'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, AlertTriangle, XCircle, ArrowUpCircle, ArrowDownCircle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useTheme } from 'next-themes'

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
const stripePromise = stripeKey ? loadStripe(stripeKey) : null

type Plan = {
  id: string
  name: string
  description: string | null
  monthlyPrice: number
  annualPrice: number
  maxUsers: number
  maxProducts: number
  features: Record<string, boolean>
  stripePriceId: string | null
}

type Subscription = {
  id: string
  planId: string
  status: string
  expiresAt: string
  contractedPrice: number
  trialEndsAt: string | null
  plan: Plan
}

type HistoryEntry = {
  id: string
  action: string
  fromStatus: string | null
  toStatus: string
  reason: string | null
  scheduledFor: string | null
  createdAt: string
  toPlanId: string
}

type Cancellation = {
  id: string
  status: string
  scheduledAt: string
  reason: string
} | null

const STATUS_MAP: Record<string, { label: string; bg: string; color: string; bd: string }> = {
  TRIAL:     { label: 'Trial',     bg: 'var(--tf-primary-bg)',  color: 'var(--tf-primary)',  bd: 'var(--tf-border-color)' },
  ACTIVE:    { label: 'Ativo',     bg: 'var(--tf-green-ok-bg)', color: 'var(--tf-green-ok)', bd: 'var(--tf-green-ok-bd)' },
  OVERDUE:   { label: 'Vencido',   bg: 'var(--tf-yellow-bg)',   color: 'var(--tf-yellow)',   bd: 'var(--tf-yellow-bd)' },
  CANCELLED: { label: 'Cancelado', bg: 'var(--tf-red-bg)',      color: 'var(--tf-red)',      bd: 'var(--tf-red-bd)' },
  SUSPENDED: { label: 'Suspenso',  bg: 'var(--tf-surface2)',    color: 'var(--tf-txt3)',     bd: 'var(--tf-border-color)' },
}

const ACTION_MAP: Record<string, { label: string; icon: React.ReactNode }> = {
  UPGRADE:    { label: 'Upgrade',      icon: <ArrowUpCircle className="h-4 w-4" style={{ color: 'var(--tf-green-ok)' }} /> },
  DOWNGRADE:  { label: 'Downgrade',    icon: <ArrowDownCircle className="h-4 w-4" style={{ color: 'var(--tf-yellow)' }} /> },
  CANCEL:     { label: 'Cancelamento', icon: <XCircle className="h-4 w-4" style={{ color: 'var(--tf-red)' }} /> },
  REACTIVATE: { label: 'Reativação',   icon: <CheckCircle className="h-4 w-4" style={{ color: 'var(--tf-green-ok)' }} /> },
}

// ---- Stripe Payment Element checkout ----
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

