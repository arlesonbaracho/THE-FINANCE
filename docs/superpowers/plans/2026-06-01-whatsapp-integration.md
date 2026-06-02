# WhatsApp Integration (Agente 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar o Z-API ao THE FINANCE para envio de alertas críticos, resumo diário e notificações de pedido iFood via WhatsApp, com painel de configuração multi-tenant.

**Architecture:** Service `zapi.service.ts` lida com HTTP + rate limit Redis. Service `whatsapp-messages.service.ts` formata mensagens e roteia. Hooks via dynamic import em `createAlert()`, `incrementarUso()` e `processarWebhook()` para zero acoplamento em tempo de compilação. BullMQ worker para resumo diário (cron 23h) registrado em `server.ts`.

**Tech Stack:** Next.js 14 App Router · TypeScript · Prisma · BullMQ (já em `src/lib/bullmq.ts`) · IORedis (já instalado) · `src/lib/crypto.ts` (AES-256-GCM, já criado) · Z-API (fetch nativo)

---

## File Map

| Ação | Arquivo |
|---|---|
| Modify | `prisma/schema.prisma` |
| Create | `src/services/integrations/whatsapp/zapi.service.ts` |
| Create | `src/services/integrations/whatsapp/whatsapp-messages.service.ts` |
| Create | `src/jobs/whatsapp/whatsapp-daily-report.job.ts` |
| Create | `src/jobs/whatsapp/index.ts` |
| Modify | `server.ts` |
| Create | `src/app/api/integracoes/whatsapp/connect/route.ts` |
| Create | `src/app/api/integracoes/whatsapp/status/route.ts` |
| Create | `src/app/api/integracoes/whatsapp/disconnect/route.ts` |
| Create | `src/app/api/integracoes/whatsapp/test/route.ts` |
| Create | `src/app/api/integracoes/whatsapp/logs/route.ts` |
| Modify | `src/jobs/alerts/utils.ts` |
| Modify | `src/services/ai/ai-usage.service.ts` |
| Modify | `src/services/integrations/ifood/ifood-orders.service.ts` |
| Create | `src/app/(dashboard)/configuracoes/integracoes/whatsapp/page.tsx` |
| Modify | `src/components/layout/sidebar.tsx` |
| Modify | `src/app/(dashboard)/ajuda/page.tsx` |

---

## Task 1: Schema Prisma — Migração WhatsApp

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Ler o schema atual e aplicar mudanças**

Adicionar ao `model Tenant` (após a linha `ifoodItemMaps IFoodItemMap[]`):
```prisma
  whatsappIntegracao  WhatsAppIntegration?
```

Adicionar ao final do arquivo:
```prisma
// ── WhatsApp Integration ──────────────────────────────────────────────────────

enum WhatsAppStatus {
  CONECTADO
  DESCONECTADO
  ERRO
}

enum WhatsAppMsgTipo {
  ALERTA
  RESUMO_DIARIO
  PEDIDO_IFOOD
}

enum WhatsAppMsgStatus {
  ENVIADO
  FALHOU
}

model WhatsAppIntegration {
  id              String          @id @default(cuid())
  tenantId        String          @unique
  instanceId      String
  tokenEncrypted  String
  numeroConectado String?
  status          WhatsAppStatus
  ultimaConexao   DateTime?
  config          Json            @default("{}")
  tenant          Tenant          @relation(fields: [tenantId], references: [id])
  logs            WhatsAppLog[]

  @@index([tenantId])
}

model WhatsAppLog {
  id           String              @id @default(cuid())
  tenantId     String
  tipo         WhatsAppMsgTipo
  destinatario String
  mensagem     String
  status       WhatsAppMsgStatus
  erro         String?
  createdAt    DateTime            @default(now())
  integracao   WhatsAppIntegration @relation(fields: [tenantId], references: [tenantId])

  @@index([tenantId])
  @@index([tenantId, createdAt])
}
```

- [ ] **Step 2: Gerar e aplicar migration**

```bash
npx prisma migrate dev --name whatsapp_integration
```

Esperado: `Your database is now in sync with your schema.`

- [ ] **Step 3: Regenerar Prisma Client**

```bash
npx prisma generate
```

Esperado: `Generated Prisma Client` sem erros.

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add WhatsApp integration models"
```

---

## Task 2: Z-API Service

**Files:**
- Create: `src/services/integrations/whatsapp/zapi.service.ts`

> **Contexto:** `src/lib/crypto.ts` exporta `encrypt(texto)` e `decrypt(cifrado)`. `src/lib/bullmq.ts` exporta `redisConnection` (IORedis). Z-API endpoints: `GET /instances/{id}/token/{token}/status`, `GET /instances/{id}/token/{token}/qr-code`, `POST /instances/{id}/token/{token}/send-text`.

- [ ] **Step 1: Criar `src/services/integrations/whatsapp/zapi.service.ts`**

```typescript
import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/crypto'
import { redisConnection } from '@/lib/bullmq'

const BASE = process.env.ZAPI_BASE_URL ?? 'https://api.z-api.io'
const RATE_LIMIT = parseInt(process.env.WHATSAPP_RATE_LIMIT_PER_HOUR ?? '10', 10)

function zapiUrl(instanceId: string, token: string, path: string): string {
  return `${BASE}/instances/${instanceId}/token/${token}${path}`
}

function mascararNumero(numero: string): string {
  // "+5511987654321" → "+55 11 ****-4321"
  const digits = numero.replace(/\D/g, '')
  if (digits.length < 6) return numero
  return numero.slice(0, -8) + ' ****-' + digits.slice(-4)
}

export async function conectar(tenantId: string, instanceId: string, token: string): Promise<void> {
  // Validate credentials via Z-API status endpoint
  const res = await fetch(zapiUrl(instanceId, token, '/status'))
  if (!res.ok) {
    throw new Error(`Z-API credenciais inválidas: ${res.status}`)
  }

  await prisma.whatsAppIntegration.upsert({
    where: { tenantId },
    create: {
      tenantId,
      instanceId,
      tokenEncrypted: encrypt(token),
      status: 'DESCONECTADO',
      config: {},
    },
    update: {
      instanceId,
      tokenEncrypted: encrypt(token),
      status: 'DESCONECTADO',
    },
  })
}

