# AI Infrastructure & NF Processor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-powered invoice (Nota Fiscal) processing + stock chat assistant + monthly token usage control to THE FINANCE.

**Architecture:** Multipart/JSON upload → Cloudinary storage + BullMQ async job → Anthropic Claude extracts NF items → enrich with Levenshtein fuzzy match against existing `Ingredient` records → user reviews in editable table → confirm batch stock entry (`IngredientMovement`). Chat assistant uses SSE streaming. All usage is tracked per tenant with monthly limits.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma + PostgreSQL, BullMQ + Redis, Socket.IO, Cloudinary, `@anthropic-ai/sdk`, `fast-levenshtein`, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-31-ai-nf-processor-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add NfProcessada, ChatMessage, AiUsage, AiUsageHistory + enums |
| `src/services/ai/types.ts` | Create | Shared TS types for AI services |
| `src/services/ai/ai-usage.service.ts` | Create | Token usage CRUD + monthly reset |
| `src/lib/middleware/ai-limit.middleware.ts` | Create | Check limit, create alert at 80% |
| `src/lib/cloudinary.ts` | Create | Cloudinary upload helper (singleton config) |
| `src/lib/queues.ts` | Create | BullMQ Queue singletons for API routes |
| `src/services/ai/nf-processor.service.ts` | Create | Cloudinary upload, Anthropic extraction, Levenshtein enrichment |
| `src/services/ai/estoque-chat.service.ts` | Create | Stock context builder + streaming chat |
| `src/jobs/ai/nf-processor.job.ts` | Create | BullMQ worker handler for NF processing |
| `src/jobs/ai/ai-usage-reset.job.ts` | Create | Monthly usage reset handler |
| `src/jobs/ai/index.ts` | Create | startAiWorkers() — registers queues + workers |
| `server.ts` | Modify | Call startAiWorkers(io) when Redis is available |
| `src/app/api/ai/processar-nf/route.ts` | Create | POST: upload + create NfProcessada + enqueue job |
| `src/app/api/ai/nf-status/[nfId]/route.ts` | Create | GET: poll NF processing status |
| `src/app/api/ai/chat-estoque/route.ts` | Create | GET SSE: streaming chat responses |
| `src/app/api/estoque/entrada-lote/route.ts` | Create | POST: confirm batch stock entries |
| `src/services/ai/__tests__/ai-usage.service.test.ts` | Create | Unit tests for AiUsage service |
| `src/services/ai/__tests__/nf-processor.service.test.ts` | Create | Unit tests for enriquecerItens |
| `src/lib/middleware/__tests__/ai-limit.middleware.test.ts` | Create | Unit tests for checkAiLimit |
| `src/app/(app)/estoque/entrada-inteligente/page.tsx` | Create | Upload + review page |
| `src/app/(app)/estoque/entrada-inteligente/components/TabelaRevisaoNF.tsx` | Create | Editable NF review table |
| `src/app/(app)/estoque/notas-fiscais/page.tsx` | Create | NF history listing |
| `src/app/(app)/estoque/components/ChatEstoque.tsx` | Create | Floating chat drawer |

---

## Task 1: Install Dependencies and Environment Variables

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `.env` (add new vars)

- [ ] **Step 1: Install runtime packages**

```bash
npm install @anthropic-ai/sdk cloudinary fast-levenshtein
npm install -D @types/fast-levenshtein
```

Expected: packages appear in `package.json` dependencies.

- [ ] **Step 2: Add environment variables**

Add the following to `.env` (fill in real values; never commit secrets):

```env
# Anthropic AI
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514
AI_MAX_TOKENS_PER_REQUEST=2000
AI_DEFAULT_MONTHLY_LIMIT_PRO=500000
AI_DEFAULT_MONTHLY_LIMIT_ENTERPRISE=0

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json .env
git commit -m "chore: install anthropic sdk, cloudinary, fast-levenshtein"
```

---

## Task 2: Prisma Schema — Add AI Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new enums and models to schema.prisma**

Append to the end of `prisma/schema.prisma` (before the closing of the file):

```prisma
// ── AI / NF Processing ────────────────────────────────────────────────────────

enum NfOrigem {
  UPLOAD_IMAGEM
  UPLOAD_PDF
  TEXTO
}

enum NfStatus {
  PROCESSANDO
  CONCLUIDA
  ERRO
}

enum ChatRole {
  USER
  ASSISTANT
}

model NfProcessada {
  id             String    @id @default(cuid())
  tenantId       String
  origem         NfOrigem
  cloudinaryUrl  String?
  numeroNf       String?
  fornecedorNome String?
  dataEmissao    DateTime?
  valorTotal     Decimal?
  status         NfStatus
  rawResponseIa  Json
  itensCriados   Int       @default(0)
  processadoPor  String
  createdAt      DateTime  @default(now())
  tenant         Tenant    @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@index([tenantId, status])
}

model ChatMessage {
  id           String   @id @default(cuid())
  tenantId     String
  userId       String
  role         ChatRole
  content      String
  tokensUsados Int
  createdAt    DateTime @default(now())
  tenant       Tenant   @relation(fields: [tenantId], references: [id])
  user         User     @relation(fields: [userId], references: [id])

  @@index([tenantId, userId])
}

model AiUsage {
  id            String   @id @default(cuid())
  tenantId      String   @unique
  mes           Int
  ano           Int
  tokensInput   Int      @default(0)
  tokensOutput  Int      @default(0)
  custoEstimado Decimal  @default(0)
  limiteTokens  Int
  updatedAt     DateTime @updatedAt
  tenant        Tenant   @relation(fields: [tenantId], references: [id])
}

model AiUsageHistory {
  id            String   @id @default(cuid())
  tenantId      String
  mes           Int
  ano           Int
  tokensInput   Int
  tokensOutput  Int
  custoEstimado Decimal
  registradoEm  DateTime @default(now())
  tenant        Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
}
```

- [ ] **Step 2: Add back-references to Tenant model**

In `prisma/schema.prisma`, find the `Tenant` model and add these relations inside it (after the existing `alerts` and `alertConfigs` lines):

```prisma
  nfsProcessadas   NfProcessada[]
  chatMessages     ChatMessage[]
  aiUsage          AiUsage?
  aiUsageHistory   AiUsageHistory[]
```

- [ ] **Step 3: Add back-reference to User model**

In the `User` model, add after the existing relation lines:

```prisma
  chatMessages  ChatMessage[]
```

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name add-ai-models
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 5: Verify Prisma client generated correctly**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` with no errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/
git commit -m "feat(db): add NfProcessada, ChatMessage, AiUsage, AiUsageHistory models"
```

---

## Task 3: Shared Types + AiUsage Service (TDD)

**Files:**
- Create: `src/services/ai/types.ts`
- Create: `src/services/ai/ai-usage.service.ts`
- Create: `src/services/ai/__tests__/ai-usage.service.test.ts`

- [ ] **Step 1: Create shared types**

Create `src/services/ai/types.ts`:

