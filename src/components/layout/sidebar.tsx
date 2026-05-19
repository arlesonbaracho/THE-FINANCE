'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
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
import { TFMark } from '@/components/ui/tf-mark'

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
      { label: 'Insumos',    href: '/estoque/insumos',    icon: ShoppingBasket },
      { label: 'Produtos',   href: '/estoque/produtos',   icon: ChefHat },
      { label: 'Inventário', href: '/estoque/inventario', icon: Package },
    ],
  },
  {
    label: 'Configurações',
    icon: Settings,
    children: [
      { label: 'Usuários',   href: '/configuracoes/usuarios',   icon: Users },
      { label: 'Meu Perfil', href: '/configuracoes/perfil',     icon: User },
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
    <aside
      style={{
        width: 220,
        minHeight: '100vh',
        background: 'var(--tf-sidebar)',
        borderRight: '1px solid var(--tf-sidebar-bd)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '18px 20px',
          borderBottom: '1px solid var(--tf-sidebar-bd)',
        }}
      >
        <TFMark size={28} />
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--tf-sidebar-txt-on)', lineHeight: 1.2 }}>
            The Finance
          </p>
          <p style={{ fontSize: 9, color: 'var(--tf-sidebar-txt)', letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 1 }}>
            Restaurantes
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map((item) => {
          if (item.children) {
            const isOpen = openGroups.includes(item.label)
            const isActive = item.children.some((c) => pathname.startsWith(c.href))

            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    borderRadius: 7,
                    fontSize: 13,
                    fontWeight: isActive ? 500 : 400,
                    color: isActive ? 'var(--tf-sidebar-txt-on)' : 'var(--tf-sidebar-txt)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 120ms, color 120ms',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'var(--tf-sidebar-hov)'
                      e.currentTarget.style.color = 'var(--tf-sidebar-txt-on)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--tf-sidebar-txt)'
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <item.icon size={15} />
                    {item.label}
                  </div>
                  {isOpen
                    ? <ChevronDown size={12} />
                    : <ChevronRight size={12} />}
                </button>

                {isOpen && (
                  <div
                    style={{
                      marginLeft: 14,
                      paddingLeft: 10,
                      borderLeft: '1px solid var(--tf-sidebar-bd)',
                      marginTop: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}
                  >
                    {item.children.map((child) => {
                      const isChildActive = pathname.startsWith(child.href)
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '7px 10px',
                            borderRadius: 7,
                            fontSize: 12.5,
                            fontWeight: isChildActive ? 500 : 400,
                            color: isChildActive ? 'var(--tf-sidebar-txt-on)' : 'var(--tf-sidebar-txt)',
                            background: isChildActive ? 'var(--tf-sidebar-active)' : 'transparent',
                            textDecoration: 'none',
                            transition: 'background 120ms, color 120ms',
                          }}
                          onMouseEnter={(e) => {
                            if (!isChildActive) {
                              e.currentTarget.style.background = 'var(--tf-sidebar-hov)'
                              e.currentTarget.style.color = 'var(--tf-sidebar-txt-on)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isChildActive) {
                              e.currentTarget.style.background = 'transparent'
                              e.currentTarget.style.color = 'var(--tf-sidebar-txt)'
                            }
                          }}
                        >
                          <child.icon size={14} />
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
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 10px',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--tf-sidebar-txt-on)' : 'var(--tf-sidebar-txt)',
                background: isActive ? 'var(--tf-sidebar-active)' : 'transparent',
                textDecoration: 'none',
                transition: 'background 120ms, color 120ms',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--tf-sidebar-hov)'
                  e.currentTarget.style.color = 'var(--tf-sidebar-txt-on)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--tf-sidebar-txt)'
                }
              }}
            >
              <item.icon size={15} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: '10px 10px 14px',
          borderTop: '1px solid var(--tf-sidebar-bd)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        <button
          onClick={() => signOut({ callbackUrl: '/auth/login' })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 10px',
            borderRadius: 7,
            fontSize: 12.5,
            color: 'var(--tf-sidebar-txt)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            transition: 'background 120ms, color 120ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#f87171'
            e.currentTarget.style.background = 'rgba(248,113,113,0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--tf-sidebar-txt)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <LogOut size={14} />
          Sair
        </button>
        <p
          style={{
            padding: '0 10px',
            fontSize: 9.5,
            color: 'var(--tf-sidebar-txt)',
            opacity: 0.5,
            letterSpacing: '0.03em',
          }}
        >
          THE FINANCE v1.0.0
        </p>
      </div>
    </aside>
  )
}
