import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";

const BACKEND = process.env.REACT_APP_BACKEND_URL || "https://api.poda.bleem-co.fr";

export default function AssoPage() {
    const { token } = useParams();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${BACKEND}/api/asso/${token}`)
            .then(r => {
                if (!r.ok) throw new Error("Lien invalide ou expiré.");
                return r.json();
            })
            .then(setData)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [token]);

    const exportCSV = () => {
        if (!data) return;
        const rows = [["N° commande", "Prénom", "Nom", "Email (masqué)", "Articles", "Taille", "Couleur", "Lot", "Expédié"]];
        data.orders.forEach(o => {
            o.items.forEach(it => {
                rows.push([
                    o.order_number,
                    o.customer?.first_name || "",
                    o.customer?.last_name || "",
                    o.customer?.email || "",
                    `${it.quantity}x ${it.product_name}`,
                    it.size,
                    it.color,
                    o.batch_number || "—",
                    o.shipped ? "Oui" : "Non",
                ]);
            });
        });
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
        const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `poda-commandes-lot${data.batch_number}.csv`;
        a.click();
    };

    if (loading) return (
        <div className="min-h-screen bg-[#FDF8F5] flex items-center justify-center">
            <p className="font-display text-xl">Chargement...</p>
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-[#FDF8F5] flex items-center justify-center">
            <div className="border-4 border-black p-8 max-w-sm text-center">
                <p className="text-4xl mb-4">🔒</p>
                <p className="font-display text-xl mb-2">Lien invalide</p>
                <p className="text-sm text-black/60">{error}</p>
            </div>
        </div>
    );

    const deadline = data.deadline_at ? new Date(data.deadline_at) : null;

    return (
        <div className="min-h-screen bg-[#FDF8F5]">
            {/* Header */}
            <header className="bg-[#FBEA8C] border-b-4 border-black px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {data.logo_data_url ? (
                        <img src={data.logo_data_url} alt="logo" className="h-10 w-10 object-contain" />
                    ) : (
                        <span className="font-display text-2xl font-black">PODA<span className="text-[#FF6B6B]">.</span></span>
                    )}
                    <div>
                        <p className="font-display text-lg font-black">{data.association_name}</p>
                        <p className="text-xs text-black/60 uppercase tracking-widest">Vue responsable</p>
                    </div>
                </div>
                <button
                    onClick={exportCSV}
                    className="bg-black text-white text-xs font-bold uppercase px-4 py-2 border-2 border-black hover:bg-transparent hover:text-black transition-colors"
                >
                    ↓ Exporter CSV
                </button>
            </header>

            <div className="max-w-5xl mx-auto px-6 py-8">
                {/* Progression du lot */}
                <div className="border-4 border-black bg-white p-6 mb-8">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold uppercase tracking-widest text-black/50">Lot collectif en cours</p>
                        <p className="text-xs font-bold uppercase tracking-widest">Lot #{data.batch_number}</p>
                    </div>
                    <div className="border-2 border-black h-8 relative mb-2">
                        <div
                            className="bg-[#FBEA8C] h-full transition-all"
                            style={{ width: `${Math.min(100, (data.position_in_batch / data.batch_size) * 100)}%` }}
                        />
                        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                            {data.position_in_batch}/{data.batch_size} unités
                        </span>
                    </div>
                    {deadline && (
                        <p className="text-xs text-black/50">
                            📅 Lancement automatique le {deadline.toLocaleDateString("fr-FR")} si le lot n'est pas complet
                        </p>
                    )}
                </div>

                {/* Tableau des commandes */}
                <div className="border-4 border-black bg-white">
                    <div className="border-b-4 border-black px-6 py-4 flex items-center justify-between">
                        <h2 className="font-display text-xl font-black">
                            Commandes membres <span className="text-[#FF6B6B]">({data.orders.length})</span>
                        </h2>
                    </div>

                    {data.orders.length === 0 ? (
                        <div className="p-12 text-center text-black/40">
                            <p className="text-4xl mb-3">📦</p>
                            <p className="font-bold">Aucune commande pour l'instant</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-black text-white">
                                        <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Membre</th>
                                        <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Articles</th>
                                        <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Lot</th>
                                        <th className="text-left p-3 font-bold uppercase tracking-widest text-xs">Expédié</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.orders.map((o, i) => (
                                        <tr key={o.order_number} className={i % 2 === 0 ? "bg-white" : "bg-[#FDF8F5]"}>
                                            <td className="p-3">
                                                <p className="font-bold">{o.customer?.first_name} {o.customer?.last_name}</p>
                                                <p className="text-xs text-black/50">{o.customer?.email}</p>
                                            </td>
                                            <td className="p-3">
                                                {o.items.map((it, j) => (
                                                    <div key={j} className="text-xs mb-1">
                                                        <span className="font-bold">{it.quantity}×</span> {it.product_name}
                                                        {it.size !== "—" && <span className="text-black/50"> — {it.size} / {it.color}</span>}
                                                    </div>
                                                ))}
                                            </td>
                                            <td className="p-3 text-xs font-mono">
                                                {o.batch_number ? `#${o.batch_number}` : "—"}
                                            </td>
                                            <td className="p-3">
                                                {o.shipped
                                                    ? <span className="text-green-700 font-bold text-xs">✓ Expédié</span>
                                                    : <span className="text-black/40 text-xs">En attente</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <p className="mt-6 text-center text-xs text-black/30">
                    Vue réservée au responsable de l'association · PODA by BLEEM
                </p>
            </div>
        </div>
    );
}
