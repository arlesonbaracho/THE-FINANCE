import { prisma } from '@/lib/prisma'
import { enviarMensagem } from './zapi.service'
import { isInSilenceWindow } from '@/jobs/alerts/utils'

type WhatsAppConfig = {
  alertas?:      { ativo?: boolean; numeros?: string[] }
  resumoDiario?: { ativo?: boolean; numeros?: string[] }
  ifood?:        { ativo?: boolean; threshold?: number; numeros?: string[] }
}

type AlertaPayload = {
  tenantId: string
  tipo: string
  severidade: string
  titulo: string
  descricao: string
  metadata?: Record<string, unknown>
}

async function getConfig(tenantId: string): Promise<WhatsAppConfig | null> {
  const integration = await prisma.whatsAppIntegration.findUnique({
    where: { tenantId },
    select: { config: true, status: true },
  })
  if (!integration || integration.status !== 'CONECTADO') return null
  return (integration.config ?? {}) as WhatsAppConfig
}

async function jaNotificadoNas2h(tenantId: string, subtipo: string): Promise<boolean> {
  const doisHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000)
  const existing = await prisma.whatsAppLog.findFirst({
    where: {
      tenantId,
      tipo: 'ALERTA',
      status: 'ENVIADO',
      createdAt: { gte: doisHorasAtras },
      mensagem: { contains: subtipo },
    },
  })
  return !!existing
}

export async function enviarAlerta(tenantId: string, alerta: AlertaPayload): Promise<void> {
  if (alerta.severidade !== 'CRITICA' && alerta.severidade !== 'ALTA') return

  const config = await getConfig(tenantId)
  if (!config?.alertas?.ativo) return

  const numeros = config.alertas.numeros ?? []
  if (numeros.length === 0) return

  const alertConfig = await prisma.alertConfig.findFirst({
    where: { tenantId, tipoAlerta: alerta.tipo },
  })
  if (alertConfig && isInSilenceWindow(alertConfig as { horarioSilencioInicio?: string | null; horarioSilencioFim?: string | null })) return

  const subtipo = (alerta.metadata as Record<string, string> | undefined)?.subtipo ?? alerta.tipo
  if (await jaNotificadoNas2h(tenantId, subtipo)) return

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
  const severidadeEmoji = alerta.severidade === 'CRITICA' ? '🔴' : '🟠'

  const mensagem = [
    `${severidadeEmoji} *THE FINANCE — Alerta ${alerta.severidade === 'CRITICA' ? 'Crítico' : 'Alto'}*`,
    `Restaurante: ${tenant?.name ?? tenantId}`,
    alerta.titulo,
    alerta.descricao,
    `Acesse: app.thefinance.com.br/alertas`,
  ].join('\n')

  for (const numero of numeros) {
    await enviarMensagem(tenantId, numero, mensagem, 'ALERTA')
  }
}

