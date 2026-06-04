# Agente 4 · Parte 3 — Páginas & Header

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar as quatro páginas do módulo Multi-Unidade (`/rede/dashboard`, `/rede/cardapio`, `/rede/compras`, `/rede/relatorios`) e modificar o Header para exibir o seletor de unidades.

**Architecture:** Client Components com TanStack Query para dados. Server Components apenas onde não há interatividade. CSS variables do tema existente (`var(--tf-*)`) para todos os estilos inline. Recharts para gráficos. Google Maps Embed API via `<iframe>`.

**Tech Stack:** React, Next.js 14 App Router, TanStack Query, Recharts, date-fns, shadcn/ui

**Pré-requisito:** Partes 1 e 2 concluídas.

---

## Mapa de arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/app/(dashboard)/rede/dashboard/page.tsx` |
| Criar | `src/app/(dashboard)/rede/cardapio/page.tsx` |
| Criar | `src/app/(dashboard)/rede/compras/page.tsx` |
| Criar | `src/app/(dashboard)/rede/relatorios/page.tsx` |
| Criar | `src/components/multi-unit/KpiCard.tsx` |
| Criar | `src/components/multi-unit/UnidadeSelector.tsx` |
| Criar | `src/components/multi-unit/NetworkBarChart.tsx` |
| Criar | `src/components/multi-unit/NetworkMap.tsx` |
| Criar | `src/components/multi-unit/BenchmarkTable.tsx` |
| Modificar | `src/components/layout/header.tsx` |

---

## Task 1: Componente `KpiCard`

**Arquivos:**
- Criar: `src/components/multi-unit/KpiCard.tsx`

- [ ] **Passo 1: Criar componente**

```tsx
// src/components/multi-unit/KpiCard.tsx
'use client'

interface KpiCardProps {
  titulo: string
  valor: string
  variacao?: number  // percentual, positivo = bom
  icone?: React.ReactNode
}

export function KpiCard({ titulo, valor, variacao, icone }: KpiCardProps) {
  const varColor =
    variacao === undefined ? 'var(--tf-txt3)'
    : variacao >= 0 ? 'var(--tf-success)'
    : 'var(--tf-danger)'

  return (
    <div
      style={{
        background: 'var(--tf-surface)',
        border: '1px solid var(--tf-border)',
        borderRadius: 12,
        padding: '20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icone}
        <span style={{ fontSize: 12, color: 'var(--tf-txt3)', fontWeight: 500 }}>{titulo}</span>
      </div>
      <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--tf-txt)' }}>{valor}</span>
      {variacao !== undefined && (
        <span style={{ fontSize: 12, color: varColor }}>
          {variacao >= 0 ? '▲' : '▼'} {Math.abs(variacao).toFixed(1)}% vs período anterior
        </span>
      )}
    </div>
  )
}
```

- [ ] **Passo 2: Commit**

```bash
git add src/components/multi-unit/KpiCard.tsx
git commit -m "feat(multi-unit): add KpiCard component"
```

---

## Task 2: Componente `UnidadeSelector`

**Arquivos:**
- Criar: `src/components/multi-unit/UnidadeSelector.tsx`

- [ ] **Passo 1: Criar componente**

```tsx
// src/components/multi-unit/UnidadeSelector.tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface Unidade {
  id: string
  name: string
  isHeadquarters: boolean
}

interface UnidadeSelectorProps {
  unidades: Unidade[]
  unidadeAtiva: string | null   // tenantId ativo ou null = "todas"
}

export function UnidadeSelector({ unidades, unidadeAtiva }: UnidadeSelectorProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const label = unidades.find((u) => u.id === unidadeAtiva)?.name ?? 'Todas as unidades'

  async function selecionar(tenantId: string | null) {
    await fetch('/api/rede/switch-unit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId }),
    })
    setOpen(false)
    router.refresh()
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 8,
          border: '1px solid var(--tf-border)',
          background: 'var(--tf-surface)',
          color: 'var(--tf-txt)',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        {label}
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: 'var(--tf-surface)',
            border: '1px solid var(--tf-border)',
            borderRadius: 8,
            minWidth: 200,
            zIndex: 50,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}
        >
          <button
            onClick={() => selecionar(null)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--tf-border)',
              color: 'var(--tf-txt)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Todas as unidades
          </button>
          {unidades.map((u) => (
            <button
              key={u.id}
              onClick={() => selecionar(u.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 16px',
                background: unidadeAtiva === u.id ? 'var(--tf-primary-soft)' : 'transparent',
                border: 'none',
                color: 'var(--tf-txt)',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {u.name} {u.isHeadquarters && '★'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Passo 2: Commit**

```bash
git add src/components/multi-unit/UnidadeSelector.tsx
git commit -m "feat(multi-unit): add UnidadeSelector component"
```

---

## Task 3: Componente `NetworkBarChart`

**Arquivos:**
- Criar: `src/components/multi-unit/NetworkBarChart.tsx`

- [ ] **Passo 1: Criar componente**

```tsx
// src/components/multi-unit/NetworkBarChart.tsx
'use client'

