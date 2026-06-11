import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getProduct, getProductProgress, createCheckout } from "../lib/api";
import { BatchProgress } from "../components/BatchProgress";
import { ArrowLeft, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function OrderPage() {
    const { productId } = useParams();
    const navigate = useNavigate();
    const [product, setProduct] = useState(null);
    const [progress, setProgress] = useState(null);
    const [form, setForm] = useState({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        address: "",
        city: "",
        postal_code: "",
        country: "France",
        size: "",
        color: "",
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const [p, prog] = await Promise.all([
                    getProduct(productId),
                    getProductProgress(productId),
                ]);
                setProduct(p);
                setProgress(prog);
                setForm((f) => ({
                    ...f,
                    size: p.sizes[0] || "",
                    color: p.colors[0] || "",
                }));
            } catch (e) {
                toast.error("Produit introuvable");
                navigate("/");
            }
        })();
    }, [productId, navigate]);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitting || !product) return;
        setSubmitting(true);
        try {
            const payload = {
                product_id: product.id,
                size: form.size,
                color: form.color,
                origin_url: window.location.origin,
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
            };
            const data = await createCheckout(payload);
            if (data.checkout_url) {
                window.location.href = data.checkout_url;
            } else {
                throw new Error("URL de paiement manquante");
            }
        } catch (err) {
            console.error(err);
            const msg = err?.response?.data?.detail || "Impossible de créer la commande.";
            toast.error(typeof msg === "string" ? msg : "Erreur de commande");
            setSubmitting(false);
        }
    };

    if (!product) {
        return (
            <div className="max-w-7xl mx-auto px-6 sm:px-10 py-20 font-display text-2xl">
                Chargement…
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10 sm:py-16">
            <Link
                to="/"
                data-testid="back-to-home"
                className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest mb-8 hover:underline"
            >
                <ArrowLeft size={16} /> Retour à la boutique
            </Link>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Product preview */}
                <div className="lg:col-span-5">
                    <div className="neo-card overflow-hidden sticky top-24">
                        <div className="aspect-square bg-[#FDF8F5] border-b-4 border-black">
                            <img
                                src={product.image}
                                alt={product.name}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="p-6">
                            <h2 className="font-display text-3xl mb-1">{product.name}</h2>
                            <div className="font-display text-2xl mb-3">
                                {product.price.toFixed(2)} €
                            </div>
                            <p className="text-black/70 mb-5 text-sm">{product.description}</p>
                            <BatchProgress progress={progress} />
                        </div>
                    </div>
                </div>

                {/* Form */}
                <div className="lg:col-span-7">
                    <h1 className="font-display text-4xl sm:text-5xl mb-2">
                        Commander en un clic
                    </h1>
                    <p className="text-black/70 mb-8 max-w-xl">
                        Remplissez vos infos, finalisez le paiement, et votre place dans le lot est garantie.
                    </p>

                    <form
                        onSubmit={handleSubmit}
                        data-testid="order-form"
                        className="neo-card p-6 sm:p-8 space-y-5"
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="neo-label">Prénom</label>
                                <input
                                    required
                                    name="first_name"
                                    value={form.first_name}
                                    onChange={handleChange}
                                    className="neo-input"
                                    data-testid="input-first-name"
                                />
                            </div>
                            <div>
                                <label className="neo-label">Nom</label>
                                <input
                                    required
                                    name="last_name"
                                    value={form.last_name}
                                    onChange={handleChange}
                                    className="neo-input"
                                    data-testid="input-last-name"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="neo-label">Email</label>
                                <input
                                    required
                                    type="email"
                                    name="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    className="neo-input"
                                    data-testid="input-email"
                                />
                            </div>
                            <div>
                                <label className="neo-label">Téléphone</label>
                                <input
                                    required
                                    name="phone"
                                    value={form.phone}
                                    onChange={handleChange}
                                    className="neo-input"
                                    data-testid="input-phone"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="neo-label">Adresse</label>
                            <input
                                required
                                name="address"
                                value={form.address}
                                onChange={handleChange}
                                className="neo-input"
                                placeholder="N°, rue, complément"
                                data-testid="input-address"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="neo-label">Code postal</label>
                                <input
                                    required
                                    name="postal_code"
                                    value={form.postal_code}
                                    onChange={handleChange}
                                    className="neo-input"
                                    data-testid="input-postal"
                                />
                            </div>
                            <div>
                                <label className="neo-label">Ville</label>
                                <input
                                    required
                                    name="city"
                                    value={form.city}
                                    onChange={handleChange}
                                    className="neo-input"
                                    data-testid="input-city"
                                />
                            </div>
                            <div>
                                <label className="neo-label">Pays</label>
                                <input
                                    required
                                    name="country"
                                    value={form.country}
                                    onChange={handleChange}
                                    className="neo-input"
                                    data-testid="input-country"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="neo-label">Taille</label>
                                <select
                                    name="size"
                                    value={form.size}
                                    onChange={handleChange}
                                    className="neo-input neo-select"
                                    data-testid="input-size"
                                >
                                    {product.sizes.map((s) => (
                                        <option key={s} value={s}>
                                            {s}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="neo-label">Couleur</label>
                                <select
                                    name="color"
                                    value={form.color}
                                    onChange={handleChange}
                                    className="neo-input neo-select"
                                    data-testid="input-color"
                                >
                                    {product.colors.map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t-4 border-black flex-wrap gap-4">
                            <div>
                                <div className="text-xs uppercase tracking-widest font-bold">Total</div>
                                <div className="font-display text-3xl">
                                    {product.price.toFixed(2)} €
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="neo-btn neo-btn-primary"
                                data-testid="submit-order"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" /> Redirection…
                                    </>
                                ) : (
                                    <>
                                        <CreditCard size={18} /> Payer avec Stripe
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
