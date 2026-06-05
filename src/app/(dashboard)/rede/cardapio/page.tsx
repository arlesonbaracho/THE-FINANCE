'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'

interface Produto { id: string; name: string; salePrice: number }
interface Unidade { id: string; name: string }
interface Override { tenantId: string; produtoId: string; preco: number | null; ativo: boolean }

export default function RedeCardapioPage() {
  const [tab, setTab] = useState<'rede' | 'overrides'>('rede')
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [unidades, setUnidades] = useState<Unidade[]>([])
  const [unidadeSel, setUnidadeSel] = useState('')
  const [overrides, setOverrides] = useState<Override[]>([])
  const [showModal, setShowModal] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novoPreco, setNovoPreco] = useState('')

  useEffect(() => {
    fetch('/api/rede/cardapio').then((r) => r.json()).then(setProdutos)
    fetch('/api/rede/unidades').then((r) => r.json()).then((d: Unidade[]) => {
      setUnidades(d)
      if (d.length > 0) setUnidadeSel(d[0].id)
    })
  }, [])

  async function criarProduto() {
    await fetch('/api/rede/cardapio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: novoNome, salePrice: parseFloat(novoPreco) || 0 }),
    })
    fetch('/api/rede/cardapio').then((r) => r.json()).then(setProdutos)
    setShowModal(false)
    setNovoNome('')
    setNovoPreco('')
  }

  async function sincronizarPreco(produtoId: string) {
    for (const u of unidades) {
      await fetch('/api/rede/cardapio/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: u.id, produtoId, preco: null }),
      })
    }
  }

  async function salvarOverride(tenantId: string, produtoId: string, preco: string, ativo: boolean) {
    await fetch('/api/rede/cardapio/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, produtoId, preco: preco ? parseFloat(preco) : null, ativo }),
    })
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 20px',
    borderRadius: '8px 8px 0 0',
    border: '1px solid var(--tf-border)',
    borderBottom: active ? '1px solid var(--tf-surface)' : '1px solid var(--tf-border)',
    background: active ? 'var(--tf-surface)' : 'transparent',
    color: active ? 'var(--tf-txt)' : 'var(--tf-txt3)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    marginBottom: -1,
  })

  const th: React.CSSProperties = {
    textAlign: 'left',
    padding: '8px 12px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--tf-txt3)',
    borderBottom: '1px solid var(--tf-border)',
  }
  const td: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: 13,
    color: 'var(--tf-txt)',
    borderBottom: '1px solid var(--tf-border)',
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', margin: 0 }}>Cardápio da Rede</h1>
        {tab === 'rede' && (
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              background: 'var(--tf-primary, #6366f1)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            <Plus className="w-4 h-4" /> Novo produto da rede
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 0 }}>
        <button style={tabStyle(tab === 'rede')} onClick={() => setTab('rede')}>Cardápio da rede</button>
        <button style={tabStyle(tab === 'overrides')} onClick={() => setTab('overrides')}>Overrides por unidade</button>
      </div>

      <div
        style={{
          background: 'var(--tf-surface)',
          border: '1px solid var(--tf-border)',
          borderRadius: '0 8px 8px 8px',
          padding: 20,
        }}
      >
        {tab === 'rede' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Nome</th>
                <th style={th}>Preço base</th>
                <th style={th}>Sincronizar preço</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => (
                <tr key={p.id}>
                  <td style={td}>{p.name}</td>
                  <td style={td}>R$ {p.salePrice.toFixed(2)}</td>
                  <td style={td}>
                    <button
                      onClick={() => sincronizarPreco(p.id)}
                      style={{
                        fontSize: 11,
                        padding: '3px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--tf-border)',
                        background: 'transparent',
                        color: 'var(--tf-txt3)',
                        cursor: 'pointer',
                      }}
                    >
                      Sincronizar
                    </button>
                  </td>
                </tr>
              ))}
              {produtos.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ ...td, color: 'var(--tf-txt3)', textAlign: 'center', padding: 32 }}>
                    Nenhum produto compartilhado. Crie o primeiro usando o botão acima.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {tab === 'overrides' && (
          <div>
            <select
              value={unidadeSel}
              onChange={(e) => setUnidadeSel(e.target.value)}
              style={{
                marginBottom: 16,
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--tf-border)',
                background: 'var(--tf-surface)',
                color: 'var(--tf-txt)',
                fontSize: 13,
              }}
            >
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Produto</th>
                  <th style={th}>Preço base</th>
                  <th style={th}>Preço override</th>
                  <th style={th}>Ativo</th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((p) => {
                  const ov = overrides.find((o) => o.tenantId === unidadeSel && o.produtoId === p.id)
                  return (
                    <tr key={p.id}>
                      <td style={td}>{p.name}</td>
                      <td style={{ ...td, color: 'var(--tf-txt3)' }}>R$ {p.salePrice.toFixed(2)}</td>
                      <td style={td}>
                        <input
                          defaultValue={ov?.preco?.toString() ?? ''}
                          onBlur={(e) =>
                            salvarOverride(unidadeSel, p.id, e.target.value, ov?.ativo ?? true)
                          }
                          placeholder="Sem override"
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: '1px solid var(--tf-border)',
                            background: 'transparent',
                            color: 'var(--tf-txt)',
                            fontSize: 13,
                            width: 120,
                          }}
                        />
                      </td>
                      <td style={td}>
                        <input
                          type="checkbox"
                          defaultChecked={ov?.ativo ?? true}
                          onChange={(e) =>
                            salvarOverride(unidadeSel, p.id, ov?.preco?.toString() ?? '', e.target.checked)
                          }
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal novo produto */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: 'var(--tf-surface)',
              borderRadius: 12,
              padding: 32,
              minWidth: 360,
              border: '1px solid var(--tf-border)',
            }}
          >
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, marginTop: 0, color: 'var(--tf-txt)' }}>
              Novo produto da rede
            </h2>
            <label style={{ fontSize: 12, color: 'var(--tf-txt3)', display: 'block', marginBottom: 4 }}>
              Nome
            </label>
            <input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--tf-border)',
                background: 'transparent',
                color: 'var(--tf-txt)',
                fontSize: 13,
                marginBottom: 16,
                boxSizing: 'border-box',
              }}
            />
            <label style={{ fontSize: 12, color: 'var(--tf-txt3)', display: 'block', marginBottom: 4 }}>
              Preço base (R$)
            </label>
            <input
              type="number"
              value={novoPreco}
              onChange={(e) => setNovoPreco(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid var(--tf-border)',
                background: 'transparent',
                color: 'var(--tf-txt)',
                fontSize: 13,
                marginBottom: 24,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--tf-border)',
                  background: 'transparent',
                  color: 'var(--tf-txt)',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={criarProduto}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  background: 'var(--tf-primary, #6366f1)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
