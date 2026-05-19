import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token || token.length < 10) {
    return NextResponse.json({ valid: false }, { status: 400 })
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { usedAt: true, expiresAt: true, user: { select: { email: true } } },
  })

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json({ valid: false })
  }

  return NextResponse.json({ valid: true, email: record.user.email })
}
