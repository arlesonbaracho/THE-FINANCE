# Agente 5 · Parte 4 — Schema, Services & Jobs BullMQ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar os modelos Prisma do Super Admin Fase 3, implementar os dois services principais (`platform-health` e `saas-metrics`) e criar os dois jobs BullMQ recorrentes.

**Architecture:** Services puros em `src/services/admin/`. Jobs BullMQ registrados em `src/lib/queues.ts` (padrão já existente) e processados em `src/jobs/worker.ts`. Platform health coleta dados via Prisma + ioredis direto.

**Tech Stack:** Prisma, BullMQ (já instalado), ioredis (já instalado), Vitest

**Pré-requisito:** Nenhuma dependência das Partes 1-3 (Agent 5 é independente do Agent 4).

---

## Mapa de arquivos

| Ação | Arquivo |
|------|---------|
| Modificar | `prisma/schema.prisma` |
| Criar | `src/services/admin/platform-health.service.ts` |
| Criar | `src/services/admin/platform-health.service.test.ts` |
| Criar | `src/services/admin/saas-metrics.service.ts` |
| Criar | `src/services/admin/saas-metrics.service.test.ts` |
| Modificar | `src/lib/queues.ts` |
| Criar | `src/jobs/admin/platform-health.job.ts` |
| Criar | `src/jobs/admin/saas-metrics-snapshot.job.ts` |
| Criar | `src/jobs/worker.ts` |

---

## Task 1: Schema — modelos Agent 5

**Arquivos:**
- Modificar: `prisma/schema.prisma`

- [ ] **Passo 1: Adicionar modelo `PlatformHealthLog`**

Abrir `prisma/schema.prisma`. Localizar a seção `// ── Super Admin`. Adicionar após os models existentes de AdminUser:

```prisma
// ── Platform Health ───────────────────────────────────────────────────────────

enum HealthLogTipo {
  API
  JOB
  WEBHOOK
  DATABASE
  REDIS
  AI
}

enum HealthLogStatus {
  OK
  ALERTA
  CRITICO
}

model PlatformHealthLog {
  id           String          @id @default(cuid())
  tipo         HealthLogTipo
  metrica      String
  valor        Decimal
  status       HealthLogStatus
  detalhes     Json?
  registradoEm DateTime        @default(now())

  @@index([tipo, registradoEm])
  @@index([registradoEm])
}

// ── SaaS Metrics ──────────────────────────────────────────────────────────────

model SaasMetricsSnapshot {
  id           String   @id @default(cuid())
  data         DateTime
  mrr          Decimal
  mrrPorPlano  Json
  churnRate    Decimal?
  tenantCount  Int
  tenantAtivos Int
  registradoEm DateTime @default(now())

  @@unique([data])
  @@index([data])
}

// ── Admin Notifications & Settings ───────────────────────────────────────────

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
}
```

- [ ] **Passo 2: Executar migração**

```bash
npx prisma migrate dev --name add_super_admin_health_saas_models
```

Saída esperada: `✔  Generated Prisma Client`.

- [ ] **Passo 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add PlatformHealthLog, SaasMetricsSnapshot, AdminNotification, AdminSettings"
```

---

## Task 2: `platform-health.service.ts`

**Arquivos:**
- Criar: `src/services/admin/platform-health.service.ts`
- Criar: `src/services/admin/platform-health.service.test.ts`

- [ ] **Passo 1: Escrever testes**

Criar `src/services/admin/platform-health.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    platformHealthLog: { findMany: vi.fn(), create: vi.fn() },
    adminNotification: { create: vi.fn() },
    ifoodWebhookLog: { findMany: vi.fn() },
    aiUsage: { aggregate: vi.fn() },
    $queryRaw: vi.fn(),
  },
}))

vi.mock('@/lib/bullmq', () => ({
  redisConnection: {
    info: vi.fn(),
  },
}))

