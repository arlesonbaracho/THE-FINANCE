'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { getSocket } from '@/lib/socket-client'

type AlertsContextValue = {
  unreadCount: number
  decrement: () => void
}

const AlertsContext = createContext<AlertsContextValue>({
  unreadCount: 0,
  decrement: () => {},
})

export function useAlerts() {
  return useContext(AlertsContext)
}

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!session?.user?.tenantId) return

    fetch('/api/alertas/count')
      .then((r) => r.json())
      .then((data: { count?: number }) => setUnreadCount(data.count ?? 0))
      .catch(() => {})

    const socket = getSocket()
    socket.emit('join:tenant', session.user.tenantId)

    const handler = () => setUnreadCount((c) => c + 1)
    socket.on('alerta:novo', handler)
    return () => {
      socket.off('alerta:novo', handler)
    }
  }, [session?.user?.tenantId])

  return (
    <AlertsContext.Provider
      value={{ unreadCount, decrement: () => setUnreadCount((c) => Math.max(0, c - 1)) }}
    >
      {children}
    </AlertsContext.Provider>
  )
}
