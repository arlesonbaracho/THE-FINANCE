'use client'

import { useState } from 'react'
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

const schema = z.object({
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'LOSS', 'EXPIRY', 'INTERNAL_USE']),
  quantity: z.number().positive('Quantidade deve ser maior que zero'),
  unitCost: z.number().min(0).optional(),
  reason: z.string().optional(),
  note: z.string().optional(),
})

type FormValues = {
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'LOSS' | 'EXPIRY' | 'INTERNAL_USE'
  quantity: number
  unitCost?: number
  reason?: string
  note?: string
}

interface MovementFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ingredientId: string
  ingredientName: string
  onSuccess: () => void
}

const movementTypeLabels: Record<string, string> = {
  IN: 'Entrada',
  OUT: 'Saída',
  ADJUSTMENT: 'Ajuste de Estoque',
  LOSS: 'Perda',
  EXPIRY: 'Vencimento',
  INTERNAL_USE: 'Consumo Interno',
}

const typeColors: Record<string, string> = {
  IN: 'text-emerald-400',
  OUT: 'text-red-400',
  ADJUSTMENT: 'text-amber-400',
  LOSS: 'text-red-400',
  EXPIRY: 'text-orange-400',
  INTERNAL_USE: 'text-blue-400',
}

export function MovementForm({ open, onOpenChange, ingredientId, ingredientName, onSuccess }: MovementFormProps) {
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: { type: 'IN', quantity: 0, unitCost: undefined, reason: '', note: '' },
  })

  const selectedType = watch('type')

  function validate(values: FormValues): string | null {
    const result = schema.safeParse(values)
    if (!result.success) {
      return result.error.issues[0]?.message ?? 'Erro de validação'
    }
    return null
  }

  async function onSubmit(values: FormValues) {
    const err = validate(values)
    if (err) { toast.error(err); return }

    setLoading(true)
    try {
      const res = await fetch(`/api/ingredients/${ingredientId}/movements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Erro ao registrar movimentação')
        return
      }
      toast.success('Movimentação registrada!')
      reset()
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
          <DialogTitle>Movimentação de Estoque</DialogTitle>
          <p className="text-sm text-zinc-400">{ingredientName}</p>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-zinc-300">Tipo</Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => { if (v) field.onChange(v) }}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {Object.entries(movementTypeLabels).map(([value, label]) => (
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
            <Label className="text-zinc-300">
              Quantidade
              {selectedType === 'ADJUSTMENT' && (
                <span className="text-yellow-400 ml-1 text-xs">(novo total)</span>
              )}
            </Label>
            <Input
              type="number"
              step="0.001"
              min="0"
              {...register('quantity', { valueAsNumber: true })}
              className={`bg-zinc-800 border-zinc-700 text-white ${typeColors[selectedType] ?? ''}`}
            />
            {errors.quantity && <p className="text-red-400 text-sm">{errors.quantity.message}</p>}
          </div>

          {selectedType === 'IN' && (
            <div className="space-y-2">
              <Label className="text-zinc-300">Custo unitário (opcional)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                {...register('unitCost', { valueAsNumber: true })}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
              <p className="text-xs text-zinc-500">Usado para recalcular o custo médio ponderado</p>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-zinc-300">Motivo (opcional)</Label>
            <Input
              placeholder="Ex: Compra, Vencimento, Inventário..."
              {...register('reason')}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-zinc-300">Observação (opcional)</Label>
            <Input
              placeholder="Observações adicionais..."
              {...register('note')}
              className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
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
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registrando...</> : 'Registrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
