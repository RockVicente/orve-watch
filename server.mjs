import { createServer as createHttpServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const MERCADO_PAGO_PREFERENCES_URL = "https://api.mercadopago.com/checkout/preferences";
const PRODUCT = Object.freeze({
    id: "poedagar-luxury-sport",
    name: "Poedagar Luxury Sport",
    price: 319.99,
    variant: "Verde esmeralda"
});

const CONTENT_TYPES = new Map([
    [".css", "text/css; charset=utf-8"],
    [".html", "text/html; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".webp", "image/webp"]
]);

function sendJson(response, statusCode, data) {
    response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(data));
}

function readJsonBody(request) {
    return new Promise((resolveBody, rejectBody) => {
        const chunks = [];
        let size = 0;
        let tooLarge = false;

        request.on("data", (chunk) => {
            size += chunk.length;
            if (size > 16_384) {
                tooLarge = true;
                chunks.length = 0;
                return;
            }
            if (!tooLarge) chunks.push(chunk);
        });
        request.on("end", () => {
            if (tooLarge) {
                rejectBody(Object.assign(new Error("A requisição excedeu o tamanho permitido."), { statusCode: 413 }));
                return;
            }
            try {
                resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
            } catch {
                rejectBody(Object.assign(new Error("O conteúdo enviado não é um JSON válido."), { statusCode: 400 }));
            }
        });
        request.on("error", rejectBody);
    });
}

function getValidatedItems(items) {
    if (!Array.isArray(items) || items.length !== 1) return null;

    const validatedItems = [];
    for (const item of items) {
        if (
            !item ||
            item.productId !== PRODUCT.id ||
            item.variant !== PRODUCT.variant ||
            !Number.isInteger(item.quantity) ||
            item.quantity < 1 ||
            item.quantity > 99
        ) {
            return null;
        }

        validatedItems.push({
            id: PRODUCT.id,
            title: `${PRODUCT.name} - ${PRODUCT.variant}`,
            quantity: item.quantity,
            unit_price: PRODUCT.price,
            currency_id: "BRL"
        });
    }

    return validatedItems;
}

function getBackUrls(publicBaseUrl) {
    if (!publicBaseUrl) return {};

    const baseUrl = new URL(publicBaseUrl);
    if (baseUrl.protocol !== "https:" || baseUrl.hostname === "localhost" || baseUrl.hostname.endsWith(".localhost")) {
        throw new Error("PUBLIC_BASE_URL deve ser uma URL pública HTTPS.");
    }

    const origin = baseUrl.origin;
    return {
        back_urls: {
            success: `${origin}/?checkout=success`,
            failure: `${origin}/?checkout=failure`,
            pending: `${origin}/?checkout=pending`
        },
        auto_return: "approved"
    };
}

async function serveStaticFile(request, response, pathname) {
    let decodedPath;
    try {
        decodedPath = decodeURIComponent(pathname);
    } catch {
        response.writeHead(400).end();
        return;
    }

    const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^[/\\]+/, "");
    const pathParts = relativePath.split(/[/\\]+/);
    const allowedRoots = new Set(["index.html", "css", "js", "imagens", "motion"]);
    if (pathParts.some((part) => part.startsWith(".")) || !allowedRoots.has(pathParts[0])) {
        response.writeHead(404).end();
        return;
    }

    const filePath = resolve(ROOT, relativePath);
    if (!filePath.startsWith(`${ROOT}${sep}`)) {
        response.writeHead(403).end();
        return;
    }

    try {
        const fileInfo = await stat(filePath);
        if (!fileInfo.isFile()) {
            response.writeHead(404).end();
            return;
        }
        response.writeHead(200, {
            "Content-Length": fileInfo.size,
            "Content-Type": CONTENT_TYPES.get(extname(filePath)) || "application/octet-stream"
        });
        if (request.method === "HEAD") response.end();
        else createReadStream(filePath).pipe(response);
    } catch {
        response.writeHead(404).end();
    }
}

export function createServer(options = {}) {
    const accessToken = Object.hasOwn(options, "accessToken") ? options.accessToken : process.env.MP_ACCESS_TOKEN;
    const publicBaseUrl = Object.hasOwn(options, "publicBaseUrl") ? options.publicBaseUrl : process.env.PUBLIC_BASE_URL;
    const fetchImpl = options.fetchImpl || globalThis.fetch;

    return createHttpServer((request, response) => {
        const url = new URL(request.url, "http://localhost");

        if (url.pathname === "/api/checkout") {
            if (request.method !== "POST") {
                response.writeHead(405, { Allow: "POST" }).end();
                return;
            }
            if (!request.headers["content-type"]?.includes("application/json")) {
                sendJson(response, 415, { error: "O checkout exige uma requisição JSON." });
                return;
            }
            if (!accessToken) {
                sendJson(response, 503, { error: "Checkout indisponível: configure MP_ACCESS_TOKEN no servidor." });
                return;
            }

            void (async () => {
                try {
                    const body = await readJsonBody(request);
                    const items = getValidatedItems(body?.items);
                    if (!items) {
                        sendJson(response, 400, { error: "A sacola enviada não é válida." });
                        return;
                    }

                    let returnUrls;
                    try {
                        returnUrls = getBackUrls(publicBaseUrl);
                    } catch (error) {
                        sendJson(response, 500, { error: error.message });
                        return;
                    }

                    const preferenceResponse = await fetchImpl(MERCADO_PAGO_PREFERENCES_URL, {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            items,
                            external_reference: randomUUID(),
                            ...returnUrls
                        })
                    });
                    let preference;
                    try {
                        preference = await preferenceResponse.json();
                    } catch {
                        preference = null;
                    }

                    if (!preferenceResponse.ok) {
                        console.error("Mercado Pago preference request failed:", preferenceResponse.status);
                        sendJson(response, 502, { error: "O Mercado Pago não conseguiu iniciar o pagamento. Tente novamente." });
                        return;
                    }

                    const checkoutUrl = accessToken.startsWith("TEST-")
                        ? preference?.sandbox_init_point
                        : preference?.init_point;
                    if (typeof checkoutUrl !== "string") {
                        sendJson(response, 502, { error: "O Mercado Pago não retornou o endereço do checkout." });
                        return;
                    }

                    const parsedCheckoutUrl = new URL(checkoutUrl);
                    if (parsedCheckoutUrl.protocol !== "https:" || !/(^|\.)mercadopago\.com(\.[a-z]{2})?$/.test(parsedCheckoutUrl.hostname)) {
                        sendJson(response, 502, { error: "O Mercado Pago retornou um endereço de checkout inválido." });
                        return;
                    }

                    sendJson(response, 201, { checkoutUrl: parsedCheckoutUrl.href });
                } catch (error) {
                    if (error.statusCode) {
                        sendJson(response, error.statusCode, { error: error.message });
                        return;
                    }
                    console.error("Checkout session creation failed:", error);
                    sendJson(response, 502, { error: "Não foi possível conectar ao Mercado Pago. Tente novamente." });
                }
            })();
            return;
        }

        if (request.method !== "GET" && request.method !== "HEAD") {
            response.writeHead(405, { Allow: "GET, HEAD" }).end();
            return;
        }
        void serveStaticFile(request, response, url.pathname);
    });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const port = Number(process.env.PORT || 3000);
    const host = process.env.HOST || "0.0.0.0";
    createServer().listen(port, host, () => {
        console.log(`Orve Watch disponível em http://localhost:${port}`);
    });
}
