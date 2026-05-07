'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

interface ImpersonationBannerProps {
  tenantName: string
}

export function ImpersonationBanner({ tenantName }: ImpersonationBannerProps) {
  const router = useRouter()

  async function stopImpersonation() {
    await fetch('/api/admin/tenants/stop/stop-impersonation', { method: 'POST' })
    router.push('/admin/restaurantes')
    router.refresh()
  }

  return (
    <div className="flex items-center justify-between bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
      <span>
        Você está acessando como <strong>{tenantName}</strong> (Modo Suporte)
      </span>
      <button
        onClick={stopImpersonation}
        className="flex items-center gap-1.5 rounded border border-white/60 px-3 py-0.5 text-xs hover:bg-white/20 transition"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sair da impersonação
      </button>
    </div>
  )
}
