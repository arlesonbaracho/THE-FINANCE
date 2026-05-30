'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, BarChart3, Package, DollarSign, ChefHat, TrendingUp, ShoppingCart, Users, GitCompare, RotateCcw, Activity } from 'lucide-react'

export type ReportId =
  | 'overview'
  | 'products'
  | 'operators'
  | 'comparison'
  | 'stock-turnover'
  | 'abc-curve'
  | 'cmv'
  | 'kitchen'

type SectionItem = { id: ReportId; label: string; icon: React.ElementType }
type Section = { id: string; label: string; icon: React.ElementType; items: SectionItem[] }

const sections: Section[] = [
  {
    id: 'vendas',
    label: 'Vendas',
    icon: BarChart3,
    items: [
      { id: 'overview', label: 'Visão Geral', icon: TrendingUp },
      { id: 'products', label: 'Por Produto', icon: ShoppingCart },
      { id: 'operators', label: 'Por Operador', icon: Users },
      { id: 'comparison', label: 'Comparativo', icon: GitCompare },
    ],
  },
  {
    id: 'estoque',
    label: 'Estoque',
    icon: Package,
    items: [
      { id: 'stock-turnover', label: 'Giro de Estoque', icon: RotateCcw },
      { id: 'abc-curve', label: 'Curva ABC', icon: Activity },
    ],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    icon: DollarSign,
    items: [{ id: 'cmv', label: 'CMV Detalhado', icon: DollarSign }],
  },
  {
    id: 'operacional',
    label: 'Operacional',
    icon: ChefHat,
    items: [{ id: 'kitchen', label: 'Desempenho da Cozinha', icon: ChefHat }],
  },
]

type Props = {
  active: ReportId
  onSelect: (id: ReportId) => void
}

export function ReportSidebar({ active, onSelect }: Props) {
  const [open, setOpen] = useState<string[]>(['vendas', 'estoque', 'financeiro', 'operacional'])

  function toggle(id: string) {
    setOpen((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <aside
      style={{
        width: 220,
        minWidth: 220,
        background: 'var(--tf-surface)',
        borderRight: '1px solid var(--tf-border)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      <div style={{ padding: '14px 12px 8px', borderBottom: '1px solid var(--tf-border)' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-txt3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Relatórios
        </p>
      </div>

      <nav style={{ flex: 1, padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sections.map((section) => {
          const isOpen = open.includes(section.id)
          const sectionActive = section.items.some((i) => i.id === active)
          return (
            <div key={section.id}>
              <button
                onClick={() => toggle(section.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                  color: sectionActive ? 'var(--tf-txt)' : 'var(--tf-txt2)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <section.icon size={13} />
                  {section.label}
                </div>
                {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </button>

              {isOpen && (
                <div style={{ marginLeft: 12, paddingLeft: 8, borderLeft: '1px solid var(--tf-border)', marginTop: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {section.items.map((item) => {
                    const isActive = item.id === active
                    return (
                      <button
                        key={item.id}
                        onClick={() => onSelect(item.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          padding: '6px 8px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? 'var(--tf-primary)' : 'var(--tf-txt2)',
                          background: isActive ? 'var(--tf-primary-bg)' : 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          width: '100%',
                          textAlign: 'left',
                          transition: 'background 120ms, color 120ms',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'var(--tf-surface2)'
                            e.currentTarget.style.color = 'var(--tf-txt)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = 'var(--tf-txt2)'
                          }
                        }}
                      >
                        <item.icon size={12} />
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
