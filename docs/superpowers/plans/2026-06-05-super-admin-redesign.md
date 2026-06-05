# Super Admin Redesign + Create/Edit Plans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all super admin pages to a modern/clean dark theme and add create/edit plan functionality.

**Architecture:** Pure frontend changes — all API routes already exist. New `PlanFormModal` component handles create (`POST /api/admin/plans`) and edit (`PUT /api/admin/plans/:id`) via `open/onOpenChange` controlled state pattern. Layout, sidebar, header and all 9 pages get unified Tailwind styling.

**Tech Stack:** Next.js 15, React, Tailwind CSS, base-ui (Dialog, Button, Input), lucide-react, sonner (toasts), recharts (charts stay with inline tick/contentStyle props — Recharts API requirement)

---

## File Map

| File | Action |
|------|--------|
| `src/components/admin/plan-form-modal.tsx` | **CREATE** — PlanFormModal + CreatePlanButton + PlanData type |
| `src/components/admin/plan-actions.tsx` | **MODIFY** — add Edit item, update Props to PlanData |
| `src/app/(admin)/admin/planos/page.tsx` | **MODIFY** — add CreatePlanButton, pass full plan to PlanActions |
| `src/components/admin/sidebar.tsx` | **MODIFY** — grouped nav, indigo active, w-56 |
| `src/components/admin/header.tsx` | **MODIFY** — indigo badge, pulse bell |
| `src/app/(admin)/layout.tsx` | **MODIFY** — bg-[#0a0d14], p-8 |
| `src/app/(admin)/admin/page.tsx` | **MODIFY** — h1 size, card colors |
| `src/app/(admin)/admin/restaurantes/page.tsx` | **MODIFY** — h1 size, table colors |
| `src/app/(admin)/admin/restaurantes/[id]/page.tsx` | **MODIFY** — h1 size, card colors |
| `src/app/(admin)/admin/logs/page.tsx` | **MODIFY** — h1 size, table colors |
| `src/app/(admin)/admin/saude/saude-client.tsx` | **MODIFY** — inline styles → Tailwind |
| `src/app/(admin)/admin/uso-ia/uso-ia-client.tsx` | **MODIFY** — inline styles → Tailwind |
| `src/app/(admin)/admin/integracoes/integracoes-client.tsx` | **MODIFY** — inline styles → Tailwind |
| `src/app/(admin)/admin/financeiro/financeiro-client.tsx` | **MODIFY** — inline styles → Tailwind |

### Color mapping (CSS vars → Tailwind)
| CSS var | Tailwind class | Hex for recharts |
|---------|---------------|-----------------|
| `var(--tf-surface)` | `bg-slate-900` | `#0f172a` |
| `var(--tf-border)` | `border-slate-800` | `#1e293b` |
| `var(--tf-txt)` | `text-white` | `#ffffff` |
| `var(--tf-txt3)` | `text-slate-400` | `#94a3b8` |
| `var(--tf-primary)` | `bg-indigo-500` | `#6366f1` |
| `var(--tf-surface-hover)` | `bg-slate-800/40` | — |

---

## Task 1: Create PlanFormModal

**Files:**
- Create: `src/components/admin/plan-form-modal.tsx`

- [ ] **Step 1: Create the file**

```tsx
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
```

- [ ] **Step 2: Check TypeScript**

Run: `cd C:\Users\gemes\Desktop\THE-FINANCE && npx tsc --noEmit 2>&1 | head -30`

Expected: no errors related to `plan-form-modal.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/plan-form-modal.tsx
git commit -m "feat(admin): add PlanFormModal for create/edit plans"
```

---

## Task 2: Update PlanActions — add Edit option

**Files:**
- Modify: `src/components/admin/plan-actions.tsx`

- [ ] **Step 1: Replace the file content**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { PlanFormModal, type PlanData } from '@/components/admin/plan-form-modal'
import { toast } from 'sonner'

interface Props {
  plan: PlanData
  subCount: number
}

export function PlanActions({ plan, subCount }: Props) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (subCount > 0) {
      toast.error(`Plano possui ${subCount} assinatura(s) ativa(s). Desative antes de excluir.`)
      setConfirmOpen(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/plans/${plan.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Plano excluído')
        router.refresh()
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Erro ao excluir plano')
      }
    } finally {
      setLoading(false)
      setConfirmOpen(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-700 hover:text-white transition-colors">
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="border-slate-700 bg-slate-900 text-slate-200">
          <DropdownMenuItem
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-2 focus:bg-slate-800"
          >
            <Pencil className="h-4 w-4" /> Editar plano
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-slate-700" />
          <DropdownMenuItem
            onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-2 text-red-400 focus:text-red-400 focus:bg-slate-800"
          >
            <Trash2 className="h-4 w-4" /> Excluir plano
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PlanFormModal plan={plan} open={editOpen} onOpenChange={setEditOpen} />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="border-slate-700 bg-slate-900 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano &quot;{plan.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {subCount > 0
                ? `Este plano possui ${subCount} assinatura(s) ativa(s) e não pode ser excluído.`
                : 'Esta ação não pode ser desfeita. O plano será removido permanentemente.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700">
              Cancelar
            </AlertDialogCancel>
            {subCount === 0 && (
              <AlertDialogAction
                onClick={handleDelete}
                disabled={loading}
                className="bg-red-700 hover:bg-red-600 disabled:opacity-50"
              >
                {loading ? 'Excluindo...' : 'Excluir'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

- [ ] **Step 2: Check TypeScript**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: no errors in plan-actions.tsx

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/plan-actions.tsx
git commit -m "feat(admin): add edit plan option to PlanActions dropdown"
```

---

## Task 3: Update Plans page

**Files:**
- Modify: `src/app/(admin)/admin/planos/page.tsx`

- [ ] **Step 1: Replace the file content**

```tsx
import { getAdminSession } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { formatCurrency } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { PlanActions } from '@/components/admin/plan-actions'
import { CreatePlanButton } from '@/components/admin/plan-form-modal'
import type { PlanData } from '@/components/admin/plan-form-modal'

const featureLabels: Record<string, string> = {
  aiAgent: 'Agente IA',
  advancedReports: 'Relatórios Avançados',
  multiUnit: 'Multi-unidade',
  prioritySupport: 'Suporte Prioritário',
  exportReports: 'Exportação',
}

export default async function PlanosPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  const plans = await prisma.plan.findMany({
    include: { _count: { select: { subscriptions: true } } },
    orderBy: { monthlyPrice: 'asc' },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Planos ({plans.length})</h1>
        <CreatePlanButton />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const features = ((plan.features ?? {}) as PlanData['features'])
          const planData: PlanData = {
            id: plan.id,
            name: plan.name,
            description: plan.description,
            monthlyPrice: plan.monthlyPrice,
            annualPrice: plan.annualPrice,
            maxUsers: plan.maxUsers,
            maxProducts: plan.maxProducts,
            maxOrdersMonth: plan.maxOrdersMonth,
            features,
          }
          return (
            <div key={plan.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-white">{plan.name}</p>
                  {plan.description && <p className="text-xs text-slate-400 mt-0.5">{plan.description}</p>}
                </div>
                <PlanActions plan={planData} subCount={plan._count.subscriptions} />
              </div>

              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-slate-500">Mensal</p>
                  <p className="text-lg font-bold text-sky-400">{formatCurrency(plan.monthlyPrice)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Anual</p>
                  <p className="text-lg font-bold text-indigo-400">{formatCurrency(plan.annualPrice)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs text-slate-400">
                <div><span className="text-white font-medium">{plan.maxUsers}</span> usuários</div>
                <div><span className="text-white font-medium">{plan.maxProducts}</span> produtos</div>
                <div><span className="text-white font-medium">{plan.maxOrdersMonth}k</span> pedidos/mês</div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {Object.entries(features ?? {}).map(([key, enabled]) => (
                  <Badge
                    key={key}
                    variant="outline"
                    className={enabled
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]'
                      : 'border-slate-700 bg-slate-800 text-slate-600 text-[10px]'}
                  >
                    {featureLabels[key] ?? key}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                <p className="text-xs text-slate-500">
                  <span className="text-white font-medium">{plan._count.subscriptions}</span> assinatura(s)
                </p>
                <Badge variant="outline" className={plan.active ? 'text-emerald-400 border-emerald-500/30' : 'text-slate-500 border-slate-700'}>
                  {plan.active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript**

Run: `npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add src/app/\(admin\)/admin/planos/page.tsx
git commit -m "feat(admin/planos): add Novo Plano button and wire PlanActions to full plan object"
```

---

## Task 4: Redesign Sidebar

**Files:**
- Modify: `src/components/admin/sidebar.tsx`

- [ ] **Step 1: Replace the file content**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Store, CreditCard, ScrollText, LogOut,
  HeartPulse, Sparkles, Plug, TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const mainNav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/restaurantes', label: 'Restaurantes', icon: Store },
  { href: '/admin/planos', label: 'Planos', icon: CreditCard },
  { href: '/admin/financeiro', label: 'Financeiro', icon: TrendingUp },
]

const systemNav = [
  { href: '/admin/saude', label: 'Saúde', icon: HeartPulse },
  { href: '/admin/uso-ia', label: 'Uso de IA', icon: Sparkles },
  { href: '/admin/integracoes', label: 'Integrações', icon: Plug },
  { href: '/admin/logs', label: 'Logs', icon: ScrollText },
]

function NavItem({ href, label, icon: Icon, exact }: { href: string; label: string; icon: React.ElementType; exact?: boolean }) {
  const pathname = usePathname()
  const active = exact ? pathname === href : pathname.startsWith(href)
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors border-l-2',
        active
          ? 'border-indigo-500 bg-indigo-600/20 text-indigo-400'
          : 'border-transparent text-slate-400 hover:bg-slate-800/80 hover:text-white'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  )
}

export function AdminSidebar() {
  const pathname = usePathname()

  async function logout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }

  return (
    <aside className="flex h-full w-56 flex-col bg-[#060810] text-slate-300">
      <div className="flex items-center gap-2.5 border-b border-slate-800/60 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-indigo-600">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <polygon points="8,2 14,13 2,13" fill="white" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold text-white">THE FINANCE</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Super Admin</p>
        </div>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-4 overflow-y-auto">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 mb-1">Principal</p>
          <div className="space-y-0.5">
            {mainNav.map((item) => <NavItem key={item.href} {...item} />)}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 mb-1">Sistema</p>
          <div className="space-y-0.5">
            {systemNav.map((item) => <NavItem key={item.href} {...item} />)}
          </div>
        </div>
      </nav>

      <div className="border-t border-slate-800/60 px-2 py-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-500 hover:bg-slate-800/80 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/sidebar.tsx
git commit -m "design(admin): redesign sidebar — grouped nav, indigo active state, w-56"
```

---

## Task 5: Redesign Header + Layout

**Files:**
- Modify: `src/components/admin/header.tsx`
- Modify: `src/app/(admin)/layout.tsx`

- [ ] **Step 1: Replace header.tsx**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function AdminHeader() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    fetch('/api/admin/notifications')
      .then((r) => r.json())
      .then((d) => setCount(d.count ?? 0))
      .catch(() => {})
  }, [])

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-800/60 bg-[#060810] px-6">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-indigo-600/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-indigo-400 border border-indigo-500/20">
          SUPER ADMIN
        </span>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative text-slate-400 hover:text-slate-200 transition-colors">
          <Bell className={count > 0 ? 'h-5 w-5 animate-pulse' : 'h-5 w-5'} />
          {count > 0 && (
            <Badge className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full p-0 text-[10px] bg-red-600 border-0">
              {count > 9 ? '9+' : count}
            </Badge>
          )}
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Replace layout.tsx**

```tsx
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyAdminToken } from '@/lib/admin-auth'
import { AdminSidebar } from '@/components/admin/sidebar'
import { AdminHeader } from '@/components/admin/header'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get('admin_token')?.value
  if (!token) redirect('/admin/login')

  const session = await verifyAdminToken(token)
  if (!session) redirect('/admin/login')

  return (
    <div className="flex h-screen bg-[#0a0d14] text-slate-100 overflow-hidden">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/header.tsx src/app/\(admin\)/layout.tsx
git commit -m "design(admin): update header and layout — indigo badge, darker bg, p-8"
```

---

## Task 6: Update static pages (Dashboard, Restaurantes, Tenant detail, Logs)

**Files:**
- Modify: `src/app/(admin)/admin/page.tsx`
- Modify: `src/app/(admin)/admin/restaurantes/page.tsx`
- Modify: `src/app/(admin)/admin/restaurantes/[id]/page.tsx`
- Modify: `src/app/(admin)/admin/logs/page.tsx`

These are color/size changes only. Pattern:
- `text-xl font-semibold` → `text-2xl font-bold`
- `bg-slate-800/60` → `bg-slate-900`
- `border-slate-700` → `border-slate-800`
- `bg-slate-800` (table header) → `bg-slate-900/80`
- `bg-slate-900` (table rows) → `bg-[#0a0d14]`
- `divide-slate-800` stays (already correct)

- [ ] **Step 1: Update Dashboard page (`src/app/(admin)/admin/page.tsx`)**

Find and replace in the stats section and chart section:

```tsx
// Line 90: change
<h1 className="text-xl font-semibold text-white">Dashboard</h1>
// to:
<h1 className="text-2xl font-bold text-white">Dashboard</h1>

// Line 94: change
<div key={s.label} className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
// to:
<div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">

// Line 102: change
<div className="col-span-2 rounded-xl border border-slate-700 bg-slate-800/60 p-5">
// to:
<div className="col-span-2 rounded-xl border border-slate-800 bg-slate-900 p-5">

// Line 106: change
<div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
// to:
<div className="rounded-xl border border-slate-800 bg-slate-900 p-5">

// Line 112: change
<div className="rounded-xl border border-slate-700 bg-slate-800/60 p-5">
// to:
<div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
```

- [ ] **Step 2: Update Restaurantes page (`src/app/(admin)/admin/restaurantes/page.tsx`)**

```tsx
// h1 — change text-xl font-semibold to text-2xl font-bold
// Table wrapper: border-slate-700 → border-slate-800
// thead: bg-slate-800 → bg-slate-900/80
// tbody rows: bg-slate-900 → bg-[#0a0d14]
// hover: hover:bg-slate-800/60 → hover:bg-slate-800/40
```

Full relevant section after changes:
```tsx
<h1 className="text-2xl font-bold text-white">
  Restaurantes
  <span className="ml-2 text-base font-normal text-slate-400">({tenants.length})</span>
</h1>
// ...
<div className="overflow-hidden rounded-xl border border-slate-800">
  <table className="w-full text-sm">
    <thead className="bg-slate-900/80 text-slate-400">
// ...
    <tbody className="divide-y divide-slate-800">
      {tenants.map((t) => {
        // ...
        return (
          <tr key={t.id} className="bg-[#0a0d14] hover:bg-slate-800/40 transition-colors">
```

- [ ] **Step 3: Update Tenant detail page (`src/app/(admin)/admin/restaurantes/[id]/page.tsx`)**

Apply these exact string replacements:

```
"text-xl font-semibold text-white">{tenant.name}
→
"text-2xl font-bold text-white">{tenant.name}

bg-slate-800 border border-slate-700
→
bg-slate-900 border border-slate-800

data-[state=active]:bg-slate-700 data-[state=active]:text-white
→
data-[state=active]:bg-indigo-600/20 data-[state=active]:text-indigo-400

rounded-xl border border-slate-700 bg-slate-800/60 p-4 space-y-3
→
rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3

rounded-xl border border-slate-700 bg-slate-800/60 p-4">
→
rounded-xl border border-slate-800 bg-slate-900 p-4">

rounded-xl border border-slate-700 bg-slate-800/60 overflow-hidden
→
rounded-xl border border-slate-800 bg-slate-900 overflow-hidden

thead className="bg-slate-800 text-slate-400"
→
thead className="bg-slate-900/80 text-slate-400"

className="bg-slate-900 hover:bg-slate-800/40"
→
className="bg-[#0a0d14] hover:bg-slate-800/40"
```

- [ ] **Step 4: Update Logs page (`src/app/(admin)/admin/logs/page.tsx`)**

```tsx
// h1: text-xl font-semibold → text-2xl font-bold
// Table wrapper: border-slate-700 → border-slate-800
// thead: bg-slate-800 → bg-slate-900/80
// rows: bg-slate-900 → bg-[#0a0d14]
// hover: hover:bg-slate-800/40 → keep
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(admin\)/admin/page.tsx \
        src/app/\(admin\)/admin/restaurantes/page.tsx \
        src/app/\(admin\)/admin/restaurantes/\[id\]/page.tsx \
        src/app/\(admin\)/admin/logs/page.tsx
git commit -m "design(admin): update dashboard, restaurantes, tenant detail, logs — unified dark theme"
```

---

## Task 7: Migrate saude-client to Tailwind

**Files:**
- Modify: `src/app/(admin)/admin/saude/saude-client.tsx`

- [ ] **Step 1: Replace the file content**

Note: Recharts `tick` and `contentStyle` props stay as inline objects (Recharts API requirement). Dynamic `borderTop` stays inline (computed from status).

```tsx
'use client'

import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

interface MetricaItem {
  tipo: string
  log: { valor: number; status: string; registradoEm: string } | null
}
interface Alerta {
  id: string
  tipo: string
  titulo: string
  severidade: string
  criadoEm: string
}
interface HistoricoItem { valor: number; status: string; registradoEm: string }

const STATUS_COLOR: Record<string, string> = {
  OK: '#10b981',
  ALERTA: '#f59e0b',
  CRITICO: '#ef4444',
}

const tooltipStyle = {
  background: '#0f172a',
  border: '1px solid #1e293b',
  borderRadius: 8,
}

export function SaudeClient() {
  const [metricas, setMetricas] = useState<MetricaItem[]>([])
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [historico, setHistorico] = useState<HistoricoItem[]>([])

  async function carregar() {
    const [m, h] = await Promise.all([
      fetch('/api/admin/saude/metricas').then((r) => r.json()),
      fetch('/api/admin/saude/historico?horas=24').then((r) => r.json()),
    ])
    setMetricas(m.metricas ?? [])
    setAlertas(m.alertas ?? [])
    setHistorico(Array.isArray(h) ? h : [])
  }

  useEffect(() => { carregar() }, [])

  async function resolverAlerta(id: string) {
    await fetch(`/api/admin/saude/alertas/${id}`, { method: 'PATCH' })
    setAlertas((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-white">Saúde da Plataforma</h1>

      <div className="grid grid-cols-5 gap-3">
        {metricas.map(({ tipo, log }) => (
          <div
            key={tipo}
            className="rounded-xl border border-slate-800 bg-slate-900 p-5"
            style={{ borderTop: `3px solid ${STATUS_COLOR[log?.status ?? 'OK']}` }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">{tipo}</div>
            <div className="text-lg font-bold text-white">{log ? Number(log.valor).toFixed(1) : '—'}</div>
            <span
              className="mt-1 inline-block rounded px-1.5 py-px text-[10px] font-semibold text-white"
              style={{ background: STATUS_COLOR[log?.status ?? 'OK'] }}
            >
              {log?.status ?? 'SEM DADOS'}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Latência das últimas 24h (ms)</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={historico.map((h) => ({ ...h, valor: Number(h.valor) }))}>
            <XAxis
              dataKey="registradoEm"
              tickFormatter={(v) => new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
            />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(v) => new Date(v).toLocaleString('pt-BR')} />
            <ReferenceLine y={2000} stroke="#ef4444" strokeDasharray="4 4" label={{ value: '2000ms', fill: '#ef4444', fontSize: 10 }} />
            <Line type="monotone" dataKey="valor" stroke="#6366f1" dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {alertas.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Alertas Ativos</h2>
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-900/80">
                <tr>
                  {['Tipo', 'Título', 'Severidade', 'Horário', 'Ação'].map((col) => (
                    <th key={col} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-800">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {alertas.map((a) => (
                  <tr key={a.id} className="bg-[#0a0d14]">
                    <td className="px-3 py-2.5 text-sm text-white">{a.tipo}</td>
                    <td className="px-3 py-2.5 text-sm text-white">{a.titulo}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className="rounded px-2 py-0.5 text-[11px] font-semibold text-white"
                        style={{ background: STATUS_COLOR[a.severidade] ?? '#6b7280' }}
                      >
                        {a.severidade}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">{new Date(a.criadoEm).toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => resolverAlerta(a.id)}
                        className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
                      >
                        Resolver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {metricas.length === 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400 text-sm">
          Nenhuma métrica coletada ainda. Inicie o worker BullMQ para começar a monitorar.
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(admin\)/admin/saude/saude-client.tsx
git commit -m "design(admin/saude): migrate inline styles to Tailwind"
```

---

## Task 8: Migrate uso-ia-client to Tailwind

**Files:**
- Modify: `src/app/(admin)/admin/uso-ia/uso-ia-client.tsx`

- [ ] **Step 1: Replace the file content**

Note: The inline modal is replaced with native Tailwind fixed overlay. Recharts tick/contentStyle stay inline. Dynamic percentage badge color stays inline.

```tsx
'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface AiUsage {
  tenantId: string
  tokensInput: number
  tokensOutput: number
  custoEstimado: number
  limiteTokens: number
  tenant: { name: string; subscription: { plan: { name: string } } | null }
}

const tooltipStyle = { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }

export function UsoIaClient() {
  const [usages, setUsages] = useState<AiUsage[]>([])
  const [modalTenant, setModalTenant] = useState<string | null>(null)
  const [novoLimite, setNovoLimite] = useState('')

  async function carregar() {
    const d = await fetch('/api/admin/uso-ia').then((r) => r.json())
    setUsages(Array.isArray(d) ? d : [])
  }

  useEffect(() => { carregar() }, [])

  async function salvarLimite() {
    if (!modalTenant) return
    await fetch(`/api/admin/uso-ia/${modalTenant}/limite`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limiteTokens: parseInt(novoLimite, 10) }),
    })
    setModalTenant(null)
    carregar()
  }

  async function resetarContador(tenantId: string) {
    if (!confirm('Resetar contador de tokens deste tenant?')) return
    await fetch(`/api/admin/uso-ia/${tenantId}/limite`, { method: 'POST' })
    carregar()
  }

  const totalHoje = usages.reduce((s, u) => s + u.tokensInput + u.tokensOutput, 0)
  const custoMes = usages.reduce((s, u) => s + Number(u.custoEstimado), 0)
  const acima = usages.filter((u) => u.limiteTokens > 0 && u.tokensInput + u.tokensOutput >= u.limiteTokens).length
  const proximo = usages.filter((u) => {
    if (u.limiteTokens === 0) return false
    const pct = (u.tokensInput + u.tokensOutput) / u.limiteTokens
    return pct >= 0.8 && pct < 1
  }).length

  const top10 = [...usages]
    .sort((a, b) => b.tokensInput + b.tokensOutput - (a.tokensInput + a.tokensOutput))
    .slice(0, 10)
    .map((u) => ({ name: u.tenant.name.slice(0, 14), tokens: u.tokensInput + u.tokensOutput }))

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-white">Uso de IA</h1>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Tokens (plataforma)', valor: totalHoje.toLocaleString('pt-BR') },
          { label: 'Custo estimado (mês)', valor: `R$ ${custoMes.toFixed(2)}` },
          { label: 'Acima do limite', valor: String(acima) },
          { label: 'Próximos do limite', valor: String(proximo) },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="text-[11px] text-slate-400 mb-1.5">{c.label}</div>
            <div className="text-2xl font-bold text-white">{c.valor}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-sm font-semibold text-white mb-3">Top 10 tenants por consumo</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={top10}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="tokens" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/80">
            <tr>
              {['Tenant', 'Plano', 'Input', 'Output', 'Custo R$', 'Limite', '% usado', 'Ações'].map((col) => (
                <th key={col} className="px-3.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-800">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {usages.map((u) => {
              const total = u.tokensInput + u.tokensOutput
              const pct = u.limiteTokens > 0 ? Math.round((total / u.limiteTokens) * 100) : null
              const isAcima = pct !== null && pct >= 100
              const isProximo = pct !== null && pct >= 80 && !isAcima
              return (
                <tr key={u.tenantId} className="bg-[#0a0d14] hover:bg-slate-800/40 transition-colors">
                  <td className="px-3.5 py-2.5 text-sm text-white">{u.tenant.name}</td>
                  <td className="px-3.5 py-2.5 text-xs text-slate-400">{u.tenant.subscription?.plan.name ?? '—'}</td>
                  <td className="px-3.5 py-2.5 text-sm text-slate-300">{u.tokensInput.toLocaleString('pt-BR')}</td>
                  <td className="px-3.5 py-2.5 text-sm text-slate-300">{u.tokensOutput.toLocaleString('pt-BR')}</td>
                  <td className="px-3.5 py-2.5 text-sm text-slate-300">R$ {Number(u.custoEstimado).toFixed(4)}</td>
                  <td className="px-3.5 py-2.5 text-sm text-slate-300">{u.limiteTokens === 0 ? '∞' : u.limiteTokens.toLocaleString('pt-BR')}</td>
                  <td className="px-3.5 py-2.5">
                    {pct !== null ? (
                      <span
                        className="rounded px-2 py-0.5 text-[11px] font-semibold text-white"
                        style={{ background: isAcima ? '#ef4444' : isProximo ? '#f59e0b' : '#10b981' }}
                      >
                        {pct}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => { setModalTenant(u.tenantId); setNovoLimite(String(u.limiteTokens)) }}
                        className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => resetarContador(u.tenantId)}
                        className="rounded-md border border-red-500/30 px-2 py-1 text-[11px] text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        Resetar
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modalTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-xl border border-slate-700 bg-slate-900 p-8 min-w-[320px] space-y-4">
            <h2 className="text-base font-bold text-white">Editar limite de tokens</h2>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 block">Limite (0 = ilimitado)</label>
              <input
                type="number"
                value={novoLimite}
                onChange={(e) => setNovoLimite(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setModalTenant(null)}
                className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvarLimite}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 transition-colors"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(admin\)/admin/uso-ia/uso-ia-client.tsx
git commit -m "design(admin/uso-ia): migrate inline styles to Tailwind"
```

---

## Task 9: Migrate integracoes-client to Tailwind

**Files:**
- Modify: `src/app/(admin)/admin/integracoes/integracoes-client.tsx`

- [ ] **Step 1: Replace the file content**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface Tenant {
  id: string
  name: string
  ifoodIntegracao: { status: string; merchantId: string; ultimaSincronizacao: string | null } | null
  whatsappContatos: Array<{ updatedAt: string }>
}

const STATUS_COLOR: Record<string, string> = {
  CONECTADO: '#10b981',
  DESCONECTADO: '#6b7280',
  ERRO: '#ef4444',
}

export function IntegracoesClient() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [expandido, setExpandido] = useState<string | null>(null)

  async function carregar() {
    const d = await fetch('/api/admin/integracoes').then((r) => r.json())
    setTenants(Array.isArray(d) ? d : [])
  }

  useEffect(() => { carregar() }, [])

  async function desconectar(tenantId: string, integracao: 'ifood' | 'whatsapp') {
    const label = integracao === 'ifood' ? 'iFood' : 'WhatsApp'
    if (!confirm(`Forçar desconexão do ${label} para este tenant?`)) return
    await fetch(`/api/admin/integracoes/${tenantId}/desconectar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ integracao }),
    })
    carregar()
  }

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-white">Integrações</h1>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/80">
            <tr>
              {['Tenant', 'iFood', 'WhatsApp', 'Última atividade', ''].map((col) => (
                <th key={col} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-800">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {tenants.map((t) => (
              <>
                <tr
                  key={t.id}
                  onClick={() => setExpandido(expandido === t.id ? null : t.id)}
                  className={`cursor-pointer transition-colors ${expandido === t.id ? 'bg-slate-800/40' : 'bg-[#0a0d14] hover:bg-slate-800/20'}`}
                >
                  <td className="px-4 py-2.5 text-sm text-white">{t.name}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className="rounded px-2 py-0.5 text-[11px] font-semibold text-white"
                      style={{ background: STATUS_COLOR[t.ifoodIntegracao?.status ?? 'DESCONECTADO'] }}
                    >
                      {t.ifoodIntegracao?.status ?? 'DESCONECTADO'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="rounded px-2 py-0.5 text-[11px] font-semibold text-white"
                      style={{ background: t.whatsappContatos.length > 0 ? '#10b981' : '#6b7280' }}
                    >
                      {t.whatsappContatos.length > 0 ? 'CONECTADO' : 'DESCONECTADO'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">
                    {t.ifoodIntegracao?.ultimaSincronizacao
                      ? new Date(t.ifoodIntegracao.ultimaSincronizacao).toLocaleString('pt-BR')
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">
                    {expandido === t.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </td>
                </tr>
                {expandido === t.id && (
                  <tr key={`${t.id}-detail`}>
                    <td colSpan={5} className="px-6 py-4 bg-slate-800/20 border-b border-slate-800">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-xs font-semibold text-slate-400 mb-2">iFood</p>
                          <p className="text-sm text-white mb-1">Merchant ID: {t.ifoodIntegracao?.merchantId ?? '—'}</p>
                          <p className="text-sm text-white mb-3">
                            Última sync:{' '}
                            {t.ifoodIntegracao?.ultimaSincronizacao
                              ? new Date(t.ifoodIntegracao.ultimaSincronizacao).toLocaleString('pt-BR')
                              : '—'}
                          </p>
                          {t.ifoodIntegracao?.status === 'CONECTADO' && (
                            <button
                              onClick={() => desconectar(t.id, 'ifood')}
                              className="rounded-md border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              Forçar desconexão iFood
                            </button>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-400 mb-2">WhatsApp</p>
                          <p className="text-sm text-white mb-3">
                            Último envio:{' '}
                            {t.whatsappContatos[0]?.updatedAt
                              ? new Date(t.whatsappContatos[0].updatedAt).toLocaleString('pt-BR')
                              : '—'}
                          </p>
                          {t.whatsappContatos.length > 0 && (
                            <button
                              onClick={() => desconectar(t.id, 'whatsapp')}
                              className="rounded-md border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              Forçar desconexão WhatsApp
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm bg-[#0a0d14]">
                  Nenhum tenant encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(admin\)/admin/integracoes/integracoes-client.tsx
git commit -m "design(admin/integracoes): migrate inline styles to Tailwind"
```

---

## Task 10: Migrate financeiro-client to Tailwind

**Files:**
- Modify: `src/app/(admin)/admin/financeiro/financeiro-client.tsx`

- [ ] **Step 1: Replace the file content**

Note: Tab navigation replaced with pill buttons (indigo active state). Recharts tick/contentStyle stay inline. Cohort cell backgrounds stay inline (dynamic computed values). Charts use hex colors instead of CSS vars.

```tsx
'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { cn } from '@/lib/utils'

type Tab = 'mrr' | 'metricas' | 'cohort' | 'projecao'

interface MRRSnapshot { data: string; mrr: number }
interface Metricas { churn: { churnRate: number }; ltv: number; nrr: number; cac: number | null }
interface CohortRow { cohort: string; retencao: number[] }
interface ProjecaoItem { mes: string; mrr: number; mrrMin: number; mrrMax: number }

const tooltipStyle = { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }

function corRetencao(v: number) {
  if (v >= 90) return '#166534'
  if (v >= 70) return '#16a34a'
  if (v >= 50) return '#f59e0b'
  return '#ef4444'
}

export function FinanceiroClient() {
  const [tab, setTab] = useState<Tab>('mrr')
  const [mrr, setMrr] = useState<{ atual: { total: number; porPlano: Record<string, number> }; historico: MRRSnapshot[] } | null>(null)
  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [cohort, setCohort] = useState<CohortRow[]>([])
  const [projecao, setProjecao] = useState<ProjecaoItem[]>([])
  const [cacInput, setCacInput] = useState('')

  useEffect(() => {
    if (tab === 'mrr' && !mrr) {
      fetch('/api/admin/financeiro/mrr').then((r) => r.json()).then(setMrr)
    }
    if (tab === 'metricas' && !metricas) {
      fetch('/api/admin/financeiro/metricas').then((r) => r.json()).then(setMetricas)
    }
    if (tab === 'cohort' && cohort.length === 0) {
      fetch('/api/admin/financeiro/cohort').then((r) => r.json()).then((d) => setCohort(Array.isArray(d) ? d : []))
    }
    if (tab === 'projecao' && projecao.length === 0) {
      fetch('/api/admin/financeiro/projecao').then((r) => r.json()).then((d) => setProjecao(Array.isArray(d) ? d : []))
    }
  }, [tab])

  const tabLabels: Record<Tab, string> = { mrr: 'MRR', metricas: 'Métricas', cohort: 'Cohort', projecao: 'Projeção' }

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-white">Financeiro SaaS</h1>

      <div className="flex gap-1">
        {(['mrr', 'metricas', 'cohort', 'projecao'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === t
                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
            )}
          >
            {tabLabels[t]}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        {tab === 'mrr' && mrr && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-slate-800 bg-[#0a0d14] p-4">
                <div className="text-[11px] text-slate-400 mb-1">MRR Total</div>
                <div className="text-2xl font-bold text-white">R$ {mrr.atual.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#0a0d14] p-4">
                <div className="text-[11px] text-slate-400 mb-1">ARR Projetado</div>
                <div className="text-2xl font-bold text-white">R$ {(mrr.atual.total * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="rounded-lg border border-slate-800 bg-[#0a0d14] p-4">
                <div className="text-[11px] text-slate-400 mb-1">Por plano</div>
                {Object.entries(mrr.atual.porPlano).map(([id, v]) => (
                  <div key={id} className="text-sm text-slate-300">{id.slice(0, 8)}: R$ {Number(v).toFixed(2)}</div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={mrr.historico.map((h) => ({ ...h, mrr: Number(h.mrr) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="data" tickFormatter={(v) => String(v).slice(0, 7)} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="mrr" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {tab === 'metricas' && metricas && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Churn Rate', valor: `${metricas.churn.churnRate.toFixed(1)}%` },
                { label: 'LTV Médio', valor: `R$ ${metricas.ltv.toFixed(2)}` },
                { label: 'NRR', valor: `${metricas.nrr.toFixed(1)}%` },
                { label: 'CAC', valor: metricas.cac ? `R$ ${metricas.cac}` : 'Não definido' },
              ].map((c) => (
                <div key={c.label} className="rounded-lg border border-slate-800 bg-[#0a0d14] p-4">
                  <div className="text-[11px] text-slate-400 mb-1">{c.label}</div>
                  <div className="text-2xl font-bold text-white">{c.valor}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 items-center">
              <input
                placeholder="Novo CAC (R$)"
                value={cacInput}
                onChange={(e) => setCacInput(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={async () => {
                  const agora = new Date()
                  await fetch('/api/admin/financeiro/metricas', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mes: agora.getMonth() + 1, ano: agora.getFullYear(), cac: parseFloat(cacInput) }),
                  })
                  fetch('/api/admin/financeiro/metricas').then((r) => r.json()).then(setMetricas)
                  setCacInput('')
                }}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 transition-colors"
              >
                Salvar CAC
              </button>
            </div>
          </div>
        )}

        {tab === 'cohort' && (
          <div className="overflow-x-auto">
            {cohort.length === 0 ? (
              <p className="text-slate-400 text-sm">Sem dados de cohort ainda (requer pelo menos 1 mês de dados).</p>
            ) : (
              <table className="border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-slate-400 font-semibold border-b border-slate-800 whitespace-nowrap">Cohort</th>
                    {cohort[0]?.retencao.map((_, i) => (
                      <th key={i} className="px-3 py-2 text-center text-slate-400 font-semibold border-b border-slate-800">M{i}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohort.map((row) => (
                    <tr key={row.cohort}>
                      <td className="px-3 py-2 font-semibold text-white border-b border-slate-800 whitespace-nowrap">{row.cohort}</td>
                      {row.retencao.map((v, i) => (
                        <td
                          key={i}
                          title={`${row.cohort} — M${i}: ${v}%`}
                          className="px-3 py-2 text-center font-semibold text-white border-b border-black/10"
                          style={{ background: corRetencao(v) }}
                        >
                          {v}%
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === 'projecao' && (
          <div className="space-y-6">
            {projecao.length === 0 ? (
              <p className="text-slate-400 text-sm">Sem dados de snapshots suficientes para projeção (mínimo 2 meses).</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4">
                  {projecao.map((p, i) => (
                    <div key={p.mes} className="rounded-lg border border-slate-800 bg-[#0a0d14] p-4">
                      <div className="text-[11px] text-slate-400 mb-1">Mês {i + 1} ({p.mes})</div>
                      <div className="text-2xl font-bold text-white">R$ {p.mrr.toLocaleString('pt-BR')}</div>
                      <div className="text-[11px] text-slate-500 mt-1">R$ {p.mrrMin.toLocaleString('pt-BR')} – R$ {p.mrrMax.toLocaleString('pt-BR')}</div>
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={projecao}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Line type="monotone" dataKey="mrr" stroke="#6366f1" strokeWidth={2} strokeDasharray="6 3" name="Projeção" />
                    <Line type="monotone" dataKey="mrrMin" stroke="#6b7280" strokeWidth={1} strokeDasharray="2 4" name="Mínimo" dot={false} />
                    <Line type="monotone" dataKey="mrrMax" stroke="#6b7280" strokeWidth={1} strokeDasharray="2 4" name="Máximo" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-[11px] text-slate-500">* Projeção baseada na taxa de crescimento média dos últimos snapshots. Intervalo de confiança: ±15%.</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(admin\)/admin/financeiro/financeiro-client.tsx
git commit -m "design(admin/financeiro): migrate inline styles to Tailwind, pill tab nav"
```

---

## Task 11: Final TypeScript check + verify

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit 2>&1 | grep -v node_modules | head -50`

Expected: zero errors

- [ ] **Step 2: Start dev server and verify manually**

Run: `npm run dev`

Visit each page and confirm:
- `/admin` — Dashboard cards dark bg, h1 larger
- `/admin/planos` — "Novo Plano" button visible top-right; clicking opens modal; saving creates plan
- `/admin/planos` — clicking ⋯ on a plan card shows "Editar plano" + "Excluir plano"; clicking edit pre-fills form
- `/admin/restaurantes` — table uses new dark bg
- `/admin/saude` — no inline styles, metric cards with colored top border
- `/admin/financeiro` — pill tabs, no inline styles
- Sidebar — two sections (Principal / Sistema), indigo active state
- Header — "SUPER ADMIN" indigo badge, no red chip

- [ ] **Step 3: Final commit if any tweaks needed**

```bash
git add -A
git commit -m "design(admin): final tweaks after visual verification"
```
