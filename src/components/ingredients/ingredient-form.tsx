'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import type { IngredientWithRelations } from '@/types'

type FormValues = {
  name: string
  unit: 'KG' | 'G' | 'L' | 'ML' | 'UN'
  currentQty: number
  minimumQty: number
  pontoReposicao: number
  unitCost: number
  categoryId?: string
  supplierId?: string
}

type TipoEmbalagem = 'unidade' | 'pacote'

interface Category { id: string; name: string }
interface Supplier  { id: string; name: string }

export interface IngredientFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ingredient?: IngredientWithRelations | null
  onSuccess: () => void
}

const UNITS: { value: 'KG' | 'G' | 'L' | 'ML' | 'UN'; label: string; short: string; step: number }[] = [
  { value: 'KG', label: 'kg', short: 'kg', step: 0.1 },
  { value: 'G',  label: 'g',  short: 'g',  step: 0.1 },
  { value: 'L',  label: 'L',  short: 'L',  step: 0.1 },
  { value: 'ML', label: 'ml', short: 'ml', step: 0.1 },
  { value: 'UN', label: 'un', short: 'un', step: 1   },
]

function fmtQty(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
}

function segBtn(active: boolean): React.CSSProperties {
  return active
    ? { background: 'var(--tf-primary)', color: 'var(--tf-primary-txt)', border: '1px solid var(--tf-primary)', borderRadius: 5, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
    : { background: 'transparent', color: 'var(--tf-txt3)', border: '1px solid var(--tf-border)', borderRadius: 5, padding: '4px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' }
}

const inp: React.CSSProperties = {
  background: 'var(--tf-input-bg)',
  borderColor: 'var(--tf-input-border)',
  color: 'var(--tf-txt)',
}

const selTrigger: React.CSSProperties = {
  background: 'var(--tf-input-bg)',
  borderColor: 'var(--tf-input-border)',
  color: 'var(--tf-txt)',
  height: 32,
}

export function IngredientForm({ open, onOpenChange, ingredient, onSuccess }: IngredientFormProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers,  setSuppliers]  = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)

  const [tipoEmbalagem,   setTipoEmbalagem]   = useState<TipoEmbalagem>('unidade')
  const [custoTotalPacote, setCustoTotalPacote] = useState('')
  const [qtdPorPacote,    setQtdPorPacote]    = useState('')
  const [qtdDesejada,     setQtdDesejada]     = useState(1)

  const { register, handleSubmit, control, reset, watch, formState: { errors } } =
    useForm<FormValues>({ defaultValues: { name: '', unit: 'KG', currentQty: 0, minimumQty: 0, pontoReposicao: 0, unitCost: 0 } })

  const watchedUnit       = watch('unit')
  const watchedUnitCost   = watch('unitCost') ?? 0
  const watchedCurrentQty = watch('currentQty') ?? 0
  const unitMeta = UNITS.find(u => u.value === watchedUnit) ?? UNITS[0]

  const custoUnitario =
    tipoEmbalagem === 'unidade'
      ? watchedUnitCost
      : parseFloat(custoTotalPacote) > 0 && parseFloat(qtdPorPacote) >= 1
        ? parseFloat(custoTotalPacote) / parseFloat(qtdPorPacote)
        : 0

  const custoParaProduto = qtdDesejada * custoUnitario

  useEffect(() => {
    if (open) {
      fetch('/api/categories?type=INGREDIENT').then(r => r.json()).then(setCategories).catch(() => {})
      fetch('/api/suppliers').then(r => r.json()).then(setSuppliers).catch(() => {})
    }
  }, [open])

  useEffect(() => {
    if (ingredient) {
      reset({
        name: ingredient.name, unit: ingredient.unit,
        currentQty: ingredient.currentQty, minimumQty: ingredient.minimumQty,
        pontoReposicao: ingredient.pontoReposicao ?? 0, unitCost: ingredient.unitCost,
        categoryId: ingredient.categoryId ?? undefined, supplierId: ingredient.supplierId ?? undefined,
      })
    } else {
      reset({ name: '', unit: 'KG', currentQty: 0, minimumQty: 0, pontoReposicao: 0, unitCost: 0 })
    }
    setTipoEmbalagem('unidade'); setCustoTotalPacote(''); setQtdPorPacote(''); setQtdDesejada(1)
  }, [ingredient, reset, open])

  async function onSubmit(values: FormValues) {
    const finalUnitCost = tipoEmbalagem === 'pacote'
      ? parseFloat(custoTotalPacote) / parseFloat(qtdPorPacote)
      : values.unitCost

    if (!(finalUnitCost > 0)) { toast.error('Custo deve ser maior que zero'); return }
    if (tipoEmbalagem === 'pacote' && !(parseFloat(qtdPorPacote) >= 1)) {
      toast.error('Informe a quantidade por pacote (mínimo 1)'); return
    }

    setLoading(true)
    try {
      const url    = ingredient ? `/api/ingredients/${ingredient.id}` : '/api/ingredients'
      const method = ingredient ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, unitCost: finalUnitCost, categoryId: values.categoryId || null, supplierId: values.supplierId || null }),
      })
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Erro ao salvar insumo'); return }
      toast.success(ingredient ? 'Insumo atualizado!' : 'Insumo criado!')
      onSuccess(); onOpenChange(false)
    } catch { toast.error('Erro de conexão') }
    finally { setLoading(false) }
  }

  function adjustQtd(delta: number) {
    setQtdDesejada(prev => Math.max(0, parseFloat((prev + delta).toFixed(3))))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg"
        style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '92vh', overflow: 'hidden' }}
      >
        {/* Header */}
        <DialogHeader style={{ padding: '16px 24px 14px', borderBottom: '1px solid var(--tf-border)', flexShrink: 0 }}>
          <DialogTitle style={{ color: 'var(--tf-txt)', fontSize: 15, fontWeight: 600 }}>
            {ingredient ? 'Editar Insumo' : 'Novo Insumo'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>

          {/* Scrollable body */}
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Nome */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <Label style={{ color: 'var(--tf-txt2)', fontSize: 11.5 }}>Nome *</Label>
              <Input placeholder="Ex: Farinha de Trigo" style={inp} {...register('name', { required: 'Nome é obrigatório' })} />
              {errors.name && <p style={{ color: 'var(--tf-red)', fontSize: 11 }}>{errors.name.message}</p>}
            </div>

            {/* Embalagem + Custo — duas colunas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Label style={{ color: 'var(--tf-txt2)', fontSize: 11.5 }}>Tipo de embalagem</Label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" onClick={() => setTipoEmbalagem('unidade')} style={segBtn(tipoEmbalagem === 'unidade')}>Unidade</button>
                  <button type="button" onClick={() => setTipoEmbalagem('pacote')}  style={segBtn(tipoEmbalagem === 'pacote')}>Pacote</button>
                </div>
              </div>

              {tipoEmbalagem === 'unidade' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <Label style={{ color: 'var(--tf-txt2)', fontSize: 11.5 }}>Custo unitário (R$)</Label>
                  <Input type="number" step="0.01" min="0" placeholder="0,00" style={inp} {...register('unitCost', { valueAsNumber: true })} />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <Label style={{ color: 'var(--tf-txt2)', fontSize: 11.5 }}>Custo do pacote (R$)</Label>
                  <Input type="number" step="0.01" min="0" placeholder="0,00" style={inp} value={custoTotalPacote} onChange={e => setCustoTotalPacote(e.target.value)} />
                </div>
              )}
            </div>

            {/* Pacote: qtd por pacote + custo calculado */}
            {tipoEmbalagem === 'pacote' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <Label style={{ color: 'var(--tf-txt2)', fontSize: 11.5 }}>Unidades por pacote</Label>
                  <Input type="number" step="1" min="1" placeholder="Ex: 12" style={inp} value={qtdPorPacote} onChange={e => setQtdPorPacote(e.target.value)} />
                </div>
                {custoUnitario > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--tf-primary-bg)', border: '1px solid var(--tf-primary-bd)', borderRadius: 6, padding: '7px 12px' }}>
                    <span style={{ fontSize: 11.5, color: 'var(--tf-txt3)' }}>Custo por unidade calculado</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tf-primary)' }}>{formatCurrency(custoUnitario)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Unidade de medida */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <Label style={{ color: 'var(--tf-txt2)', fontSize: 11.5 }}>Unidade de medida</Label>
              <Controller
                name="unit" control={control}
                render={({ field }) => (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {UNITS.map(u => (
                      <button key={u.value} type="button" onClick={() => field.onChange(u.value)} style={segBtn(field.value === u.value)}>
                        {u.label}
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>

            {/* Quantidades */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Label style={{ color: 'var(--tf-txt2)', fontSize: 11.5 }}>Qtd. Atual</Label>
                <Input type="number" step="0.001" min="0" placeholder="0,000" style={inp} {...register('currentQty', { valueAsNumber: true })} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Label style={{ color: 'var(--tf-txt2)', fontSize: 11.5 }}>Qtd. Mínima</Label>
                <Input type="number" step="0.001" min="0" placeholder="0,000" style={inp} {...register('minimumQty', { valueAsNumber: true })} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Label style={{ color: 'var(--tf-txt2)', fontSize: 11.5 }}>Ponto reposição</Label>
                <Input type="number" step="0.001" min="0" placeholder="0,000" style={inp} {...register('pontoReposicao', { valueAsNumber: true })} />
              </div>
            </div>

            {/* Categoria + Fornecedor */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Label style={{ color: 'var(--tf-txt2)', fontSize: 11.5 }}>Categoria</Label>
                <Controller
                  name="categoryId" control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? '__none__'} onValueChange={v => field.onChange(v === '__none__' ? undefined : v)}>
                      <SelectTrigger className="w-full" style={selTrigger}>
                        <SelectValue placeholder="Sem categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem categoria</SelectItem>
                        {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <Label style={{ color: 'var(--tf-txt2)', fontSize: 11.5 }}>Fornecedor</Label>
                <Controller
                  name="supplierId" control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? '__none__'} onValueChange={v => field.onChange(v === '__none__' ? undefined : v)}>
                      <SelectTrigger className="w-full" style={selTrigger}>
                        <SelectValue placeholder="Sem fornecedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Sem fornecedor</SelectItem>
                        {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            {/* Calculadora */}
            <div style={{ border: '1px solid var(--tf-border)', borderRadius: 8, overflow: 'hidden' }}>

              <div style={{ background: 'var(--tf-surface2)', borderBottom: '1px solid var(--tf-border-light)', padding: '6px 14px' }}>
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tf-txt3)' }}>
                  Calcular custo para produto
                </span>
              </div>

              {/* Resumo custo/unidade/estoque */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid var(--tf-border-light)' }}>
                {[
                  { label: 'Custo unitário', val: formatCurrency(custoUnitario) },
                  { label: 'Unidade',        val: unitMeta.short },
                  { label: 'Estoque atual',  val: watchedCurrentQty > 0 ? `${fmtQty(watchedCurrentQty)} ${unitMeta.short}` : '—' },
                ].map((item, i) => (
                  <div key={i} style={{ padding: '8px 12px', borderRight: i < 2 ? '1px solid var(--tf-border-light)' : undefined }}>
                    <p style={{ fontSize: 10, color: 'var(--tf-txt3)', margin: 0 }}>{item.label}</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-txt)', margin: '2px 0 0' }}>{item.val}</p>
                  </div>
                ))}
              </div>

              {/* +/- quantidade */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid var(--tf-border-light)' }}>
                <button type="button" onClick={() => adjustQtd(-unitMeta.step)}
                  style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid var(--tf-border)', background: 'var(--tf-input-bg)', color: 'var(--tf-txt2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16, lineHeight: 1 }}>
                  −
                </button>
                <Input
                  type="number" step={unitMeta.step} min={0} value={qtdDesejada}
                  onChange={e => setQtdDesejada(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="text-center font-mono font-semibold"
                  style={{ flex: 1, ...inp }}
                />
                <span style={{ fontSize: 12, color: 'var(--tf-txt3)', fontWeight: 500, flexShrink: 0 }}>{unitMeta.short}</span>
                <button type="button" onClick={() => adjustQtd(unitMeta.step)}
                  style={{ width: 28, height: 28, borderRadius: 5, border: '1px solid var(--tf-border)', background: 'var(--tf-input-bg)', color: 'var(--tf-txt2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16, lineHeight: 1 }}>
                  +
                </button>
                <span style={{ fontSize: 11.5, color: 'var(--tf-txt3)', flexShrink: 0 }}>de insumo</span>
              </div>

              {/* Total */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--tf-primary-bg)' }}>
                <span style={{ fontSize: 12, color: 'var(--tf-txt2)' }}>Custo total para o produto</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--tf-primary)' }}>
                  {formatCurrency(custoParaProduto)}
                </span>
              </div>
            </div>

          </div>

          {/* Footer fixo */}
          <div style={{ padding: '12px 24px', borderTop: '1px solid var(--tf-border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0, background: 'var(--tf-surface)' }}>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
