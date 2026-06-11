import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getOrderStatus, getProductProgress } from "../lib/api";
import { BatchProgress } from "../components/BatchProgress";
import { CheckCircle2, AlertTriangle, Loader2, PartyPopper } from "lucide-react";

export default function SuccessPage() {
    const [params] = useSearchParams();
    const sessionId = params.get("session_id");
    const [status, setStatus] = useState("polling"); // polling, paid, failed, expired
    const [order, setOrder] = useState(null);
    const [progress, setProgress] = useState(null);
    const attemptsRef = useRef(0);

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
                    try {
                        setProgress(await getProductProgress(data.product_id));
                    } catch {}
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
            } catch (e) {
                if (attemptsRef.current >= 8) {
                    setStatus("failed");
                } else {
                    setTimeout(poll, 2000);
                }
            }
        };
        poll();
        return () => {
            cancelled = true;
        };
    }, [sessionId]);

    return (
        <div className="max-w-3xl mx-auto px-6 sm:px-10 py-16">
            {status === "polling" && (
                <div className="neo-card p-10 text-center" data-testid="success-polling">
                    <Loader2 className="mx-auto mb-4 animate-spin" size={48} />
                    <h1 className="font-display text-4xl mb-2">Vérification du paiement…</h1>
                    <p className="text-black/70">Un instant, on confirme votre commande auprès de Stripe.</p>
                </div>
            )}

            {status === "paid" && order && (
                <div className="neo-card p-10" data-testid="success-paid">
                    <div className="flex items-center gap-3 mb-4">
                        <CheckCircle2 className="text-[#4ECDC4]" size={36} />
                        <h1 className="font-display text-4xl sm:text-5xl">Merci !</h1>
                    </div>
                    <p className="text-lg text-black/70 mb-6">
                        Votre commande <b>{order.order_number}</b> est confirmée.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                        <Info label="Produit" value={`${order.product_name}`} />
                        <Info label="Taille" value={order.size} />
                        <Info label="Couleur" value={order.color} />
                        <Info label="Montant" value={`${order.amount.toFixed(2)} €`} />
                    </div>

                    <div className="bg-[#FBEA8C] border-4 border-black p-5 mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <PartyPopper size={20} />
                            <span className="text-xs font-bold uppercase tracking-[0.2em]">
                                Votre place dans le lot
                            </span>
                        </div>
                        <div className="font-display text-5xl mb-2" data-testid="success-position">
                            {order.position_in_batch}/{order.batch_size}
                        </div>
                        <p className="text-black/70 text-sm">
                            Lot #{order.batch_number} pour le produit {order.product_name}. Dès qu'il atteint{" "}
                            {order.batch_size}, l'ensemble est expédié au bureau Poda.
                        </p>
                    </div>

                    {progress && <BatchProgress progress={progress} label={order.product_name} />}

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
                    <p className="text-black/70 mb-6">
                        Soit la session a expiré, soit le paiement n'a pas abouti. Vous pouvez recommencer.
                    </p>
                    <Link to="/" className="neo-btn neo-btn-primary">
                        Retour à la boutique
                    </Link>
                </div>
            )}
        </div>
    );
}

const Info = ({ label, value }) => (
    <div className="border-4 border-black p-4 bg-white">
        <div className="text-xs uppercase tracking-widest font-bold mb-1 text-black/60">{label}</div>
        <div className="font-display text-xl break-words">{value}</div>
    </div>
);
