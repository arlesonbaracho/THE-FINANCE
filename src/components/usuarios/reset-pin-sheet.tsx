'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet'
import { OtpInput } from '@/components/usuarios/otp-input'
import type { UserItem } from '@/components/usuarios/user-card'

interface Props {
  user: UserItem | null
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ResetPinSheet({ user, onOpenChange, onSuccess }: Props) {
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleClose(v: boolean) {
    if (!v) { setPin(''); setConfirmPin(''); setError('') }
    onOpenChange(v)
  }

  async function handleSave() {
    if (!user) return
    if (pin.length < 4) { setError('PIN deve ter 4 dígitos'); return }
    if (pin !== confirmPin) { setError('Os PINs não coincidem'); return }
    setError('')
    setSaving(true)
    try {
      const res = await fetch(`/api/usuarios/${user.id}/pin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao salvar PIN'); return }
      toast.success('PIN atualizado com sucesso')
      handleClose(false)
      onSuccess()
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null

  return (
    <Sheet open={!!user} onOpenChange={handleClose}>
      <SheetContent side="right" className="sm:max-w-[380px] flex flex-col">
        <SheetHeader style={{ paddingBottom: 0 }}>
          <SheetTitle style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: 18, color: 'var(--tf-txt)' }}>
            Redefinir PIN de {user.name ?? 'funcionário'}
          </SheetTitle>
        </SheetHeader>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 20, padding: '0 16px 8px' }}>
          <OtpInput value={pin} onChange={setPin} label="Novo PIN (4 dígitos)" />
          <OtpInput value={confirmPin} onChange={setConfirmPin} label="Confirmar PIN" />
          {error && (
            <p style={{ fontSize: 13, color: 'var(--tf-red)', background: 'var(--tf-red-bg)', border: '1px solid var(--tf-red-bd)', borderRadius: 8, padding: '10px 14px', margin: 0 }}>
              {error}
            </p>
          )}
        </div>

        <SheetFooter style={{ flexDirection: 'column', gap: 8, padding: '12px 16px' }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || pin.length < 4 || confirmPin.length < 4}
            style={{
              width: '100%', padding: 12, borderRadius: 8, border: 'none',
              cursor: saving || pin.length < 4 || confirmPin.length < 4 ? 'not-allowed' : 'pointer',
              background: 'var(--tf-primary)', color: 'var(--tf-primary-txt)',
              fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: saving || pin.length < 4 || confirmPin.length < 4 ? 0.6 : 1,
            }}
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            Salvar novo PIN
          </button>
          <button type="button" onClick={() => handleClose(false)}
            style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: 'none', color: 'var(--tf-txt3)', cursor: 'pointer', fontSize: 14 }}>
            Cancelar
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