export async function enviarResumoDiario(tenantId: string): Promise<void> {
  const config = await getConfig(tenantId)
  if (!config?.resumoDiario?.ativo) return

  const numeros = config.resumoDiario.numeros ?? []
  if (numeros.length === 0) return

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const [pedidos, movimentos, alertasAtivos] = await Promise.all([
    prisma.pedido.findMany({
      where: { tenantId, status: 'FINALIZADO', fechadoEm: { gte: hoje } },
      select: { total: true, itens: { include: { product: { select: { name: true } } } } },
    }),
    prisma.ingredientMovement.findMany({
      where: { tenantId, type: 'OUT', createdAt: { gte: hoje } },
      select: { totalCost: true },
    }),
    prisma.alert.count({
      where: { tenantId, status: { in: ['NAO_LIDO', 'LIDO'] }, severidade: 'CRITICA' },
    }),
  ])

  const totalVendas = pedidos.reduce((s, p) => s + p.total, 0)
  const numPedidos = pedidos.length
  const ticketMedio = numPedidos > 0 ? totalVendas / numPedidos : 0
  const cmvTotal = movimentos.reduce((s, m) => s + (m.totalCost ?? 0), 0)
  const cmvPct = totalVendas > 0 ? (cmvTotal / totalVendas) * 100 : 0

  const produtoCount = new Map<string, number>()
  for (const pedido of pedidos) {
    for (const item of pedido.itens) {
      const nome = item.product.name
      produtoCount.set(nome, (produtoCount.get(nome) ?? 0) + 1)
    }
  }
  const topProduto = Array.from(produtoCount.entries()).sort((a, b) => b[1] - a[1])[0]

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const cmvEmoji = cmvPct > 38 ? '🔴' : cmvPct > 32 ? '🟡' : '🟢'
  const dataStr = hoje.toLocaleDateString('pt-BR')

  const mensagem = [
    `📊 *THE FINANCE — Resumo do Dia*`,
    `Restaurante: ${tenant?.name ?? tenantId} | ${dataStr}`,
    ``,
    `💰 Vendas: ${fmt(totalVendas)}`,
    `🛒 Pedidos: ${numPedidos} | Ticket médio: ${fmt(ticketMedio)}`,
    `📉 CMV: ${cmvPct.toFixed(1)}% ${cmvEmoji}`,
    topProduto ? `🏆 Mais vendido: ${topProduto[0]} (${topProduto[1]}x)` : '',
    ``,
    alertasAtivos > 0
      ? `⚠️ ${alertasAtivos} alerta(s) crítico(s) ativo(s)`
      : `✅ Nenhum alerta crítico ativo`,
    `Acesse: app.thefinance.com.br/dashboard`,
  ].filter(Boolean).join('\n')

  for (const numero of numeros) {
    await enviarMensagem(tenantId, numero, mensagem, 'RESUMO_DIARIO')
  }
}

export async function enviarNotificacaoPedidoIfood(
  tenantId: string,
  pedido: { id: string; total: number; ifoodReference?: string | null; enderecoEntrega?: Record<string, unknown> }
): Promise<void> {
  const config = await getConfig(tenantId)
  if (!config?.ifood?.ativo) return

  const threshold = config.ifood.threshold ?? 0
  if (pedido.total < threshold) return

  const numeros = config.ifood.numeros ?? []
  if (numeros.length === 0) return

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const endereco = pedido.enderecoEntrega
  const enderecoStr = endereco
    ? [endereco.streetName, endereco.streetNumber, endereco.neighborhood].filter(Boolean).join(', ')
    : 'Endereço não informado'

  const mensagem = [
    `🛵 *Novo pedido iFood!*`,
    `Restaurante: ${tenant?.name ?? tenantId}`,
    pedido.ifoodReference ? `Pedido: #${pedido.ifoodReference} | ${fmt(pedido.total)}` : `Valor: ${fmt(pedido.total)}`,
    `Endereço: ${enderecoStr}`,
  ].join('\n')

  for (const numero of numeros) {
    await enviarMensagem(tenantId, numero, mensagem, 'PEDIDO_IFOOD')
  }
}

export async function enviarAlertaLimiteIA(tenantId: string, percentual: 80 | 100): Promise<void> {
  const config = await getConfig(tenantId)
  const numeros = config?.alertas?.numeros ?? []
  if (numeros.length === 0) return

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
  const emoji = percentual === 100 ? '🚫' : '⚠️'
  const label = percentual === 100 ? '100% — uso bloqueado' : '80% do limite mensal atingido'

  const mensagem = [
    `${emoji} *THE FINANCE — Limite de IA*`,
    `Restaurante: ${tenant?.name ?? tenantId}`,
    `Uso de IA: ${label}.`,
    `Acesse: app.thefinance.com.br/configuracoes/assinatura`,
  ].join('\n')

  for (const numero of numeros) {
    await enviarMensagem(tenantId, numero, mensagem, 'ALERTA')
  }
}
