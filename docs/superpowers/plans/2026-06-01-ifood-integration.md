# iFood Integration (Agente 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar o iFood ao THE FINANCE — OAuth, recebimento de pedidos via webhook, sincronização de cardápio, KDS atualizado, dashboard de delivery e página de Ajuda atualizada.

**Architecture:** BullMQ workers iniciados dentro de `server.ts` (padrão já existente via `startXxxWorkers`). Services em `src/services/integrations/ifood/` com chamadas `fetch` diretas. Schema Prisma estendido: `Pedido.mesaId`/`garcomId` tornam-se opcionais + 4 novos modelos iFood.

**Tech Stack:** Next.js 14 App Router · TypeScript · PostgreSQL + Prisma · BullMQ (já em `src/lib/bullmq.ts`) · Socket.io (já em `server.ts`) · AES-256-GCM (Node.js `crypto` nativo) · Recharts (já instalado)

---

## File Map

| Ação | Arquivo |
|---|---|
| Modify | `prisma/schema.prisma` |
| Create | `src/lib/crypto.ts` |
| Create | `src/services/integrations/ifood/ifood-auth.service.ts` |
| Create | `src/services/integrations/ifood/ifood-orders.service.ts` |
| Create | `src/services/integrations/ifood/ifood-catalog.service.ts` |
| Create | `src/jobs/ifood/ifood-webhook.job.ts` |
| Create | `src/jobs/ifood/ifood-auto-confirm.job.ts` |
| Create | `src/jobs/ifood/ifood-catalog-sync.job.ts` |
| Create | `src/jobs/ifood/index.ts` |
| Modify | `server.ts` |
| Create | `src/app/api/integracoes/ifood/connect/route.ts` |
| Create | `src/app/api/integracoes/ifood/lojas/route.ts` |
| Create | `src/app/api/integracoes/ifood/disconnect/route.ts` |
| Create | `src/app/api/webhooks/ifood/[tenantId]/route.ts` |
| Create | `src/app/api/integracoes/ifood/cardapio/route.ts` |
| Create | `src/app/api/integracoes/ifood/pausar-item/route.ts` |
| Create | `src/app/api/integracoes/ifood/reativar-item/route.ts` |
| Create | `src/app/api/relatorios/delivery/route.ts` |
| Create | `src/app/(dashboard)/configuracoes/integracoes/ifood/page.tsx` |
| Create | `src/app/(dashboard)/configuracoes/integracoes/ifood/cardapio/page.tsx` |
| Create | `src/app/(dashboard)/relatorios/delivery/page.tsx` |
| Modify | `src/app/[slug]/cozinha/page.tsx` |
| Modify | `src/app/(dashboard)/ajuda/page.tsx` |

---

## Task 1: Schema Prisma — Migração

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Atualizar `prisma/schema.prisma`**

Localizar o bloco `model Pedido` e aplicar as seguintes alterações:

```prisma
// Adicionar enum ANTES dos modelos PDV (após o bloco de SessaoCaixa)
enum OrigemPedido {
  BALCAO
  MESA
  IFOOD
}

// No model Pedido, alterar:
model Pedido {
  id          String       @id @default(cuid())
  tenantId    String
  tenant      Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  mesaId      String?                        // ← era String
  mesa        Mesa?        @relation(fields: [mesaId], references: [id])  // ← era Mesa
  garcomId    String?                        // ← era String
  garcom      User?        @relation("Garcom", fields: [garcomId], references: [id])  // ← era User
  origem      OrigemPedido @default(MESA)    // ← NOVO
  status      PedidoStatus @default(ABERTO)
  subtotal    Float        @default(0)
  taxaServico Float        @default(0)
  total       Float        @default(0)
  criadoEm   DateTime     @default(now())
  fechadoEm  DateTime?
  itens       PedidoItem[]
  pagamentos  Pagamento[]
  ifoodPedido IFoodPedido?                   // ← NOVO (relação reversa)

  @@index([tenantId])
  @@index([mesaId])
  @@index([garcomId])
  @@index([tenantId, status])
}
```

Adicionar ao `model Tenant` (após `relatorioSchedules`):
```prisma
  ifoodIntegracao  IFoodIntegration?
  ifoodItemMaps    IFoodItemMap[]
```

Adicionar ao `model Product` (após `pedidoItems`):
```prisma
  ifoodItemMaps IFoodItemMap[]
```

Adicionar os novos modelos e enums ao FINAL do arquivo:
```prisma
// ── iFood Integration ─────────────────────────────────────────────────────────

enum IFoodStatus {
  CONECTADO
  DESCONECTADO
  ERRO
}

enum WebhookStatus {
  PROCESSADO
  FALHOU
}

model IFoodIntegration {
  id                    String            @id @default(cuid())
  tenantId              String            @unique
  merchantId            String
  clientId              String
  clientSecretEncrypted String
  accessToken           String?
  refreshToken          String?
  tokenExpiresAt        DateTime?
  status                IFoodStatus
  ultimaSincronizacao   DateTime?
  tenant                Tenant            @relation(fields: [tenantId], references: [id])
  pedidos               IFoodPedido[]
  webhookLogs           IFoodWebhookLog[]

  @@index([tenantId])
}

model IFoodPedido {
  id              String           @id @default(cuid())
  tenantId        String
  pedidoId        String           @unique
  ifoodOrderId    String           @unique
  ifoodReference  String?
  statusIfood     String
  comissaoPercent Decimal
  enderecoEntrega Json
  createdAt       DateTime         @default(now())
  pedido          Pedido           @relation(fields: [pedidoId], references: [id])
  integracao      IFoodIntegration @relation(fields: [tenantId], references: [tenantId])

  @@index([tenantId])
}

model IFoodWebhookLog {
  id           String           @id @default(cuid())
  tenantId     String
  ifoodOrderId String
  payload      Json
  status       WebhookStatus
  erro         String?
  createdAt    DateTime         @default(now())
  integracao   IFoodIntegration @relation(fields: [tenantId], references: [tenantId])

  @@index([tenantId])
}

model IFoodItemMap {
  id            String   @id @default(cuid())
  tenantId      String
  ifoodItemId   String
  ifoodItemNome String
  produtoId     String?
  produto       Product? @relation(fields: [produtoId], references: [id])

  @@unique([tenantId, ifoodItemId])
  @@index([tenantId])
}
```

- [ ] **Step 2: Gerar e revisar a migration**

```bash
npx prisma migrate dev --name ifood_integration --create-only
```

Abrir o arquivo gerado em `prisma/migrations/*/migration.sql` e confirmar que:
- `ALTER TABLE "Pedido" ALTER COLUMN "mesaId" DROP NOT NULL;`
- `ALTER TABLE "Pedido" ALTER COLUMN "garcomId" DROP NOT NULL;`
- Novos enums criados
- Novas tabelas criadas

Aplicar a migration:
```bash
npx prisma migrate dev
```

Esperado: `Your database is now in sync with your schema.`

- [ ] **Step 3: Regenerar o Prisma Client**

```bash
npx prisma generate
```

Esperado: `Generated Prisma Client (v...)` sem erros.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): make mesaId/garcomId optional, add OrigemPedido and iFood models"
```

---

## Task 2: Utilitário Criptográfico (`src/lib/crypto.ts`)

**Files:**
- Create: `src/lib/crypto.ts`

> `ENCRYPTION_KEY` deve ser um hex de 64 chars (32 bytes). Gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` e adicione ao `.env`.

- [ ] **Step 1: Criar `src/lib/crypto.ts`**

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGO = 'aes-256-gcm'

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) throw new Error('ENCRYPTION_KEY must be 64-char hex (32 bytes)')
  return Buffer.from(hex, 'hex')
}

export function encrypt(texto: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':')
}

