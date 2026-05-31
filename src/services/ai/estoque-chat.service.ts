import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '@/lib/prisma'
import { incrementarUso } from './ai-usage.service'
import type { ChatMessage } from '@prisma/client'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

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

  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
    systemInstruction: systemPrompt,
  })

  const chat = model.startChat({
    history: historico.map((msg) => ({
      role: msg.role === 'USER' ? ('user' as const) : ('model' as const),
      parts: [{ text: msg.content }],
    })),
  })

  let fullResponse = ''
  const stream = await chat.sendMessageStream(novaMensagem)

  for await (const chunk of stream.stream) {
    const text = chunk.text()
    if (text) {
      fullResponse += text
      onChunk(text)
    }
  }

  const response = await stream.response
  const tokensInput = response.usageMetadata?.promptTokenCount ?? 0
  const tokensOutput = response.usageMetadata?.candidatesTokenCount ?? 0

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
