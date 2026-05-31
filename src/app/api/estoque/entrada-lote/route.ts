import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/session'

interface ItemLote {
  insumoId: string
  quantidade: number
  custoUnitario: number
  incluir: boolean
}

interface EntradaLoteBody {
  nfId: string
  fornecedorNome: string
  numeroNf?: string
  dataRecebimento: string
  itens: ItemLote[]
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const tenantId = session.user.tenantId as string
  const userId = (session.user as { id: string }).id

  const body = (await req.json()) as EntradaLoteBody
  const { nfId, fornecedorNome, numeroNf, dataRecebimento, itens } = body

  if (!itens?.length) {
    return NextResponse.json({ error: 'Nenhum item enviado' }, { status: 400 })
  }

  const nf = await prisma.nfProcessada.findFirst({ where: { id: nfId, tenantId } })
  if (!nf) return NextResponse.json({ error: 'NF não encontrada' }, { status: 404 })

  const itensALancar = itens.filter((i) => i.incluir && i.insumoId)
  if (itensALancar.length === 0) {
    return NextResponse.json({ error: 'Nenhum item marcado para incluir' }, { status: 400 })
  }

  let itensCriados = 0

  await prisma.$transaction(async (tx) => {
    for (const item of itensALancar) {
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
          reason: `NF ${numeroNf ?? nfId} — ${fornecedorNome}`,
          note: `Recebido em ${dataRecebimento}`,
          createdBy: userId,
        },
      })

      itensCriados++
    }

    await tx.nfProcessada.update({
      where: { id: nfId },
      data: { status: 'CONCLUIDA', fornecedorNome, numeroNf, itensCriados },
    })
  })

  return NextResponse.json({ ok: true, itensCriados })
}
