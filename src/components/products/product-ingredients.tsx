'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Loader2, Search, Package } from 'lucide-react'
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

type UnitOption = { value: string; label: string; factor: number }

function getCompatibleUnits(baseUnit: string): UnitOption[] {
  if (baseUnit === 'KG') return [
    { value: 'g',  label: 'g',  factor: 0.001 },
    { value: 'kg', label: 'kg', factor: 1 },
  ]
  if (baseUnit === 'L') return [
    { value: 'ml', label: 'ml', factor: 0.001 },
    { value: 'L',  label: 'L',  factor: 1 },
  ]
  const label = unitLabels[baseUnit] ?? baseUnit.toLowerCase()
  return [{ value: label, label, factor: 1 }]
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

  // picker state
  const [ingSearch, setIngSearch] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [selectedIng, setSelectedIng] = useState<Ingredient | null>(null)
  const [selectedQty, setSelectedQty] = useState('')
  const [selectedUnit, setSelectedUnit] = useState('')

  const fetchLinked = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${productId}/ingredients`)
      if (res.ok) {
        const data: ProductIngredientWithRelations[] = await res.json()
        setLinkedIngredients(data)
        const cost = data.reduce(
          (sum, pi) => sum + pi.ingredient.unitCost * pi.quantity,
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
      .then(r => r.json())
      .then(setAllIngredients)
      .catch(() => {})
  }, [fetchLinked])

  const linkedIds = linkedIngredients.map(li => li.ingredientId)

  const filteredIngredients = useMemo(() =>
    allIngredients
      .filter(i => !linkedIds.includes(i.id))
      .filter(i => i.name.toLowerCase().includes(ingSearch.toLowerCase())),
    [allIngredients, linkedIds, ingSearch]
  )

  async function handleAdd() {
    const rawQty = parseFloat(selectedQty)
    if (!selectedIng || !rawQty || rawQty <= 0) {
      toast.error('Selecione um insumo e informe quantidade válida')
      return
    }
    const units = getCompatibleUnits(selectedIng.unit)
    const unitOpt = units.find(u => u.value === selectedUnit) ?? units[0]
    const qty = rawQty * unitOpt.factor
    setAdding(true)
    try {
      const res = await fetch(`/api/products/${productId}/ingredients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredientId: selectedIng.id, quantity: qty }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Erro ao adicionar insumo')
        return
      }
      toast.success('Insumo adicionado!')
      setSelectedIng(null)
      setSelectedQty('')
      setSelectedUnit('')
      setIngSearch('')
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-20 text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Carregando...</span>
      </div>
    )
  }

  const totalCost = linkedIngredients.reduce(
    (sum, pi) => sum + pi.ingredient.unitCost * pi.quantity,
    0
  )

  return (
    <div className="space-y-4">
      {/* ── Picker row ── */}
      <div className="flex gap-2 items-end">
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Insumo</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9"
              placeholder={selectedIng ? selectedIng.name : 'Buscar insumo...'}
              value={selectedIng ? selectedIng.name : ingSearch}
              onChange={(e) => {
                setIngSearch(e.target.value)
                setSelectedIng(null)
                setShowPicker(true)
              }}
              onFocus={() => setShowPicker(true)}
              onBlur={() => setTimeout(() => setShowPicker(false), 150)}
            />
            {showPicker && filteredIngredients.length > 0 && (
              <div className="absolute z-50 w-full mt-1 rounded-lg border border-border bg-card shadow-lg max-h-44 overflow-y-auto">
                {filteredIngredients.map(ing => (
                  <button
                    key={ing.id}
                    type="button"
                    onMouseDown={() => {
                      setSelectedIng(ing)
                      setIngSearch(ing.name)
                      setShowPicker(false)
                      setSelectedUnit(getCompatibleUnits(ing.unit)[0].value)
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-secondary text-sm text-left"
                  >
                    <span className="font-medium text-foreground">{ing.name}</span>
                    <span className="text-muted-foreground text-xs ml-2 shrink-0">
                      {unitLabels[ing.unit] ?? ing.unit} · {formatCurrency(ing.unitCost)}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {showPicker && filteredIngredients.length === 0 && ingSearch.length > 0 && (
              <div className="absolute z-50 w-full mt-1 rounded-lg border border-border bg-card shadow-lg px-3 py-2 text-sm text-muted-foreground">
                Nenhum insumo encontrado
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Quantidade</Label>
          <div style={{ display: 'flex', gap: 4 }}>
            <Input
              type="number"
              step="any"
              min="0"
              placeholder="0"
              value={selectedQty}
              onChange={(e) => setSelectedQty(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              style={{ width: 80, textAlign: 'right' }}
            />
            {selectedIng ? (() => {
              const units = getCompatibleUnits(selectedIng.unit)
              return units.length > 1 ? (
                <select
                  value={selectedUnit}
                  onChange={e => setSelectedUnit(e.target.value)}
                  style={{ border: '1px solid var(--tf-border)', borderRadius: 6, background: 'var(--tf-input-bg)', color: 'var(--tf-txt)', padding: '0 6px', fontSize: 12, cursor: 'pointer', outline: 'none', width: 52 }}
                >
                  {units.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--tf-txt2)', paddingLeft: 4, whiteSpace: 'nowrap' }}>
                  {units[0].label}
                </span>
              )
            })() : (
              <span style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--tf-txt3)', paddingLeft: 4 }}>un</span>
            )}
          </div>
        </div>

        <Button
          onClick={handleAdd}
          disabled={adding}
          className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>

      {/* ── Ingredient list ── */}
      {linkedIngredients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border rounded-lg gap-2 text-muted-foreground">
          <Package className="w-8 h-8 opacity-40" />
          <p className="text-sm">Nenhum insumo vinculado</p>
          <p className="text-xs opacity-70">Busque e adicione os ingredientes acima</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          {/* header */}
          <div className="grid grid-cols-[1fr_80px_90px_90px_36px] gap-2 px-4 py-2 bg-muted/50 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground">Insumo</span>
            <span className="text-xs font-medium text-muted-foreground text-right">Qtd.</span>
            <span className="text-xs font-medium text-muted-foreground text-right">Custo unit.</span>
            <span className="text-xs font-medium text-muted-foreground text-right">Subtotal</span>
            <span />
          </div>

          {linkedIngredients.map((pi, idx) => {
            const subtotal = pi.ingredient.unitCost * pi.quantity
            return (
              <div
                key={pi.id}
                className={`grid grid-cols-[1fr_80px_90px_90px_36px] gap-2 px-4 py-2.5 items-center text-sm ${
                  idx % 2 === 0 ? 'bg-card' : 'bg-muted/20'
                }`}
              >
                <div>
                  <span className="font-medium text-foreground">{pi.ingredient.name}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({unitLabels[pi.ingredient.unit] ?? pi.ingredient.unit})
                  </span>
                </div>
                <span className="font-mono text-muted-foreground text-right text-xs">
                  {pi.quantity.toFixed(3)}
                </span>
                <span className="font-mono text-muted-foreground text-right text-xs">
                  {formatCurrency(pi.ingredient.unitCost)}
                </span>
                <span className="font-mono text-foreground text-right text-xs font-medium">
                  {formatCurrency(subtotal)}
                </span>
                <div className="flex justify-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleRemove(pi.ingredientId)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}

          {/* footer total */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {linkedIngredients.length} insumo(s)
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Custo total:</span>
              <span className="text-sm font-semibold text-primary">{formatCurrency(totalCost)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
