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

// ── Package cost calculation (IngredientForm embalagem logic) ─────────────────

function calcCustoUnitario(
  tipo: 'unidade' | 'pacote',
  custoUnit: number,
  custoTotalPacote: number,
  qtdPorPacote: number
): number {
  if (tipo === 'unidade') return custoUnit
  if (qtdPorPacote < 1) return 0
  return custoTotalPacote / qtdPorPacote
}

function calcCustoParaProduto(custoUnitario: number, qtdDesejada: number): number {
  return custoUnitario * qtdDesejada
}

describe('calcCustoUnitario — embalagem unidade', () => {
  it('returns the unit cost directly', () => {
    expect(calcCustoUnitario('unidade', 12.5, 0, 0)).toBe(12.5)
  })

  it('returns zero when unit cost is zero', () => {
    expect(calcCustoUnitario('unidade', 0, 100, 10)).toBe(0)
  })

  it('ignores package fields in unidade mode', () => {
    expect(calcCustoUnitario('unidade', 5, 99, 99)).toBe(5)
  })
})

describe('calcCustoUnitario — embalagem pacote', () => {
  it('divides package cost by units per package', () => {
    expect(calcCustoUnitario('pacote', 0, 50, 10)).toBeCloseTo(5, 5)
  })

  it('handles non-round division', () => {
    expect(calcCustoUnitario('pacote', 0, 100, 3)).toBeCloseTo(33.333, 2)
  })

  it('returns 0 when qtdPorPacote is 0 (avoid division by zero)', () => {
    expect(calcCustoUnitario('pacote', 0, 50, 0)).toBe(0)
  })

  it('returns 0 when qtdPorPacote < 1', () => {
    expect(calcCustoUnitario('pacote', 0, 50, 0.5)).toBe(0)
  })

  it('package cost 0 yields unit cost 0', () => {
    expect(calcCustoUnitario('pacote', 0, 0, 12)).toBe(0)
  })
})

describe('calcCustoParaProduto', () => {
  it('multiplies unit cost by desired quantity', () => {
    expect(calcCustoParaProduto(5, 2)).toBeCloseTo(10, 5)
  })

  it('handles fractional quantities (e.g. 0.250 kg)', () => {
    expect(calcCustoParaProduto(8, 0.25)).toBeCloseTo(2, 5)
  })

  it('returns 0 when quantity is 0', () => {
    expect(calcCustoParaProduto(10, 0)).toBe(0)
  })
})

// ── Product margin & price simulator (ProductForm financial tab) ──────────────

function calcMargem(precoVenda: number, custo: number): number {
  if (precoVenda <= 0) return 0
  return ((precoVenda - custo) / precoVenda) * 100
}

function margemDiag(m: number): string {
  if (m >= 40) return '✓ Margem excelente — produto muito rentável.'
  if (m >= 25) return '✓ Margem saudável para restaurantes.'
  if (m >= 10) return '⚠ Margem baixa — considere revisar o preço.'
  return '✗ Margem crítica — produto operando no prejuízo.'
}

function calcPrecoSugerido(custo: number, margemDesejada: number): number {
  if (margemDesejada >= 100 || custo <= 0) return 0
  return custo / (1 - margemDesejada / 100)
}

describe('calcMargem', () => {
  it('returns 50% when cost is half of price', () => {
    expect(calcMargem(20, 10)).toBeCloseTo(50, 5)
  })

  it('returns 0 when price is 0', () => {
    expect(calcMargem(0, 5)).toBe(0)
  })

  it('returns negative when cost exceeds price', () => {
    expect(calcMargem(10, 15)).toBeLessThan(0)
  })

  it('returns 0% at break-even', () => {
    expect(calcMargem(10, 10)).toBeCloseTo(0, 5)
  })

  it('returns 100% with zero cost', () => {
    expect(calcMargem(10, 0)).toBeCloseTo(100, 5)
  })
})

describe('margemDiag', () => {
  it('40% or above = excelente', () => {
    expect(margemDiag(40)).toMatch(/excelente/)
    expect(margemDiag(65)).toMatch(/excelente/)
  })

  it('25–39% = saudável', () => {
    expect(margemDiag(25)).toMatch(/saudável/)
    expect(margemDiag(39)).toMatch(/saudável/)
  })

  it('10–24% = baixa', () => {
    expect(margemDiag(10)).toMatch(/baixa/)
    expect(margemDiag(24)).toMatch(/baixa/)
  })

  it('below 10% = crítica', () => {
    expect(margemDiag(9)).toMatch(/crítica/)
    expect(margemDiag(0)).toMatch(/crítica/)
    expect(margemDiag(-5)).toMatch(/crítica/)
  })
})

describe('calcPrecoSugerido', () => {
  it('computes suggested price for 35% margin', () => {
    // cost=6.5, margin=35% → price = 6.5 / 0.65 ≈ 10.00
    expect(calcPrecoSugerido(6.5, 35)).toBeCloseTo(10, 1)
  })

  it('returns 0 when cost is 0', () => {
    expect(calcPrecoSugerido(0, 35)).toBe(0)
  })

  it('returns 0 when margin is 100%', () => {
    expect(calcPrecoSugerido(10, 100)).toBe(0)
  })

  it('higher desired margin requires higher price', () => {
    const p50 = calcPrecoSugerido(10, 50)
    const p30 = calcPrecoSugerido(10, 30)
    expect(p50).toBeGreaterThan(p30)
  })

  it('zero margin = price equals cost', () => {
    expect(calcPrecoSugerido(15, 0)).toBeCloseTo(15, 5)
  })
})

// ── Stock bar percentage (InventarioPage inline formula) ──────────────────────

function calcStockBarPct(currentQty: number, pontoReposicao: number): number {
  const max = Math.max(pontoReposicao * 2, currentQty, 1)
  return Math.min((currentQty / max) * 100, 100)
}

describe('calcStockBarPct', () => {
  it('returns 50% when stock equals reorder point (half of max)', () => {
    // max = pontoReposicao * 2 = 20, pct = 10/20 * 100 = 50
    expect(calcStockBarPct(10, 10)).toBeCloseTo(50, 5)
  })

  it('returns 100% when stock is double the reorder point', () => {
    expect(calcStockBarPct(20, 10)).toBeCloseTo(100, 5)
  })

  it('caps at 100% even when stock exceeds double reorder point', () => {
    expect(calcStockBarPct(100, 10)).toBe(100)
  })

  it('returns 0% when stock is 0', () => {
    expect(calcStockBarPct(0, 10)).toBe(0)
  })

  it('handles zero pontoReposicao — uses currentQty as max', () => {
    // max = Math.max(0, 5, 1) = 5, pct = 5/5 * 100 = 100
    expect(calcStockBarPct(5, 0)).toBeCloseTo(100, 5)
  })

  it('handles all-zero input — max defaults to 1', () => {
    // max = Math.max(0, 0, 1) = 1, pct = 0/1 * 100 = 0
    expect(calcStockBarPct(0, 0)).toBe(0)
  })
})
