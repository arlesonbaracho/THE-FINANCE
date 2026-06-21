'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Download, Loader2, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

type ItemPreview = {
  ifoodItemId: string
  ifoodItemNome: string
  preco: number
  categoriaNome: string
  sugestao: 'mapeado' | 'casar' | 'criar'
  produtoSugeridoId?: string | null
  score?: number | null
}

type Produto = { id: string; name: string }

type AcaoLocal = 'criar' | 'casar' | 'ignorar' | 'mapeado'

type RowState = {
  acao: AcaoLocal
  produtoId: string
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  card: {
    background: 'var(--tf-surface)',
    border: '1px solid var(--tf-border)',
    borderRadius: 10,
    padding: '16px 14px',
  } as React.CSSProperties,
  select: {
    background: 'var(--tf-bg)',
    border: '1px solid var(--tf-border)',
    borderRadius: 6,
    padding: '5px 8px',
    fontSize: 12,
    color: 'var(--tf-txt)',
    outline: 'none',
    width: '100%',
    maxWidth: 220,
    cursor: 'pointer',
  } as React.CSSProperties,
  badge: (color: string, bg: string, border: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    color,
    background: bg,
    border: `1px solid ${border}`,
    whiteSpace: 'nowrap',
  }),
}

// ── Row action control ────────────────────────────────────────────────────────

