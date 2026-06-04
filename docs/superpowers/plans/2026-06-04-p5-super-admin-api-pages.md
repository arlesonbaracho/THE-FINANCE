# Agente 5 · Parte 5 — Admin API Routes & Páginas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar todas as rotas de API do Super Admin e as quatro páginas do painel de saúde, uso de IA, integrações e financeiro SaaS.

**Architecture:** API routes em `src/app/api/admin/` seguindo o padrão existente (`getAdminSession()` em todas as rotas). Páginas Server Components para dados, com ilhas Client Component onde há interatividade. Recharts para todos os gráficos.

**Tech Stack:** Next.js 14 App Router, Recharts, Prisma, TypeScript

**Pré-requisito:** Parte 4 concluída (schema migrado, services implementados).

---

## Mapa de arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/app/api/admin/saude/metricas/route.ts` |
| Criar | `src/app/api/admin/saude/historico/route.ts` |
| Criar | `src/app/api/admin/uso-ia/route.ts` |
| Criar | `src/app/api/admin/uso-ia/[tenantId]/limite/route.ts` |
| Criar | `src/app/api/admin/integracoes/route.ts` |
| Criar | `src/app/api/admin/integracoes/[tenantId]/desconectar/route.ts` |
| Criar | `src/app/api/admin/financeiro/mrr/route.ts` |
| Criar | `src/app/api/admin/financeiro/metricas/route.ts` |
| Criar | `src/app/api/admin/financeiro/cohort/route.ts` |
| Criar | `src/app/api/admin/financeiro/projecao/route.ts` |
| Criar | `src/app/(admin)/admin/saude/page.tsx` |
| Criar | `src/app/(admin)/admin/uso-ia/page.tsx` |
| Criar | `src/app/(admin)/admin/integracoes/page.tsx` |
| Criar | `src/app/(admin)/admin/financeiro/page.tsx` |
| Modificar | `src/app/(admin)/layout.tsx` |

---

## Task 1: API Routes — Saúde da Plataforma

- [ ] **Passo 1: Criar `src/app/api/admin/saude/metricas/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Buscar o último log de cada tipo
  const tipos = ['API', 'JOB', 'WEBHOOK', 'DATABASE', 'REDIS', 'AI'] as const
  const ultimos = await Promise.all(
    tipos.map((tipo) =>
      prisma.platformHealthLog.findFirst({
        where: { tipo },
        orderBy: { registradoEm: 'desc' },
      }).then((log) => ({ tipo, log }))
    )
  )

  // Alertas ativos não resolvidos
  const alertas = await prisma.adminNotification.findMany({
    where: { resolvido: false },
    orderBy: { criadoEm: 'desc' },
    take: 50,
  })

  return NextResponse.json({ metricas: ultimos, alertas })
}
```

- [ ] **Passo 2: Criar `src/app/api/admin/saude/historico/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { subHours } from 'date-fns'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const horas = parseInt(req.nextUrl.searchParams.get('horas') ?? '24', 10)
  const desde = subHours(new Date(), horas)

  const logs = await prisma.platformHealthLog.findMany({
    where: {
      tipo: 'API',
      registradoEm: { gte: desde },
    },
    select: { metrica: true, valor: true, status: true, registradoEm: true },
    orderBy: { registradoEm: 'asc' },
  })

  return NextResponse.json(logs)
}
```

- [ ] **Passo 3: Criar rota para resolver alerta**

Criar `src/app/api/admin/saude/alertas/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const alerta = await prisma.adminNotification.update({
    where: { id: params.id },
    data: { resolvido: true, resolvidoEm: new Date() },
  })
  return NextResponse.json(alerta)
}
```

- [ ] **Passo 4: Commit**

```bash
git add src/app/api/admin/saude/
git commit -m "feat(admin-api): add /api/admin/saude/* routes"
```

---

## Task 2: API Routes — Uso de IA

- [ ] **Passo 1: Criar `src/app/api/admin/uso-ia/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const usages = await prisma.aiUsage.findMany({
    include: {
      tenant: {
        include: { subscription: { include: { plan: true } } },
      },
    },
    orderBy: { custoEstimado: 'desc' },
  })

  return NextResponse.json(usages)
}
```

