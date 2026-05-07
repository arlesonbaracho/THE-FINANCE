import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { emailService } from '@/lib/email/email.service'
import { z } from 'zod'
import crypto from 'crypto'

const schema = z.object({ email: z.string().email() })
const GENERIC_MSG = 'Se este email estiver cadastrado, você receberá as instruções em breve.'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  const rl = rateLimit(`admin:reset:${ip}`, { limit: 3, windowMs: 15 * 60 * 1000 })
  if (!rl.success) {
    return NextResponse.json({ message: GENERIC_MSG, retryAfter: rl.retryAfter }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ message: GENERIC_MSG })

  const email = parsed.data.email.toLowerCase().trim()

  try {
    const admin = await prisma.adminUser.findUnique({ where: { email } })
    if (!admin) return NextResponse.json({ message: GENERIC_MSG })

    // Invalidar tokens anteriores
    await prisma.adminPasswordResetToken.updateMany({
      where: { adminUserId: admin.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    })

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    // Admin token: 15 minutos
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

    await prisma.adminPasswordResetToken.create({
      data: { adminUserId: admin.id, tokenHash, expiresAt, requestIp: ip },
    })

    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL}/admin/recuperar-senha/${rawToken}`
    emailService.sendAdminPasswordReset(email, resetLink, ip).catch(() => {})
  } catch (e) {
    console.error('[ADMIN RESET]', e)
  }

  return NextResponse.json({ message: GENERIC_MSG })
}
