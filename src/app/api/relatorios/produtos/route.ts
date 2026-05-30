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
      itens: {
        select: {
          productId: true,
          quantidade: true,
          precoUnitario: true,
          product: {
            select: {
              id: true,
              name: true,
              image: true,
              salePrice: true,
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

  // Aggregate by productId
  const map = new Map<
    string,
    {
      id: string
      nome: string
      imagem: string | null
      categoria: string
      qtdVendida: number
      receita: number
      custoPorUnidade: number
    }
  >()

  for (const pedido of pedidos) {
    for (const item of pedido.itens) {
      const p = item.product
      const custoPorUnidade = p.ingredients.reduce(
        (s, pi) => s + pi.quantity * (pi.ingredient.custoMedioPonderado ?? 0),
        0
      )
      const existing = map.get(p.id)
      if (existing) {
        existing.qtdVendida += item.quantidade
        existing.receita += item.quantidade * item.precoUnitario
      } else {
        map.set(p.id, {
          id: p.id,
          nome: p.name,
          imagem: p.image,
          categoria: p.category?.name ?? 'Sem categoria',
          qtdVendida: item.quantidade,
          receita: item.quantidade * item.precoUnitario,
          custoPorUnidade,
        })
      }
    }
  }

  const items = Array.from(map.values()).sort((a, b) => b.receita - a.receita)
  const totalReceita = items.reduce((s, i) => s + i.receita, 0)

  // ABC classification
  let accumulated = 0
  const result = items.map((item, idx) => {
    const custoTotal = item.custoPorUnidade * item.qtdVendida
    const margem = item.receita - custoTotal
    const margemPct = item.receita > 0 ? (margem / item.receita) * 100 : 0
    const pctReceita = totalReceita > 0 ? (item.receita / totalReceita) * 100 : 0
    accumulated += pctReceita
    const classeABC = accumulated <= 80 ? 'A' : accumulated <= 95 ? 'B' : 'C'
    return {
      id: item.id,
      nome: item.nome,
      imagem: item.imagem,
      categoria: item.categoria,
      qtdVendida: item.qtdVendida,
      receita: item.receita,
      pctReceita,
      custoTotal,
      margem,
      margemPct,
      ticketMedio: item.qtdVendida > 0 ? item.receita / item.qtdVendida : 0,
      ranking: idx + 1,
      classeABC,
    }
  })

  return NextResponse.json(result)
}
