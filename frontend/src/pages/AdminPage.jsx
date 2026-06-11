import { useEffect, useState } from "react";
import { adminLogin, adminGetOrders, adminGetStats, adminShipBatch } from "../lib/api";
import { Lock, RefreshCcw, Truck, LogOut } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "poda_admin_pwd";

export default function AdminPage() {
    const [password, setPassword] = useState(() => sessionStorage.getItem(STORAGE_KEY) || "");
    const [authed, setAuthed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [orders, setOrders] = useState([]);
    const [stats, setStats] = useState([]);

    useEffect(() => {
        // try auto auth if there is stored pwd
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
            (async () => {
                try {
                    await adminLogin(stored);
                    setAuthed(true);
                    setPassword(stored);
                } catch {
                    sessionStorage.removeItem(STORAGE_KEY);
                }
            })();
        }
    }, []);

    useEffect(() => {
        if (authed) refresh();
    }, [authed]);

    const refresh = async () => {
        setLoading(true);
        try {
            const [o, s] = await Promise.all([
                adminGetOrders(password),
                adminGetStats(password),
            ]);
            setOrders(o);
            setStats(s);
        } catch (e) {
            toast.error("Impossible de charger les données admin");
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            await adminLogin(password);
            sessionStorage.setItem(STORAGE_KEY, password);
            setAuthed(true);
            toast.success("Bienvenue admin !");
        } catch {
            toast.error("Mot de passe incorrect");
        }
    };

    const handleShip = async (productId) => {
        if (!window.confirm(`Marquer toutes les commandes payées de "${productId}" comme expédiées ?`)) return;
        try {
            const { shipped_count } = await adminShipBatch(password, productId);
            toast.success(`${shipped_count} commande(s) marquée(s) expédiées`);
            refresh();
        } catch {
            toast.error("Erreur d'expédition");
        }
    };

    const logout = () => {
        sessionStorage.removeItem(STORAGE_KEY);
        setAuthed(false);
        setPassword("");
    };

    if (!authed) {
        return (
            <div className="max-w-md mx-auto px-6 py-20">
                <div className="neo-card p-8">
                    <div className="flex items-center gap-2 mb-6">
                        <Lock size={20} />
                        <span className="text-xs font-bold uppercase tracking-[0.2em]">Accès admin</span>
                    </div>
                    <h1 className="font-display text-4xl mb-6">Dashboard Poda</h1>
                    <form onSubmit={handleLogin} className="space-y-4" data-testid="admin-login-form">
                        <div>
                            <label className="neo-label">Mot de passe</label>
                            <input
                                type="password"
                                className="neo-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                data-testid="admin-password"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            className="neo-btn neo-btn-primary w-full"
                            data-testid="admin-login-btn"
                        >
                            Se connecter
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <h1 className="font-display text-4xl sm:text-5xl">Dashboard</h1>
                <div className="flex items-center gap-3">
                    <button
                        onClick={refresh}
                        className="neo-btn neo-btn-secondary"
                        data-testid="admin-refresh"
                    >
                        <RefreshCcw size={16} /> Actualiser
                    </button>
                    <button
                        onClick={logout}
                        className="neo-btn neo-btn-yellow"
                        data-testid="admin-logout"
                    >
                        <LogOut size={16} /> Déconnexion
                    </button>
                </div>
            </div>

            {/* Stats per product */}
            <section className="mb-12">
                <h2 className="font-display text-2xl mb-4">Progression par produit</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {stats.map((s) => {
                        const pct = (s.position_in_batch / s.batch_size) * 100;
                        return (
                            <div
                                key={s.product_id}
                                className="neo-card p-5"
                                data-testid={`admin-stat-${s.product_id}`}
                            >
                                <div className="flex items-baseline justify-between mb-2">
                                    <h3 className="font-display text-xl">{s.product_name}</h3>
                                    <span className="text-xs uppercase tracking-widest font-bold">
                                        Lot #{s.current_batch_number}
                                    </span>
                                </div>
                                <div className="progress-track mb-3">
                                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                                    <div className="progress-text">
                                        {s.position_in_batch}/{s.batch_size}
                                    </div>
                                </div>
                                <div className="text-sm text-black/70 mb-3">
                                    {s.total_paid} commandes payées · {s.revenue.toFixed(2)} € CA
                                </div>
                                <button
                                    onClick={() => handleShip(s.product_id)}
                                    disabled={s.total_paid === 0}
                                    className="neo-btn neo-btn-yellow w-full"
                                    data-testid={`admin-ship-${s.product_id}`}
                                >
                                    <Truck size={16} /> Marquer expédié
                                </button>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Orders table */}
            <section>
                <h2 className="font-display text-2xl mb-4">Commandes ({orders.length})</h2>
                <div className="neo-card overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-[#FBEA8C] border-b-4 border-black">
                            <tr>
                                <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">N°</th>
                                <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Produit</th>
                                <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Client</th>
                                <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Taille</th>
                                <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Couleur</th>
                                <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Lot</th>
                                <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Statut</th>
                                <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Expédié</th>
                            </tr>
                        </thead>
                        <tbody data-testid="admin-orders-table">
                            {orders.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={8} className="text-center p-8 text-black/60">
                                        Aucune commande pour l'instant.
                                    </td>
                                </tr>
                            )}
                            {orders.map((o) => (
                                <tr key={o.id} className="border-b-2 border-black/10">
                                    <td className="p-3 font-mono">{o.order_number}</td>
                                    <td className="p-3">{o.product_name}</td>
                                    <td className="p-3">
                                        {o.customer.first_name} {o.customer.last_name}
                                        <br />
                                        <span className="text-xs text-black/60">{o.customer.email}</span>
                                    </td>
                                    <td className="p-3">{o.size}</td>
                                    <td className="p-3">{o.color}</td>
                                    <td className="p-3">
                                        {o.batch_number ? `#${o.batch_number} (${o.position_in_batch})` : "—"}
                                    </td>
                                    <td className="p-3">
                                        <StatusPill status={o.payment_status} />
                                    </td>
                                    <td className="p-3">{o.shipped ? "✓" : "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

const StatusPill = ({ status }) => {
    const map = {
        paid: { c: "#4ECDC4", t: "Payée" },
        initiated: { c: "#FBEA8C", t: "En cours" },
        unpaid: { c: "#FBCFE8", t: "Non payée" },
    };
    const v = map[status] || { c: "#eee", t: status };
    return (
        <span
            className="inline-block border-2 border-black px-2 py-1 text-xs font-bold uppercase tracking-widest"
            style={{ background: v.c }}
        >
            {v.t}
        </span>
    );
};
