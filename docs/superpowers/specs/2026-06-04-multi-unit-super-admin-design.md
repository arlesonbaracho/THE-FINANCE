# Design Spec — Agente 4 (Multi-Unidade) + Agente 5 (Super Admin Fase 3)

**Date:** 2026-06-04  
**Status:** Approved  
**Stack:** Next.js 14 App Router, TypeScript, PostgreSQL + Prisma, Redis, BullMQ

---

## Overview

Two independent feature sets implemented together:

- **Agente 4 — Multi-Unidade**: Brand entity, consolidated network dashboard, shared menu, centralized purchasing, network reports. Enterprise plan only.
- **Agente 5 — Super Admin Fase 3**: Platform health monitoring, AI usage management, integrations management, SaaS financial metrics (MRR, churn, LTV, cohort analysis, projections).

Both operate on the same database and reuse existing auth/layout infrastructure.

---

## Decisions & Constraints

| Decision | Choice |
|----------|--------|
| New model field naming | Portuguese field names (e.g., `insumoId`, `fornecedorId`) pointing to existing English-named models (`Ingredient`, `Supplier`) |
| Enterprise feature guard | `checkEnterpriseFeature`: server helper checking `Plan.name === 'Enterprise'` via prisma |
| Multi-unit page routing | Inside existing `(dashboard)` route group at `src/app/(dashboard)/rede/...` |
| Admin page routing | Inside existing `(admin)` route group at `src/app/(admin)/admin/saude|uso-ia|integracoes|financeiro/...` |
| Admin API routing | `src/app/api/admin/saude|uso-ia|integracoes|financeiro/...` (matches existing admin API pattern) |
| Unit selector persistence | Cookie `active-brand-unit` (non-httpOnly), set via `POST /api/rede/switch-unit`, cleared on sign-out |
| Google Maps | Embed API via `<iframe>` — no JS SDK, markers via URL params |
| PDF export | `@react-pdf/renderer` |
| Excel export | `xlsx` (SheetJS) |

---

## 1. Schema Changes

### 1.1 New models (Agent 4)

```prisma
model Brand {
  id          String   @id @default(cuid())
  nome        String
  slug        String   @unique
  logoUrl     String?
  adminUserId String
  planId      String
  createdAt   DateTime @default(now())
  unidades    Tenant[]
  admin       User     @relation(fields: [adminUserId], references: [id])
  plan        Plan     @relation(fields: [planId], references: [id])
  purchaseOrders PurchaseOrder[]
}

model PurchaseOrder {
  id           String              @id @default(cuid())
  brandId      String
  status       PurchaseOrderStatus
  fornecedorId String              // points to Supplier from the Brand's headquarter tenant
  valorTotal   Decimal
  createdBy    String
  createdAt    DateTime            @default(now())
  brand        Brand               @relation(fields: [brandId], references: [id])
  fornecedor   Supplier            @relation(fields: [fornecedorId], references: [id])
  itens        PurchaseOrderItem[]
  criador      User                @relation(fields: [createdBy], references: [id])
}

enum PurchaseOrderStatus { RASCUNHO ENVIADO RECEBIDO }

model PurchaseOrderItem {
  id                     String         @id @default(cuid())
  purchaseOrderId        String
  insumoId               String
  quantidadeTotal        Decimal
  unidadeMedida          String
  custoUnitarioEstimado  Decimal?
  distribuicaoPorUnidade Json
  purchaseOrder          PurchaseOrder  @relation(fields: [purchaseOrderId], references: [id])
  insumo                 Ingredient     @relation(fields: [insumoId], references: [id])
}

model ProdutoOverride {
  id        String   @id @default(cuid())
  tenantId  String
  produtoId String
  preco     Decimal?
  ativo     Boolean  @default(true)
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  produto   Product  @relation(fields: [produtoId], references: [id])
  @@unique([tenantId, produtoId])
}
```

### 1.2 Modified models (Agent 4)

```prisma
// Tenant: add
brandId        String?
isHeadquarters Boolean @default(false)
brand          Brand?  @relation(fields: [brandId], references: [id])
produtoOverrides ProdutoOverride[]
purchaseOrders   PurchaseOrder[]   // via criador relation on User — keep as is

// Product: add
brandId   String?
isShared  Boolean  @default(false)
brand     Brand?   @relation(fields: [brandId], references: [id])
overrides ProdutoOverride[]
```

### 1.3 New models (Agent 5)

