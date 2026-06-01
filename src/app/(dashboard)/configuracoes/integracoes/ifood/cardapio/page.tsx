'use client'

import { useState, useEffect } from 'react'
import { Save, Loader2 } from 'lucide-react'

type IFoodItemRow = {
  id: string
  name: string
  price: number
  categoryName?: string
  available: boolean
  produtoId: string | null
}

type Produto = { id: string; name: string; salePrice: number }

export default function IFoodCardapioPage() {
  const [itens, setItens] = useState<IFoodItemRow[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [mapeamentos, setMapeamentos] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/integracoes/ifood/cardapio')
      .then((r) => r.json())
      .then((d) => {
        const itemList: IFoodItemRow[] = d.itens ?? []
        setItens(itemList)
        setProdutos(d.produtos ?? [])
        const initial: Record<string, string | null> = {}
        for (const item of itemList) initial[item.id] = item.produtoId
        setMapeamentos(initial)
      })
      .catch(() => setError('Erro ao carregar cardápio'))
      .finally(() => setLoading(false))
  }, [])

  async function salvar() {
    setSaving(true); setSaved(false)
    try {
      const mappings = itens.map((item) => ({
        ifoodItemId: item.id,
        ifoodItemNome: item.name,
        produtoId: mapeamentos[item.id] ?? null,
      }))
      const res = await fetch('/api/integracoes/ifood/cardapio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--tf-txt2)' }}>Carregando cardápio...</div>

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 4 }}>Mapeamento de Cardápio — iFood</h1>
          <p style={{ fontSize: 13, color: 'var(--tf-txt3)' }}>Vincule cada item do iFood ao produto correspondente no The Finance.</p>
        </div>
        <button onClick={salvar} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--tf-primary)', color: '#fff', fontWeight: 600, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Save size={14} />}
          {saving ? 'Salvando...' : saved ? 'Salvo ✓' : 'Salvar mapeamentos'}
        </button>
      </div>
      {error && <p style={{ fontSize: 13, color: 'var(--tf-red)', marginBottom: 16 }}>{error}</p>}
      <div style={{ border: '1px solid var(--tf-border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--tf-surface)', borderBottom: '1px solid var(--tf-border)' }}>
              {['Item iFood', 'Categoria', 'Preço iFood', 'Produto THE FINANCE', 'Status'].map((h) => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--tf-txt3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {itens.map((item, i) => {
              const mapeado = !!mapeamentos[item.id]
              return (
                <tr key={item.id} style={{ borderBottom: i < itens.length - 1 ? '1px solid var(--tf-border)' : 'none', background: i % 2 === 0 ? 'transparent' : 'var(--tf-surface)' }}>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--tf-txt)', fontWeight: 500 }}>{item.name}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--tf-txt3)' }}>{item.categoryName ?? '—'}</td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--tf-txt2)' }}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}</td>
                  <td style={{ padding: '8px 14px' }}>
                    <select value={mapeamentos[item.id] ?? ''} onChange={(e) => setMapeamentos((prev) => ({ ...prev, [item.id]: e.target.value || null }))} style={{ width: '100%', maxWidth: 240, padding: '6px 10px', borderRadius: 7, border: '1px solid var(--tf-border)', background: 'var(--tf-surface2)', color: 'var(--tf-txt)', fontSize: 12 }}>
                      <option value="">Selecionar produto...</option>
                      {produtos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    {mapeado
                      ? <span style={{ fontSize: 11, fontWeight: 700, color: '#2a9d6f', background: '#0d2b1f', border: '1px solid #2a9d6f', padding: '2px 8px', borderRadius: 10 }}>Mapeado</span>
                      : <span style={{ fontSize: 11, fontWeight: 700, color: '#e05252', background: '#1f0a0a', border: '1px solid #e05252', padding: '2px 8px', borderRadius: 10 }}>Não mapeado</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
