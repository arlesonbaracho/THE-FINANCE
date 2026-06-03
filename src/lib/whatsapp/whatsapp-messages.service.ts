// src/lib/whatsapp/whatsapp-messages.service.ts
import { prisma } from '@/lib/prisma'
import { redisConnection } from '@/lib/bullmq'
import { enviarMensagem } from './evolution.service'
import { isInSilenceWindow } from '@/jobs/alerts/utils'

type AlertaPayload = {
  tenantId: string
  tipo: string
  severidade: string
  titulo: string
  descricao: string
  metadata?: Record<string, unknown>
}

type LogTipo = 'ALERTA_CRITICO' | 'ALERTA_ALTO' | 'ESTOQUE_BAIXO' | 'RESUMO_DIARIO' | 'LIMITE_IA' | 'CONFIRMACAO_BOT' | 'RESPOSTA_BOT' | 'TESTE'

function mascararNumero(numero: string): string {
  const digits = numero.replace(/\D/g, '')
  if (digits.length < 6) return numero
  return numero.slice(0, -8) + ' ****-' + digits.slice(-4)
}

async function salvarLog(
  tenantId: string,
  tipo: LogTipo,
  numero: string,
  conteudo: string,
  status: 'ENVIADO' | 'FALHOU',
  erro?: string
): Promise<void> {
  await prisma.whatsAppLog.create({
    data: { tenantId, tipo, destinatario: mascararNumero(numero), conteudo, status, erro: erro ?? null },
  }).catch((e) => console.error('[whatsapp] log error:', e))
}

async function antiSpam(tenantId: string, chave: string): Promise<boolean> {
  const key = `whatsapp:antispam:${tenantId}:${chave}`
  const exists = await redisConnection.get(key)
  if (exists) return true
  await redisConnection.set(key, '1', 'EX', 7200)
  return false
}

export async function enviarAlerta(tenantId: string, alerta: AlertaPayload): Promise<void> {
  if (alerta.severidade !== 'CRITICA' && alerta.severidade !== 'ALTA') return

  const alertConfig = await prisma.alertConfig.findFirst({
    where: { tenantId, tipoAlerta: alerta.tipo },
  })
  if (alertConfig && isInSilenceWindow(alertConfig as { horarioSilencioInicio?: string | null; horarioSilencioFim?: string | null })) return

  const subtipo = (alerta.metadata as Record<string, string> | undefined)?.subtipo ?? alerta.tipo
  if (await antiSpam(tenantId, subtipo)) return

  const contatos = await prisma.whatsAppContato.findMany({
    where: { tenantId, ativo: true, recebeAlertas: true },
    select: { numero: true },
  })
  if (contatos.length === 0) return

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
  const emoji = alerta.severidade === 'CRITICA' ? '🔴' : '🟠'
  const tipoLabel = alerta.severidade === 'CRITICA' ? 'Crítico' : 'Alto'
  const logTipo: LogTipo = alerta.severidade === 'CRITICA' ? 'ALERTA_CRITICO' : 'ALERTA_ALTO'

  const mensagem = [
    `${emoji} *THE FINANCE — Alerta ${tipoLabel}*`,
    `Restaurante: ${tenant?.name ?? tenantId}`,
    alerta.titulo,
    alerta.descricao,
    `Acesse: app.thefinance.com.br/alertas`,
  ].join('\n')

  for (const { numero } of contatos) {
    const ok = await enviarMensagem(numero, mensagem, tenantId)
    await salvarLog(tenantId, logTipo, numero, mensagem, ok ? 'ENVIADO' : 'FALHOU')
  }
}

export async function enviarResumoDiario(tenantId: string): Promise<void> {
  const contatos = await prisma.whatsAppContato.findMany({
    where: { tenantId, ativo: true, recebeResumoDiario: true },
    select: { numero: true },
  })
  if (contatos.length === 0) return

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
    alertasAtivos > 0 ? `⚠️ ${alertasAtivos} alerta(s) crítico(s) ativo(s)` : `✅ Nenhum alerta crítico ativo`,
    `Acesse: app.thefinance.com.br/dashboard`,
  ].filter(Boolean).join('\n')

  for (const { numero } of contatos) {
    const ok = await enviarMensagem(numero, mensagem, tenantId)
    await salvarLog(tenantId, 'RESUMO_DIARIO', numero, mensagem, ok ? 'ENVIADO' : 'FALHOU')
  }
}

export async function enviarNotificacaoPedidoIfood(
  tenantId: string,
  pedido: { id: string; total: number; ifoodReference?: string | null; enderecoEntrega?: Record<string, unknown> }
): Promise<void> {
  const contatos = await prisma.whatsAppContato.findMany({
    where: { tenantId, ativo: true, recebeAlertas: true },
    select: { numero: true },
  })
  if (contatos.length === 0) return

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

  for (const { numero } of contatos) {
    const ok = await enviarMensagem(numero, mensagem, tenantId)
    await salvarLog(tenantId, 'ALERTA_ALTO', numero, mensagem, ok ? 'ENVIADO' : 'FALHOU')
  }
}

export async function enviarAlertaLimiteIA(tenantId: string, percentual: 80 | 100): Promise<void> {
  const contatos = await prisma.whatsAppContato.findMany({
    where: { tenantId, ativo: true, recebeAlertas: true },
    select: { numero: true },
  })
  if (contatos.length === 0) return

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
  const emoji = percentual === 100 ? '🚫' : '⚠️'
  const label = percentual === 100 ? '100% — uso bloqueado' : '80% do limite mensal atingido'

  const mensagem = [
    `${emoji} *THE FINANCE — Limite de IA*`,
    `Restaurante: ${tenant?.name ?? tenantId}`,
    `Uso de IA: ${label}.`,
    `Acesse: app.thefinance.com.br/configuracoes/assinatura`,
  ].join('\n')

  for (const { numero } of contatos) {
    const ok = await enviarMensagem(numero, mensagem, tenantId)
    await salvarLog(tenantId, 'LIMITE_IA', numero, mensagem, ok ? 'ENVIADO' : 'FALHOU')
  }
}

export async function enviarTeste(tenantId: string, numero: string): Promise<boolean> {
  const mensagem = [
    `✅ *THE FINANCE — Mensagem de Teste*`,
    `WhatsApp configurado com sucesso!`,
    `As notificações serão enviadas para este número.`,
  ].join('\n')
  const ok = await enviarMensagem(numero, mensagem, tenantId)
  await salvarLog(tenantId, 'TESTE', numero, mensagem, ok ? 'ENVIADO' : 'FALHOU')
  return ok
}
