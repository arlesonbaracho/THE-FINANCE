'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield } from 'lucide-react'

type Step = 'credentials' | 'totp'

export default function AdminLoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totpToken, setTotpToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (!res.ok) { setError(data.error); return }

      if (data.requiresTotpSetup) {
        router.push(`/admin/setup-2fa?adminId=${data.adminId as string}`)
        return
      }
      if (data.requiresTotp) {
        setStep('totp')
        return
      }
      router.push('/admin')
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleTotp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, totpToken }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push('/admin')
    } catch {
      setError('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900 text-slate-100">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800">
            <Shield className="h-6 w-6 text-slate-300" />
          </div>
          <CardTitle className="text-xl text-white">THE FINANCE — Super Admin</CardTitle>
          <CardDescription className="text-slate-400">
            {step === 'credentials' ? 'Acesso restrito a administradores' : 'Verificação em duas etapas'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === 'credentials' ? (
            <form onSubmit={handleCredentials} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-slate-300">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="border-slate-700 bg-slate-800 text-white"
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full bg-slate-700 hover:bg-slate-600">
                {loading ? 'Verificando...' : 'Entrar'}
              </Button>
              <Link
                href="/admin/recuperar-senha"
                className="block text-center text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Esqueci minha senha
              </Link>
            </form>
          ) : (
            <form onSubmit={handleTotp} className="space-y-4">
              <p className="text-sm text-slate-400">
                Digite o código de 6 dígitos do seu aplicativo autenticador.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="totp" className="text-slate-300">Código 2FA</Label>
                <Input
                  id="totp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, ''))}
                  required
                  autoFocus
                  placeholder="000000"
                  className="border-slate-700 bg-slate-800 text-center text-2xl tracking-widest text-white"
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full bg-slate-700 hover:bg-slate-600">
                {loading ? 'Verificando...' : 'Verificar'}
              </Button>
              <button
                type="button"
                onClick={() => setStep('credentials')}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-300"
              >
                Voltar
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
