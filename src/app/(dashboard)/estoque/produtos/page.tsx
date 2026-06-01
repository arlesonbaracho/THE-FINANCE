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
import { ProductForm } from '@/components/products/product-form'
import { formatCurrency } from '@/lib/utils'
import { fetchCached, invalidateCache } from '@/lib/client-cache'
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
  ToggleLeft,
  ToggleRight,
  ChefHat,
  CheckCircle,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ProductWithRelations } from '@/types'

interface Category { id: string; name: string }

function calcCost(product: ProductWithRelations): number {
  if (!product.ingredients) return 0
  return product.ingredients.reduce(
    (sum, pi) => sum + (pi.ingredient?.unitCost ?? 0) * (pi.quantity ?? 0),
    0
  )
}

function calcMargin(product: ProductWithRelations): number {
  const cost = calcCost(product)
  if (product.salePrice <= 0) return 0
  return ((product.salePrice - cost) / product.salePrice) * 100
}

function MargemBar({ margem }: { margem: number }) {
  const color =
    margem >= 30 ? 'var(--tf-green-ok)' :
    margem >= 15 ? 'var(--tf-yellow)' :
    'var(--tf-red)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color, minWidth: 42, textAlign: 'right' }}>
        {margem.toFixed(1)}%
      </span>
      <div style={{ width: 56, height: 3, borderRadius: 2, background: 'var(--tf-border)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(margem, 100)}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
    </div>
  )
}

export default function ProdutosPage() {
  const router = useRouter()
  const [products, setProducts] = useState<ProductWithRelations[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductWithRelations | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchProducts = useCallback(async () => {
    try {
      const data = await fetchCached<ProductWithRelations[]>('/api/products')
      setProducts(data)
    } catch {
      toast.error('Erro ao carregar produtos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  useEffect(() => {
    fetchCached<{ id: string; name: string }[]>('/api/categories?type=PRODUCT')
      .then(data => setCategories(Array.isArray(data) ? data : [])).catch(() => {})
  }, [])

  const filtered = useMemo(() => products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = categoryFilter === 'all' || p.category?.id === categoryFilter
    return matchSearch && matchCat
  }), [products, search, categoryFilter])

  const stats = useMemo(() => {
    const active = products.filter(p => p.active)
    const margins = active.map(p => calcMargin(p)).filter(m => m > 0)
    return {
      total: products.length,
      activeCount: active.length,
      avgMargin: margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : 0,
    }
  }, [products])

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/products/${deleteId}`, { method: 'DELETE' })
      if (res.ok) { toast.success('Produto excluído'); invalidateCache('/api/products'); fetchProducts() }
      else toast.error('Erro ao excluir produto')
    } catch { toast.error('Erro de conexão') }
    finally { setDeleting(false); setDeleteId(null) }
  }

  async function toggleActive(product: ProductWithRelations) {
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !product.active }),
      })
      if (res.ok) { toast.success(`Produto ${product.active ? 'desativado' : 'ativado'}`); invalidateCache('/api/products'); fetchProducts() }
    } catch { toast.error('Erro ao alterar status') }
  }

  function openEdit(p: ProductWithRelations) { setSelectedProduct(p); setFormOpen(true) }
  function openNew() { setSelectedProduct(null); setFormOpen(true) }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--tf-txt)', margin: 0 }}>Produtos</h1>
          <p style={{ fontSize: 12.5, color: 'var(--tf-txt3)', marginTop: 3 }}>
            Gerencie o cardápio e custos de produção
          </p>
        </div>
        <Button onClick={openNew} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="w-4 h-4 mr-2" />Novo Produto
        </Button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard title="Total de Produtos" value={stats.total}                            icon={ChefHat}    variant="default" />
        <StatCard title="Produtos Ativos"   value={stats.activeCount}                      icon={CheckCircle} variant="success" />
        <StatCard title="Margem Média"      value={`${stats.avgMargin.toFixed(1)}%`}       icon={TrendingUp}  variant="warning" />
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar produto por nome..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v ?? 'all')}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 8, overflow: 'hidden' }}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent" style={{ borderColor: 'var(--tf-border-light)' }}>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-center">Insumos</TableHead>
              <TableHead className="text-right">Preço Venda</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Lucro</TableHead>
              <TableHead>Margem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Carregando...</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  Nenhum produto encontrado.{' '}
                  <button onClick={openNew} className="text-primary hover:underline">Adicionar produto</button>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(product => {
                const cost = calcCost(product)
                const lucro = product.salePrice - cost
                const margin = calcMargin(product)
                const totalInsumos = product.ingredients?.length ?? 0
                const inactive = !product.active

                return (
                  <TableRow key={product.id} className="hover:bg-muted/40" style={{ borderColor: 'var(--tf-border-light)' }}>
                    <TableCell>
                      <span
                        className="font-medium"
                        style={{ color: inactive ? 'var(--tf-txt3)' : 'var(--tf-txt)' }}
                      >
                        {product.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {product.category?.name ?? '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: 22,
                          height: 22,
                          borderRadius: 9999,
                          fontSize: 11,
                          fontWeight: 600,
                          background: totalInsumos > 0 ? 'var(--tf-primary-bg)' : 'var(--tf-input-bg)',
                          color: totalInsumos > 0 ? 'var(--tf-primary)' : 'var(--tf-txt3)',
                        }}
                      >
                        {totalInsumos}
                      </span>
                    </TableCell>
                    <TableCell
                      className="text-right font-mono"
                      style={{ color: inactive ? 'var(--tf-txt3)' : 'var(--tf-txt)' }}
                    >
                      {formatCurrency(product.salePrice)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {formatCurrency(cost)}
                    </TableCell>
                    <TableCell
                      className="text-right font-mono font-semibold"
                      style={{ color: lucro >= 0 ? 'var(--tf-green-ok)' : 'var(--tf-red)' }}
                    >
                      {formatCurrency(lucro)}
                    </TableCell>
                    <TableCell>
                      <MargemBar margem={margin} />
                    </TableCell>
                    <TableCell>
                      {product.active ? (
                        <span style={{ background: 'var(--tf-green-ok-bg)', color: 'var(--tf-green-ok)', border: '1px solid var(--tf-green-ok-bd)', fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 9999 }}>
                          Ativo
                        </span>
                      ) : (
                        <span style={{ background: 'var(--tf-input-bg)', color: 'var(--tf-txt3)', border: '1px solid var(--tf-border)', fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 9999 }}>
                          Inativo
                        </span>
                      )}
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
                          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => router.push(`/estoque/produtos/${product.id}`)}>
                            <Eye className="w-4 h-4" />Ver Composição
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => openEdit(product)}>
                            <Pencil className="w-4 h-4" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => toggleActive(product)}>
                            {product.active
                              ? <><ToggleLeft className="w-4 h-4" />Desativar</>
                              : <><ToggleRight className="w-4 h-4 text-green-500" />Ativar</>}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive gap-2 cursor-pointer" onClick={() => setDeleteId(product.id)}>
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
              {filtered.length} produto(s) exibido(s)
            </span>
            <span style={{ fontSize: 12, color: 'var(--tf-txt2)', fontWeight: 500 }}>
              {filtered.filter(p => p.active).length} ativo(s)
            </span>
          </div>
        )}
      </div>

      <ProductForm open={formOpen} onOpenChange={setFormOpen} product={selectedProduct} onSuccess={() => { invalidateCache('/api/products'); fetchProducts() }} />

      <AlertDialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.
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
