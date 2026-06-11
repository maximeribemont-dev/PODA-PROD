export const BatchProgress = ({ progress, label, compact = false, testIdPrefix = "progress" }) => {
    if (!progress) return null;
    const filled = progress.position_in_batch;
    const size = progress.batch_size;
    const pct = (filled / size) * 100;
    const remaining = progress.remaining;
    return (
        <div data-testid={`${testIdPrefix}-${progress.product_id}`} className="w-full">
            {label && (
                <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-[0.2em]">{label}</span>
                    <span className="text-xs font-bold uppercase tracking-[0.2em]">
                        Lot #{progress.current_batch_number}
                    </span>
                </div>
            )}
            <div className="progress-track">
                <div
                    className="progress-fill"
                    style={{ width: `${pct}%` }}
                    data-testid={`${testIdPrefix}-fill-${progress.product_id}`}
                />
                <div className="progress-text" data-testid={`${testIdPrefix}-text-${progress.product_id}`}>
                    {filled}/{size} commandes
                </div>
            </div>
            {!compact && (
                <p className="mt-2 text-sm font-medium text-black/70">
                    {remaining === size
                        ? "Soyez le premier du prochain lot !"
                        : `Encore ${remaining} commande${remaining > 1 ? "s" : ""} avant expédition au bureau de l'asso.`}
                </p>
            )}
        </div>
    );
};
