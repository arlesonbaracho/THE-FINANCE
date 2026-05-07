'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KeyRound, ArrowLeft, CheckCircle } from 'lucide-react'

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/recuperar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.status === 429) {
        setError('Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.')
        return
      }
      setSent(true)
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <Card className="w-full max-w-md border-zinc-800 bg-zinc-900 text-zinc-100">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800">
            <KeyRound className="h-6 w-6 text-zinc-300" />
          </div>
          <CardTitle className="text-white">Recuperar senha</CardTitle>
          <CardDescription className="text-zinc-400">
            {sent ? 'Verifique seu email' : 'Informe seu email cadastrado'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-emerald-400" />
              <p className="text-sm text-zinc-300">
                Se este email estiver cadastrado, você receberá as instruções em breve.
              </p>
              <p className="text-xs text-zinc-500">
                Verifique também sua caixa de spam. O link expira em 30 minutos.
              </p>
              <Link href="/auth/login" className="block text-sm text-zinc-400 hover:text-white transition-colors">
                ← Voltar para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-zinc-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="seu@email.com"
                  className="border-zinc-700 bg-zinc-800 text-white placeholder:text-zinc-600"
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full bg-zinc-700 hover:bg-zinc-600">
                {loading ? 'Enviando...' : 'Enviar instruções'}
              </Button>
              <Link
                href="/auth/login"
                className="flex items-center justify-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <ArrowLeft className="h-3 w-3" /> Voltar para o login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
