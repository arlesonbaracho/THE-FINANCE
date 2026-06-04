# Agente 4 · Parte 2 — Services & API Routes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar os três services do módulo Multi-Unidade e todas as rotas de API `/api/rede/*`.

**Architecture:** Services puros (funções exportadas, sem classes) em `src/services/multi-unit/`. Rotas de API Next.js App Router. Todos os endpoints verificam `checkMultiUnitFeature` antes de qualquer lógica.

**Tech Stack:** Prisma, @react-pdf/renderer, xlsx, Vitest, Next.js 14 Route Handlers

**Pré-requisito:** Parte 1 concluída (schema migrado, `checkMultiUnitFeature` disponível, sessão com `brandId`).

---

## Mapa de arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/services/multi-unit/brand.service.ts` |
| Criar | `src/services/multi-unit/brand.service.test.ts` |
| Criar | `src/services/multi-unit/consolidated-reports.service.ts` |
| Criar | `src/services/multi-unit/consolidated-reports.service.test.ts` |
| Criar | `src/services/multi-unit/purchase-order.service.ts` |
| Criar | `src/services/multi-unit/purchase-order.service.test.ts` |
| Criar | `src/app/api/rede/dashboard/route.ts` |
| Criar | `src/app/api/rede/switch-unit/route.ts` |
| Criar | `src/app/api/rede/unidades/route.ts` |
| Criar | `src/app/api/rede/cardapio/route.ts` |
| Criar | `src/app/api/rede/cardapio/[id]/route.ts` |
| Criar | `src/app/api/rede/cardapio/override/route.ts` |
| Criar | `src/app/api/rede/compras/route.ts` |
| Criar | `src/app/api/rede/compras/[id]/exportar/route.ts` |
| Criar | `src/app/api/rede/relatorios/benchmark/route.ts` |

---

## Task 1: Tipos compartilhados do módulo multi-unit

**Arquivos:**
- Criar: `src/services/multi-unit/types.ts`

- [ ] **Passo 1: Criar arquivo de tipos**

```ts
// src/services/multi-unit/types.ts

export interface KpiUnidade {
  tenantId: string
  tenantName: string
  cidade?: string
  totalVendas: number
  totalPedidos: number
  ticketMedio: number
  cmvPercentual: number
  alertasAtivos: number
  ativo: boolean
}

export interface KpisConsolidados {
  totalVendas: number
  totalPedidos: number
  ticketMedio: number
  cmvMedio: number
  melhorUnidade: KpiUnidade | null
  unidadeAlerta: KpiUnidade | null
  porUnidade: KpiUnidade[]
  variacaoVendas: number   // percentual vs período anterior (0 se não houver dados)
  variacaoPedidos: number
}

export interface FiltroPeriodo {
  inicio: Date
  fim: Date
}

export interface BenchmarkUnidade {
  tenantId: string
  tenantName: string
  cmvPercent: number
  ticketMedio: number
  margemBruta: number
  liderCmv: boolean
  liderTicket: boolean
  liderMargem: boolean
  abaixoDaMedia: boolean
}

export interface BenchmarkData {
  unidades: BenchmarkUnidade[]
  mediaCmv: number
  mediaTicket: number
  mediaMargem: number
}
```

- [ ] **Passo 2: Commit**

```bash
git add src/services/multi-unit/types.ts
git commit -m "feat(multi-unit): add shared types"
```

---

## Task 2: `brand.service.ts`

**Arquivos:**
- Criar: `src/services/multi-unit/brand.service.ts`
- Criar: `src/services/multi-unit/brand.service.test.ts`

- [ ] **Passo 1: Escrever testes (devem falhar)**

