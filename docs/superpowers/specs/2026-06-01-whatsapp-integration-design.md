# Design: Integração WhatsApp via Z-API (Agente 3)

**Data:** 2026-06-01
**Status:** Aprovado
**Stack:** Next.js 14 App Router · TypeScript · PostgreSQL + Prisma · BullMQ + Redis · Z-API (zapi.io)

---

## 1. Contexto

O THE FINANCE precisa enviar notificações proativas via WhatsApp: alertas críticos de estoque/financeiro, resumo diário de operação e notificações de pedidos iFood. O gateway escolhido é a Z-API (instâncias WhatsApp Business gerenciadas pelo próprio cliente). Tokens são criptografados com AES-256-GCM (já disponível em `src/lib/crypto.ts`). A integração é multi-tenant.

---

## 2. Decisões de Design

| Decisão | Escolha | Motivo |
|---|---|---|
| Armazenamento de números/toggles | `config: Json` em `WhatsAppIntegration` | Evita nova tabela; mantém toda config WhatsApp em um modelo |
| QR Code | Buscar da Z-API e exibir na nossa UI | Melhor UX; Z-API suporta via `GET /qr-code` |
| Trigger de alerta de limite IA | Dentro de `incrementarUso()` | Zero latência; cobre NF + chat |
| Anti-spam WhatsApp | Consulta `WhatsAppLog` (2h para alertas) | Independente do anti-spam de alertas do sistema |
| `AlertConfig.canais` | Não reutilizado | Evita acoplamento com sistema de alertas existente |

---

## 3. Schema Prisma

### 3.1 Novos modelos

```prisma
enum WhatsAppStatus {
  CONECTADO
  DESCONECTADO
  ERRO
}

enum WhatsAppMsgTipo {
  ALERTA
  RESUMO_DIARIO
  PEDIDO_IFOOD
}

enum WhatsAppMsgStatus {
  ENVIADO
  FALHOU
}

model WhatsAppIntegration {
  id              String          @id @default(cuid())
  tenantId        String          @unique
  instanceId      String
  tokenEncrypted  String
  numeroConectado String?
  status          WhatsAppStatus
  ultimaConexao   DateTime?
  config          Json            @default("{}")
  // Estrutura do config:
  // {
  //   alertas:      { ativo: boolean; numeros: string[] }
  //   resumoDiario: { ativo: boolean; numeros: string[] }
  //   ifood:        { ativo: boolean; threshold: number; numeros: string[] }
  // }
  tenant          Tenant          @relation(fields: [tenantId], references: [id])
  logs            WhatsAppLog[]

  @@index([tenantId])
}

model WhatsAppLog {
  id           String              @id @default(cuid())
  tenantId     String
  tipo         WhatsAppMsgTipo
  destinatario String              // armazenado mascarado: "+55 11 ****-5678"
  mensagem     String
  status       WhatsAppMsgStatus
  erro         String?
  createdAt    DateTime            @default(now())
  integracao   WhatsAppIntegration @relation(fields: [tenantId], references: [tenantId])

  @@index([tenantId])
  @@index([tenantId, createdAt])
}
```

### 3.2 Relação adicionada ao `Tenant`

```prisma
model Tenant {
  // ... existente
  whatsappIntegracao  WhatsAppIntegration?
}
```

---

## 4. Variáveis de Ambiente

```env
ZAPI_BASE_URL=https://api.z-api.io
WHATSAPP_RATE_LIMIT_PER_HOUR=10
WHATSAPP_DAILY_REPORT_HOUR=23
```

---

## 5. Arquitetura

### 5.1 Camadas

```
Z-API ←→ src/services/integrations/whatsapp/
            ├── zapi.service.ts               (HTTP direto + rate limit Redis)
            └── whatsapp-messages.service.ts  (formatação + roteamento)

Hooks de disparo:
  src/jobs/alerts/utils.ts → createAlert()
    → whatsappMessages.enviarAlerta()       (alertas CRITICA / ALTA)

  src/services/ai/ai-usage.service.ts → incrementarUso()
    → _verificarENotificarLimite()          (80% e 100% do limite IA)

  src/services/integrations/ifood/ifood-orders.service.ts → processarWebhook()
    → whatsappMessages.enviarNotificacaoPedidoIfood()  (fora da transação)

Jobs BullMQ (src/jobs/whatsapp/index.ts → startWhatsAppWorkers):
  "whatsapp-daily-report"  — cron "0 23 * * *"
```

### 5.2 Fluxo de Envio de Mensagem

```
enviarMensagem(tenantId, numero, msg)
  1. Redis INCR "wpp:ratelimit:{tenantId}" → se novo: EXPIRE 3600
  2. count > WHATSAPP_RATE_LIMIT_PER_HOUR → retorna false, sem envio
  3. Busca WhatsAppIntegration, descriptografa token
  4. POST {ZAPI_BASE_URL}/instances/{instanceId}/token/{token}/send-text
     body: { phone: numero, message: msg }
  5. Salva WhatsAppLog { destinatario: mascarar(numero), status: ENVIADO|FALHOU }
  6. Retorna boolean
```