export function decrypt(cifrado: string): string {
  const key = getKey()
  const parts = cifrado.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted format')
  const [ivB64, tagB64, dataB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(tagB64, 'base64')
  const encrypted = Buffer.from(dataB64, 'base64')
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
```

- [ ] **Step 2: Adicionar variáveis ao `.env`**

Abrir `.env` e adicionar (substitua pelos valores reais):
```
ENCRYPTION_KEY=<64-char hex gerado acima>
IFOOD_CLIENT_ID=
IFOOD_CLIENT_SECRET=
IFOOD_WEBHOOK_SECRET=
IFOOD_API_BASE_URL=https://merchant-api.ifood.com.br
IFOOD_AUTO_CONFIRM_DELAY_MS=30000
```

- [ ] **Step 3: Verificar que TypeScript compila**

```bash
npx tsc --noEmit
```

Esperado: sem erros em `src/lib/crypto.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/crypto.ts .env.example
git commit -m "feat(crypto): add AES-256-GCM encrypt/decrypt utility"
```

---

## Task 3: iFood Auth Service

**Files:**
- Create: `src/services/integrations/ifood/ifood-auth.service.ts`

- [ ] **Step 1: Criar `src/services/integrations/ifood/ifood-auth.service.ts`**

```typescript
import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/crypto'

const BASE = process.env.IFOOD_API_BASE_URL ?? 'https://merchant-api.ifood.com.br'

async function fetchToken(clientId: string, clientSecret: string) {
  const body = new URLSearchParams({
    grantType: 'client_credentials',
    clientId,
    clientSecret,
  })
  const res = await fetch(`${BASE}/authentication/v1.0/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`iFood OAuth error ${res.status}: ${text}`)
  }
  return res.json() as Promise<{ accessToken: string; expiresIn: number; merchantId?: string }>
}

export async function conectar(tenantId: string, clientId: string, clientSecret: string): Promise<void> {
  const data = await fetchToken(clientId, clientSecret)
  const expiresAt = new Date(Date.now() + data.expiresIn * 1000)

  await prisma.iFoodIntegration.upsert({
    where: { tenantId },
    create: {
      tenantId,
      merchantId: data.merchantId ?? '',
      clientId,
      clientSecretEncrypted: encrypt(clientSecret),
      accessToken: encrypt(data.accessToken),
      tokenExpiresAt: expiresAt,
      status: 'CONECTADO',
    },
    update: {
      clientId,
      merchantId: data.merchantId ?? '',
      clientSecretEncrypted: encrypt(clientSecret),
      accessToken: encrypt(data.accessToken),
      tokenExpiresAt: expiresAt,
      status: 'CONECTADO',
    },
  })
}

export async function refreshToken(tenantId: string): Promise<string> {
  const integration = await prisma.iFoodIntegration.findUniqueOrThrow({ where: { tenantId } })
  const clientSecret = decrypt(integration.clientSecretEncrypted)
  let data: { accessToken: string; expiresIn: number }

  try {
    data = await fetchToken(integration.clientId, clientSecret)
  } catch (err) {
    await prisma.iFoodIntegration.update({ where: { tenantId }, data: { status: 'ERRO' } })
    throw err
  }

  const expiresAt = new Date(Date.now() + data.expiresIn * 1000)
  await prisma.iFoodIntegration.update({
    where: { tenantId },
    data: { accessToken: encrypt(data.accessToken), tokenExpiresAt: expiresAt, status: 'CONECTADO' },
  })
  return data.accessToken
}

export async function getAccessToken(tenantId: string): Promise<string> {
  const integration = await prisma.iFoodIntegration.findUniqueOrThrow({ where: { tenantId } })
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000)
  if (!integration.tokenExpiresAt || integration.tokenExpiresAt < fiveMinFromNow || !integration.accessToken) {
    return refreshToken(tenantId)
  }
  return decrypt(integration.accessToken)
}

export async function desconectar(tenantId: string): Promise<void> {
  await prisma.iFoodIntegration.update({
    where: { tenantId },
    data: { accessToken: null, refreshToken: null, tokenExpiresAt: null, status: 'DESCONECTADO' },
  })
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/services/
git commit -m "feat(ifood): add auth service (OAuth client_credentials, AES token storage)"
```

---

## Task 4: iFood Orders Service

**Files:**
- Create: `src/services/integrations/ifood/ifood-orders.service.ts`

> O payload de webhook do iFood tem a estrutura documentada em https://developer.ifood.com.br/. Campos-chave: `id` (orderId), `reference` (ifoodReference), `items[]`, `deliveryAddress`, `payments.methods[].value`.

- [ ] **Step 1: Criar `src/services/integrations/ifood/ifood-orders.service.ts`**

```typescript
import { prisma } from '@/lib/prisma'
import { getAccessToken } from './ifood-auth.service'
import type { Pedido } from '@prisma/client'

const BASE = process.env.IFOOD_API_BASE_URL ?? 'https://merchant-api.ifood.com.br'

type IFoodItem = {
  id: string
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

type IFoodWebhookPayload = {
  id: string
  reference?: string
  createdAt?: string
  items?: IFoodItem[]
  deliveryAddress?: Record<string, unknown>
  payments?: { methods?: Array<{ value?: number; type?: string }> }
  [key: string]: unknown
}

export async function confirmarPedido(tenantId: string, ifoodOrderId: string): Promise<void> {
  const token = await getAccessToken(tenantId)
  const res = await fetch(`${BASE}/order/v1.0/orders/${ifoodOrderId}/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`confirmarPedido failed ${res.status}: ${text}`)
  }
}

export async function rejeitarPedido(tenantId: string, ifoodOrderId: string, motivo: string): Promise<void> {
  const token = await getAccessToken(tenantId)
  const res = await fetch(`${BASE}/order/v1.0/orders/${ifoodOrderId}/reject`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cancellationCode: motivo }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`rejeitarPedido failed ${res.status}: ${text}`)
  }

  // Atualizar statusIfood no banco
  await prisma.iFoodPedido.updateMany({
    where: { ifoodOrderId },
    data: { statusIfood: 'REJECTED' },
  })
}

export async function processarWebhook(tenantId: string, payload: IFoodWebhookPayload): Promise<Pedido> {
  const ifoodOrderId = payload.id

  // Idempotência
  const existing = await prisma.iFoodPedido.findUnique({ where: { ifoodOrderId } })
  if (existing) {
    return prisma.pedido.findUniqueOrThrow({ where: { id: existing.pedidoId } })
  }

  const items: IFoodItem[] = payload.items ?? []

  // Mapear itens iFood → produtos THE FINANCE
  const mappings = items.length > 0
    ? await prisma.iFoodItemMap.findMany({
        where: {
          tenantId,
          ifoodItemId: { in: items.map((i) => i.id) },
          produtoId: { not: null },
        },
      })
    : []

  const mappingMap = new Map(mappings.map((m) => [m.ifoodItemId, m.produtoId!]))

  // Buscar preços dos produtos mapeados
  const produtoIds = [...new Set(mappings.map((m) => m.produtoId!))]
  const produtos = produtoIds.length > 0
    ? await prisma.product.findMany({ where: { id: { in: produtoIds } }, select: { id: true, salePrice: true } })
    : []
  const priceMap = new Map(produtos.map((p) => [p.id, p.salePrice]))

  const pedidoItems = items
    .filter((item) => mappingMap.has(item.id))
    .map((item) => ({
      productId: mappingMap.get(item.id)!,
      quantidade: item.quantity,
      precoUnitario: priceMap.get(mappingMap.get(item.id)!) ?? item.unitPrice,
    }))

  const subtotal = pedidoItems.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0)

  // Extrair comissão (primeiro método de pagamento iFood)
  const comissao = payload.payments?.methods?.[0]?.value ?? 0

  // Criar Pedido
  const pedido = await prisma.pedido.create({
    data: {
      tenantId,
      origem: 'IFOOD',
      status: 'ABERTO',
      subtotal,
      taxaServico: 0,
      total: subtotal,
      itens: pedidoItems.length > 0
        ? { create: pedidoItems }
        : undefined,
    },
  })

  // Criar IFoodPedido
  await prisma.iFoodPedido.create({
    data: {
      tenantId,
      pedidoId: pedido.id,
      ifoodOrderId,
      ifoodReference: payload.reference ?? null,
      statusIfood: 'PLACED',
      comissaoPercent: comissao,
      enderecoEntrega: (payload.deliveryAddress ?? {}) as object,
    },
  })

  // Descontar estoque via ficha técnica
  for (const item of pedidoItems) {
    const ingredientes = await prisma.productIngredient.findMany({
      where: { productId: item.productId },
      include: { ingredient: true },
    })
    for (const pi of ingredientes) {
      const qtdConsumida = pi.quantity * item.quantidade
      await prisma.ingredient.update({
        where: { id: pi.ingredientId },
        data: { currentQty: { decrement: qtdConsumida } },
      })
      await prisma.ingredientMovement.create({
        data: {
          ingredientId: pi.ingredientId,
          tenantId,
          type: 'OUT',
          quantity: qtdConsumida,
          reason: `Pedido iFood ${ifoodOrderId}`,
        },
      })
    }
  }

  // Emitir via Socket.io
  const io = (global as { io?: { to: (room: string) => { emit: (ev: string, data: unknown) => void } } }).io
  if (io) {
    const pedidoCompleto = await prisma.pedido.findUnique({
      where: { id: pedido.id },
      include: {
        itens: { include: { product: { select: { id: true, name: true } } } },
        ifoodPedido: true,
      },
    })
    io.to(tenantId).emit('pedido:novo', pedidoCompleto)
  }

  return pedido
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/services/integrations/ifood/ifood-orders.service.ts
git commit -m "feat(ifood): add orders service (webhook processing, estoque, socket)"
```

---

## Task 5: iFood Catalog Service

**Files:**
- Create: `src/services/integrations/ifood/ifood-catalog.service.ts`

- [ ] **Step 1: Criar `src/services/integrations/ifood/ifood-catalog.service.ts`**

```typescript
import { prisma } from '@/lib/prisma'
import { getAccessToken } from './ifood-auth.service'

const BASE = process.env.IFOOD_API_BASE_URL ?? 'https://merchant-api.ifood.com.br'

export type IFoodItem = {
  id: string
  name: string
  description?: string
  price: number
  available: boolean
  categoryId?: string
  categoryName?: string
}

async function getMerchantId(tenantId: string): Promise<string> {
  const integration = await prisma.iFoodIntegration.findUniqueOrThrow({ where: { tenantId } })
  return integration.merchantId
}

