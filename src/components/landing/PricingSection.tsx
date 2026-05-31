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
  const [annual, setAnnual] = useState(false)
  const sectionRef          = useRef<HTMLElement>(null)

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
