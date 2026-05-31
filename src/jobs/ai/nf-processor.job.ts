import type { Job } from 'bullmq'
import type { Server as SocketIOServer } from 'socket.io'
import {
  extrairItensComClaude,
  enriquecerItens,
  salvarNfStatus,
  marcarNfErro,
} from '@/services/ai/nf-processor.service'
import { incrementarUso } from '@/services/ai/ai-usage.service'

export interface NfJobPayload {
  nfId: string
  tenantId: string
  userId: string
  cloudinaryUrl?: string | null
  mediaType?: string | null
  texto?: string | null
}

export async function processNfJob(
  job: Job<NfJobPayload>,
  io: SocketIOServer
): Promise<void> {
  const { nfId, tenantId, cloudinaryUrl, mediaType, texto } = job.data

  try {
    const { data, tokensInput, tokensOutput } = await extrairItensComClaude({
      cloudinaryUrl,
      mediaType,
      texto,
    })

    const itensEnriquecidos = await enriquecerItens(tenantId, data.itens)
    const rawResponseIa = { ...data, itensEnriquecidos }

    await salvarNfStatus(nfId, data, rawResponseIa, 0)
    await incrementarUso(tenantId, tokensInput, tokensOutput)

    io.to(tenantId).emit('nf:processada', { nfId, dados: rawResponseIa })
  } catch (error) {
    const mensagem =
      error instanceof Error ? error.message : 'Erro desconhecido no processamento'
    await marcarNfErro(nfId, mensagem)
    io.to(tenantId).emit('nf:erro', { nfId, mensagem })
    throw error
  }
}
