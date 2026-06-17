# Captura fiscal de NF-e (Sub-projeto B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturar automaticamente da SEFAZ (via Focus NFe) as NF-e destinadas ao CNPJ do tenant, arquivá-las na tabela `NfProcessada` estendida, e permitir importá-las ao estoque sob demanda — com o provedor atrás de um adapter.

**Architecture:** `NfProcessada` vira a lista única de NFs (origem SEFAZ + uploads IA). Um adapter `FiscalProvider`/`FocusNfeAdapter` isola a Focus NFe. Um serviço de captura idempotente (por `chaveAcesso`) roda no worker BullMQ + sync manual. Certificado A1 cifrado (`crypto.ts`) + registrado na Focus. Import ao estoque reusa o de-para `enriquecerItens`.

**Tech Stack:** Next.js 14, Prisma 7, TypeScript, BullMQ, Vitest 4, crypto (AES-256-GCM via `src/lib/crypto.ts`), Focus NFe REST.

> **⚠️ Bloqueio externo:** a verificação end-to-end (Task 9) exige `FOCUS_NFE_TOKEN` (sandbox) + certificado de teste. Tasks 1–8 são construídas e testadas com **mocks** e não dependem de credenciais. O mapeamento fino do payload/XML real da Focus se finaliza na Task 9.

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `prisma/schema.prisma` | campos em `NfProcessada`/`TenantFiscal`, enum `NfTipo`, valores `SEFAZ`/`CAPTURADA` + migration |
| `src/services/fiscal/fiscal-provider.types.ts` | criar (interface + tipos) |
| `src/services/fiscal/focus-nfe.adapter.ts` | criar |
| `src/services/fiscal/nf-capture.service.ts` | criar |
| `src/services/fiscal/certificado.service.ts` | criar (cifra + registro) |
| `src/services/fiscal/nf-import.service.ts` | criar (reusa `enriquecerItens`) |
| `src/services/fiscal/__tests__/*.test.ts` | criar |
| `src/app/api/fiscal/certificado/route.ts` | criar (admin) |
| `src/app/api/fiscal/sincronizar/route.ts` | criar (admin) |
| `src/app/api/fiscal/importar/[id]/route.ts` | criar (admin) |
| `src/jobs/fiscal/nf-capture.job.ts` + worker | criar/registrar |
| `src/app/(dashboard)/...` lista fiscal + certificado | criar/editar (`--tf-*`) |

---

## Task 1: Schema — estender `NfProcessada` + `TenantFiscal`

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: Enums**

Em `enum NfOrigem` adicionar `SEFAZ` e `EMISSAO`:
```prisma
enum NfOrigem {
  UPLOAD_IMAGEM
  UPLOAD_PDF
  TEXTO
  SEFAZ
  EMISSAO
}
```
Em `enum NfStatus` adicionar `CAPTURADA`:
```prisma
enum NfStatus {
  PROCESSANDO
  CONCLUIDA
  ERRO
  CAPTURADA
}
```
Adicionar enum novo:
```prisma
enum NfTipo {
  ENTRADA
  SAIDA
}
```

- [ ] **Step 2: Campos em `NfProcessada`**

Tornar `rawResponseIa` nullable e adicionar campos:
```prisma
  rawResponseIa      Json?
  chaveAcesso        String?   @unique
  xml                String?   @db.Text
  modelo             String?
  tipo               NfTipo?
  importadoEstoqueEm DateTime?
```

- [ ] **Step 3: Campos de certificado em `TenantFiscal`**
```prisma
  certificadoCifrado      String?   @db.Text
  certificadoSenhaCifrada String?   @db.Text
  certificadoValidade     DateTime?
  certificadoStatus       String?
  focusEmpresaId          String?
  ultimaSincronizacaoNf   DateTime?
```

- [ ] **Step 4: Migration**

```bash
npx prisma migrate dev --name fiscal_capture_fields
```
Se `migrate dev` não rodar interativo (Prisma 7 + TTY), gere o SQL com `npx prisma migrate diff --from-config-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` não se aplica; em vez disso use o fluxo já validado no projeto: `npx prisma migrate dev` e, se bloquear, criar a pasta de migration manualmente com o SQL aditivo (ADD COLUMN nullable, CREATE UNIQUE INDEX em chaveAcesso, novos enum values via `ALTER TYPE ... ADD VALUE`) e `npx prisma migrate deploy`, depois `npx prisma generate`. Tudo aditivo/nullable → não quebra dados.