### 5.3 Fluxo de Conexão QR Code

```
POST /api/integracoes/whatsapp/connect
  → Salva { instanceId, tokenEncrypted, status: DESCONECTADO }

UI inicia polling (setInterval 10s):
  GET /api/integracoes/whatsapp/status
    → zapiService.verificarStatus() → GET Z-API /status
    → Se connected: false → zapiService.getQrCode() → GET Z-API /qr-code
    → Retorna { status, qrCode: "data:image/png;base64,...", numeroConectado: null }

  UI exibe QR Code enquanto status !== CONECTADO

Quando Z-API retorna connected: true:
  → Salva { status: CONECTADO, numeroConectado, ultimaConexao: now() }
  → UI para polling, transiciona para estado conectado
```

### 5.4 Fluxo Anti-spam WhatsApp

`enviarAlerta()` antes de enviar verifica:
1. `config.alertas.ativo === true`
2. Severidade `CRITICA` ou `ALTA`
3. Fora do horário de silêncio (`AlertConfig` do tenant)
4. Nenhum `WhatsAppLog` com mesmo `tipo=ALERTA` + mesmo subtipo nos últimos **120 minutos**

Se todas as condições passam → envia para cada número em `config.alertas.numeros`.

---

## 6. Services

### `src/services/integrations/whatsapp/zapi.service.ts`

```typescript
// Funções exportadas:
conectar(tenantId, instanceId, token): Promise<void>
  // Valida credenciais via GET /status, salva criptografado

verificarStatus(tenantId): Promise<{ status: WhatsAppStatus; numeroConectado?: string }>
  // GET Z-API /status, atualiza banco

getQrCode(tenantId): Promise<string | null>
  // GET Z-API /qr-code → retorna base64 ou null se já conectado

desconectar(tenantId): Promise<void>
  // Limpa tokens, status = DESCONECTADO

enviarMensagem(tenantId, numero, mensagem): Promise<boolean>
  // Rate limit Redis + POST Z-API + WhatsAppLog
```

**Z-API endpoints usados:**
- `GET /instances/{id}/token/{token}/status`
- `GET /instances/{id}/token/{token}/qr-code`
- `POST /instances/{id}/token/{token}/send-text`

### `src/services/integrations/whatsapp/whatsapp-messages.service.ts`

```typescript
enviarAlerta(tenantId, alerta: { tipo, severidade, titulo, descricao, metadata }): Promise<void>
  // Anti-spam 2h + verificações → envia para config.alertas.numeros

enviarResumoDiario(tenantId): Promise<void>
  // Busca métricas do dia → monta mensagem → config.resumoDiario.numeros

enviarNotificacaoPedidoIfood(tenantId, pedido: { id, total, ifoodPedido }): Promise<void>
  // Se config.ifood.ativo && pedido.total >= config.ifood.threshold → envia
```

**Templates de mensagem:**

*Alerta crítico:*
```
🔴 *THE FINANCE — Alerta Crítico*
Restaurante: {nome}
{titulo}
{descricao}
Acesse: app.thefinance.com.br/alertas
```

*Resumo diário:*
```
📊 *THE FINANCE — Resumo do Dia*
Restaurante: {nome} | {data}

💰 Vendas: R$ {totalVendas}
🛒 Pedidos: {numPedidos} | Ticket médio: R$ {ticketMedio}
📉 CMV: {cmvPct}% {emojiCmv}
🏆 Produto mais vendido: {produto} ({qtd}x)

{alertasCriticos > 0 ? "⚠️ {n} alerta(s) ativo(s)" : "✅ Nenhum alerta ativo"}
Acesse: app.thefinance.com.br/dashboard
```

*Pedido iFood:*
```
🛵 *Novo pedido iFood!*
Restaurante: {nome}
Pedido: #{ref} | R$ {total}
Endereço: {rua}, {numero} — {bairro}
```

*Alerta limite IA (80%):*
```
⚠️ *THE FINANCE — Limite de IA*
Restaurante: {nome}
Uso de IA: 80% do limite mensal atingido.
Acesse: app.thefinance.com.br/configuracoes/assinatura
```

---

## 7. Jobs BullMQ

### `src/jobs/whatsapp/index.ts` — `startWhatsAppWorkers()`

```typescript
// Registrado em server.ts dentro do if (redisOk)
new Worker('whatsapp-daily-report', processDailyReportJob, { connection })

const dailyQueue = new Queue('whatsapp-daily-report', { connection })
await dailyQueue.add('daily', {}, {
  repeat: { pattern: '0 23 * * *' },
  jobId: 'whatsapp-daily-report-cron',
})
```

### `src/jobs/whatsapp/whatsapp-daily-report.job.ts`

