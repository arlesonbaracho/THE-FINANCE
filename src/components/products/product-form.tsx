'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ProductIngredients } from './product-ingredients'
import { Loader2, Plus, Trash2, Search, ChefHat, Package } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import type { ProductWithRelations } from '@/types'

interface Category { id: string; name: string }
interface Ingredient { id: string; name: string; unit: string; unitCost: number }
interface PendingItem { ingredientId: string; quantity: number; ingredient: Ingredient }

const unitLabels: Record<string, string> = {
  KG: 'kg', G: 'g', L: 'L', ML: 'ml', UN: 'un',
}

type FormValues = {
  name: string
  salePrice: number
  categoryId?: string
}

interface ProductFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: ProductWithRelations | null
  onSuccess: () => void
}

export function ProductForm({ open, onOpenChange, product, onSuccess }: ProductFormProps) {
  const isEdit = !!product

  const [categories, setCategories] = useState<Category[]>([])
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('details')

  // ingredient picker (new product only — buffered before save)
  const [ingSearch, setIngSearch] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [selectedIng, setSelectedIng] = useState<Ingredient | null>(null)
  const [selectedQty, setSelectedQty] = useState('')
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([])

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: { name: '', salePrice: 0 },
  })

  useEffect(() => {
    if (open) {
      fetch('/api/categories?type=PRODUCT').then(r => r.json()).then(setCategories).catch(() => {})
      fetch('/api/ingredients').then(r => r.json()).then(setAllIngredients).catch(() => {})
      setActiveTab('details')
      setPendingItems([])
      setIngSearch('')
      setSelectedIng(null)
      setSelectedQty('')
      setShowPicker(false)
    }
  }, [open])

  useEffect(() => {
    if (product) {
      reset({ name: product.name, salePrice: product.salePrice, categoryId: product.categoryId ?? undefined })
    } else {
      reset({ name: '', salePrice: 0, categoryId: undefined })
    }
  }, [product, reset])

  const pendingIds = pendingItems.map(p => p.ingredientId)

  const filteredIngredients = useMemo(() =>
    allIngredients
      .filter(i => !pendingIds.includes(i.id))
      .filter(i => i.name.toLowerCase().includes(ingSearch.toLowerCase())),
    [allIngredients, pendingIds, ingSearch]
  )

  function addPendingItem() {
    const qty = parseFloat(selectedQty)
    if (!selectedIng || !qty || qty <= 0) {
      toast.error('Selecione um insumo e informe quantidade válida')
      return
    }
    setPendingItems(prev => [...prev, { ingredientId: selectedIng.id, quantity: qty, ingredient: selectedIng }])
    setSelectedIng(null)
    setSelectedQty('')
    setIngSearch('')
  }

  const pendingCost = pendingItems.reduce((sum, p) => sum + p.ingredient.unitCost * p.quantity, 0)

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const url = product ? `/api/products/${product.id}` : '/api/products'
      const method = product ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, categoryId: values.categoryId || null }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Erro ao salvar produto')
        return
      }
      const saved = await res.json()

      if (!isEdit && pendingItems.length > 0) {
        await Promise.all(
          pendingItems.map(p =>
            fetch(`/api/products/${saved.id}/ingredients`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ingredientId: p.ingredientId, quantity: p.quantity }),
            })
          )
        )
      }

      toast.success(product ? 'Produto atualizado!' : 'Produto criado!')
      onSuccess()
      onOpenChange(false)
    } catch {
      toast.error('Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10">
              <ChefHat className="w-4 h-4 text-primary" />
            </span>
            {product ? 'Editar Produto' : 'Novo Produto'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="details">Detalhes</TabsTrigger>
            <TabsTrigger value="ingredients" className="relative">
              Insumos
              {!isEdit && pendingItems.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                  {pendingItems.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <form onSubmit={handleSubmit(onSubmit)}>
            {/* ── Tab: Detalhes ── */}
            <TabsContent value="details" className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label>Nome do produto</Label>
                <Input
                  placeholder="Ex: X-Burguer Especial"
                  {...register('name', { required: 'Nome é obrigatório' })}
                />
                {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Preço de Venda (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    {...register('salePrice', {
                      valueAsNumber: true,
                      min: { value: 0, message: 'Preço inválido' },
                    })}
                  />
                  {errors.salePrice && <p className="text-destructive text-xs">{errors.salePrice.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Controller
                    name="categoryId"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value ?? 'none'}
                        onValueChange={(v) => field.onChange(v === 'none' ? undefined : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sem categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem categoria</SelectItem>
                          {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              {!isEdit && pendingItems.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    <span className="text-foreground font-semibold">{pendingItems.length} insumo(s)</span> na composição ·{' '}
                    Custo estimado:{' '}
                    <span className="text-primary font-semibold">{formatCurrency(pendingCost)}</span>
                  </p>
                </div>
              )}
            </TabsContent>

            {/* ── Tab: Insumos ── */}
            <TabsContent value="ingredients" className="mt-5">
              {isEdit ? (
                <ProductIngredients productId={product.id} />
              ) : (
                <div className="space-y-4">
                  {/* picker row */}
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1.5">
                      <Label>Insumo</Label>
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
                    <div className="w-28 space-y-1.5">
                      <Label>Quantidade</Label>
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        placeholder="0.000"
                        value={selectedQty}
                        onChange={(e) => setSelectedQty(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPendingItem())}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={addPendingItem}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* pending list */}
                  {pendingItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 border border-dashed border-border rounded-lg gap-2 text-muted-foreground">
                      <Package className="w-8 h-8 opacity-40" />
                      <p className="text-sm">Nenhum insumo adicionado</p>
                      <p className="text-xs opacity-70">Busque e adicione os ingredientes deste produto</p>
                    </div>
                  ) : (
                    <div className="space-y-1 rounded-lg border border-border overflow-hidden">
                      {pendingItems.map((item, idx) => (
                        <div
                          key={item.ingredientId}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm ${idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}`}
                        >
                          <span className="flex-1 font-medium text-foreground">{item.ingredient.name}</span>
                          <span className="text-muted-foreground text-xs w-16 text-right">
                            {item.quantity} {unitLabels[item.ingredient.unit] ?? item.ingredient.unit}
                          </span>
                          <span className="text-muted-foreground text-xs w-20 text-right">
                            {formatCurrency(item.ingredient.unitCost * item.quantity)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setPendingItems(prev => prev.filter(p => p.ingredientId !== item.ingredientId))}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-t border-border">
                        <span className="text-xs text-muted-foreground font-medium">{pendingItems.length} insumo(s)</span>
                        <span className="text-sm font-semibold text-primary">{formatCurrency(pendingCost)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <Separator className="my-4" />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {loading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>
                  : isEdit ? 'Salvar Alterações' : 'Criar Produto'
                }
              </Button>
            </div>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
