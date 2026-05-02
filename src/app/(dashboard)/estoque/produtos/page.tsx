'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { ProductForm } from '@/components/products/product-form'
import { formatCurrency } from '@/lib/utils'
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Eye,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ProductWithRelations } from '@/types'

interface Category {
  id: string
  name: string
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
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (categoryFilter && categoryFilter !== 'all') params.set('categoryId', categoryFilter)

      const res = await fetch(`/api/products?${params}`)
      if (res.ok) {
        const data = await res.json()
        setProducts(data)
      }
    } catch {
      toast.error('Erro ao carregar produtos')
    } finally {
      setLoading(false)
    }
  }, [search, categoryFilter])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  useEffect(() => {
    fetch('/api/categories?type=PRODUCT')
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {})
  }, [])

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/products/${deleteId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Produto excluído')
        fetchProducts()
      } else {
        toast.error('Erro ao excluir produto')
      }
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  async function toggleActive(product: ProductWithRelations) {
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !product.active }),
      })
      if (res.ok) {
        toast.success(`Produto ${product.active ? 'desativado' : 'ativado'}`)
        fetchProducts()
      }
    } catch {
      toast.error('Erro ao alterar status')
    }
  }

  function openEdit(product: ProductWithRelations) {
    setSelectedProduct(product)
    setFormOpen(true)
  }

  function openNew() {
    setSelectedProduct(null)
    setFormOpen(true)
  }

  function calcCost(product: ProductWithRelations): number {
    if (!product.ingredients) return 0
    return product.ingredients.reduce(
      (sum: number, pi: { quantity: number; ingredient: { unitCost: number } }) =>
        sum + (pi.ingredient?.unitCost ?? 0) * (pi.quantity ?? 0),
      0
    )
  }

  function calcMargin(product: ProductWithRelations): number {
    const cost = calcCost(product)
    if (product.salePrice <= 0) return 0
    return ((product.salePrice - cost) / product.salePrice) * 100
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Produtos</h1>
          <p className="text-zinc-400 text-sm mt-1">Gerencie o cardápio e custos</p>
        </div>
        <Button
          onClick={openNew}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
          />
        </div>
        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v ?? 'all')}
        >
          <SelectTrigger className="w-48 bg-zinc-900 border-zinc-700 text-white">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            <SelectItem value="all" className="text-zinc-200 focus:bg-zinc-800">
              Todas as categorias
            </SelectItem>
            {categories.map((cat) => (
              <SelectItem
                key={cat.id}
                value={cat.id}
                className="text-zinc-200 focus:bg-zinc-800"
              >
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400">Nome</TableHead>
              <TableHead className="text-zinc-400">Categoria</TableHead>
              <TableHead className="text-zinc-400 text-right">Preço Venda</TableHead>
              <TableHead className="text-zinc-400 text-right">Custo</TableHead>
              <TableHead className="text-zinc-400 text-right">Margem</TableHead>
              <TableHead className="text-zinc-400">Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-zinc-500 py-12">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-zinc-500 py-12">
                  Nenhum produto encontrado.{' '}
                  <button onClick={openNew} className="text-orange-400 hover:underline">
                    Adicionar produto
                  </button>
                </TableCell>
              </TableRow>
            ) : (
              products.map((product) => {
                const cost = calcCost(product)
                const margin = calcMargin(product)
                const marginColor =
                  margin >= 60
                    ? 'text-green-400'
                    : margin >= 30
                    ? 'text-yellow-400'
                    : 'text-red-400'

                return (
                  <TableRow
                    key={product.id}
                    className="border-zinc-800 hover:bg-zinc-800/50"
                  >
                    <TableCell className="text-white font-medium">
                      {product.name}
                    </TableCell>
                    <TableCell className="text-zinc-400">
                      {product.category?.name ?? '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-white">
                      {formatCurrency(product.salePrice)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-zinc-400">
                      {formatCurrency(cost)}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${marginColor}`}>
                      {margin.toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      {product.active ? (
                        <Badge className="bg-green-900/50 text-green-300 border border-green-800 text-xs">
                          Ativo
                        </Badge>
                      ) : (
                        <Badge className="bg-zinc-800 text-zinc-500 border border-zinc-700 text-xs">
                          Inativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="inline-flex items-center justify-center h-8 w-8 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                          aria-label="Opções"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-zinc-900 border-zinc-700"
                        >
                          <DropdownMenuItem
                            className="text-zinc-200 gap-2 cursor-pointer"
                            onClick={() => router.push(`/estoque/produtos/${product.id}`)}
                          >
                            <Eye className="w-4 h-4" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-zinc-200 gap-2 cursor-pointer"
                            onClick={() => openEdit(product)}
                          >
                            <Pencil className="w-4 h-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-zinc-200 gap-2 cursor-pointer"
                            onClick={() => toggleActive(product)}
                          >
                            {product.active ? (
                              <>
                                <ToggleLeft className="w-4 h-4" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <ToggleRight className="w-4 h-4 text-green-400" />
                                Ativar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-400 gap-2 cursor-pointer"
                            onClick={() => setDeleteId(product.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                            Excluir
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
      </div>

      <ProductForm
        open={formOpen}
        onOpenChange={setFormOpen}
        product={selectedProduct}
        onSuccess={fetchProducts}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null) }}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 text-zinc-300 hover:bg-zinc-800">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