```prisma
model PlatformHealthLog {
  id           String          @id @default(cuid())
  tipo         HealthLogTipo
  metrica      String
  valor        Decimal
  status       HealthLogStatus
  detalhes     Json?
  registradoEm DateTime        @default(now())
  @@index([tipo, registradoEm])
}

enum HealthLogTipo   { API JOB WEBHOOK DATABASE REDIS AI }
enum HealthLogStatus { OK ALERTA CRITICO }

model SaasMetricsSnapshot {
  id              String   @id @default(cuid())
  data            DateTime
  mrr             Decimal
  mrrPorPlano     Json
  churnRate       Decimal?
  tenantCount     Int
  tenantAtivos    Int
  registradoEm    DateTime @default(now())
  @@unique([data])
}

model AdminNotification {
  id          String   @id @default(cuid())
  tipo        String
  titulo      String
  descricao   String
  severidade  String
  resolvido   Boolean  @default(false)
  criadoEm    DateTime @default(now())
  resolvidoEm DateTime?
  @@index([resolvido, criadoEm])
}

model AdminSettings {
  id        String   @id @default(cuid())
  chave     String   @unique
  valor     Json
  updatedAt DateTime @updatedAt
  // e.g. { chave: "cac_mensal", valor: { "2026-01": 350, "2026-02": 420 } }
}
```

---

## 2. Environment Variables

```env
GOOGLE_MAPS_API_KEY=     # Agent 4 — Maps embed
```

BullMQ uses the existing `REDIS_URL` already in the project.

---

## 3. Middleware Changes

### 3.1 checkEnterpriseFeature (new helper, not Edge middleware)

`src/lib/check-enterprise-feature.ts`

```ts
// Fetches tenant subscription + plan. Throws 403 Response if Plan.name !== 'Enterprise'.
// Usage: await checkEnterpriseFeature(tenantId) at the top of API route handlers.
export async function checkEnterpriseFeature(tenantId: string): Promise<void>
```

### 3.2 Next.js middleware update

Add `/rede/:path*` to `PROTECTED_PREFIXES` in `src/middleware.ts`.

---

## 4. Services

### 4.1 Agent 4 — Multi-Unit Services

**`src/services/multi-unit/brand.service.ts`**
- `criarBrand(adminUserId, dados)` — create Brand, validate plan is Enterprise
- `adicionarUnidade(brandId, tenantId)` — set Tenant.brandId
- `removerUnidade(brandId, tenantId)` — clear Tenant.brandId
- `listarUnidades(brandId)` — include basic metrics from latest DashboardSnapshot
- `buscarKpisConsolidados(brandId, filtro)` — aggregate DashboardSnapshot rows for all brand units; return total vendas, pedidos, ticket médio, CMV médio%, best/worst unit by faturamento, per-unit breakdown

**`src/services/multi-unit/consolidated-reports.service.ts`**
- `vendasConsolidadas(brandId, periodo)` — aggregate DashboardSnapshot by date for all units
- `cmvConsolidado(brandId, periodo)` — aggregate CMV data
- `benchmarkUnidades(brandId, periodo)` — per-unit: CMV%, ticket médio, margem bruta; network average; leader per metric; flag units below 80% of average

**`src/services/multi-unit/purchase-order.service.ts`**
- `gerarPedidoConsolidado(brandId, fornecedorId)` — find all active stock alerts across all units, group by ingredient summing quantities, create PurchaseOrder with distribuicaoPorUnidade JSON
- `exportarPDF(purchaseOrderId)` — render via @react-pdf/renderer, return Buffer
- `exportarExcel(purchaseOrderId)` — render via xlsx, return Buffer

### 4.2 Agent 5 — Admin Services

**`src/services/admin/platform-health.service.ts`**
- `coletarMetricas()` — collect: API uptime % from PlatformHealthLog (24h/7d/30d), latência média per route, BullMQ queue stats via ioredis, DB connections via pg_stat_activity (requires `prisma.$queryRaw`), Redis memory/hit rate via `redis.info()`, iFood webhook logs 24h aggregate, Anthropic AI usage today aggregate
- `salvarSnapshot(metricas)` — persist to PlatformHealthLog; if any CRITICO, create AdminNotification

**`src/services/admin/saas-metrics.service.ts`**
- `calcularMRR()` — sum `TenantSubscription.contractedPrice` where status = ACTIVE, grouped by planId
- `historicMRR(meses)` — read SaasMetricsSnapshot ordered by data desc, last N months
- `calcularChurn(mes, ano)` — cancellations / active-at-start-of-month
- `calcularLTV()` — avg MRR per tenant × avg retention months (derived from TenantSubscription data)
- `calcularNRR(mes, ano)` — (retained + expansion MRR) / MRR at start of month; uses PlanHistory for upgrade/downgrade deltas
- `cohortAnalysis()` — group tenants by creation month; for each cohort, calculate retention % at each subsequent month
- `projecaoReceita(meses)` — CAGR from last 3 months of SaasMetricsSnapshot; project with simple confidence interval (±15%)

---

## 5. BullMQ Jobs

Both jobs live in `src/jobs/admin/` and are registered in `src/jobs/worker.ts`.

