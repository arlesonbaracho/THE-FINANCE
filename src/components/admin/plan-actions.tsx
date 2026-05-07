'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Trash2 } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
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

interface Props { planId: string; subCount: number; planName: string }

export function PlanActions({ planId, subCount, planName }: Props) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (subCount > 0) {
      toast.error(`Plano possui ${subCount} assinatura(s) ativa(s). Desative antes de excluir.`)
      setConfirmOpen(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/plans/${planId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Plano excluído')
        router.refresh()
      } else {
        const d = await res.json()
        toast.error(d.error ?? 'Erro ao excluir plano')
      }
    } finally {
      setLoading(false)
      setConfirmOpen(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="border-slate-700 bg-slate-900 text-slate-200">
          <DropdownMenuItem
            onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-2 text-red-400 focus:text-red-400"
          >
            <Trash2 className="h-4 w-4" /> Excluir plano
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="border-slate-700 bg-slate-900 text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano &quot;{planName}&quot;?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {subCount > 0
                ? `Este plano possui ${subCount} assinatura(s) ativa(s) e não pode ser excluído.`
                : 'Esta ação não pode ser desfeita. O plano será removido permanentemente.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700">
              Cancelar
            </AlertDialogCancel>
            {subCount === 0 && (
              <AlertDialogAction
                onClick={handleDelete}
                disabled={loading}
                className="bg-red-700 hover:bg-red-600 disabled:opacity-50"
              >
                {loading ? 'Excluindo...' : 'Excluir'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
