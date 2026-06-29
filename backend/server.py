from fastapi import FastAPI, APIRouter, HTTPException, Request, Header, Depends, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import base64
import uuid
import time
from collections import defaultdict
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta

import stripe

from products_catalog import PRODUCTS as SEED_PRODUCTS

try:
    import resend  # type: ignore
except Exception:
    resend = None

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# Config
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
stripe.api_key = STRIPE_API_KEY
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "poda2026")
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "20"))
BATCH_DEADLINE_DAYS = int(os.environ.get("BATCH_DEADLINE_DAYS", "28"))

if resend and RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("poda")

app = FastAPI(title="Poda API")
api_router = APIRouter(prefix="/api")

# Rate limiter léger — compatible serverless Vercel
_rate_store: Dict[str, List[float]] = defaultdict(list)

def rate_limit(key: str, max_calls: int, window_seconds: int) -> None:
    """Lève HTTPException 429 si la limite est dépassée."""
    now = time.time()
    calls = _rate_store[key]
    # Nettoie les appels hors fenêtre
    _rate_store[key] = [t for t in calls if now - t < window_seconds]
    if len(_rate_store[key]) >= max_calls:
        raise HTTPException(status_code=429, detail="Trop de requêtes — réessayez dans un moment.")
    _rate_store[key].append(now)


# ---------------- Models ----------------
class CustomerInfo(BaseModel):
    model_config = ConfigDict(extra="ignore")
    first_name: str
    last_name: str
    email: EmailStr
    phone: str
    address: str
    city: str
    postal_code: str
    country: str = "France"


class CartItem(BaseModel):
    product_id: str
    size: str
    color: str
    quantity: int = Field(ge=1, le=50)


class CheckoutRequest(BaseModel):
    items: List[CartItem]
    customer: CustomerInfo
    origin_url: str


class ProductPublic(BaseModel):
    id: str
    name: str
    description: str
    price: float
    currency: str
    image: str
    sizes: List[str]
    colors: List[str]


class GlobalProgress(BaseModel):
    total_units_paid: int
    current_batch_number: int
    position_in_batch: int
    batch_size: int
    remaining: int
    deadline_at: Optional[str] = None
    deadline_days_left: Optional[int] = None


# ---------------- Helpers ----------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _seed_products_if_empty():
    count = await db.products.count_documents({})
    if count == 0:
        for p in SEED_PRODUCTS.values():
            await db.products.insert_one({**p, "active": True, "created_at": now_iso()})
        logger.info("Seeded %d default products", len(SEED_PRODUCTS))


async def _get_product(product_id: str) -> Optional[dict]:
    return await db.products.find_one({"id": product_id, "active": True}, {"_id": 0})


async def _get_or_create_batch_deadline(batch_number: int) -> dict:
    """Récupère le doc batch (avec deadline) ou le crée si c'est la première commande du lot."""
    doc = await db.batches.find_one({"batch_number": batch_number}, {"_id": 0})
    if doc:
        return doc
    deadline = datetime.now(timezone.utc) + timedelta(days=BATCH_DEADLINE_DAYS)
    new_doc = {
        "batch_number": batch_number,
        "deadline_at": deadline.isoformat(),
        "forced_launch": False,
        "created_at": now_iso(),
    }
    await db.batches.update_one(
        {"batch_number": batch_number},
        {"$setOnInsert": new_doc},
        upsert=True,
    )
    return await db.batches.find_one({"batch_number": batch_number}, {"_id": 0})


async def _check_and_force_batch_if_overdue(batch_number: int) -> bool:
    """Si la deadline du lot est dépassée et qu'il n'est pas encore forcé, le marque comme lancé.
    Retourne True si le lot vient d'être forcé (pour déclencher la notif)."""
    doc = await db.batches.find_one({"batch_number": batch_number})
    if not doc or doc.get("forced_launch"):
        return False
    deadline = datetime.fromisoformat(doc["deadline_at"])
    if datetime.now(timezone.utc) >= deadline:
        await db.batches.update_one(
            {"batch_number": batch_number},
            {"$set": {"forced_launch": True, "forced_at": now_iso()}},
        )
        # Notifie tous les acheteurs du lot
        asyncio.create_task(_send_batch_launched_email(batch_number, reason="délai de 4 semaines écoulé"))
        return True
    return False


async def _count_units_in_batch(batch_number: int) -> int:
    """Compte les unités payées appartenant à un lot donné."""
    cursor = db.orders.aggregate(
        [
            {"$match": {"payment_status": "paid", "batch_number": batch_number}},
            {"$group": {"_id": None, "sum": {"$sum": "$total_units"}}},
        ]
    )
    docs = await cursor.to_list(length=1)
    return docs[0]["sum"] if docs else 0


