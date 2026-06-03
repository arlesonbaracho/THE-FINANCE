import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/bullmq', () => ({
  redisConnection: {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  },
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    ingredient: { findMany: vi.fn(), create: vi.fn() },
    product: { create: vi.fn() },
    productIngredient: { createMany: vi.fn() },
    ingredientMovement: { create: vi.fn() },
    whatsAppLog: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(),
  },
}))
vi.mock('../evolution.service', () => ({
  enviarMensagem: vi.fn().mockResolvedValue(true),
}))

const mockGenerateContent = vi.fn()
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(function () {
    return {
      getGenerativeModel: vi.fn(() => ({ generateContent: mockGenerateContent })),
    }
  }),
}))

import { interpretarComando, processarConfirmacao } from '../whatsapp-bot.service'
import { redisConnection } from '@/lib/bullmq'
import { prisma } from '@/lib/prisma'
import { enviarMensagem } from '../evolution.service'

const redis = redisConnection as {
  get: ReturnType<typeof vi.fn>
  set: ReturnType<typeof vi.fn>
  del: ReturnType<typeof vi.fn>
}
const db = prisma as {
  ingredient: { findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
  product: { create: ReturnType<typeof vi.fn> }
  productIngredient: { createMany: ReturnType<typeof vi.fn> }
  ingredientMovement: { create: ReturnType<typeof vi.fn> }
  whatsAppLog: { create: ReturnType<typeof vi.fn> }
  $transaction: ReturnType<typeof vi.fn>
}
const enviar = enviarMensagem as ReturnType<typeof vi.fn>

function geminiReturns(json: object) {
  mockGenerateContent.mockResolvedValue({ response: { text: () => JSON.stringify(json) } })
}

describe('interpretarComando', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends help menu for DESCONHECIDO intent', async () => {
    geminiReturns({ intencao: 'DESCONHECIDO', dados: {}, camposFaltando: [] })
    await interpretarComando('t1', '+5511', 'blá')
    expect(enviar).toHaveBeenCalledWith('+5511', expect.stringContaining('Não entendi'), 't1')
    expect(redis.set).not.toHaveBeenCalled()
  })

  it('asks for missing fields without saving session', async () => {
    geminiReturns({ intencao: 'NOVO_INSUMO', dados: { nome: 'Sal', unidade: 'KG', custoUnitario: 0 }, camposFaltando: ['custoUnitario'] })
    await interpretarComando('t1', '+5511', 'Novo insumo: Sal, kg')
    expect(redis.set).not.toHaveBeenCalled()
    expect(enviar).toHaveBeenCalledWith('+5511', expect.stringContaining('custoUnitario'), 't1')
  })

  it('saves session and sends confirmation for NOVO_INSUMO', async () => {
    geminiReturns({ intencao: 'NOVO_INSUMO', dados: { nome: 'Farinha', unidade: 'KG', custoUnitario: 4.5, quantidadeInicial: null }, camposFaltando: [] })
    await interpretarComando('t1', '+5511', 'Novo insumo: Farinha kg 4.50')
    expect(redis.set).toHaveBeenCalledWith('whatsapp:session:+5511:t1', expect.stringContaining('NOVO_INSUMO'), 'EX', 600)
    expect(enviar).toHaveBeenCalledWith('+5511', expect.stringContaining('Farinha'), 't1')
  })

  it('saves session for NOVO_PRODUTO when ingredients found', async () => {
    geminiReturns({ intencao: 'NOVO_PRODUTO', dados: { nome: 'X-Burguer', precoVenda: null, insumos: [{ nome: 'pão', quantidade: 1, unidade: 'UN' }] }, camposFaltando: [] })
    db.ingredient.findMany.mockResolvedValue([{ id: 'i1', name: 'pão' }])
    await interpretarComando('t1', '+5511', 'Novo produto: X-Burguer | pão 1un')
    expect(redis.set).toHaveBeenCalled()
  })

  it('sends help menu on Gemini error', async () => {
    mockGenerateContent.mockRejectedValue(new Error('api error'))
    await interpretarComando('t1', '+5511', 'test')
    expect(enviar).toHaveBeenCalledWith('+5511', expect.stringContaining('Não entendi'), 't1')
  })
})

describe('processarConfirmacao', () => {
  beforeEach(() => vi.clearAllMocks())

  it('replies session expired when no Redis session', async () => {
    redis.get.mockResolvedValue(null)
    await processarConfirmacao('t1', '+5511', 'SIM')
    expect(enviar).toHaveBeenCalledWith('+5511', expect.stringContaining('expirada'), 't1')
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('cancels on NÃO and deletes session', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ intencao: 'NOVO_INSUMO', dados: {}, expiraEm: 0 }))
    await processarConfirmacao('t1', '+5511', 'NÃO')
    expect(redis.del).toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('deletes session before DB writes (optimistic lock) for SIM', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ intencao: 'NOVO_INSUMO', dados: { nome: 'Sal', unidade: 'KG', custoUnitario: 1, quantidadeInicial: null }, expiraEm: 0 }))
    redis.del.mockResolvedValue(1)
    db.$transaction.mockResolvedValue(undefined)
    await processarConfirmacao('t1', '+5511', 'SIM')
    // del must be called before $transaction
    const delOrder = redis.del.mock.invocationCallOrder[0]
    const txOrder = db.$transaction.mock.invocationCallOrder[0]
    expect(delOrder).toBeLessThan(txOrder)
  })

  it('handles double-submission: del returns 0 means already processed', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ intencao: 'NOVO_INSUMO', dados: {}, expiraEm: 0 }))
    redis.del.mockResolvedValue(0) // someone else already consumed
    await processarConfirmacao('t1', '+5511', 'SIM')
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(enviar).toHaveBeenCalledWith('+5511', expect.stringContaining('processado'), 't1')
  })

  it('creates product with ingredients on SIM for NOVO_PRODUTO', async () => {
    redis.get.mockResolvedValue(JSON.stringify({
      intencao: 'NOVO_PRODUTO',
      dados: { nome: 'X-Burguer', precoVenda: 25, insumos: [{ nome: 'Pão', quantidade: 1, unidade: 'UN' }], insumosEncontrados: [{ id: 'i3', name: 'Pão' }] },
      expiraEm: 0,
    }))
    redis.del.mockResolvedValue(1)
    db.product.create.mockResolvedValue({ id: 'p1' })
    await processarConfirmacao('t1', '+5511', 'SIM')
    expect(db.product.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: 'X-Burguer', salePrice: 25 }) }))
    expect(redis.del).toHaveBeenCalled()
  })
})
