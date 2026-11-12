import { PRODUCT } from "./product.js";
import { addToCart, getCart, removeFromCart, updateQuantity } from "./cart.js";

const menuToggle = document.querySelector(".menu-toggle");
const searchToggle = document.querySelector(".search-toggle");
const menuPanel = document.querySelector(".menu-panel");
const searchPanel = document.querySelector(".search-panel");
const bagButton = document.querySelector(".bag-button");
const cartDialog = document.querySelector("#cart-dialog");
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
let selectedVariant = "Verde esmeralda";

function updateHeaderCount() {
    const count = getCart().reduce((total, item) => total + item.quantity, 0);
    document.querySelector(".bag-count").textContent = String(count);
    bagButton.setAttribute("aria-label", `Abrir sacola, ${count} ${count === 1 ? "item" : "itens"}`);
    const drawerCount = document.querySelector(".drawer-count");
    if (drawerCount) drawerCount.textContent = `(${count})`;
}

function togglePanel(button, panel, otherButton, otherPanel) {
    const shouldOpen = panel.hidden;
    panel.hidden = !shouldOpen;
    button.setAttribute("aria-expanded", String(shouldOpen));
    otherPanel.hidden = true;
    otherButton.setAttribute("aria-expanded", "false");
}

function renderCart() {
    const cart = getCart();
    const items = document.querySelector(".cart-items");
    if (!items) {
        updateHeaderCount();
        return;
    }

    items.replaceChildren();
    let subtotal = 0;

    for (const item of cart) {
        subtotal += PRODUCT.price * item.quantity;
        const row = document.createElement("article");
        row.className = "cart-item";
        row.innerHTML = `<img src="${PRODUCT.image}" alt="" width="88" height="108"><div><h3>${PRODUCT.name}</h3><p>${item.variant}</p><div class="quantity-control"><button type="button" data-quantity="-1" aria-label="Diminuir quantidade">−</button><span>${item.quantity}</span><button type="button" data-quantity="1" aria-label="Aumentar quantidade">+</button></div></div><button class="remove-item" type="button">Remover</button><span class="cart-item-price">${money.format(PRODUCT.price * item.quantity)}</span>`;
        row.querySelector("[data-quantity='-1']").addEventListener("click", () => changeQuantity(item.variant, -1));
        row.querySelector("[data-quantity='1']").addEventListener("click", () => changeQuantity(item.variant, 1));
        row.querySelector(".remove-item").addEventListener("click", () => {
            removeFromCart(item.variant);
            renderCart();
        });
        items.append(row);
    }

    document.querySelector(".empty-cart").hidden = cart.length > 0;
    document.querySelector(".cart-summary").hidden = cart.length === 0;
    document.querySelector(".subtotal").textContent = money.format(subtotal);
    updateHeaderCount();
}

function changeQuantity(variant, change) {
    const item = getCart().find((entry) => entry.variant === variant);
    if (item) updateQuantity(variant, item.quantity + change);
    renderCart();
}

function addProduct() {
    addToCart(selectedVariant);
    renderCart();
    document.querySelector(".cart-feedback").textContent = "Adicionado à sua sacola.";
}

async function startCheckout() {
    const cart = getCart();
    const status = document.querySelector(".checkout-status");
    const button = document.querySelector(".checkout-button");

    if (cart.length === 0) {
        status.textContent = "Adicione um produto à sacola antes de confirmar.";
        return;
    }

    button.disabled = true;
    status.textContent = "Preparando o pagamento...";

    try {
        const response = await fetch("/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: cart })
        });
        let result;
        try {
            result = await response.json();
        } catch {
            throw new Error("O servidor retornou uma resposta inválida.");
        }

        if (!response.ok) {
            throw new Error(result.error || "Não foi possível iniciar o pagamento.");
        }

        const checkoutUrl = new URL(result.checkoutUrl);
        if (checkoutUrl.protocol !== "https:" || !/(^|\.)mercadopago\.com(\.[a-z]{2})?$/.test(checkoutUrl.hostname)) {
            throw new Error("O servidor retornou um endereço de pagamento inválido.");
        }

        window.location.assign(checkoutUrl.href);
    } catch (error) {
        status.textContent = error instanceof Error ? error.message : "Não foi possível iniciar o pagamento.";
        button.disabled = false;
    }
}

menuToggle.addEventListener("click", () => togglePanel(menuToggle, menuPanel, searchToggle, searchPanel));
searchToggle.addEventListener("click", () => {
    togglePanel(searchToggle, searchPanel, menuToggle, menuPanel);
    if (!searchPanel.hidden) document.querySelector("#site-search").focus();
});

document.querySelector(".search-panel").addEventListener("submit", (event) => {
    event.preventDefault();
    const query = document.querySelector("#site-search").value.trim().toLocaleLowerCase("pt-BR");
    const matches = `${PRODUCT.name} ${PRODUCT.reference} verde esmeralda`.toLocaleLowerCase("pt-BR").includes(query);
    document.querySelector(".search-feedback").textContent = matches ? "1 peça encontrada na coleção." : "Nenhuma peça encontrada.";
    if (matches) document.querySelector("#produto").scrollIntoView({ behavior: "smooth" });
});

document.querySelector(".color-option").addEventListener("click", (event) => {
    selectedVariant = event.currentTarget.dataset.variant;
    event.currentTarget.setAttribute("aria-pressed", "true");
});
document.querySelector(".buy-button").addEventListener("click", addProduct);
bagButton.addEventListener("click", () => {
    renderCart();
    cartDialog.showModal();
});
document.querySelector(".checkout-button").addEventListener("click", startCheckout);
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => {
    document.querySelector(`#${button.dataset.close}`).close();
}));
document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
}));
document.querySelectorAll(".menu-panel a").forEach((link) => link.addEventListener("click", () => {
    menuPanel.hidden = true;
    menuToggle.setAttribute("aria-expanded", "false");
}));

renderCart();