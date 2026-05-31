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
      } catch {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ erro: 'Erro ao gerar resposta' })}\n\n`)
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
