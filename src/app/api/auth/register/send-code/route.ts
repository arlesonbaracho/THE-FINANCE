import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { registerSchema, zodErrorResponse } from '@/lib/validations'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { emailService } from '@/lib/email/email.service'
import { generateVerificationCode } from '@/lib/verification-code'

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const rl = rateLimit(`register-send-code:${ip}`, { limit: 3, windowMs: 60 * 60 * 1000 })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  try {
    const body = await req.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 400 })
    }

    const { email, name } = parsed.data

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json(
        { error: 'Este email já está cadastrado.' },
        { status: 409 }
      )
    }

    const code = generateVerificationCode()
    await prisma.emailVerificationCode.create({
      data: {
        email,
        code,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    })

    // Fire-and-forget — email failure should not block the response
    emailService.sendEmailVerification(email, code, name).catch((err) => {
      console.error('[SEND-CODE] Email send failed:', err instanceof Error ? err.message : 'unknown')
    })

    return NextResponse.json({ message: 'Código enviado' })
  } catch (error) {
    console.error('[SEND-CODE]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