function AcaoControl({
  item,
  state,
  produtos,
  onChange,
}: {
  item: ItemPreview
  state: RowState
  produtos: Produto[]
  onChange: (s: Partial<RowState>) => void
}) {
  if (item.sugestao === 'mapeado') {
    return (
      <span style={S.badge('var(--tf-txt2)', 'var(--tf-surface2)', 'var(--tf-border)')}>
        Já vinculado
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <select
        value={state.acao}
        onChange={(e) => onChange({ acao: e.target.value as AcaoLocal })}
        style={S.select}
      >
        <option value="criar">Criar novo produto</option>
        <option value="casar">Vincular a...</option>
        <option value="ignorar">Ignorar</option>
      </select>

      {state.acao === 'casar' && (
        <select
          value={state.produtoId}
          onChange={(e) => onChange({ produtoId: e.target.value })}
          style={S.select}
        >
          <option value="">Selecionar produto…</option>
          {produtos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function IFoodCardapioImportPage() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  const role = session?.user?.role
  const canAccess = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MANAGER'

  const [previewItems, setPreviewItems] = useState<ItemPreview[] | null>(null)
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({})
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [importing, setImporting] = useState(false)
  const [notConnected, setNotConnected] = useState(false)

  // Tenant products list for the "casar" select
  const { data: produtos = [] } = useQuery<Produto[]>({
    queryKey: ['products-list'],
    queryFn: () =>
      fetch('/api/products').then((r) => r.json()).then((d) => {
        // API returns array of products
        if (Array.isArray(d)) return d.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))
        return []
      }),
    staleTime: 5 * 60_000,
    enabled: canAccess,
  })

  function buildInitialStates(items: ItemPreview[]): Record<string, RowState> {
    const map: Record<string, RowState> = {}
    for (const item of items) {
      if (item.sugestao === 'mapeado') {
        map[item.ifoodItemId] = { acao: 'mapeado', produtoId: '' }
      } else if (item.sugestao === 'casar') {
        map[item.ifoodItemId] = { acao: 'casar', produtoId: item.produtoSugeridoId ?? '' }
      } else {
        map[item.ifoodItemId] = { acao: 'criar', produtoId: '' }
      }
    }
    return map
  }

  async function fetchPreview() {
    setLoadingPreview(true)
    setNotConnected(false)
    try {
      const r = await fetch('/api/integracoes/ifood/cardapio/preview')
      if (r.status === 409) {
        setNotConnected(true)
        toast.error('Conecte a integração do iFood primeiro')
        return
      }
      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        toast.error(data.error ?? 'Erro ao buscar prévia do cardápio')
        return
      }
      const items: ItemPreview[] = await r.json()
      setPreviewItems(items)
      setRowStates(buildInitialStates(items))
    } finally {
      setLoadingPreview(false)
    }
  }

  function updateRow(id: string, patch: Partial<RowState>) {
    setRowStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function handleImport() {
    if (!previewItems) return
    setImporting(true)
    try {
      const decisoes = previewItems
        .filter((item) => rowStates[item.ifoodItemId]?.acao !== 'mapeado')
        .map((item) => {
          const st = rowStates[item.ifoodItemId]
          return {
            ifoodItemId: item.ifoodItemId,
            ifoodItemNome: item.ifoodItemNome,
            preco: item.preco,
            categoriaNome: item.categoriaNome,
            acao: st.acao as 'criar' | 'casar' | 'ignorar',
            ...(st.acao === 'casar' && st.produtoId ? { produtoId: st.produtoId } : {}),
          }
        })

      const r = await fetch('/api/integracoes/ifood/cardapio/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisoes }),
      })

      if (!r.ok) {
        const data = await r.json().catch(() => ({}))
        toast.error(data.error ?? 'Erro ao importar cardápio')
        return
      }

      const { criados, mapeados } = await r.json()
      toast.success(`${criados} criados, ${mapeados} vinculados`)

      // Invalidate products and re-fetch preview
      queryClient.invalidateQueries({ queryKey: ['products-list'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      await fetchPreview()
    } finally {
      setImporting(false)
    }
  }

  // ── Access gate ──────────────────────────────────────────────────────────────

  if (session && !canAccess) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 22, margin: 0 }}>Importar Cardápio do iFood</h1>
          <p style={{ color: 'var(--tf-txt2)', fontSize: 13, margin: '4px 0 0' }}>
            Apenas administradores e gerentes podem acessar esta seção.
          </p>
        </div>
        <div
          style={{
            ...S.card,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: 'var(--tf-red)',
          }}
        >
          <AlertCircle size={18} />
          <span style={{ fontSize: 13 }}>Você não tem permissão para acessar esta página.</span>
        </div>
      </div>
    )
  }

  // ── Count actionable rows ────────────────────────────────────────────────────

  const actionableCount = previewItems
    ? previewItems.filter((it) => rowStates[it.ifoodItemId]?.acao !== 'mapeado' && rowStates[it.ifoodItemId]?.acao !== 'ignorar').length
    : 0

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontWeight: 700, fontSize: 22, margin: 0 }}>Importar Cardápio do iFood</h1>
          <p style={{ color: 'var(--tf-txt2)', fontSize: 13, margin: '4px 0 0' }}>
            Importe os itens do seu cardápio iFood como produtos no sistema.
          </p>
        </div>
        <button
          onClick={fetchPreview}
          disabled={loadingPreview}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 20px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--tf-primary)',
            color: '#fff',
            fontWeight: 600,
            fontSize: 13,
            cursor: loadingPreview ? 'not-allowed' : 'pointer',
            opacity: loadingPreview ? 0.7 : 1,
            flexShrink: 0,
          }}
        >
          {loadingPreview ? (
            <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <Download size={14} />
          )}
          {loadingPreview ? 'Buscando…' : 'Importar cardápio do iFood'}
        </button>
      </div>

      {/* Not connected notice */}
      {notConnected && (
        <div
          style={{
            ...S.card,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderColor: 'var(--tf-red-bd)',
            background: 'var(--tf-red-bg)',
          }}
        >
          <AlertCircle size={18} style={{ color: 'var(--tf-red)', flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-red)', margin: 0 }}>
              Integração iFood não conectada
            </p>
            <p style={{ fontSize: 12, color: 'var(--tf-txt2)', margin: '2px 0 0' }}>
              Acesse{' '}
              <a
                href="/configuracoes/integracoes/ifood"
                style={{ color: 'var(--tf-primary)', textDecoration: 'underline' }}
              >
                Configurações → Integrações → iFood
              </a>{' '}
              para conectar sua conta antes de importar o cardápio.
            </p>
          </div>
        </div>
      )}

      {/* Preview table */}
      {previewItems !== null && (
        <>
          {previewItems.length === 0 ? (
            <div style={{ ...S.card, color: 'var(--tf-txt2)', fontSize: 13 }}>
              Nenhum item encontrado no cardápio do iFood.
            </div>
          ) : (
            <>
              {/* Summary */}
              <p style={{ fontSize: 13, color: 'var(--tf-txt2)', margin: 0 }}>
                {previewItems.length} iten{previewItems.length !== 1 ? 's' : ''} encontrado
                {previewItems.length !== 1 ? 's' : ''} no cardápio iFood.
              </p>

              {/* Table */}
              <div
                style={{
                  border: '1px solid var(--tf-border)',
                  borderRadius: 10,
                  overflow: 'auto',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
                  <thead>
                    <tr
                      style={{
                        background: 'var(--tf-surface)',
                        borderBottom: '1px solid var(--tf-border)',
                      }}
                    >
                      {['Item iFood', 'Categoria', 'Preço', 'Score', 'Ação'].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '11px 14px',
                            textAlign: 'left',
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--tf-txt2)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewItems.map((item, i) => {
                      const st = rowStates[item.ifoodItemId]
                      const isLast = i === previewItems.length - 1
                      return (
                        <tr
                          key={item.ifoodItemId}
                          style={{
                            borderBottom: isLast ? 'none' : '1px solid var(--tf-border)',
                            background:
                              i % 2 === 0 ? 'transparent' : 'var(--tf-surface)',
                          }}
                        >
                          <td
                            style={{
                              padding: '11px 14px',
                              fontSize: 13,
                              fontWeight: 500,
                              color: 'var(--tf-txt)',
                              maxWidth: 220,
                            }}
                          >
                            {item.ifoodItemNome}
                          </td>
                          <td
                            style={{
                              padding: '11px 14px',
                              fontSize: 12,
                              color: 'var(--tf-txt2)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.categoriaNome || '—'}
                          </td>
                          <td
                            style={{
                              padding: '11px 14px',
                              fontSize: 13,
                              color: 'var(--tf-txt)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {formatCurrency(item.preco)}
                          </td>
                          <td
                            style={{
                              padding: '11px 14px',
                              fontSize: 12,
                              color: 'var(--tf-txt2)',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.score != null ? `${Math.round(item.score * 100)}%` : '—'}
                          </td>
                          <td style={{ padding: '8px 14px', minWidth: 240 }}>
                            {st && (
                              <AcaoControl
                                item={item}
                                state={st}
                                produtos={produtos}
                                onChange={(patch) => updateRow(item.ifoodItemId, patch)}
                              />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Import button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button
                  onClick={handleImport}
                  disabled={importing || actionableCount === 0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 24px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'var(--tf-primary)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: importing || actionableCount === 0 ? 'not-allowed' : 'pointer',
                    opacity: importing || actionableCount === 0 ? 0.6 : 1,
                  }}
                >
                  {importing && (
                    <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
                  )}
                  {importing ? 'Importando…' : `Importar selecionados (${actionableCount})`}
                </button>
                {actionableCount === 0 && !importing && (
                  <span style={{ fontSize: 12, color: 'var(--tf-txt2)' }}>
                    Nenhum item selecionado para importar (todos já vinculados ou ignorados).
                  </span>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* Initial empty state */}
      {previewItems === null && !notConnected && !loadingPreview && (
        <div style={{ ...S.card, color: 'var(--tf-txt2)', fontSize: 13 }}>
          Clique em <strong style={{ color: 'var(--tf-txt)' }}>&quot;Importar cardápio do iFood&quot;</strong> para buscar os itens do seu cardápio e configurar como eles serão importados.
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
