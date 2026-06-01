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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ProductIngredients } from './product-ingredients'
import { Loader2, Trash2, Search, ChefHat, Package, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import type { ProductWithRelations } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Category { id: string; name: string }
interface Ingredient { id: string; name: string; unit: string; unitCost: number }
interface PendingItem { ingredientId: string; quantity: number; ingredient: Ingredient }

type FormValues = {
  name: string
  salePrice: number
  categoryId?: string
  active: boolean
}

export interface ProductFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: ProductWithRelations | null
  onSuccess: () => void
}

// ── Constants ──────────────────────────────────────────────────────────────────

const unitLabels: Record<string, string> = { KG: 'kg', G: 'g', L: 'L', ML: 'ml', UN: 'un' }

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

// ── Helpers ────────────────────────────────────────────────────────────────────

function margemColor(m: number) {
  if (m >= 30) return 'var(--tf-green-ok)'
  if (m >= 15) return 'var(--tf-yellow)'
  return 'var(--tf-red)'
}

function margemDiag(m: number) {
  if (m >= 40) return '✓ Margem excelente — produto muito rentável.'
  if (m >= 25) return '✓ Margem saudável para restaurantes.'
  if (m >= 10) return '⚠ Margem baixa — considere revisar o preço.'
  return '✗ Margem crítica — produto operando no prejuízo.'
}

// ── Step progress bar ──────────────────────────────────────────────────────────

type StepState = 'idle' | 'done' | 'error'

