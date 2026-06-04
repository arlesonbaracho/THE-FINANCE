# WhatsApp Evolution API Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-tenant Z-API gateway with a single centralized Evolution API instance, adding contact management, inbound bot support, and a redesigned configuration page.

**Architecture:** One WhatsApp number owned by the system connects via Evolution API (self-hosted Docker). Tenants register `WhatsAppContato` records; the system sends outbound notifications using those contacts and processes inbound commands through a Gemini-powered bot with Redis sessions (TTL 10 min). All per-tenant credential storage (`WhatsAppIntegration`) is removed.

**Tech Stack:** Next.js 14 App Router, Prisma + PostgreSQL, ioredis (BullMQ), `@google/generative-ai` (Gemini — uses `GEMINI_API_KEY`, already installed), Vitest, Evolution API REST

---

## File Map

| Action | File |
|---|---|
| Modify | `prisma/schema.prisma` |
| Create | `src/lib/whatsapp/evolution.service.ts` |
| Create | `src/lib/whatsapp/whatsapp-messages.service.ts` |
| Create | `src/lib/whatsapp/whatsapp-inbound.service.ts` |
| Create | `src/lib/whatsapp/whatsapp-bot.service.ts` |
| Create | `src/lib/whatsapp/__tests__/evolution.service.test.ts` |
| Create | `src/lib/whatsapp/__tests__/whatsapp-inbound.service.test.ts` |
| Create | `src/lib/whatsapp/__tests__/whatsapp-bot.service.test.ts` |
| Delete | `src/services/integrations/whatsapp/zapi.service.ts` |
| Delete | `src/services/integrations/whatsapp/whatsapp-messages.service.ts` |
| Modify | `src/jobs/whatsapp/whatsapp-daily-report.job.ts` |
| Modify | `src/jobs/alerts/utils.ts` (update import path) |
| Modify | `src/services/ai/ai-usage.service.ts` (update import path) |
| Modify | `src/services/integrations/ifood/ifood-orders.service.ts` (update import path) |
| Delete | `src/app/api/integracoes/whatsapp/connect/route.ts` |
| Delete | `src/app/api/integracoes/whatsapp/status/route.ts` (per-tenant — replaced below) |
| Delete | `src/app/api/integracoes/whatsapp/disconnect/route.ts` |
| Create | `src/app/api/integracoes/whatsapp/status/route.ts` (system-level status) |
| Modify | `src/app/api/integracoes/whatsapp/test/route.ts` |
| Modify | `src/app/api/integracoes/whatsapp/logs/route.ts` |
| Create | `src/app/api/integracoes/whatsapp/contatos/route.ts` |
| Create | `src/app/api/integracoes/whatsapp/contatos/[id]/route.ts` |
| Create | `src/app/api/webhooks/whatsapp/inbound/route.ts` |
| Rewrite | `src/app/(dashboard)/configuracoes/integracoes/whatsapp/page.tsx` |
| Create | `docker-compose.evolution.yml` |
| Create | `docs/EVOLUTION_SETUP.md` |

---

## Task 1: Schema Prisma — Remove Z-API, Add WhatsAppContato

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Remove whatsappIntegracao from Tenant model**

In `prisma/schema.prisma`, in the `model Tenant` block (around line 213), remove:
```prisma
  whatsappIntegracao  WhatsAppIntegration?
```
And add after `ifoodItemMaps IFoodItemMap[]`:
```prisma
  whatsappContatos    WhatsAppContato[]
```

- [ ] **Step 2: Replace the entire WhatsApp section**

Replace everything from the line `// ── WhatsApp Integration ──` to the end of `model WhatsAppLog` with:

```prisma
// ── WhatsApp Integration (Evolution API — centralized) ───────────────────────

enum WhatsAppMsgTipo {
  ALERTA_CRITICO
  ALERTA_ALTO
  ESTOQUE_BAIXO
  RESUMO_DIARIO
  LIMITE_IA
  CONFIRMACAO_BOT
  RESPOSTA_BOT
  TESTE
}

enum WhatsAppMsgStatus {
  ENVIADO
  FALHOU
  PENDENTE
}

model WhatsAppContato {
  id                 String   @id @default(cuid())
  tenantId           String
  tenant             Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  nome               String
  numero             String
  ativo              Boolean  @default(true)
  permiteComandos    Boolean  @default(false)
  recebeAlertas      Boolean  @default(true)
  recebeResumoDiario Boolean  @default(false)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@unique([tenantId, numero])
  @@index([tenantId])
  @@index([numero])
}

model WhatsAppLog {
  id           String            @id @default(cuid())
  tenantId     String
  tipo         WhatsAppMsgTipo
  destinatario String
  conteudo     String
  status       WhatsAppMsgStatus
  erro         String?
  createdAt    DateTime          @default(now())

  @@index([tenantId])
  @@index([tenantId, createdAt])
}
```

- [ ] **Step 3: Run migration**

```bash
npx prisma migrate dev --name refactor_whatsapp_evolution
```

Expected: `Your database is now in sync with your schema.`

If there are FK constraint errors due to existing data, run `--create-only`, then manually add `DROP TABLE "WhatsAppIntegration" CASCADE;` at the start of the generated SQL before applying.

- [ ] **Step 4: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): replace WhatsApp per-tenant model with centralized Evolution API schema"
```

---

## Task 2: Evolution Service

**Files:**
- Create: `src/lib/whatsapp/evolution.service.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/whatsapp/evolution.service.ts
import { redisConnection } from '@/lib/bullmq'

const BASE = process.env.EVOLUTION_API_URL ?? 'http://localhost:8080'
const API_KEY = process.env.EVOLUTION_API_KEY ?? ''
const INSTANCE = process.env.EVOLUTION_INSTANCE ?? 'the-finance'
const RATE_LIMIT = parseInt(process.env.WHATSAPP_RATE_LIMIT_PER_HOUR ?? '10', 10)