export async function listarItensCatalogo(tenantId: string): Promise<IFoodItem[]> {
  const [token, merchantId] = await Promise.all([getAccessToken(tenantId), getMerchantId(tenantId)])
  const res = await fetch(`${BASE}/catalog/v1.0/merchants/${merchantId}/catalog-items`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`listarItensCatalogo failed ${res.status}: ${text}`)
  }
  const data = await res.json()
  // O payload real pode ter estrutura aninhada — adaptar conforme documentação iFood
  const items: IFoodItem[] = Array.isArray(data) ? data : (data.catalogItems ?? data.items ?? [])
  return items
}

export async function pausarItem(tenantId: string, ifoodItemId: string): Promise<void> {
  const [token, merchantId] = await Promise.all([getAccessToken(tenantId), getMerchantId(tenantId)])
  const res = await fetch(`${BASE}/catalog/v1.0/merchants/${merchantId}/items/${ifoodItemId}/unavailabilities`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'STOCK' }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`pausarItem failed ${res.status}: ${text}`)
  }
}

export async function reativarItem(tenantId: string, ifoodItemId: string): Promise<void> {
  const [token, merchantId] = await Promise.all([getAccessToken(tenantId), getMerchantId(tenantId)])
  const res = await fetch(`${BASE}/catalog/v1.0/merchants/${merchantId}/items/${ifoodItemId}/unavailabilities`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`reativarItem failed ${res.status}: ${text}`)
  }
}

export async function atualizarPreco(tenantId: string, ifoodItemId: string, novoPreco: number): Promise<void> {
  const [token, merchantId] = await Promise.all([getAccessToken(tenantId), getMerchantId(tenantId)])
  const res = await fetch(`${BASE}/catalog/v1.0/merchants/${merchantId}/items/${ifoodItemId}/prices`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ price: novoPreco }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`atualizarPreco failed ${res.status}: ${text}`)
  }
}

export async function sincronizarDisponibilidade(tenantId: string): Promise<void> {
  const mappings = await prisma.iFoodItemMap.findMany({
    where: { tenantId, produtoId: { not: null } },
    include: {
      produto: {
        include: { ingredients: { include: { ingredient: true } } },
      },
    },
  })

  for (const mapping of mappings) {
    if (!mapping.produto) continue

    // Verificar se todos os insumos têm estoque > 0
    const semEstoque = mapping.produto.ingredients.some((pi) => pi.ingredient.currentQty <= 0)

    try {
      if (semEstoque) {
        await pausarItem(tenantId, mapping.ifoodItemId)
      } else {
        await reativarItem(tenantId, mapping.ifoodItemId)
      }
    } catch {
      // Log mas não interrompe sync dos demais itens
      console.error(`[ifood-catalog-sync] Erro ao sincronizar item ${mapping.ifoodItemId}`)
    }
  }

  await prisma.iFoodIntegration.update({
    where: { tenantId },
    data: { ultimaSincronizacao: new Date() },
  })
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/services/integrations/ifood/ifood-catalog.service.ts
git commit -m "feat(ifood): add catalog service (pause/reactivate items, availability sync)"
```

---

## Task 6: BullMQ Workers + Integração em `server.ts`

**Files:**
- Create: `src/jobs/ifood/ifood-webhook.job.ts`
- Create: `src/jobs/ifood/ifood-auto-confirm.job.ts`
- Create: `src/jobs/ifood/ifood-catalog-sync.job.ts`
- Create: `src/jobs/ifood/index.ts`
- Modify: `server.ts`

- [ ] **Step 1: Criar `src/jobs/ifood/ifood-webhook.job.ts`**

```typescript
import type { Job } from 'bullmq'
import { processarWebhook } from '@/services/integrations/ifood/ifood-orders.service'

type WebhookJobData = {
  tenantId: string
  payload: Record<string, unknown>
}

export async function processWebhookJob(job: Job<WebhookJobData>): Promise<void> {
  const { tenantId, payload } = job.data
  await processarWebhook(tenantId, payload as Parameters<typeof processarWebhook>[1])
  console.log(`[ifood-webhook] Pedido ${payload.id} processado para tenant ${tenantId}`)
}
```

- [ ] **Step 2: Criar `src/jobs/ifood/ifood-auto-confirm.job.ts`**

```typescript
import type { Job } from 'bullmq'
import { confirmarPedido } from '@/services/integrations/ifood/ifood-orders.service'
import { prisma } from '@/lib/prisma'

type AutoConfirmJobData = {
  tenantId: string
  ifoodOrderId: string
}

export async function processAutoConfirmJob(job: Job<AutoConfirmJobData>): Promise<void> {
  const { tenantId, ifoodOrderId } = job.data

  const ifoodPedido = await prisma.iFoodPedido.findUnique({ where: { ifoodOrderId } })
  if (!ifoodPedido) return
  if (ifoodPedido.statusIfood === 'CANCELLED' || ifoodPedido.statusIfood === 'REJECTED') return

  await confirmarPedido(tenantId, ifoodOrderId)
  await prisma.iFoodPedido.update({
    where: { ifoodOrderId },
    data: { statusIfood: 'CONFIRMED' },
  })
  console.log(`[ifood-auto-confirm] Pedido ${ifoodOrderId} confirmado automaticamente`)
}
```

- [ ] **Step 3: Criar `src/jobs/ifood/ifood-catalog-sync.job.ts`**

```typescript
import { prisma } from '@/lib/prisma'
import { sincronizarDisponibilidade } from '@/services/integrations/ifood/ifood-catalog.service'

export async function processCatalogSyncJob(): Promise<void> {
  const integracoes = await prisma.iFoodIntegration.findMany({
    where: { status: 'CONECTADO' },
    select: { tenantId: true },
  })

  for (const { tenantId } of integracoes) {
    try {
      await sincronizarDisponibilidade(tenantId)
      console.log(`[ifood-catalog-sync] Tenant ${tenantId} sincronizado`)
    } catch (err) {
      console.error(`[ifood-catalog-sync] Erro tenant ${tenantId}:`, err)
    }
  }
}
```

- [ ] **Step 4: Criar `src/jobs/ifood/index.ts`**

```typescript
import { Queue, Worker } from 'bullmq'
import { redisConnectionOptions } from '@/lib/bullmq'
import type { Server as SocketIOServer } from 'socket.io'
import { processWebhookJob } from './ifood-webhook.job'
import { processAutoConfirmJob } from './ifood-auto-confirm.job'
import { processCatalogSyncJob } from './ifood-catalog-sync.job'

export async function startIFoodWorkers(_io: SocketIOServer): Promise<void> {
  // Worker: processa webhook payload (enfileirado pela rota POST /webhooks/ifood/[tenantId])
  new Worker('ifood-webhook', processWebhookJob, {
    connection: redisConnectionOptions,
    concurrency: 5,
  })

  // Worker: confirma pedido automaticamente após delay de 30s
  new Worker('ifood-auto-confirm', processAutoConfirmJob, {
    connection: redisConnectionOptions,
  })

  // Worker + Queue: sincroniza catálogo a cada 30 minutos (cron)
  const syncQueue = new Queue('ifood-catalog-sync', { connection: redisConnectionOptions })
  await syncQueue.add(
    'catalog-sync',
    {},
    { repeat: { pattern: '*/30 * * * *' }, jobId: 'ifood-catalog-sync-cron' }
  )
  new Worker('ifood-catalog-sync', processCatalogSyncJob, {
    connection: redisConnectionOptions,
  })

  console.log('> iFood workers started')
}
```

- [ ] **Step 5: Adicionar `startIFoodWorkers` em `server.ts`**

Localizar o bloco dentro do `if (redisOk)` em `server.ts` (após `await startAiWorkers(io)`) e adicionar:

```typescript
  // Adicionar junto aos outros imports no topo:
  // (dentro do bloco if (redisOk))
  const { startIFoodWorkers } = await import('./src/jobs/ifood')
  await startIFoodWorkers(io)
```

O bloco completo fica:
```typescript
  if (redisOk) {
    const { startAlertWorkers } = await import('./src/jobs/alerts')
    const { startDashboardWorkers } = await import('./src/jobs/dashboard')
    const { startAiWorkers } = await import('./src/jobs/ai')
    const { startIFoodWorkers } = await import('./src/jobs/ifood')   // ← NOVO
    await startAlertWorkers(io)
    await startDashboardWorkers()
    await startAiWorkers(io)
    await startIFoodWorkers(io)                                        // ← NOVO
  }
```

- [ ] **Step 6: Verificar TypeScript e iniciar servidor**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

```bash
npm run dev
```

Esperado na saída: `> iFood workers started` (se Redis disponível).

- [ ] **Step 7: Commit**

```bash
git add src/jobs/ifood/ server.ts
git commit -m "feat(ifood): add BullMQ workers (webhook, auto-confirm, catalog-sync cron)"
```

---

## Task 7: API Routes — Conexão, Lojas, Desconexão

**Files:**
- Create: `src/app/api/integracoes/ifood/connect/route.ts`
- Create: `src/app/api/integracoes/ifood/lojas/route.ts`
- Create: `src/app/api/integracoes/ifood/disconnect/route.ts`

- [ ] **Step 1: Criar `src/app/api/integracoes/ifood/connect/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { conectar } from '@/services/integrations/ifood/ifood-auth.service'

function allowed(role?: string) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const body = await req.json()
  const { clientId, clientSecret } = body
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'clientId e clientSecret são obrigatórios' }, { status: 400 })
  }

  try {
    await conectar(tenantId, clientId, clientSecret)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const integration = await prisma.iFoodIntegration.findUnique({
    where: { tenantId },
    select: { status: true, merchantId: true, ultimaSincronizacao: true, clientId: true },
  })

  if (!integration) return NextResponse.json({ status: 'DESCONECTADO' })

  const pedidosHoje = await prisma.iFoodPedido.count({
    where: {
      tenantId,
      createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
  })

  return NextResponse.json({ ...integration, pedidosHoje })
}
```

- [ ] **Step 2: Criar `src/app/api/integracoes/ifood/lojas/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAccessToken } from '@/services/integrations/ifood/ifood-auth.service'

