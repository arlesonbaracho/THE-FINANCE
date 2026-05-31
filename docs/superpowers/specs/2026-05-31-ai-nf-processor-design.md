# Design — AGENTE 1: Infraestrutura de IA e Processamento de Notas Fiscais

**Data:** 2026-05-31  
**Branch:** feat/landing-page-overhaul (base para nova branch)  
**Stack:** Next.js 14 App Router, TypeScript, PostgreSQL + Prisma, BullMQ + Redis, Cloudinary, Anthropic API  
**Modelo Anthropic:** claude-sonnet-4-20250514

---

## 1. Contexto

Expansão do THE FINANCE com IA para:
1. Processar Notas Fiscais (imagem, PDF ou texto) via Claude → extrair itens → lançar entradas no estoque
2. Chat assistente de estoque com streaming em tempo real
3. Controle de uso mensal de tokens por tenant com limites configuráveis por plano

Todas as operações são multi-tenant — sempre filtrar por `tenantId`.

---

## 2. Camada de Dados

### 2.1 Novos modelos Prisma

```prisma
model NfProcessada {
  id             String    @id @default(cuid())
  tenantId       String
  origem         NfOrigem
  cloudinaryUrl  String?
  numeroNf       String?
  fornecedorNome String?
  dataEmissao    DateTime?
  valorTotal     Decimal?
  status         NfStatus
  rawResponseIa  Json
  itensCriados   Int       @default(0)
  processadoPor  String    // userId (sem FK explícita, padrão do projeto)
  createdAt      DateTime  @default(now())
  tenant         Tenant    @relation(fields: [tenantId], references: [id])
}

enum NfOrigem {
  UPLOAD_IMAGEM
  UPLOAD_PDF
  TEXTO
}

enum NfStatus {
  PROCESSANDO
  CONCLUIDA
  ERRO
}

model ChatMessage {
  id           String   @id @default(cuid())
  tenantId     String
  userId       String
  role         ChatRole
  content      String
  tokensUsados Int
  createdAt    DateTime @default(now())
  tenant       Tenant   @relation(fields: [tenantId], references: [id])
  user         User     @relation(fields: [userId], references: [id])
}

enum ChatRole {
  USER
  ASSISTANT
}

model AiUsage {
  id             String   @id @default(cuid())
  tenantId       String   @unique
  mes            Int
  ano            Int
  tokensInput    Int      @default(0)
  tokensOutput   Int      @default(0)
  custoEstimado  Decimal  @default(0)
  limiteTokens   Int
  updatedAt      DateTime @updatedAt
  tenant         Tenant   @relation(fields: [tenantId], references: [id])
}

model AiUsageHistory {
  id             String   @id @default(cuid())
  tenantId       String
  mes            Int
  ano            Int
  tokensInput    Int
  tokensOutput   Int
  custoEstimado  Decimal
  registradoEm   DateTime @default(now())
  tenant         Tenant   @relation(fields: [tenantId], references: [id])
}
```

### 2.2 Alterações em modelos existentes

`Tenant`: adicionar relações de back-reference para `nfsProcessadas`, `chatMessages`, `aiUsage`, `aiUsageHistory`.  
`User`: adicionar relação `chatMessages ChatMessage[]`.

### 2.3 Alinhamento de nomes

O spec usa terminologia em português que mapeia para modelos ingleses existentes:

| Spec (conceitual) | Prisma model / campo |
|---|---|
| Insumo | `Ingredient` |
| MovimentacaoEstoque tipo ENTRADA | `IngredientMovement` com `type: IN` |
| Fornecedor | `Supplier` |
| quantidadeAtual | `currentQty` |
| custoMedioPonderado | `custoMedioPonderado` |

A implementação usa os nomes Prisma em inglês. As rotas de API e UI podem continuar usando termos em português.

### 2.4 Inicialização de AiUsage

Lazy via `upsert` na primeira chamada de `incrementarUso`. O limite inicial é determinado pelo plano da subscription do tenant:
- Plano Enterprise (`limiteTokens = 0`): sempre permitido
- Outros planos: `AI_DEFAULT_MONTHLY_LIMIT_PRO` (padrão: 500.000 tokens/mês)

---

## 3. Novas Dependências

```
@anthropic-ai/sdk    — SDK oficial Anthropic (streaming, vision, documents)
cloudinary           — upload e armazenamento de imagens e PDFs originais
fast-levenshtein     — promover de dep transitiva para dep direta (com tipagem)
```

---

## 4. Variáveis de Ambiente