export async function verificarStatus(tenantId: string): Promise<{ status: 'CONECTADO' | 'DESCONECTADO' | 'ERRO'; numeroConectado?: string }> {
  const integration = await prisma.whatsAppIntegration.findUniqueOrThrow({ where: { tenantId } })
  const token = decrypt(integration.tokenEncrypted)

  let zapiStatus: { connected?: boolean; phone?: string; error?: string }
  try {
    const res = await fetch(zapiUrl(integration.instanceId, token, '/status'))
    if (!res.ok) {
      await prisma.whatsAppIntegration.update({ where: { tenantId }, data: { status: 'ERRO' } })
      return { status: 'ERRO' }
    }
    zapiStatus = await res.json()
  } catch {
    await prisma.whatsAppIntegration.update({ where: { tenantId }, data: { status: 'ERRO' } })
    return { status: 'ERRO' }
  }

  const connected = zapiStatus?.connected === true
  const newStatus = connected ? 'CONECTADO' : 'DESCONECTADO'
  const numeroConectado = zapiStatus?.phone ?? undefined

  await prisma.whatsAppIntegration.update({
    where: { tenantId },
    data: {
      status: newStatus,
      numeroConectado: connected ? (numeroConectado ?? null) : null,
      ultimaConexao: connected ? new Date() : undefined,
    },
  })

  return { status: newStatus, numeroConectado }
}

export async function getQrCode(tenantId: string): Promise<string | null> {
  const integration = await prisma.whatsAppIntegration.findUnique({ where: { tenantId } })
  if (!integration) return null
  if (integration.status === 'CONECTADO') return null

  const token = decrypt(integration.tokenEncrypted)
  try {
    const res = await fetch(zapiUrl(integration.instanceId, token, '/qr-code'))
    if (!res.ok) return null
    const data = await res.json()
    // Z-API returns { value: "data:image/png;base64,..." } or { qrcode: "..." }
    return data.value ?? data.qrcode ?? null
  } catch {
    return null
  }
}

export async function desconectar(tenantId: string): Promise<void> {
  await prisma.whatsAppIntegration.update({
    where: { tenantId },
    data: {
      tokenEncrypted: '',
      numeroConectado: null,
      status: 'DESCONECTADO',
      ultimaConexao: null,
    },
  })
}

export async function enviarMensagem(
  tenantId: string,
  numero: string,
  mensagem: string,
  tipo: 'ALERTA' | 'RESUMO_DIARIO' | 'PEDIDO_IFOOD' = 'ALERTA'
): Promise<boolean> {
  // Rate limit via Redis: max RATE_LIMIT mensagens por hora por tenant
  const rateLimitKey = `wpp:ratelimit:${tenantId}`
  const count = await redisConnection.incr(rateLimitKey)
  if (count === 1) {
    await redisConnection.expire(rateLimitKey, 3600)
  }
  if (count > RATE_LIMIT) {
    console.warn(`[whatsapp] Rate limit atingido para tenant ${tenantId}`)
    return false
  }

  const integration = await prisma.whatsAppIntegration.findUnique({ where: { tenantId } })
  if (!integration || integration.status !== 'CONECTADO') return false

  const token = decrypt(integration.tokenEncrypted)
  let success = false
  let erro: string | undefined

  try {
    const res = await fetch(zapiUrl(integration.instanceId, token, '/send-text'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: numero, message: mensagem }),
    })
    success = res.ok
    if (!res.ok) {
      const txt = await res.text()
      erro = `Z-API ${res.status}: ${txt}`
    }
  } catch (err) {
    erro = (err as Error).message
  }

  await prisma.whatsAppLog.create({
    data: {
      tenantId,
      tipo,
      destinatario: mascararNumero(numero),
      mensagem,
      status: success ? 'ENVIADO' : 'FALHOU',
      erro: erro ?? null,
    },
  })

  return success
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/services/integrations/whatsapp/zapi.service.ts
git commit -m "feat(whatsapp): add Z-API service (connect, status, QR code, send)"
```

---

## Task 3: WhatsApp Messages Service

**Files:**
- Create: `src/services/integrations/whatsapp/whatsapp-messages.service.ts`

> **Contexto:** `enviarMensagem` está em `zapi.service.ts`. `AlertConfig` tem `horarioSilencioInicio`/`Fim` e `isInSilenceWindow` está em `src/jobs/alerts/utils.ts`. `WhatsAppConfig` type: `{ alertas: { ativo: boolean; numeros: string[] }, resumoDiario: { ativo: boolean; numeros: string[] }, ifood: { ativo: boolean; threshold: number; numeros: string[] } }`.

- [ ] **Step 1: Criar `src/services/integrations/whatsapp/whatsapp-messages.service.ts`**

```typescript
import { prisma } from '@/lib/prisma'
import { enviarMensagem } from './zapi.service'
import { isInSilenceWindow } from '@/jobs/alerts/utils'

type WhatsAppConfig = {
  alertas?:      { ativo?: boolean; numeros?: string[] }
  resumoDiario?: { ativo?: boolean; numeros?: string[] }
  ifood?:        { ativo?: boolean; threshold?: number; numeros?: string[] }
}

type AlertaPayload = {
  tenantId: string
  tipo: string
  severidade: string
  titulo: string
  descricao: string
  metadata?: Record<string, unknown>
}

async function getConfig(tenantId: string): Promise<WhatsAppConfig | null> {
  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { tenantId },
    select: { config: true, status: true },
  })
  if (!integration || integration.status !== 'CONECTADO') return null
  return (integration.config ?? {}) as WhatsAppConfig
}

async function jaNotificadoNas2h(tenantId: string, subtipo: string): Promise<boolean> {
  const doisHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000)
  const existing = await prisma.whatsAppLog.findFirst({
    where: {
      tenantId,
      tipo: 'ALERTA',
      status: 'ENVIADO',
      createdAt: { gte: doisHorasAtras },
      mensagem: { contains: subtipo },
    },
  })
  return !!existing
}

export async function enviarAlerta(tenantId: string, alerta: AlertaPayload): Promise<void> {
  if (alerta.severidade !== 'CRITICA' && alerta.severidade !== 'ALTA') return

  const config = await getConfig(tenantId)
  if (!config?.alertas?.ativo) return

  const numeros = config.alertas.numeros ?? []
  if (numeros.length === 0) return

  // Verificar horário de silêncio
  const alertConfig = await prisma.alertConfig.findFirst({
    where: { tenantId, tipoAlerta: alerta.tipo },
  })
  if (alertConfig && isInSilenceWindow(alertConfig as { horarioSilencioInicio?: string | null; horarioSilencioFim?: string | null })) return

  // Anti-spam: não notificar o mesmo subtipo nas últimas 2h
  const subtipo = (alerta.metadata as Record<string, string> | undefined)?.subtipo ?? alerta.tipo
  if (await jaNotificadoNas2h(tenantId, subtipo)) return

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
  const severidadeEmoji = alerta.severidade === 'CRITICA' ? '🔴' : '🟠'

  const mensagem = [
    `${severidadeEmoji} *THE FINANCE — Alerta ${alerta.severidade === 'CRITICA' ? 'Crítico' : 'Alto'}*`,
    `Restaurante: ${tenant?.name ?? tenantId}`,
    alerta.titulo,
    alerta.descricao,
    `Acesse: app.thefinance.com.br/alertas`,
  ].join('\n')

  for (const numero of numeros) {
    await enviarMensagem(tenantId, numero, mensagem, 'ALERTA')
  }
}