- [ ] **Passo 2: Criar `src/app/api/admin/uso-ia/[tenantId]/limite/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { tenantId: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { limiteTokens } = await req.json()
  if (typeof limiteTokens !== 'number' || limiteTokens < 0) {
    return NextResponse.json({ error: 'limiteTokens inválido' }, { status: 400 })
  }

  const updated = await prisma.aiUsage.update({
    where: { tenantId: params.tenantId },
    data: { limiteTokens },
  })
  return NextResponse.json(updated)
}

export async function POST(_req: NextRequest, { params }: { params: { tenantId: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Resetar contador (zerar tokens do mês atual)
  const agora = new Date()
  const updated = await prisma.aiUsage.update({
    where: { tenantId: params.tenantId },
    data: {
      tokensInput: 0,
      tokensOutput: 0,
      custoEstimado: 0,
      mes: agora.getMonth() + 1,
      ano: agora.getFullYear(),
    },
  })
  return NextResponse.json(updated)
}
```

- [ ] **Passo 3: Commit**

```bash
git add src/app/api/admin/uso-ia/
git commit -m "feat(admin-api): add /api/admin/uso-ia/* routes"
```

---

## Task 3: API Routes — Integrações

- [ ] **Passo 1: Criar `src/app/api/admin/integracoes/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const tenants = await prisma.tenant.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      ifoodIntegracao: {
        select: { status: true, ultimaSincronizacao: true, merchantId: true },
      },
      whatsappContatos: {
        select: { updatedAt: true },
        take: 1,
        orderBy: { updatedAt: 'desc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(tenants)
}
```

- [ ] **Passo 2: Criar `src/app/api/admin/integracoes/[tenantId]/desconectar/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest, { params }: { params: { tenantId: string } }) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { integracao } = await req.json() as { integracao: 'ifood' | 'whatsapp' }

  if (integracao === 'ifood') {
    await prisma.iFoodIntegration.update({
      where: { tenantId: params.tenantId },
      data: {
        status: 'DESCONECTADO',
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
      },
    })
    return NextResponse.json({ ok: true, integracao: 'ifood' })
  }

  if (integracao === 'whatsapp') {
    // Enviar logout para Evolution API
    try {
      const envUrl = process.env.EVOLUTION_API_URL ?? 'http://localhost:8080'
      const apiKey = process.env.EVOLUTION_API_KEY ?? ''
      await fetch(`${envUrl}/instance/logout/${params.tenantId}`, {
        method: 'DELETE',
        headers: { apikey: apiKey },
      })
    } catch { /* ignorar erro de rede — Evolution pode estar offline */ }

    // Limpar contatos locais não é necessário — apenas registrar desconexão
    return NextResponse.json({ ok: true, integracao: 'whatsapp' })
  }

  return NextResponse.json({ error: 'integracao deve ser ifood ou whatsapp' }, { status: 400 })
}
```

- [ ] **Passo 3: Commit**

```bash
git add src/app/api/admin/integracoes/
git commit -m "feat(admin-api): add /api/admin/integracoes/* routes"
```

---

## Task 4: API Routes — Financeiro SaaS

- [ ] **Passo 1: Criar `src/app/api/admin/financeiro/mrr/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { calcularMRR, historicMRR } from '@/services/admin/saas-metrics.service'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const meses = parseInt(req.nextUrl.searchParams.get('meses') ?? '12', 10)

  const [atual, historico] = await Promise.all([
    calcularMRR(),
    historicMRR(meses),
  ])

  return NextResponse.json({ atual, historico })
}
```

- [ ] **Passo 2: Criar `src/app/api/admin/financeiro/metricas/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { calcularChurn, calcularLTV, calcularNRR } from '@/services/admin/saas-metrics.service'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const agora = new Date()
  const mes = parseInt(req.nextUrl.searchParams.get('mes') ?? String(agora.getMonth() + 1), 10)
  const ano = parseInt(req.nextUrl.searchParams.get('ano') ?? String(agora.getFullYear()), 10)

  const [churn, ltv, nrr, cacSettings] = await Promise.all([
    calcularChurn(mes, ano),
    calcularLTV(),
    calcularNRR(mes, ano),
    prisma.adminSettings.findUnique({ where: { chave: 'cac_mensal' } }),
  ])

  const mesKey = `${ano}-${String(mes).padStart(2, '0')}`
  const cac = cacSettings ? (cacSettings.valor as Record<string, number>)[mesKey] ?? null : null

  return NextResponse.json({ churn, ltv, nrr, cac })
}

export async function PATCH(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { mes, ano, cac } = await req.json()
  const mesKey = `${ano}-${String(mes).padStart(2, '0')}`

  const existing = await prisma.adminSettings.findUnique({ where: { chave: 'cac_mensal' } })
  const valorAtual = (existing?.valor as Record<string, number>) ?? {}
  valorAtual[mesKey] = cac

  await prisma.adminSettings.upsert({
    where: { chave: 'cac_mensal' },
    create: { chave: 'cac_mensal', valor: valorAtual },
    update: { valor: valorAtual },
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Passo 3: Criar `src/app/api/admin/financeiro/cohort/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { cohortAnalysis } from '@/services/admin/saas-metrics.service'

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const data = await cohortAnalysis()
  return NextResponse.json(data)
}
```

- [ ] **Passo 4: Criar `src/app/api/admin/financeiro/projecao/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { projecaoReceita } from '@/services/admin/saas-metrics.service'

