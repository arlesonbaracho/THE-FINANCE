'use client'

import Link from 'next/link'
import { ShoppingBag, Package, BarChart2, Users, TrendingUp, Play } from 'lucide-react'

/* ── City Skyline ───────────────────────────────────────────────────────────── */
function CitySkyline() {
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, pointerEvents: 'none', zIndex: 0 }}>
      {/* glow base */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 220,
        background: 'linear-gradient(to top, rgba(74,222,128,0.07) 0%, rgba(74,222,128,0.02) 50%, transparent 100%)',
      }} />
      <svg viewBox="0 0 1440 220" preserveAspectRatio="xMidYMax slice"
        style={{ width: '100%', display: 'block' }}>
        {/* base floor */}
        <rect x="0" y="180" width="1440" height="40" fill="#060606" />
        {/* building clusters */}
        <rect x="10"   y="100" width="30" height="120" fill="#090909" />
        <rect x="20"   y="70"  width="14" height="150" fill="#0a0a0a" />
        <rect x="55"   y="60"  width="35" height="160" fill="#080808" />
        <rect x="62"   y="35"  width="20" height="185" fill="#0b0b0b" />
        <rect x="105"  y="80"  width="28" height="140" fill="#090909" />
        <rect x="120"  y="45"  width="16" height="175" fill="#0a0a0a" />
        <rect x="150"  y="30"  width="22" height="190" fill="#080808" />
        <rect x="148"  y="10"  width="26" height="210" fill="#0b0b0b" />
        <rect x="190"  y="65"  width="40" height="155" fill="#090909" />
        <rect x="245"  y="20"  width="18" height="200" fill="#0a0a0a" />
        <rect x="242"  y="0"   width="26" height="220" fill="#080808" />
        <rect x="285"  y="55"  width="34" height="165" fill="#090909" />
        <rect x="340"  y="15"  width="20" height="205" fill="#0b0b0b" />
        <rect x="337"  y="0"   width="28" height="220" fill="#0a0a0a" />
        <rect x="380"  y="70"  width="44" height="150" fill="#080808" />
        <rect x="440"  y="30"  width="18" height="190" fill="#090909" />
        <rect x="437"  y="8"   width="26" height="212" fill="#0b0b0b" />
        <rect x="480"  y="60"  width="36" height="160" fill="#080808" />
        <rect x="535"  y="10"  width="22" height="210" fill="#0a0a0a" />
        <rect x="532"  y="0"   width="30" height="220" fill="#090909" />
        <rect x="580"  y="50"  width="42" height="170" fill="#080808" />
        <rect x="640"  y="5"   width="24" height="215" fill="#0b0b0b" />
        <rect x="637"  y="0"   width="32" height="220" fill="#0a0a0a" />
        <rect x="690"  y="45"  width="38" height="175" fill="#080808" />
        <rect x="745"  y="20"  width="20" height="200" fill="#090909" />
        <rect x="742"  y="0"   width="28" height="220" fill="#0b0b0b" />
        <rect x="790"  y="55"  width="45" height="165" fill="#080808" />
        <rect x="850"  y="10"  width="22" height="210" fill="#0a0a0a" />
        <rect x="847"  y="0"   width="30" height="220" fill="#090909" />
        <rect x="900"  y="60"  width="38" height="160" fill="#080808" />
        <rect x="955"  y="15"  width="20" height="205" fill="#0b0b0b" />
        <rect x="952"  y="0"   width="28" height="220" fill="#0a0a0a" />
        <rect x="1000" y="50"  width="44" height="170" fill="#080808" />
        <rect x="1060" y="25"  width="18" height="195" fill="#090909" />
        <rect x="1057" y="5"   width="26" height="215" fill="#0b0b0b" />
        <rect x="1100" y="65"  width="40" height="155" fill="#080808" />
        <rect x="1160" y="15"  width="22" height="205" fill="#0a0a0a" />
        <rect x="1157" y="0"   width="30" height="220" fill="#090909" />
        <rect x="1210" y="55"  width="42" height="165" fill="#080808" />
        <rect x="1270" y="20"  width="20" height="200" fill="#0b0b0b" />
        <rect x="1267" y="0"   width="28" height="220" fill="#0a0a0a" />
        <rect x="1320" y="70"  width="38" height="150" fill="#080808" />
        <rect x="1375" y="90"  width="50" height="130" fill="#090909" />
        {/* window lights — pontos neon */}
        {[
          [64,42],[152,18],[202,72],[248,8],[343,8],[441,16],[538,8],[643,12],[694,52],
          [748,28],[853,8],[958,8],[1063,12],[1163,8],[1268,8],
        ].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width="2" height="2" fill="#4ADE80" opacity="0.55" />
        ))}
      </svg>
    </div>
  )
}

