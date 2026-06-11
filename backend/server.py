from fastapi import FastAPI, APIRouter, HTTPException, Request, Header, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
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

# Optional Resend
try:
    import resend  # type: ignore
except Exception:  # pragma: no cover
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

# Mongo
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("poda")

# App
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


class OrderCreateRequest(BaseModel):
    product_id: str
    size: str
    color: str
    customer: CustomerInfo
    origin_url: str  # frontend origin (window.location.origin)


class ProductPublic(BaseModel):
    id: str
    name: str
    description: str
    price: float
    currency: str
    image: str
    sizes: List[str]
    colors: List[str]


class BatchProgress(BaseModel):
    product_id: str
    total_paid: int
    current_batch_number: int
    position_in_batch: int  # how many in current open batch (0..BATCH_SIZE)
    batch_size: int
    remaining: int


# ---------------- Helpers ----------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _send_confirmation_email(order: dict) -> None:
    """Fire-and-forget email. Mock-logs if Resend is not configured."""
    subject = f"Poda - Confirmation de commande #{order['order_number']}"
    progress_text = (
        f"{order['position_in_batch']}/{BATCH_SIZE} commandes du lot en cours"
    )
    html = f"""
    <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"font-family: Arial, sans-serif; background:#FDF8F5; padding:24px;\">
      <tr><td>
        <table width=\"560\" align=\"center\" style=\"background:#fff; border:4px solid #000; padding:24px;\">
          <tr><td>
            <h1 style=\"margin:0 0 8px 0; font-size:28px; color:#000;\">Merci {order['customer']['first_name']} !</h1>
            <p style=\"margin:0 0 16px 0; color:#333;\">Votre commande Poda est confirmée.</p>
            <p style=\"margin:0 0 8px 0;\"><strong>N° de commande :</strong> {order['order_number']}</p>
            <p style=\"margin:0 0 8px 0;\"><strong>Produit :</strong> {order['product_name']} ({order['size']}, {order['color']})</p>
            <p style=\"margin:0 0 8px 0;\"><strong>Montant :</strong> {order['amount']:.2f} EUR</p>
            <hr style=\"border:none; border-top:2px dashed #000; margin:16px 0;\" />
            <p style=\"margin:0 0 8px 0; font-weight:bold;\">Progression du lot collectif</p>
            <p style=\"margin:0 0 16px 0; color:#333;\">{progress_text}. Dès que le lot atteint {BATCH_SIZE} commandes, l'ensemble est expédié au bureau de l'association.</p>
            <p style=\"margin:0;\">À très vite,<br/>L'équipe Poda</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
    """
    if not (resend and RESEND_API_KEY):
        logger.info(
            "[EMAIL MOCK] to=%s subject=%s body_len=%d",
            order["customer"]["email"],
            subject,
            len(html),
        )
        return
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [order["customer"]["email"]],
            "subject": subject,
            "html": html,
        }
        await asyncio.to_thread(resend.Emails.send, params)
        logger.info("Email sent to %s", order["customer"]["email"])
    except Exception as e:  # pragma: no cover
        logger.error("Resend email failed: %s", e)


async def _count_paid_for_product(product_id: str) -> int:
    return await db.orders.count_documents(
        {"product_id": product_id, "payment_status": "paid"}
    )


def _stripe_checkout_for(host_url: str) -> StripeCheckout:
    webhook_url = f"{host_url.rstrip('/')}/api/webhook/stripe"
    return StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)


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


