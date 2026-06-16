import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { registerSchema, zodErrorResponse } from '@/lib/validations'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { slugify } from '@/lib/utils'
import { z } from 'zod'
import { normalizeCnpj, lookupCnpj, buildFiscalData } from '@/services/fiscal/cnpj.service'

const verifySchema = registerSchema.extend({
  code: z.string().length(6).regex(/^\d{6}$/, 'Código deve ter 6 dígitos numéricos'),
})

export async function POST(req: Request) {
  const ip = getClientIp(req)

  try {
    const body = await req.json()
    const parsed = verifySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 400 })
    }

    const { email, code, restaurantName, name, password, cnpj } = parsed.data

    // Rate limit per email (brute-force protection)
    const rl = rateLimit(`register-verify:${email}`, { limit: 10, windowMs: 60 * 60 * 1000 })
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
      )
    }

    // Find latest valid, unused code for this email
    const record = await prisma.emailVerificationCode.findFirst({
      where: { email, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })

    if (!record) {
      return NextResponse.json(
        { error: 'Código inválido ou expirado.' },
        { status: 400 }
      )
    }

    if (record.code !== code) {
      return NextResponse.json(
        { error: 'Código incorreto.' },
        { status: 400 }
      )
    }

    // Mark code as used immediately to prevent replay
    await prisma.emailVerificationCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    })

    // Race condition guard: re-check email uniqueness
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json(
        { error: 'Este email já está cadastrado.' },
        { status: 409 }
      )
    }

    const cnpjDigits = normalizeCnpj(cnpj)
    const cnpjEmUso = await prisma.tenant.findUnique({ where: { cnpj: cnpjDigits } })
    if (cnpjEmUso) {
      return NextResponse.json({ error: 'Não foi possível criar a conta. Verifique os dados.' }, { status: 400 })
    }
    const lookup = await lookupCnpj(cnpjDigits)
    if (lookup.status === 'not_found' || lookup.status === 'inactive') {
      return NextResponse.json({ error: 'CNPJ não encontrado ou inativo na Receita Federal.' }, { status: 400 })
    }
    const fiscalData = buildFiscalData(lookup)

    let slug = slugify(restaurantName)
    const existingSlug = await prisma.tenant.findUnique({ where: { slug } })
    if (existingSlug) slug = `${slug}-${Date.now()}`

    const hashedPassword = await bcrypt.hash(password, 12)

    const tenant = await prisma.tenant.create({
      data: {
        name: restaurantName,
        slug,
        cnpj: cnpjDigits,
        fiscal: { create: fiscalData },
        users: {
          create: {
            name,
            email,
            password: hashedPassword,
            role: 'ADMIN',
            emailVerified: new Date(),
          },
        },
      },
    })

    return NextResponse.json(
      { message: 'Conta criada com sucesso', tenantId: tenant.id },
      { status: 201 }
    )
  } catch (error) {
    console.error('[VERIFY-CODE]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
