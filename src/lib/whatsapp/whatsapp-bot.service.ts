// src/lib/whatsapp/whatsapp-bot.service.ts
import { prisma } from '@/lib/prisma'
import { redisConnection } from '@/lib/bullmq'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { enviarMensagem } from './evolution.service'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'

const SYSTEM_PROMPT = `Você é um assistente de gestão de restaurantes. Analise a mensagem e retorne APENAS um JSON válido, sem markdown, sem explicações.

Esquema esperado:
{
  "intencao": "NOVO_INSUMO" | "NOVO_PRODUTO" | "DESCONHECIDO",
  "dados": {
    "nome": string,
    "unidade": "KG" | "G" | "L" | "ML" | "UN",
    "custoUnitario": number,
    "quantidadeInicial": number | null,
    "precoVenda": number | null,
    "insumos": [{ "nome": string, "quantidade": number, "unidade": string }]
  },
  "camposFaltando": string[]
}

Regras:
- unidade deve ser normalizada para os valores do enum
- custoUnitario e precoVenda em reais como número decimal
- Se a intenção não for clara, retornar DESCONHECIDO com dados vazio
- camposFaltando lista apenas campos obrigatórios ausentes`

type BotIntencao = 'NOVO_INSUMO' | 'NOVO_PRODUTO' | 'DESCONHECIDO'

type BotSession = {
  intencao: BotIntencao
  dados: Record<string, unknown>
  expiraEm: number
}

type GeminiResponse = {
  intencao: BotIntencao
  dados: {
    nome?: string
    unidade?: string
    custoUnitario?: number
    quantidadeInicial?: number | null
    precoVenda?: number | null
    insumos?: Array<{ nome: string; quantidade: number; unidade: string }>
  }
  camposFaltando: string[]
}

const MENU_AJUDA = `🤖 *THE FINANCE Bot*

Não entendi o comando. Exemplos:

📦 *Cadastrar insumo:*
"Novo insumo: Farinha de trigo, kg, R$ 4,50"

🍔 *Cadastrar produto:*
"Novo produto: X-Burguer | pão 1un, carne 150g, queijo 2un"

Após enviar, confirme com *SIM* ou cancele com *NÃO*.`

async function responder(tenantId: string, numero: string, texto: string): Promise<void> {
  const ok = await enviarMensagem(numero, texto, tenantId)
  await prisma.whatsAppLog.create({
    data: {
      tenantId,
      tipo: 'RESPOSTA_BOT',
      destinatario: numero.slice(0, -8) + ' ****-' + numero.slice(-4),
      conteudo: texto,
      status: ok ? 'ENVIADO' : 'FALHOU',
      erro: null,
    },
  }).catch(() => {})
}

export async function interpretarComando(
  tenantId: string,
  numero: string,
  texto: string
): Promise<void> {
  let geminiResult: GeminiResponse

  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })
    const result = await model.generateContent(`${SYSTEM_PROMPT}\n\nMensagem: ${texto}`)
    const raw = result.response.text().trim().replace(/^```(?:json)?\n?|\n?```$/g, '').trim()
    const parsed = JSON.parse(raw) as GeminiResponse
    // Runtime guards for malformed Gemini output
    if (!parsed || typeof parsed.intencao !== 'string') throw new Error('invalid Gemini response')
    if (!Array.isArray(parsed.camposFaltando)) parsed.camposFaltando = []
    geminiResult = parsed
  } catch (err) {
    console.error('[bot] Gemini error:', err)
    await responder(tenantId, numero, MENU_AJUDA)
    return
  }

  if (geminiResult.intencao === 'DESCONHECIDO') {
    await responder(tenantId, numero, MENU_AJUDA)
    return
  }

  if (geminiResult.camposFaltando.length > 0) {
    await responder(
      tenantId,
      numero,
      `Para cadastrar, preciso de: *${geminiResult.camposFaltando.join(', ')}*\n\nTente novamente com todos os dados.`
    )
    return
  }

  const sessionKey = `whatsapp:session:${numero}:${tenantId}`

  if (geminiResult.intencao === 'NOVO_INSUMO') {
    const d = geminiResult.dados
    const confirmacao = [
      `📦 *Confirmar novo insumo?*`,
      `Nome: ${d.nome}`,
      `Unidade: ${d.unidade}`,
      `Custo: R$ ${(d.custoUnitario ?? 0).toFixed(2)}`,
      d.quantidadeInicial != null ? `Qtd inicial: ${d.quantidadeInicial} ${d.unidade}` : '',
      `\nResponda *SIM* para confirmar ou *NÃO* para cancelar.`,
    ].filter(Boolean).join('\n')

    const session: BotSession = {
      intencao: 'NOVO_INSUMO',
      dados: geminiResult.dados as Record<string, unknown>,
      expiraEm: Date.now() + 600_000,
    }
    await redisConnection.set(sessionKey, JSON.stringify(session), 'EX', 600)
    await responder(tenantId, numero, confirmacao)
    return
  }

  if (geminiResult.intencao === 'NOVO_PRODUTO') {
    const d = geminiResult.dados
    const insumosNomes = (d.insumos ?? []).map((i) => i.nome.toLowerCase())
    const insumosDb = await prisma.ingredient.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    })
    const foundNames = new Set(insumosDb.map((i) => i.name.toLowerCase()))
    const naoEncontrados = insumosNomes.filter((n) => !foundNames.has(n))
    const aviso = naoEncontrados.length > 0
      ? `⚠️ Insumos não encontrados: ${naoEncontrados.join(', ')}`
      : ''

    const confirmacao = [
      `🍔 *Confirmar novo produto?*`,
      `Nome: ${d.nome}`,
      d.precoVenda != null ? `Preço: R$ ${(d.precoVenda as number).toFixed(2)}` : 'Preço: não informado',
      `Ficha técnica:`,
      ...(d.insumos ?? []).map((i) => `  - ${i.nome}: ${i.quantidade} ${i.unidade}`),
      aviso,
      `\nResponda *SIM* para confirmar ou *NÃO* para cancelar.`,
    ].filter(Boolean).join('\n')

    const session: BotSession = {
      intencao: 'NOVO_PRODUTO',
      dados: {
        ...geminiResult.dados,
        insumosEncontrados: insumosDb.map((i) => ({ id: i.id, name: i.name })),
      } as Record<string, unknown>,
      expiraEm: Date.now() + 600_000,
    }
    await redisConnection.set(sessionKey, JSON.stringify(session), 'EX', 600)
    await responder(tenantId, numero, confirmacao)
  } else {
    await responder(tenantId, numero, MENU_AJUDA)
  }
}

