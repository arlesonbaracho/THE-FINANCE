'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface AiUsage {
  tenantId: string
  tokensInput: number
  tokensOutput: number
  custoEstimado: number
  limiteTokens: number
  tenant: { name: string; subscription: { plan: { name: string } } | null }
}

export function UsoIaClient() {
  const [usages, setUsages] = useState<AiUsage[]>([])
  const [modalTenant, setModalTenant] = useState<string | null>(null)
  const [novoLimite, setNovoLimite] = useState('')

  async function carregar() {
    const d = await fetch('/api/admin/uso-ia').then((r) => r.json())
    setUsages(Array.isArray(d) ? d : [])
  }

  useEffect(() => { carregar() }, [])

  async function salvarLimite() {
    if (!modalTenant) return
    await fetch(`/api/admin/uso-ia/${modalTenant}/limite`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limiteTokens: parseInt(novoLimite, 10) }),
    })
    setModalTenant(null)
    carregar()
  }

  async function resetarContador(tenantId: string) {
    if (!confirm('Resetar contador de tokens deste tenant?')) return
    await fetch(`/api/admin/uso-ia/${tenantId}/limite`, { method: 'POST' })
    carregar()
  }

  const totalHoje = usages.reduce((s, u) => s + u.tokensInput + u.tokensOutput, 0)
  const custoMes = usages.reduce((s, u) => s + Number(u.custoEstimado), 0)
  const acima = usages.filter(
    (u) => u.limiteTokens > 0 && u.tokensInput + u.tokensOutput >= u.limiteTokens
  ).length
  const proximo = usages.filter((u) => {
    if (u.limiteTokens === 0) return false
    const pct = (u.tokensInput + u.tokensOutput) / u.limiteTokens
    return pct >= 0.8 && pct < 1
  }).length

  const top10 = [...usages]
    .sort((a, b) => b.tokensInput + b.tokensOutput - (a.tokensInput + a.tokensOutput))
    .slice(0, 10)
    .map((u) => ({ name: u.tenant.name.slice(0, 14), tokens: u.tokensInput + u.tokensOutput }))

  const card: React.CSSProperties = {
    background: 'var(--tf-surface)',
    border: '1px solid var(--tf-border)',
    borderRadius: 12,
    padding: 20,
  }
  const th: React.CSSProperties = {
    textAlign: 'left',
    padding: '10px 14px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--tf-txt3)',
    borderBottom: '1px solid var(--tf-border)',
  }
  const td: React.CSSProperties = {
    padding: '10px 14px',
    fontSize: 13,
    color: 'var(--tf-txt)',
    borderBottom: '1px solid var(--tf-border)',
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 24, marginTop: 0 }}>
        Uso de IA
      </h1>

      {/* Cards resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Tokens (plataforma)', valor: totalHoje.toLocaleString('pt-BR') },
          { label: 'Custo estimado (mês)', valor: `R$ ${custoMes.toFixed(2)}` },
          { label: 'Acima do limite', valor: String(acima) },
          { label: 'Próximos do limite', valor: String(proximo) },
        ].map((c) => (
          <div key={c.label} style={card}>
            <div style={{ fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--tf-txt)' }}>{c.valor}</div>
          </div>
        ))}
      </div>

      {/* Gráfico top 10 */}
      <div style={{ ...card, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 12, marginTop: 0 }}>
          Top 10 tenants por consumo
        </h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={top10}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--tf-txt3)' }} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--tf-txt3)' }} />
            <Tooltip
              contentStyle={{
                background: 'var(--tf-surface)',
                border: '1px solid var(--tf-border)',
                borderRadius: 8,
              }}
            />
            <Bar dataKey="tokens" fill="var(--tf-primary, #6366f1)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela completa */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Tenant', 'Plano', 'Input', 'Output', 'Custo R$', 'Limite', '% usado', 'Ações'].map(
                (col) => <th key={col} style={th}>{col}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {usages.map((u) => {
              const total = u.tokensInput + u.tokensOutput
              const pct = u.limiteTokens > 0 ? Math.round((total / u.limiteTokens) * 100) : null
              const isAcima = pct !== null && pct >= 100
              const isProximo = pct !== null && pct >= 80 && !isAcima
              return (
                <tr key={u.tenantId}>
                  <td style={td}>{u.tenant.name}</td>
                  <td style={{ ...td, color: 'var(--tf-txt3)', fontSize: 12 }}>
                    {u.tenant.subscription?.plan.name ?? '—'}
                  </td>
                  <td style={td}>{u.tokensInput.toLocaleString('pt-BR')}</td>
                  <td style={td}>{u.tokensOutput.toLocaleString('pt-BR')}</td>
                  <td style={td}>R$ {Number(u.custoEstimado).toFixed(4)}</td>
                  <td style={td}>{u.limiteTokens === 0 ? '∞' : u.limiteTokens.toLocaleString('pt-BR')}</td>
                  <td style={td}>
                    {pct !== null ? (
                      <span
                        style={{
                          fontSize: 11,
                          background: isAcima ? '#ef4444' : isProximo ? '#f59e0b' : '#10b981',
                          color: '#fff',
                          borderRadius: 4,
                          padding: '2px 8px',
                        }}
                      >
                        {pct}%
                      </span>
                    ) : '—'}
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => { setModalTenant(u.tenantId); setNovoLimite(String(u.limiteTokens)) }}
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 6,
                          border: '1px solid var(--tf-border)',
                          background: 'transparent',
                          color: 'var(--tf-txt)',
                          cursor: 'pointer',
                        }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => resetarContador(u.tenantId)}
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 6,
                          border: '1px solid #ef4444',
                          background: 'transparent',
                          color: '#ef4444',
                          cursor: 'pointer',
                        }}
                      >
                        Resetar
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal editar limite */}
      {modalTenant && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: 'var(--tf-surface)',
              borderRadius: 12,
              padding: 32,
              minWidth: 320,
              border: '1px solid var(--tf-border)',
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, marginTop: 0, color: 'var(--tf-txt)' }}>
              Editar limite de tokens
            </h2>
            <label style={{ fontSize: 12, color: 'var(--tf-txt3)', display: 'block', marginBottom: 4 }}>
              Limite (0 = ilimitado)
            </label>
            <input
              type="number"
              value={novoLimite}
              onChange={(e) => setNovoLimite(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--tf-border)',
                background: 'transparent',
                color: 'var(--tf-txt)',
                fontSize: 13,
                marginBottom: 20,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setModalTenant(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--tf-border)',
                  background: 'transparent',
                  color: 'var(--tf-txt)',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={salvarLimite}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  background: 'var(--tf-primary, #6366f1)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
