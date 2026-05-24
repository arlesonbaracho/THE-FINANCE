// Pure business logic for the PDV module — no Prisma imports here

/** Calculates subtotal, service fee and total for a pedido. */
export function calcPedidoTotal(
  itens: { quantidade: number; precoUnitario: number }[],
  taxaServicoPercent: number,
  taxaServicoAtiva: boolean,
): { subtotal: number; taxaServico: number; total: number } {
  const subtotal = itens.reduce((acc, i) => acc + i.quantidade * i.precoUnitario, 0)
  const taxaServico = taxaServicoAtiva ? round2(subtotal * (taxaServicoPercent / 100)) : 0
  return { subtotal: round2(subtotal), taxaServico, total: round2(subtotal + taxaServico) }
}

/** Returns true if every ingredient needed by the product has enough currentQty. */
export function isProdutoDisponivel(product: {
  ingredients: { ingredient: { currentQty: number }; quantity: number }[]
}): boolean {
  if (!product.ingredients || product.ingredients.length === 0) return true
  return product.ingredients.every((pi) => pi.ingredient.currentQty >= pi.quantity)
}

/**
 * Given pedido items and the products (with their ingredient lists),
 * returns the list of ingredient stock deductions to apply as OUT movements.
 */
export function calcBaixaEstoque(
  itens: { productId: string; quantidade: number }[],
  products: { id: string; ingredients: { ingredientId: string; quantity: number }[] }[],
): { ingredientId: string; quantity: number }[] {
  const map = new Map<string, number>()

  const productMap = new Map(products.map((p) => [p.id, p]))

  for (const item of itens) {
    const product = productMap.get(item.productId)
    if (!product) continue
    for (const pi of product.ingredients) {
      const total = pi.quantity * item.quantidade
      map.set(pi.ingredientId, (map.get(pi.ingredientId) ?? 0) + total)
    }
  }

  return Array.from(map.entries()).map(([ingredientId, quantity]) => ({
    ingredientId,
    quantity: round2(quantity),
  }))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
