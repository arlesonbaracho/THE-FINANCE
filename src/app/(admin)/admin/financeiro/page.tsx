import { getAdminSession } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'
import { FinanceiroClient } from './financeiro-client'

export default async function AdminFinanceiroPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  return <FinanceiroClient />
}
