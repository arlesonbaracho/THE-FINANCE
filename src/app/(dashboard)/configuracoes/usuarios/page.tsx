'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import {
  UserPlus, Users, Shield, Trash2, Plus, Search,
  MoreVertical, Pencil, KeyRound, UserCheck, UserX,
  Mail, ChefHat, RefreshCw, Package, ShoppingCart,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { StatCard } from '@/components/ui/stat-card'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/permissions-constants'
import type { UserItem, RoleItem } from '@/components/usuarios/user-card'
import { InviteSheet } from '@/components/usuarios/invite-sheet'
import { EditUserSheet } from '@/components/usuarios/edit-user-sheet'
import { ResetPinSheet } from '@/components/usuarios/reset-pin-sheet'
import { RoleDetail } from '@/components/usuarios/role-detail'

// ── Cores ─────────────────────────────────────────────────────────────────────

const C = {
  txt:         '#e8f0ec',
  surface:     '#111a16',
  surface2:    '#0d1410',
  border:      '#1e2e26',
  borderLight: '#141e19',
  rowHover:    '#0d1a14',
  txt2:        '#c8dcd2',
  muted:       '#3d6050',
  dim:         '#2d5040',
  subtle:      '#5a7a6a',
  green:       '#2a9d6f',
  greenLight:  '#4bc994',
  greenBg:     '#0d2b1f',
  yellow:      '#d4a017',
  yellowBg:    '#1c1500',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name?: string | null, email?: string | null): string {
  const src = name || email || '?'
  return src.slice(0, 2).toUpperCase()
}

function lastSeen(user: UserItem): string {
  if (user.status === 'PENDING') {
    if (!user.createdAt) return 'Convite enviado'
    try {
      return `Convidado ${formatDistanceToNow(new Date(user.createdAt), { addSuffix: true, locale: ptBR })}`
    } catch { return 'Convite enviado' }
  }
  if (!user.email) return 'Acesso via PIN'
  if (!user.ultimoAcesso) return 'Nunca acessou'
  try {
    return formatDistanceToNow(new Date(user.ultimoAcesso), { addSuffix: true, locale: ptBR })
  } catch { return '—' }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string; border: string }> = {
    ACTIVE:   { label: 'Ativo',    bg: '#071a0f', color: C.greenLight, border: '#0d3322' },
    PENDING:  { label: 'Pendente', bg: C.yellowBg, color: C.yellow,   border: '#3a2a00' },
    INACTIVE: { label: 'Inativo',  bg: C.yellowBg, color: C.yellow,   border: '#3a2a00' },
  }
  const s = map[status] ?? map.INACTIVE
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 9999,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      {s.label}
    </span>
  )
}

