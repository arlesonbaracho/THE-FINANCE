import { getAdminSession } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'
import { SaudeClient } from './saude-client'

export default async function AdminSaudePage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  return <SaudeClient />
}
