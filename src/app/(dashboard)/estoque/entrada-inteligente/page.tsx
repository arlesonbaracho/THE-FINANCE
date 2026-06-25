'use client'

import { useState, useRef, useCallback } from 'react'
import { io as socketIO, type Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { Upload, Camera, FileText, Loader2, AlertCircle, RotateCcw } from 'lucide-react'
import { TabelaRevisaoNF } from './components/TabelaRevisaoNF'

type PageState = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

interface NfDados {
  fornecedor: string | null
  numeroNf: string | null
  dataEmissao: string | null
  valorTotal: number | null
  itensEnriquecidos: Array<{
    descricao: string
    quantidade: number
    unidade: string
    custoUnitario: number
    custoTotal: number
    insumoId: string | null
    insumoNome: string | null
    scoreConfianca: number
  }>
}

export default function EntradaInteligentePage() {
  const [state, setState] = useState<PageState>('idle')
  const [modo, setModo] = useState<'arquivo' | 'texto'>('arquivo')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [texto, setTexto] = useState('')
  const [nfId, setNfId] = useState<string | null>(null)
  const [dados, setDados] = useState<NfDados | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const socketRef = useRef<Socket | null>(null)

  const conectarSocket = useCallback((tenantId: string, nfIdParam: string) => {
    const socket = socketIO({ path: '/api/socket' })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join:tenant', tenantId)
    })

    socket.on('nf:processada', (payload: { nfId: string; dados: NfDados }) => {
      if (payload.nfId !== nfIdParam) return
      setDados(payload.dados)
      setState('done')
      socket.disconnect()
    })

    socket.on('nf:erro', (payload: { nfId: string; mensagem: string }) => {
      if (payload.nfId !== nfIdParam) return
      setErro(payload.mensagem)
      setState('error')
      socket.disconnect()
    })
  }, [])

  async function handleSubmit() {
    setState('uploading')
    setErro(null)

    try {
      let body: BodyInit
      const headers: Record<string, string> = {}

      if (modo === 'arquivo' && arquivo) {
        const fd = new FormData()
        fd.append('file', arquivo)
        body = fd
      } else {
        body = JSON.stringify({ texto })
        headers['Content-Type'] = 'application/json'
      }

      const res = await fetch('/api/ai/processar-nf', { method: 'POST', body, headers })
      const json = await res.json() as { nfId?: string; error?: string }

      if (!res.ok) {
        setErro(json.error ?? 'Erro ao processar NF')
        setState('error')
        return
      }

      const { nfId: id } = json
      if (!id) { setState('error'); return }

      setNfId(id)
      setState('processing')

      // Get tenantId from session endpoint for socket room join
      const sessionRes = await fetch('/api/auth/session')
      const sessionData = await sessionRes.json() as { user?: { tenantId?: string } }
      const tenantId = sessionData?.user?.tenantId

      if (tenantId) {
        conectarSocket(tenantId, id)
      }

      // Polling fallback — if WS not available within 30s, switch to polling
      let pollAttempts = 0
      const pollInterval = setInterval(async () => {
        pollAttempts++
        if (pollAttempts > 20) { clearInterval(pollInterval); return }

        const statusRes = await fetch(`/api/ai/nf-status/${id}`)
        const statusJson = await statusRes.json() as { status: string; dados?: NfDados; erro?: string }

        if (statusJson.status === 'CONCLUIDA' && statusJson.dados) {
          clearInterval(pollInterval)
          if (socketRef.current?.connected) return
          setDados(statusJson.dados)
          setState('done')
        } else if (statusJson.status === 'ERRO') {
          clearInterval(pollInterval)
          if (socketRef.current?.connected) return
          setErro(statusJson.erro ?? 'Erro no processamento')
          setState('error')
        }
      }, 3000)
    } catch {
      setErro('Falha na conexão com o servidor')
      setState('error')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) setArquivo(file)
  }

  function resetar() {
    setState('idle')
    setArquivo(null)
    setTexto('')
    setDados(null)
    setErro(null)
    setNfId(null)
    socketRef.current?.disconnect()
  }

  const isLoading = state === 'uploading' || state === 'processing'
  const canSubmit = !isLoading && (modo === 'arquivo' ? !!arquivo : texto.trim().length > 0)

  return (
    <div className="flex h-full gap-6 p-6">
      {/* Left zone — input */}
      <div className="w-[400px] shrink-0 flex flex-col gap-4">
        <h1 className="text-lg font-semibold">Entrada Inteligente de Estoque</h1>

        <div className="flex gap-2">
          <button
            onClick={() => setModo('arquivo')}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
              modo === 'arquivo' ? 'bg-primary text-primary-foreground' : 'border-border'
            }`}
          >
            Arquivo / Foto
          </button>
          <button
            onClick={() => setModo('texto')}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
              modo === 'texto' ? 'bg-primary text-primary-foreground' : 'border-border'
            }`}
          >
            Descrever em texto
          </button>
        </div>

        {modo === 'arquivo' ? (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 min-h-[200px] border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/50 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.heic,.pdf"
              className="hidden"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
            {arquivo ? (
              <div className="text-center px-4">
                <FileText className="w-8 h-8 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">{arquivo.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(arquivo.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center px-4">
                  Arraste uma NF aqui ou clique para selecionar
                  <br />
                  <span className="text-xs">JPG, PNG, HEIC, PDF — máx 10MB</span>
                </p>
              </>
            )}
          </div>
        ) : (
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Descreva os itens da nota fiscal. Ex: 5kg Farinha de Trigo R$22,50 | 2L Azeite de Oliva R$45,00"
            className="flex-1 min-h-[200px] resize-none border border-border rounded-lg p-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {state === 'uploading' ? 'Enviando...' : 'Processando com IA...'}
            </>
          ) : (
            'Processar com IA'
          )}
        </button>
      </div>

      {/* Right zone — result */}
      <div className="flex-1 overflow-auto">
        {state === 'idle' && (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Camera className="w-12 h-12 opacity-30" />
            <p className="text-sm text-center">
              Envie uma foto, PDF ou descrição da Nota Fiscal
              <br />
              e a IA vai extrair e mapear os itens automaticamente.
            </p>
          </div>
        )}

        {(state === 'uploading' || state === 'processing') && (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <div className="space-y-2 text-center">
              <div className="h-4 bg-muted rounded animate-pulse w-48 mx-auto" />
              <div className="h-4 bg-muted rounded animate-pulse w-32 mx-auto" />
              <div className="h-4 bg-muted rounded animate-pulse w-40 mx-auto" />
            </div>
            <p className="text-sm text-muted-foreground">
              {state === 'uploading' ? 'Enviando arquivo...' : 'Claude está lendo a nota fiscal...'}
            </p>
          </div>
        )}

        {state === 'error' && (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <AlertCircle className="w-10 h-10 text-destructive" />
            <p className="text-sm text-destructive text-center max-w-xs">{erro}</p>
            <button
              onClick={resetar}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-md text-sm hover:bg-accent"
            >
              <RotateCcw className="w-4 h-4" />
              Tentar novamente
            </button>
          </div>
        )}

        {state === 'done' && dados && nfId && (
          <TabelaRevisaoNF
            nfId={nfId}
            dados={dados}
            onConfirmed={resetar}
          />
        )}
      </div>
    </div>
  )
}
