"""Backend integration tests for Poda API."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://merch-pod-shop.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_PASSWORD = "poda2026"

PRODUCT_IDS = ["tshirt", "sweat", "totebag", "mug", "casquette", "veste"]


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# Products
def test_list_products(s):
    r = s.get(f"{API}/products", timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 6
    ids = {p["id"] for p in data}
    assert ids == set(PRODUCT_IDS)
    for p in data:
        assert {"name", "price", "sizes", "colors"} <= set(p.keys())


def test_get_product_detail(s):
    r = s.get(f"{API}/products/tshirt", timeout=20)
    assert r.status_code == 200
    p = r.json()
    assert p["id"] == "tshirt"
    assert "S" in p["sizes"]


def test_get_product_404(s):
    r = s.get(f"{API}/products/nonexistent", timeout=20)
    assert r.status_code == 404


# Progress
def test_progress_list(s):
    r = s.get(f"{API}/progress", timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 6
    for it in data:
        assert it["batch_size"] == 20
        assert it["current_batch_number"] >= 1
        assert 0 <= it["position_in_batch"] < 20


# Checkout
def test_checkout_invalid_product(s):
    body = {
        "product_id": "bogus", "size": "S", "color": "Blanc",
        "customer": {
            "first_name": "T", "last_name": "U", "email": "t@u.com",
            "phone": "0600000000", "address": "1 rue", "city": "Paris",
            "postal_code": "75000", "country": "France"
        },
        "origin_url": BASE_URL,
    }
    r = s.post(f"{API}/orders/checkout", json=body, timeout=20)
    assert r.status_code == 400


def test_checkout_invalid_size(s):
    body = {
        "product_id": "tshirt", "size": "ZZZ", "color": "Blanc",
        "customer": {
            "first_name": "T", "last_name": "U", "email": "t@u.com",
            "phone": "0600000000", "address": "1 rue", "city": "Paris",
            "postal_code": "75000", "country": "France"
        },
        "origin_url": BASE_URL,
    }
    r = s.post(f"{API}/orders/checkout", json=body, timeout=20)
    assert r.status_code == 400


def test_checkout_invalid_color(s):
    body = {
        "product_id": "tshirt", "size": "S", "color": "Rose Fluo",
        "customer": {
            "first_name": "T", "last_name": "U", "email": "t@u.com",
            "phone": "0600000000", "address": "1 rue", "city": "Paris",
            "postal_code": "75000", "country": "France"
        },
        "origin_url": BASE_URL,
    }
    r = s.post(f"{API}/orders/checkout", json=body, timeout=20)
    assert r.status_code == 400


@pytest.fixture(scope="module")
def checkout_session(s):
    body = {
        "product_id": "tshirt", "size": "S", "color": "Blanc",
        "customer": {
            "first_name": "TEST", "last_name": "User", "email": "test_poda@example.com",
            "phone": "0612345678", "address": "1 rue de Test", "city": "Paris",
            "postal_code": "75001", "country": "France"
        },
        "origin_url": BASE_URL,
    }
    r = s.post(f"{API}/orders/checkout", json=body, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def test_checkout_valid_returns_url(checkout_session):
    assert "checkout_url" in checkout_session
    assert checkout_session["checkout_url"].startswith("http")
    assert "session_id" in checkout_session
    assert checkout_session["order_number"].startswith("PODA-")


def test_order_status_unpaid(s, checkout_session):
    sid = checkout_session["session_id"]
    r = s.get(f"{API}/orders/status/{sid}", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data["payment_status"] != "paid"
    assert data["product_id"] == "tshirt"


# Admin auth
def test_admin_login_bad(s):
    r = s.post(f"{API}/admin/login", json={"password": "wrong"}, timeout=20)
    assert r.status_code == 401


def test_admin_login_good(s):
    r = s.post(f"{API}/admin/login", json={"password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200
    assert r.json().get("ok") is True


def test_admin_orders_unauth(s):
    r = s.get(f"{API}/admin/orders", timeout=20)
    assert r.status_code == 401


def test_admin_orders_auth(s):
    r = s.get(f"{API}/admin/orders", headers={"X-Admin-Password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_stats(s):
    r = s.get(f"{API}/admin/stats", headers={"X-Admin-Password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200
    assert len(r.json()) == 6


def test_admin_ship_unauth(s):
    r = s.post(f"{API}/admin/batches/tshirt/ship", timeout=20)
    assert r.status_code == 401


def test_admin_ship_auth(s):
    r = s.post(f"{API}/admin/batches/tshirt/ship", headers={"X-Admin-Password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200
    assert "shipped_count" in r.json()