import { prisma } from '@/lib/prisma'
import { redisConnection } from '@/lib/bullmq'
import { calcularUptime, salvarSnapshot } from './platform-health.service'

const p = prisma as unknown as {
  platformHealthLog: Record<string, ReturnType<typeof vi.fn>>
  adminNotification: Record<string, ReturnType<typeof vi.fn>>
  ifoodWebhookLog: Record<string, ReturnType<typeof vi.fn>>
  aiUsage: Record<string, ReturnType<typeof vi.fn>>
  $queryRaw: ReturnType<typeof vi.fn>
}
const r = redisConnection as unknown as { info: ReturnType<typeof vi.fn> }

beforeEach(() => { vi.clearAllMocks() })

describe('calcularUptime', () => {
  it('retorna 100 quando todos os logs são OK', async () => {
    p.platformHealthLog.findMany.mockResolvedValue([
      { status: 'OK' },
      { status: 'OK' },
      { status: 'OK' },
    ])
    const result = await calcularUptime(24)
    expect(result).toBe(100)
  })

  it('retorna 66.7 quando 2 de 3 são OK', async () => {
    p.platformHealthLog.findMany.mockResolvedValue([
      { status: 'OK' },
      { status: 'OK' },
      { status: 'CRITICO' },
    ])
    const result = await calcularUptime(24)
    expect(result).toBeCloseTo(66.67, 1)
  })

  it('retorna 100 quando não há logs (nenhuma métrica falhou)', async () => {
    p.platformHealthLog.findMany.mockResolvedValue([])
    const result = await calcularUptime(24)
    expect(result).toBe(100)
  })
})

describe('salvarSnapshot', () => {
  it('cria log para cada tipo de métrica', async () => {
    p.platformHealthLog.create.mockResolvedValue({})
    p.adminNotification.create.mockResolvedValue({})

    await salvarSnapshot({
      uptime24h: 99.5,
      latenciaMedia: 350,
      dbConexoes: 5,
      dbQueriesLentas: 0,
      redisMemoriaPercent: 45,
      redisHitRate: 92,
      aiTokensHoje: 50000,
      aiErroPercent: 0,
      jobsFalhos: 0,
      webhooksIfoodFalhos24h: 0,
    })

    expect(p.platformHealthLog.create).toHaveBeenCalled()
  })

  it('cria AdminNotification quando há métrica CRITICA', async () => {
    p.platformHealthLog.create.mockResolvedValue({})
    p.adminNotification.create.mockResolvedValue({})

    await salvarSnapshot({
      uptime24h: 40,   // < 50 = CRITICO
      latenciaMedia: 100,
      dbConexoes: 2,
      dbQueriesLentas: 0,
      redisMemoriaPercent: 30,
      redisHitRate: 80,
      aiTokensHoje: 0,
      aiErroPercent: 0,
      jobsFalhos: 0,
      webhooksIfoodFalhos24h: 0,
    })

    expect(p.adminNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ severidade: 'CRITICO' }),
      })
    )
  })
})
```

- [ ] **Passo 2: Confirmar falha**

```bash
npx vitest run src/services/admin/platform-health.service.test.ts
```

- [ ] **Passo 3: Implementar o service**

Criar `src/services/admin/platform-health.service.ts`:

```ts
import { prisma } from '@/lib/prisma'
import { redisConnection } from '@/lib/bullmq'
import { subHours } from 'date-fns'

export interface PlatformMetrics {
  uptime24h: number
  latenciaMedia: number
  dbConexoes: number
  dbQueriesLentas: number
  redisMemoriaPercent: number
  redisHitRate: number
  aiTokensHoje: number
  aiErroPercent: number
  jobsFalhos: number
  webhooksIfoodFalhos24h: number
}

export async function calcularUptime(horas: number): Promise<number> {
  const desde = subHours(new Date(), horas)
  const logs = await prisma.platformHealthLog.findMany({
    where: { registradoEm: { gte: desde }, tipo: 'API' },
    select: { status: true },
  })
  if (logs.length === 0) return 100
  const ok = logs.filter((l) => l.status === 'OK').length
  return (ok / logs.length) * 100
}

