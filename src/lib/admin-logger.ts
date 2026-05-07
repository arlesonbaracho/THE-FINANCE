import { prisma } from '@/lib/prisma'

export async function logAdminAction(params: {
  adminId: string
  action: string
  details?: Record<string, unknown>
  ip?: string
}): Promise<void> {
  try {
    await prisma.adminLog.create({
      data: {
        adminUserId: params.adminId,
        action: params.action,
        details: (params.details ?? {}) as never,
        ip: params.ip ?? null,
      },
    })
  } catch (err) {
    console.error('[ADMIN LOG]', err instanceof Error ? err.message : 'unknown')
  }
}