export async function enviarResumoDiario(tenantId: string): Promise<void> {
  const config = await getConfig(tenantId)
  if (!config?.resumoDiario?.ativo) return

  const numeros = config.resumoDiario.numeros ?? []
  if (numeros.length === 0) return

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const [pedidos, movimentos, alertasAtivos] = await Promise.all([
    prisma.pedido.findMany({
      where: { tenantId, status: 'FINALIZADO', fechadoEm: { gte: hoje } },
      select: { total: true, itens: { include: { product: { select: { name: true } } } } },
    }),
    prisma.ingredientMovement.findMany({
      where: { tenantId, type: 'OUT', createdAt: { gte: hoje } },
      select: { totalCost: true },
    }),
    prisma.alert.count({
      where: { tenantId, status: { in: ['NAO_LIDO', 'LIDO'] }, severidade: 'CRITICA' },
    }),
  ])

  const totalVendas = pedidos.reduce((s, p) => s + p.total, 0)
  const numPedidos = pedidos.length
  const ticketMedio = numPedidos > 0 ? totalVendas / numPedidos : 0
  const cmvTotal = movimentos.reduce((s, m) => s + (m.totalCost ?? 0), 0)
  const cmvPct = totalVendas > 0 ? (cmvTotal / totalVendas) * 100 : 0

  // Produto mais vendido
  const produtoCount = new Map<string, number>()
  for (const pedido of pedidos) {
    for (const item of pedido.itens) {
      const nome = item.product.name
      produtoCount.set(nome, (produtoCount.get(nome) ?? 0) + 1)
    }
  }
  const topProduto = Array.from(produtoCount.entries()).sort((a, b) => b[1] - a[1])[0]

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const cmvEmoji = cmvPct > 38 ? '🔴' : cmvPct > 32 ? '🟡' : '🟢'
  const dataStr = hoje.toLocaleDateString('pt-BR')

  const mensagem = [
    `📊 *THE FINANCE — Resumo do Dia*`,
    `Restaurante: ${tenant?.name ?? tenantId} | ${dataStr}`,
    ``,
    `💰 Vendas: ${fmt(totalVendas)}`,
    `🛒 Pedidos: ${numPedidos} | Ticket médio: ${fmt(ticketMedio)}`,
    `📉 CMV: ${cmvPct.toFixed(1)}% ${cmvEmoji}`,
    topProduto ? `🏆 Mais vendido: ${topProduto[0]} (${topProduto[1]}x)` : '',
    ``,
    alertasAtivos > 0
      ? `⚠️ ${alertasAtivos} alerta(s) crítico(s) ativo(s)`
      : `✅ Nenhum alerta crítico ativo`,
    `Acesse: app.thefinance.com.br/dashboard`,
  ].filter(Boolean).join('\n')

  for (const numero of numeros) {
    await enviarMensagem(tenantId, numero, mensagem, 'RESUMO_DIARIO')
  }
}

export async function enviarNotificacaoPedidoIfood(
  tenantId: string,
  pedido: { id: string; total: number; ifoodReference?: string | null; enderecoEntrega?: Record<string, unknown> }
): Promise<void> {
  const config = await getConfig(tenantId)
  if (!config?.ifood?.ativo) return

  const threshold = config.ifood.threshold ?? 0
  if (pedido.total < threshold) return

  const numeros = config.ifood.numeros ?? []
  if (numeros.length === 0) return

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const endereco = pedido.enderecoEntrega
  const enderecoStr = endereco
    ? [endereco.streetName, endereco.streetNumber, endereco.neighborhood].filter(Boolean).join(', ')
    : 'Endereço não informado'

  const mensagem = [
    `🛵 *Novo pedido iFood!*`,
    `Restaurante: ${tenant?.name ?? tenantId}`,
    pedido.ifoodReference ? `Pedido: #${pedido.ifoodReference} | ${fmt(pedido.total)}` : `Valor: ${fmt(pedido.total)}`,
    `Endereço: ${enderecoStr}`,
  ].join('\n')

  for (const numero of numeros) {
    await enviarMensagem(tenantId, numero, mensagem, 'PEDIDO_IFOOD')
  }
}

