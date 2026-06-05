'use client'

import { useEffect, useState } from 'react'
import { FileText, Table, Check } from 'lucide-react'

interface Fornecedor { id: string; name: string }
interface PurchaseOrder {
  id: string
  createdAt: string
  status: 'RASCUNHO' | 'ENVIADO' | 'RECEBIDO'
  valorTotal: number
  fornecedor: { name: string }
  _count: { itens: number }
}

const STATUS_LABEL: Record<string, string> = { RASCUNHO: 'Rascunho', ENVIADO: 'Enviado', RECEBIDO: 'Recebido' }
const STATUS_COLOR: Record<string, string> = { RASCUNHO: '#f59e0b', ENVIADO: '#6366f1', RECEBIDO: '#10b981' }

export default function RedeComprasPage() {
  const [pedidos, setPedidos] = useState<PurchaseOrder[]>([])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [fornecedorSel, setFornecedorSel] = useState('')
  const [loading, setLoading] = useState(false)

  async function recarregar() {
    fetch('/api/rede/compras').then((r) => r.json()).then(setPedidos)
  }

  useEffect(() => {
    recarregar()
    fetch('/api/suppliers').then((r) => r.json()).then((d: Fornecedor[]) => {
      setFornecedores(d)
      if (d.length > 0) setFornecedorSel(d[0].id)
    })
  }, [])

  async function gerarPedido() {
    if (!fornecedorSel) return
    setLoading(true)
    await fetch('/api/rede/compras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fornecedorId: fornecedorSel }),
    })
    await recarregar()
    setLoading(false)
  }

  async function marcarRecebido(id: string) {
    await fetch(`/api/rede/compras/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'RECEBIDO' }),
    })
    recarregar()
  }

  function exportar(id: string, formato: 'pdf' | 'excel') {
    window.open(`/api/rede/compras/${id}/exportar?formato=${formato}`, '_blank')
  }

  const th: React.CSSProperties = {
    textAlign: 'left',
    padding: '10px 16px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--tf-txt3)',
    borderBottom: '1px solid var(--tf-border)',
  }
  const td: React.CSSProperties = {
    padding: '10px 16px',
    fontSize: 13,
    color: 'var(--tf-txt)',
    borderBottom: '1px solid var(--tf-border)',
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 24, marginTop: 0 }}>
        Compras Centralizadas
      </h1>

      {/* Gerar pedido */}
      <div
        style={{
          background: 'var(--tf-surface)',
          border: '1px solid var(--tf-border)',
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 12, marginTop: 0 }}>
          Gerar pedido consolidado
        </h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            value={fornecedorSel}
            onChange={(e) => setFornecedorSel(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--tf-border)',
              background: 'var(--tf-surface)',
              color: 'var(--tf-txt)',
              fontSize: 13,
            }}
          >
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <button
            onClick={gerarPedido}
            disabled={loading || !fornecedorSel}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              background: 'var(--tf-primary, #6366f1)',
              color: '#fff',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 13,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Gerando...' : 'Gerar pedido de compra'}
          </button>
        </div>
        <p style={{ marginTop: 8, fontSize: 12, color: 'var(--tf-txt3)', marginBottom: 0 }}>
          Baseado nos alertas de estoque ativos em todas as unidades da rede.
        </p>
      </div>

      {/* Histórico */}
      <div
        style={{
          background: 'var(--tf-surface)',
          border: '1px solid var(--tf-border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--tf-border)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)', margin: 0 }}>
            Histórico de pedidos
          </h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Data', 'Fornecedor', 'Itens', 'Valor estimado', 'Status', 'Ações'].map((col) => (
                <th key={col} style={th}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <tr key={p.id}>
                <td style={td}>{new Date(p.createdAt).toLocaleDateString('pt-BR')}</td>
                <td style={td}>{p.fornecedor.name}</td>
                <td style={td}>{p._count.itens}</td>
                <td style={td}>
                  {Number(p.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td style={td}>
                  <span
                    style={{
                      fontSize: 11,
                      background: STATUS_COLOR[p.status],
                      color: '#fff',
                      borderRadius: 4,
                      padding: '2px 8px',
                    }}
                  >
                    {STATUS_LABEL[p.status]}
                  </span>
                </td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => exportar(p.id, 'pdf')}
                      title="Exportar PDF"
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--tf-border)',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: 'var(--tf-txt)',
                      }}
                    >
                      <FileText className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => exportar(p.id, 'excel')}
                      title="Exportar Excel"
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--tf-border)',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: 'var(--tf-txt)',
                      }}
                    >
                      <Table className="w-3 h-3" />
                    </button>
                    {p.status !== 'RECEBIDO' && (
                      <button
                        onClick={() => marcarRecebido(p.id)}
                        title="Marcar como recebido"
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid #10b981',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: '#10b981',
                        }}
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {pedidos.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{ ...td, color: 'var(--tf-txt3)', textAlign: 'center', padding: 32 }}
                >
                  Nenhum pedido de compra gerado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
