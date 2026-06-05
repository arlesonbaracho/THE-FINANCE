import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyAdminToken } from '@/lib/admin-auth'
import { AdminSidebar } from '@/components/admin/sidebar'
import { AdminHeader } from '@/components/admin/header'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get('admin_token')?.value
  if (!token) redirect('/admin/login')

  const session = await verifyAdminToken(token)
  if (!session) redirect('/admin/login')

  return (
    <div className="flex h-screen bg-[#0a0d14] text-slate-100 overflow-hidden">
      <AdminSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  )
}
