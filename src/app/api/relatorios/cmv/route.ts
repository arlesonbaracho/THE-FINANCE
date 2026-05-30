import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTenantId, unauthorizedResponse } from '@/lib/session'

export async function GET(req: Request) {
  const tenantId = await getTenantId()
  if (!tenantId) return unauthorizedResponse()

  const url = new URL(req.url)
  const startStr = url.searchParams.get('startDate')
  const endStr = url.searchParams.get('endDate')
  const start = startStr ? new Date(startStr) : new Date(new Date().setHours(0, 0, 0, 0))
  const end = endStr ? new Date(endStr) : new Date(new Date().setHours(23, 59, 59, 999))
  start.setHours(0, 0, 0, 0)
  end.setHours(23, 59, 59, 999)

  const pedidos = await prisma.pedido.findMany({
    where: { tenantId, status: 'FINALIZADO', criadoEm: { gte: start, lte: end } },
    select: {
      criadoEm: true,
      total: true,
      itens: {
        select: {
          productId: true,
          quantidade: true,
          precoUnitario: true,
          product: {
            select: {
              name: true,
              category: { select: { name: true } },
              ingredients: {
                select: {
                  quantity: true,
                  ingredient: { select: { custoMedioPonderado: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  // Per product aggregation
  const prodMap = new Map<
    string,
    { nome: string; categoria: string; receita: number; custo: number; qtd: number }
  >()
  // Per category
  const catMap = new Map<string, { receita: number; custo: number }>()
  // Per day
  const dayMap = new Map<string, { receita: number; custo: number }>()

  for (const pedido of pedidos) {
    const dayKey = pedido.criadoEm.toISOString().split('T')[0]
    const dayAcc = dayMap.get(dayKey) ?? { receita: 0, custo: 0 }
    dayAcc.receita += pedido.total
    dayMap.set(dayKey, dayAcc)

    for (const item of pedido.itens) {
      const custoPorUnidade = item.product.ingredients.reduce(
        (s, pi) => s + pi.quantity * (pi.ingredient.custoMedioPonderado ?? 0),
        0
      )
      const custoItem = custoPorUnidade * item.quantidade
      const receitaItem = item.quantidade * item.precoUnitario
      const catName = item.product.category?.name ?? 'Sem categoria'

      const prod = prodMap.get(item.productId) ?? {
        nome: item.product.name,
        categoria: catName,
        receita: 0,
        custo: 0,
        qtd: 0,
      }
      prod.receita += receitaItem
      prod.custo += custoItem
      prod.qtd += item.quantidade
      prodMap.set(item.productId, prod)

      const cat = catMap.get(catName) ?? { receita: 0, custo: 0 }
      cat.receita += receitaItem
      cat.custo += custoItem
      catMap.set(catName, cat)

      dayAcc.custo += custoItem
    }
  }

  const maxReceita = Math.max(...Array.from(prodMap.values()).map((p) => p.receita), 0)

  const porProduto = Array.from(prodMap.entries()).map(([id, p]) => {
    const margem = p.receita - p.custo
    const margemPct = p.receita > 0 ? (margem / p.receita) * 100 : 0
    const cmvPct = p.receita > 0 ? (p.custo / p.receita) * 100 : 0
    const alerta = margemPct < 20
    const estrela = margemPct >= 40 && p.receita >= maxReceita * 0.1
    return { id, nome: p.nome, categoria: p.categoria, receita: p.receita, custo: p.custo, margem, margemPct, cmvPct, qtd: p.qtd, alerta, estrela }
  }).sort((a, b) => b.receita - a.receita)

  const porCategoria = Array.from(catMap.entries()).map(([nome, c]) => {
    const margem = c.receita - c.custo
    const margemPct = c.receita > 0 ? (margem / c.receita) * 100 : 0
    const cmvPct = c.receita > 0 ? (c.custo / c.receita) * 100 : 0
    return { nome, receita: c.receita, custo: c.custo, margem, margemPct, cmvPct }
  }).sort((a, b) => b.receita - a.receita)

  // Time series — fill all days in range
  const seriesTempo: { data: string; cmvPct: number; receita: number; custo: number }[] = []
  const cur = new Date(start)
  while (cur <= end) {
    const k = cur.toISOString().split('T')[0]
    const d = dayMap.get(k) ?? { receita: 0, custo: 0 }
    seriesTempo.push({ data: k, cmvPct: d.receita > 0 ? (d.custo / d.receita) * 100 : 0, receita: d.receita, custo: d.custo })
    cur.setDate(cur.getDate() + 1)
  }

  return NextResponse.json({ porProduto, porCategoria, seriesTempo })
}
