'use client'

import { useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { RefreshCw, Download, X, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type NfOrigem = 'SEFAZ' | 'UPLOAD_PDF' | 'UPLOAD_IMAGEM' | 'TEXTO'
type NfStatus = 'CAPTURADA' | 'CONCLUIDA' | 'ERRO' | 'PENDENTE' | 'PROCESSANDO'

interface NfListItem {
  id: string
  origem: NfOrigem
  tipo: string | null
  status: NfStatus
  numeroNf: string | null
  fornecedorNome: string | null
  valorTotal: number | null
  dataEmissao: string | null
  modelo: string | null
  importadoEstoqueEm: string | null
  createdAt: string
}

interface ItemEnriquecido {
  descricao: string
  quantidade: number
  unidade: string
  custoUnitario: number
  custoTotal: number
  insumoId: string | null
  insumoNome: string | null
  scoreConfianca: number
}

interface ImportarData {
  nfId: string
  itens: ItemEnriquecido[]
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  card: {
    background: 'var(--tf-surface)',
    border: '1px solid var(--tf-border)',
    borderRadius: 10,
    padding: '16px 14px',
  } as React.CSSProperties,
  th: {
    padding: '10px 14px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--tf-txt3)',
    textAlign: 'left',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--tf-border)',
    background: 'var(--tf-surface2)',
  } as React.CSSProperties,
  td: {
    padding: '10px 14px',
    fontSize: 13,
    color: 'var(--tf-txt)',
    borderBottom: '1px solid var(--tf-border-light)',
  } as React.CSSProperties,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ORIGEM_LABEL: Record<string, string> = {
  SEFAZ: 'SEFAZ',
  UPLOAD_PDF: 'PDF',
  UPLOAD_IMAGEM: 'Imagem',
  TEXTO: 'Texto',
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(d))
}

function StatusBadge({ status }: { status: NfStatus }) {
  let bg: string
  let color: string
  let bd: string
  let label: string
  switch (status) {
    case 'CONCLUIDA':
      bg = 'var(--tf-green-ok-bg)'; color = 'var(--tf-green-ok)'; bd = 'var(--tf-green-ok-bd)'; label = 'Concluída'
      break
    case 'CAPTURADA':
      bg = 'var(--tf-yellow-bg)'; color = 'var(--tf-yellow)'; bd = 'var(--tf-yellow-bd)'; label = 'Capturada'
      break
    case 'ERRO':
      bg = 'var(--tf-red-bg)'; color = 'var(--tf-red)'; bd = 'var(--tf-red-bd)'; label = 'Erro'
      break
    case 'PROCESSANDO':
      bg = 'var(--tf-primary-bg)'; color = 'var(--tf-primary)'; bd = 'var(--tf-primary-bd)'; label = 'Processando'
      break
    default:
      bg = 'var(--tf-surface2)'; color = 'var(--tf-txt2)'; bd = 'var(--tf-border)'; label = status
  }
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.02em',
      background: bg,
      color,
      border: `1px solid ${bd}`,
    }}>
      {label}
    </span>
  )
}

// ── Import Modal ──────────────────────────────────────────────────────────────

