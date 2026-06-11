import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export const getProducts = async () => (await api.get("/products")).data;
export const getProduct = async (id) => (await api.get(`/products/${id}`)).data;
export const getAllProgress = async () => (await api.get("/progress")).data;
export const getProductProgress = async (id) =>
    (await api.get(`/progress/${id}`)).data;

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

export const adminShipBatch = async (password, productId) =>
    (
        await api.post(`/admin/batches/${productId}/ship`, null, {
            headers: { "X-Admin-Password": password },
        })
    ).data;
