# Checklist de AuthZ de Mutacao — Rotas da API

**Data da auditoria:** 2026-06-22
**Branch:** feat/seguranca-g1
**Auditor:** Claude Opus 4.8 (sub-projeto G.1)

---

## Escopo

Auditoria de todos os handlers de mutacao (PUT, PATCH, DELETE) fora de `src/app/api/admin/**`,
verificando se o recurso mutado pertence ao tenant da sessao antes de ser alterado.

### Rotas excluidas do escopo

`src/app/api/admin/**` usa sessao **AdminUser** (nao `tenantId`), com controle de acesso proprio.
Essas rotas operam sobre registros globais (planos, tenants) ou com escopo de adminId,
e estao fora do modelo de tenant-isolation avaliado aqui.

Rotas com mutacao por token secreto (`convite/[token]`, `recuperar-senha/[token]`) tambem sao
excluidas: o token e o unico autenticador, nao ha risco cross-tenant por `id`.

---

## Tabela de Rotas Auditadas

| Rota | Metodo(s) | Veredicto | Mecanismo de protecao |
|------|-----------|-----------|----------------------|
| `ambientes/[id]` | PATCH, DELETE | SEGURO | fetch-then-check (`findFirst { id, tenantId }`) |
| `ingredients/[id]` | PATCH, DELETE | SEGURO | fetch-then-check (`findFirst { id, tenantId }`) |
| `integracoes/whatsapp/contatos/[id]` | PATCH, DELETE | SEGURO | fetch-then-check (`findFirst { id, tenantId }`) |
| `inventarios/[id]` (GET, DELETE) | GET, DELETE | SEGURO | fetch-then-check (`findFirst { id, tenantId }`) |
| `inventarios/[id]` (PATCH) | PATCH | **GAP — CORRIGIDO** | Ver secao abaixo |
| `inventarios/[id]/finalizar` | POST | SEGURO | items carregados via `include` do inventario ja verificado |
| `alert-configs/[id]` | PATCH | SEGURO | `updateMany({ where: { id, tenantId } })` |
| `alertas/[id]` | PATCH | SEGURO | `updateMany({ where: { id, tenantId } })` |
| `assinatura` (POST) | POST | SEGURO | mutacao via `where: { tenantId }` (chave unica) |
| `assinatura/cancelar` (POST) | POST | SEGURO | mutacao via `where: { tenantId }` (chave unica) |
| `assinatura/cancelar` (DELETE) | DELETE | SEGURO | mutacao via `where: { tenantId }` (chave unica) |

### Servicos (`src/services/**`) com mutacao sem `tenantId` na mesma linha

| Servico / funcao | Veredicto | Justificativa |
|-----------------|-----------|--------------|
| `ai/ai-usage.service.ts` — `incrementarUso` | SEGURO | `update({ where: { tenantId } })` e `updateMany` sem filtro de id |
| `ai/ai-usage.service.ts` — `resetarUsoMensal` | SEGURO | `updateMany` sem where de id; operacao administrativa de cron |
| `ai/estoque-chat.service.ts` — `registrar_entrada_estoque` | SEGURO | `ingredient.id` obtido via `findFirst({ where: { tenantId, ... } })` imediatamente antes |
| `ai/nf-processor.service.ts` — `salvarNfStatus` / `marcarNfErro` | SEGURO | `nfId` criado pelo proprio handler do tenant na mesma transacao; job de fila interna sem entrada externa |
| `payments/stripe.service.ts` — handlers de webhook | SEGURO | id do tenant derivado via lookup de `stripeCustomerId` validado pelo Stripe; nao e input externo livre |
| `payments/mercadopago.service.ts` | SEGURO | webhook de pagamento; `paymentTransaction` identificado por id do provedor externo |
| `multi-unit/brand.service.ts` — `adicionarUnidade` / `removerUnidade` | SEGURO | chamado apenas de rotas admin; `removerUnidade` inclui `brandId` no where como guarda adicional |

---

## Gap Real Encontrado e Corrigido

### `inventarios/[id]` PATCH — cross-tenant itemId injection

**Descricao:** O handler verificava corretamente que o `inventario` pertence ao tenant via
`findFirst({ where: { id: params.id, tenantId } })`. Porem, na transacao de atualizacao de itens,
cada `inventarioItem.update` usava apenas `{ where: { id: itemId } }`, onde `itemId` vinha do
body da requisicao. Isso permitia que um atacante autenticado como tenant-A fornecesse `itemId`s
pertencentes a inventarios de tenant-B, atualizando-os sem qualquer verificacao.

**Correcao aplicada:** adicionado `inventarioId: inventario.id` ao `where` da mutacao:

```ts
prisma.inventarioItem.update({
  where: { id: itemId, inventarioId: inventario.id },
  ...
})
```

Como `inventario.id` ja foi verificado como pertencente ao tenant, qualquer `itemId` que nao
pertenca a esse inventario recebe `P2025 Record not found` do Prisma.

**Teste:** `src/app/api/inventarios/[id]/__tests__/route.test.ts` (4 casos, todos verdes).

---

## Gap Relacionado (sub-projeto anterior, ja corrigido)

**iFood `casar` endpoint** — o unico outro gap real encontrado neste sub-projeto foi no endpoint
`integracoes/ifood/casar`, corrigido em tarefa separada antes desta auditoria.

---

## Rate Limiting de Cadastro (ja existente)

O sistema ja possui rate limiting para o fluxo de registro:

- `send-code`: **3 tentativas por hora por IP**
- `verify-code`: **10 tentativas por hora por e-mail**

Nao ha pendencias relacionadas a rate limiting de autenticacao.

---

## Itens Adiados / Fora de Escopo

- Rotas de pedidos (`pedidos/[id]`, `pedidos/[id]/itens`, `pedidos/[id]/status`): usam sessao
  de operadores (garcom/cozinha) com tenant fixo na sessao; nao foi verificado nesta auditoria
  formal mas o padrao de `where: { id, ..., tenantId }` esta presente em `pedidos/[id]/status`.
- `mesas/[id]`, `roles/[id]`, `usuarios/[id]`, `products/[id]`: nao apareceram no grep de
  mutacoes sem tenantId; considerados fora do escopo desta auditoria focada.
- Revisao periodica sugerida: sempre que um novo modelo sem `tenantId` direto for adicionado
  (como `InventarioItem`), verificar se os handlers de PATCH/DELETE validam a cadeia de posse.
