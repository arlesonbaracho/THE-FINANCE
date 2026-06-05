export interface KpiUnidade {
  tenantId: string
  tenantName: string
  cidade?: string
  totalVendas: number
  totalPedidos: number
  ticketMedio: number
  cmvPercentual: number
  alertasAtivos: number
  ativo: boolean
}

export interface KpisConsolidados {
  totalVendas: number
  totalPedidos: number
  ticketMedio: number
  cmvMedio: number
  melhorUnidade: KpiUnidade | null
  unidadeAlerta: KpiUnidade | null
  porUnidade: KpiUnidade[]
  variacaoVendas: number
  variacaoPedidos: number
}

export interface FiltroPeriodo {
  inicio: Date
  fim: Date
}

export interface BenchmarkUnidade {
  tenantId: string
  tenantName: string
  cmvPercent: number
  ticketMedio: number
  margemBruta: number
  liderCmv: boolean
  liderTicket: boolean
  liderMargem: boolean
  abaixoDaMedia: boolean
}

export interface BenchmarkData {
  unidades: BenchmarkUnidade[]
  mediaCmv: number
  mediaTicket: number
  mediaMargem: number
}
