import { describe, it, expect } from 'vitest'

// ── CMP (Custo Médio Ponderado) ───────────────────────────────────────────────
// Formula: (qtd_atual × custo_medio + qtd_entrada × custo_compra) / (qtd_atual + qtd_entrada)

function calcCMP(qtdAtual: number, cmpAtual: number, qtdEntrada: number, custoEntrada: number): number {
  const novaQtd = qtdAtual + qtdEntrada
  if (novaQtd <= 0) return cmpAtual
  return (qtdAtual * cmpAtual + qtdEntrada * custoEntrada) / novaQtd
}

describe('calcCMP — weighted average cost', () => {
  it('first entry sets CMP equal to purchase cost', () => {
    expect(calcCMP(0, 0, 10, 5)).toBeCloseTo(5, 5)
  })

  it('same cost entry keeps CMP unchanged', () => {
    expect(calcCMP(10, 5, 10, 5)).toBeCloseTo(5, 5)
  })

  it('higher-cost entry raises CMP', () => {
    const newCmp = calcCMP(10, 4, 10, 6)
    expect(newCmp).toBeCloseTo(5, 5) // (40 + 60) / 20
  })

  it('lower-cost entry lowers CMP', () => {
    const newCmp = calcCMP(10, 6, 10, 2)
    expect(newCmp).toBeCloseTo(4, 5) // (60 + 20) / 20
  })

  it('partial restock with higher cost', () => {
    // 100kg at R$10 existing, buy 20kg at R$15
    const newCmp = calcCMP(100, 10, 20, 15)
    expect(newCmp).toBeCloseTo(10.833, 2) // (1000 + 300) / 120
  })

  it('large existing stock dilutes entry impact', () => {
    const newCmp = calcCMP(1000, 5, 10, 20)
    // (5000 + 200) / 1010
    expect(newCmp).toBeCloseTo(5.148, 2)
  })

  it('zero existing quantity uses entry cost directly', () => {
    expect(calcCMP(0, 0, 50, 12.5)).toBeCloseTo(12.5, 5)
  })

  it('returns current CMP when total quantity would be zero', () => {
    expect(calcCMP(0, 8, 0, 5)).toBe(8)
  })
})

// ── Stock value calculation ───────────────────────────────────────────────────

function calcStockValue(currentQty: number, cmp: number): number {
  return currentQty * cmp
}

describe('calcStockValue', () => {
  it('computes value correctly', () => {
    expect(calcStockValue(100, 4.5)).toBeCloseTo(450, 5)
  })

  it('zero quantity = zero value', () => {
    expect(calcStockValue(0, 99)).toBe(0)
  })

  it('zero cost = zero value', () => {
    expect(calcStockValue(50, 0)).toBe(0)
  })

  it('fractional quantities', () => {
    expect(calcStockValue(0.5, 10)).toBeCloseTo(5, 5)
  })
})

// ── Stock status determination ────────────────────────────────────────────────

type StockStatus = 'ok' | 'low' | 'critical' | 'expiring' | 'expired'

function getStockStatus(
  currentQty: number,
  minimumQty: number,
  pontoReposicao: number,
  dataValidade: Date | null,
  now: Date = new Date()
): StockStatus {
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  if (dataValidade) {
    if (dataValidade < now) return 'expired'
    if (dataValidade <= sevenDays) return 'expiring'
  }

  if (currentQty <= 0 || currentQty <= minimumQty) return 'critical'
  if (currentQty <= pontoReposicao) return 'low'
  return 'ok'
}

