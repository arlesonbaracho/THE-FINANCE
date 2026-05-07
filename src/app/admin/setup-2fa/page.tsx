'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield } from 'lucide-react'

function Setup2FAContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const adminId = searchParams.get('adminId')

  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!adminId) { router.push('/admin/login'); return }
    fetch(`/api/admin/auth/setup-2fa?adminId=${adminId}`)
      .then((r) => r.json())
      .then((d) => { setQrCode(d.qrCode); setSecret(d.secret) })
      .catch(() => setError('Erro ao gerar QR code'))
  }, [adminId, router])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/auth/setup-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId, token }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      router.push('/admin')
    } catch {
      setError('Erro ao verificar código.')
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
          <CardTitle className="text-white">Configurar Autenticação 2FA</CardTitle>
          <CardDescription className="text-slate-400">
            Escaneie o QR code com Google Authenticator ou Authy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {qrCode ? (
            <div className="flex justify-center rounded-lg bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="QR Code 2FA" width={180} height={180} />
            </div>
          ) : (
            <div className="flex h-44 items-center justify-center rounded-lg bg-slate-800 text-slate-500 text-sm">
              Gerando QR code…
            </div>
          )}

          {secret && (
            <div className="rounded-lg bg-slate-800 px-4 py-2 text-center">
              <p className="text-xs text-slate-400 mb-1">Chave manual</p>
              <code className="text-xs text-slate-300 break-all">{secret}</code>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="token" className="text-slate-300">Código de confirmação</Label>
              <Input
                id="token"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                required
                className="border-slate-700 bg-slate-800 text-center text-xl tracking-widest text-white"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <Button
              type="submit"
              disabled={loading || token.length < 6}
              className="w-full bg-slate-700 hover:bg-slate-600"
            >
              {loading ? 'Verificando...' : 'Confirmar e acessar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function Setup2FAPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-slate-300" />
      </div>
    }>
      <Setup2FAContent />
    </Suspense>
  )
}