```typescript
export interface ItemExtraido {
  descricao: string
  quantidade: number
  unidade: string
  custoUnitario: number
  custoTotal: number
}

export interface ItemEnriquecido extends ItemExtraido {
  insumoId: string | null
  insumoNome: string | null
  scoreConfianca: number
}

export interface NfExtraidaData {
  fornecedor: string | null
  numeroNf: string | null
  dataEmissao: string | null
  valorTotal: number | null
  itens: ItemExtraido[]
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/services/ai/__tests__/ai-usage.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    aiUsage: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    aiUsageHistory: {
      createMany: vi.fn(),
    },
    tenantSubscription: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

import { prisma } from '@/lib/prisma'
import { verificarLimite, incrementarUso, resetarUsoMensal } from '../ai-usage.service'

const p = prisma as {
  aiUsage: Record<string, ReturnType<typeof vi.fn>>
  aiUsageHistory: Record<string, ReturnType<typeof vi.fn>>
  tenantSubscription: Record<string, ReturnType<typeof vi.fn>>
  $transaction: ReturnType<typeof vi.fn>
}

beforeEach(() => { vi.clearAllMocks() })

describe('verificarLimite', () => {
  it('returns permitido:true and 0% when no usage record exists', async () => {
    p.aiUsage.findUnique.mockResolvedValue(null)
    expect(await verificarLimite('t-1')).toEqual({ permitido: true, percentual: 0 })
  })

  it('returns permitido:true for enterprise when limiteTokens is 0', async () => {
    p.aiUsage.findUnique.mockResolvedValue({ limiteTokens: 0, tokensInput: 999999, tokensOutput: 0 })
    expect(await verificarLimite('t-1')).toEqual({ permitido: true, percentual: 0 })
  })

  it('returns permitido:false when total tokens exceed limit', async () => {
    p.aiUsage.findUnique.mockResolvedValue({ limiteTokens: 100, tokensInput: 60, tokensOutput: 50 })
    const result = await verificarLimite('t-1')
    expect(result.permitido).toBe(false)
    expect(result.percentual).toBe(100)
  })

  it('calculates 80% correctly', async () => {
    p.aiUsage.findUnique.mockResolvedValue({ limiteTokens: 100, tokensInput: 50, tokensOutput: 30 })
    const result = await verificarLimite('t-1')
    expect(result.permitido).toBe(true)
    expect(result.percentual).toBe(80)
  })
})

describe('incrementarUso', () => {
  it('creates new record when none exists, using default PRO limit', async () => {
    p.aiUsage.findUnique.mockResolvedValue(null)
    p.tenantSubscription.findUnique.mockResolvedValue(null)
    p.aiUsage.create.mockResolvedValue({})

    await incrementarUso('t-1', 1000, 500)

    expect(p.aiUsage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tokensInput: 1000,
          tokensOutput: 500,
          limiteTokens: 500000,
        }),
      })
    )
  })

  it('accumulates tokens on existing record', async () => {
    p.aiUsage.findUnique.mockResolvedValue({ tokensInput: 200, tokensOutput: 100 })
    p.aiUsage.update.mockResolvedValue({})

    await incrementarUso('t-1', 100, 50)

    expect(p.aiUsage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tokensInput: 300, tokensOutput: 150 }),
      })
    )
  })
})

describe('resetarUsoMensal', () => {
  it('does nothing when there are no usage records', async () => {
    p.aiUsage.findMany.mockResolvedValue([])
    await resetarUsoMensal()
    expect(p.$transaction).not.toHaveBeenCalled()
  })

  it('snapshots history and zeros all records', async () => {
    p.aiUsage.findMany.mockResolvedValue([
      { tenantId: 't-1', mes: 5, ano: 2026, tokensInput: 1000, tokensOutput: 500, custoEstimado: 0.01 },
    ])
    p.$transaction.mockResolvedValue([])

    await resetarUsoMensal()

    expect(p.$transaction).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx vitest run src/services/ai/__tests__/ai-usage.service.test.ts
```

Expected: all tests FAIL with "Cannot find module '../ai-usage.service'"

- [ ] **Step 4: Implement AiUsage service**

Create `src/services/ai/ai-usage.service.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import type { AiUsage } from '@prisma/client'

const COST_INPUT_PER_M = 3
const COST_OUTPUT_PER_M = 15

function calcularCusto(tokensInput: number, tokensOutput: number): number {
  return (tokensInput / 1_000_000) * COST_INPUT_PER_M + (tokensOutput / 1_000_000) * COST_OUTPUT_PER_M
}

async function getLimiteForTenant(tenantId: string): Promise<number> {
  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  })
  const isEnterprise = sub?.plan.name?.toLowerCase().includes('enterprise') ?? false
  if (isEnterprise) return parseInt(process.env.AI_DEFAULT_MONTHLY_LIMIT_ENTERPRISE ?? '0')
  return parseInt(process.env.AI_DEFAULT_MONTHLY_LIMIT_PRO ?? '500000')
}

export async function verificarLimite(
  tenantId: string
): Promise<{ permitido: boolean; percentual: number }> {
  const usage = await prisma.aiUsage.findUnique({ where: { tenantId } })
  if (!usage) return { permitido: true, percentual: 0 }
  if (usage.limiteTokens === 0) return { permitido: true, percentual: 0 }

  const totalUsed = usage.tokensInput + usage.tokensOutput
  const percentual = Math.min(Math.round((totalUsed / usage.limiteTokens) * 100), 100)
  return { permitido: totalUsed < usage.limiteTokens, percentual }
}

export async function incrementarUso(
  tenantId: string,
  tokensInput: number,
  tokensOutput: number
): Promise<void> {
  const now = new Date()
  const mes = now.getMonth() + 1
  const ano = now.getFullYear()

  const existing = await prisma.aiUsage.findUnique({ where: { tenantId } })

  if (!existing) {
    const limiteTokens = await getLimiteForTenant(tenantId)
    await prisma.aiUsage.create({
      data: {
        tenantId,
        mes,
        ano,
        tokensInput,
        tokensOutput,
        custoEstimado: calcularCusto(tokensInput, tokensOutput),
        limiteTokens,
      },
    })
    return
  }

  const newInput = existing.tokensInput + tokensInput
  const newOutput = existing.tokensOutput + tokensOutput
  await prisma.aiUsage.update({
    where: { tenantId },
    data: {
      tokensInput: newInput,
      tokensOutput: newOutput,
      custoEstimado: calcularCusto(newInput, newOutput),
    },
  })
}

export async function resetarUsoMensal(): Promise<void> {
  const now = new Date()
  const mes = now.getMonth() + 1
  const ano = now.getFullYear()

  const all = await prisma.aiUsage.findMany()
  if (all.length === 0) return

  await prisma.$transaction([
    prisma.aiUsageHistory.createMany({
      data: all.map((u) => ({
        tenantId: u.tenantId,
        mes: u.mes,
        ano: u.ano,
        tokensInput: u.tokensInput,
        tokensOutput: u.tokensOutput,
        custoEstimado: u.custoEstimado,
      })),
    }),
    prisma.aiUsage.updateMany({
      data: { tokensInput: 0, tokensOutput: 0, custoEstimado: 0, mes, ano },
    }),
  ])
}

export async function buscarUso(tenantId: string): Promise<AiUsage | null> {
  return prisma.aiUsage.findUnique({ where: { tenantId } })
}
```

- [ ] **Step 5: Run tests — expect all green**

```bash
npx vitest run src/services/ai/__tests__/ai-usage.service.test.ts
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/ai/
git commit -m "feat(ai): add AiUsage service and shared types"
```

---

## Task 4: AI Limit Middleware (TDD)

**Files:**
- Create: `src/lib/middleware/ai-limit.middleware.ts`
- Create: `src/lib/middleware/__tests__/ai-limit.middleware.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/middleware/__tests__/ai-limit.middleware.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    alert: { findFirst: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('@/services/ai/ai-usage.service', () => ({
  verificarLimite: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { verificarLimite } from '@/services/ai/ai-usage.service'
import { checkAiLimit } from '../ai-limit.middleware'

const p = prisma as { alert: Record<string, ReturnType<typeof vi.fn>> }
const mockVerificar = verificarLimite as ReturnType<typeof vi.fn>

beforeEach(() => { vi.clearAllMocks() })

describe('checkAiLimit', () => {
  it('passes through permitido:true when under 80%', async () => {
    mockVerificar.mockResolvedValue({ permitido: true, percentual: 50 })
    const result = await checkAiLimit('t-1')
    expect(result).toEqual({ permitido: true, percentual: 50 })
    expect(p.alert.create).not.toHaveBeenCalled()
  })

  it('creates SISTEMA alert when at 80% and no recent alert exists', async () => {
    mockVerificar.mockResolvedValue({ permitido: true, percentual: 82 })
    p.alert.findFirst.mockResolvedValue(null)
    p.alert.create.mockResolvedValue({})

    await checkAiLimit('t-1')

    expect(p.alert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tipo: 'SISTEMA', severidade: 'ALTA' }),
      })
    )
  })

  it('does not create duplicate alert when one exists within 24h', async () => {
    mockVerificar.mockResolvedValue({ permitido: true, percentual: 85 })
    p.alert.findFirst.mockResolvedValue({ id: 'existing-alert' })

    await checkAiLimit('t-1')

    expect(p.alert.create).not.toHaveBeenCalled()
  })

  it('returns permitido:false when limit exceeded', async () => {
    mockVerificar.mockResolvedValue({ permitido: false, percentual: 100 })
    p.alert.findFirst.mockResolvedValue(null)
    p.alert.create.mockResolvedValue({})

    const result = await checkAiLimit('t-1')

    expect(result.permitido).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/lib/middleware/__tests__/ai-limit.middleware.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the middleware**

Create `src/lib/middleware/ai-limit.middleware.ts`:

```typescript
import { prisma } from '@/lib/prisma'
import { verificarLimite } from '@/services/ai/ai-usage.service'

