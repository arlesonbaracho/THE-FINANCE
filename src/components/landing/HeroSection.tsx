'use client'

import Link from 'next/link'
import { ShoppingBag, Package, BarChart2, Users, Play, ArrowRight } from 'lucide-react'

/* ── Background image ──────────────────────────────────────────────────────── */
function BackgroundImage() {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/fundo.png"
        alt=""
        aria-hidden
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%', objectFit: 'cover',
          objectPosition: 'center bottom',
          opacity: 0.95,
        }}
      />
      {/* dark gradient on top for text readability */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(10,10,10,0.7) 0%, rgba(10,10,10,0.35) 35%, rgba(10,10,10,0.0) 60%, rgba(10,10,10,0.4) 100%)',
      }} />
    </div>
  )
}

/* ── Moon ──────────────────────────────────────────────────────────────────── */
function Moon() {
  return (
    <div aria-hidden style={{
      position: 'absolute', top: 130, left: '7vw',
      width: 90, height: 90, borderRadius: '50%',
      background: 'radial-gradient(circle at 35% 35%, #d4d4d4 0%, #5a5a5a 40%, #1a1a1a 80%)',
      boxShadow: 'inset -8px -10px 20px rgba(0,0,0,0.6), 0 0 40px rgba(180,180,180,0.15)',
      opacity: 0.55, zIndex: 1, pointerEvents: 'none',
    }} />
  )
}

/* ── Floating metric cards ─────────────────────────────────────────────────── */
function CardPedidos() {
  return (
    <div className="lp-float-card" style={{
      position: 'absolute', left: 'clamp(8px, 4vw, 80px)', top: '24%',
      animation: 'lp-float 6s ease-in-out infinite 0.8s',
      zIndex: 4,
    }}>
      <div style={{
        background: 'rgba(10,15,12,0.78)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(74,222,128,0.18)',
        borderRadius: 18, padding: '18px 22px', minWidth: 188,
        boxShadow: '0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.02) inset',
      }}>
        <p style={{ fontFamily: 'var(--font-inter)', fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: '0 0 6px' }}>
          Pedidos hoje
        </p>
        <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800, fontSize: 30, color: '#fff', margin: '0 0 10px', letterSpacing: '-0.5px' }}>
          1.285
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-cabin)', fontSize: 12, color: '#4ADE80', fontWeight: 700 }}>↑ 23%</span>
          <svg width="84" height="22" viewBox="0 0 84 22">
            <polyline points="0,18 14,14 28,16 42,8 56,11 70,4 84,2"
              fill="none" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  )
}

function CardFaturamento() {
  return (
    <div className="lp-float-card" style={{
      position: 'absolute', left: 'clamp(8px, 4vw, 80px)', top: '52%',
      animation: 'lp-float 7s ease-in-out infinite 1.6s',
      zIndex: 4,
    }}>
      <div style={{
        background: 'rgba(10,15,12,0.78)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(74,222,128,0.18)',
        borderRadius: 18, padding: '18px 22px', minWidth: 200,
        boxShadow: '0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.02) inset',
      }}>
        <p style={{ fontFamily: 'var(--font-inter)', fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: '0 0 6px' }}>
          Faturamento
        </p>
        <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800, fontSize: 24, color: '#fff', margin: '0 0 10px', letterSpacing: '-0.3px' }}>
          R$ 48.750,00
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-cabin)', fontSize: 12, color: '#4ADE80', fontWeight: 700 }}>↑ 18%</span>
          <svg width="84" height="22" viewBox="0 0 84 22">
            <polyline points="0,15 14,17 28,12 42,14 56,8 70,9 84,3"
              fill="none" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  )
}

