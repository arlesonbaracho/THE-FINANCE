'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ShoppingBag, Package, BarChart2, Users, Menu, X, ChevronDown } from 'lucide-react'

// ── Navbar ─────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <>
      <div style={{
        width: 34, height: 34, borderRadius: 8, background: 'var(--lp-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <polygon points="8,2 14,13 2,13" fill="white" />
        </svg>
      </div>
      <span style={{
        fontFamily: 'var(--font-manrope)', fontWeight: 800, fontSize: 18,
        color: '#fff', letterSpacing: '-0.3px',
      }}>THE FINANCE</span>
    </>
  )
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const navLinks = ['Início', 'Módulos', 'Planos', 'Contato']

  function scrollTo(item: string) {
    const map: Record<string, string> = { Início: 'hero', Módulos: 'modulos', Planos: 'planos', Contato: 'contato' }
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
        background: scrolled ? 'rgba(28,28,30,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <Logo />
        </Link>

        {/* Center nav — desktop */}
        <div className="hidden md:flex" style={{ gap: 32 }}>
          {navLinks.map((item) => (
            <button
              key={item}
              onClick={() => scrollTo(item)}
              style={{
                fontFamily: 'var(--font-manrope)', fontWeight: 500, fontSize: 14,
                color: 'rgba(255,255,255,0.85)', background: 'none', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                transition: 'color 0.2s', padding: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
            >
              {item}
              {item === 'Módulos' && <ChevronDown size={14} />}
            </button>
          ))}
        </div>

        {/* Right buttons — desktop */}
        <div className="hidden md:flex" style={{ gap: 10 }}>
          <Link href="/login" style={{
            fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 14,
            color: '#fff', textDecoration: 'none', padding: '9px 20px',
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8, transition: 'background 0.2s',
          }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.14)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)')}
          >
            Entrar
          </Link>
          <Link href="/cadastro" style={{
            fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 14,
            color: '#fff', textDecoration: 'none', padding: '9px 20px',
            background: 'var(--lp-primary)', borderRadius: 8,
            boxShadow: '0 2px 12px rgba(45,106,79,0.35)', transition: 'background 0.2s',
          }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--lp-primary-dark)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--lp-primary)')}
          >
            Começar grátis
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="flex md:hidden"
          onClick={() => setMobileOpen(true)}
          style={{ color: '#fff', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
          aria-label="Abrir menu"
        >
          <Menu size={24} />
        </button>
      </nav>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lp-mobile-menu"
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'var(--lp-gray-900)',
            display: 'flex', flexDirection: 'column',
            padding: '0 24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
            <Link href="/" onClick={() => setMobileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <Logo />
            </Link>
            <button onClick={() => setMobileOpen(false)} style={{ color: '#fff', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={24} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingTop: 16 }}>
            {navLinks.map((item, i) => (
              <button
                key={item}
                onClick={() => {
                  setMobileOpen(false)
                  setTimeout(() => scrollTo(item), 100)
                }}
                style={{
                  fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 22,
                  color: '#fff', background: 'none', border: 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.07)',
                  padding: '16px 0', cursor: 'pointer', textAlign: 'left',
                  animationDelay: `${i * 0.05}s`,
                }}
              >
                {item}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 40, paddingTop: 24 }}>
            <Link href="/login" onClick={() => setMobileOpen(false)} style={{
              display: 'block', textAlign: 'center', textDecoration: 'none',
              fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 16,
              color: '#fff', padding: '14px', background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10,
            }}>
              Entrar
            </Link>
            <Link href="/cadastro" onClick={() => setMobileOpen(false)} style={{
              display: 'block', textAlign: 'center', textDecoration: 'none',
              fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 16,
              color: '#fff', padding: '14px', background: 'var(--lp-primary)',
              borderRadius: 10,
            }}>
              Começar grátis
            </Link>
          </div>
        </div>
      )}
    </>
  )
}

// ── Hero Section ───────────────────────────────────────────────────────────────

function HeroSection({ onDemoClick }: { onDemoClick: () => void }) {
  const stats = [
    { icon: <ShoppingBag size={20} />, value: '12k+', label: 'Pedidos processados' },
    { icon: <Package size={20} />, value: '98%', label: 'Precisão no estoque' },
    { icon: <BarChart2 size={20} />, value: '3x', label: 'Mais eficiência operacional' },
    { icon: <Users size={20} />, value: '500+', label: 'Restaurantes ativos' },
  ]

  const chips = ['Agente de IA', 'KDS em tempo real', 'Multi-usuário', 'Controle financeiro', 'Multi-plano']

  return (
    <section id="hero" style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: '120px clamp(24px,6vw,120px) 80px',
      position: 'relative', zIndex: 1, gap: 28,
    }}>
      {/* Ambient orbs */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: 'var(--lp-primary-glow)', filter: 'blur(90px)',
        animation: 'lp-pulse-orb 8s ease-in-out infinite', pointerEvents: 'none', zIndex: -1,
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', right: '10%',
        width: 400, height: 400, borderRadius: '50%',
        background: 'rgba(45,106,79,0.08)', filter: 'blur(90px)',
        animation: 'lp-pulse-orb 12s ease-in-out infinite 2s', pointerEvents: 'none', zIndex: -1,
      }} />

      {/* Pill tagline */}
      <div className="lp-fade-up" style={{
        animationDelay: '0.1s', display: 'inline-flex', alignItems: 'center', gap: 10,
        background: 'rgba(45,106,79,0.18)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(45,106,79,0.4)', borderRadius: 10, height: 38, padding: '0 14px',
      }}>
        <span style={{
          background: 'var(--lp-primary)', borderRadius: 6, padding: '2px 9px',
          fontFamily: 'var(--font-cabin)', fontWeight: 600, fontSize: 12, color: '#fff',
        }}>
          Novo
        </span>
        <span style={{ fontFamily: 'var(--font-cabin)', fontWeight: 500, fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>
          Gestão completa para restaurantes — THE FINANCE v1.0
        </span>
      </div>

      {/* Headline */}
      <h1 className="lp-fade-up" style={{
        animationDelay: '0.25s',
        fontFamily: 'var(--font-instrument-serif)',
        fontSize: 'clamp(42px,7vw,88px)', lineHeight: 1.05,
        color: '#fff', letterSpacing: '-1px', maxWidth: 820, margin: 0,
      }}>
        Gerencie seu restaurante{' '}
        <em style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.6)' }}>com</em>{' '}
        inteligência e controle total
      </h1>

      {/* Subtext */}
      <p className="lp-fade-up" style={{
        animationDelay: '0.4s',
        fontFamily: 'var(--font-inter)', fontWeight: 300, fontSize: 18,
        lineHeight: 1.7, color: 'rgba(255,255,255,0.62)', maxWidth: 600, margin: 0,
      }}>
        Estoque inteligente com leitura de notas fiscais por IA, cardápio digital, painel da cozinha em tempo real e financeiro integrado — tudo em um só lugar.
      </p>

      {/* Feature chips */}
      <div className="lp-fade-up" style={{ animationDelay: '0.55s', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
        {chips.map((chip) => (
          <span key={chip} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 999, padding: '6px 14px',
            fontFamily: 'var(--font-cabin)', fontWeight: 500, fontSize: 13,
            color: 'rgba(255,255,255,0.7)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--lp-primary)', flexShrink: 0 }} />
            {chip}
          </span>
        ))}
      </div>

      {/* CTA buttons */}
      <div className="lp-fade-up" style={{
        animationDelay: '0.7s', display: 'flex', gap: 14,
        flexWrap: 'wrap', justifyContent: 'center',
      }}>
        <button
          onClick={onDemoClick}
          style={{
            fontFamily: 'var(--font-cabin)', fontWeight: 500, fontSize: 16,
            color: '#fff', background: 'var(--lp-primary)',
            border: 'none', borderRadius: 10, padding: '14px 32px', cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(45,106,79,0.4)',
            transition: 'background 0.2s, transform 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--lp-primary-dark)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--lp-primary)'; e.currentTarget.style.transform = 'translateY(0)' }}
        >
          Agendar demonstração
        </button>
        <Link href="/cadastro" style={{
          fontFamily: 'var(--font-cabin)', fontWeight: 500, fontSize: 16,
          color: '#f0f0f0', background: 'var(--lp-gray-700)',
          border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10,
          padding: '14px 32px', textDecoration: 'none',
          transition: 'background 0.2s, transform 0.15s', display: 'inline-block',
        }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#4a4a4c'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--lp-gray-700)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
        >
          Começar grátis
        </Link>
      </div>

      {/* Stats cards */}
      <div className="lp-fade-up" style={{
        animationDelay: '0.85s', display: 'flex', gap: 16,
        flexWrap: 'wrap', maxWidth: 820, width: '100%', marginTop: 48,
      }}>
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              flex: 1, minWidth: 150,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, padding: '24px 28px',
              transition: 'background 0.2s', cursor: 'default',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)')}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'rgba(45,106,79,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--lp-primary)', marginBottom: 12,
            }}>
              {s.icon}
            </div>
            <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800, fontSize: 32, color: '#fff', margin: '0 0 4px' }}>{s.value}</p>
            <p style={{ fontFamily: 'var(--font-inter)', fontWeight: 400, fontSize: 13, color: 'var(--lp-gray-400)', margin: 0 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Scroll hint */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 16, opacity: 0.3 }}>
        <div style={{ width: 1, height: 48, background: 'linear-gradient(transparent, white)' }} />
        <span style={{ fontFamily: 'var(--font-inter)', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#fff' }}>
          scroll
        </span>
      </div>
    </section>
  )
}

