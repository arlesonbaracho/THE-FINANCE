'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, Clock, Key, Eye, EyeOff } from 'lucide-react'

type Profile = {
  id: string
  name: string | null
  email: string | null
  avatarUrl: string | null
  role: string
  status: string
  ultimoAcesso: string | null
  createdAt: string
  customRole: { id: string; name: string; permissions: string[] } | null
  accessLogs: { id: string; ip: string | null; action: string; createdAt: string }[]
}

export default function PerfilPage() {
  const { data: session, update } = useSession()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showNewPw, setShowNewPw] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  function getPwStrength(pw: string) {
    let score = 0
    if (pw.length >= 8) score++
    if (pw.length >= 12) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++
    if (score <= 2) return { score, label: 'Fraca', color: 'bg-red-500', textColor: 'text-red-400' }
    if (score <= 3) return { score, label: 'Média', color: 'bg-amber-500', textColor: 'text-amber-400' }
    return { score, label: 'Forte', color: 'bg-emerald-500', textColor: 'text-emerald-400' }
  }
  const pwStrength = getPwStrength(newPw)

  useEffect(() => {
    fetch('/api/perfil').then((r) => r.json()).then((d) => {
      setProfile(d)
      setName(d.name ?? '')
    })
  }, [])

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg('')
    const res = await fetch('/api/perfil', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setSaving(false)
    if (res.ok) {
      setSaveMsg('Nome atualizado!')
      await update({ name })
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwMsg('')
    if (newPw !== confirmPw) { setPwError('As senhas não coincidem.'); return }
    if (pwStrength.score < 3) { setPwError('Senha muito fraca. Adicione maiúsculas, números e caracteres especiais.'); return }
    setPwLoading(true)
    const res = await fetch('/api/perfil', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw, confirmPassword: confirmPw }),
    })
    const data = await res.json()
    setPwLoading(false)
    if (!res.ok) { setPwError(data.error); return }
    setPwMsg('Senha alterada! Você receberá uma confirmação por email.')
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
    setTimeout(() => setPwMsg(''), 5000)
  }

  const permissions: string[] = profile?.customRole?.permissions ?? []
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Meu Perfil</h1>
        <p className="text-zinc-400 text-sm mt-1">Gerencie suas informações pessoais</p>
      </div>

      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-white text-base">Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-700 text-2xl font-bold text-white">
              {(session?.user?.name ?? session?.user?.email ?? '?')[0].toUpperCase()}
            </div>
            <div>
              <p className="text-white font-medium">{session?.user?.name ?? '(sem nome)'}</p>
              <p className="text-zinc-500 text-sm">{session?.user?.email}</p>
              <Badge className="mt-1 bg-zinc-700 text-zinc-400 text-[10px]">
                {profile?.customRole?.name ?? session?.user?.role}
              </Badge>
            </div>
          </div>
          <form onSubmit={saveName} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Nome</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            {saveMsg && <p className="text-sm text-emerald-400">{saveMsg}</p>}
            <Button type="submit" disabled={saving} className="bg-zinc-700 hover:bg-zinc-600">
              {saving ? 'Salvando...' : 'Salvar nome'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Key className="h-4 w-4" /> Alterar Senha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Senha atual</Label>
              <Input
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                required
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Nova senha</Label>
              <div className="relative">
                <Input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  required
                  className="bg-zinc-800 border-zinc-700 pr-10 text-white"
                />
                <button type="button" onClick={() => setShowNewPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                  {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {newPw.length > 0 && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map((i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= pwStrength.score ? pwStrength.color : 'bg-zinc-700'}`} />
                    ))}
                  </div>
                  <p className={`text-xs ${pwStrength.textColor}`}>{pwStrength.label} — mín. 8 chars, 1 maiúscula, 1 número, 1 especial</p>
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Confirmar nova senha</Label>
              <Input
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                required
                className={`bg-zinc-800 border-zinc-700 text-white ${confirmPw && confirmPw !== newPw ? 'border-red-600' : ''}`}
              />
              {confirmPw && confirmPw !== newPw && (
                <p className="text-xs text-red-400">As senhas não coincidem</p>
              )}
            </div>
            {pwError && <p className="text-sm text-red-400">{pwError}</p>}
            {pwMsg && <p className="text-sm text-emerald-400">{pwMsg}</p>}
            <Button
              type="submit"
              disabled={pwLoading || newPw !== confirmPw || pwStrength.score < 3}
              className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40"
            >
              {pwLoading ? 'Alterando...' : 'Alterar senha'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {(isAdmin || permissions.length > 0) && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Shield className="h-4 w-4" /> Minhas Permissões
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isAdmin ? (
              <p className="text-sm text-emerald-400">Acesso total como administrador</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {permissions.map((p) => (
                  <Badge key={p} className="bg-zinc-800 text-zinc-300 text-xs">{p}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {profile?.accessLogs && profile.accessLogs.length > 0 && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Histórico de Acesso
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-zinc-800">
              {profile.accessLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm text-zinc-300 capitalize">{log.action}</p>
                    {log.ip && <p className="text-xs text-zinc-600">{log.ip}</p>}
                  </div>
                  <p className="text-xs text-zinc-500">
                    {new Date(log.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