export async function GET(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const meses = parseInt(req.nextUrl.searchParams.get('meses') ?? '3', 10)
  const data = await projecaoReceita(meses)
  return NextResponse.json(data)
}
```

- [ ] **Passo 5: Commit**

```bash
git add src/app/api/admin/financeiro/
git commit -m "feat(admin-api): add /api/admin/financeiro/* routes"
```

---

## Task 5: Página `/admin/saude`

- [ ] **Passo 1: Criar `src/app/(admin)/admin/saude/page.tsx`**

```tsx
import { getAdminSession } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'
import { SaudeClient } from './saude-client'

export default async function AdminSaudePage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  return <SaudeClient />
}
```

- [ ] **Passo 2: Criar `src/app/(admin)/admin/saude/saude-client.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'

interface MetricaItem {
  tipo: string
  log: { valor: number; status: string; registradoEm: string } | null
}
interface Alerta { id: string; tipo: string; titulo: string; severidade: string; criadoEm: string }
interface HistoricoItem { valor: number; status: string; registradoEm: string }

const STATUS_COLOR: Record<string, string> = { OK: '#10b981', ALERTA: '#f59e0b', CRITICO: '#ef4444' }

export function SaudeClient() {
  const [metricas, setMetricas] = useState<MetricaItem[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [historico, setHistorico] = useState<HistoricoItem[]>([])

  async function carregar() {
    const [m, h] = await Promise.all([
      fetch('/api/admin/saude/metricas').then((r) => r.json()),
      fetch('/api/admin/saude/historico?horas=24').then((r) => r.json()),
    ])
    setMetricas(m.metricas)
    setAlertas(m.alertas)
    setHistorico(h)
  }

  useEffect(() => { carregar() }, [])

  async function resolverAlerta(id: string) {
    await fetch(`/api/admin/saude/alertas/${id}`, { method: 'PATCH' })
    setAlertas((prev) => prev.filter((a) => a.id !== id))
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--tf-surface)',
    border: '1px solid var(--tf-border)',
    borderRadius: 12,
    padding: 20,
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 24 }}>Saúde da Plataforma</h1>

      {/* Cards de status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {metricas.map(({ tipo, log }) => (
          <div key={tipo} style={{ ...cardStyle, borderTop: `3px solid ${STATUS_COLOR[log?.status ?? 'OK']}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-txt3)', marginBottom: 8 }}>{tipo}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--tf-txt)' }}>
              {log ? Number(log.valor).toFixed(1) : '—'}
            </div>
            <div style={{
              display: 'inline-block', marginTop: 4, fontSize: 10, fontWeight: 600,
              color: '#fff', background: STATUS_COLOR[log?.status ?? 'OK'],
              borderRadius: 4, padding: '1px 6px',
            }}>
              {log?.status ?? 'SEM DADOS'}
            </div>
          </div>
        ))}
      </div>

      {/* Gráfico de latência */}
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 16 }}>
          Latência das últimas 24h (ms)
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={historico.map((h) => ({ ...h, valor: Number(h.valor) }))}>
            <XAxis
              dataKey="registradoEm"
              tickFormatter={(v) => new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              tick={{ fontSize: 10, fill: 'var(--tf-txt3)' }}
            />
            <YAxis tick={{ fontSize: 10, fill: 'var(--tf-txt3)' }} />
            <Tooltip
              contentStyle={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 8 }}
              labelFormatter={(v) => new Date(v).toLocaleString('pt-BR')}
            />
            <ReferenceLine y={2000} stroke="#ef4444" strokeDasharray="4 4" label={{ value: '2000ms', fill: '#ef4444', fontSize: 10 }} />
            <Line type="monotone" dataKey="valor" stroke="var(--tf-primary)" dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Alertas ativos */}
      {alertas.length > 0 && (
        <div style={{ ...cardStyle, marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 12 }}>Alertas Ativos</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Tipo', 'Título', 'Severidade', 'Horário', 'Ação'].map((col) => (
                  <th key={col} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, color: 'var(--tf-txt3)', borderBottom: '1px solid var(--tf-border)' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alertas.map((a) => (
                <tr key={a.id}>
                  <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>{a.tipo}</td>
                  <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>{a.titulo}</td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--tf-border)' }}>
                    <span style={{ fontSize: 11, background: STATUS_COLOR[a.severidade] ?? '#6b7280', color: '#fff', borderRadius: 4, padding: '2px 8px' }}>
                      {a.severidade}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--tf-txt3)', borderBottom: '1px solid var(--tf-border)' }}>
                    {new Date(a.criadoEm).toLocaleString('pt-BR')}
                  </td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--tf-border)' }}>
                    <button
                      onClick={() => resolverAlerta(a.id)}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt)', cursor: 'pointer' }}
                    >
                      Resolver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Passo 3: Commit**

