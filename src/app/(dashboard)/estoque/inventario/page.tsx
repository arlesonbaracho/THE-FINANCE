'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Package,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  ArrowDown,
  ClipboardList,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  TrendingDown,
  BarChart3,
  Download,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import { fetchCached, invalidateCache } from '@/lib/client-cache'
import { StatCard } from '@/components/ui/stat-card'
import type { StockStatus } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Category { id: string; name: string }

interface Ingredient {
  id: string
  name: string
  codigoInterno: string | null
  unit: string
  currentQty: number
  minimumQty: number
  pontoReposicao: number
  unitCost: number
  stockStatus: StockStatus
  category: Category | null
}

type Inventario = {
  id: string
  nome: string
  status: 'ABERTO' | 'FINALIZADO' | 'CANCELADO'
  iniciadoEm: string
  finalizadoEm: string | null
  _count: { items: number }
}

type InventarioItem = {
  id: string
  qtdSistema: number
  qtdContada: number | null
  diferenca: number | null
  observacao: string | null
  ingredient: { id: string; name: string; unit: string; codigoInterno: string | null }
}

type InventarioDetail = Inventario & { items: InventarioItem[] }

// ── Constants ──────────────────────────────────────────────────────────────────

const unitLabels: Record<string, string> = { KG: 'kg', G: 'g', L: 'L', ML: 'ml', UN: 'un' }

const STATUS_STYLES: Record<StockStatus, { label: string; color: string; bg: string; bd: string; icon: LucideIcon }> = {
  ok:       { label: 'OK',        color: 'var(--tf-green-light)', bg: 'var(--tf-accent-bg)',        bd: 'var(--tf-accent-bd)',        icon: CheckCircle  },
  low:      { label: 'Reposição', color: 'var(--tf-yellow)',      bg: 'var(--tf-yellow-bg)',        bd: 'var(--tf-yellow-bd)',        icon: TrendingDown },
  critical: { label: 'Crítico',   color: 'var(--tf-red)',         bg: 'var(--tf-red-bg)',           bd: 'var(--tf-red-bd)',           icon: AlertTriangle },
  expiring: { label: 'Vencendo',  color: '#EA580C',               bg: 'rgba(234,88,12,0.08)',       bd: 'rgba(234,88,12,0.25)',       icon: Clock        },
  expired:  { label: 'Vencido',   color: 'var(--tf-txt3)',        bg: 'var(--tf-input-bg)',         bd: 'var(--tf-border)',           icon: XCircle      },
}

