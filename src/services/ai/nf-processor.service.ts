import Anthropic from '@anthropic-ai/sdk'
import levenshtein from 'fast-levenshtein'
import { prisma } from '@/lib/prisma'
import { uploadBuffer } from '@/lib/cloudinary'
import type { ItemExtraido, ItemEnriquecido, NfExtraidaData } from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const SYSTEM_PROMPT_NF = `You are a fiscal invoice (Nota Fiscal) data extraction assistant for a Brazilian restaurant management system.

Extract structured data from the provided invoice image, PDF, or text description.

Return ONLY a valid JSON object — no explanatory text, no markdown, just the JSON:

{
  "fornecedor": "supplier company name or null",
  "numeroNf": "NF number/code or null",
  "dataEmissao": "YYYY-MM-DD or null",
  "valorTotal": 0.00,
  "itens": [
    {
      "descricao": "product description as written on invoice",
      "quantidade": 0,
      "unidade": "UN or KG or G or L or ML",
      "custoUnitario": 0.00,
      "custoTotal": 0.00
    }
  ]
}

Rules:
- All monetary values in decimal (e.g. 12.50, not "R$12,50")
- If a field is missing, use null
- Map unidade to one of: UN, KG, G, L, ML
- Return empty itens array [] if no items are identifiable`

export async function uploadNfToCloudinary(buffer: Buffer, mediaType: string): Promise<string> {
  const resourceType = mediaType === 'application/pdf' ? 'raw' : 'image'
  return uploadBuffer(buffer, { folder: 'nfs', resource_type: resourceType })
}

export async function extrairItensComClaude(params: {
  cloudinaryUrl?: string | null
  mediaType?: string | null
  texto?: string | null
}): Promise<{ data: NfExtraidaData; tokensInput: number; tokensOutput: number }> {
  const { cloudinaryUrl, mediaType, texto } = params
  let content: Anthropic.Messages.MessageParam['content']

  if (cloudinaryUrl && mediaType) {
    const fileRes = await fetch(cloudinaryUrl)
    const buffer = Buffer.from(await fileRes.arrayBuffer())
    const base64 = buffer.toString('base64')

    if (mediaType === 'application/pdf') {
      content = [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        } as Anthropic.Messages.DocumentBlockParam,
      ]
    } else {
      const imgType = (
        mediaType === 'image/jpeg' || mediaType === 'image/png' ||
        mediaType === 'image/gif' || mediaType === 'image/webp'
          ? mediaType
          : 'image/jpeg'
      ) as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

      content = [
        { type: 'image', source: { type: 'base64', media_type: imgType, data: base64 } },
        { type: 'text', text: 'Extract all line items from this invoice.' },
      ]
    }
  } else {
    content = [{ type: 'text', text: texto ?? '' }]
  }

  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514',
    max_tokens: parseInt(process.env.AI_MAX_TOKENS_PER_REQUEST ?? '2000'),
    system: SYSTEM_PROMPT_NF,
    messages: [{ role: 'user', content }],
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text : '{}'
  let data: NfExtraidaData
  try {
    data = JSON.parse(rawText) as NfExtraidaData
  } catch {
    data = { fornecedor: null, numeroNf: null, dataEmissao: null, valorTotal: null, itens: [] }
  }

  return { data, tokensInput: response.usage.input_tokens, tokensOutput: response.usage.output_tokens }
}

export async function enriquecerItens(
  tenantId: string,
  itens: ItemExtraido[]
): Promise<ItemEnriquecido[]> {
  const ingredients = await prisma.ingredient.findMany({
    where: { tenantId },
    select: { id: true, name: true },
  })

  if (ingredients.length === 0) {
    return itens.map((item) => ({ ...item, insumoId: null, insumoNome: null, scoreConfianca: 0 }))
  }

  return itens.map((item) => {
    const termo = item.descricao.toLowerCase()

    const scored = ingredients.map((ing) => {
      const name = ing.name.toLowerCase()
      const dist = levenshtein.get(termo, name)
      const maxLen = Math.max(termo.length, name.length)
      const score = maxLen === 0 ? 0 : Math.round((1 - dist / maxLen) * 100)
      return { ...ing, score }
    })

    const best = scored.sort((a, b) => b.score - a.score)[0]
    const scoreConfianca = Math.max(0, Math.min(100, best.score))

    return { ...item, insumoId: best.id, insumoNome: best.name, scoreConfianca }
  })
}

export async function salvarNfStatus(
  nfId: string,
  dados: NfExtraidaData,
  rawResponseIa: object,
  itensCriados: number
): Promise<void> {
  await prisma.nfProcessada.update({
    where: { id: nfId },
    data: {
      status: 'CONCLUIDA',
      fornecedorNome: dados.fornecedor,
      numeroNf: dados.numeroNf,
      dataEmissao: dados.dataEmissao ? new Date(dados.dataEmissao) : null,
      valorTotal: dados.valorTotal,
      rawResponseIa,
      itensCriados,
    },
  })
}

export async function marcarNfErro(nfId: string, mensagem: string): Promise<void> {
  await prisma.nfProcessada.update({
    where: { id: nfId },
    data: { status: 'ERRO', rawResponseIa: { erro: mensagem } },
  })
}
