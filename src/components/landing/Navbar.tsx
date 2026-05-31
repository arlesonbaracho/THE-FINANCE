'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X, ChevronDown } from 'lucide-react'
import { TFMark } from '@/components/ui/tf-mark'

function Logo() {
  return (
    <>
      <TFMark size={32} main="#4ADE80" accent="#16a34a" />
      <span style={{
        fontFamily: 'var(--font-manrope)', fontWeight: 800, fontSize: 17,
        color: '#fff', letterSpacing: '0.04em',
      }}>THE FINANCE</span>
    </>
  )
}

export function Navbar() {
  const [, setScrolled]             = useState(false)
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
      {/* Floating pill navbar */}
      <div style={{
        position: 'fixed', top: 20, left: 0, right: 0, zIndex: 30,
        display: 'flex', justifyContent: 'center', padding: '0 16px',
        pointerEvents: 'none',
      }}>
        <nav style={{
          pointerEvents: 'auto',
          width: '100%', maxWidth: 1240,
          height: 64,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 8px 0 28px',
          background: 'rgba(10,15,12,0.72)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 999,
          boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', flexShrink: 0 }}>
            <Logo />
          </Link>

          <div className="hidden md:flex" style={{ gap: 28 }}>
            {navLinks.map((item) => (
              <button key={item} onClick={() => scrollTo(item)} style={{
                fontFamily: 'var(--font-manrope)', fontWeight: 500, fontSize: 14,
                color: 'rgba(255,255,255,0.75)', background: 'none', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                transition: 'color 0.2s', padding: 0,
              }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
              >
                {item}
                {item === 'Módulos' && <ChevronDown size={14} />}
              </button>
            ))}
          </div>

          <div className="hidden md:flex" style={{ gap: 8, alignItems: 'center' }}>
            <Link href="/auth/login" style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 13,
              color: '#fff', textDecoration: 'none', padding: '10px 22px',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 999, transition: 'background 0.2s, border-color 0.2s',
            }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
            >Entrar</Link>

            <Link href="/auth/cadastro" style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 13,
              color: '#fff', textDecoration: 'none', padding: '10px 22px',
              background: 'var(--lp-btn-green)', borderRadius: 999,
              boxShadow: '0 2px 14px rgba(22,163,74,0.4)', transition: 'background 0.2s',
            }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--lp-btn-green-dark)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--lp-btn-green)')}
            >Começar grátis</Link>
          </div>

          <button className="flex md:hidden" onClick={() => setMobileOpen(true)}
            style={{
              color: '#fff', background: 'none', border: 'none', cursor: 'pointer',
              padding: 8, marginRight: 8,
            }}
            aria-label="Abrir menu"
          ><Menu size={22} /></button>
        </nav>
      </div>

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