function allowed(role?: string) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId
  const BASE = process.env.IFOOD_API_BASE_URL ?? 'https://merchant-api.ifood.com.br'

  try {
    const token = await getAccessToken(tenantId)
    const res = await fetch(`${BASE}/merchant/v1.0/merchants`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'Falha ao buscar lojas' }, { status: 502 })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}
```

- [ ] **Step 3: Criar `src/app/api/integracoes/ifood/disconnect/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { desconectar } from '@/services/integrations/ifood/ifood-auth.service'

function allowed(role?: string) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    await desconectar(session.user.tenantId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/integracoes/ifood/connect/ src/app/api/integracoes/ifood/lojas/ src/app/api/integracoes/ifood/disconnect/
git commit -m "feat(ifood): add connect, lojas and disconnect API routes"
```

---

## Task 8: Webhook Route (HMAC-SHA256)

**Files:**
- Create: `src/app/api/webhooks/ifood/[tenantId]/route.ts`

> O iFood exige resposta em ≤ 5 segundos. A rota salva o log e enfileira o processamento, retornando 200 imediatamente. O HMAC é validado no raw body antes do parse JSON.

- [ ] **Step 1: Criar `src/app/api/webhooks/ifood/[tenantId]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import { Queue } from 'bullmq'
import { redisConnectionOptions } from '@/lib/bullmq'

function validateSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.IFOOD_WEBHOOK_SECRET ?? ''
  if (!secret) return false
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const { tenantId } = params
  const rawBody = await req.text()
  const signature = req.headers.get('x-ifood-signature') ?? ''

  if (!validateSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const ifoodOrderId = (payload.id as string) ?? 'unknown'

  // Salvar log (fire-and-forget para não atrasar o 200)
  prisma.iFoodWebhookLog.create({
    data: {
      tenantId,
      ifoodOrderId,
      payload,
      status: 'PROCESSADO',
    },
  }).catch((err) => console.error('[webhook-log]', err))

  // Enfileirar processamento assíncrono
  const queue = new Queue('ifood-webhook', { connection: redisConnectionOptions })
  await queue.add('process', { tenantId, payload }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } })

  return NextResponse.json({ ok: true }, { status: 200 })
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/
git commit -m "feat(ifood): add webhook route with HMAC-SHA256 validation and async processing"
```

---

## Task 9: API Routes — Cardápio, Pausar, Reativar + Delivery Report API

**Files:**
- Create: `src/app/api/integracoes/ifood/cardapio/route.ts`
- Create: `src/app/api/integracoes/ifood/pausar-item/route.ts`
- Create: `src/app/api/integracoes/ifood/reativar-item/route.ts`
- Create: `src/app/api/relatorios/delivery/route.ts`

- [ ] **Step 1: Criar `src/app/api/integracoes/ifood/cardapio/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { listarItensCatalogo } from '@/services/integrations/ifood/ifood-catalog.service'

function allowed(role?: string) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  try {
    const [itens, mappings, produtos] = await Promise.all([
      listarItensCatalogo(tenantId),
      prisma.iFoodItemMap.findMany({ where: { tenantId } }),
      prisma.product.findMany({
        where: { tenantId, active: true },
        select: { id: true, name: true, salePrice: true },
        orderBy: { name: 'asc' },
      }),
    ])
    const mappingMap = new Map(mappings.map((m) => [m.ifoodItemId, m.produtoId]))
    const result = itens.map((item) => ({ ...item, produtoId: mappingMap.get(item.id) ?? null }))
    return NextResponse.json({ itens: result, produtos })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const body = await req.json()
  const mappings: Array<{ ifoodItemId: string; ifoodItemNome: string; produtoId: string | null }> = body.mappings ?? []

  await Promise.all(
    mappings.map((m) =>
      prisma.iFoodItemMap.upsert({
        where: { tenantId_ifoodItemId: { tenantId, ifoodItemId: m.ifoodItemId } },
        create: { tenantId, ifoodItemId: m.ifoodItemId, ifoodItemNome: m.ifoodItemNome, produtoId: m.produtoId },
        update: { produtoId: m.produtoId, ifoodItemNome: m.ifoodItemNome },
      })
    )
  )
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Criar `src/app/api/integracoes/ifood/pausar-item/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { pausarItem } from '@/services/integrations/ifood/ifood-catalog.service'

function allowed(role?: string) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { ifoodItemId } = await req.json()
  if (!ifoodItemId) return NextResponse.json({ error: 'ifoodItemId obrigatório' }, { status: 400 })

  try {
    await pausarItem(session.user.tenantId, ifoodItemId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
```

- [ ] **Step 3: Criar `src/app/api/integracoes/ifood/reativar-item/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { reativarItem } from '@/services/integrations/ifood/ifood-catalog.service'

function allowed(role?: string) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { ifoodItemId } = await req.json()
  if (!ifoodItemId) return NextResponse.json({ error: 'ifoodItemId obrigatório' }, { status: 400 })

  try {
    await reativarItem(session.user.tenantId, ifoodItemId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
```

- [ ] **Step 4: Criar `src/app/api/relatorios/delivery/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const ALLOWED_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER'])

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !ALLOWED_ROLES.has(session.user.role ?? '')) {
    return unauthorizedResponse()
  }
  const tenantId = session.user.tenantId

  const startStr = req.nextUrl.searchParams.get('start')
  const endStr = req.nextUrl.searchParams.get('end')
  const start = startStr ? new Date(startStr) : new Date(new Date().setDate(1))
  const end = endStr ? new Date(endStr) : new Date()
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)

  const [pedidosIfood, pedidosTodos, webhookLogs] = await Promise.all([
    // Pedidos iFood no período
    prisma.pedido.findMany({
      where: {
        tenantId,
        origem: 'IFOOD',
        status: { not: 'CANCELADO' },
        criadoEm: { gte: start, lte: end },
      },
      include: {
        ifoodPedido: { select: { comissaoPercent: true, statusIfood: true } },
        itens: { include: { product: { select: { id: true, name: true } } } },
      },
    }),
    // Todos os pedidos para gráfico de canal
    prisma.pedido.groupBy({
      by: ['origem'],
      where: { tenantId, status: { not: 'CANCELADO' }, criadoEm: { gte: start, lte: end } },
      _count: { id: true },
      _sum: { total: true },
    }),
    // Últimos 20 webhooks
    prisma.iFoodWebhookLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { ifoodOrderId: true, status: true, erro: true, createdAt: true },
    }),
  ])

  const receitaBruta = pedidosIfood.reduce((s, p) => s + p.total, 0)
  const comissaoTotal = pedidosIfood.reduce((s, p) => {
    const pct = Number(p.ifoodPedido?.comissaoPercent ?? 0) / 100
    return s + p.total * pct
  }, 0)
  const rejeitados = pedidosIfood.filter((p) => p.ifoodPedido?.statusIfood === 'REJECTED').length
  const taxaRejeicao = pedidosIfood.length > 0 ? (rejeitados / pedidosIfood.length) * 100 : 0

  // Top 5 produtos via iFood
  const produtoMap = new Map<string, { name: string; qty: number; receita: number }>()
  for (const p of pedidosIfood) {
    for (const item of p.itens) {
      const key = item.productId
      const current = produtoMap.get(key) ?? { name: item.product.name, qty: 0, receita: 0 }
      produtoMap.set(key, {
        name: item.product.name,
        qty: current.qty + item.quantidade,
        receita: current.receita + item.precoUnitario * item.quantidade,
      })
    }
  }
  const top5 = [...produtoMap.values()].sort((a, b) => b.receita - a.receita).slice(0, 5)

  return NextResponse.json({
    metricas: {
      totalPedidos: pedidosIfood.length,
      receitaBruta,
      comissao: comissaoTotal,
      receitaLiquida: receitaBruta - comissaoTotal,
      ticketMedio: pedidosIfood.length > 0 ? receitaBruta / pedidosIfood.length : 0,
      taxaRejeicao,
    },
    canalDistribuicao: pedidosTodos,
    top5Produtos: top5,
    webhookLogs,
  })
}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/integracoes/ifood/ src/app/api/relatorios/delivery/
git commit -m "feat(ifood): add cardapio, pausar-item, reativar-item routes and delivery report API"
```

---

## Task 10: Página de Configuração iFood (Stepper)

**Files:**
- Create: `src/app/(dashboard)/configuracoes/integracoes/ifood/page.tsx`

- [ ] **Step 1: Criar `src/app/(dashboard)/configuracoes/integracoes/ifood/page.tsx`**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, ExternalLink, Loader2 } from 'lucide-react'

