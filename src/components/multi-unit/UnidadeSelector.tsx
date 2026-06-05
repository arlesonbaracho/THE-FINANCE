'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface Unidade {
  id: string
  name: string
  isHeadquarters: boolean
}

interface UnidadeSelectorProps {
  unidades: Unidade[]
  unidadeAtiva: string | null
}

export function UnidadeSelector({ unidades, unidadeAtiva }: UnidadeSelectorProps) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const label = unidades.find((u) => u.id === unidadeAtiva)?.name ?? 'Todas as unidades'

  async function selecionar(tenantId: string | null) {
    await fetch('/api/rede/switch-unit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId }),
    })
    setOpen(false)
    router.refresh()
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          borderRadius: 8,
          border: '1px solid var(--tf-border)',
          background: 'var(--tf-surface)',
          color: 'var(--tf-txt)',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        {label}
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: 'var(--tf-surface)',
            border: '1px solid var(--tf-border)',
            borderRadius: 8,
            minWidth: 200,
            zIndex: 50,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}
        >
          <button
            onClick={() => selecionar(null)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--tf-border)',
              color: 'var(--tf-txt)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Todas as unidades
          </button>
          {unidades.map((u) => (
            <button
              key={u.id}
              onClick={() => selecionar(u.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 16px',
                background: unidadeAtiva === u.id ? 'var(--tf-primary-soft, rgba(99,102,241,0.08))' : 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--tf-border)',
                color: 'var(--tf-txt)',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {u.isHeadquarters ? '★ ' : ''}{u.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