**`platform-health.job.ts`**
- Queue: `"platform-health"`
- Schedule: `*/5 * * * *`
- Calls `coletarMetricas()` → `salvarSnapshot()`
- On CRITICO: creates AdminNotification

**`saas-metrics-snapshot.job.ts`**
- Queue: `"saas-metrics-snapshot"`
- Schedule: `0 1 * * *`
- Calculates MRR, churn, tenant count → saves SaasMetricsSnapshot
- Dependencies: `bullmq`, `ioredis` (install as part of implementation)

---

## 6. API Routes

### 6.1 Agent 4 — Multi-Unit API

All routes check `checkEnterpriseFeature(tenantId)` before any logic.

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/rede/dashboard` | KPIs consolidados, query param `period` |
| GET | `/api/rede/unidades` | List units with basic metrics |
| POST | `/api/rede/unidades` | Add unit to brand |
| GET | `/api/rede/cardapio` | List shared products |
| POST | `/api/rede/cardapio` | Create shared product |
| PATCH | `/api/rede/cardapio/[id]` | Update network product |
| POST | `/api/rede/cardapio/override` | Create/update ProdutoOverride |
| GET | `/api/rede/compras` | List purchase orders |
| POST | `/api/rede/compras` | Generate consolidated purchase order |
| GET | `/api/rede/compras/[id]/exportar` | Export PDF or Excel (`?formato=pdf\|excel`) |
| GET | `/api/rede/relatorios/benchmark` | Benchmark data for period |
| POST | `/api/rede/switch-unit` | Set `active-brand-unit` cookie |

### 6.2 Agent 5 — Admin API

All routes verify admin session via `getAdminSession()`.

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/admin/saude/metricas` | Latest PlatformHealthLog entries per type |
| GET | `/api/admin/saude/historico` | Latency/uptime history for period |
| GET | `/api/admin/uso-ia` | AiUsage all tenants, sorted by cost |
| PATCH | `/api/admin/uso-ia/[tenantId]/limite` | Update tenant limiteTokens |
| POST | `/api/admin/uso-ia/[tenantId]/limite` | Reset token counter |
| GET | `/api/admin/integracoes` | All tenants' integration statuses |
| POST | `/api/admin/integracoes/[tenantId]/desconectar` | Force disconnect iFood or WhatsApp |
| GET | `/api/admin/financeiro/mrr` | Current MRR + last 12 months history |
| GET | `/api/admin/financeiro/metricas` | Churn, LTV, ARR, NRR |
| GET | `/api/admin/financeiro/cohort` | Cohort analysis data |
| GET | `/api/admin/financeiro/projecao` | Revenue projection 3 months |

---

## 7. Pages

### 7.1 Agent 4 — Multi-Unit Pages

All pages at `src/app/(dashboard)/rede/*/page.tsx`. Use the existing `(dashboard)` layout.

**`/rede/dashboard`**
- Guard: if `session.user.brandId` is null → redirect to `/dashboard`
- Period filter (global) + unit dropdown ("Todas" + unit list)
- 4 KPI cards: Vendas totais | Pedidos | Ticket médio | CMV%  — each with Δ vs previous period
- 2 highlight cards: Melhor unidade (green badge) | Unidade em alerta (amber badge)
- Comparative table: Unidade | Cidade | Vendas | Pedidos | Ticket médio | CMV% | Alertas | Status — row click → `/dashboard` for that unit (set unit cookie)
- Recharts BarChart grouped: toggle Vendas|Pedidos|CMV|Ticket, bars per unit, period on X axis
- Google Maps Embed iframe with markers colored by performance (green=top tercile, amber=mid, red=bottom)

**`/rede/cardapio`**
- Tabs: "Cardápio da rede" | "Overrides por unidade"
- Rede tab: product table + "＋ Novo produto da rede" modal, "Sincronizar preço" toggle per row (when toggled ON: clears all ProdutoOverride.preco for that product across units)
- Overrides tab: unit select → table of products with preço base | preço override | status override, inline edit per row

**`/rede/compras`**
- Consolidated needs card: auto-generated from active ESTOQUE alerts across all units — table: insumo | unidades solicitando | quantidade total
- "Gerar pedido de compra" button with supplier select dropdown
- History table: data | fornecedor | itens | valor estimado | status | Ações (PDF, Excel, Marcar recebido)

**`/rede/relatorios`**
- Toggle "Rede completa" | "Por unidade" at top
- Benchmark table: units × metrics (CMV%, ticket médio, margem bruta), leader cell highlighted, "Abaixo da média" badge (< 80% of network avg)
- Other Fase 2 reports shown below with consolidated data when "Rede completa" is selected

### 7.2 Header Modification

