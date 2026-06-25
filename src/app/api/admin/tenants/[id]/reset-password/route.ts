import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-logger'
import { getClientIp } from '@/lib/rate-limit'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const admin = await prisma.user.findFirst({
      where: { tenantId: params.id, role: 'ADMIN' },
    })

    if (!admin) {
      return NextResponse.json({ error: 'Admin do restaurante não encontrado' }, { status: 404 })
    }

    const tempPassword = generateTempPassword()
    const hashed = await bcrypt.hash(tempPassword, 12)

    await prisma.user.update({
      where: { id: admin.id },
      data: { password: hashed },
    })

    await logAdminAction({
      adminId: session.sub,
      action: 'RESET_TENANT_PASSWORD',
      details: { tenantId: params.id, userId: admin.id },
      ip: getClientIp(req),
    })

    return NextResponse.json({ tempPassword })
  } catch (error) {
    console.error('[ADMIN RESET PWD]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
