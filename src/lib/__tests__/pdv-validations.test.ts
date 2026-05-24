import { describe, it, expect } from 'vitest'
import {
  ambienteSchema,
  mesaSchema,
  pedidoItemSchema,
  criarPedidoSchema,
  reservaSchema,
  configPdvSchema,
} from '@/lib/validations'

const CUID = 'clxxxxxxxxxxxxxxxxxxxxxx'

describe('ambienteSchema', () => {
  it('aceita ambiente válido', () => {
    const r = ambienteSchema.safeParse({ nome: 'Salão', ordem: 0 })
    expect(r.success).toBe(true)
  })

  it('aceita sem campo ordem (opcional)', () => {
    const r = ambienteSchema.safeParse({ nome: 'Varanda' })
    expect(r.success).toBe(true)
  })

  it('rejeita nome vazio', () => {
    const r = ambienteSchema.safeParse({ nome: '' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].path).toContain('nome')
  })

  it('rejeita nome acima de 100 chars', () => {
    const r = ambienteSchema.safeParse({ nome: 'a'.repeat(101) })
    expect(r.success).toBe(false)
  })

  it('rejeita ordem negativa', () => {
    const r = ambienteSchema.safeParse({ nome: 'Salão', ordem: -1 })
    expect(r.success).toBe(false)
  })
})

describe('mesaSchema', () => {
  it('aceita mesa válida', () => {
    const r = mesaSchema.safeParse({ numero: 1, cadeiras: 4 })
    expect(r.success).toBe(true)
  })

  it('cadeiras default é 4', () => {
    const r = mesaSchema.safeParse({ numero: 5 })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.cadeiras).toBe(4)
  })

  it('rejeita numero 0', () => {
    const r = mesaSchema.safeParse({ numero: 0 })
    expect(r.success).toBe(false)
  })

  it('rejeita numero > 9999', () => {
    const r = mesaSchema.safeParse({ numero: 10000 })
    expect(r.success).toBe(false)
  })

  it('rejeita cadeiras > 50', () => {
    const r = mesaSchema.safeParse({ numero: 1, cadeiras: 51 })
    expect(r.success).toBe(false)
  })
})

describe('pedidoItemSchema', () => {
  it('aceita item válido', () => {
    const r = pedidoItemSchema.safeParse({ productId: CUID, quantidade: 2 })
    expect(r.success).toBe(true)
  })

  it('aceita com observação', () => {
    const r = pedidoItemSchema.safeParse({ productId: CUID, quantidade: 1, observacao: 'sem cebola' })
    expect(r.success).toBe(true)
  })

  it('rejeita quantidade 0', () => {
    const r = pedidoItemSchema.safeParse({ productId: CUID, quantidade: 0 })
    expect(r.success).toBe(false)
  })

  it('rejeita quantidade > 999', () => {
    const r = pedidoItemSchema.safeParse({ productId: CUID, quantidade: 1000 })
    expect(r.success).toBe(false)
  })
})

describe('criarPedidoSchema', () => {
  const item = { productId: CUID, quantidade: 1 }

  it('aceita pedido válido', () => {
    const r = criarPedidoSchema.safeParse({ mesaId: CUID, garcomId: CUID, itens: [item] })
    expect(r.success).toBe(true)
  })

  it('rejeita pedido sem itens', () => {
    const r = criarPedidoSchema.safeParse({ mesaId: CUID, garcomId: CUID, itens: [] })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].path).toContain('itens')
  })

  it('rejeita mesaId inválido', () => {
    const r = criarPedidoSchema.safeParse({ mesaId: 'nao-e-cuid', garcomId: CUID, itens: [item] })
    expect(r.success).toBe(false)
  })
})

describe('reservaSchema', () => {
  const base = {
    clienteNome: 'João Silva',
    dataHora: new Date(Date.now() + 86400000).toISOString(),
    numPessoas: 4,
    mesaIds: [CUID],
  }

  it('aceita reserva válida', () => {
    const r = reservaSchema.safeParse(base)
    expect(r.success).toBe(true)
  })

  it('rejeita nome vazio', () => {
    const r = reservaSchema.safeParse({ ...base, clienteNome: '' })
    expect(r.success).toBe(false)
  })

  it('rejeita mesaIds vazio', () => {
    const r = reservaSchema.safeParse({ ...base, mesaIds: [] })
    expect(r.success).toBe(false)
  })

  it('rejeita numPessoas 0', () => {
    const r = reservaSchema.safeParse({ ...base, numPessoas: 0 })
    expect(r.success).toBe(false)
  })
})

describe('configPdvSchema', () => {
  it('aceita config vazia (todos opcionais)', () => {
    const r = configPdvSchema.safeParse({})
    expect(r.success).toBe(true)
  })

  it('aceita taxa de serviço válida', () => {
    const r = configPdvSchema.safeParse({ taxaServico: 10, taxaServicoAtiva: true })
    expect(r.success).toBe(true)
  })

  it('rejeita taxa > 100', () => {
    const r = configPdvSchema.safeParse({ taxaServico: 101 })
    expect(r.success).toBe(false)
  })

  it('aceita formas de pagamento válidas', () => {
    const r = configPdvSchema.safeParse({ formasPagamento: ['DINHEIRO', 'PIX'] })
    expect(r.success).toBe(true)
  })

  it('rejeita forma de pagamento inválida', () => {
    const r = configPdvSchema.safeParse({ formasPagamento: ['INVALIDO'] })
    expect(r.success).toBe(false)
  })
})
