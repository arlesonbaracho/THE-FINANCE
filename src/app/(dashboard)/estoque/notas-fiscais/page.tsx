'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface NfListItem {
  id: string
  createdAt: string
  fornecedorNome: string | null
  numeroNf: string | null
  itensCriados: number
  valorTotal: number | null
  processadoPor: string
  origem: 'UPLOAD_IMAGEM' | 'UPLOAD_PDF' | 'TEXTO'
  cloudinaryUrl: string | null
}

const ORIGEM_LABELS: Record<string, string> = {
  UPLOAD_IMAGEM: 'Imagem',
  UPLOAD_PDF: 'PDF',
  TEXTO: 'Texto',
}

export default function NotasFiscaisPage() {
  const [nfs, setNfs] = useState<NfListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroFornecedor, setFiltroFornecedor] = useState('')
  const [filtroOrigem, setFiltroOrigem] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtroFornecedor) params.set('fornecedor', filtroFornecedor)
    if (filtroOrigem) params.set('origem', filtroOrigem)

    try {
      const res = await fetch(`/api/ai/nfs?${params}`)
      const data = await res.json() as NfListItem[]
      setNfs(Array.isArray(data) ? data : [])
    } finally {
      setLoading(false)
    }
  }, [filtroFornecedor, filtroOrigem])

  useEffect(() => { void carregar() }, [carregar])

  async function reprocessar(nf: NfListItem) {
    if (!nf.cloudinaryUrl) return
    try {
      const res = await fetch('/api/ai/processar-nf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cloudinaryUrl: nf.cloudinaryUrl, nfOriginalId: nf.id }),
      })
      if (res.ok) {
        toast.success('NF enviada para reprocessamento')
      } else {
        toast.error('Erro ao reprocessar NF')
      }
    } catch {
      toast.error('Erro ao reprocessar NF')
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Notas Fiscais</h1>
        <button
          onClick={() => void carregar()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <input
          value={filtroFornecedor}
          onChange={(e) => setFiltroFornecedor(e.target.value)}
          placeholder="Filtrar por fornecedor..."
          className="border border-border rounded-md px-3 py-1.5 text-sm bg-background w-56"
        />
        <select
          value={filtroOrigem}
          onChange={(e) => setFiltroOrigem(e.target.value)}
          className="border border-border rounded-md px-3 py-1.5 text-sm bg-background"
        >
          <option value="">Todas as origens</option>
          <option value="UPLOAD_IMAGEM">Imagem</option>
          <option value="UPLOAD_PDF">PDF</option>
          <option value="TEXTO">Texto</option>
        </select>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Data</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Fornecedor</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Nº NF</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Itens</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Valor total</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Origem</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                  Carregando...
                </td>
              </tr>
            ) : nfs.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                  Nenhuma nota fiscal encontrada
                </td>
              </tr>
            ) : (
              nfs.map((nf) => (
                <tr key={nf.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {format(new Date(nf.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </td>
                  <td className="px-4 py-2.5">{nf.fornecedorNome ?? '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{nf.numeroNf ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right">{nf.itensCriados}</td>
                  <td className="px-4 py-2.5 text-right">
                    {nf.valorTotal != null
                      ? Number(nf.valorTotal).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      IA · {ORIGEM_LABELS[nf.origem]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {nf.cloudinaryUrl && (
                      <button
                        onClick={() => void reprocessar(nf)}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 ml-auto"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Reprocessar
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
