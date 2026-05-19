'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { StatCard } from '@/components/ui/stat-card'
import { StockBar } from '@/components/ui/stock-bar'
import { IngredientForm } from '@/components/ingredients/ingredient-form'
import { MovementForm } from '@/components/ingredients/movement-form'
import { formatCurrency } from '@/lib/utils'
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  ArrowUpDown,
  History,
  ClipboardList,
  ShoppingBasket,
  DollarSign,
  TrendingDown,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import type { IngredientWithRelations, StockStatus } from '@/types'

interface Category {
  id: string
  name: string
}

const unitLabels: Record<string, string> = {
  KG: 'kg', G: 'g', L: 'L', ML: 'ml', UN: 'un',
}

const STOCK_STATUS: Record<StockStatus, { label: string; bg: string; color: string; border: string }> = {
  ok:       { label: 'OK',        bg: 'var(--tf-green-ok-bg)', color: 'var(--tf-green-ok)',  border: '1px solid var(--tf-green-ok-bd)' },
  low:      { label: 'Reposição', bg: 'var(--tf-yellow-bg)',   color: 'var(--tf-yellow)',    border: '1px solid var(--tf-yellow-bd)' },
  critical: { label: 'Crítico',   bg: 'var(--tf-red-bg)',      color: 'var(--tf-red)',       border: '1px solid var(--tf-red-bd)' },
  expiring: { label: 'Vencendo',  bg: 'rgba(234,88,12,0.08)', color: '#EA580C',              border: '1px solid rgba(234,88,12,0.25)' },
  expired:  { label: 'Vencido',   bg: 'var(--tf-input-bg)',    color: 'var(--tf-txt3)',      border: '1px solid var(--tf-border)' },
}

