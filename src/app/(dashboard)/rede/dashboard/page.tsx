'use client'

import { useEffect, useState } from 'react'
import { KpiCard } from '@/components/multi-unit/KpiCard'
import { NetworkBarChart } from '@/components/multi-unit/NetworkBarChart'
import { NetworkMap } from '@/components/multi-unit/NetworkMap'
import { DollarSign, ShoppingBag, TrendingUp, BarChart2 } from 'lucide-react'
import type { KpisConsolidados } from '@/services/multi-unit/types'

const DIAS_OPTIONS = [7, 15, 30, 90]

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function RedeDashboardPage() {
  const [dias, setDias] = useState(30)
  const [kpis, setKpis] = useState<KpisConsolidados | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/rede/dashboard?days=${dias}`)
      .then((r) => r.json())
      .then((d: KpisConsolidados) => { setKpis(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [dias])

  const btnBase: React.CSSProperties = {
    padding: '4px 12px',
    borderRadius: 6,
    border: '1px solid var(--tf-border)',
    fontSize: 12,
    cursor: 'pointer',
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1400 }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', margin: 0 }}>
          Dashboard da Rede
        </h1>
        <div style={{ display: 'flex', gap: 6 }}>
          {DIAS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDias(d)}
              style={{
                ...btnBase,
                background: dias === d ? 'var(--tf-primary, #6366f1)' : 'transparent',
                color: dias === d ? '#fff' : 'var(--tf-txt)',
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <p style={{ color: 'var(--tf-txt3)', fontSize: 13 }}>Carregando métricas da rede...</p>
      )}

      {!loading && kpis && (
        <>
          {/* KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <KpiCard
              titulo="Vendas Totais"
              valor={formatCurrency(kpis.totalVendas)}
              variacao={kpis.variacaoVendas}
              icone={<DollarSign className="w-4 h-4" style={{ color: 'var(--tf-primary, #6366f1)' }} />}
            />
            <KpiCard
              titulo="Total de Pedidos"
              valor={kpis.totalPedidos.toLocaleString('pt-BR')}
              variacao={kpis.variacaoPedidos}
              icone={<ShoppingBag className="w-4 h-4" style={{ color: '#6366f1' }} />}
            />
            <KpiCard
              titulo="Ticket Médio"
              valor={formatCurrency(kpis.ticketMedio)}
              icone={<TrendingUp className="w-4 h-4" style={{ color: '#10b981' }} />}
            />
            <KpiCard
              titulo="CMV Médio"
              valor={`${kpis.cmvMedio.toFixed(1)}%`}
              icone={<BarChart2 className="w-4 h-4" style={{ color: '#f59e0b' }} />}
            />
          </div>

          {/* Destaques */}
          {(kpis.melhorUnidade || kpis.unidadeAlerta) && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: kpis.melhorUnidade && kpis.unidadeAlerta ? '1fr 1fr' : '1fr',
                gap: 16,
                marginBottom: 24,
              }}
            >
              {kpis.melhorUnidade && (
                <div
                  style={{
                    padding: 20,
                    borderRadius: 12,
                    border: '1px solid #10b981',
                    background: 'var(--tf-surface)',
                  }}
                >
                  <div style={{ fontSize: 11, color: '#10b981', fontWeight: 600, marginBottom: 4 }}>
                    ✦ MELHOR UNIDADE
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tf-txt)' }}>
                    {kpis.melhorUnidade.tenantName}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--tf-txt3)', marginTop: 4 }}>
                    {formatCurrency(kpis.melhorUnidade.totalVendas)}
                  </div>
                </div>
              )}
              {kpis.unidadeAlerta && (
                <div
                  style={{
                    padding: 20,
                    borderRadius: 12,
                    border: '1px solid #f59e0b',
                    background: 'var(--tf-surface)',
                  }}
                >
                  <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, marginBottom: 4 }}>
                    ⚠ ATENÇÃO
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tf-txt)' }}>
                    {kpis.unidadeAlerta.tenantName}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--tf-txt3)', marginTop: 4 }}>
                    {formatCurrency(kpis.unidadeAlerta.totalVendas)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tabela comparativa */}
          <div
            style={{
              background: 'var(--tf-surface)',
              border: '1px solid var(--tf-border)',
              borderRadius: 12,
              overflow: 'hidden',
              marginBottom: 24,
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Unidade', 'Vendas', 'Pedidos', 'Ticket Médio', 'CMV %', 'Alertas'].map((col) => (
                    <th
                      key={col}
                      style={{
                        textAlign: 'left',
                        padding: '10px 14px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--tf-txt3)',
                        borderBottom: '1px solid var(--tf-border)',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {kpis.porUnidade.map((u) => (
                  <tr
                    key={u.tenantId}
                    style={{ cursor: 'pointer' }}
                    onClick={async () => {
                      await fetch('/api/rede/switch-unit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tenantId: u.tenantId }),
                      })
                      window.location.href = '/dashboard'
                    }}
                  >
                    {[
                      u.tenantName,
                      formatCurrency(u.totalVendas),
                      u.totalPedidos.toString(),
                      formatCurrency(u.ticketMedio),
                      `${u.cmvPercentual.toFixed(1)}%`,
                    ].map((val, i) => (
                      <td
                        key={i}
                        style={{
                          padding: '10px 14px',
                          fontSize: 13,
                          color: 'var(--tf-txt)',
                          borderBottom: '1px solid var(--tf-border)',
                        }}
                      >
                        {val}
                      </td>
                    ))}
                    <td style={{ padding: '10px 14px', borderBottom: '1px solid var(--tf-border)' }}>
                      {u.alertasAtivos > 0 && (
                        <span
                          style={{
                            background: '#ef4444',
                            color: '#fff',
                            borderRadius: 4,
                            padding: '2px 8px',
                            fontSize: 11,
                          }}
                        >
                          {u.alertasAtivos}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Gráfico */}
          <div style={{ marginBottom: 24 }}>
            <NetworkBarChart unidades={kpis.porUnidade} />
          </div>

          {/* Mapa */}
          <NetworkMap
            marcadores={[]}
            apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''}
          />
        </>
      )}

      {!loading && !kpis && (
        <p style={{ color: 'var(--tf-txt3)', fontSize: 13 }}>
          Erro ao carregar dados. Verifique que este tenant pertence a uma rede.
        </p>
      )}
    </div>
  )
}