import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type Metrica = 'vendas' | 'pedidos' | 'cmv' | 'ticket'

interface UnidadeDado {
  tenantName: string
  totalVendas: number
  totalPedidos: number
  cmvPercentual: number
  ticketMedio: number
}

interface NetworkBarChartProps {
  unidades: UnidadeDado[]
}

const METRICA_CONFIG: Record<Metrica, { label: string; dataKey: string; cor: string }> = {
  vendas:  { label: 'Vendas (R$)',    dataKey: 'totalVendas',    cor: 'var(--tf-primary)' },
  pedidos: { label: 'Pedidos',        dataKey: 'totalPedidos',   cor: '#6366f1' },
  cmv:     { label: 'CMV %',          dataKey: 'cmvPercentual',  cor: '#f59e0b' },
  ticket:  { label: 'Ticket Médio',   dataKey: 'ticketMedio',    cor: '#10b981' },
}

export function NetworkBarChart({ unidades }: NetworkBarChartProps) {
  const [metrica, setMetrica] = useState<Metrica>('vendas')
  const config = METRICA_CONFIG[metrica]

  return (
    <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(Object.keys(METRICA_CONFIG) as Metrica[]).map((m) => (
          <button
            key={m}
            onClick={() => setMetrica(m)}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              border: '1px solid var(--tf-border)',
              background: metrica === m ? 'var(--tf-primary)' : 'transparent',
              color: metrica === m ? '#fff' : 'var(--tf-txt)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {METRICA_CONFIG[m].label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={unidades} margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
          <XAxis dataKey="tenantName" tick={{ fontSize: 11, fill: 'var(--tf-txt3)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--tf-txt3)' }} />
          <Tooltip
            contentStyle={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 8 }}
          />
          <Bar dataKey={config.dataKey} fill={config.cor} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Passo 2: Commit**

```bash
git add src/components/multi-unit/NetworkBarChart.tsx
git commit -m "feat(multi-unit): add NetworkBarChart component"
```

---

## Task 4: Componente `NetworkMap`

**Arquivos:**
- Criar: `src/components/multi-unit/NetworkMap.tsx`

- [ ] **Passo 1: Criar componente**

```tsx
// src/components/multi-unit/NetworkMap.tsx
'use client'

interface Marcador {
  lat: number
  lng: number
  label: string
  performance: 'top' | 'mid' | 'baixo'
}

interface NetworkMapProps {
  marcadores: Marcador[]
  apiKey: string
}

const COR_PERFORMANCE: Record<string, string> = {
  top: 'green',
  mid: 'yellow',
  baixo: 'red',
}

export function NetworkMap({ marcadores, apiKey }: NetworkMapProps) {
  if (!apiKey || marcadores.length === 0) {
    return (
      <div
        style={{
          height: 300,
          borderRadius: 12,
          border: '1px solid var(--tf-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--tf-surface)',
          color: 'var(--tf-txt3)',
          fontSize: 13,
        }}
      >
        {!apiKey ? 'GOOGLE_MAPS_API_KEY não configurada' : 'Nenhuma unidade com localização'}
      </div>
    )
  }

  // Construir URL da Embed API com markers coloridos
  const markersParam = marcadores
    .map((m) => `color:${COR_PERFORMANCE[m.performance]}%7Clabel:${encodeURIComponent(m.label[0])}%7C${m.lat},${m.lng}`)
    .join('&markers=')

  const centro = `${marcadores[0].lat},${marcadores[0].lng}`
  const src = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${centro}&zoom=10&markers=${markersParam}`

  return (
    <iframe
      width="100%"
      height="300"
      style={{ borderRadius: 12, border: '1px solid var(--tf-border)' }}
      loading="lazy"
      allowFullScreen
      src={src}
      title="Mapa da Rede"
    />
  )
}
```

- [ ] **Passo 2: Commit**

```bash
git add src/components/multi-unit/NetworkMap.tsx
git commit -m "feat(multi-unit): add NetworkMap component (Google Maps Embed)"
```

---

## Task 5: Componente `BenchmarkTable`

**Arquivos:**
- Criar: `src/components/multi-unit/BenchmarkTable.tsx`

- [ ] **Passo 1: Criar componente**

```tsx
// src/components/multi-unit/BenchmarkTable.tsx
'use client'

import type { BenchmarkUnidade } from '@/services/multi-unit/types'

interface BenchmarkTableProps {
  unidades: BenchmarkUnidade[]
  mediaCmv: number
  mediaTicket: number
  mediaMargem: number
}

export function BenchmarkTable({ unidades, mediaCmv, mediaTicket, mediaMargem }: BenchmarkTableProps) {
  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '10px 14px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--tf-txt3)',
    borderBottom: '1px solid var(--tf-border)',
    whiteSpace: 'nowrap',
  }
  const tdStyle: React.CSSProperties = {
    padding: '10px 14px',
    fontSize: 13,
    color: 'var(--tf-txt)',
    borderBottom: '1px solid var(--tf-border)',
  }

  function liderBadge(isLider: boolean) {
    if (!isLider) return null
    return (
      <span style={{ marginLeft: 6, fontSize: 10, background: '#10b981', color: '#fff', borderRadius: 4, padding: '1px 6px' }}>
        Líder
      </span>
    )
  }

  return (
    <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Unidade</th>
            <th style={thStyle}>CMV %</th>
            <th style={thStyle}>Ticket Médio</th>
            <th style={thStyle}>Margem Bruta %</th>
            <th style={thStyle}>Status</th>
          </tr>
        </thead>
        <tbody>
          {unidades.map((u) => (
            <tr key={u.tenantId} style={{ opacity: u.abaixoDaMedia ? 0.8 : 1 }}>
              <td style={tdStyle}>{u.tenantName}</td>
              <td style={tdStyle}>
                {u.cmvPercent.toFixed(1)}%
                {liderBadge(u.liderCmv)}
              </td>
              <td style={tdStyle}>
                R$ {u.ticketMedio.toFixed(2)}
                {liderBadge(u.liderTicket)}
              </td>
              <td style={tdStyle}>
                {u.margemBruta.toFixed(1)}%
                {liderBadge(u.liderMargem)}
              </td>
              <td style={tdStyle}>
                {u.abaixoDaMedia && (
                  <span style={{ fontSize: 11, background: '#f59e0b', color: '#fff', borderRadius: 4, padding: '2px 8px' }}>
                    Abaixo da média
                  </span>
                )}
              </td>
            </tr>
          ))}
          {/* Linha de média */}
          <tr style={{ background: 'var(--tf-surface-hover)' }}>
            <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--tf-txt3)' }}>Média da rede</td>
            <td style={{ ...tdStyle, color: 'var(--tf-txt3)' }}>{mediaCmv.toFixed(1)}%</td>
            <td style={{ ...tdStyle, color: 'var(--tf-txt3)' }}>R$ {mediaTicket.toFixed(2)}</td>
            <td style={{ ...tdStyle, color: 'var(--tf-txt3)' }}>{mediaMargem.toFixed(1)}%</td>
            <td style={tdStyle} />
          </tr>
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Passo 2: Commit**

```bash
git add src/components/multi-unit/BenchmarkTable.tsx
git commit -m "feat(multi-unit): add BenchmarkTable component"
```

---

## Task 6: Página `/rede/dashboard`

**Arquivos:**
- Criar: `src/app/(dashboard)/rede/dashboard/page.tsx`

- [ ] **Passo 1: Criar página**

```tsx
// src/app/(dashboard)/rede/dashboard/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { KpiCard } from '@/components/multi-unit/KpiCard'
import { NetworkBarChart } from '@/components/multi-unit/NetworkBarChart'
import { NetworkMap } from '@/components/multi-unit/NetworkMap'
import { TrendingUp, ShoppingBag, DollarSign, BarChart2 } from 'lucide-react'
import type { KpisConsolidados } from '@/services/multi-unit/types'

const DIAS_OPTIONS = [7, 15, 30, 90]

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function RedeDashboardPage() {
  const { data: session } = useSession()
  const [dias, setDias] = useState(30)
  const [kpis, setKpis] = useState<KpisConsolidados | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/rede/dashboard?days=${dias}`)
      .then((r) => r.json())
      .then((d) => { setKpis(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [dias])

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)' }}>Dashboard da Rede</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          {DIAS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDias(d)}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: '1px solid var(--tf-border)',
                background: dias === d ? 'var(--tf-primary)' : 'transparent',
                color: dias === d ? '#fff' : 'var(--tf-txt)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <p style={{ color: 'var(--tf-txt3)', fontSize: 13 }}>Carregando...</p>
      )}

      {!loading && kpis && (
        <>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            <KpiCard
              titulo="Vendas Totais"
              valor={formatCurrency(kpis.totalVendas)}
              variacao={kpis.variacaoVendas}
              icone={<DollarSign className="w-4 h-4" style={{ color: 'var(--tf-primary)' }} />}
            />
            <KpiCard
              titulo="Total de Pedidos"
              valor={kpis.totalPedidos.toLocaleString('pt-BR')}
              variacao={kpis.variacaoPedidos}
              icone={<ShoppingBag className="w-4 h-4" style={{ color: '#6366f1' }} />}
            />
            <KpiCard
              titulo="Ticket Médio"
              valor={formatCurrency(kpis.ticketMedio)}
              icone={<TrendingUp className="w-4 h-4" style={{ color: '#10b981' }} />}
            />
            <KpiCard
              titulo="CMV Médio"
              valor={`${kpis.cmvMedio.toFixed(1)}%`}
              icone={<BarChart2 className="w-4 h-4" style={{ color: '#f59e0b' }} />}
            />
          </div>

          {/* Destaques */}
          {(kpis.melhorUnidade || kpis.unidadeAlerta) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              {kpis.melhorUnidade && (
                <div style={{ padding: 20, borderRadius: 12, border: '1px solid #10b981', background: 'var(--tf-surface)' }}>
                  <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginBottom: 4 }}>✦ MELHOR UNIDADE</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tf-txt)' }}>{kpis.melhorUnidade.tenantName}</div>
                  <div style={{ fontSize: 13, color: 'var(--tf-txt3)', marginTop: 4 }}>{formatCurrency(kpis.melhorUnidade.totalVendas)}</div>
                </div>
              )}
              {kpis.unidadeAlerta && (
                <div style={{ padding: 20, borderRadius: 12, border: '1px solid #f59e0b', background: 'var(--tf-surface)' }}>
                  <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginBottom: 4 }}>⚠ ATENÇÃO</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tf-txt)' }}>{kpis.unidadeAlerta.tenantName}</div>
                  <div style={{ fontSize: 13, color: 'var(--tf-txt3)', marginTop: 4 }}>{formatCurrency(kpis.unidadeAlerta.totalVendas)}</div>
                </div>
              )}
            </div>
          )}

          {/* Tabela comparativa */}
          <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Unidade', 'Vendas', 'Pedidos', 'Ticket Médio', 'CMV %', 'Alertas'].map((col) => (
                    <th key={col} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: 'var(--tf-txt3)', borderBottom: '1px solid var(--tf-border)' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kpis.porUnidade.map((u) => (
                  <tr key={u.tenantId} style={{ cursor: 'pointer' }}>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>{u.tenantName}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>{formatCurrency(u.totalVendas)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>{u.totalPedidos}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>{formatCurrency(u.ticketMedio)}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>{u.cmvPercentual.toFixed(1)}%</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>
                      {u.alertasAtivos > 0 && (
                        <span style={{ background: '#ef4444', color: '#fff', borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>
                          {u.alertasAtivos}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Gráfico */}
          <div style={{ marginBottom: 24 }}>
            <NetworkBarChart unidades={kpis.porUnidade} />
          </div>

          {/* Mapa */}
          <NetworkMap
            marcadores={[]}
            apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''}
          />
        </>
      )}
    </div>
  )
}
```

- [ ] **Passo 2: Adicionar `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` ao `.env`**

Abrir `.env` e adicionar:
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY}
```

- [ ] **Passo 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Passo 4: Commit**

```bash
git add src/app/(dashboard)/rede/dashboard/ .env
git commit -m "feat(rede): add /rede/dashboard page"
```

---

## Task 7: Página `/rede/cardapio`

**Arquivos:**
- Criar: `src/app/(dashboard)/rede/cardapio/page.tsx`

- [ ] **Passo 1: Criar página**

```tsx
// src/app/(dashboard)/rede/cardapio/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { Plus, Save } from 'lucide-react'

interface Produto { id: string; name: string; salePrice: number; isShared: boolean }
interface Unidade { id: string; name: string }
interface Override { tenantId: string; produtoId: string; preco: number | null; ativo: boolean }

export default function RedeCardapioPage() {
  const [tab, setTab] = useState<'rede' | 'overrides'>('rede')
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [unidadeSel, setUnidadeSel] = useState<string>('')
  const [overrides, setOverrides] = useState<Override[]>([])
  const [novoNome, setNovoNome] = useState('')
  const [novoPreco, setNovoPreco] = useState('')
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    fetch('/api/rede/cardapio').then((r) => r.json()).then(setProdutos)
    fetch('/api/rede/unidades').then((r) => r.json()).then((d: Unidade[]) => {
      setUnidades(d)
      if (d.length > 0) setUnidadeSel(d[0].id)
    })
  }, [])

  async function criarProduto() {
    await fetch('/api/rede/cardapio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: novoNome, salePrice: parseFloat(novoPreco) || 0 }),
    })
    fetch('/api/rede/cardapio').then((r) => r.json()).then(setProdutos)
    setShowModal(false)
    setNovoNome('')
    setNovoPreco('')
  }

  async function sincronizarPreco(produtoId: string) {
    // Limpar overrides de preço para esse produto em todas as unidades
    for (const u of unidades) {
      await fetch('/api/rede/cardapio/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: u.id, produtoId, preco: null }),
      })
    }
  }

  async function salvarOverride(tenantId: string, produtoId: string, preco: string, ativo: boolean) {
    await fetch('/api/rede/cardapio/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, produtoId, preco: preco ? parseFloat(preco) : null, ativo }),
    })
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px',
    borderRadius: '8px 8px 0 0',
    border: '1px solid var(--tf-border)',
    borderBottom: active ? '1px solid var(--tf-surface)' : '1px solid var(--tf-border)',
    background: active ? 'var(--tf-surface)' : 'transparent',
    color: active ? 'var(--tf-txt)' : 'var(--tf-txt3)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    marginBottom: -1,
  })

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)' }}>Cardápio da Rede</h1>
        {tab === 'rede' && (
          <button
            onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, background: 'var(--tf-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13 }}
          >
            <Plus className="w-4 h-4" /> Novo produto da rede
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 0 }}>
        <button style={tabStyle(tab === 'rede')} onClick={() => setTab('rede')}>Cardápio da rede</button>
        <button style={tabStyle(tab === 'overrides')} onClick={() => setTab('overrides')}>Overrides por unidade</button>
      </div>

      <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: '0 8px 8px 8px', padding: 20 }}>
        {tab === 'rede' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Nome', 'Preço base', 'Sincronizar preço'].map((col) => (
                  <th key={col} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--tf-txt3)', borderBottom: '1px solid var(--tf-border)' }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => (
                <tr key={p.id}>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>{p.name}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>
                    R$ {p.salePrice.toFixed(2)}
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--tf-border)' }}>
                    <button
                      onClick={() => sincronizarPreco(p.id)}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt3)', cursor: 'pointer' }}
                    >
                      Sincronizar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'overrides' && (
          <div>
            <select
              value={unidadeSel}
              onChange={(e) => setUnidadeSel(e.target.value)}
              style={{ marginBottom: 16, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)', color: 'var(--tf-txt)', fontSize: 13 }}
            >
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Produto', 'Preço base', 'Preço override', 'Ativo'].map((col) => (
                    <th key={col} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 600, color: 'var(--tf-txt3)', borderBottom: '1px solid var(--tf-border)' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {produtos.map((p) => {
                  const ov = overrides.find((o) => o.tenantId === unidadeSel && o.produtoId === p.id)
                  return (
                    <tr key={p.id}>
                      <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>{p.name}</td>
                      <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--tf-txt3)', borderBottom: '1px solid var(--tf-border)' }}>R$ {p.salePrice.toFixed(2)}</td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--tf-border)' }}>
                        <input
                          defaultValue={ov?.preco?.toString() ?? ''}
                          onBlur={(e) => salvarOverride(unidadeSel, p.id, e.target.value, ov?.ativo ?? true)}
                          placeholder="Sem override"
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt)', fontSize: 13, width: 120 }}
                        />
                      </td>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--tf-border)' }}>
                        <input
                          type="checkbox"
                          defaultChecked={ov?.ativo ?? true}
                          onChange={(e) => salvarOverride(unidadeSel, p.id, ov?.preco?.toString() ?? '', e.target.checked)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal novo produto */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--tf-surface)', borderRadius: 12, padding: 32, minWidth: 360, border: '1px solid var(--tf-border)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--tf-txt)' }}>Novo produto da rede</h2>
            <label style={{ fontSize: 12, color: 'var(--tf-txt3)', display: 'block', marginBottom: 4 }}>Nome</label>
            <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt)', fontSize: 13, marginBottom: 16, boxSizing: 'border-box' }} />
            <label style={{ fontSize: 12, color: 'var(--tf-txt3)', display: 'block', marginBottom: 4 }}>Preço base</label>
            <input type="number" value={novoPreco} onChange={(e) => setNovoPreco(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt)', fontSize: 13, marginBottom: 24, boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={criarProduto} style={{ padding: '8px 16px', borderRadius: 6, background: 'var(--tf-primary)', color: '#fff', border: 'none', cursor: 'pointer' }}>Criar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Passo 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Passo 3: Commit**

```bash
git add src/app/(dashboard)/rede/cardapio/
git commit -m "feat(rede): add /rede/cardapio page"
```

---

## Task 8: Página `/rede/compras`

**Arquivos:**
- Criar: `src/app/(dashboard)/rede/compras/page.tsx`

- [ ] **Passo 1: Criar página**

```tsx
// src/app/(dashboard)/rede/compras/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { FileText, Table, Check } from 'lucide-react'

interface Fornecedor { id: string; name: string }
interface PurchaseOrder {
  id: string
  createdAt: string
  status: string
  valorTotal: number
  fornecedor: { name: string }
  _count: { itens: number }
}

export default function RedeComprasPage() {
  const [pedidos, setPedidos] = useState<PurchaseOrder[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [fornecedorSel, setFornecedorSel] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/rede/compras').then((r) => r.json()).then(setPedidos)
    // Buscar fornecedores da sede (endpoint de suppliers existente)
    fetch('/api/suppliers').then((r) => r.json()).then((d: Fornecedor[]) => {
      setFornecedores(d)
      if (d.length > 0) setFornecedorSel(d[0].id)
    })
  }, [])

  async function gerarPedido() {
    setLoading(true)
    await fetch('/api/rede/compras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fornecedorId: fornecedorSel }),
    })
    fetch('/api/rede/compras').then((r) => r.json()).then(setPedidos)
    setLoading(false)
  }

  async function marcarRecebido(id: string) {
    // PATCH status via update inline — usar endpoint de compras com PATCH
    await fetch(`/api/rede/compras/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'RECEBIDO' }),
    })
    fetch('/api/rede/compras').then((r) => r.json()).then(setPedidos)
  }

  function exportar(id: string, formato: 'pdf' | 'excel') {
    window.open(`/api/rede/compras/${id}/exportar?formato=${formato}`, '_blank')
  }

  const STATUS_LABEL: Record<string, string> = {
    RASCUNHO: 'Rascunho',
    ENVIADO: 'Enviado',
    RECEBIDO: 'Recebido',
  }
  const STATUS_COLOR: Record<string, string> = {
    RASCUNHO: '#f59e0b',
    ENVIADO: '#6366f1',
    RECEBIDO: '#10b981',
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 24 }}>Compras Centralizadas</h1>

      {/* Gerar pedido */}
      <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 12 }}>Gerar pedido consolidado</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            value={fornecedorSel}
            onChange={(e) => setFornecedorSel(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)', color: 'var(--tf-txt)', fontSize: 13 }}
          >
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <button
            onClick={gerarPedido}
            disabled={loading || !fornecedorSel}
            style={{ padding: '8px 20px', borderRadius: 6, background: 'var(--tf-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Gerando...' : 'Gerar pedido de compra'}
          </button>
        </div>
        <p style={{ marginTop: 8, fontSize: 12, color: 'var(--tf-txt3)' }}>
          Baseado nos alertas de estoque ativos em todas as unidades da rede.
        </p>
      </div>

      {/* Histórico */}
      <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--tf-border)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)' }}>Histórico de pedidos</h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Data', 'Fornecedor', 'Itens', 'Valor estimado', 'Status', 'Ações'].map((col) => (
                <th key={col} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 600, color: 'var(--tf-txt3)', borderBottom: '1px solid var(--tf-border)' }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id}>
                <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>
                  {new Date(p.createdAt).toLocaleDateString('pt-BR')}
                </td>
                <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>{p.fornecedor.name}</td>
                <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>{p._count.itens}</td>
                <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>
                  {Number(p.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--tf-border)' }}>
                  <span style={{ fontSize: 11, background: STATUS_COLOR[p.status], color: '#fff', borderRadius: 4, padding: '2px 8px' }}>
                    {STATUS_LABEL[p.status]}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--tf-border)' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => exportar(p.id, 'pdf')} title="Exportar PDF" style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--tf-border)', background: 'transparent', cursor: 'pointer' }}>
                      <FileText className="w-3 h-3" />
                    </button>
                    <button onClick={() => exportar(p.id, 'excel')} title="Exportar Excel" style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--tf-border)', background: 'transparent', cursor: 'pointer' }}>
                      <Table className="w-3 h-3" />
                    </button>
                    {p.status !== 'RECEBIDO' && (
                      <button onClick={() => marcarRecebido(p.id)} title="Marcar como recebido" style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #10b981', background: 'transparent', cursor: 'pointer', color: '#10b981' }}>
                        <Check className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Passo 2: Adicionar PATCH ao `src/app/api/rede/compras/[id]/route.ts`**

Criar `src/app/api/rede/compras/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { checkMultiUnitFeature, MultiUnitForbiddenError } from '@/lib/check-multi-unit'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try { await checkMultiUnitFeature(session.user.tenantId) }
  catch (e) { if (e instanceof MultiUnitForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 }); throw e }

  const { status } = await req.json()
  const updated = await prisma.purchaseOrder.update({
    where: { id: params.id, brandId: session.user.brandId! },
    data: { status },
  })
  return NextResponse.json(updated)
}
```

- [ ] **Passo 3: Commit**

```bash
git add src/app/(dashboard)/rede/compras/ src/app/api/rede/compras/
git commit -m "feat(rede): add /rede/compras page and PATCH compras route"
```

---

## Task 9: Página `/rede/relatorios`

**Arquivos:**
- Criar: `src/app/(dashboard)/rede/relatorios/page.tsx`

- [ ] **Passo 1: Criar página**

```tsx
// src/app/(dashboard)/rede/relatorios/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { BenchmarkTable } from '@/components/multi-unit/BenchmarkTable'
import type { BenchmarkData } from '@/services/multi-unit/types'

