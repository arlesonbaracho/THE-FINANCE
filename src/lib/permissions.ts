import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// ── Permission keys ───────────────────────────────────────────────────────────

export const PERMISSIONS = {
  // Estoque
  ESTOQUE_VER: 'estoque.ver',
  ESTOQUE_CRIAR: 'estoque.criar',
  ESTOQUE_EDITAR: 'estoque.editar',
  ESTOQUE_DELETAR: 'estoque.deletar',
  ESTOQUE_MOVIMENTAR: 'estoque.movimentar',
  // Produtos
  PRODUTOS_VER: 'produtos.ver',
  PRODUTOS_CRIAR: 'produtos.criar',
  PRODUTOS_EDITAR: 'produtos.editar',
  PRODUTOS_DELETAR: 'produtos.deletar',
  // Usuários
  USUARIOS_VER: 'usuarios.ver',
  USUARIOS_GERENCIAR: 'usuarios.gerenciar',
  // Relatórios
  RELATORIOS_VER: 'relatorios.ver',
  // Configurações
  CONFIGURACOES_VER: 'configuracoes.ver',
  CONFIGURACOES_EDITAR: 'configuracoes.editar',
  // Pedidos / Cozinha
  COZINHA_VER: 'cozinha.ver',
  COZINHA_GERENCIAR: 'cozinha.gerenciar',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// ── Default role permission sets ──────────────────────────────────────────────

const ALL: Permission[] = Object.values(PERMISSIONS)

export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  ADMIN_RESTAURANTE: ALL,
  GERENTE: [
    PERMISSIONS.ESTOQUE_VER,
    PERMISSIONS.ESTOQUE_CRIAR,
    PERMISSIONS.ESTOQUE_EDITAR,
    PERMISSIONS.ESTOQUE_MOVIMENTAR,
    PERMISSIONS.PRODUTOS_VER,
    PERMISSIONS.PRODUTOS_CRIAR,
    PERMISSIONS.PRODUTOS_EDITAR,
    PERMISSIONS.USUARIOS_VER,
    PERMISSIONS.RELATORIOS_VER,
    PERMISSIONS.CONFIGURACOES_VER,
    PERMISSIONS.COZINHA_VER,
    PERMISSIONS.COZINHA_GERENCIAR,
  ],
  CAIXA: [
    PERMISSIONS.PRODUTOS_VER,
    PERMISSIONS.ESTOQUE_VER,
    PERMISSIONS.COZINHA_VER,
  ],
  COZINHEIRO: [
    PERMISSIONS.COZINHA_VER,
    PERMISSIONS.COZINHA_GERENCIAR,
    PERMISSIONS.ESTOQUE_VER,
  ],
  ESTOQUISTA: [
    PERMISSIONS.ESTOQUE_VER,
    PERMISSIONS.ESTOQUE_CRIAR,
    PERMISSIONS.ESTOQUE_EDITAR,
    PERMISSIONS.ESTOQUE_MOVIMENTAR,
    PERMISSIONS.PRODUTOS_VER,
    PERMISSIONS.RELATORIOS_VER,
  ],
}

export const DEFAULT_ROLE_NAMES = Object.keys(DEFAULT_ROLE_PERMISSIONS)

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