type Status = 'CONECTADO' | 'DESCONECTADO' | 'ERRO'

type IntegrationInfo = {
  status: Status
  merchantId?: string
  ultimaSincronizacao?: string
  pedidosHoje?: number
}

type Loja = { id: string; name: string; type?: string }

const STEPS = [
  'Portal iFood',
  'Credenciais',
  'Conectar',
  'Selecionar Loja',
  'Confirmação',
]

export default function IFoodConfigPage() {
  const [step, setStep] = useState(0)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [lojas, setLojas] = useState<Loja[]>([])
  const [selectedLoja, setSelectedLoja] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState<IntegrationInfo | null>(null)
  const [disconnectModal, setDisconnectModal] = useState(false)

  useEffect(() => {
    fetch('/api/integracoes/ifood/connect')
      .then((r) => r.json())
      .then((d) => {
        if (d.status === 'CONECTADO') setInfo(d)
      })
      .catch(() => {})
  }, [])

  async function handleConnect() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/integracoes/ifood/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, clientSecret }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Erro ao conectar')
      }
      // Buscar lojas após autenticação
      const lojasRes = await fetch('/api/integracoes/ifood/lojas')
      const lojasData = await lojasRes.json()
      const lista: Loja[] = Array.isArray(lojasData) ? lojasData : (lojasData.merchants ?? [])
      setLojas(lista)
      setStep(3)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    setLoading(true)
    try {
      await fetch('/api/integracoes/ifood/disconnect', { method: 'POST' })
      setInfo(null)
      setDisconnectModal(false)
      setStep(0)
    } catch { /* noop */ } finally {
      setLoading(false)
    }
  }

  const statusBadge = (s: Status) => {
    const map = {
      CONECTADO:     { color: '#2a9d6f', bg: '#0d2b1f', label: 'Conectado',     icon: <CheckCircle size={14} /> },
      DESCONECTADO:  { color: '#6b7280', bg: '#1a1a1a', label: 'Desconectado',  icon: <XCircle size={14} /> },
      ERRO:          { color: '#e05252', bg: '#1f0a0a', label: 'Erro',           icon: <AlertCircle size={14} /> },
    }
    const c = map[s]
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: c.color, background: c.bg, border: `1px solid ${c.color}` }}>
        {c.icon} {c.label}
      </span>
    )
  }

  // ── Card de status (quando já conectado) ──
  if (info?.status === 'CONECTADO') {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 4 }}>Integração iFood</h1>
        <p style={{ fontSize: 13, color: 'var(--tf-txt3)', marginBottom: 28 }}>Sua conta iFood está conectada ao The Finance.</p>

        <div style={{ padding: '20px 24px', borderRadius: 12, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--tf-txt)' }}>Status da integração</span>
            {statusBadge(info.status)}
          </div>
          {[
            { label: 'Merchant ID', value: info.merchantId ?? '—' },
            { label: 'Última sincronização', value: info.ultimaSincronizacao ? new Date(info.ultimaSincronizacao).toLocaleString('pt-BR') : 'Nunca' },
            { label: 'Pedidos hoje', value: String(info.pedidosHoje ?? 0) },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--tf-border)' }}>
              <span style={{ fontSize: 13, color: 'var(--tf-txt2)' }}>{label}</span>
              <span style={{ fontSize: 13, color: 'var(--tf-txt)', fontWeight: 500 }}>{value}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => setDisconnectModal(true)}
          style={{ fontSize: 13, color: 'var(--tf-red)', background: 'var(--tf-red-bg)', border: '1px solid var(--tf-red-bd)', borderRadius: 8, padding: '8px 18px', cursor: 'pointer' }}
        >
          Desconectar iFood
        </button>

        {disconnectModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 12, padding: 28, maxWidth: 380, width: '100%' }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 10 }}>Desconectar iFood?</p>
              <p style={{ fontSize: 13, color: 'var(--tf-txt2)', marginBottom: 24 }}>Os pedidos já recebidos não serão afetados. Você poderá reconectar a qualquer momento.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDisconnectModal(false)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt2)', cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button onClick={handleDisconnect} disabled={loading} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: 'var(--tf-red)', color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                  {loading ? 'Aguarde...' : 'Desconectar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Stepper ──
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: 32 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 4 }}>Conectar ao iFood</h1>
      <p style={{ fontSize: 13, color: 'var(--tf-txt3)', marginBottom: 28 }}>Siga os passos para integrar seu cardápio e receber pedidos do iFood.</p>

      {/* Indicador de passos */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 32 }}>
        {STEPS.map((label, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700,
              background: i < step ? 'var(--tf-primary)' : i === step ? 'var(--tf-primary)' : 'var(--tf-surface2)',
              color: i <= step ? '#fff' : 'var(--tf-txt3)',
              border: i === step ? '2px solid var(--tf-primary)' : '2px solid transparent',
            }}>
              {i < step ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: 10, color: i === step ? 'var(--tf-primary)' : 'var(--tf-txt3)', marginTop: 4, textAlign: 'center' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Conteúdo do passo */}
      <div style={{ padding: '24px', borderRadius: 12, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>

        {step === 0 && (
          <>
            <p style={{ fontSize: 14, color: 'var(--tf-txt)', fontWeight: 600, marginBottom: 8 }}>Passo 1: Acesse o Portal iFood Parceiros</p>
            <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7, marginBottom: 16 }}>
              Para integrar, você precisa criar uma credencial de API no Portal iFood. Acesse o link abaixo, faça login com sua conta de restaurante e crie um novo aplicativo para obter o <strong>Client ID</strong> e o <strong>Client Secret</strong>.
            </p>
            <a
              href="https://portal.ifood.com.br/apps"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--tf-primary)', fontWeight: 600 }}
            >
              Abrir Portal iFood <ExternalLink size={13} />
            </a>
            <div style={{ marginTop: 24 }}>
              <button onClick={() => setStep(1)} style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: 'var(--tf-primary)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                Já tenho as credenciais →
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p style={{ fontSize: 14, color: 'var(--tf-txt)', fontWeight: 600, marginBottom: 16 }}>Passo 2: Informe as credenciais</p>
            {[
              { label: 'Client ID', value: clientId, set: setClientId, placeholder: 'Cole o Client ID aqui' },
              { label: 'Client Secret', value: clientSecret, set: setClientSecret, placeholder: 'Cole o Client Secret aqui', type: 'password' },
            ].map(({ label, value, set, placeholder, type }) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tf-txt2)', marginBottom: 5 }}>{label}</label>
                <input
                  type={type ?? 'text'}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder={placeholder}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'var(--tf-surface2)', color: 'var(--tf-txt)', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setStep(0)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt2)', cursor: 'pointer' }}>
                Voltar
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={!clientId || !clientSecret}
                style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: 'var(--tf-primary)', color: '#fff', fontWeight: 600, cursor: (!clientId || !clientSecret) ? 'not-allowed' : 'pointer', opacity: (!clientId || !clientSecret) ? 0.5 : 1 }}
              >
                Continuar →
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p style={{ fontSize: 14, color: 'var(--tf-txt)', fontWeight: 600, marginBottom: 8 }}>Passo 3: Conectar ao iFood</p>
            <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7, marginBottom: 20 }}>
              Ao clicar em <strong>Conectar</strong>, o sistema irá autenticar com o iFood usando suas credenciais e listar as lojas disponíveis.
            </p>
            {error && <p style={{ fontSize: 13, color: 'var(--tf-red)', marginBottom: 14 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt2)', cursor: 'pointer' }}>
                Voltar
              </button>
              <button
                onClick={handleConnect}
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 24px', borderRadius: 8, border: 'none', background: 'var(--tf-primary)', color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
              >
                {loading && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
                {loading ? 'Conectando...' : 'Conectar'}
              </button>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </>
        )}

        {step === 3 && (
          <>
            <p style={{ fontSize: 14, color: 'var(--tf-txt)', fontWeight: 600, marginBottom: 16 }}>Passo 4: Selecione a loja</p>
            {lojas.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--tf-txt3)' }}>Nenhuma loja encontrada nesta conta.</p>
            ) : (
              <select
                value={selectedLoja}
                onChange={(e) => setSelectedLoja(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'var(--tf-surface2)', color: 'var(--tf-txt)', fontSize: 13 }}
              >
                <option value="">Selecione uma loja...</option>
                {lojas.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                onClick={() => setStep(4)}
                disabled={!selectedLoja}
                style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: 'var(--tf-primary)', color: '#fff', fontWeight: 600, cursor: !selectedLoja ? 'not-allowed' : 'pointer', opacity: !selectedLoja ? 0.5 : 1 }}
              >
                Confirmar →
              </button>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <CheckCircle size={48} style={{ color: '#2a9d6f', marginBottom: 12 }} />
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 6 }}>iFood conectado com sucesso!</p>
              <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7 }}>
                Seu restaurante está integrado ao iFood. Os pedidos chegam automaticamente no KDS da cozinha. Agora configure o mapeamento do cardápio.
              </p>
              <a
                href="/configuracoes/integracoes/ifood/cardapio"
                style={{ display: 'inline-block', marginTop: 20, padding: '9px 24px', borderRadius: 8, background: 'var(--tf-primary)', color: '#fff', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}
              >
                Mapear Cardápio →
              </a>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/'(dashboard)'/configuracoes/integracoes/ifood/page.tsx
git commit -m "feat(ifood): add iFood configuration stepper page"
```

---

## Task 11: Página de Mapeamento de Cardápio

**Files:**
- Create: `src/app/(dashboard)/configuracoes/integracoes/ifood/cardapio/page.tsx`

- [ ] **Step 1: Criar `src/app/(dashboard)/configuracoes/integracoes/ifood/cardapio/page.tsx`**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2 } from 'lucide-react'

type IFoodItemRow = {
  id: string
  name: string
  price: number
  categoryName?: string
  available: boolean
  produtoId: string | null
}

type Produto = { id: string; name: string; salePrice: number }

export default function IFoodCardapioPage() {
  const [itens, setItens] = useState<IFoodItemRow[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [mapeamentos, setMapeamentos] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/integracoes/ifood/cardapio')
      .then((r) => r.json())
      .then((d) => {
        const itemList: IFoodItemRow[] = d.itens ?? []
        setItens(itemList)
        setProdutos(d.produtos ?? [])
        const initial: Record<string, string | null> = {}
        for (const item of itemList) initial[item.id] = item.produtoId
        setMapeamentos(initial)
      })
      .catch(() => setError('Erro ao carregar cardápio'))
      .finally(() => setLoading(false))
  }, [])

  async function salvar() {
    setSaving(true)
    setSaved(false)
    try {
      const mappings = itens.map((item) => ({
        ifoodItemId: item.id,
        ifoodItemNome: item.name,
        produtoId: mapeamentos[item.id] ?? null,
      }))
      const res = await fetch('/api/integracoes/ifood/cardapio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--tf-txt2)' }}>Carregando cardápio...</div>

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 4 }}>Mapeamento de Cardápio — iFood</h1>
          <p style={{ fontSize: 13, color: 'var(--tf-txt3)' }}>Vincule cada item do iFood ao produto correspondente no The Finance.</p>
        </div>
        <button
          onClick={salvar}
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--tf-primary)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Save size={14} />}
          {saving ? 'Salvando...' : saved ? 'Salvo ✓' : 'Salvar mapeamentos'}
        </button>
      </div>

      {error && <p style={{ fontSize: 13, color: 'var(--tf-red)', marginBottom: 16 }}>{error}</p>}

      <div style={{ border: '1px solid var(--tf-border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--tf-surface)', borderBottom: '1px solid var(--tf-border)' }}>
              {['Item iFood', 'Categoria', 'Preço iFood', 'Produto THE FINANCE', 'Status'].map((h) => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--tf-txt3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {itens.map((item, i) => {
              const mapeado = !!mapeamentos[item.id]
              return (
                <tr key={item.id} style={{ borderBottom: i < itens.length - 1 ? '1px solid var(--tf-border)' : 'none', background: i % 2 === 0 ? 'transparent' : 'var(--tf-surface)' }}>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--tf-txt)', fontWeight: 500 }}>{item.name}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--tf-txt3)' }}>{item.categoryName ?? '—'}</td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--tf-txt2)' }}>
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                  </td>
                  <td style={{ padding: '8px 14px' }}>
                    <select
                      value={mapeamentos[item.id] ?? ''}
                      onChange={(e) => setMapeamentos((prev) => ({ ...prev, [item.id]: e.target.value || null }))}
                      style={{ width: '100%', maxWidth: 240, padding: '6px 10px', borderRadius: 7, border: '1px solid var(--tf-border)', background: 'var(--tf-surface2)', color: 'var(--tf-txt)', fontSize: 12 }}
                    >
                      <option value="">Selecionar produto...</option>
                      {produtos.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    {mapeado ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#2a9d6f', background: '#0d2b1f', border: '1px solid #2a9d6f', padding: '2px 8px', borderRadius: 10 }}>Mapeado</span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#e05252', background: '#1f0a0a', border: '1px solid #e05252', padding: '2px 8px', borderRadius: 10 }}>Não mapeado</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/'(dashboard)'/configuracoes/integracoes/ifood/cardapio/
git commit -m "feat(ifood): add catalog mapping page"
```

---

## Task 12: Página de Relatório Delivery

**Files:**
- Create: `src/app/(dashboard)/relatorios/delivery/page.tsx`

- [ ] **Step 1: Criar `src/app/(dashboard)/relatorios/delivery/page.tsx`**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const ALLOWED_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER'])
const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtPct = (v: number) => `${v.toFixed(1)}%`

type Metricas = {
  totalPedidos: number
  receitaBruta: number
  comissao: number
  receitaLiquida: number
  ticketMedio: number
  taxaRejeicao: number
}

type CanalItem = { origem: string; _count: { id: number }; _sum: { total: number | null } }
type Produto5 = { name: string; qty: number; receita: number }
type WebhookLog = { ifoodOrderId: string; status: string; erro?: string | null; createdAt: string }

type ReportData = {
  metricas: Metricas
  canalDistribuicao: CanalItem[]
  top5Produtos: Produto5[]
  webhookLogs: WebhookLog[]
}

const CANAL_COLORS: Record<string, string> = { IFOOD: '#f97316', MESA: '#2a9d6f', BALCAO: '#6366f1' }
const CANAL_LABELS: Record<string, string> = { IFOOD: 'iFood', MESA: 'Mesa', BALCAO: 'Balcão' }

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 140, padding: '16px 18px', borderRadius: 10, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--tf-txt3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--tf-txt)' }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--tf-txt3)', marginTop: 2 }}>{sub}</p>}
    </div>
  )
}

