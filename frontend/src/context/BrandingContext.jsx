import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getBranding } from "../lib/api";

const BrandingContext = createContext({ logo_data_url: null, association_name: "Poda", refresh: () => {} });

export const BrandingProvider = ({ children }) => {
    const [branding, setBranding] = useState({ logo_data_url: null, association_name: "Poda" });

    const refresh = useCallback(async () => {
        try {
            const data = await getBranding();
            setBranding({
                logo_data_url: data.logo_data_url || null,
                association_name: data.association_name || "Poda",
                notification_email: data.notification_email || null,
                asso_token: data.asso_token || null,
            });
        } catch {
            // silent
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return <BrandingContext.Provider value={{ ...branding, refresh }}>{children}</BrandingContext.Provider>;
};

export const useBranding = () => useContext(BrandingContext);
