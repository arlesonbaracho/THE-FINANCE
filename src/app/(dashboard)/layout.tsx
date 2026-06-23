import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { AlertsProvider } from '@/components/alerts/AlertsProvider'
import { ReactQueryProvider } from '@/components/ReactQueryProvider'
import { CnpjGate } from '@/components/CnpjGate'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { precisaReconsentir } from '@/lib/legal'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (session?.user?.id) {
    const aceitas = await prisma.consentRecord.findMany({
      where: { userId: session.user.id },
      select: { documento: true, versao: true },
    })
    if (precisaReconsentir(aceitas)) {
      redirect('/consentimento')
    }
  }

  return (
    <ReactQueryProvider>
      <AlertsProvider>
        <div className="flex min-h-screen bg-background">
          <Sidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <CnpjGate />
            <Header />
            <main className="flex-1 p-6 overflow-auto">{children}</main>
          </div>
        </div>
      </AlertsProvider>
    </ReactQueryProvider>
  )
}
