# Módulos 11 + 13: Alertas Inteligentes e Dashboard Expandido — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar sistema de alertas inteligentes (estoque, financeiro, operacional) com jobs BullMQ, notificações Socket.IO em tempo real, e expandir o dashboard com KPIs ao vivo, gráfico de linha, heatmap semanal e painel de alertas.

**Architecture:** Workers BullMQ registrados no `server.ts` existente processam alertas periodicamente e criam snapshots diários. Todos os eventos em tempo real fluem pelo Socket.IO (rooms por tenant já configurados). `AlertsProvider` no layout do dashboard centraliza a contagem de alertas e escuta eventos sem refetch por página. Dashboard usa React Query (staleTime 60s) + Zustand para append eficiente de pontos no gráfico.

**Tech Stack:** Next.js 14, Prisma + PostgreSQL, BullMQ + ioredis, Socket.IO, @tanstack/react-query, zustand, immer, recharts, TailwindCSS, Vitest

---

### Task 1: Instalar dependências e configurar variáveis de ambiente

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `.env.local`
- Modify: `src/components/providers.tsx`

- [ ] **Step 1: Instalar pacotes**

```bash
npm install bullmq ioredis @tanstack/react-query zustand immer
```

- [ ] **Step 2: Verificar instalação**

```bash
npx tsc --noEmit
```
Expected: sem erros de tipo.

- [ ] **Step 3: Adicionar variáveis ao `.env.local`**

```env
REDIS_URL=redis://localhost:6379
CRON_SECRET=dev-secret-change-in-prod
ALERT_JOB_INTERVAL_MS=3600000
KDS_ALERT_JOB_INTERVAL_MS=1800000
DEFAULT_CMV_BENCHMARK=35
DEFAULT_TEMPO_PREPARO_ALERTA=20
```

- [ ] **Step 4: Adicionar QueryClientProvider ao `src/components/providers.tsx`**

```tsx
'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
    })
  )
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster richColors position="top-right" />
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/providers.tsx .env.local
git commit -m "feat: install bullmq, ioredis, react-query, zustand and add QueryClientProvider"
```

---

### Task 2: Adicionar modelos Prisma e executar migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar enums e models ao final do `schema.prisma`**

```prisma
// ── Alerts ────────────────────────────────────────────────────────────────────

enum TipoAlerta {
  ESTOQUE
  FINANCEIRO
  OPERACIONAL
  SISTEMA
}

enum Severidade {
  CRITICA
  ALTA
  MEDIA
  BAIXA
  INFO
}

enum StatusAlerta {
  NAO_LIDO
  LIDO
  RESOLVIDO
  IGNORADO
}

model Alert {
  id          String       @id @default(cuid())
  tenantId    String
  tipo        TipoAlerta
  severidade  Severidade
  titulo      String
  descricao   String
  status      StatusAlerta @default(NAO_LIDO)
  insumoId    String?
  produtoId   String?
  metadata    Json
  criadoEm   DateTime     @default(now())
  lidoEm     DateTime?
  resolvidoEm DateTime?
  tenant      Tenant       @relation(fields: [tenantId], references: [id])

  @@index([tenantId, status])
  @@index([tenantId, tipo, insumoId])
}

model AlertConfig {
  id                    String   @id @default(cuid())
  tenantId              String
  tipoAlerta            String
  ativo                 Boolean  @default(true)
  threshold             Json
  canais                Json
  horarioSilencioInicio String?
  horarioSilencioFim    String?

  @@unique([tenantId, tipoAlerta])
  @@index([tenantId])
}

// ── Dashboard Snapshots ───────────────────────────────────────────────────────

model DashboardSnapshot {
  id                   String   @id @default(cuid())
  tenantId             String
  data                 DateTime
  totalVendas          Decimal
  totalPedidos         Int
  ticketMedio          Decimal
  cmvTotal             Decimal
  cmvPercentual        Decimal
  produtoMaisVendidoId String?
  createdAt            DateTime @default(now())
  tenant               Tenant   @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, data])
  @@index([tenantId, data])
}

// ── KDS Devices ───────────────────────────────────────────────────────────────

model KdsDevice {
  id              String   @id @default(cuid())
  tenantId        String
  pushToken       String
  plataforma      String
  nomeDispositivo String
  ultimaConexao   DateTime @updatedAt
  ativo           Boolean  @default(true)
  tenant          Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
}
```

- [ ] **Step 2: Adicionar relações ao model `Tenant`** (dentro do bloco existente do Tenant, adicionar os campos):

```prisma
  alerts               Alert[]
  alertConfigs         AlertConfig[]
  dashboardSnapshots   DashboardSnapshot[]
  kdsDevices           KdsDevice[]
```

- [ ] **Step 3: Executar migration**

```bash
npx prisma migrate dev --name add-alerts-dashboard-kds
```
Expected: "Your database is now in sync with your schema."

- [ ] **Step 4: Verificar geração do client**

```bash
npx prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Alert, AlertConfig, DashboardSnapshot, KdsDevice models"
```

---

### Task 3: Criar infraestrutura BullMQ

**Files:**
- Create: `src/lib/bullmq.ts`
- Modify: `server.ts`

- [ ] **Step 1: Criar `src/lib/bullmq.ts`**

```typescript
import IORedis from 'ioredis'

export const redisConnection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})
```

- [ ] **Step 2: Verificar que Redis está acessível**

```bash
redis-cli ping
```
Expected: `PONG`

- [ ] **Step 3: Commit**

```bash
git add src/lib/bullmq.ts
git commit -m "feat: add Redis connection for BullMQ"
```

---

### Task 4: Criar utilitários de alertas (anti-spam + criação)

**Files:**
- Create: `src/jobs/alerts/utils.ts`
- Test: `src/jobs/alerts/__tests__/utils.test.ts`

- [ ] **Step 1: Escrever o teste**

```typescript
// src/jobs/alerts/__tests__/utils.test.ts
import { describe, it, expect } from 'vitest'
import { isInSilenceWindow, buildAlertTitulo } from '../utils'

describe('isInSilenceWindow', () => {
  it('returns false when no config set', () => {
    expect(isInSilenceWindow({ horarioSilencioInicio: null, horarioSilencioFim: null })).toBe(false)
  })

  it('returns true when current time is within window', () => {
    const now = new Date()
    const h = now.getHours()
    const startH = h > 0 ? h - 1 : 0
    const endH = h < 23 ? h + 1 : 23
    const pad = (n: number) => String(n).padStart(2, '0')
    expect(
      isInSilenceWindow({
        horarioSilencioInicio: `${pad(startH)}:00`,
        horarioSilencioFim: `${pad(endH)}:00`,
      })
    ).toBe(true)
  })

  it('handles midnight crossing window', () => {
    expect(
      isInSilenceWindow({ horarioSilencioInicio: '23:00', horarioSilencioFim: '06:00' })
    ).toBeTypeOf('boolean')
  })
})

describe('buildAlertTitulo', () => {
  it('interpolates nome correctly', () => {
    expect(buildAlertTitulo('[Insumo] zerou o estoque', 'Frango')).toBe('Frango zerou o estoque')
  })
})
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
npm test -- src/jobs/alerts/__tests__/utils.test.ts
```
Expected: FAIL — `Cannot find module '../utils'`

- [ ] **Step 3: Criar `src/jobs/alerts/utils.ts`**

```typescript
import { prisma } from '@/lib/prisma'
import { TipoAlerta, Severidade } from '@prisma/client'
import type { Server as SocketIOServer } from 'socket.io'

export type CreateAlertPayload = {
  tenantId: string
  tipo: TipoAlerta
  severidade: Severidade
  titulo: string
  descricao: string
  insumoId?: string
  produtoId?: string
  metadata: Record<string, unknown>
}

export function buildAlertTitulo(template: string, nome: string): string {
  return template.replace('[Insumo]', nome).replace('[Produto]', nome)
}

export function isInSilenceWindow(config: {
  horarioSilencioInicio?: string | null
  horarioSilencioFim?: string | null
}): boolean {
  if (!config.horarioSilencioInicio || !config.horarioSilencioFim) return false
  const now = new Date()
  const cur = now.getHours() * 60 + now.getMinutes()
  const [sh, sm] = config.horarioSilencioInicio.split(':').map(Number)
  const [eh, em] = config.horarioSilencioFim.split(':').map(Number)
  const start = sh * 60 + sm
  const end = eh * 60 + em
  if (start <= end) return cur >= start && cur < end
  return cur >= start || cur < end // cruza meia-noite
}

export async function antiSpamEstoque(
  tenantId: string,
  insumoId: string,
): Promise<boolean> {
  const existing = await prisma.alert.findFirst({
    where: {
      tenantId,
      tipo: 'ESTOQUE',
      insumoId,
      status: { in: ['NAO_LIDO', 'LIDO'] },
    },
    select: { id: true },
  })
  return !!existing
}

export async function antiSpamFinanceiro(
  tenantId: string,
  subtipo: string,
): Promise<boolean> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const existing = await prisma.alert.findFirst({
    where: {
      tenantId,
      tipo: 'FINANCEIRO',
      criadoEm: { gte: startOfDay },
      metadata: { path: ['subtipo'], equals: subtipo },
    },
    select: { id: true },
  })
  return !!existing
}

export async function antiSpamOperacional(
  tenantId: string,
  subtipo: string,
): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const existing = await prisma.alert.findFirst({
    where: {
      tenantId,
      tipo: 'OPERACIONAL',
      status: { in: ['NAO_LIDO', 'LIDO'] },
      criadoEm: { gte: oneHourAgo },
      metadata: { path: ['subtipo'], equals: subtipo },
    },
    select: { id: true },
  })
  return !!existing
}

export async function createAlert(
  payload: CreateAlertPayload,
  io: SocketIOServer,
): Promise<void> {
  const alert = await prisma.alert.create({
    data: {
      tenantId: payload.tenantId,
      tipo: payload.tipo,
      severidade: payload.severidade,
      titulo: payload.titulo,
      descricao: payload.descricao,
      insumoId: payload.insumoId,
      produtoId: payload.produtoId,
      metadata: payload.metadata,
      status: 'NAO_LIDO',
    },
  })
  io.to(payload.tenantId).emit('alerta:novo', alert)
}
```

