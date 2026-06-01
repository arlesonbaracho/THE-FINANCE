import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { checkAiLimit } from '@/lib/middleware/ai-limit.middleware'
import { gerarResposta } from '@/services/ai/estoque-chat.service'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const tenantId = session.user.tenantId as string
  const userId = (session.user as { id: string }).id

  const mensagem = req.nextUrl.searchParams.get('mensagem')?.trim()
  if (!mensagem) return new Response('mensagem é obrigatória', { status: 400 })

  const { permitido } = await checkAiLimit(tenantId)
  if (!permitido) {
    const encoder = new TextEncoder()
    return new Response(
      encoder.encode(
        `data: ${JSON.stringify({ erro: 'Limite mensal de IA atingido' })}\n\ndata: [DONE]\n\n`
      ),
      { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } }
    )
  }

  const historico = await prisma.chatMessage.findMany({
    where: { tenantId, userId },
    orderBy: { createdAt: 'asc' },
    take: 20,
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await gerarResposta(tenantId, userId, historico, mensagem, (chunk) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
          )
        })
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido'
        console.error('[chat-estoque] Gemini error:', msg)

        let erroVisivel = 'Erro ao gerar resposta. Tente novamente.'
        if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid') || msg.includes('UNAUTHENTICATED')) {
          erroVisivel = '❌ GEMINI_API_KEY inválida ou expirada. Copie a chave completa em aistudio.google.com/apikey e reinicie o servidor.'
        } else if (msg.includes('PERMISSION_DENIED') || msg.includes('403')) {
          erroVisivel = '❌ GEMINI_API_KEY sem permissão. Verifique se a chave está ativa no Google AI Studio.'
        } else if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
          erroVisivel = '⚠️ Cota diária do Gemini atingida. Aguarde até amanhã ou use outra chave.'
        } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('ECONNREFUSED')) {
          erroVisivel = '❌ Sem conexão com a API Gemini. Verifique sua internet.'
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ erro: erroVisivel })}\n\n`)
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
