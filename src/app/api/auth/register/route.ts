import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/utils'
import { registerSchema, zodErrorResponse } from '@/lib/validations'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { normalizeCnpj, lookupCnpj, buildFiscalData } from '@/services/fiscal/cnpj.service'
import { z } from 'zod'

export async function POST(req: Request) {
  // Rate limit: 5 registrations per IP per hour
  const ip = getClientIp(req)
  const rl = rateLimit(`register:${ip}`, { limit: 5, windowMs: 60 * 60 * 1000 })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfter) },
      }
    )
  }

  try {
    const body = await req.json()
    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(zodErrorResponse(parsed.error), { status: 400 })
    }

    const { restaurantName, name, email, password, cnpj } = parsed.data
    const cnpjDigits = normalizeCnpj(cnpj)

    const cnpjEmUso = await prisma.tenant.findUnique({ where: { cnpj: cnpjDigits } })
    if (cnpjEmUso) {
      return NextResponse.json(
        { error: 'Não foi possível criar a conta. Verifique os dados.' },
        { status: 400 }
      )
    }

    const lookup = await lookupCnpj(cnpjDigits)
    if (lookup.status === 'not_found' || lookup.status === 'inactive') {
      return NextResponse.json(
        { error: 'CNPJ não encontrado ou inativo na Receita Federal.' },
        { status: 400 }
      )
    }
    // status 'unavailable' (Receita/BrasilAPI fora do ar) NÃO bloqueia o cadastro.
    const fiscalData = buildFiscalData(lookup)

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      // Avoid leaking whether an email exists — same generic message
      return NextResponse.json(
        { error: 'Não foi possível criar a conta. Verifique os dados.' },
        { status: 400 }
      )
    }

    let slug = slugify(restaurantName)
    const existingSlug = await prisma.tenant.findUnique({ where: { slug } })
    if (existingSlug) {
      slug = `${slug}-${Date.now()}`
    }

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
          },
        },
      },
    })

    return NextResponse.json(
      { message: 'Conta criada com sucesso', tenantId: tenant.id },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(zodErrorResponse(error), { status: 400 })
    }
    console.error('[REGISTER]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
