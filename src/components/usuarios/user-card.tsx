'use client'

import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChefHat, MoreHorizontal, Pencil, KeyRound, Smartphone, UserX, UserCheck, RotateCcw, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type UserItem = {
  id: string
  name: string | null
  email: string | null
  role: string
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING'
  ultimoAcesso: string | null
  avatarUrl: string | null
  hasPin: boolean
  createdAt: string
  customRole: { id: string; name: string } | null
}

export type RoleItem = {
  id: string
  name: string
  isDefault: boolean
  permissions: string[]
  _count: { users: number }
}

type Props = {
  user: UserItem
  currentUserId: string
  onAction: (action: string, userId: string) => void
}

function initials(name: string | null, email: string | null) {
  const src = name ?? email ?? '?'
  return src.slice(0, 2).toUpperCase()
}

function StatusBadge({ status }: { status: UserItem['status'] }) {
  if (status === 'ACTIVE') {
    return (
      <span style={{
        padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
        background: 'var(--tf-green-ok-bg)', color: 'var(--tf-green-ok)',
        border: '1px solid var(--tf-green-ok-bd)',
      }}>Ativo</span>
    )
  }
  if (status === 'PENDING') {
    return (
      <span style={{
        padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
        background: 'var(--tf-yellow-bg)', color: 'var(--tf-yellow)',
        border: '1px solid var(--tf-yellow-bd)',
      }}>Convite pendente</span>
    )
  }
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
      background: 'var(--tf-surface2)', color: 'var(--tf-txt3)',
      border: '1px solid var(--tf-border-light)',
    }}>Inativo</span>
  )
}

function RoleChip({ role }: { role: { id: string; name: string } | null }) {
  if (!role) return null
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
      background: 'var(--tf-surface2)', color: 'var(--tf-txt2)',
      border: '1px solid var(--tf-border-light)', display: 'inline-flex', alignItems: 'center',
    }}>
      {role.name}
    </span>
  )
}

export function UserCard({ user, currentUserId, onAction }: Props) {
  const isOwn = user.id === currentUserId
  const isCook = user.customRole?.name?.toLowerCase().includes('cozinheiro')

  function lastSeen() {
    if (user.status === 'PENDING') {
      try {
        const days = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86400000)
        return `Convite enviado há ${days === 0 ? 'hoje' : `${days} dia${days !== 1 ? 's' : ''}`}`
      } catch { return 'Convite enviado' }
    }
    if (user.hasPin) return 'Acesso via PIN'
    if (!user.ultimoAcesso) return 'Nunca acessou'
    try {
      return `Último acesso: ${formatDistanceToNow(new Date(user.ultimoAcesso), { addSuffix: true, locale: ptBR })}`
    } catch { return 'Último acesso desconhecido' }
  }

  return (
    <div style={{
      background: 'var(--tf-surface)', border: '1px solid var(--tf-border-color)',
      borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
    }}>
      {/* Avatar */}
      <div style={{
        width: 44, height: 44, borderRadius: '50%', background: 'var(--tf-surface2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        border: '1px solid var(--tf-border-light)',
      }}>
        {isCook
          ? <ChefHat size={20} style={{ color: 'var(--tf-txt2)' }} />
          : <span style={{ fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 15, color: 'var(--tf-txt)' }}>
              {initials(user.name, user.email)}
            </span>
        }
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 15, color: 'var(--tf-txt)', margin: 0, marginBottom: 2, truncate: true } as React.CSSProperties}>
          {user.name ?? '(sem nome)'}
          {isOwn && <span style={{ fontSize: 11, color: 'var(--tf-txt3)', marginLeft: 6, fontWeight: 400 }}>você</span>}
        </p>
        <p style={{ fontSize: 13, color: 'var(--tf-txt3)', margin: 0, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.hasPin ? 'Acesso por PIN' : (user.email ?? '—')}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <RoleChip role={user.customRole} />
          <StatusBadge status={user.status} />
        </div>
      </div>

      {/* Last seen */}
      <div style={{ fontSize: 12, color: 'var(--tf-txt3)', textAlign: 'right', flexShrink: 0, minWidth: 120 }}>
        {lastSeen()}
      </div>

      {/* Actions */}
      {!isOwn && (
        <DropdownMenu>
          <DropdownMenuTrigger
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 6, borderRadius: 6, color: 'var(--tf-txt3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <MoreHorizontal size={18} />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="left" align="start">
            <DropdownMenuItem onClick={() => onAction('edit', user.id)}>
              <Pencil size={14} /> Editar funcionário
            </DropdownMenuItem>
            {user.email && (
              <DropdownMenuItem onClick={() => onAction('resetPassword', user.id)}>
                <KeyRound size={14} /> Resetar senha
              </DropdownMenuItem>
            )}
            {user.hasPin && (
              <DropdownMenuItem onClick={() => onAction('resetPIN', user.id)}>
                <Smartphone size={14} /> Redefinir PIN
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {user.status === 'ACTIVE' && (
              <DropdownMenuItem onClick={() => onAction('deactivate', user.id)}>
                <UserX size={14} /> Desativar
              </DropdownMenuItem>
            )}
            {user.status === 'INACTIVE' && (
              <DropdownMenuItem onClick={() => onAction('activate', user.id)}>
                <UserCheck size={14} /> Reativar
              </DropdownMenuItem>
            )}
            {user.status === 'PENDING' && (
              <DropdownMenuItem onClick={() => onAction('resendInvite', user.id)}>
                <RotateCcw size={14} /> Reenviar convite
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onAction('remove', user.id)}>
              <Trash2 size={14} /> Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