async def _count_paid_units() -> int:
    """Count total paid units across all orders (global counter)."""
    cursor = db.orders.aggregate(
        [
            {"$match": {"payment_status": "paid"}},
            {"$group": {"_id": None, "sum": {"$sum": "$total_units"}}},
        ]
    )
    docs = await cursor.to_list(length=1)
    return docs[0]["sum"] if docs else 0



    """Count total paid units across all orders (global counter)."""
    cursor = db.orders.aggregate(
        [
            {"$match": {"payment_status": "paid"}},
            {"$group": {"_id": None, "sum": {"$sum": "$total_units"}}},
        ]
    )
    docs = await cursor.to_list(length=1)
    return docs[0]["sum"] if docs else 0


def _items_summary(items: List[dict]) -> str:
    return ", ".join(
        f"{i['quantity']}× {i['product_name']} ({i['size']}, {i['color']})" for i in items
    )


def _email_base(content: str) -> str:
    """Wrapper HTML email commun PODA."""
    return f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FDF8F5;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:24px 12px;">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:4px solid #000;max-width:560px;width:100%;">
      <tr><td style="padding:32px 28px;">
        <!-- Header -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>
            <td><span style="font-size:28px;font-weight:900;letter-spacing:-1px;color:#000;">PODA<span style="color:#FF6B6B;">.</span></span></td>
            <td align="right"><span style="font-size:11px;color:#999;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">by BLEEM</span></td>
          </tr>
        </table>
        <hr style="border:none;border-top:4px solid #000;margin:0 0 24px 0;">
        {content}
        <hr style="border:none;border-top:2px dashed #000;margin:24px 0;">
        <p style="margin:0;font-size:12px;color:#999;text-align:center;">
          PODA by BLEEM · 3 rue des Noisetiers, 72190 Sargé-lès-le-Mans<br>
          <a href="https://poda.bleem-co.fr" style="color:#999;">poda.bleem-co.fr</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>"""


async def _send_confirmation_email(order: dict) -> None:
    """Email de confirmation de commande envoyé immédiatement après paiement."""
    is_express = any(it.get("product_id") == "__express__" for it in order.get("items", []))
    summary_lines = "".join([
        f"<tr><td style='padding:6px 0;border-bottom:1px solid #eee;'>{it['quantity']}× {it.get('product_name', it.get('name', ''))} {'— ' + it['size'] + ' / ' + it['color'] if it.get('size') and it['size'] != '—' else ''}</td>"
        f"<td style='padding:6px 0;border-bottom:1px solid #eee;text-align:right;font-weight:bold;'>{it['unit_price'] * it['quantity']:.2f}€</td></tr>"
        for it in order.get("items", [])
    ])

    # Récupère la deadline du lot en cours
    batch_number = order.get("batch_number", 1)
    batch_doc = await db.batches.find_one({"batch_number": batch_number}, {"_id": 0})
    deadline_text = ""
    if batch_doc and batch_doc.get("deadline_at") and not is_express:
        deadline = datetime.fromisoformat(batch_doc["deadline_at"])
        deadline_fr = deadline.strftime("%d/%m/%Y")
        deadline_text = f"""
        <tr><td colspan="2" style="padding-top:16px;">
          <div style="background:#FBEA8C;border:2px solid #000;padding:14px;border-radius:2px;">
            <p style="margin:0 0 6px 0;font-weight:bold;font-size:14px;">📦 Quand serez-vous livré ?</p>
            <p style="margin:0;font-size:13px;color:#333;">
              Votre commande part en production dès que le lot atteint <strong>20 pièces</strong>,
              ou automatiquement le <strong>{deadline_fr}</strong> même si le lot n'est pas complet.
              Livraison au bureau de l'association sous 10 à 15 jours ouvrés après le lancement.
            </p>
          </div>
        </td></tr>"""
    elif is_express:
        deadline_text = f"""
        <tr><td colspan="2" style="padding-top:16px;">
          <div style="background:#000;padding:14px;border-radius:2px;">
            <p style="margin:0 0 6px 0;font-weight:bold;font-size:14px;color:#fff;">🚀 Livraison express à domicile</p>
            <p style="margin:0;font-size:13px;color:#ccc;">
              Votre commande est traitée en priorité et expédiée directement chez vous sous <strong>8 jours ouvrés</strong>.
              Vous recevrez un email de suivi dès l'expédition.
            </p>
          </div>
        </td></tr>"""

    content = f"""
    <h1 style="margin:0 0 4px 0;font-size:24px;font-weight:900;">Merci {order['customer']['first_name']} ! 🎉</h1>
    <p style="margin:0 0 24px 0;color:#666;font-size:14px;">Votre commande PODA est confirmée.</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        <td style="font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#999;padding-bottom:8px;">Commande</td>
        <td style="font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#999;padding-bottom:8px;text-align:right;">#{order['order_number']}</td>
      </tr>
      {summary_lines}
      <tr>
        <td style="padding-top:12px;font-weight:bold;font-size:16px;">Total</td>
        <td style="padding-top:12px;font-weight:bold;font-size:16px;text-align:right;">{order['total_amount']:.2f}€</td>
      </tr>
      {deadline_text}
    </table>
    """

    subject = f"✅ Commande #{order['order_number']} confirmée — PODA by BLEEM"
    html = _email_base(content)

    if not (resend and RESEND_API_KEY):
        logger.info("[EMAIL MOCK] to=%s subject=%s", order["customer"]["email"], subject)
        return
    try:
        await asyncio.to_thread(
            resend.Emails.send,
            {"from": SENDER_EMAIL, "to": [order["customer"]["email"]], "subject": subject, "html": html},
        )
        logger.info("Email confirmation envoyé à %s", order["customer"]["email"])
    except Exception as e:
        logger.error("Resend email failed: %s", e)


async def _send_batch_launched_email(batch_number: int, reason: str = "20 unités atteintes") -> None:
    """Email envoyé à tous les acheteurs du lot + email bureau asso avec montant généré."""
    orders = await db.orders.find(
        {"payment_status": "paid", "batch_number": batch_number},
        {"_id": 0}
    ).to_list(None)

    if not orders:
        return

    # Calcul de la marge totale du lot (hors express)
    marge_totale = 0.0
    total_pieces = 0
    for o in orders:
        for it in o.get("items", []):
            if it.get("product_id") != "__express__":
                marge_totale += it.get("marge_line", 0)
                total_pieces += it.get("quantity", 0)
    marge_totale = round(marge_totale, 2)

    if not (resend and RESEND_API_KEY):
        logger.info("[EMAIL MOCK] batch_launched lot #%d — %d destinataires — marge: %.2f€", batch_number, len(orders), marge_totale)
        return

    # Email aux acheteurs individuels
    for order in orders:
        is_express = any(it.get("product_id") == "__express__" for it in order.get("items", []))
        if is_express:
            continue

        summary_lines = "".join([
            f"<tr><td style='padding:6px 0;border-bottom:1px solid #eee;'>{it['quantity']}× {it.get('product_name', '')} {'— ' + it['size'] + ' / ' + it['color'] if it.get('size') and it['size'] != '—' else ''}</td></tr>"
            for it in order.get("items", []) if it.get("product_id") != "__express__"
        ])

        content = f"""
        <h1 style="margin:0 0 4px 0;font-size:24px;font-weight:900;">C'est parti {order['customer']['first_name']} ! 🚀</h1>
        <p style="margin:0 0 24px 0;color:#666;font-size:14px;">Votre lot PODA est lancé en production.</p>

        <div style="background:#FBEA8C;border:2px solid #000;padding:16px;margin-bottom:20px;">
          <p style="margin:0 0 8px 0;font-weight:bold;font-size:15px;">Lot #{batch_number} — {reason}</p>
          <p style="margin:0;font-size:13px;color:#333;">
            Votre commande est en cours de fabrication. Livraison au bureau de l'association
            sous <strong>10 à 15 jours ouvrés</strong>.
          </p>
        </div>

        <p style="margin:0 0 8px 0;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#999;">Votre commande</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          {summary_lines}
          <tr>
            <td style="padding-top:12px;font-weight:bold;">Total payé</td>
            <td style="padding-top:12px;font-weight:bold;text-align:right;">{order['total_amount']:.2f}€</td>
          </tr>
        </table>
        """

        subject = f"🚀 Votre lot PODA #{batch_number} est en production !"
        html = _email_base(content)
        try:
            await asyncio.to_thread(
                resend.Emails.send,
                {"from": SENDER_EMAIL, "to": [order["customer"]["email"]], "subject": subject, "html": html},
            )
            logger.info("Email batch_launched envoyé à %s", order["customer"]["email"])
        except Exception as e:
            logger.error("Resend batch email failed for %s: %s", order["customer"]["email"], e)

    # Email de notification au bureau de l'asso
    branding = await db.settings.find_one({"_id": "branding"})
    notification_email = branding.get("notification_email") if branding else None
    asso_name = branding.get("association_name", "votre association") if branding else "votre association"

    if notification_email:
        orders_rows = ""
        for o in orders:
            items_str = ", ".join([
                f"{it['quantity']}x {it.get('product_name', '')}"
                for it in o.get("items", [])
                if it.get("product_id") != "__express__"
            ])
            orders_rows += (
                f"<tr>"
                f"<td style='padding:4px 8px;border-bottom:1px solid #eee;'>{o['customer']['first_name']} {o['customer']['last_name']}</td>"
                f"<td style='padding:4px 8px;border-bottom:1px solid #eee;'>{items_str}</td>"
                f"<td style='padding:4px 8px;border-bottom:1px solid #eee;text-align:right;'>{o['total_amount']:.2f}€</td>"
                f"</tr>"
            )

        content_asso = f"""
        <h1 style="margin:0 0 4px 0;font-size:24px;font-weight:900;">🎉 Lot #{batch_number} lancé en production !</h1>
        <p style="margin:0 0 24px 0;color:#666;font-size:14px;">Récapitulatif du lot collectif de {asso_name}</p>

        <div style="background:#FBEA8C;border:2px solid #000;padding:16px;margin-bottom:20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-weight:bold;font-size:13px;">{total_pieces} pièces produites</td>
              <td style="font-weight:bold;font-size:13px;text-align:right;">{reason}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top:12px;font-size:20px;font-weight:900;color:#000;">
                Montant généré pour l'association : <span style="color:#FF6B6B;">{marge_totale:.2f}€</span>
              </td>
            </tr>
          </table>
        </div>

        <p style="margin:0 0 8px 0;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#999;">Détail des commandes du lot</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr style="background:#000;color:#fff;">
            <td style="padding:6px 8px;font-size:11px;font-weight:bold;">Membre</td>
            <td style="padding:6px 8px;font-size:11px;font-weight:bold;">Articles</td>
            <td style="padding:6px 8px;font-size:11px;font-weight:bold;text-align:right;">Montant</td>
          </tr>
          {orders_rows}
        </table>

        <p style="margin:16px 0 0;font-size:12px;color:#666;">
          Livraison prévue au bureau de l'association sous 10 à 15 jours ouvrés.
        </p>
        """

        subject_asso = f"🚀 Lot PODA #{batch_number} en production — {marge_totale:.2f}€ générés pour {asso_name}"
        html_asso = _email_base(content_asso)
        try:
            await asyncio.to_thread(
                resend.Emails.send,
                {"from": SENDER_EMAIL, "to": [notification_email], "subject": subject_asso, "html": html_asso},
            )
            logger.info("Email bureau asso envoyé à %s — marge: %.2f€", notification_email, marge_totale)
        except Exception as e:
            logger.error("Resend asso notification failed: %s", e)

# ---------------- Public routes ----------------
@api_router.get("/")
async def root():
    return {"message": "Poda API up", "batch_size": BATCH_SIZE}


@api_router.get("/products", response_model=List[ProductPublic])
async def list_products():
    docs = await db.products.find({"active": True}, {"_id": 0}).sort("created_at", 1).to_list(length=200)
    return [ProductPublic(**d) for d in docs]


@api_router.get("/products/{product_id}", response_model=ProductPublic)
async def get_product(product_id: str):
    p = await _get_product(product_id)
    if not p:
        raise HTTPException(404, "Produit introuvable")
    return ProductPublic(**p)


@api_router.get("/progress", response_model=GlobalProgress)
async def global_progress():
    total = await _count_paid_units()
    position = total % BATCH_SIZE
    current = (total // BATCH_SIZE) + 1

    deadline_at = None
    deadline_days_left = None

    # Le lot en cours n'a une deadline que si au moins une commande a été payée dedans
    if position > 0:
        batch_doc = await db.batches.find_one({"batch_number": current}, {"_id": 0})
        if batch_doc:
            # Vérifie si la deadline est dépassée → force le lancement automatiquement
            await _check_and_force_batch_if_overdue(current)
            batch_doc = await db.batches.find_one({"batch_number": current}, {"_id": 0})
            deadline_at = batch_doc.get("deadline_at")
            if deadline_at and not batch_doc.get("forced_launch"):
                deadline = datetime.fromisoformat(deadline_at)
                delta = deadline - datetime.now(timezone.utc)
                deadline_days_left = max(0, delta.days)

    return GlobalProgress(
        total_units_paid=total,
        current_batch_number=current,
        position_in_batch=position,
        batch_size=BATCH_SIZE,
        remaining=BATCH_SIZE - position,
        deadline_at=deadline_at,
        deadline_days_left=deadline_days_left,
    )


@api_router.get("/settings/branding")
async def get_branding():
    """Public branding (logo + association name) used by all pages."""
    doc = await db.settings.find_one({"_id": "branding"}, {"_id": 0}) or {}
    # Génère un token asso si pas encore créé
    if not doc.get("asso_token"):
        token = str(uuid.uuid4()).replace("-", "")[:24]
        await db.settings.update_one(
            {"_id": "branding"},
            {"$set": {"asso_token": token}},
            upsert=True,
        )
        doc["asso_token"] = token
    return {
        "logo_data_url": doc.get("logo_data_url"),
        "association_name": doc.get("association_name", "Poda"),
        "notification_email": doc.get("notification_email"),
        "asso_token": doc.get("asso_token"),
    }


@api_router.get("/asso/{token}")
async def asso_view(token: str):
    """Vue publique pour le responsable asso — lecture seule, sans prix."""
    branding = await db.settings.find_one({"_id": "branding"})
    if not branding or branding.get("asso_token") != token:
        raise HTTPException(403, "Lien invalide ou expiré.")

    orders = await db.orders.find(
        {"payment_status": "paid"},
        {"_id": 0, "order_number": 1, "customer": 1, "items": 1, "batch_number": 1, "created_at": 1, "shipped": 1}
    ).sort("created_at", -1).to_list(length=500)

    # Nettoie les items — pas de prix exposés
    for o in orders:
        o["items"] = [
            {
                "product_name": it.get("product_name", ""),
                "quantity": it.get("quantity", 1),
                "size": it.get("size", "—"),
                "color": it.get("color", "—"),
            }
            for it in o.get("items", [])
            if it.get("product_id") != "__express__"
        ]

    total_units = await _count_paid_units()
    batch_number = (total_units // BATCH_SIZE) + 1
    position_in_batch = total_units % BATCH_SIZE
    batch_doc = await db.batches.find_one({"batch_number": batch_number}, {"_id": 0})

    return {
        "association_name": branding.get("association_name", "Mon Association"),
        "logo_data_url": branding.get("logo_data_url"),
        "orders": orders,
        "total_units": total_units,
        "batch_number": batch_number,
        "position_in_batch": position_in_batch,
        "batch_size": BATCH_SIZE,
        "deadline_at": batch_doc.get("deadline_at") if batch_doc else None,
    }


# ---------------- Checkout ----------------
@api_router.post("/orders/checkout")
async def create_checkout(body: CheckoutRequest, http_request: Request):
    ip = http_request.client.host if http_request.client else "unknown"
    rate_limit(f"checkout:{ip}", max_calls=10, window_seconds=60)
    if not body.items:
        raise HTTPException(400, "Panier vide")

    normalized_items: List[dict] = []
    total_amount = 0.0
    total_units = 0
    has_unlock = False
    for it in body.items:
        # Item spécial livraison express à domicile
        if it.product_id == "__express__":
            has_unlock = True
            unlock_amount = 20.0
            total_amount += unlock_amount
            normalized_items.append({
                "product_id": "__express__",
                "product_name": "🚀 Livraison express à domicile",
                "size": "—",
                "color": "—",
                "quantity": 1,
                "unit_price": unlock_amount,
                "line_total": unlock_amount,
                "is_express": True,
            })
            continue
        product = await _get_product(it.product_id)
        if not product:
            raise HTTPException(400, f"Produit invalide: {it.product_id}")
        if it.size not in product["sizes"]:
            raise HTTPException(400, f"Taille invalide pour {product['name']}")
        if it.color not in product["colors"]:
            raise HTTPException(400, f"Couleur invalide pour {product['name']}")
        if it.quantity < 1:
            raise HTTPException(400, "Quantité invalide")
        line_amount = float(product["price"]) * it.quantity
        total_amount += line_amount
        total_units += it.quantity
        price_asso = float(product.get("price_asso", 0))
        normalized_items.append({
            "product_id": it.product_id,
            "product_name": product["name"],
            "size": it.size,
            "color": it.color,
            "quantity": it.quantity,
            "unit_price": float(product["price"]),
            "price_asso": price_asso,
            "marge_line": round((float(product["price"]) - price_asso) * it.quantity, 2),
            "line_total": line_amount,
        })

    total_amount = round(total_amount, 2)

    order_id = str(uuid.uuid4())
    order_number = f"PODA-{datetime.now(timezone.utc).strftime('%y%m%d')}-{order_id[:6].upper()}"

    success_url = f"{body.origin_url.rstrip('/')}/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{body.origin_url.rstrip('/')}/cart"

    metadata = {
        "order_id": order_id,
        "order_number": order_number,
        "customer_email": body.customer.email,
        "total_units": str(total_units),
    }

    try:
        stripe_line_items = []
        for item in normalized_items:
            if item["product_id"] == "__express__":
                stripe_line_items.append({
                    "price_data": {
                        "currency": "eur",
                        "unit_amount": 2000,
                        "product_data": {"name": "🚀 Livraison express à domicile — je sors du lot collectif"},
                    },
                    "quantity": 1,
                })
            else:
                stripe_line_items.append({
                    "price_data": {
                        "currency": "eur",
                        "unit_amount": round(item["unit_price"] * 100),
                        "product_data": {
                            "name": f"{item['product_name']} — {item['size']} / {item['color']}",
                        },
                    },
                    "quantity": item["quantity"],
                })
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=stripe_line_items,
            success_url=success_url,
            cancel_url=cancel_url,
            metadata=metadata,
        )
    except Exception as e:
        logger.exception("Stripe session creation failed")
        raise HTTPException(502, f"Erreur Stripe: {e}")

    order_doc = {
        "id": order_id,
        "order_number": order_number,
        "items": normalized_items,
        "total_amount": total_amount,
        "total_units": total_units,
        "currency": "eur",
        "customer": body.customer.model_dump(),
        "stripe_session_id": session.id,
        "payment_status": "initiated",
        "batch_number": None,
        "start_position": None,
        "end_position": None,
        "shipped": False,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.orders.insert_one(order_doc)
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "session_id": session.id,
        "amount": total_amount,
        "currency": "eur",
        "metadata": metadata,
        "payment_status": "initiated",
        "status": "open",
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })

    return {
        "checkout_url": session.url,
        "session_id": session.id,
        "order_id": order_id,
        "order_number": order_number,
    }


async def _finalize_order_if_paid(session_id: str) -> Optional[dict]:
    order = await db.orders.find_one({"stripe_session_id": session_id}, {"_id": 0})
    if not order:
        return None
    if order.get("payment_status") == "paid":
        return order

    try:
        status = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id)
    except Exception as e:
        logger.error("get_checkout_status failed: %s", e)
        return order

    update_doc: Dict = {
        "payment_status": status.payment_status,
        "stripe_status": status.status,
        "updated_at": now_iso(),
    }

    if status.payment_status == "paid":
        prior_units = await _count_paid_units()
        start_position = prior_units + 1  # 1-indexed in global counter
        end_position = prior_units + int(order["total_units"])
        # batch_number based on start (an order can span batches; we tag the starting one)
        batch_number = ((start_position - 1) // BATCH_SIZE) + 1
        update_doc["batch_number"] = batch_number
        update_doc["start_position"] = start_position
        update_doc["end_position"] = end_position
        # Crée la deadline de 4 semaines si c'est la première commande payée de ce lot
        await _get_or_create_batch_deadline(batch_number)
        # Vérifie si cette commande complète le lot (atteint les 20 pièces)
        new_total = prior_units + int(order["total_units"])
        if new_total % BATCH_SIZE == 0:
            asyncio.create_task(_send_batch_launched_email(batch_number, reason="20 unités atteintes"))

    await db.orders.update_one(
        {"stripe_session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": update_doc},
    )
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "payment_status": status.payment_status,
            "status": status.status,
            "updated_at": now_iso(),
        }},
    )

    refreshed = await db.orders.find_one({"stripe_session_id": session_id}, {"_id": 0})
    if refreshed and refreshed.get("payment_status") == "paid" and order.get("payment_status") != "paid":
        try:
            await _send_confirmation_email(refreshed)
        except Exception as e:
            logger.error("Email send failed: %s", e)
    return refreshed


@api_router.get("/orders/status/{session_id}")
async def order_status(session_id: str):
    order = await _finalize_order_if_paid(session_id)
    if not order:
        raise HTTPException(404, "Commande introuvable")
    return {
        "order_number": order["order_number"],
        "payment_status": order["payment_status"],
        "stripe_status": order.get("stripe_status"),
        "items": order["items"],
        "total_amount": order["total_amount"],
        "total_units": order["total_units"],
        "currency": order["currency"],
        "batch_number": order.get("batch_number"),
        "start_position": order.get("start_position"),
        "end_position": order.get("end_position"),
        "batch_size": BATCH_SIZE,
    }


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    try:
        event = stripe.Webhook.construct_event(body, signature, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        logger.error("Webhook handling failed: %s", e)
        raise HTTPException(400, "Webhook invalide")
    session_obj = event.get("data", {}).get("object", {})
    session_id = session_obj.get("id")
    if session_id:
        await _finalize_order_if_paid(session_id)
    return {"received": True}


# ---------------- Admin ----------------
def require_admin(x_admin_password: Optional[str] = Header(default=None)):
    if not x_admin_password or x_admin_password != ADMIN_PASSWORD:
        raise HTTPException(401, "Accès admin refusé")
    return True


@api_router.post("/admin/login")
async def admin_login(request: Request, payload: Dict[str, str]):
    ip = request.client.host if request.client else "unknown"
    rate_limit(f"login:{ip}", max_calls=5, window_seconds=60)
    if payload.get("password") != ADMIN_PASSWORD:
        raise HTTPException(401, "Mot de passe incorrect")
    return {"ok": True}


@api_router.get("/admin/orders", dependencies=[Depends(require_admin)])
async def admin_orders():
    return await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(length=1000)


@api_router.delete("/admin/orders/{order_number}", dependencies=[Depends(require_admin)])
async def admin_cancel_order(order_number: str):
    order = await db.orders.find_one({"order_number": order_number})
    if not order:
        raise HTTPException(404, "Commande introuvable")
    if order.get("payment_status") == "paid":
        raise HTTPException(400, "Impossible d'annuler une commande payée non remboursée — utilisez le remboursement.")
    result = await db.orders.delete_one({"order_number": order_number})
    if result.deleted_count == 0:
        raise HTTPException(500, "Erreur lors de la suppression")
    return {"ok": True, "deleted": order_number}


@api_router.patch("/admin/orders/{order_number}/status", dependencies=[Depends(require_admin)])
async def admin_update_order_status(order_number: str, body: Dict[str, str]):
    """Change le statut d'une commande manuellement (ex: paid → cancelled, refunded)."""
    new_status = body.get("status", "").strip()
    allowed = {"cancelled", "refunded", "paid", "unpaid"}
    if new_status not in allowed:
        raise HTTPException(400, f"Statut invalide. Valeurs autorisées : {', '.join(allowed)}")
    order = await db.orders.find_one({"order_number": order_number})
    if not order:
        raise HTTPException(404, "Commande introuvable")
    await db.orders.update_one(
        {"order_number": order_number},
        {"$set": {"payment_status": new_status, "status_updated_at": now_iso(), "status_updated_by": "admin"}}
    )
    return {"ok": True, "order_number": order_number, "status": new_status}


