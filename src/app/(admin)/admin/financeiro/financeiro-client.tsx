'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'

type Tab = 'mrr' | 'metricas' | 'cohort' | 'projecao'

interface MRRSnapshot { data: string; mrr: number }
interface Metricas { churn: { churnRate: number }; ltv: number; nrr: number; cac: number | null }
interface CohortRow { cohort: string; retencao: number[] }
interface ProjecaoItem { mes: string; mrr: number; mrrMin: number; mrrMax: number }

function corRetencao(v: number) {
  if (v >= 90) return '#166534'
  if (v >= 70) return '#16a34a'
  if (v >= 50) return '#f59e0b'
  return '#ef4444'
}

export function FinanceiroClient() {
  const [tab, setTab] = useState<Tab>('mrr')
  const [mrr, setMrr] = useState<{ atual: { total: number; porPlano: Record<string, number> }; historico: MRRSnapshot[] } | null>(null)
  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [cohort, setCohort] = useState<CohortRow[]>([])
  const [projecao, setProjecao] = useState<ProjecaoItem[]>([])
  const [cacInput, setCacInput] = useState('')

  useEffect(() => {
    if (tab === 'mrr' && !mrr) {
      fetch('/api/admin/financeiro/mrr').then((r) => r.json()).then(setMrr)
    }
    if (tab === 'metricas' && !metricas) {
      fetch('/api/admin/financeiro/metricas').then((r) => r.json()).then(setMetricas)
    }
    if (tab === 'cohort' && cohort.length === 0) {
      fetch('/api/admin/financeiro/cohort').then((r) => r.json()).then((d) => setCohort(Array.isArray(d) ? d : []))
    }
    if (tab === 'projecao' && projecao.length === 0) {
      fetch('/api/admin/financeiro/projecao').then((r) => r.json()).then((d) => setProjecao(Array.isArray(d) ? d : []))
    }
  }, [tab])

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px',
    borderRadius: '8px 8px 0 0',
    border: '1px solid var(--tf-border)',
    borderBottom: active ? '1px solid var(--tf-surface)' : '1px solid var(--tf-border)',
    background: active ? 'var(--tf-surface)' : 'transparent',
    color: active ? 'var(--tf-txt)' : 'var(--tf-txt3)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    marginBottom: -1,
  })

  const card: React.CSSProperties = {
    background: 'var(--tf-surface)',
    border: '1px solid var(--tf-border)',
    borderRadius: 12,
    padding: 20,
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 8, marginTop: 0 }}>
        Financeiro SaaS
      </h1>

      <div style={{ display: 'flex', gap: 0, marginBottom: 0 }}>
        {(['mrr', 'metricas', 'cohort', 'projecao'] as Tab[]).map((t) => (
          <button key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>
            {{ mrr: 'MRR', metricas: 'Métricas', cohort: 'Cohort', projecao: 'Projeção' }[t]}
          </button>
        ))}
      </div>

      <div
        style={{
          ...card,
          borderRadius: '0 8px 8px 8px',
        }}
      >
        {/* ── MRR ── */}
        {tab === 'mrr' && mrr && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              <div style={card}>
                <div style={{ fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 4 }}>MRR Total</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--tf-txt)' }}>
                  R$ {mrr.atual.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div style={card}>
                <div style={{ fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 4 }}>ARR Projetado</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--tf-txt)' }}>
                  R$ {(mrr.atual.total * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div style={card}>
                <div style={{ fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 4 }}>Por plano</div>
                {Object.entries(mrr.atual.porPlano).map(([id, v]) => (
                  <div key={id} style={{ fontSize: 13, color: 'var(--tf-txt)' }}>
                    {id.slice(0, 8)}: R$ {Number(v).toFixed(2)}
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={mrr.historico.map((h) => ({ ...h, mrr: Number(h.mrr) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--tf-border)" />
                <XAxis
                  dataKey="data"
                  tickFormatter={(v) => String(v).slice(0, 7)}
                  tick={{ fontSize: 11, fill: 'var(--tf-txt3)' }}
                />
                <YAxis tick={{ fontSize: 11, fill: 'var(--tf-txt3)' }} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--tf-surface)',
                    border: '1px solid var(--tf-border)',
                    borderRadius: 8,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="mrr"
                  stroke="var(--tf-primary, #6366f1)"
                  fill="var(--tf-primary, #6366f1)"
                  fillOpacity={0.15}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Métricas ── */}
        {tab === 'metricas' && metricas && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Churn Rate', valor: `${metricas.churn.churnRate.toFixed(1)}%` },
                { label: 'LTV Médio', valor: `R$ ${metricas.ltv.toFixed(2)}` },
                { label: 'NRR', valor: `${metricas.nrr.toFixed(1)}%` },
                { label: 'CAC', valor: metricas.cac ? `R$ ${metricas.cac}` : 'Não definido' },
              ].map((c) => (
                <div key={c.label} style={card}>
                  <div style={{ fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--tf-txt)' }}>{c.valor}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <input
                placeholder="Novo CAC (R$)"
                value={cacInput}
                onChange={(e) => setCacInput(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--tf-border)',
                  background: 'transparent',
                  color: 'var(--tf-txt)',
                  fontSize: 13,
                }}
              />
              <button
                onClick={async () => {
                  const agora = new Date()
                  await fetch('/api/admin/financeiro/metricas', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      mes: agora.getMonth() + 1,
                      ano: agora.getFullYear(),
                      cac: parseFloat(cacInput),
                    }),
                  })
                  fetch('/api/admin/financeiro/metricas').then((r) => r.json()).then(setMetricas)
                  setCacInput('')
                }}
                style={{
                  padding: '6px 16px',
                  borderRadius: 6,
                  background: 'var(--tf-primary, #6366f1)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Salvar CAC
              </button>
            </div>
          </div>
        )}

        {/* ── Cohort ── */}
        {tab === 'cohort' && (
          <div style={{ overflowX: 'auto' }}>
            {cohort.length === 0 ? (
              <p style={{ color: 'var(--tf-txt3)', fontSize: 13 }}>
                Sem dados de cohort ainda (requer pelo menos 1 mês de dados).
              </p>
            ) : (
              <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th
                      style={{
                        padding: '8px 12px',
                        color: 'var(--tf-txt3)',
                        fontWeight: 600,
                        borderBottom: '1px solid var(--tf-border)',
                        textAlign: 'left',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Cohort
                    </th>
                    {cohort[0]?.retencao.map((_, i) => (
                      <th
                        key={i}
                        style={{
                          padding: '8px 12px',
                          color: 'var(--tf-txt3)',
                          fontWeight: 600,
                          borderBottom: '1px solid var(--tf-border)',
                          textAlign: 'center',
                        }}
                      >
                        M{i}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohort.map((row) => (
                    <tr key={row.cohort}>
                      <td
                        style={{
                          padding: '8px 12px',
                          fontWeight: 600,
                          color: 'var(--tf-txt)',
                          borderBottom: '1px solid var(--tf-border)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.cohort}
                      </td>
                      {row.retencao.map((v, i) => (
                        <td
                          key={i}
                          title={`${row.cohort} — M${i}: ${v}%`}
                          style={{
                            padding: '8px 12px',
                            textAlign: 'center',
                            background: corRetencao(v),
                            color: '#fff',
                            fontWeight: 600,
                            borderBottom: '1px solid rgba(0,0,0,0.1)',
                          }}
                        >
                          {v}%
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Projeção ── */}
        {tab === 'projecao' && (
          <div>
            {projecao.length === 0 ? (
              <p style={{ color: 'var(--tf-txt3)', fontSize: 13 }}>
                Sem dados de snapshots suficientes para projeção (mínimo 2 meses).
              </p>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
                  {projecao.map((p, i) => (
                    <div key={p.mes} style={card}>
                      <div style={{ fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 4 }}>
                        Mês {i + 1} ({p.mes})
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--tf-txt)' }}>
                        R$ {p.mrr.toLocaleString('pt-BR')}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--tf-txt3)', marginTop: 4 }}>
                        R$ {p.mrrMin.toLocaleString('pt-BR')} – R$ {p.mrrMax.toLocaleString('pt-BR')}
                      </div>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={projecao}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--tf-border)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--tf-txt3)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--tf-txt3)' }} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--tf-surface)',
                        border: '1px solid var(--tf-border)',
                        borderRadius: 8,
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="mrr"
                      stroke="var(--tf-primary, #6366f1)"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      name="Projeção"
                    />
                    <Line
                      type="monotone"
                      dataKey="mrrMin"
                      stroke="#6b7280"
                      strokeWidth={1}
                      strokeDasharray="2 4"
                      name="Mínimo"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="mrrMax"
                      stroke="#6b7280"
                      strokeWidth={1}
                      strokeDasharray="2 4"
                      name="Máximo"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <p style={{ fontSize: 11, color: 'var(--tf-txt3)', marginTop: 12 }}>
                  * Projeção baseada na taxa de crescimento média dos últimos snapshots mensais.
                  Intervalo de confiança: ±15%.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
