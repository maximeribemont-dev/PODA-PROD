import { useState } from "react";
import { Plus, Minus, ShoppingBag, Check } from "lucide-react";
import { useCart } from "../context/CartContext";
import { toast } from "sonner";

export const ProductCard = ({ product }) => {
    const { addItem } = useCart();
    const [size, setSize] = useState(product.sizes[0]);
    const [color, setColor] = useState(product.colors[0]);
    const [qty, setQty] = useState(1);
    const [justAdded, setJustAdded] = useState(false);

    const handleAdd = () => {
        addItem({
            product_id: product.id,
            product_name: product.name,
            image: product.image,
            unit_price: product.price,
            size,
            color,
            quantity: qty,
        });
        setJustAdded(true);
        toast.success(`${qty}× ${product.name} ajouté au panier`);
        setTimeout(() => setJustAdded(false), 1200);
        setQty(1);
    };

    return (
        <article data-testid={`product-card-${product.id}`} className="neo-card neo-card-hover flex flex-col">
            <div className="aspect-square bg-[#FDF8F5] border-b-4 border-black overflow-hidden">
                <img src={product.image} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
            </div>
            <div className="p-5 flex flex-col flex-1 gap-3">
                <div className="flex items-baseline justify-between">
                    <h3 className="font-display text-2xl">{product.name}</h3>
                    <span className="font-display text-2xl">{product.price.toFixed(0)}€</span>
                </div>
                <p className="text-sm text-black/70 line-clamp-2">{product.description}</p>

                <div className="grid grid-cols-2 gap-2 mt-1">
                    <select
                        data-testid={`size-${product.id}`}
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                        className="neo-input neo-select py-2 text-sm"
                    >
                        {product.sizes.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                    <select
                        data-testid={`color-${product.id}`}
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="neo-input neo-select py-2 text-sm"
                    >
                        {product.colors.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center border-4 border-black">
                        <button
                            type="button"
                            onClick={() => setQty((q) => Math.max(1, q - 1))}
                            data-testid={`qty-minus-${product.id}`}
                            className="px-3 py-2 hover:bg-[#FBEA8C]"
                        >
                            <Minus size={16} />
                        </button>
                        <span data-testid={`qty-${product.id}`} className="px-4 font-bold min-w-[2ch] text-center">{qty}</span>
                        <button
                            type="button"
                            onClick={() => setQty((q) => Math.min(50, q + 1))}
                            data-testid={`qty-plus-${product.id}`}
                            className="px-3 py-2 hover:bg-[#FBEA8C]"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={handleAdd}
                        data-testid={`add-cart-${product.id}`}
                        className={`neo-btn flex-1 ${justAdded ? "neo-btn-yellow" : "neo-btn-primary"}`}
                    >
                        {justAdded ? <><Check size={18} /> Ajouté</> : <><ShoppingBag size={18} /> Ajouter</>}
                    </button>
                </div>
            </div>
        </article>
    );
};