// ── Modules Section ────────────────────────────────────────────────────────────

const MODULES = [
  { emoji: '🤖', title: 'Agente de IA', description: 'Lê notas fiscais por foto e lança no estoque automaticamente.' },
  { emoji: '📦', title: 'Estoque Inteligente', description: 'Custo médio ponderado, inventário, alertas de reposição.' },
  { emoji: '🍽️', title: 'Cardápio & PDV', description: 'Cardápio digital e ponto de venda integrados ao estoque.' },
  { emoji: '👨‍🍳', title: 'Painel da Cozinha', description: 'KDS em tempo real. Pedidos chegam direto para a equipe.' },
  { emoji: '📊', title: 'Financeiro', description: 'DRE automático, CMV, relatórios do dia, semana e mês.' },
  { emoji: '👥', title: 'Multi-usuário', description: 'Cada função com acesso certo. Admin, caixa, cozinheiro e mais.' },
]

function ModulesSection() {
  return (
    <section id="modulos" style={{ padding: '80px clamp(24px,6vw,120px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h2 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: 'clamp(32px,4vw,52px)', color: '#fff', margin: '0 0 12px' }}>
          Tudo que seu restaurante precisa
        </h2>
        <p style={{ fontFamily: 'var(--font-inter)', fontSize: 16, color: 'var(--lp-gray-400)', maxWidth: 480, margin: '0 auto' }}>
          Módulos integrados que conversam entre si — do estoque ao financeiro, sem planilhas.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 16,
      }}>
        {MODULES.map((mod) => (
          <div
            key={mod.title}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 16, padding: '28px 24px',
              display: 'flex', flexDirection: 'column', gap: 12,
              transition: 'background 0.2s, border-color 0.2s', cursor: 'default',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'rgba(45,106,79,0.08)'
              el.style.borderColor = 'rgba(45,106,79,0.30)'
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'rgba(255,255,255,0.03)'
              el.style.borderColor = 'rgba(255,255,255,0.07)'
            }}
          >
            <span style={{ fontSize: 28 }}>{mod.emoji}</span>
            <h3 style={{ fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: 16, color: '#fff', margin: 0 }}>
              {mod.title}
            </h3>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: 14, lineHeight: 1.6, color: 'var(--lp-gray-400)', margin: 0 }}>
              {mod.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Pricing Section ────────────────────────────────────────────────────────────

type PlanFeature = { text: string; included: boolean }

type Plan = {
  name: string
  monthlyPrice: number | null
  annualPrice: number | null
  priceLabel?: string
  description: string
  highlight: boolean
  badge?: string
  features: PlanFeature[]
  cta: string
  href: string
}

const PLANS: Plan[] = [
  {
    name: 'Básico',
    monthlyPrice: 149,
    annualPrice: 119,
    description: 'Para começar com organização',
    highlight: false,
    features: [
      { text: 'Estoque manual', included: true },
      { text: 'Cardápio digital', included: true },
      { text: 'PDV', included: true },
      { text: 'Painel da cozinha (KDS)', included: true },
      { text: 'Até 3 usuários', included: true },
      { text: 'Relatórios básicos', included: true },
      { text: 'Agente de IA (NF)', included: false },
      { text: 'Relatórios avançados', included: false },
    ],
    cta: 'Começar grátis',
    href: '/cadastro?plano=basico',
  },
  {
    name: 'Pro',
    monthlyPrice: 299,
    annualPrice: 239,
    description: 'Para operações que crescem',
    highlight: true,
    badge: 'Mais popular',
    features: [
      { text: 'Estoque manual', included: true },
      { text: 'Cardápio digital', included: true },
      { text: 'PDV', included: true },
      { text: 'Painel da cozinha (KDS)', included: true },
      { text: 'Até 10 usuários', included: true },
      { text: 'Relatórios básicos', included: true },
      { text: 'Agente de IA (leitura de NF)', included: true },
      { text: 'Relatórios avançados', included: true },
      { text: 'Exportação PDF e Excel', included: true },
      { text: 'Alertas automáticos', included: true },
    ],
    cta: 'Começar com Pro',
    href: '/cadastro?plano=pro',
  },
  {
    name: 'Enterprise',
    monthlyPrice: null,
    annualPrice: null,
    priceLabel: 'Sob consulta',
    description: 'Para redes e multi-unidades',
    highlight: false,
    features: [
      { text: 'Tudo do Pro', included: true },
      { text: 'Multi-unidade', included: true },
      { text: 'API de integração', included: true },
      { text: 'Suporte dedicado', included: true },
      { text: 'Usuários ilimitados', included: true },
      { text: 'SLA garantido', included: true },
    ],
    cta: 'Falar com vendas',
    href: '#contato',
  },
]

function PricingSection({ onContactClick }: { onContactClick: () => void }) {
  const [annual, setAnnual] = useState(false)

  return (
    <section id="planos" style={{ padding: '80px clamp(24px,6vw,120px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h2 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: 'clamp(32px,4vw,52px)', color: '#fff', margin: '0 0 12px' }}>
          Planos para cada momento do seu negócio
        </h2>
        <p style={{ fontFamily: 'var(--font-inter)', fontSize: 16, color: 'var(--lp-gray-400)', margin: '0 0 32px' }}>
          Comece grátis. Escale quando precisar.
        </p>

        {/* Toggle */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 12,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 999, padding: '6px 16px',
        }}>
          <span style={{ fontFamily: 'var(--font-manrope)', fontSize: 14, color: annual ? 'var(--lp-gray-400)' : '#fff', transition: 'color 0.2s' }}>
            Mensal
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            aria-label="Alternar faturamento anual"
            style={{
              position: 'relative', width: 44, height: 24, borderRadius: 999,
              background: annual ? 'var(--lp-primary)' : 'rgba(255,255,255,0.15)',
              border: 'none', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: 2, left: annual ? 22 : 2,
              width: 20, height: 20, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s',
            }} />
          </button>
          <span style={{ fontFamily: 'var(--font-manrope)', fontSize: 14, color: annual ? '#fff' : 'var(--lp-gray-400)', transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}>
            Anual
            <span style={{
              background: 'var(--lp-primary)', borderRadius: 999, padding: '1px 7px',
              fontFamily: 'var(--font-cabin)', fontWeight: 600, fontSize: 11, color: '#fff',
            }}>−20%</span>
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1000, margin: '0 auto' }}>
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            style={{
              background: plan.highlight ? 'rgba(45,106,79,0.10)' : 'rgba(255,255,255,0.03)',
              border: `${plan.highlight ? 2 : 1}px solid ${plan.highlight ? 'var(--lp-primary)' : 'rgba(255,255,255,0.08)'}`,
              boxShadow: plan.highlight ? '0 0 40px rgba(45,106,79,0.25)' : 'none',
              borderRadius: 20, padding: '32px 28px',
              position: 'relative', display: 'flex', flexDirection: 'column',
              flex: '1 1 260px', maxWidth: 320,
            }}
          >
            {plan.badge && (
              <div style={{
                position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                background: 'var(--lp-primary)', borderRadius: 999,
                fontFamily: 'var(--font-cabin)', fontWeight: 600, fontSize: 12,
                color: '#fff', padding: '3px 14px', whiteSpace: 'nowrap',
              }}>
                {plan.badge}
              </div>
            )}

            <h3 style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800, fontSize: 20, color: '#fff', margin: '0 0 6px' }}>
              {plan.name}
            </h3>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: 14, color: 'var(--lp-gray-400)', margin: '0 0 24px' }}>
              {plan.description}
            </p>

            <div style={{ marginBottom: 28 }}>
              {plan.priceLabel ? (
                <span style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800, fontSize: 32, color: '#fff' }}>
                  {plan.priceLabel}
                </span>
              ) : (
                <>
                  <span style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800, fontSize: 40, color: '#fff' }}>
                    R${annual ? plan.annualPrice : plan.monthlyPrice}
                  </span>
                  <span style={{ fontFamily: 'var(--font-inter)', fontSize: 14, color: 'var(--lp-gray-400)' }}>/mês</span>
                  {annual && (
                    <p style={{ fontFamily: 'var(--font-inter)', fontSize: 12, color: 'var(--lp-gray-400)', margin: '4px 0 0' }}>
                      Cobrado R${(plan.annualPrice ?? 0) * 12}/ano
                    </p>
                  )}
                </>
              )}
            </div>

            <ul style={{ listStyle: 'none', margin: '0 0 32px', padding: 0, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              {plan.features.map((f) => (
                <li key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-inter)', fontSize: 14, color: f.included ? 'rgba(255,255,255,0.75)' : 'var(--lp-gray-500)' }}>
                  <span style={{ color: f.included ? 'var(--lp-primary)' : 'var(--lp-gray-500)', flexShrink: 0, fontSize: 14 }}>
                    {f.included ? '✓' : '✗'}
                  </span>
                  {f.text}
                </li>
              ))}
            </ul>

            {plan.name === 'Enterprise' ? (
              <button
                onClick={onContactClick}
                style={{
                  display: 'block', width: '100%', textAlign: 'center',
                  fontFamily: 'var(--font-cabin)', fontWeight: 600, fontSize: 15,
                  color: '#fff', padding: '13px',
                  background: 'rgba(255,255,255,0.09)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10, cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
              >
                {plan.cta}
              </button>
            ) : (
              <Link href={plan.href} style={{
                display: 'block', textAlign: 'center', textDecoration: 'none',
                fontFamily: 'var(--font-cabin)', fontWeight: 600, fontSize: 15,
                color: '#fff', padding: '13px',
                background: plan.highlight ? 'var(--lp-primary)' : 'rgba(255,255,255,0.09)',
                border: plan.highlight ? 'none' : '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                boxShadow: plan.highlight ? '0 4px 20px rgba(45,106,79,0.35)' : 'none',
                transition: 'background 0.2s',
              }}
                onMouseEnter={(e) => {
                  if (plan.highlight) (e.currentTarget as HTMLElement).style.background = 'var(--lp-primary-dark)'
                  else (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.14)'
                }}
                onMouseLeave={(e) => {
                  if (plan.highlight) (e.currentTarget as HTMLElement).style.background = 'var(--lp-primary)'
                  else (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'
                }}
              >
                {plan.cta}
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Testimonials Section ───────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    text: 'Eliminamos as planilhas em 1 semana. O agente que lê nota fiscal sozinho já pagou o sistema.',
    name: 'Carlos Mendes',
    role: 'Gerente',
    restaurant: 'Burger Station, Natal-RN',
    initial: 'C',
  },
  {
    text: 'O painel da cozinha transformou nossa operação. Zero pedido perdido.',
    name: 'Ana Paula Rocha',
    role: 'Proprietária',
    restaurant: 'Café da Praça, Fortaleza-CE',
    initial: 'A',
  },
  {
    text: 'Finalmente sei o CMV real de cada prato. Reajustei o cardápio e aumentei a margem em 12%.',
    name: 'Roberto Lima',
    role: 'Chef e Sócio',
    restaurant: 'La Trattoria, Recife-PE',
    initial: 'R',
  },
]

function TestimonialsSection() {
  return (
    <section style={{ padding: '80px clamp(24px,6vw,120px)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h2 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: 'clamp(32px,4vw,52px)', color: '#fff', margin: 0 }}>
          O que nossos clientes dizem
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {TESTIMONIALS.map((t) => (
          <div key={t.name} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16, padding: 28,
          }}>
            <div style={{ display: 'flex', gap: 2, marginBottom: 16 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} style={{ color: 'var(--lp-primary)', fontSize: 14 }}>★</span>
              ))}
            </div>
            <p style={{
              fontFamily: 'var(--font-inter)', fontSize: 15, lineHeight: 1.7,
              color: 'rgba(255,255,255,0.75)', fontStyle: 'italic', margin: '0 0 20px',
            }}>
              &ldquo;{t.text}&rdquo;
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'var(--lp-gray-700)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: 16, color: '#fff',
                flexShrink: 0,
              }}>
                {t.initial}
              </div>
              <div>
                <p style={{ fontFamily: 'var(--font-manrope)', fontWeight: 600, fontSize: 14, color: '#fff', margin: 0 }}>
                  {t.name}
                </p>
                <p style={{ fontFamily: 'var(--font-inter)', fontSize: 13, color: 'var(--lp-gray-400)', margin: 0 }}>
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

// ── CTA Final ─────────────────────────────────────────────────────────────────

function CTASection({ onDemoClick }: { onDemoClick: () => void }) {
  return (
    <section style={{
      padding: '80px clamp(24px,6vw,120px)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient orb */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 700, height: 400, borderRadius: '50%',
        background: 'var(--lp-primary-glow)', filter: 'blur(90px)',
        pointerEvents: 'none', animation: 'lp-pulse-orb 10s ease-in-out infinite',
      }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <h2 style={{
          fontFamily: 'var(--font-instrument-serif)',
          fontSize: 'clamp(32px,4vw,52px)', color: '#fff', margin: 0,
        }}>
          Pronto para transformar sua operação?
        </h2>
        <p style={{ fontFamily: 'var(--font-inter)', fontSize: 16, color: 'var(--lp-gray-400)', maxWidth: 440, margin: 0 }}>
          Comece com 14 dias grátis. Sem cartão de crédito. Cancele quando quiser.
        </p>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={onDemoClick}
            style={{
              fontFamily: 'var(--font-cabin)', fontWeight: 500, fontSize: 16,
              color: '#fff', background: 'var(--lp-primary)',
              border: 'none', borderRadius: 10, padding: '14px 32px', cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(45,106,79,0.4)',
              transition: 'background 0.2s, transform 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--lp-primary-dark)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--lp-primary)'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            Agendar demonstração
          </button>
          <Link href="/cadastro" style={{
            fontFamily: 'var(--font-cabin)', fontWeight: 500, fontSize: 16,
            color: '#f0f0f0', background: 'var(--lp-gray-700)',
            border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10,
            padding: '14px 32px', textDecoration: 'none',
            transition: 'background 0.2s, transform 0.15s', display: 'inline-block',
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#4a4a4c'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--lp-gray-700)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
          >
            Começar grátis
          </Link>
        </div>

        <p style={{ fontFamily: 'var(--font-inter)', fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
          Mais de 500 restaurantes já usam o THE FINANCE
        </p>
      </div>
    </section>
  )
}

// ── Footer ─────────────────────────────────────────────────────────────────────

function Footer() {
  const cols = [
    {
      title: 'Produto',
      links: ['Funcionalidades', 'Planos', 'Novidades', 'Roadmap'],
    },
    {
      title: 'Empresa',
      links: ['Sobre', 'Blog', 'Contato', 'Trabalhe conosco'],
    },
    {
      title: 'Suporte',
      links: ['Central de ajuda', 'Documentação', 'Status', 'Termos e Privacidade'],
    },
  ]

  return (
    <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '48px clamp(24px,6vw,120px)' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 40,
        marginBottom: 40,
      }}>
        {/* Brand column */}
        <div style={{ gridColumn: 'span 1' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--lp-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><polygon points="8,2 14,13 2,13" fill="white" /></svg>
            </div>
            <span style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800, fontSize: 18, color: '#fff' }}>THE FINANCE</span>
          </div>
          <p style={{ fontFamily: 'var(--font-inter)', fontSize: 14, lineHeight: 1.7, color: 'var(--lp-gray-400)', margin: '0 0 16px', maxWidth: 240 }}>
            Sistema de gestão completo para restaurantes e lanchonetes.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Dados protegidos', 'SSL'].map((badge) => (
              <span key={badge} style={{
                fontFamily: 'var(--font-cabin)', fontWeight: 500, fontSize: 11, color: 'rgba(255,255,255,0.5)',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 999, padding: '3px 10px',
              }}>
                {badge}
              </span>
            ))}
          </div>
        </div>

        {/* Link columns */}
        {cols.map((col) => (
          <div key={col.title}>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: 13,
              color: 'rgba(255,255,255,0.5)', margin: '0 0 16px',
              textTransform: 'uppercase', letterSpacing: '0.1em',
            }}>
              {col.title}
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {col.links.map((link) => (
                <li key={link}>
                  <a href="#" style={{
                    fontFamily: 'var(--font-inter)', fontSize: 14,
                    color: 'rgba(255,255,255,0.7)', textDecoration: 'none', transition: 'color 0.2s',
                  }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#fff')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)')}
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 24,
        display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <p style={{ fontFamily: 'var(--font-inter)', fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
          © 2026 THE FINANCE · Todos os direitos reservados
        </p>
        <p style={{ fontFamily: 'var(--font-inter)', fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
          Feito com ♥ para restaurantes brasileiros
        </p>
      </div>
    </footer>
  )
}

// ── Demo Modal ─────────────────────────────────────────────────────────────────

type DemoForm = {
  name: string
  email: string
  phone: string
  restaurant: string
  employees: string
  message: string
}

function DemoModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState<DemoForm>({ name: '', email: '', phone: '', restaurant: '', employees: '', message: '' })
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', fn)
      document.body.style.overflow = ''
    }
  }, [onClose])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => { setLoading(false); setSent(true) }, 1200)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 8, padding: '12px 16px',
    fontFamily: 'var(--font-inter)', fontSize: 14, color: '#fff', outline: 'none',
    transition: 'border-color 0.2s',
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        overflowY: 'auto',
      }}
    >
      <div
        className="lp-mobile-menu"
        style={{
          background: 'var(--lp-gray-900)', border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 20, padding: '40px 36px', maxWidth: 480, width: '100%',
          position: 'relative', margin: 'auto',
        }}
      >
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', transition: 'color 0.2s', padding: 4 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
        >
          <X size={20} />
        </button>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(45,106,79,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: 24,
            }}>
              ✓
            </div>
            <h3 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: 26, color: '#fff', margin: '0 0 8px' }}>
              Agendado com sucesso!
            </h3>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: 14, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
              Entraremos em contato em até 2 horas pelo WhatsApp.
            </p>
          </div>
        ) : (
          <>
            <h3 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: 28, color: '#fff', margin: '0 0 6px' }}>
              Agende sua demonstração gratuita
            </h3>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: 14, color: 'var(--lp-gray-400)', margin: '0 0 28px' }}>
              Nossa equipe mostra o sistema completo em 30 minutos.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { key: 'name', label: 'Nome completo', placeholder: 'João Silva', type: 'text' },
                { key: 'email', label: 'Email', placeholder: 'joao@restaurante.com', type: 'email' },
                { key: 'phone', label: 'Telefone / WhatsApp', placeholder: '(84) 9 9999-9999', type: 'tel' },
                { key: 'restaurant', label: 'Nome do restaurante', placeholder: 'Sabor do Norte', type: 'text' },
              ].map((field) => (
                <div key={field.key}>
                  <label style={{ fontFamily: 'var(--font-manrope)', fontWeight: 500, fontSize: 13, color: 'rgba(255,255,255,0.65)', display: 'block', marginBottom: 5 }}>
                    {field.label} *
                  </label>
                  <input
                    type={field.type}
                    required
                    value={form[field.key as keyof DemoForm]}
                    onChange={(e) => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    style={{ ...inputStyle, '::placeholder': { color: 'rgba(255,255,255,0.35)' } } as React.CSSProperties}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--lp-primary)')}
                    onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
                  />
                </div>
              ))}

              <div>
                <label style={{ fontFamily: 'var(--font-manrope)', fontWeight: 500, fontSize: 13, color: 'rgba(255,255,255,0.65)', display: 'block', marginBottom: 5 }}>
                  Número de funcionários
                </label>
                <select
                  value={form.employees}
                  onChange={(e) => setForm(prev => ({ ...prev, employees: e.target.value }))}
                  style={{
                    ...inputStyle,
                    color: form.employees ? '#fff' : 'rgba(255,255,255,0.35)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="" style={{ background: '#1C1C1E', color: '#fff' }}>Selecionar</option>
                  <option value="1-5" style={{ background: '#1C1C1E', color: '#fff' }}>1–5 funcionários</option>
                  <option value="6-15" style={{ background: '#1C1C1E', color: '#fff' }}>6–15 funcionários</option>
                  <option value="16-30" style={{ background: '#1C1C1E', color: '#fff' }}>16–30 funcionários</option>
                  <option value="30+" style={{ background: '#1C1C1E', color: '#fff' }}>30+ funcionários</option>
                </select>
              </div>

              <div>
                <label style={{ fontFamily: 'var(--font-manrope)', fontWeight: 500, fontSize: 13, color: 'rgba(255,255,255,0.65)', display: 'block', marginBottom: 5 }}>
                  Mensagem (opcional)
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Conte um pouco sobre seu restaurante..."
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--lp-primary)')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 4,
                  fontFamily: 'var(--font-cabin)', fontWeight: 500, fontSize: 16,
                  color: '#fff', background: 'var(--lp-primary)', border: 'none',
                  borderRadius: 10, padding: '14px', cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1, transition: 'background 0.2s, opacity 0.2s',
                  boxShadow: '0 4px 18px rgba(45,106,79,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
                }}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'var(--lp-primary-dark)' }}
                onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = 'var(--lp-primary)' }}
              >
                {loading ? (
                  <>
                    <span style={{
                      width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff', borderRadius: '50%',
                      animation: 'lp-spin 0.8s linear infinite', display: 'inline-block',
                    }} />
                    Enviando...
                  </>
                ) : 'Confirmar agendamento'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// ── Root LandingPage ───────────────────────────────────────────────────────────

export function LandingPage() {
  const [demoOpen, setDemoOpen] = useState(false)

  return (
    <div
      className="lp-noise"
      style={{ background: 'var(--lp-gray-900)', minHeight: '100vh', color: '#fff' }}
    >
      <Navbar />
      <HeroSection onDemoClick={() => setDemoOpen(true)} />
      <ModulesSection />
      <PricingSection onContactClick={() => setDemoOpen(true)} />
      <TestimonialsSection />
      <CTASection onDemoClick={() => setDemoOpen(true)} />
      <Footer />
      {demoOpen && <DemoModal onClose={() => setDemoOpen(false)} />}
    </div>
  )
}
