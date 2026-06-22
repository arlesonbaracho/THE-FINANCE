'use client'
import type { FuncaoOperacao } from '@/lib/operacao-theme'
import { temaOperacao, funcaoMeta } from '@/lib/operacao-theme'

export function OperacaoHeader({
  funcao,
  nome,
  subtitulo,
  direita,
}: {
  funcao: FuncaoOperacao
  nome: string
  subtitulo?: string
  direita?: React.ReactNode
}) {
  const C = temaOperacao(funcao)
  const meta = funcaoMeta(funcao)
  const accent = C.accent ?? C.green
  const accentLight = C.accentLight ?? C.greenLight ?? accent
  const accentBg = C.accentBg ?? C.greenBg ?? C.surface

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            overflow: 'hidden',
            background: accentBg,
            border: `2px solid ${accent}`,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={meta.avatar} alt={meta.label} width={64} height={64} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 500, color: C.txt }}>
            Bem-vindo, <span style={{ color: accentLight }}>{nome}</span>
          </div>
          {subtitulo && <div style={{ fontSize: 13, color: C.subtle ?? C.muted }}>{subtitulo}</div>}
        </div>
      </div>
      {direita && <div style={{ display: 'flex', gap: 10 }}>{direita}</div>}
    </div>
  )
}