export async function checkAiLimit(
  tenantId: string
): Promise<{ permitido: boolean; percentual: number }> {
  const { permitido, percentual } = await verificarLimite(tenantId)

  if (percentual >= 80) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recent = await prisma.alert.findFirst({
      where: {
        tenantId,
        tipo: 'SISTEMA',
        metadata: { path: ['subtipo'], equals: 'LIMITE_IA_80' },
        criadoEm: { gte: oneDayAgo },
      },
    })
    if (!recent) {
      await prisma.alert.create({
        data: {
          tenantId,
          tipo: 'SISTEMA',
          severidade: 'ALTA',
          titulo: `Uso de IA em ${percentual}% do limite mensal`,
          descricao: `O tenant atingiu ${percentual}% do limite de tokens de IA para este mês.`,
          status: 'NAO_LIDO',
          metadata: { subtipo: 'LIMITE_IA_80', percentual },
        },
      })
    }
  }

  return { permitido, percentual }
}
```

- [ ] **Step 4: Run tests — expect all green**

```bash
npx vitest run src/lib/middleware/__tests__/ai-limit.middleware.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/middleware/
git commit -m "feat(ai): add AI limit middleware with 80% alert"
```

---

## Task 5: Cloudinary Helper + NF Processor Service (TDD)

**Files:**
- Create: `src/lib/cloudinary.ts`
- Create: `src/lib/queues.ts`
- Create: `src/services/ai/nf-processor.service.ts`
- Create: `src/services/ai/__tests__/nf-processor.service.test.ts`

- [ ] **Step 1: Create Cloudinary helper**

Create `src/lib/cloudinary.ts`:

```typescript
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
})

export async function uploadBuffer(
  buffer: Buffer,
  options: { folder?: string; resource_type?: 'image' | 'raw' | 'auto' }
): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { folder: options.folder ?? 'nfs', resource_type: options.resource_type ?? 'auto' },
        (err, result) => {
          if (err || !result) reject(err ?? new Error('Cloudinary upload failed'))
          else resolve(result.secure_url)
        }
      )
      .end(buffer)
  })
}
```

- [ ] **Step 2: Create queue singletons**

Create `src/lib/queues.ts`:

```typescript
import { Queue } from 'bullmq'
import { redisConnectionOptions } from './bullmq'

export const nfQueue = new Queue('nf-processing', {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'fixed', delay: 5000 },
  },
})
```

- [ ] **Step 3: Write failing tests for enriquecerItens**

Create `src/services/ai/__tests__/nf-processor.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ingredient: { findMany: vi.fn() },
    nfProcessada: { update: vi.fn() },
  },
}))

vi.mock('@/lib/cloudinary', () => ({ uploadBuffer: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}))

import { prisma } from '@/lib/prisma'
import { enriquecerItens } from '../nf-processor.service'

const p = prisma as { ingredient: Record<string, ReturnType<typeof vi.fn>> }

beforeEach(() => { vi.clearAllMocks() })

describe('enriquecerItens', () => {
  it('matches ingredient with high confidence on exact name', async () => {
    p.ingredient.findMany.mockResolvedValue([
      { id: 'ing-1', name: 'Farinha de Trigo' },
      { id: 'ing-2', name: 'Açúcar Cristal' },
    ])

    const result = await enriquecerItens('t-1', [
      { descricao: 'Farinha de Trigo', quantidade: 5, unidade: 'KG', custoUnitario: 4.5, custoTotal: 22.5 },
    ])

    expect(result[0].insumoId).toBe('ing-1')
    expect(result[0].scoreConfianca).toBeGreaterThan(70)
  })

  it('returns null insumoId and 0 confidence when no ingredients exist', async () => {
    p.ingredient.findMany.mockResolvedValue([])

    const result = await enriquecerItens('t-1', [
      { descricao: 'Pimenta do Reino', quantidade: 1, unidade: 'UN', custoUnitario: 10, custoTotal: 10 },
    ])

    expect(result[0].insumoId).toBeNull()
    expect(result[0].scoreConfianca).toBe(0)
  })

  it('returns low confidence score for dissimilar names', async () => {
    p.ingredient.findMany.mockResolvedValue([
      { id: 'ing-1', name: 'Manteiga sem sal' },
    ])

    const result = await enriquecerItens('t-1', [
      { descricao: 'Carne bovina contrafilé', quantidade: 2, unidade: 'KG', custoUnitario: 50, custoTotal: 100 },
    ])

    expect(result[0].scoreConfianca).toBeLessThan(40)
  })

  it('preserves original item fields in enriched result', async () => {
    p.ingredient.findMany.mockResolvedValue([{ id: 'ing-1', name: 'Sal' }])

    const result = await enriquecerItens('t-1', [
      { descricao: 'Sal refinado', quantidade: 3, unidade: 'KG', custoUnitario: 2, custoTotal: 6 },
    ])

    expect(result[0].quantidade).toBe(3)
    expect(result[0].custoTotal).toBe(6)
  })
})
```

- [ ] **Step 4: Run tests to confirm they fail**

```bash
npx vitest run src/services/ai/__tests__/nf-processor.service.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 5: Implement NF processor service**

Create `src/services/ai/nf-processor.service.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import levenshtein from 'fast-levenshtein'
import { prisma } from '@/lib/prisma'
import { uploadBuffer } from '@/lib/cloudinary'
import type { ItemExtraido, ItemEnriquecido, NfExtraidaData } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const SYSTEM_PROMPT_NF = `You are a fiscal invoice (Nota Fiscal) data extraction assistant for a Brazilian restaurant management system.

Extract structured data from the provided invoice image, PDF, or text description.

Return ONLY a valid JSON object — no explanatory text, no markdown, just the JSON:

{
  "fornecedor": "supplier company name or null",
  "numeroNf": "NF number/code or null",
  "dataEmissao": "YYYY-MM-DD or null",
  "valorTotal": 0.00,
  "itens": [
    {
      "descricao": "product description as written on invoice",
      "quantidade": 0,
      "unidade": "UN or KG or G or L or ML",
      "custoUnitario": 0.00,
      "custoTotal": 0.00
    }
  ]
}

Rules:
- All monetary values in decimal (e.g. 12.50, not "R$12,50")
- If a field is missing, use null
- Map unidade to one of: UN, KG, G, L, ML
- Return empty itens array [] if no items are identifiable`

export async function uploadNfToCloudinary(buffer: Buffer, mediaType: string): Promise<string> {
  const resourceType = mediaType === 'application/pdf' ? 'raw' : 'image'
  return uploadBuffer(buffer, { folder: 'nfs', resource_type: resourceType })
}

export async function extrairItensComClaude(params: {
  cloudinaryUrl?: string | null
  mediaType?: string | null
  texto?: string | null
}): Promise<{ data: NfExtraidaData; tokensInput: number; tokensOutput: number }> {
  const { cloudinaryUrl, mediaType, texto } = params
  let content: Anthropic.Messages.MessageParam['content']

  if (cloudinaryUrl && mediaType) {
    const fileRes = await fetch(cloudinaryUrl)
    const buffer = Buffer.from(await fileRes.arrayBuffer())
    const base64 = buffer.toString('base64')

    if (mediaType === 'application/pdf') {
      content = [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        } as Anthropic.Messages.DocumentBlockParam,
      ]
    } else {
      const imgType = (
        mediaType === 'image/jpeg' || mediaType === 'image/png' ||
        mediaType === 'image/gif' || mediaType === 'image/webp'
          ? mediaType
          : 'image/jpeg'
      ) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

      content = [
        { type: 'image', source: { type: 'base64', media_type: imgType, data: base64 } },
        { type: 'text', text: 'Extract all line items from this invoice.' },
      ]
    }
  } else {
    content = [{ type: 'text', text: texto ?? '' }]
  }

  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514',
    max_tokens: parseInt(process.env.AI_MAX_TOKENS_PER_REQUEST ?? '2000'),
    system: SYSTEM_PROMPT_NF,
    messages: [{ role: 'user', content }],
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text : '{}'
  let data: NfExtraidaData
  try {
    data = JSON.parse(rawText) as NfExtraidaData
  } catch {
    data = { fornecedor: null, numeroNf: null, dataEmissao: null, valorTotal: null, itens: [] }
  }

  return { data, tokensInput: response.usage.input_tokens, tokensOutput: response.usage.output_tokens }
}

export async function enriquecerItens(
  tenantId: string,
  itens: ItemExtraido[]
): Promise<ItemEnriquecido[]> {
  const ingredients = await prisma.ingredient.findMany({
    where: { tenantId },
    select: { id: true, name: true },
  })

  if (ingredients.length === 0) {
    return itens.map((item) => ({ ...item, insumoId: null, insumoNome: null, scoreConfianca: 0 }))
  }

  return itens.map((item) => {
    const termo = item.descricao.toLowerCase()

    const scored = ingredients.map((ing) => {
      const name = ing.name.toLowerCase()
      const dist = levenshtein.get(termo, name)
      const maxLen = Math.max(termo.length, name.length)
      const score = maxLen === 0 ? 0 : Math.round((1 - dist / maxLen) * 100)
      return { ...ing, score }
    })

    const best = scored.sort((a, b) => b.score - a.score)[0]
    const scoreConfianca = Math.max(0, Math.min(100, best.score))

    return { ...item, insumoId: best.id, insumoNome: best.name, scoreConfianca }
  })
}

export async function salvarNfStatus(
  nfId: string,
  dados: NfExtraidaData,
  rawResponseIa: object,
  itensCriados: number
): Promise<void> {
  await prisma.nfProcessada.update({
    where: { id: nfId },
    data: {
      status: 'CONCLUIDA',
      fornecedorNome: dados.fornecedor,
      numeroNf: dados.numeroNf,
      dataEmissao: dados.dataEmissao ? new Date(dados.dataEmissao) : null,
      valorTotal: dados.valorTotal,
      rawResponseIa,
      itensCriados,
    },
  })
}

export async function marcarNfErro(nfId: string, mensagem: string): Promise<void> {
  await prisma.nfProcessada.update({
    where: { id: nfId },
    data: { status: 'ERRO', rawResponseIa: { erro: mensagem } },
  })
}
```

