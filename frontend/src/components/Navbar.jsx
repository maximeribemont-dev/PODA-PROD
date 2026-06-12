import { Link, useLocation } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useBranding } from "../context/BrandingContext";

export const Navbar = () => {
    const { pathname } = useLocation();
    const { totalUnits } = useCart();
    const { logo_data_url, association_name } = useBranding();

    return (
        <header data-testid="poda-navbar" className="border-b-4 border-black bg-[#FBEA8C] sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-6 sm:px-10 h-20 flex items-center justify-between gap-4">
                <Link to="/" data-testid="nav-logo" className="flex items-center gap-3 group">
                    {logo_data_url ? (
                        <img
                            src={logo_data_url}
                            alt={association_name}
                            data-testid="nav-asso-logo"
                            className="h-12 w-12 object-contain border-2 border-black bg-white"
                        />
                    ) : null}
                    <div className="flex flex-col leading-tight">
                        <span className="font-display text-2xl sm:text-3xl tracking-tight">
                            PODA<span className="text-[#FF6B6B]">.</span>
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/70">
                            {association_name}
                        </span>
                    </div>
                </Link>
                <nav className="flex items-center gap-3 sm:gap-5">
                    <Link
                        to="/"
                        data-testid="nav-home"
                        className={`text-sm font-bold uppercase tracking-widest hidden sm:inline ${pathname === "/" ? "underline underline-offset-4" : ""}`}
                    >
                        Boutique
                    </Link>
                    <Link to="/cart" data-testid="nav-cart" className="relative inline-flex items-center gap-2 border-4 border-black bg-white px-3 py-2 shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:shadow-[2px_2px_0_0_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                        <ShoppingBag size={18} />
                        <span className="text-xs font-bold uppercase tracking-widest">Panier</span>
                        {totalUnits > 0 && (
                            <span data-testid="nav-cart-badge" className="ml-1 bg-[#FF6B6B] text-white text-xs font-bold px-2 py-0.5 border-2 border-black">
                                {totalUnits}
                            </span>
                        )}
                    </Link>
                    <Link to="/admin" data-testid="nav-admin" className="text-sm font-bold uppercase tracking-widest hidden sm:inline">
                        Admin
                    </Link>
                </nav>
            </div>
        </header>
    );
};
