import { GoogleGenerativeAI, SchemaType, FunctionCallingMode, type Tool } from '@google/generative-ai'
import { prisma } from '@/lib/prisma'
import { incrementarUso } from './ai-usage.service'
import type { ChatMessage, Unit } from '@prisma/client'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'
const VALID_UNITS: Unit[] = ['KG', 'G', 'L', 'ML', 'UN']

function validarUnidade(u: string): Unit {
  const upper = u.toUpperCase() as Unit
  return VALID_UNITS.includes(upper) ? upper : 'UN'
}

// ── Definição das ferramentas (function calling) ──────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TOOLS: Tool[] = [
  {
    functionDeclarations: [
      {
        name: 'criar_insumo',
        description:
          'Cria um novo insumo/ingrediente no estoque. Use quando o usuário pedir para cadastrar, adicionar ou criar um insumo.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            nome: { type: SchemaType.STRING, description: 'Nome do insumo (ex: Farinha de Trigo)' },
            unidade: { type: SchemaType.STRING, description: 'Unidade de medida: KG, G, L, ML ou UN' },
            quantidadeAtual: { type: SchemaType.NUMBER, description: 'Quantidade atual em estoque (padrão: 0)' },
            quantidadeMinima: { type: SchemaType.NUMBER, description: 'Quantidade mínima para alerta (padrão: 0)' },
            custoUnitario: { type: SchemaType.NUMBER, description: 'Custo unitário em R$ (padrão: 0)' },
          },
          required: ['nome', 'unidade'],
        },
      },
      {
        name: 'criar_produto',
        description:
          'Cria um novo produto no cardápio. Use quando o usuário pedir para criar ou cadastrar um produto/prato.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            nome: { type: SchemaType.STRING, description: 'Nome do produto (ex: Pizza Margherita)' },
            precoVenda: { type: SchemaType.NUMBER, description: 'Preço de venda em R$' },
            insumos: {
              type: SchemaType.ARRAY,
              description: 'Ingredientes que compõem o produto (opcional)',
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  nomeInsumo: { type: SchemaType.STRING, description: 'Nome do insumo já cadastrado no sistema' },
                  quantidade: { type: SchemaType.NUMBER, description: 'Quantidade usada por porção' },
                },
                required: ['nomeInsumo', 'quantidade'],
              },
            },
          },
          required: ['nome', 'precoVenda'],
        },
      },
      {
        name: 'registrar_entrada_estoque',
        description:
          'Registra uma entrada de estoque (compra ou recebimento de mercadoria). Use quando o usuário disser que recebeu ou comprou mercadoria.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            nomeInsumo: { type: SchemaType.STRING, description: 'Nome do insumo que está entrando' },
            quantidade: { type: SchemaType.NUMBER, description: 'Quantidade recebida' },
            custoUnitario: { type: SchemaType.NUMBER, description: 'Custo unitário pago nessa compra (opcional)' },
            motivo: { type: SchemaType.STRING, description: 'Fornecedor ou motivo da entrada (opcional)' },
          },
          required: ['nomeInsumo', 'quantidade'],
        },
      },
    ],
  },
]

// ── Execução das funções ──────────────────────────────────────────────────────

