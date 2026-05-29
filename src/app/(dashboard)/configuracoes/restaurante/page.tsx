'use client'

import { useEffect, useState, useCallback } from 'react'
import { fetchCached, invalidateCache } from '@/lib/client-cache'
import { toast } from 'sonner'
import { Plus, Trash2, Edit2, Check, X, LayoutGrid, Table2, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ── Types ─────────────────────────────────────────────────────────────────────

type Ambiente = { id: string; nome: string; ordem: number; _count: { mesas: number } }
type Mesa = { id: string; numero: number; identificacao: string | null; cadeiras: number; status: string; ambienteId: string | null }
type ConfigPdv = {
  taxaServico: number
  taxaServicoAtiva: boolean
  couvert: number | null
  taxaEntrega: number | null
  formasPagamento: string[]
}

type Tab = 'ambientes' | 'mesas' | 'config'

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  card: {
    background: 'var(--tf-surface)',
    border: '1px solid var(--tf-border)',
    borderRadius: 10,
    padding: '16px 14px',
  } as React.CSSProperties,
  input: {
    background: 'var(--tf-bg)',
    border: '1px solid var(--tf-border)',
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 13,
    color: 'var(--tf-txt)',
    outline: 'none',
    width: '100%',
  } as React.CSSProperties,
}

function statusColor(s: string) {
  if (s === 'LIVRE') return '#2a9d6f'
  if (s === 'OCUPADA') return '#d97706'
  return '#6d4fc2'
}

// ── Ambientes ─────────────────────────────────────────────────────────────────

