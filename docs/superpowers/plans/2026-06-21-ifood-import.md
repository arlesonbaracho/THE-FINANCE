# Import do cardápio iFood → sistema (Sub-projeto E) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar os itens do cardápio do iFood para o sistema como produtos, via uma tela de pré-visualização + confirmação com de-para por similaridade, reusando catálogo/auth/IFoodItemMap já existentes.

**Architecture:** Um helper compartilhado `melhorMatchPorNome` (extraído do nf-processor). Um serviço de import (`preparar`/`confirmar`) que reusa `listarItensCatalogo` + `IFoodItemMap` e cria `Product`/`Category`. Rotas admin + UI de preview.

**Tech Stack:** Next.js 14, Prisma 7, TypeScript, Vitest 4, fast-levenshtein (já no projeto).

## Global Constraints

- Apenas tokens `--tf-*` em UI nova (sem cores hardcoded/Tailwind color classes).
- Rotas admin/MANAGER-only (ADMIN/SUPER_ADMIN/MANAGER); todas as queries por `tenantId`.
- Sem novas dependências.
- Idempotência: `IFoodItemMap @@unique[tenantId, ifoodItemId]`; nunca sobrescrever produtos existentes.
- ⚠️ Verificação end-to-end (Task 5, passo final) requer uma `IFoodIntegration` CONECTADA — unit tests cobrem tudo com mocks.

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `src/lib/match-nome.ts` (+teste) | criar |
| `src/services/ai/nf-processor.service.ts` | refatorar `enriquecerItens` p/ usar o helper |
| `src/services/integrations/ifood/ifood-import.service.ts` (+testes) | criar |
| `src/app/api/integracoes/ifood/cardapio/preview/route.ts`, `importar/route.ts` | criar |
| `src/app/(dashboard)/...` UI import iFood | criar/editar |

---

## Task 1: Helper de similaridade compartilhado (TDD)

**Files:** Create `src/lib/match-nome.ts`, `src/lib/__tests__/match-nome.test.ts`; Modify `src/services/ai/nf-processor.service.ts`

**Interfaces:**
- Produces: `melhorMatchPorNome(termo: string, candidatos: { id: string; name: string }[]): { id: string; name: string; score: number } | null`

- [ ] **Step 1: Teste** (`src/lib/__tests__/match-nome.test.ts`)
```typescript
import { describe, it, expect } from 'vitest'
import { melhorMatchPorNome } from '../match-nome'

describe('melhorMatchPorNome', () => {
  it('retorna null para lista vazia', () => {
    expect(melhorMatchPorNome('arroz', [])).toBeNull()
  })
  it('acha o melhor candidato com score alto para nome igual', () => {
    const r = melhorMatchPorNome('Arroz', [{ id: '1', name: 'Arroz' }, { id: '2', name: 'Feijão' }])
    expect(r?.id).toBe('1')
    expect(r?.score).toBe(100)
  })
  it('escolhe o mais parecido entre vários', () => {
    const r = melhorMatchPorNome('X-Burguer', [{ id: '1', name: 'Refrigerante' }, { id: '2', name: 'X-Burger' }])
    expect(r?.id).toBe('2')
    expect(r!.score).toBeGreaterThan(80)
  })
})
```

- [ ] **Step 2: Run, confirm FAIL**
```bash
npx vitest run src/lib/__tests__/match-nome.test.ts
```

- [ ] **Step 3: Implementar `src/lib/match-nome.ts`**
```typescript
import levenshtein from 'fast-levenshtein'

export function melhorMatchPorNome(
  termo: string,
  candidatos: { id: string; name: string }[],
): { id: string; name: string; score: number } | null {
  if (candidatos.length === 0) return null
  const t = termo.toLowerCase()
  const scored = candidatos.map((c) => {
    const name = c.name.toLowerCase()
    const dist = levenshtein.get(t, name)
    const maxLen = Math.max(t.length, name.length)
    const score = maxLen === 0 ? 0 : Math.round((1 - dist / maxLen) * 100)
    return { id: c.id, name: c.name, score: Math.max(0, Math.min(100, score)) }
  })
  return scored.sort((a, b) => b.score - a.score)[0]
}
```