export default function DeliveryReportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [start, setStart] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]
  })
  const [end, setEnd] = useState(() => new Date().toISOString().split('T')[0])
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user?.role || !ALLOWED_ROLES.has(session.user.role)) router.replace('/dashboard')
  }, [session, status, router])

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/relatorios/delivery?start=${start}&end=${end}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [start, end])

  useEffect(() => { load() }, [load])

  const pieData = (data?.canalDistribuicao ?? []).map((c) => ({
    name: CANAL_LABELS[c.origem] ?? c.origem,
    value: c._count.id,
    color: CANAL_COLORS[c.origem] ?? '#888',
  }))

  return (
    <div style={{ padding: '24px 32px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 4 }}>Relatório de Delivery</h1>
      <p style={{ fontSize: 13, color: 'var(--tf-txt3)', marginBottom: 24 }}>Desempenho dos pedidos recebidos via iFood.</p>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 28, flexWrap: 'wrap' }}>
        {[{ label: 'Início', value: start, set: setStart }, { label: 'Fim', value: end, set: setEnd }].map(({ label, value, set }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--tf-txt2)', fontWeight: 600 }}>{label}</label>
            <input type="date" value={value} onChange={(e) => set(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)', color: 'var(--tf-txt)', fontSize: 13 }} />
          </div>
        ))}
        <button onClick={load} style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: 'var(--tf-primary)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          {loading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>

      {!data ? (
        <p style={{ color: 'var(--tf-txt3)', fontSize: 13 }}>{loading ? 'Carregando...' : 'Nenhum dado.'}</p>
      ) : (
        <>
          {/* Cards de métricas */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
            <MetricCard label="Total pedidos" value={String(data.metricas.totalPedidos)} />
            <MetricCard label="Receita bruta" value={fmt(data.metricas.receitaBruta)} />
            <MetricCard label="Comissão iFood" value={fmt(data.metricas.comissao)} />
            <MetricCard label="Receita líquida" value={fmt(data.metricas.receitaLiquida)} />
            <MetricCard label="Ticket médio" value={fmt(data.metricas.ticketMedio)} />
            <MetricCard label="Taxa rejeição" value={fmtPct(data.metricas.taxaRejeicao)} />
          </div>

          {/* Gráfico pizza + Top 5 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
            <div style={{ padding: '18px 20px', borderRadius: 10, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 14 }}>Vendas por Canal</p>
              {pieData.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>Sem dados no período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                      {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${v} pedidos`, '']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={{ padding: '18px 20px', borderRadius: 10, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 14 }}>Top 5 Produtos — iFood</p>
              {data.top5Produtos.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>Sem pedidos iFood no período.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Produto', 'Qtd', 'Receita'].map((h) => (
                        <th key={h} style={{ padding: '6px 0', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--tf-txt3)', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.top5Produtos.map((p, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--tf-border)' }}>
                        <td style={{ padding: '8px 0', fontSize: 12, color: 'var(--tf-txt)' }}>{p.name}</td>
                        <td style={{ padding: '8px 0', fontSize: 12, color: 'var(--tf-txt2)' }}>{p.qty}</td>
                        <td style={{ padding: '8px 0', fontSize: 12, color: 'var(--tf-txt2)' }}>{fmt(p.receita)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Log de webhooks */}
          <div style={{ padding: '18px 20px', borderRadius: 10, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 14 }}>Log de Webhooks Recentes</p>
            {data.webhookLogs.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>Nenhum webhook recebido.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Pedido iFood', 'Status', 'Horário'].map((h) => (
                      <th key={h} style={{ padding: '6px 0', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--tf-txt3)', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.webhookLogs.map((log) => (
                    <tr key={log.ifoodOrderId + log.createdAt} style={{ borderTop: '1px solid var(--tf-border)' }}>
                      <td style={{ padding: '8px 0', fontSize: 12, color: 'var(--tf-txt)', fontFamily: 'monospace' }}>{log.ifoodOrderId.slice(0, 16)}...</td>
                      <td style={{ padding: '8px 0' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: log.status === 'PROCESSADO' ? '#2a9d6f' : '#e05252', background: log.status === 'PROCESSADO' ? '#0d2b1f' : '#1f0a0a', border: `1px solid ${log.status === 'PROCESSADO' ? '#2a9d6f' : '#e05252'}`, padding: '2px 7px', borderRadius: 9 }}>
                          {log.status}
                        </span>
                        {log.erro && <span style={{ fontSize: 11, color: 'var(--tf-txt3)', marginLeft: 8 }}>{log.erro}</span>}
                      </td>
                      <td style={{ padding: '8px 0', fontSize: 12, color: 'var(--tf-txt3)' }}>{new Date(log.createdAt).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/'(dashboard)'/relatorios/delivery/
git commit -m "feat(ifood): add delivery report page with pie chart, metrics and webhook log"
```

---

## Task 13: Modificações no KDS (`cozinha/page.tsx`)

**Files:**
- Modify: `src/app/[slug]/cozinha/page.tsx`

- [ ] **Step 1: Atualizar tipos no topo do arquivo**

Localizar as linhas de tipo em `src/app/[slug]/cozinha/page.tsx` (próximo à linha 34):

```typescript
// ANTES:
type PedidoItem  = { id: string; quantidade: number; product: { name: string }; observacao: string | null }
type Pedido      = { id: string; status: string; criadoEm: string; itens: PedidoItem[]; mesa: { numero: number } | null; garcom: { name: string } | null }
```

```typescript
// DEPOIS:
type PedidoItem  = { id: string; quantidade: number; product: { name: string }; observacao: string | null }
type IFoodMeta   = { enderecoEntrega: Record<string, unknown>; ifoodReference: string | null }
type Pedido      = { id: string; status: string; criadoEm: string; itens: PedidoItem[]; mesa: { numero: number } | null; garcom: { name: string } | null; origem?: string; ifoodPedido?: IFoodMeta | null }
```

- [ ] **Step 2: Adicionar estado para modal de rejeição**

Localizar o bloco de estados no componente (próximo à linha 63, após `const [updatingId, setUpdatingId] = useState...`):

```typescript
// Adicionar:
const [rejectModal, setRejectModal] = useState<{ pedidoId: string; ifoodOrderId?: string } | null>(null)
const [rejectMotivo, setRejectMotivo] = useState('PedidoUnavailable')
const [rejecting, setRejecting] = useState(false)
```

- [ ] **Step 3: Adicionar função `rejectIFoodOrder` após a função `updateStatus`**

Após a função `updateStatus` (próximo à linha 103):

```typescript
async function rejectIFoodOrder() {
  if (!rejectModal) return
  setRejecting(true)
  await fetch(`/api/pedidos/${rejectModal.pedidoId}?slug=${slug}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'CANCELADO' }),
  })
  // Rejeitar no iFood via API
  if (rejectModal.ifoodOrderId) {
    await fetch('/api/integracoes/ifood/pedidos/rejeitar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ifoodOrderId: rejectModal.ifoodOrderId, motivo: rejectMotivo }),
    }).catch(() => {})
  }
  setRejecting(false)
  setRejectModal(null)
  await loadPedidos()
}
```

- [ ] **Step 4: Atualizar a query de pedidos para incluir `ifoodPedido`**

Localizar `loadPedidos` (próximo à linha 71):

```typescript
// ANTES:
const r = await fetch(`/api/pedidos?slug=${slug}&status=ABERTO,EM_PREPARO,PRONTO`)

// DEPOIS:
const r = await fetch(`/api/pedidos?slug=${slug}&status=ABERTO,EM_PREPARO,PRONTO&includeIfood=1`)
```

Em `src/app/api/pedidos/route.ts`, localizar o bloco `include` do `prisma.pedido.findMany` e adicionar `ifoodPedido: true`:

```typescript
// ANTES:
include: {
  itens: { include: { product: { select: { id: true, name: true, salePrice: true } } } },
  mesa: { select: { id: true, numero: true, identificacao: true } },
  garcom: { select: { id: true, name: true } },
  pagamentos: true,
},

// DEPOIS:
include: {
  itens: { include: { product: { select: { id: true, name: true, salePrice: true } } } },
  mesa: { select: { id: true, numero: true, identificacao: true } },
  garcom: { select: { id: true, name: true } },
  pagamentos: true,
  ifoodPedido: { select: { enderecoEntrega: true, ifoodReference: true, ifoodOrderId: true } },
},
```

- [ ] **Step 5: Atualizar o card do pedido no KDS**

Localizar o bloco de renderização do card (próximo à linha 270, dentro do `pedidos.map`):

Substituir o bloco do header do card (o `div` com `padding: '10px 14px'` que tem `Mesa #`):

```tsx
// ANTES:
<div style={{ padding: '10px 14px', background: C.surface2, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
  <div>
    <span style={{ fontWeight: 700, fontSize: 16, color: C.txt }}>
      Mesa #{p.mesa?.numero ?? '?'}
    </span>
    {p.garcom && <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>{p.garcom.name}</span>}
  </div>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ fontSize: 11, color: C.muted }}>{timeAgo(p.criadoEm)}</span>
    <span style={{ fontSize: 11, fontWeight: 600, color: statusColor, background: statusColor + '22', padding: '2px 6px', borderRadius: 4 }}>
      {statusLabel}
    </span>
  </div>
</div>

// DEPOIS:
<div style={{ padding: '10px 14px', background: C.surface2, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    {p.origem === 'IFOOD' && (
      <span style={{ fontSize: 10, fontWeight: 800, color: '#f97316', background: '#1c0e00', border: '1px solid #f97316', padding: '2px 7px', borderRadius: 10 }}>
        iFood
      </span>
    )}
    <span style={{ fontWeight: 700, fontSize: 16, color: C.txt }}>
      {p.origem === 'IFOOD' ? 'Delivery' : `Mesa #${p.mesa?.numero ?? '?'}`}
    </span>
    {p.garcom && <span style={{ fontSize: 12, color: C.muted }}>{p.garcom.name}</span>}
  </div>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    {(() => {
      const mins = Math.floor((Date.now() - new Date(p.criadoEm).getTime()) / 60000)
      const urgente = mins > 8
      return (
        <span style={{ fontSize: 11, color: urgente ? C.red : C.muted, fontWeight: urgente ? 700 : 400 }}>
          {timeAgo(p.criadoEm)}{urgente ? ' ⚠' : ''}
        </span>
      )
    })()}
    <span style={{ fontSize: 11, fontWeight: 600, color: statusColor, background: statusColor + '22', padding: '2px 6px', borderRadius: 4 }}>
      {statusLabel}
    </span>
  </div>
</div>
```

Adicionar rodapé do card para pedidos iFood (após o bloco de itens `p.itens.map`, antes do bloco de botões):

```tsx
{p.origem === 'IFOOD' && p.ifoodPedido && (
  <div style={{ padding: '6px 14px', background: '#120a00', borderTop: `1px solid #2a1a00` }}>
    {p.ifoodPedido.ifoodReference && (
      <p style={{ margin: 0, fontSize: 11, color: '#f97316' }}>Ref: {p.ifoodPedido.ifoodReference}</p>
    )}
    {p.ifoodPedido.enderecoEntrega && typeof p.ifoodPedido.enderecoEntrega === 'object' && (
      <p style={{ margin: 0, fontSize: 11, color: C.muted, marginTop: 2 }}>
        {[
          (p.ifoodPedido.enderecoEntrega as Record<string, unknown>).streetName,
          (p.ifoodPedido.enderecoEntrega as Record<string, unknown>).streetNumber,
          (p.ifoodPedido.enderecoEntrega as Record<string, unknown>).neighborhood,
        ].filter(Boolean).join(', ')}
      </p>
    )}
  </div>
)}
```

Adicionar botão "Rejeitar" para pedidos iFood no bloco de botões (após o botão "Iniciar"):

```tsx
{p.origem === 'IFOOD' && isAberto && (
  <button
    onClick={() => setRejectModal({ pedidoId: p.id, ifoodOrderId: (p.ifoodPedido as (IFoodMeta & { ifoodOrderId?: string }) | null | undefined)?.ifoodOrderId })}
    style={{ padding: '8px 12px', background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 8, color: C.red, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
  >
    Rejeitar
  </button>
)}
```

- [ ] **Step 6: Adicionar modal de rejeição antes do `return` final**

Dentro do JSX do dashboard (antes do fechamento `</div>` principal), adicionar:

```tsx
{rejectModal && (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, maxWidth: 360, width: '100%' }}>
      <p style={{ fontSize: 15, fontWeight: 600, color: C.txt, marginBottom: 12 }}>Rejeitar pedido iFood</p>
      <label style={{ display: 'block', fontSize: 12, color: C.txt2, marginBottom: 6 }}>Motivo</label>
      <select
        value={rejectMotivo}
        onChange={(e) => setRejectMotivo(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.txt, fontSize: 13, marginBottom: 20 }}
      >
        <option value="PedidoUnavailable">Item indisponível</option>
        <option value="OperationProblem">Problema operacional</option>
        <option value="RestauranteClosed">Restaurante fechado</option>
      </select>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => setRejectModal(null)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.txt2, cursor: 'pointer' }}>
          Cancelar
        </button>
        <button onClick={rejectIFoodOrder} disabled={rejecting} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: C.red, color: '#fff', fontWeight: 600, cursor: rejecting ? 'not-allowed' : 'pointer', opacity: rejecting ? 0.6 : 1 }}>
          {rejecting ? '...' : 'Rejeitar'}
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 7: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 8: Commit**

```bash
git add src/app/'[slug]'/cozinha/page.tsx src/app/api/pedidos/route.ts
git commit -m "feat(kds): add iFood badge, delivery footer, 8min timer alert, reject modal"
```

---

## Task 14: Página de Ajuda — Seção iFood

**Files:**
- Modify: `src/app/(dashboard)/ajuda/page.tsx`

- [ ] **Step 1: Adicionar `'ifood'` ao tipo `SectionId`**

Localizar (linha 9):
```typescript
// ANTES:
type SectionId =
  | 'intro' | 'primeiros-passos' | 'garcom' | 'cozinha' | 'caixa'
  | 'insumos' | 'produtos' | 'inventario' | 'relatorios' | 'usuarios'
  | 'entrada-inteligente' | 'faq'

// DEPOIS:
type SectionId =
  | 'intro' | 'primeiros-passos' | 'garcom' | 'cozinha' | 'caixa'
  | 'insumos' | 'produtos' | 'inventario' | 'relatorios' | 'usuarios'
  | 'entrada-inteligente' | 'ifood' | 'faq'
```

- [ ] **Step 2: Adicionar import do ícone e entrada no array `SECTIONS`**

No topo do arquivo, adicionar `Truck` ao import do `lucide-react`:
```typescript
// ANTES:
import {
  BookOpen, Rocket, UtensilsCrossed, ChefHat, CreditCard,
  BarChart3, Users, HelpCircle, ShoppingBasket, ClipboardList, Sparkles,
} from 'lucide-react'

// DEPOIS:
import {
  BookOpen, Rocket, UtensilsCrossed, ChefHat, CreditCard,
  BarChart3, Users, HelpCircle, ShoppingBasket, ClipboardList, Sparkles, Truck,
} from 'lucide-react'
```

No array `SECTIONS`, adicionar antes de `{ id: 'faq' ... }`:
```typescript
{ id: 'ifood',  label: 'Integração iFood', icon: Truck },
```

- [ ] **Step 3: Criar o componente `IFood()` antes de `Faq()`**

Adicionar a função antes da função `Faq()` existente:

```tsx
function IFoodHelp() {
  return (
    <>
      <SectionTitle sub="Como conectar e gerenciar pedidos recebidos pelo iFood">Integração iFood</SectionTitle>
      <Tip type="info">
        Acesse a configuração em <strong>Configurações → Integrações → iFood</strong>. Você precisa de credenciais de API geradas no Portal iFood Parceiros.
      </Tip>

      <Sub>Conectar ao iFood</Sub>
      <Step n={1} title="Acesse o Portal iFood Parceiros">
        Navegue até <strong>portal.ifood.com.br/apps</strong>, faça login com sua conta de restaurante e crie um novo aplicativo. Copie o <strong>Client ID</strong> e o <strong>Client Secret</strong> gerados.
      </Step>
      <Step n={2} title="Informe as credenciais no The Finance">
        Em <strong>Configurações → Integrações → iFood</strong>, siga o assistente de 5 passos: cole o Client ID e Client Secret, clique em <strong>Conectar</strong> e selecione a loja correta.
      </Step>
      <Step n={3} title="Confirme a integração">
        Após conectar, um card de status exibe <Tag color="green">Conectado</Tag> com o Merchant ID e a última sincronização. A partir daí, pedidos do iFood chegam automaticamente na cozinha.
      </Step>

      <Sub>Recebimento de Pedidos</Sub>
      <Step n={4} title="Pedidos aparecem no KDS com badge laranja 'iFood'">
        Assim que um cliente faz um pedido no iFood, ele aparece em tempo real na tela da cozinha. O card exibe o endereço de entrega no rodapé e a referência do pedido.
      </Step>
      <Step n={5} title="Confirmação automática">
        O sistema confirma automaticamente o pedido no iFood após 30 segundos, salvo se você rejeitar manualmente antes disso.
      </Step>
      <Step n={6} title="Rejeitar um pedido">
        No card do pedido iFood no KDS, clique em <strong>Rejeitar</strong>, selecione o motivo (Item indisponível, Problema operacional ou Restaurante fechado) e confirme.
      </Step>

      <Tip type="warning">
        O cronômetro do pedido fica vermelho após 8 minutos — sinal de que o tempo de preparo está além do recomendado pelo iFood.
      </Tip>

      <Sub>Mapeamento de Cardápio</Sub>
      <Step n={7} title="Acesse Configurações → Integrações → iFood → Cardápio">
        A tela lista todos os itens do seu cardápio no iFood. Para cada item, selecione o produto correspondente no The Finance. Itens sem vínculo aparecem com badge vermelho <Tag color="red">Não mapeado</Tag> — eles chegam no KDS mas não descontam estoque automaticamente.
      </Step>
      <Step n={8} title="Salve os mapeamentos">
        Clique em <strong>Salvar mapeamentos</strong>. A partir daí, ao receber um pedido iFood, o estoque dos insumos é descontado automaticamente pela ficha técnica de cada produto vinculado.
      </Step>

      <Sub>Sincronização de Disponibilidade</Sub>
      <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7, marginBottom: 16 }}>
        A cada 30 minutos, o sistema verifica se os insumos dos produtos mapeados têm estoque suficiente. Se um insumo zerar, o item correspondente é <strong>pausado automaticamente no iFood</strong> — evitando pedidos de itens que você não consegue preparar. Quando o estoque é reposto, o item é reativado.
      </p>
      <Tip>Você pode pausar ou reativar itens manualmente na tela de mapeamento de cardápio, sem precisar aguardar a sincronização automática.</Tip>

      <Sub>Relatório de Delivery</Sub>
      <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7, marginBottom: 16 }}>
        Em <strong>Relatórios → Delivery</strong> você encontra: total de pedidos, receita bruta, comissão iFood, receita líquida, ticket médio, taxa de rejeição, distribuição de vendas por canal (iFood vs. presencial) e os 5 produtos mais pedidos pelo delivery.
      </p>

      <Sub>Desconectar</Sub>
      <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7, marginBottom: 16 }}>
        Para desconectar, clique em <strong>Desconectar iFood</strong> no card de status e confirme. Os pedidos já recebidos continuam no histórico. Você pode reconectar a qualquer momento informando as credenciais novamente.
      </p>
      <Tip type="warning">Ao desconectar, a sincronização automática de disponibilidade é interrompida. Itens pausados no iFood não serão reativados automaticamente — faça isso manualmente no Portal iFood Parceiros.</Tip>
    </>
  )
}
```

- [ ] **Step 4: Adicionar ao mapa `CONTENT`**

Localizar o mapa `CONTENT` e adicionar:
```typescript
// ANTES:
const CONTENT: Record<SectionId, React.ReactNode> = {
  intro:                  <Intro />,
  ...
  'entrada-inteligente':  <EntradaInteligente />,
  relatorios:             <Relatorios />,
  usuarios:               <Usuarios />,
  faq:                    <Faq />,
}

// DEPOIS (adicionar linha antes de faq):
  ifood:                  <IFoodHelp />,
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/app/'(dashboard)'/ajuda/page.tsx
git commit -m "feat(ajuda): add iFood integration help section"
```

---

## Self-Review — Cobertura da Spec

| Requisito da Spec | Task que implementa |
|---|---|
| Schema: `mesaId?`/`garcomId?`, `OrigemPedido`, 4 novos modelos | Task 1 |
| `src/lib/crypto.ts` AES-256-GCM | Task 2 |
| `ifood-auth.service.ts` | Task 3 |
| `ifood-orders.service.ts` | Task 4 |
| `ifood-catalog.service.ts` | Task 5 |
| BullMQ workers (webhook, auto-confirm, catalog-sync cron) | Task 6 |
| API: connect/lojas/disconnect | Task 7 |
| API: webhook com HMAC-SHA256 | Task 8 |
| API: cardapio, pausar-item, reativar-item, delivery report | Task 9 |
| Página: stepper de configuração iFood | Task 10 |
| Página: mapeamento de cardápio | Task 11 |
| Página: relatório delivery | Task 12 |
| KDS: badge iFood, cronômetro, endereço, botão rejeitar | Task 13 |
| Ajuda: seção iFood | Task 14 |

**Nota de endpoint iFood:** Os endpoints do catalog service (`/catalog/v1.0/merchants/.../catalog-items`, `/unavailabilities`) devem ser validados contra a documentação oficial em https://developer.ifood.com.br antes do deploy, pois a Merchant API do iFood pode ter versões e paths diferentes do ambiente sandbox para produção.
