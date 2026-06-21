import type { NfcePayload } from './fiscal-provider.types'

export type ItemPedidoFiscal = {
  nome: string; quantidade: number; precoUnitario: number
  ncm?: string; cfop?: string; cstCsosn?: string; origemMercadoria?: string; unidadeTributavel?: string
}
export type TenantFiscalDefaults = {
  ncmPadrao?: string; cfopPadrao?: string; cstCsosnPadrao?: string; origemMercadoriaPadrao?: string
  serie: number; numero: number
}
export type PayloadInput = {
  pedido: { total: number; itens: ItemPedidoFiscal[]; pagamentos: { formaPagamento: string; valor: number }[] }
  fiscal: TenantFiscalDefaults
  cnpjEmitente: string
}

const FORMA_MAP: Record<string, string> = { DINHEIRO: '01', CREDITO: '03', DEBITO: '04', PIX: '17' }

export function montarPayloadNfce(input: PayloadInput): NfcePayload {
  const { pedido, fiscal, cnpjEmitente } = input
  const items = pedido.itens.map((it, i) => ({
    numero_item: i + 1,
    descricao: it.nome,
    quantidade_comercial: it.quantidade,
    valor_unitario_comercial: it.precoUnitario,
    valor_bruto: Math.round(it.quantidade * it.precoUnitario * 100) / 100,
    ncm: it.ncm ?? fiscal.ncmPadrao,
    cfop: it.cfop ?? fiscal.cfopPadrao,
    codigo_situacao_tributaria: it.cstCsosn ?? fiscal.cstCsosnPadrao,
    origem: it.origemMercadoria ?? fiscal.origemMercadoriaPadrao,
    unidade_comercial: it.unidadeTributavel ?? 'UN',
  }))
  return {
    cnpj_emitente: cnpjEmitente,
    serie: fiscal.serie,
    numero: fiscal.numero,
    valor_total: pedido.total,
    formas_pagamento: pedido.pagamentos.map((p) => ({
      forma_pagamento: FORMA_MAP[p.formaPagamento] ?? '99',
      valor_pagamento: p.valor,
    })),
    items,
  }
}