- [ ] **Step 5: Verify + Commit**
```bash
npx tsc --noEmit
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): extend NfProcessada + TenantFiscal for fiscal capture"
```

---

## Task 2: Tipos + Adapter Focus NFe (TDD)

**Files:** Create `src/services/fiscal/fiscal-provider.types.ts`, `src/services/fiscal/focus-nfe.adapter.ts`, `src/services/fiscal/__tests__/focus-nfe.adapter.test.ts`

- [ ] **Step 1: Tipos** (`fiscal-provider.types.ts`)
```typescript
export type NotaDestinada = {
  chaveAcesso: string
  numero: string
  emitenteNome: string
  valorTotal: number
  dataEmissao: Date
  modelo: string
}

export interface FiscalProvider {
  registrarEmitente(params: { cnpj: string; certificadoBase64: string; senha: string }): Promise<{ focusEmpresaId: string; validade: Date | null }>
  consultarNotasDestinadas(params: { cnpj: string; desde?: Date }): Promise<NotaDestinada[]>
  baixarXml(chaveAcesso: string): Promise<string>
}
```

- [ ] **Step 2: Teste falhando** (`__tests__/focus-nfe.adapter.test.ts`)
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FocusNfeAdapter } from '../focus-nfe.adapter'

describe('FocusNfeAdapter.consultarNotasDestinadas', () => {
  beforeEach(() => { vi.restoreAllMocks(); process.env.FOCUS_NFE_TOKEN = 'tok'; process.env.FOCUS_NFE_BASE_URL = 'https://homolog.focusnfe.test' })

  it('mapeia a resposta da Focus para NotaDestinada[]', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        { chave_nfe: '352..44d', numero: '123', nome_emitente: 'ACME LTDA', valor_total: '150.50', data_emissao: '2026-06-01', modelo: '55' },
      ]),
    }))
    const adapter = new FocusNfeAdapter()
    const r = await adapter.consultarNotasDestinadas({ cnpj: '11222333000181' })
    expect(r).toHaveLength(1)
    expect(r[0].chaveAcesso).toBe('352..44d')
    expect(r[0].valorTotal).toBe(150.5)
    expect(r[0].modelo).toBe('NFe')
  })

  it('retorna [] quando a Focus responde vazio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ([]) }))
    const adapter = new FocusNfeAdapter()
    expect(await adapter.consultarNotasDestinadas({ cnpj: '11222333000181' })).toEqual([])
  })

  it('lança erro tipado quando a Focus falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'err' }))
    const adapter = new FocusNfeAdapter()
    await expect(adapter.consultarNotasDestinadas({ cnpj: '11222333000181' })).rejects.toThrow()
  })
})
```

- [ ] **Step 3: Rodar e confirmar falha**
```bash
npx vitest run src/services/fiscal/__tests__/focus-nfe.adapter.test.ts
```

- [ ] **Step 4: Implementar `FocusNfeAdapter`** (`focus-nfe.adapter.ts`)
```typescript
import type { FiscalProvider, NotaDestinada } from './fiscal-provider.types'

const MODELO_MAP: Record<string, string> = { '55': 'NFe', '65': 'NFCe' }

function baseUrl(): string {
  return process.env.FOCUS_NFE_BASE_URL ?? 'https://homologacao.focusnfe.com.br'
}
function authHeader(): string {
  const token = process.env.FOCUS_NFE_TOKEN
  if (!token) throw new Error('FOCUS_NFE_TOKEN ausente')
  return 'Basic ' + Buffer.from(`${token}:`).toString('base64')
}

