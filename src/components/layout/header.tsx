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
import { LogOut, Store, UserCircle, Sun, Moon } from 'lucide-react'
import Link from 'next/link'

export function Header() {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

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
        <Store className="w-4 h-4" style={{ color: 'var(--tf-txt3)' }} />
        <span style={{ color: 'var(--tf-txt)', fontSize: 13.5, fontWeight: 500 }}>
          {session?.user?.tenantName ?? 'Carregando...'}
        </span>
      </div>

      <div className="flex items-center gap-2">
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
    </header>
  )
}
