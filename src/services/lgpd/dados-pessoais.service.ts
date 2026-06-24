import { prisma } from '@/lib/prisma'

export type DadosExportados = {
  perfil: Record<string, unknown>
  consentimentos: unknown[]
  logsAcesso: unknown[]
}

export async function exportarDadosUsuario(userId: string): Promise<DadosExportados> {
  const perfil = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, status: true, avatarUrl: true, ultimoAcesso: true, createdAt: true, updatedAt: true, anonimizadoEm: true },
  })
  const consentimentos = await prisma.consentRecord.findMany({
    where: { userId },
    select: { documento: true, versao: true, aceitoEm: true, ip: true },
    orderBy: { aceitoEm: 'asc' },
  })
  const logsAcesso = await prisma.userAccessLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return { perfil: perfil ?? {}, consentimentos, logsAcesso }
}

export async function anonimizarUsuario(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      name: null,
      email: `anonimizado+${userId}@removido.local`,
      avatarUrl: null,
      image: null,
      pin: null,
      password: null,
      status: 'INACTIVE',
      anonimizadoEm: new Date(),
    },
  })
}

export async function contarAdminsAtivos(tenantId: string): Promise<number> {
  return prisma.user.count({
    where: { tenantId, role: { in: ['ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE', anonimizadoEm: null },
  })
}

export function podeAnonimizar(usuario: { role: string; tenantId: string | null }, totalAdminsAtivos: number): boolean {
  if (usuario.role === 'ADMIN' || usuario.role === 'SUPER_ADMIN') return totalAdminsAtivos > 1
  return true
}
