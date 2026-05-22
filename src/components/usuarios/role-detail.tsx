'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ChefHat, Package, UtensilsCrossed, PieChart, Settings, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { UserItem, RoleItem } from '@/components/usuarios/user-card'

// ── Colors ────────────────────────────────────────────────────────────────────

const C = {
  surface:    '#111a16',
  surface2:   '#0d1410',
  border:     '#1e2e26',
  rowHover:   '#0d1a14',
  txt2:       '#c8dcd2',
  muted:      '#3d6050',
  dim:        '#2d5040',
  green:      '#2a9d6f',
  greenLight: '#4bc994',
  greenBg:    '#0d2b1f',
}
const SEP = '1px solid #1a2820'

// ── Permission groups ─────────────────────────────────────────────────────────

type PermGroup = {
  label: string
  icon: LucideIcon
  color: string
  perms: { key: string; label: string }[]
}

const PERM_GROUPS: PermGroup[] = [
  {
    label: 'ESTOQUE',
    icon: Package,
    color: '#d4a017',
    perms: [
      { key: 'estoque.ver',         label: 'Visualizar insumos' },
      { key: 'estoque.criar',       label: 'Criar e editar insumos' },
      { key: 'estoque.movimentar',  label: 'Movimentar estoque (entradas e saídas)' },
      { key: 'estoque.deletar',     label: 'Excluir insumos' },
    ],
  },
  {
    label: 'PRODUTOS',
    icon: UtensilsCrossed,
    color: '#e05252',
    perms: [
      { key: 'produtos.ver',    label: 'Visualizar produtos' },
      { key: 'produtos.criar',  label: 'Criar e editar produtos' },
      { key: 'produtos.deletar', label: 'Excluir produtos' },
    ],
  },
  {
    label: 'FINANCEIRO',
    icon: PieChart,
    color: '#4bc994',
    perms: [
      { key: 'relatorios.ver', label: 'Visualizar relatórios e dashboard' },
    ],
  },
  {
    label: 'CONFIGURAÇÕES',
    icon: Settings,
    color: '#5a7a6a',
    perms: [
      { key: 'configuracoes.ver',    label: 'Visualizar configurações' },
      { key: 'configuracoes.editar', label: 'Editar configurações do restaurante' },
    ],
  },
  {
    label: 'USUÁRIOS',
    icon: Users,
    color: '#a78bfa',
    perms: [
      { key: 'usuarios.ver',      label: 'Visualizar funcionários' },
      { key: 'usuarios.gerenciar', label: 'Gerenciar funcionários' },
    ],
  },
  {
    label: 'COZINHA',
    icon: ChefHat,
    color: '#e07a2a',
    perms: [
      { key: 'cozinha.ver',      label: 'Visualizar painel da cozinha' },
      { key: 'cozinha.gerenciar', label: 'Gerenciar pedidos na cozinha' },
    ],
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  role: RoleItem
  users: UserItem[]
  onPermissionsUpdate: (roleId: string, permissions: string[]) => void
}

export function RoleDetail({ role, users, onPermissionsUpdate }: Props) {
  const [localPerms, setLocalPerms] = useState<string[]>(role.permissions as string[])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function togglePerm(key: string) {
    const next = localPerms.includes(key) ? localPerms.filter((p) => p !== key) : [...localPerms, key]
    setLocalPerms(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/roles/${role.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: next }),
      })
      if (res.ok) {
        toast.success('Permissões salvas', { duration: 1500 })
        onPermissionsUpdate(role.id, next)
      } else {
        toast.error('Erro ao salvar permissões')
      }
    }, 500)
  }

  return (
    <div style={{
      flex: 1,
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: C.txt2, margin: 0 }}>
              {role.name}
            </p>
            <p style={{ fontSize: 11, color: C.dim, margin: '2px 0 0' }}>
              Permissões do cargo
            </p>
          </div>
          {role.isDefault && (
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 20,
              background: C.surface2, color: C.dim, border: `1px solid ${C.border}`,
            }}>
              Padrão
            </span>
          )}
        </div>

        {/* Users with this role */}
        {users.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <div style={{ display: 'flex' }}>
              {users.slice(0, 5).map((u, i) => (
                <div key={u.id} style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: C.surface2, border: `2px solid ${C.surface}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginLeft: i > 0 ? -8 : 0, fontSize: 11, fontWeight: 600, color: C.txt2,
                }}>
                  {u.customRole?.name?.toLowerCase().includes('cozinheiro')
                    ? <ChefHat size={12} />
                    : (u.name ?? u.email ?? '?')[0].toUpperCase()
                  }
                </div>
              ))}
            </div>
            <span style={{ fontSize: 12, color: C.dim }}>
              {users.length} usuário{users.length !== 1 ? 's' : ''} com este cargo
            </span>
          </div>
        )}
      </div>

      {/* Permissions list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {PERM_GROUPS.map((group, gi) => {
          const Icon = group.icon
          return (
            <div key={group.label} style={{ borderTop: gi > 0 ? SEP : undefined }}>

              {/* Group label */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 20px 4px',
              }}>
                <Icon size={12} style={{ color: group.color, flexShrink: 0 }} />
                <span style={{
                  fontSize: 10, fontWeight: 600, color: C.dim,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {group.label}
                </span>
              </div>

              {/* Permission rows */}
              {group.perms.map((perm) => {
                const enabled = localPerms.includes(perm.key)
                return (
                  <label
                    key={perm.key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '7px 20px',
                      cursor: role.isDefault ? 'default' : 'pointer',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                      background: enabled ? C.greenBg : '#161f1b',
                      border: `1px solid ${enabled ? C.green : C.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {enabled && (
                        <span style={{ color: C.greenLight, fontSize: 11, lineHeight: 1 }}>✓</span>
                      )}
                    </div>
                    {!role.isDefault && (
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => togglePerm(perm.key)}
                        style={{ display: 'none' }}
                      />
                    )}
                    <span style={{ fontSize: 12.5, color: enabled ? C.txt2 : C.muted }}>
                      {perm.label}
                    </span>
                  </label>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