const ALL_PERMS = [
  { key: 'estoque.ver',          label: 'Ver estoque' },
  { key: 'estoque.criar',        label: 'Criar insumos' },
  { key: 'estoque.editar',       label: 'Editar insumos' },
  { key: 'estoque.deletar',      label: 'Excluir insumos' },
  { key: 'estoque.movimentar',   label: 'Movimentar estoque' },
  { key: 'produtos.ver',         label: 'Ver produtos' },
  { key: 'produtos.criar',       label: 'Criar produtos' },
  { key: 'produtos.editar',      label: 'Editar produtos' },
  { key: 'produtos.deletar',     label: 'Excluir produtos' },
  { key: 'usuarios.ver',         label: 'Ver usuários' },
  { key: 'usuarios.gerenciar',   label: 'Gerenciar usuários' },
  { key: 'relatorios.ver',       label: 'Ver relatórios' },
  { key: 'configuracoes.ver',    label: 'Ver configurações' },
  { key: 'configuracoes.editar', label: 'Editar configurações' },
  { key: 'cozinha.ver',          label: 'Ver cozinha' },
  { key: 'cozinha.gerenciar',    label: 'Gerenciar cozinha' },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const { data: session } = useSession()
  const { can } = usePermissions()
  const [users, setUsers]   = useState<UserItem[]>([])
  const [roles, setRoles]   = useState<RoleItem[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch]                 = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterRole, setFilterRole]         = useState('all')
  const [filterStatus, setFilterStatus]     = useState('all')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [activeTab, setActiveTab] = useState<'funcionarios' | 'cargos'>('funcionarios')

  const [inviteOpen, setInviteOpen]               = useState(false)
  const [editUser, setEditUser]                   = useState<UserItem | null>(null)
  const [resetPINUser, setResetPINUser]           = useState<UserItem | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = useState<UserItem | null>(null)
  const [removeUser, setRemoveUser]               = useState<UserItem | null>(null)
  const [selectedRoleId, setSelectedRoleId]       = useState<string | null>(null)

  const [tenantInfo, setTenantInfo] = useState<{ name: string; slug: string } | null>(null)
  const [newRoleOpen, setNewRoleOpen]   = useState(false)
  const [newRoleName, setNewRoleName]   = useState('')
  const [newRolePerms, setNewRolePerms] = useState<string[]>([])
  const [roleSaving, setRoleSaving]     = useState(false)
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<RoleItem | null>(null)

  useEffect(() => {
    fetch('/api/perfil/tenant')
      .then((r) => r.json())
      .then((d) => { if (d.slug) setTenantInfo(d) })
      .catch(() => {})
  }, [])

  const load = useCallback(async () => {
    const [ur, rr] = await Promise.all([fetch('/api/usuarios'), fetch('/api/roles')])
    const [ud, rd] = await Promise.all([ur.json(), rr.json()])
    if (Array.isArray(ud)) setUsers(ud)
    if (Array.isArray(rd)) setRoles(rd)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function handleSearchChange(v: string) {
    setSearch(v)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebouncedSearch(v), 300)
  }

  function handleTabChange(tab: 'funcionarios' | 'cargos') {
    setActiveTab(tab)
    if (tab === 'cargos' && selectedRoleId === null && roles.length > 0) setSelectedRoleId(roles[0].id)
    if (tab === 'funcionarios') setSelectedRoleId(null)
  }

  const filtered = useMemo(() => users.filter((u) => {
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      if (!u.name?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false
    }
    if (filterRole !== 'all' && u.customRole?.id !== filterRole) return false
    if (filterStatus !== 'all' && u.status !== filterStatus) return false
    return true
  }), [users, debouncedSearch, filterRole, filterStatus])

  async function handleAction(action: string, userId: string) {
    const user = users.find((u) => u.id === userId)
    if (!user) return
    switch (action) {
      case 'edit':          setEditUser(user); break
      case 'resetPassword': setResetPasswordUser(user); break
      case 'resetPIN':      setResetPINUser(user); break
      case 'deactivate':    await patchStatus(userId, 'INACTIVE'); break
      case 'activate':      await patchStatus(userId, 'ACTIVE'); break
      case 'resendInvite':  await resendInvite(user); break
      case 'remove':        setRemoveUser(user); break
    }
  }

  async function patchStatus(userId: string, status: 'ACTIVE' | 'INACTIVE') {
    const res = await fetch(`/api/usuarios/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      toast.success(status === 'ACTIVE' ? 'Funcionário reativado' : 'Funcionário desativado')
      load()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Erro ao atualizar status')
    }
  }

  async function resendInvite(user: UserItem) {
    if (!user.email) return
    const res = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, roleId: user.customRole?.id }),
    })
    if (res.ok) {
      toast.success(`Convite reenviado para ${user.email}`)
      load()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Erro ao reenviar convite')
    }
  }

  async function confirmRemove() {
    if (!removeUser) return
    const res = await fetch(`/api/usuarios/${removeUser.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Funcionário removido')
      setRemoveUser(null)
      load()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Erro ao remover')
    }
  }

  async function confirmResetPassword() {
    if (!resetPasswordUser) return
    const res = await fetch(`/api/usuarios/${resetPasswordUser.id}/reset-senha`, { method: 'POST' })
    const d = await res.json()
    if (res.ok) {
      toast.success(`Link de reset enviado para ${resetPasswordUser.email}`)
    } else {
      toast.error(d.error ?? 'Erro ao enviar reset')
    }
    setResetPasswordUser(null)
  }

  async function createRole(e: React.FormEvent) {
    e.preventDefault()
    if (newRolePerms.length === 0) { toast.error('Selecione ao menos uma permissão'); return }
    setRoleSaving(true)
    const res = await fetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newRoleName, permissions: newRolePerms }),
    })
    const d = await res.json()
    setRoleSaving(false)
    if (!res.ok) { toast.error(d.error ?? 'Erro ao criar cargo'); return }
    toast.success(`Cargo "${newRoleName}" criado`)
    setNewRoleOpen(false)
    setNewRoleName('')
    setNewRolePerms([])
    load()
  }

  async function deleteRole() {
    if (!deleteRoleTarget) return
    await fetch(`/api/roles/${deleteRoleTarget.id}`, { method: 'DELETE' })
    toast.success(`Cargo "${deleteRoleTarget.name}" removido`)
    setDeleteRoleTarget(null)
    if (selectedRoleId === deleteRoleTarget.id) setSelectedRoleId(null)
    load()
  }

  function handlePermissionsUpdate(roleId: string, permissions: string[]) {
    setRoles((prev) => prev.map((r) => r.id === roleId ? { ...r, permissions } : r))
  }

  const selectedRole  = roles.find((r) => r.id === selectedRoleId) ?? null
  const usersOfRole   = selectedRole ? users.filter((u) => u.customRole?.id === selectedRole.id) : []
  const activeCount   = users.filter((u) => u.status === 'ACTIVE').length
  const inactiveCount = users.filter((u) => u.status === 'INACTIVE').length

  if (!can(PERMISSIONS.USUARIOS_GERENCIAR) && !can(PERMISSIONS.USUARIOS_VER)) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Shield size={48} style={{ color: 'var(--tf-txt3)', marginBottom: 12 }} />
        <p style={{ fontSize: 15, color: 'var(--tf-txt2)' }}>Sem permissão para acessar esta área.</p>
      </div>
    )
  }

  function tabStyle(tab: 'funcionarios' | 'cargos'): React.CSSProperties {
    const on = activeTab === tab
    return {
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 14px', fontSize: 13, fontWeight: 500,
      borderRadius: 6, border: 'none', cursor: 'pointer',
      transition: 'background 0.12s, color 0.12s',
      background: on ? C.greenBg : 'transparent',
      color:      on ? C.greenLight : C.dim,
      outline:    on ? `1px solid #1e3d2e` : '1px solid transparent',
    }
  }

  return (
    <div className="space-y-5">
      <style>{`
        .tf-urow:hover td { background: ${C.rowHover} !important; }
        .tf-role-item:hover { background: ${C.rowHover}; }
        .tf-chef-btn:hover { background: ${C.greenBg} !important; color: ${C.greenLight} !important; }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: C.txt, margin: 0 }}>
            Funcionários
          </h1>
          <p style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
            {users.filter((u) => u.status !== 'INACTIVE').length} funcionários · {roles.length} cargos
          </p>
        </div>
        {can(PERMISSIONS.USUARIOS_GERENCIAR) && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" /> Convidar funcionário
          </Button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard title="Total de funcionários" value={users.length} icon={Users} />
        <StatCard title="Ativos" value={activeCount} icon={UserCheck} variant="success" />
        <StatCard title="Cargos" value={roles.length} icon={Shield} variant="warning" />
      </div>

      {/* Link banners (cozinha / estoque / caixa) */}
      {tenantInfo && (
        <>
          <div style={{
            background: C.greenBg, border: '1px solid #1e3d2e',
            borderRadius: 10, padding: '14px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ChefHat size={16} style={{ color: C.greenLight, flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: 12, color: C.muted, display: 'block' }}>
                  Link de acesso da cozinha (PIN)
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.greenLight, fontFamily: 'monospace' }}>
                  {typeof window !== 'undefined' ? window.location.origin : ''}/{tenantInfo.slug}/cozinha
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const url = `${window.location.origin}/${tenantInfo.slug}/cozinha`
                navigator.clipboard.writeText(url)
                toast.success('Link copiado!')
              }}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                background: C.greenBg, border: '1px solid #2a9d6f',
                color: C.greenLight, cursor: 'pointer', flexShrink: 0,
              }}
            >
              Copiar link
            </button>
          </div>

          <div style={{
            background: '#0a1a2b', border: '1px solid #1a3a5e',
            borderRadius: 10, padding: '14px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Package size={16} style={{ color: '#4b8fd4', flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: 12, color: '#3d5068', display: 'block' }}>
                  Link de acesso do estoque (PIN)
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#4b8fd4', fontFamily: 'monospace' }}>
                  {typeof window !== 'undefined' ? window.location.origin : ''}/{tenantInfo.slug}/estoque
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const url = `${window.location.origin}/${tenantInfo.slug}/estoque`
                navigator.clipboard.writeText(url)
                toast.success('Link copiado!')
              }}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                background: '#0a1a2b', border: '1px solid #2a6fb4',
                color: '#4b8fd4', cursor: 'pointer', flexShrink: 0,
              }}
            >
              Copiar link
            </button>
          </div>

          <div style={{
            background: '#2b1f0d', border: '1px solid #5e3a1a',
            borderRadius: 10, padding: '14px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShoppingCart size={16} style={{ color: '#d4a84b', flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: 12, color: '#604830', display: 'block' }}>
                  Link de acesso do caixa (PIN)
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#d4a84b', fontFamily: 'monospace' }}>
                  {typeof window !== 'undefined' ? window.location.origin : ''}/{tenantInfo.slug}/caixa
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const url = `${window.location.origin}/${tenantInfo.slug}/caixa`
                navigator.clipboard.writeText(url)
                toast.success('Link copiado!')
              }}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                background: '#2b1f0d', border: '1px solid #b48a2a',
                color: '#d4a84b', cursor: 'pointer', flexShrink: 0,
              }}
            >
              Copiar link
            </button>
          </div>
        </>
      )}

      {/* Pill tabs */}
      <div style={{
        display: 'inline-flex', background: C.surface,
        border: `1px solid ${C.border}`, borderRadius: 8, padding: 3, gap: 2,
      }}>
        <button onClick={() => handleTabChange('funcionarios')} style={tabStyle('funcionarios')}>
          <Users size={14} /> Funcionários
        </button>
        <button onClick={() => handleTabChange('cargos')} style={tabStyle('cargos')}>
          <Shield size={14} /> Cargos e Permissões
        </button>
      </div>

      {/* ── Tab 1: Funcionários ────────────────────────────────────────────────── */}
      {activeTab === 'funcionarios' && (
        <div>
          {/* Filters */}
          <div className="flex gap-3 flex-wrap" style={{ marginBottom: 16 }}>
            <div className="relative flex-1 min-w-[200px]">
              <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: C.subtle }} />
              <Input
                placeholder="Buscar por nome ou email..."
                className="pl-9"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.txt2 }}
              />
            </div>
            <Select value={filterRole} onValueChange={(v) => setFilterRole(v ?? '')}>
              <SelectTrigger className="w-44" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.txt2 }}>
                <SelectValue placeholder="Todos os cargos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os cargos</SelectItem>
                {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? '')}>
              <SelectTrigger className="w-36" style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.txt2 }}>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ACTIVE">Ativo</SelectItem>
                <SelectItem value="INACTIVE">Inativo</SelectItem>
                <SelectItem value="PENDING">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
            <Table>
              <TableHeader>
                <TableRow style={{ background: C.surface2, borderColor: C.borderLight }} className="hover:bg-transparent">
                  <TableHead style={{ color: C.dim, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Funcionário</TableHead>
                  <TableHead style={{ color: C.dim, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Cargo</TableHead>
                  <TableHead style={{ color: C.dim, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Status</TableHead>
                  <TableHead style={{ color: C.dim, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Último acesso</TableHead>
                  <TableHead style={{ width: 40 }} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} style={{ textAlign: 'center', padding: '48px 0', color: C.dim, fontSize: 13 }}>
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} style={{ textAlign: 'center', padding: '48px 0' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                        <Users size={40} style={{ color: C.muted }} />
                        <p style={{ fontSize: 14, color: C.subtle, margin: 0 }}>
                          {search || filterRole !== 'all' || filterStatus !== 'all'
                            ? 'Nenhum resultado encontrado'
                            : 'Nenhum funcionário cadastrado'}
                        </p>
                        {!search && filterRole === 'all' && filterStatus === 'all' && can(PERMISSIONS.USUARIOS_GERENCIAR) && (
                          <button
                            onClick={() => setInviteOpen(true)}
                            style={{ fontSize: 13, color: C.greenLight, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Convidar funcionário
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((user) => {
                    const isSelf = user.id === session?.user?.id
                    const avatarStyle: React.CSSProperties = isSelf
                      ? { background: C.greenBg, border: `2px solid ${C.green}`, color: C.greenLight }
                      : user.status === 'ACTIVE'
                        ? { background: '#1a3a2a', color: '#fff' }
                        : { background: '#1a1a1a', color: C.subtle }
                    return (
                      <TableRow key={user.id} className="tf-urow" style={{ borderColor: C.borderLight }}>
                        <TableCell>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar style={{ width: 34, height: 34, borderRadius: '50%', ...avatarStyle, flexShrink: 0 }}>
                              <AvatarFallback style={{ ...avatarStyle, fontSize: 12, fontWeight: 600, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                                {user.email ? initials(user.name, user.email) : <ChefHat size={14} />}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 13, fontWeight: 500, color: user.status === 'INACTIVE' ? C.subtle : C.txt2 }}>
                                  {user.name ?? user.email ?? 'Sem nome'}
                                </span>
                                {isSelf && (
                                  <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: C.greenBg, color: C.greenLight, border: `1px solid ${C.green}` }}>
                                    você
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: C.dim }}>
                                {user.email ?? 'Acesso por PIN'}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <span style={{
                            fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em',
                            padding: '2px 8px', borderRadius: 9999,
                            background: C.surface2,
                            color: user.status === 'INACTIVE' ? C.muted : C.dim,
                            border: `1px solid ${C.border}`,
                            whiteSpace: 'nowrap',
                          }}>
                            {user.customRole?.name ?? (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' ? 'Administrador' : 'Funcionário')}
                          </span>
                        </TableCell>

                        <TableCell><StatusBadge status={user.status} /></TableCell>

                        <TableCell style={{ fontSize: 12, color: user.ultimoAcesso ? C.subtle : C.dim }}>
                          {lastSeen(user)}
                        </TableCell>

                        <TableCell>
                          {!isSelf && (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className="inline-flex items-center justify-center h-8 w-8 rounded-md transition-colors"
                                style={{ color: C.dim, background: 'transparent' }}
                                aria-label="Opções"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => handleAction('edit', user.id)}>
                                  <Pencil className="w-4 h-4" /> Editar
                                </DropdownMenuItem>
                                {user.email && (
                                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => handleAction('resetPassword', user.id)}>
                                    <KeyRound className="w-4 h-4" /> Resetar senha
                                  </DropdownMenuItem>
                                )}
                                {user.hasPin && (
                                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => handleAction('resetPIN', user.id)}>
                                    <RefreshCw className="w-4 h-4" /> Resetar PIN
                                  </DropdownMenuItem>
                                )}
                                {user.status === 'PENDING' && user.email && (
                                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => handleAction('resendInvite', user.id)}>
                                    <Mail className="w-4 h-4" /> Reenviar convite
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {user.status === 'INACTIVE' ? (
                                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => handleAction('activate', user.id)}>
                                    <UserCheck className="w-4 h-4" /> Reativar
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => handleAction('deactivate', user.id)}>
                                    <UserX className="w-4 h-4" /> Desativar
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem className="text-destructive gap-2 cursor-pointer" onClick={() => handleAction('remove', user.id)}>
                                  <Trash2 className="w-4 h-4" /> Remover
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>

            {!loading && (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 16px',
                borderTop: `1px solid ${C.borderLight}`,
                background: C.surface2,
              }}>
                <span style={{ fontSize: 12, color: C.dim }}>
                  {filtered.length} funcionário{filtered.length !== 1 ? 's' : ''} exibido{filtered.length !== 1 ? 's' : ''}
                </span>
                <span style={{ fontSize: 12, color: C.subtle, fontWeight: 500 }}>
                  {activeCount} ativo{activeCount !== 1 ? 's' : ''} · {inactiveCount} inativo{inactiveCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 2: Cargos e Permissões ─────────────────────────────────────────── */}
      {activeTab === 'cargos' && (
        <div style={{ display: 'flex', gap: 12 }}>

          {/* Lista de cargos */}
          <div style={{
            width: 320, flexShrink: 0,
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 10, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '12px 16px', background: C.surface2, borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 10, textTransform: 'uppercase', color: C.dim, letterSpacing: '0.06em', fontWeight: 600 }}>
                CARGOS
              </span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              {roles.map((role) => {
                const active = selectedRoleId === role.id
                return (
                  <div
                    key={role.id}
                    onClick={() => setSelectedRoleId(role.id)}
                    className={!active ? 'tf-role-item' : ''}
                    style={{
                      padding: '14px 16px',
                      borderBottom: `1px solid ${C.borderLight}`,
                      borderLeft: `2px solid ${active ? C.green : 'transparent'}`,
                      background: active ? C.greenBg : 'transparent',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                      transition: 'background 0.1s',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: active ? C.greenLight : C.txt2, margin: 0 }}>
                        {role.name}
                      </p>
                      <p style={{ fontSize: 11, color: C.dim, margin: 0 }}>
                        {role._count.users} usuário{role._count.users !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {role.isDefault ? (
                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: C.surface2, color: C.dim, border: `1px solid ${C.border}` }}>
                          Padrão
                        </span>
                      ) : (
                        <>
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 20, background: C.greenBg, color: C.greenLight, border: `1px solid #1e3d2e` }}>
                            Custom
                          </span>
                          {can(PERMISSIONS.USUARIOS_GERENCIAR) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteRoleTarget(role) }}
                              disabled={role._count.users > 0}
                              title={role._count.users > 0 ? 'Remova os usuários deste cargo antes' : 'Excluir cargo'}
                              style={{ background: 'none', border: 'none', cursor: role._count.users > 0 ? 'not-allowed' : 'pointer', color: C.muted, padding: 2, opacity: role._count.users > 0 ? 0.4 : 1 }}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {can(PERMISSIONS.USUARIOS_GERENCIAR) && (
              <button
                onClick={() => setNewRoleOpen(true)}
                className="tf-chef-btn"
                style={{
                  width: '100%', padding: '12px 16px',
                  borderTop: `1px solid ${C.border}`,
                  background: 'transparent', border: 'none',
                  color: C.dim, cursor: 'pointer', fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'background 0.12s, color 0.12s',
                }}
              >
                <Plus size={14} /> Novo cargo
              </button>
            )}
          </div>

          {/* Painel de detalhe */}
          {selectedRole ? (
            <RoleDetail
              key={selectedRole.id}
              role={selectedRole}
              users={usersOfRole}
              onPermissionsUpdate={handlePermissionsUpdate}
            />
          ) : (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.dim, fontSize: 14,
              background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
            }}>
              Selecione um cargo para ver as permissões
            </div>
          )}
        </div>
      )}

      {/* Modal novo cargo */}
      {newRoleOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setNewRoleOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: C.surface, borderRadius: 12, padding: 24, width: '90%', maxWidth: 500, maxHeight: '80vh', overflowY: 'auto', border: `1px solid ${C.border}` }}
          >
            <h3 style={{ fontWeight: 700, fontSize: 16, color: C.txt2, margin: '0 0 16px' }}>
              Novo cargo personalizado
            </h3>
            <form onSubmit={createRole} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.subtle, marginBottom: 6 }}>
                  Nome do cargo *
                </label>
                <Input
                  required value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="Ex: Supervisor"
                  style={{ background: C.surface2, border: `1px solid ${C.border}`, color: C.txt2 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: C.subtle, marginBottom: 8 }}>
                  Permissões *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {ALL_PERMS.map((p) => (
                    <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: C.txt2 }}>
                      <input
                        type="checkbox"
                        checked={newRolePerms.includes(p.key)}
                        onChange={() => setNewRolePerms((prev) =>
                          prev.includes(p.key) ? prev.filter((x) => x !== p.key) : [...prev, p.key]
                        )}
                        style={{ accentColor: C.green }}
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button type="submit" disabled={roleSaving} className="flex-1">
                  {roleSaving ? 'Salvando...' : 'Criar cargo'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setNewRoleOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sheets */}
      <InviteSheet open={inviteOpen} onOpenChange={setInviteOpen} roles={roles} onSuccess={load} />
      <EditUserSheet user={editUser} roles={roles} onOpenChange={(v) => { if (!v) setEditUser(null) }} onSuccess={load} />
      <ResetPinSheet user={resetPINUser} onOpenChange={(v) => { if (!v) setResetPINUser(null) }} onSuccess={load} />

      {/* AlertDialog: Reset password */}
      <AlertDialog open={!!resetPasswordUser} onOpenChange={(v) => { if (!v) setResetPasswordUser(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar senha de {resetPasswordUser?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Será enviado um email para <strong>{resetPasswordUser?.email}</strong> com um link de
              redefinição de senha válido por 2 horas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setResetPasswordUser(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmResetPassword} style={{ background: 'var(--tf-primary)', color: 'var(--tf-primary-txt)' }}>
              Enviar link de reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog: Remove user */}
      <AlertDialog open={!!removeUser} onOpenChange={(v) => { if (!v) setRemoveUser(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover {removeUser?.name ?? removeUser?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação desativará o acesso do funcionário ao sistema e pode ser revertida reativando o usuário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRemoveUser(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="bg-red-600 hover:bg-red-700 text-white">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog: Delete role */}
      <AlertDialog open={!!deleteRoleTarget} onOpenChange={(v) => { if (!v) setDeleteRoleTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cargo &quot;{deleteRoleTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              Este cargo será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteRoleTarget(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteRole} className="bg-red-600 hover:bg-red-700 text-white">
              Remover cargo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
