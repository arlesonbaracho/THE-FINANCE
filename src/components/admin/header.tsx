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
    <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-slate-950 px-6">
      <div className="flex items-center gap-2">
        <span className="rounded bg-red-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
          MODO ADMIN
        </span>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative text-slate-400 hover:text-slate-200 transition-colors">
          <Bell className="h-5 w-5" />
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
