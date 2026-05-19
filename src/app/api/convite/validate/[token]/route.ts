import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token || token.length < 10) {
    return NextResponse.json({ valid: false }, { status: 400 })
  }

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: {
      tenant: { select: { name: true } },
    },
  })

  if (!invite) return NextResponse.json({ valid: false })
  if (invite.status !== 'PENDING' || invite.expiresAt < new Date()) {
    return NextResponse.json({ valid: false })
  }

  let roleName = 'Funcionário'
  if (invite.roleId) {
    const role = await prisma.role.findUnique({
      where: { id: invite.roleId },
      select: { name: true },
    })
    if (role) roleName = role.name
  }

  return NextResponse.json({
    valid: true,
    email: invite.email,
    role: roleName,
    tenantName: invite.tenant.name,
  })
}
