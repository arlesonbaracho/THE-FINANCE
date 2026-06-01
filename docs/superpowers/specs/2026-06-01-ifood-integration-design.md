# Design: Integração iFood (Agente 2)

**Data:** 2026-06-01  
**Status:** Aprovado  
**Stack:** Next.js 14 App Router · TypeScript · PostgreSQL + Prisma · BullMQ + Redis · Socket.io

---

## 1. Contexto

O sistema THE FINANCE precisa receber pedidos do iFood, sincronizar disponibilidade de cardápio com base no estoque e exibir esses pedidos no KDS (Kitchen Display System) já existente. A integração é multi-tenant: cada restaurante tem suas próprias credenciais OAuth iFood, armazenadas criptografadas.

---

## 2. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| `mesaId`/`garcomId` em pedidos iFood | Tornar opcionais no schema | Solução tecnicamente correta; adiciona `origem: OrigemPedido` para distinguir canais |
| Jobs de background | BullMQ + Redis bootstrapado do zero | Retry automático, filas persistentes, adequado para VPS/Docker |
| HTTP nos services | Chamadas `fetch` diretas, sem interface abstrata | Padrão do restante do codebase; sem over-engineering |

---

## 3. Schema Prisma

### 3.1 Mudanças no modelo `Pedido`

```prisma
enum OrigemPedido {
  BALCAO
  MESA
  IFOOD
}

model Pedido {
  // campos existentes — alterações:
  mesaId      String?           // era String (não-nullable)
  garcomId    String?           // era String (não-nullable)
  origem      OrigemPedido  @default(MESA)
  ifoodPedido IFoodPedido?      // relação reversa (adicionada)
  // ... restante sem alteração
}
```

A migration que torna esses campos opcionais deve ser gerada com `--create-only` e revisada antes de aplicar em produção, pois altera tabela com dados existentes.

A validação Zod em `POST /api/pedidos` (pedidos presenciais) permanece exigindo `mesaId` e `garcomId` — a mudança de schema não relaxa a validação da rota existente.

### 3.2 Relações adicionadas ao `Tenant`

```prisma
model Tenant {
  // ... existente
  ifoodIntegracao  IFoodIntegration?
  ifoodIntegracao  IFoodIntegration?
  ifoodItemMaps    IFoodItemMap[]
}
```

### 3.3 Relação adicionada ao `Product`

```prisma
model Product {
  // ... existente
  ifoodItemMaps  IFoodItemMap[]
}
```

### 3.4 Novos modelos

```prisma
enum IFoodStatus {
  CONECTADO
  DESCONECTADO
  ERRO
}

enum WebhookStatus {
  PROCESSADO
  FALHOU
}

model IFoodIntegration {
  id                    String            @id @default(cuid())
  tenantId              String            @unique
  merchantId            String
  clientId              String
  clientSecretEncrypted String
  accessToken           String?
  refreshToken          String?
  tokenExpiresAt        DateTime?
  status                IFoodStatus
  ultimaSincronizacao   DateTime?
  tenant                Tenant            @relation(fields: [tenantId], references: [id])
  pedidos               IFoodPedido[]
  webhookLogs           IFoodWebhookLog[]
}

model IFoodPedido {
  id               String           @id @default(cuid())
  tenantId         String
  pedidoId         String           @unique
  ifoodOrderId     String           @unique
  ifoodReference   String?
  statusIfood      String
  comissaoPercent  Decimal
  enderecoEntrega  Json
  createdAt        DateTime         @default(now())
  pedido           Pedido           @relation(fields: [pedidoId], references: [id])
  integracao       IFoodIntegration @relation(fields: [tenantId], references: [tenantId])
}

model IFoodWebhookLog {
  id           String           @id @default(cuid())
  tenantId     String
  ifoodOrderId String
  payload      Json
  status       WebhookStatus
  erro         String?
  createdAt    DateTime         @default(now())
  integracao   IFoodIntegration @relation(fields: [tenantId], references: [tenantId])
}

model IFoodItemMap {
  id            String   @id @default(cuid())
  tenantId      String
  ifoodItemId   String
  ifoodItemNome String
  produtoId     String?
  produto       Product? @relation(fields: [produtoId], references: [id])

  @@unique([tenantId, ifoodItemId])
}
```

---

## 4. Variáveis de Ambiente

```env
IFOOD_CLIENT_ID=
IFOOD_CLIENT_SECRET=
IFOOD_WEBHOOK_SECRET=
IFOOD_API_BASE_URL=https://merchant-api.ifood.com.br
IFOOD_AUTO_CONFIRM_DELAY_MS=30000
ENCRYPTION_KEY=           # hex 64 chars = 32 bytes AES-256
REDIS_URL=redis://localhost:6379
```

