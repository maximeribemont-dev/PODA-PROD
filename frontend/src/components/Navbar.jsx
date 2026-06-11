import { Link, useLocation } from "react-router-dom";

export const Navbar = () => {
    const { pathname } = useLocation();
    return (
        <header
            data-testid="poda-navbar"
            className="border-b-4 border-black bg-[#FBEA8C] sticky top-0 z-40"
        >
            <div className="max-w-7xl mx-auto px-6 sm:px-10 h-16 flex items-center justify-between">
                <Link
                    to="/"
                    data-testid="nav-logo"
                    className="font-display text-2xl sm:text-3xl tracking-tight"
                >
                    PODA<span className="text-[#FF6B6B]">.</span>
                </Link>
                <nav className="flex items-center gap-3 sm:gap-6">
                    <Link
                        to="/"
                        data-testid="nav-home"
                        className={`text-sm font-bold uppercase tracking-widest ${pathname === "/" ? "underline underline-offset-4" : ""}`}
                    >
                        Boutique
                    </Link>
                    <Link
                        to="/admin"
                        data-testid="nav-admin"
                        className="text-sm font-bold uppercase tracking-widest"
                    >
                        Admin
                    </Link>
                </nav>
            </div>
        </header>
    );
};
