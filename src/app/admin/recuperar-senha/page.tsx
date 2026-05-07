'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, ArrowLeft, CheckCircle } from 'lucide-react'

export default function AdminRecuperarSenhaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/auth/recuperar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.status === 429) {
        setError('Muitas tentativas. Aguarde antes de tentar novamente.')
        return
      }
      setSent(true)
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
          <CardTitle className="text-white">Recuperar acesso Admin</CardTitle>
          <CardDescription className="text-slate-400">
            {sent ? 'Verifique seu email' : 'Link expira em 15 minutos — alta segurança'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-emerald-400" />
              <p className="text-sm text-slate-300">
                Se este email estiver cadastrado, você receberá as instruções em breve.
              </p>
              <p className="text-xs text-slate-500">
                Após redefinir a senha, sua autenticação 2FA será reiniciada.
              </p>
              <Link href="/admin/login" className="block text-sm text-slate-400 hover:text-white transition-colors">
                ← Voltar para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-slate-300">Email do administrador</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="border-slate-700 bg-slate-800 text-white"
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full bg-slate-700 hover:bg-slate-600">
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </Button>
              <Link
                href="/admin/login"
                className="flex items-center justify-center gap-1 text-sm text-slate-500 hover:text-slate-300 transition-colors"
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