- [ ] **Step 6: Run tests — expect all green**

```bash
npx vitest run src/services/ai/__tests__/nf-processor.service.test.ts
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/cloudinary.ts src/lib/queues.ts src/services/ai/
git commit -m "feat(ai): add NF processor service with Cloudinary upload and Levenshtein enrichment"
```

---

## Task 6: Estoque Chat Service

**Files:**
- Create: `src/services/ai/estoque-chat.service.ts`

No unit tests for this service — it wraps Anthropic streaming and Prisma writes; integration-tested via the SSE route.

- [ ] **Step 1: Implement chat service**

Create `src/services/ai/estoque-chat.service.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { incrementarUso } from './ai-usage.service'
import type { ChatMessage } from '@prisma/client'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function montarContextoEstoque(tenantId: string): Promise<string> {
  const [ingredients, movements, alerts] = await Promise.all([
    prisma.ingredient.findMany({
      where: { tenantId },
      select: {
        id: true, name: true, currentQty: true, minimumQty: true,
        unit: true, custoMedioPonderado: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.ingredientMovement.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        type: true, quantity: true, unitCost: true, createdAt: true,
        ingredient: { select: { name: true } },
      },
    }),
    prisma.alert.findMany({
      where: { tenantId, status: { in: ['NAO_LIDO', 'LIDO'] } },
      select: { tipo: true, titulo: true, criadoEm: true },
      orderBy: { criadoEm: 'desc' },
      take: 10,
    }),
  ])

  return JSON.stringify({ ingredients, movements, alerts })
}

export async function gerarResposta(
  tenantId: string,
  userId: string,
  historico: ChatMessage[],
  novaMensagem: string,
  onChunk: (text: string) => void
): Promise<void> {
  const contexto = await montarContextoEstoque(tenantId)

  const systemPrompt = `Você é um assistente de gestão de estoque para um restaurante brasileiro.
Responda em português sobre níveis de estoque, movimentações, custos e alertas.
Use os dados em tempo real abaixo para responder com precisão:

${contexto}`

  const messages: Anthropic.Messages.MessageParam[] = [
    ...historico.map((msg) => ({
      role: msg.role === 'USER' ? ('user' as const) : ('assistant' as const),
      content: msg.content,
    })),
    { role: 'user', content: novaMensagem },
  ]

  let fullResponse = ''
  const stream = anthropic.messages.stream({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514',
    max_tokens: parseInt(process.env.AI_MAX_TOKENS_PER_REQUEST ?? '2000'),
    system: systemPrompt,
    messages,
  })

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      fullResponse += chunk.delta.text
      onChunk(chunk.delta.text)
    }
  }

  const finalMessage = await stream.finalMessage()
  const tokensInput = finalMessage.usage.input_tokens
  const tokensOutput = finalMessage.usage.output_tokens

  await prisma.$transaction([
    prisma.chatMessage.create({
      data: { tenantId, userId, role: 'USER', content: novaMensagem, tokensUsados: 0 },
    }),
    prisma.chatMessage.create({
      data: { tenantId, userId, role: 'ASSISTANT', content: fullResponse, tokensUsados: tokensOutput },
    }),
  ])

  await incrementarUso(tenantId, tokensInput, tokensOutput)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/ai/estoque-chat.service.ts
git commit -m "feat(ai): add estoque chat service with streaming and context builder"
```

---

## Task 7: BullMQ Jobs + Register Workers in server.ts

**Files:**
- Create: `src/jobs/ai/nf-processor.job.ts`
- Create: `src/jobs/ai/ai-usage-reset.job.ts`
- Create: `src/jobs/ai/index.ts`
- Modify: `server.ts`

- [ ] **Step 1: Create NF processor job**

Create `src/jobs/ai/nf-processor.job.ts`:

```typescript
import type { Job } from 'bullmq'
import type { Server as SocketIOServer } from 'socket.io'
import {
  extrairItensComClaude,
  enriquecerItens,
  salvarNfStatus,
  marcarNfErro,
} from '@/services/ai/nf-processor.service'
import { incrementarUso } from '@/services/ai/ai-usage.service'

export interface NfJobPayload {
  nfId: string
  tenantId: string
  userId: string
  cloudinaryUrl?: string | null
  mediaType?: string | null
  texto?: string | null
}

export async function processNfJob(
  job: Job<NfJobPayload>,
  io: SocketIOServer
): Promise<void> {
  const { nfId, tenantId, cloudinaryUrl, mediaType, texto } = job.data

  try {
    const { data, tokensInput, tokensOutput } = await extrairItensComClaude({
      cloudinaryUrl,
      mediaType,
      texto,
    })

    const itensEnriquecidos = await enriquecerItens(tenantId, data.itens)
    const rawResponseIa = { ...data, itensEnriquecidos }

    await salvarNfStatus(nfId, data, rawResponseIa, 0)
    await incrementarUso(tenantId, tokensInput, tokensOutput)

    io.to(tenantId).emit('nf:processada', { nfId, dados: rawResponseIa })
  } catch (error) {
    const mensagem =
      error instanceof Error ? error.message : 'Erro desconhecido no processamento'
    await marcarNfErro(nfId, mensagem)
    io.to(tenantId).emit('nf:erro', { nfId, mensagem })
    throw error
  }
}
```

- [ ] **Step 2: Create usage reset job**

Create `src/jobs/ai/ai-usage-reset.job.ts`:

```typescript
import { resetarUsoMensal } from '@/services/ai/ai-usage.service'

export async function resetAiUsage(): Promise<void> {
  console.log('[ai-usage-reset] Starting monthly reset...')
  await resetarUsoMensal()
  console.log('[ai-usage-reset] Monthly reset complete')
}
```

- [ ] **Step 3: Create startAiWorkers**

Create `src/jobs/ai/index.ts`:

```typescript
import { Queue, Worker } from 'bullmq'
import { redisConnectionOptions } from '@/lib/bullmq'
import type { Server as SocketIOServer } from 'socket.io'
import { processNfJob } from './nf-processor.job'
import { resetAiUsage } from './ai-usage-reset.job'

export async function startAiWorkers(io: SocketIOServer): Promise<void> {
  new Worker('nf-processing', (job) => processNfJob(job, io), {
    connection: redisConnectionOptions,
  })

  const resetQueue = new Queue('ai-usage-reset', { connection: redisConnectionOptions })
  await resetQueue.add(
    'monthly-reset',
    {},
    { repeat: { pattern: '0 0 1 * *' }, jobId: 'ai-usage-reset-monthly' }
  )
  new Worker('ai-usage-reset', () => resetAiUsage(), {
    connection: redisConnectionOptions,
  })

  console.log('> AI workers started')
}
```

