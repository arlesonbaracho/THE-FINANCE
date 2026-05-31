'use client'

import { useEffect, useRef } from 'react'

const TESTIMONIALS = [
  {
    text: 'Eliminamos as planilhas em 1 semana. O agente que lê nota fiscal sozinho já pagou o sistema.',
    name: 'Carlos Mendes', role: 'Gerente', restaurant: 'Burger Station, Natal-RN', initial: 'C',
  },
  {
    text: 'O painel da cozinha transformou nossa operação. Zero pedido perdido.',
    name: 'Ana Paula Rocha', role: 'Proprietária', restaurant: 'Café da Praça, Fortaleza-CE', initial: 'A',
  },
  {
    text: 'Finalmente sei o CMV real de cada prato. Reajustei o cardápio e aumentei a margem em 12%.',
    name: 'Roberto Lima', role: 'Chef e Sócio', restaurant: 'La Trattoria, Recife-PE', initial: 'R',
  },
]

export function TestimonialsSection() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const items = el.querySelectorAll<HTMLElement>('.lp-scroll-reveal')
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          setTimeout(() => e.target.classList.add('lp-revealed'), i * 100)
          io.unobserve(e.target)
        }
      })
    }, { threshold: 0.1 })
    items.forEach(c => io.observe(c))
    return () => io.disconnect()
  }, [])

  return (
    <section ref={sectionRef} style={{
      padding: '96px clamp(24px,6vw,120px)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      position: 'relative', zIndex: 1,
    }}>
      <div className="lp-scroll-reveal" style={{ textAlign: 'center', marginBottom: 52 }}>
        <h2 style={{
          fontFamily: 'var(--font-instrument-serif)',
          fontSize: 'clamp(30px,4vw,52px)', color: '#fff', margin: 0,
        }}>O que nossos clientes dizem</h2>
        <div style={{
          width: 48, height: 3, background: 'var(--lp-neon)',
          borderRadius: 999, margin: '18px auto 0',
          boxShadow: '0 0 12px rgba(74,222,128,0.5)',
        }} />
      </div>

      <div className="lp-testimonials-track" style={{
        display: 'flex', gap: 16, flexWrap: 'wrap',
        maxWidth: 1100, margin: '0 auto',
      }}>
        {TESTIMONIALS.map((t) => (
          <div key={t.name} className="lp-scroll-reveal" style={{
            flex: '1 1 280px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20, padding: '28px 24px',
            backdropFilter: 'blur(12px)',
            transition: 'background 0.25s, border-color 0.25s, transform 0.25s, box-shadow 0.25s',
            cursor: 'default',
          }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.background  = 'rgba(74,222,128,0.05)'
              el.style.borderColor = 'rgba(74,222,128,0.25)'
              el.style.transform   = 'translateY(-4px)'
              el.style.boxShadow   = '0 10px 36px rgba(74,222,128,0.08)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.background  = 'rgba(255,255,255,0.03)'
              el.style.borderColor = 'rgba(255,255,255,0.07)'
              el.style.transform   = 'translateY(0)'
              el.style.boxShadow   = 'none'
            }}
          >
            <div style={{ display: 'flex', gap: 2, marginBottom: 18 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{ color: 'var(--lp-neon)', fontSize: 15 }}>★</span>
              ))}
            </div>
            <p style={{
              fontFamily: 'var(--font-inter)', fontSize: 15, lineHeight: 1.75,
              color: 'rgba(255,255,255,0.72)', fontStyle: 'italic', margin: '0 0 22px',
            }}>&ldquo;{t.text}&rdquo;</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 42, height: 42, borderRadius: '50%',
                background: 'linear-gradient(135deg, #16a34a 0%, #052e16 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: 16, color: '#fff', flexShrink: 0,
              }}>{t.initial}</div>
              <div>
                <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 14, color: '#fff', margin: 0 }}>
                  {t.name}
                </p>
                <p style={{ fontFamily: 'var(--font-inter)', fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
                  {t.role} · {t.restaurant}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
