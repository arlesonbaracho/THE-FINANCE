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
    const raw = error instanceof Error ? error.message : 'Erro desconhecido no processamento'
    console.error('[nf-processor.job] Erro:', raw)

    let mensagem = raw
    if (raw.includes('API_KEY_INVALID') || raw.includes('API key not valid')) {
      mensagem = 'Chave GEMINI_API_KEY inválida. Verifique o .env.'
    } else if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('quota')) {
      mensagem = 'Cota diária do Gemini atingida. Tente novamente amanhã.'
    }

    await marcarNfErro(nfId, mensagem)
    io.to(tenantId).emit('nf:erro', { nfId, mensagem })
    throw error
  }
}
