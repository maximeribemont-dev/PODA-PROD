import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getOrderStatus, getGlobalProgress } from "../lib/api";
import { BatchProgress } from "../components/BatchProgress";
import { CheckCircle2, AlertTriangle, Loader2, PartyPopper } from "lucide-react";
import { useCart } from "../context/CartContext";

export default function SuccessPage() {
    const [params] = useSearchParams();
    const sessionId = params.get("session_id");
    const [status, setStatus] = useState("polling");
    const [order, setOrder] = useState(null);
    const [progress, setProgress] = useState(null);
    const attemptsRef = useRef(0);
    const { clear } = useCart();

    useEffect(() => {
        if (!sessionId) {
            setStatus("failed");
            return;
        }
        let cancelled = false;
        const poll = async () => {
            attemptsRef.current += 1;
            try {
                const data = await getOrderStatus(sessionId);
                if (cancelled) return;
                setOrder(data);
                if (data.payment_status === "paid") {
                    setStatus("paid");
                    clear();
                    try {
                        setProgress(await getGlobalProgress());
                    } catch (_e) {
                        // non-blocking
                    }
                    return;
                }
                if (data.stripe_status === "expired") {
                    setStatus("expired");
                    return;
                }
                if (attemptsRef.current >= 8) {
                    setStatus("failed");
                    return;
                }
                setTimeout(poll, 2000);
            } catch (_e) {
                if (attemptsRef.current >= 8) setStatus("failed");
                else setTimeout(poll, 2000);
            }
        };
        poll();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId]);

    return (
        <div className="max-w-3xl mx-auto px-6 sm:px-10 py-16">
            {status === "polling" && (
                <div className="neo-card p-10 text-center" data-testid="success-polling">
                    <Loader2 className="mx-auto mb-4 animate-spin" size={48} />
                    <h1 className="font-display text-4xl mb-2">Vérification du paiement…</h1>
                    <p className="text-black/70">Un instant, on confirme votre commande.</p>
                </div>
            )}

            {status === "paid" && order && (
                <div className="neo-card p-10" data-testid="success-paid">
                    <div className="flex items-center gap-3 mb-4">
                        <CheckCircle2 className="text-[#4ECDC4]" size={36} />
                        <h1 className="font-display text-4xl sm:text-5xl">Merci !</h1>
                    </div>
                    <p className="text-lg text-black/70 mb-6">
                        Commande <b>{order.order_number}</b> confirmée.
                    </p>

                    <div className="border-4 border-black p-4 mb-6">
                        <div className="text-xs uppercase tracking-widest font-bold mb-3">Articles</div>
                        <ul className="space-y-2" data-testid="success-items">
                            {order.items.map((it, i) => (
                                <li key={i} className="flex items-center justify-between gap-3 text-sm">
                                    {it.product_id === "__express__" ? (
                                        <span>🚀 <b>{it.product_name}</b></span>
                                    ) : (
                                        <span>{it.quantity}× <b>{it.product_name}</b> ({it.size}, {it.color})</span>
                                    )}
                                    <span className="font-bold">{(it.unit_price * it.quantity).toFixed(2)}€</span>
                                </li>
                            ))}
                        </ul>
                        <div className="border-t-2 border-black mt-3 pt-3 flex items-center justify-between">
                            <span className="text-xs uppercase tracking-widest font-bold">Total</span>
                            <span className="font-display text-2xl">{order.total_amount.toFixed(2)}€</span>
                        </div>
                    </div>

                    {/* Bloc livraison selon le type de commande */}
                    {order.items.some(it => it.product_id === "__express__") ? (
                        <div className="bg-black text-white border-4 border-black p-5 mb-6">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl">🚀</span>
                                <span className="text-xs font-bold uppercase tracking-[0.2em]">Livraison express à domicile</span>
                            </div>
                            <p className="font-display text-2xl mb-1">Livraison sous 8 jours ouvrés</p>
                            <p className="text-white/70 text-sm">Votre commande est traitée en priorité et expédiée directement à votre adresse. Vous recevrez un email de suivi dès l'expédition.</p>
                        </div>
                    ) : (
                        <div className="bg-[#FBEA8C] border-4 border-black p-5 mb-6">
                            <div className="flex items-center gap-2 mb-3">
                                <PartyPopper size={20} />
                                <span className="text-xs font-bold uppercase tracking-[0.2em]">Votre place dans le lot</span>
                            </div>
                            <div className="font-display text-4xl mb-2" data-testid="success-position">
                                Positions {order.start_position} → {order.end_position} / {order.batch_size}
                            </div>
                            <p className="text-black/70 text-sm mb-3">
                                Lot #{order.batch_number}. Dès qu'il atteint {order.batch_size} unités, l'ensemble est expédié au bureau de l'asso.
                            </p>
                            <div className="border-t-2 border-black/20 pt-3 flex items-center gap-2 text-sm font-bold">
                                <span>📦</span>
                                <span>Délai estimé après lancement du lot : <u>10 à 15 jours ouvrés</u></span>
                            </div>
                        </div>
                    )}

                    {progress && <BatchProgress progress={progress} />}

                    <div className="mt-8 flex flex-wrap gap-4">
                        <Link to="/" className="neo-btn neo-btn-secondary" data-testid="success-back">
                            Retour boutique
                        </Link>
                    </div>
                </div>
            )}

            {(status === "failed" || status === "expired") && (
                <div className="neo-card p-10 text-center" data-testid="success-failed">
                    <AlertTriangle className="mx-auto mb-4 text-[#FF6B6B]" size={48} />
                    <h1 className="font-display text-4xl mb-2">Paiement non confirmé</h1>
                    <p className="text-black/70 mb-6">Vous pouvez recommencer.</p>
                    <Link to="/cart" className="neo-btn neo-btn-primary">Retour panier</Link>
                </div>
            )}
        </div>
    );
}
