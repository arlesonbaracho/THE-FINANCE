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
import type { ProductWithRelations } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  salePrice: z.number().min(0, 'Preço não pode ser negativo'),
  categoryId: z.string().optional(),
})

type FormValues = {
  name: string
  salePrice: number
  categoryId?: string
}

interface Category { id: string; name: string }

interface ProductFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: ProductWithRelations | null
  onSuccess: () => void
}

export function ProductForm({ open, onOpenChange, product, onSuccess }: ProductFormProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: { name: '', salePrice: 0 },
  })

  useEffect(() => {
    if (open) {
      fetch('/api/categories?type=PRODUCT').then(r => r.json()).then(setCategories).catch(() => {})
    }
  }, [open])

  useEffect(() => {
    if (product) {
      reset({ name: product.name, salePrice: product.salePrice, categoryId: product.categoryId ?? undefined })
    } else {
      reset({ name: '', salePrice: 0, categoryId: undefined })
    }
  }, [product, reset])

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
      <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-zinc-300">Nome</Label>
            <Input
              placeholder="Ex: X-Burguer Especial"
              {...register('name', { required: 'Nome é obrigatório' })}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
            {errors.name && <p className="text-red-400 text-sm">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Preço de Venda (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              {...register('salePrice', { valueAsNumber: true, min: { value: 0, message: 'Preço não pode ser negativo' } })}
              className="bg-zinc-800 border-zinc-700 text-white"
            />
            {errors.salePrice && <p className="text-red-400 text-sm">{errors.salePrice.message}</p>}
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

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-orange-500 hover:bg-orange-600 text-white">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
