export type NotaDestinada = {
  chaveAcesso: string
  numero: string
  emitenteNome: string
  valorTotal: number
  dataEmissao: Date
  modelo: string
}

export interface FiscalProvider {
  registrarEmitente(params: { cnpj: string; certificadoBase64: string; senha: string }): Promise<{ focusEmpresaId: string; validade: Date | null }>
  consultarNotasDestinadas(params: { cnpj: string; desde?: Date }): Promise<NotaDestinada[]>
  baixarXml(chaveAcesso: string): Promise<string>
}
