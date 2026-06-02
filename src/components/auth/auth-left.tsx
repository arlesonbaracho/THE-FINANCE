'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { TFMark } from '@/components/ui/tf-mark'

export const C = {
  pageBg:     '#0f1714',
  surface:    '#111a16',
  surface2:   '#0d1410',
  border:     '#1e2e26',
  txt:        '#e8f0ec',
  txt2:       '#c8dcd2',
  muted:      '#3d6050',
  dim:        '#2d5040',
  subtle:     '#5a7a6a',
  green:      '#2a9d6f',
  greenLight: '#4bc994',
  greenBg:    '#071a0f',
}

function FeatureItem({ text }: { text: string }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 10 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: hovered ? C.greenLight : C.green,
        transition: 'background 0.15s',
      }} />
      <span style={{
        fontSize: 13,
        color: hovered ? C.subtle : C.muted,
        transition: 'color 0.15s',
      }}>
        {text}
      </span>
    </div>
  )
}

export function AuthLeft() {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '48px 56px', position: 'relative', overflow: 'hidden',
      background: C.surface,
    }}>
      {/* Grid SVG decoration */}
      <svg aria-hidden="true" style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        opacity: 0.04, pointerEvents: 'none',
      }}>
        <defs>
          <pattern id="tf-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={C.greenLight} strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#tf-grid)" />
      </svg>

      {/* Glow 1 */}
      <div aria-hidden="true" style={{
        position: 'absolute', top: -80, left: -80,
        width: 400, height: 400, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(42,157,111,.18) 0%, transparent 70%)',
      }} />

      {/* Glow 2 */}
      <div aria-hidden="true" style={{
        position: 'absolute', bottom: 60, left: 120,
        width: 300, height: 300, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(75,201,148,.08) 0%, transparent 70%)',
      }} />

      {/* Mascot */}
      <img
        aria-hidden="true"
        src="/realzinho.png"
        alt=""
        style={{
          position: 'absolute',
          bottom: 96,
          left: '29%',
          transform: 'translateX(-50%)',
          height: '68%',
          width: 'auto',
          zIndex: 1,
          animation: 'lp-float 5s ease-in-out infinite',
          filter: 'drop-shadow(0 0 60px rgba(74,222,128,0.55)) drop-shadow(0 24px 48px rgba(0,0,0,0.7))',
          userSelect: 'none', pointerEvents: 'none',
        }}
      />

      {/* Top section */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        {/* Back to landing */}
        <div style={{ marginBottom: 32 }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, fontWeight: 500, color: C.muted,
              textDecoration: 'none', padding: '6px 10px',
              borderRadius: 6, border: `1px solid ${C.border}`,
              background: 'transparent',
              transition: 'color 0.15s, border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLAnchorElement
              el.style.color = C.greenLight
              el.style.borderColor = C.green
              el.style.background = C.greenBg
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLAnchorElement
              el.style.color = C.muted
              el.style.borderColor = C.border
              el.style.background = 'transparent'
            }}
          >
            <ArrowLeft size={13} /> Voltar ao site
          </Link>
        </div>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 56 }}>
          <TFMark size={55} main={C.greenLight} accent={C.green} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: C.txt2, letterSpacing: '0.02em' }}>
              The Finance
            </span>
            <span style={{ fontSize: 10, fontWeight: 400, color: C.dim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Restaurantes
            </span>
          </div>
        </div>

        {/* Tagline */}
        <div>
          <h1 style={{
            fontFamily: 'var(--tf-font-display)', fontSize: 52, fontWeight: 600,
            color: C.txt, lineHeight: 1.05, letterSpacing: '-0.5px',
            margin: '0 0 20px',
          }}>
            Sua operação sob <span style={{ color: C.greenLight }}>controle</span>,{' '}
            em tempo real.
          </h1>
          <p style={{
            fontFamily: 'var(--font-inter, var(--font-manrope))',
            fontSize: 24, fontWeight: 600, color: C.greenLight,
            maxWidth: 740, lineHeight: 1.7, margin: 0,
          }}>
            Estoque, cozinha e financeiro integrados para restaurantes que crescem.
          </p>
        </div>
      </div>

      {/* Bottom section — features + version */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          <FeatureItem text="Estoque com custo médio automático" />
          <FeatureItem text="Painel da cozinha em tempo real" />
          <FeatureItem text="Relatórios financeiros integrados" />
        </div>
        <span style={{ fontSize: 10, color: '#1e3028', letterSpacing: '0.04em' }}>
          v1.0.0
        </span>
      </div>
    </div>
  )
}
