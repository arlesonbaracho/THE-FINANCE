# Checkout Customizado com Stripe Payment Element — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o redirect do Stripe Checkout por um modal embutido com Payment Element (estratégia SetupIntent-primeiro), e migrar a página de assinatura para o design system `--tf-*`.

**Architecture:** Backend ganha `createSetupIntent` + `createSubscriptionFromPaymentMethod` e perde `createCheckoutSession`. Frontend ganha um `CheckoutModal` com `<Elements>`/`<PaymentElement>` e a página inteira é reescrita para tokens `--tf-*`.

**Tech Stack:** Next.js 14, TypeScript, Prisma 7, Stripe SDK v22 (`@stripe/stripe-js`, `@stripe/react-stripe-js`), next-themes, Vitest 4, Sonner.

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `src/services/payments/stripe.service.ts` | +2 funções, −`createCheckoutSession` |
| `src/services/payments/__tests__/stripe.service.test.ts` | +testes |
| `src/app/api/assinatura/stripe/setup-intent/route.ts` | criar |
| `src/app/api/assinatura/stripe/subscribe/route.ts` | criar |
| `src/app/api/assinatura/stripe/create/route.ts` | remover |
| `src/app/(dashboard)/configuracoes/assinatura/page.tsx` | modal + migração `--tf-*` |

---

## Task 1: Funções de backend no service (TDD)

**Files:**
- Modify: `src/services/payments/stripe.service.ts`
- Modify: `src/services/payments/__tests__/stripe.service.test.ts`

- [ ] **Step 1: Estender o mock do Stripe no teste**

No `__tests__/stripe.service.test.ts`, a classe `MockStripe` precisa expor `setupIntents`, `paymentMethods` e `subscriptions.create`. Substitua a classe mock por:

```typescript
vi.mock('stripe', () => {
  class MockStripe {
    customers = { create: vi.fn(), update: vi.fn() }
    setupIntents = { create: vi.fn() }
    paymentMethods = { attach: vi.fn() }
    subscriptions = { create: vi.fn(), update: vi.fn() }
    checkout = { sessions: { create: vi.fn() } }
    webhooks = { constructEvent: vi.fn() }
  }
  return { default: MockStripe }
})
```

> O mock instanciado no módulo não é acessível diretamente; os testes abaixo focam no efeito no `prisma`. Para asserts em chamadas do Stripe, capturamos a instância via retorno das funções.

- [ ] **Step 2: Escrever testes falhando para as novas funções**

Adicione ao final do arquivo de teste:

```typescript
import { createSetupIntent, createSubscriptionFromPaymentMethod } from '../stripe.service'

describe('createSubscriptionFromPaymentMethod', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lança erro se não houver StripeCustomer', async () => {
    ;(prisma as any).stripeCustomer.findUnique = vi.fn().mockResolvedValue(null)
    await expect(
      createSubscriptionFromPaymentMethod('tenant_x', 'price_1', 'pm_1')
    ).rejects.toThrow('Cliente Stripe não encontrado')
  })

  it('grava stripeSubId após criar a subscription', async () => {
    ;(prisma as any).stripeCustomer.findUnique = vi.fn().mockResolvedValue({
      tenantId: 'tenant_x',
      stripeCustomerId: 'cus_x',
    })
    ;(prisma as any).stripeCustomer.update = vi.fn().mockResolvedValue({})

    const result = await createSubscriptionFromPaymentMethod('tenant_x', 'price_1', 'pm_1')

    expect((prisma as any).stripeCustomer.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'tenant_x' } })
    )
    expect(result).toHaveProperty('status')
  })
})
```

> Nota: a instância do Stripe mockada retorna `vi.fn()` cujos métodos resolvem `undefined`; ajuste o service para tolerar `subscription?.id` e `subscription?.status` quando o mock não devolve objeto. Para tornar o teste determinístico, o service deve usar os valores retornados — no Step 3 garantimos que `subscriptions.create` é chamado e seu retorno é usado. Como o mock devolve `undefined`, complementamos o mock por instância no Step seguinte.

- [ ] **Step 3: Tornar o mock do Stripe inspecionável por instância**

Para asserts confiáveis, exponha a instância. Reescreva o mock para guardar a última instância em um holder:

