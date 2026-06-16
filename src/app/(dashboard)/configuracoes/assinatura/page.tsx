'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  TRIAL: { label: 'Trial', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  ACTIVE: { label: 'Ativo', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  OVERDUE: { label: 'Vencido', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  SUSPENDED: { label: 'Suspenso', color: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
}

const ACTION_MAP: Record<string, { label: string; icon: React.ReactNode }> = {
  UPGRADE: { label: 'Upgrade', icon: <ArrowUpCircle className="h-4 w-4 text-emerald-400" /> },
  DOWNGRADE: { label: 'Downgrade', icon: <ArrowDownCircle className="h-4 w-4 text-amber-400" /> },
  CANCEL: { label: 'Cancelamento', icon: <XCircle className="h-4 w-4 text-red-400" /> },
  REACTIVATE: { label: 'Reativação', icon: <CheckCircle className="h-4 w-4 text-emerald-400" /> },
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
export default function AssinaturaPage() {
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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
      </div>
    )
  }

  const { subscription, plans, history, cancellation } = data

  const currentPlanPrice = subscription
    ? (billingCycle === 'ANNUAL' ? (subscription.plan.annualPrice / 12) : subscription.plan.monthlyPrice)
    : 0

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Assinatura</h1>
        <p className="text-zinc-400 text-sm mt-1">Gerencie seu plano e faturamento</p>
      </div>

      {/* Current subscription status */}
      {subscription && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-zinc-400 text-sm">Plano atual</p>
                <p className="text-white text-xl font-bold mt-1">{subscription.plan.name}</p>
                <p className="text-zinc-400 text-sm mt-1">
                  R$ {subscription.contractedPrice.toFixed(2)}/mês ·{' '}
                  Vence em {new Date(subscription.expiresAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <Badge className={`border ${STATUS_MAP[subscription.status]?.color ?? ''}`}>
                {STATUS_MAP[subscription.status]?.label ?? subscription.status}
              </Badge>
            </div>

            {cancellation && cancellation.status === 'PENDING' && (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-amber-400 text-sm font-medium">Cancelamento agendado</p>
                  <p className="text-zinc-400 text-xs">
                    Sua conta será encerrada em {new Date(cancellation.scheduledAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                {isAdmin && (
                  <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    onClick={handleRevertCancel}>
                    Reverter
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        {(['plano', 'historico'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'border-b-2 border-white text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t === 'plano' ? 'Planos' : 'Histórico'}
          </button>
        ))}
      </div>

      {msg && <p className="text-sm text-emerald-400">{msg}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {tab === 'plano' && (
        <>
          {/* Billing cycle toggle */}
          <div className="flex items-center gap-3">
            <span className={`text-sm ${billingCycle === 'MONTHLY' ? 'text-white' : 'text-zinc-500'}`}>Mensal</span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'MONTHLY' ? 'ANNUAL' : 'MONTHLY')}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                billingCycle === 'ANNUAL' ? 'bg-emerald-600' : 'bg-zinc-700'
              }`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                billingCycle === 'ANNUAL' ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
            <span className={`text-sm ${billingCycle === 'ANNUAL' ? 'text-white' : 'text-zinc-500'}`}>
              Anual <span className="text-emerald-400 text-xs">(-20%)</span>
            </span>
          </div>

          {/* Plan cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const price = billingCycle === 'ANNUAL' ? plan.annualPrice / 12 : plan.monthlyPrice
              const isCurrent = subscription?.planId === plan.id
              const isUpgrade = price > currentPlanPrice

              return (
                <Card key={plan.id}
                  className={`border-2 bg-zinc-900 transition-colors ${
                    isCurrent ? 'border-emerald-500/50' : 'border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-white text-base">{plan.name}</CardTitle>
                      {isCurrent && <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs">Atual</Badge>}
                    </div>
                    <div className="mt-2">
                      <span className="text-2xl font-bold text-white">R$ {price.toFixed(2)}</span>
                      <span className="text-zinc-500 text-sm">/mês</span>
                    </div>
                    {billingCycle === 'ANNUAL' && (
                      <p className="text-xs text-zinc-500">Cobrado R$ {plan.annualPrice.toFixed(2)}/ano</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="space-y-1.5 text-sm text-zinc-400">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        Até {plan.maxUsers} usuários
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        Até {plan.maxProducts} produtos
                      </li>
                      {plan.description && (
                        <li className="text-zinc-500 text-xs mt-2">{plan.description}</li>
                      )}
                    </ul>

                    {isAdmin && !isCurrent && (
                      <Button
                        size="sm"
                        onClick={() => handleChangePlan(plan.id, isUpgrade)}
                        disabled={loading}
                        className={`w-full ${
                          isUpgrade
                            ? 'bg-emerald-600 hover:bg-emerald-700'
                            : 'bg-zinc-700 hover:bg-zinc-600'
                        }`}
                      >
                        {isUpgrade ? 'Fazer Upgrade' : 'Fazer Downgrade'}
                      </Button>
                    )}

                    {isAdmin && !isCurrent && isUpgrade && stripeKey && (
                      <Button
                        size="sm"
                        onClick={() => handleStripeUpgrade(plan, price)}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 w-full mt-2"
                      >
                        Pagar com cartão (Stripe)
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Cancel section */}
          {isAdmin && subscription && subscription.status !== 'CANCELLED' && !cancellation && (
            <div className="rounded-lg border border-zinc-800 p-4">
              <p className="text-white font-medium text-sm">Cancelar assinatura</p>
              <p className="text-zinc-500 text-xs mt-1 mb-3">
                Você continuará tendo acesso por 30 dias após o cancelamento.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCancelModal(true)}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                Cancelar assinatura
              </Button>
            </div>
          )}
        </>
      )}

      {tab === 'historico' && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardContent className="p-0">
            {history.length === 0 ? (
              <p className="text-zinc-500 text-sm text-center py-8">Nenhum histórico ainda</p>
            ) : (
              <div className="divide-y divide-zinc-800">
                {history.map((entry) => {
                  const action = ACTION_MAP[entry.action]
                  return (
                    <div key={entry.id} className="flex items-center gap-3 px-6 py-4">
                      {action?.icon ?? <Clock className="h-4 w-4 text-zinc-500" />}
                      <div className="flex-1">
                        <p className="text-sm text-white">{action?.label ?? entry.action}</p>
                        {entry.reason && <p className="text-xs text-zinc-500 mt-0.5">{entry.reason}</p>}
                        {entry.scheduledFor && (
                          <p className="text-xs text-zinc-600 mt-0.5">
                            Agendado para {new Date(entry.scheduledFor).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                      <p className="text-xs text-zinc-600">
                        {new Date(entry.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 text-red-400" />
              <h2 className="text-white font-semibold">Cancelar assinatura</h2>
            </div>

            <p className="text-zinc-400 text-sm">
              Você terá acesso por mais 30 dias. Após isso, sua conta será suspensa e os dados retidos por 90 dias.
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-zinc-300 text-sm">Motivo do cancelamento</Label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
                >
                  <option value="">Selecione um motivo</option>
                  <option value="Custo elevado">Custo elevado</option>
                  <option value="Não atende minhas necessidades">Não atende minhas necessidades</option>
                  <option value="Vou usar outro sistema">Vou usar outro sistema</option>
                  <option value="Fechei o negócio">Fechei o negócio</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300 text-sm">Feedback (opcional)</Label>
                <textarea
                  value={cancelFeedback}
                  onChange={(e) => setCancelFeedback(e.target.value)}
                  placeholder="Como podemos melhorar?"
                  rows={3}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-600 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300 text-sm">Digite <span className="text-red-400 font-mono">CANCELAR</span> para confirmar</Label>
                <Input
                  value={cancelConfirmation}
                  onChange={(e) => setCancelConfirmation(e.target.value)}
                  className="bg-zinc-800 border-zinc-700 text-white font-mono"
                  placeholder="CANCELAR"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 border-zinc-700 text-zinc-300"
                onClick={() => setShowCancelModal(false)}>
                Voltar
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40"
                disabled={cancelLoading || !cancelReason || cancelConfirmation !== 'CANCELAR'}
                onClick={handleCancel}
              >
                {cancelLoading ? 'Cancelando...' : 'Confirmar cancelamento'}
              </Button>
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