function AmbientesTab({ ambientes, reload }: { ambientes: Ambiente[]; reload: () => void }) {
  const [newNome, setNewNome] = useState('')
  const [creating, setCreating] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')

  async function create() {
    if (!newNome.trim()) return
    setCreating(true)
    const r = await fetch('/api/ambientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: newNome.trim() }),
    })
    setCreating(false)
    if (!r.ok) { toast.error((await r.json()).error ?? 'Erro ao criar ambiente'); return }
    setNewNome('')
    toast.success('Ambiente criado')
    reload()
  }

  async function update(id: string) {
    if (!editNome.trim()) return
    const r = await fetch(`/api/ambientes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: editNome.trim() }),
    })
    if (!r.ok) { toast.error((await r.json()).error ?? 'Erro ao editar'); return }
    setEditId(null)
    toast.success('Ambiente atualizado')
    reload()
  }

  async function remove(id: string) {
    const r = await fetch(`/api/ambientes/${id}`, { method: 'DELETE' })
    if (!r.ok) { toast.error((await r.json()).error ?? 'Erro ao excluir'); return }
    toast.success('Ambiente excluído')
    reload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Create */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Input
          placeholder="Nome do ambiente (ex: Salão, Varanda…)"
          value={newNome}
          onChange={(e) => setNewNome(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          style={{ maxWidth: 320 }}
        />
        <Button onClick={create} disabled={creating || !newNome.trim()} size="sm">
          <Plus size={15} style={{ marginRight: 4 }} /> Criar
        </Button>
      </div>

      {ambientes.length === 0 && (
        <p style={{ color: 'var(--tf-txt2)', fontSize: 13 }}>Nenhum ambiente criado. Crie um para organizar as mesas.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ambientes.map((a) => (
          <div key={a.id} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 12 }}>
            {editId === a.id ? (
              <>
                <Input
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') update(a.id); if (e.key === 'Escape') setEditId(null) }}
                  style={{ maxWidth: 260 }}
                  autoFocus
                />
                <button onClick={() => update(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2a9d6f' }}><Check size={16} /></button>
                <button onClick={() => setEditId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tf-txt2)' }}><X size={16} /></button>
              </>
            ) : (
              <>
                <LayoutGrid size={16} style={{ color: 'var(--tf-txt2)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{a.nome}</span>
                <span style={{ fontSize: 12, color: 'var(--tf-txt2)' }}>{a._count.mesas} mesa{a._count.mesas !== 1 ? 's' : ''}</span>
                <button onClick={() => { setEditId(a.id); setEditNome(a.nome) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tf-txt2)' }}>
                  <Edit2 size={15} />
                </button>
                <button onClick={() => remove(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                  <Trash2 size={15} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Mesas ─────────────────────────────────────────────────────────────────────

function MesasTab({ mesas, ambientes, reload }: { mesas: Mesa[]; ambientes: Ambiente[]; reload: () => void }) {
  const [modo, setModo] = useState<'individual' | 'lote'>('individual')
  const [numero, setNumero] = useState('')
  const [cadeiras, setCadeiras] = useState('4')
  const [ambienteId, setAmbienteId] = useState('')
  const [loteQtd, setLoteQtd] = useState('10')
  const [loteCadeiras, setLoteCadeiras] = useState('4')
  const [loteAmbienteId, setLoteAmbienteId] = useState('')
  const [saving, setSaving] = useState(false)

  async function createIndividual() {
    setSaving(true)
    const r = await fetch('/api/mesas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numero: parseInt(numero),
        cadeiras: parseInt(cadeiras),
        ambienteId: ambienteId || undefined,
      }),
    })
    setSaving(false)
    if (!r.ok) { toast.error((await r.json()).error ?? 'Erro ao criar mesa'); return }
    setNumero('')
    toast.success('Mesa criada')
    reload()
  }

  async function createLote() {
    const qty = parseInt(loteQtd)
    if (isNaN(qty) || qty < 1) return
    setSaving(true)
    const nextNum = mesas.length > 0 ? Math.max(...mesas.map((m) => m.numero)) + 1 : 1
    const batch = Array.from({ length: qty }, (_, i) => ({
      numero: nextNum + i,
      cadeiras: parseInt(loteCadeiras),
      ambienteId: loteAmbienteId || undefined,
    }))
    const r = await fetch('/api/mesas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    })
    setSaving(false)
    if (!r.ok) { toast.error((await r.json()).error ?? 'Erro ao criar mesas'); return }
    toast.success(`${qty} mesa${qty > 1 ? 's' : ''} criada${qty > 1 ? 's' : ''}`)
    reload()
  }

  async function remove(id: string) {
    const r = await fetch(`/api/mesas/${id}`, { method: 'DELETE' })
    if (!r.ok) { toast.error((await r.json()).error ?? 'Não foi possível excluir'); return }
    toast.success('Mesa excluída')
    reload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['individual', 'lote'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setModo(m)}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: '1px solid var(--tf-border)',
              background: modo === m ? 'var(--tf-primary)' : 'var(--tf-surface)',
              color: modo === m ? '#fff' : 'var(--tf-txt)',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: modo === m ? 600 : 400,
            }}
          >
            {m === 'individual' ? 'Mesa individual' : 'Criar em lote'}
          </button>
        ))}
      </div>

      {modo === 'individual' ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <Label style={{ fontSize: 12, color: 'var(--tf-txt2)' }}>Número</Label>
            <Input type="number" min={1} value={numero} onChange={(e) => setNumero(e.target.value)} style={{ width: 90 }} placeholder="Ex: 1" />
          </div>
          <div>
            <Label style={{ fontSize: 12, color: 'var(--tf-txt2)' }}>Cadeiras</Label>
            <Input type="number" min={1} max={50} value={cadeiras} onChange={(e) => setCadeiras(e.target.value)} style={{ width: 90 }} />
          </div>
          <div>
            <Label style={{ fontSize: 12, color: 'var(--tf-txt2)' }}>Ambiente</Label>
            <select
              value={ambienteId}
              onChange={(e) => setAmbienteId(e.target.value)}
              style={{ ...S.input, width: 180 }}
            >
              <option value="">Sem ambiente</option>
              {ambientes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
          <Button onClick={createIndividual} disabled={saving || !numero} size="sm">
            <Plus size={15} style={{ marginRight: 4 }} /> Criar mesa
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <Label style={{ fontSize: 12, color: 'var(--tf-txt2)' }}>Quantidade</Label>
            <Input type="number" min={1} max={100} value={loteQtd} onChange={(e) => setLoteQtd(e.target.value)} style={{ width: 90 }} />
          </div>
          <div>
            <Label style={{ fontSize: 12, color: 'var(--tf-txt2)' }}>Cadeiras cada</Label>
            <Input type="number" min={1} max={50} value={loteCadeiras} onChange={(e) => setLoteCadeiras(e.target.value)} style={{ width: 90 }} />
          </div>
          <div>
            <Label style={{ fontSize: 12, color: 'var(--tf-txt2)' }}>Ambiente</Label>
            <select
              value={loteAmbienteId}
              onChange={(e) => setLoteAmbienteId(e.target.value)}
              style={{ ...S.input, width: 180 }}
            >
              <option value="">Sem ambiente</option>
              {ambientes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </div>
          <Button onClick={createLote} disabled={saving || !loteQtd} size="sm">
            <Plus size={15} style={{ marginRight: 4 }} /> Criar {loteQtd} mesa{parseInt(loteQtd) !== 1 ? 's' : ''}
          </Button>
        </div>
      )}

      {/* Grid */}
      {mesas.length === 0 && (
        <p style={{ color: 'var(--tf-txt2)', fontSize: 13 }}>Nenhuma mesa criada ainda.</p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
        {mesas.map((m) => (
          <div key={m.id} style={{ ...S.card, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 700, fontSize: 18 }}>#{m.numero}</span>
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                color: statusColor(m.status),
                background: statusColor(m.status) + '22',
                padding: '2px 6px',
                borderRadius: 4,
              }}>{m.status}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--tf-txt2)', margin: '4px 0 0' }}>
              {m.cadeiras} cadeiras
              {m.ambienteId && ambientes.find((a) => a.id === m.ambienteId) && (
                <> · {ambientes.find((a) => a.id === m.ambienteId)!.nome}</>
              )}
            </p>
            {m.status === 'LIVRE' && (
              <button
                onClick={() => remove(m.id)}
                style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', opacity: 0.6 }}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Config PDV ────────────────────────────────────────────────────────────────

const FORMAS = ['DINHEIRO', 'DEBITO', 'CREDITO', 'PIX'] as const
const FORMAS_LABEL: Record<string, string> = { DINHEIRO: 'Dinheiro', DEBITO: 'Débito', CREDITO: 'Crédito', PIX: 'Pix' }

function ConfigTab({ config, reload }: { config: ConfigPdv | null; reload: () => void }) {
  const [taxa, setTaxa] = useState(String(config?.taxaServico ?? 10))
  const [taxaAtiva, setTaxaAtiva] = useState(config?.taxaServicoAtiva ?? false)
  const [couvert, setCouvert] = useState(String(config?.couvert ?? ''))
  const [formas, setFormas] = useState<string[]>(config?.formasPagamento ?? ['DINHEIRO', 'DEBITO', 'CREDITO', 'PIX'])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!config) return
    setTaxa(String(config.taxaServico))
    setTaxaAtiva(config.taxaServicoAtiva)
    setCouvert(config.couvert != null ? String(config.couvert) : '')
    setFormas(config.formasPagamento)
  }, [config])

  function toggleForma(f: string) {
    setFormas((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f])
  }

  async function save() {
    setSaving(true)
    const r = await fetch('/api/config-pdv', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taxaServico: parseFloat(taxa) || 0,
        taxaServicoAtiva: taxaAtiva,
        couvert: couvert ? parseFloat(couvert) : undefined,
        formasPagamento: formas,
      }),
    })
    setSaving(false)
    if (!r.ok) { toast.error((await r.json()).error ?? 'Erro ao salvar'); return }
    toast.success('Configurações salvas')
    reload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 480 }}>
      {/* Taxa de serviço */}
      <div style={S.card}>
        <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Taxa de Serviço</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button
            role="switch"
            aria-checked={taxaAtiva}
            onClick={() => setTaxaAtiva((v) => !v)}
            style={{
              width: 42,
              height: 22,
              borderRadius: 11,
              background: taxaAtiva ? 'var(--tf-primary)' : 'var(--tf-border)',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              flexShrink: 0,
              transition: 'background 0.2s',
            }}
          >
            <span style={{
              position: 'absolute',
              top: 3,
              left: taxaAtiva ? 22 : 3,
              width: 16,
              height: 16,
              borderRadius: 8,
              background: '#fff',
              transition: 'left 0.2s',
            }} />
          </button>
          <Label style={{ fontSize: 13 }}>Cobrar taxa de serviço</Label>
        </div>
        {taxaAtiva && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={taxa}
              onChange={(e) => setTaxa(e.target.value)}
              style={{ width: 90 }}
            />
            <span style={{ fontSize: 13, color: 'var(--tf-txt2)' }}>%</span>
          </div>
        )}
      </div>

      {/* Couvert */}
      <div style={S.card}>
        <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Couvert Artístico</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--tf-txt2)' }}>R$</span>
          <Input
            type="number"
            min={0}
            step={0.5}
            value={couvert}
            onChange={(e) => setCouvert(e.target.value)}
            placeholder="0,00"
            style={{ width: 120 }}
          />
        </div>
        <p style={{ fontSize: 12, color: 'var(--tf-txt2)', marginTop: 6 }}>Deixe em branco para não cobrar couvert.</p>
      </div>

      {/* Formas de pagamento */}
      <div style={S.card}>
        <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Formas de Pagamento</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FORMAS.map((f) => {
            const ativo = formas.includes(f)
            return (
              <button
                key={f}
                onClick={() => toggleForma(f)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: `1px solid ${ativo ? 'var(--tf-primary)' : 'var(--tf-border)'}`,
                  background: ativo ? 'var(--tf-primary)' : 'var(--tf-surface)',
                  color: ativo ? '#fff' : 'var(--tf-txt)',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontWeight: ativo ? 600 : 400,
                }}
              >
                {FORMAS_LABEL[f]}
              </button>
            )
          })}
        </div>
      </div>

      <Button onClick={save} disabled={saving} style={{ alignSelf: 'flex-start' }}>
        {saving ? 'Salvando…' : 'Salvar configurações'}
      </Button>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RestaurantePage() {
  const [tab, setTab] = useState<Tab>('ambientes')
  const [ambientes, setAmbientes] = useState<Ambiente[]>([])
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [config, setConfig] = useState<ConfigPdv | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rA, rM, rC] = await Promise.all([
        fetchCached<Ambiente[]>('/api/ambientes'),
        fetchCached<Mesa[]>('/api/mesas'),
        fetchCached<ConfigPdv>('/api/config-pdv'),
      ])
      setAmbientes(rA)
      setMesas(rM)
      setConfig(rC)
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  const reload = useCallback(() => {
    invalidateCache('/api/ambientes', '/api/mesas', '/api/config-pdv')
    load()
  }, [load])

  useEffect(() => { load() }, [load])

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'ambientes', label: 'Ambientes', icon: <LayoutGrid size={15} /> },
    { key: 'mesas', label: 'Mesas', icon: <Table2 size={15} /> },
    { key: 'config', label: 'Configurações PDV', icon: <Settings size={15} /> },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontWeight: 700, fontSize: 22, margin: 0 }}>Restaurante</h1>
        <p style={{ color: 'var(--tf-txt2)', fontSize: 13, margin: '4px 0 0' }}>
          Gerencie ambientes, mesas e configurações do ponto de venda.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--tf-border)', paddingBottom: 0 }}>
        {TABS.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: 'none',
              border: 'none',
              borderBottom: tab === key ? '2px solid var(--tf-primary)' : '2px solid transparent',
              color: tab === key ? 'var(--tf-primary)' : 'var(--tf-txt2)',
              fontWeight: tab === key ? 600 : 400,
              fontSize: 14,
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--tf-txt2)', fontSize: 13 }}>Carregando…</p>
      ) : (
        <>
          {tab === 'ambientes' && <AmbientesTab ambientes={ambientes} reload={reload} />}
          {tab === 'mesas' && <MesasTab mesas={mesas} ambientes={ambientes} reload={reload} />}
          {tab === 'config' && <ConfigTab config={config} reload={reload} />}
        </>
      )}
    </div>
  )
}
