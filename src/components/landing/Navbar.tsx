'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X, ChevronDown } from 'lucide-react'
import { TFMark } from '@/components/ui/tf-mark'

function Logo() {
  return (
    <>
      <TFMark size={38} main="#4ADE80" accent="#16a34a" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, lineHeight: 1 }}>
        <span style={{
          fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: 16,
          color: '#fff', letterSpacing: '0.02em',
        }}>The Finance</span>
        <span style={{
          fontFamily: 'var(--font-manrope)', fontWeight: 400, fontSize: 9,
          color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>Restaurantes</span>
      </div>
    </>
  )
}

export function Navbar() {
  const [scrolled, setScrolled]     = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const navLinks = ['Início', 'Módulos', 'Planos', 'Contato']

  function scrollTo(item: string) {
    const map: Record<string, string> = {
      Início: 'hero', Módulos: 'modulos', Planos: 'planos', Contato: 'contato',
    }
    document.getElementById(map[item])?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30,
        height: 68, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 clamp(24px,6vw,120px)',
        transition: 'background 0.3s, border-color 0.3s',
        background: scrolled ? 'rgba(10,10,10,0.88)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <Logo />
        </Link>

        <div className="hidden md:flex" style={{ gap: 32 }}>
          {navLinks.map((item) => (
            <button key={item} onClick={() => scrollTo(item)} style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 500, fontSize: 14,
              color: 'rgba(255,255,255,0.8)', background: 'none', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              transition: 'color 0.2s', padding: 0,
            }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
            >
              {item}
              {item === 'Módulos' && <ChevronDown size={14} />}
            </button>
          ))}
        </div>

        <div className="hidden md:flex" style={{ gap: 10 }}>
          <Link href="/auth/login" style={{
            fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 14,
            color: '#fff', textDecoration: 'none', padding: '9px 20px',
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8, transition: 'background 0.2s',
          }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)')}
          >Entrar</Link>

          <Link href="/auth/cadastro" style={{
            fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 14,
            color: '#fff', textDecoration: 'none', padding: '9px 20px',
            background: 'var(--lp-btn-green)', borderRadius: 8,
            boxShadow: '0 2px 14px rgba(22,163,74,0.4)', transition: 'background 0.2s',
          }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--lp-btn-green-dark)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--lp-btn-green)')}
          >Começar grátis</Link>
        </div>

        <button className="flex md:hidden" onClick={() => setMobileOpen(true)}
          style={{ color: '#fff', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          aria-label="Abrir menu"
        ><Menu size={24} /></button>
      </nav>

      {mobileOpen && (
        <div className="lp-mobile-menu" style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: '#0a0a0a',
          display: 'flex', flexDirection: 'column', padding: '0 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
            <Link href="/" onClick={() => setMobileOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <Logo />
            </Link>
            <button onClick={() => setMobileOpen(false)}
              style={{ color: '#fff', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={24} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingTop: 16 }}>
            {navLinks.map((item, i) => (
              <button key={item} onClick={() => { setMobileOpen(false); setTimeout(() => scrollTo(item), 100) }}
                style={{
                  fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 22,
                  color: '#fff', background: 'none', border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                  padding: '16px 0', cursor: 'pointer', textAlign: 'left',
                  animationDelay: `${i * 0.05}s`,
                }}
              >{item}</button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 40, paddingTop: 24 }}>
            <Link href="/auth/login" onClick={() => setMobileOpen(false)} style={{
              display: 'block', textAlign: 'center', textDecoration: 'none',
              fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 16,
              color: '#fff', padding: '14px',
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10,
            }}>Entrar</Link>
            <Link href="/auth/cadastro" onClick={() => setMobileOpen(false)} style={{
              display: 'block', textAlign: 'center', textDecoration: 'none',
              fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 16,
              color: '#fff', padding: '14px',
              background: 'var(--lp-btn-green)', borderRadius: 10,
            }}>Começar grátis</Link>
          </div>
        </div>
      )}
    </>
  )
}
