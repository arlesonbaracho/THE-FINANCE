import { NextResponse } from 'next/server'
import { clearImpersonationCookie } from '@/lib/admin-auth'

export async function POST() {
  clearImpersonationCookie()
  return NextResponse.json({ success: true })
}