function CardEstoque() {
  return (
    <div className="lp-float-card" style={{
      position: 'absolute', right: 'clamp(8px, 4vw, 80px)', top: '30%',
      animation: 'lp-float 6.5s ease-in-out infinite 1.2s',
      zIndex: 4,
    }}>
      <div style={{
        background: 'rgba(10,15,12,0.78)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(74,222,128,0.18)',
        borderRadius: 18, padding: '18px 22px', minWidth: 188,
        boxShadow: '0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.02) inset',
      }}>
        <p style={{ fontFamily: 'var(--font-inter)', fontSize: 12, color: 'rgba(255,255,255,0.55)', margin: '0 0 6px' }}>
          Estoque preciso
        </p>
        <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800, fontSize: 30, color: '#fff', margin: '0 0 12px', letterSpacing: '-0.5px' }}>
          98%
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-cabin)', fontSize: 12, color: '#4ADE80', fontWeight: 700 }}>↑ 12%</span>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.08)', borderRadius: 999, height: 5 }}>
            <div style={{
              background: 'linear-gradient(90deg, #16a34a, #4ADE80)',
              borderRadius: 999, height: 5, width: '98%',
              boxShadow: '0 0 8px rgba(74,222,128,0.5)',
            }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function CardMiniGraph() {
  return (
    <div className="lp-float-card" style={{
      position: 'absolute', right: 'clamp(8px, 10vw, 140px)', top: '52%',
      animation: 'lp-float 5.5s ease-in-out infinite 2.2s',
      zIndex: 4,
    }}>
      <div style={{
        background: 'rgba(10,15,12,0.78)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(74,222,128,0.35)',
        borderRadius: 16, padding: '20px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.4), 0 0 24px rgba(74,222,128,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="44" height="44" viewBox="0 0 44 44" style={{ display: 'block' }}>
          <defs>
            <filter id="lp-bar-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g filter="url(#lp-bar-glow)" stroke="#4ADE80" strokeWidth="2.2" fill="none" strokeLinecap="round">
            <line x1="8"  y1="34" x2="8"  y2="26" />
            <line x1="16" y1="34" x2="16" y2="22" />
            <line x1="24" y1="34" x2="24" y2="16" />
            <line x1="32" y1="34" x2="32" y2="10" />
            <path d="M6 24 L14 20 L22 14 L30 8 L36 6" strokeWidth="1.5" />
            <path d="M32 10 L36 6 M36 6 L36 10 M36 6 L32 6" strokeWidth="1.5" />
          </g>
        </svg>
      </div>
    </div>
  )
}

/* ── Mascot ────────────────────────────────────────────────────────────────── */
function Mascot() {
  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
      {/* glow radial atrás do mascote */}
      <div style={{
        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: 620, height: 620, borderRadius: '50%',
        background: 'radial-gradient(ellipse 70% 55% at 50% 65%, rgba(74,222,128,0.28), transparent 70%)',
        pointerEvents: 'none',
      }} />
      {/* anel externo */}
      <div style={{
        position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 500, borderRadius: '50%',
        border: '1px solid rgba(74,222,128,0.22)',
        animation: 'lp-ring-pulse 3.5s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      {/* anel interno */}
      <div style={{
        position: 'absolute', bottom: '12%', left: '50%', transform: 'translateX(-50%)',
        width: 360, height: 360, borderRadius: '50%',
        border: '1px solid rgba(74,222,128,0.32)',
        animation: 'lp-ring-pulse 3.5s ease-in-out infinite 1.75s',
        pointerEvents: 'none',
      }} />
      {/* imagem */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/Mascot.png"
        alt="The Finance mascot"
        style={{
          width: 'clamp(340px, 42vw, 580px)',
          position: 'relative', zIndex: 2,
          animation: 'lp-float 5s ease-in-out infinite',
          filter: 'drop-shadow(0 0 60px rgba(74,222,128,0.55)) drop-shadow(0 24px 48px rgba(0,0,0,0.7))',
          userSelect: 'none', pointerEvents: 'none',
        }}
      />
    </div>
  )
}

/* ── Stats strip ──────────────────────────────────────────────────────────── */
const STATS = [
  { icon: <ShoppingBag size={18} />, value: '+12k',  label: 'pedidos processados' },
  { icon: <Package     size={18} />, value: '98%',   label: 'precisão no estoque' },
  { icon: <BarChart2   size={18} />, value: '3x',    label: 'mais eficiência' },
  { icon: <Users       size={18} />, value: '500+',  label: 'restaurantes ativos' },
]

function StatsStrip() {
  return (
    <div style={{
      position: 'relative', zIndex: 5,
      maxWidth: 1100, margin: '0 auto', padding: '0 clamp(16px,4vw,40px)',
      width: '100%',
    }}>
      <div style={{
        background: 'rgba(10,15,12,0.82)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 22,
        padding: '18px clamp(20px,3vw,40px)',
        display: 'flex', flexWrap: 'wrap', justifyContent: 'space-around', gap: 16,
        boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
      }}>
        {STATS.map((s) => (
          <div key={s.label} style={{
            display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 200px',
            justifyContent: 'center',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(74,222,128,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--lp-neon)', flexShrink: 0,
            }}>{s.icon}</div>
            <div>
              <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800, fontSize: 22, color: '#fff', margin: 0, lineHeight: 1, letterSpacing: '-0.3px' }}>
                {s.value}
              </p>
              <p style={{ fontFamily: 'var(--font-inter)', fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '3px 0 0' }}>
                {s.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── HeroSection ───────────────────────────────────────────────────────────── */
export function HeroSection({ onDemoClick }: { onDemoClick: () => void }) {
  return (
    <section id="hero" style={{
      minHeight: '100vh', position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', paddingBottom: 40,
    }}>
      <BackgroundImage />
      <Moon />

      {/* text block */}
      <div style={{
        flex: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', padding: 'clamp(120px,14vh,160px) clamp(24px,6vw,120px) 0',
        position: 'relative', zIndex: 3, gap: 24,
      }}>
        {/* tagline pill */}
        <div className="lp-fade-up" style={{
          animationDelay: '0.1s', display: 'inline-flex', alignItems: 'center', gap: 10,
          background: 'rgba(10,15,12,0.6)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(74,222,128,0.3)', borderRadius: 999, height: 36, padding: '0 5px 0 5px',
        }}>
          <span style={{
            background: 'var(--lp-btn-green)', borderRadius: 999, padding: '4px 12px',
            fontFamily: 'var(--font-cabin)', fontWeight: 700, fontSize: 12, color: '#fff',
          }}>Novo</span>
          <span style={{
            fontFamily: 'var(--font-cabin)', fontWeight: 500, fontSize: 13,
            color: 'rgba(255,255,255,0.85)', paddingRight: 14,
          }}>
            Gestão completa para restaurantes — THE FINANCE v1.0
          </span>
        </div>

        {/* headline */}
        <h1 className="lp-fade-up" style={{
          animationDelay: '0.25s',
          fontFamily: 'var(--font-instrument-serif)',
          fontSize: 'clamp(36px,6vw,80px)', lineHeight: 1.08,
          color: '#fff', letterSpacing: '-1.5px', maxWidth: 980, margin: 0,
          textWrap: 'balance' as React.CSSProperties['textWrap'],
          fontWeight: 400,
        }}>
          Gerencie seu restaurante com{' '}
          <em style={{ fontStyle: 'italic', color: 'var(--lp-neon)' }}>inteligência</em>
          {' '}e controle total
        </h1>

        {/* subtitle */}
        <p className="lp-fade-up" style={{
          animationDelay: '0.4s',
          fontFamily: 'var(--font-inter)', fontWeight: 400, fontSize: 17,
          lineHeight: 1.6, color: 'rgba(255,255,255,0.62)', maxWidth: 720, margin: 0,
          textWrap: 'balance' as React.CSSProperties['textWrap'],
        }}>
          Estoque inteligente com leitura de notas fiscais por IA, cardápio digital,
          painel da cozinha em tempo real e financeiro integrado — tudo em um só lugar.
        </p>

        {/* CTAs */}
        <div className="lp-fade-up" style={{
          animationDelay: '0.6s', display: 'flex', gap: 14,
          flexWrap: 'wrap', justifyContent: 'center', marginTop: 4,
        }}>
          <Link href="/auth/cadastro" style={{
            fontFamily: 'var(--font-cabin)', fontWeight: 600, fontSize: 15,
            color: '#fff', textDecoration: 'none',
            background: 'var(--lp-btn-green)', borderRadius: 12, padding: '14px 28px',
            boxShadow: '0 4px 24px rgba(22,163,74,0.5)',
            transition: 'background 0.2s, transform 0.15s',
            display: 'inline-flex', alignItems: 'center', gap: 10,
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--lp-btn-green-dark)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--lp-btn-green)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
          >
            Começar grátis
            <ArrowRight size={16} />
          </Link>

          <button onClick={onDemoClick} style={{
            fontFamily: 'var(--font-cabin)', fontWeight: 600, fontSize: 15,
            color: 'rgba(255,255,255,0.95)',
            background: 'rgba(20,25,22,0.7)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12, padding: '14px 28px', cursor: 'pointer',
            transition: 'background 0.2s, border-color 0.2s, transform 0.15s',
            display: 'flex', alignItems: 'center', gap: 10,
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(74,222,128,0.1)'; e.currentTarget.style.borderColor = 'rgba(74,222,128,0.4)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(20,25,22,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            Ver demonstração
            <span style={{
              width: 22, height: 22, borderRadius: '50%',
              background: 'var(--lp-btn-green)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Play size={10} fill="#fff" color="#fff" style={{ marginLeft: 1 }} />
            </span>
          </button>
        </div>
      </div>

      {/* mascot + floating cards */}
      <div className="lp-fade-up" style={{
        animationDelay: '0.8s',
        flex: 1, position: 'relative',
        display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
        minHeight: 560, paddingTop: 40, paddingBottom: 60, zIndex: 2,
      }}>
        <CardPedidos />
        <CardFaturamento />
        <CardEstoque />
        <CardMiniGraph />
        <Mascot />
      </div>

      {/* stats strip pill */}
      <StatsStrip />
    </section>
  )
}
