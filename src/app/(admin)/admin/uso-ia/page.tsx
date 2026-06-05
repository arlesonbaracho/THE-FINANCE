import { getAdminSession } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'
import { UsoIaClient } from './uso-ia-client'

export default async function AdminUsoIaPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  return <UsoIaClient />
}