async def admin_refund_order(order_number: str):
    """Rembourse une commande payée via Stripe et met à jour son statut en base."""
    order = await db.orders.find_one({"order_number": order_number})
    if not order:
        raise HTTPException(404, "Commande introuvable")
    if order.get("payment_status") != "paid":
        raise HTTPException(400, "Seules les commandes payées peuvent être remboursées.")
    if order.get("payment_status") == "refunded":
        raise HTTPException(400, "Cette commande a déjà été remboursée.")

    # Récupère le payment_intent depuis la session Stripe
    session_id = order.get("stripe_session_id")
    if not session_id:
        raise HTTPException(400, "Session Stripe introuvable pour cette commande.")
    try:
        session = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id)
        payment_intent_id = session.payment_intent
        if not payment_intent_id:
            raise HTTPException(400, "Payment intent introuvable — remboursez manuellement depuis Stripe.")
        refund = await asyncio.to_thread(stripe.Refund.create, **{"payment_intent": payment_intent_id})
    except stripe.error.StripeError as e:
        raise HTTPException(400, f"Erreur Stripe : {str(e)}")

    # Met à jour le statut en base
    await db.orders.update_one(
        {"order_number": order_number},
        {"$set": {"payment_status": "refunded", "refunded_at": now_iso(), "stripe_refund_id": refund.id}}
    )
    return {"ok": True, "refund_id": refund.id, "amount": refund.amount / 100}