const INV_STATUS = {
  ABERTO:     { label: 'Em andamento', icon: Clock,       iconColor: '#3b82f6',            bg: 'rgba(59,130,246,0.1)',   color: '#3b82f6',            border: '1px solid rgba(59,130,246,0.3)' },
  FINALIZADO: { label: 'Finalizado',   icon: CheckCircle, iconColor: 'var(--tf-green-ok)', bg: 'var(--tf-green-ok-bg)', color: 'var(--tf-green-ok)', border: '1px solid var(--tf-green-ok-bd)' },
  CANCELADO:  { label: 'Cancelado',    icon: XCircle,     iconColor: 'var(--tf-txt3)',     bg: 'var(--tf-input-bg)',    color: 'var(--tf-txt3)',     border: '1px solid var(--tf-border)' },
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcCoverage(current: number, minimum: number): number {
  if (minimum <= 0) return 999
  return Math.min((current / minimum) * 100, 999)
}

function coverageColor(pct: number): string {
  if (pct >= 999) return 'var(--tf-green-light)'
  if (pct >= 60)  return 'var(--tf-green-light)'
  if (pct >= 20)  return 'var(--tf-yellow)'
  return 'var(--tf-red)'
}

function tabStyle(active: boolean): React.CSSProperties {
  return active
    ? { background: 'var(--tf-accent-bg)', color: 'var(--tf-green-light)', border: '1px solid #1e3d2e', borderRadius: 6, padding: '7px 16px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }
    : { background: 'transparent', color: 'var(--tf-muted)', border: '1px solid transparent', borderRadius: 6, padding: '7px 16px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InventarioPage() {
  const [activeTab, setActiveTab] = useState<'stock' | 'counts'>('stock')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const handleFetched = useCallback(() => setLastUpdate(new Date()), [])

  const timestamp = lastUpdate
    ? `Atualizado às ${String(lastUpdate.getHours()).padStart(2, '0')}:${String(lastUpdate.getMinutes()).padStart(2, '0')}`
    : ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--tf-txt)', margin: 0 }}>
          Inventário
        </h1>
        <p style={{ fontSize: 12, color: 'var(--tf-muted)', marginTop: 3 }}>
          Posição do estoque e contagens físicas
        </p>
      </div>

      {/* Tab pill bar + timestamp */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 8, padding: 3, display: 'inline-flex', gap: 2 }}>
          <button style={tabStyle(activeTab === 'stock')} onClick={() => setActiveTab('stock')}>
            <BarChart3 size={13} />
            Posição do Estoque
          </button>
          <button style={tabStyle(activeTab === 'counts')} onClick={() => setActiveTab('counts')}>
            <ClipboardList size={13} />
            Contagens Físicas
          </button>
        </div>
        {timestamp && (
          <span style={{ fontSize: 11, color: 'var(--tf-muted)' }}>{timestamp}</span>
        )}
      </div>

      {/* Content */}
      {activeTab === 'stock'  && <StockPosition onFetched={handleFetched} />}
      {activeTab === 'counts' && <PhysicalCounts />}
    </div>
  )
}

// ── Tab 1: Stock Position ─────────────────────────────────────────────────────

const COLS = '36px 1fr 100px 150px 68px 82px 92px 104px 104px'