- [ ] **Step 4: Run green**
```bash
npx vitest run src/lib/__tests__/match-nome.test.ts
```

- [ ] **Step 5: Refatorar `enriquecerItens` para usar o helper**

Em `src/services/ai/nf-processor.service.ts`: importar `melhorMatchPorNome` de `@/lib/match-nome`. Dentro de `enriquecerItens`, substituir o bloco que calcula `scored`/`best` por:
```typescript
    const best = melhorMatchPorNome(item.descricao, ingredients)
    const insumoId = best?.id ?? null
    const insumoNome = best?.name ?? null
    const scoreConfianca = best?.score ?? 0
    return { ...item, insumoId, insumoNome, scoreConfianca }
```
Manter o early-return quando `ingredients.length === 0` (retorna itens com `insumoId: null`). Remover o `import levenshtein` se não for mais usado no arquivo.

- [ ] **Step 6: Rodar a suíte (o refactor não pode quebrar os testes do NF)**
```bash
npx tsc --noEmit
npm test
```
Esperado: tudo verde (os testes existentes de `nf-processor`/`enriquecerItens` continuam passando).

- [ ] **Step 7: Commit**
```bash
git add src/lib/match-nome.ts src/lib/__tests__/match-nome.test.ts src/services/ai/nf-processor.service.ts
git commit -m "feat(lib): shared melhorMatchPorNome helper + reuse in nf-processor"
```

---

## Task 2: Serviço de import iFood (TDD)

**Files:** Create `src/services/integrations/ifood/ifood-import.service.ts`, `src/services/integrations/ifood/__tests__/ifood-import.service.test.ts`

**Interfaces:**
- Consumes: `listarItensCatalogo` (injetável), `melhorMatchPorNome`, prisma.
- Produces:
  `ItemPreview = { ifoodItemId: string; ifoodItemNome: string; preco: number; categoriaNome: string | null; sugestao: 'mapeado'|'casar'|'criar'; produtoSugeridoId: string | null; score: number | null }`;
  `DecisaoImport = { ifoodItemId: string; ifoodItemNome: string; preco: number; categoriaNome: string | null; acao: 'criar'|'casar'|'ignorar'; produtoId?: string }`;
  `prepararImportacaoCardapio(tenantId: string, carregarCatalogo?): Promise<ItemPreview[]>`;
  `confirmarImportacaoCardapio(tenantId: string, decisoes: DecisaoImport[]): Promise<{ criados: number; mapeados: number }>`.

- [ ] **Step 1: Teste** (`__tests__/ifood-import.service.test.ts`)
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    iFoodItemMap: { findMany: vi.fn(), upsert: vi.fn() },
    product: { findMany: vi.fn(), create: vi.fn() },
    category: { findUnique: vi.fn(), create: vi.fn() },
  },
}))

import { prepararImportacaoCardapio, confirmarImportacaoCardapio } from '../ifood-import.service'
import { prisma } from '@/lib/prisma'

const mp = prisma as any
const catalogo = [
  { id: 'i1', name: 'X-Burger', price: 20, available: true, categoryName: 'Lanches' },
  { id: 'i2', name: 'Coca 350ml', price: 6, available: true, categoryName: 'Bebidas' },
]

describe('prepararImportacaoCardapio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mp.iFoodItemMap.findMany.mockResolvedValue([{ ifoodItemId: 'i1', produtoId: 'p1' }])
    mp.product.findMany.mockResolvedValue([{ id: 'p1', name: 'X-Burger' }, { id: 'p9', name: 'Suco' }])
  })
  it('classifica mapeado / casar / criar', async () => {
    const r = await prepararImportacaoCardapio('t1', async () => catalogo as any)
    const i1 = r.find((x) => x.ifoodItemId === 'i1')!
    const i2 = r.find((x) => x.ifoodItemId === 'i2')!
    expect(i1.sugestao).toBe('mapeado')
    expect(i2.sugestao).toBe('criar') // 'Coca 350ml' não casa bem com 'X-Burger'/'Suco'
  })
})

