'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
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

const STOCK_STATUS: Record<StockStatus, { label: string; barColor: string; bg: string; color: string; border: string }> = {
  ok:       { label: 'OK',        barColor: 'var(--tf-green-ok)', bg: 'var(--tf-green-ok-bg)', color: 'var(--tf-green-ok)',  border: '1px solid var(--tf-green-ok-bd)' },
  low:      { label: 'Reposição', barColor: 'var(--tf-yellow)',   bg: 'var(--tf-yellow-bg)',   color: 'var(--tf-yellow)',    border: '1px solid var(--tf-yellow-bd)' },
  critical: { label: 'Crítico',   barColor: 'var(--tf-red)',      bg: 'var(--tf-red-bg)',      color: 'var(--tf-red)',       border: '1px solid var(--tf-red-bd)' },
  expiring: { label: 'Vencendo',  barColor: '#EA580C',            bg: 'rgba(234,88,12,0.08)',  color: '#EA580C',             border: '1px solid rgba(234,88,12,0.25)' },
  expired:  { label: 'Vencido',   barColor: 'var(--tf-txt3)',     bg: 'var(--tf-input-bg)',    color: 'var(--tf-txt3)',      border: '1px solid var(--tf-border)' },
}

const INV_STATUS = {
  ABERTO:     { label: 'Em andamento', icon: Clock,       iconColor: '#3b82f6',            bg: 'rgba(59,130,246,0.1)',      color: '#3b82f6',            border: '1px solid rgba(59,130,246,0.3)' },
  FINALIZADO: { label: 'Finalizado',   icon: CheckCircle, iconColor: 'var(--tf-green-ok)', bg: 'var(--tf-green-ok-bg)',    color: 'var(--tf-green-ok)', border: '1px solid var(--tf-green-ok-bd)' },
  CANCELADO:  { label: 'Cancelado',    icon: XCircle,     iconColor: 'var(--tf-txt3)',     bg: 'var(--tf-input-bg)',       color: 'var(--tf-txt3)',     border: '1px solid var(--tf-border)' },
}

// ── Stat mini card ─────────────────────────────────────────────────────────────

type StatMiniVariant = 'default' | 'success' | 'warning' | 'danger'

const statIconStyle: Record<StatMiniVariant, { background: string; color: string }> = {
  default: { background: 'var(--tf-input-bg)',    color: 'var(--tf-txt3)' },
  success: { background: 'var(--tf-green-ok-bg)', color: 'var(--tf-green-ok)' },
  warning: { background: 'var(--tf-yellow-bg)',   color: 'var(--tf-yellow)' },
  danger:  { background: 'var(--tf-red-bg)',      color: 'var(--tf-red)' },
}

const statValueColor: Record<StatMiniVariant, string> = {
  default: 'var(--tf-txt)',
  success: 'var(--tf-green-ok)',
  warning: 'var(--tf-yellow)',
  danger:  'var(--tf-red)',
}

function StatMini({ label, value, variant = 'default', icon: Icon }: {
  label: string; value: number; variant?: StatMiniVariant; icon: LucideIcon
}) {
  return (
    <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 8, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, ...statIconStyle[variant] }}>
        <Icon size={18} />
      </div>
      <div>
        <p style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--tf-txt3)', margin: 0 }}>{label}</p>
        <p style={{ fontSize: 20, fontWeight: 600, color: statValueColor[variant], margin: '2px 0 0', lineHeight: 1.2 }}>{value}</p>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InventarioPage() {
  const [activeTab, setActiveTab] = useState('stock')

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--tf-txt)', margin: 0 }}>
          Inventário
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--tf-txt3)', marginTop: 3 }}>
          Posição do estoque e contagens físicas
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="stock" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Posição do Estoque
          </TabsTrigger>
          <TabsTrigger value="counts" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            Contagens Físicas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-6">
          <StockPosition />
        </TabsContent>

        <TabsContent value="counts" className="mt-6">
          <PhysicalCounts />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── Tab 1: Stock Position ─────────────────────────────────────────────────────

