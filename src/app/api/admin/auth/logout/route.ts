import { NextResponse } from 'next/server'
import { clearAdminCookie, getAdminSession } from '@/lib/admin-auth'
import { logAdminAction } from '@/lib/admin-logger'
import { getClientIp } from '@/lib/rate-limit'

export async function POST(req: Request) {
  const session = await getAdminSession()
  if (session) {
    await logAdminAction({
      adminId: session.sub,
      action: 'LOGOUT',
      ip: getClientIp(req),
    })
  }
  clearAdminCookie()
  return NextResponse.json({ success: true })
}