export async function enviarAlertaLimiteIA(tenantId: string, percentual: 80 | 100): Promise<void> {
  const config = await getConfig(tenantId)
  // Reutiliza canal de alertas para notificação de limite de IA
  const numeros = config?.alertas?.numeros ?? []
  if (numeros.length === 0) return

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
  const emoji = percentual === 100 ? '🚫' : '⚠️'
  const label = percentual === 100 ? '100% — uso bloqueado' : '80% do limite mensal atingido'

  const mensagem = [
    `${emoji} *THE FINANCE — Limite de IA*`,
    `Restaurante: ${tenant?.name ?? tenantId}`,
    `Uso de IA: ${label}.`,
    `Acesse: app.thefinance.com.br/configuracoes/assinatura`,
  ].join('\n')

  for (const numero of numeros) {
    await enviarMensagem(tenantId, numero, mensagem, 'ALERTA')
  }
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/services/integrations/whatsapp/
git commit -m "feat(whatsapp): add message service (alerts, daily report, iFood, AI limit)"
```

---

## Task 4: BullMQ Worker + server.ts

**Files:**
- Create: `src/jobs/whatsapp/whatsapp-daily-report.job.ts`
- Create: `src/jobs/whatsapp/index.ts`
- Modify: `server.ts`

- [ ] **Step 1: Criar `src/jobs/whatsapp/whatsapp-daily-report.job.ts`**

```typescript
import { prisma } from '@/lib/prisma'
import { enviarResumoDiario } from '@/services/integrations/whatsapp/whatsapp-messages.service'

export async function processDailyReportJob(): Promise<void> {
  const integracoes = await prisma.whatsAppIntegration.findMany({
    where: { status: 'CONECTADO' },
    select: { tenantId: true, config: true },
  })

  for (const { tenantId, config } of integracoes) {
    const cfg = config as { resumoDiario?: { ativo?: boolean } }
    if (!cfg?.resumoDiario?.ativo) continue

    try {
      await enviarResumoDiario(tenantId)
      console.log(`[whatsapp-daily-report] Resumo enviado para tenant ${tenantId}`)
    } catch (err) {
      console.error(`[whatsapp-daily-report] Erro tenant ${tenantId}:`, err)
    }
  }
}
```

- [ ] **Step 2: Criar `src/jobs/whatsapp/index.ts`**

```typescript
import { Queue, Worker } from 'bullmq'
import { redisConnectionOptions } from '@/lib/bullmq'
import type { Server as SocketIOServer } from 'socket.io'
import { processDailyReportJob } from './whatsapp-daily-report.job'

export async function startWhatsAppWorkers(_io: SocketIOServer): Promise<void> {
  const dailyQueue = new Queue('whatsapp-daily-report', { connection: redisConnectionOptions })
  await dailyQueue.add(
    'daily-report',
    {},
    { repeat: { pattern: '0 23 * * *' }, jobId: 'whatsapp-daily-report-cron' }
  )

  new Worker('whatsapp-daily-report', processDailyReportJob, {
    connection: redisConnectionOptions,
  })

  console.log('> WhatsApp workers started')
}
```

- [ ] **Step 3: Modificar `server.ts`**

Localizar o bloco `if (redisOk)` e adicionar após `await startIFoodWorkers(io)`:

```typescript
    const { startWhatsAppWorkers } = await import('./src/jobs/whatsapp')
    await startWhatsAppWorkers(io)
```

O bloco completo fica:
```typescript
  if (redisOk) {
    const { startAlertWorkers }    = await import('./src/jobs/alerts')
    const { startDashboardWorkers } = await import('./src/jobs/dashboard')
    const { startAiWorkers }       = await import('./src/jobs/ai')
    const { startIFoodWorkers }    = await import('./src/jobs/ifood')
    const { startWhatsAppWorkers } = await import('./src/jobs/whatsapp')   // ← NOVO
    await startAlertWorkers(io)
    await startDashboardWorkers()
    await startAiWorkers(io)
    await startIFoodWorkers(io)
    await startWhatsAppWorkers(io)                                           // ← NOVO
  }
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/jobs/whatsapp/ server.ts
git commit -m "feat(whatsapp): add BullMQ daily report worker (cron 23h)"
```

---

## Task 5: API Routes

**Files:**
- Create: `src/app/api/integracoes/whatsapp/connect/route.ts`
- Create: `src/app/api/integracoes/whatsapp/status/route.ts`
- Create: `src/app/api/integracoes/whatsapp/disconnect/route.ts`
- Create: `src/app/api/integracoes/whatsapp/test/route.ts`
- Create: `src/app/api/integracoes/whatsapp/logs/route.ts`

- [ ] **Step 1: Criar `src/app/api/integracoes/whatsapp/connect/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { conectar } from '@/services/integrations/whatsapp/zapi.service'

function allowed(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const body = await req.json()
  const { instanceId, token } = body
  if (!instanceId || !token) {
    return NextResponse.json({ error: 'instanceId e token são obrigatórios' }, { status: 400 })
  }

  try {
    await conectar(tenantId, instanceId, token)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const body = await req.json()
  const { config } = body
  if (!config || typeof config !== 'object') {
    return NextResponse.json({ error: 'config inválido' }, { status: 400 })
  }

  await prisma.whatsAppIntegration.update({
    where: { tenantId },
    data: { config },
  })
  return NextResponse.json({ ok: true })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { tenantId },
    select: { status: true, numeroConectado: true, ultimaConexao: true, config: true, instanceId: true },
  })

  if (!integration) return NextResponse.json({ status: 'DESCONECTADO' })
  return NextResponse.json(integration)
}
```

- [ ] **Step 2: Criar `src/app/api/integracoes/whatsapp/status/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { verificarStatus, getQrCode } from '@/services/integrations/whatsapp/zapi.service'

function allowed(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  try {
    const { status, numeroConectado } = await verificarStatus(tenantId)
    const qrCode = status !== 'CONECTADO' ? await getQrCode(tenantId) : null
    return NextResponse.json({ status, numeroConectado, qrCode })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}
```

- [ ] **Step 3: Criar `src/app/api/integracoes/whatsapp/disconnect/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { desconectar } from '@/services/integrations/whatsapp/zapi.service'

function allowed(role?: string | null) {
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

- [ ] **Step 4: Criar `src/app/api/integracoes/whatsapp/test/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { enviarMensagem } from '@/services/integrations/whatsapp/zapi.service'

function allowed(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  // Buscar número do admin logado (email → usuário)
  const user = await import('@/lib/prisma').then(({ prisma }) =>
    prisma.user.findUnique({
      where: { email: session.user?.email ?? '' },
      select: { phone: true },
    }).catch(() => null)
  )

  const mensagem = [
    `✅ *THE FINANCE — Mensagem de Teste*`,
    `WhatsApp configurado com sucesso!`,
    `As notificações serão enviadas para este número.`,
  ].join('\n')

  // Buscar qualquer número configurado ou tentar o número do usuário
  const { prisma } = await import('@/lib/prisma')
  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { tenantId },
    select: { config: true, numeroConectado: true },
  })

  const config = (integration?.config ?? {}) as { alertas?: { numeros?: string[] } }
  const primeiroNumero = config?.alertas?.numeros?.[0] ?? integration?.numeroConectado

  if (!primeiroNumero) {
    return NextResponse.json({ error: 'Nenhum número configurado. Adicione um número em Alertas críticos.' }, { status: 400 })
  }

  const ok = await enviarMensagem(tenantId, primeiroNumero, mensagem, 'ALERTA')
  return NextResponse.json({ ok })
}
```

- [ ] **Step 5: Criar `src/app/api/integracoes/whatsapp/logs/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function allowed(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const tipo = req.nextUrl.searchParams.get('tipo') ?? undefined
  const status = req.nextUrl.searchParams.get('status') ?? undefined
  const start = req.nextUrl.searchParams.get('start')
  const end = req.nextUrl.searchParams.get('end')

  const logs = await prisma.whatsAppLog.findMany({
    where: {
      tenantId,
      ...(tipo ? { tipo: tipo as 'ALERTA' | 'RESUMO_DIARIO' | 'PEDIDO_IFOOD' } : {}),
      ...(status ? { status: status as 'ENVIADO' | 'FALHOU' } : {}),
      ...(start || end ? {
        createdAt: {
          ...(start ? { gte: new Date(start) } : {}),
          ...(end ? { lte: new Date(new Date(end).setHours(23, 59, 59, 999)) } : {}),
        },
      } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      tipo: true,
      destinatario: true,
      status: true,
      erro: true,
      createdAt: true,
    },
  })

  return NextResponse.json(logs)
}
```

- [ ] **Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/integracoes/whatsapp/
git commit -m "feat(whatsapp): add API routes (connect, status, disconnect, test, logs)"
```

---

## Task 6: Hooks em Arquivos Existentes

**Files:**
- Modify: `src/jobs/alerts/utils.ts`
- Modify: `src/services/ai/ai-usage.service.ts`
- Modify: `src/services/integrations/ifood/ifood-orders.service.ts`

- [ ] **Step 1: Modificar `src/jobs/alerts/utils.ts` — adicionar hook WhatsApp em `createAlert`**

Localizar a função `createAlert`. Após o bloco `try { io.to(...).emit(...) } catch {}` (ao final da função, antes do fechamento `}`), adicionar:

```typescript
  // Notificação WhatsApp (fire-and-forget, não bloqueia o fluxo de alertas)
  if (payload.severidade === 'CRITICA' || payload.severidade === 'ALTA') {
    import('@/services/integrations/whatsapp/whatsapp-messages.service')
      .then(({ enviarAlerta }) => enviarAlerta(payload.tenantId, {
        tenantId: payload.tenantId,
        tipo: payload.tipo,
        severidade: payload.severidade,
        titulo: payload.titulo,
        descricao: payload.descricao,
        metadata: payload.metadata as Record<string, unknown>,
      }))
      .catch((err) => console.error('[whatsapp] enviarAlerta failed:', err))
  }
```

- [ ] **Step 2: Modificar `src/services/ai/ai-usage.service.ts` — adicionar verificação de limite**

Adicionar a função `_verificarENotificarLimite` ANTES da função `resetarUsoMensal`:

```typescript
async function _verificarENotificarLimite(tenantId: string): Promise<void> {
  const { percentual, permitido } = await verificarLimite(tenantId)

  // Só notifica nos thresholds exatos de 80% e 100%
  if (percentual !== 80 && percentual !== 100) return

  // Anti-spam: usar Redis para garantir envio único por threshold por dia
  const { redisConnection } = await import('@/lib/bullmq')
  const key = `wpp:ai-limit:${tenantId}:${percentual}`
  const existing = await redisConnection.get(key)
  if (existing) return // Já notificou hoje

  await redisConnection.set(key, '1', 'EX', 86400) // Expira em 24h

  import('@/services/integrations/whatsapp/whatsapp-messages.service')
    .then(({ enviarAlertaLimiteIA }) =>
      enviarAlertaLimiteIA(tenantId, percentual as 80 | 100)
    )
    .catch((err) => console.error('[whatsapp] enviarAlertaLimiteIA failed:', err))
}
```

No final da função `incrementarUso`, após o `await prisma.aiUsage.update(...)`, adicionar antes do fechamento `}`:

```typescript
  // Verificar e notificar limites de uso de IA via WhatsApp
  _verificarENotificarLimite(tenantId).catch((err) =>
    console.error('[ai-usage] _verificarENotificarLimite failed:', err)
  )