Criar `src/services/multi-unit/brand.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    brand: { create: vi.fn(), findUnique: vi.fn() },
    tenant: { update: vi.fn(), findMany: vi.fn() },
    dashboardSnapshot: { findMany: vi.fn() },
    alert: { count: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import {
  criarBrand,
  adicionarUnidade,
  removerUnidade,
  listarUnidades,
  buscarKpisConsolidados,
} from './brand.service'

const p = prisma as unknown as {
  brand: Record<string, ReturnType<typeof vi.fn>>
  tenant: Record<string, ReturnType<typeof vi.fn>>
  dashboardSnapshot: Record<string, ReturnType<typeof vi.fn>>
  alert: Record<string, ReturnType<typeof vi.fn>>
}

beforeEach(() => { vi.clearAllMocks() })

describe('criarBrand', () => {
  it('cria brand com os dados fornecidos', async () => {
    p.brand.create.mockResolvedValue({ id: 'b-1', nome: 'Rede X', slug: 'rede-x' })
    const result = await criarBrand('u-1', { nome: 'Rede X', slug: 'rede-x', planId: 'p-1' })
    expect(result.slug).toBe('rede-x')
    expect(p.brand.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ adminUserId: 'u-1' }) })
    )
  })
})

describe('adicionarUnidade', () => {
  it('atualiza brandId do tenant', async () => {
    p.tenant.update.mockResolvedValue({})
    await adicionarUnidade('b-1', 't-1')
    expect(p.tenant.update).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: { brandId: 'b-1' },
    })
  })
})

describe('removerUnidade', () => {
  it('limpa brandId do tenant', async () => {
    p.tenant.update.mockResolvedValue({})
    await removerUnidade('b-1', 't-1')
    expect(p.tenant.update).toHaveBeenCalledWith({
      where: { id: 't-1', brandId: 'b-1' },
      data: { brandId: null, isHeadquarters: false },
    })
  })
})

describe('buscarKpisConsolidados', () => {
  it('retorna zeros quando não há snapshots', async () => {
    p.tenant.findMany.mockResolvedValue([{ id: 't-1', name: 'Unidade A' }])
    p.dashboardSnapshot.findMany.mockResolvedValue([])
    p.alert.count.mockResolvedValue(0)

    const result = await buscarKpisConsolidados('b-1', {
      inicio: new Date('2026-01-01'),
      fim: new Date('2026-01-31'),
    })

    expect(result.totalVendas).toBe(0)
    expect(result.porUnidade).toHaveLength(1)
    expect(result.melhorUnidade).toBeNull()
  })

  it('agrega vendas de múltiplas unidades', async () => {
    p.tenant.findMany.mockResolvedValue([
      { id: 't-1', name: 'Unidade A' },
      { id: 't-2', name: 'Unidade B' },
    ])
    p.dashboardSnapshot.findMany.mockResolvedValue([
      { tenantId: 't-1', totalVendas: 1000, totalPedidos: 50, ticketMedio: 20, cmvPercentual: 35 },
      { tenantId: 't-2', totalVendas: 2000, totalPedidos: 80, ticketMedio: 25, cmvPercentual: 40 },
    ])
    p.alert.count.mockResolvedValue(0)

    const result = await buscarKpisConsolidados('b-1', {
      inicio: new Date('2026-01-01'),
      fim: new Date('2026-01-31'),
    })

    expect(result.totalVendas).toBe(3000)
    expect(result.totalPedidos).toBe(130)
    expect(result.melhorUnidade?.tenantId).toBe('t-2')
  })
})
```

- [ ] **Passo 2: Confirmar falha**

```bash
npx vitest run src/services/multi-unit/brand.service.test.ts
```

Saída esperada: `FAIL` com `Cannot find module './brand.service'`.

- [ ] **Passo 3: Implementar `brand.service.ts`**

Criar `src/services/multi-unit/brand.service.ts`:

