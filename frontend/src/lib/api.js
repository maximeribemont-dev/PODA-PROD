import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export const getProducts = async () => (await api.get("/products")).data;
export const getProduct = async (id) => (await api.get(`/products/${id}`)).data;
export const getGlobalProgress = async () => (await api.get("/progress")).data;
export const getBranding = async () => (await api.get("/settings/branding")).data;

export const createCheckout = async (payload) =>
    (await api.post("/orders/checkout", payload)).data;

export const getOrderStatus = async (sessionId) =>
    (await api.get(`/orders/status/${sessionId}`)).data;

// Admin
export const adminLogin = async (password) =>
    (await api.post("/admin/login", { password })).data;

export const adminGetOrders = async (password) =>
    (await api.get("/admin/orders", { headers: { "X-Admin-Password": password } })).data;

export const adminGetStats = async (password) =>
    (await api.get("/admin/stats", { headers: { "X-Admin-Password": password } })).data;

export const adminShipBatch = async (password, batchNumber) =>
    (
        await api.post(`/admin/batches/${batchNumber}/ship`, null, {
            headers: { "X-Admin-Password": password },
        })
    ).data;

export const adminUpdateBranding = async (password, { file, associationName }) => {
    const fd = new FormData();
    if (file) fd.append("logo", file);
    const headers = { "X-Admin-Password": password };
    if (associationName) headers["X-Asso-Name"] = associationName;
    const res = await api.post("/admin/settings/branding", fd, { headers });
    return res.data;
};

export const adminDeleteLogo = async (password) =>
    (await api.delete("/admin/settings/logo", { headers: { "X-Admin-Password": password } })).data;
