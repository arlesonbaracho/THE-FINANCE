'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet'
import type { UserItem, RoleItem } from '@/components/usuarios/user-card'
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '@/lib/permissions-constants'

type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

interface Props {
  user: UserItem | null
  roles: RoleItem[]
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

function getDiff(fromPerms: string[], toPerms: string[]) {
  const added = toPerms.filter((p) => !fromPerms.includes(p))
  const removed = fromPerms.filter((p) => !toPerms.includes(p))
  return { added, removed }
}

function getDefaultPermsForRole(name: string): string[] {
  const key = name.toUpperCase().replace(/\s+/g, '_')
  for (const [k, v] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    if (k === key || name.toLowerCase().includes(k.toLowerCase())) return v as string[]
  }
  return []
}

export function EditUserSheet({ user, roles, onOpenChange, onSuccess }: Props) {
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (user) setSelectedRoleId(user.customRole?.id ?? '')
  }, [user])

  const currentRolePerms: string[] = (() => {
    if (!user?.customRole) return []
    const role = roles.find((r) => r.id === user.customRole!.id)
    return role ? (role.permissions as string[]) : getDefaultPermsForRole(user.customRole.name)
  })()

  const newRolePerms: string[] = (() => {
    if (!selectedRoleId) return []
    const role = roles.find((r) => r.id === selectedRoleId)
    return role ? (role.permissions as string[]) : []
  })()

  const diff = selectedRoleId !== (user?.customRole?.id ?? '') ? getDiff(currentRolePerms, newRolePerms) : null

  async function handleSave() {
    if (!user) return
    setSaving(true)
    try {
      const res = await fetch(`/api/usuarios/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customRoleId: selectedRoleId || null }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erro ao salvar'); return }
      toast.success('Funcionário atualizado')
      onOpenChange(false)
      onSuccess()
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <Sheet open={!!user} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-[460px] overflow-y-auto flex flex-col">
        <SheetHeader style={{ paddingBottom: 0 }}>
          <SheetTitle style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: 18, color: 'var(--tf-txt)' }}>
            Editar funcionário
          </SheetTitle>
        </SheetHeader>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20, padding: '0 16px 8px', overflowY: 'auto' }}>
          {/* Nome e email (read-only) */}
          <div style={{ background: 'var(--tf-surface2)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--tf-border-light)' }}>
            <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 15, color: 'var(--tf-txt)', margin: '0 0 2px' }}>
              {user.name ?? '(sem nome)'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--tf-txt3)', margin: 0 }}>
              {user.hasPin ? 'Acesso por PIN' : (user.email ?? '—')}
            </p>
          </div>

          {/* Tipo de acesso (read-only) */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--tf-txt2)', marginBottom: 6 }}>
              Tipo de acesso
            </label>
            <p style={{ fontSize: 13, color: 'var(--tf-txt3)', background: 'var(--tf-surface2)', padding: '10px 12px', borderRadius: 8, margin: 0, border: '1px solid var(--tf-border-light)' }}>
              {user.hasPin ? '🔢 Acesso por PIN' : '📧 Acesso por email'}
              <span style={{ display: 'block', fontSize: 11, marginTop: 2 }}>O tipo de acesso não pode ser alterado após o cadastro.</span>
            </p>
          </div>

          {/* Cargo */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--tf-txt2)', marginBottom: 8 }}>
              Cargo
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                type="button"
                onClick={() => setSelectedRoleId('')}
                style={{
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  border: selectedRoleId === '' ? '2px solid var(--tf-primary)' : '2px solid var(--tf-border-color)',
                  background: selectedRoleId === '' ? 'var(--tf-primary-bg)' : 'var(--tf-surface)',
                  textAlign: 'left', fontSize: 13, color: selectedRoleId === '' ? 'var(--tf-primary)' : 'var(--tf-txt2)',
                }}
              >
                Sem cargo específico
              </button>
              {roles.map((role) => {
                const selected = selectedRoleId === role.id
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRoleId(role.id)}
                    style={{
                      padding: '10px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                      border: selected ? '2px solid var(--tf-primary)' : '2px solid var(--tf-border-color)',
                      background: selected ? 'var(--tf-primary-bg)' : 'var(--tf-surface)',
                      fontSize: 13, fontWeight: 600, color: selected ? 'var(--tf-primary)' : 'var(--tf-txt)',
                      position: 'relative',
                    }}
                  >
                    {role.name}
                    {role.isDefault && (
                      <span style={{ fontSize: 10, color: 'var(--tf-txt3)', fontWeight: 400, display: 'block' }}>Padrão</span>
                    )}
                    {selected && (
                      <span style={{
                        position: 'absolute', top: 6, right: 6,
                        width: 14, height: 14, borderRadius: '50%',
                        background: 'var(--tf-primary)', color: 'white',
                        fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>✓</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Diff de permissões */}
          {diff && (diff.added.length > 0 || diff.removed.length > 0) && (
            <div style={{ borderRadius: 8, padding: '12px 14px', border: '1px solid var(--tf-border-light)', background: 'var(--tf-surface2)' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tf-txt2)', margin: '0 0 8px' }}>Mudanças de permissão</p>
              {diff.added.map((p) => (
                <p key={p} style={{ fontSize: 12, color: 'var(--tf-green-ok)', margin: '0 0 3px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>+</span> {p.replace('.', ' → ')}
                </p>
              ))}
              {diff.removed.map((p) => (
                <p key={p} style={{ fontSize: 12, color: 'var(--tf-red)', margin: '0 0 3px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>−</span> {p.replace('.', ' → ')}
                </p>
              ))}
            </div>
          )}
        </div>

        <SheetFooter style={{ flexDirection: 'column', gap: 8, padding: '12px 16px' }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              width: '100%', padding: 12, borderRadius: 8, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              background: 'var(--tf-primary)', color: 'var(--tf-primary-txt)',
              fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: saving ? 0.8 : 1,
            }}
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            Salvar alterações
          </button>
          <button type="button" onClick={() => onOpenChange(false)}
            style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: 'none', color: 'var(--tf-txt3)', cursor: 'pointer', fontSize: 14 }}>
            Cancelar
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