```ts
import { prisma } from '@/lib/prisma'
import type { Brand } from '@prisma/client'
import type { FiltroPeriodo, KpisConsolidados, KpiUnidade } from './types'

interface CriarBrandDados {
  nome: string
  slug: string
  planId: string
  logoUrl?: string
}

export async function criarBrand(adminUserId: string, dados: CriarBrandDados): Promise<Brand> {
  return prisma.brand.create({
    data: {
      nome: dados.nome,
      slug: dados.slug,
      logoUrl: dados.logoUrl,
      planId: dados.planId,
      adminUserId,
    },
  })
}

export async function adicionarUnidade(brandId: string, tenantId: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { brandId },
  })
}

export async function removerUnidade(brandId: string, tenantId: string): Promise<void> {
  await prisma.tenant.update({
    where: { id: tenantId, brandId },
    data: { brandId: null, isHeadquarters: false },
  })
}

export async function listarUnidades(brandId: string) {
  return prisma.tenant.findMany({
    where: { brandId },
    select: { id: true, name: true, active: true, isHeadquarters: true },
    orderBy: [{ isHeadquarters: 'desc' }, { name: 'asc' }],
  })
}

export async function buscarKpisConsolidados(
  brandId: string,
  filtro: FiltroPeriodo
): Promise<KpisConsolidados> {
  const unidades = await prisma.tenant.findMany({
    where: { brandId },
    select: { id: true, name: true },
  })

  const tenantIds = unidades.map((u) => u.id)

  const [snapshots, alertCounts] = await Promise.all([
    prisma.dashboardSnapshot.findMany({
      where: {
        tenantId: { in: tenantIds },
        data: { gte: filtro.inicio, lte: filtro.fim },
      },
    }),
    Promise.all(
      tenantIds.map((id) =>
        prisma.alert
          .count({ where: { tenantId: id, status: 'NAO_LIDO' } })
          .then((count) => ({ tenantId: id, count }))
      )
    ),
  ])

  // Agregar por unidade
  const porUnidadeMap = new Map<string, { vendas: number; pedidos: number; cmvSum: number; days: number }>()
  for (const s of snapshots) {
    const cur = porUnidadeMap.get(s.tenantId) ?? { vendas: 0, pedidos: 0, cmvSum: 0, days: 0 }
    cur.vendas += Number(s.totalVendas)
    cur.pedidos += s.totalPedidos
    cur.cmvSum += Number(s.cmvPercentual)
    cur.days += 1
    porUnidadeMap.set(s.tenantId, cur)
  }

  const alertMap = new Map(alertCounts.map((a) => [a.tenantId, a.count]))

  const porUnidade: KpiUnidade[] = unidades.map((u) => {
    const agg = porUnidadeMap.get(u.id)
    const vendas = agg?.vendas ?? 0
    const pedidos = agg?.pedidos ?? 0
    const cmvPercentual = agg && agg.days > 0 ? agg.cmvSum / agg.days : 0
    const ticketMedio = pedidos > 0 ? vendas / pedidos : 0
    return {
      tenantId: u.id,
      tenantName: u.name,
      totalVendas: vendas,
      totalPedidos: pedidos,
      ticketMedio,
      cmvPercentual,
      alertasAtivos: alertMap.get(u.id) ?? 0,
      ativo: true,
    }
  })

  const totalVendas = porUnidade.reduce((s, u) => s + u.totalVendas, 0)
  const totalPedidos = porUnidade.reduce((s, u) => s + u.totalPedidos, 0)
  const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : 0
  const cmvMedio =
    porUnidade.length > 0
      ? porUnidade.reduce((s, u) => s + u.cmvPercentual, 0) / porUnidade.length
      : 0

  const sorted = [...porUnidade].sort((a, b) => b.totalVendas - a.totalVendas)
  const melhorUnidade = sorted[0]?.totalVendas > 0 ? sorted[0] : null
  const unidadeAlerta =
    sorted.length > 1 ? sorted[sorted.length - 1] : null

  return {
    totalVendas,
    totalPedidos,
    ticketMedio,
    cmvMedio,
    melhorUnidade,
    unidadeAlerta,
    porUnidade,
    variacaoVendas: 0,
    variacaoPedidos: 0,
  }
}
```

- [ ] **Passo 4: Executar testes**

```bash
npx vitest run src/services/multi-unit/brand.service.test.ts
```

Saída esperada: `✓ 5 tests passed`.

- [ ] **Passo 5: Commit**

```bash
git add src/services/multi-unit/brand.service.ts src/services/multi-unit/brand.service.test.ts
git commit -m "feat(multi-unit): implement brand.service"
```

---

## Task 3: `consolidated-reports.service.ts`

**Arquivos:**
- Criar: `src/services/multi-unit/consolidated-reports.service.ts`
- Criar: `src/services/multi-unit/consolidated-reports.service.test.ts`

- [ ] **Passo 1: Escrever testes**

