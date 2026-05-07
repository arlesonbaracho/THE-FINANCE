'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Store } from 'lucide-react'

type InviteInfo = {
  email: string
  tenantName: string
  tenantLogo: string | null
}

export default function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch(`/api/convite/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error) } else { setInfo(d) }
        setLoading(false)
      })
      .catch(() => { setError('Erro ao carregar convite'); setLoading(false) })
  }, [token])

  async function accept(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const res = await fetch(`/api/convite/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(data.error); return }
    setSuccess(true)
    setTimeout(() => router.push('/auth/login'), 3000)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900 text-zinc-100">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
            <Store className="h-6 w-6 text-zinc-300" />
          </div>
          <CardTitle className="text-white">
            {loading ? 'Carregando...' : success ? 'Conta criada!' : info ? `Entrar em ${info.tenantName}` : 'Convite inválido'}
          </CardTitle>
          {info && !success && (
            <CardDescription className="text-zinc-400">
              Você foi convidado para <strong className="text-zinc-200">{info.tenantName}</strong> com o email <strong className="text-zinc-200">{info.email}</strong>
            </CardDescription>
          )}
        </CardHeader>

        <CardContent>
          {loading && (
            <div className="flex justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
            </div>
          )}

          {!loading && success && (
            <p className="text-center text-sm text-emerald-400">
              Conta criada com sucesso! Redirecionando para o login...
            </p>
          )}

          {!loading && !success && error && !info && (
            <p className="text-center text-sm text-red-400">{error}</p>
          )}

          {!loading && !success && info && (
            <form onSubmit={accept} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Seu nome</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  placeholder="Nome completo"
                  className="border-zinc-700 bg-zinc-800 text-white"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Crie uma senha</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  className="border-zinc-700 bg-zinc-800 text-white"
                />
                <p className="text-xs text-zinc-500">Precisa de 1 maiúscula e 1 número</p>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button type="submit" disabled={submitting} className="w-full bg-zinc-700 hover:bg-zinc-600">
                {submitting ? 'Criando conta...' : 'Criar conta e entrar'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
