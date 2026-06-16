import { NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { createSetupIntent } from '@/services/payments/stripe.service'

export async function POST() {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const { tenantId } = session.user

  try {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      include: { users: { where: { role: 'ADMIN' }, take: 1 } },
    })
    const email = tenant.users[0]?.email ?? `tenant-${tenantId}@thefinance.app`
    const result = await createSetupIntent(tenantId, email, tenant.name)
    return NextResponse.json(result)
  } catch (err: unknown) {
    console.error('[stripe-setup-intent]', err)
    return NextResponse.json({ error: 'Erro ao iniciar pagamento' }, { status: 500 })
  }
}
