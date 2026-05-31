import { GoogleGenerativeAI, type Part } from '@google/generative-ai'
import levenshtein from 'fast-levenshtein'
import { prisma } from '@/lib/prisma'
import { uploadBuffer } from '@/lib/cloudinary'
import type { ItemExtraido, ItemEnriquecido, NfExtraidaData } from './types'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const SYSTEM_PROMPT_NF = `You are a fiscal invoice (Nota Fiscal) data extraction assistant for a Brazilian restaurant management system.

Extract structured data from the provided invoice image, PDF, or text description.

Return ONLY a valid JSON object — no explanatory text, no markdown code blocks, just the raw JSON:

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
  return uploadBuffer(buffer, { folder: 'nfs', resource_type: resourceType, contentType: mediaType })
}

export async function extrairItensComClaude(params: {
  cloudinaryUrl?: string | null
  mediaType?: string | null
  texto?: string | null
}): Promise<{ data: NfExtraidaData; tokensInput: number; tokensOutput: number }> {
  const { cloudinaryUrl, mediaType, texto } = params

  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
    systemInstruction: SYSTEM_PROMPT_NF,
  })

  const parts: Part[] = []

  if (cloudinaryUrl && mediaType) {
    const fileRes = await fetch(cloudinaryUrl)
    const buffer = Buffer.from(await fileRes.arrayBuffer())
    const base64 = buffer.toString('base64')

    parts.push({
      inlineData: {
        data: base64,
        mimeType: mediaType,
      },
    })
    parts.push({ text: 'Extract all items from this invoice. Return only the JSON.' })
  } else {
    parts.push({ text: texto ?? '' })
  }

  const result = await model.generateContent(parts)
  const rawText = result.response.text()

  // Strip markdown code fences if Gemini wraps the JSON
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  let data: NfExtraidaData
  try {
    data = JSON.parse(cleaned) as NfExtraidaData
  } catch {
    data = { fornecedor: null, numeroNf: null, dataEmissao: null, valorTotal: null, itens: [] }
  }

  const tokensInput = result.response.usageMetadata?.promptTokenCount ?? 0
  const tokensOutput = result.response.usageMetadata?.candidatesTokenCount ?? 0

  return { data, tokensInput, tokensOutput }
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
