import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { createCheckout, getGlobalProgress } from "../lib/api";
import { BatchProgress } from "../components/BatchProgress";
import { ArrowLeft, CreditCard, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function CartPage() {
    const { items, updateQuantity, removeItem, totalAmount, totalUnits } = useCart();
    const [progress, setProgress] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();
    const [form, setForm] = useState({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        postal_code: "",
        country: "France",
    });
    const [acceptedCgv, setAcceptedCgv] = useState(false);

    useEffect(() => {
        getGlobalProgress().then(setProgress).catch(() => {});
    }, []);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitting || items.length === 0) return;
        if (!acceptedCgv) {
            toast.error("Veuillez accepter les CGV pour continuer");
            return;
        }
        setSubmitting(true);
        try {
            const payload = {
                items: items.map((i) => ({
                    product_id: i.product_id,
                    size: i.size,
                    color: i.color,
                    quantity: i.quantity,
                })),
                customer: {
                    first_name: form.first_name.trim(),
                    last_name: form.last_name.trim(),
                    email: form.email.trim(),
                    phone: form.phone.trim(),
                    address: form.address.trim(),
                    city: form.city.trim(),
                    postal_code: form.postal_code.trim(),
                    country: form.country.trim() || "France",
                },
                origin_url: window.location.origin,
            };
            const data = await createCheckout(payload);
            if (data.checkout_url) {
                window.location.href = data.checkout_url;
            } else {
                throw new Error("URL de paiement manquante");
            }
        } catch (err) {
            const msg = err?.response?.data?.detail || "Impossible de créer la commande.";
            toast.error(typeof msg === "string" ? msg : "Erreur de commande");
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10 sm:py-14">
            <Link
                to="/"
                data-testid="back-to-home"
                className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest mb-8 hover:underline"
            >
                <ArrowLeft size={16} /> Continuer mes achats
            </Link>

            <h1 className="font-display text-4xl sm:text-5xl mb-3">Mon panier</h1>
            {progress && <div className="mb-8 max-w-xl"><BatchProgress progress={progress} /></div>}

            {items.length === 0 ? (
                <div className="neo-card p-10 text-center" data-testid="cart-empty">
                    <p className="text-lg mb-6">Votre panier est vide.</p>
                    <Link to="/" className="neo-btn neo-btn-primary">Découvrir la boutique</Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* Items */}
                    <div className="lg:col-span-7 space-y-5" data-testid="cart-items">
                        {items.map((it, i) => (
                            <div key={`${it.product_id}-${it.size}-${it.color}-${i}`} className="neo-card p-4 flex gap-4" data-testid={`cart-item-${i}`}>
                                {it.product_id === "__unlock__" ? (
                                    <div className="w-24 h-24 flex-shrink-0 bg-black flex items-center justify-center text-3xl border-2 border-black">
                                        ⚡
                                    </div>
                                ) : (
                                    <img src={it.image} alt={it.product_name} className="w-24 h-24 object-cover border-2 border-black flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline justify-between gap-2">
                                        <h3 className="font-display text-xl truncate">{it.product_id === "__unlock__" ? it.name : it.product_name}</h3>
                                        <span className="font-display text-lg whitespace-nowrap">
                                            {(it.unit_price * it.quantity).toFixed(2)}€
                                        </span>
                                    </div>
                                    {it.product_id === "__unlock__" ? (
                                        <p className="text-xs uppercase tracking-widest font-bold text-[#FF6B6B] mb-3">
                                            Je ne veux pas attendre — je débloque le lot pour tout le monde
                                        </p>
                                    ) : (
                                        <p className="text-xs uppercase tracking-widest font-bold text-black/60 mb-3">
                                            Taille {it.size} · {it.color} · {it.unit_price.toFixed(2)}€ / unité
                                        </p>
                                    )}
                                    <div className="flex items-center justify-between gap-3">
                                        {it.product_id !== "__unlock__" && (
                                            <div className="flex items-center border-4 border-black">
                                                <button
                                                    type="button"
                                                    onClick={() => updateQuantity(i, it.quantity - 1)}
                                                    data-testid={`cart-minus-${i}`}
                                                    className="px-3 py-1 hover:bg-[#FBEA8C]"
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <span className="px-4 font-bold">{it.quantity}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => updateQuantity(i, it.quantity + 1)}
                                                    data-testid={`cart-plus-${i}`}
                                                    className="px-3 py-1 hover:bg-[#FBEA8C]"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeItem(i)}
                                            data-testid={`cart-remove-${i}`}
                                            className="inline-flex items-center gap-1 text-sm font-bold uppercase tracking-widest text-[#FF6B6B] hover:underline"
                                        >
                                            <Trash2 size={14} /> Retirer
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Form + summary */}
                    <div className="lg:col-span-5">
                        <form onSubmit={handleSubmit} className="neo-card p-6 space-y-4 sticky top-24" data-testid="checkout-form">
                            <h2 className="font-display text-2xl">Livraison</h2>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="neo-label">Prénom</label>
                                    <input required name="first_name" value={form.first_name} onChange={handleChange} className="neo-input" data-testid="input-first-name" />
                                </div>
                                <div>
                                    <label className="neo-label">Nom</label>
                                    <input required name="last_name" value={form.last_name} onChange={handleChange} className="neo-input" data-testid="input-last-name" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="neo-label">Email</label>
                                    <input required type="email" name="email" value={form.email} onChange={handleChange} className="neo-input" data-testid="input-email" />
                                </div>
                                <div>
                                    <label className="neo-label">Téléphone</label>
                                    <input required name="phone" value={form.phone} onChange={handleChange} className="neo-input" data-testid="input-phone" />
                                </div>
                            </div>
                            <div>
                                <label className="neo-label">Adresse</label>
                                <input required name="address" value={form.address} onChange={handleChange} className="neo-input" data-testid="input-address" />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="neo-label">CP</label>
                                    <input required name="postal_code" value={form.postal_code} onChange={handleChange} className="neo-input" data-testid="input-postal" />
                                </div>
                                <div>
                                    <label className="neo-label">Ville</label>
                                    <input required name="city" value={form.city} onChange={handleChange} className="neo-input" data-testid="input-city" />
                                </div>
                                <div>
                                    <label className="neo-label">Pays</label>
                                    <input required name="country" value={form.country} onChange={handleChange} className="neo-input" data-testid="input-country" />
                                </div>
                            </div>

                            <div className="border-t-4 border-black pt-4 space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="font-bold uppercase tracking-widest">Articles</span>
                                    <span>{totalUnits} unité{totalUnits > 1 ? "s" : ""}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs uppercase tracking-widest font-bold">Total</span>
                                    <span className="font-display text-3xl" data-testid="cart-total">{totalAmount.toFixed(2)}€</span>
                                </div>
                                <label className="flex items-start gap-2 text-xs leading-snug cursor-pointer pt-2 border-t-2 border-black/10">
                                    <input
                                        type="checkbox"
                                        checked={acceptedCgv}
                                        onChange={(e) => setAcceptedCgv(e.target.checked)}
                                        data-testid="cgv-checkbox"
                                        className="mt-0.5"
                                        required
                                    />
                                    <span>
                                        J'ai lu et j'accepte les{" "}
                                        <Link to="/legal/cgv" target="_blank" className="underline font-bold">CGV</Link>
                                        {" "}et la{" "}
                                        <Link to="/legal/confidentialite" target="_blank" className="underline font-bold">politique de confidentialité</Link>.
                                        Je comprends que mes produits sont personnalisés à la demande et qu'aucun droit de rétractation ne s'applique (art. L221-28 du Code de la consommation).
                                    </span>
                                </label>
                            </div>

                            <button type="submit" disabled={submitting || !acceptedCgv} className="neo-btn neo-btn-primary w-full" data-testid="submit-checkout">
                                {submitting ? <><Loader2 size={18} className="animate-spin" /> Redirection…</> : <><CreditCard size={18} /> Payer avec Stripe</>}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
