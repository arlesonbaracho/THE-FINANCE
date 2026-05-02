'use client'

import { useSession, signOut } from 'next-auth/react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, Store } from 'lucide-react'

export function Header() {
  const { data: session } = useSession()

  const initials = session?.user?.name
    ? session.user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U'

  return (
    <header className="h-16 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-2">
        <Store className="w-4 h-4 text-zinc-400" />
        <span className="text-zinc-300 text-sm font-medium">
          {session?.user?.tenantName ?? 'Carregando...'}
        </span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-800 transition-colors outline-none">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-orange-500 text-white text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="text-left hidden sm:block">
            <p className="text-sm text-white font-medium leading-none">
              {session?.user?.name ?? 'Usuário'}
            </p>
            <p className="text-xs text-zinc-400 mt-0.5">{session?.user?.email}</p>
          </div>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-56 bg-zinc-900 border-zinc-800 text-zinc-100"
        >
          <DropdownMenuLabel className="text-zinc-400 font-normal text-xs uppercase tracking-wider">
            Minha Conta
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-zinc-800" />
          <DropdownMenuItem
            className="text-red-400 gap-2 cursor-pointer"
            onClick={() => signOut({ callbackUrl: '/auth/login' })}
          >
            <LogOut className="w-4 h-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
