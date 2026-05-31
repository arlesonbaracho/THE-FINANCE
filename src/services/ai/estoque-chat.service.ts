import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { incrementarUso } from './ai-usage.service'
import type { ChatMessage } from '@prisma/client'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function montarContextoEstoque(tenantId: string): Promise<string> {
  const [ingredients, movements, alerts] = await Promise.all([
    prisma.ingredient.findMany({
      where: { tenantId },
      select: {
        id: true, name: true, currentQty: true, minimumQty: true,
        unit: true, custoMedioPonderado: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.ingredientMovement.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        type: true, quantity: true, unitCost: true, createdAt: true,
        ingredient: { select: { name: true } },
      },
    }),
    prisma.alert.findMany({
      where: { tenantId, status: { in: ['NAO_LIDO', 'LIDO'] } },
      select: { tipo: true, titulo: true, criadoEm: true },
      orderBy: { criadoEm: 'desc' },
      take: 10,
    }),
  ])

  return JSON.stringify({ ingredients, movements, alerts })
}

export async function gerarResposta(
  tenantId: string,
  userId: string,
  historico: ChatMessage[],
  novaMensagem: string,
  onChunk: (text: string) => void
): Promise<void> {
  const contexto = await montarContextoEstoque(tenantId)

  const systemPrompt = `Você é um assistente de gestão de estoque para um restaurante brasileiro.
Responda em português sobre níveis de estoque, movimentações, custos e alertas.
Use os dados em tempo real abaixo para responder com precisão:

${contexto}`

  const messages: Anthropic.Messages.MessageParam[] = [
    ...historico.map((msg) => ({
      role: msg.role === 'USER' ? ('user' as const) : ('assistant' as const),
      content: msg.content,
    })),
    { role: 'user', content: novaMensagem },
  ]

  let fullResponse = ''
  const stream = anthropic.messages.stream({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514',
    max_tokens: parseInt(process.env.AI_MAX_TOKENS_PER_REQUEST ?? '2000'),
    system: systemPrompt,
    messages,
  })

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      fullResponse += chunk.delta.text
      onChunk(chunk.delta.text)
    }
  }

  const finalMessage = await stream.finalMessage()
  const tokensInput = finalMessage.usage.input_tokens
  const tokensOutput = finalMessage.usage.output_tokens

  await prisma.$transaction([
    prisma.chatMessage.create({
      data: { tenantId, userId, role: 'USER', content: novaMensagem, tokensUsados: 0 },
    }),
    prisma.chatMessage.create({
      data: { tenantId, userId, role: 'ASSISTANT', content: fullResponse, tokensUsados: tokensOutput },
    }),
  ])

  await incrementarUso(tenantId, tokensInput, tokensOutput)
}
