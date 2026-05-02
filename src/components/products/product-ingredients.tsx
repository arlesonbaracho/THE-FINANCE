'use client'

import { useCallback, useEffect, useState } from 'react'
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
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import type { ProductIngredientWithRelations } from '@/types'

interface Ingredient {
  id: string
  name: string
  unit: string
  unitCost: number
}

const unitLabels: Record<string, string> = {
  KG: 'kg', G: 'g', L: 'L', ML: 'ml', UN: 'un',
}

interface ProductIngredientsProps {
  productId: string
  onCostChange?: (cost: number) => void
}

export function ProductIngredients({ productId, onCostChange }: ProductIngredientsProps) {
  const [linkedIngredients, setLinkedIngredients] = useState<ProductIngredientWithRelations[]>([])
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newIngredientId, setNewIngredientId] = useState('')
  const [newQty, setNewQty] = useState('')

  const fetchLinked = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${productId}/ingredients`)
      if (res.ok) {
        const data: ProductIngredientWithRelations[] = await res.json()
        setLinkedIngredients(data)
        const cost = data.reduce(
          (sum: number, pi: ProductIngredientWithRelations) =>
            sum + pi.ingredient.unitCost * pi.quantity,
          0
        )
        onCostChange?.(cost)
      }
    } catch {
      toast.error('Erro ao carregar insumos do produto')
    } finally {
      setLoading(false)
    }
  }, [productId, onCostChange])

  useEffect(() => {
    fetchLinked()
    fetch('/api/ingredients')
      .then((r) => r.json())
      .then(setAllIngredients)
      .catch(() => {})
  }, [fetchLinked])

  async function handleAdd() {
    if (!newIngredientId || !newQty || parseFloat(newQty) <= 0) {
      toast.error('Selecione um insumo e informe uma quantidade válida')
      return
    }
    setAdding(true)
    try {
      const res = await fetch(`/api/products/${productId}/ingredients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ingredientId: newIngredientId,
          quantity: parseFloat(newQty),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Erro ao adicionar insumo')
        return
      }

      toast.success('Insumo adicionado!')
      setNewIngredientId('')
      setNewQty('')
      fetchLinked()
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(ingredientId: string) {
    try {
      const res = await fetch(
        `/api/products/${productId}/ingredients?ingredientId=${ingredientId}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        toast.success('Insumo removido')
        fetchLinked()
      } else {
        toast.error('Erro ao remover insumo')
      }
    } catch {
      toast.error('Erro de conexão')
    }
  }

  const linkedIds = linkedIngredients.map((li) => li.ingredientId)
  const availableIngredients = allIngredients.filter((i) => !linkedIds.includes(i.id))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-20 text-zinc-500">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Carregando...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Select value={newIngredientId} onValueChange={(v) => setNewIngredientId(v ?? '')}>
          <SelectTrigger className="flex-1 bg-zinc-800 border-zinc-700 text-white">
            <SelectValue placeholder="Selecionar insumo..." />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-700">
            {availableIngredients.length === 0 ? (
              <SelectItem value="empty" disabled className="text-zinc-500">
                Nenhum insumo disponível
              </SelectItem>
            ) : (
              availableIngredients.map((ing) => (
                <SelectItem
                  key={ing.id}
                  value={ing.id}
                  className="text-zinc-200 focus:bg-zinc-800"
                >
                  {ing.name} ({unitLabels[ing.unit] ?? ing.unit})
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Input
          type="number"
          step="0.001"
          min="0"
          placeholder="Qtd."
          value={newQty}
          onChange={(e) => setNewQty(e.target.value)}
          className="w-28 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
        />
        <Button
          onClick={handleAdd}
          disabled={adding}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>

      {linkedIngredients.length === 0 ? (
        <div className="text-center py-8 text-zinc-500 text-sm border border-zinc-800 rounded-lg">
          Nenhum insumo vinculado. Adicione ingredientes acima.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400">Insumo</TableHead>
              <TableHead className="text-zinc-400 text-right">Qtd.</TableHead>
              <TableHead className="text-zinc-400 text-right">Custo Unit.</TableHead>
              <TableHead className="text-zinc-400 text-right">Custo Total</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {linkedIngredients.map((pi) => {
              const total = pi.ingredient.unitCost * pi.quantity
              return (
                <TableRow key={pi.id} className="border-zinc-800 hover:bg-zinc-800/30">
                  <TableCell className="text-white">
                    {pi.ingredient.name}
                    <span className="text-zinc-500 text-xs ml-1">
                      ({unitLabels[pi.ingredient.unit] ?? pi.ingredient.unit})
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-zinc-300">
                    {pi.quantity.toFixed(3)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-zinc-400">
                    {formatCurrency(pi.ingredient.unitCost)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-zinc-300">
                    {formatCurrency(total)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:text-red-400 hover:bg-red-950/30"
                      onClick={() => handleRemove(pi.ingredientId)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
