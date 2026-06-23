'use client'

import { useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Download, FileArchive } from 'lucide-react'
import { Button } from '@/components/ui/button'

const S = {
  card: {
    background: 'var(--tf-surface)',
    border: '1px solid var(--tf-border)',
    borderRadius: 10,
    padding: 20,
  } as React.CSSProperties,
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--tf-txt2)',
    marginBottom: 6,
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '8px 10px',
    fontSize: 13,
    color: 'var(--tf-txt)',
    background: 'var(--tf-surface2)',
    border: '1px solid var(--tf-border)',
    borderRadius: 8,
  } as React.CSSProperties,
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

type Modo = 'mes' | 'intervalo'

export default function FiscalFechamentoPage() {
  const { data: session } = useSession()
  const role = session?.user?.role
  const podeExportar = role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'

  const hoje = useMemo(() => new Date(), [])
  const [modo, setModo] = useState<Modo>('mes')
  const [mes, setMes] = useState(hoje.getMonth())
  const [ano, setAno] = useState(hoje.getFullYear())
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [gerando, setGerando] = useState(false)

  const anos = useMemo(() => {
    const atual = hoje.getFullYear()
    return [atual, atual - 1, atual - 2, atual - 3, atual - 4]
  }, [hoje])

  function resolverPeriodo(): { inicio: Date; fim: Date } | null {
    if (modo === 'mes') {
      return { inicio: new Date(ano, mes, 1, 0, 0, 0), fim: new Date(ano, mes + 1, 0, 23, 59, 59) }
    }
    if (!inicio || !fim) {
      toast.error('Informe as datas de início e fim.')
      return null
    }
    const i = new Date(`${inicio}T00:00:00`)
    const f = new Date(`${fim}T23:59:59`)
    if (i > f) {
      toast.error('A data inicial deve ser anterior à final.')
      return null
    }
    return { inicio: i, fim: f }
  }

  async function gerar() {
    const periodo = resolverPeriodo()
    if (!periodo) return
    setGerando(true)
    try {
      const params = new URLSearchParams({ inicio: periodo.inicio.toISOString(), fim: periodo.fim.toISOString() })
      const r = await fetch(`/api/fiscal/fechamento?${params}`)
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        toast.error(err.error ?? 'Falha ao gerar o fechamento.')
        return
      }
      const blob = await r.blob()
      const cd = r.headers.get('Content-Disposition') ?? ''
      const nome = /filename="([^"]+)"/.exec(cd)?.[1] ?? 'fechamento-fiscal.zip'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = nome
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Fechamento gerado.')
    } catch {
      toast.error('Falha ao gerar o fechamento.')
    } finally {
      setGerando(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
      {/* Header */}
      <div>
        <h1 style={{ fontWeight: 700, fontSize: 22, margin: 0 }}>Fechamento Fiscal</h1>
        <p style={{ color: 'var(--tf-txt2)', fontSize: 13, margin: '4px 0 0' }}>
          Gere o pacote do contador: um ZIP com os XMLs das notas (entradas e saídas) e um relatório em Excel do período.
        </p>
      </div>

      {!podeExportar ? (
        <div style={S.card}>
          <p style={{ color: 'var(--tf-txt2)', fontSize: 13, margin: 0 }}>
            Você não tem permissão para gerar o fechamento fiscal. Fale com um administrador.
          </p>
        </div>
      ) : (
        <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Modo */}
          <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: 'var(--tf-surface2)', border: '1px solid var(--tf-border)', borderRadius: 10, alignSelf: 'flex-start' }}>
            {([['mes', 'Mês/ano'], ['intervalo', 'Intervalo']] as const).map(([k, label]) => {
              const ativo = modo === k
              return (
                <button
                  key={k}
                  onClick={() => setModo(k)}
                  style={{
                    padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13,
                    fontWeight: ativo ? 700 : 500,
                    background: ativo ? 'var(--tf-surface)' : 'transparent',
                    color: ativo ? 'var(--tf-primary)' : 'var(--tf-txt2)',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Seletores */}
          {modo === 'mes' ? (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={S.label}>Mês</label>
                <select style={S.input} value={mes} onChange={(e) => setMes(Number(e.target.value))}>
                  {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label style={S.label}>Ano</label>
                <select style={S.input} value={ano} onChange={(e) => setAno(Number(e.target.value))}>
                  {anos.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={S.label}>Início</label>
                <input type="date" style={S.input} value={inicio} onChange={(e) => setInicio(e.target.value)} />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={S.label}>Fim</label>
                <input type="date" style={S.input} value={fim} onChange={(e) => setFim(e.target.value)} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button onClick={gerar} disabled={gerando} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {gerando ? <FileArchive size={14} /> : <Download size={14} />}
              {gerando ? 'Gerando…' : 'Gerar fechamento'}
            </Button>
            <span style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>
              Inclui notas autorizadas, capturadas e canceladas com XML.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
