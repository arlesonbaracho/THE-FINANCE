'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, TrendingDown, Settings2, Info } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Alert = {
  id: string
  tipo: 'ESTOQUE' | 'FINANCEIRO' | 'OPERACIONAL' | 'SISTEMA'
  severidade: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAIXA' | 'INFO'
  titulo: string
  descricao: string
  status: 'NAO_LIDO' | 'LIDO' | 'RESOLVIDO' | 'IGNORADO'
  criadoEm: string
  metadata: Record<string, unknown>
}

const TIPO_ICON: Record<string, React.ReactNode> = {
  ESTOQUE: <AlertTriangle className="w-4 h-4" />,
  FINANCEIRO: <TrendingDown className="w-4 h-4" />,
  OPERACIONAL: <Settings2 className="w-4 h-4" />,
  SISTEMA: <Info className="w-4 h-4" />,
}

const SEV_COLOR: Record<string, string> = {
  CRITICA: 'var(--tf-red)',
  ALTA: '#f97316',
  MEDIA: '#eab308',
  BAIXA: 'var(--tf-txt3)',
  INFO: '#22c55e',
}

const STATUS_LABEL: Record<string, string> = {
  NAO_LIDO: 'Não lido',
  LIDO: 'Lido',
  RESOLVIDO: 'Resolvido',
  IGNORADO: 'Ignorado',
}

export default function AlertasPage() {
  const [tipo, setTipo] = useState('')
  const [status, setStatus] = useState('')
  const [busca, setBusca] = useState('')
  const [page, setPage] = useState(1)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['alertas', tipo, status, busca, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (tipo) params.set('tipo', tipo)
      if (status) params.set('status', status)
      if (busca) params.set('busca', busca)
      const r = await fetch(`/api/alertas?${params}`)
      if (!r.ok) throw new Error('Erro ao carregar alertas')
      return r.json() as Promise<{ items: Alert[]; total: number; pages: number }>
    },
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const r = await fetch(`/api/alertas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!r.ok) throw new Error('Erro ao atualizar status')
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alertas'] })
      qc.invalidateQueries({ queryKey: ['alerts-drawer'] })
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--tf-txt)', margin: 0 }}>
          Central de Alertas
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--tf-txt3)', marginTop: 3 }}>
          Histórico completo de alertas do sistema
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input
          placeholder="Buscar alertas..."
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-lg text-sm border"
          style={{
            background: 'var(--tf-surface)',
            borderColor: 'var(--tf-border)',
            color: 'var(--tf-txt)',
            minWidth: 220,
            outline: 'none',
          }}
        />
        <select
          value={tipo}
          onChange={(e) => { setTipo(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-lg text-sm border"
          style={{ background: 'var(--tf-surface)', borderColor: 'var(--tf-border)', color: 'var(--tf-txt)' }}
        >
          <option value="">Todos os tipos</option>
          <option value="ESTOQUE">Estoque</option>
          <option value="FINANCEIRO">Financeiro</option>
          <option value="OPERACIONAL">Operacional</option>
          <option value="SISTEMA">Sistema</option>
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-lg text-sm border"
          style={{ background: 'var(--tf-surface)', borderColor: 'var(--tf-border)', color: 'var(--tf-txt)' }}
        >
          <option value="">Todos os status</option>
          <option value="NAO_LIDO">Não lido</option>
          <option value="LIDO">Lido</option>
          <option value="RESOLVIDO">Resolvido</option>
          <option value="IGNORADO">Ignorado</option>
        </select>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {isLoading && (
          <p style={{ color: 'var(--tf-txt3)', fontSize: 13 }}>Carregando...</p>
        )}
        {!isLoading && data?.items.length === 0 && (
          <p style={{ color: 'var(--tf-txt3)', fontSize: 13 }}>Nenhum alerta encontrado.</p>
        )}
        {data?.items.map((alert) => (
          <div
            key={alert.id}
            className="rounded-lg p-4 flex items-start gap-3"
            style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)' }}
          >
            <span style={{ color: SEV_COLOR[alert.severidade] ?? 'var(--tf-txt3)', marginTop: 2, flexShrink: 0 }}>
              {TIPO_ICON[alert.tipo] ?? <Info className="w-4 h-4" />}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: 'var(--tf-txt)' }}>
                {alert.titulo}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--tf-txt3)' }}>
                {alert.descricao}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--tf-txt3)' }}>
                {formatDistanceToNow(new Date(alert.criadoEm), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
            <select
              value={alert.status}
              onChange={(e) =>
                updateStatus.mutate({ id: alert.id, newStatus: e.target.value })
              }
              className="text-xs px-2 py-1 rounded border flex-shrink-0"
              style={{
                background: 'var(--tf-surface2)',
                borderColor: 'var(--tf-border)',
                color: 'var(--tf-txt)',
              }}
            >
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      {/* Paginação */}
      {data && data.pages > 1 && (
        <div className="flex items-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40"
            style={{
              background: 'var(--tf-surface)',
              borderColor: 'var(--tf-border)',
              color: 'var(--tf-txt)',
              cursor: page === 1 ? 'not-allowed' : 'pointer',
            }}
          >
            Anterior
          </button>
          <span className="px-3 py-1.5 text-sm" style={{ color: 'var(--tf-txt3)' }}>
            {page} / {data.pages}
          </span>
          <button
            disabled={page === data.pages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-40"
            style={{
              background: 'var(--tf-surface)',
              borderColor: 'var(--tf-border)',
              color: 'var(--tf-txt)',
              cursor: page === data.pages ? 'not-allowed' : 'pointer',
            }}
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  )
}
