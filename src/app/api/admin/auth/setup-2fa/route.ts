import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateTotpSecret, generateQrCodeDataUrl, verifyTotpToken } from '@/lib/totp'
import { signAdminToken, setAdminCookie } from '@/lib/admin-auth'
import { z } from 'zod'

// GET: generate a new TOTP secret and QR code for a given adminId
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const adminId = searchParams.get('adminId')
  if (!adminId) return NextResponse.json({ error: 'adminId obrigatório' }, { status: 400 })

  const admin = await prisma.adminUser.findUnique({ where: { id: adminId } })
  if (!admin) return NextResponse.json({ error: 'Admin não encontrado' }, { status: 404 })

  const secret = generateTotpSecret()
  await prisma.adminUser.update({
    where: { id: adminId },
    data: { totpSecret: secret, totpEnabled: false },
  })

  const qrCode = await generateQrCodeDataUrl(admin.email, secret)
  return NextResponse.json({ qrCode, secret })
}

const verifySchema = z.object({
  adminId: z.string(),
  token: z.string().length(6),
})

// POST: confirm the TOTP token and mark 2FA as enabled
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = verifySchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })

    const { adminId, token } = parsed.data
    const admin = await prisma.adminUser.findUnique({ where: { id: adminId } })

    if (!admin || !admin.totpSecret) {
      return NextResponse.json({ error: 'Setup não iniciado' }, { status: 400 })
    }

    const valid = verifyTotpToken(token, admin.totpSecret)
    if (!valid) {
      return NextResponse.json({ error: 'Código inválido. Tente novamente.' }, { status: 400 })
    }

    await prisma.adminUser.update({ where: { id: adminId }, data: { totpEnabled: true } })

    // Issue session cookie after successful 2FA setup
    const jwt = await signAdminToken({ sub: admin.id, email: admin.email, role: admin.role })
    setAdminCookie(jwt)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[SETUP 2FA]', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
