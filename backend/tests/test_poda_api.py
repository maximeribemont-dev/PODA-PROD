"""Backend integration tests for Poda v2 API (multi-item cart, global counter, branding)."""
import io
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://merch-pod-shop.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_PASSWORD = "poda2026"
ADMIN_H = {"X-Admin-Password": ADMIN_PASSWORD}

PRODUCT_IDS = {"tshirt", "sweat", "totebag", "mug", "casquette", "veste"}


@pytest.fixture(scope="module")
def s():
    return requests.Session()


def _customer():
    return {
        "first_name": "TEST", "last_name": "User", "email": "test_poda@example.com",
        "phone": "0612345678", "address": "1 rue de Test", "city": "Paris",
        "postal_code": "75001", "country": "France",
    }


# ---------- Products ----------
def test_list_products(s):
    r = s.get(f"{API}/products", timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert {p["id"] for p in data} == PRODUCT_IDS


# ---------- Global progress (v2) ----------
def test_progress_global(s):
    r = s.get(f"{API}/progress", timeout=20)
    assert r.status_code == 200
    d = r.json()
    for k in ("total_units_paid", "current_batch_number", "position_in_batch", "batch_size", "remaining"):
        assert k in d
    assert d["batch_size"] == 20
    assert d["remaining"] == d["batch_size"] - d["position_in_batch"]


# ---------- Branding public ----------
def test_branding_public_defaults(s):
    r = s.get(f"{API}/settings/branding", timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert "logo_data_url" in d
    assert "association_name" in d


# ---------- Checkout validation ----------
def test_checkout_empty_cart(s):
    body = {"items": [], "customer": _customer(), "origin_url": BASE_URL}
    r = s.post(f"{API}/orders/checkout", json=body, timeout=20)
    assert r.status_code == 400


def test_checkout_invalid_product(s):
    body = {"items": [{"product_id": "bogus", "size": "S", "color": "Blanc", "quantity": 1}],
            "customer": _customer(), "origin_url": BASE_URL}
    r = s.post(f"{API}/orders/checkout", json=body, timeout=20)
    assert r.status_code == 400


def test_checkout_invalid_size(s):
    body = {"items": [{"product_id": "tshirt", "size": "ZZZ", "color": "Blanc", "quantity": 1}],
            "customer": _customer(), "origin_url": BASE_URL}
    r = s.post(f"{API}/orders/checkout", json=body, timeout=20)
    assert r.status_code == 400


def test_checkout_invalid_color(s):
    body = {"items": [{"product_id": "tshirt", "size": "S", "color": "Rose Fluo", "quantity": 1}],
            "customer": _customer(), "origin_url": BASE_URL}
    r = s.post(f"{API}/orders/checkout", json=body, timeout=20)
    assert r.status_code == 400


def test_checkout_invalid_quantity(s):
    body = {"items": [{"product_id": "tshirt", "size": "S", "color": "Blanc", "quantity": 0}],
            "customer": _customer(), "origin_url": BASE_URL}
    r = s.post(f"{API}/orders/checkout", json=body, timeout=20)
    assert r.status_code == 422


# ---------- Checkout success multi-item ----------
@pytest.fixture(scope="module")
def checkout_session(s):
    # Fetch products to get a valid (size,color) for mug too
    products = {p["id"]: p for p in s.get(f"{API}/products").json()}
    tshirt = products["tshirt"]
    mug = products["mug"]
    body = {
        "items": [
            {"product_id": "tshirt", "size": tshirt["sizes"][0], "color": tshirt["colors"][0], "quantity": 3},
            {"product_id": "mug", "size": mug["sizes"][0], "color": mug["colors"][0], "quantity": 2},
        ],
        "customer": _customer(),
        "origin_url": BASE_URL,
    }
    r = s.post(f"{API}/orders/checkout", json=body, timeout=30)
    assert r.status_code == 200, r.text
    j = r.json()
    j["_expected_units"] = 5
    j["_expected_amount"] = round(tshirt["price"] * 3 + mug["price"] * 2, 2)
    return j


def test_checkout_returns_stripe_url(checkout_session):
    assert checkout_session["checkout_url"].startswith("http")
    assert checkout_session["session_id"]
    assert checkout_session["order_number"].startswith("PODA-")


def test_order_status_has_items_array(s, checkout_session):
    sid = checkout_session["session_id"]
    r = s.get(f"{API}/orders/status/{sid}", timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert isinstance(d["items"], list)
    assert len(d["items"]) == 2
    assert d["total_units"] == checkout_session["_expected_units"]
    assert abs(d["total_amount"] - checkout_session["_expected_amount"]) < 0.01
    # Not paid yet -> batch_number None
    assert d["batch_number"] is None
    assert d["payment_status"] != "paid"


# ---------- Admin auth ----------
def test_admin_login_bad(s):
    r = s.post(f"{API}/admin/login", json={"password": "wrong"}, timeout=20)
    assert r.status_code == 401


def test_admin_login_good(s):
    r = s.post(f"{API}/admin/login", json={"password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200


def test_admin_stats_v2(s):
    r = s.get(f"{API}/admin/stats", headers=ADMIN_H, timeout=20)
    assert r.status_code == 200
    d = r.json()
    for k in ("total_units_paid", "total_orders_paid", "total_orders", "revenue",
              "batch_size", "current_batch_number", "position_in_batch", "per_product"):
        assert k in d
    assert isinstance(d["per_product"], list)


def test_admin_ship_by_batch_number_unauth(s):
    r = s.post(f"{API}/admin/batches/1/ship", timeout=20)
    assert r.status_code == 401


def test_admin_ship_by_batch_number_auth(s):
    r = s.post(f"{API}/admin/batches/1/ship", headers=ADMIN_H, timeout=20)
    assert r.status_code == 200
    j = r.json()
    assert "shipped_count" in j and j["batch_number"] == 1


# ---------- Branding admin ----------
PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf"
    b"\xc0\x00\x00\x00\x03\x00\x01\xa5\xf6E\x0e\x00\x00\x00\x00IEND\xaeB`\x82"
)


def test_branding_unauth(s):
    files = {"logo": ("t.png", io.BytesIO(PNG_BYTES), "image/png")}
    r = s.post(f"{API}/admin/settings/branding", files=files, timeout=20)
    assert r.status_code == 401


def test_branding_wrong_password(s):
    files = {"logo": ("t.png", io.BytesIO(PNG_BYTES), "image/png")}
    r = s.post(f"{API}/admin/settings/branding", files=files,
               headers={"X-Admin-Password": "nope"}, timeout=20)
    assert r.status_code == 401


def test_branding_upload_logo_and_name(s):
    files = {"logo": ("t.png", io.BytesIO(PNG_BYTES), "image/png")}
    headers = {**ADMIN_H, "X-Asso-Name": "TEST Asso"}
    r = s.post(f"{API}/admin/settings/branding", files=files, headers=headers, timeout=20)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["association_name"] == "TEST Asso"
    assert d["logo_data_url"].startswith("data:image/")

    # Verify public endpoint reflects it
    r2 = s.get(f"{API}/settings/branding", timeout=20)
    pub = r2.json()
    assert pub["association_name"] == "TEST Asso"
    assert pub["logo_data_url"].startswith("data:image/")


def test_branding_too_large(s):
    # 3 MB payload
    big = b"\x00" * (3 * 1024 * 1024)
    files = {"logo": ("big.png", io.BytesIO(big), "image/png")}
    r = s.post(f"{API}/admin/settings/branding", files=files, headers=ADMIN_H, timeout=30)
    assert r.status_code == 400


def test_branding_delete_logo(s):
    r = s.delete(f"{API}/admin/settings/logo", headers=ADMIN_H, timeout=20)
    assert r.status_code == 200
    pub = s.get(f"{API}/settings/branding", timeout=20).json()
    assert pub["logo_data_url"] in (None, "")
    # association_name preserved
    assert pub["association_name"] == "TEST Asso"


def test_branding_reset_name(s):
    # Restore default name for cleanliness
    r = s.post(f"{API}/admin/settings/branding",
               headers={**ADMIN_H, "X-Asso-Name": "Poda"}, timeout=20)
    assert r.status_code == 200
    assert r.json()["association_name"] == "Poda"