export class FocusNfeAdapter implements FiscalProvider {
  async consultarNotasDestinadas({ cnpj, desde }: { cnpj: string; desde?: Date }): Promise<NotaDestinada[]> {
    const params = new URLSearchParams({ cnpj })
    if (desde) params.set('data_inicial', desde.toISOString().slice(0, 10))
    const res = await fetch(`${baseUrl()}/v2/nfes_recebidas?${params.toString()}`, {
      headers: { Authorization: authHeader() },
    })
    if (!res.ok) throw new Error(`Focus NFe consultarNotasDestinadas falhou: ${res.status}`)
    const arr = (await res.json()) as Array<Record<string, unknown>>
    return arr.map((o) => ({
      chaveAcesso: String(o.chave_nfe ?? ''),
      numero: String(o.numero ?? ''),
      emitenteNome: String(o.nome_emitente ?? ''),
      valorTotal: Number(o.valor_total ?? 0),
      dataEmissao: new Date(String(o.data_emissao ?? Date.now())),
      modelo: MODELO_MAP[String(o.modelo ?? '55')] ?? 'NFe',
    }))
  }

  async baixarXml(chaveAcesso: string): Promise<string> {
    const res = await fetch(`${baseUrl()}/v2/nfes_recebidas/${chaveAcesso}.xml`, {
      headers: { Authorization: authHeader() },
    })
    if (!res.ok) throw new Error(`Focus NFe baixarXml falhou: ${res.status}`)
    return await res.text()
  }

  async registrarEmitente({ cnpj, certificadoBase64, senha }: { cnpj: string; certificadoBase64: string; senha: string }): Promise<{ focusEmpresaId: string; validade: Date | null }> {
    const res = await fetch(`${baseUrl()}/v2/empresas`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ cnpj, arquivo_certificado_base64: certificadoBase64, senha_certificado: senha }),
    })
    if (!res.ok) throw new Error(`Focus NFe registrarEmitente falhou: ${res.status}`)
    const o = (await res.json()) as Record<string, unknown>
    return {
      focusEmpresaId: String(o.id ?? cnpj),
      validade: o.certificado_valido_ate ? new Date(String(o.certificado_valido_ate)) : null,
    }
  }
}
```
> Nota (Task 9): os nomes de campo/rotas da Focus (`nfes_recebidas`, `chave_nfe`, etc.) devem ser confirmados contra a doc/sandbox real; o adapter centraliza esse mapeamento, então ajustes ficam isolados aqui.

- [ ] **Step 5: Rodar verde + Commit**
```bash
npx vitest run src/services/fiscal/__tests__/focus-nfe.adapter.test.ts
git add src/services/fiscal/fiscal-provider.types.ts src/services/fiscal/focus-nfe.adapter.ts src/services/fiscal/__tests__/focus-nfe.adapter.test.ts
git commit -m "feat(fiscal): Focus NFe adapter (consulta destinadas, xml, emitente)"
```

---

## Task 3: Serviço de captura idempotente (TDD)

**Files:** Create `src/services/fiscal/nf-capture.service.ts`, `src/services/fiscal/__tests__/nf-capture.service.test.ts`

- [ ] **Step 1: Teste falhando** — mocka prisma + um `FiscalProvider` fake:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenantFiscal: { findUnique: vi.fn(), update: vi.fn() },
    nfProcessada: { findUnique: vi.fn(), create: vi.fn() },
  },
}))

import { sincronizarNotasDestinadas } from '../nf-capture.service'
import { prisma } from '@/lib/prisma'

const mp = prisma as any

const fakeProvider = {
  consultarNotasDestinadas: vi.fn(),
  baixarXml: vi.fn(),
  registrarEmitente: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  mp.tenantFiscal.findUnique.mockResolvedValue({ tenantId: 't1', focusEmpresaId: 'e1', ultimaSincronizacaoNf: null, tenant: { cnpj: '11222333000181' } })
  mp.tenantFiscal.update.mockResolvedValue({})
  fakeProvider.baixarXml.mockResolvedValue('<xml/>')
})

it('cria NfProcessada só para chaves novas (idempotência)', async () => {
  fakeProvider.consultarNotasDestinadas.mockResolvedValue([
    { chaveAcesso: 'A', numero: '1', emitenteNome: 'X', valorTotal: 10, dataEmissao: new Date(), modelo: 'NFe' },
    { chaveAcesso: 'B', numero: '2', emitenteNome: 'Y', valorTotal: 20, dataEmissao: new Date(), modelo: 'NFe' },
  ])
  mp.nfProcessada.findUnique.mockImplementation(({ where }: any) => where.chaveAcesso === 'A' ? { id: 'existing' } : null)
  mp.nfProcessada.create.mockResolvedValue({})

  const n = await sincronizarNotasDestinadas('t1', fakeProvider as any)

  expect(n).toBe(1) // só 'B' é nova
  expect(mp.nfProcessada.create).toHaveBeenCalledTimes(1)
  expect(mp.nfProcessada.create).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ chaveAcesso: 'B', origem: 'SEFAZ', tipo: 'ENTRADA', status: 'CAPTURADA' }),
  }))
  expect(mp.tenantFiscal.update).toHaveBeenCalled()
})

it('não faz nada sem focusEmpresaId', async () => {
  mp.tenantFiscal.findUnique.mockResolvedValue({ tenantId: 't1', focusEmpresaId: null, tenant: { cnpj: '1' } })
  const n = await sincronizarNotasDestinadas('t1', fakeProvider as any)
  expect(n).toBe(0)
  expect(fakeProvider.consultarNotasDestinadas).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Rodar e confirmar falha**
```bash
npx vitest run src/services/fiscal/__tests__/nf-capture.service.test.ts
```

- [ ] **Step 3: Implementar** (`nf-capture.service.ts`) — injeta o provider (default `FocusNfeAdapter`) para testabilidade:
```typescript
import { prisma } from '@/lib/prisma'
import { FocusNfeAdapter } from './focus-nfe.adapter'
import type { FiscalProvider } from './fiscal-provider.types'

