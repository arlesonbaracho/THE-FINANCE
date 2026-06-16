# Spec: Checkout Customizado com Stripe Payment Element

**Data:** 2026-06-16
**Status:** Aprovado

---

## Contexto

Hoje a assinatura usa Stripe Checkout hospedado (redirect). O objetivo é um fluxo de checkout próprio: um **modal embutido** na página de assinatura, com o **Stripe Payment Element** (campo de cartão seguro) renderizado dentro do app, seguindo o design system `--tf-*` do projeto. O redirect é removido.

A página de assinatura atual usa o padrão antigo (classes Tailwind `bg-zinc-*`, `text-emerald-*`). Ela será migrada para os tokens `--tf-*` (padrão oficial, conforme memória `project-theme-css-vars`).

## Decisões tomadas no brainstorming

- **Abordagem de UI:** Payment Element (formulário próprio, campo de cartão do Stripe) — controle visual total.
- **Local:** modal sobre a página de assinatura.
- **Visual:** padrão `--tf-*` no modal **e** migração da página de assinatura inteira para `--tf-*`.
- **Redirect:** removido totalmente (substituído pelo modal).
- **Estratégia de backend:** SetupIntent primeiro (contorna a falha anterior de extração de `client_secret` da subscription na API 2026, usando APIs estáveis).

---

## Fluxo (SetupIntent primeiro)

1. Usuário clica "Assinar plano" → modal abre.
2. Modal faz `POST /api/assinatura/stripe/setup-intent` → backend cria SetupIntent → retorna `clientSecret`.
3. `<PaymentElement>` monta com o `clientSecret` (tema `--tf-*` via `appearance`).
4. Usuário preenche cartão → `stripe.confirmSetup({ redirect: 'if_required' })` → salva cartão + 3DS → retorna `payment_method`.
5. Modal faz `POST /api/assinatura/stripe/subscribe` com `{ priceId, paymentMethodId }` → backend cria subscription com esse cartão como `default_payment_method` → cobra → grava `stripeSubId`.
6. Webhook (`invoice.payment_succeeded` / `checkout.session.completed`) ativa a assinatura (`status: ACTIVE`).
7. Modal fecha → toast de sucesso → `invalidateQueries(['assinatura'])`.

---

## Seção 1 — Backend

### `src/services/payments/stripe.service.ts`

**Adicionar:**

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

**Remover:** `createCheckoutSession`.
**Manter:** `getOrCreateStripeCustomer`, `cancelSubscription`, `handleWebhook`, `stripe` export.

### Rotas

- **Criar** `src/app/api/assinatura/stripe/setup-intent/route.ts` — POST, auth por `getSession`, busca admin do tenant para email/nome, chama `createSetupIntent`, retorna `{ clientSecret }`.
- **Criar** `src/app/api/assinatura/stripe/subscribe/route.ts` — POST, auth por `getSession`, body `{ priceId, paymentMethodId }`, chama `createSubscriptionFromPaymentMethod`, retorna `{ status }`.
- **Remover** `src/app/api/assinatura/stripe/create/route.ts`.

---

## Seção 2 — Frontend: modal de checkout

Na página de assinatura, novo componente `CheckoutModal`:
- Recebe `plan`, `billingCycle`, `onClose`, `onSuccess`.
- Ao montar: `POST /setup-intent`, guarda `clientSecret` em estado.
- Renderiza `<Elements stripe={stripePromise} options={{ clientSecret, appearance }}>` com um form interno `CheckoutForm` que usa `useStripe`/`useElements`.
- `CheckoutForm`: resumo do plano (`--tf-*`) + `<PaymentElement>` + botão "Pagar R$ X".
- Submit: `stripe.confirmSetup({ elements, redirect: 'if_required' })`; se erro → mensagem inline; se ok → `POST /subscribe` com `priceId` + `setupIntent.payment_method`; sucesso → `onSuccess()`.

Reintroduzir imports `loadStripe` (`@stripe/stripe-js`) e `Elements, PaymentElement, useStripe, useElements` (`@stripe/react-stripe-js`), e `stripePromise` (null-safe).

O botão de plano (`isAdmin && !isCurrent && isUpgrade && stripeKey`) passa a abrir o modal em vez de redirecionar.

---

## Seção 3 — Tema do Payment Element

O iframe do Stripe não lê CSS variables. Passar `appearance` com valores resolvidos conforme o tema (`useTheme` do `next-themes`):

```typescript
const appearance = {
  theme: resolvedTheme === 'dark' ? 'night' : 'stripe',
  variables: {
    colorPrimary: '#2D6A4F',
    colorBackground: resolvedTheme === 'dark' ? '#252528' : '#FFFFFF',
    colorText: resolvedTheme === 'dark' ? '#FFFFFF' : '#1C1C1E',
    borderRadius: '8px',
  },
}
```

---

## Seção 4 — Migração da página para `--tf-*`

Reescrever a camada visual da página de assinatura: trocar classes Tailwind de cor (`bg-zinc-900`, `text-emerald-400`, `border-zinc-800`, etc.) por `style` inline com tokens `--tf-*` (cards de plano, badges de status, toggle mensal/anual, botões, seção de cancelamento, histórico). Lógica (queries, handlers, estados) permanece igual.

---

## Seção 5 — Erros e testes

**Erros:**
- Falha no `/setup-intent` → toast + fecha modal.
- `confirmSetup` com erro (cartão recusado/3DS) → mensagem inline no modal, sem fechar.
- Falha no `/subscribe` → toast, mantém modal para retry.

**Testes (Vitest):** unit tests para `createSetupIntent` e `createSubscriptionFromPaymentMethod` com `stripe` e `prisma` mockados (mesmo padrão do teste de webhook existente). Migração visual: sem teste unitário — verificação via `tsc --noEmit` + suíte existente.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/services/payments/stripe.service.ts` | +2 funções, −`createCheckoutSession` |
| `src/services/payments/__tests__/stripe.service.test.ts` | +testes das 2 funções |
| `src/app/api/assinatura/stripe/setup-intent/route.ts` | criar |
| `src/app/api/assinatura/stripe/subscribe/route.ts` | criar |
| `src/app/api/assinatura/stripe/create/route.ts` | remover |
| `src/app/(dashboard)/configuracoes/assinatura/page.tsx` | modal + migração `--tf-*` |

---

## Critérios de aceite

- [ ] Clicar em "Assinar/Upgrade" abre o modal embutido (sem redirect).
- [ ] O Payment Element renderiza com tema combinando com `--tf-*` (light e dark).
- [ ] Cartão de teste do Stripe conclui o fluxo e a assinatura vira `ACTIVE`.
- [ ] `stripeSubId` é gravado.
- [ ] Erro de cartão mostra mensagem inline sem fechar o modal.
- [ ] Página de assinatura não usa mais classes Tailwind de cor — só `--tf-*`.
- [ ] `createCheckoutSession` e a rota `/create` foram removidas.
- [ ] `tsc --noEmit` sem erros; suíte de testes passando.