---

## 5. Arquitetura

### 5.1 Camadas

```
iFood API ←→ src/services/integrations/ifood/
               ├── ifood-auth.service.ts     (OAuth, tokens criptografados)
               ├── ifood-orders.service.ts   (webhook → Pedido, Socket.io, estoque)
               └── ifood-catalog.service.ts  (pausar/reativar itens, sync)

src/lib/
  ├── crypto.ts     (AES-256-GCM encrypt/decrypt, nativo Node)
  └── queue.ts      (BullMQ: getQueue, addJob, Redis singleton via ioredis)

src/workers/
  └── index.ts      (processo separado, inicia todos os workers BullMQ)
      ├── ifood-webhook.worker.ts       (processa payload, cria Pedido)
      ├── ifood-auto-confirm.worker.ts  (confirma pedido após delay 30s)
      └── ifood-catalog-sync.worker.ts  (cron */30 para sync de disponibilidade)
```

### 5.2 Fluxo de Pedido iFood

```
POST /api/webhooks/ifood/[tenantId]
  1. Valida HMAC-SHA256 (X-Ifood-Signature) — retorna 401 se inválido
  2. Salva IFoodWebhookLog (status=PROCESSADO | FALHOU)
  3. addJob("ifood-webhook", payload)
  4. Retorna 200 imediatamente (≤ 5s exigido pelo iFood)

Worker "ifood-webhook":
  → processarWebhook(tenantId, payload)
    ├── Verifica idempotência: ifoodOrderId já existe? → abort
    ├── Mapeia itens via IFoodItemMap (itens sem mapeamento: logados, não bloqueiam)
    ├── Cria Pedido { origem: IFOOD, mesaId: null, garcomId: null }
    ├── Cria IFoodPedido com metadados
    ├── Emite socket "pedido:novo" para KDS
    ├── Cria IngredientMovement { type: OUT, reason: "Pedido iFood" } por item mapeado
    └── addJob("ifood-auto-confirm", { tenantId, ifoodOrderId }, { delay: 30000 })

Worker "ifood-auto-confirm" (após 30s):
  → Verifica se IFoodPedido.statusIfood !== 'CANCELLED' | 'REJECTED'
  → Se pendente: confirmarPedido(tenantId, ifoodOrderId)

Worker "ifood-catalog-sync" (cron "*/30 * * * *"):
  → Busca todos IFoodIntegration { status: CONECTADO }
  → Para cada tenant: sincronizarDisponibilidade(tenantId)
```

### 5.3 Fluxo de Autenticação OAuth

```
conectar(tenantId, clientId, clientSecret)
  → POST /authentication/v1.0/oauth/token (grant_type=client_credentials)
  → Salva { clientSecretEncrypted, accessToken, tokenExpiresAt, status: CONECTADO }

getAccessToken(tenantId)
  → Lê IFoodIntegration
  → Se tokenExpiresAt < agora + 5min: refreshToken(tenantId)
  → Retorna accessToken

desconectar(tenantId)
  → Limpa tokens, status = DESCONECTADO
```

---

## 6. Services

### `src/lib/crypto.ts`
- `encrypt(texto: string): string` — AES-256-GCM, IV aleatório 12 bytes, output: `iv:authTag:ciphertext` (base64)
- `decrypt(cifrado: string): string` — split nos `:`, decipher GCM

### `src/lib/queue.ts`
- Conexão Redis singleton via `ioredis` usando `REDIS_URL`
- `getQueue(nome: string): Queue`
- `addJob(fila: string, dados: unknown, opts?: JobsOptions): Promise<Job>`
- Script separado: `"worker": "tsx src/workers/index.ts"` no `package.json`

### `src/services/integrations/ifood/ifood-auth.service.ts`
- `conectar(tenantId, clientId, clientSecret): Promise<void>`
- `refreshToken(tenantId): Promise<string>`
- `getAccessToken(tenantId): Promise<string>`
- `desconectar(tenantId): Promise<void>`

### `src/services/integrations/ifood/ifood-orders.service.ts`
- `confirmarPedido(tenantId, ifoodOrderId): Promise<void>`
- `rejeitarPedido(tenantId, ifoodOrderId, motivo: string): Promise<void>`
- `processarWebhook(tenantId, payload: unknown): Promise<Pedido>`