describe('getStockStatus', () => {
  const now = new Date('2026-05-03T12:00:00Z')

  it('returns ok when stock is above reorder point', () => {
    expect(getStockStatus(50, 10, 20, null, now)).toBe('ok')
  })

  it('returns low when stock is between minimum and reorder point', () => {
    expect(getStockStatus(15, 5, 20, null, now)).toBe('low')
  })

  it('returns critical when stock equals minimum', () => {
    expect(getStockStatus(10, 10, 20, null, now)).toBe('critical')
  })

  it('returns critical when stock is below minimum', () => {
    expect(getStockStatus(3, 10, 20, null, now)).toBe('critical')
  })

  it('returns critical when stock is zero', () => {
    expect(getStockStatus(0, 0, 0, null, now)).toBe('critical')
  })

  it('returns expired for past expiry date', () => {
    const expiredDate = new Date('2026-04-01T00:00:00Z')
    expect(getStockStatus(50, 10, 20, expiredDate, now)).toBe('expired')
  })

  it('returns expiring for expiry within 7 days', () => {
    const soonDate = new Date('2026-05-08T00:00:00Z') // 5 days from now
    expect(getStockStatus(50, 10, 20, soonDate, now)).toBe('expiring')
  })

  it('returns ok for expiry more than 7 days away', () => {
    const futureDate = new Date('2026-06-01T00:00:00Z')
    expect(getStockStatus(50, 10, 20, futureDate, now)).toBe('ok')
  })

  it('expiry check takes priority over stock level', () => {
    // Even if stock is critical, expired takes priority
    const expiredDate = new Date('2026-04-01T00:00:00Z')
    expect(getStockStatus(0, 10, 20, expiredDate, now)).toBe('expired')
  })

  it('expiring takes priority over low stock', () => {
    const soonDate = new Date('2026-05-06T00:00:00Z') // 3 days from now
    expect(getStockStatus(15, 5, 20, soonDate, now)).toBe('expiring')
  })
})

// ── Inventory counting — difference calculation ───────────────────────────────

function calcInventarioDiff(qtdSistema: number, qtdContada: number): {
  diferenca: number
  tipo: 'ok' | 'surplus' | 'shortage'
} {
  const diferenca = qtdContada - qtdSistema
  if (diferenca === 0) return { diferenca, tipo: 'ok' }
  return { diferenca, tipo: diferenca > 0 ? 'surplus' : 'shortage' }
}

describe('calcInventarioDiff', () => {
  it('no difference when counts match', () => {
    const result = calcInventarioDiff(10, 10)
    expect(result.diferenca).toBe(0)
    expect(result.tipo).toBe('ok')
  })

  it('positive difference = surplus', () => {
    const result = calcInventarioDiff(10, 12)
    expect(result.diferenca).toBe(2)
    expect(result.tipo).toBe('surplus')
  })

  it('negative difference = shortage', () => {
    const result = calcInventarioDiff(10, 7)
    expect(result.diferenca).toBe(-3)
    expect(result.tipo).toBe('shortage')
  })

  it('handles fractional quantities', () => {
    const result = calcInventarioDiff(5.250, 5.100)
    expect(result.diferenca).toBeCloseTo(-0.15, 5)
    expect(result.tipo).toBe('shortage')
  })

  it('zero system stock with counted stock', () => {
    const result = calcInventarioDiff(0, 3.5)
    expect(result.diferenca).toBe(3.5)
    expect(result.tipo).toBe('surplus')
  })
})

// ── Stock movement - enhanced types ──────────────────────────────────────────

type MovementType = 'IN' | 'OUT' | 'ADJUSTMENT' | 'LOSS' | 'EXPIRY' | 'INTERNAL_USE'

