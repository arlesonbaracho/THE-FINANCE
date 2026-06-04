# Agente 4 · Parte 1 — Schema, Auth & Middleware

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar os modelos Prisma do módulo Multi-Unidade, estender a sessão NextAuth com `brandId` e proteger as rotas `/rede/*` no middleware.

**Architecture:** Schema-first — primeiro migramos o banco, depois atualizamos a sessão para carregar `brandId` do tenant, e por fim adicionamos o helper `checkMultiUnitFeature` e a proteção de rota.

**Tech Stack:** Prisma, Next.js 14 App Router, NextAuth JWT, TypeScript, Vitest

---

## Mapa de arquivos

| Ação | Arquivo |
|------|---------|
| Modificar | `prisma/schema.prisma` |
| Criar | `prisma/migrations/` (auto-gerado via `prisma migrate dev`) |
| Criar | `src/lib/check-multi-unit.ts` |
| Modificar | `src/lib/auth.ts` |
| Modificar | `src/middleware.ts` |
| Criar | `src/lib/__tests__/check-multi-unit.test.ts` |

---

## Task 1: Schema Prisma — modelos Agent 4

**Arquivos:**
- Modificar: `prisma/schema.prisma`

- [ ] **Passo 1: Adicionar campos a `Tenant`**

Abrir `prisma/schema.prisma`. Localizar o model `Tenant` (começa na linha onde aparece `model Tenant {`). Adicionar os três campos e a relação **antes** da última chave `}`:

```prisma
  brandId          String?
  isHeadquarters   Boolean  @default(false)
  brand            Brand?   @relation(fields: [brandId], references: [id])
  produtoOverrides ProdutoOverride[]
```

- [ ] **Passo 2: Adicionar campos a `Product`**

Localizar `model Product {`. Adicionar antes da última `}`:

```prisma
  brandId   String?
  isShared  Boolean   @default(false)
  brand     Brand?    @relation(fields: [brandId], references: [id])
  overrides ProdutoOverride[]
```

- [ ] **Passo 3: Adicionar model `Brand`**

Adicionar após os models de `Plan`:

```prisma
// ── Multi-Unidade ─────────────────────────────────────────────────────────────

model Brand {
  id             String          @id @default(cuid())
  nome           String
  slug           String          @unique
  logoUrl        String?
  adminUserId    String
  planId         String
  createdAt      DateTime        @default(now())
  unidades       Tenant[]
  admin          User            @relation("BrandAdmin", fields: [adminUserId], references: [id])
  plan           Plan            @relation(fields: [planId], references: [id])
  purchaseOrders PurchaseOrder[]

  @@index([adminUserId])
}
```

- [ ] **Passo 4: Adicionar `PurchaseOrder`, `PurchaseOrderItem`, enum e `ProdutoOverride`**

Adicionar logo após o model `Brand`:

```prisma
model PurchaseOrder {
  id           String              @id @default(cuid())
  brandId      String
  status       PurchaseOrderStatus @default(RASCUNHO)
  fornecedorId String
  valorTotal   Decimal             @default(0)
  createdBy    String
  createdAt    DateTime            @default(now())
  brand        Brand               @relation(fields: [brandId], references: [id])
  fornecedor   Supplier            @relation("PurchaseOrderFornecedor", fields: [fornecedorId], references: [id])
  itens        PurchaseOrderItem[]
  criador      User                @relation("PurchaseOrderCriador", fields: [createdBy], references: [id])

  @@index([brandId])
  @@index([fornecedorId])
}

enum PurchaseOrderStatus {
  RASCUNHO
  ENVIADO
  RECEBIDO
}

model PurchaseOrderItem {
  id                     String        @id @default(cuid())
  purchaseOrderId        String
  insumoId               String
  quantidadeTotal        Decimal
  unidadeMedida          String
  custoUnitarioEstimado  Decimal?
  distribuicaoPorUnidade Json
  purchaseOrder          PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  insumo                 Ingredient    @relation(fields: [insumoId], references: [id])

  @@index([purchaseOrderId])
  @@index([insumoId])
}

model ProdutoOverride {
  id        String   @id @default(cuid())
  tenantId  String
  produtoId String
  preco     Decimal?
  ativo     Boolean  @default(true)
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  produto   Product  @relation(fields: [produtoId], references: [id], onDelete: Cascade)

  @@unique([tenantId, produtoId])
  @@index([tenantId])
  @@index([produtoId])
}
```

- [ ] **Passo 5: Adicionar relações inversas em `User` e `Supplier`**