```

> **Nota:** chamada é fire-and-forget (sem `await`) para não bloquear o fluxo principal de processamento de NF/chat.

- [ ] **Step 3: Modificar `src/services/integrations/ifood/ifood-orders.service.ts` — hook iFood**

Na função `processarWebhook`, localizar o bloco Socket.io (após a transação Prisma). Após o bloco `if (io) { ... }`, adicionar:

```typescript
  // Notificação WhatsApp para pedido iFood (fire-and-forget)
  const ifoodPedidoData = await prisma.iFoodPedido.findUnique({
    where: { pedidoId: pedido.id },
    select: { ifoodReference: true, enderecoEntrega: true },
  })
  import('@/services/integrations/whatsapp/whatsapp-messages.service')
    .then(({ enviarNotificacaoPedidoIfood }) =>
      enviarNotificacaoPedidoIfood(tenantId, {
        id: pedido.id,
        total: pedido.total,
        ifoodReference: ifoodPedidoData?.ifoodReference ?? null,
        enderecoEntrega: (ifoodPedidoData?.enderecoEntrega ?? {}) as Record<string, unknown>,
      })
    )
    .catch((err) => console.error('[whatsapp] enviarNotificacaoPedidoIfood failed:', err))
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/jobs/alerts/utils.ts src/services/ai/ai-usage.service.ts src/services/integrations/ifood/ifood-orders.service.ts
git commit -m "feat(whatsapp): hook alerts, AI limit and iFood order notifications"
```

---

## Task 7: Página de Configuração WhatsApp

**Files:**
- Create: `src/app/(dashboard)/configuracoes/integracoes/whatsapp/page.tsx`

> Padrão visual: CSS variables `var(--tf-*)`, inline styles, lucide-react icons, `'use client'`.

- [ ] **Step 1: Criar `src/app/(dashboard)/configuracoes/integracoes/whatsapp/page.tsx`**

```tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle, XCircle, AlertCircle, Loader2, Plus, Trash2, Send, ExternalLink } from 'lucide-react'

type WppStatus = 'CONECTADO' | 'DESCONECTADO' | 'ERRO'

type WppConfig = {
  alertas?:      { ativo?: boolean; numeros?: string[] }
  resumoDiario?: { ativo?: boolean; numeros?: string[] }
  ifood?:        { ativo?: boolean; threshold?: number; numeros?: string[] }
}

type IntegrationInfo = {
  status: WppStatus
  numeroConectado?: string
  ultimaConexao?: string
  config?: WppConfig
  instanceId?: string
}

type LogEntry = {
  id: string
  tipo: string
  destinatario: string
  status: string
  erro?: string | null
  createdAt: string
}

const TIPO_LABELS: Record<string, string> = { ALERTA: 'Alerta', RESUMO_DIARIO: 'Resumo Diário', PEDIDO_IFOOD: 'Pedido iFood' }
const TIPO_COLORS: Record<string, string> = { ALERTA: '#e05252', RESUMO_DIARIO: '#2a9d6f', PEDIDO_IFOOD: '#f97316' }

function StatusBadge({ status }: { status: WppStatus }) {
  const map = {
    CONECTADO:    { color: '#2a9d6f', bg: '#0d2b1f', label: 'Conectado',    icon: <CheckCircle size={13} /> },
    DESCONECTADO: { color: '#6b7280', bg: '#1a1a1a', label: 'Desconectado', icon: <XCircle size={13} /> },
    ERRO:         { color: '#e05252', bg: '#1f0a0a', label: 'Erro',          icon: <AlertCircle size={13} /> },
  }
  const c = map[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: c.color, background: c.bg, border: `1px solid ${c.color}` }}>
      {c.icon} {c.label}
    </span>
  )
}

