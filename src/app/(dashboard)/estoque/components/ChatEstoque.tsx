'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2 } from 'lucide-react'

interface Mensagem {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

interface AiUsageInfo {
  tokensInput: number
  tokensOutput: number
  limiteTokens: number
}

export function ChatEstoque() {
  const [aberto, setAberto] = useState(false)
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [usage, setUsage] = useState<AiUsageInfo | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return

    // Carrega uso de tokens e histórico de conversas ao abrir
    Promise.all([
      fetch('/api/ai/usage').then((r) => r.json() as Promise<AiUsageInfo>),
      fetch('/api/ai/chat-historico').then((r) =>
        r.json() as Promise<Array<{ role: string; content: string }>>
      ),
    ])
      .then(([usageData, historyData]) => {
        setUsage(usageData)
        if (Array.isArray(historyData) && historyData.length > 0) {
          setMensagens(
            historyData.map((msg) => ({
              role: msg.role === 'USER' ? ('user' as const) : ('assistant' as const),
              content: msg.content,
            }))
          )
        }
      })
      .catch(() => {/* non-critical */})
  }, [aberto])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  const limiteBloqueado =
    usage !== null && usage.limiteTokens > 0 &&
    usage.tokensInput + usage.tokensOutput >= usage.limiteTokens

  const percentualUso =
    usage && usage.limiteTokens > 0
      ? Math.min(Math.round(((usage.tokensInput + usage.tokensOutput) / usage.limiteTokens) * 100), 100)
      : 0

  async function enviar() {
    const texto = input.trim()
    if (!texto || streaming || limiteBloqueado) return

    setInput('')
    setMensagens((prev) => [...prev, { role: 'user', content: texto }])
    setStreaming(true)
    setMensagens((prev) => [...prev, { role: 'assistant', content: '', streaming: true }])

    const source = new EventSource(`/api/ai/chat-estoque?mensagem=${encodeURIComponent(texto)}`)

    source.onmessage = (e) => {
      if (e.data === '[DONE]') {
        source.close()
        setStreaming(false)
        setMensagens((prev) =>
          prev.map((m, i) => (i === prev.length - 1 ? { ...m, streaming: false } : m))
        )
        return
      }

      try {
        const { text, erro } = JSON.parse(e.data as string) as { text?: string; erro?: string }
        if (erro) {
          source.close()
          setStreaming(false)
          setMensagens((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: erro, streaming: false } : m
            )
          )
          return
        }
        if (text) {
          setMensagens((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: m.content + text } : m
            )
          )
        }
      } catch { /* ignore parse errors */ }
    }

    source.onerror = () => {
      source.close()
      setStreaming(false)
    }
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
        title="Assistente de estoque"
      >
        <MessageCircle className="w-5 h-5" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[520px] bg-background border border-border rounded-xl shadow-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Assistente de Estoque</span>
        </div>
        <button
          onClick={() => setAberto(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {mensagens.length === 0 && (
          <div className="mt-6 space-y-2">
            <p className="text-xs text-muted-foreground text-center font-medium">
              Pergunte ou peça ações ao assistente:
            </p>
            {[
              '📦 "Cria um insumo Farinha de Trigo, KG, R$4,50"',
              '🍕 "Cria um produto Pizza Margherita por R$35"',
              '📥 "Registra entrada de 10kg de açúcar"',
              '❓ "Quais insumos estão abaixo do mínimo?"',
            ].map((hint) => (
              <button
                key={hint}
                onClick={() => setInput(hint.replace(/^[^\s]+ /, '').replace(/"/g, ''))}
                className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                {hint}
              </button>
            ))}
          </div>
        )}
        {mensagens.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              {msg.content}
              {msg.streaming && (
                <span className="inline-block w-1 h-4 bg-current ml-0.5 animate-pulse" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div className="border-t border-border p-3 space-y-2">
        {limiteBloqueado ? (
          <p className="text-xs text-destructive text-center">
            Limite mensal de IA atingido. Disponível no próximo mês.
          </p>
        ) : (
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void enviar()}
              placeholder="Pergunte ou peça para criar insumos/produtos..."
              disabled={streaming}
              className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            <button
              onClick={() => void enviar()}
              disabled={!input.trim() || streaming}
              className="w-8 h-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center disabled:opacity-50"
            >
              {streaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
        {usage && usage.limiteTokens > 0 && (
          <div className="space-y-1">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  percentualUso >= 100
                    ? 'bg-destructive'
                    : percentualUso >= 80
                    ? 'bg-yellow-500'
                    : 'bg-primary'
                }`}
                style={{ width: `${percentualUso}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-right">
              {percentualUso}% do limite mensal usado
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