- [ ] **Step 4: Register startAiWorkers in server.ts**

In `server.ts`, find the `if (redisOk)` block:

```typescript
  if (redisOk) {
    const { startAlertWorkers } = await import('./src/jobs/alerts')
    const { startDashboardWorkers } = await import('./src/jobs/dashboard')
    await startAlertWorkers(io)
    await startDashboardWorkers()
  }
```

Add the AI workers import and call:

```typescript
  if (redisOk) {
    const { startAlertWorkers } = await import('./src/jobs/alerts')
    const { startDashboardWorkers } = await import('./src/jobs/dashboard')
    const { startAiWorkers } = await import('./src/jobs/ai')
    await startAlertWorkers(io)
    await startDashboardWorkers()
    await startAiWorkers(io)
  }
```

- [ ] **Step 5: Commit**

```bash
git add src/jobs/ai/ server.ts
git commit -m "feat(ai): add BullMQ jobs for NF processing and monthly usage reset"
```

---

## Task 8: API Routes — processar-nf + nf-status

**Files:**
- Create: `src/app/api/ai/processar-nf/route.ts`
- Create: `src/app/api/ai/nf-status/[nfId]/route.ts`

- [ ] **Step 1: Create processar-nf route**

Create `src/app/api/ai/processar-nf/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { checkAiLimit } from '@/lib/middleware/ai-limit.middleware'
import { uploadNfToCloudinary } from '@/services/ai/nf-processor.service'
import { nfQueue } from '@/lib/queues'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const tenantId = session.user.tenantId as string
  const userId = (session.user as { id: string }).id

  const { permitido } = await checkAiLimit(tenantId)
  if (!permitido) {
    return NextResponse.json(
      { error: 'Limite mensal de IA atingido. Aguarde o próximo mês ou faça upgrade do plano.' },
      { status: 403 }
    )
  }

  const contentType = req.headers.get('content-type') ?? ''
  let cloudinaryUrl: string | null = null
  let mediaType: string | null = null
  let texto: string | null = null
  let origem: 'UPLOAD_IMAGEM' | 'UPLOAD_PDF' | 'TEXTO'

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo maior que 10MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    mediaType = file.type
    cloudinaryUrl = await uploadNfToCloudinary(buffer, mediaType)
    origem = mediaType === 'application/pdf' ? 'UPLOAD_PDF' : 'UPLOAD_IMAGEM'
  } else {
    const body = (await req.json()) as { texto?: string; cloudinaryUrl?: string; nfOriginalId?: string }

    if (body.cloudinaryUrl && body.nfOriginalId) {
      // Reprocess case — retrieve original NF to derive origem and mediaType
      const original = await prisma.nfProcessada.findFirst({
        where: { id: body.nfOriginalId, tenantId },
        select: { origem: true },
      })
      cloudinaryUrl = body.cloudinaryUrl
      origem = original?.origem ?? 'UPLOAD_IMAGEM'
      mediaType = origem === 'UPLOAD_PDF' ? 'application/pdf' : 'image/jpeg'
    } else if (body.texto?.trim()) {
      texto = body.texto.trim()
      origem = 'TEXTO'
    } else {
      return NextResponse.json({ error: 'Envie um arquivo, texto ou cloudinaryUrl para reprocessamento' }, { status: 400 })
    }
  }

  const nf = await prisma.nfProcessada.create({
    data: {
      tenantId,
      origem,
      cloudinaryUrl,
      status: 'PROCESSANDO',
      rawResponseIa: {},
      processadoPor: userId,
    },
  })

  await nfQueue.add('process', {
    nfId: nf.id,
    tenantId,
    userId,
    cloudinaryUrl,
    mediaType,
    texto,
  })

  return NextResponse.json({ nfId: nf.id, status: 'PROCESSANDO' })
}
```

- [ ] **Step 2: Create nf-status route**

Create `src/app/api/ai/nf-status/[nfId]/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

export async function GET(
  _req: Request,
  { params }: { params: { nfId: string } }
) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const nf = await prisma.nfProcessada.findFirst({
    where: { id: params.nfId, tenantId },
    select: { status: true, rawResponseIa: true },
  })

  if (!nf) return NextResponse.json({ error: 'NF não encontrada' }, { status: 404 })

  return NextResponse.json({
    status: nf.status,
    ...(nf.status === 'CONCLUIDA' && { dados: nf.rawResponseIa }),
    ...(nf.status === 'ERRO' && { erro: (nf.rawResponseIa as { erro?: string })?.erro }),
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ai/
git commit -m "feat(api): add processar-nf and nf-status routes"
```

---

## Task 9: API Route — chat-estoque (SSE)

**Files:**
- Create: `src/app/api/ai/chat-estoque/route.ts`

- [ ] **Step 1: Implement SSE route**

Create `src/app/api/ai/chat-estoque/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { checkAiLimit } from '@/lib/middleware/ai-limit.middleware'
import { gerarResposta } from '@/services/ai/estoque-chat.service'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const tenantId = session.user.tenantId as string
  const userId = (session.user as { id: string }).id

  const mensagem = req.nextUrl.searchParams.get('mensagem')?.trim()
  if (!mensagem) return new Response('mensagem é obrigatória', { status: 400 })

  const { permitido } = await checkAiLimit(tenantId)
  if (!permitido) {
    const encoder = new TextEncoder()
    return new Response(
      encoder.encode(
        `data: ${JSON.stringify({ erro: 'Limite mensal de IA atingido' })}\n\ndata: [DONE]\n\n`
      ),
      { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } }
    )
  }

  const historico = await prisma.chatMessage.findMany({
    where: { tenantId, userId },
    orderBy: { createdAt: 'asc' },
    take: 20,
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await gerarResposta(tenantId, userId, historico, mensagem, (chunk) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
          )
        })
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ erro: 'Erro ao gerar resposta' })}\n\n`)
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/ai/chat-estoque/
git commit -m "feat(api): add chat-estoque SSE streaming route"
```

---

## Task 10: API Route — entrada-lote

**Files:**
- Create: `src/app/api/estoque/entrada-lote/route.ts`

- [ ] **Step 1: Implement entrada-lote route**

Create `src/app/api/estoque/entrada-lote/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/session'

interface ItemLote {
  insumoId: string
  quantidade: number
  custoUnitario: number
  incluir: boolean
}

interface EntradaLoteBody {
  nfId: string
  fornecedorNome: string
  numeroNf?: string
  dataRecebimento: string
  itens: ItemLote[]
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const tenantId = session.user.tenantId as string
  const userId = (session.user as { id: string }).id

  const body = (await req.json()) as EntradaLoteBody
  const { nfId, fornecedorNome, numeroNf, dataRecebimento, itens } = body

  if (!itens?.length) {
    return NextResponse.json({ error: 'Nenhum item enviado' }, { status: 400 })
  }

  const nf = await prisma.nfProcessada.findFirst({ where: { id: nfId, tenantId } })
  if (!nf) return NextResponse.json({ error: 'NF não encontrada' }, { status: 404 })

  const itensALancar = itens.filter((i) => i.incluir && i.insumoId)
  if (itensALancar.length === 0) {
    return NextResponse.json({ error: 'Nenhum item marcado para incluir' }, { status: 400 })
  }

  let itensCriados = 0

  await prisma.$transaction(async (tx) => {
    for (const item of itensALancar) {
      const ingredient = await tx.ingredient.findFirst({
        where: { id: item.insumoId, tenantId },
        select: { id: true, currentQty: true, custoMedioPonderado: true },
      })
      if (!ingredient) continue

      const { currentQty: qtdAtual, custoMedioPonderado: cmpAtual } = ingredient
      const { quantidade: qtdEntrada, custoUnitario } = item

      const novoCmp =
        qtdAtual + qtdEntrada > 0
          ? (qtdAtual * cmpAtual + qtdEntrada * custoUnitario) / (qtdAtual + qtdEntrada)
          : custoUnitario

      await tx.ingredient.update({
        where: { id: ingredient.id },
        data: {
          currentQty: qtdAtual + qtdEntrada,
          custoMedioPonderado: novoCmp,
          unitCost: custoUnitario,
        },
      })

      await tx.ingredientMovement.create({
        data: {
          ingredientId: ingredient.id,
          tenantId,
          type: 'IN',
          quantity: qtdEntrada,
          unitCost: custoUnitario,
          totalCost: qtdEntrada * custoUnitario,
          reason: `NF ${numeroNf ?? nfId} — ${fornecedorNome}`,
          note: `Recebido em ${dataRecebimento}`,
          createdBy: userId,
        },
      })

      itensCriados++
    }

    await tx.nfProcessada.update({
      where: { id: nfId },
      data: { status: 'CONCLUIDA', fornecedorNome, numeroNf, itensCriados },
    })
  })

