import { prisma } from '@/lib/prisma'
import { getAccessToken } from './ifood-auth.service'

const BASE = process.env.IFOOD_API_BASE_URL ?? 'https://merchant-api.ifood.com.br'

export type IFoodItem = {
  id: string
  name: string
  description?: string
  price: number
  available: boolean
  categoryId?: string
  categoryName?: string
}

async function getMerchantId(tenantId: string): Promise<string> {
  const integration = await prisma.iFoodIntegration.findUniqueOrThrow({ where: { tenantId } })
  return integration.merchantId
}

export async function listarItensCatalogo(tenantId: string): Promise<IFoodItem[]> {
  const [token, merchantId] = await Promise.all([getAccessToken(tenantId), getMerchantId(tenantId)])
  const res = await fetch(`${BASE}/catalog/v1.0/merchants/${merchantId}/catalog-items`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`listarItensCatalogo failed ${res.status}: ${text}`)
  }
  const data = await res.json()
  const items: IFoodItem[] = Array.isArray(data) ? data : (data.catalogItems ?? data.items ?? [])
  return items
}

export async function pausarItem(tenantId: string, ifoodItemId: string): Promise<void> {
  const [token, merchantId] = await Promise.all([getAccessToken(tenantId), getMerchantId(tenantId)])
  const res = await fetch(`${BASE}/catalog/v1.0/merchants/${merchantId}/items/${ifoodItemId}/unavailabilities`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'STOCK' }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`pausarItem failed ${res.status}: ${text}`)
  }
}

export async function reativarItem(tenantId: string, ifoodItemId: string): Promise<void> {
  const [token, merchantId] = await Promise.all([getAccessToken(tenantId), getMerchantId(tenantId)])
  const res = await fetch(`${BASE}/catalog/v1.0/merchants/${merchantId}/items/${ifoodItemId}/unavailabilities`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`reativarItem failed ${res.status}: ${text}`)
  }
}

export async function atualizarPreco(tenantId: string, ifoodItemId: string, novoPreco: number): Promise<void> {
  const [token, merchantId] = await Promise.all([getAccessToken(tenantId), getMerchantId(tenantId)])
  const res = await fetch(`${BASE}/catalog/v1.0/merchants/${merchantId}/items/${ifoodItemId}/prices`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ price: novoPreco }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`atualizarPreco failed ${res.status}: ${text}`)
  }
}

export async function sincronizarDisponibilidade(tenantId: string): Promise<void> {
  const mappings = await prisma.iFoodItemMap.findMany({
    where: { tenantId, produtoId: { not: null } },
    include: {
      produto: {
        include: { ingredients: { include: { ingredient: true } } },
      },
    },
  })

  for (const mapping of mappings) {
    if (!mapping.produto) continue

    const semEstoque = mapping.produto.ingredients.some((pi) => pi.ingredient.currentQty <= 0)

    try {
      if (semEstoque) {
        await pausarItem(tenantId, mapping.ifoodItemId)
      } else {
        await reativarItem(tenantId, mapping.ifoodItemId)
      }
    } catch {
      console.error(`[ifood-catalog-sync] Erro ao sincronizar item ${mapping.ifoodItemId}`)
    }
  }

  await prisma.iFoodIntegration.update({
    where: { tenantId },
    data: { ultimaSincronizacao: new Date() },
  })
}
