import { describe, it, expect } from 'vitest'
import { montarPayloadNfce } from '../nfce-payload'

const base = {
  cnpjEmitente: '11222333000181',
  fiscal: { ncmPadrao: '21069090', cfopPadrao: '5102', cstCsosnPadrao: '102', origemMercadoriaPadrao: '0', serie: 1, numero: 7 },
  pedido: {
    total: 30,
    itens: [
      { nome: 'X-Burger', quantidade: 2, precoUnitario: 10 },
      { nome: 'Refri', quantidade: 1, precoUnitario: 10, ncm: '22021000', cfop: '5405' },
    ],
    pagamentos: [{ formaPagamento: 'PIX', valor: 30 }],
  },
}

describe('montarPayloadNfce', () => {
  it('usa override do item quando presente, senão o padrão do tenant', () => {
    const p: any = montarPayloadNfce(base as any)
    expect(p.items[0].ncm).toBe('21069090')
    expect(p.items[1].ncm).toBe('22021000')
    expect(p.items[1].cfop).toBe('5405')
    expect(p.items[0].cfop).toBe('5102')
  })
  it('mapeia série/número e total', () => {
    const p: any = montarPayloadNfce(base as any)
    expect(p.serie).toBe(1)
    expect(p.numero).toBe(7)
    expect(p.valor_total).toBe(30)
  })
  it('mapeia formas de pagamento', () => {
    const p: any = montarPayloadNfce(base as any)
    expect(p.formas_pagamento[0].valor_pagamento).toBe(30)
  })
})
