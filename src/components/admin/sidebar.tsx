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