export async function processarConfirmacao(
  tenantId: string,
  numero: string,
  resposta: string
): Promise<void> {
  const sessionKey = `whatsapp:session:${numero}:${tenantId}`
  const sessionJson = await redisConnection.get(sessionKey)

  if (!sessionJson) {
    await responder(tenantId, numero, 'Sessão expirada. Envie o comando novamente.')
    return
  }

  const session: BotSession = JSON.parse(sessionJson)

  if (resposta === 'NÃO' || resposta === 'NAO') {
    await redisConnection.del(sessionKey)
    await responder(tenantId, numero, '❌ Cancelado.')
    return
  }

  // Delete session before DB writes — prevents double-submission on retry/concurrent delivery
  const deleted = await redisConnection.del(sessionKey)
  if (deleted === 0) {
    // Another process already consumed this session
    await responder(tenantId, numero, 'Comando já está sendo processado.')
    return
  }

  try {
    if (session.intencao === 'NOVO_INSUMO') {
      const d = session.dados as {
        nome: string
        unidade: string
        custoUnitario: number
        quantidadeInicial?: number | null
      }
      await prisma.$transaction(async (tx) => {
        const ingredient = await tx.ingredient.create({
          data: {
            tenantId,
            name: d.nome,
            unit: d.unidade as 'KG' | 'G' | 'L' | 'ML' | 'UN',
            unitCost: d.custoUnitario,
            custoMedioPonderado: d.custoUnitario,
            currentQty: d.quantidadeInicial ?? 0,
            minimumQty: 0,
            pontoReposicao: 0,
          },
        })
        if ((d.quantidadeInicial ?? 0) > 0) {
          await tx.ingredientMovement.create({
            data: {
              tenantId,
              ingredientId: ingredient.id,
              type: 'IN',
              quantity: d.quantidadeInicial!,
              unitCost: d.custoUnitario,
              totalCost: d.quantidadeInicial! * d.custoUnitario,
              reason: 'Cadastro via WhatsApp Bot',
            },
          })
        }
      })
      await responder(tenantId, numero, `✅ Insumo *${d.nome}* cadastrado!\nAcesse: app.thefinance.com.br/estoque/insumos`)
    } else if (session.intencao === 'NOVO_PRODUTO') {
      const d = session.dados as {
        nome: string
        precoVenda?: number | null
        insumos?: Array<{ nome: string; quantidade: number; unidade: string }>
        insumosEncontrados?: Array<{ id: string; name: string }>
      }
      const product = await prisma.product.create({
        data: { tenantId, name: d.nome, salePrice: d.precoVenda ?? 0, active: true },
      })
      const foundMap = new Map((d.insumosEncontrados ?? []).map((i) => [i.name.toLowerCase(), i.id]))
      const links = (d.insumos ?? [])
        .filter((i) => foundMap.has(i.nome.toLowerCase()))
        .map((i) => ({ productId: product.id, ingredientId: foundMap.get(i.nome.toLowerCase())!, quantity: i.quantidade }))
      if (links.length > 0) {
        await prisma.productIngredient.createMany({ data: links })
      }
      await responder(tenantId, numero, `✅ Produto *${d.nome}* cadastrado!\nAcesse: app.thefinance.com.br/estoque/produtos`)
    }
  } catch (err) {
    console.error('[bot] processarConfirmacao error:', err)
    await responder(tenantId, numero, '❌ Erro ao cadastrar. Tente novamente.')
    // Session is already deleted — user must re-send command
  }
}