function StepBar({ steps, activeIdx }: { steps: { label: string; state: StepState }[]; activeIdx: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: '4px 0 12px' }}>
      {steps.map((step, i) => {
        const isActive = i === activeIdx
        const color =
          step.state === 'done'  ? 'var(--tf-green-ok)' :
          step.state === 'error' ? 'var(--tf-red)'      :
          isActive               ? 'var(--tf-primary)'  : 'var(--tf-txt3)'

        const circleBg = step.state !== 'idle' || isActive ? color : 'transparent'

        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : undefined }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                border: `2px solid ${color}`,
                background: circleBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700,
                color: step.state !== 'idle' || isActive ? '#fff' : color,
                flexShrink: 0,
              }}>
                {step.state === 'done' ? '✓' : step.state === 'error' ? '!' : i + 1}
              </div>
              <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, color, whiteSpace: 'nowrap' }}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: 'var(--tf-border-light)', margin: '0 6px', marginBottom: 14 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ProductForm({ open, onOpenChange, product, onSuccess }: ProductFormProps) {
  const isEdit = !!product

  const [categories, setCategories] = useState<Category[]>([])
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const [tentouSalvar, setTentouSalvar] = useState(false)

  // Ingredient state
  const [ingSearch, setIngSearch] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([])

  // Quantity selector (shown after picking an ingredient)
  const [selectedForAdd, setSelectedForAdd] = useState<Ingredient | null>(null)
  const [addQtyStr, setAddQtyStr] = useState('')
  const [addUnit, setAddUnit] = useState('')

  // Financial simulator
  const [margemDesejada, setMargemDesejada] = useState(35)

  const { register, handleSubmit, control, reset, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: { name: '', salePrice: 0, active: true },
  })

  const watchedName  = watch('name')    ?? ''
  const watchedPrice = watch('salePrice') ?? 0

  // ── Derived costs ────────────────────────────────────────────────────────────

  const pendingCost = useMemo(
    () => pendingItems.reduce((s, p) => s + p.ingredient.unitCost * p.quantity, 0),
    [pendingItems]
  )

  const editCost = useMemo(() => {
    if (!product?.ingredients) return 0
    return product.ingredients.reduce(
      (s, pi) => s + (pi.ingredient?.unitCost ?? 0) * (pi.quantity ?? 0), 0
    )
  }, [product])

  const custoTotal      = isEdit ? editCost : pendingCost
  const lucro           = watchedPrice - custoTotal
  const margem          = watchedPrice > 0 ? (lucro / watchedPrice) * 100 : 0
  const precoSugerido   = margemDesejada < 100 && custoTotal > 0
    ? custoTotal / (1 - margemDesejada / 100) : 0

  // ── Step state ───────────────────────────────────────────────────────────────

  const detailsDone  = watchedName.trim() !== '' && watchedPrice > 0
  const ingredsDone  = isEdit ? true : pendingItems.length > 0
  const ingredsError = tentouSalvar && !ingredsDone

  const steps: { label: string; state: StepState }[] = [
    { label: 'Detalhes',   state: detailsDone ? 'done' : 'idle' },
    { label: 'Insumos',    state: ingredsError ? 'error' : ingredsDone ? 'done' : 'idle' },
    { label: 'Financeiro', state: watchedPrice > 0 && custoTotal > 0 ? 'done' : 'idle' },
  ]

  const tabIdx = activeTab === 'details' ? 0 : activeTab === 'ingredients' ? 1 : 2

  // ── Ingredient picker ────────────────────────────────────────────────────────

  const pendingIds = useMemo(() => pendingItems.map(p => p.ingredientId), [pendingItems])

  const filteredIngredients = useMemo(() =>
    allIngredients
      .filter(i => !pendingIds.includes(i.id))
      .filter(i => i.name.toLowerCase().includes(ingSearch.toLowerCase())),
    [allIngredients, pendingIds, ingSearch]
  )

  function selectIngredient(ing: Ingredient) {
    const units = getCompatibleUnits(ing.unit)
    setSelectedForAdd(ing)
    setAddUnit(units[0].value)
    setAddQtyStr('')
    setShowPicker(false)
    setIngSearch(ing.name)
  }

  function confirmAdd() {
    if (!selectedForAdd) return
    const qty = parseFloat(addQtyStr)
    if (!qty || qty <= 0) return
    const units = getCompatibleUnits(selectedForAdd.unit)
    const unitOpt = units.find(u => u.value === addUnit) ?? units[0]
    const convertedQty = qty * unitOpt.factor
    setPendingItems(prev => [...prev, { ingredientId: selectedForAdd.id, quantity: convertedQty, ingredient: selectedForAdd }])
    setSelectedForAdd(null)
    setAddQtyStr('')
    setIngSearch('')
  }

  function cancelAdd() {
    setSelectedForAdd(null)
    setAddQtyStr('')
    setIngSearch('')
  }

  function updateQty(id: string, qty: number) {
    setPendingItems(prev => prev.map(p => p.ingredientId === id ? { ...p, quantity: qty } : p))
  }

  function removeItem(id: string) {
    setPendingItems(prev => prev.filter(p => p.ingredientId !== id))
  }

  // ── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      fetch('/api/categories?type=PRODUCT').then(r => r.json()).then(data => setCategories(Array.isArray(data) ? data : [])).catch(() => {})
      fetch('/api/ingredients').then(r => r.json()).then(data => setAllIngredients(Array.isArray(data) ? data : [])).catch(() => {})
      setActiveTab('details')
      setPendingItems([])
      setIngSearch('')
      setShowPicker(false)
      setTentouSalvar(false)
      setMargemDesejada(35)
      setSelectedForAdd(null)
      setAddQtyStr('')
      setAddUnit('')
    }
  }, [open])

  useEffect(() => {
    if (product) {
      reset({ name: product.name, salePrice: product.salePrice, categoryId: product.categoryId ?? undefined, active: product.active })
    } else {
      reset({ name: '', salePrice: 0, categoryId: undefined, active: true })
    }
  }, [product, reset])

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function onSubmit(values: FormValues) {
    if (!isEdit && pendingItems.length === 0) {
      setTentouSalvar(true)
      setActiveTab('ingredients')
      return
    }

    setLoading(true)
    try {
      const url    = product ? `/api/products/${product.id}` : '/api/products'
      const method = product ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: values.name, salePrice: values.salePrice, categoryId: values.categoryId || null, active: values.active }),
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

  const canSubmit = watchedName.trim() !== '' && watchedPrice > 0 && (isEdit || pendingItems.length > 0)

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl"
        style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '92vh', overflow: 'hidden' }}
      >
        {/* Header */}
        <DialogHeader style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <DialogTitle style={{ color: 'var(--tf-txt)', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'var(--tf-primary-bg)' }}>
              <ChefHat style={{ width: 16, height: 16, color: 'var(--tf-primary)' }} />
            </span>
            {product ? 'Editar Produto' : 'Novo Produto'}
          </DialogTitle>
        </DialogHeader>

        {/* Progress bar */}
        <div style={{ padding: '0 24px', flexShrink: 0 }}>
          <StepBar steps={steps} activeIdx={tabIdx} />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <Tabs value={activeTab} onValueChange={setActiveTab} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div style={{ padding: '0 24px', flexShrink: 0 }}>
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="details" style={{ fontSize: 12.5 }}>Detalhes</TabsTrigger>
                <TabsTrigger value="ingredients" style={{ fontSize: 12.5 }}>
                  Insumos
                  {!isEdit && pendingItems.length > 0 && (
                    <span style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: 'var(--tf-primary)', color: '#fff', fontSize: 10, fontWeight: 700 }}>
                      {pendingItems.length}
                    </span>
                  )}
                  {ingredsError && (
                    <span style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', background: 'var(--tf-red)', color: '#fff', fontSize: 10, fontWeight: 700 }}>!</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="financial" style={{ fontSize: 12.5 }}>Financeiro</TabsTrigger>
              </TabsList>
            </div>

            {/* Scrollable tab body */}
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>

            {/* ── Tab 1: Detalhes ── */}
            <TabsContent value="details" className="mt-0 space-y-4" style={{ padding: '20px 24px' }}>

              <div className="space-y-1.5">
                <Label style={{ color: 'var(--tf-txt2)', fontSize: 12 }}>Nome do produto *</Label>
                <Input placeholder="Ex: X-Burguer Especial" {...register('name', { required: 'Nome é obrigatório' })} />
                {errors.name && <p style={{ color: 'var(--tf-red)', fontSize: 11 }}>{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label style={{ color: 'var(--tf-txt2)', fontSize: 12 }}>Preço de venda (R$) *</Label>
                  <Input type="number" step="0.01" min="0" placeholder="0,00"
                    {...register('salePrice', { valueAsNumber: true, min: { value: 0, message: 'Preço inválido' } })} />
                  {errors.salePrice && <p style={{ color: 'var(--tf-red)', fontSize: 11 }}>{errors.salePrice.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label style={{ color: 'var(--tf-txt2)', fontSize: 12 }}>Categoria</Label>
                  <Controller name="categoryId" control={control} render={({ field }) => (
                    <select
                      value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value || undefined)}
                      style={{
                        width: '100%', height: 32, padding: '0 10px',
                        borderRadius: 6, border: '1px solid var(--tf-border)',
                        background: 'var(--tf-input-bg)', color: field.value ? 'var(--tf-txt)' : 'var(--tf-txt3)',
                        fontSize: 13, cursor: 'pointer', outline: 'none',
                        appearance: 'auto',
                      }}
                    >
                      <option value="">Sem categoria</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  )} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label style={{ color: 'var(--tf-txt2)', fontSize: 12 }}>Tempo de preparo (min)</Label>
                  <Input type="number" step="1" min="0" defaultValue={15} />
                </div>
                <div className="space-y-1.5">
                  <Label style={{ color: 'var(--tf-txt2)', fontSize: 12 }}>Porção / rende</Label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Input type="number" step="0.1" min="0" placeholder="1" style={{ flex: 1 }} />
                    <select style={{ border: '1px solid var(--tf-border)', borderRadius: 6, background: 'var(--tf-input-bg)', color: 'var(--tf-txt)', padding: '0 8px', fontSize: 13, cursor: 'pointer', outline: 'none', width: 64 }}>
                      <option value="un">un</option>
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                      <option value="ml">ml</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Disponível toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--tf-surface2)', borderRadius: 6, border: '1px solid var(--tf-border-light)' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--tf-txt)', margin: 0 }}>Disponível para venda</p>
                  <p style={{ fontSize: 11, color: 'var(--tf-txt3)', margin: '2px 0 0' }}>Produto aparece no cardápio</p>
                </div>
                <Controller name="active" control={control} render={({ field }) => (
                  <button
                    type="button"
                    onClick={() => field.onChange(!field.value)}
                    style={{ width: 42, height: 24, borderRadius: 9999, padding: 2, background: field.value ? 'var(--tf-primary)' : 'var(--tf-border)', border: 'none', cursor: 'pointer', transition: 'background 200ms', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  >
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', transform: field.value ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 200ms' }} />
                  </button>
                )} />
              </div>

              {/* Cost preview */}
              {!isEdit && pendingItems.length > 0 && (
                <div style={{ background: 'var(--tf-primary-bg)', border: '1px solid var(--tf-primary-bd)', borderRadius: 6, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>{pendingItems.length} insumo(s) · custo estimado</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tf-primary)' }}>{formatCurrency(pendingCost)}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="button" onClick={() => setActiveTab('ingredients')} className="bg-primary hover:bg-primary/90 text-primary-foreground" style={{ fontSize: 12.5 }}>
                  Próximo: adicionar insumos →
                </Button>
              </div>
            </TabsContent>

            {/* ── Tab 2: Insumos ── */}
            <TabsContent value="ingredients" className="mt-0 space-y-4" style={{ padding: '20px 24px' }}>
              {isEdit ? (
                <ProductIngredients productId={product.id} />
              ) : (
                <>
                  {/* Alert block */}
                  <div style={{
                    borderRadius: 6, padding: '10px 14px',
                    background: pendingItems.length > 0 ? 'var(--tf-green-ok-bg)' : 'var(--tf-red-bg)',
                    border: `1px solid ${pendingItems.length > 0 ? 'var(--tf-green-ok-bd)' : 'var(--tf-red-bd)'}`,
                  }}>
                    <p style={{ fontSize: 12, margin: 0, fontWeight: 500, color: pendingItems.length > 0 ? 'var(--tf-green-ok)' : 'var(--tf-red)' }}>
                      {pendingItems.length > 0
                        ? `Insumos adicionados — ${pendingItems.length} insumo(s) vinculado(s) a este produto.`
                        : 'Insumos obrigatórios — Adicione ao menos 1 insumo para criar o produto.'
                      }
                    </p>
                  </div>

                  {/* Search */}
                  <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--tf-txt3)', pointerEvents: 'none' }} />
                    <Input
                      className="pl-9"
                      placeholder="Buscar insumo para adicionar..."
                      value={selectedForAdd ? selectedForAdd.name : ingSearch}
                      readOnly={!!selectedForAdd}
                      onChange={e => { setIngSearch(e.target.value); setShowPicker(true); setSelectedForAdd(null) }}
                      onFocus={() => { if (!selectedForAdd) setShowPicker(true) }}
                      onBlur={() => setTimeout(() => setShowPicker(false), 150)}
                      style={{ borderColor: selectedForAdd ? 'var(--tf-primary)' : ingredsError && pendingItems.length === 0 ? 'var(--tf-red)' : undefined }}
                    />
                    {showPicker && !selectedForAdd && (
                      <div style={{ position: 'absolute', zIndex: 50, width: '100%', marginTop: 4, background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', maxHeight: 200, overflowY: 'auto' }}>
                        {filteredIngredients.length === 0 ? (
                          <div style={{ padding: '10px 14px', fontSize: 13, color: 'var(--tf-txt3)' }}>
                            {ingSearch ? 'Nenhum insumo encontrado' : 'Digite para buscar'}
                          </div>
                        ) : filteredIngredients.map(ing => (
                          <button
                            key={ing.id}
                            type="button"
                            onMouseDown={() => selectIngredient(ing)}
                            className="hover:bg-muted/40"
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--tf-border-light)', cursor: 'pointer', textAlign: 'left' }}
                          >
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--tf-txt)' }}>{ing.name}</span>
                            <span style={{ fontSize: 11, color: 'var(--tf-txt3)', marginLeft: 8, flexShrink: 0 }}>
                              {unitLabels[ing.unit] ?? ing.unit} · {formatCurrency(ing.unitCost)}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quantity selector — shown after picking an ingredient */}
                  {selectedForAdd && (() => {
                    const units = getCompatibleUnits(selectedForAdd.unit)
                    const unitOpt = units.find(u => u.value === addUnit) ?? units[0]
                    const preview = parseFloat(addQtyStr) > 0
                      ? parseFloat(addQtyStr) * unitOpt.factor
                      : null
                    return (
                      <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: 'var(--tf-primary-bg)', border: '1px solid var(--tf-primary-bd)', borderRadius: 8, alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 11, color: 'var(--tf-primary)', fontWeight: 600, margin: '0 0 1px' }}>Quantidade usada por porção</p>
                          <p style={{ fontSize: 11, color: 'var(--tf-txt3)', margin: 0 }}>
                            {selectedForAdd.name}
                            {preview !== null && (
                              <span style={{ marginLeft: 6, color: 'var(--tf-primary)' }}>
                                → {preview < 0.01 ? preview.toFixed(4) : preview % 1 === 0 ? preview.toString() : preview.toFixed(3)} {unitLabels[selectedForAdd.unit] ?? selectedForAdd.unit}
                              </span>
                            )}
                          </p>
                        </div>
                        <Input
                          type="number"
                          autoFocus
                          step="any"
                          min="0.001"
                          placeholder="0"
                          value={addQtyStr}
                          onChange={e => setAddQtyStr(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmAdd() } if (e.key === 'Escape') cancelAdd() }}
                          style={{ width: 80, textAlign: 'right', fontSize: 13 }}
                        />
                        {units.length > 1 ? (
                          <select
                            value={addUnit}
                            onChange={e => setAddUnit(e.target.value)}
                            style={{ border: '1px solid var(--tf-border)', borderRadius: 6, background: 'var(--tf-input-bg)', color: 'var(--tf-txt)', padding: '0 8px', fontSize: 13, height: 36, cursor: 'pointer', outline: 'none' }}
                          >
                            {units.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                          </select>
                        ) : (
                          <span style={{ fontSize: 13, color: 'var(--tf-txt2)', minWidth: 28, textAlign: 'center', fontWeight: 500 }}>
                            {units[0].label}
                          </span>
                        )}
                        <Button
                          type="button"
                          onClick={confirmAdd}
                          disabled={!addQtyStr || parseFloat(addQtyStr) <= 0}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                          style={{ height: 36, padding: '0 12px', fontSize: 12 }}
                        >
                          <Plus style={{ width: 14, height: 14, marginRight: 4 }} />
                          Adicionar
                        </Button>
                        <button
                          type="button"
                          onClick={cancelAdd}
                          style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid var(--tf-border)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tf-txt3)', fontSize: 16, lineHeight: 1, flexShrink: 0 }}
                          title="Cancelar"
                        >×</button>
                      </div>
                    )
                  })()}

                  {/* List */}
                  {pendingItems.length === 0 ? (
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      padding: '32px 16px', gap: 8,
                      border: `1px dashed ${ingredsError ? 'var(--tf-red)' : 'var(--tf-border)'}`,
                      borderRadius: 6,
                    }}>
                      <Package style={{ width: 32, height: 32, color: ingredsError ? 'var(--tf-red)' : 'var(--tf-txt3)', opacity: 0.5 }} />
                      <p style={{ fontSize: 13, color: ingredsError ? 'var(--tf-red)' : 'var(--tf-txt3)', margin: 0, fontWeight: ingredsError ? 500 : 400 }}>
                        {ingredsError ? 'Adicione ao menos 1 insumo para continuar' : 'Nenhum insumo adicionado'}
                      </p>
                    </div>
                  ) : (
                    <div style={{ border: '1px solid var(--tf-border)', borderRadius: 6, overflow: 'hidden' }}>
                      {/* List header */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 90px 32px', gap: 8, padding: '6px 14px', background: 'var(--tf-surface2)', borderBottom: '1px solid var(--tf-border-light)' }}>
                        {['Insumo', 'Quantidade', 'Custo', ''].map((h, i) => (
                          <span key={i} style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tf-txt3)', textAlign: i === 2 ? 'right' : 'left' }}>{h}</span>
                        ))}
                      </div>

                      {pendingItems.map((item, idx) => {
                        const custoItem = item.ingredient.unitCost * item.quantity
                        return (
                          <div
                            key={item.ingredientId}
                            style={{ display: 'grid', gridTemplateColumns: '1fr 130px 90px 32px', gap: 8, padding: '8px 14px', alignItems: 'center', borderBottom: idx < pendingItems.length - 1 ? '1px solid var(--tf-border-light)' : undefined }}
                          >
                            <div>
                              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--tf-txt)', margin: 0 }}>{item.ingredient.name}</p>
                              <p style={{ fontSize: 11, color: 'var(--tf-txt3)', margin: '1px 0 0' }}>
                                {formatCurrency(item.ingredient.unitCost)}/{unitLabels[item.ingredient.unit] ?? item.ingredient.unit}
                              </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Input
                                type="number" step="0.001" min="0.001"
                                value={item.quantity}
                                onChange={e => updateQty(item.ingredientId, parseFloat(e.target.value) || 0)}
                                style={{ width: 76, textAlign: 'right', fontSize: 12 }}
                              />
                              <span style={{ fontSize: 11, color: 'var(--tf-txt3)', flexShrink: 0 }}>
                                {unitLabels[item.ingredient.unit] ?? item.ingredient.unit}
                              </span>
                            </div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-green-ok)', textAlign: 'right', margin: 0 }}>
                              {formatCurrency(custoItem)}
                            </p>
                            <button
                              type="button"
                              onClick={() => removeItem(item.ingredientId)}
                              className="hover:bg-red-50 dark:hover:bg-red-950"
                              style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid var(--tf-border)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tf-txt3)' }}
                            >
                              <Trash2 style={{ width: 13, height: 13 }} />
                            </button>
                          </div>
                        )
                      })}

                      {/* List footer */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', background: 'var(--tf-primary-bg)', borderTop: '1px solid var(--tf-primary-bd)' }}>
                        <span style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>Custo total dos insumos</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tf-primary)' }}>{formatCurrency(pendingCost)}</span>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button type="button" variant="outline" onClick={() => setActiveTab('financial')} style={{ fontSize: 12.5 }}>
                      Ver análise financeira →
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ── Tab 3: Financeiro ── */}
            <TabsContent value="financial" className="mt-0 space-y-4" style={{ padding: '20px 24px' }}>

              {/* Summary */}
              <div style={{ border: '1px solid var(--tf-border)', borderRadius: 6, overflow: 'hidden' }}>
                {([
                  { label: 'Preço de venda',   value: formatCurrency(watchedPrice), color: 'var(--tf-txt)' },
                  { label: 'Custo dos insumos', value: formatCurrency(custoTotal),  color: 'var(--tf-txt2)' },
                  { label: 'Lucro bruto',       value: formatCurrency(lucro),       color: lucro >= 0 ? 'var(--tf-green-ok)' : 'var(--tf-red)' },
                ] as const).map((row, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: i < 2 ? '1px solid var(--tf-border-light)' : undefined, background: i === 2 ? 'var(--tf-surface2)' : 'var(--tf-surface)' }}>
                    <span style={{ fontSize: 13, color: 'var(--tf-txt3)' }}>{row.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: row.color, fontFamily: 'monospace' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Margem bar */}
              <div style={{ border: '1px solid var(--tf-border)', borderRadius: 6, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--tf-txt3)' }}>Margem</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: margemColor(margem) }}>{margem.toFixed(1)}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 9999, background: 'var(--tf-border)', overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ height: '100%', borderRadius: 9999, background: margemColor(margem), width: `${Math.min(Math.max(margem, 0), 100)}%`, transition: 'width 400ms, background 400ms' }} />
                </div>
                <p style={{ fontSize: 12, color: margemColor(margem), margin: 0, fontWeight: 500 }}>{margemDiag(margem)}</p>
              </div>

              {/* Price simulator */}
              <div style={{ border: '1px solid var(--tf-border)', borderRadius: 6, padding: '14px 16px' }}>
                <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tf-txt3)', margin: '0 0 10px' }}>
                  Simulador de preço sugerido
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--tf-txt3)', flexShrink: 0 }}>Margem desejada</span>
                  <Input
                    type="number" step="1" min="0" max="99"
                    value={margemDesejada}
                    onChange={e => setMargemDesejada(parseFloat(e.target.value) || 0)}
                    style={{ width: 72, textAlign: 'center' }}
                  />
                  <span style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>%</span>
                </div>
                {precoSugerido > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--tf-primary-bg)', border: '1px solid var(--tf-primary-bd)', borderRadius: 6, padding: '8px 12px' }}>
                    <span style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>Preço sugerido com {margemDesejada}% de margem</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--tf-primary)' }}>{formatCurrency(precoSugerido)}</span>
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--tf-txt3)', margin: 0 }}>Adicione insumos para ver o preço sugerido.</p>
                )}
              </div>
            </TabsContent>

            </div>{/* end scrollable body */}
          </Tabs>

          {/* ── Footer ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderTop: '1px solid var(--tf-border)', background: 'var(--tf-surface2)', flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: canSubmit ? 'var(--tf-green-ok)' : 'var(--tf-red)' }}>
              {canSubmit ? '✓ Pronto para criar' : 'Adicione insumos para liberar'}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {loading
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>
                  : isEdit ? 'Salvar Alterações' : 'Criar Produto'
                }
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
