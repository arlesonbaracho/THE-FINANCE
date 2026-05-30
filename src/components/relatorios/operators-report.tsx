'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Operator = {
  userId: string; nome: string; avatarUrl: string | null
  pedidos: number; cancelamentos: number; receita: number
  ticketMedio: number; horarioPico: string; taxaCancelamento: number
}

function fmt(v: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) }

export function OperatorsReport({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [data, setData] = useState<Operator[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/relatorios/operadores?startDate=${startDate}&endDate=${endDate}`)
      if (res.ok) { const d = await res.json(); setData(d.operadores ?? []) }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [startDate, endDate])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--tf-border)', borderTopColor: 'var(--tf-primary)', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (data.length === 0) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--tf-txt3)', fontSize: 14 }}>
      Nenhum dado de operador no período.
    </div>
  )

  const maxReceita = Math.max(...data.map((o) => o.receita), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Ranking cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        {data.slice(0, 6).map((op, i) => (
          <Card key={op.userId} style={{ border: `1px solid ${i === 0 ? 'var(--tf-primary-bd)' : 'var(--tf-border)'}`, background: 'var(--tf-surface)' }}>
            <CardContent style={{ paddingTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: i === 0 ? 'var(--tf-primary)' : 'var(--tf-surface2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700, color: i === 0 ? '#fff' : 'var(--tf-txt2)',
                  flexShrink: 0,
                }}>
                  {(op.nome)[0]?.toUpperCase() ?? '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{op.nome}</p>
                  <p style={{ fontSize: 10, color: 'var(--tf-txt3)' }}>#{i + 1} por receita</p>
                </div>
              </div>
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: 'var(--tf-txt3)' }}>Receita</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--tf-txt)' }}>{fmt(op.receita)}</span>
                </div>
                <div style={{ height: 4, background: 'var(--tf-surface2)', borderRadius: 2 }}>
                  <div style={{ height: 4, background: 'var(--tf-primary)', borderRadius: 2, width: `${(op.receita / maxReceita) * 100}%` }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--tf-txt2)' }}>
                <span>{op.pedidos} pedidos</span>
                <span>Pico: {op.horarioPico}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail table */}
      <div style={{ border: '1px solid var(--tf-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--tf-surface)' }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hover:bg-transparent">#</TableHead>
              <TableHead className="hover:bg-transparent">Operador</TableHead>
              <TableHead className="hover:bg-transparent">Pedidos</TableHead>
              <TableHead className="hover:bg-transparent">Receita</TableHead>
              <TableHead className="hover:bg-transparent">Ticket médio</TableHead>
              <TableHead className="hover:bg-transparent">Pico</TableHead>
              <TableHead className="hover:bg-transparent">Cancelamentos</TableHead>
              <TableHead className="hover:bg-transparent">Taxa cancel.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((op, i) => (
              <TableRow key={op.userId}>
                <TableCell style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>{i + 1}</TableCell>
                <TableCell style={{ fontSize: 12, fontWeight: 500 }}>{op.nome}</TableCell>
                <TableCell style={{ fontSize: 12 }}>{op.pedidos}</TableCell>
                <TableCell style={{ fontSize: 12 }}>{fmt(op.receita)}</TableCell>
                <TableCell style={{ fontSize: 12 }}>{fmt(op.ticketMedio)}</TableCell>
                <TableCell style={{ fontSize: 12 }}>{op.horarioPico}</TableCell>
                <TableCell style={{ fontSize: 12 }}>{op.cancelamentos}</TableCell>
                <TableCell style={{ fontSize: 12, color: op.taxaCancelamento > 10 ? 'var(--tf-red)' : undefined }}>
                  {op.taxaCancelamento.toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
