# Spec: Import do cardápio iFood → sistema (Sub-projeto E)

**Data:** 2026-06-21
**Status:** Aprovado
**Roadmap:** Sub-projeto E (independente do fiscal). Ver [[project-fiscal-roadmap]].

---

## Contexto

O restaurante já tem integração iFood (`IFoodIntegration` por tenant: merchant, client, token). O sistema **envia** disponibilidade ao iFood (`sincronizarDisponibilidade`) e **lê** o catálogo (`listarItensCatalogo(tenantId): IFoodItem[]`, em `src/services/integrations/ifood/ifood-catalog.service.ts`). O `IFoodItemMap` (`@@unique[tenantId, ifoodItemId]`, `produtoId?`) mapeia item do iFood ↔ `Product`. Falta o **sentido inverso**: trazer os itens do cardápio do iFood para dentro do sistema como produtos.

Tipos existentes: `IFoodItem = { id, name, description?, price, available, categoryId?, categoryName? }`. `Product = { name, salePrice, categoryId?, ... }`. `Category = { name, type (PRODUCT|INGREDIENT), tenantId }` com `@@unique[name, type, tenantId]`.

## Decisões do brainstorming

- **Fluxo:** pré-visualização + **confirmação com de-para** (não auto-cria às cegas).
- **Sugestão de de-para:** **casamento por similaridade de nome** (levenshtein), sugerindo produto existente; sem bom match → "criar novo".
- **Categoria:** ao criar produto novo, **casar/criar `Category`** (type PRODUCT) pelo `categoryName` do iFood.
- **Já mapeados:** não sobrescreve preço/nome do produto (iFood não é fonte de verdade do catálogo).
- **Matching:** extrair um helper compartilhado `melhorMatchPorNome` e fazer o `nf-processor.enriquecerItens` reusá-lo (DRY).

---

## Seção 1 — Helper de similaridade compartilhado

`src/lib/match-nome.ts`:
```typescript
export function melhorMatchPorNome(
  termo: string,
  candidatos: { id: string; name: string }[],
): { id: string; name: string; score: number } | null
```
Levenshtein (lib `fast-levenshtein`, já no projeto), `score = round((1 - dist/maxLen) * 100)`, retorna o melhor candidato ou `null` se a lista estiver vazia. Refatorar `enriquecerItens` (`src/services/ai/nf-processor.service.ts`) para usar este helper no de-para item→insumo (mantendo o comportamento e os testes atuais verdes). Testes próprios do helper.

---

## Seção 2 — Serviço de import (`src/services/integrations/ifood/ifood-import.service.ts`)

Tipos:
```typescript
export type ItemPreview = {
  ifoodItemId: string
  ifoodItemNome: string
  preco: number
  categoriaNome: string | null
  sugestao: 'mapeado' | 'casar' | 'criar'
  produtoSugeridoId: string | null
  score: number | null
}
export type DecisaoImport = {
  ifoodItemId: string
  ifoodItemNome: string
  preco: number
  categoriaNome: string | null
  acao: 'criar' | 'casar' | 'ignorar'
  produtoId?: string   // obrigatório quando acao = 'casar'
}
```

- `prepararImportacaoCardapio(tenantId)`:
  1. `listarItensCatalogo(tenantId)`;
  2. carrega `IFoodItemMap` do tenant + `Product[]` (id,name) do tenant;
  3. por item: se há map com `produtoId` → `mapeado`; senão `melhorMatchPorNome(nome, produtos)` → score alto (limiar ex. 80) vira `casar` (com `produtoSugeridoId`/score), senão `criar`;
  4. retorna `ItemPreview[]`.
- `confirmarImportacaoCardapio(tenantId, decisoes: DecisaoImport[])`:
  - `criar`: resolve `Category` por `categoriaNome` (find `@@unique[name,'PRODUCT',tenantId]` ou cria) → `prisma.product.create({ name, salePrice: preco, categoryId, tenantId })` → upsert `IFoodItemMap({ tenantId, ifoodItemId, ifoodItemNome, produtoId })`;
  - `casar`: upsert `IFoodItemMap` com o `produtoId` informado;
  - `ignorar`: nada.
  - Idempotente (upsert no `@@unique[tenantId, ifoodItemId]`); não toca produtos já existentes. Retorna `{ criados, mapeados }`.