function StockPosition({ onFetched }: { onFetched: () => void }) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [entradaTarget, setEntradaTarget] = useState<Ingredient | null>(null)

  const fetchIngredients = useCallback(async () => {
    try {
      const data = await fetchCached<Ingredient[]>('/api/ingredients')
      setIngredients(data)
      onFetched()
    } catch {
      toast.error('Erro ao carregar estoque')
    } finally {
      setLoading(false)
    }
  }, [onFetched])

  useEffect(() => {
    fetchIngredients()
    fetchCached<Category[]>('/api/categories?type=INGREDIENT').then(setCategories).catch(() => {})
  }, [fetchIngredients])

  const filtered = useMemo(() => ingredients.filter(ing => {
    const matchSearch = !search
      || ing.name.toLowerCase().includes(search.toLowerCase())
      || (ing.codigoInterno ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || ing.stockStatus === statusFilter
    const matchCat = categoryFilter === 'all' || ing.category?.id === categoryFilter
    return matchSearch && matchStatus && matchCat
  }), [ingredients, search, statusFilter, categoryFilter])

  const filteredValue = useMemo(
    () => filtered.reduce((s, i) => s + i.currentQty * i.unitCost, 0),
    [filtered],
  )

  const stats = useMemo(() => ({
    total:    ingredients.length,
    ok:       ingredients.filter(i => i.stockStatus === 'ok').length,
    low:      ingredients.filter(i => i.stockStatus === 'low').length,
    critical: ingredients.filter(i => ['critical', 'expired'].includes(i.stockStatus)).length,
    expiring: ingredients.filter(i => i.stockStatus === 'expiring').length,
  }), [ingredients])

  function handleExport() {
    const headers = ['Código', 'Nome', 'Categoria', 'Qtd. Atual', 'Unidade', 'Mínimo', 'Cobertura%', 'Valor (R$)', 'Status']
    const rows = filtered.map(ing => {
      const cov = calcCoverage(ing.currentQty, ing.minimumQty)
      return [
        ing.codigoInterno ?? '',
        ing.name,
        ing.category?.name ?? '',
        ing.currentQty.toFixed(3),
        unitLabels[ing.unit] ?? ing.unit,
        ing.minimumQty.toFixed(3),
        cov >= 999 ? '—' : cov.toFixed(1),
        (ing.currentQty * ing.unitCost).toFixed(2).replace('.', ','),
        STATUS_STYLES[ing.stockStatus].label,
      ].join(';')
    })
    const csv = [headers.join(';'), ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventario-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        <StatCard title="Total de Itens"    value={stats.total}                       icon={Package}       variant="default" />
        <StatCard title="Estoque OK"         value={stats.ok}                          icon={CheckCircle}   variant="success" />
        <StatCard title="Em Reposição"       value={stats.low}                         icon={TrendingDown}  variant="warning" />
        <StatCard title="Crítico / Vencido"  value={stats.critical + stats.expiring}  icon={AlertTriangle} variant="danger"  />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--tf-muted)', pointerEvents: 'none' }} />
          <Input placeholder="Buscar por nome ou código..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
          <SelectTrigger style={{ width: 160 }}><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="ok">OK</SelectItem>
            <SelectItem value="low">Reposição</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
            <SelectItem value="expiring">Vencendo</SelectItem>
            <SelectItem value="expired">Vencido</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v ?? 'all')}>
          <SelectTrigger style={{ width: 180 }}><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={handleExport}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 500, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)', color: 'var(--tf-txt2)', cursor: 'pointer' }}
        >
          <Download size={13} />
          Exportar
        </button>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 10, overflow: 'hidden' }}>
        {/* th */}
        <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '8px 16px', background: 'var(--tf-surface2)', borderBottom: '1px solid var(--tf-border-light)' }}>
          {['#', 'Nome', 'Categoria', 'Qtd. Atual', 'Cobertura', 'Mínimo', 'Valor', 'Status', 'Ações'].map((h, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tf-muted)', textAlign: i >= 4 && i <= 6 ? 'right' : 'left' }}>
              {h}
            </span>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '64px 16px', color: 'var(--tf-muted)' }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span style={{ fontSize: 13 }}>Carregando...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 16px', gap: 8 }}>
            <Package style={{ width: 32, height: 32, color: 'var(--tf-muted)', opacity: 0.3 }} />
            <p style={{ fontSize: 13, color: 'var(--tf-muted)', margin: 0 }}>Nenhum item encontrado</p>
          </div>
        ) : filtered.map((ing, idx) => {
          const s = STATUS_STYLES[ing.stockStatus]
          const StatusIcon = s.icon
          const cov = calcCoverage(ing.currentQty, ing.minimumQty)
          const covColor = coverageColor(cov)
          const isCritical = ['critical', 'expired'].includes(ing.stockStatus)
          const isLast = idx === filtered.length - 1

          return (
            <div
              key={ing.id}
              style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '12px 16px', alignItems: 'center', borderBottom: isLast ? 'none' : '1px solid var(--tf-border-light)', background: 'transparent', transition: 'background 150ms' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'var(--tf-surface2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
            >
              {/* # */}
              <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--tf-muted)' }}>
                {ing.codigoInterno ?? '—'}
              </span>

              {/* Nome */}
              <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--tf-txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ing.name}
              </span>

              {/* Categoria */}
              <span style={{ fontSize: 12, color: 'var(--tf-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ing.category?.name ?? '—'}
              </span>

              {/* Qtd. Atual + mini bar */}
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: covColor }}>
                    {ing.currentQty.toFixed(3)}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--tf-muted)' }}>
                    {unitLabels[ing.unit] ?? ing.unit}
                  </span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--tf-border-row, var(--tf-border))', overflow: 'hidden', marginTop: 4, maxWidth: 120 }}>
                  <div style={{ height: '100%', borderRadius: 2, background: covColor, width: `${Math.min(cov, 100)}%`, transition: 'width 300ms' }} />
                </div>
              </div>

              {/* Cobertura % */}
              <span style={{ fontSize: 13, fontWeight: 600, color: covColor, textAlign: 'right' }}>
                {cov >= 999 ? '—' : `${cov.toFixed(0)}%`}
              </span>

              {/* Mínimo */}
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--tf-muted)', textAlign: 'right' }}>
                {ing.minimumQty.toFixed(3)}
              </span>

              {/* Valor */}
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: covColor, textAlign: 'right' }}>
                {formatCurrency(ing.currentQty * ing.unitCost)}
              </span>

              {/* Status badge */}
              <div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: s.bg, color: s.color, border: `1px solid ${s.bd}`, fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 9999, whiteSpace: 'nowrap' }}>
                  <StatusIcon size={10} />
                  {s.label}
                </span>
              </div>

              {/* Ações */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setEntradaTarget(ing)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: isCritical ? 'var(--tf-red-bg)' : 'var(--tf-accent-bg)',
                    color: isCritical ? 'var(--tf-red)' : 'var(--tf-green-light)',
                    border: `1px solid ${isCritical ? 'var(--tf-red-bd)' : 'var(--tf-accent-bd)'}`,
                    borderRadius: 9999, fontSize: 11, fontWeight: 500, padding: '4px 10px', cursor: 'pointer',
                  }}
                >
                  <ArrowDown size={11} />
                  Entrada
                </button>
                <button
                  style={{ background: 'transparent', border: 'none', color: 'var(--tf-muted)', cursor: 'pointer', borderRadius: 6, padding: '4px 8px', fontSize: 16, letterSpacing: 2 }}
                  title="Mais ações"
                >
                  ···
                </button>
              </div>
            </div>
          )
        })}

        {/* tfoot */}
        {!loading && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid var(--tf-border)', background: 'var(--tf-surface2)' }}>
            <span style={{ fontSize: 12, color: 'var(--tf-muted)' }}>
              {filtered.length} item(s)
            </span>
            <span style={{ fontSize: 12 }}>
              <span style={{ color: 'var(--tf-muted)' }}>Valor total: </span>
              <strong style={{ color: 'var(--tf-green-light)', fontFamily: 'monospace' }}>
                {formatCurrency(filteredValue)}
              </strong>
            </span>
          </div>
        )}
      </div>

      <EntradaDialog
        ingredient={entradaTarget}
        onClose={() => setEntradaTarget(null)}
        onSuccess={() => { setEntradaTarget(null); fetchIngredients() }}
      />
    </div>
  )
}