```typescript
const stripeMock = {
  customers: { create: vi.fn(), update: vi.fn() },
  setupIntents: { create: vi.fn() },
  paymentMethods: { attach: vi.fn() },
  subscriptions: { create: vi.fn(), update: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
  webhooks: { constructEvent: vi.fn() },
}
vi.mock('stripe', () => ({ default: vi.fn(() => stripeMock) }))
```

E declare `stripeMock` no topo (antes do `vi.mock`, usando `vi.hoisted`):

```typescript
const stripeMock = vi.hoisted(() => ({
  customers: { create: vi.fn(), update: vi.fn() },
  setupIntents: { create: vi.fn() },
  paymentMethods: { attach: vi.fn() },
  subscriptions: { create: vi.fn(), update: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
  webhooks: { constructEvent: vi.fn() },
}))
vi.mock('stripe', () => ({ default: vi.fn(() => stripeMock) }))
```

Ajuste os testes de `createSetupIntent`:

```typescript
describe('createSetupIntent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(prisma as any).stripeCustomer.findUnique = vi.fn().mockResolvedValue({
      tenantId: 'tenant_x', stripeCustomerId: 'cus_x',
    })
    stripeMock.setupIntents.create.mockResolvedValue({ client_secret: 'seti_secret_123' })
  })

  it('retorna o clientSecret do SetupIntent', async () => {
    const r = await createSetupIntent('tenant_x', 'a@b.com', 'Tenant X')
    expect(stripeMock.setupIntents.create).toHaveBeenCalled()
    expect(r.clientSecret).toBe('seti_secret_123')
  })
})
```

E complete o teste de subscription:

```typescript
stripeMock.subscriptions.create.mockResolvedValue({ id: 'sub_1', status: 'active' })
```

- [ ] **Step 4: Rodar testes e confirmar falha**

```bash
npx vitest run src/services/payments/__tests__/stripe.service.test.ts
```

Esperado: FAIL — `createSetupIntent` / `createSubscriptionFromPaymentMethod` não existem.

- [ ] **Step 5: Implementar as funções no service**

Em `src/services/payments/stripe.service.ts`, remova `createCheckoutSession` e adicione:

```typescript
export async function createSetupIntent(
  tenantId: string,
  email: string,
  name: string,
): Promise<{ clientSecret: string }> {
  const customerId = await getOrCreateStripeCustomer(tenantId, email, name)
  const intent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
    usage: 'off_session',
  })
  return { clientSecret: intent.client_secret! }
}

export async function createSubscriptionFromPaymentMethod(
  tenantId: string,
  priceId: string,
  paymentMethodId: string,
): Promise<{ status: string }> {
  const customer = await prisma.stripeCustomer.findUnique({ where: { tenantId } })
  if (!customer) throw new Error('Cliente Stripe não encontrado')

  await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.stripeCustomerId })
  await stripe.customers.update(customer.stripeCustomerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  })

  const subscription = await stripe.subscriptions.create({
    customer: customer.stripeCustomerId,
    items: [{ price: priceId }],
    default_payment_method: paymentMethodId,
    metadata: { tenantId },
  })

  await prisma.stripeCustomer.update({
    where: { tenantId },
    data: { stripeSubId: subscription.id },
  })

  return { status: subscription.status }
}
```

- [ ] **Step 6: Rodar testes e confirmar verde**

```bash
npx vitest run src/services/payments/__tests__/stripe.service.test.ts
```

Esperado: todos PASS.

- [ ] **Step 7: Suíte completa + tsc**

```bash
npm test
npx tsc --noEmit
```

Esperado: tudo verde, 0 erros de tipo.

- [ ] **Step 8: Commit**

```bash
git add src/services/payments/stripe.service.ts src/services/payments/__tests__/stripe.service.test.ts
git commit -m "feat(stripe): add setup-intent + subscription-from-pm, drop checkout session"
```

---

## Task 2: Rotas de API

**Files:**
- Create: `src/app/api/assinatura/stripe/setup-intent/route.ts`
- Create: `src/app/api/assinatura/stripe/subscribe/route.ts`
- Delete: `src/app/api/assinatura/stripe/create/route.ts`

