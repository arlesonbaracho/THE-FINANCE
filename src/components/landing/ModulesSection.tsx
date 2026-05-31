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