Provider/serviço de catálogo injetável (default o `listarItensCatalogo` real) para testabilidade.

---

## Seção 3 — Rotas (admin-only, tenant-scoped)

- `GET /api/integracoes/ifood/cardapio/preview` → `prepararImportacaoCardapio(tenantId)`.
- `POST /api/integracoes/ifood/cardapio/importar` `{ decisoes }` → `confirmarImportacaoCardapio`.
Ambas exigem ADMIN/SUPER_ADMIN/MANAGER (gestão de catálogo) e `IFoodIntegration` com status CONECTADO (senão 409 "integração iFood não conectada").

---

## Seção 4 — UI

Tela/seção na área de integração iFood (admin): botão "Importar cardápio do iFood" → carrega o preview (GET) → tabela com, por linha: nome iFood, preço, categoria, e a **ação** (radio/select): `mapeado` (read-only), `casar` com um `<select>` de produtos (pré-selecionado pela sugestão), `criar novo`, `ignorar`. Botão "Importar selecionados" envia as decisões (POST), `toast` com `{ criados, mapeados }`, e invalida a lista de produtos. Tokens `--tf-*`.

---

## Seção 5 — Segurança, testes e bloqueio

**Testes (Vitest):**
- `melhorMatchPorNome` (puro): melhor match, lista vazia → null, score.
- `prepararImportacaoCardapio`: classifica mapeado/casar/criar (catálogo + prisma mockados, limiar de score).
- `confirmarImportacaoCardapio`: cria produto + categoria (casar existente vs criar), grava map; `casar` grava map; idempotência (não duplica map).
- `nf-processor`: testes atuais continuam verdes após o refactor para o helper.

**Vulnerabilidades:**
- Rotas admin/MANAGER-only; todas as queries por `tenantId`; `IFoodItemMap @@unique` evita duplicação.
- Não sobrescreve produtos existentes (sem perda de dados do catálogo do usuário).
- `salePrice` vem do iFood validado como número.

**Verificação:** `npm test` + `tsc` + `lint` + `npm audit`. ⚠️ **Verificação end-to-end** requer uma `IFoodIntegration` **CONECTADA** (token válido) para puxar o catálogo real; tudo o mais coberto por mocks. Menos bloqueado que o fiscal — funciona assim que houver um merchant iFood conectado.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/match-nome.ts` (+teste) | criar (helper compartilhado) |
| `src/services/ai/nf-processor.service.ts` | refatorar `enriquecerItens` p/ usar o helper |
| `src/services/integrations/ifood/ifood-import.service.ts` (+testes) | criar |
| `src/app/api/integracoes/ifood/cardapio/preview/route.ts`, `importar/route.ts` | criar |
| `src/app/(dashboard)/...` UI de import iFood | criar/editar (`--tf-*`) |

---

## Critérios de aceite

- [ ] `melhorMatchPorNome` extraído e reusado pelo `nf-processor` (testes do NF continuam verdes).
- [ ] Preview classifica corretamente mapeado/casar/criar com sugestão por similaridade.
- [ ] Confirmar cria produto + categoria (casar existente ou criar), grava `IFoodItemMap`, idempotente.
- [ ] Já mapeados/produtos existentes não são sobrescritos.
- [ ] Rotas admin/MANAGER-only, tenant-scoped; exige integração CONECTADA.
- [ ] `npm test`/`tsc`/`lint` verdes; sem vuln nova.
- [ ] (Bloqueado) import real com um merchant iFood conectado.

## Fora de escopo
Sincronizar modificadores/complementos do iFood, fotos, e o sentido sistema→iFood (já existe). Atualização contínua de preço dos mapeados (decisão: não sobrescrever).