/* ── Floating metric cards ──────────────────────────────────────────────────── */
function CardLeft() {
  return (
    <div className="lp-float-card" style={{
      position: 'absolute', left: 'clamp(8px, 4vw, 56px)', top: '22%',
      animation: 'lp-float 6s ease-in-out infinite 0.8s',
      zIndex: 4,
    }}>
      <div style={{
        background: 'rgba(10,10,10,0.75)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 16, padding: '16px 20px', minWidth: 164,
      }}>
        <p style={{ fontFamily: 'var(--font-inter)', fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '0 0 6px' }}>
          Pedidos hoje
        </p>
        <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800, fontSize: 28, color: '#fff', margin: '0 0 8px' }}>
          1.285
        </p>
        <svg width="80" height="22" viewBox="0 0 80 22" style={{ display: 'block', marginBottom: 6 }}>
          <polyline points="0,18 16,12 32,14 48,6 64,9 80,2"
            fill="none" stroke="#4ADE80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontFamily: 'var(--font-cabin)', fontSize: 12, color: '#4ADE80', fontWeight: 600 }}>↑ 23%</span>
      </div>
    </div>
  )
}

function CardRight() {
  return (
    <div className="lp-float-card" style={{
      position: 'absolute', right: 'clamp(8px, 4vw, 56px)', top: '28%',
      animation: 'lp-float 7s ease-in-out infinite 1.4s',
      zIndex: 4,
    }}>
      <div style={{
        background: 'rgba(10,10,10,0.75)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 16, padding: '16px 20px', minWidth: 164,
      }}>
        <p style={{ fontFamily: 'var(--font-inter)', fontSize: 11, color: 'rgba(255,255,255,0.5)', margin: '0 0 6px' }}>
          Estoque preciso
        </p>
        <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800, fontSize: 28, color: '#fff', margin: '0 0 10px' }}>
          98%
        </p>
        <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 999, height: 5, width: '100%', marginBottom: 6 }}>
          <div style={{ background: 'linear-gradient(90deg, #16a34a, #4ADE80)', borderRadius: 999, height: 5, width: '98%' }} />
        </div>
        <span style={{ fontFamily: 'var(--font-cabin)', fontSize: 12, color: '#4ADE80', fontWeight: 600 }}>↑ 12%</span>
      </div>
    </div>
  )
}

function CardMiniRevenue() {
  return (
    <div className="lp-float-card" style={{
      position: 'absolute', right: 'clamp(8px, 8vw, 120px)', bottom: '18%',
      animation: 'lp-float 5.5s ease-in-out infinite 2s',
      zIndex: 4,
    }}>
      <div style={{
        background: 'rgba(10,10,10,0.75)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(74,222,128,0.2)',
        borderRadius: 12, padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'rgba(74,222,128,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#4ADE80',
        }}><TrendingUp size={16} /></div>
        <div>
          <p style={{ fontFamily: 'var(--font-inter)', fontSize: 10, color: 'rgba(255,255,255,0.5)', margin: 0 }}>Faturamento</p>
          <p style={{ fontFamily: 'var(--font-cabin)', fontSize: 13, fontWeight: 700, color: '#4ADE80', margin: 0 }}>↑ 18%</p>
        </div>
      </div>
    </div>
  )
}

/* ── Mascot ─────────────────────────────────────────────────────────────────── */
function Mascot() {
  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
      {/* glow radial atrás do mascote */}
      <div style={{
        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: 580, height: 580, borderRadius: '50%',
        background: 'radial-gradient(ellipse 70% 55% at 50% 65%, rgba(74,222,128,0.25), transparent 70%)',
        pointerEvents: 'none',
      }} />
      {/* anel externo */}
      <div style={{
        position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)',
        width: 480, height: 480, borderRadius: '50%',
        border: '1px solid rgba(74,222,128,0.2)',
        animation: 'lp-ring-pulse 3.5s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      {/* anel interno */}
      <div style={{
        position: 'absolute', bottom: '12%', left: '50%', transform: 'translateX(-50%)',
        width: 340, height: 340, borderRadius: '50%',
        border: '1px solid rgba(74,222,128,0.3)',
        animation: 'lp-ring-pulse 3.5s ease-in-out infinite 1.75s',
        pointerEvents: 'none',
      }} />
      {/* SVG filter to remove white background */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <defs>
          <filter id="lp-remove-white">
            <feColorMatrix type="matrix" values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              -2 -2 -2 0 4.6
            " />
          </filter>
        </defs>
      </svg>
      {/* imagem */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mascot.svg"
        alt="The Finance mascot"
        style={{
          width: 'clamp(320px, 40vw, 560px)',
          position: 'relative', zIndex: 2,
          animation: 'lp-float 5s ease-in-out infinite',
          filter: 'url(#lp-remove-white) drop-shadow(0 0 60px rgba(74,222,128,0.55)) drop-shadow(0 24px 48px rgba(0,0,0,0.7))',
          userSelect: 'none', pointerEvents: 'none',
        }}
      />
    </div>
  )
}

/* ── Stats strip ────────────────────────────────────────────────────────────── */
const STATS = [
  { icon: <ShoppingBag size={18} />, value: '+12k',  label: 'pedidos processados' },
  { icon: <Package     size={18} />, value: '98%',   label: 'precisão no estoque' },
  { icon: <BarChart2   size={18} />, value: '3x',    label: 'mais eficiência' },
  { icon: <Users       size={18} />, value: '500+',  label: 'restaurantes ativos' },
]

function StatsStrip() {
  return (
    <div style={{
      borderTop: '1px solid rgba(255,255,255,0.07)',
      padding: '20px clamp(24px,6vw,120px)',
      display: 'flex', gap: 0, flexWrap: 'wrap',
      justifyContent: 'center',
      position: 'relative', zIndex: 2,
    }}>
      {STATS.map((s, i) => (
        <div key={s.label} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 28px',
          borderRight: i < STATS.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
        }}>
          <span style={{ color: 'var(--lp-neon)', flexShrink: 0 }}>{s.icon}</span>
          <span style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800, fontSize: 18, color: '#fff' }}>{s.value}</span>
          <span style={{ fontFamily: 'var(--font-inter)', fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{s.label}</span>
        </div>
      ))}
    </div>
  )
}

