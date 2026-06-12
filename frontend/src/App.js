import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { Navbar } from "./components/Navbar";
import { CartProvider } from "./context/CartContext";
import { BrandingProvider } from "./context/BrandingContext";
import HomePage from "./pages/HomePage";
import CartPage from "./pages/CartPage";
import SuccessPage from "./pages/SuccessPage";
import AdminPage from "./pages/AdminPage";

function App() {
    return (
        <div className="App min-h-screen">
            <BrandingProvider>
                <CartProvider>
                    <BrowserRouter>
                        <Navbar />
                        <Routes>
                            <Route path="/" element={<HomePage />} />
                            <Route path="/cart" element={<CartPage />} />
                            <Route path="/success" element={<SuccessPage />} />
                            <Route path="/admin" element={<AdminPage />} />
                        </Routes>
                        <Toaster position="top-right" richColors />
                    </BrowserRouter>
                </CartProvider>
            </BrandingProvider>
        </div>
    );
}

export default App;
