import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { NfOrigem } from '@prisma/client'
import { getSession, unauthorizedResponse } from '@/lib/session'
import { checkAiLimit } from '@/lib/middleware/ai-limit.middleware'
import { uploadNfToCloudinary } from '@/services/ai/nf-processor.service'
import { nfQueue } from '@/lib/queues'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.user?.tenantId) return unauthorizedResponse()
  const tenantId = session.user.tenantId as string
  const userId = (session.user as { id: string }).id

  const { permitido } = await checkAiLimit(tenantId)
  if (!permitido) {
    return NextResponse.json(
      { error: 'Limite mensal de IA atingido. Aguarde o próximo mês ou faça upgrade do plano.' },
      { status: 403 }
    )
  }

  const contentType = req.headers.get('content-type') ?? ''
  let cloudinaryUrl: string | null = null
  let mediaType: string | null = null
  let texto: string | null = null
  let origem: NfOrigem

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo maior que 10MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    mediaType = file.type
    cloudinaryUrl = await uploadNfToCloudinary(buffer, mediaType)
    origem = mediaType === 'application/pdf' ? 'UPLOAD_PDF' : 'UPLOAD_IMAGEM'
  } else {
    const body = (await req.json()) as { texto?: string; cloudinaryUrl?: string; nfOriginalId?: string }

    if (body.cloudinaryUrl && body.nfOriginalId) {
      // Reprocess case — retrieve original NF to derive origem and mediaType
      const original = await prisma.nfProcessada.findFirst({
        where: { id: body.nfOriginalId, tenantId },
        select: { origem: true },
      })
      cloudinaryUrl = body.cloudinaryUrl
      origem = original?.origem ?? 'UPLOAD_IMAGEM'
      mediaType = origem === 'UPLOAD_PDF' ? 'application/pdf' : 'image/jpeg'
    } else if (body.texto?.trim()) {
      texto = body.texto.trim()
      origem = 'TEXTO'
    } else {
      return NextResponse.json({ error: 'Envie um arquivo, texto ou cloudinaryUrl para reprocessamento' }, { status: 400 })
    }
  }

  const nf = await prisma.nfProcessada.create({
    data: {
      tenantId,
      origem,
      cloudinaryUrl,
      status: 'PROCESSANDO',
      rawResponseIa: {},
      processadoPor: userId,
    },
  })

  try {
    await nfQueue.add('process', {
      nfId: nf.id,
      tenantId,
      userId,
      cloudinaryUrl,
      mediaType,
      texto,
    })
  } catch (redisErr) {
    console.warn('[processar-nf] Redis indisponível — NF criada mas job não enfileirado:', (redisErr as Error).message)
    // NF permanece com status PROCESSANDO; o usuário pode reprocessar quando Redis voltar
  }

  return NextResponse.json({ nfId: nf.id, status: 'PROCESSANDO' })
}