describe('confirmarImportacaoCardapio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mp.category.findUnique.mockResolvedValue(null)
    mp.category.create.mockResolvedValue({ id: 'cat1' })
    mp.product.create.mockResolvedValue({ id: 'pnew' })
    mp.iFoodItemMap.upsert.mockResolvedValue({})
  })
  it('cria categoria + produto + map para acao=criar', async () => {
    const r = await confirmarImportacaoCardapio('t1', [
      { ifoodItemId: 'i2', ifoodItemNome: 'Coca 350ml', preco: 6, categoriaNome: 'Bebidas', acao: 'criar' },
    ])
    expect(mp.category.create).toHaveBeenCalled()
    expect(mp.product.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'Coca 350ml', salePrice: 6, tenantId: 't1', categoryId: 'cat1' }),
    }))
    expect(mp.iFoodItemMap.upsert).toHaveBeenCalled()
    expect(r.criados).toBe(1)
  })
  it('apenas grava map para acao=casar', async () => {
    const r = await confirmarImportacaoCardapio('t1', [
      { ifoodItemId: 'i3', ifoodItemNome: 'Batata', preco: 12, categoriaNome: null, acao: 'casar', produtoId: 'pX' },
    ])
    expect(mp.product.create).not.toHaveBeenCalled()
    expect(mp.iFoodItemMap.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ produtoId: 'pX', ifoodItemId: 'i3' }),
    }))
    expect(r.mapeados).toBe(1)
  })
})
```

- [ ] **Step 2: Run, confirm FAIL**
```bash
npx vitest run src/services/integrations/ifood/__tests__/ifood-import.service.test.ts
```

- [ ] **Step 3: Implementar `ifood-import.service.ts`**
```typescript
import { prisma } from '@/lib/prisma'
import { listarItensCatalogo, type IFoodItem } from './ifood-catalog.service'
import { melhorMatchPorNome } from '@/lib/match-nome'

const LIMIAR_CASAR = 80

export type ItemPreview = {
  ifoodItemId: string
  ifoodItemNome: string
  preco: number
  categoriaNome: string | null
  sugestao: 'mapeado' | 'casar' | 'criar'
  produtoSugeridoId: string | null
  score: number | null
}
export type DecisaoImport = {
  ifoodItemId: string
  ifoodItemNome: string
  preco: number
  categoriaNome: string | null
  acao: 'criar' | 'casar' | 'ignorar'
  produtoId?: string
}

type CarregarCatalogo = (tenantId: string) => Promise<IFoodItem[]>

export async function prepararImportacaoCardapio(
  tenantId: string,
  carregarCatalogo: CarregarCatalogo = listarItensCatalogo,
): Promise<ItemPreview[]> {
  const [itens, maps, produtos] = await Promise.all([
    carregarCatalogo(tenantId),
    prisma.iFoodItemMap.findMany({ where: { tenantId }, select: { ifoodItemId: true, produtoId: true } }),
    prisma.product.findMany({ where: { tenantId }, select: { id: true, name: true } }),
  ])
  const mapeados = new Map(maps.filter((m) => m.produtoId).map((m) => [m.ifoodItemId, m.produtoId as string]))

  return itens.map((it) => {
    if (mapeados.has(it.id)) {
      return { ifoodItemId: it.id, ifoodItemNome: it.name, preco: it.price, categoriaNome: it.categoryName ?? null, sugestao: 'mapeado', produtoSugeridoId: mapeados.get(it.id)!, score: null }
    }
    const best = melhorMatchPorNome(it.name, produtos)
    const casar = best && best.score >= LIMIAR_CASAR
    return {
      ifoodItemId: it.id, ifoodItemNome: it.name, preco: it.price, categoriaNome: it.categoryName ?? null,
      sugestao: casar ? 'casar' : 'criar',
      produtoSugeridoId: casar ? best!.id : null,
      score: best?.score ?? null,
    }
  })
}