export async function sincronizarNotasDestinadas(
  tenantId: string,
  provider: FiscalProvider = new FocusNfeAdapter(),
): Promise<number> {
  const fiscal = await prisma.tenantFiscal.findUnique({
    where: { tenantId },
    include: { tenant: { select: { cnpj: true } } },
  })
  if (!fiscal?.focusEmpresaId || !fiscal.tenant?.cnpj) return 0

  const notas = await provider.consultarNotasDestinadas({
    cnpj: fiscal.tenant.cnpj,
    desde: fiscal.ultimaSincronizacaoNf ?? undefined,
  })

  let criadas = 0
  for (const nota of notas) {
    const existe = await prisma.nfProcessada.findUnique({ where: { chaveAcesso: nota.chaveAcesso } })
    if (existe) continue
    const xml = await provider.baixarXml(nota.chaveAcesso)
    await prisma.nfProcessada.create({
      data: {
        tenantId,
        origem: 'SEFAZ',
        tipo: 'ENTRADA',
        status: 'CAPTURADA',
        chaveAcesso: nota.chaveAcesso,
        numeroNf: nota.numero,
        fornecedorNome: nota.emitenteNome,
        valorTotal: nota.valorTotal,
        dataEmissao: nota.dataEmissao,
        modelo: nota.modelo,
        xml,
        processadoPor: 'sefaz',
      },
    })
    criadas++
  }

  await prisma.tenantFiscal.update({ where: { tenantId }, data: { ultimaSincronizacaoNf: new Date() } })
  return criadas
}
```
> Nota: `processadoPor` é `String` obrigatório no modelo atual; usamos `'sefaz'`. Confirmar que `valorTotal` (Decimal) aceita `number` no create (Prisma converte) — se reclamar, usar `new Prisma.Decimal(nota.valorTotal)`.

- [ ] **Step 4: Rodar verde + tsc + Commit**
```bash
npx vitest run src/services/fiscal/__tests__/nf-capture.service.test.ts
npx tsc --noEmit
git add src/services/fiscal/nf-capture.service.ts src/services/fiscal/__tests__/nf-capture.service.test.ts
git commit -m "feat(fiscal): idempotent SEFAZ capture service"
```

---

## Task 4: Serviço de certificado (cifra + registro) (TDD)

**Files:** Create `src/services/fiscal/certificado.service.ts`, `src/services/fiscal/__tests__/certificado.service.test.ts`

- [ ] **Step 1: Teste** — round-trip de cifra e que o segredo é registrado/persistido cifrado:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: { tenantFiscal: { upsert: vi.fn() } } }))

import { salvarCertificado } from '../certificado.service'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'

const mp = prisma as any
const fakeProvider = { registrarEmitente: vi.fn(), consultarNotasDestinadas: vi.fn(), baixarXml: vi.fn() }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ENCRYPTION_KEY = 'a'.repeat(64)
  fakeProvider.registrarEmitente.mockResolvedValue({ focusEmpresaId: 'e1', validade: new Date('2027-01-01') })
  mp.tenantFiscal.upsert.mockResolvedValue({})
})

it('cifra o certificado/senha e registra o emitente', async () => {
  await salvarCertificado('t1', '11222333000181', 'BASE64PFX', 'senha123', fakeProvider as any)
  expect(fakeProvider.registrarEmitente).toHaveBeenCalledWith({ cnpj: '11222333000181', certificadoBase64: 'BASE64PFX', senha: 'senha123' })
  const arg = mp.tenantFiscal.upsert.mock.calls[0][0]
  const stored = arg.update
  // valores persistidos estão cifrados (não em texto plano) e decifram de volta
  expect(stored.certificadoCifrado).not.toBe('BASE64PFX')
  expect(decrypt(stored.certificadoCifrado)).toBe('BASE64PFX')
  expect(decrypt(stored.certificadoSenhaCifrada)).toBe('senha123')
  expect(stored.focusEmpresaId).toBe('e1')
  expect(stored.certificadoStatus).toBe('ATIVO')
})
```

