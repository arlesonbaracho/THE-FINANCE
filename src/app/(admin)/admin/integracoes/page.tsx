import { getAdminSession } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'
import { IntegracoesClient } from './integracoes-client'

export default async function AdminIntegracoesPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  return <IntegracoesClient />
}
