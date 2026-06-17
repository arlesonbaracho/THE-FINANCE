import type { FiscalProvider, NotaDestinada } from './fiscal-provider.types'

const MODELO_MAP: Record<string, string> = { '55': 'NFe', '65': 'NFCe' }

function baseUrl(): string {
  return process.env.FOCUS_NFE_BASE_URL ?? 'https://homologacao.focusnfe.com.br'
}
function authHeader(): string {
  const token = process.env.FOCUS_NFE_TOKEN
  if (!token) throw new Error('FOCUS_NFE_TOKEN ausente')
  return 'Basic ' + Buffer.from(`${token}:`).toString('base64')
}

export class FocusNfeAdapter implements FiscalProvider {
  async consultarNotasDestinadas({ cnpj, desde }: { cnpj: string; desde?: Date }): Promise<NotaDestinada[]> {
    const params = new URLSearchParams({ cnpj })
    if (desde) params.set('data_inicial', desde.toISOString().slice(0, 10))
    const res = await fetch(`${baseUrl()}/v2/nfes_recebidas?${params.toString()}`, {
      headers: { Authorization: authHeader() },
    })
    if (!res.ok) throw new Error(`Focus NFe consultarNotasDestinadas falhou: ${res.status}`)
    const arr = (await res.json()) as Array<Record<string, unknown>>
    return arr.map((o) => ({
      chaveAcesso: String(o.chave_nfe ?? ''),
      numero: String(o.numero ?? ''),
      emitenteNome: String(o.nome_emitente ?? ''),
      valorTotal: Number(o.valor_total ?? 0),
      dataEmissao: new Date(String(o.data_emissao ?? Date.now())),
      modelo: MODELO_MAP[String(o.modelo ?? '55')] ?? 'NFe',
    }))
  }

  async baixarXml(chaveAcesso: string): Promise<string> {
    const res = await fetch(`${baseUrl()}/v2/nfes_recebidas/${chaveAcesso}.xml`, {
      headers: { Authorization: authHeader() },
    })
    if (!res.ok) throw new Error(`Focus NFe baixarXml falhou: ${res.status}`)
    return await res.text()
  }

  async registrarEmitente({ cnpj, certificadoBase64, senha }: { cnpj: string; certificadoBase64: string; senha: string }): Promise<{ focusEmpresaId: string; validade: Date | null }> {
    const res = await fetch(`${baseUrl()}/v2/empresas`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ cnpj, arquivo_certificado_base64: certificadoBase64, senha_certificado: senha }),
    })
    if (!res.ok) throw new Error(`Focus NFe registrarEmitente falhou: ${res.status}`)
    const o = (await res.json()) as Record<string, unknown>
    return {
      focusEmpresaId: String(o.id ?? cnpj),
      validade: o.certificado_valido_ate ? new Date(String(o.certificado_valido_ate)) : null,
    }
  }
}