Criar `src/services/multi-unit/consolidated-reports.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenant: { findMany: vi.fn() },
    dashboardSnapshot: { findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { benchmarkUnidades } from './consolidated-reports.service'

const p = prisma as unknown as {
  tenant: Record<string, ReturnType<typeof vi.fn>>
  dashboardSnapshot: Record<string, ReturnType<typeof vi.fn>>
}

beforeEach(() => { vi.clearAllMocks() })

describe('benchmarkUnidades', () => {
  it('retorna array vazio quando não há unidades', async () => {
    p.tenant.findMany.mockResolvedValue([])
    p.dashboardSnapshot.findMany.mockResolvedValue([])

    const result = await benchmarkUnidades('b-1', {
      inicio: new Date('2026-01-01'),
      fim: new Date('2026-01-31'),
    })

    expect(result.unidades).toHaveLength(0)
    expect(result.mediaCmv).toBe(0)
  })

  it('marca como abaixoDaMedia quando unidade < 80% da média de vendas', async () => {
    p.tenant.findMany.mockResolvedValue([
      { id: 't-1', name: 'A' },
      { id: 't-2', name: 'B' },
    ])
    // t-1: vendas 1000, pedidos 50, cmvPercentual 30
    // t-2: vendas 100, pedidos 5,  cmvPercentual 40
    p.dashboardSnapshot.findMany.mockResolvedValue([
      { tenantId: 't-1', totalVendas: 1000, totalPedidos: 50, ticketMedio: 20, cmvPercentual: 30, cmvTotal: 300 },
      { tenantId: 't-2', totalVendas: 100,  totalPedidos: 5,  ticketMedio: 20, cmvPercentual: 40, cmvTotal: 40  },
    ])

    const result = await benchmarkUnidades('b-1', {
      inicio: new Date('2026-01-01'),
      fim: new Date('2026-01-31'),
    })

    const t2 = result.unidades.find((u) => u.tenantId === 't-2')!
    expect(t2.abaixoDaMedia).toBe(true)
  })

  it('identifica líder por CMV%', async () => {
    p.tenant.findMany.mockResolvedValue([
      { id: 't-1', name: 'A' },
      { id: 't-2', name: 'B' },
    ])
    p.dashboardSnapshot.findMany.mockResolvedValue([
      { tenantId: 't-1', totalVendas: 1000, totalPedidos: 50, ticketMedio: 20, cmvPercentual: 25, cmvTotal: 250 },
      { tenantId: 't-2', totalVendas: 1000, totalPedidos: 50, ticketMedio: 20, cmvPercentual: 40, cmvTotal: 400 },
    ])

    const result = await benchmarkUnidades('b-1', {
      inicio: new Date('2026-01-01'),
      fim: new Date('2026-01-31'),
    })

    const lider = result.unidades.find((u) => u.liderCmv)
    expect(lider?.tenantId).toBe('t-1')
  })
})
```

- [ ] **Passo 2: Confirmar falha**

```bash
npx vitest run src/services/multi-unit/consolidated-reports.service.test.ts
```

- [ ] **Passo 3: Implementar o service**

Criar `src/services/multi-unit/consolidated-reports.service.ts`:

```ts
import { prisma } from '@/lib/prisma'
import type { FiltroPeriodo, BenchmarkData, BenchmarkUnidade } from './types'

export async function vendasConsolidadas(brandId: string, periodo: FiltroPeriodo) {
  const tenants = await prisma.tenant.findMany({ where: { brandId }, select: { id: true } })
  const ids = tenants.map((t) => t.id)

  return prisma.dashboardSnapshot.findMany({
    where: { tenantId: { in: ids }, data: { gte: periodo.inicio, lte: periodo.fim } },
    orderBy: { data: 'asc' },
  })
}

export async function cmvConsolidado(brandId: string, periodo: FiltroPeriodo) {
  const snapshots = await vendasConsolidadas(brandId, periodo)
  const totalVendas = snapshots.reduce((s, r) => s + Number(r.totalVendas), 0)
  const totalCmv = snapshots.reduce((s, r) => s + Number(r.cmvTotal), 0)
  return {
    totalVendas,
    totalCmv,
    cmvPercentual: totalVendas > 0 ? (totalCmv / totalVendas) * 100 : 0,
  }
}

export async function benchmarkUnidades(brandId: string, periodo: FiltroPeriodo): Promise<BenchmarkData> {
  const tenants = await prisma.tenant.findMany({
    where: { brandId },
    select: { id: true, name: true },
  })

  if (tenants.length === 0) {
    return { unidades: [], mediaCmv: 0, mediaTicket: 0, mediaMargem: 0 }
  }

  const ids = tenants.map((t) => t.id)
  const snapshots = await prisma.dashboardSnapshot.findMany({
    where: { tenantId: { in: ids }, data: { gte: periodo.inicio, lte: periodo.fim } },
  })

  // Agregar por unidade
  const aggMap = new Map<string, { vendas: number; pedidos: number; cmvSum: number; days: number }>()
  for (const s of snapshots) {
    const cur = aggMap.get(s.tenantId) ?? { vendas: 0, pedidos: 0, cmvSum: 0, days: 0 }
    cur.vendas += Number(s.totalVendas)
    cur.pedidos += s.totalPedidos
    cur.cmvSum += Number(s.cmvPercentual)
    cur.days += 1
    aggMap.set(s.tenantId, cur)
  }

  const unidadesRaw: Array<{ tenantId: string; tenantName: string; ticketMedio: number; cmvPercent: number; margemBruta: number }> =
    tenants.map((t) => {
      const agg = aggMap.get(t.id)
      const vendas = agg?.vendas ?? 0
      const pedidos = agg?.pedidos ?? 0
      const cmvPercent = agg && agg.days > 0 ? agg.cmvSum / agg.days : 0
      const ticketMedio = pedidos > 0 ? vendas / pedidos : 0
      const margemBruta = 100 - cmvPercent
      return { tenantId: t.id, tenantName: t.name, ticketMedio, cmvPercent, margemBruta }
    })

  const mediaCmv = unidadesRaw.reduce((s, u) => s + u.cmvPercent, 0) / unidadesRaw.length
  const mediaTicket = unidadesRaw.reduce((s, u) => s + u.ticketMedio, 0) / unidadesRaw.length
  const mediaMargem = unidadesRaw.reduce((s, u) => s + u.margemBruta, 0) / unidadesRaw.length

  // Líderes (menor CMV% = melhor)
  const minCmv = Math.min(...unidadesRaw.map((u) => u.cmvPercent))
  const maxTicket = Math.max(...unidadesRaw.map((u) => u.ticketMedio))
  const maxMargem = Math.max(...unidadesRaw.map((u) => u.margemBruta))

  const unidades: BenchmarkUnidade[] = unidadesRaw.map((u) => ({
    ...u,
    liderCmv: u.cmvPercent === minCmv,
    liderTicket: u.ticketMedio === maxTicket,
    liderMargem: u.margemBruta === maxMargem,
    abaixoDaMedia: u.ticketMedio < mediaTicket * 0.8,
  }))

  return { unidades, mediaCmv, mediaTicket, mediaMargem }
}
```

- [ ] **Passo 4: Executar testes**

```bash
npx vitest run src/services/multi-unit/consolidated-reports.service.test.ts
```

Saída esperada: `✓ 3 tests passed`.

- [ ] **Passo 5: Commit**

```bash
git add src/services/multi-unit/consolidated-reports.service.ts src/services/multi-unit/consolidated-reports.service.test.ts
git commit -m "feat(multi-unit): implement consolidated-reports.service"
```

---

## Task 4: `purchase-order.service.ts`

**Arquivos:**
- Criar: `src/services/multi-unit/purchase-order.service.ts`
- Criar: `src/services/multi-unit/purchase-order.service.test.ts`

- [ ] **Passo 1: Escrever testes**

Criar `src/services/multi-unit/purchase-order.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenant: { findMany: vi.fn() },
    alert: { findMany: vi.fn() },
    purchaseOrder: { create: vi.fn(), findUnique: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { gerarPedidoConsolidado } from './purchase-order.service'

const p = prisma as unknown as {
  tenant: Record<string, ReturnType<typeof vi.fn>>
  alert: Record<string, ReturnType<typeof vi.fn>>
  purchaseOrder: Record<string, ReturnType<typeof vi.fn>>
}

beforeEach(() => { vi.clearAllMocks() })

describe('gerarPedidoConsolidado', () => {
  it('cria PurchaseOrder com itens agrupados por insumo', async () => {
    p.tenant.findMany.mockResolvedValue([{ id: 't-1' }, { id: 't-2' }])
    p.alert.findMany.mockResolvedValue([
      {
        tenantId: 't-1',
        metadata: { ingredientId: 'i-1', quantidadeNecessaria: 10, unit: 'KG' },
      },
      {
        tenantId: 't-2',
        metadata: { ingredientId: 'i-1', quantidadeNecessaria: 5, unit: 'KG' },
      },
      {
        tenantId: 't-1',
        metadata: { ingredientId: 'i-2', quantidadeNecessaria: 3, unit: 'UN' },
      },
    ])
    p.purchaseOrder.create.mockResolvedValue({ id: 'po-1' })

    await gerarPedidoConsolidado('b-1', 'f-1', 'u-admin')

    const createCall = p.purchaseOrder.create.mock.calls[0][0]
    const itens = createCall.data.itens.create
    expect(itens).toHaveLength(2)

    const i1 = itens.find((i: { insumoId: string }) => i.insumoId === 'i-1')
    expect(Number(i1.quantidadeTotal)).toBe(15)
    expect(i1.distribuicaoPorUnidade).toEqual({ 't-1': 10, 't-2': 5 })
  })
})
```