@api_router.get("/admin/stats", dependencies=[Depends(require_admin)])
async def admin_stats():
    total_units = await _count_paid_units()
    revenue_doc = await db.orders.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "sum": {"$sum": "$total_amount"}}},
    ]).to_list(length=1)
    revenue = revenue_doc[0]["sum"] if revenue_doc else 0
    total_orders_paid = await db.orders.count_documents({"payment_status": "paid"})
    total_orders = await db.orders.count_documents({})

    # Per-product breakdown (sum of qty)
    per_product_cursor = db.orders.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.product_id",
            "units": {"$sum": "$items.quantity"},
            "name": {"$first": "$items.product_name"},
        }},
    ])
    per_product = []
    async for doc in per_product_cursor:
        per_product.append({"product_id": doc["_id"], "product_name": doc["name"], "units": doc["units"]})

    current_batch_number = (total_units // BATCH_SIZE) + 1
    batch_doc = await db.batches.find_one({"batch_number": current_batch_number}, {"_id": 0})

    return {
        "total_units_paid": total_units,
        "total_orders_paid": total_orders_paid,
        "total_orders": total_orders,
        "revenue": revenue,
        "batch_size": BATCH_SIZE,
        "current_batch_number": current_batch_number,
        "position_in_batch": total_units % BATCH_SIZE,
        "per_product": per_product,
        "batch_deadline_at": batch_doc.get("deadline_at") if batch_doc else None,
        "batch_forced_launch": batch_doc.get("forced_launch", False) if batch_doc else False,
    }


@api_router.post("/admin/batches/{batch_number}/ship", dependencies=[Depends(require_admin)])
async def ship_batch(batch_number: int):
    result = await db.orders.update_many(
        {"batch_number": batch_number, "payment_status": "paid", "shipped": False},
        {"$set": {"shipped": True, "shipped_at": now_iso(), "updated_at": now_iso()}},
    )
    return {"shipped_count": result.modified_count, "batch_number": batch_number}


@api_router.post("/admin/settings/branding", dependencies=[Depends(require_admin)])
async def update_branding(
    logo: Optional[UploadFile] = File(default=None),
    association_name: Optional[str] = Header(default=None, alias="X-Asso-Name"),
    notification_email: Optional[str] = Header(default=None, alias="X-Notification-Email"),
):
    update: Dict = {"updated_at": now_iso()}
    if logo is not None:
        contents = await logo.read()
        if len(contents) > 2 * 1024 * 1024:
            raise HTTPException(400, "Logo trop volumineux (max 2 Mo)")
        mime = logo.content_type or "image/png"
        b64 = base64.b64encode(contents).decode("utf-8")
        update["logo_data_url"] = f"data:{mime};base64,{b64}"
    if association_name:
        update["association_name"] = association_name.strip()
    if notification_email:
        update["notification_email"] = notification_email.strip().lower()
    if len(update) == 1:
        raise HTTPException(400, "Aucune donnée à mettre à jour")
    await db.settings.update_one(
        {"_id": "branding"}, {"$set": update}, upsert=True
    )
    doc = await db.settings.find_one({"_id": "branding"}, {"_id": 0})
    return doc


@api_router.delete("/admin/settings/logo", dependencies=[Depends(require_admin)])
async def delete_logo():
    await db.settings.update_one(
        {"_id": "branding"}, {"$unset": {"logo_data_url": ""}}
    )
    return {"ok": True}


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "https://poda-frontend-mu.vercel.app").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@api_router.get("/admin/products", dependencies=[Depends(require_admin)])
async def admin_list_products():
    return await db.products.find({}, {"_id": 0}).sort("created_at", 1).to_list(length=200)


