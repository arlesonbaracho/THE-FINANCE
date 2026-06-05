'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

interface MetricaItem {
  tipo: string
  log: { valor: number; status: string; registradoEm: string } | null
}
interface Alerta {
  id: string
  tipo: string
  titulo: string
  severidade: string
  criadoEm: string
}
interface HistoricoItem { valor: number; status: string; registradoEm: string }

const STATUS_COLOR: Record<string, string> = {
  OK: '#10b981',
  ALERTA: '#f59e0b',
  CRITICO: '#ef4444',
}

export function SaudeClient() {
  const [metricas, setMetricas] = useState<MetricaItem[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [historico, setHistorico] = useState<HistoricoItem[]>([])

  async function carregar() {
    const [m, h] = await Promise.all([
      fetch('/api/admin/saude/metricas').then((r) => r.json()),
      fetch('/api/admin/saude/historico?horas=24').then((r) => r.json()),
    ])
    setMetricas(m.metricas ?? [])
    setAlertas(m.alertas ?? [])
    setHistorico(Array.isArray(h) ? h : [])
  }

  useEffect(() => { carregar() }, [])

  async function resolverAlerta(id: string) {
    await fetch(`/api/admin/saude/alertas/${id}`, { method: 'PATCH' })
    setAlertas((prev) => prev.filter((a) => a.id !== id))
  }

  const card: React.CSSProperties = {
    background: 'var(--tf-surface)',
    border: '1px solid var(--tf-border)',
    borderRadius: 12,
    padding: 20,
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 24, marginTop: 0 }}>
        Saúde da Plataforma
      </h1>

      {/* Cards de status */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {metricas.map(({ tipo, log }) => (
          <div
            key={tipo}
            style={{
              ...card,
              borderTop: `3px solid ${STATUS_COLOR[log?.status ?? 'OK']}`,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tf-txt3)', marginBottom: 8 }}>
              {tipo}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--tf-txt)' }}>
              {log ? Number(log.valor).toFixed(1) : '—'}
            </div>
            <div
              style={{
                display: 'inline-block',
                marginTop: 4,
                fontSize: 10,
                fontWeight: 600,
                color: '#fff',
                background: STATUS_COLOR[log?.status ?? 'OK'],
                borderRadius: 4,
                padding: '1px 6px',
              }}
            >
              {log?.status ?? 'SEM DADOS'}
            </div>
          </div>
        ))}
      </div>

      {/* Gráfico de latência */}
      <div style={{ ...card, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 16, marginTop: 0 }}>
          Latência das últimas 24h (ms)
        </h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={historico.map((h) => ({ ...h, valor: Number(h.valor) }))}>
            <XAxis
              dataKey="registradoEm"
              tickFormatter={(v) =>
                new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              }
              tick={{ fontSize: 10, fill: 'var(--tf-txt3)' }}
            />
            <YAxis tick={{ fontSize: 10, fill: 'var(--tf-txt3)' }} />
            <Tooltip
              contentStyle={{
                background: 'var(--tf-surface)',
                border: '1px solid var(--tf-border)',
                borderRadius: 8,
              }}
              labelFormatter={(v) => new Date(v).toLocaleString('pt-BR')}
            />
            <ReferenceLine
              y={2000}
              stroke="#ef4444"
              strokeDasharray="4 4"
              label={{ value: '2000ms', fill: '#ef4444', fontSize: 10 }}
            />
            <Line
              type="monotone"
              dataKey="valor"
              stroke="var(--tf-primary, #6366f1)"
              dot={false}
              strokeWidth={1.5}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Alertas ativos */}
      {alertas.length > 0 && (
        <div style={{ ...card, marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 12, marginTop: 0 }}>
            Alertas Ativos
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Tipo', 'Título', 'Severidade', 'Horário', 'Ação'].map((col) => (
                  <th
                    key={col}
                    style={{
                      textAlign: 'left',
                      padding: '8px 12px',
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
              {alertas.map((a) => (
                <tr key={a.id}>
                  <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>
                    {a.tipo}
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--tf-txt)', borderBottom: '1px solid var(--tf-border)' }}>
                    {a.titulo}
                  </td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--tf-border)' }}>
                    <span
                      style={{
                        fontSize: 11,
                        background: STATUS_COLOR[a.severidade] ?? '#6b7280',
                        color: '#fff',
                        borderRadius: 4,
                        padding: '2px 8px',
                      }}
                    >
                      {a.severidade}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--tf-txt3)', borderBottom: '1px solid var(--tf-border)' }}>
                    {new Date(a.criadoEm).toLocaleString('pt-BR')}
                  </td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--tf-border)' }}>
                    <button
                      onClick={() => resolverAlerta(a.id)}
                      style={{
                        fontSize: 11,
                        padding: '3px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--tf-border)',
                        background: 'transparent',
                        color: 'var(--tf-txt)',
                        cursor: 'pointer',
                      }}
                    >
                      Resolver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {metricas.length === 0 && (
        <div style={{ ...card, textAlign: 'center', color: 'var(--tf-txt3)', fontSize: 13 }}>
          Nenhuma métrica coletada ainda. Inicie o worker BullMQ para começar a monitorar.
        </div>
      )}
    </div>
  )
}
