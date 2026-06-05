'use client'

import { useSession, signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, Store, UserCircle, Sun, Moon, Bell, Network } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAlerts } from '@/components/alerts/AlertsProvider'
import { AlertsDrawer } from '@/components/alerts/AlertsDrawer'

function BrandUnitDropdown({ tenantName, brandId }: { tenantName: string; brandId: string }) {
  const [open, setOpen] = useState(false)
  const [unidades, setUnidades] = useState<Array<{ id: string; name: string; isHeadquarters: boolean }>>([])
  const router = useRouter()

  useEffect(() => {
    fetch('/api/rede/unidades')
      .then((r) => r.json())
      .then(setUnidades)
      .catch(() => {})
  }, [brandId])

  async function irPara(tenantId: string | null) {
    await fetch('/api/rede/switch-unit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId }),
    })
    setOpen(false)
    if (tenantId === null) {
      router.push('/rede/dashboard')
    } else {
      router.push('/dashboard')
    }
    router.refresh()
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 10px',
          borderRadius: 8,
          border: '1px solid var(--tf-border)',
          background: 'transparent',
          color: 'var(--tf-txt)',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        <Network className="w-3 h-3" style={{ color: 'var(--tf-primary, #6366f1)' }} />
        {tenantName}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '110%',
            left: 0,
            background: 'var(--tf-surface)',
            border: '1px solid var(--tf-border)',
            borderRadius: 8,
            minWidth: 220,
            zIndex: 200,
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          }}
        >
          <button
            onClick={() => irPara(null)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '10px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--tf-border)',
              color: 'var(--tf-primary, #6366f1)',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Visão consolidada →
          </button>
          {unidades.map((u) => (
            <button
              key={u.id}
              onClick={() => irPara(u.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--tf-border)',
                color: 'var(--tf-txt)',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {u.isHeadquarters ? '★ ' : ''}{u.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Header() {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { unreadCount } = useAlerts()

  useEffect(() => { setMounted(true) }, [])

  const initials = session?.user?.name
    ? session.user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U'

  return (
    <header
      className="flex items-center justify-between px-6"
      style={{
        height: 52,
        background: 'var(--tf-surface)',
        borderBottom: '1px solid var(--tf-border)',
        flexShrink: 0,
      }}
    >
      <div className="flex items-center gap-2">
        {session?.user?.brandId ? (
          <BrandUnitDropdown tenantName={session.user.tenantName} brandId={session.user.brandId} />
        ) : (
          <>
            <Store className="w-4 h-4" style={{ color: 'var(--tf-txt3)' }} />
            <span style={{ color: 'var(--tf-txt)', fontSize: 13.5, fontWeight: 500 }}>
              {session?.user?.tenantName ?? 'Carregando...'}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Alert bell button */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="relative p-2 rounded-lg transition-colors"
          style={{
            color: 'var(--tf-txt3)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--tf-surface2)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--tf-txt)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--tf-txt3)'
          }}
          aria-label="Abrir alertas"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-white"
              style={{
                minWidth: 16,
                height: 16,
                fontSize: 10,
                fontWeight: 700,
                background: 'var(--tf-red)',
                padding: '0 3px',
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--tf-txt3)', background: 'transparent', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--tf-surface2)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--tf-txt)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--tf-txt3)' }}
            aria-label="Alternar tema"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors outline-none hover:bg-secondary">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium leading-none" style={{ color: 'var(--tf-txt)' }}>
                {session?.user?.name ?? 'Usuário'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--tf-txt3)' }}>{session?.user?.email}</p>
            </div>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-muted-foreground font-normal text-xs uppercase tracking-wider">
              Minha Conta
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => {}}>
              <Link href="/configuracoes/perfil" className="flex items-center gap-2 w-full">
                <UserCircle className="w-4 h-4" />
                Meu Perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive gap-2 cursor-pointer"
              onClick={() => signOut({ callbackUrl: '/auth/login' })}
            >
              <LogOut className="w-4 h-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <AlertsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </header>
  )
}