// ── Entrada Dialog ─────────────────────────────────────────────────────────────

function EntradaDialog({
  ingredient, onClose, onSuccess,
}: {
  ingredient: Ingredient | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [qty, setQty] = useState('')
  const [cost, setCost] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (ingredient) {
      setQty('')
      setCost(ingredient.unitCost.toFixed(4))
      setReason('')
    }
  }, [ingredient])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ingredient) return
    const quantity = parseFloat(qty)
    const unitCost = parseFloat(cost)
    if (!quantity || quantity <= 0) { toast.error('Informe uma quantidade válida'); return }

    setLoading(true)
    try {
      const res = await fetch(`/api/ingredients/${ingredient.id}/movements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'IN', quantity, unitCost: isNaN(unitCost) ? undefined : unitCost, reason: reason || undefined }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Erro ao registrar entrada')
        return
      }
      toast.success(`Entrada de ${quantity} ${unitLabels[ingredient.unit] ?? ingredient.unit} registrada`)
      onSuccess()
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  const s = ingredient ? STATUS_STYLES[ingredient.stockStatus] : null

  return (
    <Dialog open={!!ingredient} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'var(--tf-accent-bg)' }}>
              <ArrowDown style={{ width: 16, height: 16, color: 'var(--tf-green-light)' }} />
            </span>
            Registrar Entrada
          </DialogTitle>
        </DialogHeader>

        {ingredient && s && (
          <form onSubmit={handleSubmit} className="space-y-4 mt-1">
            <div style={{ borderRadius: 8, border: '1px solid var(--tf-border)', background: 'var(--tf-surface2)', padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--tf-txt)' }}>{ingredient.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--tf-txt3)' }}>
                  Estoque atual:{' '}
                  <span className="font-mono font-medium" style={{ color: 'var(--tf-txt)' }}>
                    {ingredient.currentQty.toFixed(3)} {unitLabels[ingredient.unit] ?? ingredient.unit}
                  </span>
                </p>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: s.bg, color: s.color, border: `1px solid ${s.bd}`, fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 9999, whiteSpace: 'nowrap' }}>
                {s.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quantidade <span className="text-xs" style={{ color: 'var(--tf-txt3)' }}>({unitLabels[ingredient.unit] ?? ingredient.unit})</span></Label>
                <Input type="number" step="0.001" min="0.001" placeholder="0.000" value={qty} onChange={e => setQty(e.target.value)} autoFocus required />
              </div>
              <div className="space-y-1.5">
                <Label>Custo unitário (R$)</Label>
                <Input type="number" step="0.0001" min="0" placeholder="0,0000" value={cost} onChange={e => setCost(e.target.value)} />
              </div>
            </div>

            {qty && parseFloat(qty) > 0 && cost && parseFloat(cost) > 0 && (
              <div style={{ borderRadius: 8, background: 'var(--tf-accent-bg)', border: '1px solid var(--tf-accent-bd)', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="text-xs" style={{ color: 'var(--tf-muted)' }}>Total da entrada</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--tf-green-light)' }}>
                  {formatCurrency(parseFloat(qty) * parseFloat(cost))}
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Motivo <span className="text-xs" style={{ color: 'var(--tf-txt3)' }}>(opcional)</span></Label>
              <Input placeholder="Ex: Compra fornecedor, NF 1234..." value={reason} onChange={e => setReason(e.target.value)} />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</>
                  : <><ArrowDown className="w-4 h-4" />Confirmar Entrada</>
                }
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Tab 2: Physical Counts ─────────────────────────────────────────────────────

function PhysicalCounts() {
  const [list, setList] = useState<Inventario[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<InventarioDetail | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [confirmFinalize, setConfirmFinalize] = useState(false)
  const [searchCount, setSearchCount] = useState('')

  async function loadList() {
    try {
      const data = await fetchCached<Inventario[]>('/api/inventarios')
      setList(data)
    } catch { /* silent */ }
    setLoading(false)
  }

  useEffect(() => { loadList() }, [])

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    const res = await fetch('/api/inventarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: newName }),
    })
    setCreating(false)
    if (!res.ok) { toast.error('Erro ao criar inventário'); return }
    const data: InventarioDetail = await res.json()
    invalidateCache('/api/inventarios')
    setNewName(''); setShowNewForm(false); setSelected(data); loadList()
    toast.success('Inventário criado — preencha as quantidades contadas')
  }

  async function openInventario(id: string) {
    const res = await fetch(`/api/inventarios/${id}`)
    if (res.ok) setSelected(await res.json())
  }

  function updateItemCount(itemId: string, value: string) {
    if (!selected) return
    const parsed = parseFloat(value)
    setSelected(prev => prev ? {
      ...prev,
      items: prev.items.map(i =>
        i.id === itemId ? { ...i, qtdContada: isNaN(parsed) || value === '' ? null : parsed } : i
      ),
    } : prev)
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    const items = selected.items
      .filter(i => i.qtdContada !== null)
      .map(i => ({ itemId: i.id, qtdContada: i.qtdContada as number, observacao: i.observacao ?? undefined }))
    const res = await fetch(`/api/inventarios/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    setSaving(false)
    if (res.ok) toast.success('Contagem salva')
    else toast.error('Erro ao salvar contagem')
  }

  async function handleFinalize() {
    if (!selected) return
    setFinalizing(true); setConfirmFinalize(false)
    const res = await fetch(`/api/inventarios/${selected.id}/finalizar`, { method: 'POST' })
    setFinalizing(false)
    if (!res.ok) { toast.error('Erro ao finalizar'); return }
    toast.success('Inventário finalizado! Estoque atualizado.')
    invalidateCache('/api/inventarios', '/api/ingredients')
    setSelected(null); loadList()
  }

  async function handleCancel() {
    if (!selected) return
    const res = await fetch(`/api/inventarios/${selected.id}`, { method: 'DELETE' })
    if (res.ok) { invalidateCache('/api/inventarios'); setSelected(null); loadList(); toast.success('Inventário cancelado') }
  }

  // ── Count detail view ──
  if (selected) {
    const counted = selected.items.filter(i => i.qtdContada !== null).length
    const total = selected.items.length
    const progress = total > 0 ? Math.round((counted / total) * 100) : 0
    const isOpen = selected.status === 'ABERTO'
    const visibleItems = selected.items.filter(i =>
      !searchCount || i.ingredient.name.toLowerCase().includes(searchCount.toLowerCase())
    )

    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <button
              onClick={() => setSelected(null)}
              className="flex items-center gap-1 text-sm mb-2 transition-colors hover:opacity-80"
              style={{ color: 'var(--tf-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <ChevronLeft className="w-4 h-4" />Voltar às contagens
            </button>
            <h2 className="text-xl font-bold" style={{ color: 'var(--tf-txt)' }}>{selected.nome}</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--tf-muted)' }}>{counted} de {total} itens contados</p>
          </div>

          {isOpen && (
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={handleCancel} className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10">
                <XCircle className="w-4 h-4 mr-1.5" />Cancelar
              </Button>
              <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button size="sm" disabled={finalizing || counted === 0} className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => setConfirmFinalize(true)}>
                <CheckCircle className="w-4 h-4 mr-1.5" />
                {finalizing ? 'Finalizando...' : 'Finalizar'}
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs" style={{ color: 'var(--tf-muted)' }}>
            <span>Progresso</span>
            <span className="font-semibold" style={{ color: 'var(--tf-txt)' }}>{progress}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 9999, background: 'var(--tf-border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--tf-primary)', borderRadius: 9999, width: `${progress}%`, transition: 'width 500ms' }} />
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--tf-muted)' }} />
          <Input className="pl-9" placeholder="Buscar insumo na contagem..." value={searchCount} onChange={e => setSearchCount(e.target.value)} />
        </div>

        <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 10, overflow: 'hidden' }}>
          <div className="grid grid-cols-[80px_1fr_120px_140px_110px] gap-2 px-4 py-2.5" style={{ background: 'var(--tf-surface2)', borderBottom: '1px solid var(--tf-border-light)' }}>
            {['Código', 'Insumo', 'Sistema', 'Contado', 'Diferença'].map((h, i) => (
              <span key={i} style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tf-muted)', textAlign: i >= 2 ? 'right' : 'left' }}>{h}</span>
            ))}
          </div>

          {visibleItems.map((item, idx) => {
            const diff = item.qtdContada !== null ? item.qtdContada - item.qtdSistema : null
            const unit = unitLabels[item.ingredient.unit] ?? item.ingredient.unit

            return (
              <div
                key={item.id}
                className="grid grid-cols-[80px_1fr_120px_140px_110px] gap-2 px-4 py-2.5 items-center text-sm"
                style={{ borderBottom: idx < visibleItems.length - 1 ? '1px solid var(--tf-border-light)' : undefined }}
              >
                <span className="font-mono text-[10px]" style={{ color: 'var(--tf-muted)' }}>
                  {item.ingredient.codigoInterno ?? '—'}
                </span>

                <div className="flex items-center gap-2">
                  <span style={{ width: 8, height: 8, borderRadius: 9999, background: item.qtdContada !== null ? 'var(--tf-green-ok)' : 'var(--tf-border)', flexShrink: 0, display: 'inline-block' }} />
                  <span className="font-medium text-sm truncate" style={{ color: 'var(--tf-txt)' }}>{item.ingredient.name}</span>
                </div>

                <span className="font-mono text-right text-xs" style={{ color: 'var(--tf-muted)' }}>
                  {item.qtdSistema.toFixed(3)} {unit}
                </span>

                <div className="flex justify-end">
                  {isOpen ? (
                    <Input type="number" min="0" step="0.001" value={item.qtdContada ?? ''} onChange={e => updateItemCount(item.id, e.target.value)} className="w-28 text-right h-8 font-mono text-sm" placeholder="—" />
                  ) : (
                    <span className="font-mono text-xs" style={{ color: 'var(--tf-muted)' }}>
                      {item.qtdContada !== null ? item.qtdContada.toFixed(3) : '—'}
                    </span>
                  )}
                </div>

                <span
                  className="font-mono text-right text-xs font-medium"
                  style={{ color: diff === null ? 'var(--tf-border)' : diff > 0 ? 'var(--tf-green-ok)' : diff < 0 ? 'var(--tf-red)' : 'var(--tf-txt3)' }}
                >
                  {diff !== null ? (diff >= 0 ? '+' : '') + diff.toFixed(3) : '—'}
                </span>
              </div>
            )
          })}
        </div>

        <AlertDialog open={confirmFinalize} onOpenChange={setConfirmFinalize}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Finalizar inventário?</AlertDialogTitle>
              <AlertDialogDescription>
                As diferenças serão aplicadas ao estoque como ajustes. Esta ação não pode ser desfeita.
                <br />
                <strong className="text-foreground">{counted} de {total} itens</strong> foram contados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleFinalize} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <CheckCircle className="w-4 h-4 mr-1.5" />Sim, finalizar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  // ── Count list view ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 13, color: 'var(--tf-muted)' }}>
          Realize contagens físicas periódicas para auditar e ajustar o estoque.
        </p>
        <Button
          onClick={() => setShowNewForm(true)}
          style={{ background: 'var(--tf-primary)', color: 'var(--tf-primary-txt)', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Plus className="w-4 h-4" />Nova Contagem
        </Button>
      </div>

      {showNewForm && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-3" style={{ color: 'var(--tf-txt)' }}>Nova Contagem Física</p>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Ex: Contagem Mensal — Maio 2026"
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <Button onClick={handleCreate} disabled={creating || !newName.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar'}
              </Button>
              <Button variant="outline" onClick={() => { setShowNewForm(false); setNewName('') }}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '64px 16px', color: 'var(--tf-muted)' }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span style={{ fontSize: 13 }}>Carregando...</span>
        </div>
      ) : list.length === 0 ? (
        // ── Empty state estruturado ──
        <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 10, padding: '64px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 12, background: 'var(--tf-surface2)', border: '1px solid var(--tf-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ClipboardList style={{ width: 26, height: 26, color: 'var(--tf-muted)' }} />
          </div>
          <div>
            <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--tf-txt)', margin: '0 0 6px' }}>Nenhuma contagem realizada</p>
            <p style={{ fontSize: 12, color: 'var(--tf-muted)', margin: 0 }}>
              Crie uma contagem para auditar o estoque fisicamente e corrigir divergências.
            </p>
          </div>
          <Button
            onClick={() => setShowNewForm(true)}
            style={{ background: 'var(--tf-primary)', color: 'var(--tf-primary-txt)', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4 }}
          >
            <Plus className="w-4 h-4" />Iniciar nova contagem
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(inv => {
            const s = INV_STATUS[inv.status]
            const Icon = s.icon
            return (
              <button
                key={inv.id}
                onClick={() => openInventario(inv.id)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, padding: '14px 20px', textAlign: 'left', border: '1px solid var(--tf-border)', background: 'var(--tf-surface)', cursor: 'pointer', width: '100%', transition: 'background 150ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--tf-surface2)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--tf-surface)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <Icon style={{ width: 20, height: 20, color: s.iconColor, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--tf-txt)', margin: 0 }}>{inv.nome}</p>
                    <p style={{ fontSize: 12, color: 'var(--tf-muted)', margin: '3px 0 0' }}>
                      {inv._count.items} insumos · {new Date(inv.iniciadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {inv.finalizadoEm && ` · Finalizado em ${new Date(inv.finalizadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
                    </p>
                  </div>
                </div>
                <span style={{ background: s.bg, color: s.color, border: s.border, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 9999, whiteSpace: 'nowrap' }}>
                  {s.label}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