class ProductUpsert(BaseModel):
    id: Optional[str] = None
    name: str
    description: str = ""
    price: float = Field(gt=0)
    price_asso: float = Field(default=0.0, ge=0)
    image: str = ""
    image_verso: str = ""
    sizes: List[str] = Field(default_factory=lambda: ["Unique"])
    colors: List[str] = Field(default_factory=lambda: ["Standard"])
    active: bool = True


@api_router.post("/admin/products", dependencies=[Depends(require_admin)])
async def admin_create_product(body: ProductUpsert):
    pid = (body.id or body.name.lower().replace(" ", "-"))[:40]
    if await db.products.find_one({"id": pid}):
        raise HTTPException(400, "Cet identifiant existe déjà, choisissez-en un autre")
    doc = {
        "id": pid,
        "name": body.name,
        "description": body.description,
        "price": float(body.price),
        "price_asso": float(body.price_asso),
        "currency": "eur",
        "image": body.image or "https://images.pexels.com/photos/12025472/pexels-photo-12025472.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        "image_verso": body.image_verso or "",
        "sizes": body.sizes or ["Unique"],
        "colors": body.colors or ["Standard"],
        "active": body.active,
        "created_at": now_iso(),
    }
    await db.products.insert_one(doc)
    return await db.products.find_one({"id": pid}, {"_id": 0})


@api_router.put("/admin/products/{product_id}", dependencies=[Depends(require_admin)])
async def admin_update_product(product_id: str, body: ProductUpsert):
    existing = await db.products.find_one({"id": product_id})
    if not existing:
        raise HTTPException(404, "Produit introuvable")
    update = {
        "name": body.name,
        "description": body.description,
        "price": float(body.price),
        "price_asso": float(body.price_asso),
        "image": body.image or existing.get("image"),
        "image_verso": body.image_verso if body.image_verso is not None else existing.get("image_verso", ""),
        "sizes": body.sizes or ["Unique"],
        "colors": body.colors or ["Standard"],
        "active": body.active,
        "updated_at": now_iso(),
    }
    await db.products.update_one({"id": product_id}, {"$set": update})
    return await db.products.find_one({"id": product_id}, {"_id": 0})


@api_router.delete("/admin/products/{product_id}", dependencies=[Depends(require_admin)])
async def admin_delete_product(product_id: str):
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Produit introuvable")
    return {"ok": True}


@app.on_event("startup")
async def on_startup():
    await _seed_products_if_empty()


app.include_router(api_router)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
