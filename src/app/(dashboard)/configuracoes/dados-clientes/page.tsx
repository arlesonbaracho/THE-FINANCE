'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Trash2, Search, ShieldAlert } from 'lucide-react'

interface ClienteData {
  reservas: unknown[]
  contatosWhatsapp: unknown[]
  logsWhatsapp: unknown[]
}

export default function DadosClientesPage() {
  // Search form state
  const [telefone, setTelefone] = useState('')
  const [nome, setNome] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [result, setResult] = useState<ClienteData | null>(null)
  const [searched, setSearched] = useState(false)

  // Export state
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [deleteSuccess, setDeleteSuccess] = useState('')

  const hasResult =
    result !== null &&
    (result.reservas.length > 0 ||
      result.contatosWhatsapp.length > 0 ||
      result.logsWhatsapp.length > 0)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!telefone.trim()) return
    setSearching(true)
    setSearchError('')
    setResult(null)
    setSearched(false)
    setShowDeleteConfirm(false)
    setDeleteConfirm('')
    setDeleteSuccess('')
    try {
      const params = new URLSearchParams({ telefone: telefone.trim() })
      if (nome.trim()) params.set('nome', nome.trim())
      const r = await fetch(`/api/clientes/dados?${params.toString()}`)
      if (!r.ok) {
        setSearchError('Falha ao buscar dados. Tente novamente.')
        return
      }
      const data: ClienteData = await r.json()
      setResult(data)
      setSearched(true)
    } catch {
      setSearchError('Erro inesperado ao buscar. Tente novamente.')
    } finally {
      setSearching(false)
    }
  }

  async function handleExport() {
    if (!result) return
    setExporting(true)
    setExportError('')
    try {
      const params = new URLSearchParams({ telefone: telefone.trim() })
      if (nome.trim()) params.set('nome', nome.trim())
      const r = await fetch(`/api/clientes/dados/exportar?${params.toString()}`)
      if (!r.ok) {
        setExportError('Falha ao exportar dados. Tente novamente.')
        return
      }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'dados-cliente.json'
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
    setDeleteSuccess('')
    try {
      const res = await fetch('/api/clientes/dados/excluir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: telefone.trim(), nome: nome.trim() || undefined }),
      })
      if (res.ok) {
        const body = await res.json()
        setDeleteSuccess(
          `Apagados: ${body.reservas ?? 0} reservas, ${body.contatosWhatsapp ?? 0} contatos, ${body.logsWhatsapp ?? 0} mensagens.`
        )
        setResult(null)
        setSearched(false)
        setShowDeleteConfirm(false)
        setDeleteConfirm('')
      } else {
        const body = await res.json().catch(() => ({}))
        setDeleteError(body.error ?? 'Erro ao excluir dados. Tente novamente.')
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
        <h1 className="text-2xl font-bold text-white">Dados de Clientes (LGPD)</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Consulte, exporte ou exclua dados de um cliente para atender a um pedido de titular de dados (LGPD).
        </p>
      </div>

      {/* Card: Search */}
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Search className="h-4 w-4" /> Buscar cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-zinc-300">
                Telefone <span className="text-zinc-500 text-xs">(obrigatório)</span>
              </Label>
              <Input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="+55 11 91234-5678"
                className="bg-zinc-800 border-zinc-700 text-white"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-zinc-300">
                Nome <span className="text-zinc-500 text-xs">(opcional)</span>
              </Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome do cliente"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            {searchError && <p className="text-sm text-red-400">{searchError}</p>}
            <Button
              type="submit"
              disabled={searching || !telefone.trim()}
              className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40"
            >
              {searching ? 'Buscando...' : 'Buscar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results preview */}
      {searched && result !== null && (
        <Card className="border-zinc-800 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-white text-base">Registros encontrados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasResult ? (
              <p className="text-sm text-zinc-500">Nenhum registro encontrado para os dados informados.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-800/50 px-3 py-2">
                  <span className="text-sm text-zinc-300">Reservas</span>
                  <span className="text-sm font-mono text-white">{result.reservas.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-800/50 px-3 py-2">
                  <span className="text-sm text-zinc-300">Contatos WhatsApp</span>
                  <span className="text-sm font-mono text-white">{result.contatosWhatsapp.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-800/50 px-3 py-2">
                  <span className="text-sm text-zinc-300">Mensagens WhatsApp</span>
                  <span className="text-sm font-mono text-white">{result.logsWhatsapp.length}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Success message after delete */}
      {deleteSuccess && (
        <div className="rounded-md border border-green-800/50 bg-green-950/30 px-4 py-3">
          <p className="text-sm text-green-300">{deleteSuccess}</p>
        </div>
      )}

      {/* Action buttons */}
      {hasResult && (
        <>
          {/* Export */}
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Download className="h-4 w-4" /> Exportar dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-400">
                Baixe todos os dados encontrados em formato JSON para entrega ao titular.
              </p>
              {exportError && <p className="text-sm text-red-400">{exportError}</p>}
              <Button
                onClick={handleExport}
                disabled={exporting}
                className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40"
              >
                {exporting ? 'Exportando...' : 'Exportar (JSON)'}
              </Button>
            </CardContent>
          </Card>

          {/* Delete */}
          <Card className="border-red-900/50 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-red-400 text-base flex items-center gap-2">
                <Trash2 className="h-4 w-4" /> Excluir dados do cliente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 rounded-md border border-red-900/40 bg-red-950/30 p-3">
                <ShieldAlert className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-300">
                  Esta ação é <strong>irreversível</strong>. Todos os registros vinculados ao cliente
                  serão permanentemente removidos da plataforma.
                </p>
              </div>

              {!showDeleteConfirm ? (
                <Button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="bg-red-900/60 hover:bg-red-800 text-white"
                >
                  Excluir dados
                </Button>
              ) : (
                <div className="space-y-3">
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
                  <div className="flex gap-2">
                    <Button
                      onClick={handleDelete}
                      disabled={deleteConfirm !== 'EXCLUIR' || deleting}
                      className="bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                    >
                      {deleting ? 'Excluindo...' : 'Excluir dados do cliente'}
                    </Button>
                    <Button
                      onClick={() => {
                        setShowDeleteConfirm(false)
                        setDeleteConfirm('')
                        setDeleteError('')
                      }}
                      className="bg-zinc-700 hover:bg-zinc-600 text-white"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