```env
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514
AI_MAX_TOKENS_PER_REQUEST=2000
AI_DEFAULT_MONTHLY_LIMIT_PRO=500000
AI_DEFAULT_MONTHLY_LIMIT_ENTERPRISE=0
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

---

## 5. Camada de Services

### 5.1 `src/services/ai/nf-processor.service.ts`

**`prepararArquivo(file: File)`**  
- Faz upload do arquivo (imagem ou PDF) no Cloudinary → armazenamento permanente para histórico e reprocessamento
- Retorna `{ cloudinaryUrl, mediaType, bytes: Buffer }`
- Os `bytes` são usados para enviar ao Anthropic como base64 (evita round-trip extra da URL do Cloudinary)

**`extrairItensComClaude({ cloudinaryUrl, bytes, mediaType, texto })`**  
- Monta payload Anthropic com system prompt de extração de NF
- Se imagem: `content: [{ type: "image", source: { type: "base64", media_type, data } }, { type: "text", text: prompt }]`
- Se PDF: `content: [{ type: "document", source: { type: "base64", media_type: "application/pdf", data } }]`  
  *(Anthropic native PDF support — sem pdf2pic, sem dependência nativa)*
- Se texto puro: `content: [{ type: "text", text: textoUsuario }]`
- Parseia resposta JSON estruturado: `{ fornecedor, numeroNf, dataEmissao, valorTotal, itens[] }`

**`enriquecerItens(tenantId, itens[])`**  
- Para cada item: busca `Ingredient` do tenant via `ILIKE '%termo%'`
- Ordena candidatos por distância Levenshtein (fast-levenshtein)
- Retorna itens com `insumoEncontrado: Ingredient | null` e `scoreConfianca: number` (0–100)

**`salvarNf(tenantId, userId, dados, itensCriados)`**  
- Persiste `NfProcessada` com `status: CONCLUIDA` e `rawResponseIa`

### 5.2 `src/services/ai/estoque-chat.service.ts`

**`montarContextoEstoque(tenantId)`**  
- Busca todos os `Ingredient`s (qty, custo), últimas 20 `IngredientMovement`s, `Alert`s com status `NAO_LIDO` ou `LIDO`
- Serializa como JSON compacto para incluir no system prompt

**`gerarResposta(tenantId, userId, historico, novaMensagem, onChunk)`**  
- Monta system prompt com contexto do estoque
- Chama Anthropic com `stream: true`, itera chunks via `for await`
- Invoca `onChunk(texto)` para cada fragmento (a rota SSE repassa ao cliente)
- Ao finalizar: salva `ChatMessage` (USER + ASSISTANT), chama `incrementarUso`

### 5.3 `src/services/ai/ai-usage.service.ts`

**`verificarLimite(tenantId)`** → `{ permitido: boolean, percentual: number }`  
- Se registro inexistente: considera permitido (criado no primeiro incremento)
- Se `limiteTokens === 0`: Enterprise, sempre `permitido: true`
- Se `tokensUsados >= limiteTokens`: `permitido: false`

**`incrementarUso(tenantId, tokensInput, tokensOutput)`**  
- `upsert` — cria com limite do plano se não existir; incrementa contadores
- `custoEstimado` recalculado: `(tokensInput / 1_000_000 * 3) + (tokensOutput / 1_000_000 * 15)` (USD, preços Anthropic Sonnet)

**`resetarUsoMensal()`** — snapshot em `AiUsageHistory` + `updateMany` zerando `AiUsage`  
**`buscarUso(tenantId)`** → `AiUsage`

---

## 6. Camada de Jobs BullMQ

### 6.1 `src/jobs/ai/nf-processor.job.ts` — fila `"nf-processing"`

**Payload:** `{ nfId, tenantId, userId, cloudinaryUrl?, pdfBytes?, imageBytes?, mediaType?, texto? }`

**Pipeline:**
1. `prepararArquivo` (se arquivo ainda não processado)
2. `extrairItensComClaude`
3. `enriquecerItens`
4. `salvarNf` / atualizar `NfProcessada`

**Sucesso:** `io.to("tenant:{tenantId}").emit("nf:processada", { nfId, dados })`  
**Falha:** `io.to("tenant:{tenantId}").emit("nf:erro", { nfId, mensagem })` + `NfProcessada.status = ERRO`  
**Retries:** 2 tentativas, backoff fixo de 5s

### 6.2 `src/jobs/ai/ai-usage-reset.job.ts` — fila `"ai-usage-reset"`

- Cron `"0 0 1 * *"` via `repeat: { pattern: "0 0 1 * *" }` (BullMQ)
- Snapshot em `AiUsageHistory` de todos os tenants
- `updateMany` zerando `tokensInput`, `tokensOutput`, `custoEstimado` em `AiUsage`
- Atualiza `mes` e `ano` para o mês corrente

**Registro:** num `startAiWorkers()` análogo ao `startAlertWorkers()` existente, chamado no server.ts.

---

## 7. Rotas de API

| Rota | Método | Descrição |
|------|--------|-----------|
| `/api/ai/processar-nf` | POST | Verifica limite → upload Cloudinary → cria `NfProcessada(PROCESSANDO)` → enfileira job → retorna `{ nfId, status: "PROCESSANDO" }` |
| `/api/ai/chat-estoque` | GET SSE | Verifica limite → `gerarResposta` com stream → envia chunks → fecha stream |
| `/api/ai/nf-status/[nfId]` | GET | Retorna `{ status, dados?, erro? }` da `NfProcessada` (polling fallback) |
| `/api/estoque/entrada-lote` | POST | Cria `IngredientMovement(IN)` por item → atualiza `Ingredient.currentQty` + `custoMedioPonderado` → marca `NfProcessada(CONCLUIDA)` |

**`entrada-lote` — cálculo de CMP:**
```
novoCMP = (qtdAtual * cmpAtual + qtdEntrada * custoUnitario) / (qtdAtual + qtdEntrada)
```

---

## 8. Middleware de Limite de IA

**`src/lib/middleware/ai-limit.middleware.ts`**

```ts
async function checkAiLimit(tenantId: string): Promise<{ permitido: boolean; percentual: number }>
```

- Se `percentual >= 80` e `percentual < 100`: cria `Alert` tipo `SISTEMA`, severidade `ALTA` (usa modelo `Alert` existente)
- Se `percentual >= 100`: retorna `permitido: false`; rotas retornam HTTP 403 com mensagem clara
- Se Enterprise (`limiteTokens === 0`): sempre `{ permitido: true, percentual: 0 }`

---

## 9. Páginas e Componentes

### 9.1 `/estoque/entrada-inteligente/page.tsx`

Layout two-column (esquerda fixa, direita scrollável).

**Zona esquerda — upload:**
- Drag-and-drop (`input[accept=".jpg,.jpeg,.png,.heic,.pdf"]`, máx 10MB)
- Preview inline da imagem ou nome do PDF após seleção
- Botão "Tirar foto" (`input[capture]`, visível em mobile)
- Toggle "Descrever em texto" substitui drop zone por `textarea`
- Botão "Processar com IA"

**Fluxo ao submeter:**
1. `POST /api/ai/processar-nf` com `multipart/form-data` (arquivo) ou `application/json` (texto)
2. Conecta Socket.IO na sala do tenant
3. Aguarda `nf:processada` (→ estado concluído) ou `nf:erro` (→ estado erro)
4. `/api/ai/nf-status/[nfId]` como fallback (polling a cada 3s se WebSocket não disponível)

**Zona direita — resultado:**
- Vazio: ícone + instruções
- Processando: skeleton animado + mensagem de progresso
- Concluído: `<TabelaRevisaoNF />`
- Erro: mensagem + botão "Tentar novamente"

### 9.2 `TabelaRevisaoNF.tsx`

Gerenciado por `react-hook-form` com `useFieldArray`.

**Campos globais:** fornecedor (select com `Supplier`s do tenant), nº NF, data recebimento.

**Colunas por linha:**
| Coluna | Editável | Notas |
|--------|----------|-------|
| Descrição original | Não | `text-gray-400` |
| Insumo no sistema | Combobox | Badge de confiança: verde ≥80%, amarelo ≥50%, cinza <50% |
| "＋ Criar novo insumo" | Expande inline | Campos: nome, unidade, categoria |
| Quantidade + unidade | Sim | |
| Custo unitário R$ | Sim | |
| Custo total | Não | Calculado em tempo real |
| Incluir/ignorar | Toggle | |

**Rodapé:** total de itens | itens incluídos | valor total  
**Botão "Confirmar lançamento":** valida (ao menos 1 item incluído, todos com insumo mapeado) → `POST /api/estoque/entrada-lote` → toast de sucesso + redirect para `/estoque/notas-fiscais`

### 9.3 `/estoque/notas-fiscais/page.tsx`

Tabela paginada com filtros:
- Fornecedor (select), período (date range), origem (todas / imagem / PDF / texto)

Colunas: data | fornecedor | nº NF | qtd itens | valor total | lançado por | origem  
Origem: badge "IA" (verde) para `UPLOAD_IMAGEM`/`UPLOAD_PDF`/`TEXTO` processados via IA, "Manual" (cinza) para entradas manuais futuras.

Click na linha → modal com detalhe dos itens  
Botão "Reprocessar": visível apenas quando `cloudinaryUrl !== null` (origem arquivo); reenfileira o job com a URL armazenada no Cloudinary.

### 9.4 `ChatEstoque.tsx`

Drawer fixed `bottom-4 right-4`, z-index elevado.

- Botão flutuante (ícone de chat) abre/fecha o drawer
- Histórico da sessão em memória local (não persiste entre refreshes no cliente)
- Input + botão enviar → `GET /api/ai/chat-estoque?mensagem=...` via `EventSource`
- Streaming renderizado caractere a caractere com cursor piscando
- Rodapé: barra de progresso discreta de tokens usados no mês
- Quando limite atingido: input desabilitado + tooltip explicativo

---

## 10. Decisões Técnicas

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| PDFs para Anthropic | Anthropic native (base64 `document`) | Sem dependência nativa (pdf2pic/ImageMagick) |
| Armazenamento de arquivos | Cloudinary (imagens + PDFs) | Habilita botão "Reprocessar" sem re-upload |
| Notificação de job | Socket.IO sala `tenant:{tenantId}` | Padrão existente no projeto (alerts, KDS) |
| Inicialização AiUsage | Lazy via upsert | Sem migration para tenants existentes |
| Enforcement de limite | Middleware função pura | Chamada explícita em cada rota de IA |
| Alerta 80% de uso | Alert modelo existente tipo `SISTEMA` | Reutiliza infra de alerts já construída |