- [ ] **Step 2: Rodar e confirmar falha**
```bash
npx vitest run src/services/fiscal/__tests__/certificado.service.test.ts
```

- [ ] **Step 3: Implementar** (`certificado.service.ts`)
```typescript
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { FocusNfeAdapter } from './focus-nfe.adapter'
import type { FiscalProvider } from './fiscal-provider.types'

export async function salvarCertificado(
  tenantId: string,
  cnpj: string,
  certificadoBase64: string,
  senha: string,
  provider: FiscalProvider = new FocusNfeAdapter(),
): Promise<{ validade: Date | null }> {
  const { focusEmpresaId, validade } = await provider.registrarEmitente({ cnpj, certificadoBase64, senha })

  const data = {
    certificadoCifrado: encrypt(certificadoBase64),
    certificadoSenhaCifrada: encrypt(senha),
    certificadoValidade: validade,
    certificadoStatus: 'ATIVO',
    focusEmpresaId,
  }
  await prisma.tenantFiscal.upsert({
    where: { tenantId },
    create: { tenantId, ...data },
    update: data,
  })
  return { validade }
}
```

- [ ] **Step 4: Rodar verde + tsc + Commit**
```bash
npx vitest run src/services/fiscal/__tests__/certificado.service.test.ts
npx tsc --noEmit
git add src/services/fiscal/certificado.service.ts src/services/fiscal/__tests__/certificado.service.test.ts
git commit -m "feat(fiscal): certificate service (encrypt at rest + register emitente)"
```

---

## Task 5: Rotas admin (certificado + sincronizar) + job agendado

**Files:** Create `src/app/api/fiscal/certificado/route.ts`, `src/app/api/fiscal/sincronizar/route.ts`, `src/jobs/fiscal/nf-capture.job.ts`; modify the worker registration.

- [ ] **Step 1: `certificado/route.ts`** (admin-only)
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { salvarCertificado } from '@/services/fiscal/certificado.service'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const { certificadoBase64, senha } = await req.json()
  if (!certificadoBase64 || !senha) return NextResponse.json({ error: 'Certificado e senha são obrigatórios' }, { status: 400 })

  const tenant = await prisma.tenant.findUnique({ where: { id: session.user.tenantId }, select: { cnpj: true } })
  if (!tenant?.cnpj) return NextResponse.json({ error: 'Cadastre o CNPJ da empresa antes do certificado.' }, { status: 400 })

  try {
    const { validade } = await salvarCertificado(session.user.tenantId, tenant.cnpj, certificadoBase64, senha)
    return NextResponse.json({ ok: true, validade })
  } catch (err) {
    console.error('[fiscal-certificado]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Falha ao registrar o certificado na Receita/Focus.' }, { status: 502 })
  }
}
```
> Nunca logar `senha`/`certificadoBase64`.

- [ ] **Step 2: `sincronizar/route.ts`** (admin-only)
```typescript
import { NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { sincronizarNotasDestinadas } from '@/services/fiscal/nf-capture.service'

export async function POST() {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  try {
    const criadas = await sincronizarNotasDestinadas(session.user.tenantId)
    return NextResponse.json({ ok: true, capturadas: criadas })
  } catch (err) {
    console.error('[fiscal-sincronizar]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Falha na sincronização.' }, { status: 502 })
  }
}
```

- [ ] **Step 3: Job agendado** (`src/jobs/fiscal/nf-capture.job.ts`) — espelha o padrão do `ifood-catalog-sync.job.ts`:
```typescript
import { prisma } from '@/lib/prisma'
import { sincronizarNotasDestinadas } from '@/services/fiscal/nf-capture.service'

