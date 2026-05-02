'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MovementForm } from '@/components/ingredients/movement-form'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, Plus, TrendingUp, TrendingDown, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import type { IngredientWithRelations, IngredientMovementWithRelations } from '@/types'

const movementConfig: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  IN: { label: 'Entrada', color: 'bg-green-900/50 text-green-300 border-green-800', icon: TrendingUp },
  OUT: { label: 'Saída', color: 'bg-red-900/50 text-red-300 border-red-800', icon: TrendingDown },
  ADJUSTMENT: { label: 'Ajuste', color: 'bg-yellow-900/50 text-yellow-300 border-yellow-800', icon: RotateCcw },
}

const unitLabels: Record<string, string> = {
  KG: 'kg', G: 'g', L: 'L', ML: 'ml', UN: 'un',
}

export default function MovimentacoesPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [ingredient, setIngredient] = useState<IngredientWithRelations | null>(null)
  const [movements, setMovements] = useState<IngredientMovementWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [movementOpen, setMovementOpen] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [ingRes, movRes] = await Promise.all([
        fetch(`/api/ingredients/${id}`),
        fetch(`/api/ingredients/${id}/movements`),
      ])

      if (ingRes.ok) setIngredient(await ingRes.json())
      if (movRes.ok) setMovements(await movRes.json())
    } catch {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500">
        Carregando...
      </div>
    )
  }

  if (!ingredient) {
    return (
      <div className="text-center text-zinc-500 py-12">
        <p>Insumo não encontrado.</p>
        <Button
          onClick={() => router.back()}
          variant="outline"
          className="mt-4 border-zinc-700 text-zinc-300"
        >
          Voltar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          onClick={() => router.back()}
          variant="ghost"
          size="icon"
          className="text-zinc-400 hover:text-white hover:bg-zinc-800"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">Histórico de Movimentações</h1>
          <p className="text-zinc-400 text-sm mt-1">{ingredient.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-400 uppercase tracking-wide">Estoque Atual</p>
          <p className={`text-2xl font-bold mt-1 ${ingredient.currentQty <= ingredient.minimumQty ? 'text-red-400' : 'text-white'}`}>
            {ingredient.currentQty.toFixed(3)}{' '}
            <span className="text-sm font-normal text-zinc-400">
              {unitLabels[ingredient.unit] ?? ingredient.unit}
            </span>
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-400 uppercase tracking-wide">Estoque Mínimo</p>
          <p className="text-2xl font-bold mt-1 text-zinc-300">
            {ingredient.minimumQty.toFixed(3)}{' '}
            <span className="text-sm font-normal text-zinc-400">
              {unitLabels[ingredient.unit] ?? ingredient.unit}
            </span>
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-400 uppercase tracking-wide">Total de Movimentos</p>
          <p className="text-2xl font-bold mt-1 text-white">{movements.length}</p>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">Movimentos</h2>
        <Button
          onClick={() => setMovementOpen(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Movimentação
        </Button>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-400">Data</TableHead>
              <TableHead className="text-zinc-400">Tipo</TableHead>
              <TableHead className="text-zinc-400 text-right">Quantidade</TableHead>
              <TableHead className="text-zinc-400">Motivo</TableHead>
              <TableHead className="text-zinc-400">Observação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-zinc-500 py-12">
                  Nenhuma movimentação registrada ainda.
                </TableCell>
              </TableRow>
            ) : (
              movements.map((movement) => {
                const config = movementConfig[movement.type] ?? movementConfig.IN
                const Icon = config.icon
                return (
                  <TableRow
                    key={movement.id}
                    className="border-zinc-800 hover:bg-zinc-800/50"
                  >
                    <TableCell className="text-zinc-400 text-sm">
                      {formatDate(movement.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${config.color} border text-xs flex items-center gap-1 w-fit`}
                      >
                        <Icon className="w-3 h-3" />
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-white">
                      {movement.type === 'IN' ? '+' : movement.type === 'OUT' ? '-' : '='}{' '}
                      {movement.quantity.toFixed(3)}{' '}
                      <span className="text-zinc-400 text-xs">
                        {unitLabels[ingredient.unit] ?? ingredient.unit}
                      </span>
                    </TableCell>
                    <TableCell className="text-zinc-400">
                      {movement.reason ?? '—'}
                    </TableCell>
                    <TableCell className="text-zinc-500 text-sm">
                      {movement.note ?? '—'}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <MovementForm
        open={movementOpen}
        onOpenChange={setMovementOpen}
        ingredientId={ingredient.id}
        ingredientName={ingredient.name}
        onSuccess={fetchData}
      />
    </div>
  )
}
