import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProducts, getAllProgress } from "../lib/api";
import { BatchProgress } from "../components/BatchProgress";
import { Truck, Sparkles, Users } from "lucide-react";

export default function HomePage() {
    const [products, setProducts] = useState([]);
    const [progressMap, setProgressMap] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const [p, prog] = await Promise.all([getProducts(), getAllProgress()]);
                setProducts(p);
                const map = {};
                prog.forEach((x) => (map[x.product_id] = x));
                setProgressMap(map);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const totalPaid = Object.values(progressMap).reduce((a, b) => a + b.total_paid, 0);

    return (
        <div className="min-h-screen">
            {/* Hero */}
            <section className="relative overflow-hidden bg-[#FDF8F5] border-b-4 border-black">
                <div className="bg-grain absolute inset-0" />
                <div className="max-w-7xl mx-auto px-6 sm:px-10 py-16 sm:py-24 relative">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                        <div className="lg:col-span-7">
                            <div className="inline-flex items-center gap-2 bg-[#C4B5FD] border-4 border-black px-4 py-2 mb-6 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
                                <Sparkles size={16} />
                                <span className="text-xs font-bold uppercase tracking-[0.2em]">
                                    Merch d'association · Print on demand
                                </span>
                            </div>
                            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl leading-[0.95] mb-6">
                                Le merch
                                <br />
                                <span className="bg-[#FBEA8C] px-3 inline-block border-4 border-black mt-2">
                                    en un clic.
                                </span>
                            </h1>
                            <p className="text-lg sm:text-xl text-black/70 max-w-xl mb-8">
                                Commandez votre pièce Poda. Dès que <b>20 commandes</b> sont passées sur un produit,
                                le lot est lancé en production et expédié directement au bureau de l'association.
                            </p>
                            <div className="flex flex-wrap gap-4">
                                <a
                                    href="#produits"
                                    data-testid="hero-cta-shop"
                                    className="neo-btn neo-btn-primary"
                                >
                                    Voir la boutique
                                </a>
                                <a
                                    href="#concept"
                                    data-testid="hero-cta-concept"
                                    className="neo-btn neo-btn-secondary"
                                >
                                    Le concept
                                </a>
                            </div>
                            <div className="mt-10 flex gap-6 flex-wrap">
                                <div className="neo-card px-5 py-4">
                                    <div className="text-xs uppercase tracking-widest font-bold">Commandes totales</div>
                                    <div className="font-display text-3xl mt-1" data-testid="stat-total-orders">
                                        {totalPaid}
                                    </div>
                                </div>
                                <div className="neo-card px-5 py-4 bg-[#FBCFE8]">
                                    <div className="text-xs uppercase tracking-widest font-bold">Lot</div>
                                    <div className="font-display text-3xl mt-1">20 pièces</div>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-5">
                            <div className="neo-card p-6 sm:p-8">
                                <div className="flex items-center gap-3 mb-4">
                                    <Users size={20} />
                                    <span className="text-xs font-bold uppercase tracking-[0.2em]">
                                        Progression collective
                                    </span>
                                </div>
                                <div className="space-y-5">
                                    {products.slice(0, 4).map((p) => (
                                        <BatchProgress
                                            key={p.id}
                                            progress={progressMap[p.id]}
                                            label={p.name}
                                            compact
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Marquee */}
                <div className="border-t-4 border-black bg-[#FF6B6B] py-3 overflow-hidden">
                    <div className="marquee-track text-white font-display text-xl uppercase tracking-tight">
                        {Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-12 px-12 whitespace-nowrap">
                                <span>20 commandes = 1 lot expédié</span>
                                <span>•</span>
                                <span>Print on demand militant</span>
                                <span>•</span>
                                <span>Fait avec amour pour l'asso</span>
                                <span>•</span>
                                <span>Livraison au bureau Poda</span>
                                <span>•</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Concept */}
            <section id="concept" className="max-w-7xl mx-auto px-6 sm:px-10 py-20">
                <h2 className="font-display text-4xl sm:text-5xl mb-10 max-w-2xl">
                    Comment ça marche ?
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { n: "01", t: "Choisissez votre pièce", d: "Six produits brodés ou sérigraphiés au choix.", c: "#FBEA8C" },
                        { n: "02", t: "Commandez en 1 clic", d: "Formulaire express + paiement Stripe sécurisé.", c: "#C4B5FD" },
                        { n: "03", t: "Lot expédié à 20", d: "Dès que 20 commandes sont atteintes, on lance la prod.", c: "#FBCFE8" },
                    ].map((step) => (
                        <div
                            key={step.n}
                            className="neo-card p-6"
                            style={{ background: step.c }}
                            data-testid={`step-${step.n}`}
                        >
                            <div className="font-display text-5xl mb-4">{step.n}</div>
                            <h3 className="font-display text-2xl mb-2">{step.t}</h3>
                            <p className="text-black/70">{step.d}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Produits */}
            <section id="produits" className="max-w-7xl mx-auto px-6 sm:px-10 pb-24">
                <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
                    <h2 className="font-display text-4xl sm:text-5xl">La boutique</h2>
                    <p className="text-sm font-bold uppercase tracking-[0.2em] text-black/70">
                        {products.length} produits · Print on demand
                    </p>
                </div>

                {loading ? (
                    <div className="text-center py-20 font-display text-2xl">Chargement…</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                        {products.map((p) => (
                            <article
                                key={p.id}
                                data-testid={`product-card-${p.id}`}
                                className="neo-card neo-card-hover flex flex-col"
                            >
                                <div className="aspect-square bg-[#FDF8F5] border-b-4 border-black overflow-hidden">
                                    <img
                                        src={p.image}
                                        alt={p.name}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                </div>
                                <div className="p-5 flex flex-col flex-1">
                                    <div className="flex items-baseline justify-between mb-2">
                                        <h3 className="font-display text-2xl">{p.name}</h3>
                                        <span className="font-display text-2xl">{p.price.toFixed(0)}€</span>
                                    </div>
                                    <p className="text-sm text-black/70 mb-4">{p.description}</p>
                                    <div className="mb-4">
                                        <BatchProgress progress={progressMap[p.id]} compact />
                                    </div>
                                    <Link
                                        to={`/commander/${p.id}`}
                                        data-testid={`order-btn-${p.id}`}
                                        className="neo-btn neo-btn-primary mt-auto"
                                    >
                                        <Truck size={18} /> Commander
                                    </Link>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            <footer className="border-t-4 border-black bg-black text-white py-10">
                <div className="max-w-7xl mx-auto px-6 sm:px-10 flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="font-display text-2xl">
                        PODA<span className="text-[#FF6B6B]">.</span>
                    </div>
                    <p className="text-sm text-white/60">
                        © {new Date().getFullYear()} Poda — Merch militant, fabriqué avec soin.
                    </p>
                </div>
            </footer>
        </div>
    );
}