- [ ] **Step 4: Rodar o teste**

```bash
npm test -- src/jobs/alerts/__tests__/utils.test.ts
```
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/jobs/alerts/utils.ts src/jobs/alerts/__tests__/utils.test.ts
git commit -m "feat: add alert utils (anti-spam, silence window, createAlert)"
```

---

### Task 5: Job de alertas de estoque

**Files:**
- Create: `src/jobs/alerts/estoque.job.ts`

- [ ] **Step 1: Criar `src/jobs/alerts/estoque.job.ts`**

```typescript
import { prisma } from '@/lib/prisma'
import type { Server as SocketIOServer } from 'socket.io'
import { antiSpamEstoque, createAlert, isInSilenceWindow } from './utils'

export async function processEstoqueAlerts(io: SocketIOServer): Promise<void> {
  const tenants = await prisma.tenant.findMany({
    where: { active: true, deletedAt: null },
    select: { id: true },
  })

  for (const { id: tenantId } of tenants) {
    const config = await prisma.alertConfig.findFirst({
      where: { tenantId, tipoAlerta: 'ESTOQUE' },
    })
    if (config && !config.ativo) continue
    if (config && isInSilenceWindow(config as { horarioSilencioInicio?: string | null; horarioSilencioFim?: string | null })) continue

    const ingredients = await prisma.ingredient.findMany({
      where: { tenantId },
      select: {
        id: true, name: true, currentQty: true,
        minimumQty: true, pontoReposicao: true, dataValidade: true,
      },
    })

    for (const ing of ingredients) {
      // 1. Estoque zerado
      if (ing.currentQty === 0) {
        if (await antiSpamEstoque(tenantId, ing.id)) continue
        await createAlert({
          tenantId, tipo: 'ESTOQUE', severidade: 'CRITICA',
          titulo: `${ing.name} zerou o estoque`,
          descricao: `O insumo "${ing.name}" está com estoque zero.`,
          insumoId: ing.id,
          metadata: { subtipo: 'ESTOQUE_ZERADO', acao: 'Lançar entrada' },
        }, io)
        continue
      }

      // 2. Abaixo do mínimo
      if (ing.currentQty < ing.minimumQty) {
        if (await antiSpamEstoque(tenantId, ing.id)) continue
        await createAlert({
          tenantId, tipo: 'ESTOQUE', severidade: 'ALTA',
          titulo: `${ing.name} abaixo do mínimo (${ing.currentQty} unidades restantes)`,
          descricao: `Estoque atual: ${ing.currentQty}. Mínimo: ${ing.minimumQty}.`,
          insumoId: ing.id,
          metadata: { subtipo: 'ABAIXO_MINIMO', acao: 'Lançar entrada', qtdAtual: ing.currentQty, qtdMinima: ing.minimumQty },
        }, io)
        continue
      }

      // 3. Abaixo do ponto de reposição
      if (ing.pontoReposicao > 0 && ing.currentQty < ing.pontoReposicao) {
        if (await antiSpamEstoque(tenantId, ing.id)) continue
        await createAlert({
          tenantId, tipo: 'ESTOQUE', severidade: 'MEDIA',
          titulo: `${ing.name} chegando ao ponto de reposição`,
          descricao: `Estoque atual: ${ing.currentQty}. Ponto de reposição: ${ing.pontoReposicao}.`,
          insumoId: ing.id,
          metadata: { subtipo: 'PONTO_REPOSICAO', acao: 'Planejar compra' },
        }, io)
      }

      // 4 e 5. Validade
      if (ing.dataValidade) {
        const now = new Date()
        const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        const daysLeft = Math.ceil((ing.dataValidade.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        if (ing.dataValidade < now) {
          if (await antiSpamEstoque(tenantId, ing.id)) continue
          await createAlert({
            tenantId, tipo: 'ESTOQUE', severidade: 'CRITICA',
            titulo: `${ing.name} está vencido — remover do estoque`,
            descricao: `Venceu em ${ing.dataValidade.toLocaleDateString('pt-BR')}.`,
            insumoId: ing.id,
            metadata: { subtipo: 'VENCIDO', acao: 'Lançar baixa' },
          }, io)
        } else if (ing.dataValidade <= sevenDays) {
          if (await antiSpamEstoque(tenantId, ing.id)) continue
          await createAlert({
            tenantId, tipo: 'ESTOQUE', severidade: 'ALTA',
            titulo: `${ing.name} vence em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}`,
            descricao: `Data de validade: ${ing.dataValidade.toLocaleDateString('pt-BR')}.`,
            insumoId: ing.id,
            metadata: { subtipo: 'PROXIMO_VENCIMENTO', acao: 'Ver insumo', diasRestantes: daysLeft },
          }, io)
        }
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/jobs/alerts/estoque.job.ts
git commit -m "feat: add estoque alert job (zerado, mínimo, reposição, validade)"
```

---

### Task 6: Job de alertas financeiros

**Files:**
- Create: `src/jobs/alerts/financeiro.job.ts`

- [ ] **Step 1: Criar `src/jobs/alerts/financeiro.job.ts`**

```typescript
import { prisma } from '@/lib/prisma'
import type { Server as SocketIOServer } from 'socket.io'
import { antiSpamFinanceiro, createAlert, isInSilenceWindow } from './utils'

const BENCHMARK = parseFloat(process.env.DEFAULT_CMV_BENCHMARK ?? '35')

export async function processFinanceiroAlerts(io: SocketIOServer): Promise<void> {
  const tenants = await prisma.tenant.findMany({
    where: { active: true, deletedAt: null },
    select: { id: true },
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const { id: tenantId } of tenants) {
    const config = await prisma.alertConfig.findFirst({
      where: { tenantId, tipoAlerta: 'FINANCEIRO' },
    })
    if (config && !config.ativo) continue
    if (config && isInSilenceWindow(config as { horarioSilencioInicio?: string | null; horarioSilencioFim?: string | null })) continue

    // Pegar pedidos finalizados hoje
    const pedidosHoje = await prisma.pedido.findMany({
      where: { tenantId, status: 'FINALIZADO', fechadoEm: { gte: today } },
      select: { total: true, subtotal: true },
    })

    if (pedidosHoje.length === 0) continue

    const totalVendas = pedidosHoje.reduce((s, p) => s + p.total, 0)
    const totalPedidos = pedidosHoje.length
    const ticketMedio = totalVendas / totalPedidos

    // CMV do dia: pegar movimentações OUT de hoje
    const movimentacoesHoje = await prisma.ingredientMovement.findMany({
      where: { tenantId, type: 'OUT', createdAt: { gte: today } },
      select: { totalCost: true },
    })
    const cmvTotal = movimentacoesHoje.reduce((s, m) => s + (m.totalCost ?? 0), 0)
    const cmvPercentual = totalVendas > 0 ? (cmvTotal / totalVendas) * 100 : 0

    // 1. CMV acima do benchmark
    if (cmvPercentual > 38) {
      if (!(await antiSpamFinanceiro(tenantId, 'CMV_ELEVADO'))) {
        await createAlert({
          tenantId, tipo: 'FINANCEIRO', severidade: 'ALTA',
          titulo: `CMV elevado hoje: ${cmvPercentual.toFixed(1)}% (benchmark: ${BENCHMARK}%)`,
          descricao: `CMV do dia: R$ ${cmvTotal.toFixed(2)} sobre R$ ${totalVendas.toFixed(2)} em vendas.`,
          metadata: { subtipo: 'CMV_ELEVADO', acao: 'Ver relatório CMV', cmvPercentual, benchmark: BENCHMARK },
        }, io)
      }
    }

    // 2. CMV elevado por 3 dias consecutivos
    const ultimos3 = await prisma.dashboardSnapshot.findMany({
      where: { tenantId },
      orderBy: { data: 'desc' },
      take: 3,
      select: { cmvPercentual: true },
    })
    if (ultimos3.length === 3 && ultimos3.every((s) => Number(s.cmvPercentual) > BENCHMARK)) {
      if (!(await antiSpamFinanceiro(tenantId, 'CMV_CONSECUTIVO'))) {
        await createAlert({
          tenantId, tipo: 'FINANCEIRO', severidade: 'CRITICA',
          titulo: `CMV acima do benchmark por 3 dias consecutivos`,
          descricao: `Médias: ${ultimos3.map((s) => `${Number(s.cmvPercentual).toFixed(1)}%`).join(', ')}.`,
          metadata: { subtipo: 'CMV_CONSECUTIVO', acao: 'Ver relatório CMV' },
        }, io)
      }
    }

    // 3. Queda de vendas — comparar com média dos últimos 7 dias
    const seteDiasAtras = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const snapshotsRecentes = await prisma.dashboardSnapshot.findMany({
      where: { tenantId, data: { gte: seteDiasAtras, lt: today } },
      select: { totalVendas: true },
    })
    if (snapshotsRecentes.length >= 3) {
      const mediaVendas = snapshotsRecentes.reduce((s, snap) => s + Number(snap.totalVendas), 0) / snapshotsRecentes.length
      if (totalVendas < mediaVendas * 0.7) {
        const quedaPct = Math.round((1 - totalVendas / mediaVendas) * 100)
        if (!(await antiSpamFinanceiro(tenantId, 'QUEDA_VENDAS'))) {
          await createAlert({
            tenantId, tipo: 'FINANCEIRO', severidade: 'ALTA',
            titulo: `Vendas ${quedaPct}% abaixo da média desta semana`,
            descricao: `Vendas hoje: R$ ${totalVendas.toFixed(2)}. Média 7 dias: R$ ${mediaVendas.toFixed(2)}.`,
            metadata: { subtipo: 'QUEDA_VENDAS', acao: 'Ver relatório de vendas', quedaPct },
          }, io)
        }
      }
    }

    // 4. Meta diária atingida (config threshold.metaDiaria)
    const metaDiaria = config && typeof (config.threshold as Record<string, number>).metaDiaria === 'number'
      ? (config.threshold as Record<string, number>).metaDiaria
      : null
    if (metaDiaria && totalVendas >= metaDiaria) {
      if (!(await antiSpamFinanceiro(tenantId, 'META_ATINGIDA'))) {
        await createAlert({
          tenantId, tipo: 'FINANCEIRO', severidade: 'INFO',
          titulo: `Meta do dia atingida! R$ ${totalVendas.toFixed(2)} vendidos`,
          descricao: `Meta: R$ ${metaDiaria.toFixed(2)}. Parabéns!`,
          metadata: { subtipo: 'META_ATINGIDA', acao: 'Ver relatório', totalVendas, meta: metaDiaria },
        }, io)
      }
    }

    // 5. Queda do ticket médio (últimos 3 dias vs últimos 30 dias)
    const trintaDiasAtras = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
    const [snapshots3, snapshots30] = await Promise.all([
      prisma.dashboardSnapshot.findMany({
        where: { tenantId, data: { gte: seteDiasAtras } },
        orderBy: { data: 'desc' },
        take: 3,
        select: { ticketMedio: true },
      }),
      prisma.dashboardSnapshot.findMany({
        where: { tenantId, data: { gte: trintaDiasAtras } },
        select: { ticketMedio: true },
      }),
    ])
    if (snapshots3.length === 3 && snapshots30.length >= 7) {
      const media3 = snapshots3.reduce((s, snap) => s + Number(snap.ticketMedio), 0) / 3
      const media30 = snapshots30.reduce((s, snap) => s + Number(snap.ticketMedio), 0) / snapshots30.length
      if (media3 < media30 * 0.85) {
        if (!(await antiSpamFinanceiro(tenantId, 'TICKET_QUEDA'))) {
          await createAlert({
            tenantId, tipo: 'FINANCEIRO', severidade: 'MEDIA',
            titulo: `Ticket médio em queda nos últimos 3 dias`,
            descricao: `Ticket médio 3 dias: R$ ${media3.toFixed(2)}. Média 30 dias: R$ ${media30.toFixed(2)}.`,
            metadata: { subtipo: 'TICKET_QUEDA', acao: 'Ver relatório', media3, media30 },
          }, io)
        }
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/jobs/alerts/financeiro.job.ts
git commit -m "feat: add financeiro alert job (CMV, vendas, meta, ticket médio)"
```

---

### Task 7: Job de alertas operacionais

**Files:**
- Create: `src/jobs/alerts/operacional.job.ts`

- [ ] **Step 1: Criar `src/jobs/alerts/operacional.job.ts`**

```typescript
import { prisma } from '@/lib/prisma'
import type { Server as SocketIOServer } from 'socket.io'
import { antiSpamOperacional, createAlert, isInSilenceWindow } from './utils'

const TEMPO_PREPARO_ALERTA = parseInt(process.env.DEFAULT_TEMPO_PREPARO_ALERTA ?? '20')
const OPERATIONAL_HOURS = { start: 6, end: 23 } // 06:00–23:00 fallback

function isWithinOperationalHours(): boolean {
  const h = new Date().getHours()
  return h >= OPERATIONAL_HOURS.start && h < OPERATIONAL_HOURS.end
}

export async function processOperacionalAlerts(io: SocketIOServer): Promise<void> {
  if (!isWithinOperationalHours()) return

  const tenants = await prisma.tenant.findMany({
    where: { active: true, deletedAt: null },
    select: { id: true },
  })

  const now = new Date()
  const dezMinAtras = new Date(now.getTime() - 10 * 60 * 1000)
  const umaHoraAtras = new Date(now.getTime() - 60 * 60 * 1000)

  for (const { id: tenantId } of tenants) {
    const config = await prisma.alertConfig.findFirst({
      where: { tenantId, tipoAlerta: 'OPERACIONAL' },
    })
    if (config && !config.ativo) continue
    if (config && isInSilenceWindow(config as { horarioSilencioInicio?: string | null; horarioSilencioFim?: string | null })) continue

    const thresholdPedidosParados: number =
      config && typeof (config.threshold as Record<string, number>).pedidosParados === 'number'
        ? (config.threshold as Record<string, number>).pedidosParados
        : 5

    // 1. Pedidos parados na fila
    const pedidosParados = await prisma.pedido.count({
      where: {
        tenantId,
        status: 'ABERTO',
        criadoEm: { lte: dezMinAtras },
      },
    })
    if (pedidosParados >= thresholdPedidosParados) {
      if (!(await antiSpamOperacional(tenantId, 'PEDIDOS_PARADOS'))) {
        await createAlert({
          tenantId, tipo: 'OPERACIONAL', severidade: 'ALTA',
          titulo: `${pedidosParados} pedidos parados na fila da cozinha`,
          descricao: `${pedidosParados} pedidos com status "Aberto" sem movimentação por mais de 10 minutos.`,
          metadata: { subtipo: 'PEDIDOS_PARADOS', acao: 'Ver cozinha', qtd: pedidosParados },
        }, io)
      }
    }

    // 2. Alto volume de cancelamentos na última hora
    const cancelamentos = await prisma.pedido.count({
      where: {
        tenantId,
        status: 'CANCELADO',
        fechadoEm: { gte: umaHoraAtras },
      },
    })
    if (cancelamentos > 3) {
      if (!(await antiSpamOperacional(tenantId, 'CANCELAMENTOS'))) {
        await createAlert({
          tenantId, tipo: 'OPERACIONAL', severidade: 'ALTA',
          titulo: `Alto volume de cancelamentos — verificar operação`,
          descricao: `${cancelamentos} cancelamentos na última hora.`,
          metadata: { subtipo: 'CANCELAMENTOS', acao: 'Ver pedidos', qtd: cancelamentos },
        }, io)
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/jobs/alerts/operacional.job.ts
git commit -m "feat: add operacional alert job (pedidos parados, cancelamentos)"
```

---

### Task 8: Registrar workers BullMQ no server.ts

**Files:**
- Create: `src/jobs/alerts/index.ts`
- Create: `src/jobs/dashboard/index.ts`
- Modify: `server.ts`

- [ ] **Step 1: Criar `src/jobs/alerts/index.ts`**

```typescript
import { Queue, Worker } from 'bullmq'
import { redisConnection } from '@/lib/bullmq'
import type { Server as SocketIOServer } from 'socket.io'
import { processEstoqueAlerts } from './estoque.job'
import { processFinanceiroAlerts } from './financeiro.job'
import { processOperacionalAlerts } from './operacional.job'

export async function startAlertWorkers(io: SocketIOServer): Promise<void> {
  const estoqueInterval = parseInt(process.env.ALERT_JOB_INTERVAL_MS ?? '3600000')
  const operacionalInterval = parseInt(process.env.KDS_ALERT_JOB_INTERVAL_MS ?? '1800000')

  const estoqueQueue = new Queue('alerts:estoque', { connection: redisConnection })
  await estoqueQueue.add('run', {}, { repeat: { every: estoqueInterval }, jobId: 'estoque-repeat' })
  new Worker('alerts:estoque', () => processEstoqueAlerts(io), { connection: redisConnection })

  const financeiroQueue = new Queue('alerts:financeiro', { connection: redisConnection })
  await financeiroQueue.add('run', {}, { repeat: { pattern: '0 23 * * *' }, jobId: 'financeiro-repeat' })
  new Worker('alerts:financeiro', () => processFinanceiroAlerts(io), { connection: redisConnection })

  const operacionalQueue = new Queue('alerts:operacional', { connection: redisConnection })
  await operacionalQueue.add('run', {}, { repeat: { every: operacionalInterval }, jobId: 'operacional-repeat' })
  new Worker('alerts:operacional', () => processOperacionalAlerts(io), { connection: redisConnection })

  console.log('> Alert workers started')
}
```

- [ ] **Step 2: Criar `src/jobs/dashboard/index.ts`**

```typescript
import { Queue, Worker } from 'bullmq'
import { redisConnection } from '@/lib/bullmq'
import { processDashboardSnapshot } from './snapshot.job'

export async function startDashboardWorkers(): Promise<void> {
  const snapshotQueue = new Queue('dashboard:snapshot', { connection: redisConnection })
  await snapshotQueue.add('run', {}, { repeat: { pattern: '50 23 * * *' }, jobId: 'snapshot-repeat' })
  new Worker('dashboard:snapshot', () => processDashboardSnapshot(), { connection: redisConnection })
  console.log('> Dashboard workers started')
}
```

- [ ] **Step 3: Modificar `server.ts` para registrar workers**

Substituir o conteúdo de `server.ts` por:

```typescript
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIO } from 'socket.io'
import { startAlertWorkers } from './src/jobs/alerts'
import { startDashboardWorkers } from './src/jobs/dashboard'

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(async () => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  })

  const io = new SocketIO(httpServer, {
    path: '/api/socket',
    cors: { origin: '*' },
  })

  ;(global as { io?: SocketIO }).io = io

  io.on('connection', (socket) => {
    socket.on('join:tenant', (tenantId: string) => {
      socket.join(tenantId)
    })
  })

  await startAlertWorkers(io)
  await startDashboardWorkers()

  const port = parseInt(process.env.PORT ?? '3000', 10)
  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`)
  })
})
```

- [ ] **Step 4: Verificar compilação**

```bash
npx tsc --noEmit
```
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/jobs/alerts/index.ts src/jobs/dashboard/index.ts server.ts
git commit -m "feat: register BullMQ alert and dashboard workers in server.ts"
```

---

### Task 9: Job de DashboardSnapshot

**Files:**
- Create: `src/jobs/dashboard/snapshot.job.ts`

- [ ] **Step 1: Criar `src/jobs/dashboard/snapshot.job.ts`**

```typescript
import { prisma } from '@/lib/prisma'

export async function processDashboardSnapshot(): Promise<void> {
  const tenants = await prisma.tenant.findMany({
    where: { active: true, deletedAt: null },
    select: { id: true },
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const { id: tenantId } of tenants) {
    const pedidos = await prisma.pedido.findMany({
      where: { tenantId, status: 'FINALIZADO', fechadoEm: { gte: today } },
      select: { total: true, itens: { select: { productId: true, quantidade: true } } },
    })

    if (pedidos.length === 0) continue

    const totalVendas = pedidos.reduce((s, p) => s + p.total, 0)
    const totalPedidos = pedidos.length
    const ticketMedio = totalVendas / totalPedidos

    // CMV: movimentações OUT do dia
    const movs = await prisma.ingredientMovement.findMany({
      where: { tenantId, type: 'OUT', createdAt: { gte: today } },
      select: { totalCost: true },
    })
    const cmvTotal = movs.reduce((s, m) => s + (m.totalCost ?? 0), 0)
    const cmvPercentual = totalVendas > 0 ? (cmvTotal / totalVendas) * 100 : 0

    // Produto mais vendido
    const contagemProdutos: Record<string, number> = {}
    for (const pedido of pedidos) {
      for (const item of pedido.itens) {
        contagemProdutos[item.productId] = (contagemProdutos[item.productId] ?? 0) + item.quantidade
      }
    }
    const produtoMaisVendidoId = Object.entries(contagemProdutos)
      .sort(([, a], [, b]) => b - a)[0]?.[0] ?? null

    await prisma.dashboardSnapshot.upsert({
      where: { tenantId_data: { tenantId, data: today } },
      create: {
        tenantId, data: today,
        totalVendas, totalPedidos, ticketMedio, cmvTotal, cmvPercentual,
        produtoMaisVendidoId,
      },
      update: {
        totalVendas, totalPedidos, ticketMedio, cmvTotal, cmvPercentual,
        produtoMaisVendidoId,
      },
    })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/jobs/dashboard/snapshot.job.ts
git commit -m "feat: add DashboardSnapshot BullMQ job (daily at 23:50)"
```

---

### Task 10: API routes de alertas

**Files:**
- Create: `src/app/api/alertas/route.ts`
- Create: `src/app/api/alertas/[id]/route.ts`
- Create: `src/app/api/alertas/count/route.ts`
- Create: `src/app/api/alert-configs/route.ts`
- Create: `src/app/api/alert-configs/[id]/route.ts`

- [ ] **Step 1: Criar `src/app/api/alertas/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'
import { TipoAlerta, StatusAlerta } from '@prisma/client'

export async function GET(req: NextRequest) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const { searchParams } = req.nextUrl
  const tipo = searchParams.get('tipo') as TipoAlerta | null
  const status = searchParams.get('status') as StatusAlerta | null
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  const busca = searchParams.get('busca') ?? ''
  const skip = (page - 1) * limit

  const where = {
    tenantId,
    ...(tipo ? { tipo } : {}),
    ...(status ? { status } : {}),
    ...(busca ? { titulo: { contains: busca, mode: 'insensitive' as const } } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.alert.findMany({
      where, orderBy: { criadoEm: 'desc' }, skip, take: limit,
    }),
    prisma.alert.count({ where }),
  ])

  return NextResponse.json({ items, total, page, limit, pages: Math.ceil(total / limit) })
}
```

- [ ] **Step 2: Criar `src/app/api/alertas/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'
import { z } from 'zod'

const schema = z.object({
  status: z.enum(['LIDO', 'RESOLVIDO', 'IGNORADO']),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Status inválido' }, { status: 400 })

  const { status } = parsed.data
  const data: Record<string, unknown> = { status }
  if (status === 'LIDO') data.lidoEm = new Date()
  if (status === 'RESOLVIDO') data.resolvidoEm = new Date()

  const alert = await prisma.alert.updateMany({
    where: { id: params.id, tenantId },
    data,
  })

  if (alert.count === 0) return NextResponse.json({ error: 'Alerta não encontrado' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Criar `src/app/api/alertas/count/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

export async function GET() {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const count = await prisma.alert.count({
    where: { tenantId, status: 'NAO_LIDO' },
  })

  return NextResponse.json({ count })
}
```

- [ ] **Step 4: Criar `src/app/api/alert-configs/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

export async function GET() {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const configs = await prisma.alertConfig.findMany({ where: { tenantId } })
  return NextResponse.json(configs)
}
```

- [ ] **Step 5: Criar `src/app/api/alert-configs/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'
import { z } from 'zod'

const schema = z.object({
  ativo: z.boolean().optional(),
  threshold: z.record(z.unknown()).optional(),
  canais: z.object({
    sistema: z.boolean(),
    email: z.array(z.string()),
    whatsapp: z.array(z.string()),
  }).optional(),
  horarioSilencioInicio: z.string().nullable().optional(),
  horarioSilencioFim: z.string().nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })

  const config = await prisma.alertConfig.updateMany({
    where: { id: params.id, tenantId },
    data: parsed.data as Record<string, unknown>,
  })

  if (config.count === 0) return NextResponse.json({ error: 'Config não encontrada' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/alertas/ src/app/api/alert-configs/
git commit -m "feat: add alert and alert-config API routes"
```

---

### Task 11: AlertsProvider e AlertsBadge no Header

**Files:**
- Create: `src/components/alerts/AlertsProvider.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/components/layout/header.tsx`

- [ ] **Step 1: Criar `src/components/alerts/AlertsProvider.tsx`**

```tsx
'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { getSocket } from '@/lib/socket-client'

type AlertsContextValue = {
  unreadCount: number
  increment: () => void
}

const AlertsContext = createContext<AlertsContextValue>({ unreadCount: 0, increment: () => {} })

export function useAlerts() {
  return useContext(AlertsContext)
}

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!session?.user?.tenantId) return

    fetch('/api/alertas/count')
      .then((r) => r.json())
      .then((data) => setUnreadCount(data.count ?? 0))
      .catch(() => {})

    const socket = getSocket()
    socket.emit('join:tenant', session.user.tenantId)

    const handler = () => setUnreadCount((c) => c + 1)
    socket.on('alerta:novo', handler)
    return () => { socket.off('alerta:novo', handler) }
  }, [session?.user?.tenantId])

  return (
    <AlertsContext.Provider value={{ unreadCount, increment: () => setUnreadCount((c) => c + 1) }}>
      {children}
    </AlertsContext.Provider>
  )
}
```

- [ ] **Step 2: Modificar `src/app/(dashboard)/layout.tsx`**

```tsx
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { AlertsProvider } from '@/components/alerts/AlertsProvider'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AlertsProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </AlertsProvider>
  )
}
```

- [ ] **Step 3: Adicionar AlertsBadge ao `src/components/layout/header.tsx`**

Adicionar import e badge no bloco `<div className="flex items-center gap-2">` antes do dropdown. Substituir a linha `<div className="flex items-center gap-2">` da direita:

```tsx
// Adicionar ao topo dos imports existentes:
import { Bell } from 'lucide-react'
import { useAlerts } from '@/components/alerts/AlertsProvider'
import Link from 'next/link'

// Adicionar no início do componente Header():
const { unreadCount } = useAlerts()

// Adicionar dentro de <div className="flex items-center gap-2"> (antes do theme toggle):
<Link href="/alertas" className="relative p-2 rounded-lg transition-colors"
  style={{ color: 'var(--tf-txt3)', background: 'transparent' }}>
  <Bell className="w-4 h-4" />
  {unreadCount > 0 && (
    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-white"
      style={{ minWidth: 16, height: 16, fontSize: 10, fontWeight: 700, background: 'var(--tf-red)', padding: '0 3px' }}>
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  )}
</Link>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/alerts/AlertsProvider.tsx src/app/(dashboard)/layout.tsx src/components/layout/header.tsx
git commit -m "feat: add AlertsProvider with real-time badge in header"
```

---

### Task 12: AlertsDrawer — painel lateral com últimos 5 alertas

**Files:**
- Create: `src/components/alerts/AlertsDrawer.tsx`
- Modify: `src/components/layout/header.tsx` (adicionar botão para abrir o drawer)

- [ ] **Step 1: Criar `src/components/alerts/AlertsDrawer.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { X, AlertTriangle, TrendingDown, Settings2, Info } from 'lucide-react'
import Link from 'next/link'

type Alert = { id: string; tipo: string; severidade: string; titulo: string; criadoEm: string; metadata: Record<string, unknown> }

const TIPO_ICON: Record<string, React.ReactNode> = {
  ESTOQUE: <AlertTriangle className="w-3.5 h-3.5" />,
  FINANCEIRO: <TrendingDown className="w-3.5 h-3.5" />,
  OPERACIONAL: <Settings2 className="w-3.5 h-3.5" />,
  SISTEMA: <Info className="w-3.5 h-3.5" />,
}

const SEV_COLOR: Record<string, string> = {
  CRITICA: 'var(--tf-red)', ALTA: '#f97316', MEDIA: '#eab308', BAIXA: 'var(--tf-txt3)', INFO: '#22c55e',
}

const ACAO_MAP: Record<string, string> = {
  'Lançar entrada': '/estoque/insumos',
  'Ver relatório CMV': '/relatorios',
  'Ver insumo': '/estoque/insumos',
  'Lançar baixa': '/estoque/insumos',
}

export function AlertsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data = [] } = useQuery<Alert[]>({
    queryKey: ['alerts-drawer'],
    queryFn: () =>
      fetch('/api/alertas?limit=5&status=NAO_LIDO')
        .then((r) => r.json())
        .then((d) => d.items ?? []),
    staleTime: 60_000,
    enabled: open,
  })

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-80 z-50 flex flex-col"
        style={{ background: 'var(--tf-surface)', borderLeft: '1px solid var(--tf-border)', boxShadow: '-4px 0 20px rgba(0,0,0,0.15)' }}>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid var(--tf-border)' }}>
          <p className="font-semibold text-sm" style={{ color: 'var(--tf-txt)' }}>Alertas recentes</p>
          <button onClick={onClose} style={{ color: 'var(--tf-txt3)', background: 'none', border: 'none', cursor: 'pointer' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {data.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--tf-txt3)', textAlign: 'center', marginTop: 20 }}>
              Nenhum alerta não lido
            </p>
          )}
          {data.map((a) => {
            const acao = (a.metadata?.acao as string) ?? ''
            const href = ACAO_MAP[acao] ?? '/alertas'
            return (
              <div key={a.id} className="rounded-lg p-3 space-y-1"
                style={{ background: 'var(--tf-surface2)', border: '1px solid var(--tf-border)' }}>
                <div className="flex items-center gap-2">
                  <span style={{ color: SEV_COLOR[a.severidade] }}>{TIPO_ICON[a.tipo]}</span>
                  <span style={{ fontSize: 11, color: 'var(--tf-txt3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {a.tipo}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--tf-txt)', lineHeight: 1.4 }}>{a.titulo}</p>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: 11, color: 'var(--tf-txt3)' }}>
                    {formatDistanceToNow(new Date(a.criadoEm), { addSuffix: true, locale: ptBR })}
                  </span>
                  {acao && (
                    <Link href={href} onClick={onClose}
                      style={{ fontSize: 11, color: 'var(--tf-green)', fontWeight: 600 }}>
                      {acao} →
                    </Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="p-4" style={{ borderTop: '1px solid var(--tf-border)' }}>
          <Link href="/alertas" onClick={onClose}
            className="block text-center text-sm py-2 rounded-lg font-medium"
            style={{ background: 'var(--tf-surface2)', color: 'var(--tf-txt2)', border: '1px solid var(--tf-border)' }}>
            Ver todos os alertas
          </Link>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Integrar AlertsDrawer no Header**

Em `src/components/layout/header.tsx`, adicionar estado `drawerOpen` e renderizar o drawer. Substituir o `<Link href="/alertas">` do badge por um `<button>` que abre o drawer:

```tsx
// Adicionar imports:
import { AlertsDrawer } from '@/components/alerts/AlertsDrawer'

// Adicionar no componente Header:
const [drawerOpen, setDrawerOpen] = useState(false)

// Substituir o Link do badge por:
<button onClick={() => setDrawerOpen(true)} className="relative p-2 rounded-lg transition-colors"
  style={{ color: 'var(--tf-txt3)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
  <Bell className="w-4 h-4" />
  {unreadCount > 0 && (
    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-white"
      style={{ minWidth: 16, height: 16, fontSize: 10, fontWeight: 700, background: 'var(--tf-red)', padding: '0 3px' }}>
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  )}
</button>
<AlertsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/alerts/AlertsDrawer.tsx src/components/layout/header.tsx
git commit -m "feat: add AlertsDrawer lateral panel with last 5 unread alerts"
```

---

### Task 13: Página /alertas

**Files:**
- Create: `src/app/(dashboard)/alertas/page.tsx`
- Create: `src/app/(dashboard)/alertas/loading.tsx`

- [ ] **Step 1: Criar `src/app/(dashboard)/alertas/loading.tsx`**

```tsx
export default function Loading() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-16 rounded-lg animate-pulse" style={{ background: 'var(--tf-surface2)' }} />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Criar `src/app/(dashboard)/alertas/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, AlertTriangle, Info, TrendingDown, Settings2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Alert = {
  id: string
  tipo: 'ESTOQUE' | 'FINANCEIRO' | 'OPERACIONAL' | 'SISTEMA'
  severidade: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAIXA' | 'INFO'
  titulo: string
  descricao: string
  status: 'NAO_LIDO' | 'LIDO' | 'RESOLVIDO' | 'IGNORADO'
  criadoEm: string
  metadata: Record<string, unknown>
}

const TIPO_ICON: Record<string, React.ReactNode> = {
  ESTOQUE: <AlertTriangle className="w-4 h-4" />,
  FINANCEIRO: <TrendingDown className="w-4 h-4" />,
  OPERACIONAL: <Settings2 className="w-4 h-4" />,
  SISTEMA: <Info className="w-4 h-4" />,
}

const SEVERIDADE_COLOR: Record<string, string> = {
  CRITICA: 'var(--tf-red)',
  ALTA: '#f97316',
  MEDIA: '#eab308',
  BAIXA: 'var(--tf-txt3)',
  INFO: '#22c55e',
}

const STATUS_LABEL: Record<string, string> = {
  NAO_LIDO: 'Não lido',
  LIDO: 'Lido',
  RESOLVIDO: 'Resolvido',
  IGNORADO: 'Ignorado',
}

export default function AlertasPage() {
  const [tipo, setTipo] = useState('')
  const [status, setStatus] = useState('')
  const [busca, setBusca] = useState('')
  const [page, setPage] = useState(1)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['alertas', tipo, status, busca, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (tipo) params.set('tipo', tipo)
      if (status) params.set('status', status)
      if (busca) params.set('busca', busca)
      const r = await fetch(`/api/alertas?${params}`)
      return r.json() as Promise<{ items: Alert[]; total: number; pages: number }>
    },
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      await fetch(`/api/alertas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alertas'] }),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--tf-txt)', margin: 0 }}>
          Central de Alertas
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--tf-txt3)', marginTop: 3 }}>
          Histórico completo de alertas do sistema
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Buscar alertas..."
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-lg text-sm border"
          style={{ background: 'var(--tf-surface)', borderColor: 'var(--tf-border)', color: 'var(--tf-txt)', minWidth: 220 }}
        />
        <select value={tipo} onChange={(e) => { setTipo(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-lg text-sm border"
          style={{ background: 'var(--tf-surface)', borderColor: 'var(--tf-border)', color: 'var(--tf-txt)' }}>
          <option value="">Todos os tipos</option>
          <option value="ESTOQUE">Estoque</option>
          <option value="FINANCEIRO">Financeiro</option>
          <option value="OPERACIONAL">Operacional</option>
          <option value="SISTEMA">Sistema</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-lg text-sm border"
          style={{ background: 'var(--tf-surface)', borderColor: 'var(--tf-border)', color: 'var(--tf-txt)' }}>
          <option value="">Todos os status</option>
          <option value="NAO_LIDO">Não lido</option>
          <option value="LIDO">Lido</option>
          <option value="RESOLVIDO">Resolvido</option>
          <option value="IGNORADO">Ignorado</option>
        </select>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {isLoading && <p style={{ color: 'var(--tf-txt3)', fontSize: 13 }}>Carregando...</p>}
        {data?.items.map((alert) => (
          <div key={alert.id} className="rounded-lg p-4 flex items-start gap-3"
            style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)' }}>
            <span style={{ color: SEVERIDADE_COLOR[alert.severidade], marginTop: 2 }}>
              {TIPO_ICON[alert.tipo]}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: 'var(--tf-txt)' }}>{alert.titulo}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--tf-txt3)' }}>{alert.descricao}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--tf-txt3)' }}>
                {formatDistanceToNow(new Date(alert.criadoEm), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
            <select
              value={alert.status}
              onChange={(e) => updateStatus.mutate({ id: alert.id, newStatus: e.target.value })}
              className="text-xs px-2 py-1 rounded border"
              style={{ background: 'var(--tf-surface2)', borderColor: 'var(--tf-border)', color: 'var(--tf-txt)' }}>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Paginação */}
      {data && data.pages > 1 && (
        <div className="flex gap-2">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40"
            style={{ background: 'var(--tf-surface)', borderColor: 'var(--tf-border)', color: 'var(--tf-txt)' }}>
            Anterior
          </button>
          <span className="px-3 py-1.5 text-sm" style={{ color: 'var(--tf-txt3)' }}>
            {page} / {data.pages}
          </span>
          <button disabled={page === data.pages} onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40"
            style={{ background: 'var(--tf-surface)', borderColor: 'var(--tf-border)', color: 'var(--tf-txt)' }}>
            Próxima
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/alertas/
git commit -m "feat: add /alertas page with filters and inline status update"
```

---

### Task 13: Página /configuracoes/alertas

**Files:**
- Create: `src/app/(dashboard)/configuracoes/alertas/page.tsx`

- [ ] **Step 1: Criar `src/app/(dashboard)/configuracoes/alertas/page.tsx`**

```tsx
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

type AlertConfig = {
  id: string
  tipoAlerta: string
  ativo: boolean
  threshold: Record<string, number>
  canais: { sistema: boolean; email: string[]; whatsapp: string[] }
  horarioSilencioInicio: string | null
  horarioSilencioFim: string | null
}

const TIPO_LABELS: Record<string, string> = {
  ESTOQUE: 'Alertas de Estoque',
  FINANCEIRO: 'Alertas Financeiros',
  OPERACIONAL: 'Alertas Operacionais',
}

const DEFAULT_CONFIGS: Omit<AlertConfig, 'id'>[] = [
  { tipoAlerta: 'ESTOQUE', ativo: true, threshold: { diasVencimento: 7 }, canais: { sistema: true, email: [], whatsapp: [] }, horarioSilencioInicio: null, horarioSilencioFim: null },
  { tipoAlerta: 'FINANCEIRO', ativo: true, threshold: { cmvBenchmark: 35, metaDiaria: 0 }, canais: { sistema: true, email: [], whatsapp: [] }, horarioSilencioInicio: null, horarioSilencioFim: null },
  { tipoAlerta: 'OPERACIONAL', ativo: true, threshold: { pedidosParados: 5 }, canais: { sistema: true, email: [], whatsapp: [] }, horarioSilencioInicio: '00:00', horarioSilencioFim: '06:00' },
]

export default function ConfiguracoesAlertasPage() {
  const qc = useQueryClient()
  const { data: configs = [] } = useQuery<AlertConfig[]>({
    queryKey: ['alert-configs'],
    queryFn: () => fetch('/api/alert-configs').then((r) => r.json()),
  })

  const save = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AlertConfig> }) => {
      const r = await fetch(`/api/alert-configs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!r.ok) throw new Error('Erro ao salvar')
    },
    onSuccess: () => {
      toast.success('Configuração salva')
      qc.invalidateQueries({ queryKey: ['alert-configs'] })
    },
    onError: () => toast.error('Erro ao salvar configuração'),
  })

  const displayConfigs = DEFAULT_CONFIGS.map((def) => {
    const existing = configs.find((c) => c.tipoAlerta === def.tipoAlerta)
    return existing ?? { ...def, id: '' }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--tf-txt)', margin: 0 }}>
          Configurações de Alertas
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--tf-txt3)', marginTop: 3 }}>
          Configure quando e como receber alertas do sistema
        </p>
      </div>

      {displayConfigs.map((config) => (
        <ConfigCard key={config.tipoAlerta} config={config}
          onSave={(data) => config.id ? save.mutate({ id: config.id, data }) : toast.error('Config não criada ainda')} />
      ))}
    </div>
  )
}

function ConfigCard({ config, onSave }: { config: AlertConfig & { id: string }; onSave: (data: Partial<AlertConfig>) => void }) {
  const [ativo, setAtivo] = useState(config.ativo)
  const [silencioInicio, setSilencioInicio] = useState(config.horarioSilencioInicio ?? '')
  const [silencioFim, setSilencioFim] = useState(config.horarioSilencioFim ?? '')

  return (
    <div className="rounded-lg p-5 space-y-4" style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)' }}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold" style={{ color: 'var(--tf-txt)', fontSize: 15 }}>
          {TIPO_LABELS[config.tipoAlerta] ?? config.tipoAlerta}
        </h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <span style={{ fontSize: 13, color: 'var(--tf-txt3)' }}>Ativo</span>
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="w-4 h-4" />
        </label>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--tf-txt3)' }}>Horário de silêncio início</label>
          <input type="time" value={silencioInicio} onChange={(e) => setSilencioInicio(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm border"
            style={{ background: 'var(--tf-surface2)', borderColor: 'var(--tf-border)', color: 'var(--tf-txt)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--tf-txt3)' }}>Horário de silêncio fim</label>
          <input type="time" value={silencioFim} onChange={(e) => setSilencioFim(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm border"
            style={{ background: 'var(--tf-surface2)', borderColor: 'var(--tf-border)', color: 'var(--tf-txt)' }} />
        </div>
      </div>

      <div className="flex gap-2">
        <span className="text-xs px-2 py-1 rounded" style={{ background: 'var(--tf-surface2)', color: 'var(--tf-txt3)' }}>
          Sistema: sempre ativo
        </span>
        <span className="text-xs px-2 py-1 rounded opacity-50" style={{ background: 'var(--tf-surface2)', color: 'var(--tf-txt3)' }}>
          WhatsApp: Fase 3
        </span>
      </div>

      <button
        onClick={() => onSave({ ativo, horarioSilencioInicio: silencioInicio || null, horarioSilencioFim: silencioFim || null })}
        className="px-4 py-2 rounded-lg text-sm font-medium"
        style={{ background: 'var(--tf-green)', color: '#fff' }}>
        Salvar
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/configuracoes/alertas/
git commit -m "feat: add /configuracoes/alertas page for alert config management"
```

---

### Task 14: API routes do dashboard expandido

**Files:**
- Create: `src/app/api/dashboard/kpis/route.ts`
- Create: `src/app/api/dashboard/grafico/route.ts`
- Create: `src/app/api/dashboard/heatmap/route.ts`
- Create: `src/app/api/dashboard/estoque-critico/route.ts`
- Create: `src/app/api/dashboard/caixa/route.ts`

- [ ] **Step 1: Criar `src/app/api/dashboard/kpis/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

export async function GET() {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [pedidosHoje, pedidosAbertos] = await Promise.all([
    prisma.pedido.findMany({
      where: { tenantId, status: 'FINALIZADO', fechadoEm: { gte: today } },
      select: { total: true, garcomId: true },
    }),
    prisma.pedido.count({ where: { tenantId, status: { in: ['ABERTO', 'EM_PREPARO', 'PRONTO'] } } }),
  ])

  const totalVendas = pedidosHoje.reduce((s, p) => s + p.total, 0)
  const totalPedidos = pedidosHoje.length
  const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0

  // CMV
  const movs = await prisma.ingredientMovement.findMany({
    where: { tenantId, type: 'OUT', createdAt: { gte: today } },
    select: { totalCost: true },
  })
  const cmvTotal = movs.reduce((s, m) => s + (m.totalCost ?? 0), 0)
  const cmvPercentual = totalVendas > 0 ? (cmvTotal / totalVendas) * 100 : 0

  // Produto mais vendido
  const itens = await prisma.pedidoItem.findMany({
    where: { pedido: { tenantId, status: 'FINALIZADO', fechadoEm: { gte: today } } },
    select: { productId: true, quantidade: true, product: { select: { name: true } } },
  })
  const porProduto: Record<string, { nome: string; qtd: number }> = {}
  for (const item of itens) {
    if (!porProduto[item.productId]) porProduto[item.productId] = { nome: item.product.name, qtd: 0 }
    porProduto[item.productId].qtd += item.quantidade
  }
  const maisVendido = Object.values(porProduto).sort((a, b) => b.qtd - a.qtd)[0] ?? null

  // Operador com mais pedidos
  const porOperador: Record<string, number> = {}
  for (const p of pedidosHoje) porOperador[p.garcomId] = (porOperador[p.garcomId] ?? 0) + 1
  const topOperadorId = Object.entries(porOperador).sort(([, a], [, b]) => b - a)[0]?.[0]
  const topOperador = topOperadorId
    ? await prisma.user.findFirst({ where: { id: topOperadorId }, select: { name: true } })
    : null

  // Variação vs semana passada
  const seteDiasAtras = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const fimOntem = new Date(seteDiasAtras.getTime() + 24 * 60 * 60 * 1000)
  const snapshotSemanaPassada = await prisma.dashboardSnapshot.findFirst({
    where: { tenantId, data: { gte: seteDiasAtras, lt: fimOntem } },
    select: { totalVendas: true, ticketMedio: true },
  })

  const variacaoVendas = snapshotSemanaPassada
    ? ((totalVendas - Number(snapshotSemanaPassada.totalVendas)) / Number(snapshotSemanaPassada.totalVendas)) * 100
    : null
  const variacaoTicket = snapshotSemanaPassada
    ? ((ticketMedio - Number(snapshotSemanaPassada.ticketMedio)) / Number(snapshotSemanaPassada.ticketMedio)) * 100
    : null

  return NextResponse.json({
    totalVendas, totalPedidos, pedidosAbertos, ticketMedio,
    cmvTotal, cmvPercentual, benchmark: parseFloat(process.env.DEFAULT_CMV_BENCHMARK ?? '35'),
    maisVendido, topOperador: topOperador?.name ?? null,
    variacaoVendas, variacaoTicket,
  })
}
```

- [ ] **Step 2: Criar `src/app/api/dashboard/grafico/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

export async function GET() {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const seteDiasAtras = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [pedidosHoje, snapshotSemanaPassada] = await Promise.all([
    prisma.pedido.findMany({
      where: { tenantId, status: 'FINALIZADO', fechadoEm: { gte: today } },
      select: { total: true, fechadoEm: true },
      orderBy: { fechadoEm: 'asc' },
    }),
    prisma.dashboardSnapshot.findFirst({
      where: { tenantId, data: { gte: seteDiasAtras, lt: new Date(seteDiasAtras.getTime() + 24 * 60 * 60 * 1000) } },
      select: { totalVendas: true },
    }),
  ])

  // Acumular por hora (0–23)
  const porHora: number[] = Array(24).fill(0)
  let acumulado = 0
  for (const p of pedidosHoje) {
    const hora = new Date(p.fechadoEm!).getHours()
    acumulado += p.total
    porHora[hora] = acumulado
  }
  // Forward-fill zeros
  let ultimo = 0
  const acumuladoPorHora = porHora.map((v) => { if (v > 0) ultimo = v; return ultimo })

  return NextResponse.json({
    diaAtual: acumuladoPorHora,
    semanaPassada: snapshotSemanaPassada ? Number(snapshotSemanaPassada.totalVendas) : null,
  })
}
```

- [ ] **Step 3: Criar `src/app/api/dashboard/heatmap/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'
import { redisConnection } from '@/lib/bullmq'

export async function GET(req: NextRequest) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const cacheKey = `heatmap:${tenantId}`
  const cached = await redisConnection.get(cacheKey)
  if (cached) return NextResponse.json(JSON.parse(cached))

  const dias = parseInt(req.nextUrl.searchParams.get('dias') ?? '30')
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)

  const pedidos = await prisma.pedido.findMany({
    where: { tenantId, status: 'FINALIZADO', fechadoEm: { gte: desde } },
    select: { total: true, fechadoEm: true },
  })

  // grid[diaSemana][hora] = { soma, count }
  const grid: { soma: number; count: number }[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ soma: 0, count: 0 }))
  )
  for (const p of pedidos) {
    const d = new Date(p.fechadoEm!)
    const dia = d.getDay() // 0=Dom
    const hora = d.getHours()
    grid[dia][hora].soma += p.total
    grid[dia][hora].count += 1
  }
  const result = grid.map((row) => row.map((cell) => ({
    media: cell.count > 0 ? cell.soma / cell.count : 0,
    pedidos: cell.count,
  })))

  await redisConnection.set(cacheKey, JSON.stringify(result), 'EX', 3600)
  return NextResponse.json(result)
}
```

- [ ] **Step 4: Criar `src/app/api/dashboard/estoque-critico/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

export async function GET() {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  // Prisma não suporta comparação coluna-vs-coluna diretamente — filtramos em JS
  const todos = await prisma.ingredient.findMany({
    where: { tenantId },
    select: { id: true, name: true, currentQty: true, minimumQty: true, unit: true },
  })
  const insumos = todos
    .filter((i) => i.currentQty === 0 || i.currentQty < i.minimumQty)
    .sort((a, b) => a.currentQty - b.currentQty)
    .slice(0, 20)

  return NextResponse.json(insumos)
}

- [ ] **Step 5: Criar `src/app/api/dashboard/caixa/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

export async function GET(req: NextRequest) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const caixaId = req.nextUrl.searchParams.get('caixaId')
  if (!caixaId) return NextResponse.json({ error: 'caixaId required' }, { status: 400 })

  const sessao = await prisma.sessaoCaixa.findFirst({
    where: { tenantId, usuarioId: caixaId, fechadoEm: null },
    select: { abertoEm: true },
  })

  const [pedidosAbertos, ultimosPedidos] = await Promise.all([
    prisma.pedido.findMany({
      where: { tenantId, garcomId: caixaId, status: { in: ['ABERTO', 'EM_PREPARO', 'PRONTO'] } },
      select: { id: true, total: true, mesa: { select: { numero: true } }, criadoEm: true },
      orderBy: { criadoEm: 'desc' },
    }),
    prisma.pedido.findMany({
      where: {
        tenantId, garcomId: caixaId, status: 'FINALIZADO',
        ...(sessao ? { fechadoEm: { gte: sessao.abertoEm } } : {}),
      },
      select: { id: true, total: true, mesa: { select: { numero: true } }, fechadoEm: true },
      orderBy: { fechadoEm: 'desc' },
      take: 5,
    }),
  ])

  const totalSessao = ultimosPedidos.reduce((s, p) => s + p.total, 0)
  const ticketMedio = ultimosPedidos.length > 0 ? totalSessao / ultimosPedidos.length : 0

  return NextResponse.json({ pedidosAbertos, ultimosPedidos, totalSessao, ticketMedio })
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/dashboard/
git commit -m "feat: add dashboard API routes (kpis, grafico, heatmap, estoque-critico, caixa)"
```

---

### Task 15: Emitir eventos Socket.IO no finalizar pedido e update de insumo

**Files:**
- Modify: `src/app/api/pedidos/[id]/finalizar/route.ts`
- Modify: `src/app/api/ingredients/[id]/route.ts`

- [ ] **Step 1: Adicionar emissão de `dashboard:atualizar` ao finalizar pedido**

Em `src/app/api/pedidos/[id]/finalizar/route.ts`, após as emissões existentes na linha 92, adicionar:

```typescript
io?.to(pedido.tenantId).emit('dashboard:atualizar', { tipo: 'pedido_finalizado', pedidoId: params.id, total: pedido.total })
```

- [ ] **Step 2: Adicionar emissão ao atualizar quantidade de insumo**

Em `src/app/api/ingredients/[id]/route.ts`, localizar o método `PUT` e após o `prisma.ingredient.update`, adicionar antes do `return`:

```typescript
const io = (global as { io?: { to: (r: string) => { emit: (e: string, d: unknown) => void } } }).io
io?.to(tenantId).emit('dashboard:atualizar', { tipo: 'estoque_atualizado' })
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/pedidos/[id]/finalizar/route.ts src/app/api/ingredients/[id]/route.ts
git commit -m "feat: emit dashboard:atualizar socket event on pedido finalizado and ingredient update"
```

---

### Task 16: Zustand store + KpiGrid

**Files:**
- Create: `src/stores/dashboard.store.ts`
- Create: `src/components/dashboard/KpiGrid.tsx`

- [ ] **Step 1: Criar `src/stores/dashboard.store.ts`**

```typescript
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

type GraficoPoint = { hora: number; valor: number }

type DashboardState = {
  kpis: {
    totalVendas: number
    totalPedidos: number
    pedidosAbertos: number
    ticketMedio: number
    cmvTotal: number
    cmvPercentual: number
    benchmark: number
    maisVendido: { nome: string; qtd: number } | null
    topOperador: string | null
    variacaoVendas: number | null
    variacaoTicket: number | null
  } | null
  grafico: GraficoPoint[]
  setKpis: (kpis: DashboardState['kpis']) => void
  applyDelta: (delta: { total?: number }) => void
  appendGrafico: (hora: number, acumulado: number) => void
  setGrafico: (pontos: GraficoPoint[]) => void
}

export const useDashboardStore = create<DashboardState>()(
  immer((set) => ({
    kpis: null,
    grafico: [],
    setKpis: (kpis) => set((s) => { s.kpis = kpis }),
    applyDelta: (delta) => set((s) => {
      if (!s.kpis) return
      if (delta.total != null) {
        s.kpis.totalVendas += delta.total
        s.kpis.totalPedidos += 1
        s.kpis.pedidosAbertos = Math.max(0, s.kpis.pedidosAbertos - 1)
        s.kpis.ticketMedio = s.kpis.totalVendas / s.kpis.totalPedidos
      }
    }),
    appendGrafico: (hora, acumulado) => set((s) => {
      const idx = s.grafico.findIndex((p) => p.hora === hora)
      if (idx >= 0) s.grafico[idx].valor = acumulado
      else s.grafico.push({ hora, valor: acumulado })
    }),
    setGrafico: (pontos) => set((s) => { s.grafico = pontos }),
  }))
)
```

- [ ] **Step 2: Criar `src/components/dashboard/KpiGrid.tsx`**

```tsx
'use client'

import { TrendingUp, TrendingDown, ShoppingCart, DollarSign, BarChart2, Package, Users } from 'lucide-react'

type KpiData = {
  totalVendas: number
  totalPedidos: number
  pedidosAbertos: number
  ticketMedio: number
  cmvTotal: number
  cmvPercentual: number
  benchmark: number
  maisVendido: { nome: string; qtd: number } | null
  topOperador: string | null
  variacaoVendas: number | null
  variacaoTicket: number | null
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function Variacao({ v }: { v: number | null }) {
  if (v == null) return null
  const up = v >= 0
  return (
    <span className="flex items-center gap-0.5 text-xs" style={{ color: up ? '#22c55e' : 'var(--tf-red)' }}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {Math.abs(v).toFixed(1)}%
    </span>
  )
}

function KpiCard({ title, value, sub, icon: Icon, variacao, warn }: {
  title: string; value: string; sub?: string; icon: React.ElementType
  variacao?: number | null; warn?: boolean
}) {
  return (
    <div className="rounded-xl p-4 space-y-2" style={{
      background: 'var(--tf-surface)', border: `1px solid ${warn ? 'var(--tf-red-bd)' : 'var(--tf-border)'}`,
    }}>
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>{title}</span>
        <Icon className="w-4 h-4" style={{ color: 'var(--tf-txt3)' }} />
      </div>
      <p style={{ fontSize: 22, fontWeight: 700, color: warn ? 'var(--tf-red)' : 'var(--tf-txt)', margin: 0 }}>{value}</p>
      <div className="flex items-center gap-2">
        {sub && <span style={{ fontSize: 11, color: 'var(--tf-txt3)' }}>{sub}</span>}
        <Variacao v={variacao ?? null} />
      </div>
    </div>
  )
}

export function KpiGrid({ data }: { data: KpiData }) {
  const cmvWarn = data.cmvPercentual > data.benchmark
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard title="Vendas do dia" value={fmt(data.totalVendas)} icon={DollarSign} variacao={data.variacaoVendas} />
      <KpiCard title="Pedidos finalizados" value={String(data.totalPedidos)} icon={ShoppingCart} />
      <KpiCard title="Pedidos em aberto" value={String(data.pedidosAbertos)} icon={BarChart2}
        sub={data.pedidosAbertos > 0 ? 'Em andamento' : undefined} />
      <KpiCard title="Ticket médio" value={fmt(data.ticketMedio)} icon={TrendingUp} variacao={data.variacaoTicket} />
      <KpiCard title="CMV do dia" value={`${data.cmvPercentual.toFixed(1)}%`}
        sub={`R$ ${data.cmvTotal.toFixed(2)} · benchmark ${data.benchmark}%`}
        icon={BarChart2} warn={cmvWarn} />
      <KpiCard title="Mais vendido" value={data.maisVendido?.nome ?? '—'}
        sub={data.maisVendido ? `${data.maisVendido.qtd} unidades` : undefined} icon={Package} />
      <KpiCard title="Operador destaque" value={data.topOperador ?? '—'} icon={Users} />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/stores/dashboard.store.ts src/components/dashboard/KpiGrid.tsx
git commit -m "feat: add Zustand dashboard store and KpiGrid component"
```

---

### Task 17: Gráfico de vendas e Heatmap

**Files:**
- Create: `src/components/dashboard/SalesChart.tsx`
- Create: `src/components/dashboard/WeeklyHeatmap.tsx`

- [ ] **Step 1: Criar `src/components/dashboard/SalesChart.tsx`**

```tsx
'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

type Props = {
  diaAtual: number[]       // 24 valores (acumulado por hora)
  semanaPassada: number | null  // total da semana passada (distribuído linearmente como referência)
}

export function SalesChart({ diaAtual, semanaPassada }: Props) {
  const data = diaAtual.map((valor, hora) => ({
    hora: `${String(hora).padStart(2, '0')}h`,
    hoje: valor,
    semanaPassada: semanaPassada != null ? (semanaPassada / 24) * (hora + 1) : undefined,
  }))

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)' }}>
      <p className="text-sm font-semibold mb-4" style={{ color: 'var(--tf-txt)' }}>Vendas acumuladas — hoje vs semana passada</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--tf-border)" />
          <XAxis dataKey="hora" tick={{ fontSize: 11, fill: 'var(--tf-txt3)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--tf-txt3)' }}
            tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
          <Line type="monotone" dataKey="hoje" stroke="#22c55e" strokeWidth={2} dot={false} name="Hoje" />
          {semanaPassada != null && (
            <Line type="monotone" dataKey="semanaPassada" stroke="var(--tf-txt3)"
              strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="Semana passada" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Criar `src/components/dashboard/WeeklyHeatmap.tsx`**

```tsx
'use client'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const HORAS = Array.from({ length: 18 }, (_, i) => i + 6) // 6h–23h

type Cell = { media: number; pedidos: number }
type HeatmapData = Cell[][] // [7][24]

function intensity(value: number, max: number): number {
  return max > 0 ? value / max : 0
}

function heatColor(int: number): string {
  const lightness = Math.round(100 - int * 60)
  return `hsl(142, 70%, ${lightness}%)`
}

export function WeeklyHeatmap({ data }: { data: HeatmapData }) {
  const max = Math.max(...data.flatMap((row) => row.map((c) => c.media)))

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)' }}>
      <p className="text-sm font-semibold mb-4" style={{ color: 'var(--tf-txt)' }}>Mapa de calor semanal — últimos 30 dias</p>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `40px repeat(7, 1fr)`, gap: 2, minWidth: 480 }}>
          {/* Header */}
          <div />
          {DIAS.map((d) => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--tf-txt3)', fontWeight: 600 }}>{d}</div>
          ))}
          {/* Rows */}
          {HORAS.map((hora) => (
            <>
              <div key={`h${hora}`} style={{ fontSize: 10, color: 'var(--tf-txt3)', paddingRight: 4, textAlign: 'right', lineHeight: '20px' }}>
                {String(hora).padStart(2, '0')}h
              </div>
              {DIAS.map((_, dia) => {
                const cell = data[dia]?.[hora] ?? { media: 0, pedidos: 0 }
                const int = intensity(cell.media, max)
                return (
                  <div key={`${dia}-${hora}`}
                    title={`${DIAS[dia]} às ${hora}h — média R$ ${cell.media.toFixed(2)} (${cell.pedidos} pedidos)`}
                    style={{
                      height: 20, borderRadius: 3,
                      backgroundColor: cell.media > 0 ? heatColor(int) : 'var(--tf-surface2)',
                      cursor: 'default',
                    }}
                  />
                )
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/SalesChart.tsx src/components/dashboard/WeeklyHeatmap.tsx
git commit -m "feat: add SalesChart and WeeklyHeatmap dashboard components"
```

---

### Task 18: CriticalStockPanel, AlertsHighlight e DashboardCaixa

**Files:**
- Create: `src/components/dashboard/CriticalStockPanel.tsx`
- Create: `src/components/dashboard/AlertsHighlight.tsx`
- Create: `src/components/dashboard/DashboardCaixa.tsx`

- [ ] **Step 1: Criar `src/components/dashboard/CriticalStockPanel.tsx`**

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { CheckCircle } from 'lucide-react'

type Insumo = { id: string; name: string; currentQty: number; minimumQty: number; unit: string }

export function CriticalStockPanel() {
  const { data = [], isLoading } = useQuery<Insumo[]>({
    queryKey: ['estoque-critico'],
    queryFn: () => fetch('/api/dashboard/estoque-critico').then((r) => r.json()),
    staleTime: 300_000,
  })

  if (isLoading) return <div className="h-20 animate-pulse rounded-xl" style={{ background: 'var(--tf-surface2)' }} />

  if (data.length === 0) {
    return (
      <div className="rounded-xl p-4 flex items-center gap-3"
        style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-green-bd)' }}>
        <CheckCircle className="w-5 h-5" style={{ color: '#22c55e' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--tf-txt)' }}>Estoque normalizado</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)' }}>
      <p className="text-sm font-semibold" style={{ color: 'var(--tf-txt)' }}>Estoque crítico</p>
      {data.map((i) => (
        <div key={i.id} className="flex items-center justify-between">
          <div>
            <p style={{ fontSize: 13, color: 'var(--tf-txt)' }}>{i.name}</p>
            <p style={{ fontSize: 11, color: 'var(--tf-txt3)' }}>{i.currentQty} {i.unit} · mín. {i.minimumQty}</p>
          </div>
          <Link href={`/estoque/insumos?id=${i.id}`}
            className="px-3 py-1 rounded-lg text-xs font-medium"
            style={{ background: 'var(--tf-surface2)', color: 'var(--tf-txt2)', border: '1px solid var(--tf-border)' }}>
            Lançar entrada
          </Link>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Criar `src/components/dashboard/AlertsHighlight.tsx`**

```tsx
'use client'

import { useAlerts } from '@/components/alerts/AlertsProvider'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle } from 'lucide-react'

type Alert = { id: string; titulo: string; severidade: string; criadoEm: string; metadata: Record<string, unknown> }

const SEV_COLOR: Record<string, string> = {
  CRITICA: 'var(--tf-red)', ALTA: '#f97316', MEDIA: '#eab308', BAIXA: 'var(--tf-txt3)', INFO: '#22c55e',
}

export function AlertsHighlight() {
  const { data = [] } = useQuery<Alert[]>({
    queryKey: ['alertas-highlight'],
    queryFn: () => fetch('/api/alertas?status=NAO_LIDO&limit=3').then((r) => r.json()).then((d) => d.items ?? []),
    staleTime: 60_000,
  })

  if (data.length === 0) return null

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-red-bd)' }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: 'var(--tf-txt)' }}>Alertas críticos</p>
        <Link href="/alertas" style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>Ver todos →</Link>
      </div>
      {data.map((a) => (
        <div key={a.id} className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5" style={{ color: SEV_COLOR[a.severidade] ?? 'var(--tf-txt3)', flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 13, color: 'var(--tf-txt)' }}>{a.titulo}</p>
            <p style={{ fontSize: 11, color: 'var(--tf-txt3)' }}>
              {formatDistanceToNow(new Date(a.criadoEm), { addSuffix: true, locale: ptBR })}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Criar `src/components/dashboard/DashboardCaixa.tsx`**

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

type Pedido = { id: string; total: number; mesa: { numero: number }; fechadoEm?: string; criadoEm?: string }

export function DashboardCaixa() {
  const { data: session } = useSession()
  const caixaId = session?.user?.id

  const { data } = useQuery({
    queryKey: ['dashboard-caixa', caixaId],
    queryFn: () => fetch(`/api/dashboard/caixa?caixaId=${caixaId}`).then((r) => r.json()),
    enabled: !!caixaId,
  })

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)' }}>
          <p style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>Total da sessão</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--tf-txt)' }}>{fmt(data?.totalSessao ?? 0)}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)' }}>
          <p style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>Ticket médio</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--tf-txt)' }}>{fmt(data?.ticketMedio ?? 0)}</p>
        </div>
      </div>

      <Link href="/pdv" className="block w-full text-center py-3 rounded-xl font-semibold text-white"
        style={{ background: 'var(--tf-green)', fontSize: 15 }}>
        Abrir PDV →
      </Link>

      <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)' }}>
        <p className="text-sm font-semibold" style={{ color: 'var(--tf-txt)' }}>Pedidos em aberto</p>
        {(data?.pedidosAbertos ?? []).map((p: Pedido) => (
          <Link key={p.id} href={`/pdv?pedido=${p.id}`} className="flex justify-between py-1">
            <span style={{ fontSize: 13, color: 'var(--tf-txt)' }}>Mesa {p.mesa.numero}</span>
            <span style={{ fontSize: 13, color: 'var(--tf-txt2)' }}>{fmt(p.total)}</span>
          </Link>
        ))}
        {(data?.pedidosAbertos ?? []).length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--tf-txt3)' }}>Nenhum pedido em aberto</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/CriticalStockPanel.tsx src/components/dashboard/AlertsHighlight.tsx src/components/dashboard/DashboardCaixa.tsx
git commit -m "feat: add CriticalStockPanel, AlertsHighlight, DashboardCaixa components"
```

---

### Task 19: Expandir página /dashboard

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Substituir `src/app/(dashboard)/dashboard/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { getSocket } from '@/lib/socket-client'
import { useDashboardStore } from '@/stores/dashboard.store'
import { KpiGrid } from '@/components/dashboard/KpiGrid'
import { SalesChart } from '@/components/dashboard/SalesChart'
import { WeeklyHeatmap } from '@/components/dashboard/WeeklyHeatmap'
import { CriticalStockPanel } from '@/components/dashboard/CriticalStockPanel'
import { AlertsHighlight } from '@/components/dashboard/AlertsHighlight'
import { DashboardCaixa } from '@/components/dashboard/DashboardCaixa'
import { useAlerts } from '@/components/alerts/AlertsProvider'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

function saudacao(nome: string) {
  const h = new Date().getHours()
  const periodo = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  return `${periodo}, ${nome}!`
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const role = session?.user?.role
  const isCaixa = role === 'STAFF' && !['ADMIN', 'MANAGER'].includes(role ?? '')
  const nome = session?.user?.name?.split(' ')[0] ?? 'usuário'

  const { unreadCount } = useAlerts()
  const { kpis, setKpis, applyDelta, grafico, setGrafico, appendGrafico } = useDashboardStore()

  const { data: kpisData } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: () => fetch('/api/dashboard/kpis').then((r) => r.json()),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  const { data: graficoData } = useQuery({
    queryKey: ['dashboard-grafico'],
    queryFn: () => fetch('/api/dashboard/grafico').then((r) => r.json()),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  const { data: heatmapData } = useQuery({
    queryKey: ['dashboard-heatmap'],
    queryFn: () => fetch('/api/dashboard/heatmap').then((r) => r.json()),
    staleTime: 3_600_000,
  })

  useEffect(() => { if (kpisData) setKpis(kpisData) }, [kpisData, setKpis])
  useEffect(() => {
    if (graficoData?.diaAtual) {
      setGrafico(graficoData.diaAtual.map((v: number, i: number) => ({ hora: i, valor: v })))
    }
  }, [graficoData, setGrafico])

  useEffect(() => {
    const socket = getSocket()
    const handler = (payload: { tipo: string; total?: number }) => {
      if (payload.tipo === 'pedido_finalizado' && payload.total != null) {
        applyDelta({ total: payload.total })
        const hora = new Date().getHours()
        appendGrafico(hora, (kpis?.totalVendas ?? 0) + payload.total)
      }
    }
    socket.on('dashboard:atualizar', handler)
    return () => { socket.off('dashboard:atualizar', handler) }
  }, [applyDelta, appendGrafico, kpis?.totalVendas])

  if (isCaixa) return <DashboardCaixa />

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="space-y-6">
      {/* Banner alertas críticos */}
      {unreadCount > 0 && (
        <Link href="/alertas"
          className="flex items-center gap-3 rounded-xl p-4"
          style={{ background: 'var(--tf-red-bg)', border: '1px solid var(--tf-red-bd)' }}>
          <AlertTriangle className="w-5 h-5" style={{ color: 'var(--tf-red)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--tf-red)' }}>
            {unreadCount} alerta{unreadCount !== 1 ? 's' : ''} não lido{unreadCount !== 1 ? 's' : ''} precisam da sua atenção
          </p>
        </Link>
      )}

      {/* Saudação */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--tf-txt)', margin: 0 }}>
          {saudacao(nome)}
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--tf-txt3)', marginTop: 3 }}>
          {hoje.charAt(0).toUpperCase() + hoje.slice(1)}
        </p>
      </div>

      {/* KPIs */}
      {kpis && <KpiGrid data={kpis} />}

      {/* Gráfico + Estoque crítico */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <SalesChart
            diaAtual={grafico.map((p) => p.valor)}
            semanaPassada={graficoData?.semanaPassada ?? null}
          />
        </div>
        <CriticalStockPanel />
      </div>

      {/* Heatmap */}
      {heatmapData && <WeeklyHeatmap data={heatmapData} />}

      {/* Alertas em destaque */}
      <AlertsHighlight />
    </div>
  )
}
```

- [ ] **Step 2: Testar navegação — verificar que a página carrega sem erros**

```bash
npm run dev
```
Abrir `http://localhost:3000/dashboard` e verificar que KPIs carregam, gráfico renderiza e badge no header aparece.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat: expand /dashboard with real-time KPIs, line chart, heatmap and alerts"
```

---

### Task 20: Verificação final e testes

**Files:**
- Test: Rodar suite completa

- [ ] **Step 1: Rodar todos os testes**

```bash
npm test
```
Expected: todos passam.

- [ ] **Step 2: Verificar build de produção**

```bash
npm run build
```
Expected: sem erros de compilação.

- [ ] **Step 3: Commit final se houver ajustes**

```bash
git add -A
git commit -m "fix: resolve any type errors from build verification"
```