function StockPosition() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [entradaTarget, setEntradaTarget] = useState<Ingredient | null>(null)

  const fetchIngredients = useCallback(async () => {
    try {
      const res = await fetch('/api/ingredients')
      if (res.ok) setIngredients(await res.json())
    } catch {
      toast.error('Erro ao carregar estoque')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchIngredients()
    fetch('/api/categories?type=INGREDIENT')
      .then(r => r.json()).then(setCategories).catch(() => {})
  }, [fetchIngredients])

  const filtered = useMemo(() => ingredients.filter(ing => {
    const matchSearch = !search || ing.name.toLowerCase().includes(search.toLowerCase()) ||
      (ing.codigoInterno ?? '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || ing.stockStatus === statusFilter
    const matchCat = categoryFilter === 'all' || ing.category?.id === categoryFilter
    return matchSearch && matchStatus && matchCat
  }), [ingredients, search, statusFilter, categoryFilter])

  const filteredValue = useMemo(
    () => filtered.reduce((s, ing) => s + ing.currentQty * ing.unitCost, 0),
    [filtered]
  )

  const stats = useMemo(() => ({
    total: ingredients.length,
    ok: ingredients.filter(i => i.stockStatus === 'ok').length,
    low: ingredients.filter(i => i.stockStatus === 'low').length,
    critical: ingredients.filter(i => ['critical', 'expired'].includes(i.stockStatus)).length,
    expiring: ingredients.filter(i => i.stockStatus === 'expiring').length,
  }), [ingredients])

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatMini label="Total de Itens"    value={stats.total}                     variant="default" icon={Package} />
        <StatMini label="Estoque OK"         value={stats.ok}                        variant="success" icon={CheckCircle} />
        <StatMini label="Em Reposição"       value={stats.low}                       variant="warning" icon={TrendingDown} />
        <StatMini label="Crítico / Vencido"  value={stats.critical + stats.expiring} variant="danger"  icon={AlertTriangle} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou código..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
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
          <SelectTrigger className="w-48"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 8, overflow: 'hidden' }}>
        {/* Header */}
        <div
          className="grid grid-cols-[40px_1fr_120px_180px_100px_90px_100px_80px] gap-2 px-4 py-2.5"
          style={{ background: 'var(--tf-surface2)', borderBottom: '1px solid var(--tf-border-light)' }}
        >
          {['#', 'Nome', 'Categoria', 'Qtd. Atual', 'Mínimo', 'Valor', 'Status', ''].map((h, i) => (
            <span key={i} style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--tf-txt3)', textAlign: i >= 4 && i <= 5 ? 'right' : 'left' }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <Package className="w-8 h-8 opacity-30" />
            <p className="text-sm">Nenhum item encontrado</p>
          </div>
        ) : (
          filtered.map((ing, idx) => {
            const s = STOCK_STATUS[ing.stockStatus]
            const max = Math.max(ing.pontoReposicao * 2, ing.currentQty, 1)
            const pct = Math.min((ing.currentQty / max) * 100, 100)

            return (
              <div
                key={ing.id}
                className="grid grid-cols-[40px_1fr_120px_180px_100px_90px_100px_80px] gap-2 px-4 py-3 items-center text-sm hover:bg-muted/40"
                style={{ borderBottom: idx < filtered.length - 1 ? '1px solid var(--tf-border-light)' : undefined }}
              >
                <span className="font-mono text-[10px]" style={{ color: 'var(--tf-txt3)' }}>
                  {ing.codigoInterno ?? '—'}
                </span>

                <span className="font-medium" style={{ color: 'var(--tf-txt)' }}>{ing.name}</span>

                <span className="text-xs truncate" style={{ color: 'var(--tf-txt3)' }}>
                  {ing.category?.name ?? '—'}
                </span>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-medium" style={{ color: 'var(--tf-txt)' }}>
                      {ing.currentQty.toFixed(3)}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--tf-txt3)' }}>
                      {unitLabels[ing.unit] ?? ing.unit}
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 9999, background: 'var(--tf-border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 9999, background: s.barColor, width: `${pct}%`, transition: 'width 300ms' }} />
                  </div>
                </div>

                <span className="font-mono text-right text-xs" style={{ color: 'var(--tf-txt3)' }}>
                  {ing.minimumQty.toFixed(3)} {unitLabels[ing.unit] ?? ing.unit}
                </span>

                <span className="font-mono text-right text-xs" style={{ color: 'var(--tf-txt2)' }}>
                  {formatCurrency(ing.currentQty * ing.unitCost)}
                </span>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <span style={{ background: s.bg, color: s.color, border: s.border, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 9999, whiteSpace: 'nowrap' }}>
                    {s.label}
                  </span>
                </div>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1 hover:bg-primary/10"
                    style={{ color: 'var(--tf-primary)' }}
                    onClick={() => setEntradaTarget(ing)}
                  >
                    <ArrowDown className="w-3 h-3" />
                    Entrada
                  </Button>
                </div>
              </div>
            )
          })
        )}

        {!loading && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid var(--tf-border)', background: 'var(--tf-surface2)' }}>
            <span style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>{filtered.length} de {ingredients.length} item(s)</span>
            <span style={{ fontSize: 12, color: 'var(--tf-txt2)', fontWeight: 500 }}>Valor total: {formatCurrency(filteredValue)}</span>
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

  const ss = ingredient ? STOCK_STATUS[ingredient.stockStatus] : null

  return (
    <Dialog open={!!ingredient} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'var(--tf-green-ok-bg)' }}>
              <ArrowDown style={{ width: 16, height: 16, color: 'var(--tf-green-ok)' }} />
            </span>
            Registrar Entrada
          </DialogTitle>
        </DialogHeader>

        {ingredient && ss && (
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
              <span style={{ background: ss.bg, color: ss.color, border: ss.border, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 9999, whiteSpace: 'nowrap' }}>
                {ss.label}
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
              <div style={{ borderRadius: 8, background: 'var(--tf-green-ok-bg)', border: '1px solid var(--tf-green-ok-bd)', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="text-xs" style={{ color: 'var(--tf-txt3)' }}>Total da entrada</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--tf-green-ok)' }}>
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
    const res = await fetch('/api/inventarios')
    if (res.ok) setList(await res.json())
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
    setSelected(null); loadList()
  }

  async function handleCancel() {
    if (!selected) return
    const res = await fetch(`/api/inventarios/${selected.id}`, { method: 'DELETE' })
    if (res.ok) { setSelected(null); loadList(); toast.success('Inventário cancelado') }
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
              style={{ color: 'var(--tf-txt3)' }}
            >
              <ChevronLeft className="w-4 h-4" />Voltar às contagens
            </button>
            <h2 className="text-xl font-bold" style={{ color: 'var(--tf-txt)' }}>{selected.nome}</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--tf-txt3)' }}>{counted} de {total} itens contados</p>
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
          <div className="flex justify-between text-xs" style={{ color: 'var(--tf-txt3)' }}>
            <span>Progresso</span>
            <span className="font-semibold" style={{ color: 'var(--tf-txt)' }}>{progress}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 9999, background: 'var(--tf-border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--tf-primary)', borderRadius: 9999, width: `${progress}%`, transition: 'width 500ms' }} />
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar insumo na contagem..." value={searchCount} onChange={e => setSearchCount(e.target.value)} />
        </div>

        <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 8, overflow: 'hidden' }}>
          <div className="grid grid-cols-[80px_1fr_120px_140px_110px] gap-2 px-4 py-2.5" style={{ background: 'var(--tf-surface2)', borderBottom: '1px solid var(--tf-border-light)' }}>
            {['Código', 'Insumo', 'Sistema', 'Contado', 'Diferença'].map((h, i) => (
              <span key={i} style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--tf-txt3)', textAlign: i >= 2 ? 'right' : 'left' }}>{h}</span>
            ))}
          </div>

          {visibleItems.map((item, idx) => {
            const diff = item.qtdContada !== null ? item.qtdContada - item.qtdSistema : null
            const unit = unitLabels[item.ingredient.unit] ?? item.ingredient.unit

            return (
              <div
                key={item.id}
                className="grid grid-cols-[80px_1fr_120px_140px_110px] gap-2 px-4 py-2.5 items-center text-sm hover:bg-muted/40"
                style={{ borderBottom: idx < visibleItems.length - 1 ? '1px solid var(--tf-border-light)' : undefined }}
              >
                <span className="font-mono text-[10px]" style={{ color: 'var(--tf-txt3)' }}>
                  {item.ingredient.codigoInterno ?? '—'}
                </span>

                <div className="flex items-center gap-2">
                  <span style={{ width: 8, height: 8, borderRadius: 9999, background: item.qtdContada !== null ? 'var(--tf-green-ok)' : 'var(--tf-border)', flexShrink: 0, display: 'inline-block' }} />
                  <span className="font-medium text-sm truncate" style={{ color: 'var(--tf-txt)' }}>{item.ingredient.name}</span>
                </div>

                <span className="font-mono text-right text-xs" style={{ color: 'var(--tf-txt3)' }}>
                  {item.qtdSistema.toFixed(3)} {unit}
                </span>

                <div className="flex justify-end">
                  {isOpen ? (
                    <Input type="number" min="0" step="0.001" value={item.qtdContada ?? ''} onChange={e => updateItemCount(item.id, e.target.value)} className="w-28 text-right h-8 font-mono text-sm" placeholder="—" />
                  ) : (
                    <span className="font-mono text-xs" style={{ color: 'var(--tf-txt3)' }}>
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--tf-txt3)' }}>
          Realize contagens físicas periódicas para auditar e ajustar o estoque.
        </p>
        <Button onClick={() => setShowNewForm(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
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
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      ) : list.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px dashed var(--tf-border)', padding: '64px 16px', gap: 12, textAlign: 'center' }}>
          <ClipboardList style={{ width: 40, height: 40, color: 'var(--tf-txt3)', opacity: 0.4 }} />
          <p className="font-medium text-sm" style={{ color: 'var(--tf-txt3)' }}>Nenhuma contagem realizada</p>
          <p className="text-xs" style={{ color: 'var(--tf-txt3)', opacity: 0.7 }}>Crie uma contagem para auditar o estoque fisicamente</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(inv => {
            const s = INV_STATUS[inv.status]
            const Icon = s.icon
            return (
              <button
                key={inv.id}
                onClick={() => openInventario(inv.id)}
                className="w-full flex items-center justify-between rounded-lg px-5 py-4 text-left hover:bg-muted/40 transition-colors"
                style={{ border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}
              >
                <div className="flex items-center gap-4">
                  <Icon style={{ width: 20, height: 20, color: s.iconColor, flexShrink: 0 }} />
                  <div>
                    <p className="font-medium text-sm" style={{ color: 'var(--tf-txt)' }}>{inv.nome}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--tf-txt3)' }}>
                      {inv._count.items} insumos · {new Date(inv.iniciadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {inv.finalizadoEm && ` · Finalizado em ${new Date(inv.finalizadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
                    </p>
                  </div>
                </div>
                <span style={{ background: s.bg, color: s.color, border: s.border, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 9999 }}>
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
