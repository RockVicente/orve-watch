import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { createServer } from "../server.mjs";

async function withServer(server, run) {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const { port } = server.address();
    try {
        await run(`http://127.0.0.1:${port}`);
    } finally {
        await new Promise((resolveClose, rejectClose) => {
            server.close((error) => error ? rejectClose(error) : resolveClose());
        });
    }
}

test("checkout reports when the Mercado Pago token is not configured", async () => {
    const server = createServer({
        accessToken: "",
        fetchImpl: () => {
            throw new Error("Mercado Pago must not be called without a token");
        }
    });

    await withServer(server, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: [] })
        });

        assert.equal(response.status, 503);
        assert.match((await response.json()).error, /MP_ACCESS_TOKEN/);
    });
});

test("checkout creates a Mercado Pago preference using server-owned product details", async () => {
    let preferenceRequest;
    const server = createServer({
        accessToken: "TEST-token",
        publicBaseUrl: "https://orve.example",
        fetchImpl: async (url, options) => {
            preferenceRequest = { url, options };
            return {
                ok: true,
                status: 201,
                json: async () => ({
                    sandbox_init_point: "https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=test"
                })
            };
        }
    });

    await withServer(server, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                items: [{
                    productId: "poedagar-luxury-sport",
                    variant: "Verde esmeralda",
                    quantity: 2,
                    unit_price: 0.01
                }]
            })
        });
        const result = await response.json();

        assert.equal(response.status, 201);
        assert.equal(result.checkoutUrl, "https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=test");
        assert.equal(preferenceRequest.url, "https://api.mercadopago.com/checkout/preferences");
        assert.equal(preferenceRequest.options.headers.Authorization, "Bearer TEST-token");

        const preference = JSON.parse(preferenceRequest.options.body);
        assert.deepEqual(preference.items, [{
            id: "poedagar-luxury-sport",
            title: "Poedagar Luxury Sport - Verde esmeralda",
            quantity: 2,
            unit_price: 319.99,
            currency_id: "BRL"
        }]);
        assert.equal(preference.back_urls.success, "https://orve.example/?checkout=success");
        assert.equal(preference.auto_return, "approved");
    });
});

test("checkout rejects invalid cart quantities without contacting Mercado Pago", async () => {
    const server = createServer({
        accessToken: "TEST-token",
        fetchImpl: () => {
            throw new Error("Invalid cart must not reach Mercado Pago");
        }
    });

    await withServer(server, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/checkout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                items: [{
                    productId: "poedagar-luxury-sport",
                    variant: "Verde esmeralda",
                    quantity: 0
                }]
            })
        });

        assert.equal(response.status, 400);
        assert.match((await response.json()).error, /sacola/);
    });
});
