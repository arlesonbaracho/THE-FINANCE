'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

type AlertConfig = {
  id: string
  tipoAlerta: string
  ativo: boolean
  threshold: Record<string, number>
  canais: { sistema: boolean; email: string[]; whatsapp: string[] }
  horarioSilencioInicio: string | null
  horarioSilencioFim: string | null
}

const TIPO_LABELS: Record<string, string> = {
  ESTOQUE: 'Alertas de Estoque',
  FINANCEIRO: 'Alertas Financeiros',
  OPERACIONAL: 'Alertas Operacionais',
}

const TIPO_DESCRIPTIONS: Record<string, string> = {
  ESTOQUE: 'Insumos zerados, abaixo do mínimo, próximos do vencimento.',
  FINANCEIRO: 'CMV elevado, queda de vendas, metas e ticket médio.',
  OPERACIONAL: 'Pedidos parados na cozinha e volume de cancelamentos.',
}

function ConfigCard({
  tipoAlerta,
  config,
  onSave,
}: {
  tipoAlerta: string
  config: AlertConfig | null
  onSave: (id: string, data: Partial<AlertConfig>) => void
}) {
  const [ativo, setAtivo] = useState(config?.ativo ?? true)
  const [silencioInicio, setSilencioInicio] = useState(config?.horarioSilencioInicio ?? '')
  const [silencioFim, setSilencioFim] = useState(config?.horarioSilencioFim ?? '')

  const isDirty =
    ativo !== (config?.ativo ?? true) ||
    silencioInicio !== (config?.horarioSilencioInicio ?? '') ||
    silencioFim !== (config?.horarioSilencioFim ?? '')

  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)' }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold" style={{ color: 'var(--tf-txt)', fontSize: 15 }}>
            {TIPO_LABELS[tipoAlerta] ?? tipoAlerta}
          </h2>
          <p style={{ fontSize: 12, color: 'var(--tf-txt3)', marginTop: 2 }}>
            {TIPO_DESCRIPTIONS[tipoAlerta]}
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
          <span style={{ fontSize: 13, color: 'var(--tf-txt3)' }}>
            {ativo ? 'Ativo' : 'Inativo'}
          </span>
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            className="w-4 h-4 accent-green-600"
          />
        </label>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--tf-txt3)' }}>
            Silêncio — início
          </label>
          <input
            type="time"
            value={silencioInicio}
            onChange={(e) => setSilencioInicio(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm border"
            style={{
              background: 'var(--tf-surface2)',
              borderColor: 'var(--tf-border)',
              color: 'var(--tf-txt)',
            }}
          />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--tf-txt3)' }}>
            Silêncio — fim
          </label>
          <input
            type="time"
            value={silencioFim}
            onChange={(e) => setSilencioFim(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm border"
            style={{
              background: 'var(--tf-surface2)',
              borderColor: 'var(--tf-border)',
              color: 'var(--tf-txt)',
            }}
          />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <span
          className="text-xs px-2 py-1 rounded"
          style={{ background: 'var(--tf-surface2)', color: 'var(--tf-txt3)' }}
        >
          Sistema: sempre ativo
        </span>
        <span
          className="text-xs px-2 py-1 rounded opacity-50 cursor-not-allowed"
          style={{ background: 'var(--tf-surface2)', color: 'var(--tf-txt3)' }}
          title="Disponível na Fase 3"
        >
          WhatsApp: Fase 3
        </span>
      </div>

      {config?.id && isDirty && (
        <button
          onClick={() =>
            onSave(config.id, {
              ativo,
              horarioSilencioInicio: silencioInicio || null,
              horarioSilencioFim: silencioFim || null,
            })
          }
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: 'var(--tf-green)' }}
        >
          Salvar alterações
        </button>
      )}
      {!config?.id && (
        <p style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>
          Configure os alertas salvos pelo sistema para habilitar ajustes.
        </p>
      )}
    </div>
  )
}

export default function ConfiguracoesAlertasPage() {
  const qc = useQueryClient()

  const { data: configs = [], isLoading } = useQuery<AlertConfig[]>({
    queryKey: ['alert-configs'],
    queryFn: () => fetch('/api/alert-configs').then((r) => r.json()),
  })

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AlertConfig> }) => {
      const r = await fetch(`/api/alert-configs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!r.ok) throw new Error('Erro ao salvar')
    },
    onSuccess: () => {
      toast.success('Configuração salva')
      qc.invalidateQueries({ queryKey: ['alert-configs'] })
    },
    onError: () => toast.error('Erro ao salvar configuração'),
  })

  const TIPOS = ['ESTOQUE', 'FINANCEIRO', 'OPERACIONAL']

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--tf-txt)', margin: 0 }}>
          Configurações de Alertas
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--tf-txt3)', marginTop: 3 }}>
          Configure quando e como receber alertas do sistema
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 rounded-xl animate-pulse"
              style={{ background: 'var(--tf-surface2)' }}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {TIPOS.map((tipo) => {
            const config = configs.find((c) => c.tipoAlerta === tipo) ?? null
            return (
              <ConfigCard
                key={tipo}
                tipoAlerta={tipo}
                config={config}
                onSave={(id, data) => saveMutation.mutate({ id, data })}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
