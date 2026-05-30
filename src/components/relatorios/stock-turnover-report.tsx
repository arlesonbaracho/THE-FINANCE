'use client'

import { useEffect, useState, useCallback } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertTriangle } from 'lucide-react'

type IngredientTurnover = {
  id: string; nome: string; codigo: string | null; unit: string
  estoqueInicial: number; entradas: number; saidas: number; estoqueFinal: number
  custoEntradas: number; custoSaidas: number; giro: number; classificacao: string; semMovimento: boolean
}

const CLASS_COLOR: Record<string, string> = {
  Alta: 'var(--tf-green-ok)',
  Média: '#f59e0b',
  Baixa: 'var(--tf-txt3)',
  Parado: 'var(--tf-red)',
}
const CLASS_BG: Record<string, string> = {
  Alta: 'var(--tf-green-ok-bg)',
  Média: 'var(--tf-yellow-bg)',
  Baixa: 'var(--tf-surface2)',
  Parado: 'var(--tf-red-bg)',
}

function fmt(v: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) }
function fmtQty(v: number, unit: string) { return `${v.toFixed(2)} ${unit.toLowerCase()}` }

export function StockTurnoverReport({ startDate, endDate }: { startDate: string; endDate: string }) {
  const [items, setItems] = useState<IngredientTurnover[]>([])
  const [semMovimento, setSemMovimento] = useState<IngredientTurnover[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/relatorios/estoque/giro?startDate=${startDate}&endDate=${endDate}`)
      if (res.ok) {
        const d = await res.json()
        setItems(d.itens ?? [])
        setSemMovimento(d.semMovimento ?? [])
      }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [startDate, endDate])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--tf-border)', borderTopColor: 'var(--tf-primary)', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  function RenderTable({ data, title, highlight }: { data: IngredientTurnover[]; title: string; highlight?: boolean }) {
    return (
      <div>
        {title && <p style={{ fontSize: 13, fontWeight: 600, color: highlight ? 'var(--tf-red)' : 'var(--tf-txt)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          {highlight && <AlertTriangle size={14} />} {title}
        </p>}
        <div style={{ border: `1px solid ${highlight ? 'var(--tf-red-bd)' : 'var(--tf-border)'}`, borderRadius: 8, overflow: 'hidden', background: highlight ? 'var(--tf-red-bg)' : 'var(--tf-surface)' }}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hover:bg-transparent">Insumo</TableHead>
                <TableHead className="hover:bg-transparent">Código</TableHead>
                <TableHead className="hover:bg-transparent">Est. inicial</TableHead>
                <TableHead className="hover:bg-transparent">Entradas</TableHead>
                <TableHead className="hover:bg-transparent">Saídas</TableHead>
                <TableHead className="hover:bg-transparent">Est. final</TableHead>
                <TableHead className="hover:bg-transparent">Custo saídas</TableHead>
                <TableHead className="hover:bg-transparent">Giro</TableHead>
                <TableHead className="hover:bg-transparent">Classe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell style={{ fontSize: 12, fontWeight: 500 }}>{item.nome}</TableCell>
                  <TableCell style={{ fontSize: 11, color: 'var(--tf-txt3)' }}>{item.codigo ?? '—'}</TableCell>
                  <TableCell style={{ fontSize: 12 }}>{fmtQty(item.estoqueInicial, item.unit)}</TableCell>
                  <TableCell style={{ fontSize: 12 }}>{fmtQty(item.entradas, item.unit)}</TableCell>
                  <TableCell style={{ fontSize: 12 }}>{fmtQty(item.saidas, item.unit)}</TableCell>
                  <TableCell style={{ fontSize: 12 }}>{fmtQty(item.estoqueFinal, item.unit)}</TableCell>
                  <TableCell style={{ fontSize: 12 }}>{fmt(item.custoSaidas)}</TableCell>
                  <TableCell style={{ fontSize: 12 }}>{item.giro.toFixed(2)}</TableCell>
                  <TableCell>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: CLASS_BG[item.classificacao], color: CLASS_COLOR[item.classificacao] }}>
                      {item.classificacao}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow><TableCell colSpan={9} style={{ textAlign: 'center', color: 'var(--tf-txt3)', padding: 20, fontSize: 13 }}>Nenhum registro.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <RenderTable data={items} title="Giro de Estoque" />
      {semMovimento.length > 0 && (
        <RenderTable data={semMovimento} title={`${semMovimento.length} insumo(s) sem movimentação no período`} highlight />
      )}
    </div>
  )
}
