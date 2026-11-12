# Bazar da Mudança

Site estático (GitHub Pages) para vender os itens da mudança — São Paulo (Rodrigo) e Campinas (Isabella).

- `index.html` — vitrine com filtros (cidade, categoria, preço), fotos, escolha da data de retirada e contato/pagamento.
- `admin.html` — área admin: editar itens, preços, status (disponível/reservado/vendido), subir fotos, configurar WhatsApp e prazos. Salva direto no repositório via API do GitHub.
- `data/items.json` — itens. `data/config.json` — WhatsApp, prazos, analytics.
- `img/` — fotos (o admin redimensiona para 1600px antes de enviar).

## Fluxo de compra
1. Comprador escolhe o item e, se quiser, uma data preferida de retirada (o dia real é combinado no WhatsApp).
2. Se o item tem link de pagamento (Mercado Pago/InfinitePay), paga com cartão ou Pix e clica em "Já paguei" → abre o WhatsApp com item, preço e data.
3. Sem link: "Quero comprar" abre o WhatsApp para combinar.
4. Vendido? Marque como **Vendido** no admin — some do site.

## Admin
Gere um token fine-grained em GitHub → Settings → Developer settings → Fine-grained tokens, com acesso só a este repositório e permissão **Contents: Read and write**. Cole em `/admin.html`.

## Analytics
Microsoft Clarity (grátis): visitas, visitantes recorrentes, mapa de calor, gravação de sessões, rage clicks e eventos (`ver_item`, `clique_pay`, `clique_wa_buy`, `clique_wa_paid`, `filtro_*`). Crie um projeto em clarity.microsoft.com e cole o ID em Configurações no admin.
