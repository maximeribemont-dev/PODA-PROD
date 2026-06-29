import ProductsAdmin from "../components/ProductsAdmin";
import { useEffect, useRef, useState } from "react";
import {
    adminLogin,
    adminGetOrders,
    adminGetStats,
    adminShipBatch,
    adminUpdateBranding,
    adminDeleteLogo,
    adminCancelOrder,
    adminRefundOrder,
    adminUpdateOrderStatus,
} from "../lib/api";
import { useBranding } from "../context/BrandingContext";
import { Lock, RefreshCcw, Truck, LogOut, Upload, ImageOff } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = "poda_admin_pwd";

export default function AdminPage() {
    const [password, setPassword] = useState(() => sessionStorage.getItem(STORAGE_KEY) || "");
    const [authed, setAuthed] = useState(false);
    const [orders, setOrders] = useState([]);
    const [stats, setStats] = useState(null);
    const [assoName, setAssoName] = useState("");
    const [notificationEmail, setNotificationEmail] = useState("");
    const [busy, setBusy] = useState(false);
    const fileRef = useRef(null);
    const { logo_data_url, association_name, notification_email: brandingNotificationEmail, refresh: refreshBranding } = useBranding();

    useEffect(() => {
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authed]);

    useEffect(() => {
        if (association_name) setAssoName(association_name);
        if (brandingNotificationEmail) setNotificationEmail(brandingNotificationEmail);
    }, [association_name]);

    const refresh = async () => {
        try {
            const [o, s] = await Promise.all([adminGetOrders(password), adminGetStats(password)]);
            setOrders(o);
            setStats(s);
        } catch {
            toast.error("Erreur de chargement");
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        const pwd = (password || "").trim();
        if (!pwd) return toast.error("Mot de passe requis");
        try {
            await adminLogin(pwd);
            sessionStorage.setItem(STORAGE_KEY, pwd);
            setPassword(pwd);
            setAuthed(true);
            toast.success("Bienvenue admin !");
        } catch {
            toast.error("Mot de passe incorrect");
        }
    };

    const handleShip = async (batchNumber) => {
        if (!window.confirm(`Marquer le lot #${batchNumber} comme expédié ?`)) return;
        try {
            const { shipped_count } = await adminShipBatch(password, batchNumber);
            toast.success(`${shipped_count} commande(s) marquée(s) expédiées`);
            refresh();
        } catch {
            toast.error("Erreur d'expédition");
        }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) return toast.error("Logo trop volumineux (max 2 Mo)");
        setBusy(true);
        try {
            await adminUpdateBranding(password, { file });
            await refreshBranding();
            toast.success("Logo mis à jour !");
        } catch {
            toast.error("Erreur d'upload");
        } finally {
            setBusy(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const handleSaveAssoName = async () => {
        setBusy(true);
        try {
            await adminUpdateBranding(password, { associationName: assoName, notificationEmail });
            await refreshBranding();
            toast.success("Nom de l'association mis à jour");
        } catch {
            toast.error("Erreur");
        } finally {
            setBusy(false);
        }
    };

    const handleDeleteLogo = async () => {
        if (!window.confirm("Supprimer le logo ?")) return;
        setBusy(true);
        try {
            await adminDeleteLogo(password);
            await refreshBranding();
            toast.success("Logo supprimé");
        } catch {
            toast.error("Erreur");
        } finally {
            setBusy(false);
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
                        <button type="submit" className="neo-btn neo-btn-primary w-full" data-testid="admin-login-btn">
                            Se connecter
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    const pct = stats ? (stats.position_in_batch / stats.batch_size) * 100 : 0;

    return (
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <h1 className="font-display text-4xl sm:text-5xl">Dashboard</h1>
                <div className="flex items-center gap-3">
                    <button onClick={refresh} className="neo-btn neo-btn-secondary" data-testid="admin-refresh">
                        <RefreshCcw size={16} /> Actualiser
                    </button>
                    <button onClick={logout} className="neo-btn neo-btn-yellow" data-testid="admin-logout">
                        <LogOut size={16} /> Déconnexion
                    </button>
                </div>
            </div>

            {/* Global counter + Branding side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-12">
                {/* Global counter */}
                <div className="lg:col-span-7">
                    <div className="neo-card p-6" data-testid="admin-global-stats">
                        <h2 className="font-display text-2xl mb-4">Lot collectif en cours</h2>
                        {stats && (
                            <>
                                <div className="progress-track mb-3">
                                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                                    <div className="progress-text">{stats.position_in_batch}/{stats.batch_size} unités</div>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                                    <Stat label="Unités payées" value={stats.total_units_paid} />
                                    <Stat label="Lot #" value={stats.current_batch_number} />
                                    <Stat label="Commandes" value={stats.total_orders_paid} />
                                    <Stat label="CA" value={`${stats.revenue.toFixed(0)}€`} />
                                </div>
                                <button
                                    onClick={() => handleShip(stats.current_batch_number)}
                                    disabled={stats.position_in_batch === 0}
                                    className="neo-btn neo-btn-yellow mt-5"
                                    data-testid="admin-ship-current"
                                >
                                    <Truck size={16} /> Marquer le lot #{stats.current_batch_number} expédié
                                </button>
                            </>
                        )}
                    </div>

                    <div className="mt-6 neo-card p-6">
                        <h3 className="font-display text-xl mb-4">Répartition par produit (payés)</h3>
                        {stats?.per_product?.length ? (
                            <ul className="space-y-2">
                                {stats.per_product.map((p) => (
                                    <li key={p.product_id} className="flex items-center justify-between border-b-2 border-black/10 pb-1">
                                        <span>{p.product_name}</span>
                                        <span className="font-bold">{p.units} unité{p.units > 1 ? "s" : ""}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-black/60">Aucune unité vendue pour l'instant.</p>
                        )}
                    </div>
                </div>

                {/* Branding */}
                <div className="lg:col-span-5">
                    <div className="neo-card p-6" data-testid="admin-branding">
                        <h2 className="font-display text-2xl mb-4">Identité de l'association</h2>
                        <div className="flex items-center gap-4 mb-5">
                            <div className="w-24 h-24 border-4 border-black bg-white flex items-center justify-center overflow-hidden">
                                {logo_data_url ? (
                                    <img src={logo_data_url} alt="logo" className="w-full h-full object-contain" data-testid="admin-current-logo" />
                                ) : (
                                    <ImageOff size={36} className="text-black/30" />
                                )}
                            </div>
                            <div className="flex-1">
                                <label className="neo-label">Logo (PNG/JPG/SVG, max 2 Mo)</label>
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                    className="text-sm w-full"
                                    data-testid="admin-logo-input"
                                />
                                {logo_data_url && (
                                    <button
                                        onClick={handleDeleteLogo}
                                        disabled={busy}
                                        className="mt-2 text-xs font-bold uppercase tracking-widest text-[#FF6B6B] hover:underline"
                                        data-testid="admin-delete-logo"
                                    >
                                        Supprimer
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="neo-label">Nom de l'association</label>
                            <input
                                type="text"
                                className="neo-input"
                                value={assoName}
                                onChange={(e) => setAssoName(e.target.value)}
                                placeholder="Ex: Mon Asso Poda"
                                data-testid="admin-asso-name"
                            />
                            <label className="neo-label mt-3">Email de notification</label>
                            <input
                                type="email"
                                className="neo-input"
                                value={notificationEmail}
                                onChange={(e) => setNotificationEmail(e.target.value)}
                                placeholder="president@monasso.fr"
                            />
                            <p className="text-xs text-black/50">Reçoit une alerte quand le lot est lancé (20 pièces atteintes ou délai expiré)</p>
                            <button
                                onClick={handleSaveAssoName}
                                disabled={busy || !assoName.trim()}
                                className="neo-btn neo-btn-primary w-full"
                                data-testid="admin-save-asso"
                            >
                                <Upload size={16} /> Enregistrer
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Orders table */}
            <ProductsAdmin password={password} />

            <section className="mt-12">
                <h2 className="font-display text-2xl mb-4">Commandes ({orders.length})</h2>
                <div className="neo-card overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-[#FBEA8C] border-b-4 border-black">
                            <tr>
                                <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">N°</th>
                                <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Articles</th>
                                <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Client</th>
                                <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Total</th>
                                <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Lot</th>
                                <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Statut</th>
                                <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Expédié</th>
                                <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Actions</th>
                            </tr>
                        </thead>
                        <tbody data-testid="admin-orders-table">
                            {orders.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="text-center p-8 text-black/60">
                                        Aucune commande.
                                    </td>
                                </tr>
                            )}
                            {orders.map((o) => (
                                <tr key={o.id} className="border-b-2 border-black/10 align-top">
                                    <td className="p-3 font-mono whitespace-nowrap">{o.order_number}</td>
                                    <td className="p-3">
                                        <ul className="space-y-1">
                                            {o.items.map((it, i) => (
                                                <li key={i} className="text-xs">
                                                    {it.quantity}× {it.product_name} <span className="text-black/60">({it.size}, {it.color})</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </td>
                                    <td className="p-3">
                                        {o.customer.first_name} {o.customer.last_name}
                                        <br />
                                        <span className="text-xs text-black/60">{o.customer.email}</span>
                                    </td>
                                    <td className="p-3 whitespace-nowrap">{o.total_amount.toFixed(2)}€<br/><span className="text-xs text-black/60">{o.total_units} unité{o.total_units > 1 ? "s" : ""}</span></td>
                                    <td className="p-3">
                                        {o.batch_number ? `#${o.batch_number} (${o.start_position}-${o.end_position})` : "—"}
                                    </td>
                                    <td className="p-3">
                                        <select
                                            value={o.payment_status}
                                            onChange={async (e) => {
                                                const newStatus = e.target.value;
                                                if (!window.confirm(`Changer le statut de la commande ${o.order_number} en "${newStatus}" ?`)) return;
                                                try {
                                                    await adminUpdateOrderStatus(password, o.order_number, newStatus);
                                                    toast.success(`Statut mis à jour → ${newStatus}`);
                                                    refresh();
                                                } catch (err) {
                                                    toast.error(err?.response?.data?.detail || "Erreur");
                                                }
                                            }}
                                            className="border-2 border-black text-xs font-bold uppercase px-2 py-1 cursor-pointer"
                                            style={{
                                                background: o.payment_status === "paid" ? "#4ECDC4"
                                                    : o.payment_status === "refunded" ? "#FED7AA"
                                                    : o.payment_status === "cancelled" ? "#FECACA"
                                                    : "#FBEA8C"
                                            }}
                                        >
                                            <option value="paid">Payée</option>
                                            <option value="unpaid">Non payée</option>
                                            <option value="refunded">Remboursée</option>
                                            <option value="cancelled">Annulée</option>
                                        </select>
                                    </td>
                                    <td className="p-3">{o.shipped ? "✓" : "—"}</td>
                                    <td className="p-3">
                                        {o.payment_status !== "paid" && o.payment_status !== "refunded" && (
                                            <button
                                                onClick={async () => {
                                                    if (!window.confirm(`Annuler la commande ${o.order_number} ?`)) return;
                                                    try {
                                                        await adminCancelOrder(password, o.order_number);
                                                        toast.success(`Commande ${o.order_number} annulée`);
                                                        refresh();
                                                    } catch (e) {
                                                        toast.error(e?.response?.data?.detail || "Erreur lors de l'annulation");
                                                    }
                                                }}
                                                className="text-[#FF6B6B] border-2 border-[#FF6B6B] px-2 py-1 text-xs font-bold hover:bg-[#FF6B6B] hover:text-white transition-colors"
                                            >
                                                Annuler
                                            </button>
                                        )}
                                        {o.payment_status === "paid" && (
                                            <button
                                                onClick={async () => {
                                                    if (!window.confirm(`Rembourser ${o.total_amount?.toFixed(2)}€ à ${o.customer?.first_name} ${o.customer?.last_name} ?\n\nCette action est irréversible.`)) return;
                                                    try {
                                                        const res = await adminRefundOrder(password, o.order_number);
                                                        toast.success(`Remboursement de ${res.amount?.toFixed(2)}€ effectué`);
                                                        refresh();
                                                    } catch (e) {
                                                        toast.error(e?.response?.data?.detail || "Erreur lors du remboursement");
                                                    }
                                                }}
                                                className="text-orange-500 border-2 border-orange-500 px-2 py-1 text-xs font-bold hover:bg-orange-500 hover:text-white transition-colors"
                                            >
                                                Rembourser
                                            </button>
                                        )}
                                        {o.payment_status === "refunded" && (
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs text-orange-500 font-bold">Remboursé</span>
                                                <button
                                                    onClick={async () => {
                                                        if (!window.confirm(`Supprimer la commande ${o.order_number} (déjà remboursée) ?`)) return;
                                                        try {
                                                            await adminCancelOrder(password, o.order_number);
                                                            toast.success(`Commande supprimée`);
                                                            refresh();
                                                        } catch (e) {
                                                            toast.error(e?.response?.data?.detail || "Erreur");
                                                        }
                                                    }}
                                                    className="text-gray-400 border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-100 transition-colors"
                                                >
                                                    Supprimer
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}

const Stat = ({ label, value }) => (
    <div className="border-4 border-black p-3 bg-white">
        <div className="text-[10px] uppercase tracking-widest font-bold text-black/60">{label}</div>
        <div className="font-display text-2xl mt-1">{value}</div>
    </div>
);

const StatusPill = ({ status }) => {
    const map = {
        paid:      { c: "#4ECDC4", t: "Payée" },
        initiated: { c: "#FBEA8C", t: "En cours" },
        unpaid:    { c: "#FBCFE8", t: "Non payée" },
        refunded:  { c: "#FED7AA", t: "Remboursée" },
        cancelled: { c: "#FECACA", t: "Annulée" },
    };
    const v = map[status] || { c: "#eee", t: status };
    return (
        <span className="inline-block border-2 border-black px-2 py-1 text-xs font-bold uppercase tracking-widest" style={{ background: v.c }}>
            {v.t}
        </span>
    );
};