export async function processNfCaptureJob(): Promise<void> {
  const fiscais = await prisma.tenantFiscal.findMany({
    where: { focusEmpresaId: { not: null }, certificadoStatus: 'ATIVO' },
    select: { tenantId: true },
  })
  for (const { tenantId } of fiscais) {
    try {
      const n = await sincronizarNotasDestinadas(tenantId)
      console.log(`[nf-capture] tenant ${tenantId}: ${n} nota(s) capturada(s)`)
    } catch (err) {
      console.error(`[nf-capture] erro tenant ${tenantId}:`, err instanceof Error ? err.message : err)
    }
  }
}
```

- [ ] **Step 4: Registrar no worker** — READ `src/jobs/worker.ts` e os `index.ts` de jobs existentes (ex. `src/jobs/ifood/index.ts`) e registrar o `processNfCaptureJob` num schedule recorrente (padrão a cada 6h, via env `NF_CAPTURE_INTERVAL_HOURS` com default 6). Seguir exatamente o mecanismo de agendamento já usado (BullMQ repeatable job). Não inventar um novo scheduler.

- [ ] **Step 5: Verify + Commit**
```bash
npx tsc --noEmit
npm test
git add src/app/api/fiscal/ src/jobs/fiscal/ src/jobs/worker.ts
git commit -m "feat(fiscal): admin certificate/sync routes + scheduled capture job"
```

---

## Task 6: Import ao estoque sob demanda (TDD)

**Files:** Create `src/services/fiscal/nf-import.service.ts`, `src/services/fiscal/__tests__/nf-import.service.test.ts`, `src/app/api/fiscal/importar/[id]/route.ts`

- [ ] **Step 1: Teste do de-para a partir do XML** — o serviço extrai itens do XML e reusa `enriquecerItens`. Mocka `enriquecerItens` e prisma:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/ai/nf-processor.service', () => ({ enriquecerItens: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { nfProcessada: { findFirst: vi.fn() } } }))

import { prepararImportacao } from '../nf-import.service'
import { enriquecerItens } from '@/services/ai/nf-processor.service'
import { prisma } from '@/lib/prisma'

const mp = prisma as any

beforeEach(() => {
  vi.clearAllMocks()
  mp.nfProcessada.findFirst.mockResolvedValue({
    id: 'nf1', tenantId: 't1',
    xml: '<nfeProc><NFe><infNFe><det><prod><xProd>ARROZ TIPO 1</xProd><qCom>10</qCom><uCom>KG</uCom><vUnCom>5.00</vUnCom></prod></det></infNFe></NFe></nfeProc>',
  })
  ;(enriquecerItens as any).mockResolvedValue([{ descricao: 'ARROZ TIPO 1', quantidade: 10, unidade: 'KG', custoUnitario: 5, insumoId: 'ing1', insumoNome: 'Arroz', scoreConfianca: 95 }])
})

it('extrai itens do XML e devolve o de-para enriquecido', async () => {
  const r = await prepararImportacao('t1', 'nf1')
  expect(enriquecerItens).toHaveBeenCalledWith('t1', expect.arrayContaining([
    expect.objectContaining({ descricao: 'ARROZ TIPO 1', quantidade: 10, unidade: 'KG' }),
  ]))
  expect(r.itens[0].insumoId).toBe('ing1')
})
```

- [ ] **Step 2: Rodar e confirmar falha**
```bash
npx vitest run src/services/fiscal/__tests__/nf-import.service.test.ts
```

