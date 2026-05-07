'use client'

import { useEffect, useState, use } from 'react'
import { ChefHat, Delete } from 'lucide-react'

type KitchenUser = { id: string; name: string; avatarUrl: string | null }
type TenantInfo = { id: string; name: string }

type Step = 'select' | 'pin'

export default function CozinhaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [users, setUsers] = useState<KitchenUser[]>([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>('select')
  const [selected, setSelected] = useState<KitchenUser | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [authing, setAuthing] = useState(false)

  useEffect(() => {
    fetch(`/api/cozinha/auth?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.tenant) setTenant(d.tenant)
        if (Array.isArray(d.users)) setUsers(d.users)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [slug])

  function selectUser(user: KitchenUser) {
    setSelected(user)
    setPin('')
    setError('')
    setStep('pin')
  }

  function pressDigit(d: string) {
    if (pin.length < 4) setPin((p) => p + d)
  }

  function backspace() {
    setPin((p) => p.slice(0, -1))
  }

  useEffect(() => {
    if (pin.length === 4) authenticate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  async function authenticate() {
    if (!selected) return
    setAuthing(true)
    setError('')
    const res = await fetch('/api/cozinha/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantSlug: slug, userId: selected.id, pin }),
    })
    const data = await res.json()
    setAuthing(false)
    if (!res.ok) {
      setError('PIN incorreto')
      setPin('')
      return
    }
    // Store kitchen session in sessionStorage and redirect
    sessionStorage.setItem('kitchenSession', JSON.stringify(data))
    window.location.href = `/${slug}/cozinha/pedidos`
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800">
          <ChefHat className="h-7 w-7 text-zinc-300" />
        </div>
        <h1 className="text-xl font-bold text-white">{tenant?.name ?? slug}</h1>
        <p className="text-sm text-zinc-500">Cozinha</p>
      </div>

      {step === 'select' ? (
        <div className="w-full max-w-sm">
          <p className="mb-4 text-center text-sm text-zinc-400">Selecione seu nome</p>
          {users.length === 0 ? (
            <p className="text-center text-zinc-600 text-sm">Nenhum usuário com PIN configurado</p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => selectUser(u)}
                  className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-left transition-colors hover:border-zinc-600 hover:bg-zinc-800"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-700 text-sm font-semibold text-white shrink-0">
                    {(u.name ?? '?')[0].toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-white">{u.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="w-full max-w-xs">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-700 text-lg font-bold text-white">
              {(selected?.name ?? '?')[0].toUpperCase()}
            </div>
            <p className="text-white font-medium">{selected?.name}</p>
            <p className="text-zinc-500 text-sm">Digite seu PIN</p>
          </div>

          <div className="mb-6 flex justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-4 w-4 rounded-full transition-colors ${i < pin.length ? 'bg-white' : 'bg-zinc-700'}`}
              />
            ))}
          </div>

          {error && <p className="mb-4 text-center text-sm text-red-400">{error}</p>}
          {authing && <p className="mb-4 text-center text-sm text-zinc-400">Verificando...</p>}

          <div className="grid grid-cols-3 gap-3">
            {['1','2','3','4','5','6','7','8','9'].map((d) => (
              <button
                key={d}
                onClick={() => pressDigit(d)}
                disabled={authing}
                className="flex h-14 items-center justify-center rounded-xl bg-zinc-800 text-xl font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
              >
                {d}
              </button>
            ))}
            <button
              onClick={() => { setStep('select'); setSelected(null); setPin(''); setError('') }}
              className="flex h-14 items-center justify-center rounded-xl bg-zinc-800 text-xs text-zinc-400 transition-colors hover:bg-zinc-700"
            >
              Voltar
            </button>
            <button
              onClick={() => pressDigit('0')}
              disabled={authing}
              className="flex h-14 items-center justify-center rounded-xl bg-zinc-800 text-xl font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              0
            </button>
            <button
              onClick={backspace}
              disabled={authing}
              className="flex h-14 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              <Delete className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
