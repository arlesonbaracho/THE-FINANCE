import { prisma } from '@/lib/prisma'
import { enriquecerItens } from '@/services/ai/nf-processor.service'
import type { ItemExtraido } from '@/services/ai/types'

const UNIDADES = ['KG', 'G', 'L', 'ML', 'UN']

function mapUnidade(u: string): string {
  const up = u.toUpperCase()
  return UNIDADES.includes(up) ? up : 'UN'
}

export function parseItensNfe(xml: string): ItemExtraido[] {
  const itens: ItemExtraido[] = []
  const prodBlocks = xml.match(/<prod>[\s\S]*?<\/prod>/g) ?? []
  for (const block of prodBlocks) {
    const get = (tag: string) => block.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`))?.[1] ?? ''
    const quantidade = Number(get('qCom') || 0)
    const custoUnitario = Number(get('vUnCom') || 0)
    itens.push({
      descricao: get('xProd'),
      quantidade,
      unidade: mapUnidade(get('uCom')),
      custoUnitario,
      custoTotal: Math.round(quantidade * custoUnitario * 100) / 100,
    })
  }
  return itens
}

export async function prepararImportacao(tenantId: string, nfId: string) {
  const nf = await prisma.nfProcessada.findFirst({ where: { id: nfId, tenantId } })
  if (!nf?.xml) throw new Error('NF sem XML para importar')
  const itens = parseItensNfe(nf.xml)
  const enriquecidos = await enriquecerItens(tenantId, itens)
  return { nfId, itens: enriquecidos }
}

export interface ItemConfirmado {
  insumoId: string
  quantidade: number
  custoUnitario: number
}

/**
 * Applies a batch stock IN entry for the given items, mirroring the logic in
 * src/app/api/estoque/entrada-lote/route.ts:
 *   - fetches current qty + CMP per ingredient
 *   - recalculates weighted-average cost (CMP)
 *   - updates ingredient.currentQty, custoMedioPonderado, unitCost
 *   - creates IngredientMovement type=IN
 *   - marks NfProcessada as CONCLUIDA with importadoEstoqueEm
 * All wrapped in a single prisma.$transaction.
 */
export async function aplicarEntradaEstoque(
  tenantId: string,
  userId: string,
  nfId: string,
  itens: ItemConfirmado[]
): Promise<{ itensCriados: number }> {
  let itensCriados = 0

  await prisma.$transaction(async (tx) => {
    for (const item of itens) {
      if (!item.insumoId) continue

      const ingredient = await tx.ingredient.findFirst({
        where: { id: item.insumoId, tenantId },
        select: { id: true, currentQty: true, custoMedioPonderado: true },
      })
      if (!ingredient) continue

      const { currentQty: qtdAtual, custoMedioPonderado: cmpAtual } = ingredient
      const { quantidade: qtdEntrada, custoUnitario } = item

      const novoCmp =
        qtdAtual + qtdEntrada > 0
          ? (qtdAtual * cmpAtual + qtdEntrada * custoUnitario) / (qtdAtual + qtdEntrada)
          : custoUnitario

      await tx.ingredient.update({
        where: { id: ingredient.id },
        data: {
          currentQty: qtdAtual + qtdEntrada,
          custoMedioPonderado: novoCmp,
          unitCost: custoUnitario,
        },
      })

      await tx.ingredientMovement.create({
        data: {
          ingredientId: ingredient.id,
          tenantId,
          type: 'IN',
          quantity: qtdEntrada,
          unitCost: custoUnitario,
          totalCost: qtdEntrada * custoUnitario,
          reason: `NF Fiscal ${nfId}`,
          note: `Importado via NF-e capturada do SEFAZ`,
          createdBy: userId,
        },
      })

      itensCriados++
    }

    await tx.nfProcessada.update({
      where: { id: nfId },
      data: {
        status: 'CONCLUIDA',
        importadoEstoqueEm: new Date(),
        itensCriados,
      },
    })
  })

  return { itensCriados }
}
