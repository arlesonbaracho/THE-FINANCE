import { prisma } from '@/lib/prisma'
import { listarItensCatalogo, type IFoodItem } from './ifood-catalog.service'
import { melhorMatchPorNome } from '@/lib/match-nome'

const LIMIAR_CASAR = 80

export type ItemPreview = {
  ifoodItemId: string
  ifoodItemNome: string
  preco: number
  categoriaNome: string | null
  sugestao: 'mapeado' | 'casar' | 'criar'
  produtoSugeridoId: string | null
  score: number | null
}
export type DecisaoImport = {
  ifoodItemId: string
  ifoodItemNome: string
  preco: number
  categoriaNome: string | null
  acao: 'criar' | 'casar' | 'ignorar'
  produtoId?: string
}

type CarregarCatalogo = (tenantId: string) => Promise<IFoodItem[]>

export async function prepararImportacaoCardapio(
  tenantId: string,
  carregarCatalogo: CarregarCatalogo = listarItensCatalogo,
): Promise<ItemPreview[]> {
  const [itens, maps, produtos] = await Promise.all([
    carregarCatalogo(tenantId),
    prisma.iFoodItemMap.findMany({ where: { tenantId }, select: { ifoodItemId: true, produtoId: true } }),
    prisma.product.findMany({ where: { tenantId }, select: { id: true, name: true } }),
  ])
  const mapeados = new Map(maps.filter((m) => m.produtoId).map((m) => [m.ifoodItemId, m.produtoId as string]))

  return itens.map((it) => {
    if (mapeados.has(it.id)) {
      return { ifoodItemId: it.id, ifoodItemNome: it.name, preco: it.price, categoriaNome: it.categoryName ?? null, sugestao: 'mapeado', produtoSugeridoId: mapeados.get(it.id)!, score: null }
    }
    const best = melhorMatchPorNome(it.name, produtos)
    const casar = best != null && best.score >= LIMIAR_CASAR
    return {
      ifoodItemId: it.id, ifoodItemNome: it.name, preco: it.price, categoriaNome: it.categoryName ?? null,
      sugestao: casar ? 'casar' : 'criar',
      produtoSugeridoId: casar ? best.id : null,
      score: best?.score ?? null,
    }
  })
}

async function resolverCategoria(tenantId: string, nome: string | null): Promise<string | null> {
  if (!nome) return null
  const existente = await prisma.category.findUnique({
    where: { name_type_tenantId: { name: nome, type: 'PRODUCT', tenantId } },
  })
  if (existente) return existente.id
  const nova = await prisma.category.create({ data: { name: nome, type: 'PRODUCT', tenantId } })
  return nova.id
}

export async function confirmarImportacaoCardapio(
  tenantId: string,
  decisoes: DecisaoImport[],
): Promise<{ criados: number; mapeados: number }> {
  let criados = 0
  let mapeados = 0
  for (const d of decisoes) {
    if (d.acao === 'ignorar') continue
    if (d.acao === 'criar') {
      const categoryId = await resolverCategoria(tenantId, d.categoriaNome)
      const produto = await prisma.product.create({
        data: { name: d.ifoodItemNome, salePrice: d.preco, tenantId, ...(categoryId ? { categoryId } : {}) },
      })
      await prisma.iFoodItemMap.upsert({
        where: { tenantId_ifoodItemId: { tenantId, ifoodItemId: d.ifoodItemId } },
        create: { tenantId, ifoodItemId: d.ifoodItemId, ifoodItemNome: d.ifoodItemNome, produtoId: produto.id },
        update: { produtoId: produto.id },
      })
      criados++
    } else if (d.acao === 'casar' && d.produtoId) {
      await prisma.iFoodItemMap.upsert({
        where: { tenantId_ifoodItemId: { tenantId, ifoodItemId: d.ifoodItemId } },
        create: { tenantId, ifoodItemId: d.ifoodItemId, ifoodItemNome: d.ifoodItemNome, produtoId: d.produtoId },
        update: { produtoId: d.produtoId },
      })
      mapeados++
    }
  }
  return { criados, mapeados }
}
