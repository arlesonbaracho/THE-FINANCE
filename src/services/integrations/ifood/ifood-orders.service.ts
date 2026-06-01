import { prisma } from '@/lib/prisma'
import { getAccessToken } from './ifood-auth.service'
import type { Pedido } from '@prisma/client'

const BASE = process.env.IFOOD_API_BASE_URL ?? 'https://merchant-api.ifood.com.br'

type IFoodItem = {
  id: string
  name: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

type IFoodWebhookPayload = {
  id: string
  reference?: string
  createdAt?: string
  items?: IFoodItem[]
  deliveryAddress?: Record<string, unknown>
  payments?: { methods?: Array<{ value?: number; type?: string }> }
  [key: string]: unknown
}

export async function confirmarPedido(tenantId: string, ifoodOrderId: string): Promise<void> {
  const token = await getAccessToken(tenantId)
  const res = await fetch(`${BASE}/order/v1.0/orders/${ifoodOrderId}/confirm`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`confirmarPedido failed ${res.status}: ${text}`)
  }
}

export async function rejeitarPedido(tenantId: string, ifoodOrderId: string, motivo: string): Promise<void> {
  const token = await getAccessToken(tenantId)
  const res = await fetch(`${BASE}/order/v1.0/orders/${ifoodOrderId}/reject`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cancellationCode: motivo }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`rejeitarPedido failed ${res.status}: ${text}`)
  }

  await prisma.iFoodPedido.updateMany({
    where: { ifoodOrderId },
    data: { statusIfood: 'REJECTED' },
  })
}

export async function processarWebhook(tenantId: string, payload: IFoodWebhookPayload): Promise<Pedido> {
  const ifoodOrderId = payload.id

  // Idempotência
  const existing = await prisma.iFoodPedido.findUnique({ where: { ifoodOrderId } })
  if (existing) {
    return prisma.pedido.findUniqueOrThrow({ where: { id: existing.pedidoId } })
  }

  const items: IFoodItem[] = payload.items ?? []

  // Mapear itens iFood → produtos THE FINANCE
  const mappings = items.length > 0
    ? await prisma.iFoodItemMap.findMany({
        where: {
          tenantId,
          ifoodItemId: { in: items.map((i) => i.id) },
          produtoId: { not: null },
        },
      })
    : []

  const mappingMap = new Map(mappings.map((m) => [m.ifoodItemId, m.produtoId!]))

  // Buscar preços dos produtos mapeados
  const produtoIds = Array.from(new Set(mappings.map((m) => m.produtoId!)))
  const produtos = produtoIds.length > 0
    ? await prisma.product.findMany({ where: { id: { in: produtoIds } }, select: { id: true, salePrice: true } })
    : []
  const priceMap = new Map(produtos.map((p) => [p.id, p.salePrice]))

  const pedidoItems = items
    .filter((item) => mappingMap.has(item.id))
    .map((item) => ({
      productId: mappingMap.get(item.id)!,
      quantidade: item.quantity,
      precoUnitario: priceMap.get(mappingMap.get(item.id)!) ?? item.unitPrice,
    }))

  const subtotal = pedidoItems.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0)

  // Extrair comissão (primeiro método de pagamento iFood)
  const comissao = payload.payments?.methods?.[0]?.value ?? 0

  // Criar Pedido
  const pedido = await prisma.pedido.create({
    data: {
      tenantId,
      origem: 'IFOOD',
      status: 'ABERTO',
      subtotal,
      taxaServico: 0,
      total: subtotal,
      itens: pedidoItems.length > 0
        ? { create: pedidoItems }
        : undefined,
    },
  })

  // Criar IFoodPedido
  await prisma.iFoodPedido.create({
    data: {
      tenantId,
      pedidoId: pedido.id,
      ifoodOrderId,
      ifoodReference: payload.reference ?? null,
      statusIfood: 'PLACED',
      comissaoPercent: comissao,
      enderecoEntrega: (payload.deliveryAddress ?? {}) as object,
    },
  })

  // Descontar estoque via ficha técnica
  for (const item of pedidoItems) {
    const ingredientes = await prisma.productIngredient.findMany({
      where: { productId: item.productId },
      include: { ingredient: true },
    })
    for (const pi of ingredientes) {
      const qtdConsumida = pi.quantity * item.quantidade
      await prisma.ingredient.update({
        where: { id: pi.ingredientId },
        data: { currentQty: { decrement: qtdConsumida } },
      })
      await prisma.ingredientMovement.create({
        data: {
          ingredientId: pi.ingredientId,
          tenantId,
          type: 'OUT',
          quantity: qtdConsumida,
          reason: `Pedido iFood ${ifoodOrderId}`,
        },
      })
    }
  }

  // Emitir via Socket.io
  const io = (global as { io?: { to: (room: string) => { emit: (ev: string, data: unknown) => void } } }).io
  if (io) {
    const pedidoCompleto = await prisma.pedido.findUnique({
      where: { id: pedido.id },
      include: {
        itens: { include: { product: { select: { id: true, name: true } } } },
        ifoodPedido: true,
      },
    })
    io.to(tenantId).emit('pedido:novo', pedidoCompleto)
  }

  return pedido
}
