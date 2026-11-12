# Orve Watch

## Checkout do Mercado Pago

O botão **Confirmar** cria uma preferência no backend e redireciona o comprador ao Checkout Pro. O preço e os dados do produto são definidos no servidor; o token do Mercado Pago nunca é enviado ao navegador.

Requisitos: Node.js 18 ou superior e credenciais do Mercado Pago. Configure as variáveis no terminal, sem adicioná-las ao código:

```powershell
$env:MP_ACCESS_TOKEN = "TEST-seu-token-de-teste"
node .\server.mjs
```

Abra `http://localhost:3000`. As credenciais de teste iniciam um checkout de sandbox. Para produção, configure o token de produção no ambiente de hospedagem. Para retornar ao site após o pagamento, configure também `PUBLIC_BASE_URL` com a URL pública HTTPS do site; URLs `localhost` não são aceitas como URLs de retorno pelo Mercado Pago.

Execute os testes automatizados com `node --test`.

O fluxo cria a sessão de pagamento e redireciona ao Mercado Pago. A confirmação de pedidos e o processamento de notificações/webhooks ainda precisam ser integrados antes de usar o pagamento para fulfillment em produção.