- [ ] **Step 3: Implementar `prepararImportacao`** — parse mínimo do XML NF-e (sem nova dependência: usar regex/`DOMParser` não está disponível no Node; usar um parse simples por regex dos blocos `<det>...<prod>`):
```typescript
import { prisma } from '@/lib/prisma'
import { enriquecerItens } from '@/services/ai/nf-processor.service'
import type { ItemExtraido } from '@/services/ai/types'

const UNIDADES = ['KG', 'G', 'L', 'ML', 'UN']
function mapUnidade(u: string): string {
  const up = u.toUpperCase()
  return UNIDADES.includes(up) ? up : 'UN'
}

export function parseItensNfe(xml: string): ItemExtraido[] {
  const itens: ItemExtraido[] = []
  const prodBlocks = xml.match(/<prod>[\s\S]*?<\/prod>/g) ?? []
  for (const block of prodBlocks) {
    const get = (tag: string) => block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1] ?? ''
    const quantidade = Number(get('qCom') || 0)
    const custoUnitario = Number(get('vUnCom') || 0)
    itens.push({
      descricao: get('xProd'),
      quantidade,
      unidade: mapUnidade(get('uCom')),
      custoUnitario,
      custoTotal: Math.round(quantidade * custoUnitario * 100) / 100,
    })
  }
  return itens
}

export async function prepararImportacao(tenantId: string, nfId: string) {
  const nf = await prisma.nfProcessada.findFirst({ where: { id: nfId, tenantId } })
  if (!nf?.xml) throw new Error('NF sem XML para importar')
  const itens = parseItensNfe(nf.xml)
  const enriquecidos = await enriquecerItens(tenantId, itens)
  return { nfId, itens: enriquecidos }
}
```
> Confirmar a forma de `ItemExtraido` em `src/services/ai/types.ts` e ajustar os campos (descricao/quantidade/unidade/custoUnitario/custoTotal) para baterem exatamente.

- [ ] **Step 4: Rota de confirmação** (`importar/[id]/route.ts`, admin) — GET devolve `prepararImportacao` (de-para para a tela de confirmação); POST recebe o de-para confirmado (`[{ insumoId, quantidade, custoUnitario }]`) e aplica movimentações reusando o mesmo mecanismo de entrada de estoque do fluxo de upload (READ a rota/job que hoje aplica `IngredientMovement` no fluxo IA e reusar a mesma função; se estiver inline, extrair para `nf-import.service` uma função `aplicarEntradaEstoque(tenantId, itensConfirmados)`), e ao final marcar `importadoEstoqueEm` + `status='CONCLUIDA'`. Mantém tudo dentro de uma transação prisma.

- [ ] **Step 5: Verify + Commit**
```bash
npx vitest run src/services/fiscal/__tests__/nf-import.service.test.ts
npx tsc --noEmit && npm test
git add src/services/fiscal/nf-import.service.ts src/services/fiscal/__tests__/nf-import.service.test.ts src/app/api/fiscal/importar
git commit -m "feat(fiscal): on-demand NF stock import (reuse de-para)"
```

---

## Task 7: UI — lista fiscal + onboarding do certificado

**Files:** Create/modify under `src/app/(dashboard)/` (usar tokens `--tf-*`, seguir padrão das páginas existentes)

- [ ] **Step 1: Página/seção da lista fiscal** — uma página (ex. `src/app/(dashboard)/fiscal/notas/page.tsx`) listando `NfProcessada` (origem SEFAZ + uploads), com colunas: data, fornecedor, número, valor, origem, status; botões "Sincronizar agora" (POST `/api/fiscal/sincronizar`) e "Importar para estoque" (abre confirmação do de-para via GET `/api/fiscal/importar/[id]`, confirma via POST). Estilo `--tf-*`, `toast` para feedback. Precisa de uma rota GET que liste as NFs do tenant (criar `GET /api/fiscal/notas` se não existir).

- [ ] **Step 2: Seção de certificado** — em Configurações fiscais (admin-only, mesmo padrão da aba CNPJ do sub-projeto A): input de arquivo `.pfx` (ler como base64 no client) + senha → POST `/api/fiscal/certificado`; exibe status/validade; nunca exibe o segredo. Esconder a seção/abas para não-admin (como feito na aba CNPJ).

- [ ] **Step 3: Verify + Commit**
```bash
npx tsc --noEmit && npx next lint
git add "src/app/(dashboard)/fiscal" src/app/api/fiscal/notas
git commit -m "feat(fiscal): NF list + certificate onboarding UI"
```

