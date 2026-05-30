import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: params.slug },
      select: { id: true, name: true, slug: true, logo: true },
    })
    if (!tenant) {
      return NextResponse.json(
        { error: 'Restaurante não encontrado' },
        { status: 404 }
      )
    }
    return NextResponse.json(tenant)
  } catch (error) {
    console.error('[tenants/verify]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