const DIAS_OPTIONS = [7, 30, 90]

export default function RedeRelatoriosPage() {
  const [dias, setDias] = useState(30)
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/rede/relatorios/benchmark?days=${dias}`)
      .then((r) => r.json())
      .then((d: BenchmarkData) => { setBenchmark(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [dias])

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)' }}>Relatórios da Rede</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          {DIAS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDias(d)}
              style={{
                padding: '4px 12px', borderRadius: 6,
                border: '1px solid var(--tf-border)',
                background: dias === d ? 'var(--tf-primary)' : 'transparent',
                color: dias === d ? '#fff' : 'var(--tf-txt)',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 12 }}>Benchmark de Unidades</h2>

      {loading && <p style={{ color: 'var(--tf-txt3)', fontSize: 13 }}>Carregando...</p>}

      {!loading && benchmark && (
        <BenchmarkTable
          unidades={benchmark.unidades}
          mediaCmv={benchmark.mediaCmv}
          mediaTicket={benchmark.mediaTicket}
          mediaMargem={benchmark.mediaMargem}
        />
      )}

      {!loading && benchmark && benchmark.unidades.length === 0 && (
        <p style={{ color: 'var(--tf-txt3)', fontSize: 13 }}>Nenhuma unidade com dados no período selecionado.</p>
      )}
    </div>
  )
}
```

- [ ] **Passo 2: Commit**

```bash
git add src/app/(dashboard)/rede/relatorios/
git commit -m "feat(rede): add /rede/relatorios page"
```

---

## Task 10: Modificação do Header

**Arquivos:**
- Modificar: `src/components/layout/header.tsx`

- [ ] **Passo 1: Adicionar import e seletor de rede**

Abrir `src/components/layout/header.tsx`. Localizar o bloco `<div className="flex items-center gap-2">` que contém o nome do tenant (por volta da linha 48).

Adicionar imports no topo:
```tsx
import { useRouter } from 'next/navigation'
import { Network } from 'lucide-react'
```

Substituir o bloco do nome do tenant:

```tsx
// Substituir o div existente:
// <div className="flex items-center gap-2">
//   <Store className="w-4 h-4" ... />
//   <span>...</span>
// </div>
// Por:

<div className="flex items-center gap-2">
  {session?.user?.brandId ? (
    // Multi-unidade: mostrar dropdown de seleção
    <BrandUnitDropdown />
  ) : (
    <>
      <Store className="w-4 h-4" style={{ color: 'var(--tf-txt3)' }} />
      <span style={{ color: 'var(--tf-txt)', fontSize: 13.5, fontWeight: 500 }}>
        {session?.user?.tenantName ?? 'Carregando...'}
      </span>
    </>
  )}
</div>
```

- [ ] **Passo 2: Adicionar componente `BrandUnitDropdown` no mesmo arquivo (abaixo da exportação de `Header`)**

```tsx
function BrandUnitDropdown() {
  const { data: session } = useSession()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [unidades, setUnidades] = useState<Array<{ id: string; name: string; isHeadquarters: boolean }>>([])

  useEffect(() => {
    fetch('/api/rede/unidades').then((r) => r.json()).then(setUnidades).catch(() => {})
  }, [])

  async function irParaUnidade(tenantId: string | null) {
    await fetch('/api/rede/switch-unit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId }),
    })
    setOpen(false)
    if (tenantId === null) {
      router.push('/rede/dashboard')
    } else {
      router.push('/dashboard')
    }
    router.refresh()
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '3px 10px', borderRadius: 8,
          border: '1px solid var(--tf-border)',
          background: 'transparent',
          color: 'var(--tf-txt)', fontSize: 13, cursor: 'pointer',
        }}
      >
        <Network className="w-3 h-3" style={{ color: 'var(--tf-primary)' }} />
        {session?.user?.tenantName ?? 'Rede'}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '110%', left: 0,
          background: 'var(--tf-surface)', border: '1px solid var(--tf-border)',
          borderRadius: 8, minWidth: 220, zIndex: 200,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}>
          <button
            onClick={() => irParaUnidade(null)}
            style={{ width: '100%', textAlign: 'left', padding: '10px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--tf-border)', color: 'var(--tf-primary)', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
          >
            Visão consolidada →
          </button>
          {unidades.map((u) => (
            <button
              key={u.id}
              onClick={() => irParaUnidade(u.id)}
              style={{ width: '100%', textAlign: 'left', padding: '10px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--tf-border)', color: 'var(--tf-txt)', cursor: 'pointer', fontSize: 13 }}
            >
              {u.isHeadquarters ? '★ ' : ''}{u.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Passo 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Passo 4: Commit**

```bash
git add src/components/layout/header.tsx
git commit -m "feat(header): add brand unit dropdown for multi-unit users"
```

---

## Checklist final da Parte 3

- [ ] `npx tsc --noEmit` — sem erros
- [ ] Acessar `/rede/dashboard` logado com usuário Enterprise: página carrega KPIs
- [ ] Acessar `/rede/dashboard` logado sem plano Enterprise: redireciona para `/dashboard`
- [ ] Header de usuário Enterprise mostra dropdown de seleção de unidade