---

## Task 8: Env + verificação local (mocks) + segurança

**Files:** Modify `.env.example`

- [ ] **Step 1: Documentar env** em `.env.example`:
```
# Focus NFe (sandbox: https://homologacao.focusnfe.com.br)
FOCUS_NFE_TOKEN=
FOCUS_NFE_BASE_URL=https://homologacao.focusnfe.com.br
NF_CAPTURE_INTERVAL_HOURS=6
```

- [ ] **Step 2: Suíte + tipos + lint + audit**
```bash
npm test
npx tsc --noEmit
npx next lint
npm audit --omit=dev
```
Esperado: testes verdes, 0 erros de tipo/lint; `npm audit` sem vulnerabilidade NOVA introduzida (não adicionamos dependência — parse por regex, `fetch` nativo).

- [ ] **Step 3: Checklist de vulnerabilidades (revisão manual)**
- Certificado/senha **cifrados** em repouso (`crypto.ts`); nunca em log/resposta.
- Rotas `certificado`, `sincronizar`, `importar` **admin-only**.
- `FOCUS_NFE_TOKEN` em env, não no código.
- Captura **idempotente** (`chaveAcesso @unique`) → sem estoque duplicado.
- Import em transação; `importadoEstoqueEm` evita reimport.
- Nota LGPD do certificado anotada para o sub-projeto **G**.

- [ ] **Step 4: Commit**
```bash
git add .env.example
git commit -m "chore(fiscal): document Focus NFe env + capture interval"
```

---

## Task 9: ⚠️ Verificação end-to-end (BLOQUEADA — requer credenciais)

> **NÃO executável sem `FOCUS_NFE_TOKEN` (sandbox) + certificado A1 de teste.** Deixar pendente até o usuário fornecer.

- [ ] **Step 1:** Configurar `FOCUS_NFE_TOKEN`/`FOCUS_NFE_BASE_URL` (homologação) no `.env` e subir um certificado A1 de teste via a UI.
- [ ] **Step 2:** Confirmar contra a doc/sandbox da Focus os nomes reais de rotas/campos usados no `focus-nfe.adapter.ts` (`nfes_recebidas`, `chave_nfe`, `valor_total`, `data_emissao`, `modelo`, `arquivo_certificado_base64`, etc.) e ajustar SOMENTE o adapter onde divergir.
- [ ] **Step 3:** Rodar "Sincronizar agora" e verificar que NF-e de homologação são capturadas (idempotentes), aparecem na lista, e o de-para + import ao estoque funciona com XML real.
- [ ] **Step 4:** Ajustar o parse de itens (`parseItensNfe`) ao layout real do XML de NF-e (campos `det/prod`), se necessário.

---

## Self-Review

**Cobertura do spec:**
- [x] Modelo unificado (`NfProcessada` + `TenantFiscal`) → Task 1
- [x] Adapter Focus NFe + tipos → Task 2
- [x] Captura idempotente agendada + manual → Tasks 3, 5
- [x] Onboarding certificado cifrado + registro → Tasks 4, 5
- [x] Import sob demanda com de-para → Task 6
- [x] UI lista + certificado → Task 7
- [x] Segurança/testes/audit → Tasks 2–8
- [x] Verificação end-to-end (bloqueada) → Task 9

**Placeholders:** Núcleos testáveis (schema, adapter, captura, certificado, import) têm código completo. Tasks 5/7 referenciam padrões existentes (worker BullMQ, páginas `--tf-*`) por serem integração em arquivos grandes — pontos de integração descritos explicitamente. Itens marcados "confirmar contra sandbox" são exclusivos da Task 9 (bloqueada) e isolados no adapter.

**Consistência de tipos:** `FiscalProvider`/`NotaDestinada` usados igualmente em adapter, captura (injeção do provider), certificado e job. `sincronizarNotasDestinadas(tenantId, provider?)` e `salvarCertificado(tenantId, cnpj, base64, senha, provider?)` com a mesma injeção testável. `NfProcessada` create usa `origem='SEFAZ'`, `tipo='ENTRADA'`, `status='CAPTURADA'` — coerentes com os enums da Task 1.
