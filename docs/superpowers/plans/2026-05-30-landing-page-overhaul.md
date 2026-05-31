# Landing Page Overhaul — THE FINANCE

> **Para agentes:** SUB-SKILL OBRIGATÓRIO: Use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para implementar este plano tarefa por tarefa. Os passos usam sintaxe de checkbox (`- [ ]`) para rastreamento.

**Goal:** Substituir `src/components/landing/LandingPage.tsx` por arquitetura multi-arquivo ultra-moderna — mascote 3D centralizado, canvas com partículas/grid/anéis, glassmorphism fintech premium e seções redesenhadas.

**Architecture:** Canvas fixo (`CanvasBackground`) renderiza fundo animado. Oito componentes de seção independentes. `LandingPage.tsx` vira orquestrador fino. Sem dependências novas. CSS keyframes + `IntersectionObserver` para scroll-reveal.

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript · Inline styles · Canvas 2D API · Lucide React (já instalado) · Tailwind CSS (classes utilitárias existentes apenas)

---

## Mapa de arquivos

| Ação | Arquivo |
|---|---|
| Modificar | `src/app/globals.css` |
| Criar | `src/components/landing/CanvasBackground.tsx` |
| Criar | `src/components/landing/Navbar.tsx` |
| Criar | `src/components/landing/DemoModal.tsx` |
| Criar | `src/components/landing/HeroSection.tsx` |
| Criar | `src/components/landing/ModulesSection.tsx` |
| Criar | `src/components/landing/PricingSection.tsx` |
| Criar | `src/components/landing/TestimonialsSection.tsx` |
| Criar | `src/components/landing/CTASection.tsx` |
| Criar | `src/components/landing/Footer.tsx` |
| Reescrever | `src/components/landing/LandingPage.tsx` |

---

## Task 1: Atualizar globals.css — keyframes e variáveis LP

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Passo 1: Adicionar variáveis e keyframes novos ao final da seção LP**

Localizar o bloco que começa com `/* ── Landing Page ─────` e substituí-lo pelo conteúdo abaixo (mantém tudo que já existe, acrescenta o novo):

```css
/* ── Landing Page ─────────────────────────────────────────────────────────── */

:root {
  --lp-primary:        #2D6A4F;
  --lp-primary-dark:   #1B4332;
  --lp-primary-glow:   rgba(45, 106, 79, 0.15);
  --lp-gray-900:       #1C1C1E;
  --lp-gray-700:       #3A3A3C;
  --lp-gray-500:       #636366;
  --lp-gray-400:       #8E8E93;
  --lp-white:          #FFFFFF;
  --lp-white-70:       rgba(255, 255, 255, 0.70);
  --lp-white-10:       rgba(255, 255, 255, 0.08);
  --lp-white-06:       rgba(255, 255, 255, 0.06);
  /* NEW */
  --lp-neon:           #4ADE80;
  --lp-neon-glow:      rgba(74, 222, 128, 0.35);
  --lp-btn-green:      #16a34a;
  --lp-btn-green-dark: #15803d;
}

@keyframes lp-fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes lp-fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes lp-pulse-orb {
  0%, 100% { transform: scale(1);   opacity: 0.6; }
  50%       { transform: scale(1.1); opacity: 0.9; }
}

@keyframes lp-spin {
  to { transform: rotate(360deg); }
}

/* NEW keyframes */
@keyframes lp-float {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-12px); }
}

@keyframes lp-ring-pulse {
  0%, 100% { transform: scale(1);    opacity: 0.35; }
  50%       { transform: scale(1.12); opacity: 0.12; }
}

@keyframes lp-shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}

.lp-fade-up {
  opacity: 0;
  animation: lp-fadeUp 0.7s ease forwards;
}

.lp-mobile-menu {
  animation: lp-fadeIn 0.2s ease;
}

/* Scroll-reveal */
.lp-scroll-reveal {
  opacity: 0;
  transform: translateY(28px);
  transition: opacity 0.65s ease, transform 0.65s ease;
}
.lp-scroll-reveal.lp-revealed {
  opacity: 1;
  transform: translateY(0);
}

/* Shimmer no card Pro */
.lp-plan-shimmer {
  position: relative;
  overflow: hidden;
}
.lp-plan-shimmer::before {
  content: '';
  position: absolute;
  top: -2px; bottom: -2px;
  left: -60%;
  width: 60%;
  background: linear-gradient(90deg, transparent, rgba(74,222,128,0.14), transparent);
  animation: lp-shimmer 2.8s linear infinite;
  pointer-events: none;
}

/* Responsive helpers */
@media (max-width: 767px) {
  .lp-float-card    { display: none !important; }
  .lp-modules-bento { grid-template-columns: 1fr !important; }
  .lp-modules-bento > * { grid-column: span 1 !important; }
  .lp-testimonials-track { flex-wrap: nowrap !important; overflow-x: auto; scroll-snap-type: x mandatory; }
  .lp-testimonials-track > * { scroll-snap-align: start; flex-shrink: 0; }
}

/* Granular noise overlay */
.lp-noise::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  opacity: 0.025;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
```

