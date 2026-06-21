# Emissão de NFC-e (Sub-projeto C) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emitir NFC-e (modelo 65) no fechamento do pedido do caixa via Focus NFe, com config fiscal por tenant + override por produto, idempotente por pedido, não-bloqueante, com reemissão/cancelamento e retry.

**Architecture:** Reusa a fundação fiscal do B (`FocusNfeAdapter`, `TenantFiscal`, `NfProcessada`, `crypto.ts`). Novos: campos fiscais no schema, métodos NFC-e no adapter, um builder puro de payload, um serviço de emissão idempotente, rotas admin + gatilho na finalização + job de retry, e UI.

**Tech Stack:** Next.js 14, Prisma 7, TypeScript, BullMQ, Vitest 4, crypto AES-256-GCM (`src/lib/crypto.ts`), Focus NFe REST.

## Global Constraints

- Apenas tokens `--tf-*` em UI nova (sem cores hardcoded/Tailwind color classes).
- Segredos (CSC) cifrados em repouso via `crypto.ts`; nunca em log/resposta.
- Rotas de config fiscal/emissão/cancelamento admin-only (ADMIN/SUPER_ADMIN); reemissão pode incluir MANAGER.
- Sem novas dependências (usar `fetch` nativo).
- Idempotência: uma NFC-e por pedido (`pedidoId @unique`).
- ⚠️ Verificação end-to-end (Task 9) BLOQUEADA — requer `FOCUS_NFE_TOKEN` + certificado + CSC em homologação. Tasks 1–8 testadas com mocks.

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` | campos `TenantFiscal`/`Product`/`NfProcessada`, enums, migration |
| `src/services/fiscal/fiscal-provider.types.ts` | +tipos NFC-e |
| `src/services/fiscal/focus-nfe.adapter.ts` | +emitir/consultar/cancelar NFC-e |
| `src/services/fiscal/nfce-payload.ts` | criar (builder puro) |
| `src/services/fiscal/nfce-emissao.service.ts` | criar |
| `src/services/fiscal/__tests__/*.test.ts` | criar |
| `src/app/api/fiscal/nfce/emitir/route.ts`, `cancelar/route.ts`, `status/[pedidoId]/route.ts` | criar |
| `src/app/api/fiscal/config-nfce/route.ts` | criar (config + CSC cifrado) |
| `src/app/api/pedidos/[id]/finalizar/route.ts` | gatilho não-bloqueante |
| `src/jobs/fiscal/nfce-retry.job.ts` + worker | criar/registrar |
| `src/app/[slug]/caixa/page.tsx`, config fiscal UI, form de produto | editar (`--tf-*`) |

---

## Task 1: Schema — campos fiscais de emissão

**Files:** Modify `prisma/schema.prisma`

**Interfaces:**
- Produces: enum `RegimeTributario { SIMPLES_NACIONAL NORMAL }`; `NfStatus` += `AUTORIZADA REJEITADA CANCELADA`; `TenantFiscal` fiscal fields; `Product` fiscal override fields; `NfProcessada` += `pedidoId @unique` + emission fields; `Pedido.nfce` relation.

- [ ] **Step 1: Enums + TenantFiscal**

Adicionar `enum RegimeTributario { SIMPLES_NACIONAL NORMAL }`. Em `enum NfStatus` adicionar `AUTORIZADA`, `REJEITADA`, `CANCELADA`. Em `TenantFiscal`:
```prisma
  regimeTributario       RegimeTributario?
  inscricaoEstadual      String?
  cscNfce                String?  @db.Text
  cscIdNfce              String?
  serieNfce              Int?     @default(1)
  proximoNumeroNfce      Int?     @default(1)
  nfceAutomatica         Boolean  @default(true)
  ncmPadrao              String?
  cfopPadrao             String?
  cstCsosnPadrao         String?
  origemMercadoriaPadrao String?  @default("0")
```

- [ ] **Step 2: Product override**
```prisma
  ncm               String?
  cfop              String?
  cstCsosn          String?
  origemMercadoria  String?
  unidadeTributavel String?
```

- [ ] **Step 3: NfProcessada + Pedido relation**

Em `NfProcessada`:
```prisma
  pedidoId             String?  @unique
  pedido               Pedido?  @relation(fields: [pedidoId], references: [id])
  danfeUrl             String?
  qrCode               String?  @db.Text
  protocoloAutorizacao String?
  motivoRejeicao       String?
  refExterna           String?
```
Em `Pedido` adicionar a relação inversa: `nfce NfProcessada?`.

- [ ] **Step 4: Migration**

`npx prisma migrate dev --name nfce_emission_fields`. Se `migrate dev` não rodar interativo (Prisma 7/TTY), replicar o workaround do projeto: criar a migration manualmente com SQL aditivo (`ADD COLUMN` nullable; `CREATE UNIQUE INDEX "NfProcessada_pedidoId_key"`; `CREATE TYPE "RegimeTributario"`; `ALTER TYPE "NfStatus" ADD VALUE` para os 3 novos — fora de transação), depois `npx prisma migrate deploy` + `npx prisma generate`. Tudo aditivo/nullable.

- [ ] **Step 5: Verify + Commit**
```bash
npx tsc --noEmit
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): NFC-e emission fiscal fields"
```

---

## Task 2: Adapter — métodos NFC-e (TDD)

**Files:** Modify `src/services/fiscal/fiscal-provider.types.ts`, `src/services/fiscal/focus-nfe.adapter.ts`; create `src/services/fiscal/__tests__/focus-nfe.nfce.test.ts`

**Interfaces:**
- Consumes: existing `FiscalProvider`, `authHeader`/`baseUrl` helpers in the adapter.
- Produces: `NfcePayload` (opaque `Record<string, unknown>`), `NfceResultado = { status: 'autorizado'|'processando'|'erro'|'cancelado'; chaveAcesso?: string; danfeUrl?: string; xml?: string; protocolo?: string; motivo?: string }`; adapter methods `emitirNfce(ref, payload)`, `consultarNfce(ref)`, `cancelarNfce(ref, justificativa)`.

- [ ] **Step 1: Tipos** — em `fiscal-provider.types.ts`:
```typescript
export type NfcePayload = Record<string, unknown>
export type NfceResultado = {
  status: 'autorizado' | 'processando' | 'erro' | 'cancelado'
  chaveAcesso?: string
  danfeUrl?: string
  xml?: string
  protocolo?: string
  motivo?: string
}
```
E adicionar à interface `FiscalProvider`:
```typescript
  emitirNfce(ref: string, payload: NfcePayload): Promise<NfceResultado>
  consultarNfce(ref: string): Promise<NfceResultado>
  cancelarNfce(ref: string, justificativa: string): Promise<NfceResultado>
```

- [ ] **Step 2: Teste falhando** (`__tests__/focus-nfe.nfce.test.ts`)
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FocusNfeAdapter } from '../focus-nfe.adapter'

describe('FocusNfeAdapter NFC-e', () => {
  beforeEach(() => { vi.restoreAllMocks(); process.env.FOCUS_NFE_TOKEN = 'tok'; process.env.FOCUS_NFE_BASE_URL = 'https://h.test' })

  it('emitirNfce mapeia autorizado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'autorizado', chave_nfe: 'CHAVE', caminho_danfe: '/d.pdf', caminho_xml_nota_fiscal: '/n.xml', protocolo: '123' }),
    }))
    const r = await new FocusNfeAdapter().emitirNfce('ref1', { foo: 1 })
    expect(r.status).toBe('autorizado')
    expect(r.chaveAcesso).toBe('CHAVE')
    expect(r.protocolo).toBe('123')
  })

  it('emitirNfce mapeia erro/rejeição com motivo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'erro_autorizacao', mensagem_sefaz: 'Rejeição 999' }),
    }))
    const r = await new FocusNfeAdapter().emitirNfce('ref1', {})
    expect(r.status).toBe('erro')
    expect(r.motivo).toContain('999')
  })

  it('cancelarNfce mapeia cancelado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'cancelado' }) }))
    const r = await new FocusNfeAdapter().cancelarNfce('ref1', 'engano')
    expect(r.status).toBe('cancelado')
  })
})
```

- [ ] **Step 3: Run, confirm FAIL**
```bash
npx vitest run src/services/fiscal/__tests__/focus-nfe.nfce.test.ts
```

- [ ] **Step 4: Implementar no `focus-nfe.adapter.ts`** (reusa `baseUrl()`/`authHeader()`):
```typescript
function mapNfce(o: Record<string, unknown>): NfceResultado {
  const raw = String(o.status ?? '')
  const status: NfceResultado['status'] =
    raw === 'autorizado' ? 'autorizado'
    : raw === 'cancelado' ? 'cancelado'
    : raw === 'processando_autorizacao' ? 'processando'
    : 'erro'
  return {
    status,
    chaveAcesso: o.chave_nfe ? String(o.chave_nfe) : undefined,
    danfeUrl: o.caminho_danfe ? String(o.caminho_danfe) : undefined,
    xml: o.caminho_xml_nota_fiscal ? String(o.caminho_xml_nota_fiscal) : undefined,
    protocolo: o.protocolo ? String(o.protocolo) : undefined,
    motivo: o.mensagem_sefaz ? String(o.mensagem_sefaz) : (o.erros ? JSON.stringify(o.erros) : undefined),
  }
}

// dentro da classe FocusNfeAdapter:
async emitirNfce(ref: string, payload: NfcePayload): Promise<NfceResultado> {
  const res = await fetch(`${baseUrl()}/v2/nfce?ref=${encodeURIComponent(ref)}`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok && res.status >= 500) throw new Error(`Focus NFCe emitir falhou: ${res.status}`)
  return mapNfce((await res.json()) as Record<string, unknown>)
}
async consultarNfce(ref: string): Promise<NfceResultado> {
  const res = await fetch(`${baseUrl()}/v2/nfce/${encodeURIComponent(ref)}`, { headers: { Authorization: authHeader() } })
  if (!res.ok && res.status >= 500) throw new Error(`Focus NFCe consultar falhou: ${res.status}`)
  return mapNfce((await res.json()) as Record<string, unknown>)
}
async cancelarNfce(ref: string, justificativa: string): Promise<NfceResultado> {
  const res = await fetch(`${baseUrl()}/v2/nfce/${encodeURIComponent(ref)}`, {
    method: 'DELETE',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ justificativa }),
  })
  if (!res.ok && res.status >= 500) throw new Error(`Focus NFCe cancelar falhou: ${res.status}`)
  return mapNfce((await res.json()) as Record<string, unknown>)
}
```
Importar `NfcePayload`, `NfceResultado` no topo do adapter.
> Nomes de campos da Focus (`chave_nfe`, `caminho_danfe`, `mensagem_sefaz`, etc.) confirmados contra a doc/sandbox na Task 9; isolados aqui.

- [ ] **Step 5: Run green + tsc + commit**
```bash
npx vitest run src/services/fiscal/__tests__/focus-nfe.nfce.test.ts
npx tsc --noEmit
git add src/services/fiscal/fiscal-provider.types.ts src/services/fiscal/focus-nfe.adapter.ts src/services/fiscal/__tests__/focus-nfe.nfce.test.ts
git commit -m "feat(fiscal): NFC-e adapter methods (emitir/consultar/cancelar)"
```

---

## Task 3: Builder de payload (puro, TDD)

**Files:** Create `src/services/fiscal/nfce-payload.ts`, `src/services/fiscal/__tests__/nfce-payload.test.ts`

**Interfaces:**
- Produces: `montarPayloadNfce(input: PayloadInput): NfcePayload` where
  `PayloadInput = { pedido: { total: number; itens: ItemPedidoFiscal[]; pagamentos: { formaPagamento: string; valor: number }[] }; fiscal: TenantFiscalDefaults; cnpjEmitente: string }`,
  `ItemPedidoFiscal = { nome: string; quantidade: number; precoUnitario: number; ncm?: string; cfop?: string; cstCsosn?: string; origemMercadoria?: string; unidadeTributavel?: string }`,
  `TenantFiscalDefaults = { ncmPadrao?: string; cfopPadrao?: string; cstCsosnPadrao?: string; origemMercadoriaPadrao?: string; serie: number; numero: number }`.

- [ ] **Step 1: Teste** (`__tests__/nfce-payload.test.ts`)
```typescript
import { describe, it, expect } from 'vitest'
import { montarPayloadNfce } from '../nfce-payload'

const base = {
  cnpjEmitente: '11222333000181',
  fiscal: { ncmPadrao: '21069090', cfopPadrao: '5102', cstCsosnPadrao: '102', origemMercadoriaPadrao: '0', serie: 1, numero: 7 },
  pedido: {
    total: 30,
    itens: [
      { nome: 'X-Burger', quantidade: 2, precoUnitario: 10 },
      { nome: 'Refri', quantidade: 1, precoUnitario: 10, ncm: '22021000', cfop: '5405' },
    ],
    pagamentos: [{ formaPagamento: 'PIX', valor: 30 }],
  },
}

describe('montarPayloadNfce', () => {
  it('usa override do item quando presente, senão o padrão do tenant', () => {
    const p: any = montarPayloadNfce(base as any)
    expect(p.items[0].ncm).toBe('21069090') // padrão
    expect(p.items[1].ncm).toBe('22021000') // override
    expect(p.items[1].cfop).toBe('5405')    // override
    expect(p.items[0].cfop).toBe('5102')    // padrão
  })
  it('mapeia série/número e total', () => {
    const p: any = montarPayloadNfce(base as any)
    expect(p.serie).toBe(1)
    expect(p.numero).toBe(7)
    expect(p.valor_total).toBe(30)
  })
  it('mapeia formas de pagamento', () => {
    const p: any = montarPayloadNfce(base as any)
    expect(p.formas_pagamento[0].valor_pagamento).toBe(30)
  })
})
```

- [ ] **Step 2: Run, confirm FAIL**
```bash
npx vitest run src/services/fiscal/__tests__/nfce-payload.test.ts
```

- [ ] **Step 3: Implementar `nfce-payload.ts`**
```typescript
import type { NfcePayload } from './fiscal-provider.types'

export type ItemPedidoFiscal = {
  nome: string; quantidade: number; precoUnitario: number
  ncm?: string; cfop?: string; cstCsosn?: string; origemMercadoria?: string; unidadeTributavel?: string
}
export type TenantFiscalDefaults = {
  ncmPadrao?: string; cfopPadrao?: string; cstCsosnPadrao?: string; origemMercadoriaPadrao?: string
  serie: number; numero: number
}
export type PayloadInput = {
  pedido: { total: number; itens: ItemPedidoFiscal[]; pagamentos: { formaPagamento: string; valor: number }[] }
  fiscal: TenantFiscalDefaults
  cnpjEmitente: string
}

const FORMA_MAP: Record<string, string> = { DINHEIRO: '01', CREDITO: '03', DEBITO: '04', PIX: '17' }

export function montarPayloadNfce(input: PayloadInput): NfcePayload {
  const { pedido, fiscal, cnpjEmitente } = input
  const items = pedido.itens.map((it, i) => ({
    numero_item: i + 1,
    descricao: it.nome,
    quantidade_comercial: it.quantidade,
    valor_unitario_comercial: it.precoUnitario,
    valor_bruto: Math.round(it.quantidade * it.precoUnitario * 100) / 100,
    ncm: it.ncm ?? fiscal.ncmPadrao,
    cfop: it.cfop ?? fiscal.cfopPadrao,
    codigo_situacao_tributaria: it.cstCsosn ?? fiscal.cstCsosnPadrao,
    origem: it.origemMercadoria ?? fiscal.origemMercadoriaPadrao,
    unidade_comercial: it.unidadeTributavel ?? 'UN',
  }))
  return {
    cnpj_emitente: cnpjEmitente,
    serie: fiscal.serie,
    numero: fiscal.numero,
    valor_total: pedido.total,
    formas_pagamento: pedido.pagamentos.map((p) => ({
      forma_pagamento: FORMA_MAP[p.formaPagamento] ?? '99',
      valor_pagamento: p.valor,
    })),
    items,
  }
}
```

- [ ] **Step 4: Run green + commit**
```bash
npx vitest run src/services/fiscal/__tests__/nfce-payload.test.ts
npx tsc --noEmit
git add src/services/fiscal/nfce-payload.ts src/services/fiscal/__tests__/nfce-payload.test.ts
git commit -m "feat(fiscal): pure NFC-e payload builder (override-or-default)"
```

---

## Task 4: Serviço de emissão idempotente (TDD)

**Files:** Create `src/services/fiscal/nfce-emissao.service.ts`, `src/services/fiscal/__tests__/nfce-emissao.service.test.ts`

**Interfaces:**
- Consumes: `montarPayloadNfce`, adapter `emitirNfce`, prisma.
- Produces: `emitirNfceParaPedido(pedidoId: string, provider?: FiscalProvider): Promise<{ status: NfStatus; nfId: string | null }>`.

- [ ] **Step 1: Teste** — mocka prisma + payload builder + provider:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    nfProcessada: { findUnique: vi.fn(), upsert: vi.fn() },
    tenantFiscal: { update: vi.fn() },
    pedido: { findFirst: vi.fn() },
  },
}))
vi.mock('../nfce-payload', () => ({ montarPayloadNfce: vi.fn(() => ({ fake: true })) }))

import { emitirNfceParaPedido } from '../nfce-emissao.service'
import { prisma } from '@/lib/prisma'

const mp = prisma as any
const provider = { emitirNfce: vi.fn(), consultarNfce: vi.fn(), cancelarNfce: vi.fn(), registrarEmitente: vi.fn(), consultarNotasDestinadas: vi.fn(), baixarXml: vi.fn() }

beforeEach(() => {
  vi.clearAllMocks()
  mp.pedido.findFirst.mockResolvedValue({
    id: 'p1', tenantId: 't1', total: 30,
    itens: [{ quantidade: 1, precoUnitario: 30, product: { name: 'X', ncm: null, cfop: null, cstCsosn: null, origemMercadoria: null, unidadeTributavel: null } }],
    pagamentos: [{ formaPagamento: 'PIX', valor: 30 }],
    tenant: { cnpj: '11222333000181', fiscal: { serieNfce: 1, proximoNumeroNfce: 7, ncmPadrao: '2106', cfopPadrao: '5102', cstCsosnPadrao: '102', origemMercadoriaPadrao: '0' } },
  })
  mp.nfProcessada.findUnique.mockResolvedValue(null)
  mp.nfProcessada.upsert.mockResolvedValue({ id: 'nf1' })
  mp.tenantFiscal.update.mockResolvedValue({})
  provider.emitirNfce.mockResolvedValue({ status: 'autorizado', chaveAcesso: 'C', danfeUrl: '/d', protocolo: '1' })
})

describe('emitirNfceParaPedido', () => {
  it('emite e grava AUTORIZADA, incrementa a numeração', async () => {
    const r = await emitirNfceParaPedido('p1', provider as any)
    expect(provider.emitirNfce).toHaveBeenCalled()
    expect(mp.nfProcessada.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { pedidoId: 'p1' },
      create: expect.objectContaining({ origem: 'EMISSAO', tipo: 'SAIDA', status: 'AUTORIZADA' }),
    }))
    expect(mp.tenantFiscal.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { proximoNumeroNfce: 8 },
    }))
    expect(r.status).toBe('AUTORIZADA')
  })

  it('é idempotente: não reemite se já AUTORIZADA', async () => {
    mp.nfProcessada.findUnique.mockResolvedValue({ id: 'nf1', status: 'AUTORIZADA' })
    const r = await emitirNfceParaPedido('p1', provider as any)
    expect(provider.emitirNfce).not.toHaveBeenCalled()
    expect(r.status).toBe('AUTORIZADA')
  })

  it('grava REJEITADA quando o provider retorna erro', async () => {
    provider.emitirNfce.mockResolvedValue({ status: 'erro', motivo: 'Rejeição' })
    const r = await emitirNfceParaPedido('p1', provider as any)
    expect(mp.nfProcessada.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ status: 'REJEITADA' }),
    }))
    expect(r.status).toBe('REJEITADA')
  })
})
```

- [ ] **Step 2: Run, confirm FAIL**
```bash
npx vitest run src/services/fiscal/__tests__/nfce-emissao.service.test.ts
```

- [ ] **Step 3: Implementar `nfce-emissao.service.ts`**
```typescript
import { prisma } from '@/lib/prisma'
import { FocusNfeAdapter } from './focus-nfe.adapter'
import type { FiscalProvider } from './fiscal-provider.types'
import { montarPayloadNfce } from './nfce-payload'

const STATUS_MAP: Record<string, 'AUTORIZADA' | 'PROCESSANDO' | 'REJEITADA' | 'CANCELADA'> = {
  autorizado: 'AUTORIZADA', processando: 'PROCESSANDO', erro: 'REJEITADA', cancelado: 'CANCELADA',
}

export async function emitirNfceParaPedido(
  pedidoId: string,
  provider: FiscalProvider = new FocusNfeAdapter(),
): Promise<{ status: string; nfId: string | null }> {
  const existente = await prisma.nfProcessada.findUnique({ where: { pedidoId } })
  if (existente && (existente.status === 'AUTORIZADA' || existente.status === 'PROCESSANDO')) {
    return { status: existente.status, nfId: existente.id }
  }

  const pedido = await prisma.pedido.findFirst({
    where: { id: pedidoId },
    include: { itens: { include: { product: true } }, pagamentos: true, tenant: { include: { fiscal: true } } },
  })
  if (!pedido?.tenant?.fiscal || !pedido.tenant.cnpj) return { status: 'ERRO', nfId: null }
  const f = pedido.tenant.fiscal
  const numero = f.proximoNumeroNfce ?? 1

  const payload = montarPayloadNfce({
    cnpjEmitente: pedido.tenant.cnpj,
    fiscal: {
      ncmPadrao: f.ncmPadrao ?? undefined, cfopPadrao: f.cfopPadrao ?? undefined,
      cstCsosnPadrao: f.cstCsosnPadrao ?? undefined, origemMercadoriaPadrao: f.origemMercadoriaPadrao ?? undefined,
      serie: f.serieNfce ?? 1, numero,
    },
    pedido: {
      total: pedido.total,
      itens: pedido.itens.map((it) => ({
        nome: it.product.name, quantidade: it.quantidade, precoUnitario: it.precoUnitario,
        ncm: it.product.ncm ?? undefined, cfop: it.product.cfop ?? undefined,
        cstCsosn: it.product.cstCsosn ?? undefined, origemMercadoria: it.product.origemMercadoria ?? undefined,
        unidadeTributavel: it.product.unidadeTributavel ?? undefined,
      })),
      pagamentos: pedido.pagamentos.map((p) => ({ formaPagamento: p.formaPagamento, valor: p.valor })),
    },
  })

  const ref = `nfce-${pedidoId}`
  const res = await provider.emitirNfce(ref, payload)
  const status = STATUS_MAP[res.status] ?? 'REJEITADA'

  const data = {
    tenantId: pedido.tenantId, origem: 'EMISSAO' as const, tipo: 'SAIDA' as const,
    status, pedidoId, refExterna: ref, processadoPor: 'nfce',
    chaveAcesso: res.chaveAcesso ?? null, danfeUrl: res.danfeUrl ?? null,
    protocoloAutorizacao: res.protocolo ?? null, motivoRejeicao: res.motivo ?? null,
  }
  const nf = await prisma.nfProcessada.upsert({ where: { pedidoId }, create: data, update: data })

  if (status === 'AUTORIZADA') {
    await prisma.tenantFiscal.update({ where: { tenantId: pedido.tenantId }, data: { proximoNumeroNfce: numero + 1 } })
  }
  return { status, nfId: nf.id }
}
```
> Confirmar que `PedidoItem` tem `precoUnitario` (no schema: `precoUnitario`). Ajustar se o nome divergir.

- [ ] **Step 4: Run green + tsc + commit**
```bash
npx vitest run src/services/fiscal/__tests__/nfce-emissao.service.test.ts
npx tsc --noEmit
git add src/services/fiscal/nfce-emissao.service.ts src/services/fiscal/__tests__/nfce-emissao.service.test.ts
git commit -m "feat(fiscal): idempotent NFC-e emission service"
```

---

## Task 5: Config fiscal NFC-e (CSC cifrado) + rotas de emissão/cancelar/status

**Files:** Create `src/app/api/fiscal/config-nfce/route.ts`, `src/app/api/fiscal/nfce/emitir/route.ts`, `src/app/api/fiscal/nfce/cancelar/route.ts`, `src/app/api/fiscal/nfce/status/[pedidoId]/route.ts`

**Interfaces:**
- Consumes: `getSession`, `unauthorizedResponse`, `encrypt` (`@/lib/crypto`), `emitirNfceParaPedido`, `FocusNfeAdapter.cancelarNfce`.

- [ ] **Step 1: `config-nfce/route.ts`** (GET status + POST salvar; admin-only). POST cifra `cscNfce` com `encrypt`, grava demais campos (`regimeTributario`, `inscricaoEstadual`, `cscIdNfce`, `serieNfce`, `nfceAutomatica`, padrões) via `tenantFiscal.upsert`. GET retorna tudo **menos** `cscNfce`/cert (nunca o segredo). Padrão admin-guard idêntico a `src/app/api/fiscal/certificado/route.ts`.

- [ ] **Step 2: `nfce/emitir/route.ts`** (POST `{ pedidoId }`, admin/MANAGER):
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { emitirNfceParaPedido } from '@/services/fiscal/nfce-emissao.service'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const role = session.user.role
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN' && role !== 'MANAGER')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { pedidoId } = await req.json()
  if (!pedidoId) return NextResponse.json({ error: 'pedidoId obrigatório' }, { status: 400 })
  try {
    const r = await emitirNfceParaPedido(pedidoId)
    return NextResponse.json(r)
  } catch (err) {
    console.error('[nfce-emitir]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Falha ao emitir NFC-e' }, { status: 502 })
  }
}
```

- [ ] **Step 3: `nfce/cancelar/route.ts`** (POST `{ pedidoId, justificativa }`, admin-only): carrega `NfProcessada` por `pedidoId`, chama `new FocusNfeAdapter().cancelarNfce(refExterna, justificativa)`, atualiza status `CANCELADA` + `motivoRejeicao`/protocolo conforme retorno. Justificativa mínima 15 chars (regra SEFAZ) → validar 400.

- [ ] **Step 4: `nfce/status/[pedidoId]/route.ts`** (GET, autenticado, tenant-scoped): retorna `{ status, danfeUrl, chaveAcesso, motivoRejeicao }` da `NfProcessada` do pedido (sem xml/segredos).

- [ ] **Step 5: Verify + commit**
```bash
npx tsc --noEmit && npm test
git add src/app/api/fiscal/config-nfce src/app/api/fiscal/nfce
git commit -m "feat(fiscal): NFC-e config + emit/cancel/status routes"
```

---

## Task 6: Gatilho na finalização + retry job

**Files:** Modify `src/app/api/pedidos/[id]/finalizar/route.ts`; create `src/jobs/fiscal/nfce-retry.job.ts` + worker registration.

- [ ] **Step 1: Gatilho não-bloqueante na finalização**

Em `finalizar/route.ts`, após o `await prisma.$transaction(...)` e antes do `return NextResponse.json({ ok: true })`, adicionar (padrão fire-and-forget do auto-sync iFood):
```typescript
  // NFC-e automática (não-bloqueante): não derruba a finalização se falhar
  void (async () => {
    try {
      const fiscal = await prisma.tenantFiscal.findUnique({ where: { tenantId: pedido.tenantId }, select: { nfceAutomatica: true, focusEmpresaId: true } })
      if (fiscal?.nfceAutomatica && fiscal.focusEmpresaId) {
        const { emitirNfceParaPedido } = await import('@/services/fiscal/nfce-emissao.service')
        await emitirNfceParaPedido(params.id)
      }
    } catch (err) {
      console.error('[finalizar nfce]', err instanceof Error ? err.message : err)
    }
  })()
```

- [ ] **Step 2: Retry job** (`src/jobs/fiscal/nfce-retry.job.ts`) — mirror `nf-capture.job.ts`:
```typescript
import { prisma } from '@/lib/prisma'
import { emitirNfceParaPedido } from '@/services/fiscal/nfce-emissao.service'

export async function processNfceRetryJob(): Promise<void> {
  const pendentes = await prisma.nfProcessada.findMany({
    where: { origem: 'EMISSAO', status: 'REJEITADA', pedidoId: { not: null } },
    select: { pedidoId: true },
    take: 50,
  })
  for (const { pedidoId } of pendentes) {
    if (!pedidoId) continue
    try { await emitirNfceParaPedido(pedidoId) }
    catch (err) { console.error('[nfce-retry]', pedidoId, err instanceof Error ? err.message : err) }
  }
}
```
> Nota: o serviço só reemite quando não há nota AUTORIZADA/PROCESSANDO; uma REJEITADA é reprocessada (o upsert sobrescreve). Para evitar loop infinito de rejeições definitivas, a Task 9 pode adicionar um contador de tentativas — por ora, take 50 + intervalo limitam o volume.

- [ ] **Step 3: Registrar no worker** — READ `src/jobs/worker.ts` e `src/jobs/fiscal/index.ts` (criado no B) e registrar `processNfceRetryJob` como repeatable, intervalo `NFCE_RETRY_INTERVAL_MIN` (default 15) — mesmo mecanismo `upsertJobScheduler` do `nf-capture`. Não inventar scheduler.

- [ ] **Step 4: Verify + commit**
```bash
npx tsc --noEmit && npm test
git add "src/app/api/pedidos/[id]/finalizar/route.ts" src/jobs/fiscal/nfce-retry.job.ts src/jobs/worker.ts src/jobs/fiscal/index.ts
git commit -m "feat(fiscal): auto NFC-e on finalize + retry job"
```

---

## Task 7: UI — config NFC-e, campos de produto, status no caixa

**Files:** Modify config fiscal page, product form, `src/app/[slug]/caixa/page.tsx` (usar `--tf-*`)

- [ ] **Step 1: Config fiscal NFC-e** — adicionar uma aba/seção (admin-only, mirror da aba certificado em `configuracoes/restaurante/page.tsx`): regime (select), inscrição estadual, CSC (input secreto) + idCSC, série, flag `nfceAutomatica` (toggle), padrões NCM/CFOP/CST/origem. POST `/api/fiscal/config-nfce`. CSC nunca exibido de volta.

- [ ] **Step 2: Campos fiscais no formulário de produto** — em `estoque/produtos` (form de criar/editar), uma seção colapsável "Fiscal (opcional)" com NCM/CFOP/CST/origem/unidade. Enviar no PUT/POST de produto (estender o handler/route de produtos para aceitar e persistir esses campos opcionais).

- [ ] **Step 3: Status no caixa** — em `src/app/[slug]/caixa/page.tsx`, após finalizar mostrar o status da NFC-e do pedido (poll `GET /api/fiscal/nfce/status/[pedidoId]`): badge Processando/Autorizada/Rejeitada + link DANFE quando houver + botão "Emitir/Reemitir" (POST `/api/fiscal/nfce/emitir`) quando não autorizada. Estilo do `C` palette já usado no caixa.

- [ ] **Step 4: Verify + commit**
```bash
npx tsc --noEmit && npx next lint
git add ...
git commit -m "feat(fiscal): NFC-e config UI + product fiscal fields + caixa status"
```

---

## Task 8: Env + verificação (mocks) + segurança

**Files:** Modify `.env.example`

- [ ] **Step 1: Env** — adicionar:
```
# NFC-e retry (minutos)
NFCE_RETRY_INTERVAL_MIN=15
```

- [ ] **Step 2: Suíte + tipos + lint + audit**
```bash
npm test
npx tsc --noEmit
npx next lint
npm audit --omit=dev
```
Esperado: verde, 0 erros de tipo/lint, sem vuln nova (sem dependência adicionada).

- [ ] **Step 3: Checklist de vulnerabilidades**
- CSC cifrado em repouso (`crypto.ts`); nunca em log/resposta.
- Config/emitir/cancelar admin (ou MANAGER p/ emitir); status tenant-scoped.
- Idempotência por `pedidoId @unique`; numeração incrementada só em AUTORIZADA.
- Nota LGPD (CPF na nota) anotada para o sub-projeto **G**.

- [ ] **Step 4: Commit**
```bash
git add .env.example
git commit -m "chore(fiscal): NFC-e retry env + security checklist"
```

---

## Task 9: ⚠️ Verificação end-to-end (BLOQUEADA — credenciais)

> NÃO executável sem `FOCUS_NFE_TOKEN` + certificado + **CSC** em homologação.

- [ ] **Step 1:** Configurar token/cert/CSC de homologação; cadastrar config fiscal NFC-e.
- [ ] **Step 2:** Confirmar nomes de campos/rotas reais da Focus para NFC-e (`/v2/nfce`, `chave_nfe`, `caminho_danfe`, `mensagem_sefaz`, formas de pagamento, layout de itens) e ajustar SOMENTE o adapter + `nfce-payload.ts` onde divergir.
- [ ] **Step 3:** Finalizar um pedido de teste e verificar emissão automática autorizada, DANFE/QR, idempotência (não duplica), numeração incrementando, reemissão de rejeição e cancelamento.
- [ ] **Step 4:** Validar regime Simples (CSOSN) e Normal (CST) com produtos reais.

---

## Self-Review

**Cobertura do spec:**
- [x] Modelo de dados (TenantFiscal/Product/NfProcessada/enums) → Task 1
- [x] Adapter NFC-e → Task 2
- [x] Builder de payload override-ou-padrão → Task 3
- [x] Emissão idempotente + numeração → Task 4
- [x] Config CSC cifrado + rotas emitir/cancelar/status → Task 5
- [x] Gatilho automático não-bloqueante + retry → Task 6
- [x] UI (config, produto, caixa) → Task 7
- [x] Segurança/testes/env → Task 8
- [x] E2E bloqueado → Task 9

**Placeholders:** Núcleos testáveis (schema, adapter, payload, emissão) têm código completo. Tasks 5/7 referenciam padrões existentes (admin-guard de `certificado/route.ts`, aba certificado de `restaurante/page.tsx`, palette do caixa) por serem integração em arquivos grandes — pontos de integração explícitos. Itens "confirmar contra sandbox" isolados na Task 9.

**Consistência de tipos:** `NfcePayload`/`NfceResultado` (Task 2) usados em `montarPayloadNfce` (Task 3) e no serviço (Task 4). `emitirNfceParaPedido(pedidoId, provider?)` consumido pelas rotas (Task 5) e gatilho/retry (Task 6). `STATUS_MAP` converte status do adapter para `NfStatus` (`AUTORIZADA`/`REJEITADA`/`PROCESSANDO`/`CANCELADA`) coerente com os enums da Task 1.
