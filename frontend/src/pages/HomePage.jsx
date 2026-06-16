import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProducts, getGlobalProgress } from "../lib/api";
import { BatchProgress } from "../components/BatchProgress";
import { ProductCard } from "../components/ProductCard";
import { Sparkles, Users, ShoppingBag } from "lucide-react";
import { useCart } from "../context/CartContext";

export default function HomePage() {
    const [products, setProducts] = useState([]);
    const [progress, setProgress] = useState(null);
    const [loading, setLoading] = useState(true);
    const { totalUnits } = useCart();

    useEffect(() => {
        (async () => {
            try {
                const [p, prog] = await Promise.all([getProducts(), getGlobalProgress()]);
                setProducts(p);
                setProgress(prog);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

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
                                Composez votre commande, ajoutez vos pièces au panier. Dès que <b>20 unités au total</b> sont
                                achetées (tous produits confondus), le lot part en production et est expédié au bureau de l'asso.
                            </p>
                            <div className="flex flex-wrap gap-4">
                                <a href="#produits" data-testid="hero-cta-shop" className="neo-btn neo-btn-primary">
                                    Voir la boutique
                                </a>
                                <Link to="/cart" data-testid="hero-cta-cart" className="neo-btn neo-btn-secondary">
                                    <ShoppingBag size={18} /> Mon panier ({totalUnits})
                                </Link>
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
                                <BatchProgress progress={progress} />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="border-t-4 border-black bg-[#FF6B6B] py-3 overflow-hidden">
                    <div className="marquee-track text-white font-display text-xl uppercase tracking-tight">
                        {Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-12 px-12 whitespace-nowrap">
                                <span>20 unités = 1 lot expédié</span>
                                <span>•</span>
                                <span>Print on demand</span>
                                <span>•</span>
                                <span>Fait avec amour pour l'asso</span>
                                <span>•</span>
                                <span>Livraison au bureau de l'asso</span>
                                <span>•</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Concept */}
            <section id="concept" className="max-w-7xl mx-auto px-6 sm:px-10 py-20">
                <h2 className="font-display text-4xl sm:text-5xl mb-10 max-w-2xl">Comment ça marche ?</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { n: "01", t: "Composez votre panier", d: "Choisissez vos pièces, tailles, couleurs et quantités.", c: "#FBEA8C" },
                        { n: "02", t: "Payez en 1 clic", d: "Formulaire express + paiement Stripe sécurisé.", c: "#C4B5FD" },
                        { n: "03", t: "Lot expédié à 20", d: "Dès que 20 unités tous produits confondus sont atteintes, on lance la prod.", c: "#FBCFE8" },
                    ].map((step) => (
                        <div key={step.n} className="neo-card p-6" style={{ background: step.c }}>
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
                        {products.map((p) => <ProductCard key={p.id} product={p} />)}
                    </div>
                )}
            </section>

            <footer className="border-t-4 border-black bg-black text-white py-10">
                <div className="max-w-7xl mx-auto px-6 sm:px-10 flex flex-col gap-6">
                    <div className="flex flex-col items-center gap-3 py-4 border border-white/20 rounded-lg px-6 text-center">
                        <p className="text-white font-display text-lg uppercase tracking-tight">Tu veux un PODA pour ton asso ?</p>
                        <a
                            href="https://bleem-co.fr/contactez-nous/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block bg-[#FF6B6B] text-black font-display uppercase text-sm px-6 py-2 border-2 border-[#FF6B6B] hover:bg-transparent hover:text-[#FF6B6B] transition-colors"
                        >
                            Contacte BLEEM →
                        </a>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                        <div className="font-display text-2xl">
                            PODA<span className="text-[#FF6B6B]">.</span>
                        </div>
                        <nav className="flex flex-wrap gap-5 text-sm">
                            <Link to="/legal/cgv" className="hover:underline" data-testid="footer-cgv">CGV</Link>
                            <Link to="/legal/confidentialite" className="hover:underline" data-testid="footer-privacy">Confidentialité</Link>
                            <Link to="/admin" className="hover:underline">Admin</Link>
                        </nav>
                    </div>
                    <p className="text-xs text-white/50 text-center sm:text-left">
                        © {new Date().getFullYear()} Poda · Édité par SAS BLEEM · RCS Le Mans 953 785 706 · 3 rue des Noisetiers, 72190 Sargé-lès-le-Mans · Capital 1 000 €
                    </p>
                </div>
            </footer>
        </div>
    );
}
