'use client'
import type { FuncaoOperacao } from '@/lib/operacao-theme'
import { temaOperacao, funcaoMeta } from '@/lib/operacao-theme'

/** Avatar do personagem da função (login, etc.). `frame={false}` mostra o mascote solto, sem círculo.
 *  `size` aceita número (px) ou string CSS (ex.: `clamp(180px, 28vw, 360px)`) para ser responsivo. */
export function AvatarFuncao({ funcao, size = 64, frame = true }: { funcao: FuncaoOperacao; size?: number | string; frame?: boolean }) {
  const C = temaOperacao(funcao)
  const meta = funcaoMeta(funcao)
  const accent = C.accent ?? C.green
  const accentBg = C.accentBg ?? C.greenBg ?? C.surface
  const dim = typeof size === 'number' ? `${size}px` : size
  if (!frame) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={meta.avatar} alt={meta.label} style={{ objectFit: 'contain', width: dim, height: dim, maxWidth: '100%', flexShrink: 0 }} />
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
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
      <img src={meta.avatar} alt={meta.label} width={size} height={size} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
    </div>
  )
}
