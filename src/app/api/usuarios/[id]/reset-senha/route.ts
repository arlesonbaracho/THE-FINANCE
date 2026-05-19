import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkPermission, PERMISSIONS } from '@/lib/permissions'
import { rateLimit } from '@/lib/rate-limit'
import { emailService } from '@/lib/email/email.service'
import crypto from 'crypto'

const EXPIRY_MS = 2 * 60 * 60 * 1000 // 2 hours

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const allowed = await checkPermission(session.user.id, session.user.tenantId, PERMISSIONS.USUARIOS_GERENCIAR)
  if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  // Rate limit: 3 admin resets per hour per tenant
  const rl = rateLimit(`reset-admin:${session.user.tenantId}`, { limit: 3, windowMs: 60 * 60 * 1000 })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Muitas solicitações. Tente novamente em 1 hora.' },
      { status: 429 }
    )
  }

  const target = await prisma.user.findFirst({
    where: { id, tenantId: session.user.tenantId },
    select: { id: true, name: true, email: true },
  })

  if (!target) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  if (!target.email) return NextResponse.json({ error: 'Usuário sem email cadastrado' }, { status: 422 })

  // Invalidate existing tokens
  await prisma.passwordResetToken.updateMany({
    where: { userId: target.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() },
  })

  const rawToken = crypto.randomBytes(32).toString('hex')
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + EXPIRY_MS)

  await prisma.passwordResetToken.create({
    data: {
      userId: target.id,
      tokenHash,
      expiresAt,
      initiatedBy: 'ADMIN',
    },
  })

  const resetLink = `${process.env.NEXTAUTH_URL}/auth/recuperar-senha/${rawToken}`

  emailService
    .sendPasswordReset(target.email, resetLink, 120, target.name ?? undefined)
    .catch((e) => console.error('[EMAIL] Admin reset failed:', e))

  return NextResponse.json({ ok: true })
}
