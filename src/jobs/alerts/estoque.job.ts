import { prisma } from '@/lib/prisma'
import type { Server as SocketIOServer } from 'socket.io'
import { antiSpamEstoque, createAlert, isInSilenceWindow } from './utils'

export async function processEstoqueAlerts(io: SocketIOServer): Promise<void> {
  const tenants = await prisma.tenant.findMany({
    where: { active: true, deletedAt: null },
    select: { id: true },
  })

  for (const { id: tenantId } of tenants) {
    const config = await prisma.alertConfig.findFirst({
      where: { tenantId, tipoAlerta: 'ESTOQUE' },
    })
    if (config && !config.ativo) continue
    if (config && isInSilenceWindow(config as { horarioSilencioInicio?: string | null; horarioSilencioFim?: string | null })) continue

    const ingredients = await prisma.ingredient.findMany({
      where: { tenantId },
      select: {
        id: true, name: true, currentQty: true,
        minimumQty: true, pontoReposicao: true, dataValidade: true,
      },
    })

    for (const ing of ingredients) {
      // 1. Estoque zerado
      if (ing.currentQty === 0) {
        if (await antiSpamEstoque(tenantId, ing.id)) continue
        await createAlert({
          tenantId, tipo: 'ESTOQUE', severidade: 'CRITICA',
          titulo: `${ing.name} zerou o estoque`,
          descricao: `O insumo "${ing.name}" está com estoque zero.`,
          insumoId: ing.id,
          metadata: { subtipo: 'ESTOQUE_ZERADO', acao: 'Lançar entrada' },
        }, io)
        continue
      }

      // 2. Abaixo do mínimo
      if (ing.minimumQty > 0 && ing.currentQty < ing.minimumQty) {
        if (await antiSpamEstoque(tenantId, ing.id)) continue
        await createAlert({
          tenantId, tipo: 'ESTOQUE', severidade: 'ALTA',
          titulo: `${ing.name} abaixo do mínimo (${ing.currentQty} unidades restantes)`,
          descricao: `Estoque atual: ${ing.currentQty}. Mínimo: ${ing.minimumQty}.`,
          insumoId: ing.id,
          metadata: { subtipo: 'ABAIXO_MINIMO', acao: 'Lançar entrada', qtdAtual: ing.currentQty, qtdMinima: ing.minimumQty },
        }, io)
        continue
      }

      // 3. Abaixo do ponto de reposição
      if (ing.pontoReposicao > 0 && ing.currentQty < ing.pontoReposicao) {
        if (await antiSpamEstoque(tenantId, ing.id)) continue
        await createAlert({
          tenantId, tipo: 'ESTOQUE', severidade: 'MEDIA',
          titulo: `${ing.name} chegando ao ponto de reposição`,
          descricao: `Estoque atual: ${ing.currentQty}. Ponto de reposição: ${ing.pontoReposicao}.`,
          insumoId: ing.id,
          metadata: { subtipo: 'PONTO_REPOSICAO', acao: 'Planejar compra' },
        }, io)
      }

      // 4 e 5. Validade
      if (ing.dataValidade) {
        const now = new Date()
        const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        const daysLeft = Math.ceil((ing.dataValidade.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        if (ing.dataValidade < now) {
          if (await antiSpamEstoque(tenantId, ing.id)) continue
          await createAlert({
            tenantId, tipo: 'ESTOQUE', severidade: 'CRITICA',
            titulo: `${ing.name} está vencido — remover do estoque`,
            descricao: `Venceu em ${ing.dataValidade.toLocaleDateString('pt-BR')}.`,
            insumoId: ing.id,
            metadata: { subtipo: 'VENCIDO', acao: 'Lançar baixa' },
          }, io)
        } else if (ing.dataValidade <= sevenDays) {
          if (await antiSpamEstoque(tenantId, ing.id)) continue
          await createAlert({
            tenantId, tipo: 'ESTOQUE', severidade: 'ALTA',
            titulo: `${ing.name} vence em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}`,
            descricao: `Data de validade: ${ing.dataValidade.toLocaleDateString('pt-BR')}.`,
            insumoId: ing.id,
            metadata: { subtipo: 'PROXIMO_VENCIMENTO', acao: 'Ver insumo', diasRestantes: daysLeft },
          }, io)
        }
      }
    }
  }
}
