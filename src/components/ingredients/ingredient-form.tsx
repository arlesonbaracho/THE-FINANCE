'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
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
import type { IngredientWithRelations } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  unit: z.enum(['KG', 'G', 'L', 'ML', 'UN']),
  currentQty: z.number().min(0, 'Quantidade não pode ser negativa'),
  minimumQty: z.number().min(0, 'Quantidade mínima não pode ser negativa'),
  unitCost: z.number().min(0, 'Custo não pode ser negativo'),
  categoryId: z.string().optional(),
  supplierId: z.string().optional(),
})

type FormValues = {
  name: string
  unit: 'KG' | 'G' | 'L' | 'ML' | 'UN'
  currentQty: number
  minimumQty: number
  unitCost: number
  categoryId?: string
  supplierId?: string
}

interface Category { id: string; name: string }
interface Supplier { id: string; name: string }

interface IngredientFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ingredient?: IngredientWithRelations | null
  onSuccess: () => void
}

const unitLabels: Record<string, string> = {
  KG: 'Quilograma (kg)',
  G: 'Grama (g)',
  L: 'Litro (L)',
  ML: 'Mililitro (ml)',
  UN: 'Unidade (un)',
}

export function IngredientForm({ open, onOpenChange, ingredient, onSuccess }: IngredientFormProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      name: '',
      unit: 'KG',
      currentQty: 0,
      minimumQty: 0,
      unitCost: 0,
    },
  })

  useEffect(() => {
    if (open) {
      fetch('/api/categories?type=INGREDIENT').then(r => r.json()).then(setCategories).catch(() => {})
      fetch('/api/suppliers').then(r => r.json()).then(setSuppliers).catch(() => {})
    }
  }, [open])

  useEffect(() => {
    if (ingredient) {
      reset({
        name: ingredient.name,
        unit: ingredient.unit,
        currentQty: ingredient.currentQty,
        minimumQty: ingredient.minimumQty,
        unitCost: ingredient.unitCost,
        categoryId: ingredient.categoryId ?? undefined,
        supplierId: ingredient.supplierId ?? undefined,
      })
    } else {
      reset({ name: '', unit: 'KG', currentQty: 0, minimumQty: 0, unitCost: 0 })
    }
  }, [ingredient, reset])

  function validate(values: FormValues): string | null {
    const result = schema.safeParse(values)
    if (!result.success) return result.error.issues[0]?.message ?? 'Erro de validação'
    return null
  }

  async function onSubmit(values: FormValues) {
    const err = validate(values)
    if (err) { toast.error(err); return }

    setLoading(true)
    try {
      const url = ingredient ? `/api/ingredients/${ingredient.id}` : '/api/ingredients'
      const method = ingredient ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, categoryId: values.categoryId || null, supplierId: values.supplierId || null }),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Erro ao salvar insumo')
        return
      }
      toast.success(ingredient ? 'Insumo atualizado!' : 'Insumo criado!')
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
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>{ingredient ? 'Editar Insumo' : 'Novo Insumo'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-zinc-300">Nome</Label>
            <Input
              placeholder="Ex: Farinha de Trigo"
              {...register('name', { required: 'Nome é obrigatório' })}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
            {errors.name && <p className="text-red-400 text-sm">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Unidade</Label>
              <Controller
                name="unit"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => { if (v) field.onChange(v) }}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      {Object.entries(unitLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value} className="text-zinc-200 focus:bg-zinc-800">
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Custo Unitário (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...register('unitCost', { valueAsNumber: true, min: { value: 0, message: 'Custo não pode ser negativo' } })}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
              {errors.unitCost && <p className="text-red-400 text-sm">{errors.unitCost.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Qtd. Atual</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                {...register('currentQty', { valueAsNumber: true, min: { value: 0, message: 'Não pode ser negativo' } })}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
              {errors.currentQty && <p className="text-red-400 text-sm">{errors.currentQty.message}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Qtd. Mínima</Label>
              <Input
                type="number"
                step="0.001"
                min="0"
                {...register('minimumQty', { valueAsNumber: true, min: { value: 0, message: 'Não pode ser negativo' } })}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
              {errors.minimumQty && <p className="text-red-400 text-sm">{errors.minimumQty.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Categoria</Label>
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? 'none'}
                  onValueChange={(v) => field.onChange(v === 'none' || !v ? undefined : v)}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    <SelectItem value="none" className="text-zinc-400 focus:bg-zinc-800">Sem categoria</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id} className="text-zinc-200 focus:bg-zinc-800">
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Fornecedor</Label>
            <Controller
              name="supplierId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? 'none'}
                  onValueChange={(v) => field.onChange(v === 'none' || !v ? undefined : v)}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue placeholder="Selecione um fornecedor" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    <SelectItem value="none" className="text-zinc-400 focus:bg-zinc-800">Sem fornecedor</SelectItem>
                    {suppliers.map((sup) => (
                      <SelectItem key={sup.id} value={sup.id} className="text-zinc-200 focus:bg-zinc-800">
                        {sup.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
