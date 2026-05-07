'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Eye, EyeOff, CheckCircle } from 'lucide-react'

function getStrength(pw: string) {
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 2) return { score, label: 'Fraca', color: 'bg-red-500' }
  if (score <= 3) return { score, label: 'Média', color: 'bg-amber-500' }
  return { score, label: 'Forte', color: 'bg-emerald-500' }
}

export default function AdminResetTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'success'>('loading')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const strength = getStrength(password)

  useEffect(() => {
    fetch(`/api/admin/auth/recuperar-senha/${token}`)
      .then((r) => r.json())
      .then((d) => setStatus(d.valid ? 'valid' : 'invalid'))
      .catch(() => setStatus('invalid'))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    if (strength.score < 3) { setError('Senha muito fraca.'); return }
    setSubmitting(true)
    const res = await fetch(`/api/admin/auth/recuperar-senha/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(data.error); return }
    setStatus('success')
    setTimeout(() => router.push('/admin/login'), 3000)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900 text-slate-100">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800">
            <Shield className="h-6 w-6 text-slate-300" />
          </div>
          <CardTitle className="text-white">Nova senha — Admin</CardTitle>
          <CardDescription className="text-slate-400">
            {status === 'valid' && 'Após redefinir, sua autenticação 2FA será reiniciada'}
            {status === 'success' && 'Senha redefinida com sucesso'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {status === 'loading' && (
            <div className="flex justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-slate-300" />
            </div>
          )}

          {status === 'invalid' && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-red-400">Link inválido ou expirado (15 min).</p>
              <Link href="/admin/recuperar-senha" className="block text-sm text-slate-400 hover:text-white">
                Solicitar novo link →
              </Link>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-emerald-400" />
              <p className="text-sm text-slate-300">Redirecionando para o login...</p>
              <p className="text-xs text-slate-500">Configure seu 2FA novamente ao entrar.</p>
            </div>
          )}

          {status === 'valid' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-slate-300">Nova senha</Label>
                <div className="relative">
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                    className="border-slate-700 bg-slate-800 pr-10 text-white"
                  />
                  <button type="button" onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : 'bg-slate-700'}`} />
                      ))}
                    </div>
                    <p className={`text-xs ${strength.score <= 2 ? 'text-red-400' : strength.score <= 3 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {strength.label}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-300">Confirmar senha</Label>
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className={`border-slate-700 bg-slate-800 text-white ${confirm && confirm !== password ? 'border-red-600' : ''}`}
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button type="submit" disabled={submitting || password !== confirm || strength.score < 3}
                className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-40">
                {submitting ? 'Salvando...' : 'Redefinir senha'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
