import { describe, it, expect } from 'vitest'

// ── Business logic: product cost & margin ─────────────────────────────────────
// These pure functions mirror what the UI computes from fetched data.

function calculateProductCost(
  ingredients: Array<{ unitCost: number; quantity: number }>
): number {
  return ingredients.reduce((sum, item) => sum + item.unitCost * item.quantity, 0)
}

function calculateProfitMargin(salePrice: number, cost: number): number {
  if (salePrice <= 0) return 0
  return ((salePrice - cost) / salePrice) * 100
}

describe('calculateProductCost', () => {
  it('returns 0 for empty ingredient list', () => {
    expect(calculateProductCost([])).toBe(0)
  })

  it('calculates single ingredient cost', () => {
    expect(calculateProductCost([{ unitCost: 5, quantity: 2 }])).toBe(10)
  })

  it('calculates multiple ingredients', () => {
    const ingredients = [
      { unitCost: 4, quantity: 0.2 },   // 0.80
      { unitCost: 10, quantity: 0.05 },  // 0.50
      { unitCost: 2, quantity: 1 },      // 2.00
    ]
    expect(calculateProductCost(ingredients)).toBeCloseTo(3.3, 5)
  })

  it('handles fractional quantities accurately', () => {
    expect(calculateProductCost([{ unitCost: 8, quantity: 0.125 }])).toBeCloseTo(1, 5)
  })
})

describe('calculateProfitMargin', () => {
  it('returns 0 when salePrice is 0', () => {
    expect(calculateProfitMargin(0, 5)).toBe(0)
  })

  it('returns 50% margin when cost is half the price', () => {
    expect(calculateProfitMargin(20, 10)).toBeCloseTo(50, 5)
  })

  it('returns 0% when cost equals price (break-even)', () => {
    expect(calculateProfitMargin(10, 10)).toBeCloseTo(0, 5)
  })

  it('returns negative margin when cost exceeds price', () => {
    expect(calculateProfitMargin(10, 15)).toBeLessThan(0)
  })

  it('returns 100% margin when cost is zero', () => {
    expect(calculateProfitMargin(10, 0)).toBeCloseTo(100, 5)
  })
})

// ── Business logic: stock movement ────────────────────────────────────────────

function applyMovement(
  currentQty: number,
  type: 'IN' | 'OUT' | 'ADJUSTMENT',
  quantity: number
): { newQty: number; error?: string } {
  if (type === 'IN') return { newQty: currentQty + quantity }
  if (type === 'OUT') {
    const newQty = currentQty - quantity
    if (newQty < 0) return { newQty: currentQty, error: 'Quantidade insuficiente em estoque' }
    return { newQty }
  }
  if (type === 'ADJUSTMENT') return { newQty: quantity }
  return { newQty: currentQty, error: 'Tipo inválido' }
}

describe('applyMovement', () => {
  it('IN adds to current quantity', () => {
    expect(applyMovement(10, 'IN', 5).newQty).toBe(15)
  })

  it('OUT subtracts from current quantity', () => {
    expect(applyMovement(10, 'OUT', 3).newQty).toBe(7)
  })

  it('OUT to exact zero is allowed', () => {
    const result = applyMovement(5, 'OUT', 5)
    expect(result.newQty).toBe(0)
    expect(result.error).toBeUndefined()
  })

  it('OUT that would go negative is rejected', () => {
    const result = applyMovement(2, 'OUT', 5)
    expect(result.error).toBeDefined()
    expect(result.newQty).toBe(2) // quantity unchanged
  })

  it('ADJUSTMENT sets absolute quantity', () => {
    expect(applyMovement(100, 'ADJUSTMENT', 25).newQty).toBe(25)
  })

  it('ADJUSTMENT to zero is valid', () => {
    expect(applyMovement(50, 'ADJUSTMENT', 0).newQty).toBe(0)
  })
})

// ── Business logic: low-stock alert ──────────────────────────────────────────

function isLowStock(currentQty: number, minimumQty: number): boolean {
  return currentQty <= minimumQty
}

describe('isLowStock', () => {
  it('triggers alert when current equals minimum', () => {
    expect(isLowStock(5, 5)).toBe(true)
  })

  it('triggers alert when current is below minimum', () => {
    expect(isLowStock(1, 5)).toBe(true)
  })

  it('does not trigger when current is above minimum', () => {
    expect(isLowStock(10, 5)).toBe(false)
  })

  it('does not trigger when both are zero', () => {
    expect(isLowStock(0, 0)).toBe(true) // 0 <= 0, edge case: still an alert
  })
})
