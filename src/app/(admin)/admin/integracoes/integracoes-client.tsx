'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface Tenant {
  id: string
  name: string
  ifoodIntegracao: { status: string; merchantId: string; ultimaSincronizacao: string | null } | null
  whatsappContatos: Array<{ updatedAt: string }>
}

const STATUS_COLOR: Record<string, string> = {
  CONECTADO: '#10b981',
  DESCONECTADO: '#6b7280',
  ERRO: '#ef4444',
}

export function IntegracoesClient() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [expandido, setExpandido] = useState<string | null>(null)

  async function carregar() {
    const d = await fetch('/api/admin/integracoes').then((r) => r.json())
    setTenants(Array.isArray(d) ? d : [])
  }

  useEffect(() => { carregar() }, [])

  async function desconectar(tenantId: string, integracao: 'ifood' | 'whatsapp') {
    const label = integracao === 'ifood' ? 'iFood' : 'WhatsApp'
    if (!confirm(`Forçar desconexão do ${label} para este tenant?`)) return
    await fetch(`/api/admin/integracoes/${tenantId}/desconectar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ integracao }),
    })
    carregar()
  }

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold text-white">Integrações</h1>

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/80">
            <tr>
              {['Tenant', 'iFood', 'WhatsApp', 'Última atividade', ''].map((col) => (
                <th key={col} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-800">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {tenants.map((t) => (
              <>
                <tr
                  key={t.id}
                  onClick={() => setExpandido(expandido === t.id ? null : t.id)}
                  className={`cursor-pointer transition-colors ${expandido === t.id ? 'bg-slate-800/40' : 'bg-[#0a0d14] hover:bg-slate-800/20'}`}
                >
                  <td className="px-4 py-2.5 text-sm text-white">{t.name}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className="rounded px-2 py-0.5 text-[11px] font-semibold text-white"
                      style={{ background: STATUS_COLOR[t.ifoodIntegracao?.status ?? 'DESCONECTADO'] }}
                    >
                      {t.ifoodIntegracao?.status ?? 'DESCONECTADO'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="rounded px-2 py-0.5 text-[11px] font-semibold text-white"
                      style={{ background: t.whatsappContatos.length > 0 ? '#10b981' : '#6b7280' }}
                    >
                      {t.whatsappContatos.length > 0 ? 'CONECTADO' : 'DESCONECTADO'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">
                    {t.ifoodIntegracao?.ultimaSincronizacao
                      ? new Date(t.ifoodIntegracao.ultimaSincronizacao).toLocaleString('pt-BR')
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">
                    {expandido === t.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </td>
                </tr>
                {expandido === t.id && (
                  <tr key={`${t.id}-detail`}>
                    <td colSpan={5} className="px-6 py-4 bg-slate-800/20 border-b border-slate-800">
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-xs font-semibold text-slate-400 mb-2">iFood</p>
                          <p className="text-sm text-white mb-1">Merchant ID: {t.ifoodIntegracao?.merchantId ?? '—'}</p>
                          <p className="text-sm text-white mb-3">
                            Última sync:{' '}
                            {t.ifoodIntegracao?.ultimaSincronizacao
                              ? new Date(t.ifoodIntegracao.ultimaSincronizacao).toLocaleString('pt-BR')
                              : '—'}
                          </p>
                          {t.ifoodIntegracao?.status === 'CONECTADO' && (
                            <button
                              onClick={() => desconectar(t.id, 'ifood')}
                              className="rounded-md border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              Forçar desconexão iFood
                            </button>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-400 mb-2">WhatsApp</p>
                          <p className="text-sm text-white mb-3">
                            Último envio:{' '}
                            {t.whatsappContatos[0]?.updatedAt
                              ? new Date(t.whatsappContatos[0].updatedAt).toLocaleString('pt-BR')
                              : '—'}
                          </p>
                          {t.whatsappContatos.length > 0 && (
                            <button
                              onClick={() => desconectar(t.id, 'whatsapp')}
                              className="rounded-md border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              Forçar desconexão WhatsApp
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm bg-[#0a0d14]">
                  Nenhum tenant encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
