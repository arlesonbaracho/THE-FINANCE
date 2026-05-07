import { describe, it, expect } from 'vitest'
import {
  registerSchema,
  ingredientSchema,
  movementSchema,
  productSchema,
  productIngredientSchema,
} from '@/lib/validations'

// ── registerSchema ────────────────────────────────────────────────────────────

describe('registerSchema', () => {
  const valid = {
    restaurantName: 'Sabor do Norte',
    name: 'João Silva',
    email: 'joao@example.com',
    password: 'Senha123',
  }

  it('accepts a valid registration', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects passwords shorter than 8 characters', () => {
    const result = registerSchema.safeParse({ ...valid, password: 'Ab1' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toMatch(/8 caracteres/)
  })

  it('rejects passwords without uppercase letter', () => {
    const result = registerSchema.safeParse({ ...valid, password: 'senha1234' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toMatch(/maiúscula/)
  })

  it('rejects passwords without a number', () => {
    const result = registerSchema.safeParse({ ...valid, password: 'SenhaSemNum' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toMatch(/número/)
  })

  it('rejects invalid email format', () => {
    const result = registerSchema.safeParse({ ...valid, email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('normalizes email to lowercase', () => {
    const result = registerSchema.safeParse({ ...valid, email: 'JOAO@EXAMPLE.COM' })
    expect(result.success).toBe(true)
    expect((result as { data: { email: string } }).data.email).toBe('joao@example.com')
  })

  it('rejects empty restaurantName', () => {
    const result = registerSchema.safeParse({ ...valid, restaurantName: '' })
    expect(result.success).toBe(false)
  })
})

// ── ingredientSchema ──────────────────────────────────────────────────────────

describe('ingredientSchema', () => {
  const valid = {
    name: 'Farinha de Trigo',
    unit: 'KG',
    currentQty: 10,
    minimumQty: 2,
    unitCost: 4.5,
  }

  it('accepts a valid ingredient', () => {
    expect(ingredientSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects unknown unit', () => {
    const result = ingredientSchema.safeParse({ ...valid, unit: 'CAIXA' })
    expect(result.success).toBe(false)
  })

  it('accepts all valid units', () => {
    for (const unit of ['KG', 'G', 'L', 'ML', 'UN']) {
      expect(ingredientSchema.safeParse({ ...valid, unit }).success).toBe(true)
    }
  })

  it('rejects negative currentQty', () => {
    const result = ingredientSchema.safeParse({ ...valid, currentQty: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects quantity exceeding max', () => {
    const result = ingredientSchema.safeParse({ ...valid, currentQty: 1_000_000 })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = ingredientSchema.safeParse({ ...valid, name: '' })
    expect(result.success).toBe(false)
  })

  it('trims name whitespace', () => {
    const result = ingredientSchema.safeParse({ ...valid, name: '  Sal  ' })
    expect(result.success).toBe(true)
    expect((result as { data: { name: string } }).data.name).toBe('Sal')
  })

  it('accepts enhanced fields: unidadeCompra, pontoReposicao, subcategoria, localizacao', () => {
    const result = ingredientSchema.safeParse({
      ...valid,
      unidadeCompra: 'KG',
      fatorConversao: 1,
      pontoReposicao: 5,
      subcategoria: 'Farinhas',
      localizacao: 'Prateleira A-1',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid unidadeCompra', () => {
    const result = ingredientSchema.safeParse({ ...valid, unidadeCompra: 'LITRO' })
    expect(result.success).toBe(false)
  })

  it('rejects negative fatorConversao', () => {
    const result = ingredientSchema.safeParse({ ...valid, fatorConversao: -1 })
    expect(result.success).toBe(false)
  })

  it('accepts null for optional fields', () => {
    const result = ingredientSchema.safeParse({
      ...valid,
      unidadeCompra: null,
      quantidadeMaxima: null,
      dataValidade: null,
      foto: null,
    })
    expect(result.success).toBe(true)
  })
})

// ── movementSchema ────────────────────────────────────────────────────────────

describe('movementSchema', () => {
  const valid = { type: 'IN', quantity: 5 }

  it('accepts valid IN movement', () => {
    expect(movementSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts valid OUT movement', () => {
    expect(movementSchema.safeParse({ type: 'OUT', quantity: 2 }).success).toBe(true)
  })

  it('accepts valid ADJUSTMENT movement', () => {
    expect(movementSchema.safeParse({ type: 'ADJUSTMENT', quantity: 10 }).success).toBe(true)
  })

  it('rejects invalid movement type', () => {
    const result = movementSchema.safeParse({ type: 'TRANSFER', quantity: 5 })
    expect(result.success).toBe(false)
  })

  it('rejects zero quantity', () => {
    const result = movementSchema.safeParse({ type: 'IN', quantity: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects negative quantity', () => {
    const result = movementSchema.safeParse({ type: 'IN', quantity: -3 })
    expect(result.success).toBe(false)
  })

  it('rejects quantity above max', () => {
    const result = movementSchema.safeParse({ type: 'IN', quantity: 1_000_000 })
    expect(result.success).toBe(false)
  })

  it('accepts optional reason and note', () => {
    const result = movementSchema.safeParse({ ...valid, reason: 'Compra', note: 'NF 123' })
    expect(result.success).toBe(true)
  })

  it('accepts new exit types: LOSS, EXPIRY, INTERNAL_USE', () => {
    for (const type of ['LOSS', 'EXPIRY', 'INTERNAL_USE']) {
      expect(movementSchema.safeParse({ type, quantity: 1 }).success).toBe(true)
    }
  })

  it('accepts optional unitCost for IN movements', () => {
    const result = movementSchema.safeParse({ type: 'IN', quantity: 5, unitCost: 12.5 })
    expect(result.success).toBe(true)
  })

  it('rejects negative unitCost', () => {
    const result = movementSchema.safeParse({ type: 'IN', quantity: 5, unitCost: -1 })
    expect(result.success).toBe(false)
  })
})

// ── productSchema ─────────────────────────────────────────────────────────────

describe('productSchema', () => {
  it('accepts a valid product', () => {
    expect(productSchema.safeParse({ name: 'X-Burguer', salePrice: 25 }).success).toBe(true)
  })

  it('rejects empty name', () => {
    expect(productSchema.safeParse({ name: '', salePrice: 25 }).success).toBe(false)
  })

  it('rejects negative salePrice', () => {
    expect(productSchema.safeParse({ name: 'X-Burguer', salePrice: -1 }).success).toBe(false)
  })
})

// ── productIngredientSchema ───────────────────────────────────────────────────

describe('productIngredientSchema', () => {
  const validCuid = 'clxxxxxxxxxxxxxxxxxxxxxx'

  it('rejects zero quantity', () => {
    const result = productIngredientSchema.safeParse({ ingredientId: validCuid, quantity: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects negative quantity', () => {
    const result = productIngredientSchema.safeParse({ ingredientId: validCuid, quantity: -1 })
    expect(result.success).toBe(false)
  })
})
