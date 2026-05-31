export interface ItemExtraido {
  descricao: string
  quantidade: number
  unidade: string
  custoUnitario: number
  custoTotal: number
}

export interface ItemEnriquecido extends ItemExtraido {
  insumoId: string | null
  insumoNome: string | null
  scoreConfianca: number
}

export interface NfExtraidaData {
  fornecedor: string | null
  numeroNf: string | null
  dataEmissao: string | null
  valorTotal: number | null
  itens: ItemExtraido[]
}
