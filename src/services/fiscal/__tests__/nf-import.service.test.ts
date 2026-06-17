import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/ai/nf-processor.service', () => ({ enriquecerItens: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { nfProcessada: { findFirst: vi.fn() } } }))

import { prepararImportacao, parseItensNfe } from '../nf-import.service'
import { enriquecerItens } from '@/services/ai/nf-processor.service'
import { prisma } from '@/lib/prisma'

const mp = prisma as any

beforeEach(() => {
  vi.clearAllMocks()
  mp.nfProcessada.findFirst.mockResolvedValue({
    id: 'nf1', tenantId: 't1',
    xml: '<nfeProc><NFe><infNFe><det><prod><xProd>ARROZ TIPO 1</xProd><qCom>10</qCom><uCom>KG</uCom><vUnCom>5.00</vUnCom></prod></det></infNFe></NFe></nfeProc>',
  })
  ;(enriquecerItens as any).mockResolvedValue([{ descricao: 'ARROZ TIPO 1', quantidade: 10, unidade: 'KG', custoUnitario: 5, custoTotal: 50, insumoId: 'ing1', insumoNome: 'Arroz', scoreConfianca: 95 }])
})

describe('parseItensNfe', () => {
  it('extrai itens dos blocos <prod> do XML', () => {
    const itens = parseItensNfe('<det><prod><xProd>FEIJAO</xProd><qCom>3</qCom><uCom>KG</uCom><vUnCom>8.00</vUnCom></prod></det>')
    expect(itens).toHaveLength(1)
    expect(itens[0]).toMatchObject({ descricao: 'FEIJAO', quantidade: 3, unidade: 'KG', custoUnitario: 8 })
    expect(itens[0].custoTotal).toBe(24)
  })
  it('mapeia unidade desconhecida para UN', () => {
    const itens = parseItensNfe('<prod><xProd>X</xProd><qCom>1</qCom><uCom>CX</uCom><vUnCom>2</vUnCom></prod>')
    expect(itens[0].unidade).toBe('UN')
  })
})

describe('prepararImportacao', () => {
  it('extrai itens do XML e devolve o de-para enriquecido', async () => {
    const r = await prepararImportacao('t1', 'nf1')
    expect(enriquecerItens).toHaveBeenCalledWith('t1', expect.arrayContaining([
      expect.objectContaining({ descricao: 'ARROZ TIPO 1', quantidade: 10, unidade: 'KG' }),
    ]))
    expect(r.itens[0].insumoId).toBe('ing1')
  })
  it('lança erro se a NF não tem XML', async () => {
    mp.nfProcessada.findFirst.mockResolvedValue({ id: 'nf1', tenantId: 't1', xml: null })
    await expect(prepararImportacao('t1', 'nf1')).rejects.toThrow()
  })
})