### `src/services/integrations/ifood/ifood-catalog.service.ts`
- `listarItensCatalogo(tenantId): Promise<IFoodItem[]>`
- `pausarItem(tenantId, ifoodItemId): Promise<void>`
- `reativarItem(tenantId, ifoodItemId): Promise<void>`
- `sincronizarDisponibilidade(tenantId): Promise<void>`
- `atualizarPreco(tenantId, ifoodItemId, novoPreco: number): Promise<void>`

---

## 7. Rotas de API

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| POST | `/api/integracoes/ifood/connect` | Iniciar conexão OAuth | ADMIN/MANAGER |
| GET | `/api/integracoes/ifood/connect` | Status + merchantId | ADMIN/MANAGER |
| GET | `/api/integracoes/ifood/lojas` | Listar lojas após auth | ADMIN/MANAGER |
| POST | `/api/integracoes/ifood/disconnect` | Desconectar | ADMIN/MANAGER |
| POST | `/api/webhooks/ifood/[tenantId]` | Receber webhook | HMAC-SHA256 |
| GET | `/api/integracoes/ifood/cardapio` | Listar itens + mapeamentos | ADMIN/MANAGER |
| POST | `/api/integracoes/ifood/cardapio` | Salvar mapeamentos | ADMIN/MANAGER |
| POST | `/api/integracoes/ifood/pausar-item` | Pausar item manualmente | ADMIN/MANAGER |
| POST | `/api/integracoes/ifood/reativar-item` | Reativar item manualmente | ADMIN/MANAGER |

**Segurança do webhook:** `X-Ifood-Signature` = HMAC-SHA256(body, `IFOOD_WEBHOOK_SECRET`). Retorna 401 imediatamente se inválido. Não usa `getServerSession`.

---

## 8. Páginas

### `src/app/(dashboard)/configuracoes/integracoes/ifood/page.tsx`
Stepper de 5 passos (tema verde-escuro, inline styles, padrão do projeto):
1. Instrução com link para Portal iFood Parceiros
2. Campos Client ID e Client Secret
3. Botão "Conectar" → OAuth → lista lojas
4. Select da loja correta
5. Confirmação com status badge

Após conectado: card com badge Conectado/Desconectado/Erro, merchantId, última sincronização, pedidos hoje. Botão "Desconectar" com modal de confirmação.

### `src/app/(dashboard)/configuracoes/integracoes/ifood/cardapio/page.tsx`
Tabela de mapeamento lado a lado:
- Colunas: nome iFood, categoria, preço iFood | select produto THE FINANCE | toggle "Sincronizar preço"
- Badge vermelho "Não mapeado" para itens sem vínculo
- Botão "Salvar mapeamentos"

### `src/app/(dashboard)/relatorios/delivery/page.tsx`
- Filtro de período no topo
- Gráfico pizza: vendas por canal (Balcão | Mesa | iFood) via `recharts`
- Cards: total pedidos, receita bruta, comissão, receita líquida, ticket médio iFood vs presencial, taxa de rejeição
- Top 5 produtos via iFood (tabela)
- Log dos últimos webhooks (status, horário, pedido)

---

## 9. Modificações no KDS (`src/app/[slug]/cozinha/page.tsx`)

**Tipo `Pedido` expandido:**
```ts
type IFoodMeta = {
  enderecoEntrega: Record<string, unknown>
  ifoodReference: string | null
}
type Pedido = {
  // ... existente
  origem: 'BALCAO' | 'MESA' | 'IFOOD'
  ifoodPedido?: IFoodMeta
}
```

**Cards com `origem === 'IFOOD'`:**
- Badge laranja "iFood" no header (ao lado do número de mesa — que será null, exibindo "Delivery")
- Rodapé com endereço de entrega e `ifoodReference` se disponível
- Cronômetro vermelho quando `> 8 minutos` (lógica de cor adicionada ao `timeAgo` existente)
- Botão "Rejeitar" abre modal inline com `<select>` dos motivos oficiais iFood:
  - `PedidoUnavailable` — Item indisponível
  - `OperationProblem` — Problema operacional
  - `RestauranteClosed` — Restaurante fechado

---

## 10. Fora do Escopo

- Pagamento via iFood (conciliação financeira)
- Notificações push para cliente final
- Múltiplos merchantIds por tenant
- Painel admin (Super Admin) para visualizar integrações

---

## 11. Dependências Novas

| Pacote | Versão | Uso |
|---|---|---|
| `bullmq` | `^5.x` | Filas e workers — **já instalado** |
| `ioredis` | `^5.x` | Conexão Redis — **já instalado** |
| `tsx` | `^4.x` | Rodar workers TypeScript (verificar se já é devDependency) |
| `recharts` | `^3.x` | Gráfico pizza no relatório delivery — **já instalado** |
