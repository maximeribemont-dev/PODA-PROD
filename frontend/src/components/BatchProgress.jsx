import { useCart } from "../context/CartContext";

export const BatchProgress = ({ progress, compact = false }) => {
    const { addItem, items } = useCart();
    if (!progress) return null;

    const isCampaign = progress.shop_mode === "campaign";
    const hasExpress = items.some((i) => i.product_id === "__express__");

    const handleExpress = () => {
        if (hasExpress) return;
        addItem({
            product_id: "__express__",
            name: "🚀 Livraison express à domicile",
            size: "—",
            color: "—",
            quantity: 1,
            unit_price: 20,
        });
    };

    // ── Mode campagne ──────────────────────────────────────────
    if (isCampaign) {
        const ended = progress.campaign_ended;
        const daysLeft = progress.campaign_days_left;
        const endDate = progress.campaign_end_at
            ? new Date(progress.campaign_end_at).toLocaleDateString("fr-FR")
            : null;

        return (
            <div data-testid="global-progress" className="w-full">
                {!compact && (
                    <div className="flex items-baseline justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-[0.2em]">Campagne en cours</span>
                        {endDate && (
                            <span className="text-xs font-bold uppercase tracking-[0.2em]">
                                Fermeture le {endDate}
                            </span>
                        )}
                    </div>
                )}

                {/* Compte à rebours */}
                <div className="border-4 border-black bg-white p-4 text-center">
                    {ended ? (
                        <p className="font-display text-xl font-black">🎉 Campagne terminée — en production !</p>
                    ) : (
                        <>
                            <p className="text-4xl font-black font-display">
                                {daysLeft !== null && daysLeft !== undefined ? daysLeft : "—"}
                            </p>
                            <p className="text-xs font-bold uppercase tracking-widest text-black/50">
                                {daysLeft === 0 ? "Dernier jour !" : daysLeft === 1 ? "jour restant" : "jours restants"}
                            </p>
                            {endDate && (
                                <p className="text-xs text-black/40 mt-1">
                                    Commandez avant le {endDate}
                                </p>
                            )}
                        </>
                    )}
                </div>

                {!compact && !ended && (
                    <>
                        <p className="mt-2 text-sm font-medium text-black/70">
                            {progress.total_units_paid > 0
                                ? `${progress.total_units_paid} commande${progress.total_units_paid > 1 ? "s" : ""} déjà passée${progress.total_units_paid > 1 ? "s" : ""}.`
                                : "Soyez le premier à commander !"}
                        </p>
                        <button
                            onClick={handleExpress}
                            disabled={hasExpress}
                            className={`mt-3 flex items-center justify-center gap-2 w-full border-2 font-display uppercase text-sm px-4 py-2 transition-colors ${
                                hasExpress
                                    ? "bg-green-100 border-green-500 text-green-700 cursor-default"
                                    : "border-black bg-transparent text-black hover:bg-black hover:text-white"
                            }`}
                        >
                            {hasExpress ? "✓ Livraison à domicile ajoutée" : (
                                <>
                                    🚀 Ne pas attendre — livraison directe chez moi
                                    <span className="bg-[#FF6B6B] text-white text-xs px-2 py-0.5 font-bold">+20€</span>
                                </>
                            )}
                        </button>
                    </>
                )}
            </div>
        );
    }

    // ── Mode lot collectif (défaut) ────────────────────────────
    const filled = progress.position_in_batch;
    const size = progress.batch_size;
    const pct = (filled / size) * 100;
    const remaining = progress.remaining;
    const isComplete = remaining === 0;

    return (
        <div data-testid="global-progress" className="w-full">
            {!compact && (
                <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-[0.2em]">Lot collectif en cours</span>
                    <span className="text-xs font-bold uppercase tracking-[0.2em]">
                        Lot #{progress.current_batch_number}
                    </span>
                </div>
            )}
            <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pct}%` }} data-testid="progress-fill" />
                <div className="progress-text" data-testid="progress-text">
                    {filled}/{size} unités
                </div>
            </div>
            {!compact && (
                <>
                    <p className="mt-2 text-sm font-medium text-black/70">
                        {remaining === size
                            ? "Soyez le premier du prochain lot !"
                            : isComplete
                            ? "🎉 Lot complet — en route vers la production !"
                            : `Encore ${remaining} unité${remaining > 1 ? "s" : ""} avant expédition au bureau.`}
                    </p>
                    {!isComplete && progress.deadline_days_left !== null && progress.deadline_days_left !== undefined && (
                        <p className="mt-1.5 text-xs font-bold uppercase tracking-wide text-black/50 flex items-center gap-1.5">
                            <span>📅</span>
                            {progress.deadline_days_left > 0
                                ? `Lancement automatique dans ${progress.deadline_days_left} jour${progress.deadline_days_left > 1 ? "s" : ""} max, même si le lot n'est pas complet`
                                : "Lancement automatique imminent, même si le lot n'est pas complet"}
                        </p>
                    )}
                    {!isComplete && (
                        <button
                            onClick={handleExpress}
                            disabled={hasExpress}
                            className={`mt-3 flex items-center justify-center gap-2 w-full border-2 font-display uppercase text-sm px-4 py-2 transition-colors ${
                                hasExpress
                                    ? "bg-green-100 border-green-500 text-green-700 cursor-default"
                                    : "border-black bg-transparent text-black hover:bg-black hover:text-white"
                            }`}
                        >
                            {hasExpress ? "✓ Livraison à domicile ajoutée" : (
                                <>
                                    🚀 Ne pas attendre — livraison directe chez moi
                                    <span className="bg-[#FF6B6B] text-white text-xs px-2 py-0.5 font-bold">+20€</span>
                                </>
                            )}
                        </button>
                    )}
                </>
            )}
        </div>
    );
};
