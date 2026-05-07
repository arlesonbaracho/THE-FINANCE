'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import type { Permission } from '@/lib/permissions'

export function usePermissions() {
  const { data: session } = useSession()
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.user?.id) { setLoading(false); return }
    fetch('/api/perfil/permissions')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.permissions)) setPermissions(d.permissions) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session?.user?.id])

  function can(permission: Permission): boolean {
    const role = session?.user?.role
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return true
    return permissions.includes(permission)
  }

  return { permissions, loading, can }
}
