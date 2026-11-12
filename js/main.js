const menuToggle = document.querySelector(".menu-toggle");
const searchToggle = document.querySelector(".search-toggle");
const menuPanel = document.querySelector(".menu-panel");
const searchPanel = document.querySelector(".search-panel");
const buyButton = document.querySelector(".buy-button");
const bagButton = document.querySelector(".bag-button");
const bagCount = document.querySelector(".bag-count");
const cartFeedback = document.querySelector(".cart-feedback");

function togglePanel(button, panel, otherButton, otherPanel) {
    const shouldOpen = panel.hidden;
    panel.hidden = !shouldOpen;
    button.setAttribute("aria-expanded", String(shouldOpen));
    otherPanel.hidden = true;
    otherButton.setAttribute("aria-expanded", "false");
}

menuToggle.addEventListener("click", () => {
    togglePanel(menuToggle, menuPanel, searchToggle, searchPanel);
});

searchToggle.addEventListener("click", () => {
    togglePanel(searchToggle, searchPanel, menuToggle, menuPanel);
    if (!searchPanel.hidden) {
        document.querySelector("#site-search").focus();
    }
});

document.querySelector(".search-panel").addEventListener("submit", (event) => {
    event.preventDefault();
    document.querySelector("#site-search").value = "";
    searchPanel.hidden = true;
    searchToggle.setAttribute("aria-expanded", "false");
});

buyButton.addEventListener("click", () => {
    const quantity = Number(bagCount.textContent) + 1;
    bagCount.textContent = String(quantity);
    bagButton.setAttribute("aria-label", `Sacola, ${quantity} ${quantity === 1 ? "item" : "itens"}`);
    cartFeedback.textContent = "Adicionado à sua sacola.";
});