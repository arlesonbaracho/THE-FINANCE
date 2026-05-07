'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'
import { Search, X } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos os status' },
  { value: 'ACTIVE', label: 'Ativo' },
  { value: 'TRIAL', label: 'Trial' },
  { value: 'OVERDUE', label: 'Inadimplente' },
  { value: 'SUSPENDED', label: 'Suspenso' },
  { value: 'CANCELLED', label: 'Cancelado' },
]

interface Props {
  plans: Array<{ id: string; name: string }>
}

export function RestaurantesFilters({ plans }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? ''
  const planId = searchParams.get('planId') ?? ''

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      startTransition(() => router.replace(`${pathname}?${params.toString()}`))
    },
    [router, pathname, searchParams],
  )

  const hasFilters = search || status || planId

  return (
    <div className="flex flex-wrap gap-2">
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Buscar por nome ou email…"
          defaultValue={search}
          onChange={(e) => updateParam('search', e.target.value)}
          className="h-8 w-64 rounded-md border border-slate-700 bg-slate-800 pl-8 pr-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
        />
      </div>

      {/* Status filter */}
      <select
        value={status}
        onChange={(e) => updateParam('status', e.target.value)}
        className="h-8 rounded-md border border-slate-700 bg-slate-800 px-2 text-sm text-slate-200 focus:border-slate-500 focus:outline-none"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value} style={{ background: '#1e293b' }}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Plan filter */}
      {plans.length > 0 && (
        <select
          value={planId}
          onChange={(e) => updateParam('planId', e.target.value)}
          className="h-8 rounded-md border border-slate-700 bg-slate-800 px-2 text-sm text-slate-200 focus:border-slate-500 focus:outline-none"
        >
          <option value="" style={{ background: '#1e293b' }}>Todos os planos</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id} style={{ background: '#1e293b' }}>{p.name}</option>
          ))}
        </select>
      )}

      {/* Clear filters */}
      {hasFilters && (
        <button
          onClick={() => startTransition(() => router.replace(pathname))}
          className="flex h-8 items-center gap-1 rounded-md px-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="h-3 w-3" /> Limpar
        </button>
      )}

      {isPending && (
        <span className="flex items-center text-xs text-slate-500">Filtrando…</span>
      )}
    </div>
  )
}