export default function InsumoPage() {
  const router = useRouter()
  const [ingredients, setIngredients] = useState<IngredientWithRelations[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [movementOpen, setMovementOpen] = useState(false)
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientWithRelations | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchIngredients = useCallback(async () => {
    try {
      const res = await fetch('/api/ingredients')
      if (res.ok) setIngredients(await res.json())
    } catch {
      toast.error('Erro ao carregar insumos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchIngredients() }, [fetchIngredients])

  useEffect(() => {
    fetch('/api/categories?type=INGREDIENT')
      .then(r => r.json()).then(setCategories).catch(() => {})
  }, [])

  const filtered = useMemo(() => ingredients.filter(ing => {
    const matchSearch = !search ||
      ing.name.toLowerCase().includes(search.toLowerCase()) ||
      (ing.codigoInterno ?? '').toLowerCase().includes(search.toLowerCase())
    const matchCat = categoryFilter === 'all' || ing.category?.id === categoryFilter
    const matchStatus = statusFilter === 'all' || ing.stockStatus === statusFilter
    return matchSearch && matchCat && matchStatus
  }), [ingredients, search, categoryFilter, statusFilter])

  const stats = useMemo(() => ({
    total: ingredients.length,
    totalValue: ingredients.reduce((s, i) => s + i.currentQty * i.custoMedioPonderado, 0),
    lowCount: ingredients.filter(i => i.stockStatus === 'low').length,
    criticalCount: ingredients.filter(i => ['critical', 'expiring', 'expired'].includes(i.stockStatus ?? '')).length,
  }), [ingredients])

  const filteredValue = useMemo(
    () => filtered.reduce((s, i) => s + i.currentQty * i.custoMedioPonderado, 0),
    [filtered]
  )

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/ingredients/${deleteId}`, { method: 'DELETE' })
      if (res.ok) { toast.success('Insumo excluído'); fetchIngredients() }
      else toast.error('Erro ao excluir insumo')
    } catch { toast.error('Erro de conexão') }
    finally { setDeleting(false); setDeleteId(null) }
  }

  function openEdit(i: IngredientWithRelations) { setSelectedIngredient(i); setFormOpen(true) }
  function openMovement(i: IngredientWithRelations) { setSelectedIngredient(i); setMovementOpen(true) }
  function openNew() { setSelectedIngredient(null); setFormOpen(true) }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--tf-txt)', margin: 0 }}>Insumos</h1>
          <p style={{ fontSize: 12.5, color: 'var(--tf-txt3)', marginTop: 3 }}>
            Gerencie o estoque de ingredientes e matérias-primas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/estoque/inventario')}>
            <ClipboardList className="w-4 h-4 mr-2" />Inventário
          </Button>
          <Button onClick={openNew} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" />Novo Insumo
          </Button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard title="Total de Insumos"   value={stats.total}                         icon={ShoppingBasket} variant="default" />
        <StatCard title="Valor em Estoque"   value={formatCurrency(stats.totalValue)}    icon={DollarSign}     variant="success" />
        <StatCard title="Em Reposição"        value={stats.lowCount}                      icon={TrendingDown}   variant="warning" />
        <StatCard title="Crítico / Vencido"   value={stats.criticalCount}                 icon={AlertTriangle}  variant="danger"  />
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou código..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v ?? 'all')}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v ?? 'all')}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ok">OK</SelectItem>
            <SelectItem value="low">Reposição</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
            <SelectItem value="expiring">Vencendo</SelectItem>
            <SelectItem value="expired">Vencido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 8, overflow: 'hidden' }}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent" style={{ borderColor: 'var(--tf-border-light)' }}>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Un.</TableHead>
              <TableHead className="text-right">Qtd. Atual</TableHead>
              <TableHead className="text-right">Mín.</TableHead>
              <TableHead className="text-right">CMP</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">Carregando...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                  Nenhum insumo encontrado.{' '}
                  <button onClick={openNew} className="text-primary hover:underline">Adicionar insumo</button>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(ingredient => {
                const status = ingredient.stockStatus ?? 'ok'
                const statusInfo = STOCK_STATUS[status]
                const totalValue = ingredient.currentQty * ingredient.custoMedioPonderado
                return (
                  <TableRow key={ingredient.id} className="hover:bg-muted/40" style={{ borderColor: 'var(--tf-border-light)' }}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {ingredient.codigoInterno ?? '—'}
                    </TableCell>
                    <TableCell className="font-medium" style={{ color: 'var(--tf-txt)' }}>
                      {ingredient.name}
                      {ingredient.subcategoria && (
                        <span className="block text-xs text-muted-foreground">{ingredient.subcategoria}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {ingredient.category?.name ?? '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {unitLabels[ingredient.unit] ?? ingredient.unit}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className="font-mono text-sm"
                          style={{
                            color: status === 'critical' ? 'var(--tf-red)' :
                                   status === 'low' ? 'var(--tf-yellow)' : 'var(--tf-txt)',
                          }}
                        >
                          {ingredient.currentQty.toFixed(3)}
                        </span>
                        <StockBar current={ingredient.currentQty} minimum={ingredient.minimumQty} width={72} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {ingredient.minimumQty.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right font-mono" style={{ color: 'var(--tf-txt2)' }}>
                      {formatCurrency(ingredient.custoMedioPonderado)}
                    </TableCell>
                    <TableCell className="text-right font-mono" style={{ color: 'var(--tf-txt2)' }}>
                      {formatCurrency(totalValue)}
                    </TableCell>
                    <TableCell>
                      <span style={{ ...statusInfo, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 9999, whiteSpace: 'nowrap' }}>
                        {statusInfo.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          aria-label="Opções"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => openMovement(ingredient)}>
                            <ArrowUpDown className="w-4 h-4" />Movimentação
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => router.push(`/estoque/insumos/${ingredient.id}/movimentacoes`)}>
                            <History className="w-4 h-4" />Histórico
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => openEdit(ingredient)}>
                            <Pencil className="w-4 h-4" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive gap-2 cursor-pointer" onClick={() => setDeleteId(ingredient.id)}>
                            <Trash2 className="w-4 h-4" />Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {/* Table footer */}
        {!loading && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 16px',
              borderTop: '1px solid var(--tf-border)',
              background: 'var(--tf-surface2)',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>
              {filtered.length} item(s) exibido(s)
            </span>
            <span style={{ fontSize: 12, color: 'var(--tf-txt2)', fontWeight: 500 }}>
              Valor total: {formatCurrency(filteredValue)}
            </span>
          </div>
        )}
      </div>

      <IngredientForm open={formOpen} onOpenChange={setFormOpen} ingredient={selectedIngredient} onSuccess={fetchIngredients} />

      {selectedIngredient && (
        <MovementForm
          open={movementOpen} onOpenChange={setMovementOpen}
          ingredientId={selectedIngredient.id} ingredientName={selectedIngredient.name}
          onSuccess={fetchIngredients}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este insumo? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