```typescript
// Busca todos tenants com WhatsApp CONECTADO e config.resumoDiario.ativo = true
// Para cada um: chama whatsappMessages.enviarResumoDiario(tenantId)
```

**Nota:** O job `whatsapp-ai-limit-alert` não é uma fila separada — o alerta é enfileirado diretamente de `_verificarENotificarLimite()` dentro de `incrementarUso()`, usando a fila `whatsapp-daily-report` já existente não — usa `addJob` direto sem delay via worker inline.

> **Decisão de implementação:** O alerta de IA é enviado de forma síncrona dentro de `_verificarENotificarLimite()` (não via BullMQ) para simplicidade — é uma chamada única por tenant na hora que cruza o threshold, não necessita de fila.

---

## 8. Rotas de API

| Método | Rota | Descrição | Auth |
|---|---|---|---|
| POST | `/api/integracoes/whatsapp/connect` | Salvar credenciais + iniciar verificação | ADMIN/MANAGER |
| GET | `/api/integracoes/whatsapp/status` | Polling: status + QR Code base64 | ADMIN/MANAGER |
| POST | `/api/integracoes/whatsapp/disconnect` | Desconectar | ADMIN/MANAGER |
| POST | `/api/integracoes/whatsapp/test` | Enviar mensagem de teste | ADMIN/MANAGER |
| GET | `/api/integracoes/whatsapp/logs` | Histórico de mensagens enviadas | ADMIN/MANAGER |
| PATCH | `/api/integracoes/whatsapp/connect` | Atualizar `config` (toggles e números) | ADMIN/MANAGER |

---

## 9. Página

**`src/app/(dashboard)/configuracoes/integracoes/whatsapp/page.tsx`**

Segue exatamente o padrão visual do projeto (CSS variables `var(--tf-*)`, inline styles, lucide-react).

**Estado desconectado:**
- Campos Instance ID e Token + link para portal.z-api.io
- Botão "Conectar" → chama POST `/connect` → inicia polling
- Área de QR Code: exibe `<img src={qrCode} />` enquanto polling retorna qrCode; spinner se ainda carregando; mensagem "Escaneie com o WhatsApp do número que será usado"

**Estado conectado:**
- Card: badge verde, número conectado, última conexão
- Seção configurações: toggles + inputs de número (add/remove) + threshold iFood
- Botão "Salvar" → PATCH `/connect` com novo config
- Botão "Enviar teste" → POST `/test`
- Botão "Desconectar" com modal de confirmação

**Histórico:** tabela paginada (últimas 50 mensagens), filtros por tipo/status.

**Sidebar:** adicionar entrada `{ label: 'WhatsApp', href: '/configuracoes/integracoes/whatsapp', icon: MessageCircle }` em Configurações, após o item Integrações iFood.

---

## 10. Modificações em Arquivos Existentes

### `src/jobs/alerts/utils.ts` — `createAlert()`

Após o `io.to(...).emit(...)`:
```typescript
// Notificação WhatsApp (fire-and-forget)
if (payload.severidade === 'CRITICA' || payload.severidade === 'ALTA') {
  import('@/services/integrations/whatsapp/whatsapp-messages.service')
    .then(({ enviarAlerta }) => enviarAlerta(payload.tenantId, payload))
    .catch((err) => console.error('[whatsapp] enviarAlerta failed:', err))
}
```

### `src/services/ai/ai-usage.service.ts` — `incrementarUso()`

Ao final da função, após o `upsert`:
```typescript
// Verificar e notificar limite de IA
await _verificarENotificarLimite(tenantId)
```

```typescript
async function _verificarENotificarLimite(tenantId: string): Promise<void> {
  const { percentual } = await verificarLimite(tenantId)
  // Só notifica nos thresholds exatos (evita spam)
  if (percentual !== 80 && percentual !== 100) return
  // Verificar se já notificou esse threshold hoje
  // Enviar via whatsapp-messages.service (dynamic import)
}
```

### `src/services/integrations/ifood/ifood-orders.service.ts` — `processarWebhook()`

Após o bloco Socket.io (fora da transação Prisma):
```typescript
// Notificação WhatsApp pedido iFood (fire-and-forget)
import('@/services/integrations/whatsapp/whatsapp-messages.service')
  .then(({ enviarNotificacaoPedidoIfood }) =>
    enviarNotificacaoPedidoIfood(tenantId, { id: pedido.id, total: pedido.total })
  )
  .catch((err) => console.error('[whatsapp] enviarNotificacaoPedidoIfood failed:', err))
```

---

## 11. Fora do Escopo

- Recebimento de mensagens WhatsApp (webhook Z-API de entrada)
- Respostas automáticas / chatbot via WhatsApp
- Múltiplas instâncias WhatsApp por tenant
- Envio de mídia (imagens, PDFs) — apenas texto

---

## 12. Dependências Novas

Nenhuma. Todo o código usa `fetch` nativo, Redis via `ioredis` (já instalado) e `src/lib/crypto.ts` (já criado no Agente 2).
