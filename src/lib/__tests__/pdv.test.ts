import { describe, it, expect } from 'vitest'
import { calcPedidoTotal, isProdutoDisponivel, calcBaixaEstoque } from '@/lib/pdv'

// ── calcPedidoTotal ───────────────────────────────────────────────────────────

describe('calcPedidoTotal', () => {
  it('calcula subtotal simples sem taxa', () => {
    const itens = [{ quantidade: 2, precoUnitario: 15 }]
    const r = calcPedidoTotal(itens, 10, false)
    expect(r.subtotal).toBe(30)
    expect(r.taxaServico).toBe(0)
    expect(r.total).toBe(30)
  })

  it('calcula com taxa de serviço ativa (10%)', () => {
    const itens = [{ quantidade: 1, precoUnitario: 100 }]
    const r = calcPedidoTotal(itens, 10, true)
    expect(r.subtotal).toBe(100)
    expect(r.taxaServico).toBe(10)
    expect(r.total).toBe(110)
  })

  it('taxa inativa não impacta total', () => {
    const itens = [{ quantidade: 1, precoUnitario: 50 }]
    const r = calcPedidoTotal(itens, 15, false)
    expect(r.taxaServico).toBe(0)
    expect(r.total).toBe(50)
  })

  it('soma múltiplos itens corretamente', () => {
    const itens = [
      { quantidade: 2, precoUnitario: 20 },
      { quantidade: 3, precoUnitario: 10 },
    ]
    const r = calcPedidoTotal(itens, 10, false)
    expect(r.subtotal).toBe(70)
    expect(r.total).toBe(70)
  })

  it('arredonda corretamente (2 casas decimais)', () => {
    const itens = [{ quantidade: 3, precoUnitario: 10.1 }]
    const r = calcPedidoTotal(itens, 10, true)
    expect(r.subtotal).toBe(30.3)
    expect(r.taxaServico).toBe(3.03)
    expect(r.total).toBe(33.33)
  })

  it('pedido vazio resulta em zeros', () => {
    const r = calcPedidoTotal([], 10, true)
    expect(r.subtotal).toBe(0)
    expect(r.taxaServico).toBe(0)
    expect(r.total).toBe(0)
  })

  it('taxa de 0% não altera total mesmo ativa', () => {
    const itens = [{ quantidade: 1, precoUnitario: 100 }]
    const r = calcPedidoTotal(itens, 0, true)
    expect(r.taxaServico).toBe(0)
    expect(r.total).toBe(100)
  })
})

// ── isProdutoDisponivel ───────────────────────────────────────────────────────

describe('isProdutoDisponivel', () => {
  it('produto sem ficha técnica está disponível', () => {
    expect(isProdutoDisponivel({ ingredients: [] })).toBe(true)
  })

  it('produto com todos os insumos disponíveis', () => {
    const product = {
      ingredients: [
        { ingredient: { currentQty: 10 }, quantity: 2 },
        { ingredient: { currentQty: 5 }, quantity: 1 },
      ],
    }
    expect(isProdutoDisponivel(product)).toBe(true)
  })

  it('produto com insumo exatamente no limite está disponível', () => {
    const product = {
      ingredients: [{ ingredient: { currentQty: 2 }, quantity: 2 }],
    }
    expect(isProdutoDisponivel(product)).toBe(true)
  })

  it('produto com insumo insuficiente está indisponível', () => {
    const product = {
      ingredients: [
        { ingredient: { currentQty: 5 }, quantity: 2 },
        { ingredient: { currentQty: 0 }, quantity: 1 },
      ],
    }
    expect(isProdutoDisponivel(product)).toBe(false)
  })

  it('insumo zerado torna produto indisponível', () => {
    const product = {
      ingredients: [{ ingredient: { currentQty: 0 }, quantity: 0.5 }],
    }
    expect(isProdutoDisponivel(product)).toBe(false)
  })
})

// ── calcBaixaEstoque ──────────────────────────────────────────────────────────

describe('calcBaixaEstoque', () => {
  const products = [
    {
      id: 'prod-1',
      ingredients: [
        { ingredientId: 'ing-1', quantity: 0.2 }, // 200g de carne por unidade
        { ingredientId: 'ing-2', quantity: 0.05 }, // 50g de queijo por unidade
      ],
    },
    {
      id: 'prod-2',
      ingredients: [
        { ingredientId: 'ing-1', quantity: 0.1 }, // 100g de carne
      ],
    },
  ]

  it('calcula baixa para um item com múltiplos insumos', () => {
    const itens = [{ productId: 'prod-1', quantidade: 2 }]
    const result = calcBaixaEstoque(itens, products)
    const ing1 = result.find((r) => r.ingredientId === 'ing-1')
    const ing2 = result.find((r) => r.ingredientId === 'ing-2')
    expect(ing1?.quantity).toBe(0.4)  // 0.2 * 2
    expect(ing2?.quantity).toBe(0.1)  // 0.05 * 2
  })

  it('agrega mesmo insumo de produtos diferentes', () => {
    const itens = [
      { productId: 'prod-1', quantidade: 1 },
      { productId: 'prod-2', quantidade: 1 },
    ]
    const result = calcBaixaEstoque(itens, products)
    const ing1 = result.find((r) => r.ingredientId === 'ing-1')
    expect(ing1?.quantity).toBe(0.3)  // 0.2 + 0.1
  })

  it('ignora productId não encontrado', () => {
    const itens = [{ productId: 'inexistente', quantidade: 5 }]
    const result = calcBaixaEstoque(itens, products)
    expect(result).toHaveLength(0)
  })

  it('pedido vazio retorna lista vazia', () => {
    const result = calcBaixaEstoque([], products)
    expect(result).toHaveLength(0)
  })

  it('produto sem ingredientes não gera baixa', () => {
    const prodSemFicha = [{ id: 'prod-3', ingredients: [] }]
    const itens = [{ productId: 'prod-3', quantidade: 10 }]
    const result = calcBaixaEstoque(itens, prodSemFicha)
    expect(result).toHaveLength(0)
  })
})