function ImportModal({
  nfId,
  onClose,
  onSuccess,
}: {
  nfId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [saving, setSaving] = useState(false)

  const { data, isLoading, isError } = useQuery<ImportarData>({
    queryKey: ['fiscal-importar', nfId],
    queryFn: () => fetch(`/api/fiscal/importar/${nfId}`).then((r) => r.json()),
    staleTime: 0,
  })

  async function confirmar() {
    if (!data?.itens) return
    const itensValidos = data.itens
      .filter((i) => i.insumoId && i.quantidade > 0)
      .map((i) => ({ insumoId: i.insumoId!, quantidade: i.quantidade, custoUnitario: i.custoUnitario }))

    if (itensValidos.length === 0) {
      toast.error('Nenhum item com insumo vinculado para importar.')
      return
    }

    setSaving(true)
    try {
      const r = await fetch(`/api/fiscal/importar/${nfId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itens: itensValidos }),
      })
      if (!r.ok) {
        const err = await r.json()
        toast.error(err.error ?? 'Erro ao importar para estoque.')
        return
      }
      const result = await r.json()
      toast.success(`${result.itensCriados ?? itensValidos.length} itens importados para o estoque.`)
      onSuccess()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const itensVinculados = data?.itens.filter((i) => i.insumoId).length ?? 0
  const itensTotal = data?.itens.length ?? 0

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 1000,
        }}
      />
      {/* Dialog */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1001,
        background: 'var(--tf-surface)',
        border: '1px solid var(--tf-border)',
        borderRadius: 12,
        padding: 24,
        width: '90%',
        maxWidth: 680,
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>Importar NF para Estoque</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tf-txt2)', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {isLoading && (
          <p style={{ color: 'var(--tf-txt2)', fontSize: 13 }}>Carregando itens da nota…</p>
        )}

        {isError && (
          <p style={{ color: 'var(--tf-red)', fontSize: 13 }}>Erro ao carregar itens da nota.</p>
        )}

        {data && (
          <>
            <p style={{ fontSize: 13, color: 'var(--tf-txt2)', margin: 0 }}>
              {itensVinculados} de {itensTotal} itens vinculados a insumos do estoque.
              {itensVinculados < itensTotal && (
                <span style={{ color: 'var(--tf-yellow)', marginLeft: 6 }}>
                  Itens sem vínculo serão ignorados.
                </span>
              )}
            </p>

            {/* Items table */}
            <div style={{ overflowY: 'auto', flex: 1, border: '1px solid var(--tf-border)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={S.th}>Descrição NF</th>
                    <th style={S.th}>Insumo</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>Qtd</th>
                    <th style={{ ...S.th, textAlign: 'right' }}>Custo Unit.</th>
                    <th style={{ ...S.th, textAlign: 'center' }}>Confiança</th>
                  </tr>
                </thead>
                <tbody>
                  {data.itens.map((item, idx) => (
                    <tr key={idx} style={{ background: item.insumoId ? 'transparent' : 'var(--tf-red-bg)' }}>
                      <td style={{ ...S.td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.descricao}
                      </td>
                      <td style={{ ...S.td }}>
                        {item.insumoNome ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={12} style={{ color: 'var(--tf-green-ok)', flexShrink: 0 }} />
                            {item.insumoNome}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--tf-txt3)', fontSize: 12 }}>Sem vínculo</span>
                        )}
                      </td>
                      <td style={{ ...S.td, textAlign: 'right' }}>
                        {item.quantidade} {item.unidade}
                      </td>
                      <td style={{ ...S.td, textAlign: 'right' }}>
                        {formatCurrency(item.custoUnitario)}
                      </td>
                      <td style={{ ...S.td, textAlign: 'center' }}>
                        {item.insumoId ? (
                          <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: item.scoreConfianca >= 0.8
                              ? 'var(--tf-green-ok)'
                              : item.scoreConfianca >= 0.5
                                ? 'var(--tf-yellow)'
                                : 'var(--tf-red)',
                          }}>
                            {Math.round(item.scoreConfianca * 100)}%
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="outline" onClick={onClose} disabled={saving} size="sm">
                Cancelar
              </Button>
              <Button
                onClick={confirmar}
                disabled={saving || itensVinculados === 0}
                size="sm"
              >
                {saving ? 'Importando…' : `Importar ${itensVinculados} iten${itensVinculados !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FiscalNotasPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'
  const queryClient = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const [importModalId, setImportModalId] = useState<string | null>(null)

  const { data: notas = [], isLoading } = useQuery<NfListItem[]>({
    queryKey: ['fiscal-notas'],
    queryFn: () => fetch('/api/fiscal/notas').then((r) => r.json()),
    staleTime: 2 * 60_000,
  })

  const reload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['fiscal-notas'] })
  }, [queryClient])

  async function sincronizar() {
    setSyncing(true)
    try {
      const r = await fetch('/api/fiscal/sincronizar', { method: 'POST' })
      if (!r.ok) {
        const err = await r.json()
        toast.error(err.error ?? 'Erro ao sincronizar.')
        return
      }
      const result = await r.json()
      const count: number = result.capturadas ?? 0
      toast.success(
        count > 0
          ? `${count} nota${count !== 1 ? 's' : ''} capturada${count !== 1 ? 's' : ''} da SEFAZ.`
          : 'Sincronização concluída. Nenhuma nota nova.'
      )
      reload()
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 22, margin: 0 }}>Notas Fiscais</h1>
          <p style={{ color: 'var(--tf-txt2)', fontSize: 13, margin: '4px 0 0' }}>
            NF-e capturadas da SEFAZ e importadas para o estoque.
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={sincronizar}
            disabled={syncing}
            size="sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
            {syncing ? 'Sincronizando…' : 'Sincronizar agora'}
          </Button>
        )}
      </div>

      {/* Table */}
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={S.th}>Data</th>
              <th style={S.th}>Fornecedor</th>
              <th style={S.th}>Número</th>
              <th style={S.th}>Modelo</th>
              <th style={{ ...S.th, textAlign: 'right' }}>Valor</th>
              <th style={S.th}>Origem</th>
              <th style={S.th}>Status</th>
              {isAdmin && <th style={{ ...S.th, textAlign: 'center' }}>Ação</th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={isAdmin ? 8 : 7}
                  style={{ ...S.td, textAlign: 'center', padding: 32, color: 'var(--tf-txt2)' }}
                >
                  Carregando…
                </td>
              </tr>
            ) : notas.length === 0 ? (
              <tr>
                <td
                  colSpan={isAdmin ? 8 : 7}
                  style={{ ...S.td, textAlign: 'center', padding: 32, color: 'var(--tf-txt2)' }}
                >
                  Nenhuma nota fiscal encontrada. Use &ldquo;Sincronizar agora&rdquo; para buscar notas da SEFAZ.
                </td>
              </tr>
            ) : (
              notas.map((nf) => (
                <tr key={nf.id}>
                  <td style={{ ...S.td, color: 'var(--tf-txt2)', fontSize: 12 }}>
                    {formatDate(nf.dataEmissao ?? nf.createdAt)}
                  </td>
                  <td style={{ ...S.td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {nf.fornecedorNome ?? <span style={{ color: 'var(--tf-txt3)' }}>—</span>}
                  </td>
                  <td style={{ ...S.td, color: 'var(--tf-txt2)', fontVariantNumeric: 'tabular-nums' }}>
                    {nf.numeroNf ?? '—'}
                  </td>
                  <td style={{ ...S.td, color: 'var(--tf-txt2)' }}>
                    {nf.modelo ?? '—'}
                  </td>
                  <td style={{ ...S.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {nf.valorTotal != null ? formatCurrency(Number(nf.valorTotal)) : '—'}
                  </td>
                  <td style={{ ...S.td }}>
                    <span style={{
                      fontSize: 11,
                      padding: '2px 7px',
                      borderRadius: 4,
                      background: nf.origem === 'SEFAZ' ? 'var(--tf-primary-bg)' : 'var(--tf-surface2)',
                      color: nf.origem === 'SEFAZ' ? 'var(--tf-primary)' : 'var(--tf-txt2)',
                      border: `1px solid ${nf.origem === 'SEFAZ' ? 'var(--tf-primary-bd)' : 'var(--tf-border)'}`,
                      fontWeight: 500,
                    }}>
                      {ORIGEM_LABEL[nf.origem] ?? nf.origem}
                    </span>
                  </td>
                  <td style={S.td}>
                    <StatusBadge status={nf.status} />
                  </td>
                  {isAdmin && (
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      {nf.status === 'CAPTURADA' && (
                        <button
                          onClick={() => setImportModalId(nf.id)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 10px',
                            fontSize: 12,
                            fontWeight: 500,
                            borderRadius: 6,
                            border: '1px solid var(--tf-border)',
                            background: 'var(--tf-surface)',
                            color: 'var(--tf-txt)',
                            cursor: 'pointer',
                            transition: 'border-color 120ms',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--tf-primary)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--tf-border)' }}
                        >
                          <Download size={12} />
                          Importar
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Totals summary */}
      {notas.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--tf-txt3)', margin: 0 }}>
          {notas.length} nota{notas.length !== 1 ? 's' : ''} exibida{notas.length !== 1 ? 's' : ''} (últimas 200)
        </p>
      )}

      {/* Import modal */}
      {importModalId && (
        <ImportModal
          nfId={importModalId}
          onClose={() => setImportModalId(null)}
          onSuccess={reload}
        />
      )}
    </div>
  )
}
