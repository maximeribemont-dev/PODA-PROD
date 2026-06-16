import { useEffect, useState } from "react";
import {
    adminListProducts,
    adminCreateProduct,
    adminUpdateProduct,
    adminDeleteProduct,
} from "../lib/api";
import { Plus, Trash2, Pencil, Save, X, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const EMPTY = {
    id: "",
    name: "",
    description: "",
    price: 25,
    image: "",
    sizes: "Unique",
    colors: "Standard",
    active: true,
};

export default function ProductsAdmin({ password }) {
    const [products, setProducts] = useState([]);
    const [editing, setEditing] = useState(null); // null | "new" | productId
    const [form, setForm] = useState(EMPTY);
    const [busy, setBusy] = useState(false);

    const refresh = async () => {
        try {
            setProducts(await adminListProducts(password));
        } catch {
            toast.error("Erreur de chargement des produits");
        }
    };

    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startNew = () => {
        setForm(EMPTY);
        setEditing("new");
    };

    const startEdit = (p) => {
        setForm({
            id: p.id,
            name: p.name,
            description: p.description,
            price: p.price,
            image: p.image,
            sizes: (p.sizes || []).join(", "),
            colors: (p.colors || []).join(", "),
            active: p.active !== false,
        });
        setEditing(p.id);
    };

    const cancel = () => {
        setEditing(null);
        setForm(EMPTY);
    };

    const save = async () => {
        if (!form.name.trim()) return toast.error("Nom requis");
        if (!Number(form.price) || Number(form.price) <= 0) return toast.error("Prix invalide");
        setBusy(true);
        try {
            const payload = {
                id: editing === "new" ? (form.id.trim() || undefined) : undefined,
                name: form.name.trim(),
                description: form.description.trim(),
                price: Number(form.price),
                image: form.image.trim(),
                sizes: form.sizes.split(",").map((s) => s.trim()).filter(Boolean),
                colors: form.colors.split(",").map((s) => s.trim()).filter(Boolean),
                active: !!form.active,
            };
            if (editing === "new") {
                await adminCreateProduct(password, payload);
                toast.success("Produit créé");
            } else {
                await adminUpdateProduct(password, editing, payload);
                toast.success("Produit mis à jour");
            }
            await refresh();
            cancel();
        } catch (e) {
            toast.error(e?.response?.data?.detail || "Erreur de sauvegarde");
        } finally {
            setBusy(false);
        }
    };

    const remove = async (p) => {
        if (!window.confirm(`Supprimer définitivement « ${p.name} » ?`)) return;
        try {
            await adminDeleteProduct(password, p.id);
            toast.success("Produit supprimé");
            refresh();
        } catch {
            toast.error("Erreur de suppression");
        }
    };

    const toggleActive = async (p) => {
        try {
            await adminUpdateProduct(password, p.id, {
                name: p.name,
                description: p.description,
                price: p.price,
                image: p.image,
                sizes: p.sizes,
                colors: p.colors,
                active: !p.active,
            });
            refresh();
        } catch {
            toast.error("Erreur");
        }
    };

    return (
        <section className="mt-12" data-testid="admin-products">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-2xl">Gestion des produits ({products.length})</h2>
                <button onClick={startNew} className="neo-btn neo-btn-primary" data-testid="add-product-btn">
                    <Plus size={16} /> Ajouter
                </button>
            </div>

            {editing && (
                <div className="neo-card p-6 mb-6" data-testid="product-form">
                    <h3 className="font-display text-xl mb-4">
                        {editing === "new" ? "Nouveau produit" : `Modifier « ${form.name} »`}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {editing === "new" && (
                            <div>
                                <label className="neo-label">ID (optionnel, slug auto sinon)</label>
                                <input className="neo-input" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="ex: bonnet" data-testid="product-id" />
                            </div>
                        )}
                        <div className={editing === "new" ? "" : "md:col-span-2"}>
                            <label className="neo-label">Nom</label>
                            <input className="neo-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="product-name" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="neo-label">Description</label>
                            <input className="neo-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="product-description" />
                        </div>
                        <div>
                            <label className="neo-label">Prix (€)</label>
                            <input type="number" step="0.01" className="neo-input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} data-testid="product-price" />
                        </div>
                        <div>
                            <label className="neo-label">Image produit</label>
                            <div className="flex flex-col gap-2">
                                {form.image && (
                                    <img src={form.image} alt="aperçu" className="w-24 h-24 object-cover border-2 border-black" />
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const widget = window.cloudinary.createUploadWidget(
                                            {
                                                cloudName: "dpwsbjwl0",
                                                uploadPreset: "poda_products",
                                                sources: ["local", "camera"],
                                                multiple: false,
                                                cropping: true,
                                                croppingAspectRatio: 1,
                                                language: "fr",
                                                text: {
                                                    fr: {
                                                        or: "ou",
                                                        menu: { files: "Mes fichiers", camera: "Caméra" },
                                                        selection_counter: { image: "image sélectionnée" },
                                                        actions: { upload: "Envoyer", clear: "Effacer" },
                                                    }
                                                }
                                            },
                                            (error, result) => {
                                                if (!error && result?.event === "success") {
                                                    setForm(f => ({ ...f, image: result.info.secure_url }));
                                                }
                                            }
                                        );
                                        widget.open();
                                    }}
                                    className="neo-btn-outline text-sm flex items-center gap-2"
                                >
                                    📷 {form.image ? "Changer l'image" : "Choisir une image"}
                                </button>
                                {form.image && (
                                    <button
                                        type="button"
                                        onClick={() => setForm(f => ({ ...f, image: "" }))}
                                        className="text-xs text-[#FF6B6B] hover:underline text-left"
                                    >
                                        Supprimer l'image
                                    </button>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="neo-label">Tailles (virgules)</label>
                            <input className="neo-input" value={form.sizes} onChange={(e) => setForm({ ...form, sizes: e.target.value })} placeholder="S, M, L" data-testid="product-sizes" />
                        </div>
                        <div>
                            <label className="neo-label">Couleurs (virgules)</label>
                            <input className="neo-input" value={form.colors} onChange={(e) => setForm({ ...form, colors: e.target.value })} placeholder="Noir, Blanc" data-testid="product-colors" />
                        </div>
                        <div className="md:col-span-2 flex items-center gap-2">
                            <input type="checkbox" id="active" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} data-testid="product-active" />
                            <label htmlFor="active" className="text-sm font-bold uppercase tracking-widest">Actif (visible sur la boutique)</label>
                        </div>
                    </div>
                    <div className="flex gap-3 mt-5">
                        <button onClick={save} disabled={busy} className="neo-btn neo-btn-primary" data-testid="save-product">
                            <Save size={16} /> Enregistrer
                        </button>
                        <button onClick={cancel} className="neo-btn neo-btn-secondary" data-testid="cancel-product">
                            <X size={16} /> Annuler
                        </button>
                    </div>
                </div>
            )}

            <div className="neo-card overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-[#FBEA8C] border-b-4 border-black">
                        <tr>
                            <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Visuel</th>
                            <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Nom</th>
                            <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Prix</th>
                            <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Tailles</th>
                            <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Couleurs</th>
                            <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Actif</th>
                            <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Actions</th>
                        </tr>
                    </thead>
                    <tbody data-testid="admin-products-table">
                        {products.length === 0 && (
                            <tr><td colSpan={7} className="p-6 text-center text-black/60">Aucun produit. Cliquez sur Ajouter.</td></tr>
                        )}
                        {products.map((p) => (
                            <tr key={p.id} className="border-b-2 border-black/10">
                                <td className="p-3">
                                    {p.image && <img src={p.image} alt={p.name} className="w-12 h-12 object-cover border-2 border-black" />}
                                </td>
                                <td className="p-3 font-bold">{p.name}<br/><span className="text-xs font-mono text-black/60">{p.id}</span></td>
                                <td className="p-3">{Number(p.price).toFixed(2)}€</td>
                                <td className="p-3 text-xs">{(p.sizes || []).join(", ")}</td>
                                <td className="p-3 text-xs">{(p.colors || []).join(", ")}</td>
                                <td className="p-3">{p.active ? "✓" : "—"}</td>
                                <td className="p-3 flex gap-2 flex-wrap">
                                    <button onClick={() => startEdit(p)} className="border-2 border-black px-2 py-1 hover:bg-[#FBEA8C]" data-testid={`edit-product-${p.id}`} title="Modifier"><Pencil size={14} /></button>
                                    <button onClick={() => toggleActive(p)} className="border-2 border-black px-2 py-1 hover:bg-[#FBEA8C]" title={p.active ? "Désactiver" : "Activer"}>{p.active ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                                    <button onClick={() => remove(p)} className="border-2 border-black px-2 py-1 hover:bg-[#FF6B6B] hover:text-white" data-testid={`delete-product-${p.id}`} title="Supprimer"><Trash2 size={14} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
