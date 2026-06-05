import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { tenantId } = await req.json()
  const res = NextResponse.json({ ok: true })

  if (tenantId) {
    res.cookies.set('active-brand-unit', tenantId, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 8,
    })
  } else {
    res.cookies.delete('active-brand-unit')
  }

  return res
}