No model `User`, adicionar antes da última `}`:
```prisma
  brandsAdmin        Brand[]         @relation("BrandAdmin")
  purchaseOrdersCriados PurchaseOrder[] @relation("PurchaseOrderCriador")
```

No model `Supplier`, adicionar antes da última `}`:
```prisma
  purchaseOrders PurchaseOrder[] @relation("PurchaseOrderFornecedor")
```

No model `Ingredient`, adicionar antes da última `}`:
```prisma
  purchaseOrderItems PurchaseOrderItem[]
```

No model `Plan`, adicionar antes da última `}`:
```prisma
  brands Brand[]
```

- [ ] **Passo 6: Executar migração**

```bash
npx prisma migrate dev --name add_multi_unit_models
```

Saída esperada: `✔  Generated Prisma Client` e nome da migration impresso.

- [ ] **Passo 7: Confirmar que o cliente foi gerado**

```bash
npx prisma generate
```

Saída esperada: `✔  Generated Prisma Client`.

- [ ] **Passo 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add Brand, PurchaseOrder, ProdutoOverride models for multi-unit"
```

---

## Task 2: Helper `checkMultiUnitFeature`

> Usa `parsePlanFeatures` (já existe em `src/lib/plan-features.ts`) para checar `features.multiUnit === true`. Mais robusto do que checar o nome do plano.

**Arquivos:**
- Criar: `src/lib/check-multi-unit.ts`
- Criar: `src/lib/__tests__/check-multi-unit.test.ts`

- [ ] **Passo 1: Escrever o teste (deve falhar)**

Criar `src/lib/__tests__/check-multi-unit.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenantSubscription: {
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { checkMultiUnitFeature } from '../check-multi-unit'

const p = prisma as unknown as {
  tenantSubscription: { findUnique: ReturnType<typeof vi.fn> }
}

beforeEach(() => { vi.clearAllMocks() })

describe('checkMultiUnitFeature', () => {
  it('lança 403 quando tenant não tem assinatura', async () => {
    p.tenantSubscription.findUnique.mockResolvedValue(null)
    await expect(checkMultiUnitFeature('t-1')).rejects.toMatchObject({ status: 403 })
  })

  it('lança 403 quando plano não tem multiUnit', async () => {
    p.tenantSubscription.findUnique.mockResolvedValue({
      plan: { features: { multiUnit: false, aiAgent: false, advancedReports: false, prioritySupport: false, exportReports: false } },
    })
    await expect(checkMultiUnitFeature('t-1')).rejects.toMatchObject({ status: 403 })
  })

  it('resolve sem erro quando multiUnit está habilitado', async () => {
    p.tenantSubscription.findUnique.mockResolvedValue({
      plan: { features: { multiUnit: true, aiAgent: false, advancedReports: false, prioritySupport: false, exportReports: false } },
    })
    await expect(checkMultiUnitFeature('t-1')).resolves.toBeUndefined()
  })
})
```

- [ ] **Passo 2: Executar teste para confirmar falha**

```bash
npx vitest run src/lib/__tests__/check-multi-unit.test.ts
```

Saída esperada: `FAIL` com `Cannot find module '../check-multi-unit'`.

- [ ] **Passo 3: Implementar o helper**

Criar `src/lib/check-multi-unit.ts`:

```ts
import { prisma } from '@/lib/prisma'
import { parsePlanFeatures } from '@/lib/plan-features'

export class MultiUnitForbiddenError extends Error {
  readonly status = 403
  constructor() {
    super('Funcionalidade Multi-Unidade não disponível no seu plano.')
  }
}

export async function checkMultiUnitFeature(tenantId: string): Promise<void> {
  const sub = await prisma.tenantSubscription.findUnique({
    where: { tenantId },
    include: { plan: true },
  })

  const features = parsePlanFeatures(sub?.plan?.features)
  if (!features.multiUnit) {
    throw new MultiUnitForbiddenError()
  }
}
```

- [ ] **Passo 4: Executar teste para confirmar aprovação**

```bash
npx vitest run src/lib/__tests__/check-multi-unit.test.ts
```

Saída esperada: `✓ 3 tests passed`.

- [ ] **Passo 5: Commit**

```bash
git add src/lib/check-multi-unit.ts src/lib/__tests__/check-multi-unit.test.ts
git commit -m "feat(lib): add checkMultiUnitFeature helper"
```

---

## Task 3: Estender sessão NextAuth com `brandId`

**Arquivos:**
- Modificar: `src/lib/auth.ts`
- Modificar: `src/types/next-auth.d.ts` (ou onde estiver a declaração de tipos da sessão)

- [ ] **Passo 1: Localizar a declaração de tipos de sessão**

```bash
grep -r "tenantId" src/types/ 2>/dev/null || grep -r "declare module.*next-auth" src/ --include="*.d.ts" -l
```

Se não houver arquivo de tipos, criar `src/types/next-auth.d.ts`.

- [ ] **Passo 2: Adicionar `brandId` à interface do usuário de sessão**

No arquivo de tipos encontrado (ou criado), garantir que contenha:

```ts
import NextAuth, { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
      tenantId: string
      tenantName: string
      brandId?: string | null
      customRoleId?: string
      avatarUrl?: string
      subscriptionStatus?: string | null
      trialEndsAt?: string | null
      planFeatures?: unknown
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
    tenantId?: string
    tenantName?: string
    brandId?: string | null
    customRoleId?: string
    avatarUrl?: string
    subscriptionStatus?: string | null
    trialEndsAt?: string | null
    planFeatures?: unknown
    passwordChangedAt?: string | null
  }
}
```

- [ ] **Passo 3: Atualizar `authorize` em `src/lib/auth.ts` para incluir `brandId`**

Localizar o bloco `return { id: user.id, ... }` dentro do `authorize` (por volta da linha 110). Atualizar a query do `findUnique` para incluir o `brandId` do tenant:

```ts
// Na query findUnique, alterar o include para:
include: {
  tenant: {
    include: {
      subscription: { include: { plan: true } },
    },
  },
  customRole: true,
},
```

E no objeto de retorno, adicionar `brandId`:

```ts
return {
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  tenantId: user.tenantId,
  tenantName: user.tenant?.name,
  brandId: user.tenant?.brandId ?? null,      // ← novo
  customRoleId: user.customRoleId,
  avatarUrl: user.avatarUrl,
  subscriptionStatus: sub?.status ?? null,
  trialEndsAt: sub?.trialEndsAt?.toISOString() ?? null,
  planFeatures: sub?.plan?.features ?? null,
  passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
}
```

- [ ] **Passo 4: Propagar `brandId` no callback `jwt`**

No callback `jwt` (por volta da linha 128), dentro do bloco `if (user) { ... }`, adicionar:

```ts
token.brandId = (u as { brandId?: string | null }).brandId ?? null
```

- [ ] **Passo 5: Propagar `brandId` no callback `session`**

No callback `session`, adicionar:

```ts
session.user.brandId = token.brandId as string | null | undefined
```

- [ ] **Passo 6: Verificar que TypeScript compila**

```bash
npx tsc --noEmit
```

Saída esperada: sem erros relacionados a `brandId`.

- [ ] **Passo 7: Commit**

```bash
git add src/lib/auth.ts src/types/next-auth.d.ts
git commit -m "feat(auth): add brandId to NextAuth JWT and session"
```

---

## Task 4: Middleware — proteger `/rede/*`

**Arquivos:**
- Modificar: `src/middleware.ts`

- [ ] **Passo 1: Adicionar `/rede` aos prefixos protegidos**

Abrir `src/middleware.ts`. Localizar o array `PROTECTED_PREFIXES`. Adicionar `'/rede'`:

```ts
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/estoque',
  '/configuracoes',
  '/plano-bloqueado',
  '/rede',             // ← novo
]
```

- [ ] **Passo 2: Adicionar `/rede/:path*` ao matcher do config**

No objeto `config.matcher` no final do arquivo, adicionar:

```ts
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/estoque/:path*',
    '/configuracoes/:path*',
    '/plano-bloqueado/:path*',
    '/rede/:path*',              // ← novo
    '/auth/:path*',
    '/admin/:path*',
    '/recuperar-senha/:path*',
  ],
}
```

- [ ] **Passo 3: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Passo 4: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(middleware): protect /rede/* routes with NextAuth"
```

---

## Task 5: Layout pass-through para `/rede`

**Arquivos:**
- Criar: `src/app/(dashboard)/rede/layout.tsx`

- [ ] **Passo 1: Criar layout da rede**

Criar `src/app/(dashboard)/rede/layout.tsx`:

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function RedeLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.brandId) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
```

- [ ] **Passo 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Passo 3: Commit**

```bash
git add src/app/(dashboard)/rede/layout.tsx
git commit -m "feat(rede): add layout guard — redirect non-brand users to /dashboard"
```

---

## Checklist final da Parte 1

- [ ] `npx prisma migrate status` — todas as migrations aplicadas
- [ ] `npx vitest run src/lib/__tests__/check-multi-unit.test.ts` — 3 testes passando
- [ ] `npx tsc --noEmit` — sem erros de TypeScript