async function resolverCategoria(tenantId: string, nome: string | null): Promise<string | null> {
  if (!nome) return null
  const existente = await prisma.category.findUnique({
    where: { name_type_tenantId: { name: nome, type: 'PRODUCT', tenantId } },
  })
  if (existente) return existente.id
  const nova = await prisma.category.create({ data: { name: nome, type: 'PRODUCT', tenantId } })
  return nova.id
}

export async function confirmarImportacaoCardapio(
  tenantId: string,
  decisoes: DecisaoImport[],
): Promise<{ criados: number; mapeados: number }> {
  let criados = 0
  let mapeados = 0
  for (const d of decisoes) {
    if (d.acao === 'ignorar') continue
    if (d.acao === 'criar') {
      const categoryId = await resolverCategoria(tenantId, d.categoriaNome)
      const produto = await prisma.product.create({
        data: { name: d.ifoodItemNome, salePrice: d.preco, tenantId, ...(categoryId ? { categoryId } : {}) },
      })
      await prisma.iFoodItemMap.upsert({
        where: { tenantId_ifoodItemId: { tenantId, ifoodItemId: d.ifoodItemId } },
        create: { tenantId, ifoodItemId: d.ifoodItemId, ifoodItemNome: d.ifoodItemNome, produtoId: produto.id },
        update: { produtoId: produto.id },
      })
      criados++
    } else if (d.acao === 'casar' && d.produtoId) {
      await prisma.iFoodItemMap.upsert({
        where: { tenantId_ifoodItemId: { tenantId, ifoodItemId: d.ifoodItemId } },
        create: { tenantId, ifoodItemId: d.ifoodItemId, ifoodItemNome: d.ifoodItemNome, produtoId: d.produtoId },
        update: { produtoId: d.produtoId },
      })
      mapeados++
    }
  }
  return { criados, mapeados }
}
```
> Confirmar o nome do índice composto do `IFoodItemMap` (`tenantId_ifoodItemId`) e do `Category` (`name_type_tenantId`) no client gerado do Prisma; ajustar se divergir.

- [ ] **Step 4: Run green + tsc + commit**
```bash
npx vitest run src/services/integrations/ifood/__tests__/ifood-import.service.test.ts
npx tsc --noEmit
git add src/services/integrations/ifood/ifood-import.service.ts src/services/integrations/ifood/__tests__/ifood-import.service.test.ts
git commit -m "feat(ifood): menu import service (preview + confirm de-para)"
```

---

## Task 3: Rotas (preview + importar)

**Files:** Create `src/app/api/integracoes/ifood/cardapio/preview/route.ts`, `src/app/api/integracoes/ifood/cardapio/importar/route.ts`

- [ ] **Step 1: `preview/route.ts`** (GET, admin/MANAGER, exige integração CONECTADA)
```typescript
import { NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { prepararImportacaoCardapio } from '@/services/integrations/ifood/ifood-import.service'

export async function GET() {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const role = session.user.role
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN' && role !== 'MANAGER')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const integ = await prisma.iFoodIntegration.findUnique({ where: { tenantId: session.user.tenantId }, select: { status: true } })
  if (integ?.status !== 'CONECTADO') return NextResponse.json({ error: 'Integração iFood não conectada' }, { status: 409 })
  try {
    const preview = await prepararImportacaoCardapio(session.user.tenantId)
    return NextResponse.json(preview)
  } catch (err) {
    console.error('[ifood-cardapio-preview]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Falha ao buscar o cardápio do iFood' }, { status: 502 })
  }
}
```

- [ ] **Step 2: `importar/route.ts`** (POST `{ decisoes }`, admin/MANAGER)
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { confirmarImportacaoCardapio } from '@/services/integrations/ifood/ifood-import.service'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const role = session.user.role
  if (role !== 'ADMIN' && role !== 'SUPER_ADMIN' && role !== 'MANAGER')
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  const { decisoes } = await req.json()
  if (!Array.isArray(decisoes)) return NextResponse.json({ error: 'decisoes inválidas' }, { status: 400 })
  try {
    const r = await confirmarImportacaoCardapio(session.user.tenantId, decisoes)
    return NextResponse.json(r)
  } catch (err) {
    console.error('[ifood-cardapio-importar]', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Falha ao importar o cardápio' }, { status: 502 })
  }
}
```

