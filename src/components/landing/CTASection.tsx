'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Play } from 'lucide-react'

export function CTASection({ onDemoClick }: { onDemoClick: () => void }) {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const items = el.querySelectorAll<HTMLElement>('.lp-scroll-reveal')
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('lp-revealed'); io.unobserve(e.target) }
      })
    }, { threshold: 0.15 })
    items.forEach(c => io.observe(c))
    return () => io.disconnect()
  }, [])

  return (
    <section id="contato" ref={sectionRef} style={{
      padding: '100px clamp(24px,6vw,120px)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28,
      position: 'relative', overflow: 'hidden', zIndex: 1,
    }}>
      {/* cinematic orb */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 900, height: 500, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(74,222,128,0.1) 0%, transparent 65%)',
        filter: 'blur(80px)',
        animation: 'lp-pulse-orb 12s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      <div className="lp-scroll-reveal" style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <h2 style={{
          fontFamily: 'var(--font-instrument-serif)',
          fontSize: 'clamp(30px,4vw,56px)', color: '#fff', margin: 0,
        }}>Pronto para transformar sua operação?</h2>

        <p style={{ fontFamily: 'var(--font-inter)', fontSize: 16, color: 'rgba(255,255,255,0.5)', maxWidth: 440, margin: 0 }}>
          Comece com 14 dias grátis. Sem cartão de crédito. Cancele quando quiser.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/auth/cadastro" style={{
            fontFamily: 'var(--font-cabin)', fontWeight: 600, fontSize: 16,
            color: '#fff', textDecoration: 'none',
            background: 'var(--lp-btn-green)', borderRadius: 10, padding: '14px 32px',
            boxShadow: '0 4px 24px rgba(22,163,74,0.45)',
            transition: 'background 0.2s, transform 0.15s', display: 'inline-block',
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--lp-btn-green-dark)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--lp-btn-green)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
          >Começar Gratuitamente</Link>

          <button onClick={onDemoClick} style={{
            fontFamily: 'var(--font-cabin)', fontWeight: 600, fontSize: 16,
            color: 'rgba(255,255,255,0.85)',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(74,222,128,0.35)',
            borderRadius: 10, padding: '14px 32px', cursor: 'pointer',
            transition: 'background 0.2s, transform 0.15s',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(74,222,128,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <Play size={14} fill="currentColor" />
            Assistir Demonstração
          </button>
        </div>

        <p style={{ fontFamily: 'var(--font-inter)', fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: 0 }}>
          Mais de 500 restaurantes já usam o THE FINANCE
        </p>
      </div>
    </section>
  )
}