// ---- Main Page ----
function AssinaturaContent() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const router = useRouter()

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

  const [tab, setTab] = useState<'plano' | 'historico'>('plano')
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  // Cancel flow
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelFeedback, setCancelFeedback] = useState('')
  const [cancelConfirmation, setCancelConfirmation] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)

  // Stripe checkout modal
  const [checkoutPlan, setCheckoutPlan] = useState<{ plan: Plan; price: number } | null>(null)

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'

  type AssinaturaData = {
    subscription: Subscription | null
    plans: Plan[]
    history: HistoryEntry[]
    cancellation: Cancellation
  }

  const { data } = useQuery<AssinaturaData | null>({
    queryKey: ['assinatura'],
    queryFn: () => fetch('/api/assinatura').then(r => r.json()).catch(() => null),
    staleTime: 2 * 60_000,
  })

  function loadData() {
    queryClient.invalidateQueries({ queryKey: ['assinatura'] })
  }

  async function handleChangePlan(planId: string, isUpgrade: boolean) {
    if (!isAdmin) return
    const confirmMsg = isUpgrade
      ? 'Confirmar upgrade? O novo plano entra em vigor imediatamente.'
      : 'Confirmar downgrade? O plano será reduzido no fim do período atual.'
    if (!confirm(confirmMsg)) return

    setLoading(true)
    setMsg('')
    setError('')

    const res = await fetch('/api/assinatura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, billingCycle }),
    })

    const d = await res.json()
    setLoading(false)

    if (!res.ok) { setError(d.error); return }
    setMsg(d.message)
    loadData()
    setTimeout(() => setMsg(''), 6000)
  }

  function handleStripeUpgrade(plan: Plan, price: number) {
    if (!plan.stripePriceId) {
      toast.error(`Plano "${plan.name}" ainda não tem preço configurado no Stripe.`)
      return
    }
    setCheckoutPlan({ plan, price })
  }

  async function handleCancel() {
    setCancelLoading(true)
    const res = await fetch('/api/assinatura/cancelar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: cancelReason, feedback: cancelFeedback, confirmation: cancelConfirmation }),
    })
    const d = await res.json()
    setCancelLoading(false)

    if (!res.ok) { setError(d.error); return }
    setMsg(d.message)
    setShowCancelModal(false)
    loadData()
  }

  async function handleRevertCancel() {
    if (!confirm('Deseja reverter o cancelamento agendado?')) return
    const res = await fetch('/api/assinatura/cancelar', { method: 'DELETE' })
    const d = await res.json()
    if (!res.ok) { setError(d.error); return }
    setMsg(d.message)
    loadData()
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="h-6 w-6 animate-spin rounded-full" style={{ border: '2px solid var(--tf-border-color)', borderTopColor: 'var(--tf-txt3)' }} />
      </div>
    )
  }

  const { subscription, plans, history, cancellation } = data

  const currentPlanPrice = subscription
    ? (billingCycle === 'ANNUAL' ? (subscription.plan.annualPrice / 12) : subscription.plan.monthlyPrice)
    : 0

  const inputStyle: React.CSSProperties = {
    width: '100%', borderRadius: 8, padding: '8px 12px', fontSize: 14,
    background: 'var(--tf-input-bg)', border: '1px solid var(--tf-input-border)', color: 'var(--tf-txt)',
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 style={{ fontFamily: 'var(--tf-font-display)', fontSize: 24, fontWeight: 700, color: 'var(--tf-txt)' }}>Assinatura</h1>
        <p style={{ fontSize: 14, color: 'var(--tf-txt3)', marginTop: 4 }}>Gerencie seu plano e faturamento</p>
      </div>

      {/* Current subscription status */}
      {subscription && (
        <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border-color)', borderRadius: 10, padding: 24 }}>
          <div className="flex items-start justify-between">
            <div>
              <p style={{ fontSize: 14, color: 'var(--tf-txt3)' }}>Plano atual</p>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginTop: 4 }}>{subscription.plan.name}</p>
              <p style={{ fontSize: 14, color: 'var(--tf-txt3)', marginTop: 4 }}>
                R$ {subscription.contractedPrice.toFixed(2)}/mês ·{' '}
                Vence em {new Date(subscription.expiresAt).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <span style={{
              background: STATUS_MAP[subscription.status]?.bg, color: STATUS_MAP[subscription.status]?.color,
              border: `1px solid ${STATUS_MAP[subscription.status]?.bd}`, borderRadius: 6, padding: '2px 10px', fontSize: 12, height: 'fit-content',
            }}>
              {STATUS_MAP[subscription.status]?.label ?? subscription.status}
            </span>
          </div>

          {cancellation && cancellation.status === 'PENDING' && (
            <div className="mt-4 flex items-center gap-3" style={{ borderRadius: 8, border: '1px solid var(--tf-yellow-bd)', background: 'var(--tf-yellow-bg)', padding: 12 }}>
              <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'var(--tf-yellow)' }} />
              <div className="flex-1">
                <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--tf-yellow)' }}>Cancelamento agendado</p>
                <p style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>
                  Sua conta será encerrada em {new Date(cancellation.scheduledAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
              {isAdmin && (
                <button onClick={handleRevertCancel}
                  style={{ fontSize: 13, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--tf-yellow-bd)', background: 'transparent', color: 'var(--tf-yellow)', cursor: 'pointer' }}>
                  Reverter
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: '1px solid var(--tf-border-color)' }}>
        {(['plano', 'historico'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px', fontSize: 14, fontWeight: 500, background: 'transparent', cursor: 'pointer',
              borderBottom: tab === t ? '2px solid var(--tf-primary)' : '2px solid transparent',
              color: tab === t ? 'var(--tf-txt)' : 'var(--tf-txt3)',
            }}
          >
            {t === 'plano' ? 'Planos' : 'Histórico'}
          </button>
        ))}
      </div>

      {msg && <p style={{ fontSize: 13, color: 'var(--tf-green-ok)' }}>{msg}</p>}
      {error && <p style={{ fontSize: 13, color: 'var(--tf-red)' }}>{error}</p>}

      {tab === 'plano' && (
        <>
          {/* Billing cycle toggle */}
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 14, color: billingCycle === 'MONTHLY' ? 'var(--tf-txt)' : 'var(--tf-txt3)' }}>Mensal</span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'MONTHLY' ? 'ANNUAL' : 'MONTHLY')}
              className="relative h-6 w-11 rounded-full transition-colors"
              style={{ background: billingCycle === 'ANNUAL' ? 'var(--tf-primary)' : 'var(--tf-surface2)' }}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full transition-transform ${
                billingCycle === 'ANNUAL' ? 'translate-x-5' : 'translate-x-0.5'
              }`} style={{ background: '#fff' }} />
            </button>
            <span style={{ fontSize: 14, color: billingCycle === 'ANNUAL' ? 'var(--tf-txt)' : 'var(--tf-txt3)' }}>
              Anual <span style={{ fontSize: 12, color: 'var(--tf-green-ok)' }}>(-20%)</span>
            </span>
          </div>

          {/* Plan cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const price = billingCycle === 'ANNUAL' ? plan.annualPrice / 12 : plan.monthlyPrice
              const isCurrent = subscription?.planId === plan.id
              const isUpgrade = price > currentPlanPrice

              return (
                <div key={plan.id}
                  style={{
                    background: 'var(--tf-surface)', borderRadius: 10, padding: 16,
                    border: `2px solid ${isCurrent ? 'var(--tf-green-ok-bd)' : 'var(--tf-border-color)'}`,
                  }}
                >
                  <div className="flex items-start justify-between">
                    <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--tf-txt)' }}>{plan.name}</p>
                    {isCurrent && (
                      <span style={{ background: 'var(--tf-green-ok-bg)', color: 'var(--tf-green-ok)', border: '1px solid var(--tf-green-ok-bd)', borderRadius: 6, padding: '2px 8px', fontSize: 12 }}>
                        Atual
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--tf-txt)' }}>R$ {price.toFixed(2)}</span>
                    <span style={{ fontSize: 14, color: 'var(--tf-txt3)' }}>/mês</span>
                  </div>
                  {billingCycle === 'ANNUAL' && (
                    <p style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>Cobrado R$ {plan.annualPrice.toFixed(2)}/ano</p>
                  )}

                  <ul style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <li className="flex items-center gap-2" style={{ fontSize: 14, color: 'var(--tf-txt2)' }}>
                      <CheckCircle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--tf-green-ok)' }} />
                      Até {plan.maxUsers} usuários
                    </li>
                    <li className="flex items-center gap-2" style={{ fontSize: 14, color: 'var(--tf-txt2)' }}>
                      <CheckCircle className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--tf-green-ok)' }} />
                      Até {plan.maxProducts} produtos
                    </li>
                    {plan.description && (
                      <li style={{ fontSize: 12, color: 'var(--tf-txt3)', marginTop: 8 }}>{plan.description}</li>
                    )}
                  </ul>

                  {isAdmin && !isCurrent && (
                    <button
                      onClick={() => handleChangePlan(plan.id, isUpgrade)}
                      disabled={loading}
                      style={{
                        width: '100%', marginTop: 16, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                        background: isUpgrade ? 'var(--tf-primary)' : 'var(--tf-surface2)',
                        color: isUpgrade ? 'var(--tf-primary-txt)' : 'var(--tf-txt2)',
                        opacity: loading ? 0.6 : 1,
                      }}
                    >
                      {isUpgrade ? 'Fazer Upgrade' : 'Fazer Downgrade'}
                    </button>
                  )}

                  {isAdmin && !isCurrent && isUpgrade && stripeKey && (
                    <button
                      onClick={() => handleStripeUpgrade(plan, price)}
                      disabled={loading}
                      style={{ width: '100%', marginTop: 8, padding: '8px', borderRadius: 8, border: '1px solid var(--tf-primary)', background: 'var(--tf-primary-bg)', color: 'var(--tf-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 500, opacity: loading ? 0.6 : 1 }}
                    >
                      Pagar com cartão (Stripe)
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Cancel section */}
          {isAdmin && subscription && subscription.status !== 'CANCELLED' && !cancellation && (
            <div style={{ borderRadius: 8, border: '1px solid var(--tf-border-color)', padding: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--tf-txt)' }}>Cancelar assinatura</p>
              <p style={{ fontSize: 12, color: 'var(--tf-txt3)', marginTop: 4, marginBottom: 12 }}>
                Você continuará tendo acesso por 30 dias após o cancelamento.
              </p>
              <button
                onClick={() => setShowCancelModal(true)}
                style={{ fontSize: 13, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--tf-red-bd)', background: 'transparent', color: 'var(--tf-red)', cursor: 'pointer' }}
              >
                Cancelar assinatura
              </button>
            </div>
          )}
        </>
      )}

      {tab === 'historico' && (
        <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border-color)', borderRadius: 10 }}>
          {history.length === 0 ? (
            <p style={{ fontSize: 14, color: 'var(--tf-txt3)', textAlign: 'center', padding: '32px 0' }}>Nenhum histórico ainda</p>
          ) : (
            <div>
              {history.map((entry, i) => {
                const action = ACTION_MAP[entry.action]
                return (
                  <div key={entry.id} className="flex items-center gap-3" style={{ padding: '16px 24px', borderTop: i === 0 ? 'none' : '1px solid var(--tf-border-color)' }}>
                    {action?.icon ?? <Clock className="h-4 w-4" style={{ color: 'var(--tf-txt3)' }} />}
                    <div className="flex-1">
                      <p style={{ fontSize: 14, color: 'var(--tf-txt)' }}>{action?.label ?? entry.action}</p>
                      {entry.reason && <p style={{ fontSize: 12, color: 'var(--tf-txt3)', marginTop: 2 }}>{entry.reason}</p>}
                      {entry.scheduledFor && (
                        <p style={{ fontSize: 12, color: 'var(--tf-txt3)', marginTop: 2 }}>
                          Agendado para {new Date(entry.scheduledFor).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>
                      {new Date(entry.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
          <div style={{ width: '100%', maxWidth: 448, borderRadius: 12, border: '1px solid var(--tf-border-color)', background: 'var(--tf-surface)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5" style={{ color: 'var(--tf-red)' }} />
              <h2 style={{ fontSize: 18, fontWeight: 500, color: 'var(--tf-txt)' }}>Cancelar assinatura</h2>
            </div>

            <p style={{ fontSize: 14, color: 'var(--tf-txt3)' }}>
              Você terá acesso por mais 30 dias. Após isso, sua conta será suspensa e os dados retidos por 90 dias.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 14, color: 'var(--tf-txt2)' }}>Motivo do cancelamento</label>
                <select value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} style={inputStyle}>
                  <option value="">Selecione um motivo</option>
                  <option value="Custo elevado">Custo elevado</option>
                  <option value="Não atende minhas necessidades">Não atende minhas necessidades</option>
                  <option value="Vou usar outro sistema">Vou usar outro sistema</option>
                  <option value="Fechei o negócio">Fechei o negócio</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 14, color: 'var(--tf-txt2)' }}>Feedback (opcional)</label>
                <textarea
                  value={cancelFeedback}
                  onChange={(e) => setCancelFeedback(e.target.value)}
                  placeholder="Como podemos melhorar?"
                  rows={3}
                  style={{ ...inputStyle, resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 14, color: 'var(--tf-txt2)' }}>
                  Digite <span style={{ color: 'var(--tf-red)', fontFamily: 'monospace' }}>CANCELAR</span> para confirmar
                </label>
                <input
                  value={cancelConfirmation}
                  onChange={(e) => setCancelConfirmation(e.target.value)}
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                  placeholder="CANCELAR"
                />
              </div>
            </div>

            <div className="flex gap-3" style={{ paddingTop: 4 }}>
              <button onClick={() => setShowCancelModal(false)}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--tf-border-color)', background: 'transparent', color: 'var(--tf-txt2)', cursor: 'pointer' }}>
                Voltar
              </button>
              <button
                disabled={cancelLoading || !cancelReason || cancelConfirmation !== 'CANCELAR'}
                onClick={handleCancel}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--tf-red)', color: '#fff', cursor: 'pointer', opacity: (cancelLoading || !cancelReason || cancelConfirmation !== 'CANCELAR') ? 0.4 : 1 }}
              >
                {cancelLoading ? 'Cancelando...' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stripe Payment Element checkout modal */}
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
    </div>
  )
}

export default function AssinaturaPage() {
  return (
    <Suspense fallback={null}>
      <AssinaturaContent />
    </Suspense>
  )
}