function applyMovementEnhanced(
  currentQty: number,
  cmpAtual: number,
  type: MovementType,
  quantity: number,
  unitCost?: number
): { newQty: number; newCmp: number; error?: string } {
  const EXIT_TYPES: MovementType[] = ['OUT', 'LOSS', 'EXPIRY', 'INTERNAL_USE']

  if (EXIT_TYPES.includes(type)) {
    if (currentQty < quantity) {
      return { newQty: currentQty, newCmp: cmpAtual, error: 'Estoque insuficiente' }
    }
    return { newQty: currentQty - quantity, newCmp: cmpAtual }
  }

  if (type === 'IN') {
    const entryUnitCost = unitCost ?? cmpAtual
    const newQty = currentQty + quantity
    const newCmp = newQty > 0
      ? (currentQty * cmpAtual + quantity * entryUnitCost) / newQty
      : cmpAtual
    return { newQty, newCmp }
  }

  if (type === 'ADJUSTMENT') {
    return { newQty: quantity, newCmp: cmpAtual }
  }

  return { newQty: currentQty, newCmp: cmpAtual, error: 'Tipo inválido' }
}

describe('applyMovementEnhanced', () => {
  it('IN updates quantity and recalculates CMP', () => {
    const result = applyMovementEnhanced(10, 5, 'IN', 10, 8)
    expect(result.newQty).toBe(20)
    expect(result.newCmp).toBeCloseTo(6.5, 5) // (50+80)/20
    expect(result.error).toBeUndefined()
  })

  it('IN without cost uses current CMP', () => {
    const result = applyMovementEnhanced(10, 5, 'IN', 10)
    expect(result.newCmp).toBeCloseTo(5, 5)
  })

  it('OUT reduces quantity without changing CMP', () => {
    const result = applyMovementEnhanced(20, 8, 'OUT', 5)
    expect(result.newQty).toBe(15)
    expect(result.newCmp).toBe(8)
  })

  it('LOSS reduces quantity like OUT', () => {
    const result = applyMovementEnhanced(10, 5, 'LOSS', 2)
    expect(result.newQty).toBe(8)
    expect(result.error).toBeUndefined()
  })

  it('EXPIRY reduces quantity', () => {
    const result = applyMovementEnhanced(10, 5, 'EXPIRY', 3)
    expect(result.newQty).toBe(7)
  })

  it('INTERNAL_USE reduces quantity', () => {
    const result = applyMovementEnhanced(10, 5, 'INTERNAL_USE', 1)
    expect(result.newQty).toBe(9)
  })

  it('OUT with insufficient stock returns error', () => {
    const result = applyMovementEnhanced(5, 8, 'OUT', 10)
    expect(result.error).toBeDefined()
    expect(result.newQty).toBe(5) // unchanged
  })

  it('ADJUSTMENT sets absolute quantity', () => {
    const result = applyMovementEnhanced(100, 5, 'ADJUSTMENT', 25)
    expect(result.newQty).toBe(25)
    expect(result.newCmp).toBe(5) // CMP unchanged on adjustment
  })

  it('LOSS with insufficient stock returns error', () => {
    const result = applyMovementEnhanced(1, 5, 'LOSS', 5)
    expect(result.error).toBeDefined()
  })
})

// ── Auto-generated code format ────────────────────────────────────────────────

function generateCodigoInterno(lastCode: string | null): string {
  if (!lastCode) return 'INS-0001'
  const num = parseInt(lastCode.replace('INS-', ''), 10)
  if (isNaN(num)) return 'INS-0001'
  return `INS-${String(num + 1).padStart(4, '0')}`
}

describe('generateCodigoInterno', () => {
  it('generates INS-0001 when no prior code', () => {
    expect(generateCodigoInterno(null)).toBe('INS-0001')
  })

  it('increments from last code', () => {
    expect(generateCodigoInterno('INS-0001')).toBe('INS-0002')
  })

  it('pads numbers with leading zeros', () => {
    expect(generateCodigoInterno('INS-0009')).toBe('INS-0010')
  })

  it('handles codes beyond 9999', () => {
    expect(generateCodigoInterno('INS-9999')).toBe('INS-10000')
  })

  it('handles triple-digit codes', () => {
    expect(generateCodigoInterno('INS-0099')).toBe('INS-0100')
  })

  it('handles invalid format gracefully', () => {
    expect(generateCodigoInterno('INVALID')).toBe('INS-0001')
  })
})
