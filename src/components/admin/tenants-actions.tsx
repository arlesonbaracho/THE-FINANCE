'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { MoreHorizontal, Eye, Ban, RefreshCw, Key, UserCheck, Trash2, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

interface Props {
  tenantId: string
  tenantName: string
  status: string
}

export function TenantsActions({ tenantId, tenantName, status }: Props) {
  const router = useRouter()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [resetPwdOpen, setResetPwdOpen] = useState(false)
  const [tempPwd, setTempPwd] = useState('')
  const [loadingSuspend, setLoadingSuspend] = useState(false)
  const [loadingImpersonate, setLoadingImpersonate] = useState(false)
  const [loadingReset, setLoadingReset] = useState(false)
  const [loadingDelete, setLoadingDelete] = useState(false)

  async function handleSuspend() {
    if (loadingSuspend) return
    setLoadingSuspend(true)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/suspend`, { method: 'POST' })
      if (res.ok) {
        toast.success(status === 'SUSPENDED' ? 'Restaurante reativado' : 'Restaurante suspenso')
        router.refresh()
      } else {
        toast.error('Erro ao alterar status')
      }
    } finally {
      setLoadingSuspend(false)
    }
  }

  async function handleImpersonate() {
    if (loadingImpersonate) return
    setLoadingImpersonate(true)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/impersonate`, { method: 'POST' })
      if (res.ok) router.push('/dashboard')
      else toast.error('Erro ao iniciar impersonação')
    } finally {
      setLoadingImpersonate(false)
    }
  }

  async function handleResetPassword() {
    if (loadingReset) return
    setLoadingReset(true)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/reset-password`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) { setTempPwd(data.tempPassword); setResetPwdOpen(true) }
      else toast.error(data.error ?? 'Erro ao resetar senha')
    } finally {
      setLoadingReset(false)
    }
  }

  async function handleDelete() {
    if (loadingDelete) return
    setLoadingDelete(true)
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Restaurante excluído')
        router.refresh()
      } else {
        toast.error('Erro ao excluir')
      }
    } finally {
      setLoadingDelete(false)
      setDeleteOpen(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 border-slate-700 bg-slate-900 text-slate-200">
          <DropdownMenuItem
            onClick={() => router.push(`/admin/restaurantes/${tenantId}`)}
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" /> Ver detalhes
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleImpersonate}
            disabled={loadingImpersonate}
            className="flex items-center gap-2"
          >
            {loadingImpersonate
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <UserCheck className="h-4 w-4" />}
            Impersonar
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-slate-700" />
          <DropdownMenuItem
            onClick={handleSuspend}
            disabled={loadingSuspend}
            className="flex items-center gap-2"
          >
            {loadingSuspend
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : status === 'SUSPENDED'
                ? <RefreshCw className="h-4 w-4" />
                : <Ban className="h-4 w-4" />}
            {status === 'SUSPENDED' ? 'Reativar' : 'Suspender'}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleResetPassword}
            disabled={loadingReset}
            className="flex items-center gap-2"
          >
            {loadingReset
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Key className="h-4 w-4" />}
            Resetar senha admin
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-slate-700" />
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="flex items-center gap-2 text-red-400 focus:text-red-400"
          >
            <Trash2 className="h-4 w-4" /> Excluir restaurante
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="border-slate-700 bg-slate-900 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {tenantName}?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Esta ação não pode ser desfeita. O restaurante e todos os seus dados serão desativados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loadingDelete}
              className="bg-red-700 hover:bg-red-600 disabled:opacity-50"
            >
              {loadingDelete ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Temp password dialog */}
      <AlertDialog open={resetPwdOpen} onOpenChange={setResetPwdOpen}>
        <AlertDialogContent className="border-slate-700 bg-slate-900 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Senha Temporária Gerada</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              Copie e envie esta senha ao administrador do restaurante. Ela não será exibida novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg bg-slate-800 px-4 py-3 text-center">
            <code className="text-lg font-bold tracking-wider text-white select-all">{tempPwd}</code>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => { navigator.clipboard.writeText(tempPwd).catch(() => {}); setResetPwdOpen(false) }}
              className="bg-slate-700 hover:bg-slate-600"
            >
              Copiar e fechar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
