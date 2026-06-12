export const BatchProgress = ({ progress, compact = false }) => {
    if (!progress) return null;
    const filled = progress.position_in_batch;
    const size = progress.batch_size;
    const pct = (filled / size) * 100;
    const remaining = progress.remaining;
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
                <p className="mt-2 text-sm font-medium text-black/70">
                    {remaining === size
                        ? "Soyez le premier du prochain lot !"
                        : `Encore ${remaining} unité${remaining > 1 ? "s" : ""} avant expédition au bureau.`}
                </p>
            )}
        </div>
    );
};
