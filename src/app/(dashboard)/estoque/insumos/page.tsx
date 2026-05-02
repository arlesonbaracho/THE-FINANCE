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
} from 'lucide-react'
import { toast } from 'sonner'
import type { IngredientWithRelations } from '@/types'

interface Category {
  id: string
  name: string
}

const unitLabels: Record<string, string> = {
  KG: 'kg',
  G: 'g',
  L: 'L',
  ML: 'ml',
  UN: 'un',
}

export default function InsumoPage() {
  const router = useRouter()
  const [ingredients, setIngredients] = useState<IngredientWithRelations[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [movementOpen, setMovementOpen] = useState(false)
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientWithRelations | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchIngredients = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (categoryFilter && categoryFilter !== 'all') params.set('categoryId', categoryFilter)

      const res = await fetch(`/api/ingredients?${params}`)
      if (res.ok) {
        const data = await res.json()
        setIngredients(data)
      }
    } catch {
      toast.error('Erro ao carregar insumos')
    } finally {
      setLoading(false)
    }
  }, [search, categoryFilter])

  useEffect(() => {
    fetchIngredients()
  }, [fetchIngredients])

  useEffect(() => {
    fetch('/api/categories?type=INGREDIENT')
      .then((r) => r.json())
      .then(setCategories)
      .catch(() => {})
  }, [])

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/ingredients/${deleteId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Insumo excluído')
        fetchIngredients()
      } else {
        toast.error('Erro ao excluir insumo')
      }
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  function openEdit(ingredient: IngredientWithRelations) {
    setSelectedIngredient(ingredient)
    setFormOpen(true)
  }

  function openMovement(ingredient: IngredientWithRelations) {
    setSelectedIngredient(ingredient)
    setMovementOpen(true)
  }

  function openNew() {
    setSelectedIngredient(null)
    setFormOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Insumos</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Gerencie o estoque de ingredientes
          </p>
        </div>
        <Button
          onClick={openNew}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Insumo
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Buscar insumo..."
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
              <TableHead className="text-zinc-400">Un.</TableHead>
              <TableHead className="text-zinc-400 text-right">Qtd. Atual</TableHead>
              <TableHead className="text-zinc-400 text-right">Qtd. Mínima</TableHead>
              <TableHead className="text-zinc-400 text-right">Custo Unit.</TableHead>
              <TableHead className="text-zinc-400">Fornecedor</TableHead>
              <TableHead className="text-zinc-400">Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-zinc-500 py-12">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : ingredients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-zinc-500 py-12">
                  Nenhum insumo encontrado.{' '}
                  <button
                    onClick={openNew}
                    className="text-orange-400 hover:underline"
                  >
                    Adicionar insumo
                  </button>
                </TableCell>
              </TableRow>
            ) : (
              ingredients.map((ingredient) => {
                const isLow = ingredient.currentQty <= ingredient.minimumQty
                return (
                  <TableRow
                    key={ingredient.id}
                    className="border-zinc-800 hover:bg-zinc-800/50"
                  >
                    <TableCell className="text-white font-medium">
                      {ingredient.name}
                    </TableCell>
                    <TableCell className="text-zinc-400">
                      {ingredient.category?.name ?? '—'}
                    </TableCell>
                    <TableCell className="text-zinc-400">
                      {unitLabels[ingredient.unit] ?? ingredient.unit}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono ${isLow ? 'text-red-400' : 'text-white'}`}
                    >
                      {ingredient.currentQty.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-zinc-400">
                      {ingredient.minimumQty.toFixed(3)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-zinc-300">
                      {formatCurrency(ingredient.unitCost)}
                    </TableCell>
                    <TableCell className="text-zinc-400">
                      {ingredient.supplier?.name ?? '—'}
                    </TableCell>
                    <TableCell>
                      {isLow ? (
                        <Badge className="bg-red-900/50 text-red-300 border border-red-800 text-xs">
                          Baixo Estoque
                        </Badge>
                      ) : (
                        <Badge className="bg-green-900/50 text-green-300 border border-green-800 text-xs">
                          OK
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
                            onClick={() => openMovement(ingredient)}
                          >
                            <ArrowUpDown className="w-4 h-4" />
                            Movimentação
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-zinc-200 gap-2 cursor-pointer"
                            onClick={() =>
                              router.push(
                                `/estoque/insumos/${ingredient.id}/movimentacoes`
                              )
                            }
                          >
                            <History className="w-4 h-4" />
                            Histórico
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-zinc-200 gap-2 cursor-pointer"
                            onClick={() => openEdit(ingredient)}
                          >
                            <Pencil className="w-4 h-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-400 gap-2 cursor-pointer"
                            onClick={() => setDeleteId(ingredient.id)}
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

      <IngredientForm
        open={formOpen}
        onOpenChange={setFormOpen}
        ingredient={selectedIngredient}
        onSuccess={fetchIngredients}
      />

      {selectedIngredient && (
        <MovementForm
          open={movementOpen}
          onOpenChange={setMovementOpen}
          ingredientId={selectedIngredient.id}
          ingredientName={selectedIngredient.name}
          onSuccess={fetchIngredients}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null) }}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Tem certeza que deseja excluir este insumo? Esta ação não pode ser desfeita.
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