@api_router.get("/progress", response_model=List[BatchProgress])
async def all_progress():
    out: List[BatchProgress] = []
    for pid in PRODUCTS:
        total_paid = await _count_paid_for_product(pid)
        position = total_paid % BATCH_SIZE
        # If position == 0 and total_paid > 0, last batch is closed; the new (next) batch starts at 0
        current_batch = (total_paid // BATCH_SIZE) + 1
        out.append(
            BatchProgress(
                product_id=pid,
                total_paid=total_paid,
                current_batch_number=current_batch,
                position_in_batch=position,
                batch_size=BATCH_SIZE,
                remaining=BATCH_SIZE - position,
            )
        )
    return out


@api_router.get("/progress/{product_id}", response_model=BatchProgress)
async def product_progress(product_id: str):
    if product_id not in PRODUCTS:
        raise HTTPException(404, "Produit introuvable")
    total_paid = await _count_paid_for_product(product_id)
    position = total_paid % BATCH_SIZE
    current_batch = (total_paid // BATCH_SIZE) + 1
    return BatchProgress(
        product_id=product_id,
        total_paid=total_paid,
        current_batch_number=current_batch,
        position_in_batch=position,
        batch_size=BATCH_SIZE,
        remaining=BATCH_SIZE - position,
    )


# ---------------- Checkout ----------------
@api_router.post("/orders/checkout")
async def create_checkout(body: OrderCreateRequest, http_request: Request):
    product = PRODUCTS.get(body.product_id)
    if not product:
        raise HTTPException(400, "Produit invalide")
    if body.size not in product["sizes"]:
        raise HTTPException(400, "Taille invalide")
    if body.color not in product["colors"]:
        raise HTTPException(400, "Couleur invalide")

    amount = float(product["price"])  # server-side authoritative
    currency = product["currency"]

    order_id = str(uuid.uuid4())
    order_number = f"PODA-{datetime.now(timezone.utc).strftime('%y%m%d')}-{order_id[:6].upper()}"

    success_url = f"{body.origin_url.rstrip('/')}/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{body.origin_url.rstrip('/')}/commander/{body.product_id}"

    host_url = str(http_request.base_url)
    sc = _stripe_checkout_for(host_url)

    metadata = {
        "order_id": order_id,
        "order_number": order_number,
        "product_id": body.product_id,
        "size": body.size,
        "color": body.color,
        "customer_email": body.customer.email,
    }

    req = CheckoutSessionRequest(
        amount=amount,
        currency=currency,
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
        "product_id": body.product_id,
        "product_name": product["name"],
        "size": body.size,
        "color": body.color,
        "amount": amount,
        "currency": currency,
        "customer": body.customer.model_dump(),
        "stripe_session_id": session.session_id,
        "payment_status": "initiated",
        "batch_number": None,
        "position_in_batch": None,
        "shipped": False,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.orders.insert_one(order_doc)

    # Also write a payment_transactions record per playbook
    await db.payment_transactions.insert_one(
        {
            "id": str(uuid.uuid4()),
            "order_id": order_id,
            "session_id": session.session_id,
            "amount": amount,
            "currency": currency,
            "metadata": metadata,
            "payment_status": "initiated",
            "status": "open",
            "created_at": now_iso(),
            "updated_at": now_iso(),
        }
    )

    return {
        "checkout_url": session.url,
        "session_id": session.session_id,
        "order_id": order_id,
        "order_number": order_number,
    }


async def _finalize_order_if_paid(session_id: str) -> Optional[dict]:
    """Look up checkout status, update order if newly paid, return order dict."""
    order = await db.orders.find_one({"stripe_session_id": session_id}, {"_id": 0})
    if not order:
        return None

    # If already paid, just return it (idempotent)
    if order.get("payment_status") == "paid":
        return order

    # Use a transient host_url to instantiate StripeCheckout (api key only needed)
    sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="https://example.com/api/webhook/stripe")
    try:
        status: CheckoutStatusResponse = await sc.get_checkout_status(session_id)
    except Exception as e:
        logger.error("get_checkout_status failed: %s", e)
        return order

    new_payment_status = status.payment_status  # 'paid', 'unpaid'
    new_status = status.status  # 'complete', 'expired', etc.

    update_doc: Dict = {
        "payment_status": new_payment_status,
        "stripe_status": new_status,
        "updated_at": now_iso(),
    }

    if new_payment_status == "paid" and order.get("payment_status") != "paid":
        # assign batch & position atomically
        product_id = order["product_id"]
        prior_paid = await _count_paid_for_product(product_id)
        batch_number = (prior_paid // BATCH_SIZE) + 1
        position_in_batch = (prior_paid % BATCH_SIZE) + 1
        update_doc["batch_number"] = batch_number
        update_doc["position_in_batch"] = position_in_batch

    await db.orders.update_one(
        {"stripe_session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": update_doc},
    )
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {
            "$set": {
                "payment_status": new_payment_status,
                "status": new_status,
                "updated_at": now_iso(),
            }
        },
    )

    refreshed = await db.orders.find_one({"stripe_session_id": session_id}, {"_id": 0})

    # Send email only on transition to paid
    if (
        refreshed
        and refreshed.get("payment_status") == "paid"
        and order.get("payment_status") != "paid"
    ):
        try:
            await _send_confirmation_email(refreshed)
        except Exception as e:  # pragma: no cover
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
        "product_id": order["product_id"],
        "product_name": order["product_name"],
        "size": order["size"],
        "color": order["color"],
        "amount": order["amount"],
        "currency": order["currency"],
        "batch_number": order.get("batch_number"),
        "position_in_batch": order.get("position_in_batch"),
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
    # Use the same finalize routine
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
    docs = (
        await db.orders.find({}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(length=1000)
    )
    return docs


@api_router.get("/admin/stats", dependencies=[Depends(require_admin)])
async def admin_stats():
    stats = []
    for pid, p in PRODUCTS.items():
        total_paid = await _count_paid_for_product(pid)
        total_orders = await db.orders.count_documents({"product_id": pid})
        revenue_doc = await db.orders.aggregate(
            [
                {"$match": {"product_id": pid, "payment_status": "paid"}},
                {"$group": {"_id": None, "sum": {"$sum": "$amount"}}},
            ]
        ).to_list(length=1)
        revenue = revenue_doc[0]["sum"] if revenue_doc else 0
        stats.append(
            {
                "product_id": pid,
                "product_name": p["name"],
                "total_paid": total_paid,
                "total_orders": total_orders,
                "revenue": revenue,
                "current_batch_number": (total_paid // BATCH_SIZE) + 1,
                "position_in_batch": total_paid % BATCH_SIZE,
                "batch_size": BATCH_SIZE,
            }
        )
    return stats


@api_router.post(
    "/admin/batches/{product_id}/ship", dependencies=[Depends(require_admin)]
)
async def ship_batch(product_id: str):
    if product_id not in PRODUCTS:
        raise HTTPException(404, "Produit introuvable")
    # mark all unshipped paid orders of this product as shipped
    result = await db.orders.update_many(
        {"product_id": product_id, "payment_status": "paid", "shipped": False},
        {"$set": {"shipped": True, "shipped_at": now_iso(), "updated_at": now_iso()}},
    )
    return {"shipped_count": result.modified_count}


# Mount router and middleware
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