function NumberInput({ numbers, onChange }: { numbers: string[]; onChange: (nums: string[]) => void }) {
  const [input, setInput] = useState('')
  function add() {
    const n = input.trim().replace(/\s/g, '')
    if (n && !numbers.includes(n)) { onChange([...numbers, n]); setInput('') }
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="+5511987654321"
          style={{ flex: 1, padding: '7px 10px', borderRadius: 7, border: '1px solid var(--tf-border)', background: 'var(--tf-surface2)', color: 'var(--tf-txt)', fontSize: 12 }}
        />
        <button onClick={add} style={{ padding: '7px 12px', borderRadius: 7, border: 'none', background: 'var(--tf-primary)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <Plus size={14} />
        </button>
      </div>
      {numbers.map((n) => (
        <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 10px', borderRadius: 6, background: 'var(--tf-surface2)', marginBottom: 4, fontSize: 12, color: 'var(--tf-txt2)' }}>
          <span>{n}</span>
          <button onClick={() => onChange(numbers.filter((x) => x !== n))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tf-txt3)', display: 'flex' }}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
    >
      <div style={{ width: 36, height: 20, borderRadius: 10, background: checked ? 'var(--tf-primary)' : 'var(--tf-border)', position: 'relative', transition: 'background 200ms', flexShrink: 0 }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: checked ? 18 : 2, transition: 'left 200ms' }} />
      </div>
      <span style={{ fontSize: 13, color: 'var(--tf-txt)', fontWeight: 500 }}>{label}</span>
    </button>
  )
}

export default function WhatsAppConfigPage() {
  const [instanceId, setInstanceId] = useState('')
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState<IntegrationInfo | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const [config, setConfig] = useState<WppConfig>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const [disconnectModal, setDisconnectModal] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logTipo, setLogTipo] = useState('')
  const [logStatus, setLogStatus] = useState('')
  const [ifoodAtivo, setIfoodAtivo] = useState(false)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Verificar se iFood está conectado
  useEffect(() => {
    fetch('/api/integracoes/ifood/connect')
      .then((r) => r.json())
      .then((d) => setIfoodAtivo(d.status === 'CONECTADO'))
      .catch(() => {})
  }, [])

  // Carregar estado inicial
  useEffect(() => {
    fetch('/api/integracoes/whatsapp/connect')
      .then((r) => r.json())
      .then((d) => {
        if (d.status && d.status !== 'DESCONECTADO') {
          setInfo(d)
          setConfig(d.config ?? {})
        }
      })
      .catch(() => {})
  }, [])

  // Carregar logs
  const loadLogs = useCallback(() => {
    const params = new URLSearchParams()
    if (logTipo) params.set('tipo', logTipo)
    if (logStatus) params.set('status', logStatus)
    fetch(`/api/integracoes/whatsapp/logs?${params}`)
      .then((r) => r.json())
      .then(setLogs)
      .catch(() => {})
  }, [logTipo, logStatus])

  useEffect(() => {
    if (info?.status === 'CONECTADO') loadLogs()
  }, [info?.status, loadLogs])

  // Polling de status / QR Code
  useEffect(() => {
    if (!polling) { if (pollingRef.current) clearInterval(pollingRef.current); return }
    pollingRef.current = setInterval(async () => {
      const r = await fetch('/api/integracoes/whatsapp/status').then((x) => x.json()).catch(() => null)
      if (!r) return
      setQrCode(r.qrCode ?? null)
      if (r.status === 'CONECTADO') {
        setPolling(false)
        setInfo({ status: 'CONECTADO', numeroConectado: r.numeroConectado, config: {} })
        const full = await fetch('/api/integracoes/whatsapp/connect').then((x) => x.json()).catch(() => null)
        if (full) { setInfo(full); setConfig(full.config ?? {}) }
      }
    }, 10_000)
    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  }, [polling])

  async function handleConnect() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/integracoes/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId, token }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Erro ao conectar') }
      setPolling(true)
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  async function handleSaveConfig() {
    setSaving(true); setSaved(false)
    try {
      await fetch('/api/integracoes/whatsapp/connect', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch { /* noop */ } finally { setSaving(false) }
  }

  async function handleTest() {
    setTestLoading(true); setTestMsg('')
    try {
      const res = await fetch('/api/integracoes/whatsapp/test', { method: 'POST' })
      const d = await res.json()
      setTestMsg(d.ok ? '✅ Mensagem enviada!' : `❌ ${d.error ?? 'Falha ao enviar'}`)
    } catch { setTestMsg('❌ Erro ao enviar') } finally { setTestLoading(false) }
  }

  async function handleDisconnect() {
    setLoading(true)
    try {
      await fetch('/api/integracoes/whatsapp/disconnect', { method: 'POST' })
      setInfo(null); setConfig({}); setQrCode(null); setPolling(false); setDisconnectModal(false)
    } catch { /* noop */ } finally { setLoading(false) }
  }

  function updateConfig(path: string[], value: unknown) {
    setConfig((prev) => {
      const next = { ...prev }
      let cur: Record<string, unknown> = next as Record<string, unknown>
      for (let i = 0; i < path.length - 1; i++) {
        if (!cur[path[i]]) cur[path[i]] = {}
        cur = cur[path[i]] as Record<string, unknown>
      }
      cur[path[path.length - 1]] = value
      return next
    })
  }

  // ── Estado conectado ──
  if (info?.status === 'CONECTADO') {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 32 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 4 }}>WhatsApp</h1>
        <p style={{ fontSize: 13, color: 'var(--tf-txt3)', marginBottom: 24 }}>Gerencie notificações e alertas via WhatsApp.</p>

        {/* Status card */}
        <div style={{ padding: '18px 22px', borderRadius: 12, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--tf-txt)' }}>Status</span>
            <StatusBadge status="CONECTADO" />
          </div>
          {[
            { label: 'Número conectado', value: info.numeroConectado ?? '—' },
            { label: 'Última conexão', value: info.ultimaConexao ? new Date(info.ultimaConexao).toLocaleString('pt-BR') : '—' },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: '1px solid var(--tf-border)' }}>
              <span style={{ fontSize: 13, color: 'var(--tf-txt2)' }}>{label}</span>
              <span style={{ fontSize: 13, color: 'var(--tf-txt)', fontWeight: 500 }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Configurações de envio */}
        <div style={{ padding: '18px 22px', borderRadius: 12, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)', marginBottom: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 18 }}>Configurações de envio</p>

          {/* Alertas críticos */}
          <div style={{ marginBottom: 20 }}>
            <Toggle
              checked={config.alertas?.ativo ?? false}
              onChange={(v) => updateConfig(['alertas', 'ativo'], v)}
              label="Alertas críticos por WhatsApp"
            />
            {config.alertas?.ativo && (
              <div style={{ marginLeft: 46, marginTop: 10 }}>
                <p style={{ fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 6 }}>Números de destino</p>
                <NumberInput
                  numbers={config.alertas?.numeros ?? []}
                  onChange={(nums) => updateConfig(['alertas', 'numeros'], nums)}
                />
              </div>
            )}
          </div>

          {/* Resumo diário */}
          <div style={{ marginBottom: 20 }}>
            <Toggle
              checked={config.resumoDiario?.ativo ?? false}
              onChange={(v) => updateConfig(['resumoDiario', 'ativo'], v)}
              label="Resumo diário por WhatsApp (23h)"
            />
            {config.resumoDiario?.ativo && (
              <div style={{ marginLeft: 46, marginTop: 10 }}>
                <p style={{ fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 6 }}>Números de destino</p>
                <NumberInput
                  numbers={config.resumoDiario?.numeros ?? []}
                  onChange={(nums) => updateConfig(['resumoDiario', 'numeros'], nums)}
                />
              </div>
            )}
          </div>

          {/* Notificações iFood (só se iFood ativo) */}
          {ifoodAtivo && (
            <div style={{ marginBottom: 8 }}>
              <Toggle
                checked={config.ifood?.ativo ?? false}
                onChange={(v) => updateConfig(['ifood', 'ativo'], v)}
                label="Notificações de pedido iFood"
              />
              {config.ifood?.ativo && (
                <div style={{ marginLeft: 46, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 5 }}>Valor mínimo (R$)</label>
                    <input
                      type="number"
                      min="0"
                      value={config.ifood?.threshold ?? 0}
                      onChange={(e) => updateConfig(['ifood', 'threshold'], Number(e.target.value))}
                      style={{ width: 120, padding: '7px 10px', borderRadius: 7, border: '1px solid var(--tf-border)', background: 'var(--tf-surface2)', color: 'var(--tf-txt)', fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 6 }}>Números de destino</p>
                    <NumberInput
                      numbers={config.ifood?.numeros ?? []}
                      onChange={(nums) => updateConfig(['ifood', 'numeros'], nums)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20, alignItems: 'center' }}>
            <button onClick={handleSaveConfig} disabled={saving} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--tf-primary)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Salvando...' : saved ? 'Salvo ✓' : 'Salvar configurações'}
            </button>
            <button onClick={handleTest} disabled={testLoading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt2)', fontSize: 13, cursor: testLoading ? 'not-allowed' : 'pointer' }}>
              {testLoading ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={13} />}
              Enviar teste
            </button>
            {testMsg && <span style={{ fontSize: 12, color: testMsg.startsWith('✅') ? '#2a9d6f' : '#e05252' }}>{testMsg}</span>}
          </div>
        </div>

        {/* Histórico */}
        <div style={{ padding: '18px 22px', borderRadius: 12, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)' }}>Histórico de mensagens</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['', 'Todos os tipos'], ['ALERTA', 'Alertas'], ['RESUMO_DIARIO', 'Resumos'], ['PEDIDO_IFOOD', 'iFood']].map(([val, label]) => (
                <button key={val} onClick={() => { setLogTipo(val); setTimeout(loadLogs, 0) }} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${logTipo === val ? 'var(--tf-primary)' : 'var(--tf-border)'}`, background: logTipo === val ? 'var(--tf-primary-bg)' : 'transparent', color: logTipo === val ? 'var(--tf-primary)' : 'var(--tf-txt3)', fontSize: 11, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {logs.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>Nenhuma mensagem enviada.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Data', 'Tipo', 'Destinatário', 'Status'].map((h) => <th key={h} style={{ padding: '6px 0', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--tf-txt3)', textTransform: 'uppercase' }}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderTop: '1px solid var(--tf-border)' }}>
                    <td style={{ padding: '8px 0', fontSize: 11, color: 'var(--tf-txt3)' }}>{new Date(log.createdAt).toLocaleString('pt-BR')}</td>
                    <td style={{ padding: '8px 0' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: TIPO_COLORS[log.tipo] ?? '#888', background: (TIPO_COLORS[log.tipo] ?? '#888') + '22', padding: '2px 6px', borderRadius: 8 }}>
                        {TIPO_LABELS[log.tipo] ?? log.tipo}
                      </span>
                    </td>
                    <td style={{ padding: '8px 0', fontSize: 12, color: 'var(--tf-txt2)', fontFamily: 'monospace' }}>{log.destinatario}</td>
                    <td style={{ padding: '8px 0' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: log.status === 'ENVIADO' ? '#2a9d6f' : '#e05252' }}>{log.status}</span>
                      {log.erro && <span style={{ fontSize: 10, color: 'var(--tf-txt3)', display: 'block' }}>{log.erro}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Desconectar */}
        <button onClick={() => setDisconnectModal(true)} style={{ fontSize: 13, color: 'var(--tf-red)', background: 'var(--tf-red-bg)', border: '1px solid var(--tf-red-bd)', borderRadius: 8, padding: '8px 18px', cursor: 'pointer' }}>
          Desconectar WhatsApp
        </button>

        {disconnectModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 12, padding: 28, maxWidth: 380, width: '100%' }}>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 10 }}>Desconectar WhatsApp?</p>
              <p style={{ fontSize: 13, color: 'var(--tf-txt2)', marginBottom: 24 }}>As configurações de envio serão mantidas. Você pode reconectar a qualquer momento.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDisconnectModal(false)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt2)', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleDisconnect} disabled={loading} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: 'var(--tf-red)', color: '#fff', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}>
                  {loading ? '...' : 'Desconectar'}
                </button>
              </div>
            </div>
          </div>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── Estado desconectado ──
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 32 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 4 }}>Conectar WhatsApp</h1>
      <p style={{ fontSize: 13, color: 'var(--tf-txt3)', marginBottom: 24 }}>
        Use o gateway Z-API para enviar notificações via WhatsApp.{' '}
        <a href="https://portal.z-api.io" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--tf-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          Portal Z-API <ExternalLink size={12} />
        </a>
      </p>

      <div style={{ padding: '22px 24px', borderRadius: 12, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
        {!polling ? (
          <>
            {[
              { label: 'Instance ID', value: instanceId, set: setInstanceId, placeholder: 'Ex: 3E9B0B5...', type: 'text' },
              { label: 'Token', value: token, set: setToken, placeholder: 'Cole o token aqui', type: 'password' },
            ].map(({ label, value, set, placeholder, type }) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tf-txt2)', marginBottom: 5 }}>{label}</label>
                <input
                  type={type}
                  value={value}
                  onChange={(e) => (set as (v: string) => void)(e.target.value)}
                  placeholder={placeholder}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'var(--tf-surface2)', color: 'var(--tf-txt)', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            ))}
            {error && <p style={{ fontSize: 13, color: 'var(--tf-red)', marginBottom: 12 }}>{error}</p>}
            <button
              onClick={handleConnect}
              disabled={loading || !instanceId || !token}
              style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', background: 'var(--tf-primary)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: (loading || !instanceId || !token) ? 'not-allowed' : 'pointer', opacity: (loading || !instanceId || !token) ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {loading && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
              {loading ? 'Conectando...' : 'Conectar e gerar QR Code'}
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--tf-txt2)', marginBottom: 16 }}>Escaneie o QR Code com o WhatsApp do número que será usado.</p>
            {qrCode ? (
              <img src={qrCode} alt="QR Code WhatsApp" style={{ width: 220, height: 220, borderRadius: 8, border: '1px solid var(--tf-border)' }} />
            ) : (
              <div style={{ width: 220, height: 220, borderRadius: 8, border: '1px solid var(--tf-border)', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--tf-surface2)' }}>
                <Loader2 size={32} style={{ color: 'var(--tf-primary)', animation: 'spin 0.8s linear infinite' }} />
              </div>
            )}
            <p style={{ fontSize: 12, color: 'var(--tf-txt3)', marginTop: 14 }}>Aguardando scan... (verificando a cada 10s)</p>
            <button onClick={() => setPolling(false)} style={{ marginTop: 12, fontSize: 12, color: 'var(--tf-txt3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Cancelar
            </button>
          </div>
        )}
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
git add "src/app/(dashboard)/configuracoes/integracoes/whatsapp/"
git commit -m "feat(whatsapp): add configuration page (QR code, toggles, history)"
```

---

## Task 8: Sidebar + Ajuda

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/app/(dashboard)/ajuda/page.tsx`

- [ ] **Step 1: Adicionar `MessageCircle` ao import do sidebar**

Em `src/components/layout/sidebar.tsx`, localizar a importação do `lucide-react` e adicionar `MessageCircle`:

```typescript
import {
  // ... existentes
  Plug,
  Truck,
  MessageCircle,   // ← NOVO
  LucideIcon,
} from 'lucide-react'
```

- [ ] **Step 2: Adicionar entrada WhatsApp no `navItems`**

No array `navItems`, localizar o grupo `Configurações`. Após `{ label: 'Integrações', href: '/configuracoes/integracoes/ifood', icon: Plug }`, adicionar:

```typescript
{ label: 'WhatsApp', href: '/configuracoes/integracoes/whatsapp', icon: MessageCircle },
```

- [ ] **Step 3: Adicionar seção WhatsApp na página de Ajuda**

Em `src/app/(dashboard)/ajuda/page.tsx`:

**3a) Adicionar `'whatsapp'` ao tipo `SectionId`:**
```typescript
type SectionId =
  | 'intro' | 'primeiros-passos' | 'garcom' | 'cozinha' | 'caixa'
  | 'insumos' | 'produtos' | 'inventario' | 'relatorios' | 'usuarios'
  | 'entrada-inteligente' | 'ifood' | 'whatsapp' | 'faq'
```

**3b) Adicionar `MessageCircle` ao import do `lucide-react`** (já importado no sidebar, importar aqui também):
```typescript
import {
  // ... existentes
  MessageCircle,
} from 'lucide-react'
```

**3c) Adicionar ao array `SECTIONS` antes de `{ id: 'faq', ... }`:**
```typescript
{ id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
```

**3d) Criar componente `WhatsAppHelp()` antes de `function Faq()`:**

```tsx
function WhatsAppHelp() {
  return (
    <>
      <SectionTitle sub="Como conectar e configurar notificações via WhatsApp">Integração WhatsApp</SectionTitle>
      <Tip type="info">
        Acesse em <strong>Configurações → WhatsApp</strong>. É necessário ter uma instância ativa no <strong>portal.z-api.io</strong>.
      </Tip>

      <Sub>Conectar o WhatsApp</Sub>
      <Step n={1} title="Crie uma instância no portal Z-API">
        Acesse <strong>portal.z-api.io</strong>, crie uma conta e gere uma nova instância. Copie o <strong>Instance ID</strong> e o <strong>Token</strong>.
      </Step>
      <Step n={2} title="Informe as credenciais no The Finance">
        Em <strong>Configurações → WhatsApp</strong>, cole o Instance ID e o Token e clique em <strong>Conectar e gerar QR Code</strong>.
      </Step>
      <Step n={3} title="Escaneie o QR Code">
        Um QR Code será exibido. Abra o WhatsApp no celular que receberá as notificações, vá em <strong>Dispositivos conectados → Conectar um dispositivo</strong> e escaneie. O sistema confirma a conexão automaticamente.
      </Step>

      <Sub>Tipos de notificação</Sub>
      <Step n={4} title="Alertas críticos">
        Ative o toggle <strong>Alertas críticos por WhatsApp</strong> e cadastre os números de destino. Quando um alerta de severidade Alta ou Crítica for gerado (estoque zerado, CMV elevado, etc.), a mensagem é enviada para todos os números cadastrados. Anti-spam: o mesmo alerta não é reenviado por 2 horas.
      </Step>
      <Step n={5} title="Resumo diário">
        Ative <strong>Resumo diário por WhatsApp</strong> e informe os números. Todo dia às 23h o sistema envia automaticamente: total de vendas, número de pedidos, ticket médio, CMV do dia e produto mais vendido.
      </Step>
      <Step n={6} title="Notificações de pedido iFood">
        Disponível somente se o iFood estiver conectado. Ative e defina um <strong>valor mínimo (R$)</strong> — pedidos acima desse valor disparam uma notificação com o endereço de entrega. Útil para alertar o gerente sobre pedidos grandes.
      </Step>

      <Tip type="warning">
        O sistema tem um limite de <strong>{parseInt(process.env.NEXT_PUBLIC_WPP_RATE_LIMIT ?? '10', 10) || 10} mensagens por hora</strong> por restaurante para evitar bloqueios do WhatsApp. Alertas acima desse limite são descartados silenciosamente.
      </Tip>

      <Sub>Mensagem de teste</Sub>
      <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7, marginBottom: 16 }}>
        Após configurar os números, clique em <strong>Enviar teste</strong> para verificar se a mensagem chega corretamente no primeiro número cadastrado nos alertas.
      </p>

      <Sub>Histórico de mensagens</Sub>
      <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7, marginBottom: 16 }}>
        Na parte inferior da página de configuração, você vê as últimas 50 mensagens enviadas com tipo, destinatário (mascarado por privacidade) e status (Enviado / Falhou). Filtre por tipo ou status para diagnosticar problemas.
      </p>

      <Sub>Desconectar</Sub>
      <p style={{ fontSize: 13, color: 'var(--tf-txt2)', lineHeight: 1.7 }}>
        Clique em <strong>Desconectar WhatsApp</strong> e confirme. As configurações de números e toggles são mantidas — ao reconectar, tudo volta ao estado anterior.
      </p>
    </>
  )
}
```

**3e) Adicionar ao mapa `CONTENT` antes de `faq`:**
```typescript
  whatsapp:  <WhatsAppHelp />,
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/sidebar.tsx "src/app/(dashboard)/ajuda/page.tsx"
git commit -m "feat(whatsapp): add sidebar link and help section"
```

---

## Self-Review — Cobertura da Spec

| Requisito da Spec | Task que implementa |
|---|---|
| Schema: `WhatsAppIntegration` + `WhatsAppLog` com `config: Json` | Task 1 |
| `zapi.service.ts` com rate limit Redis | Task 2 |
| `whatsapp-messages.service.ts` com 4 funções + templates | Task 3 |
| BullMQ daily report cron 23h + `server.ts` | Task 4 |
| 6 rotas API (connect GET/POST/PATCH, status, disconnect, test, logs) | Task 5 |
| Hook em `createAlert()` (utils.ts) | Task 6 |
| Hook em `incrementarUso()` com anti-spam Redis | Task 6 |
| Hook em `processarWebhook()` (ifood-orders) | Task 6 |
| Página config: estado desconectado + QR Code polling | Task 7 |
| Página config: estado conectado + toggles + histórico | Task 7 |
| Sidebar: entrada WhatsApp | Task 8 |
| Ajuda: seção WhatsApp | Task 8 |

**Nota:** `process.env.NEXT_PUBLIC_WPP_RATE_LIMIT` na seção de Ajuda é opcional — se não definido, exibe fallback `10`. Não é necessário adicionar ao `.env` (o valor já vem de `WHATSAPP_RATE_LIMIT_PER_HOUR` no server side).
