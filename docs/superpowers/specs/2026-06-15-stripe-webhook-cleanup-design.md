# Spec: Stripe Checkout — Webhook, Cleanup e Feedback de UX

**Data:** 2026-06-15
**Status:** Aprovado

---

## Contexto

O sistema THE FINANCE usa **Stripe Checkout Session** (redirect para página hospedada pelo Stripe) para pagamento de assinaturas SaaS. Após a migração da abordagem de embedded Elements para redirect, três pendências ficaram abertas:

1. O evento `checkout.session.completed` não é tratado no webhook, causando falha na ativação da assinatura no banco.
2. Código referente à abordagem antiga (Elements/modal) permanece morto no arquivo da página de assinatura.
3. A URL de retorno do Stripe (`?sucesso=1`, `?cancelado=1`) não exibe nenhum feedback visual ao usuário.

---

## Escopo

Dois arquivos de código + um passo manual no Stripe Dashboard.

---

## Seção 1 — Webhook `checkout.session.completed`

### Arquivo: `src/services/payments/stripe.service.ts`

**Problema:** O `handleWebhook` escuta `invoice.payment_succeeded`, mas o evento primário do fluxo Checkout Session é `checkout.session.completed`. Sem esse handler, a assinatura permanece em `TRIAL` mesmo após pagamento confirmado.

**Mudança:** Adicionar `case 'checkout.session.completed'` no switch existente.

```typescript
case 'checkout.session.completed': {
  const session = event.data.object as Stripe.Checkout.Session
  const customerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id
  if (!customerId) return

  const subId = typeof session.subscription === 'string'
    ? session.subscription
    : session.subscription?.id

  const customer = await prisma.stripeCustomer.findFirst({
    where: { stripeCustomerId: customerId },
  })
  if (!customer) return

  // Salva stripeSubId para permitir cancelamentos futuros
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

**Passo manual (Stripe Dashboard):**
- Webhooks → editar endpoint existente → adicionar evento `checkout.session.completed`

---

## Seção 2 — Remoção de código morto

### Arquivo: `src/app/(dashboard)/configuracoes/assinatura/page.tsx`

**O que remover:**

| Elemento | Localização | Motivo |
|---|---|---|
| `import { Elements, PaymentElement, useStripe, useElements }` | linha 14 | Nenhum dos 4 é usado após remoção do modal |
| `import { loadStripe }` | linha 13 | Não usado sem `stripePromise` |
| `const stripePromise = ...` | linha 17 | Só alimentava `<Elements>` |
| Componente `StripeCheckoutForm` | linhas 75–127 | Abordagem abandonada |
| Componente `StripeCheckoutModal` | linhas 129–150 | Abordagem abandonada |
| Estado `stripeClientSecret` | linha 171 | Nunca setado no fluxo atual |
| Estado `showStripeModal` | linha 172 | Nunca setado no fluxo atual |
| Bloco `{showStripeModal && stripeClientSecret && ...}` | linhas 575–581 | Nunca renderiza |

**O que manter:**
- `const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — usado na condição do botão (linha 436)

---

## Seção 3 — Feedback visual ao retornar do Stripe

### Arquivo: `src/app/(dashboard)/configuracoes/assinatura/page.tsx`

**Mudança:** Adicionar `useSearchParams` e `useRouter` do `next/navigation` e um `useEffect` que roda uma vez ao montar:

```typescript
import { useSearchParams, useRouter } from 'next/navigation'

// dentro do componente:
const searchParams = useSearchParams()
const router = useRouter()

useEffect(() => {
  const sucesso = searchParams.get('sucesso')
  const cancelado = searchParams.get('cancelado')

  if (sucesso === '1') {
    toast.success('Pagamento realizado! Sua assinatura será ativada em instantes.')
    loadData()
    router.replace('/configuracoes/assinatura')
  }
  if (cancelado === '1') {
    toast.info('Pagamento cancelado. Nenhuma cobrança foi realizada.')
    router.replace('/configuracoes/assinatura')
  }
}, []) // eslint-disable-line react-hooks/exhaustive-deps
```

---

## Resumo de arquivos alterados

| Arquivo | Tipo de mudança |
|---|---|
| `src/services/payments/stripe.service.ts` | +1 case no switch do handleWebhook |
| `src/app/(dashboard)/configuracoes/assinatura/page.tsx` | Remover ~80 linhas mortas + useEffect de params |

**Nenhuma migration de banco necessária** — `stripeSubId` já existe no modelo `StripeCustomer`.

---

## Critérios de aceite

- [ ] Após pagamento no Stripe Checkout, `TenantSubscription.status` muda para `ACTIVE`
- [ ] `StripeCustomer.stripeSubId` é gravado ao completar o checkout
- [ ] A página `/configuracoes/assinatura` não importa nem referencia `Elements`, `PaymentElement`, `useStripe`, `useElements`, `loadStripe`, `stripePromise`
- [ ] Ao retornar com `?sucesso=1`, toast de sucesso aparece e URL é limpa
- [ ] Ao retornar com `?cancelado=1`, toast informativo aparece e URL é limpa
- [ ] TypeScript compila sem erros (`tsc --noEmit`)
