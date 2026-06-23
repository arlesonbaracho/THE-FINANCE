export type ConsentDocumento = 'POLITICA' | 'TERMOS'

export const POLITICA_VERSAO = '2026-06-22'
export const TERMOS_VERSAO = '2026-06-22'

export const DPO_CONTATO = { nome: 'Encarregado de Dados (DPO)', email: 'dpo@thefinance.app' }

export const DOCUMENTOS_VIGENTES: { documento: ConsentDocumento; versao: string }[] = [
  { documento: 'POLITICA', versao: POLITICA_VERSAO },
  { documento: 'TERMOS', versao: TERMOS_VERSAO },
]

/** true se faltar aceitar algum documento vigente ou se a maior versão aceita for menor que a vigente. */
export function precisaReconsentir(
  aceitas: { documento: ConsentDocumento; versao: string }[],
  vigentes = DOCUMENTOS_VIGENTES,
): boolean {
  return vigentes.some((v) => {
    const maiorAceita = aceitas
      .filter((a) => a.documento === v.documento)
      .map((a) => a.versao)
      .sort()
      .at(-1)
    return maiorAceita == null || maiorAceita < v.versao
  })
}