- [ ] **Step 1: Criar `setup-intent/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { createSetupIntent } from '@/services/payments/stripe.service'

export async function POST() {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const { tenantId } = session.user

  try {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      include: { users: { where: { role: 'ADMIN' }, take: 1 } },
    })
    const email = tenant.users[0]?.email ?? `tenant-${tenantId}@thefinance.app`
    const result = await createSetupIntent(tenantId, email, tenant.name)
    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error('[stripe-setup-intent]', err)
    return NextResponse.json({ error: 'Erro ao iniciar pagamento' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Criar `subscribe/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { createSubscriptionFromPaymentMethod } from '@/services/payments/stripe.service'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const { tenantId } = session.user

  const { priceId, paymentMethodId } = await req.json()
  if (!priceId || !paymentMethodId) {
    return NextResponse.json({ error: 'priceId e paymentMethodId são obrigatórios' }, { status: 400 })
  }

  try {
    const result = await createSubscriptionFromPaymentMethod(tenantId, priceId, paymentMethodId)
    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error('[stripe-subscribe]', err)
    const msg = (err as { message?: string })?.message ?? null
    return NextResponse.json({ error: 'Erro ao criar assinatura', detail: msg }, { status: 500 })
  }
}
```

- [ ] **Step 3: Remover a rota antiga**

```bash
git rm src/app/api/assinatura/stripe/create/route.ts
```

- [ ] **Step 4: tsc**

```bash
npx tsc --noEmit
```

Esperado: 0 erros (confirma que nada mais importa `createCheckoutSession`).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/assinatura/stripe/
git commit -m "feat(api): setup-intent + subscribe routes, remove create route"
```

---

## Task 3: Modal de checkout com Payment Element

**Files:**
- Modify: `src/app/(dashboard)/configuracoes/assinatura/page.tsx`

> Esta task adiciona o modal e troca o handler do botão. A migração visual completa para `--tf-*` é a Task 4. Aqui o foco é a funcionalidade do Payment Element.

- [ ] **Step 1: Reintroduzir imports do Stripe**

No topo do arquivo, após `import { toast } from 'sonner'`:

```typescript
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useTheme } from 'next-themes'
```

E após a const `stripeKey`:

```typescript
const stripePromise = stripeKey ? loadStripe(stripeKey) : null
```

- [ ] **Step 2: Adicionar o componente `CheckoutForm`**

Antes de `// ---- Main Page ----`, adicione:

```typescript
function CheckoutForm({ plan, price, onSuccess, onClose }: {
  plan: Plan
  price: number
  onSuccess: () => void
  onClose: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements || !plan.stripePriceId) return

    setPaying(true)
    setPayError('')

    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: 'if_required',
    })

    if (error) {
      setPayError(error.message ?? 'Erro ao validar cartão')
      setPaying(false)
      return
    }

    const paymentMethodId = typeof setupIntent?.payment_method === 'string'
      ? setupIntent.payment_method
      : setupIntent?.payment_method?.id

    if (!paymentMethodId) {
      setPayError('Não foi possível obter o método de pagamento')
      setPaying(false)
      return
    }

    const res = await fetch('/api/assinatura/stripe/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId: plan.stripePriceId, paymentMethodId }),
    })
    const d = await res.json()
    setPaying(false)

    if (!res.ok) {
      setPayError(d.detail ?? d.error ?? 'Erro ao criar assinatura')
      return
    }
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'var(--tf-surface2)', borderRadius: 8, padding: 12 }}>
        <p style={{ fontSize: 13, color: 'var(--tf-txt3)', margin: 0 }}>Plano selecionado</p>
        <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--tf-txt)', margin: '2px 0 0' }}>
          {plan.name} — R$ {price.toFixed(2)}/mês
        </p>
      </div>
      <PaymentElement />
      {payError && <p style={{ fontSize: 13, color: 'var(--tf-red)', margin: 0 }}>{payError}</p>}
      <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
        <button type="button" onClick={onClose} disabled={paying}
          style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--tf-border-color)', background: 'transparent', color: 'var(--tf-txt2)', cursor: 'pointer' }}>
          Cancelar
        </button>
        <button type="submit" disabled={paying || !stripe}
          style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--tf-primary)', color: 'var(--tf-primary-txt)', cursor: 'pointer', opacity: paying ? 0.6 : 1 }}>
          {paying ? 'Processando...' : `Pagar R$ ${price.toFixed(2)}`}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Adicionar o componente `CheckoutModal`**

Depois de `CheckoutForm`:

```typescript
function CheckoutModal({ plan, price, onSuccess, onClose }: {
  plan: Plan
  price: number
  onSuccess: () => void
  onClose: () => void
}) {
  const { resolvedTheme } = useTheme()
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    fetch('/api/assinatura/stripe/setup-intent', { method: 'POST' })
      .then(r => r.json())
      .then(d => {
        if (d.clientSecret) setClientSecret(d.clientSecret)
        else setLoadError(d.error ?? 'Erro ao iniciar pagamento')
      })
      .catch(() => setLoadError('Erro de conexão'))
  }, [])

  const appearance = {
    theme: (resolvedTheme === 'dark' ? 'night' : 'stripe') as 'night' | 'stripe',
    variables: {
      colorPrimary: '#2D6A4F',
      colorBackground: resolvedTheme === 'dark' ? '#252528' : '#FFFFFF',
      colorText: resolvedTheme === 'dark' ? '#FFFFFF' : '#1C1C1E',
      borderRadius: '8px',
    },
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
      <div style={{ width: '100%', maxWidth: 440, borderRadius: 12, border: '1px solid var(--tf-border-color)', background: 'var(--tf-surface)', padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--tf-txt)', margin: '0 0 16px' }}>
          Pagamento com cartão
        </h2>
        {loadError && <p style={{ fontSize: 13, color: 'var(--tf-red)' }}>{loadError}</p>}
        {!clientSecret && !loadError && (
          <p style={{ fontSize: 13, color: 'var(--tf-txt3)' }}>Carregando...</p>
        )}
        {clientSecret && stripePromise && (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
            <CheckoutForm plan={plan} price={price} onSuccess={onSuccess} onClose={onClose} />
          </Elements>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Adicionar estado do modal e trocar o handler**

Dentro de `AssinaturaPage`, junto aos outros estados, adicione:

```typescript
const [checkoutPlan, setCheckoutPlan] = useState<{ plan: Plan; price: number } | null>(null)
```

Substitua a função `handleStripeUpgrade` inteira por:

```typescript
function handleStripeUpgrade(plan: Plan, price: number) {
  if (!plan.stripePriceId) {
    toast.error(`Plano "${plan.name}" ainda não tem preço configurado no Stripe.`)
    return
  }
  setCheckoutPlan({ plan, price })
}
```

- [ ] **Step 5: Atualizar o botão do Stripe e renderizar o modal**

No botão "Pagar com cartão (Stripe)", troque o `onClick` para:

```typescript
onClick={() => handleStripeUpgrade(plan, price)}
```

Antes do `</div>` final de fechamento da página, adicione:

```typescript
{checkoutPlan && (
  <CheckoutModal
    plan={checkoutPlan.plan}
    price={checkoutPlan.price}
    onSuccess={() => {
      setCheckoutPlan(null)
      toast.success('Assinatura criada! Ativando seu plano...')
      loadData()
    }}
    onClose={() => setCheckoutPlan(null)}
  />
)}
```

- [ ] **Step 6: tsc + testes**

```bash
npx tsc --noEmit
npm test
```

Esperado: 0 erros, suíte verde.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/configuracoes/assinatura/page.tsx"
git commit -m "feat(assinatura): embedded Stripe Payment Element checkout modal"
```

---

## Task 4: Migrar a página de assinatura para `--tf-*`

**Files:**
- Modify: `src/app/(dashboard)/configuracoes/assinatura/page.tsx`

> Troca mecânica: classes Tailwind de cor → `style` inline com tokens `--tf-*`. Lógica intocada. Referência de tokens na memória `project-theme-css-vars`.

- [ ] **Step 1: Migrar `STATUS_MAP` para estilos inline**

Troque o map de strings de classe por objetos de estilo:

```typescript
const STATUS_MAP: Record<string, { label: string; bg: string; color: string; bd: string }> = {
  TRIAL:     { label: 'Trial',     bg: 'var(--tf-primary-bg)',   color: 'var(--tf-primary)',  bd: 'var(--tf-border-color)' },
  ACTIVE:    { label: 'Ativo',     bg: 'var(--tf-green-ok-bg)',  color: 'var(--tf-green-ok)', bd: 'var(--tf-green-ok-bd)' },
  OVERDUE:   { label: 'Vencido',   bg: 'var(--tf-yellow-bg)',    color: 'var(--tf-yellow)',   bd: 'var(--tf-yellow-bd)' },
  CANCELLED: { label: 'Cancelado', bg: 'var(--tf-red-bg)',       color: 'var(--tf-red)',      bd: 'var(--tf-red-bd)' },
  SUSPENDED: { label: 'Suspenso',  bg: 'var(--tf-surface2)',     color: 'var(--tf-txt3)',     bd: 'var(--tf-border-color)' },
}
```

E no uso (badge de status atual), troque o `<Badge className=...>` por:

```typescript
<span style={{
  background: STATUS_MAP[subscription.status]?.bg, color: STATUS_MAP[subscription.status]?.color,
  border: `1px solid ${STATUS_MAP[subscription.status]?.bd}`, borderRadius: 6, padding: '2px 10px', fontSize: 12,
}}>
  {STATUS_MAP[subscription.status]?.label ?? subscription.status}
</span>
```

- [ ] **Step 2: Migrar `ACTION_MAP` (cores dos ícones)**

```typescript
const ACTION_MAP: Record<string, { label: string; icon: React.ReactNode }> = {
  UPGRADE:    { label: 'Upgrade',      icon: <ArrowUpCircle className="h-4 w-4" style={{ color: 'var(--tf-green-ok)' }} /> },
  DOWNGRADE:  { label: 'Downgrade',    icon: <ArrowDownCircle className="h-4 w-4" style={{ color: 'var(--tf-yellow)' }} /> },
  CANCEL:     { label: 'Cancelamento', icon: <XCircle className="h-4 w-4" style={{ color: 'var(--tf-red)' }} /> },
  REACTIVATE: { label: 'Reativação',   icon: <CheckCircle className="h-4 w-4" style={{ color: 'var(--tf-green-ok)' }} /> },
}
```

- [ ] **Step 2b: Loader inicial**

Troque o loader (bloco `if (!data)`) por:

```typescript
<div className="flex items-center justify-center h-40">
  <div className="h-6 w-6 animate-spin rounded-full" style={{ border: '2px solid var(--tf-border-color)', borderTopColor: 'var(--tf-txt3)' }} />
</div>
```

- [ ] **Step 3: Migrar título e cabeçalho**

```typescript
<h1 style={{ fontFamily: 'var(--tf-font-display)', fontSize: 24, fontWeight: 700, color: 'var(--tf-txt)' }}>Assinatura</h1>
<p style={{ fontSize: 14, color: 'var(--tf-txt3)', marginTop: 4 }}>Gerencie seu plano e faturamento</p>
```

- [ ] **Step 4: Migrar card de status atual**

Troque o `<Card className="border-zinc-800 bg-zinc-900">` por um `<div>` estilizado:

```typescript
<div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border-color)', borderRadius: 10, padding: 24 }}>
```

Textos: `text-zinc-400` → `style={{ color: 'var(--tf-txt3)' }}`, `text-white` → `style={{ color: 'var(--tf-txt)' }}`. Caixa de cancelamento agendado: `border-amber-500/30 bg-amber-500/10` → `style={{ border: '1px solid var(--tf-yellow-bd)', background: 'var(--tf-yellow-bg)' }}`, texto âmbar → `var(--tf-yellow)`.

- [ ] **Step 5: Migrar tabs**

```typescript
<div style={{ display: 'flex', borderBottom: '1px solid var(--tf-border-color)' }}>
```

Cada botão de tab:

```typescript
style={{
  padding: '8px 16px', fontSize: 14, fontWeight: 500, background: 'transparent', cursor: 'pointer',
  borderBottom: tab === t ? '2px solid var(--tf-primary)' : '2px solid transparent',
  color: tab === t ? 'var(--tf-txt)' : 'var(--tf-txt3)',
}}
```

- [ ] **Step 6: Migrar mensagens, toggle de ciclo e cards de plano**

- `msg`: `style={{ fontSize: 13, color: 'var(--tf-green-ok)' }}`; `error`: `var(--tf-red)`.
- Toggle: trilho ativo `background: 'var(--tf-primary)'` / inativo `var(--tf-surface2)`; textos ativo `var(--tf-txt)` / inativo `var(--tf-txt3)`; selo "(-20%)" `var(--tf-green-ok)`.
- Card de plano: `<div>` com `background: 'var(--tf-surface)'`, `border: 2px solid` (`var(--tf-green-ok-bd)` se atual, senão `var(--tf-border-color)`), `borderRadius: 10`, `padding: 16`.
- Título do plano `var(--tf-txt)`; preço `var(--tf-txt)`; "/mês" e descrição `var(--tf-txt3)`; ícones de check `var(--tf-green-ok)`; itens da lista `var(--tf-txt2)`.
- Badge "Atual": mesmo padrão verde do Step 1.

- [ ] **Step 7: Migrar botões de ação dos planos**

Botão upgrade/downgrade:

```typescript
style={{
  width: '100%', padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
  background: isUpgrade ? 'var(--tf-primary)' : 'var(--tf-surface2)',
  color: isUpgrade ? 'var(--tf-primary-txt)' : 'var(--tf-txt2)',
}}
```

Botão "Pagar com cartão (Stripe)":

```typescript
style={{ width: '100%', marginTop: 8, padding: '8px', borderRadius: 8, border: '1px solid var(--tf-primary)', background: 'var(--tf-primary-bg)', color: 'var(--tf-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
```

- [ ] **Step 8: Migrar seção de cancelamento, histórico e cancel modal**

- Seção cancelar: `<div>` com `border: '1px solid var(--tf-border-color)'`, `borderRadius: 8`, `padding: 16`; título `var(--tf-txt)`; texto `var(--tf-txt3)`; botão com `border: '1px solid var(--tf-red-bd)'`, `color: 'var(--tf-red)'`, `background: 'transparent'`.
- Histórico: card `var(--tf-surface)`/`var(--tf-border-color)`; divisores `borderColor: var(--tf-border-color)`; textos `var(--tf-txt)`/`var(--tf-txt3)`.
- Cancel modal: overlay `rgba(0,0,0,0.6)`; caixa `var(--tf-surface)`/`var(--tf-border-color)`; `<select>`/`<textarea>`/`<Input>` com `background: 'var(--tf-input-bg)'`, `border: '1px solid var(--tf-input-border)'`, `color: 'var(--tf-txt)'`; botão voltar outline; botão confirmar `background: 'var(--tf-red)'`, `color: '#fff'`. Remova imports não usados (`Card`, `CardContent`, `CardHeader`, `CardTitle`, `Badge`, `Button` se não restar uso; manter `Input`/`Label` se ainda usados no cancel modal — senão migrar para tags nativas e remover).

- [ ] **Step 9: tsc + testes + lint**

```bash
npx tsc --noEmit
npm test
```

Esperado: 0 erros, suíte verde. Garanta que não sobraram imports não usados (o `tsc`/lint acusa).

- [ ] **Step 10: Verificação visual**

```bash
npm run dev
```

Abrir `/configuracoes/assinatura`, conferir em tema claro e escuro: cards, badges, toggle, botões e o modal de checkout. Confirmar que nenhuma cor zinc/emerald do Tailwind permaneceu.

- [ ] **Step 11: Commit**

```bash
git add "src/app/(dashboard)/configuracoes/assinatura/page.tsx"
git commit -m "refactor(assinatura): migrate page to --tf-* design tokens"
```

---

## Self-Review

**Cobertura do spec:**
- [x] Backend: `createSetupIntent` + `createSubscriptionFromPaymentMethod`, remove `createCheckoutSession` → Task 1
- [x] Rotas setup-intent/subscribe, remove create → Task 2
- [x] Modal com Payment Element + tema `--tf-*` (appearance) + troca do botão → Task 3
- [x] Migração da página para `--tf-*` → Task 4
- [x] Testes das funções de service → Task 1
- [x] Tratamento de erro (setup-intent, confirmSetup, subscribe) → Task 3 (CheckoutForm/Modal)

**Placeholders:** Nenhum.

**Consistência de tipos:** `CheckoutModal`/`CheckoutForm` recebem `plan: Plan` e `price: number`; `handleStripeUpgrade(plan, price)` alimenta `checkoutPlan`; `subscribe` recebe `{ priceId, paymentMethodId }` — consistente com a rota da Task 2.

**Nota de risco:** o tema do `appearance` do Stripe usa hexes resolvidos (o iframe não lê CSS vars) — valores tirados da memória `project-theme-css-vars`. Se o projeto adicionar mais temas além de light/dark, revisar.