  return NextResponse.json({ ok: true, itensCriados })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/estoque/entrada-lote/
git commit -m "feat(api): add entrada-lote route with CMP recalculation"
```

---

## Task 11: Page — entrada-inteligente

**Files:**
- Create: `src/app/(app)/estoque/entrada-inteligente/page.tsx`

- [ ] **Step 1: Implement the page**

Create `src/app/(app)/estoque/entrada-inteligente/page.tsx`:

```tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import { io as socketIO, type Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { Upload, Camera, FileText, Loader2, AlertCircle, RotateCcw } from 'lucide-react'
import { TabelaRevisaoNF } from './components/TabelaRevisaoNF'

type PageState = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

interface NfDados {
  fornecedor: string | null
  numeroNf: string | null
  dataEmissao: string | null
  valorTotal: number | null
  itensEnriquecidos: Array<{
    descricao: string
    quantidade: number
    unidade: string
    custoUnitario: number
    custoTotal: number
    insumoId: string | null
    insumoNome: string | null
    scoreConfianca: number
  }>
}

export default function EntradaInteligentePage() {
  const [state, setState] = useState<PageState>('idle')
  const [modo, setModo] = useState<'arquivo' | 'texto'>('arquivo')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [texto, setTexto] = useState('')
  const [nfId, setNfId] = useState<string | null>(null)
  const [dados, setDados] = useState<NfDados | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const socketRef = useRef<Socket | null>(null)

  const conectarSocket = useCallback((tenantId: string, nfIdParam: string) => {
    const socket = socketIO({ path: '/api/socket' })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join:tenant', tenantId)
    })

    socket.on('nf:processada', (payload: { nfId: string; dados: NfDados }) => {
      if (payload.nfId !== nfIdParam) return
      setDados(payload.dados)
      setState('done')
      socket.disconnect()
    })

    socket.on('nf:erro', (payload: { nfId: string; mensagem: string }) => {
      if (payload.nfId !== nfIdParam) return
      setErro(payload.mensagem)
      setState('error')
      socket.disconnect()
    })
  }, [])

  async function handleSubmit() {
    setState('uploading')
    setErro(null)

    try {
      let body: BodyInit
      let headers: Record<string, string> = {}

      if (modo === 'arquivo' && arquivo) {
        const fd = new FormData()
        fd.append('file', arquivo)
        body = fd
      } else {
        body = JSON.stringify({ texto })
        headers['Content-Type'] = 'application/json'
      }

      const res = await fetch('/api/ai/processar-nf', { method: 'POST', body, headers })
      const json = await res.json() as { nfId?: string; error?: string }

      if (!res.ok) {
        setErro(json.error ?? 'Erro ao processar NF')
        setState('error')
        return
      }

      const { nfId: id } = json
      if (!id) { setState('error'); return }

      setNfId(id)
      setState('processing')

      // Get tenantId from session endpoint for socket room join
      const sessionRes = await fetch('/api/auth/session')
      const sessionData = await sessionRes.json() as { user?: { tenantId?: string } }
      const tenantId = sessionData?.user?.tenantId

      if (tenantId) {
        conectarSocket(tenantId, id)
      }

      // Polling fallback — if WS not available within 30s, switch to polling
      let pollAttempts = 0
      const pollInterval = setInterval(async () => {
        pollAttempts++
        if (pollAttempts > 20) { clearInterval(pollInterval); return }

        const statusRes = await fetch(`/api/ai/nf-status/${id}`)
        const statusJson = await statusRes.json() as { status: string; dados?: NfDados; erro?: string }

        if (statusJson.status === 'CONCLUIDA' && statusJson.dados) {
          clearInterval(pollInterval)
          if (socketRef.current?.connected) return
          setDados(statusJson.dados)
          setState('done')
        } else if (statusJson.status === 'ERRO') {
          clearInterval(pollInterval)
          if (socketRef.current?.connected) return
          setErro(statusJson.erro ?? 'Erro no processamento')
          setState('error')
        }
      }, 3000)
    } catch {
      setErro('Falha na conexão com o servidor')
      setState('error')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) setArquivo(file)
  }

  function resetar() {
    setState('idle')
    setArquivo(null)
    setTexto('')
    setDados(null)
    setErro(null)
    setNfId(null)
    socketRef.current?.disconnect()
  }

  const isLoading = state === 'uploading' || state === 'processing'
  const canSubmit = !isLoading && (modo === 'arquivo' ? !!arquivo : texto.trim().length > 0)

