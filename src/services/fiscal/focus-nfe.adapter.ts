import type { FiscalProvider, NotaDestinada, NfcePayload, NfceResultado } from './fiscal-provider.types'

const MODELO_MAP: Record<string, string> = { '55': 'NFe', '65': 'NFCe' }

function baseUrl(): string {
  return process.env.FOCUS_NFE_BASE_URL ?? 'https://homologacao.focusnfe.com.br'
}
function authHeader(): string {
  const token = process.env.FOCUS_NFE_TOKEN
  if (!token) throw new Error('FOCUS_NFE_TOKEN ausente')
  return 'Basic ' + Buffer.from(`${token}:`).toString('base64')
}

function mapNfce(o: Record<string, unknown>): NfceResultado {
  const raw = String(o.status ?? '')
  const status: NfceResultado['status'] =
    raw === 'autorizado' ? 'autorizado'
    : raw === 'cancelado' ? 'cancelado'
    : raw === 'processando_autorizacao' ? 'processando'
    : 'erro'
  return {
    status,
    chaveAcesso: o.chave_nfe ? String(o.chave_nfe) : undefined,
    danfeUrl: o.caminho_danfe ? String(o.caminho_danfe) : undefined,
    xml: o.caminho_xml_nota_fiscal ? String(o.caminho_xml_nota_fiscal) : undefined,
    protocolo: o.protocolo ? String(o.protocolo) : undefined,
    motivo: o.mensagem_sefaz ? String(o.mensagem_sefaz) : (o.erros ? JSON.stringify(o.erros) : undefined),
  }
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
      dataEmissao: o.data_emissao != null ? new Date(String(o.data_emissao)) : new Date(),
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

  async emitirNfce(ref: string, payload: NfcePayload): Promise<NfceResultado> {
    const res = await fetch(`${baseUrl()}/v2/nfce?ref=${encodeURIComponent(ref)}`, {
      method: 'POST',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok && res.status >= 500) throw new Error(`Focus NFCe emitir falhou: ${res.status}`)
    return mapNfce((await res.json()) as Record<string, unknown>)
  }

  async consultarNfce(ref: string): Promise<NfceResultado> {
    const res = await fetch(`${baseUrl()}/v2/nfce/${encodeURIComponent(ref)}`, { headers: { Authorization: authHeader() } })
    if (!res.ok && res.status >= 500) throw new Error(`Focus NFCe consultar falhou: ${res.status}`)
    return mapNfce((await res.json()) as Record<string, unknown>)
  }

  async cancelarNfce(ref: string, justificativa: string): Promise<NfceResultado> {
    const res = await fetch(`${baseUrl()}/v2/nfce/${encodeURIComponent(ref)}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ justificativa }),
    })
    if (!res.ok && res.status >= 500) throw new Error(`Focus NFCe cancelar falhou: ${res.status}`)
    return mapNfce((await res.json()) as Record<string, unknown>)
  }
}
