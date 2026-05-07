'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { UserPlus, Mail, Shield, UserX, UserCheck, Trash2, Copy, Check, Hash } from 'lucide-react'

type UserItem = {
  id: string
  name: string | null
  email: string | null
  role: string
  status: string
  ultimoAcesso: string | null
  avatarUrl: string | null
  customRole: { id: string; name: string } | null
}

type RoleItem = {
  id: string
  name: string
  isDefault: boolean
  permissions: string[]
  _count: { users: number }
}

export default function UsuariosPage() {
  const { data: session } = useSession()
  const [users, setUsers] = useState<UserItem[]>([])
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRoleId, setInviteRoleId] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [copied, setCopied] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [pinModal, setPinModal] = useState<{ userId: string; name: string } | null>(null)
  const [newPin, setNewPin] = useState('')
  const [pinSaving, setPinSaving] = useState(false)
  const [pinMsg, setPinMsg] = useState('')
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'

  async function load() {
    const [ur, rr] = await Promise.all([fetch('/api/usuarios'), fetch('/api/roles')])
    const [ud, rd] = await Promise.all([ur.json(), rr.json()])
    if (Array.isArray(ud)) setUsers(ud)
    if (Array.isArray(rd)) setRoles(rd)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteLoading(true)
    setInviteError('')
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, roleId: inviteRoleId || undefined }),
    })
    const data = await res.json()
    setInviteLoading(false)
    if (!res.ok) { setInviteError(data.error); return }
    setInviteLink(data.inviteUrl)
    setInviteEmail('')
    setInviteRoleId('')
  }

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function toggleStatus(user: UserItem) {
    const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    await fetch(`/api/usuarios/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    load()
  }

  async function savePin(e: React.FormEvent) {
    e.preventDefault()
    if (!pinModal || !/^\d{4}$/.test(newPin)) return
    setPinSaving(true)
    const res = await fetch(`/api/usuarios/${pinModal.userId}/pin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: newPin }),
    })
    setPinSaving(false)
    if (res.ok) {
      setPinMsg('PIN redefinido com sucesso!')
      setTimeout(() => { setPinModal(null); setPinMsg(''); setNewPin('') }, 1500)
    }
  }

  async function changeRole(userId: string, roleId: string) {
    await fetch(`/api/usuarios/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customRoleId: roleId || null }),
    })
    load()
  }

  function statusBadge(status: string) {
    if (status === 'ACTIVE') return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Ativo</Badge>
    if (status === 'PENDING') return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Pendente</Badge>
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Inativo</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Usuários</h1>
          <p className="text-zinc-400 text-sm mt-1">Gerencie os membros do seu restaurante</p>
        </div>
        {isAdmin && (
          <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) { setInviteLink(''); setInviteError('') } }}>
            <DialogTrigger className="inline-flex items-center justify-center gap-2 rounded-md bg-zinc-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-600">
              <UserPlus className="h-4 w-4" /> Convidar usuário
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
              <DialogHeader>
                <DialogTitle>Convidar usuário</DialogTitle>
              </DialogHeader>
              {!inviteLink ? (
                <form onSubmit={sendInvite} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-zinc-300">Email</Label>
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                      placeholder="colaborador@email.com"
                      className="bg-zinc-800 border-zinc-700 text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-zinc-300">Função</Label>
                    <select
                      value={inviteRoleId}
                      onChange={(e) => setInviteRoleId(e.target.value)}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
                    >
                      <option value="">Sem função específica</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  {inviteError && <p className="text-sm text-red-400">{inviteError}</p>}
                  <Button type="submit" disabled={inviteLoading} className="w-full bg-zinc-700 hover:bg-zinc-600">
                    <Mail className="h-4 w-4 mr-2" />
                    {inviteLoading ? 'Gerando...' : 'Gerar link de convite'}
                  </Button>
                </form>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-zinc-400">Link gerado com validade de 48 horas. Compartilhe com o colaborador.</p>
                  <div className="flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2">
                    <code className="text-xs text-zinc-300 flex-1 break-all">{inviteLink}</code>
                    <button onClick={copyLink} className="shrink-0 text-zinc-400 hover:text-white">
                      {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button onClick={() => { setInviteLink(''); setInviteOpen(false) }} className="w-full bg-zinc-700 hover:bg-zinc-600">
                    Fechar
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-white text-base">Membros ({users.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-zinc-500 text-sm">Carregando...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-sm">Nenhum usuário encontrado</div>
          ) : (
            <div className="divide-y divide-zinc-800">
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-sm font-semibold text-white">
                    {(user.name ?? user.email ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{user.name ?? '(sem nome)'}</p>
                    <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {isAdmin && user.id !== session?.user?.id ? (
                      <select
                        value={user.customRole?.id ?? ''}
                        onChange={(e) => changeRole(user.id, e.target.value)}
                        className="text-xs rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-300"
                      >
                        <option value="">Função padrão</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-zinc-500">
                        <Shield className="h-3 w-3" />
                        {user.customRole?.name ?? user.role}
                      </span>
                    )}
                    {statusBadge(user.status)}
                    {isAdmin && user.id !== session?.user?.id && (
                      <>
                        <button
                          onClick={() => { setPinModal({ userId: user.id, name: user.name ?? user.email ?? '' }); setNewPin('') }}
                          title="Redefinir PIN"
                          className="text-zinc-500 hover:text-zinc-300 transition-colors"
                        >
                          <Hash className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => toggleStatus(user)}
                          title={user.status === 'ACTIVE' ? 'Desativar' : 'Ativar'}
                          className="text-zinc-500 hover:text-white transition-colors"
                        >
                          {user.status === 'ACTIVE' ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </button>
                      </>
                    )}
                    {user.id === session?.user?.id && (
                      <span className="text-xs text-zinc-600">você</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <RolesSection roles={roles} onChanged={load} />
      )}

      {/* Modal de redefinição de PIN */}
      <Dialog open={!!pinModal} onOpenChange={(o) => { if (!o) { setPinModal(null); setNewPin(''); setPinMsg('') } }}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
          <DialogHeader>
            <DialogTitle>Redefinir PIN — {pinModal?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={savePin} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-zinc-300">Novo PIN (4 dígitos)</Label>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                required
                placeholder="0000"
                autoFocus
                className="bg-zinc-800 border-zinc-700 text-center text-2xl tracking-widest text-white"
              />
            </div>
            {pinMsg && <p className="text-sm text-emerald-400">{pinMsg}</p>}
            <Button
              type="submit"
              disabled={pinSaving || newPin.length < 4}
              className="w-full bg-zinc-700 hover:bg-zinc-600"
            >
              {pinSaving ? 'Salvando...' : 'Salvar PIN'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RolesSection({ roles, onChanged }: { roles: RoleItem[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [selectedPerms, setSelectedPerms] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const ALL_PERMS = [
    { key: 'estoque.ver', label: 'Ver estoque' },
    { key: 'estoque.criar', label: 'Criar insumos' },
    { key: 'estoque.editar', label: 'Editar insumos' },
    { key: 'estoque.deletar', label: 'Excluir insumos' },
    { key: 'estoque.movimentar', label: 'Movimentar estoque' },
    { key: 'produtos.ver', label: 'Ver produtos' },
    { key: 'produtos.criar', label: 'Criar produtos' },
    { key: 'produtos.editar', label: 'Editar produtos' },
    { key: 'produtos.deletar', label: 'Excluir produtos' },
    { key: 'usuarios.ver', label: 'Ver usuários' },
    { key: 'usuarios.gerenciar', label: 'Gerenciar usuários' },
    { key: 'relatorios.ver', label: 'Ver relatórios' },
    { key: 'configuracoes.ver', label: 'Ver configurações' },
    { key: 'configuracoes.editar', label: 'Editar configurações' },
    { key: 'cozinha.ver', label: 'Ver cozinha' },
    { key: 'cozinha.gerenciar', label: 'Gerenciar cozinha' },
  ]

  function togglePerm(key: string) {
    setSelectedPerms((prev) => prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key])
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (selectedPerms.length === 0) { setError('Selecione ao menos uma permissão'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, permissions: selectedPerms }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error); return }
    setOpen(false)
    setName('')
    setSelectedPerms([])
    onChanged()
  }

  async function deleteRole(id: string) {
    if (!confirm('Remover função?')) return
    await fetch(`/api/roles/${id}`, { method: 'DELETE' })
    onChanged()
  }

  return (
    <Card className="border-zinc-800 bg-zinc-900">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-white text-base">Funções ({roles.length})</CardTitle>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setError(''); setSelectedPerms([]) } }}>
          <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-zinc-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-600">
            Nova função
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova função personalizada</DialogTitle>
            </DialogHeader>
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Nome da função</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Ex: Supervisor"
                  className="bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-300">Permissões</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_PERMS.map((p) => (
                    <label key={p.key} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPerms.includes(p.key)}
                        onChange={() => togglePerm(p.key)}
                        className="accent-zinc-400"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button type="submit" disabled={saving} className="w-full bg-zinc-700 hover:bg-zinc-600">
                {saving ? 'Salvando...' : 'Criar função'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-zinc-800">
          {roles.map((role) => (
            <div key={role.id} className="flex items-center gap-3 px-6 py-3">
              <Shield className="h-4 w-4 text-zinc-500 shrink-0" />
              <div className="flex-1">
                <span className="text-sm text-white">{role.name}</span>
                {role.isDefault && <Badge className="ml-2 bg-zinc-700 text-zinc-400 text-[10px]">Padrão</Badge>}
              </div>
              <span className="text-xs text-zinc-500">{role._count.users} usuário{role._count.users !== 1 ? 's' : ''}</span>
              {!role.isDefault && (
                <button onClick={() => deleteRole(role.id)} className="text-zinc-600 hover:text-red-400 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
