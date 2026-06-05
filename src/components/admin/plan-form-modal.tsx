'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export interface PlanData {
  id: string
  name: string
  description: string | null
  monthlyPrice: number
  annualPrice: number
  maxUsers: number
  maxProducts: number
  maxOrdersMonth: number
  features: {
    aiAgent: boolean
    advancedReports: boolean
    multiUnit: boolean
    prioritySupport: boolean
    exportReports: boolean
  }
}

const featureLabels: Record<keyof PlanData['features'], string> = {
  aiAgent: 'Agente IA',
  advancedReports: 'Relatórios Avançados',
  multiUnit: 'Multi-unidade',
  prioritySupport: 'Suporte Prioritário',
  exportReports: 'Exportação',
}

const defaultFeatures: PlanData['features'] = {
  aiAgent: false,
  advancedReports: false,
  multiUnit: false,
  prioritySupport: false,
  exportReports: false,
}

interface PlanFormModalProps {
  plan?: PlanData
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PlanFormModal({ plan, open, onOpenChange }: PlanFormModalProps) {
  const router = useRouter()
  const isEdit = !!plan

  const [name, setName] = useState(plan?.name ?? '')
  const [description, setDescription] = useState(plan?.description ?? '')
  const [monthlyPrice, setMonthlyPrice] = useState(String(plan?.monthlyPrice ?? ''))
  const [annualPrice, setAnnualPrice] = useState(String(plan?.annualPrice ?? ''))
  const [maxUsers, setMaxUsers] = useState(String(plan?.maxUsers ?? ''))
  const [maxProducts, setMaxProducts] = useState(String(plan?.maxProducts ?? ''))
  const [maxOrdersMonth, setMaxOrdersMonth] = useState(String(plan?.maxOrdersMonth ?? ''))
  const [features, setFeatures] = useState<PlanData['features']>(plan?.features ?? defaultFeatures)
  const [loading, setLoading] = useState(false)

  function reset() {
    setName(plan?.name ?? '')
    setDescription(plan?.description ?? '')
    setMonthlyPrice(String(plan?.monthlyPrice ?? ''))
    setAnnualPrice(String(plan?.annualPrice ?? ''))
    setMaxUsers(String(plan?.maxUsers ?? ''))
    setMaxProducts(String(plan?.maxProducts ?? ''))
    setMaxOrdersMonth(String(plan?.maxOrdersMonth ?? ''))
    setFeatures(plan?.features ?? defaultFeatures)
  }

  function toggleFeature(key: keyof PlanData['features']) {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2) {
      toast.error('Nome deve ter pelo menos 2 caracteres')
      return
    }
    setLoading(true)
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        monthlyPrice: parseFloat(monthlyPrice),
        annualPrice: parseFloat(annualPrice),
        maxUsers: parseInt(maxUsers, 10),
        maxProducts: parseInt(maxProducts, 10),
        maxOrdersMonth: parseInt(maxOrdersMonth, 10),
        features,
      }
      const url = isEdit ? `/api/admin/plans/${plan.id}` : '/api/admin/plans'
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success(isEdit ? 'Plano atualizado' : 'Plano criado')
        onOpenChange(false)
        router.refresh()
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Erro ao salvar plano')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="border-slate-700 bg-slate-900 text-slate-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">{isEdit ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Nome *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Profissional"
              className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional"
              className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Preço Mensal (R$) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={monthlyPrice}
                onChange={(e) => setMonthlyPrice(e.target.value)}
                className="border-slate-700 bg-slate-800 text-white"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Preço Anual (R$) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={annualPrice}
                onChange={(e) => setAnnualPrice(e.target.value)}
                className="border-slate-700 bg-slate-800 text-white"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Máx. Usuários *</Label>
              <Input
                type="number"
                min="1"
                value={maxUsers}
                onChange={(e) => setMaxUsers(e.target.value)}
                className="border-slate-700 bg-slate-800 text-white"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Máx. Produtos *</Label>
              <Input
                type="number"
                min="1"
                value={maxProducts}
                onChange={(e) => setMaxProducts(e.target.value)}
                className="border-slate-700 bg-slate-800 text-white"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Pedidos/mês (k) *</Label>
              <Input
                type="number"
                min="1"
                value={maxOrdersMonth}
                onChange={(e) => setMaxOrdersMonth(e.target.value)}
                className="border-slate-700 bg-slate-800 text-white"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-300 text-xs">Features</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(featureLabels) as (keyof PlanData['features'])[]).map((key) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={features[key]}
                    onChange={() => toggleFeature(key)}
                    className="h-3.5 w-3.5 rounded border-slate-600 accent-indigo-500"
                  />
                  <span className="text-xs text-slate-300">{featureLabels[key]}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter className="border-slate-800 bg-slate-800/50">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
            >
              {loading ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar plano'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CreatePlanButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-indigo-600 hover:bg-indigo-500 text-white gap-1.5"
      >
        <Plus className="h-4 w-4" />
        Novo Plano
      </Button>
      <PlanFormModal open={open} onOpenChange={setOpen} />
    </>
  )
}
