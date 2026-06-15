# Stripe Checkout — Webhook, Cleanup e Feedback de UX

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir ativação de assinatura pós-pagamento, remover código morto da abordagem antiga de Stripe Elements e adicionar feedback visual ao usuário ao retornar do Stripe Checkout.

**Architecture:** Três mudanças independentes nos mesmos dois arquivos. O webhook recebe o evento `checkout.session.completed` e persiste `stripeSubId` + ativa a assinatura. A página de assinatura perde ~80 linhas de código morto e ganha um `useEffect` que lê os query params de retorno do Stripe.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma 7, Stripe SDK v22, Vitest 4, Sonner (toast), TanStack Query v5.

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `src/services/payments/stripe.service.ts` | Modificar — adicionar case no `handleWebhook` |
| `src/services/payments/__tests__/stripe.service.test.ts` | Criar — testes do novo case |
| `src/app/(dashboard)/configuracoes/assinatura/page.tsx` | Modificar — remover código morto + adicionar useEffect |

---

## Task 1: Adicionar handler `checkout.session.completed` no webhook

**Files:**
- Modify: `src/services/payments/stripe.service.ts`
- Create: `src/services/payments/__tests__/stripe.service.test.ts`

- [ ] **Step 1: Criar o arquivo de teste com o caso falhando**

Crie `src/services/payments/__tests__/stripe.service.test.ts` com o conteúdo:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type Stripe from 'stripe'

// Mock do Prisma antes de importar o service
vi.mock('@/lib/prisma', () => ({
  prisma: {
    stripeCustomer: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    tenantSubscription: {
      update: vi.fn(),
    },
  },
}))

// Mock do Stripe SDK (o service cria uma instância no módulo)
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      customers: { create: vi.fn() },
      subscriptions: { update: vi.fn() },
      checkout: {
        sessions: { create: vi.fn() },
      },
      webhooks: { constructEvent: vi.fn() },
    })),
  }
})

import { handleWebhook } from '../stripe.service'
import { prisma } from '@/lib/prisma'

