export type NotaDestinada = {
  chaveAcesso: string
  numero: string
  emitenteNome: string
  valorTotal: number
  dataEmissao: Date
  modelo: string
}

export type NfcePayload = Record<string, unknown>
export type NfceResultado = {
  status: 'autorizado' | 'processando' | 'erro' | 'cancelado'
  chaveAcesso?: string
  danfeUrl?: string
  xml?: string
  protocolo?: string
  motivo?: string
}

export interface FiscalProvider {
  registrarEmitente(params: { cnpj: string; certificadoBase64: string; senha: string }): Promise<{ focusEmpresaId: string; validade: Date | null }>
  consultarNotasDestinadas(params: { cnpj: string; desde?: Date }): Promise<NotaDestinada[]>
  baixarXml(chaveAcesso: string): Promise<string>
  emitirNfce(ref: string, payload: NfcePayload): Promise<NfceResultado>
  consultarNfce(ref: string): Promise<NfceResultado>
  cancelarNfce(ref: string, justificativa: string): Promise<NfceResultado>
}
