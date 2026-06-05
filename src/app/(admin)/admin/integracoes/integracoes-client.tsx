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

  const th: React.CSSProperties = {
    textAlign: 'left',
    padding: '10px 16px',
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--tf-txt3)',
    borderBottom: '1px solid var(--tf-border)',
  }
  const td: React.CSSProperties = {
    padding: '10px 16px',
    fontSize: 13,
    color: 'var(--tf-txt)',
    borderBottom: '1px solid var(--tf-border)',
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 24, marginTop: 0 }}>
        Integrações
      </h1>

      <div
        style={{
          background: 'var(--tf-surface)',
          border: '1px solid var(--tf-border)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Tenant', 'iFood', 'WhatsApp', 'Última atividade', ''].map((col) => (
                <th key={col} style={th}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <>
                <tr
                  key={t.id}
                  onClick={() => setExpandido(expandido === t.id ? null : t.id)}
                  style={{
                    cursor: 'pointer',
                    background:
                      expandido === t.id
                        ? 'var(--tf-surface-hover, rgba(0,0,0,0.03))'
                        : 'transparent',
                  }}
                >
                  <td style={td}>{t.name}</td>
                  <td style={td}>
                    <span
                      style={{
                        fontSize: 11,
                        background: STATUS_COLOR[t.ifoodIntegracao?.status ?? 'DESCONECTADO'],
                        color: '#fff',
                        borderRadius: 4,
                        padding: '2px 8px',
                      }}
                    >
                      {t.ifoodIntegracao?.status ?? 'DESCONECTADO'}
                    </span>
                  </td>
                  <td style={td}>
                    <span
                      style={{
                        fontSize: 11,
                        background: t.whatsappContatos.length > 0 ? '#10b981' : '#6b7280',
                        color: '#fff',
                        borderRadius: 4,
                        padding: '2px 8px',
                      }}
                    >
                      {t.whatsappContatos.length > 0 ? 'CONECTADO' : 'DESCONECTADO'}
                    </span>
                  </td>
                  <td style={{ ...td, fontSize: 12, color: 'var(--tf-txt3)' }}>
                    {t.ifoodIntegracao?.ultimaSincronizacao
                      ? new Date(t.ifoodIntegracao.ultimaSincronizacao).toLocaleString('pt-BR')
                      : '—'}
                  </td>
                  <td style={td}>
                    {expandido === t.id ? (
                      <ChevronUp className="w-4 h-4" style={{ color: 'var(--tf-txt3)' }} />
                    ) : (
                      <ChevronDown className="w-4 h-4" style={{ color: 'var(--tf-txt3)' }} />
                    )}
                  </td>
                </tr>
                {expandido === t.id && (
                  <tr key={`${t.id}-detail`}>
                    <td
                      colSpan={5}
                      style={{
                        padding: '16px 24px',
                        background: 'var(--tf-surface-hover, rgba(0,0,0,0.03))',
                        borderBottom: '1px solid var(--tf-border)',
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                        {/* iFood */}
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tf-txt3)', marginBottom: 8 }}>
                            iFood
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--tf-txt)', marginBottom: 4 }}>
                            Merchant ID: {t.ifoodIntegracao?.merchantId ?? '—'}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--tf-txt)', marginBottom: 12 }}>
                            Última sync:{' '}
                            {t.ifoodIntegracao?.ultimaSincronizacao
                              ? new Date(t.ifoodIntegracao.ultimaSincronizacao).toLocaleString('pt-BR')
                              : '—'}
                          </div>
                          {t.ifoodIntegracao?.status === 'CONECTADO' && (
                            <button
                              onClick={() => desconectar(t.id, 'ifood')}
                              style={{
                                fontSize: 12,
                                padding: '5px 12px',
                                borderRadius: 6,
                                border: '1px solid #ef4444',
                                background: 'transparent',
                                color: '#ef4444',
                                cursor: 'pointer',
                              }}
                            >
                              Forçar desconexão iFood
                            </button>
                          )}
                        </div>
                        {/* WhatsApp */}
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tf-txt3)', marginBottom: 8 }}>
                            WhatsApp
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--tf-txt)', marginBottom: 12 }}>
                            Último envio:{' '}
                            {t.whatsappContatos[0]?.updatedAt
                              ? new Date(t.whatsappContatos[0].updatedAt).toLocaleString('pt-BR')
                              : '—'}
                          </div>
                          {t.whatsappContatos.length > 0 && (
                            <button
                              onClick={() => desconectar(t.id, 'whatsapp')}
                              style={{
                                fontSize: 12,
                                padding: '5px 12px',
                                borderRadius: 6,
                                border: '1px solid #ef4444',
                                background: 'transparent',
                                color: '#ef4444',
                                cursor: 'pointer',
                              }}
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
                <td
                  colSpan={5}
                  style={{ ...td, textAlign: 'center', color: 'var(--tf-txt3)', padding: 32 }}
                >
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
