import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { emailService } from '@/lib/email/email.service'
import { z } from 'zod'
import crypto from 'crypto'

const schema = z.object({ email: z.string().email() })

const EXPIRY_MS = 30 * 60 * 1000
const GENERIC_MSG = 'Se este email estiver cadastrado, você receberá as instruções em breve.'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  // Rate limit: 3 req/15min per IP
  const rl = rateLimit(`reset:ip:${ip}`, { limit: 3, windowMs: 15 * 60 * 1000 })
  if (!rl.success) {
    return NextResponse.json(
      { message: GENERIC_MSG, rateLimited: true, retryAfter: rl.retryAfter },
      { status: 429 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ message: GENERIC_MSG })

  const email = parsed.data.email.toLowerCase().trim()

  // Rate limit: 3 req/15min per email (additional layer)
  const rlEmail = rateLimit(`reset:email:${email}`, { limit: 3, windowMs: 15 * 60 * 1000 })
  if (!rlEmail.success) {
    return NextResponse.json({ message: GENERIC_MSG })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    })

    // Always return generic response regardless of user existence
    if (!user) return NextResponse.json({ message: GENERIC_MSG })

    // Invalidate previous unused tokens
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    })

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + EXPIRY_MS)

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt, requestIp: ip },
    })

    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL}/recuperar-senha/${rawToken}`

    emailService.sendPasswordReset(email, resetLink, 30, user.name ?? undefined).catch((e) =>
      console.error('[EMAIL] Password reset failed:', e)
    )
  } catch (e) {
    console.error('[RESET]', e)
  }

  return NextResponse.json({ message: GENERIC_MSG })
}