- [ ] **Passo 2: Verificar compilação**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Passo 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: add lp-float, lp-ring-pulse, lp-shimmer keyframes and scroll-reveal helpers"
```

---

## Task 2: Criar CanvasBackground.tsx

**Files:**
- Create: `src/components/landing/CanvasBackground.tsx`

- [ ] **Passo 1: Criar o arquivo com o conteúdo abaixo**

```tsx
'use client'

import { useEffect, useRef } from 'react'

interface Particle { x: number; y: number; vx: number; vy: number; r: number; a: number; green: boolean }
interface Ring     { r: number; base: number; maxR: number; speed: number }
interface NNode    { x: number; y: number; vx: number; vy: number }

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const vpy = h * 0.65
  const vpx = w * 0.5
  ctx.save()
  ctx.lineWidth = 0.5
  // linhas horizontais
  for (let i = 1; i <= 14; i++) {
    const t = i / 14
    const y = vpy + (h - vpy) * (t * t)
    ctx.globalAlpha = t * 0.18
    ctx.strokeStyle = 'rgba(45,183,106,1)'
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }
  // linhas radiais do ponto de fuga
  for (let i = 0; i <= 18; i++) {
    const x = (i / 18) * w
    ctx.globalAlpha = 0.07
    ctx.strokeStyle = 'rgba(45,183,106,1)'
    ctx.beginPath(); ctx.moveTo(vpx, vpy); ctx.lineTo(x, h); ctx.stroke()
  }
  ctx.restore()
}

function drawNeural(ctx: CanvasRenderingContext2D, nodes: NNode[], w: number, h: number, dt: number) {
  nodes.forEach(n => {
    n.x += n.vx * dt; n.y += n.vy * dt
    if (n.x < 0 || n.x > w) n.vx *= -1
    if (n.y < 0 || n.y > h) n.vy *= -1
  })
  ctx.lineWidth = 0.5
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x
      const dy = nodes[i].y - nodes[j].y
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d < 200) {
        ctx.globalAlpha = (1 - d / 200) * 0.1
        ctx.strokeStyle = '#4ADE80'
        ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.stroke()
      }
    }
  }
  nodes.forEach(n => {
    ctx.globalAlpha = 0.2
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(n.x, n.y, 1.5, 0, Math.PI * 2); ctx.fill()
  })
}

function drawRings(ctx: CanvasRenderingContext2D, rings: Ring[], cx: number, cy: number, dt: number) {
  rings.forEach(ring => {
    ring.r += ring.speed * dt
    if (ring.r > ring.maxR) ring.r = ring.base
    const prog = (ring.r - ring.base) / (ring.maxR - ring.base)
    ctx.globalAlpha = (1 - prog) * 0.22
    ctx.strokeStyle = '#4ADE80'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.arc(cx, cy, ring.r, 0, Math.PI * 2); ctx.stroke()
  })
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[], w: number, h: number, dt: number) {
  particles.forEach(p => {
    p.x += p.vx * dt; p.y += p.vy * dt
    if (p.x < 0) p.x = w; if (p.x > w) p.x = 0
    if (p.y < 0) p.y = h; if (p.y > h) p.y = 0
    ctx.globalAlpha = p.a
    ctx.fillStyle = p.green ? '#4ADE80' : '#ffffff'
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
  })
}

export function CanvasBackground() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0, h = 0, raf = 0, last = 0

    const resize = () => {
      w = canvas.width  = window.innerWidth
      h = canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize, { passive: true })

    const P: Particle[] = Array.from({ length: 70 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r:  Math.random() * 1.5 + 0.4,
      a:  Math.random() * 0.4 + 0.08,
      green: Math.random() > 0.72,
    }))

    const R: Ring[] = [0, 1, 2].map(i => ({
      r:     70  + i * 80,
      base:  70  + i * 80,
      maxR:  290 + i * 60,
      speed: 0.6 + i * 0.3,
    }))

    const N: NNode[] = Array.from({ length: 15 }, () => ({
      x:  Math.random() * window.innerWidth,
      y:  Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
    }))

    const loop = (ts: number) => {
      const dt = Math.min((ts - last) / 16, 3)
      last = ts
      ctx.clearRect(0, 0, w, h)

      drawGrid(ctx, w, h)
      drawNeural(ctx, N, w, h, dt)
      drawRings(ctx, R, w * 0.5, h * 0.65, dt)
      drawParticles(ctx, P, w, h, dt)

      ctx.globalAlpha = 1
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{
        position: 'fixed', inset: 0,
        width: '100%', height: '100%',
        zIndex: -1, pointerEvents: 'none',
      }}
    />
  )
}
```

- [ ] **Passo 2: Verificar compilação**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Passo 3: Commit**

```bash
git add src/components/landing/CanvasBackground.tsx
git commit -m "feat(landing): add CanvasBackground — particles, grid, rings, neural network"
```

---

## Task 3: Extrair Navbar.tsx e DemoModal.tsx

**Files:**
- Create: `src/components/landing/Navbar.tsx`
- Create: `src/components/landing/DemoModal.tsx`

Os dois componentes são extrações puras do `LandingPage.tsx` atual, sem mudanças visuais.

- [ ] **Passo 1: Criar `src/components/landing/Navbar.tsx`**

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X, ChevronDown } from 'lucide-react'

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
```

