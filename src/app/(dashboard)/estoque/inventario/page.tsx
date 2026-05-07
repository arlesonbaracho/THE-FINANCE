'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
  ArrowUp,
  ClipboardList,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  TrendingDown,
  BarChart3,
} from 'lucide-react'
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

const STOCK_STATUS: Record<StockStatus, { label: string; bar: string; badge: string }> = {
  ok:       { label: 'OK',        bar: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  low:      { label: 'Reposição', bar: 'bg-amber-500',   badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  critical: { label: 'Crítico',   bar: 'bg-red-500',     badge: 'bg-red-500/15 text-red-400 border-red-500/30' },
  expiring: { label: 'Vencendo',  bar: 'bg-orange-500',  badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  expired:  { label: 'Vencido',   bar: 'bg-zinc-600',    badge: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
}

const INV_STATUS = {
  ABERTO:     { label: 'Em andamento', icon: Clock,        cls: 'text-blue-400' },
  FINALIZADO: { label: 'Finalizado',   icon: CheckCircle,  cls: 'text-emerald-400' },
  CANCELADO:  { label: 'Cancelado',    icon: XCircle,      cls: 'text-zinc-500' },
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function InventarioPage() {
  const [activeTab, setActiveTab] = useState('stock')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inventário</h1>
        <p className="text-muted-foreground text-sm mt-1">Posição do estoque e contagens físicas</p>
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

  const filtered = useMemo(() => {
    return ingredients.filter(ing => {
      const matchSearch = !search || ing.name.toLowerCase().includes(search.toLowerCase()) ||
        (ing.codigoInterno ?? '').toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || ing.stockStatus === statusFilter
      const matchCat = categoryFilter === 'all' || ing.category?.id === categoryFilter
      return matchSearch && matchStatus && matchCat
    })
  }, [ingredients, search, statusFilter, categoryFilter])

  // Stats
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
        <StatMini label="Total de Itens"  value={stats.total}    color="text-foreground"      icon={Package} />
        <StatMini label="Estoque OK"       value={stats.ok}       color="text-emerald-400"     icon={CheckCircle} />
        <StatMini label="Em Reposição"     value={stats.low}      color="text-amber-400"       icon={TrendingDown} />
        <StatMini label="Crítico / Vencido" value={stats.critical + stats.expiring} color="text-red-400" icon={AlertTriangle} />
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
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
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
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* header */}
        <div className="grid grid-cols-[40px_1fr_120px_180px_100px_80px_80px] gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
          <span className="text-xs font-medium text-muted-foreground">#</span>
          <span className="text-xs font-medium text-muted-foreground">Nome</span>
          <span className="text-xs font-medium text-muted-foreground">Categoria</span>
          <span className="text-xs font-medium text-muted-foreground">Qtd. Atual</span>
          <span className="text-xs font-medium text-muted-foreground text-right">Mínimo</span>
          <span className="text-xs font-medium text-muted-foreground text-right">Status</span>
          <span />
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
            // qty bar: percentage relative to pontoReposicao * 2 as "full"
            const max = Math.max(ing.pontoReposicao * 2, ing.currentQty, 1)
            const pct = Math.min((ing.currentQty / max) * 100, 100)

            return (
              <div
                key={ing.id}
                className={`grid grid-cols-[40px_1fr_120px_180px_100px_80px_80px] gap-2 px-4 py-3 items-center text-sm border-b border-border last:border-0 ${
                  idx % 2 === 0 ? 'bg-card' : 'bg-muted/10'
                }`}
              >
                <span className="font-mono text-[10px] text-muted-foreground">{ing.codigoInterno ?? '—'}</span>

                <div>
                  <span className="font-medium text-foreground">{ing.name}</span>
                </div>

                <span className="text-xs text-muted-foreground truncate">
                  {ing.category?.name ?? '—'}
                </span>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-foreground text-xs font-medium">
                      {ing.currentQty.toFixed(3)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {unitLabels[ing.unit] ?? ing.unit}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${s.bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <span className="font-mono text-muted-foreground text-right text-xs">
                  {ing.minimumQty.toFixed(3)} {unitLabels[ing.unit] ?? ing.unit}
                </span>

                <div className="flex justify-center">
                  <Badge className={`text-[10px] border px-1.5 py-0 ${s.badge}`}>{s.label}</Badge>
                </div>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1"
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
      </div>

      <p className="text-xs text-muted-foreground text-right">
        {filtered.length} de {ingredients.length} item(s)
      </p>

      {/* Entry Dialog */}
      <EntradaDialog
        ingredient={entradaTarget}
        onClose={() => setEntradaTarget(null)}
        onSuccess={() => { setEntradaTarget(null); fetchIngredients() }}
      />
    </div>
  )
}

// ── Stat mini card ─────────────────────────────────────────────────────────────

function StatMini({ label, value, color, icon: Icon }: {
  label: string; value: number; color: string; icon: React.ElementType
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className={`w-5 h-5 shrink-0 ${color}`} />
        <div>
          <p className={`text-xl font-bold ${color}`}>{value}</p>
          <p className="text-xs text-muted-foreground leading-tight">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Entrada Dialog ─────────────────────────────────────────────────────────────

function EntradaDialog({
  ingredient,
  onClose,
  onSuccess,
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
        body: JSON.stringify({
          type: 'IN',
          quantity,
          unitCost: isNaN(unitCost) ? undefined : unitCost,
          reason: reason || undefined,
        }),
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

  return (
    <Dialog open={!!ingredient} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10">
              <ArrowDown className="w-4 h-4 text-emerald-400" />
            </span>
            Registrar Entrada
          </DialogTitle>
        </DialogHeader>

        {ingredient && (
          <form onSubmit={handleSubmit} className="space-y-4 mt-1">
            {/* ingredient summary */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground text-sm">{ingredient.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Estoque atual: <span className="font-mono font-medium text-foreground">
                    {ingredient.currentQty.toFixed(3)} {unitLabels[ingredient.unit] ?? ingredient.unit}
                  </span>
                </p>
              </div>
              <Badge className={`text-[10px] border ${STOCK_STATUS[ingredient.stockStatus].badge}`}>
                {STOCK_STATUS[ingredient.stockStatus].label}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quantidade recebida <span className="text-muted-foreground text-xs">({unitLabels[ingredient.unit] ?? ingredient.unit})</span></Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0.001"
                  placeholder="0.000"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Custo unitário (R$)</Label>
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="0,0000"
                  value={cost}
                  onChange={e => setCost(e.target.value)}
                />
              </div>
            </div>

            {qty && parseFloat(qty) > 0 && cost && parseFloat(cost) > 0 && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total da entrada</span>
                <span className="text-sm font-semibold text-emerald-400">
                  {formatCurrency(parseFloat(qty) * parseFloat(cost))}
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Motivo / Observação <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input
                placeholder="Ex: Compra fornecedor, NF 1234..."
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
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
    setNewName('')
    setShowNewForm(false)
    setSelected(data)
    loadList()
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
    setFinalizing(true)
    setConfirmFinalize(false)
    const res = await fetch(`/api/inventarios/${selected.id}/finalizar`, { method: 'POST' })
    setFinalizing(false)
    if (!res.ok) { toast.error('Erro ao finalizar'); return }
    toast.success('Inventário finalizado! Estoque atualizado.')
    setSelected(null)
    loadList()
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
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <button
              onClick={() => setSelected(null)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar às contagens
            </button>
            <h2 className="text-xl font-bold text-foreground">{selected.nome}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {counted} de {total} itens contados
            </p>
          </div>

          {isOpen && (
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <XCircle className="w-4 h-4 mr-1.5" />
                Cancelar
              </Button>
              <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
              <Button
                size="sm"
                disabled={finalizing || counted === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => setConfirmFinalize(true)}
              >
                <CheckCircle className="w-4 h-4 mr-1.5" />
                {finalizing ? 'Finalizando...' : 'Finalizar'}
              </Button>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso</span>
            <span className="font-semibold text-foreground">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Search within count */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar insumo na contagem..."
            value={searchCount}
            onChange={e => setSearchCount(e.target.value)}
          />
        </div>

        {/* Count table */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-[80px_1fr_120px_140px_110px] gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground">Código</span>
            <span className="text-xs font-medium text-muted-foreground">Insumo</span>
            <span className="text-xs font-medium text-muted-foreground text-right">Sistema</span>
            <span className="text-xs font-medium text-muted-foreground text-right">Contado</span>
            <span className="text-xs font-medium text-muted-foreground text-right">Diferença</span>
          </div>

          {visibleItems.map((item, idx) => {
            const diff = item.qtdContada !== null ? item.qtdContada - item.qtdSistema : null
            const unit = unitLabels[item.ingredient.unit] ?? item.ingredient.unit

            return (
              <div
                key={item.id}
                className={`grid grid-cols-[80px_1fr_120px_140px_110px] gap-2 px-4 py-2.5 items-center text-sm border-b border-border last:border-0 ${
                  idx % 2 === 0 ? 'bg-card' : 'bg-muted/10'
                }`}
              >
                <span className="font-mono text-[10px] text-muted-foreground">
                  {item.ingredient.codigoInterno ?? '—'}
                </span>

                <div className="flex items-center gap-2">
                  {item.qtdContada !== null ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" />
                  )}
                  <span className="font-medium text-foreground text-sm truncate">{item.ingredient.name}</span>
                </div>

                <span className="font-mono text-muted-foreground text-right text-xs">
                  {item.qtdSistema.toFixed(3)} {unit}
                </span>

                <div className="flex justify-end">
                  {isOpen ? (
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      value={item.qtdContada ?? ''}
                      onChange={e => updateItemCount(item.id, e.target.value)}
                      className="w-28 text-right h-8 font-mono text-sm"
                      placeholder="—"
                    />
                  ) : (
                    <span className="font-mono text-muted-foreground text-xs">
                      {item.qtdContada !== null ? item.qtdContada.toFixed(3) : '—'}
                    </span>
                  )}
                </div>

                <span className={`font-mono text-right text-xs font-medium ${
                  diff === null ? 'text-muted-foreground/40' :
                  diff > 0  ? 'text-emerald-400' :
                  diff < 0  ? 'text-red-400' :
                  'text-muted-foreground'
                }`}>
                  {diff !== null ? (diff >= 0 ? '+' : '') + diff.toFixed(3) : '—'}
                </span>
              </div>
            )
          })}
        </div>

        {/* Confirm finalize dialog */}
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
              <AlertDialogAction
                onClick={handleFinalize}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-1.5" />
                Sim, finalizar
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
        <p className="text-sm text-muted-foreground">
          Realize contagens físicas periódicas para auditar e ajustar o estoque.
        </p>
        <Button
          onClick={() => setShowNewForm(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Contagem
        </Button>
      </div>

      {showNewForm && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium text-foreground mb-3">Nova Contagem Física</p>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Ex: Contagem Mensal — Maio 2026"
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <Button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar'}
              </Button>
              <Button variant="outline" onClick={() => { setShowNewForm(false); setNewName('') }}>
                Cancelar
              </Button>
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 gap-3 text-center">
          <ClipboardList className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-muted-foreground font-medium text-sm">Nenhuma contagem realizada</p>
          <p className="text-muted-foreground/60 text-xs">Crie uma contagem para auditar o estoque fisicamente</p>
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
                className="w-full flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 hover:bg-secondary/40 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <Icon className={`h-5 w-5 shrink-0 ${s.cls}`} />
                  <div>
                    <p className="font-medium text-foreground text-sm">{inv.nome}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {inv._count.items} insumos · {new Date(inv.iniciadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {inv.finalizadoEm && ` · Finalizado em ${new Date(inv.finalizadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
                    </p>
                  </div>
                </div>
                <Badge className={`text-xs border ${
                  inv.status === 'ABERTO' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
                  inv.status === 'FINALIZADO' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                  'bg-muted text-muted-foreground border-border'
                }`}>
                  {s.label}
                </Badge>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