- [ ] **Step 3: Verify + commit**
```bash
npx tsc --noEmit && npm test
git add src/app/api/integracoes/ifood/cardapio
git commit -m "feat(ifood): cardapio preview + import routes (admin/manager)"
```

---

## Task 4: UI de import

**Files:** Create/modify under `src/app/(dashboard)/` (find the iFood integration page; usar `--tf-*`)

- [ ] **Step 1: Tela de import** — Localizar a página de integração iFood (procurar por `integracoes/ifood` em `src/app/(dashboard)`). Adicionar um botão "Importar cardápio do iFood" que faz `GET /api/integracoes/ifood/cardapio/preview` e abre uma tabela: por linha, nome iFood + preço + categoria + um seletor de **ação** (`mapeado` read-only; `casar` com `<select>` de produtos pré-selecionado pelo `produtoSugeridoId`; `criar`; `ignorar`). Carregar a lista de produtos (`GET /api/products`) para o `<select>` do "casar". Botão "Importar selecionados" → `POST /api/integracoes/ifood/cardapio/importar` com `{ decisoes }` (montadas do estado), `toast` com `{ criados, mapeados }`, invalida a query de produtos. Tratar 409 (integração não conectada) com mensagem clara. Tokens `--tf-*`. Admin/MANAGER (esconder para outros papéis, mas a API já protege).

- [ ] **Step 2: Verify + commit**
```bash
npx tsc --noEmit && npx next lint
git add ...
git commit -m "feat(ifood): menu import preview/confirm UI"
```

---

## Task 5: Verificação + segurança (+ E2E bloqueado)

**Files:** nenhum (verificação)

- [ ] **Step 1: Suíte + tipos + lint + audit**
```bash
npm test
npx tsc --noEmit
npx next lint
npm audit --omit=dev
```
Esperado: verde; sem vuln nova (sem dependência adicionada).

- [ ] **Step 2: Checklist de segurança**
- Rotas preview/importar admin/MANAGER-only; queries por `tenantId`.
- `IFoodItemMap @@unique` → idempotente, sem duplicar mapeamento.
- Produtos existentes nunca sobrescritos.
- Exige integração CONECTADA (409 caso contrário).

- [ ] **Step 3: ⚠️ E2E (BLOQUEADO)** — Com uma `IFoodIntegration` CONECTADA (token válido), abrir a tela, conferir que o catálogo real carrega, sugestões fazem sentido, "criar"/"casar"/"ignorar" funcionam, e reimportar é idempotente. Ajustar o parsing em `listarItensCatalogo`/serviço apenas se o payload real divergir.

---

## Self-Review

**Cobertura do spec:**
- [x] Helper compartilhado + reuso no nf-processor → Task 1
- [x] Serviço preview/confirm com de-para e categoria → Task 2
- [x] Rotas admin/MANAGER + exige CONECTADO → Task 3
- [x] UI de preview/confirm → Task 4
- [x] Segurança/testes/E2E bloqueado → Task 5

**Placeholders:** Núcleos (helper, serviço, rotas) com código completo. Task 4 referencia a página de integração existente (a localizar) por ser UI em arquivo a inspecionar — integração descrita.

**Consistência de tipos:** `ItemPreview`/`DecisaoImport` definidos na Task 2 e consumidos pelas rotas (Task 3) e UI (Task 4). `melhorMatchPorNome` (Task 1) usado no serviço (Task 2). Índices compostos do Prisma (`tenantId_ifoodItemId`, `name_type_tenantId`) a confirmar no client gerado.