export async function enviarMensagem(
  numero: string,
  texto: string,
  tenantId: string
): Promise<boolean> {
  const rateLimitKey = `whatsapp:ratelimit:${tenantId}`
  const count = await redisConnection.incr(rateLimitKey)
  if (count === 1) await redisConnection.expire(rateLimitKey, 3600)
  if (count > RATE_LIMIT) {
    console.warn(`[evolution] Rate limit atingido para tenant ${tenantId}`)
    return false
  }

  try {
    const res = await fetch(`${BASE}/message/sendText/${INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: API_KEY },
      body: JSON.stringify({ number: numero, text: texto }),
    })
    return res.status >= 200 && res.status < 300
  } catch (err) {
    console.error('[evolution] enviarMensagem error:', (err as Error).message)
    return false
  }
}

export async function verificarConexao(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/instance/connectionState/${INSTANCE}`, {
      headers: { apikey: API_KEY },
    })
    if (!res.ok) return false
    const data = await res.json() as { instance?: { state?: string } }
    return data?.instance?.state === 'open'
  } catch {
    return false
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/whatsapp/evolution.service.ts
git commit -m "feat(whatsapp): add Evolution API service (centralized, rate-limited)"
```

---

## Task 3: Messages Service (new location)

**Files:**
- Create: `src/lib/whatsapp/whatsapp-messages.service.ts`

> This new file replaces `src/services/integrations/whatsapp/whatsapp-messages.service.ts`. The old file is deleted in Task 8.
> iFood notifications use `ALERTA_ALTO` (not `ALERTA_CRITICO` — it's a notification, not an alert).

- [ ] **Step 1: Create the file**

```typescript
// src/lib/whatsapp/whatsapp-messages.service.ts
import { prisma } from '@/lib/prisma'
import { redisConnection } from '@/lib/bullmq'
import { enviarMensagem } from './evolution.service'
import { isInSilenceWindow } from '@/jobs/alerts/utils'

type AlertaPayload = {
  tenantId: string
  tipo: string
  severidade: string
  titulo: string
  descricao: string
  metadata?: Record<string, unknown>
}

type LogTipo = 'ALERTA_CRITICO' | 'ALERTA_ALTO' | 'ESTOQUE_BAIXO' | 'RESUMO_DIARIO' | 'LIMITE_IA' | 'CONFIRMACAO_BOT' | 'RESPOSTA_BOT' | 'TESTE'

function mascararNumero(numero: string): string {
  const digits = numero.replace(/\D/g, '')
  if (digits.length < 6) return numero
  return numero.slice(0, -8) + ' ****-' + digits.slice(-4)
}

async function salvarLog(
  tenantId: string,
  tipo: LogTipo,
  numero: string,
  conteudo: string,
  status: 'ENVIADO' | 'FALHOU',
  erro?: string
): Promise<void> {
  await prisma.whatsAppLog.create({
    data: { tenantId, tipo, destinatario: mascararNumero(numero), conteudo, status, erro: erro ?? null },
  }).catch((e) => console.error('[whatsapp] log error:', e))
}

async function antiSpam(tenantId: string, chave: string): Promise<boolean> {
  const key = `whatsapp:antispam:${tenantId}:${chave}`
  const exists = await redisConnection.get(key)
  if (exists) return true
  await redisConnection.set(key, '1', 'EX', 7200)
  return false
}

export async function enviarAlerta(tenantId: string, alerta: AlertaPayload): Promise<void> {
  if (alerta.severidade !== 'CRITICA' && alerta.severidade !== 'ALTA') return

  const alertConfig = await prisma.alertConfig.findFirst({
    where: { tenantId, tipoAlerta: alerta.tipo },
  })
  if (alertConfig && isInSilenceWindow(alertConfig as { horarioSilencioInicio?: string | null; horarioSilencioFim?: string | null })) return

  const subtipo = (alerta.metadata as Record<string, string> | undefined)?.subtipo ?? alerta.tipo
  if (await antiSpam(tenantId, subtipo)) return

  const contatos = await prisma.whatsAppContato.findMany({
    where: { tenantId, ativo: true, recebeAlertas: true },
    select: { numero: true },
  })
  if (contatos.length === 0) return

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
  const emoji = alerta.severidade === 'CRITICA' ? '🔴' : '🟠'
  const tipoLabel = alerta.severidade === 'CRITICA' ? 'Crítico' : 'Alto'
  const logTipo: LogTipo = alerta.severidade === 'CRITICA' ? 'ALERTA_CRITICO' : 'ALERTA_ALTO'

  const mensagem = [
    `${emoji} *THE FINANCE — Alerta ${tipoLabel}*`,
    `Restaurante: ${tenant?.name ?? tenantId}`,
    alerta.titulo,
    alerta.descricao,
    `Acesse: app.thefinance.com.br/alertas`,
  ].join('\n')

  for (const { numero } of contatos) {
    const ok = await enviarMensagem(numero, mensagem, tenantId)
    await salvarLog(tenantId, logTipo, numero, mensagem, ok ? 'ENVIADO' : 'FALHOU')
  }
}

export async function enviarResumoDiario(tenantId: string): Promise<void> {
  const contatos = await prisma.whatsAppContato.findMany({
    where: { tenantId, ativo: true, recebeResumoDiario: true },
    select: { numero: true },
  })
  if (contatos.length === 0) return

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const [pedidos, movimentos, alertasAtivos] = await Promise.all([
    prisma.pedido.findMany({
      where: { tenantId, status: 'FINALIZADO', fechadoEm: { gte: hoje } },
      select: { total: true, itens: { include: { product: { select: { name: true } } } } },
    }),
    prisma.ingredientMovement.findMany({
      where: { tenantId, type: 'OUT', createdAt: { gte: hoje } },
      select: { totalCost: true },
    }),
    prisma.alert.count({
      where: { tenantId, status: { in: ['NAO_LIDO', 'LIDO'] }, severidade: 'CRITICA' },
    }),
  ])

  const totalVendas = pedidos.reduce((s, p) => s + p.total, 0)
  const numPedidos = pedidos.length
  const ticketMedio = numPedidos > 0 ? totalVendas / numPedidos : 0
  const cmvTotal = movimentos.reduce((s, m) => s + (m.totalCost ?? 0), 0)
  const cmvPct = totalVendas > 0 ? (cmvTotal / totalVendas) * 100 : 0

  const produtoCount = new Map<string, number>()
  for (const pedido of pedidos) {
    for (const item of pedido.itens) {
      const nome = item.product.name
      produtoCount.set(nome, (produtoCount.get(nome) ?? 0) + 1)
    }
  }
  const topProduto = Array.from(produtoCount.entries()).sort((a, b) => b[1] - a[1])[0]

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const cmvEmoji = cmvPct > 38 ? '🔴' : cmvPct > 32 ? '🟡' : '🟢'
  const dataStr = hoje.toLocaleDateString('pt-BR')

  const mensagem = [
    `📊 *THE FINANCE — Resumo do Dia*`,
    `Restaurante: ${tenant?.name ?? tenantId} | ${dataStr}`,
    ``,
    `💰 Vendas: ${fmt(totalVendas)}`,
    `🛒 Pedidos: ${numPedidos} | Ticket médio: ${fmt(ticketMedio)}`,
    `📉 CMV: ${cmvPct.toFixed(1)}% ${cmvEmoji}`,
    topProduto ? `🏆 Mais vendido: ${topProduto[0]} (${topProduto[1]}x)` : '',
    ``,
    alertasAtivos > 0 ? `⚠️ ${alertasAtivos} alerta(s) crítico(s) ativo(s)` : `✅ Nenhum alerta crítico ativo`,
    `Acesse: app.thefinance.com.br/dashboard`,
  ].filter(Boolean).join('\n')

  for (const { numero } of contatos) {
    const ok = await enviarMensagem(numero, mensagem, tenantId)
    await salvarLog(tenantId, 'RESUMO_DIARIO', numero, mensagem, ok ? 'ENVIADO' : 'FALHOU')
  }
}

export async function enviarNotificacaoPedidoIfood(
  tenantId: string,
  pedido: { id: string; total: number; ifoodReference?: string | null; enderecoEntrega?: Record<string, unknown> }
): Promise<void> {
  const contatos = await prisma.whatsAppContato.findMany({
    where: { tenantId, ativo: true, recebeAlertas: true },
    select: { numero: true },
  })
  if (contatos.length === 0) return

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const endereco = pedido.enderecoEntrega
  const enderecoStr = endereco
    ? [endereco.streetName, endereco.streetNumber, endereco.neighborhood].filter(Boolean).join(', ')
    : 'Endereço não informado'

  const mensagem = [
    `🛵 *Novo pedido iFood!*`,
    `Restaurante: ${tenant?.name ?? tenantId}`,
    pedido.ifoodReference ? `Pedido: #${pedido.ifoodReference} | ${fmt(pedido.total)}` : `Valor: ${fmt(pedido.total)}`,
    `Endereço: ${enderecoStr}`,
  ].join('\n')

  for (const { numero } of contatos) {
    const ok = await enviarMensagem(numero, mensagem, tenantId)
    await salvarLog(tenantId, 'ALERTA_ALTO', numero, mensagem, ok ? 'ENVIADO' : 'FALHOU')
  }
}

export async function enviarAlertaLimiteIA(tenantId: string, percentual: 80 | 100): Promise<void> {
  const contatos = await prisma.whatsAppContato.findMany({
    where: { tenantId, ativo: true, recebeAlertas: true },
    select: { numero: true },
  })
  if (contatos.length === 0) return

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
  const emoji = percentual === 100 ? '🚫' : '⚠️'
  const label = percentual === 100 ? '100% — uso bloqueado' : '80% do limite mensal atingido'

  const mensagem = [
    `${emoji} *THE FINANCE — Limite de IA*`,
    `Restaurante: ${tenant?.name ?? tenantId}`,
    `Uso de IA: ${label}.`,
    `Acesse: app.thefinance.com.br/configuracoes/assinatura`,
  ].join('\n')

  for (const { numero } of contatos) {
    const ok = await enviarMensagem(numero, mensagem, tenantId)
    await salvarLog(tenantId, 'LIMITE_IA', numero, mensagem, ok ? 'ENVIADO' : 'FALHOU')
  }
}

export async function enviarTeste(tenantId: string, numero: string): Promise<boolean> {
  const mensagem = [
    `✅ *THE FINANCE — Mensagem de Teste*`,
    `WhatsApp configurado com sucesso!`,
    `As notificações serão enviadas para este número.`,
  ].join('\n')
  const ok = await enviarMensagem(numero, mensagem, tenantId)
  await salvarLog(tenantId, 'TESTE', numero, mensagem, ok ? 'ENVIADO' : 'FALHOU')
  return ok
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/whatsapp/whatsapp-messages.service.ts
git commit -m "feat(whatsapp): add refactored messages service using Evolution API + WhatsAppContato"
```

---

## Task 4: Inbound Service

**Files:**
- Create: `src/lib/whatsapp/whatsapp-inbound.service.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/whatsapp/whatsapp-inbound.service.ts
import { prisma } from '@/lib/prisma'
import { redisConnection } from '@/lib/bullmq'
import { enviarMensagem } from './evolution.service'

export type EvolutionWebhookPayload = {
  event?: string
  instance?: string
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean; id?: string }
    message?: { conversation?: string; extendedTextMessage?: { text?: string } }
    pushName?: string
  }
  [key: string]: unknown
}

function extrairNumero(jid: string): string {
  return '+' + jid.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '')
}

