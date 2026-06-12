from fastapi import FastAPI, APIRouter, HTTPException, Request, Header, Depends, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import base64
import uuid
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict
from datetime import datetime, timezone

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    CheckoutStatusResponse,
)

from products_catalog import PRODUCTS

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
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "poda2026")
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "20"))

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


# ---------------- Helpers ----------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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


def _items_summary(items: List[dict]) -> str:
    return ", ".join(
        f"{i['quantity']}× {i['product_name']} ({i['size']}, {i['color']})" for i in items
    )


async def _send_confirmation_email(order: dict) -> None:
    subject = f"Poda - Confirmation de commande #{order['order_number']}"
    summary = _items_summary(order["items"])
    pos_start = order.get("start_position")
    pos_end = order.get("end_position")
    progress_text = (
        f"Positions {pos_start} à {pos_end} dans le lot collectif (lot de {BATCH_SIZE} unités)"
        if pos_start
        else ""
    )
    html = f"""
    <table width=\"100%\" style=\"font-family:Arial,sans-serif;background:#FDF8F5;padding:24px;\">
      <tr><td>
        <table width=\"560\" align=\"center\" style=\"background:#fff;border:4px solid #000;padding:24px;\">
          <tr><td>
            <h1 style=\"margin:0 0 8px 0;font-size:28px;color:#000;\">Merci {order['customer']['first_name']} !</h1>
            <p style=\"margin:0 0 16px 0;color:#333;\">Votre commande Poda est confirmée.</p>
            <p style=\"margin:0 0 8px 0;\"><strong>N°:</strong> {order['order_number']}</p>
            <p style=\"margin:0 0 8px 0;\"><strong>Articles:</strong> {summary}</p>
            <p style=\"margin:0 0 8px 0;\"><strong>Total:</strong> {order['total_amount']:.2f} EUR</p>
            <hr style=\"border:none;border-top:2px dashed #000;margin:16px 0;\" />
            <p style=\"margin:0 0 8px 0;font-weight:bold;\">Progression du lot collectif</p>
            <p style=\"margin:0 0 16px 0;color:#333;\">{progress_text}. Dès que le lot atteint {BATCH_SIZE} unités, l'ensemble est expédié au bureau Poda.</p>
            <p style=\"margin:0;\">À très vite,<br/>L'équipe Poda</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
    """
    if not (resend and RESEND_API_KEY):
        logger.info(
            "[EMAIL MOCK] to=%s subject=%s body_len=%d",
            order["customer"]["email"], subject, len(html),
        )
        return
    try:
        await asyncio.to_thread(
            resend.Emails.send,
            {"from": SENDER_EMAIL, "to": [order["customer"]["email"]], "subject": subject, "html": html},
        )
    except Exception as e:
        logger.error("Resend email failed: %s", e)


# ---------------- Public routes ----------------
@api_router.get("/")
async def root():
    return {"message": "Poda API up", "batch_size": BATCH_SIZE}


@api_router.get("/products", response_model=List[ProductPublic])
async def list_products():
    return [ProductPublic(**p) for p in PRODUCTS.values()]


@api_router.get("/products/{product_id}", response_model=ProductPublic)
async def get_product(product_id: str):
    p = PRODUCTS.get(product_id)
    if not p:
        raise HTTPException(404, "Produit introuvable")
    return ProductPublic(**p)


@api_router.get("/progress", response_model=GlobalProgress)
async def global_progress():
    total = await _count_paid_units()
    position = total % BATCH_SIZE
    current = (total // BATCH_SIZE) + 1
    return GlobalProgress(
        total_units_paid=total,
        current_batch_number=current,
        position_in_batch=position,
        batch_size=BATCH_SIZE,
        remaining=BATCH_SIZE - position,
    )


@api_router.get("/settings/branding")
async def get_branding():
    """Public branding (logo + association name) used by all pages."""
    doc = await db.settings.find_one({"_id": "branding"}, {"_id": 0}) or {}
    return {
        "logo_data_url": doc.get("logo_data_url"),
        "association_name": doc.get("association_name", "Poda"),
    }


# ---------------- Checkout ----------------
@api_router.post("/orders/checkout")
async def create_checkout(body: CheckoutRequest, http_request: Request):
    if not body.items:
        raise HTTPException(400, "Panier vide")

    normalized_items: List[dict] = []
    total_amount = 0.0
    total_units = 0
    for it in body.items:
        product = PRODUCTS.get(it.product_id)
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
        normalized_items.append({
            "product_id": it.product_id,
            "product_name": product["name"],
            "size": it.size,
            "color": it.color,
            "quantity": it.quantity,
            "unit_price": float(product["price"]),
            "line_total": line_amount,
        })

    total_amount = round(total_amount, 2)

    order_id = str(uuid.uuid4())
    order_number = f"PODA-{datetime.now(timezone.utc).strftime('%y%m%d')}-{order_id[:6].upper()}"

    success_url = f"{body.origin_url.rstrip('/')}/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{body.origin_url.rstrip('/')}/cart"

    host_url = str(http_request.base_url)
    sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host_url.rstrip('/')}/api/webhook/stripe")

    metadata = {
        "order_id": order_id,
        "order_number": order_number,
        "customer_email": body.customer.email,
        "total_units": str(total_units),
    }

    req = CheckoutSessionRequest(
        amount=total_amount,
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    try:
        session: CheckoutSessionResponse = await sc.create_checkout_session(req)
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
        "stripe_session_id": session.session_id,
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
        "session_id": session.session_id,
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
        "session_id": session.session_id,
        "order_id": order_id,
        "order_number": order_number,
    }


async def _finalize_order_if_paid(session_id: str) -> Optional[dict]:
    order = await db.orders.find_one({"stripe_session_id": session_id}, {"_id": 0})
    if not order:
        return None
    if order.get("payment_status") == "paid":
        return order

    sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="https://example.com/api/webhook/stripe")
    try:
        status: CheckoutStatusResponse = await sc.get_checkout_status(session_id)
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
    sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="https://example.com/api/webhook/stripe")
    try:
        event = await sc.handle_webhook(body, signature)
    except Exception as e:
        logger.error("Webhook handling failed: %s", e)
        raise HTTPException(400, "Webhook invalide")
    if event and getattr(event, "session_id", None):
        await _finalize_order_if_paid(event.session_id)
    return {"received": True}


# ---------------- Admin ----------------
def require_admin(x_admin_password: Optional[str] = Header(default=None)):
    if not x_admin_password or x_admin_password != ADMIN_PASSWORD:
        raise HTTPException(401, "Accès admin refusé")
    return True


@api_router.post("/admin/login")
async def admin_login(payload: Dict[str, str]):
    if payload.get("password") != ADMIN_PASSWORD:
        raise HTTPException(401, "Mot de passe incorrect")
    return {"ok": True}


@api_router.get("/admin/orders", dependencies=[Depends(require_admin)])
async def admin_orders():
    return await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(length=1000)


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

    return {
        "total_units_paid": total_units,
        "total_orders_paid": total_orders_paid,
        "total_orders": total_orders,
        "revenue": revenue,
        "batch_size": BATCH_SIZE,
        "current_batch_number": (total_units // BATCH_SIZE) + 1,
        "position_in_batch": total_units % BATCH_SIZE,
        "per_product": per_product,
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


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
