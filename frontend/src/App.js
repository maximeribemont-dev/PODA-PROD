import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { Navbar } from "./components/Navbar";
import HomePage from "./pages/HomePage";
import OrderPage from "./pages/OrderPage";
import SuccessPage from "./pages/SuccessPage";
import AdminPage from "./pages/AdminPage";

function App() {
    return (
        <div className="App min-h-screen">
            <BrowserRouter>
                <Navbar />
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/commander/:productId" element={<OrderPage />} />
                    <Route path="/success" element={<SuccessPage />} />
                    <Route path="/admin" element={<AdminPage />} />
                </Routes>
                <Toaster position="top-right" richColors />
            </BrowserRouter>
        </div>
    );
}

export default App;