async function executarFuncao(
  tenantId: string,
  nome: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  try {
    switch (nome) {
      case 'criar_insumo': {
        const existente = await prisma.ingredient.findFirst({
          where: { tenantId, name: { equals: args.nome as string, mode: 'insensitive' } },
        })
        if (existente) return { erro: `Insumo "${args.nome}" já existe no sistema.` }

        const insumo = await prisma.ingredient.create({
          data: {
            tenantId,
            name: args.nome as string,
            unit: validarUnidade(args.unidade as string),
            currentQty: (args.quantidadeAtual as number) ?? 0,
            minimumQty: (args.quantidadeMinima as number) ?? 0,
            unitCost: (args.custoUnitario as number) ?? 0,
            custoMedioPonderado: (args.custoUnitario as number) ?? 0,
            pontoReposicao: 0,
          },
        })
        return { sucesso: true, id: insumo.id, mensagem: `Insumo "${insumo.name}" criado com sucesso!` }
      }

      case 'criar_produto': {
        const existente = await prisma.product.findFirst({
          where: { tenantId, name: { equals: args.nome as string, mode: 'insensitive' } },
        })
        if (existente) return { erro: `Produto "${args.nome}" já existe no sistema.` }

        const produto = await prisma.product.create({
          data: {
            tenantId,
            name: args.nome as string,
            salePrice: args.precoVenda as number,
            active: true,
          },
        })

        const insumosList = args.insumos as Array<{ nomeInsumo: string; quantidade: number }> | undefined
        const naoEncontrados: string[] = []

        if (insumosList?.length) {
          for (const item of insumosList) {
            const ing = await prisma.ingredient.findFirst({
              where: { tenantId, name: { contains: item.nomeInsumo, mode: 'insensitive' } },
            })
            if (ing) {
              await prisma.productIngredient.create({
                data: { productId: produto.id, ingredientId: ing.id, quantity: item.quantidade },
              })
            } else {
              naoEncontrados.push(item.nomeInsumo)
            }
          }
        }

        const aviso = naoEncontrados.length
          ? ` Atenção: insumos não encontrados — ${naoEncontrados.join(', ')} (cadastre-os antes de vincular).`
          : ''
        return {
          sucesso: true,
          id: produto.id,
          mensagem: `Produto "${produto.name}" criado com preço R$${(args.precoVenda as number).toFixed(2)}.${aviso}`,
        }
      }

      case 'registrar_entrada_estoque': {
        const ingredient = await prisma.ingredient.findFirst({
          where: { tenantId, name: { contains: args.nomeInsumo as string, mode: 'insensitive' } },
        })
        if (!ingredient) {
          return {
            erro: `Insumo "${args.nomeInsumo}" não encontrado. Verifique o nome ou crie o insumo primeiro.`,
          }
        }

        const qtdEntrada = args.quantidade as number
        const custoUnitario = (args.custoUnitario as number) ?? ingredient.unitCost
        const qtdAtual = ingredient.currentQty
        const cmpAtual = ingredient.custoMedioPonderado
        const novoCmp =
          qtdAtual + qtdEntrada > 0
            ? (qtdAtual * cmpAtual + qtdEntrada * custoUnitario) / (qtdAtual + qtdEntrada)
            : custoUnitario

        await prisma.$transaction([
          prisma.ingredient.update({
            where: { id: ingredient.id },
            data: { currentQty: qtdAtual + qtdEntrada, custoMedioPonderado: novoCmp, unitCost: custoUnitario },
          }),
          prisma.ingredientMovement.create({
            data: {
              ingredientId: ingredient.id,
              tenantId,
              type: 'IN',
              quantity: qtdEntrada,
              unitCost: custoUnitario,
              totalCost: qtdEntrada * custoUnitario,
              reason: (args.motivo as string) ?? 'Entrada via assistente IA',
            },
          }),
        ])

        return {
          sucesso: true,
          mensagem: `✅ Entrada registrada: +${qtdEntrada} ${ingredient.unit} de "${ingredient.name}". Novo estoque: ${qtdAtual + qtdEntrada} ${ingredient.unit}.`,
        }
      }

      default:
        return { erro: `Função desconhecida: ${nome}` }
    }
  } catch (err) {
    return { erro: `Erro ao executar: ${(err as Error).message}` }
  }
}

// ── Contexto do estoque ───────────────────────────────────────────────────────

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

// ── Gerador de resposta com function calling ──────────────────────────────────

export async function gerarResposta(
  tenantId: string,
  userId: string,
  historico: ChatMessage[],
  novaMensagem: string,
  onChunk: (text: string) => void
): Promise<void> {
  const contexto = await montarContextoEstoque(tenantId)

  const systemPrompt = `Você é um assistente de gestão de estoque para um restaurante brasileiro com poderes de ação.
Você pode responder perguntas E executar ações reais no sistema:
- Criar insumos/ingredientes
- Criar produtos no cardápio
- Registrar entradas de estoque

Responda sempre em português. Seja direto e objetivo.
Quando o usuário pedir para criar, cadastrar ou registrar algo, USE as ferramentas disponíveis imediatamente.
Após executar uma ação, confirme o resultado de forma amigável e informe o que foi feito.

Dados atuais do estoque:
${contexto}`

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt,
    tools: TOOLS,
    toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.AUTO } },
  })

  const chat = model.startChat({
    history: historico.map((msg) => ({
      role: msg.role === 'USER' ? ('user' as const) : ('model' as const),
      parts: [{ text: msg.content }],
    })),
  })

  // Loop de function calling (máx 5 iterações)
  let result = await chat.sendMessage(novaMensagem)
  let response = result.response

  let iteracoes = 0
  while (response.functionCalls()?.length && iteracoes < 5) {
    iteracoes++
    const fcs = response.functionCalls()!

    const fcResponses = await Promise.all(
      fcs.map(async (fc) => {
        const fcResult = await executarFuncao(tenantId, fc.name, fc.args as Record<string, unknown>)
        return { functionResponse: { name: fc.name, response: fcResult } }
      })
    )

    result = await chat.sendMessage(fcResponses)
    response = result.response
  }

  const fullText = response.text()
  const tokensInput = response.usageMetadata?.promptTokenCount ?? 0
  const tokensOutput = response.usageMetadata?.candidatesTokenCount ?? 0

  // Envia o texto em pedaços (simulando streaming)
  const partes = fullText.split(/(\s+)/)
  for (let i = 0; i < partes.length; i++) {
    onChunk(partes[i])
    if (i % 4 === 3) await new Promise<void>((r) => setTimeout(r, 6))
  }

  await prisma.$transaction([
    prisma.chatMessage.create({
      data: { tenantId, userId, role: 'USER', content: novaMensagem, tokensUsados: 0 },
    }),
    prisma.chatMessage.create({
      data: { tenantId, userId, role: 'ASSISTANT', content: fullText, tokensUsados: tokensOutput },
    }),
  ])

  await incrementarUso(tenantId, tokensInput, tokensOutput)
}