```bash
git add src/app/(admin)/admin/saude/
git commit -m "feat(admin): add /admin/saude page"
```

---

## Task 6: Página `/admin/uso-ia`

- [ ] **Passo 1: Criar `src/app/(admin)/admin/uso-ia/page.tsx`**

```tsx
import { getAdminSession } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'
import { UsoIaClient } from './uso-ia-client'

export default async function AdminUsoIaPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  return <UsoIaClient />
}
```

- [ ] **Passo 2: Criar `src/app/(admin)/admin/uso-ia/uso-ia-client.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface AiUsage {
  tenantId: string
  tokensInput: number
  tokensOutput: number
  custoEstimado: number
  limiteTokens: number
  tenant: { name: string; subscription: { plan: { name: string } } | null }
}

export function UsoIaClient() {
  const [usages, setUsages] = useState<AiUsage[]>([])
  const [modalTenant, setModalTenant] = useState<string | null>(null)
  const [novoLimite, setNovoLimite] = useState('')

  async function carregar() {
    const d = await fetch('/api/admin/uso-ia').then((r) => r.json())
    setUsages(d)
  }

  useEffect(() => { carregar() }, [])

  async function salvarLimite() {
    if (!modalTenant) return
    await fetch(`/api/admin/uso-ia/${modalTenant}/limite`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limiteTokens: parseInt(novoLimite, 10) }),
    })
    setModalTenant(null)
    carregar()
  }

  async function resetarContador(tenantId: string) {
    if (!confirm('Resetar contador de tokens deste tenant?')) return
    await fetch(`/api/admin/uso-ia/${tenantId}/limite`, { method: 'POST' })
    carregar()
  }

  const totalHoje = usages.reduce((s, u) => s + u.tokensInput + u.tokensOutput, 0)
  const custoMes = usages.reduce((s, u) => s + Number(u.custoEstimado), 0)
  const acima = usages.filter((u) => u.limiteTokens > 0 && (u.tokensInput + u.tokensOutput) >= u.limiteTokens).length
  const proximo = usages.filter((u) => {
    if (u.limiteTokens === 0) return false
    const pct = (u.tokensInput + u.tokensOutput) / u.limiteTokens
    return pct >= 0.8 && pct < 1
  }).length

  const top10 = [...usages]
    .sort((a, b) => (b.tokensInput + b.tokensOutput) - (a.tokensInput + a.tokensOutput))
    .slice(0, 10)
    .map((u) => ({ name: u.tenant.name.slice(0, 12), tokens: u.tokensInput + u.tokensOutput }))

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 24 }}>Uso de IA</h1>

      {/* Cards resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Tokens hoje (plataforma)', valor: totalHoje.toLocaleString('pt-BR') },
          { label: 'Custo estimado (mês)', valor: `R$ ${custoMes.toFixed(2)}` },
          { label: 'Acima do limite', valor: String(acima) },
          { label: 'Próximos do limite', valor: String(proximo) },
        ].map((c) => (
          <div key={c.label} style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--tf-txt)' }}>{c.valor}</div>
          </div>
        ))}
      </div>

      {/* Gráfico top 10 */}
      <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 12 }}>Top 10 tenants por consumo</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={top10}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--tf-txt3)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--tf-txt3)' }} />
            <Tooltip contentStyle={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 8 }} />
            <Bar dataKey="tokens" fill="var(--tf-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela completa */}
      <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Tenant', 'Plano', 'Tokens input', 'Tokens output', 'Custo R$', 'Limite', '% usado', 'Ações'].map((col) => (
                <th key={col} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: 'var(--tf-txt3)', borderBottom: '1px solid var(--tf-border)' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usages.map((u) => {
              const total = u.tokensInput + u.tokensOutput
              const pct = u.limiteTokens > 0 ? Math.round((total / u.limiteTokens) * 100) : null
              const isAcima = pct !== null && pct >= 100
              const isProximo = pct !== null && pct >= 80 && pct < 100
              return (
                <tr key={u.tenantId}>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>{u.tenant.name}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--tf-txt3)', borderBottom: '1px solid var(--tf-border)' }}>{u.tenant.subscription?.plan.name ?? '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>{u.tokensInput.toLocaleString('pt-BR')}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>{u.tokensOutput.toLocaleString('pt-BR')}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>R$ {Number(u.custoEstimado).toFixed(4)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>{u.limiteTokens === 0 ? '∞' : u.limiteTokens.toLocaleString('pt-BR')}</td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--tf-border)' }}>
                    {pct !== null ? (
                      <span style={{ fontSize: 11, background: isAcima ? '#ef4444' : isProximo ? '#f59e0b' : '#10b981', color: '#fff', borderRadius: 4, padding: '2px 8px' }}>
                        {pct}%
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--tf-border)' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => { setModalTenant(u.tenantId); setNovoLimite(String(u.limiteTokens)) }}
                        style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt)', cursor: 'pointer' }}
                      >
                        Editar limite
                      </button>
                      <button
                        onClick={() => resetarContador(u.tenantId)}
                        style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                      >
                        Resetar
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal editar limite */}
      {modalTenant && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--tf-surface)', borderRadius: 12, padding: 32, minWidth: 320, border: '1px solid var(--tf-border)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--tf-txt)' }}>Editar limite de tokens</h2>
            <label style={{ fontSize: 12, color: 'var(--tf-txt3)', display: 'block', marginBottom: 4 }}>Limite (0 = ilimitado)</label>
            <input
              type="number"
              value={novoLimite}
              onChange={(e) => setNovoLimite(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt)', fontSize: 13, marginBottom: 20, boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalTenant(null)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarLimite} style={{ padding: '8px 16px', borderRadius: 6, background: 'var(--tf-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Passo 3: Commit**

```bash
git add src/app/(admin)/admin/uso-ia/
git commit -m "feat(admin): add /admin/uso-ia page"
```

---

## Task 7: Página `/admin/integracoes`

- [ ] **Passo 1: Criar `src/app/(admin)/admin/integracoes/page.tsx`**

```tsx
import { getAdminSession } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'
import { IntegracoesClient } from './integracoes-client'

