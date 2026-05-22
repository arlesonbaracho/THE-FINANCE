import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_ROLE_NAMES,
  type Permission,
} from '@/lib/permissions-constants'

const ALL: Permission[] = Object.values(PERMISSIONS)

export { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, DEFAULT_ROLE_NAMES }
export type { Permission }

// ── Permission check ──────────────────────────────────────────────────────────

export async function checkPermission(
  userId: string,
  tenantId: string,
  permission: Permission
): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    include: { customRole: true },
  })

  if (!user) return false
  if (user.status !== 'ACTIVE') return false

  // Legacy ADMIN/MANAGER roles have full access
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true
  if (user.role === 'MANAGER') {
    const managerPerms = DEFAULT_ROLE_PERMISSIONS['GERENTE']
    return managerPerms.includes(permission)
  }

  // Custom role check
  if (user.customRole) {
    const perms = user.customRole.permissions as Permission[]
    return Array.isArray(perms) && perms.includes(permission)
  }

  // STAFF default: limited
  return false
}

// ── Session-based permission check (server components / route handlers) ───────

export async function requirePermission(permission: Permission): Promise<void> {
  const session = await getServerSession(authOptions)
  const u = session?.user as { id?: string; tenantId?: string } | undefined
  if (!u?.id || !u.tenantId) {
    throw new Error('Unauthorized')
  }
  const allowed = await checkPermission(u.id, u.tenantId, permission)
  if (!allowed) throw new Error('Forbidden')
}

// ── Resolve user permissions array ───────────────────────────────────────────

export async function getUserPermissions(userId: string, tenantId: string): Promise<Permission[]> {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    include: { customRole: true },
  })

  if (!user || (user.status as string) !== 'ACTIVE') return []
  if ((user.role as string) === 'ADMIN' || (user.role as string) === 'SUPER_ADMIN') return ALL
  if ((user.role as string) === 'MANAGER') return DEFAULT_ROLE_PERMISSIONS['GERENTE'] ?? []
  if (user.customRole) {
    const perms = user.customRole.permissions as Permission[]
    return Array.isArray(perms) ? perms : []
  }
  return []
}