function extrairTexto(payload: EvolutionWebhookPayload): string | null {
  return (
    payload.data?.message?.conversation ??
    payload.data?.message?.extendedTextMessage?.text ??
    null
  )
}

export async function processarMensagem(payload: EvolutionWebhookPayload): Promise<void> {
  if (payload.data?.key?.fromMe === true) return
  if (payload.event !== 'messages.upsert') return

  const jid = payload.data?.key?.remoteJid
  if (!jid) return

  const numero = extrairNumero(jid)
  const texto = extrairTexto(payload)
  if (!texto) return

  const contato = await prisma.whatsAppContato.findFirst({
    where: { numero, ativo: true },
    select: { tenantId: true, permiteComandos: true },
  })

  if (!contato) return

  const { tenantId } = contato

  if (!contato.permiteComandos) {
    await enviarMensagem(
      numero,
      'Você não tem permissão para enviar comandos. Entre em contato com o administrador do restaurante.',
      tenantId
    )
    return
  }

  const { interpretarComando, processarConfirmacao } = await import('./whatsapp-bot.service')

  const sessionKey = `whatsapp:session:${numero}:${tenantId}`
  const sessionJson = await redisConnection.get(sessionKey)

  const textoUpper = texto.trim().toUpperCase()
  if (sessionJson && (textoUpper === 'SIM' || textoUpper === 'NÃO' || textoUpper === 'NAO')) {
    await processarConfirmacao(tenantId, numero, textoUpper)
  } else {
    await interpretarComando(tenantId, numero, texto)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/whatsapp/whatsapp-inbound.service.ts
git commit -m "feat(whatsapp): add inbound webhook service (contact lookup, permission check, bot routing)"
```

---

## Task 5: Bot Service (Gemini)

**Files:**
- Create: `src/lib/whatsapp/whatsapp-bot.service.ts`

> Uses `GEMINI_API_KEY` env var (same as the rest of the project — see `src/services/ai/estoque-chat.service.ts`).
> Prisma field names confirmed from schema: `Ingredient.currentQty`, `unitCost`, `custoMedioPonderado`, `minimumQty`, `pontoReposicao`; `Product.salePrice`; `ProductIngredient.quantity`.

- [ ] **Step 1: Create the file**

```typescript
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
    const responseText = result.response.text().trim()
    geminiResult = JSON.parse(responseText) as GeminiResponse
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

  try {
    if (session.intencao === 'NOVO_INSUMO') {
      const d = session.dados as {
        nome: string
        unidade: string
        custoUnitario: number
        quantidadeInicial?: number | null
      }
      const ingredient = await prisma.ingredient.create({
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
        await prisma.ingredientMovement.create({
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
      await redisConnection.del(sessionKey)
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
      await redisConnection.del(sessionKey)
      await responder(tenantId, numero, `✅ Produto *${d.nome}* cadastrado!\nAcesse: app.thefinance.com.br/estoque/produtos`)
    }
  } catch (err) {
    console.error('[bot] processarConfirmacao error:', err)
    await responder(tenantId, numero, '❌ Erro ao cadastrar. Tente novamente.')
    await redisConnection.del(sessionKey)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/whatsapp/whatsapp-bot.service.ts
git commit -m "feat(whatsapp): add Gemini-powered bot service (NOVO_INSUMO, NOVO_PRODUTO, confirmação)"
```

---

## Task 6: API Routes

**Files:** delete 3 old routes, create system status route, modify test/logs, create contatos CRUD + inbound webhook

- [ ] **Step 1: Delete old routes (PowerShell)**

```powershell
Remove-Item -Recurse -Force "src\app\api\integracoes\whatsapp\connect"
Remove-Item -Recurse -Force "src\app\api\integracoes\whatsapp\disconnect"
Remove-Item -Force "src\app\api\integracoes\whatsapp\status\route.ts"
```

- [ ] **Step 2: Create new system status route**

Create `src/app/api/integracoes/whatsapp/status/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { verificarConexao } from '@/lib/whatsapp/evolution.service'

function allowed(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const conectado = await verificarConexao()
  return NextResponse.json({ conectado })
}
```

- [ ] **Step 3: Rewrite test/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enviarTeste } from '@/lib/whatsapp/whatsapp-messages.service'

function allowed(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const body = await req.json().catch(() => ({}))
  const { numero } = body as { numero?: string }

  let destino = numero
  if (!destino) {
    const contato = await prisma.whatsAppContato.findFirst({
      where: { tenantId, ativo: true },
      select: { numero: true },
    })
    destino = contato?.numero
  }

  if (!destino) {
    return NextResponse.json({ error: 'Nenhum contato cadastrado. Adicione um contato primeiro.' }, { status: 400 })
  }

  const ok = await enviarTeste(tenantId, destino)
  return NextResponse.json({ ok })
}
```

- [ ] **Step 4: Rewrite logs/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function allowed(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

const VALID_TIPOS = new Set([
  'ALERTA_CRITICO', 'ALERTA_ALTO', 'ESTOQUE_BAIXO', 'RESUMO_DIARIO',
  'LIMITE_IA', 'CONFIRMACAO_BOT', 'RESPOSTA_BOT', 'TESTE',
])
const VALID_STATUS = new Set(['ENVIADO', 'FALHOU', 'PENDENTE'])

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const tipo = req.nextUrl.searchParams.get('tipo') ?? undefined
  const status = req.nextUrl.searchParams.get('status') ?? undefined
  const start = req.nextUrl.searchParams.get('start')
  const end = req.nextUrl.searchParams.get('end')

  const logs = await prisma.whatsAppLog.findMany({
    where: {
      tenantId,
      ...(tipo && VALID_TIPOS.has(tipo) ? { tipo: tipo as never } : {}),
      ...(status && VALID_STATUS.has(status) ? { status: status as never } : {}),
      ...(start || end ? {
        createdAt: {
          ...(start ? { gte: new Date(start) } : {}),
          ...(end ? { lte: new Date(new Date(end).setHours(23, 59, 59, 999)) } : {}),
        },
      } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, tipo: true, destinatario: true, status: true, erro: true, createdAt: true },
  })

  return NextResponse.json(logs)
}
```

- [ ] **Step 5: Create contatos/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

function allowed(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

const contatoSchema = z.object({
  nome: z.string().min(1).max(100).trim(),
  numero: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Número deve estar no formato E.164: +5511999999999'),
  permiteComandos: z.boolean().default(false),
  recebeAlertas: z.boolean().default(true),
  recebeResumoDiario: z.boolean().default(false),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const contatos = await prisma.whatsAppContato.findMany({
    where: { tenantId: session.user.tenantId, ativo: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(contatos)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const body = await req.json()
  const parsed = contatoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const existing = await prisma.whatsAppContato.findUnique({
    where: { tenantId_numero: { tenantId, numero: parsed.data.numero } },
  })
  if (existing) {
    if (!existing.ativo) {
      const reactivated = await prisma.whatsAppContato.update({
        where: { id: existing.id },
        data: { ativo: true, ...parsed.data },
      })
      return NextResponse.json(reactivated)
    }
    return NextResponse.json({ error: 'Número já cadastrado' }, { status: 409 })
  }

  const contato = await prisma.whatsAppContato.create({ data: { tenantId, ...parsed.data } })
  return NextResponse.json(contato, { status: 201 })
}
```

- [ ] **Step 6: Create contatos/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

function allowed(role?: string | null) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MANAGER'
}

const updateSchema = z.object({
  nome: z.string().min(1).max(100).trim().optional(),
  permiteComandos: z.boolean().optional(),
  recebeAlertas: z.boolean().optional(),
  recebeResumoDiario: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const contato = await prisma.whatsAppContato.findFirst({ where: { id: params.id, tenantId } })
  if (!contato) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  }

  const updated = await prisma.whatsAppContato.update({ where: { id: params.id }, data: parsed.data })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId || !allowed(session.user.role)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const tenantId = session.user.tenantId

  const contato = await prisma.whatsAppContato.findFirst({ where: { id: params.id, tenantId } })
  if (!contato) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  await prisma.whatsAppContato.update({ where: { id: params.id }, data: { ativo: false } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 7: Create webhooks/whatsapp/inbound/route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'

function validateSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET ?? ''
  if (!secret) return true
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-webhook-secret') ?? req.headers.get('x-hub-signature-256') ?? ''

  if (!validateSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  import('@/lib/whatsapp/whatsapp-inbound.service')
    .then(({ processarMensagem }) => processarMensagem(payload as Parameters<typeof processarMensagem>[0]))
    .catch((err) => console.error('[inbound]', err))

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 8: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero errors in these new files.

- [ ] **Step 9: Commit**

```bash
git add src/app/api/integracoes/whatsapp/ src/app/api/webhooks/whatsapp/
git commit -m "feat(whatsapp): add Evolution API routes (system status, contatos CRUD, inbound webhook)"
```

---

## Task 7: BullMQ Job + Hook Import Updates

**Files:**
- Modify: `src/jobs/whatsapp/whatsapp-daily-report.job.ts`
- Modify: `src/jobs/alerts/utils.ts`
- Modify: `src/services/ai/ai-usage.service.ts`
- Modify: `src/services/integrations/ifood/ifood-orders.service.ts`

- [ ] **Step 1: Rewrite whatsapp-daily-report.job.ts**

```typescript
import { prisma } from '@/lib/prisma'
import { enviarResumoDiario } from '@/lib/whatsapp/whatsapp-messages.service'

export async function processDailyReportJob(): Promise<void> {
  const contatos = await prisma.whatsAppContato.findMany({
    where: { ativo: true, recebeResumoDiario: true },
    select: { tenantId: true },
    distinct: ['tenantId'],
  })

  for (const { tenantId } of contatos) {
    try {
      await enviarResumoDiario(tenantId)
      console.log(`[whatsapp-daily-report] Resumo enviado para tenant ${tenantId}`)
    } catch (err) {
      console.error(`[whatsapp-daily-report] Erro tenant ${tenantId}:`, err)
    }
  }
}
```

- [ ] **Step 2: Update import in src/jobs/alerts/utils.ts**

Find (around line 120):
```typescript
    import('@/services/integrations/whatsapp/whatsapp-messages.service')
```
Replace with:
```typescript
    import('@/lib/whatsapp/whatsapp-messages.service')
```

- [ ] **Step 3: Update import in src/services/ai/ai-usage.service.ts**

Find (around line 91):
```typescript
  import('@/services/integrations/whatsapp/whatsapp-messages.service')
```
Replace with:
```typescript
  import('@/lib/whatsapp/whatsapp-messages.service')
```

- [ ] **Step 4: Update import in src/services/integrations/ifood/ifood-orders.service.ts**

Find (around line 173):
```typescript
  import('@/services/integrations/whatsapp/whatsapp-messages.service')
```
Replace with:
```typescript
  import('@/lib/whatsapp/whatsapp-messages.service')
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/jobs/whatsapp/whatsapp-daily-report.job.ts src/jobs/alerts/utils.ts src/services/ai/ai-usage.service.ts src/services/integrations/ifood/ifood-orders.service.ts
git commit -m "feat(whatsapp): update job and hooks to import from lib/whatsapp"
```

---

## Task 8: Delete Old Files

- [ ] **Step 1: Delete old Z-API files (PowerShell)**

```powershell
Remove-Item -Force "src\services\integrations\whatsapp\zapi.service.ts"
Remove-Item -Force "src\services\integrations\whatsapp\whatsapp-messages.service.ts"
$remaining = Get-ChildItem "src\services\integrations\whatsapp" -ErrorAction SilentlyContinue
if (-not $remaining) { Remove-Item -Recurse -Force "src\services\integrations\whatsapp" }
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Run test suite**

```bash
npx vitest run
```

Expected: all existing tests pass (276+).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(whatsapp): delete Z-API service files"
```

---

## Task 9: Frontend Page Redesign

**Files:**
- Rewrite: `src/app/(dashboard)/configuracoes/integracoes/whatsapp/page.tsx`

> Status endpoint `GET /api/integracoes/whatsapp/status` now returns `{ conectado: boolean }` (not the old `{ status: string }`).

- [ ] **Step 1: Rewrite the page**

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle, XCircle, Plus, Trash2, Edit2, Send, Loader2 } from 'lucide-react'

type Contato = {
  id: string
  nome: string
  numero: string
  permiteComandos: boolean
  recebeAlertas: boolean
  recebeResumoDiario: boolean
}

type ContatoForm = {
  nome: string
  numero: string
  permiteComandos: boolean
  recebeAlertas: boolean
  recebeResumoDiario: boolean
}

type LogEntry = {
  id: string
  tipo: string
  destinatario: string
  status: string
  erro?: string | null
  createdAt: string
}

const TIPO_LABELS: Record<string, string> = {
  ALERTA_CRITICO: 'Alerta Crítico', ALERTA_ALTO: 'Alerta Alto', ESTOQUE_BAIXO: 'Estoque Baixo',
  RESUMO_DIARIO: 'Resumo Diário', LIMITE_IA: 'Limite IA',
  CONFIRMACAO_BOT: 'Bot Confirmação', RESPOSTA_BOT: 'Bot Resposta', TESTE: 'Teste',
}
const TIPO_COLORS: Record<string, string> = {
  ALERTA_CRITICO: '#e05252', ALERTA_ALTO: '#f97316', ESTOQUE_BAIXO: '#f59e0b',
  RESUMO_DIARIO: '#2a9d6f', LIMITE_IA: '#8b5cf6',
  CONFIRMACAO_BOT: '#0ea5e9', RESPOSTA_BOT: '#0ea5e9', TESTE: '#6b7280',
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
      <div style={{ width: 36, height: 20, borderRadius: 10, background: checked ? 'var(--tf-primary)' : 'var(--tf-border)', position: 'relative', transition: 'background 200ms' }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: checked ? 18 : 2, transition: 'left 200ms' }} />
      </div>
    </button>
  )
}

const FORM_VAZIO: ContatoForm = { nome: '', numero: '', permiteComandos: false, recebeAlertas: true, recebeResumoDiario: false }

export default function WhatsAppPage() {
  const [conexaoOk, setConexaoOk] = useState<boolean | null>(null)
  const [contatos, setContatos] = useState<Contato[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [modal, setModal] = useState<{ open: boolean; editId?: string; form: ContatoForm }>({ open: false, form: FORM_VAZIO })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testNumero, setTestNumero] = useState('')
  const [testMsg, setTestMsg] = useState('')
  const [logTipo, setLogTipo] = useState('')

  useEffect(() => {
    fetch('/api/integracoes/whatsapp/status')
      .then((r) => r.json())
      .then((d) => setConexaoOk(d.conectado === true))
      .catch(() => setConexaoOk(false))
  }, [])

  const loadContatos = useCallback(() => {
    fetch('/api/integracoes/whatsapp/contatos')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setContatos(d))
      .catch(() => {})
  }, [])

  const loadLogs = useCallback(() => {
    const p = logTipo ? `?tipo=${logTipo}` : ''
    fetch(`/api/integracoes/whatsapp/logs${p}`)
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setLogs(d))
      .catch(() => {})
  }, [logTipo])

  useEffect(() => { loadContatos() }, [loadContatos])
  useEffect(() => { loadLogs() }, [loadLogs])

  function abrirModal(contato?: Contato) {
    setFormError('')
    setModal({
      open: true,
      editId: contato?.id,
      form: contato
        ? { nome: contato.nome, numero: contato.numero, permiteComandos: contato.permiteComandos, recebeAlertas: contato.recebeAlertas, recebeResumoDiario: contato.recebeResumoDiario }
        : FORM_VAZIO,
    })
  }

  async function salvarContato() {
    setSaving(true); setFormError('')
    try {
      const url = modal.editId ? `/api/integracoes/whatsapp/contatos/${modal.editId}` : '/api/integracoes/whatsapp/contatos'
      const method = modal.editId ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(modal.form) })
      const d = await res.json()
      if (!res.ok) { setFormError(d.error ?? 'Erro ao salvar'); return }
      setModal({ open: false, form: FORM_VAZIO })
      loadContatos()
    } catch { setFormError('Erro de rede') } finally { setSaving(false) }
  }

  async function deletarContato(id: string) {
    await fetch(`/api/integracoes/whatsapp/contatos/${id}`, { method: 'DELETE' })
    loadContatos()
  }

  async function enviarTeste() {
    setTestLoading(true); setTestMsg('')
    try {
      const body = testNumero ? { numero: testNumero } : {}
      const res = await fetch('/api/integracoes/whatsapp/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      setTestMsg(d.ok ? '✅ Enviado!' : `❌ ${d.error ?? 'Falha'}`)
    } catch { setTestMsg('❌ Erro') } finally { setTestLoading(false) }
  }

  function updateForm(key: keyof ContatoForm, value: string | boolean) {
    setModal((prev) => ({ ...prev, form: { ...prev.form, [key]: value } }))
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 32 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tf-txt)', marginBottom: 4 }}>WhatsApp</h1>
      <p style={{ fontSize: 13, color: 'var(--tf-txt3)', marginBottom: 28 }}>Notificações via número único centralizado da plataforma.</p>

      {/* Bloco 1: Status do sistema */}
      <div style={{ padding: '16px 20px', borderRadius: 10, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 2 }}>Status do sistema</p>
          <p style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>Este número é compartilhado por todos os restaurantes na plataforma.</p>
        </div>
        {conexaoOk === null ? (
          <Loader2 size={18} style={{ color: 'var(--tf-txt3)', animation: 'spin 0.8s linear infinite' }} />
        ) : conexaoOk ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#2a9d6f', background: '#0d2b1f', border: '1px solid #2a9d6f' }}>
            <CheckCircle size={13} /> Conectado
          </span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, color: '#e05252', background: '#1f0a0a', border: '1px solid #e05252' }}>
            <XCircle size={13} /> Desconectado
          </span>
        )}
      </div>

      {/* Bloco 2: Contatos */}
      <div style={{ padding: '18px 20px', borderRadius: 10, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)' }}>Contatos cadastrados</p>
          <button onClick={() => abrirModal()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--tf-primary)', color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            <Plus size={13} /> Adicionar contato
          </button>
        </div>
        {contatos.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--tf-txt3)' }}>Nenhum contato cadastrado.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Nome', 'Número', 'Comandos', 'Alertas', 'Resumo', 'Ações'].map((h) => (
                <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--tf-txt3)', textTransform: 'uppercase' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {contatos.map((c) => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--tf-border)' }}>
                  <td style={{ padding: '10px 8px', fontSize: 13, color: 'var(--tf-txt)', fontWeight: 500 }}>{c.nome}</td>
                  <td style={{ padding: '10px 8px', fontSize: 12, color: 'var(--tf-txt2)', fontFamily: 'monospace' }}>{c.numero}</td>
                  <td style={{ padding: '10px 8px' }}><span style={{ fontSize: 11, color: c.permiteComandos ? '#2a9d6f' : 'var(--tf-txt3)' }}>{c.permiteComandos ? '✓' : '—'}</span></td>
                  <td style={{ padding: '10px 8px' }}><span style={{ fontSize: 11, color: c.recebeAlertas ? '#2a9d6f' : 'var(--tf-txt3)' }}>{c.recebeAlertas ? '✓' : '—'}</span></td>
                  <td style={{ padding: '10px 8px' }}><span style={{ fontSize: 11, color: c.recebeResumoDiario ? '#2a9d6f' : 'var(--tf-txt3)' }}>{c.recebeResumoDiario ? '✓' : '—'}</span></td>
                  <td style={{ padding: '10px 8px', display: 'flex', gap: 6 }}>
                    <button onClick={() => abrirModal(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tf-txt3)', display: 'flex' }}><Edit2 size={14} /></button>
                    <button onClick={() => deletarContato(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tf-red)', display: 'flex' }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bloco 3: Histórico */}
      <div style={{ padding: '18px 20px', borderRadius: 10, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)' }}>Histórico de mensagens</p>
          <div style={{ display: 'flex', gap: 6 }}>
            {([['', 'Todos'], ['ALERTA_CRITICO', 'Alertas'], ['RESUMO_DIARIO', 'Resumos'], ['RESPOSTA_BOT', 'Bot']] as [string, string][]).map(([val, label]) => (
              <button key={val} onClick={() => setLogTipo(val)} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${logTipo === val ? 'var(--tf-primary)' : 'var(--tf-border)'}`, background: logTipo === val ? 'var(--tf-primary-bg)' : 'transparent', color: logTipo === val ? 'var(--tf-primary)' : 'var(--tf-txt3)', fontSize: 11, cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {logs.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--tf-txt3)' }}>Nenhuma mensagem enviada.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Tipo', 'Número', 'Status', 'Data'].map((h) => <th key={h} style={{ padding: '6px 0', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--tf-txt3)', textTransform: 'uppercase' }}>{h}</th>)}</tr></thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderTop: '1px solid var(--tf-border)' }}>
                  <td style={{ padding: '8px 0' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: TIPO_COLORS[log.tipo] ?? '#888', background: (TIPO_COLORS[log.tipo] ?? '#888') + '22', padding: '2px 6px', borderRadius: 8 }}>
                      {TIPO_LABELS[log.tipo] ?? log.tipo}
                    </span>
                  </td>
                  <td style={{ padding: '8px 0', fontSize: 12, color: 'var(--tf-txt2)', fontFamily: 'monospace' }}>{log.destinatario}</td>
                  <td style={{ padding: '8px 0' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: log.status === 'ENVIADO' ? '#2a9d6f' : '#e05252' }}>{log.status}</span>
                  </td>
                  <td style={{ padding: '8px 0', fontSize: 11, color: 'var(--tf-txt3)' }}>{new Date(log.createdAt).toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bloco 4: Teste */}
      <div style={{ padding: '18px 20px', borderRadius: 10, border: '1px solid var(--tf-border)', background: 'var(--tf-surface)' }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 14 }}>Mensagem de teste</p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={testNumero} onChange={(e) => setTestNumero(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'var(--tf-surface2)', color: 'var(--tf-txt)', fontSize: 13, minWidth: 200 }}>
            <option value="">Primeiro contato disponível</option>
            {contatos.map((c) => <option key={c.id} value={c.numero}>{c.nome} ({c.numero})</option>)}
          </select>
          <button onClick={enviarTeste} disabled={testLoading} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt2)', fontSize: 13, cursor: testLoading ? 'not-allowed' : 'pointer' }}>
            {testLoading ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Send size={13} />}
            Enviar teste
          </button>
          {testMsg && <span style={{ fontSize: 12, color: testMsg.startsWith('✅') ? '#2a9d6f' : '#e05252' }}>{testMsg}</span>}
        </div>
      </div>

      {/* Modal contato */}
      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--tf-surface)', border: '1px solid var(--tf-border)', borderRadius: 12, padding: 28, maxWidth: 420, width: '100%' }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--tf-txt)', marginBottom: 20 }}>
              {modal.editId ? 'Editar contato' : 'Adicionar contato'}
            </p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tf-txt2)', marginBottom: 5 }}>Nome *</label>
              <input value={modal.form.nome} onChange={(e) => updateForm('nome', e.target.value)} placeholder="Ex: Gerente João" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'var(--tf-surface2)', color: 'var(--tf-txt)', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            {!modal.editId && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--tf-txt2)', marginBottom: 5 }}>Número (E.164) *</label>
                <input value={modal.form.numero} onChange={(e) => updateForm('numero', e.target.value)} placeholder="+5511999999999" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'var(--tf-surface2)', color: 'var(--tf-txt)', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            )}
            {([
              ['permiteComandos', 'Permite enviar comandos ao bot'],
              ['recebeAlertas', 'Recebe alertas críticos'],
              ['recebeResumoDiario', 'Recebe resumo diário (23h)'],
            ] as [keyof ContatoForm, string][]).map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--tf-txt)' }}>{label}</span>
                <Toggle checked={modal.form[key] as boolean} onChange={(v) => updateForm(key, v)} />
              </div>
            ))}
            {formError && <p style={{ fontSize: 12, color: '#e05252', marginBottom: 10 }}>{formError}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button onClick={() => setModal({ open: false, form: FORM_VAZIO })} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid var(--tf-border)', background: 'transparent', color: 'var(--tf-txt2)', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={salvarContato} disabled={saving || !modal.form.nome || (!modal.editId && !modal.form.numero)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: 'var(--tf-primary)', color: '#fff', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(dashboard)/configuracoes/integracoes/whatsapp/page.tsx"
git commit -m "feat(whatsapp): redesign config page — contact management, system status, no per-tenant QR code"
```

---

## Task 10: Infrastructure Files + Env Vars

- [ ] **Step 1: Create docker-compose.evolution.yml**

```yaml
version: '3.8'
services:
  evolution-api:
    image: atendai/evolution-api:latest
    container_name: evolution-api
    restart: always
    ports:
      - "8080:8080"
    environment:
      - SERVER_URL=${EVOLUTION_SERVER_URL}
      - AUTHENTICATION_API_KEY=${EVOLUTION_API_KEY}
      - WEBHOOK_GLOBAL_URL=${NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp/inbound
      - WEBHOOK_GLOBAL_ENABLED=true
      - WEBHOOK_EVENTS_MESSAGES_UPSERT=true
      - DATABASE_ENABLED=false
      - REDIS_ENABLED=false
    volumes:
      - evolution_data:/evolution/instances
volumes:
  evolution_data:
```

- [ ] **Step 2: Create docs/EVOLUTION_SETUP.md**

```markdown
# Evolution API Setup

## Variáveis de ambiente

Adicione ao `.env`:

```env
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua_chave_aqui
EVOLUTION_INSTANCE=the-finance
EVOLUTION_SERVER_URL=https://seu-dominio.com
WHATSAPP_WEBHOOK_SECRET=secret_para_validar_webhook
```

## Subir o container

```bash
docker compose -f docker-compose.evolution.yml up -d
```

## Conectar o número

1. Acesse `{EVOLUTION_SERVER_URL}/manager`
2. Crie uma instância chamada `the-finance` (igual a `EVOLUTION_INSTANCE`)
3. Escaneie o QR Code com o WhatsApp do número do sistema
4. Aguarde o status mudar para "Open"

## Verificar conexão

```bash
curl -H "apikey: sua_chave" http://localhost:8080/instance/connectionState/the-finance
# Esperado: {"instance":{"instanceName":"the-finance","state":"open"}}
```

## Webhook em desenvolvimento

Em dev use ngrok para expor localhost:
```bash
ngrok http 3000
# Configure NEXT_PUBLIC_APP_URL com a URL HTTPS do ngrok
```
```

- [ ] **Step 3: Update .env.example**

Remove lines with `ZAPI_BASE_URL` and `WHATSAPP_RATE_LIMIT_PER_HOUR`, add:
```env
# Evolution API (WhatsApp centralizado)
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua_chave_aqui
EVOLUTION_INSTANCE=the-finance
EVOLUTION_SERVER_URL=https://seu-dominio.com
WHATSAPP_WEBHOOK_SECRET=secret_para_validar_webhook
WHATSAPP_RATE_LIMIT_PER_HOUR=10
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.evolution.yml docs/EVOLUTION_SETUP.md .env.example
git commit -m "feat(whatsapp): add Evolution API docker setup, docs, env example"
```

---

## Task 11: Tests

**Files:**
- Create: `src/lib/whatsapp/__tests__/evolution.service.test.ts`
- Create: `src/lib/whatsapp/__tests__/whatsapp-inbound.service.test.ts`
- Create: `src/lib/whatsapp/__tests__/whatsapp-bot.service.test.ts`

- [ ] **Step 1: Create evolution.service.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/bullmq', () => ({
  redisConnection: { incr: vi.fn(), expire: vi.fn() },
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { enviarMensagem, verificarConexao } from '../evolution.service'
import { redisConnection } from '@/lib/bullmq'

const redis = redisConnection as { incr: ReturnType<typeof vi.fn>; expire: ReturnType<typeof vi.fn> }

describe('enviarMensagem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    redis.incr.mockResolvedValue(1)
    redis.expire.mockResolvedValue(1)
  })

  it('returns true on 200', async () => {
    mockFetch.mockResolvedValue({ status: 200 })
    expect(await enviarMensagem('+5511999', 'Oi', 'tenant-1')).toBe(true)
  })

  it('returns false on non-2xx', async () => {
    mockFetch.mockResolvedValue({ status: 500 })
    expect(await enviarMensagem('+5511999', 'Oi', 'tenant-1')).toBe(false)
  })

  it('returns false without throwing on network error', async () => {
    mockFetch.mockRejectedValue(new Error('timeout'))
    expect(await enviarMensagem('+5511999', 'Oi', 'tenant-1')).toBe(false)
  })

  it('blocks fetch when rate limit exceeded (count > 10)', async () => {
    redis.incr.mockResolvedValue(11)
    expect(await enviarMensagem('+5511999', 'Oi', 'tenant-rate')).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

describe('verificarConexao', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true when state is open', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ instance: { state: 'open' } }) })
    expect(await verificarConexao()).toBe(true)
  })

  it('returns false when state is not open', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ instance: { state: 'close' } }) })
    expect(await verificarConexao()).toBe(false)
  })

  it('returns false on error', async () => {
    mockFetch.mockRejectedValue(new Error('unreachable'))
    expect(await verificarConexao()).toBe(false)
  })
})
```

- [ ] **Step 2: Run evolution tests**

```bash
npx vitest run src/lib/whatsapp/__tests__/evolution.service.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Create whatsapp-inbound.service.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { whatsAppContato: { findFirst: vi.fn() } },
}))
vi.mock('@/lib/bullmq', () => ({
  redisConnection: { get: vi.fn() },
}))
vi.mock('../evolution.service', () => ({
  enviarMensagem: vi.fn().mockResolvedValue(true),
}))
vi.mock('../whatsapp-bot.service', () => ({
  interpretarComando: vi.fn(),
  processarConfirmacao: vi.fn(),
}))