export default async function AdminIntegracoesPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  return <IntegracoesClient />
}
```

- [ ] **Passo 2: Criar `src/app/(admin)/admin/integracoes/integracoes-client.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface Tenant {
  id: string
  name: string
  ifoodIntegracao: { status: string; merchantId: string; ultimaSincronizacao: string | null } | null
  whatsappContatos: Array<{ updatedAt: string }>
}

export function IntegracoesClient() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [expandido, setExpandido] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/integracoes').then((r) => r.json()).then(setTenants)
  }, [])

  async function desconectar(tenantId: string, integracao: 'ifood' | 'whatsapp') {
    const label = integracao === 'ifood' ? 'iFood' : 'WhatsApp'
    if (!confirm(`Forçar desconexão do ${label} para este tenant?`)) return

    await fetch(`/api/admin/integracoes/${tenantId}/desconectar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ integracao }),
    })
    fetch('/api/admin/integracoes').then((r) => r.json()).then(setTenants)
  }

  const STATUS_COLOR: Record<string, string> = { CONECTADO: '#10b981', DESCONECTADO: '#6b7280', ERRO: '#ef4444' }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 24 }}>Integrações</h1>

      <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Tenant', 'iFood', 'WhatsApp', 'Última atividade', ''].map((col) => (
                <th key={col} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: 'var(--tf-txt3)', borderBottom: '1px solid var(--tf-border)' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <>
                <tr
                  key={t.id}
                  onClick={() => setExpandido(expandido === t.id ? null : t.id)}
                  style={{ cursor: 'pointer', background: expandido === t.id ? 'var(--tf-surface-hover)' : 'transparent' }}
                >
                  <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>{t.name}</td>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--tf-border)' }}>
                    <span style={{ fontSize: 11, background: STATUS_COLOR[t.ifoodIntegracao?.status ?? 'DESCONECTADO'], color: '#fff', borderRadius: 4, padding: '2px 8px' }}>
                      {t.ifoodIntegracao?.status ?? 'DESCONECTADO'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--tf-border)' }}>
                    <span style={{ fontSize: 11, background: t.whatsappContatos.length > 0 ? '#10b981' : '#6b7280', color: '#fff', borderRadius: 4, padding: '2px 8px' }}>
                      {t.whatsappContatos.length > 0 ? 'CONECTADO' : 'DESCONECTADO'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--tf-txt3)', borderBottom: '1px solid var(--tf-border)' }}>
                    {t.ifoodIntegracao?.ultimaSincronizacao
                      ? new Date(t.ifoodIntegracao.ultimaSincronizacao).toLocaleString('pt-BR')
                      : '—'}
                  </td>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--tf-border)' }}>
                    {expandido === t.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </td>
                </tr>
                {expandido === t.id && (
                  <tr key={`${t.id}-detail`}>
                    <td colSpan={5} style={{ padding: '16px 24px', background: 'var(--tf-surface-hover)', borderBottom: '1px solid var(--tf-border)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tf-txt3)', marginBottom: 8 }}>iFood</div>
                          <div style={{ fontSize: 13, color: 'var(--tf-txt)', marginBottom: 4 }}>Merchant ID: {t.ifoodIntegracao?.merchantId ?? '—'}</div>
                          <div style={{ fontSize: 13, color: 'var(--tf-txt)', marginBottom: 12 }}>
                            Última sync: {t.ifoodIntegracao?.ultimaSincronizacao ? new Date(t.ifoodIntegracao.ultimaSincronizacao).toLocaleString('pt-BR') : '—'}
                          </div>
                          {t.ifoodIntegracao?.status === 'CONECTADO' && (
                            <button
                              onClick={() => desconectar(t.id, 'ifood')}
                              style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                            >
                              Forçar desconexão iFood
                            </button>
                          )}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tf-txt3)', marginBottom: 8 }}>WhatsApp</div>
                          <div style={{ fontSize: 13, color: 'var(--tf-txt)', marginBottom: 12 }}>
                            Último envio: {t.whatsappContatos[0]?.updatedAt ? new Date(t.whatsappContatos[0].updatedAt).toLocaleString('pt-BR') : '—'}
                          </div>
                          {t.whatsappContatos.length > 0 && (
                            <button
                              onClick={() => desconectar(t.id, 'whatsapp')}
                              style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                            >
                              Forçar desconexão WhatsApp
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Passo 3: Commit**

```bash
git add src/app/(admin)/admin/integracoes/
git commit -m "feat(admin): add /admin/integracoes page"
```

---

## Task 8: Página `/admin/financeiro`

- [ ] **Passo 1: Criar `src/app/(admin)/admin/financeiro/page.tsx`**

```tsx
import { getAdminSession } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'
import { FinanceiroClient } from './financeiro-client'

export default async function AdminFinanceiroPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  return <FinanceiroClient />
}
```

- [ ] **Passo 2: Criar `src/app/(admin)/admin/financeiro/financeiro-client.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'

type Tab = 'mrr' | 'metricas' | 'cohort' | 'projecao'

interface MRRHistorico { data: string; mrr: number; mrrPorPlano: Record<string, number> }
interface Metricas { churn: { churnRate: number }; ltv: number; nrr: number; cac: number | null }
interface CohortRow { cohort: string; retencao: number[] }
interface ProjecaoItem { mes: string; mrr: number; mrrMin: number; mrrMax: number }

const CORES_RETENCAO = (v: number) =>
  v >= 90 ? '#166534' : v >= 70 ? '#16a34a' : v >= 50 ? '#f59e0b' : '#ef4444'

export function FinanceiroClient() {
  const [tab, setTab] = useState<Tab>('mrr')
  const [mrr, setMrr] = useState<{ atual: { total: number; porPlano: Record<string, number> }; historico: MRRHistorico[] } | null>(null)
  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [cohort, setCohort] = useState<CohortRow[]>([])
  const [projecao, setProjecao] = useState<ProjecaoItem[]>([])
  const [cacInput, setCacInput] = useState('')

  useEffect(() => {
    if (tab === 'mrr' && !mrr) fetch('/api/admin/financeiro/mrr').then((r) => r.json()).then(setMrr)
    if (tab === 'metricas' && !metricas) fetch('/api/admin/financeiro/metricas').then((r) => r.json()).then(setMetricas)
    if (tab === 'cohort' && cohort.length === 0) fetch('/api/admin/financeiro/cohort').then((r) => r.json()).then(setCohort)
    if (tab === 'projecao' && projecao.length === 0) fetch('/api/admin/financeiro/projecao').then((r) => r.json()).then(setProjecao)
  }, [tab])

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px', borderRadius: '8px 8px 0 0',
    border: '1px solid var(--tf-border)',
    borderBottom: active ? '1px solid var(--tf-surface)' : '1px solid var(--tf-border)',
    background: active ? 'var(--tf-surface)' : 'transparent',
    color: active ? 'var(--tf-txt)' : 'var(--tf-txt3)',
    cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400, marginBottom: -1,
  })

  const cardStyle: React.CSSProperties = {
    background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 12, padding: 20,
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 8 }}>Financeiro SaaS</h1>

      <div style={{ display: 'flex', gap: 0, marginBottom: 0 }}>
        {(['mrr', 'metricas', 'cohort', 'projecao'] as Tab[]).map((t) => (
          <button key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>
            {{ mrr: 'MRR', metricas: 'Métricas', cohort: 'Cohort', projecao: 'Projeção' }[t]}
          </button>
        ))}
      </div>

      <div style={{ ...cardStyle, borderRadius: '0 8px 8px 8px' }}>
        {/* ── MRR ── */}
        {tab === 'mrr' && mrr && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              <div style={cardStyle}>
                <div style={{ fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 4 }}>MRR Total</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--tf-txt)' }}>
                  R$ {mrr.atual.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 4 }}>ARR Projetado</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--tf-txt)' }}>
                  R$ {(mrr.atual.total * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div style={cardStyle}>
                <div style={{ fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 4 }}>Planos ativos</div>
                <div style={{ fontSize: 16, color: 'var(--tf-txt)' }}>
                  {Object.entries(mrr.atual.porPlano).map(([id, v]) => (
                    <div key={id}>{id}: R$ {Number(v).toFixed(2)}</div>
                  ))}
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={mrr.historico.map((h) => ({ ...h, mrr: Number(h.mrr) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--tf-border)" />
                <XAxis dataKey="data" tickFormatter={(v) => v.slice(0, 7)} tick={{ fontSize: 11, fill: 'var(--tf-txt3)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--tf-txt3)' }} />
                <Tooltip contentStyle={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 8 }} />
                <Area type="monotone" dataKey="mrr" stroke="var(--tf-primary)" fill="var(--tf-primary)" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Métricas ── */}
        {tab === 'metricas' && metricas && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Churn Rate', valor: `${metricas.churn.churnRate.toFixed(1)}%` },
                { label: 'LTV Médio', valor: `R$ ${metricas.ltv.toFixed(2)}` },
                { label: 'NRR', valor: `${metricas.nrr.toFixed(1)}%` },
                { label: 'CAC (manual)', valor: metricas.cac ? `R$ ${metricas.cac}` : 'Não definido' },
              ].map((c) => (
                <div key={c.label} style={cardStyle}>
                  <div style={{ fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--tf-txt)' }}>{c.valor}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <input
                placeholder="Novo CAC (R$)"
                value={cacInput}
                onChange={(e) => setCacInput(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt)', fontSize: 13 }}
              />
              <button
                onClick={async () => {
                  const agora = new Date()
                  await fetch('/api/admin/financeiro/metricas', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mes: agora.getMonth() + 1, ano: agora.getFullYear(), cac: parseFloat(cacInput) }),
                  })
                  fetch('/api/admin/financeiro/metricas').then((r) => r.json()).then(setMetricas)
                }}
                style={{ padding: '6px 16px', borderRadius: 6, background: 'var(--tf-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13 }}
              >
                Salvar CAC
              </button>
            </div>
          </div>
        )}

        {/* ── Cohort ── */}
        {tab === 'cohort' && cohort.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 12px', color: 'var(--tf-txt3)', fontWeight: 600, borderBottom: '1px solid var(--tf-border)', whiteSpace: 'nowrap' }}>Cohort</th>
                  {cohort[0].retencao.map((_, i) => (
                    <th key={i} style={{ padding: '8px 12px', color: 'var(--tf-txt3)', fontWeight: 600, borderBottom: '1px solid var(--tf-border)', textAlign: 'center' }}>
                      M{i}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohort.map((row) => (
                  <tr key={row.cohort}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)', whiteSpace: 'nowrap' }}>{row.cohort}</td>
                    {row.retencao.map((v, i) => (
                      <td
                        key={i}
                        title={`${row.cohort} — Mês ${i}: ${v}%`}
                        style={{
                          padding: '8px 12px', textAlign: 'center',
                          background: CORES_RETENCAO(v),
                          color: '#fff', fontWeight: 600,
                          borderBottom: '1px solid rgba(0,0,0,0.1)',
                        }}
                      >
                        {v}%
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Projeção ── */}
        {tab === 'projecao' && projecao.length > 0 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              {projecao.map((p, i) => (
                <div key={p.mes} style={cardStyle}>
                  <div style={{ fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 4 }}>Mês {i + 1} ({p.mes})</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--tf-txt)' }}>
                    R$ {p.mrr.toLocaleString('pt-BR')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--tf-txt3)', marginTop: 4 }}>
                    {p.mrrMin.toLocaleString('pt-BR')} – {p.mrrMax.toLocaleString('pt-BR')}
                  </div>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={projecao.map((p) => ({ ...p }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--tf-border)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--tf-txt3)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--tf-txt3)' }} />
                <Tooltip contentStyle={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="mrr" stroke="var(--tf-primary)" strokeWidth={2} strokeDasharray="6 3" name="Projeção" />
                <Line type="monotone" dataKey="mrrMin" stroke="#6b7280" strokeWidth={1} strokeDasharray="2 4" name="Mínimo" dot={false} />
                <Line type="monotone" dataKey="mrrMax" stroke="#6b7280" strokeWidth={1} strokeDasharray="2 4" name="Máximo" dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <p style={{ fontSize: 11, color: 'var(--tf-txt3)', marginTop: 12 }}>
              * Projeção baseada na taxa de crescimento média dos últimos 3 meses. Intervalo de confiança: ±15%.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Passo 3: Commit**

```bash
git add src/app/(admin)/admin/financeiro/
git commit -m "feat(admin): add /admin/financeiro page with MRR, Métricas, Cohort, Projeção tabs"
```

---

## Task 9: Atualizar layout e nav do Admin

**Arquivos:**
- Modificar: `src/app/(admin)/layout.tsx`

- [ ] **Passo 1: Verificar a estrutura atual do layout**

```bash
cat src/app/(admin)/layout.tsx
```

- [ ] **Passo 2: Adicionar links de nav para as novas páginas**

Abrir `src/app/(admin)/layout.tsx`. Localizar onde estão os links de navegação existentes (ex: "Restaurantes", "Planos", "Logs"). Adicionar após os links existentes:

```tsx
{/* Novos links — Super Admin Fase 3 */}
<Link href="/admin/saude" className="...">
  Saúde
</Link>
<Link href="/admin/uso-ia" className="...">
  Uso de IA
</Link>
<Link href="/admin/integracoes" className="...">
  Integrações
</Link>
<Link href="/admin/financeiro" className="...">
  Financeiro
</Link>
```

> Use exatamente as mesmas classes/estilos dos links existentes para manter consistência visual.

- [ ] **Passo 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Passo 4: Commit**

```bash
git add src/app/(admin)/layout.tsx
git commit -m "feat(admin-nav): add Saúde, Uso de IA, Integrações, Financeiro links"
```

---

## Checklist final da Parte 5

- [ ] `npx tsc --noEmit` — sem erros
- [ ] Acessar `/admin/saude` logado como Admin: cards de saúde aparecem
- [ ] Acessar `/admin/uso-ia`: tabela de tenants com tokens e botões funcionando
- [ ] Acessar `/admin/integracoes`: lista de tenants com status iFood/WhatsApp
- [ ] Acessar `/admin/financeiro`: todas as 4 abas carregam sem erro
- [ ] `npx vitest run` — todos os testes passando
