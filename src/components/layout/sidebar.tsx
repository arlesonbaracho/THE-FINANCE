'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  ShoppingBasket,
  ChefHat,
  ChevronDown,
  ChevronRight,
  Settings,
  Users,
  User,
  LogOut,
  LucideIcon,
} from 'lucide-react'
import { useState } from 'react'

type LeafItem = {
  label: string
  href: string
  icon: LucideIcon
  children?: never
}

type GroupItem = {
  label: string
  icon: LucideIcon
  href?: never
  children: LeafItem[]
}

type NavItem = LeafItem | GroupItem

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Estoque',
    icon: Package,
    children: [
      { label: 'Insumos', href: '/estoque/insumos', icon: ShoppingBasket },
      { label: 'Produtos', href: '/estoque/produtos', icon: ChefHat },
      { label: 'Inventário', href: '/estoque/inventario', icon: Package },
    ],
  },
  {
    label: 'Configurações',
    icon: Settings,
    children: [
      { label: 'Usuários', href: '/configuracoes/usuarios', icon: Users },
      { label: 'Meu Perfil', href: '/configuracoes/perfil', icon: User },
      { label: 'Assinatura', href: '/configuracoes/assinatura', icon: Settings },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const initialOpen = navItems
    .filter((item): item is GroupItem => !!item.children)
    .filter((item) => item.children.some((c) => pathname.startsWith(c.href)))
    .map((item) => item.label)

  const [openGroups, setOpenGroups] = useState<string[]>(
    initialOpen.length > 0 ? initialOpen : ['Estoque']
  )

  function toggleGroup(label: string) {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    )
  }

  return (
    <aside className="w-64 min-h-screen bg-sidebar border-r border-border flex flex-col">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
          <ChefHat className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="text-foreground font-bold text-lg tracking-tight">THE FINANCE</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          if (item.children) {
            const isOpen = openGroups.includes(item.label)
            const isActive = item.children.some((c) => pathname.startsWith(c.href))

            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </div>
                  {isOpen ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </button>

                {isOpen && (
                  <div className="ml-4 mt-1 space-y-1 pl-3 border-l border-border">
                    {item.children.map((child) => {
                      const isChildActive = pathname.startsWith(child.href)
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                            isChildActive
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                          )}
                        >
                          <child.icon className="w-4 h-4" />
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-3 border-t border-border space-y-1">
        <button
          onClick={() => signOut({ callbackUrl: '/auth/login' })}
          className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
        <p className="px-3 text-[10px] text-muted-foreground/50">THE FINANCE v1.0.0</p>
      </div>
    </aside>
  )
}
