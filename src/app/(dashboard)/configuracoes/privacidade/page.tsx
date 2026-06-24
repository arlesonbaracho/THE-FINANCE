'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Trash2, ShieldAlert } from 'lucide-react'

export default function PrivacidadePage() {
  // Export state
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function handleExport() {
    setExporting(true)
    setExportError('')
    try {
      const r = await fetch('/api/conta/exportar')
      if (!r.ok) {
        setExportError('Falha ao exportar dados. Tente novamente.')
        return
      }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'meus-dados.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setExportError('Erro inesperado ao exportar. Tente novamente.')
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete() {
    if (deleteConfirm !== 'EXCLUIR') return
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch('/api/conta/excluir', { method: 'POST' })
      if (res.ok) {
        await signOut({ callbackUrl: '/auth/login' })
        return
      }
      if (res.status === 409) {
        const body = await res.json()
        setDeleteError(body.error ?? 'Operação não permitida.')
      } else {
        setDeleteError('Erro ao excluir a conta. Tente novamente.')
      }
    } catch {
      setDeleteError('Erro inesperado. Tente novamente.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Privacidade e meus dados</h1>
        <p className="text-zinc-400 text-sm mt-1">Gerencie seus dados pessoais e a sua conta</p>
      </div>

      {/* Card: Download data */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Download className="h-4 w-4" /> Seus dados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-400">
            Baixe uma cópia de todos os seus dados armazenados na plataforma em formato JSON.
          </p>
          {exportError && <p className="text-sm text-red-400">{exportError}</p>}
          <Button
            onClick={handleExport}
            disabled={exporting}
            className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40"
          >
            {exporting ? 'Exportando...' : 'Baixar meus dados'}
          </Button>
        </CardContent>
      </Card>

      {/* Card: Delete account */}
      <Card className="border-red-900/50 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-red-400 text-base flex items-center gap-2">
            <Trash2 className="h-4 w-4" /> Excluir minha conta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-red-900/40 bg-red-950/30 p-3">
            <ShieldAlert className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
            <p className="text-sm text-red-300">
              Esta ação é <strong>irreversível</strong>. Sua conta será anonimizada e você perderá
              acesso permanentemente. Todos os dados vinculados a você serão desassociados.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-zinc-300">
              Digite <span className="font-mono font-bold text-white">EXCLUIR</span> para confirmar
            </Label>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="EXCLUIR"
              className="bg-zinc-800 border-zinc-700 text-white font-mono"
            />
          </div>
          {deleteError && <p className="text-sm text-red-400">{deleteError}</p>}
          <Button
            onClick={handleDelete}
            disabled={deleteConfirm !== 'EXCLUIR' || deleting}
            className="bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white"
          >
            {deleting ? 'Excluindo...' : 'Excluir minha conta'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