- [ ] **Passo 2: Confirmar falha**

```bash
npx vitest run src/services/multi-unit/purchase-order.service.test.ts
```

- [ ] **Passo 3: Implementar o service**

Criar `src/services/multi-unit/purchase-order.service.ts`:

```ts
import { prisma } from '@/lib/prisma'
import type { PurchaseOrder } from '@prisma/client'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import * as XLSX from 'xlsx'
import { createElement } from 'react'

export async function gerarPedidoConsolidado(
  brandId: string,
  fornecedorId: string,
  createdBy: string
): Promise<PurchaseOrder> {
  const tenants = await prisma.tenant.findMany({
    where: { brandId },
    select: { id: true },
  })
  const tenantIds = tenants.map((t) => t.id)

  // Buscar alertas de estoque ativos em todas as unidades
  const alertas = await prisma.alert.findMany({
    where: {
      tenantId: { in: tenantIds },
      tipo: 'ESTOQUE',
      status: 'NAO_LIDO',
    },
    select: { tenantId: true, metadata: true },
  })

  // Agrupar por insumoId
  const grouped = new Map<
    string,
    { total: number; unit: string; dist: Record<string, number> }
  >()
  for (const alerta of alertas) {
    const meta = alerta.metadata as { ingredientId?: string; quantidadeNecessaria?: number; unit?: string }
    if (!meta.ingredientId) continue
    const cur = grouped.get(meta.ingredientId) ?? { total: 0, unit: meta.unit ?? 'UN', dist: {} }
    cur.total += meta.quantidadeNecessaria ?? 0
    cur.dist[alerta.tenantId] = (cur.dist[alerta.tenantId] ?? 0) + (meta.quantidadeNecessaria ?? 0)
    grouped.set(meta.ingredientId, cur)
  }

  const itens = Array.from(grouped.entries()).map(([insumoId, data]) => ({
    insumoId,
    quantidadeTotal: data.total,
    unidadeMedida: data.unit,
    distribuicaoPorUnidade: data.dist,
  }))

  return prisma.purchaseOrder.create({
    data: {
      brandId,
      fornecedorId,
      createdBy,
      status: 'RASCUNHO',
      valorTotal: 0,
      itens: { create: itens },
    },
  })
}

export async function exportarPDF(purchaseOrderId: string): Promise<Buffer> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: {
      fornecedor: true,
      itens: { include: { insumo: true } },
    },
  })
  if (!po) throw new Error('Pedido não encontrado')

  const styles = StyleSheet.create({
    page: { padding: 32, fontSize: 10 },
    title: { fontSize: 16, marginBottom: 16 },
    row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 4 },
    col: { flex: 1 },
  })

  const doc = createElement(
    Document,
    null,
    createElement(
      Page,
      { size: 'A4', style: styles.page },
      createElement(Text, { style: styles.title }, `Pedido de Compra #${po.id.slice(-6)}`),
      createElement(Text, null, `Fornecedor: ${po.fornecedor.name}`),
      createElement(Text, null, `Status: ${po.status}`),
      createElement(View, { style: { marginTop: 16 } },
        ...po.itens.map((item) =>
          createElement(
            View,
            { key: item.id, style: styles.row },
            createElement(Text, { style: styles.col }, item.insumo.name),
            createElement(Text, { style: styles.col }, `${item.quantidadeTotal} ${item.unidadeMedida}`)
          )
        )
      )
    )
  )

  return renderToBuffer(doc)
}