export async function coletarMetricas(): Promise<PlatformMetrics> {
  const agora = new Date()
  const inicio24h = subHours(agora, 24)

  // Latência média dos últimos logs de API
  const logsApi = await prisma.platformHealthLog.findMany({
    where: { tipo: 'API', registradoEm: { gte: inicio24h } },
    select: { valor: true },
    orderBy: { registradoEm: 'desc' },
    take: 288, // 5min × 288 = 24h
  })
  const latenciaMedia =
    logsApi.length > 0
      ? logsApi.reduce((s, l) => s + Number(l.valor), 0) / logsApi.length
      : 0

  // DB — conexões ativas e queries lentas
  let dbConexoes = 0
  let dbQueriesLentas = 0
  try {
    const conResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) FROM pg_stat_activity WHERE state = 'active'
    `
    dbConexoes = Number(conResult[0]?.count ?? 0)
  } catch { /* pg_stat_activity pode não estar disponível em todos os ambientes */ }

  // Redis — memória e hit rate
  let redisMemoriaPercent = 0
  let redisHitRate = 0
  try {
    const info = await (redisConnection as { info: (section: string) => Promise<string> }).info('all')
    const usedMem = parseRedisInfo(info, 'used_memory')
    const maxMem = parseRedisInfo(info, 'maxmemory') || parseRedisInfo(info, 'used_memory') * 2
    const hits = parseRedisInfo(info, 'keyspace_hits')
    const misses = parseRedisInfo(info, 'keyspace_misses')
    redisMemoriaPercent = maxMem > 0 ? (usedMem / maxMem) * 100 : 0
    redisHitRate = hits + misses > 0 ? (hits / (hits + misses)) * 100 : 100
  } catch { /* Redis pode estar indisponível em dev */ }

  // AI usage hoje
  const hoje = new Date()
  const aiAgg = await prisma.aiUsage.aggregate({
    _sum: { tokensInput: true, tokensOutput: true },
    where: { mes: hoje.getMonth() + 1, ano: hoje.getFullYear() },
  })
  const aiTokensHoje = (aiAgg._sum.tokensInput ?? 0) + (aiAgg._sum.tokensOutput ?? 0)

  // Webhooks iFood com falha nas últimas 24h
  const webhooksIfoodFalhos24h = await prisma.ifoodWebhookLog.findMany({
    where: { status: 'FALHOU', createdAt: { gte: inicio24h } },
    select: { id: true },
  }).then((r) => r.length)

  const uptime24h = await calcularUptime(24)

  return {
    uptime24h,
    latenciaMedia,
    dbConexoes,
    dbQueriesLentas,
    redisMemoriaPercent,
    redisHitRate,
    aiTokensHoje,
    aiErroPercent: 0,
    jobsFalhos: 0,
    webhooksIfoodFalhos24h,
  }
}

function parseRedisInfo(info: string, key: string): number {
  const match = new RegExp(`${key}:(\\d+)`).exec(info)
  return match ? parseInt(match[1], 10) : 0
}

function classificarStatus(tipo: string, valor: number): 'OK' | 'ALERTA' | 'CRITICO' {
  const limites: Record<string, { alerta: number; critico: number; inversao?: boolean }> = {
    uptime:     { alerta: 95, critico: 50, inversao: true },
    latencia:   { alerta: 1000, critico: 3000 },
    dbConexoes: { alerta: 50, critico: 100 },
    redisMemoria: { alerta: 70, critico: 90 },
    hitRate:    { alerta: 70, critico: 50, inversao: true },
  }
  const limite = limites[tipo]
  if (!limite) return 'OK'
  if (limite.inversao) {
    if (valor < limite.critico) return 'CRITICO'
    if (valor < limite.alerta) return 'ALERTA'
  } else {
    if (valor >= limite.critico) return 'CRITICO'
    if (valor >= limite.alerta) return 'ALERTA'
  }
  return 'OK'
}

export async function salvarSnapshot(metricas: PlatformMetrics): Promise<void> {
  const registros = [
    { tipo: 'API' as const, metrica: 'uptime_24h', valor: metricas.uptime24h, status: classificarStatus('uptime', metricas.uptime24h) },
    { tipo: 'API' as const, metrica: 'latencia_media_ms', valor: metricas.latenciaMedia, status: classificarStatus('latencia', metricas.latenciaMedia) },
    { tipo: 'DATABASE' as const, metrica: 'conexoes_ativas', valor: metricas.dbConexoes, status: classificarStatus('dbConexoes', metricas.dbConexoes) },
    { tipo: 'REDIS' as const, metrica: 'memoria_percent', valor: metricas.redisMemoriaPercent, status: classificarStatus('redisMemoria', metricas.redisMemoriaPercent) },
    { tipo: 'REDIS' as const, metrica: 'hit_rate_percent', valor: metricas.redisHitRate, status: classificarStatus('hitRate', metricas.redisHitRate) },
    { tipo: 'AI' as const, metrica: 'tokens_hoje', valor: metricas.aiTokensHoje, status: 'OK' as const },
    { tipo: 'WEBHOOK' as const, metrica: 'ifood_falhos_24h', valor: metricas.webhooksIfoodFalhos24h, status: metricas.webhooksIfoodFalhos24h > 10 ? 'ALERTA' as const : 'OK' as const },
  ]

  await Promise.all(
    registros.map((r) =>
      prisma.platformHealthLog.create({
        data: { tipo: r.tipo, metrica: r.metrica, valor: r.valor, status: r.status },
      })
    )
  )

  const temCritico = registros.some((r) => r.status === 'CRITICO')
  if (temCritico) {
    const criticos = registros.filter((r) => r.status === 'CRITICO')
    await prisma.adminNotification.create({
      data: {
        tipo: 'SAUDE_PLATAFORMA',
        titulo: `Métricas críticas detectadas: ${criticos.map((r) => r.metrica).join(', ')}`,
        descricao: criticos.map((r) => `${r.metrica}: ${r.valor}`).join('\n'),
        severidade: 'CRITICO',
      },
    })
  }
}
```

- [ ] **Passo 4: Executar testes**

```bash
npx vitest run src/services/admin/platform-health.service.test.ts
```

Saída esperada: `✓ 5 tests passed`.

- [ ] **Passo 5: Commit**

```bash
git add src/services/admin/platform-health.service.ts src/services/admin/platform-health.service.test.ts
git commit -m "feat(admin): implement platform-health.service"
```

---

## Task 3: `saas-metrics.service.ts`

**Arquivos:**
- Criar: `src/services/admin/saas-metrics.service.ts`
- Criar: `src/services/admin/saas-metrics.service.test.ts`

- [ ] **Passo 1: Escrever testes**

Criar `src/services/admin/saas-metrics.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenantSubscription: { findMany: vi.fn(), aggregate: vi.fn(), count: vi.fn() },
    saasMetricsSnapshot: { findMany: vi.fn(), upsert: vi.fn() },
    planHistory: { findMany: vi.fn() },
    tenant: { count: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { calcularMRR, calcularChurn, calcularLTV, cohortAnalysis, projecaoReceita } from './saas-metrics.service'

const p = prisma as unknown as {
  tenantSubscription: Record<string, ReturnType<typeof vi.fn>>
  saasMetricsSnapshot: Record<string, ReturnType<typeof vi.fn>>
  planHistory: Record<string, ReturnType<typeof vi.fn>>
  tenant: Record<string, ReturnType<typeof vi.fn>>
}

beforeEach(() => { vi.clearAllMocks() })

describe('calcularMRR', () => {
  it('soma contractedPrice de subscriptions ATIVO', async () => {
    p.tenantSubscription.findMany.mockResolvedValue([
      { planId: 'p-1', contractedPrice: 299 },
      { planId: 'p-1', contractedPrice: 299 },
      { planId: 'p-2', contractedPrice: 499 },
    ])

    const result = await calcularMRR()

    expect(result.total).toBe(1097)
    expect(result.porPlano['p-1']).toBe(598)
    expect(result.porPlano['p-2']).toBe(499)
  })
})

describe('calcularChurn', () => {
  it('divide cancelamentos pelo total ativo no início do mês', async () => {
    // 2 cancelamentos em Jan/2026, 10 ativos no início do mês
    p.tenantSubscription.count
      .mockResolvedValueOnce(2)   // cancelados no mês
      .mockResolvedValueOnce(10)  // ativos no início

    const result = await calcularChurn(1, 2026)
    expect(result.churnRate).toBeCloseTo(20, 1) // 20%
    expect(result.cancelamentos).toBe(2)
  })

  it('retorna 0 quando não há ativos no início do mês', async () => {
    p.tenantSubscription.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)

    const result = await calcularChurn(1, 2026)
    expect(result.churnRate).toBe(0)
  })
})

describe('projecaoReceita', () => {
  it('projeta 3 meses baseado na taxa de crescimento média', async () => {
    p.saasMetricsSnapshot.findMany.mockResolvedValue([
      { data: new Date('2026-01-01'), mrr: 1000 },
      { data: new Date('2026-02-01'), mrr: 1100 },
      { data: new Date('2026-03-01'), mrr: 1210 },
    ])

    const result = await projecaoReceita(3)

    expect(result).toHaveLength(3)
    // Taxa mensal ~10%, então mês 4 ≈ 1331
    expect(Number(result[0].mrr)).toBeCloseTo(1331, -1)
  })
})
```

- [ ] **Passo 2: Confirmar falha**

```bash
npx vitest run src/services/admin/saas-metrics.service.test.ts
```

- [ ] **Passo 3: Implementar o service**

Criar `src/services/admin/saas-metrics.service.ts`:

```ts
import { prisma } from '@/lib/prisma'
import { startOfMonth, endOfMonth, subMonths, addMonths, format } from 'date-fns'

export interface MRRData {
  total: number
  porPlano: Record<string, number>
}

export interface ChurnData {
  churnRate: number
  cancelamentos: number
  ativosInicio: number
}

export interface ProjecaoData {
  mes: string
  mrr: number
  mrrMin: number
  mrrMax: number
}

export async function calcularMRR(): Promise<MRRData> {
  const subs = await prisma.tenantSubscription.findMany({
    where: { status: 'ACTIVE' },
    select: { planId: true, contractedPrice: true },
  })

  const porPlano: Record<string, number> = {}
  let total = 0
  for (const s of subs) {
    porPlano[s.planId] = (porPlano[s.planId] ?? 0) + s.contractedPrice
    total += s.contractedPrice
  }

  return { total, porPlano }
}

export async function historicMRR(meses: number) {
  return prisma.saasMetricsSnapshot.findMany({
    orderBy: { data: 'desc' },
    take: meses,
  })
}

export async function calcularChurn(mes: number, ano: number): Promise<ChurnData> {
  const inicioMes = startOfMonth(new Date(ano, mes - 1))
  const fimMes = endOfMonth(inicioMes)

  const [cancelamentos, ativosInicio] = await Promise.all([
    prisma.tenantSubscription.count({
      where: { status: 'CANCELLED', updatedAt: { gte: inicioMes, lte: fimMes } },
    }),
    prisma.tenantSubscription.count({
      where: { status: 'ACTIVE', startDate: { lt: inicioMes } },
    }),
  ])

  const churnRate = ativosInicio > 0 ? (cancelamentos / ativosInicio) * 100 : 0
  return { churnRate, cancelamentos, ativosInicio }
}

export async function calcularLTV(): Promise<number> {
  const subs = await prisma.tenantSubscription.findMany({
    select: { contractedPrice: true, startDate: true, status: true },
  })
  if (subs.length === 0) return 0

  const mrrMedio = subs.reduce((s, sub) => s + sub.contractedPrice, 0) / subs.length

  const agora = new Date()
  const retencaoMeses = subs.reduce((s, sub) => {
    const fim = sub.status === 'ACTIVE' ? agora : agora
    const meses = (fim.getTime() - sub.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    return s + Math.max(1, meses)
  }, 0) / subs.length

  return mrrMedio * retencaoMeses
}

export async function calcularNRR(mes: number, ano: number): Promise<number> {
  const inicioMes = startOfMonth(new Date(ano, mes - 1))
  const fimMes = endOfMonth(inicioMes)

  // MRR no início do mês
  const subsInicio = await prisma.tenantSubscription.findMany({
    where: { status: 'ACTIVE', startDate: { lt: inicioMes } },
    select: { tenantId: true, contractedPrice: true },
  })
  const mrrInicio = subsInicio.reduce((s, sub) => s + sub.contractedPrice, 0)
  if (mrrInicio === 0) return 100

  // Variações (upgrades e downgrades) via PlanHistory no período
  const historico = await prisma.planHistory.findMany({
    where: { createdAt: { gte: inicioMes, lte: fimMes } },
    include: {
      tenant: { include: { subscription: true } },
    },
  })

  // Expansão: tenant que estava ativo e aumentou preço
  // Contração: tenant que estava ativo e reduziu preço
  // Simplificação: usar contractedPrice atual vs início
  let expansao = 0
  let contracao = 0
  for (const h of historico) {
    const priceAtual = h.tenant.subscription?.contractedPrice ?? 0
    const wasActive = subsInicio.some((s) => s.tenantId === h.tenantId)
    if (!wasActive) continue
    const prevPrice = subsInicio.find((s) => s.tenantId === h.tenantId)?.contractedPrice ?? 0
    if (priceAtual > prevPrice) expansao += priceAtual - prevPrice
    if (priceAtual < prevPrice) contracao += prevPrice - priceAtual
  }

  return ((mrrInicio + expansao - contracao) / mrrInicio) * 100
}

export async function cohortAnalysis(): Promise<Array<{ cohort: string; retencao: number[] }>> {
  const dozeAtras = subMonths(new Date(), 12)

  const tenants = await prisma.tenantSubscription.findMany({
    where: { startDate: { gte: dozeAtras } },
    select: { tenantId: true, startDate: true, status: true },
    orderBy: { startDate: 'asc' },
  })

  // Agrupar por mês de início
  const cohortMap = new Map<string, Array<{ tenantId: string; startDate: Date; status: string }>>()
  for (const t of tenants) {
    const key = format(t.startDate, 'yyyy-MM')
    const cur = cohortMap.get(key) ?? []
    cur.push(t)
    cohortMap.set(key, cur)
  }

  const agora = new Date()
  const result: Array<{ cohort: string; retencao: number[] }> = []

  for (const [cohort, membros] of cohortMap.entries()) {
    const cohortDate = new Date(cohort + '-01')
    const maxMeses = Math.floor((agora.getTime() - cohortDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
    const retencao: number[] = []

    for (let mes = 0; mes <= Math.min(maxMeses, 11); mes++) {
      const refDate = addMonths(cohortDate, mes)
      const ativos = membros.filter((m) => {
        if (m.startDate > refDate) return false
        if (m.status === 'CANCELLED') return false
        return true
      }).length
      retencao.push(membros.length > 0 ? Math.round((ativos / membros.length) * 100) : 0)
    }

    result.push({ cohort, retencao })
  }

  return result
}

export async function projecaoReceita(meses: number): Promise<ProjecaoData[]> {
  const snapshots = await prisma.saasMetricsSnapshot.findMany({
    orderBy: { data: 'asc' },
    take: 3,
  })

  if (snapshots.length < 2) {
    // Sem dados suficientes — projetar com crescimento zero
    const mrrAtual = (await calcularMRR()).total
    return Array.from({ length: meses }, (_, i) => ({
      mes: format(addMonths(new Date(), i + 1), 'yyyy-MM'),
      mrr: mrrAtual,
      mrrMin: mrrAtual * 0.85,
      mrrMax: mrrAtual * 1.15,
    }))
  }

  // Calcular taxa de crescimento média entre snapshots
  const taxas: number[] = []
  for (let i = 1; i < snapshots.length; i++) {
    const prev = Number(snapshots[i - 1].mrr)
    const cur = Number(snapshots[i].mrr)
    if (prev > 0) taxas.push((cur - prev) / prev)
  }
  const taxaMedia = taxas.reduce((s, t) => s + t, 0) / taxas.length

  let mrrBase = Number(snapshots[snapshots.length - 1].mrr)
  const projecoes: ProjecaoData[] = []
  const ultimaData = snapshots[snapshots.length - 1].data

  for (let i = 1; i <= meses; i++) {
    mrrBase = mrrBase * (1 + taxaMedia)
    projecoes.push({
      mes: format(addMonths(ultimaData, i), 'yyyy-MM'),
      mrr: Math.round(mrrBase),
      mrrMin: Math.round(mrrBase * 0.85),
      mrrMax: Math.round(mrrBase * 1.15),
    })
  }

  return projecoes
}

export async function salvarSaasSnapshot(): Promise<void> {
  const hoje = startOfMonth(new Date())
  const [mrrData, { churnRate }, totalTenants, tenantAtivos] = await Promise.all([
    calcularMRR(),
    calcularChurn(new Date().getMonth() + 1, new Date().getFullYear()),
    prisma.tenant.count({ where: { deletedAt: null } }),
    prisma.tenantSubscription.count({ where: { status: 'ACTIVE' } }),
  ])

  await prisma.saasMetricsSnapshot.upsert({
    where: { data: hoje },
    create: {
      data: hoje,
      mrr: mrrData.total,
      mrrPorPlano: mrrData.porPlano,
      churnRate,
      tenantCount: totalTenants,
      tenantAtivos,
    },
    update: {
      mrr: mrrData.total,
      mrrPorPlano: mrrData.porPlano,
      churnRate,
      tenantCount: totalTenants,
      tenantAtivos,
    },
  })
}
```

- [ ] **Passo 4: Executar testes**

```bash
npx vitest run src/services/admin/saas-metrics.service.test.ts
```

Saída esperada: `✓ 5 tests passed`.

- [ ] **Passo 5: Commit**

```bash
git add src/services/admin/saas-metrics.service.ts src/services/admin/saas-metrics.service.test.ts
git commit -m "feat(admin): implement saas-metrics.service"
```

---

## Task 4: BullMQ — Adicionar filas ao `queues.ts`

**Arquivos:**
- Modificar: `src/lib/queues.ts`

- [ ] **Passo 1: Adicionar as novas filas**

Abrir `src/lib/queues.ts`. Ao final do arquivo, adicionar:

```ts
import { Queue } from 'bullmq'
import { redisConnectionOptions } from './bullmq'

export const platformHealthQueue = new Queue('platform-health', {
  connection: redisConnectionOptions,
  defaultJobOptions: { attempts: 2, backoff: { type: 'fixed', delay: 3000 } },
})

export const saasMetricsQueue = new Queue('saas-metrics-snapshot', {
  connection: redisConnectionOptions,
  defaultJobOptions: { attempts: 2, backoff: { type: 'fixed', delay: 5000 } },
})

// Silenciar erros de conexão
for (const q of [platformHealthQueue, saasMetricsQueue]) {
  q.on('error', (err) => {
    const code = (err as NodeJS.ErrnoException).code
    if (code !== 'ECONNREFUSED' && code !== 'EPIPE') {
      console.error(`[${q.name}]`, err.message)
    }
  })
}
```

- [ ] **Passo 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Passo 3: Commit**

```bash
git add src/lib/queues.ts
git commit -m "feat(queues): add platform-health and saas-metrics-snapshot queues"
```

---

## Task 5: Criar os jobs e o worker

**Arquivos:**
- Criar: `src/jobs/admin/platform-health.job.ts`
- Criar: `src/jobs/admin/saas-metrics-snapshot.job.ts`
- Criar: `src/jobs/worker.ts`

- [ ] **Passo 1: Criar `platform-health.job.ts`**

Criar `src/jobs/admin/platform-health.job.ts`:

```ts
import { Worker, type Job } from 'bullmq'
import { redisConnectionOptions } from '@/lib/bullmq'
import { coletarMetricas, salvarSnapshot } from '@/services/admin/platform-health.service'

export function criarPlatformHealthWorker() {
  const worker = new Worker(
    'platform-health',
    async (_job: Job) => {
      const metricas = await coletarMetricas()
      await salvarSnapshot(metricas)
    },
    { connection: redisConnectionOptions }
  )

  worker.on('failed', (job, err) => {
    console.error(`[platform-health] Job ${job?.id} falhou:`, err.message)
  })

  return worker
}
```

- [ ] **Passo 2: Criar `saas-metrics-snapshot.job.ts`**

Criar `src/jobs/admin/saas-metrics-snapshot.job.ts`:

```ts
import { Worker, type Job } from 'bullmq'
import { redisConnectionOptions } from '@/lib/bullmq'
import { salvarSaasSnapshot } from '@/services/admin/saas-metrics.service'

export function criarSaasMetricsWorker() {
  const worker = new Worker(
    'saas-metrics-snapshot',
    async (_job: Job) => {
      await salvarSaasSnapshot()
    },
    { connection: redisConnectionOptions }
  )

  worker.on('failed', (job, err) => {
    console.error(`[saas-metrics-snapshot] Job ${job?.id} falhou:`, err.message)
  })

  return worker
}
```

- [ ] **Passo 3: Criar `src/jobs/worker.ts`**

```ts
import { platformHealthQueue, saasMetricsQueue } from '@/lib/queues'
import { criarPlatformHealthWorker } from './admin/platform-health.job'
import { criarSaasMetricsWorker } from './admin/saas-metrics-snapshot.job'

async function iniciarWorker() {
  console.log('[worker] Iniciando workers BullMQ...')

  // Registrar jobs recorrentes (upsert para não duplicar em restart)
  await platformHealthQueue.upsertJobScheduler(
    'platform-health-cron',
    { pattern: '*/5 * * * *' },
    { name: 'platform-health', data: {} }
  )

  await saasMetricsQueue.upsertJobScheduler(
    'saas-metrics-daily',
    { pattern: '0 1 * * *' },
    { name: 'saas-metrics-snapshot', data: {} }
  )

  // Iniciar workers
  criarPlatformHealthWorker()
  criarSaasMetricsWorker()

  console.log('[worker] Workers iniciados.')
  console.log('[worker] platform-health: a cada 5 minutos')
  console.log('[worker] saas-metrics-snapshot: diário às 01h')
}

iniciarWorker().catch((err) => {
  console.error('[worker] Erro ao iniciar:', err)
  process.exit(1)
})
```

- [ ] **Passo 4: Adicionar script no `package.json`**

Abrir `package.json`. No objeto `"scripts"`, adicionar:

```json
"worker": "tsx src/jobs/worker.ts"
```

- [ ] **Passo 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Passo 6: Commit**

```bash
git add src/jobs/ package.json
git commit -m "feat(jobs): add BullMQ workers for platform-health and saas-metrics"
```

---

## Checklist final da Parte 4

- [ ] `npx prisma migrate status` — migrations aplicadas
- [ ] `npx vitest run src/services/admin/` — todos os testes passando
- [ ] `npx tsc --noEmit` — sem erros
- [ ] `npm run worker` com Redis rodando: logs `[worker] Workers iniciados.` sem erros