  return (
    <div className="flex h-full gap-6 p-6">
      {/* Left zone — input */}
      <div className="w-[400px] shrink-0 flex flex-col gap-4">
        <h1 className="text-lg font-semibold">Entrada Inteligente de Estoque</h1>

        <div className="flex gap-2">
          <button
            onClick={() => setModo('arquivo')}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
              modo === 'arquivo' ? 'bg-primary text-primary-foreground' : 'border-border'
            }`}
          >
            Arquivo / Foto
          </button>
          <button
            onClick={() => setModo('texto')}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
              modo === 'texto' ? 'bg-primary text-primary-foreground' : 'border-border'
            }`}
          >
            Descrever em texto
          </button>
        </div>

        {modo === 'arquivo' ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 min-h-[200px] border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/50 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.heic,.pdf"
              className="hidden"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
            {arquivo ? (
              <div className="text-center px-4">
                <FileText className="w-8 h-8 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">{arquivo.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(arquivo.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center px-4">
                  Arraste uma NF aqui ou clique para selecionar
                  <br />
                  <span className="text-xs">JPG, PNG, HEIC, PDF — máx 10MB</span>
                </p>
              </>
            )}
          </div>
        ) : (
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Descreva os itens da nota fiscal. Ex: 5kg Farinha de Trigo R$22,50 | 2L Azeite de Oliva R$45,00"
            className="flex-1 min-h-[200px] resize-none border border-border rounded-lg p-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {state === 'uploading' ? 'Enviando...' : 'Processando com IA...'}
            </>
          ) : (
            'Processar com IA'
          )}
        </button>
      </div>

      {/* Right zone — result */}
      <div className="flex-1 overflow-auto">
        {state === 'idle' && (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Camera className="w-12 h-12 opacity-30" />
            <p className="text-sm text-center">
              Envie uma foto, PDF ou descrição da Nota Fiscal
              <br />
              e a IA vai extrair e mapear os itens automaticamente.
            </p>
          </div>
        )}

        {(state === 'uploading' || state === 'processing') && (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <div className="space-y-2 text-center">
              <div className="h-4 bg-muted rounded animate-pulse w-48 mx-auto" />
              <div className="h-4 bg-muted rounded animate-pulse w-32 mx-auto" />
              <div className="h-4 bg-muted rounded animate-pulse w-40 mx-auto" />
            </div>
            <p className="text-sm text-muted-foreground">
              {state === 'uploading' ? 'Enviando arquivo...' : 'Claude está lendo a nota fiscal...'}
            </p>
          </div>
        )}

        {state === 'error' && (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <AlertCircle className="w-10 h-10 text-destructive" />
            <p className="text-sm text-destructive text-center max-w-xs">{erro}</p>
            <button
              onClick={resetar}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-md text-sm hover:bg-accent"
            >
              <RotateCcw className="w-4 h-4" />
              Tentar novamente
            </button>
          </div>
        )}

        {state === 'done' && dados && nfId && (
          <TabelaRevisaoNF
            nfId={nfId}
            dados={dados}
            onConfirmed={resetar}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(app)/estoque/entrada-inteligente/page.tsx"
git commit -m "feat(ui): add entrada-inteligente page with upload zones and WS integration"
```

---

## Task 12: Component — TabelaRevisaoNF

**Files:**
- Create: `src/app/(app)/estoque/entrada-inteligente/components/TabelaRevisaoNF.tsx`

- [ ] **Step 1: Implement the review table**

Create `src/app/(app)/estoque/entrada-inteligente/components/TabelaRevisaoNF.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { toast } from 'sonner'
import { Check, X, Plus, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Insumo {
  id: string
  name: string
}

interface Fornecedor {
  id: string
  name: string
}

interface ItemForm {
  descricao: string
  insumoId: string
  insumoNome: string
  scoreConfianca: number
  quantidade: number
  unidade: string
  custoUnitario: number
  incluir: boolean
  criarNovo: boolean
  novoNome: string
  novaUnidade: string
}

interface FormValues {
  fornecedorNome: string
  numeroNf: string
  dataRecebimento: string
  itens: ItemForm[]
}

interface TabelaRevisaoNFProps {
  nfId: string
  dados: {
    fornecedor: string | null
    numeroNf: string | null
    dataEmissao: string | null
    valorTotal: number | null
    itensEnriquecidos: Array<{
      descricao: string
      quantidade: number
      unidade: string
      custoUnitario: number
      custoTotal: number
      insumoId: string | null
      insumoNome: string | null
      scoreConfianca: number
    }>
  }
  onConfirmed: () => void
}

function BadgeConfianca({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-100 text-green-800' : score >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${color}`}>
      {score}%
    </span>
  )
}

export function TabelaRevisaoNF({ nfId, dados, onConfirmed }: TabelaRevisaoNFProps) {
  const router = useRouter()
  const [insumos, setInsumos] = useState<Insumo[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [submitting, setSubmitting] = useState(false)

  const { register, control, handleSubmit, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      fornecedorNome: dados.fornecedor ?? '',
      numeroNf: dados.numeroNf ?? '',
      dataRecebimento: new Date().toISOString().split('T')[0],
      itens: dados.itensEnriquecidos.map((item) => ({
        descricao: item.descricao,
        insumoId: item.insumoId ?? '',
        insumoNome: item.insumoNome ?? '',
        scoreConfianca: item.scoreConfianca,
        quantidade: item.quantidade,
        unidade: item.unidade,
        custoUnitario: item.custoUnitario,
        incluir: item.insumoId !== null,
        criarNovo: false,
        novoNome: '',
        novaUnidade: 'UN',
      })),
    },
  })

  const { fields } = useFieldArray({ control, name: 'itens' })
  const itens = watch('itens')

  useEffect(() => {
    Promise.all([
      fetch('/api/ingredients').then((r) => r.json() as Promise<Insumo[]>),
      fetch('/api/suppliers').then((r) => r.json() as Promise<Fornecedor[]>),
    ]).then(([ins, fors]) => {
      setInsumos(Array.isArray(ins) ? ins : [])
      setFornecedores(Array.isArray(fors) ? fors : [])
    })
  }, [])

  const itensIncluidos = itens.filter((i) => i.incluir)
  const valorTotal = itensIncluidos.reduce(
    (sum, i) => sum + i.quantidade * i.custoUnitario,
    0
  )

  async function onSubmit(values: FormValues) {
    const itensPayload = values.itens
      .filter((i) => i.incluir)
      .map((i) => ({
        insumoId: i.insumoId,
        quantidade: i.quantidade,
        custoUnitario: i.custoUnitario,
        incluir: true,
      }))

    if (itensPayload.length === 0) {
      toast.error('Inclua ao menos um item')
      return
    }

    const semInsumo = itensPayload.filter((i) => !i.insumoId)
    if (semInsumo.length > 0) {
      toast.error('Todos os itens incluídos precisam ter um insumo mapeado')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/estoque/entrada-lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nfId,
          fornecedorNome: values.fornecedorNome,
          numeroNf: values.numeroNf,
          dataRecebimento: values.dataRecebimento,
          itens: itensPayload,
        }),
      })

      const json = await res.json() as { ok?: boolean; error?: string; itensCriados?: number }
      if (!res.ok) {
        toast.error(json.error ?? 'Erro ao confirmar lançamento')
        return
      }

      toast.success(`${json.itensCriados} itens lançados com sucesso!`)
      onConfirmed()
      router.push('/estoque/notas-fiscais')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Global fields */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-card border border-border rounded-lg">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Fornecedor</label>
          <select
            {...register('fornecedorNome')}
            className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background"
          >
            <option value="">Selecione ou digite</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.name}>{f.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Nº NF</label>
          <input
            {...register('numeroNf')}
            className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background"
            placeholder="000001"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Data Recebimento</label>
          <input
            type="date"
            {...register('dataRecebimento')}
            className="w-full border border-border rounded-md px-2 py-1.5 text-sm bg-background"
          />
        </div>
      </div>

      {/* Items table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Descrição original</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Insumo no sistema</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Qtd</th>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Un</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Custo unit.</th>
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Total</th>
              <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Incluir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {fields.map((field, idx) => {
              const item = itens[idx]
              return (
                <tr key={field.id} className={item?.incluir ? '' : 'opacity-50'}>
                  <td className="px-3 py-2 text-muted-foreground max-w-[160px]">
                    <span className="truncate block" title={field.descricao}>{field.descricao}</span>
                  </td>
                  <td className="px-3 py-2 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <select
                        {...register(`itens.${idx}.insumoId`)}
                        className="flex-1 border border-border rounded px-1.5 py-1 text-xs bg-background"
                        onChange={(e) => {
                          setValue(`itens.${idx}.insumoId`, e.target.value)
                          const ing = insumos.find((i) => i.id === e.target.value)
                          setValue(`itens.${idx}.insumoNome`, ing?.name ?? '')
                        }}
                      >
                        <option value="">Selecione...</option>
                        {insumos.map((i) => (
                          <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                      </select>
                      <BadgeConfianca score={item?.scoreConfianca ?? 0} />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.001"
                      {...register(`itens.${idx}.quantidade`, { valueAsNumber: true })}
                      className="w-20 border border-border rounded px-1.5 py-1 text-xs text-right bg-background"
                    />
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{field.unidade}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      {...register(`itens.${idx}.custoUnitario`, { valueAsNumber: true })}
                      className="w-24 border border-border rounded px-1.5 py-1 text-xs text-right bg-background"
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    {((item?.quantidade ?? 0) * (item?.custoUnitario ?? 0)).toLocaleString('pt-BR', {
                      style: 'currency', currency: 'BRL',
                    })}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => setValue(`itens.${idx}.incluir`, !item?.incluir)}
                      className={`w-6 h-6 rounded-full border flex items-center justify-center mx-auto transition-colors ${
                        item?.incluir
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      {item?.incluir ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-4 bg-muted/30 border border-border rounded-lg">
        <div className="flex gap-6 text-sm text-muted-foreground">
          <span>Total de itens: <strong className="text-foreground">{itens.length}</strong></span>
          <span>Incluídos: <strong className="text-foreground">{itensIncluidos.length}</strong></span>
          <span>Valor total: <strong className="text-foreground">
            {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </strong></span>
        </div>
        <button
          type="submit"
          disabled={submitting || itensIncluidos.length === 0}
          className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Confirmar lançamento
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(app)/estoque/entrada-inteligente/components/"
git commit -m "feat(ui): add TabelaRevisaoNF editable component with confidence badges"
```

---

## Task 13: Page — notas-fiscais

**Files:**
- Create: `src/app/(app)/estoque/notas-fiscais/page.tsx`

- [ ] **Step 1: Add API route for NF listing**

Create `src/app/api/ai/nfs/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

export async function GET(req: NextRequest) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const { searchParams } = req.nextUrl
  const fornecedor = searchParams.get('fornecedor')
  const origem = searchParams.get('origem') as 'UPLOAD_IMAGEM' | 'UPLOAD_PDF' | 'TEXTO' | null
  const de = searchParams.get('de')
  const ate = searchParams.get('ate')

  const nfs = await prisma.nfProcessada.findMany({
    where: {
      tenantId,
      status: 'CONCLUIDA',
      ...(fornecedor && { fornecedorNome: { contains: fornecedor, mode: 'insensitive' } }),
      ...(origem && { origem }),
      ...(de && ate && { createdAt: { gte: new Date(de), lte: new Date(ate) } }),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true, createdAt: true, fornecedorNome: true, numeroNf: true,
      itensCriados: true, valorTotal: true, processadoPor: true, origem: true, cloudinaryUrl: true,
    },
  })

  return NextResponse.json(nfs)
}
```

- [ ] **Step 2: Implement notas-fiscais page**

Create `src/app/(app)/estoque/notas-fiscais/page.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface NfListItem {
  id: string
  createdAt: string
  fornecedorNome: string | null
  numeroNf: string | null
  itensCriados: number
  valorTotal: number | null
  processadoPor: string
  origem: 'UPLOAD_IMAGEM' | 'UPLOAD_PDF' | 'TEXTO'
  cloudinaryUrl: string | null
}

const ORIGEM_LABELS: Record<string, string> = {
  UPLOAD_IMAGEM: 'Imagem',
  UPLOAD_PDF: 'PDF',
  TEXTO: 'Texto',
}

export default function NotasFiscaisPage() {
  const [nfs, setNfs] = useState<NfListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroFornecedor, setFiltroFornecedor] = useState('')
  const [filtroOrigem, setFiltroOrigem] = useState('')

  async function carregar() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtroFornecedor) params.set('fornecedor', filtroFornecedor)
    if (filtroOrigem) params.set('origem', filtroOrigem)

    const res = await fetch(`/api/ai/nfs?${params}`)
    const data = await res.json() as NfListItem[]
    setNfs(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { carregar() }, [filtroFornecedor, filtroOrigem])

  async function reprocessar(nf: NfListItem) {
    if (!nf.cloudinaryUrl) return
    const res = await fetch('/api/ai/processar-nf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cloudinaryUrl: nf.cloudinaryUrl, nfOriginalId: nf.id }),
    })
    if (res.ok) {
      toast.success('NF enviada para reprocessamento')
    } else {
      toast.error('Erro ao reprocessar NF')
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Notas Fiscais</h1>
        <button onClick={carregar} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <input
          value={filtroFornecedor}
          onChange={(e) => setFiltroFornecedor(e.target.value)}
          placeholder="Filtrar por fornecedor..."
          className="border border-border rounded-md px-3 py-1.5 text-sm bg-background w-56"
        />
        <select
          value={filtroOrigem}
          onChange={(e) => setFiltroOrigem(e.target.value)}
          className="border border-border rounded-md px-3 py-1.5 text-sm bg-background"
        >
          <option value="">Todas as origens</option>
          <option value="UPLOAD_IMAGEM">Imagem</option>
          <option value="UPLOAD_PDF">PDF</option>
          <option value="TEXTO">Texto</option>
        </select>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Data</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Fornecedor</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Nº NF</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Itens</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Valor total</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Origem</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                  Carregando...
                </td>
              </tr>
            ) : nfs.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                  Nenhuma nota fiscal encontrada
                </td>
              </tr>
            ) : (
              nfs.map((nf) => (
                <tr key={nf.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {format(new Date(nf.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </td>
                  <td className="px-4 py-2.5">{nf.fornecedorNome ?? '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{nf.numeroNf ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right">{nf.itensCriados}</td>
                  <td className="px-4 py-2.5 text-right">
                    {nf.valorTotal != null
                      ? Number(nf.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      IA · {ORIGEM_LABELS[nf.origem]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {nf.cloudinaryUrl && (
                      <button
                        onClick={() => reprocessar(nf)}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 ml-auto"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Reprocessar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ai/nfs/ "src/app/(app)/estoque/notas-fiscais/"
git commit -m "feat(ui): add notas-fiscais listing page with filters and reprocess"
```

---

## Task 14: Component — ChatEstoque (Floating Drawer)

**Files:**
- Create: `src/app/(app)/estoque/components/ChatEstoque.tsx`

- [ ] **Step 1: Add route for usage info**

Create `src/app/api/ai/usage/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getTenantId, unauthorizedResponse } from '@/lib/session'
import { buscarUso } from '@/services/ai/ai-usage.service'

export async function GET() {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()
  const usage = await buscarUso(tenantId)
  return NextResponse.json(usage ?? { tokensInput: 0, tokensOutput: 0, limiteTokens: 0 })
}
```

- [ ] **Step 2: Implement ChatEstoque**

Create `src/app/(app)/estoque/components/ChatEstoque.tsx`:

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2 } from 'lucide-react'

interface Mensagem {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

interface AiUsageInfo {
  tokensInput: number
  tokensOutput: number
  limiteTokens: number
}

export function ChatEstoque() {
  const [aberto, setAberto] = useState(false)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [usage, setUsage] = useState<AiUsageInfo | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/ai/usage')
      .then((r) => r.json() as Promise<AiUsageInfo>)
      .then(setUsage)
  }, [aberto])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  const limiteBloqueado =
    usage !== null && usage.limiteTokens > 0 &&
    usage.tokensInput + usage.tokensOutput >= usage.limiteTokens

  const percentualUso =
    usage && usage.limiteTokens > 0
      ? Math.min(Math.round(((usage.tokensInput + usage.tokensOutput) / usage.limiteTokens) * 100), 100)
      : 0

  async function enviar() {
    const texto = input.trim()
    if (!texto || streaming || limiteBloqueado) return

    setInput('')
    setMensagens((prev) => [...prev, { role: 'user', content: texto }])
    setStreaming(true)

    setMensagens((prev) => [...prev, { role: 'assistant', content: '', streaming: true }])

    const source = new EventSource(`/api/ai/chat-estoque?mensagem=${encodeURIComponent(texto)}`)

    source.onmessage = (e) => {
      if (e.data === '[DONE]') {
        source.close()
        setStreaming(false)
        setMensagens((prev) =>
          prev.map((m, i) => (i === prev.length - 1 ? { ...m, streaming: false } : m))
        )
        return
      }

      try {
        const { text, erro } = JSON.parse(e.data) as { text?: string; erro?: string }
        if (erro) {
          source.close()
          setStreaming(false)
          setMensagens((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: erro, streaming: false } : m
            )
          )
          return
        }
        if (text) {
          setMensagens((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: m.content + text } : m
            )
          )
        }
      } catch { /* ignore parse errors */ }
    }

    source.onerror = () => {
      source.close()
      setStreaming(false)
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
        title="Assistente de estoque"
      >
        <MessageCircle className="w-5 h-5" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[520px] bg-background border border-border rounded-xl shadow-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Assistente de Estoque</span>
        </div>
        <button
          onClick={() => setAberto(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {mensagens.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-8">
            Pergunte sobre seu estoque, movimentações ou alertas.
          </p>
        )}
        {mensagens.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              {msg.content}
              {msg.streaming && (
                <span className="inline-block w-1 h-4 bg-current ml-0.5 animate-pulse" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div className="border-t border-border p-3 space-y-2">
        {limiteBloqueado ? (
          <p className="text-xs text-destructive text-center">
            Limite mensal de IA atingido. Disponível no próximo mês.
          </p>
        ) : (
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && enviar()}
              placeholder="Pergunte sobre o estoque..."
              disabled={streaming}
              className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            <button
              onClick={enviar}
              disabled={!input.trim() || streaming}
              className="w-8 h-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center disabled:opacity-50"
            >
              {streaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
        {usage && usage.limiteTokens > 0 && (
          <div className="space-y-1">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  percentualUso >= 100 ? 'bg-destructive' : percentualUso >= 80 ? 'bg-yellow-500' : 'bg-primary'
                }`}
                style={{ width: `${percentualUso}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-right">
              {percentualUso}% do limite mensal usado
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add ChatEstoque to the stock layout**

Find the stock layout file (likely `src/app/(app)/estoque/layout.tsx` or the main app layout). Import and add `<ChatEstoque />` at the end of the layout body so it appears on all stock pages.

If a stock-specific layout doesn't exist, create `src/app/(app)/estoque/layout.tsx`:

```tsx
import { ChatEstoque } from './components/ChatEstoque'

export default function EstoqueLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ChatEstoque />
    </>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ai/usage/ "src/app/(app)/estoque/"
git commit -m "feat(ui): add ChatEstoque floating drawer with SSE streaming"
```

---

## Task 15: Run All Tests

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS (including existing tests + the 3 new test files).

- [ ] **Step 2: TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Final commit if there are fixes**

```bash
git add -A
git commit -m "fix: resolve any type errors from AI feature implementation"
```

---

## Dependency Order

```
Task 1 (deps)
  → Task 2 (schema)
    → Task 3 (ai-usage service)
      → Task 4 (ai-limit middleware)
        → Task 5 (cloudinary + nf-processor service)
          → Task 6 (estoque-chat service)
            → Task 7 (jobs + server.ts)
              → Task 8 (processar-nf + nf-status routes)
              → Task 9 (chat-estoque route)
              → Task 10 (entrada-lote route)
                → Task 11 (entrada-inteligente page)
                  → Task 12 (TabelaRevisaoNF)
                → Task 13 (notas-fiscais page)
                → Task 14 (ChatEstoque)
                  → Task 15 (tests + typecheck)
```