export async function exportarExcel(purchaseOrderId: string): Promise<Buffer> {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    include: {
      fornecedor: true,
      itens: { include: { insumo: true } },
    },
  })
  if (!po) throw new Error('Pedido não encontrado')

  const rows = po.itens.map((item) => ({
    Insumo: item.insumo.name,
    'Quantidade Total': Number(item.quantidadeTotal),
    'Unidade de Medida': item.unidadeMedida,
    'Custo Unitário Estimado': item.custoUnitarioEstimado ? Number(item.custoUnitarioEstimado) : '',
    Distribuição: JSON.stringify(item.distribuicaoPorUnidade),
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Pedido de Compra')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}
```

- [ ] **Passo 4: Executar testes**

```bash
npx vitest run src/services/multi-unit/purchase-order.service.test.ts
```

Saída esperada: `✓ 1 test passed`.

- [ ] **Passo 5: Commit**

```bash
git add src/services/multi-unit/purchase-order.service.ts src/services/multi-unit/purchase-order.service.test.ts
git commit -m "feat(multi-unit): implement purchase-order.service with PDF/Excel export"
```

---

## Task 5: API Routes `/api/rede/*`

- [ ] **Passo 1: Criar `src/app/api/rede/switch-unit/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { tenantId } = await req.json()
  const res = NextResponse.json({ ok: true })

  if (tenantId) {
    res.cookies.set('active-brand-unit', tenantId, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 horas (mesma duração da sessão)
    })
  } else {
    res.cookies.delete('active-brand-unit')
  }

  return res
}
```

- [ ] **Passo 2: Criar `src/app/api/rede/dashboard/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { checkMultiUnitFeature } from '@/lib/check-multi-unit'
import { buscarKpisConsolidados } from '@/services/multi-unit/brand.service'
import { MultiUnitForbiddenError } from '@/lib/check-multi-unit'
import { subDays, startOfDay, endOfDay } from 'date-fns'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    await checkMultiUnitFeature(session.user.tenantId)
  } catch (e) {
    if (e instanceof MultiUnitForbiddenError) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }
    throw e
  }

  const { searchParams } = req.nextUrl
  const days = parseInt(searchParams.get('days') ?? '30', 10)
  const fim = endOfDay(new Date())
  const inicio = startOfDay(subDays(fim, days))

  const brandId = session.user.brandId
  if (!brandId) {
    return NextResponse.json({ error: 'Tenant não pertence a uma rede' }, { status: 400 })
  }

  const kpis = await buscarKpisConsolidados(brandId, { inicio, fim })
  return NextResponse.json(kpis)
}
```

- [ ] **Passo 3: Criar `src/app/api/rede/unidades/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { checkMultiUnitFeature, MultiUnitForbiddenError } from '@/lib/check-multi-unit'
import { listarUnidades, adicionarUnidade } from '@/services/multi-unit/brand.service'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try { await checkMultiUnitFeature(session.user.tenantId) }
  catch (e) { if (e instanceof MultiUnitForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 }); throw e }

  const brandId = session.user.brandId!
  const unidades = await listarUnidades(brandId)
  return NextResponse.json(unidades)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try { await checkMultiUnitFeature(session.user.tenantId) }
  catch (e) { if (e instanceof MultiUnitForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 }); throw e }

  const { tenantId } = await req.json()
  if (!tenantId) return NextResponse.json({ error: 'tenantId obrigatório' }, { status: 400 })

  await adicionarUnidade(session.user.brandId!, tenantId)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Passo 4: Criar `src/app/api/rede/cardapio/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { checkMultiUnitFeature, MultiUnitForbiddenError } from '@/lib/check-multi-unit'
import { prisma } from '@/lib/prisma'

async function guardedSession() {
  const session = await getSession()
  if (!session?.user?.tenantId) return null
  try { await checkMultiUnitFeature(session.user.tenantId) } catch { return null }
  return session
}

export async function GET() {
  const session = await guardedSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const produtos = await prisma.product.findMany({
    where: { brandId: session.user.brandId!, isShared: true },
    include: { category: true, overrides: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(produtos)
}

export async function POST(req: NextRequest) {
  const session = await guardedSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const body = await req.json()
  const produto = await prisma.product.create({
    data: {
      name: body.name,
      salePrice: body.salePrice ?? 0,
      categoryId: body.categoryId ?? null,
      tenantId: session.user.tenantId,
      brandId: session.user.brandId!,
      isShared: true,
    },
  })
  return NextResponse.json(produto, { status: 201 })
}
```

- [ ] **Passo 5: Criar `src/app/api/rede/cardapio/[id]/route.ts`**

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

  const body = await req.json()
  const produto = await prisma.product.update({
    where: { id: params.id, brandId: session.user.brandId! },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.salePrice !== undefined && { salePrice: body.salePrice }),
    },
  })
  return NextResponse.json(produto)
}
```

- [ ] **Passo 6: Criar `src/app/api/rede/cardapio/override/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { checkMultiUnitFeature, MultiUnitForbiddenError } from '@/lib/check-multi-unit'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try { await checkMultiUnitFeature(session.user.tenantId) }
  catch (e) { if (e instanceof MultiUnitForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 }); throw e }

  const { tenantId, produtoId, preco, ativo } = await req.json()

  const override = await prisma.produtoOverride.upsert({
    where: { tenantId_produtoId: { tenantId, produtoId } },
    create: { tenantId, produtoId, preco: preco ?? null, ativo: ativo ?? true },
    update: { preco: preco ?? null, ativo: ativo ?? true },
  })
  return NextResponse.json(override)
}
```

- [ ] **Passo 7: Criar `src/app/api/rede/compras/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { checkMultiUnitFeature, MultiUnitForbiddenError } from '@/lib/check-multi-unit'
import { prisma } from '@/lib/prisma'
import { gerarPedidoConsolidado } from '@/services/multi-unit/purchase-order.service'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try { await checkMultiUnitFeature(session.user.tenantId) }
  catch (e) { if (e instanceof MultiUnitForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 }); throw e }

  const pedidos = await prisma.purchaseOrder.findMany({
    where: { brandId: session.user.brandId! },
    include: { fornecedor: true, _count: { select: { itens: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(pedidos)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try { await checkMultiUnitFeature(session.user.tenantId) }
  catch (e) { if (e instanceof MultiUnitForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 }); throw e }

  const { fornecedorId } = await req.json()
  const pedido = await gerarPedidoConsolidado(session.user.brandId!, fornecedorId, session.user.id)
  return NextResponse.json(pedido, { status: 201 })
}
```

- [ ] **Passo 8: Criar `src/app/api/rede/compras/[id]/exportar/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { checkMultiUnitFeature, MultiUnitForbiddenError } from '@/lib/check-multi-unit'
import { exportarPDF, exportarExcel } from '@/services/multi-unit/purchase-order.service'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try { await checkMultiUnitFeature(session.user.tenantId) }
  catch (e) { if (e instanceof MultiUnitForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 }); throw e }

  const formato = req.nextUrl.searchParams.get('formato') ?? 'pdf'

  if (formato === 'excel') {
    const buffer = await exportarExcel(params.id)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="pedido-${params.id}.xlsx"`,
      },
    })
  }

  const buffer = await exportarPDF(params.id)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="pedido-${params.id}.pdf"`,
    },
  })
}
```

- [ ] **Passo 9: Criar `src/app/api/rede/relatorios/benchmark/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { checkMultiUnitFeature, MultiUnitForbiddenError } from '@/lib/check-multi-unit'
import { benchmarkUnidades } from '@/services/multi-unit/consolidated-reports.service'
import { subDays, startOfDay, endOfDay } from 'date-fns'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try { await checkMultiUnitFeature(session.user.tenantId) }
  catch (e) { if (e instanceof MultiUnitForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 }); throw e }

  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  const fim = endOfDay(new Date())
  const inicio = startOfDay(subDays(fim, days))

  const data = await benchmarkUnidades(session.user.brandId!, { inicio, fim })
  return NextResponse.json(data)
}
```

- [ ] **Passo 10: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Passo 11: Commit**

```bash
git add src/app/api/rede/
git commit -m "feat(api): add /api/rede/* routes for multi-unit module"
```

---

## Checklist final da Parte 2

- [ ] `npx vitest run src/services/multi-unit/` — todos os testes passando
- [ ] `npx tsc --noEmit` — sem erros
