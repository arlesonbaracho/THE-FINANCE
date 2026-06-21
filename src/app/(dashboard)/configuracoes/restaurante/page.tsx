'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Trash2, Edit2, Check, X, LayoutGrid, Table2, Settings, FileText, ShieldCheck, Receipt } from 'lucide-react'
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

type Tab = 'ambientes' | 'mesas' | 'config' | 'cnpj' | 'certificado' | 'nfce'

// ── Helpers ───────────────────────────────────────────────────────────────────

function maskCnpj(v: string) {
  return v.replace(/\D/g, '').slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

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

// ── CNPJ ──────────────────────────────────────────────────────────────────────

function CnpjTab({ cnpjAtual, reload }: { cnpjAtual: string | null; reload: () => void }) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  if (cnpjAtual) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
        <div style={S.card}>
          <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>CNPJ da Empresa</h3>
          <p style={{ fontSize: 13, color: 'var(--tf-txt2)', marginBottom: 12 }}>
            O CNPJ já está cadastrado. Para alterá-lo entre em contato com o suporte.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: 1,
              color: 'var(--tf-txt)',
              background: 'var(--tf-bg)',
              border: '1px solid var(--tf-border)',
              borderRadius: 6,
              padding: '7px 14px',
            }}>{cnpjAtual}</span>
          </div>
        </div>
      </div>
    )
  }

  async function save() {
    setFieldError(null)
    setSaving(true)
    const r = await fetch('/api/configuracoes/cnpj', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cnpj: value }),
    })
    setSaving(false)
    if (!r.ok) {
      const data = await r.json()
      setFieldError(data.error ?? 'Erro ao salvar CNPJ')
      return
    }
    toast.success('CNPJ cadastrado com sucesso')
    setValue('')
    reload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
      <div style={S.card}>
        <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>CNPJ da Empresa</h3>
        <p style={{ fontSize: 13, color: 'var(--tf-txt2)', marginBottom: 16 }}>
          Informe o CNPJ para habilitar recursos fiscais. Ele será validado junto à Receita Federal.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Label style={{ fontSize: 12, color: 'var(--tf-txt2)' }}>CNPJ</Label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input
              placeholder="00.000.000/0000-00"
              value={value}
              onChange={(e) => { setValue(maskCnpj(e.target.value)); setFieldError(null) }}
              onKeyDown={(e) => e.key === 'Enter' && !saving && save()}
              style={{ maxWidth: 220 }}
              autoComplete="off"
            />
            <Button onClick={save} disabled={saving || value.replace(/\D/g, '').length < 14} size="sm">
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
          {fieldError && (
            <p style={{ fontSize: 12, color: 'var(--tf-red)', margin: 0 }}>{fieldError}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Certificado Digital ───────────────────────────────────────────────────────

type CertificadoStatus = {
  certificadoStatus: string | null
  certificadoValidade: string | null
  ultimaSincronizacaoNf: string | null
}

function CertificadoTab({ status, reload }: { status: CertificadoStatus | null; reload: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [senha, setSenha] = useState('')
  const [saving, setSaving] = useState(false)

  function formatDateBR(d: string | null) {
    if (!d) return null
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d))
  }

  function readAsBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // strip data URL prefix: "data:...;base64,"
        const b64 = result.split(',')[1] ?? result
        resolve(b64)
      }
      reader.onerror = reject
      reader.readAsDataURL(f)
    })
  }

  async function salvar() {
    if (!file || !senha) return
    setSaving(true)
    try {
      const certificadoBase64 = await readAsBase64(file)
      const r = await fetch('/api/fiscal/certificado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certificadoBase64, senha }),
      })
      if (!r.ok) {
        const data = await r.json()
        toast.error(data.error ?? 'Erro ao salvar certificado.')
        return
      }
      const result = await r.json()
      const validadeStr = result.validade
        ? ` Validade: ${formatDateBR(result.validade)}.`
        : ''
      toast.success(`Certificado registrado com sucesso.${validadeStr}`)
      setFile(null)
      setSenha('')
      reload()
    } finally {
      setSaving(false)
    }
  }

  const hasValidCert = status?.certificadoStatus === 'ATIVO'
  const certExpired = status?.certificadoValidade
    ? new Date(status.certificadoValidade) < new Date()
    : false

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
      {/* Current status */}
      {status?.certificadoStatus && (
        <div style={S.card}>
          <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Status do Certificado</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--tf-txt2)', minWidth: 80 }}>Situação:</span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                background: hasValidCert && !certExpired ? 'var(--tf-green-ok-bg)' : 'var(--tf-red-bg)',
                color: hasValidCert && !certExpired ? 'var(--tf-green-ok)' : 'var(--tf-red)',
                border: `1px solid ${hasValidCert && !certExpired ? 'var(--tf-green-ok-bd)' : 'var(--tf-red-bd)'}`,
              }}>
                {certExpired ? 'Vencido' : (status.certificadoStatus ?? '—')}
              </span>
            </div>
            {status.certificadoValidade && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--tf-txt2)', minWidth: 80 }}>Validade:</span>
                <span style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: certExpired ? 'var(--tf-red)' : 'var(--tf-txt)',
                }}>
                  {formatDateBR(status.certificadoValidade)}
                  {certExpired && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--tf-red)' }}>(vencido)</span>}
                </span>
              </div>
            )}
            {status.ultimaSincronizacaoNf && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--tf-txt2)', minWidth: 80 }}>Últ. sync:</span>
                <span style={{ fontSize: 13, color: 'var(--tf-txt2)' }}>
                  {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(status.ultimaSincronizacaoNf))}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload form */}
      <div style={S.card}>
        <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
          {status?.certificadoStatus ? 'Renovar Certificado .pfx' : 'Carregar Certificado .pfx'}
        </h3>
        <p style={{ fontSize: 13, color: 'var(--tf-txt2)', marginBottom: 16 }}>
          Selecione o arquivo <strong>.pfx</strong> do certificado digital A1 e informe a senha.
          O certificado é enviado de forma segura e criptografado em repouso.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Label style={{ fontSize: 12, color: 'var(--tf-txt2)', marginBottom: 4, display: 'block' }}>
              Arquivo .pfx
            </Label>
            <input
              type="file"
              accept=".pfx,.p12"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={{
                ...S.input,
                padding: '6px 10px',
                cursor: 'pointer',
              }}
            />
            {file && (
              <p style={{ fontSize: 12, color: 'var(--tf-txt2)', marginTop: 4 }}>
                Selecionado: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>
          <div>
            <Label style={{ fontSize: 12, color: 'var(--tf-txt2)', marginBottom: 4, display: 'block' }}>
              Senha do certificado
            </Label>
            <Input
              type="password"
              placeholder="Senha do .pfx"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !saving && salvar()}
              autoComplete="new-password"
              style={{ maxWidth: 260 }}
            />
          </div>
          <Button
            onClick={salvar}
            disabled={saving || !file || !senha}
            size="sm"
            style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ShieldCheck size={14} />
            {saving ? 'Salvando…' : 'Salvar certificado'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── NFC-e Config ──────────────────────────────────────────────────────────────

type NfceConfig = {
  regimeTributario: string | null
  inscricaoEstadual: string | null
  cscIdNfce: string | null
  serieNfce: number | null
  nfceAutomatica: boolean
  ncmPadrao: string | null
  cfopPadrao: string | null
  cstCsosnPadrao: string | null
  origemMercadoriaPadrao: string | null
  cscConfigurado: boolean
}

function NfceTab({ config, reload }: { config: NfceConfig | null; reload: () => void }) {
  const [regime, setRegime]           = useState(config?.regimeTributario ?? '')
  const [ie, setIe]                   = useState(config?.inscricaoEstadual ?? '')
  const [serie, setSerie]             = useState(String(config?.serieNfce ?? '1'))
  const [automatica, setAutomatica]   = useState(config?.nfceAutomatica ?? false)
  const [csc, setCsc]                 = useState('')
  const [cscId, setCscId]             = useState(config?.cscIdNfce ?? '')
  const [ncm, setNcm]                 = useState(config?.ncmPadrao ?? '')
  const [cfop, setCfop]               = useState(config?.cfopPadrao ?? '')
  const [cst, setCst]                 = useState(config?.cstCsosnPadrao ?? '')
  const [origem, setOrigem]           = useState(config?.origemMercadoriaPadrao ?? '')
  const [saving, setSaving]           = useState(false)

  useEffect(() => {
    if (!config) return
    setRegime(config.regimeTributario ?? '')
    setIe(config.inscricaoEstadual ?? '')
    setSerie(String(config.serieNfce ?? '1'))
    setAutomatica(config.nfceAutomatica ?? false)
    setCscId(config.cscIdNfce ?? '')
    setNcm(config.ncmPadrao ?? '')
    setCfop(config.cfopPadrao ?? '')
    setCst(config.cstCsosnPadrao ?? '')
    setOrigem(config.origemMercadoriaPadrao ?? '')
  }, [config])

  async function save() {
    setSaving(true)
    const body: Record<string, string | number | boolean | undefined> = {
      regimeTributario: regime || undefined,
      inscricaoEstadual: ie || undefined,
      cscIdNfce: cscId || undefined,
      serieNfce: parseInt(serie, 10) || 1,
      nfceAutomatica: automatica,
      ncmPadrao: ncm || undefined,
      cfopPadrao: cfop || undefined,
      cstCsosnPadrao: cst || undefined,
      origemMercadoriaPadrao: origem || undefined,
    }
    // Only include CSC if user typed a value
    if (csc.trim().length > 0) body.cscNfce = csc

    const r = await fetch('/api/fiscal/config-nfce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!r.ok) { toast.error((await r.json()).error ?? 'Erro ao salvar'); return }
    toast.success('Configuração NFC-e salva')
    setCsc('')
    reload()
  }

  const selectStyle: React.CSSProperties = {
    ...S.input,
    height: 34,
    cursor: 'pointer',
    appearance: 'auto',
  }

  const toggleBtn: (on: boolean) => React.CSSProperties = (on) => ({
    width: 42,
    height: 22,
    borderRadius: 11,
    background: on ? 'var(--tf-primary)' : 'var(--tf-border)',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    flexShrink: 0,
    transition: 'background 0.2s',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 540 }}>
      <div style={S.card}>
        <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Regime e Inscrição</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Label style={{ fontSize: 12, color: 'var(--tf-txt2)', display: 'block', marginBottom: 4 }}>Regime Tributário</Label>
            <select value={regime} onChange={(e) => setRegime(e.target.value)} style={selectStyle}>
              <option value="">Selecione…</option>
              <option value="SIMPLES_NACIONAL">Simples Nacional</option>
              <option value="NORMAL">Lucro Presumido / Real</option>
            </select>
          </div>
          <div>
            <Label style={{ fontSize: 12, color: 'var(--tf-txt2)', display: 'block', marginBottom: 4 }}>Inscrição Estadual</Label>
            <input
              type="text"
              value={ie}
              onChange={(e) => setIe(e.target.value)}
              placeholder="Ex: 123456789"
              style={S.input}
              maxLength={20}
            />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Label style={{ fontSize: 12, color: 'var(--tf-txt2)', display: 'block', marginBottom: 4 }}>Série NFC-e</Label>
              <input
                type="number"
                min={1}
                max={999}
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
                style={{ ...S.input, width: 90 }}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                <button
                  role="switch"
                  aria-checked={automatica}
                  onClick={() => setAutomatica((v) => !v)}
                  style={toggleBtn(automatica)}
                >
                  <span style={{
                    position: 'absolute',
                    top: 3,
                    left: automatica ? 22 : 3,
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    background: '#fff',
                    transition: 'left 0.2s',
                  }} />
                </button>
                <Label style={{ fontSize: 13 }}>Emissão automática</Label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={S.card}>
        <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>CSC (Código de Segurança do Contribuinte)</h3>
        <p style={{ fontSize: 12, color: 'var(--tf-txt2)', marginBottom: 14 }}>
          O CSC é exigido pela SEFAZ para emissão de NFC-e. Ele é armazenado de forma criptografada.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <Label style={{ fontSize: 12, color: 'var(--tf-txt2)', display: 'block', marginBottom: 4 }}>CSC</Label>
            <input
              type="password"
              autoComplete="new-password"
              value={csc}
              onChange={(e) => setCsc(e.target.value)}
              placeholder={config?.cscConfigurado ? '● configurado — deixe em branco para manter' : 'Cole o CSC da SEFAZ'}
              style={S.input}
              maxLength={200}
            />
          </div>
          <div>
            <Label style={{ fontSize: 12, color: 'var(--tf-txt2)', display: 'block', marginBottom: 4 }}>ID do CSC</Label>
            <input
              type="text"
              value={cscId}
              onChange={(e) => setCscId(e.target.value)}
              placeholder="Ex: 000001"
              style={S.input}
              maxLength={10}
            />
          </div>
        </div>
      </div>

      <div style={S.card}>
        <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Padrões Fiscais</h3>
        <p style={{ fontSize: 12, color: 'var(--tf-txt2)', marginBottom: 14 }}>
          Valores usados quando o produto não tem campo fiscal preenchido.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <Label style={{ fontSize: 12, color: 'var(--tf-txt2)', display: 'block', marginBottom: 4 }}>NCM padrão</Label>
            <input type="text" value={ncm} onChange={(e) => setNcm(e.target.value)} placeholder="Ex: 21069090" style={S.input} maxLength={12} />
          </div>
          <div>
            <Label style={{ fontSize: 12, color: 'var(--tf-txt2)', display: 'block', marginBottom: 4 }}>CFOP padrão</Label>
            <input type="text" value={cfop} onChange={(e) => setCfop(e.target.value)} placeholder="Ex: 5102" style={S.input} maxLength={6} />
          </div>
          <div>
            <Label style={{ fontSize: 12, color: 'var(--tf-txt2)', display: 'block', marginBottom: 4 }}>CST / CSOSN padrão</Label>
            <input type="text" value={cst} onChange={(e) => setCst(e.target.value)} placeholder="Ex: 102" style={S.input} maxLength={5} />
          </div>
          <div>
            <Label style={{ fontSize: 12, color: 'var(--tf-txt2)', display: 'block', marginBottom: 4 }}>Origem mercadoria padrão</Label>
            <select value={origem} onChange={(e) => setOrigem(e.target.value)} style={selectStyle}>
              <option value="">Selecione…</option>
              <option value="0">0 — Nacional</option>
              <option value="1">1 — Estrangeira (importação direta)</option>
              <option value="2">2 — Estrangeira (adquirida no mercado interno)</option>
            </select>
          </div>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        style={{
          alignSelf: 'flex-start',
          padding: '8px 20px',
          background: 'var(--tf-primary)',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          fontSize: 14,
          fontWeight: 600,
          cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? 'Salvando…' : 'Salvar configuração NFC-e'}
      </button>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RestaurantePage() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN'
  const [tab, setTab] = useState<Tab>('ambientes')

  const { data: ambientes = [], isLoading: loadingA } = useQuery<Ambiente[]>({
    queryKey: ['ambientes'],
    queryFn: () => fetch('/api/ambientes').then(r => r.json()),
    staleTime: 5 * 60_000,
  })
  const { data: mesas = [], isLoading: loadingM } = useQuery<Mesa[]>({
    queryKey: ['mesas'],
    queryFn: () => fetch('/api/mesas').then(r => r.json()),
    staleTime: 5 * 60_000,
  })
  const { data: config = null, isLoading: loadingC } = useQuery<ConfigPdv | null>({
    queryKey: ['config-pdv'],
    queryFn: () => fetch('/api/config-pdv').then(r => r.json()).catch(() => null),
    staleTime: 10 * 60_000,
  })
  const { data: cnpjData, isLoading: loadingCnpj } = useQuery<{ cnpj: string | null }>({
    queryKey: ['configuracoes-cnpj'],
    queryFn: () => fetch('/api/configuracoes/cnpj').then(r => r.json()),
    staleTime: 30 * 60_000,
    enabled: isAdmin,
  })
  const { data: certData, isLoading: loadingCert } = useQuery<CertificadoStatus>({
    queryKey: ['fiscal-certificado'],
    queryFn: () => fetch('/api/fiscal/certificado').then(r => r.json()),
    staleTime: 10 * 60_000,
    enabled: isAdmin,
  })
  const { data: nfceData, isLoading: loadingNfce } = useQuery<NfceConfig>({
    queryKey: ['config-nfce'],
    queryFn: () => fetch('/api/fiscal/config-nfce').then(r => r.json()),
    staleTime: 10 * 60_000,
    enabled: isAdmin,
  })

  const loading = loadingA || loadingM || loadingC || (tab === 'cnpj' && loadingCnpj) || (tab === 'certificado' && loadingCert) || (tab === 'nfce' && loadingNfce)

  const reload = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['ambientes'] })
    queryClient.invalidateQueries({ queryKey: ['mesas'] })
    queryClient.invalidateQueries({ queryKey: ['config-pdv'] })
    queryClient.invalidateQueries({ queryKey: ['configuracoes-cnpj'] })
    queryClient.invalidateQueries({ queryKey: ['fiscal-certificado'] })
    queryClient.invalidateQueries({ queryKey: ['config-nfce'] })
  }, [queryClient])

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'ambientes', label: 'Ambientes', icon: <LayoutGrid size={15} /> },
    { key: 'mesas', label: 'Mesas', icon: <Table2 size={15} /> },
    { key: 'config', label: 'Configurações PDV', icon: <Settings size={15} /> },
    // CNPJ e Certificado são configurações fiscais — visíveis apenas para administradores
    ...(isAdmin ? [{ key: 'cnpj' as Tab, label: 'CNPJ', icon: <FileText size={15} /> }] : []),
    ...(isAdmin ? [{ key: 'certificado' as Tab, label: 'Certificado Digital', icon: <ShieldCheck size={15} /> }] : []),
    ...(isAdmin ? [{ key: 'nfce' as Tab, label: 'NFC-e', icon: <Receipt size={15} /> }] : []),
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
          {tab === 'cnpj' && isAdmin && <CnpjTab cnpjAtual={cnpjData?.cnpj ?? null} reload={reload} />}
          {tab === 'certificado' && isAdmin && <CertificadoTab status={certData ?? null} reload={reload} />}
          {tab === 'nfce' && isAdmin && <NfceTab config={nfceData ?? null} reload={reload} />}
        </>
      )}
    </div>
  )
}