`src/components/layout/header.tsx`:
- Read `session.user.brandId` — if truthy, render brand unit dropdown next to store name
- Dropdown items: "Visão consolidada" (top, bold) → clear cookie + navigate `/rede/dashboard`; then list of units → set cookie + navigate `/dashboard`
- Non-Enterprise users: no change to header

### 7.3 Agent 5 — Super Admin Pages

All at `src/app/(admin)/admin/*/page.tsx`.

**`/admin/saude`**
- 5 status cards: API uptime% | Jobs (active/waiting/failed today) | DB connections + slow queries | Redis memory% + hit rate | AI tokens today + error rate
- Latency chart (recharts LineChart): 24h, 5-min intervals, red reference line at 2000ms, value+status tooltip
- Active alerts table: tipo | descrição | severidade | horário | "Resolver" button
- iFood webhook logs: tenant | horário | status | erro — filter by Processado/Falhou

**`/admin/uso-ia`**
- 3 summary cards: total tokens hoje | custo estimado mês | tenants acima/próximos do limite
- Usage table: Tenant | Plano | Tokens input | Tokens output | Custo R$ | Limite | % usado | Ações
  - "Acima" red badge / "Próximo" amber badge when relevant
  - Actions: edit limit (modal with number input) + reset counter (confirmation)
- Bar chart: top 10 tenants by token consumption

**`/admin/integracoes`**
- Table: Tenant | iFood status | WhatsApp status | Última atividade
- Click row → inline expand: iFood (merchantId, last sync, orders today, webhook error rate) + WhatsApp (number, msgs today, last send) + disconnect buttons with confirmation

**`/admin/financeiro`**
- Tabs: MRR | Métricas | Cohort | Projeção

  **MRR tab**: MRR total card + per-plan breakdown (3 smaller cards) + ARR projected card; recharts AreaChart stacked by plan, last 12 months

  **Métricas tab**: Churn rate | LTV médio | NRR | CAC (manual input, read/written via AdminSettings model); recharts LineChart of monthly churn history

  **Cohort tab**: grid — rows=acquisition month, cols=months of retention; cells color-coded: >90% dark green, 70-90% light green, 50-70% amber, <50% red; tooltip: cohort | month | active tenants | retention %

  **Projeção tab**: recharts LineChart — solid line (12mo history) + dashed line (3mo projection) + shaded confidence band (±15%); 3 cards (MRR projection month 1/2/3); methodology note below chart

---

## 8. Suggested Improvements

The following are not in the original spec but are worth considering during implementation:

1. **Redis-level KPI caching** (Agent 4): `buscarKpisConsolidados` aggregates DashboardSnapshot across all units on every request. For networks with many units, cache the result in Redis with a 5-minute TTL keyed by `brandId + period`.

2. **Consolidated `DashboardSnapshot` rows** (Agent 4): Consider writing a brand-level snapshot daily (via BullMQ job) that pre-aggregates all units. Eliminates runtime aggregation cost for the consolidated dashboard.

3. **`checkEnterpriseFeature` as wrapper, not inline check** (Agent 4): Implement as a higher-order function wrapping entire route handlers — reduces boilerplate per route and makes it easier to add feature flags in the future.

4. **`AdminSettings` model** (Agent 5): Included in spec — `AdminSettings { chave String @unique, valor Json }` stores CAC by month and any other admin-level key-value config.

5. **Platform health latency instrumentation** (Agent 5): `pg_stat_statements` requires the PostgreSQL extension to be enabled. As a simpler alternative, wrap key Prisma calls in a timing utility and write results to `PlatformHealthLog` directly from the app — no superuser needed.

6. **Soft-disable vs hard-disconnect for integrations** (Agent 5): "Force disconnect" for iFood means revoking the OAuth token and clearing `IFoodIntegration`. For WhatsApp (Evolution API), it means sending a logout command to the Evolution API instance. Document the exact behavior for each integration type.

7. **NRR calculation** (Agent 5): NRR (Net Revenue Retention) requires tracking expansion revenue (upgrades) vs contraction (downgrades). The current `PlanHistory` model has this data — implement `calcularNRR` using PlanHistory entries within a period rather than approximating.

---

## 9. Implementation Order

Within the combined plan:

1. **Schema migration** — all new models + Tenant/Product field additions
2. **`checkEnterpriseFeature` helper + middleware update**
3. **Agent 4 services** (brand → consolidated-reports → purchase-order)
4. **Agent 4 API routes**
5. **Agent 4 pages** (dashboard → cardapio → compras → relatorios)
6. **Header modification**
7. **Agent 5 schema** (PlatformHealthLog, SaasMetricsSnapshot, AdminNotification)
8. **BullMQ worker setup + install bullmq/ioredis**
9. **Agent 5 services** (platform-health → saas-metrics)
10. **Agent 5 jobs**
11. **Agent 5 API routes**
12. **Agent 5 pages** (saude → uso-ia → integracoes → financeiro)