import { processarMensagem } from '../whatsapp-inbound.service'
import { prisma } from '@/lib/prisma'
import { redisConnection } from '@/lib/bullmq'
import { enviarMensagem } from '../evolution.service'
import { interpretarComando, processarConfirmacao } from '../whatsapp-bot.service'

const db = prisma as { whatsAppContato: { findFirst: ReturnType<typeof vi.fn> } }
const redis = redisConnection as { get: ReturnType<typeof vi.fn> }
const enviar = enviarMensagem as ReturnType<typeof vi.fn>
const interpretar = interpretarComando as ReturnType<typeof vi.fn>
const confirmar = processarConfirmacao as ReturnType<typeof vi.fn>

function makePayload(jid: string, text: string, fromMe = false) {
  return { event: 'messages.upsert', data: { key: { remoteJid: jid, fromMe }, message: { conversation: text } } }
}

describe('processarMensagem', () => {
  beforeEach(() => { vi.clearAllMocks(); redis.get.mockResolvedValue(null) })

  it('ignores echo (fromMe=true)', async () => {
    await processarMensagem(makePayload('5511@s.whatsapp.net', 'Oi', true) as never)
    expect(db.whatsAppContato.findFirst).not.toHaveBeenCalled()
  })

  it('ignores unknown numbers silently', async () => {
    db.whatsAppContato.findFirst.mockResolvedValue(null)
    await processarMensagem(makePayload('5511@s.whatsapp.net', 'Oi') as never)
    expect(enviar).not.toHaveBeenCalled()
  })

  it('replies without permission when permiteComandos is false', async () => {
    db.whatsAppContato.findFirst.mockResolvedValue({ tenantId: 't1', permiteComandos: false })
    await processarMensagem(makePayload('5511@s.whatsapp.net', 'Novo insumo') as never)
    expect(enviar).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('permissão'), 't1')
    expect(interpretar).not.toHaveBeenCalled()
  })

  it('calls interpretarComando for regular text with permission', async () => {
    db.whatsAppContato.findFirst.mockResolvedValue({ tenantId: 't1', permiteComandos: true })
    await processarMensagem(makePayload('5511@s.whatsapp.net', 'Novo insumo: Farinha') as never)
    expect(interpretar).toHaveBeenCalledWith('t1', '+5511', 'Novo insumo: Farinha')
  })

  it('calls processarConfirmacao when session exists and text is SIM', async () => {
    db.whatsAppContato.findFirst.mockResolvedValue({ tenantId: 't1', permiteComandos: true })
    redis.get.mockResolvedValue('{"intencao":"NOVO_INSUMO"}')
    await processarMensagem(makePayload('5511@s.whatsapp.net', 'SIM') as never)
    expect(confirmar).toHaveBeenCalledWith('t1', '+5511', 'SIM')
  })

  it('calls interpretarComando for SIM when no active session', async () => {
    db.whatsAppContato.findFirst.mockResolvedValue({ tenantId: 't1', permiteComandos: true })
    redis.get.mockResolvedValue(null)
    await processarMensagem(makePayload('5511@s.whatsapp.net', 'SIM') as never)
    expect(interpretar).toHaveBeenCalled()
    expect(confirmar).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: Run inbound tests**

```bash
npx vitest run src/lib/whatsapp/__tests__/whatsapp-inbound.service.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Create whatsapp-bot.service.test.ts**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/bullmq', () => ({
  redisConnection: { get: vi.fn(), set: vi.fn().mockResolvedValue('OK'), del: vi.fn().mockResolvedValue(1) },
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    ingredient: { findMany: vi.fn(), create: vi.fn() },
    product: { create: vi.fn() },
    productIngredient: { createMany: vi.fn() },
    ingredientMovement: { create: vi.fn() },
    whatsAppLog: { create: vi.fn().mockResolvedValue({}) },
  },
}))
vi.mock('../evolution.service', () => ({
  enviarMensagem: vi.fn().mockResolvedValue(true),
}))

const mockGenerateContent = vi.fn()
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: vi.fn(() => ({ generateContent: mockGenerateContent })),
  })),
}))

import { interpretarComando, processarConfirmacao } from '../whatsapp-bot.service'
import { redisConnection } from '@/lib/bullmq'
import { prisma } from '@/lib/prisma'
import { enviarMensagem } from '../evolution.service'

const redis = redisConnection as { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn>; del: ReturnType<typeof vi.fn> }
const db = prisma as {
  ingredient: { findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
  product: { create: ReturnType<typeof vi.fn> }
  productIngredient: { createMany: ReturnType<typeof vi.fn> }
  ingredientMovement: { create: ReturnType<typeof vi.fn> }
  whatsAppLog: { create: ReturnType<typeof vi.fn> }
}
const enviar = enviarMensagem as ReturnType<typeof vi.fn>

function geminiReturns(json: object) {
  mockGenerateContent.mockResolvedValue({ response: { text: () => JSON.stringify(json) } })
}

describe('interpretarComando', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends menu for DESCONHECIDO intent', async () => {
    geminiReturns({ intencao: 'DESCONHECIDO', dados: {}, camposFaltando: [] })
    await interpretarComando('t1', '+5511', 'blá')
    expect(enviar).toHaveBeenCalledWith('+5511', expect.stringContaining('Não entendi'), 't1')
    expect(redis.set).not.toHaveBeenCalled()
  })

  it('asks for missing fields without saving session', async () => {
    geminiReturns({ intencao: 'NOVO_INSUMO', dados: { nome: 'Sal', unidade: 'KG', custoUnitario: 0 }, camposFaltando: ['custoUnitario'] })
    await interpretarComando('t1', '+5511', 'Novo insumo: Sal, kg')
    expect(redis.set).not.toHaveBeenCalled()
    expect(enviar).toHaveBeenCalledWith('+5511', expect.stringContaining('custoUnitario'), 't1')
  })

  it('saves session and sends confirmation for NOVO_INSUMO', async () => {
    geminiReturns({ intencao: 'NOVO_INSUMO', dados: { nome: 'Farinha', unidade: 'KG', custoUnitario: 4.5, quantidadeInicial: null }, camposFaltando: [] })
    await interpretarComando('t1', '+5511', 'Novo insumo: Farinha kg 4.50')
    expect(redis.set).toHaveBeenCalledWith('whatsapp:session:+5511:t1', expect.stringContaining('NOVO_INSUMO'), 'EX', 600)
    expect(enviar).toHaveBeenCalledWith('+5511', expect.stringContaining('Farinha'), 't1')
  })

  it('saves session for NOVO_PRODUTO when ingredients found', async () => {
    geminiReturns({ intencao: 'NOVO_PRODUTO', dados: { nome: 'X-Burguer', precoVenda: null, insumos: [{ nome: 'pão', quantidade: 1, unidade: 'UN' }] }, camposFaltando: [] })
    db.ingredient.findMany.mockResolvedValue([{ id: 'i1', name: 'pão' }])
    await interpretarComando('t1', '+5511', 'Novo produto: X-Burguer | pão 1un')
    expect(redis.set).toHaveBeenCalled()
  })
})

describe('processarConfirmacao', () => {
  beforeEach(() => vi.clearAllMocks())

  it('replies session expired when no Redis session', async () => {
    redis.get.mockResolvedValue(null)
    await processarConfirmacao('t1', '+5511', 'SIM')
    expect(enviar).toHaveBeenCalledWith('+5511', expect.stringContaining('expirada'), 't1')
    expect(db.ingredient.create).not.toHaveBeenCalled()
  })

  it('cancels on NÃO and deletes session', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ intencao: 'NOVO_INSUMO', dados: {}, expiraEm: 0 }))
    await processarConfirmacao('t1', '+5511', 'NÃO')
    expect(redis.del).toHaveBeenCalled()
    expect(db.ingredient.create).not.toHaveBeenCalled()
  })

  it('creates ingredient on SIM for NOVO_INSUMO without initial stock', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ intencao: 'NOVO_INSUMO', dados: { nome: 'Sal', unidade: 'KG', custoUnitario: 1, quantidadeInicial: null }, expiraEm: 0 }))
    db.ingredient.create.mockResolvedValue({ id: 'i1' })
    await processarConfirmacao('t1', '+5511', 'SIM')
    expect(db.ingredient.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: 'Sal', unit: 'KG' }) }))
    expect(db.ingredientMovement.create).not.toHaveBeenCalled()
    expect(redis.del).toHaveBeenCalled()
  })

  it('creates ingredient AND movement when quantidadeInicial > 0', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ intencao: 'NOVO_INSUMO', dados: { nome: 'Arroz', unidade: 'KG', custoUnitario: 5, quantidadeInicial: 10 }, expiraEm: 0 }))
    db.ingredient.create.mockResolvedValue({ id: 'i2' })
    await processarConfirmacao('t1', '+5511', 'SIM')
    expect(db.ingredientMovement.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'IN', quantity: 10 }) }))
  })

  it('creates product with ingredients on SIM for NOVO_PRODUTO', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ intencao: 'NOVO_PRODUTO', dados: { nome: 'X-Burguer', salePrice: 25, insumos: [{ nome: 'Pão', quantidade: 1, unidade: 'UN' }], insumosEncontrados: [{ id: 'i3', name: 'Pão' }] }, expiraEm: 0 }))
    db.product.create.mockResolvedValue({ id: 'p1' })
    await processarConfirmacao('t1', '+5511', 'SIM')
    expect(db.product.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: 'X-Burguer' }) }))
    expect(db.productIngredient.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ productId: 'p1', ingredientId: 'i3', quantity: 1 })] }))
    expect(redis.del).toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Run bot tests**

```bash
npx vitest run src/lib/whatsapp/__tests__/whatsapp-bot.service.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Run full test suite**

```bash
npx vitest run
```

Expected: all 276+ existing tests still pass, plus the new WhatsApp tests.

- [ ] **Step 8: Commit**

```bash
git add src/lib/whatsapp/__tests__/
git commit -m "test(whatsapp): add unit tests for evolution, inbound, and bot services"
```

---

## Task 12: Final Verification

- [ ] **Step 1: TypeScript full check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: No Z-API or WhatsAppIntegration references remain**

```bash
grep -r "zapi\|WhatsAppIntegration\|ZAPI_BASE_URL\|whatsappIntegracao" src/ --include="*.ts" --include="*.tsx"
```

Expected: no output.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(whatsapp): complete Evolution API migration — centralized model, bot, inbound webhook"
```

---

## Spec Coverage

| Spec requirement | Task |
|---|---|
| docker-compose.evolution.yml + EVOLUTION_SETUP.md | Task 10 |
| Evolution env vars in .env.example | Task 10 |
| Remove WhatsAppIntegration, add WhatsAppContato, update enums | Task 1 |
| evolution.service: enviarMensagem + rate limit (Redis) | Task 2 |
| evolution.service: verificarConexao | Task 2 |
| whatsapp-messages.service refactor (all outbound functions) | Task 3 |
| Anti-spam via Redis TTL 7200s (not DB query) | Task 3 |
| enviarTeste without anti-spam | Task 3 |
| whatsapp-inbound.service: echo filter, unknown number, permission check | Task 4 |
| whatsapp-bot.service: Gemini intent extraction | Task 5 |
| Bot: NOVO_INSUMO confirmation flow | Task 5 |
| Bot: NOVO_PRODUTO with ingredient lookup | Task 5 |
| Redis sessions TTL 600s | Task 5 |
| System status route replaces per-tenant status | Task 6 |
| Contatos GET/POST with E.164 validation | Task 6 |
| Contatos PATCH/DELETE (soft delete) | Task 6 |
| Inbound webhook: public, HMAC, fire-and-forget | Task 6 |
| Adapted test route (accepts numero in body) | Task 6 |
| Updated logs route (new enum values) | Task 6 |
| Daily report job queries WhatsAppContato | Task 7 |
| Hook imports updated (alerts, AI, iFood) | Task 7 |
| Old Z-API files deleted | Task 8 |
| Frontend redesigned (4 blocks, no per-tenant QR) | Task 9 |
| Unit tests: evolution, inbound, bot | Task 11 |