- [ ] **Passo 2: Criar `src/components/landing/DemoModal.tsx`**

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

type DemoForm = {
  name: string; email: string; phone: string
  restaurant: string; employees: string; message: string
}

export function DemoModal({ onClose }: { onClose: () => void }) {
  const [form, setForm]       = useState<DemoForm>({ name: '', email: '', phone: '', restaurant: '', employees: '', message: '' })
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)
  const overlayRef            = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', fn)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', fn); document.body.style.overflow = '' }
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
    <div ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, overflowY: 'auto',
      }}
    >
      <div className="lp-mobile-menu" style={{
        background: '#111', border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 20, padding: '40px 36px', maxWidth: 480, width: '100%',
        position: 'relative', margin: 'auto',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 20, right: 20, background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.5)', cursor: 'pointer', transition: 'color 0.2s', padding: 4,
        }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
        ><X size={20} /></button>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(74,222,128,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: 24, color: 'var(--lp-neon)',
            }}>✓</div>
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
                { key: 'name',       label: 'Nome completo',          placeholder: 'João Silva',              type: 'text' },
                { key: 'email',      label: 'Email',                   placeholder: 'joao@restaurante.com',    type: 'email' },
                { key: 'phone',      label: 'Telefone / WhatsApp',     placeholder: '(84) 9 9999-9999',        type: 'tel' },
                { key: 'restaurant', label: 'Nome do restaurante',     placeholder: 'Sabor do Norte',          type: 'text' },
              ].map((field) => (
                <div key={field.key}>
                  <label style={{ fontFamily: 'var(--font-manrope)', fontWeight: 500, fontSize: 13, color: 'rgba(255,255,255,0.65)', display: 'block', marginBottom: 5 }}>
                    {field.label} *
                  </label>
                  <input
                    type={field.type} required
                    value={form[field.key as keyof DemoForm]}
                    onChange={(e) => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--lp-neon)')}
                    onBlur={(e)  => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
                  />
                </div>
              ))}

              <div>
                <label style={{ fontFamily: 'var(--font-manrope)', fontWeight: 500, fontSize: 13, color: 'rgba(255,255,255,0.65)', display: 'block', marginBottom: 5 }}>
                  Número de funcionários
                </label>
                <select value={form.employees}
                  onChange={(e) => setForm(prev => ({ ...prev, employees: e.target.value }))}
                  style={{ ...inputStyle, color: form.employees ? '#fff' : 'rgba(255,255,255,0.35)', cursor: 'pointer' }}
                >
                  <option value="" style={{ background: '#111' }}>Selecionar</option>
                  {['1-5','6-15','16-30','30+'].map(v => (
                    <option key={v} value={v} style={{ background: '#111' }}>
                      {v} funcionários
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontFamily: 'var(--font-manrope)', fontWeight: 500, fontSize: 13, color: 'rgba(255,255,255,0.65)', display: 'block', marginBottom: 5 }}>
                  Mensagem (opcional)
                </label>
                <textarea value={form.message}
                  onChange={(e) => setForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Conte um pouco sobre seu restaurante..."
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--lp-neon)')}
                  onBlur={(e)  => (e.target.style.borderColor = 'rgba(255,255,255,0.10)')}
                />
              </div>

              <button type="submit" disabled={loading} style={{
                marginTop: 4,
                fontFamily: 'var(--font-cabin)', fontWeight: 600, fontSize: 16,
                color: '#fff', background: 'var(--lp-btn-green)', border: 'none',
                borderRadius: 10, padding: '14px', cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1, transition: 'background 0.2s, opacity 0.2s',
                boxShadow: '0 4px 20px rgba(22,163,74,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
              }}
                onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'var(--lp-btn-green-dark)' }}
                onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = 'var(--lp-btn-green)' }}
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
```

- [ ] **Passo 3: Verificar compilação**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Passo 4: Commit**

```bash
git add src/components/landing/Navbar.tsx src/components/landing/DemoModal.tsx
git commit -m "feat(landing): extract Navbar and DemoModal into separate files"
```

---

## Task 4: Criar HeroSection.tsx

**Files:**
- Create: `src/components/landing/HeroSection.tsx`

- [ ] **Passo 1: Criar o arquivo**

```tsx
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
        width: 420, height: 420, borderRadius: '50%',
        background: 'radial-gradient(ellipse 70% 55% at 50% 65%, rgba(74,222,128,0.22), transparent 70%)',
        pointerEvents: 'none',
      }} />
      {/* anel externo */}
      <div style={{
        position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)',
        width: 340, height: 340, borderRadius: '50%',
        border: '1px solid rgba(74,222,128,0.2)',
        animation: 'lp-ring-pulse 3.5s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      {/* anel interno */}
      <div style={{
        position: 'absolute', bottom: '12%', left: '50%', transform: 'translateX(-50%)',
        width: 240, height: 240, borderRadius: '50%',
        border: '1px solid rgba(74,222,128,0.3)',
        animation: 'lp-ring-pulse 3.5s ease-in-out infinite 1.75s',
        pointerEvents: 'none',
      }} />
      {/* imagem */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mascot.png"
        alt="The Finance mascot"
        style={{
          width: 'clamp(220px, 28vw, 400px)',
          position: 'relative', zIndex: 2,
          animation: 'lp-float 5s ease-in-out infinite',
          filter: 'drop-shadow(0 0 55px rgba(74,222,128,0.5)) drop-shadow(0 20px 40px rgba(0,0,0,0.6))',
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
          fontSize: 'clamp(38px,6.5vw,82px)', lineHeight: 1.06,
          color: '#fff', letterSpacing: '-1px', maxWidth: 860, margin: 0,
        }}>
          Gerencie seu restaurante com{' '}
          <em style={{ fontStyle: 'italic', color: 'var(--lp-neon)' }}>inteligência</em>
          {' '}e controle total
        </h1>

        {/* subtitle */}
        <p className="lp-fade-up" style={{
          animationDelay: '0.4s',
          fontFamily: 'var(--font-inter)', fontWeight: 300, fontSize: 18,
          lineHeight: 1.7, color: 'rgba(255,255,255,0.58)', maxWidth: 580, margin: 0,
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
        minHeight: 340, paddingBottom: 80, zIndex: 2,
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
```

- [ ] **Passo 2: Verificar compilação**

```bash
npx tsc --noEmit
```

Esperado: sem erros. Se aparecer erro de `no-img-element`, é aviso do Next.js lint — pode ignorar por ora pois o componente usa `eslint-disable` inline.

- [ ] **Passo 3: Commit**

```bash
git add src/components/landing/HeroSection.tsx
git commit -m "feat(landing): add HeroSection — mascot, floating cards, skyline, CTAs"
```

---

## Task 5: Criar ModulesSection.tsx

**Files:**
- Create: `src/components/landing/ModulesSection.tsx`

- [ ] **Passo 1: Criar o arquivo**

```tsx
'use client'

import { useEffect, useRef } from 'react'
import { Bot, Package, ShoppingCart, ChefHat, BarChart2, Users } from 'lucide-react'

const MODULES = [
  {
    Icon: Bot,
    title: 'Agente de IA',
    description: 'Lê notas fiscais por foto e lança no estoque automaticamente. Zero digitação, máxima precisão.',
    featured: true,
  },
  {
    Icon: Package,
    title: 'Estoque Inteligente',
    description: 'Custo médio ponderado, inventário, alertas de reposição automáticos.',
    featured: false,
  },
  {
    Icon: ShoppingCart,
    title: 'Cardápio & PDV',
    description: 'Cardápio digital e ponto de venda integrados ao estoque em tempo real.',
    featured: false,
  },
  {
    Icon: ChefHat,
    title: 'Painel da Cozinha',
    description: 'KDS em tempo real. Pedidos chegam direto para a equipe — sem papel.',
    featured: false,
  },
  {
    Icon: BarChart2,
    title: 'Financeiro',
    description: 'DRE automático, CMV, relatórios do dia, semana e mês.',
    featured: false,
  },
  {
    Icon: Users,
    title: 'Multi-usuário',
    description: 'Cada função com acesso certo. Admin, caixa, cozinheiro e mais.',
    featured: false,
  },
]

export function ModulesSection() {
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const cards = el.querySelectorAll<HTMLElement>('.lp-scroll-reveal')
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          setTimeout(() => e.target.classList.add('lp-revealed'), i * 80)
          io.unobserve(e.target)
        }
      })
    }, { threshold: 0.1 })
    cards.forEach(c => io.observe(c))
    return () => io.disconnect()
  }, [])

  return (
    <section id="modulos" ref={sectionRef} style={{
      padding: '96px clamp(24px,6vw,120px)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      position: 'relative', zIndex: 1,
    }}>
      {/* heading */}
      <div className="lp-scroll-reveal" style={{ textAlign: 'center', marginBottom: 56 }}>
        <h2 style={{
          fontFamily: 'var(--font-instrument-serif)',
          fontSize: 'clamp(30px,4vw,52px)', color: '#fff', margin: '0 0 14px',
        }}>
          Tudo que seu restaurante precisa
        </h2>
        <p style={{
          fontFamily: 'var(--font-inter)', fontSize: 16,
          color: 'rgba(255,255,255,0.5)', maxWidth: 480, margin: '0 auto',
        }}>
          Módulos integrados que conversam entre si — do estoque ao financeiro, sem planilhas.
        </p>
        {/* linha decorativa */}
        <div style={{
          width: 48, height: 3, background: 'var(--lp-neon)',
          borderRadius: 999, margin: '20px auto 0',
          boxShadow: '0 0 12px rgba(74,222,128,0.6)',
        }} />
      </div>

      {/* bento grid */}
      <div className="lp-modules-bento" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 16,
        maxWidth: 1100, margin: '0 auto',
      }}>
        {MODULES.map((mod) => {
          const Icon = mod.Icon
          return (
            <div
              key={mod.title}
              className="lp-scroll-reveal"
              style={{
                gridColumn: mod.featured ? 'span 2' : undefined,
                background: 'rgba(255,255,255,0.035)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 20,
                padding: mod.featured ? '36px 32px' : '28px 24px',
                display: 'flex', flexDirection: 'column', gap: 14,
                transition: 'background 0.25s, border-color 0.25s, transform 0.25s, box-shadow 0.25s',
                cursor: 'default',
                backdropFilter: 'blur(12px)',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.background = 'rgba(74,222,128,0.06)'
                el.style.borderColor = 'rgba(74,222,128,0.35)'
                el.style.transform   = 'translateY(-4px)'
                el.style.boxShadow   = '0 12px 40px rgba(74,222,128,0.1)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement
                el.style.background  = 'rgba(255,255,255,0.035)'
                el.style.borderColor = 'rgba(255,255,255,0.07)'
                el.style.transform   = 'translateY(0)'
                el.style.boxShadow   = 'none'
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(74,222,128,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--lp-neon)', flexShrink: 0,
              }}>
                <Icon size={22} />
              </div>
              <h3 style={{
                fontFamily: 'var(--font-manrope)', fontWeight: 700,
                fontSize: mod.featured ? 20 : 16, color: '#fff', margin: 0,
              }}>{mod.title}</h3>
              <p style={{
                fontFamily: 'var(--font-inter)', fontSize: 14, lineHeight: 1.65,
                color: 'rgba(255,255,255,0.5)', margin: 0,
              }}>{mod.description}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
```

- [ ] **Passo 2: Verificar compilação**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Passo 3: Commit**

```bash
git add src/components/landing/ModulesSection.tsx
git commit -m "feat(landing): add ModulesSection — bento grid glassmorphism"
```

---

## Task 6: Criar PricingSection.tsx

**Files:**
- Create: `src/components/landing/PricingSection.tsx`

- [ ] **Passo 1: Criar o arquivo**

```tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Check, X } from 'lucide-react'

type PlanFeature = { text: string; included: boolean }
type Plan = {
  name: string; monthlyPrice: number | null; annualPrice: number | null
  priceLabel?: string; description: string; highlight: boolean; badge?: string
  features: PlanFeature[]; cta: string; href: string
}

const PLANS: Plan[] = [
  {
    name: 'Básico', monthlyPrice: 149, annualPrice: 119,
    description: 'Para começar com organização',
    highlight: false,
    features: [
      { text: 'Estoque manual',           included: true  },
      { text: 'Cardápio digital',          included: true  },
      { text: 'PDV',                       included: true  },
      { text: 'Painel da cozinha (KDS)',   included: true  },
      { text: 'Até 3 usuários',            included: true  },
      { text: 'Relatórios básicos',        included: true  },
      { text: 'Agente de IA (NF)',         included: false },
      { text: 'Relatórios avançados',      included: false },
    ],
    cta: 'Começar grátis', href: '/auth/cadastro?plano=basico',
  },
  {
    name: 'Pro', monthlyPrice: 299, annualPrice: 239,
    description: 'Para operações que crescem',
    highlight: true, badge: 'Mais popular',
    features: [
      { text: 'Estoque manual',            included: true },
      { text: 'Cardápio digital',           included: true },
      { text: 'PDV',                        included: true },
      { text: 'Painel da cozinha (KDS)',    included: true },
      { text: 'Até 10 usuários',            included: true },
      { text: 'Relatórios básicos',         included: true },
      { text: 'Agente de IA (leitura NF)', included: true },
      { text: 'Relatórios avançados',       included: true },
      { text: 'Exportação PDF e Excel',     included: true },
      { text: 'Alertas automáticos',        included: true },
    ],
    cta: 'Começar com Pro', href: '/auth/cadastro?plano=pro',
  },
  {
    name: 'Enterprise', monthlyPrice: null, annualPrice: null,
    priceLabel: 'Sob consulta',
    description: 'Para redes e multi-unidades',
    highlight: false,
    features: [
      { text: 'Tudo do Pro',         included: true },
      { text: 'Multi-unidade',       included: true },
      { text: 'API de integração',   included: true },
      { text: 'Suporte dedicado',    included: true },
      { text: 'Usuários ilimitados', included: true },
      { text: 'SLA garantido',       included: true },
    ],
    cta: 'Falar com vendas', href: '#contato',
  },
]

export function PricingSection({ onContactClick }: { onContactClick: () => void }) {
  const [annual, setAnnual]   = useState(false)
  const sectionRef            = useRef<HTMLElement>(null)

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
    <section id="planos" ref={sectionRef} style={{
      padding: '96px clamp(24px,6vw,120px)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      position: 'relative', zIndex: 1,
    }}>
      <div className="lp-scroll-reveal" style={{ textAlign: 'center', marginBottom: 52 }}>
        <h2 style={{
          fontFamily: 'var(--font-instrument-serif)',
          fontSize: 'clamp(30px,4vw,52px)', color: '#fff', margin: '0 0 12px',
        }}>Planos para cada momento do seu negócio</h2>
        <p style={{ fontFamily: 'var(--font-inter)', fontSize: 16, color: 'rgba(255,255,255,0.5)', margin: '0 0 32px' }}>
          Comece grátis. Escale quando precisar.
        </p>

        {/* toggle */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 12,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 999, padding: '6px 18px',
        }}>
          <span style={{ fontFamily: 'var(--font-manrope)', fontSize: 14, color: annual ? 'rgba(255,255,255,0.4)' : '#fff', transition: 'color 0.2s' }}>
            Mensal
          </span>
          <button onClick={() => setAnnual(!annual)} aria-label="Alternar faturamento anual" style={{
            position: 'relative', width: 44, height: 24, borderRadius: 999,
            background: annual ? 'var(--lp-btn-green)' : 'rgba(255,255,255,0.15)',
            border: 'none', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
          }}>
            <span style={{
              position: 'absolute', top: 2, left: annual ? 22 : 2,
              width: 20, height: 20, borderRadius: '50%', background: '#fff',
              transition: 'left 0.22s',
            }} />
          </button>
          <span style={{ fontFamily: 'var(--font-manrope)', fontSize: 14, color: annual ? '#fff' : 'rgba(255,255,255,0.4)', transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}>
            Anual
            <span style={{
              background: 'var(--lp-btn-green)', borderRadius: 999, padding: '1px 7px',
              fontFamily: 'var(--font-cabin)', fontWeight: 600, fontSize: 11, color: '#fff',
            }}>−20%</span>
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1060, margin: '0 auto' }}>
        {PLANS.map((plan) => (
          <div key={plan.name} className={`lp-scroll-reveal${plan.highlight ? ' lp-plan-shimmer' : ''}`} style={{
            background: plan.highlight ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.03)',
            border: `${plan.highlight ? 2 : 1}px solid ${plan.highlight ? 'rgba(74,222,128,0.55)' : 'rgba(255,255,255,0.08)'}`,
            boxShadow: plan.highlight ? '0 0 52px rgba(74,222,128,0.18)' : 'none',
            borderRadius: 22, padding: '34px 28px',
            position: 'relative', display: 'flex', flexDirection: 'column',
            flex: '1 1 265px', maxWidth: 330,
            backdropFilter: 'blur(16px)',
          }}>
            {plan.badge && (
              <div style={{
                position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
                background: 'var(--lp-btn-green)',
                boxShadow: '0 0 16px rgba(22,163,74,0.5)',
                borderRadius: 999, padding: '3px 14px', whiteSpace: 'nowrap',
                fontFamily: 'var(--font-cabin)', fontWeight: 700, fontSize: 12, color: '#fff',
              }}>{plan.badge}</div>
            )}

            <h3 style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800, fontSize: 20, color: '#fff', margin: '0 0 6px' }}>
              {plan.name}
            </h3>
            <p style={{ fontFamily: 'var(--font-inter)', fontSize: 14, color: 'rgba(255,255,255,0.45)', margin: '0 0 24px' }}>
              {plan.description}
            </p>

            <div style={{ marginBottom: 28 }}>
              {plan.priceLabel ? (
                <span style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800, fontSize: 32, color: '#fff' }}>
                  {plan.priceLabel}
                </span>
              ) : (
                <>
                  <span style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800, fontSize: 42, color: '#fff' }}>
                    R${annual ? plan.annualPrice : plan.monthlyPrice}
                  </span>
                  <span style={{ fontFamily: 'var(--font-inter)', fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>/mês</span>
                  {annual && (
                    <p style={{ fontFamily: 'var(--font-inter)', fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '4px 0 0' }}>
                      Cobrado R${(plan.annualPrice ?? 0) * 12}/ano
                    </p>
                  )}
                </>
              )}
            </div>

            <ul style={{ listStyle: 'none', margin: '0 0 32px', padding: 0, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              {plan.features.map((f) => (
                <li key={f.text} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  fontFamily: 'var(--font-inter)', fontSize: 14,
                  color: f.included ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)',
                }}>
                  {f.included
                    ? <Check size={14} style={{ color: 'var(--lp-neon)', flexShrink: 0 }} />
                    : <X     size={14} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
                  }
                  {f.text}
                </li>
              ))}
            </ul>

            {plan.name === 'Enterprise' ? (
              <button onClick={onContactClick} style={{
                display: 'block', width: '100%', textAlign: 'center',
                fontFamily: 'var(--font-cabin)', fontWeight: 600, fontSize: 15,
                color: '#fff', padding: '13px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10, cursor: 'pointer', transition: 'background 0.2s',
              }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
              >{plan.cta}</button>
            ) : (
              <Link href={plan.href} style={{
                display: 'block', textAlign: 'center', textDecoration: 'none',
                fontFamily: 'var(--font-cabin)', fontWeight: 600, fontSize: 15,
                color: '#fff', padding: '13px',
                background: plan.highlight ? 'var(--lp-btn-green)' : 'rgba(255,255,255,0.08)',
                border: plan.highlight ? 'none' : '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                boxShadow: plan.highlight ? '0 4px 22px rgba(22,163,74,0.4)' : 'none',
                transition: 'background 0.2s',
              }}
                onMouseEnter={(e) => {
                  if (plan.highlight) (e.currentTarget as HTMLElement).style.background = 'var(--lp-btn-green-dark)'
                  else                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.14)'
                }}
                onMouseLeave={(e) => {
                  if (plan.highlight) (e.currentTarget as HTMLElement).style.background = 'var(--lp-btn-green)'
                  else                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'
                }}
              >{plan.cta}</Link>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Passo 2: Verificar compilação**

```bash
npx tsc --noEmit
```

- [ ] **Passo 3: Commit**

```bash
git add src/components/landing/PricingSection.tsx
git commit -m "feat(landing): add PricingSection — shimmer Pro card, glassmorphism"
```

---

## Task 7: Criar TestimonialsSection.tsx

**Files:**
- Create: `src/components/landing/TestimonialsSection.tsx`

- [ ] **Passo 1: Criar o arquivo**

```tsx
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
```

- [ ] **Passo 2: Verificar compilação e commit**

```bash
npx tsc --noEmit
git add src/components/landing/TestimonialsSection.tsx
git commit -m "feat(landing): add TestimonialsSection — glassmorphism cards"
```

---

## Task 8: Criar CTASection.tsx e Footer.tsx

**Files:**
- Create: `src/components/landing/CTASection.tsx`
- Create: `src/components/landing/Footer.tsx`

- [ ] **Passo 1: Criar `src/components/landing/CTASection.tsx`**

```tsx
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
```

- [ ] **Passo 2: Criar `src/components/landing/Footer.tsx`**

```tsx
import Link from 'next/link'

const COLS = [
  { title: 'Produto',  links: ['Funcionalidades', 'Planos', 'Novidades', 'Roadmap'] },
  { title: 'Empresa',  links: ['Sobre', 'Blog', 'Contato', 'Trabalhe conosco'] },
  { title: 'Suporte',  links: ['Central de ajuda', 'Documentação', 'Status', 'Termos e Privacidade'] },
]

export function Footer() {
  return (
    <footer style={{
      background: '#0d0d0d',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      padding: '56px clamp(24px,6vw,120px) 32px',
      position: 'relative', zIndex: 1,
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 40, marginBottom: 48,
      }}>
        {/* brand */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--lp-btn-green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <polygon points="8,2 14,13 2,13" fill="white" />
              </svg>
            </div>
            <span style={{ fontFamily: 'var(--font-manrope)', fontWeight: 800, fontSize: 18, color: '#fff' }}>
              THE FINANCE
            </span>
          </div>
          <p style={{ fontFamily: 'var(--font-inter)', fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.4)', margin: '0 0 16px', maxWidth: 240 }}>
            Sistema de gestão completo para restaurantes e lanchonetes.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Dados protegidos', 'SSL'].map((b) => (
              <span key={b} style={{
                fontFamily: 'var(--font-cabin)', fontWeight: 500, fontSize: 11,
                color: 'rgba(255,255,255,0.35)',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 999, padding: '3px 10px',
              }}>{b}</span>
            ))}
          </div>
        </div>

        {COLS.map((col) => (
          <div key={col.title}>
            <p style={{
              fontFamily: 'var(--font-manrope)', fontWeight: 700, fontSize: 12,
              color: 'rgba(255,255,255,0.35)', margin: '0 0 16px',
              textTransform: 'uppercase', letterSpacing: '0.12em',
            }}>{col.title}</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {col.links.map((link) => (
                <li key={link}>
                  <a href="#" style={{
                    fontFamily: 'var(--font-inter)', fontSize: 14,
                    color: 'rgba(255,255,255,0.55)', textDecoration: 'none', transition: 'color 0.2s',
                  }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#fff')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)')}
                  >{link}</a>
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
        <p style={{ fontFamily: 'var(--font-inter)', fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: 0 }}>
          © 2026 THE FINANCE · Todos os direitos reservados
        </p>
        <p style={{ fontFamily: 'var(--font-inter)', fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: 0 }}>
          Feito com ♥ para restaurantes brasileiros
        </p>
      </div>
    </footer>
  )
}
```

- [ ] **Passo 3: Verificar compilação e commit**

```bash
npx tsc --noEmit
git add src/components/landing/CTASection.tsx src/components/landing/Footer.tsx
git commit -m "feat(landing): add CTASection and Footer"
```

---

## Task 9: Reescrever LandingPage.tsx como orquestrador

**Files:**
- Modify: `src/components/landing/LandingPage.tsx`

- [ ] **Passo 1: Substituir o conteúdo completo do arquivo**

```tsx
'use client'

import { useState } from 'react'
import { CanvasBackground }      from './CanvasBackground'
import { Navbar }                from './Navbar'
import { HeroSection }           from './HeroSection'
import { ModulesSection }        from './ModulesSection'
import { PricingSection }        from './PricingSection'
import { TestimonialsSection }   from './TestimonialsSection'
import { CTASection }            from './CTASection'
import { Footer }                from './Footer'
import { DemoModal }             from './DemoModal'

export function LandingPage() {
  const [demoOpen, setDemoOpen] = useState(false)

  return (
    <div className="lp-noise" style={{ background: '#0a0a0a', minHeight: '100vh', color: '#fff' }}>
      <CanvasBackground />
      <Navbar />
      <HeroSection       onDemoClick={() => setDemoOpen(true)} />
      <ModulesSection />
      <PricingSection    onContactClick={() => setDemoOpen(true)} />
      <TestimonialsSection />
      <CTASection        onDemoClick={() => setDemoOpen(true)} />
      <Footer />
      {demoOpen && <DemoModal onClose={() => setDemoOpen(false)} />}
    </div>
  )
}
```

- [ ] **Passo 2: Verificar compilação TypeScript**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Passo 3: Verificar build de produção**

```bash
npm run build
```

Esperado: build completo sem erros. Warnings de `no-img-element` em `HeroSection` são aceitáveis (o mascote usa `<img>` explicitamente com o comentário `eslint-disable`).

- [ ] **Passo 4: Commit final**

```bash
git add src/components/landing/LandingPage.tsx
git commit -m "feat(landing): assemble full landing page overhaul — multi-file split complete"
```

---

## Task 10: Adicionar mascote ao public/

**Files:**
- Create: `public/mascot.png`

- [ ] **Passo 1: Copiar manualmente o arquivo**

Copie a imagem do mascote (pose: dedo apontando para cima) para `public/mascot.png` na raiz do projeto.

- [ ] **Passo 2: Verificar renderização no browser**

```bash
npm run dev
```

Abrir `http://localhost:3000`. Verificar:
- [ ] Mascote aparece centralizado no hero
- [ ] Animação de flutuação ativa
- [ ] Glow verde visível
- [ ] Dois anéis pulsando ao redor
- [ ] Cards flutuantes nas laterais (desktop)
- [ ] Canvas com partículas, grid e anéis de energia visíveis no fundo
- [ ] Stats strip no rodapé do hero
- [ ] Skyline de cidade visível na base do hero
- [ ] Scroll-reveal funcionando nas seções abaixo
- [ ] Cards da seção de módulos com hover verde
- [ ] Shimmer no card Pro dos planos
- [ ] Modal de demo abre e fecha corretamente

- [ ] **Passo 3: Commit do mascote**

```bash
git add public/mascot.png
git commit -m "assets: add mascot PNG to public/"
```

---

## Checklist de auto-review do plano

### Cobertura do spec

| Requisito do spec | Tarefa |
|---|---|
| CanvasBackground com partículas, grid, anéis, rede neural | Task 2 |
| Navbar extraída | Task 3 |
| DemoModal extraída | Task 3 |
| HeroSection com mascote, cards flutuantes, skyline, CTAs, stats | Task 4 |
| ModulesSection bento grid glassmorphism | Task 5 |
| PricingSection com shimmer no Pro | Task 6 |
| TestimonialsSection glassmorphism + mobile scroll | Task 7 |
| CTASection cinematic | Task 8 |
| Footer dark | Task 8 |
| LandingPage orquestrador | Task 9 |
| `lp-float`, `lp-ring-pulse`, `lp-shimmer`, `lp-scroll-reveal` | Task 1 |
| Responsividade (cards ocultos < 768px, grid 1 coluna) | Task 1 (CSS) + Task 4 (cards) |
| `prefers-reduced-motion` | Task 2 (canvas desativa) |
| Mascote em `public/mascot.png` | Task 10 |

### Consistência de tipos

- `Plan` e `PlanFeature` definidos localmente em `PricingSection.tsx` — usado apenas lá ✓
- `DemoForm` definido localmente em `DemoModal.tsx` ✓
- Interfaces `Particle`, `Ring`, `NNode` locais em `CanvasBackground.tsx` ✓
- `drawGrid`, `drawNeural`, `drawRings`, `drawParticles` todas definidas na Task 2 antes de serem chamadas ✓

### Sem placeholders

Todas as tarefas contêm código completo e comandos exatos. ✓
