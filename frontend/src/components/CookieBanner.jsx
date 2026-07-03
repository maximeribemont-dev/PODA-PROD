import { useState, useEffect } from "react";

export function CookieBanner() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const accepted = localStorage.getItem("poda_cookies_accepted");
        if (!accepted) setVisible(true);
    }, []);

    const accept = () => {
        localStorage.setItem("poda_cookies_accepted", "1");
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t-4 border-black bg-white p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
            <p className="text-sm text-black/70 flex-1">
                Ce site utilise uniquement des <strong>cookies techniques</strong> indispensables à son fonctionnement
                (panier, session). Aucun cookie publicitaire ni de traçage.{" "}
                <a href="/legal/confidentialite" className="underline text-black">
                    En savoir plus
                </a>
            </p>
            <button
                onClick={accept}
                className="flex-shrink-0 bg-black text-white font-bold text-xs uppercase px-5 py-2 border-2 border-black hover:bg-transparent hover:text-black transition-colors"
            >
                J'ai compris
            </button>
        </div>
    );
}
