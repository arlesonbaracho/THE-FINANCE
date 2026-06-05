'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Store,
  CreditCard,
  ScrollText,
  LogOut,
  HeartPulse,
  Sparkles,
  Plug,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/restaurantes', label: 'Restaurantes', icon: Store },
  { href: '/admin/planos', label: 'Planos', icon: CreditCard },
  { href: '/admin/logs', label: 'Logs', icon: ScrollText },
  // Fase 3
  { href: '/admin/saude', label: 'Saúde', icon: HeartPulse },
  { href: '/admin/uso-ia', label: 'Uso de IA', icon: Sparkles },
  { href: '/admin/integracoes', label: 'Integrações', icon: Plug },
  { href: '/admin/financeiro', label: 'Financeiro', icon: TrendingUp },
]

export function AdminSidebar() {
  const pathname = usePathname()

  async function logout() {
    await fetch('/api/admin/auth/logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }

  return (
    <aside className="flex h-full w-60 flex-col bg-slate-950 text-slate-300">
      <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-emerald-700">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <polygon points="8,2 14,13 2,13" fill="white" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold text-white">THE FINANCE</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Super Admin</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {nav.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-slate-800 text-white'
                  : 'hover:bg-slate-900 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-slate-800 px-2 py-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-slate-400 hover:bg-slate-900 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  )
}
