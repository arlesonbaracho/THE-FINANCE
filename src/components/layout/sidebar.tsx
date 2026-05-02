'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  ShoppingBasket,
  ChefHat,
  ChevronDown,
  ChevronRight,
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
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [openGroups, setOpenGroups] = useState<string[]>(['Estoque'])

  function toggleGroup(label: string) {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    )
  }

  return (
    <aside className="w-64 min-h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-zinc-800">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-500">
          <ChefHat className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-bold text-lg tracking-tight">THE FINANCE</span>
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
                      ? 'text-orange-400'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
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
                  <div className="ml-4 mt-1 space-y-1 pl-3 border-l border-zinc-800">
                    {item.children.map((child) => {
                      const isChildActive = pathname.startsWith(child.href)
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                            isChildActive
                              ? 'bg-orange-500/10 text-orange-400 font-medium'
                              : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
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
                  ? 'bg-orange-500/10 text-orange-400'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-6 py-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">THE FINANCE v1.0.0</p>
      </div>
    </aside>
  )
}