const mockPrisma = prisma as unknown as {
  stripeCustomer: { findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
  tenantSubscription: { update: ReturnType<typeof vi.fn> }
}

describe('handleWebhook — checkout.session.completed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.stripeCustomer.findFirst.mockResolvedValue({
      tenantId: 'tenant_abc',
      stripeCustomerId: 'cus_123',
      stripeSubId: null,
    })
    mockPrisma.stripeCustomer.update.mockResolvedValue({})
    mockPrisma.tenantSubscription.update.mockResolvedValue({})
  })

  it('ativa a assinatura e salva stripeSubId quando checkout é concluído', async () => {
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_123',
          subscription: 'sub_456',
          metadata: { tenantId: 'tenant_abc' },
        },
      },
    } as unknown as Stripe.Event

    await handleWebhook(event)

    expect(mockPrisma.stripeCustomer.findFirst).toHaveBeenCalledWith({
      where: { stripeCustomerId: 'cus_123' },
    })

    expect(mockPrisma.stripeCustomer.update).toHaveBeenCalledWith({
      where: { tenantId: 'tenant_abc' },
      data: { stripeSubId: 'sub_456' },
    })

    expect(mockPrisma.tenantSubscription.update).toHaveBeenCalledWith({
      where: { tenantId: 'tenant_abc' },
      data: expect.objectContaining({ status: 'ACTIVE' }),
    })
  })

  it('não chama update se customer não for encontrado no banco', async () => {
    mockPrisma.stripeCustomer.findFirst.mockResolvedValue(null)

    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_unknown',
          subscription: 'sub_456',
          metadata: {},
        },
      },
    } as unknown as Stripe.Event

    await handleWebhook(event)

    expect(mockPrisma.stripeCustomer.update).not.toHaveBeenCalled()
    expect(mockPrisma.tenantSubscription.update).not.toHaveBeenCalled()
  })

  it('não chama stripeCustomer.update quando não há subscription no evento', async () => {
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_123',
          subscription: null,
          metadata: {},
        },
      },
    } as unknown as Stripe.Event

    await handleWebhook(event)

    expect(mockPrisma.stripeCustomer.update).not.toHaveBeenCalled()
    expect(mockPrisma.tenantSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) })
    )
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx vitest run src/services/payments/__tests__/stripe.service.test.ts
```

Esperado: FAIL — `handleWebhook` não trata `checkout.session.completed`, então `stripeCustomer.update` nunca é chamado.

- [ ] **Step 3: Implementar o case no `handleWebhook`**

Abra `src/services/payments/stripe.service.ts`. No switch do `handleWebhook`, adicione o novo case **antes** do `case 'invoice.payment_succeeded'`:

```typescript
case 'checkout.session.completed': {
  const session = event.data.object as Stripe.Checkout.Session
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id
  if (!customerId) return

  const subId =
    typeof session.subscription === 'string'
      ? session.subscription
      : (session.subscription as Stripe.Subscription | null)?.id ?? null

  const customer = await prisma.stripeCustomer.findFirst({
    where: { stripeCustomerId: customerId },
  })
  if (!customer) return

  if (subId) {
    await prisma.stripeCustomer.update({
      where: { tenantId: customer.tenantId },
      data: { stripeSubId: subId },
    })
  }

  await prisma.tenantSubscription.update({
    where: { tenantId: customer.tenantId },
    data: {
      status: 'ACTIVE',
      startDate: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })
  break
}
```

O switch completo fica com essa ordem: `checkout.session.completed` → `invoice.payment_succeeded` → `invoice.payment_failed` → `customer.subscription.deleted`.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx vitest run src/services/payments/__tests__/stripe.service.test.ts
```

Esperado: 3 testes PASS.

- [ ] **Step 5: Rodar a suite completa para checar regressão**

```bash
npm test
```

Esperado: todos os testes passando (nenhuma regressão).

- [ ] **Step 6: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: 0 erros.

- [ ] **Step 7: Commit**

```bash
git add src/services/payments/stripe.service.ts src/services/payments/__tests__/stripe.service.test.ts
git commit -m "feat(stripe): handle checkout.session.completed to activate subscription"
```

---

## Task 2: Remover código morto da página de assinatura

**Files:**
- Modify: `src/app/(dashboard)/configuracoes/assinatura/page.tsx`

> Esta task não tem teste unitário — é remoção de código. A verificação é o TypeScript compilar sem erros e os testes existentes passarem.

- [ ] **Step 1: Remover imports inutilizados**

No topo do arquivo, as linhas 13–17 atualmente são:

```typescript
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise = stripeKey ? loadStripe(stripeKey) : null
```

Substitua pelas linhas abaixo (mantém apenas `stripeKey`, usado na condição do botão na linha ~436):

```typescript
const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
```

- [ ] **Step 2: Remover os componentes `StripeCheckoutForm` e `StripeCheckoutModal`**

Localize e delete o bloco entre `// ---- Stripe Checkout Modal ----` e `// ---- Main Page ----` (aproximadamente linhas 74–150). O resultado é que a linha `// ---- Main Page ----` fica imediatamente após os `STATUS_MAP` e `ACTION_MAP`.

O bloco a remover é:

```typescript
// ---- Stripe Checkout Modal ----
function StripeCheckoutForm({ onSuccess, onClose }: { ... }) {
  ...
}

function StripeCheckoutModal({ clientSecret, onSuccess, onClose }: { ... }) {
  ...
}
```

- [ ] **Step 3: Remover os estados mortos**

Dentro de `AssinaturaPage`, localize e remova as duas linhas:

```typescript
const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null)
const [showStripeModal, setShowStripeModal] = useState(false)
```

- [ ] **Step 4: Remover o bloco de renderização morto**

No final do JSX retornado, localize e remova o bloco:

```typescript
{/* Stripe Modal — só renderiza se a chave estiver configurada */}
{showStripeModal && stripeClientSecret && stripePromise && (
  <StripeCheckoutModal
    clientSecret={stripeClientSecret}
    onSuccess={() => { setShowStripeModal(false); setStripeClientSecret(null); loadData() }}
    onClose={() => { setShowStripeModal(false); setStripeClientSecret(null) }}
  />
)}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: 0 erros. Se aparecer erro de variável não declarada, confirme que `stripeKey` está no topo do arquivo (Step 1).

- [ ] **Step 6: Rodar a suite de testes**

```bash
npm test
```

Esperado: todos os testes passando.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/configuracoes/assinatura/page.tsx
git commit -m "refactor(assinatura): remove dead Stripe Elements code after redirect migration"
```

---

## Task 3: Feedback visual ao retornar do Stripe Checkout

**Files:**
- Modify: `src/app/(dashboard)/configuracoes/assinatura/page.tsx`

- [ ] **Step 1: Adicionar imports de roteamento**

No bloco de imports do arquivo, adicione `useSearchParams` e `useRouter` junto com os outros imports de `next/navigation` (se não houver, adicione nova linha):

```typescript
import { useSearchParams, useRouter } from 'next/navigation'
```

- [ ] **Step 2: Instanciar os hooks dentro do componente**

Dentro de `AssinaturaPage`, após as instâncias de `useSession` e `useQueryClient`, adicione:

```typescript
const searchParams = useSearchParams()
const router = useRouter()
```

- [ ] **Step 3: Adicionar o `useEffect` de leitura de params**

Logo após as declarações dos hooks (antes do primeiro `useQuery`), adicione:

```typescript
useEffect(() => {
  const sucesso = searchParams.get('sucesso')
  const cancelado = searchParams.get('cancelado')

  if (sucesso === '1') {
    toast.success('Pagamento realizado! Sua assinatura será ativada em instantes.')
    queryClient.invalidateQueries({ queryKey: ['assinatura'] })
    router.replace('/configuracoes/assinatura')
  }

  if (cancelado === '1') {
    toast.info('Pagamento cancelado. Nenhuma cobrança foi realizada.')
    router.replace('/configuracoes/assinatura')
  }
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

> O array de deps vazio é intencional: queremos rodar apenas uma vez ao montar, quando os params da URL ainda estão presentes.

- [ ] **Step 4: Adicionar `useEffect` aos imports do React**

Confirme que `useEffect` está na importação do React no topo do arquivo:

```typescript
import { useState, useEffect } from 'react'
```

- [ ] **Step 5: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperado: 0 erros.

- [ ] **Step 6: Rodar a suite de testes**

```bash
npm test
```

Esperado: todos os testes passando.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/configuracoes/assinatura/page.tsx
git commit -m "feat(assinatura): show toast feedback on return from Stripe Checkout"
```

---

## Task 4: Passo manual no Stripe Dashboard

> Esta task não envolve código — é configuração de infraestrutura.

- [ ] **Step 1: Acessar o Stripe Dashboard**

Vá em: https://dashboard.stripe.com → **Developers → Webhooks**

- [ ] **Step 2: Editar o endpoint existente**

Clique no endpoint que aponta para `/api/pagamentos/webhook/stripe` → **"Edit endpoint"** (ou "Adicionar eventos").

- [ ] **Step 3: Adicionar o evento**

Busque e adicione: `checkout.session.completed`

Salve. O endpoint agora escuta 4 eventos:
- `checkout.session.completed` ← novo
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.deleted`

- [ ] **Step 4: Confirmar a variável de ambiente**

Verifique que `STRIPE_WEBHOOK_SECRET` no `.env` corresponde ao **Signing secret** deste endpoint (começa com `whsec_`).

---

## Self-Review

**Cobertura do spec:**
- [x] Handler `checkout.session.completed` com `stripeSubId` + ativação → Task 1
- [x] Remoção de `StripeCheckoutModal`, `StripeCheckoutForm`, estados e imports mortos → Task 2
- [x] Feedback `?sucesso=1` / `?cancelado=1` com toast + limpeza de URL → Task 3
- [x] Passo manual no Stripe Dashboard → Task 4

**Placeholders:** Nenhum.

**Consistência de tipos:** `Stripe.Checkout.Session` usado no service e no teste. `Stripe.Subscription` no cast de `session.subscription`. Consistente.
