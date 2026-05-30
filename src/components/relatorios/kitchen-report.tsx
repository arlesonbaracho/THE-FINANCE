'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Clock, Zap, TrendingDown } from 'lucide-react'

type PratTempo = { id: string; nome: string; tempoMedioMs: number; tempoMedioMin: number }
type TurnoTempo = { turno: string; tempoMedioMin: number; pedidos: number }
type HeatRow = { hora: string; dias: { dow: number; label: string; count: number }[] }
type Cancelamento = { data: string; operador: string; produtos: string[]; pedidoId: string }

type ApiData = {
  tempoMedioGeralMin: number
  tempoMedioPorPrato: PratTempo[]
  tempoMedioPorTurno: TurnoTempo[]
  heatmap: HeatRow[]
  cancelamentos: Cancelamento[]
  totalPedidos: number
  totalCancelamentos: number
}

function fmtDate(d: string) { return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') }

export function KitchenReport({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoveredCell, setHoveredCell] = useState<{ h: number; d: number; count: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/relatorios/cozinha?startDate=${startDate}&endDate=${endDate}`)
      if (res.ok) setData(await res.json())
    } catch { /* silent */ } finally { setLoading(false) }
  }, [startDate, endDate])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--tf-border)', borderTopColor: 'var(--tf-primary)', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--tf-txt3)', fontSize: 14 }}>Nenhum dado no período.</div>

  const fastest = data.tempoMedioPorPrato[0]
  const slowest = data.tempoMedioPorPrato[data.tempoMedioPorPrato.length - 1]
  const maxCount = Math.max(...data.heatmap.flatMap((r) => r.dias.map((d) => d.count)), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {[
          { label: 'Tempo médio geral', value: `${data.tempoMedioGeralMin} min`, icon: Clock, sub: `${data.totalPedidos} pedidos` },
          { label: 'Mais rápido', value: fastest ? `${fastest.tempoMedioMin} min` : '—', icon: Zap, sub: fastest?.nome ?? '' },
          { label: 'Mais lento', value: slowest ? `${slowest.tempoMedioMin} min` : '—', icon: TrendingDown, sub: slowest?.nome ?? '' },
          { label: 'Cancelamentos', value: `${data.totalCancelamentos}`, icon: TrendingDown, sub: `${data.totalPedidos > 0 ? ((data.totalCancelamentos / data.totalPedidos) * 100).toFixed(1) : 0}% do total` },
        ].map(({ label, value, icon: Icon, sub }) => (
          <Card key={label} style={{ border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
            <CardContent style={{ paddingTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 4 }}>{label}</p>
                  <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 2 }}>{value}</p>
                  <p style={{ fontSize: 11, color: 'var(--tf-txt2)' }}>{sub}</p>
                </div>
                <Icon size={16} style={{ color: 'var(--tf-txt3)' }} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Turno cards */}
      <div style={{ display: 'flex', gap: 12 }}>
        {data.tempoMedioPorTurno.map((t) => (
          <div key={t.turno} style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
            <p style={{ fontSize: 11, color: 'var(--tf-txt3)', marginBottom: 2 }}>{t.turno}</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--tf-txt)' }}>{t.tempoMedioMin} min</p>
            <p style={{ fontSize: 11, color: 'var(--tf-txt2)' }}>{t.pedidos} pedido(s)</p>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <Card style={{ border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
        <CardHeader><CardTitle style={{ fontSize: 14, color: 'var(--tf-txt)' }}>Heatmap — Pedidos por hora e dia da semana</CardTitle></CardHeader>
        <CardContent style={{ overflowX: 'auto' }}>
          <div style={{ position: 'relative', display: 'inline-block', minWidth: 480 }}>
            {/* Day labels */}
            <div style={{ display: 'flex', marginLeft: 36, marginBottom: 4 }}>
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                <div key={d} style={{ width: 40, textAlign: 'center', fontSize: 10, color: 'var(--tf-txt3)', fontWeight: 600 }}>{d}</div>
              ))}
            </div>
            {/* Grid */}
            {data.heatmap.map((row, hi) => (
              <div key={row.hora} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ width: 32, fontSize: 9, color: 'var(--tf-txt3)', textAlign: 'right', paddingRight: 4, flexShrink: 0 }}>{row.hora}</span>
                {row.dias.map((cell) => {
                  const intensity = maxCount > 0 ? cell.count / maxCount : 0
                  const isHovered = hoveredCell?.h === hi && hoveredCell.d === cell.dow
                  return (
                    <div
                      key={cell.dow}
                      onMouseEnter={() => setHoveredCell({ h: hi, d: cell.dow, count: cell.count })}
                      onMouseLeave={() => setHoveredCell(null)}
                      title={`${row.hora} ${cell.label}: ${cell.count} pedido(s)`}
                      style={{
                        width: 36, height: 24, margin: '0 2px',
                        borderRadius: 3,
                        background: cell.count === 0 ? 'var(--tf-surface2)' : `rgba(42, 157, 111, ${0.15 + intensity * 0.85})`,
                        border: isHovered ? '1px solid var(--tf-primary)' : '1px solid transparent',
                        cursor: 'default',
                        transition: 'border-color 80ms',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {cell.count > 0 && <span style={{ fontSize: 9, color: intensity > 0.5 ? '#fff' : 'var(--tf-txt)', fontWeight: 600 }}>{cell.count}</span>}
                    </div>
                  )
                })}
              </div>
            ))}
            {hoveredCell && (
              <div style={{ position: 'absolute', bottom: -28, left: 36, fontSize: 11, color: 'var(--tf-txt2)', whiteSpace: 'nowrap' }}>
                {hoveredCell.count} pedido(s) nesse horário
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ranking por prato */}
      <Card style={{ border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
        <CardHeader><CardTitle style={{ fontSize: 14, color: 'var(--tf-txt)' }}>Ranking por tempo de preparo</CardTitle></CardHeader>
        <CardContent style={{ padding: 0 }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hover:bg-transparent">#</TableHead>
                <TableHead className="hover:bg-transparent">Produto</TableHead>
                <TableHead className="hover:bg-transparent">Tempo médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.tempoMedioPorPrato.slice(0, 15).map((p, i) => (
                <TableRow key={p.id}>
                  <TableCell style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>{i + 1}</TableCell>
                  <TableCell style={{ fontSize: 12, fontWeight: 500 }}>{p.nome}</TableCell>
                  <TableCell style={{ fontSize: 12, color: p.tempoMedioMin > data.tempoMedioGeralMin ? 'var(--tf-red)' : 'var(--tf-green-ok)' }}>{p.tempoMedioMin} min</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cancelamentos */}
      {data.cancelamentos.length > 0 && (
        <Card style={{ border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
          <CardHeader><CardTitle style={{ fontSize: 14, color: 'var(--tf-txt)' }}>Pedidos Cancelados ({data.cancelamentos.length})</CardTitle></CardHeader>
          <CardContent style={{ padding: 0 }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hover:bg-transparent">Data</TableHead>
                  <TableHead className="hover:bg-transparent">Operador</TableHead>
                  <TableHead className="hover:bg-transparent">Produtos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.cancelamentos.map((c) => (
                  <TableRow key={c.pedidoId}>
                    <TableCell style={{ fontSize: 12 }}>{fmtDate(c.data)}</TableCell>
                    <TableCell style={{ fontSize: 12 }}>{c.operador}</TableCell>
                    <TableCell style={{ fontSize: 12, color: 'var(--tf-txt2)' }}>{c.produtos.join(', ')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