/* ── HeroSection ────────────────────────────────────────────────────────────── */
const CHIPS = ['Agente de IA', 'KDS em tempo real', 'Multi-usuário', 'Controle financeiro', 'Multi-plano']

export function HeroSection({ onDemoClick }: { onDemoClick: () => void }) {
  return (
    <section id="hero" style={{
      minHeight: '100vh', position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ambient orb */}
      <div style={{
        position: 'absolute', top: '15%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 700, height: 700, borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(74,222,128,0.08) 0%, transparent 70%)',
        filter: 'blur(60px)',
        animation: 'lp-pulse-orb 10s ease-in-out infinite',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* text block */}
      <div style={{
        flex: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
        textAlign: 'center', padding: 'clamp(100px,12vh,140px) clamp(24px,6vw,120px) 0',
        position: 'relative', zIndex: 2, gap: 22,
      }}>
        {/* tagline pill */}
        <div className="lp-fade-up" style={{
          animationDelay: '0.1s', display: 'inline-flex', alignItems: 'center', gap: 10,
          background: 'rgba(74,222,128,0.1)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(74,222,128,0.3)', borderRadius: 10, height: 38, padding: '0 14px',
        }}>
          <span style={{
            background: 'var(--lp-btn-green)', borderRadius: 6, padding: '2px 9px',
            fontFamily: 'var(--font-cabin)', fontWeight: 700, fontSize: 11, color: '#fff',
          }}>Novo</span>
          <span style={{ fontFamily: 'var(--font-cabin)', fontWeight: 500, fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
            Gestão completa para restaurantes — THE FINANCE v1.0
          </span>
        </div>

        {/* headline */}
        <h1 className="lp-fade-up" style={{
          animationDelay: '0.25s',
          fontFamily: 'var(--font-instrument-serif)',
          fontSize: 'clamp(34px,6.2vw,78px)', lineHeight: 1.08,
          color: '#fff', letterSpacing: '-1px', maxWidth: 920, margin: 0,
          textWrap: 'balance' as React.CSSProperties['textWrap'],
        }}>
          Gerencie seu restaurante com{' '}
          <em style={{ fontStyle: 'italic', color: 'var(--lp-neon)' }}>inteligência</em>
          {' '}e controle total
        </h1>

        {/* subtitle */}
        <p className="lp-fade-up" style={{
          animationDelay: '0.4s',
          fontFamily: 'var(--font-inter)', fontWeight: 300, fontSize: 18,
          lineHeight: 1.7, color: 'rgba(255,255,255,0.58)', maxWidth: 760, margin: 0,
        }}>
          Controle estoque, vendas, financeiro e cozinha em tempo real com IA.
        </p>

        {/* chips */}
        <div className="lp-fade-up" style={{ animationDelay: '0.52s', display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {CHIPS.map((c) => (
            <span key={c} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 999, padding: '5px 14px',
              fontFamily: 'var(--font-cabin)', fontWeight: 500, fontSize: 12,
              color: 'rgba(255,255,255,0.65)',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--lp-neon)', flexShrink: 0 }} />
              {c}
            </span>
          ))}
        </div>

        {/* CTAs */}
        <div className="lp-fade-up" style={{
          animationDelay: '0.66s', display: 'flex', gap: 12,
          flexWrap: 'wrap', justifyContent: 'center',
        }}>
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
            color: 'rgba(255,255,255,0.9)',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(74,222,128,0.35)',
            borderRadius: 10, padding: '14px 32px', cursor: 'pointer',
            transition: 'background 0.2s, border-color 0.2s, transform 0.15s',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(74,222,128,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <Play size={14} fill="currentColor" />
            Assistir Demonstração
          </button>
        </div>
      </div>

      {/* mascot + floating cards */}
      <div className="lp-fade-up" style={{
        animationDelay: '0.8s',
        flex: 1, position: 'relative',
        display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
        minHeight: 540, paddingTop: 60, paddingBottom: 100, zIndex: 2,
      }}>
        <CardLeft />
        <CardRight />
        <CardMiniRevenue />
        <Mascot />
      </div>

      {/* city skyline */}
      <CitySkyline />

      {/* stats strip */}
      <StatsStrip />
    </section>
  )
}
