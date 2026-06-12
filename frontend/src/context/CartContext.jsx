import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "poda_cart_v1";

const sameLine = (a, b) =>
    a.product_id === b.product_id && a.size === b.size && a.color === b.color;

export const CartProvider = ({ children }) => {
    const [items, setItems] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        } catch {
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }, [items]);

    const addItem = (item) => {
        setItems((prev) => {
            const idx = prev.findIndex((p) => sameLine(p, item));
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], quantity: next[idx].quantity + item.quantity };
                return next;
            }
            return [...prev, item];
        });
    };

    const updateQuantity = (index, quantity) => {
        setItems((prev) =>
            prev.map((it, i) => (i === index ? { ...it, quantity: Math.max(1, quantity) } : it))
        );
    };

    const removeItem = (index) => {
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    const clear = () => setItems([]);

    const totals = useMemo(() => {
        const totalUnits = items.reduce((a, b) => a + b.quantity, 0);
        const totalAmount = items.reduce((a, b) => a + b.quantity * b.unit_price, 0);
        return { totalUnits, totalAmount };
    }, [items]);

    const value = { items, addItem, updateQuantity, removeItem, clear, ...totals };
    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
    const ctx = useContext(CartContext);
    if (!ctx) throw new Error("useCart must be used within CartProvider");
    return ctx;
};
