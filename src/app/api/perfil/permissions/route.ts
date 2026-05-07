import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUserPermissions } from '@/lib/permissions'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const permissions = await getUserPermissions(session.user.id, session.user.tenantId)
  return NextResponse.json({ permissions })
}
