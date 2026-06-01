'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const ALLOWED_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'MANAGER'])
const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtPct = (v: number) => `${v.toFixed(1)}%`

type Metricas = {
  totalPedidos: number
  receitaBruta: number
  comissao: number
  receitaLiquida: number
  ticketMedio: number
  taxaRejeicao: number
}

type CanalItem = { origem: string; _count: { id: number }; _sum: { total: number | null } }
type Produto5 = { name: string; qty: number; receita: number }
type WebhookLog = { ifoodOrderId: string; status: string; erro?: string | null; createdAt: string }

type ReportData = {
  metricas: Metricas
  canalDistribuicao: CanalItem[]
  top5Produtos: Produto5[]
  webhookLogs: WebhookLog[]
}

const CANAL_COLORS: Record<string, string> = { IFOOD: '#f97316', MESA: '#2a9d6f', BALCAO: '#6366f1' }
const CANAL_LABELS: Record<string, string> = { IFOOD: 'iFood', MESA: 'Mesa', BALCAO: 'Balcão' }

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, minWidth: 140, padding: '16px 18px', borderRadius: 10, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--tf-txt3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--tf-txt)' }}>{value}</p>
    </div>
  )
}

export default function DeliveryReportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [start, setStart] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0] })
  const [end, setEnd] = useState(() => new Date().toISOString().split('T')[0])
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user?.role || !ALLOWED_ROLES.has(session.user.role)) router.replace('/dashboard')
  }, [session, status, router])

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/relatorios/delivery?start=${start}&end=${end}`)
      .then((r) => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [start, end])

  useEffect(() => { load() }, [load])

  const pieData = (data?.canalDistribuicao ?? []).map((c) => ({
    name: CANAL_LABELS[c.origem] ?? c.origem,
    value: c._count.id,
    color: CANAL_COLORS[c.origem] ?? '#888',
  }))

  return (
    <div style={{ padding: '24px 32px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 4 }}>Relatório de Delivery</h1>
      <p style={{ fontSize: 13, color: 'var(--tf-txt3)', marginBottom: 24 }}>Desempenho dos pedidos recebidos via iFood.</p>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 28, flexWrap: 'wrap' }}>
        {[{ label: 'Início', value: start, set: setStart }, { label: 'Fim', value: end, set: setEnd }].map(({ label, value, set }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--tf-txt2)', fontWeight: 600 }}>{label}</label>
            <input type="date" value={value} onChange={(e) => set(e.target.value)} style={{ padding: '7px 10px', borderRadius: 7, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)', color: 'var(--tf-txt)', fontSize: 13 }} />
          </div>
        ))}
        <button onClick={load} style={{ padding: '7px 18px', borderRadius: 7, border: 'none', background: 'var(--tf-primary)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          {loading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>

      {!data ? (
        <p style={{ color: 'var(--tf-txt3)', fontSize: 13 }}>{loading ? 'Carregando...' : 'Nenhum dado.'}</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
            <MetricCard label="Total pedidos" value={String(data.metricas.totalPedidos)} />
            <MetricCard label="Receita bruta" value={fmt(data.metricas.receitaBruta)} />
            <MetricCard label="Comissão iFood" value={fmt(data.metricas.comissao)} />
            <MetricCard label="Receita líquida" value={fmt(data.metricas.receitaLiquida)} />
            <MetricCard label="Ticket médio" value={fmt(data.metricas.ticketMedio)} />
            <MetricCard label="Taxa rejeição" value={fmtPct(data.metricas.taxaRejeicao)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
            <div style={{ padding: '18px 20px', borderRadius: 10, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 14 }}>Vendas por Canal</p>
              {pieData.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>Sem dados no período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                      {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${v} pedidos`, '']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={{ padding: '18px 20px', borderRadius: 10, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 14 }}>Top 5 Produtos — iFood</p>
              {data.top5Produtos.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>Sem pedidos iFood no período.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Produto', 'Qtd', 'Receita'].map((h) => <th key={h} style={{ padding: '6px 0', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--tf-txt3)', textTransform: 'uppercase' }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {data.top5Produtos.map((p, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--tf-border)' }}>
                        <td style={{ padding: '8px 0', fontSize: 12, color: 'var(--tf-txt)' }}>{p.name}</td>
                        <td style={{ padding: '8px 0', fontSize: 12, color: 'var(--tf-txt2)' }}>{p.qty}</td>
                        <td style={{ padding: '8px 0', fontSize: 12, color: 'var(--tf-txt2)' }}>{fmt(p.receita)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div style={{ padding: '18px 20px', borderRadius: 10, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 14 }}>Log de Webhooks Recentes</p>
            {data.webhookLogs.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>Nenhum webhook recebido.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Pedido iFood', 'Status', 'Horário'].map((h) => <th key={h} style={{ padding: '6px 0', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--tf-txt3)', textTransform: 'uppercase' }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {data.webhookLogs.map((log) => (
                    <tr key={log.ifoodOrderId + log.createdAt} style={{ borderTop: '1px solid var(--tf-border)' }}>
                      <td style={{ padding: '8px 0', fontSize: 12, color: 'var(--tf-txt)', fontFamily: 'monospace' }}>{log.ifoodOrderId.slice(0, 16)}...</td>
                      <td style={{ padding: '8px 0' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: log.status === 'PROCESSADO' ? '#2a9d6f' : '#e05252', background: log.status === 'PROCESSADO' ? '#0d2b1f' : '#1f0a0a', border: `1px solid ${log.status === 'PROCESSADO' ? '#2a9d6f' : '#e05252'}`, padding: '2px 7px', borderRadius: 9 }}>{log.status}</span>
                        {log.erro && <span style={{ fontSize: 11, color: 'var(--tf-txt3)', marginLeft: 8 }}>{log.erro}</span>}
                      </td>
                      <td style={{ padding: '8px 0', fontSize: 12, color: 'var(--tf-txt3)' }}>{new Date(log.createdAt).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
