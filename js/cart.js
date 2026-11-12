import { PRODUCT } from "./product.js";

const STORAGE_KEY = "orve-watch-cart";

export function getCart() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
        if (!Array.isArray(saved)) return [];
        return saved.filter((item) => PRODUCT.variants.includes(item.variant) && Number.isInteger(item.quantity) && item.quantity > 0);
    } catch {
        return [];
    }
}

function saveCart(cart) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
        return;
    }
}

export function addToCart(variant) {
    if (!PRODUCT.variants.includes(variant)) return;
    const cart = getCart();
    const item = cart.find((entry) => entry.variant === variant);
    if (item) item.quantity += 1;
    else cart.push({ productId: PRODUCT.id, variant, quantity: 1 });
    saveCart(cart);
}

export function updateQuantity(variant, quantity) {
    const cart = getCart().map((item) => item.variant === variant ? { ...item, quantity } : item).filter((item) => item.quantity > 0);
    saveCart(cart);
}

export function removeFromCart(variant) {
    saveCart(getCart().filter((item) => item.variant !== variant));
}