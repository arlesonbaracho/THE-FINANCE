'use client'
import type { FuncaoOperacao } from '@/lib/operacao-theme'
import { temaOperacao, funcaoMeta } from '@/lib/operacao-theme'

export function OperacaoHeader({
  funcao,
  nomeRestaurante,
  logoUrl,
  nomeUsuario,
  direita,
}: {
  funcao: FuncaoOperacao
  nomeRestaurante: string
  logoUrl?: string | null
  nomeUsuario?: string | null
  direita?: React.ReactNode
}) {
  const C = temaOperacao(funcao)
  const meta = funcaoMeta(funcao)
  const accent = C.accent ?? C.green
  const accentLight = C.accentLight ?? C.greenLight ?? accent
  const accentBg = C.accentBg ?? C.greenBg ?? C.surface

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 11,
            overflow: 'hidden',
            background: accentBg,
            border: `1px solid ${C.border}`,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={nomeRestaurante} width={44} height={44} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
          ) : (
            <span style={{ fontSize: 20, fontWeight: 700, color: accentLight }}>{(nomeRestaurante || '?').charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 500, color: C.txt }}>{nomeRestaurante}</div>
          <div style={{ fontSize: 12, color: C.subtle ?? C.muted, letterSpacing: '0.04em' }}>
            <span style={{ color: accent }}>{meta.label.toUpperCase()}</span>
            {nomeUsuario ? ` · ${nomeUsuario}` : ''}
          </div>
        </div>
      </div>
      {direita && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{direita}</div>}
    </div>
  )
}
