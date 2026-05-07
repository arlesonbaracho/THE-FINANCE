'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KeyRound, Eye, EyeOff, CheckCircle } from 'lucide-react'

function getStrength(pw: string): { score: number; label: string; color: string } {
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

export default function ResetTokenPage({ params }: { params: Promise<{ token: string }> }) {
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
    fetch(`/api/recuperar-senha/${token}`)
      .then((r) => r.json())
      .then((d) => setStatus(d.valid ? 'valid' : 'invalid'))
      .catch(() => setStatus('invalid'))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    if (strength.score < 3) { setError('Senha muito fraca. Adicione maiúsculas, números e caracteres especiais.'); return }

    setSubmitting(true)
    const res = await fetch(`/api/recuperar-senha/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(data.error); return }
    setStatus('success')
    setTimeout(() => router.push('/auth/login?reset=1'), 3000)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900 text-zinc-100">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
            <KeyRound className="h-6 w-6 text-zinc-300" />
          </div>
          <CardTitle className="text-white">Nova senha</CardTitle>
          <CardDescription className="text-zinc-400">
            {status === 'loading' && 'Validando link...'}
            {status === 'valid' && 'Crie sua nova senha'}
            {status === 'invalid' && 'Link inválido ou expirado'}
            {status === 'success' && 'Senha redefinida!'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {status === 'loading' && (
            <div className="flex justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
            </div>
          )}

          {status === 'invalid' && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-red-400">Este link é inválido ou já expirou.</p>
              <Link href="/recuperar-senha" className="block text-sm text-zinc-400 hover:text-white transition-colors">
                Solicitar novo link →
              </Link>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-emerald-400" />
              <p className="text-sm text-zinc-300">Senha redefinida com sucesso! Redirecionando...</p>
            </div>
          )}

          {status === 'valid' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Nova senha</Label>
                <div className="relative">
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                    className="border-zinc-700 bg-zinc-800 pr-10 text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Barra de força */}
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            i <= strength.score ? strength.color : 'bg-zinc-700'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs ${strength.score <= 2 ? 'text-red-400' : strength.score <= 3 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {strength.label} — mín. 8 caracteres, 1 maiúscula, 1 número, 1 especial
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-zinc-300">Confirmar senha</Label>
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className={`border-zinc-700 bg-zinc-800 text-white ${
                    confirm && confirm !== password ? 'border-red-600' : ''
                  }`}
                />
                {confirm && confirm !== password && (
                  <p className="text-xs text-red-400">As senhas não coincidem</p>
                )}
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button
                type="submit"
                disabled={submitting || password !== confirm || strength.score < 3}
                className="w-full bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40"
              >
                {submitting ? 'Salvando...' : 'Redefinir senha'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
