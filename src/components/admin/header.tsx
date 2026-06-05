'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function AdminHeader() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    fetch('/api/admin/notifications')
      .then((r) => r.json())
      .then((d) => setCount(d.count ?? 0))
      .catch(() => {})
  }, [])

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-800/60 bg-[#060810] px-6">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-indigo-600/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-indigo-400 border border-indigo-500/20">
          SUPER ADMIN
        </span>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative text-slate-400 hover:text-slate-200 transition-colors">
          <Bell className={count > 0 ? 'h-5 w-5 animate-pulse' : 'h-5 w-5'} />
          {count > 0 && (
            <Badge className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full p-0 text-[10px] bg-red-600 border-0">
              {count > 9 ? '9+' : count}
            </Badge>
          )}
        </button>
      </div>
    </header>
  )
}
