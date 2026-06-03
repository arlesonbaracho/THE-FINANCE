# Relatório de Migração — WhatsApp Evolution API

**Data:** 02–03 de junho de 2026  
**Branch:** `feat/whatsapp-evolution` → mergeado em `main`  
**Resumo:** Migração completa do gateway WhatsApp de Z-API (por tenant) para Evolution API centralizada, com adição de bot de IA, gerenciamento de contatos e webhook de entrada.

---

## 1. Motivação

O modelo anterior usava Z-API com uma instância separada por tenant, armazenando credenciais criptografadas (`WhatsAppIntegration`) no banco de dados. Isso gerava:

- **Complexidade operacional**: cada restaurante precisava configurar sua própria instância e escanear QR Code
- **Custo por tenant**: licença Z-API por restaurante
- **Ausência de canal de entrada**: sem capacidade de receber e processar mensagens enviadas pelos usuários
- **Bot impossível**: sem inbound, não havia como implementar comandos via WhatsApp

A solução adotada: **um único número WhatsApp do sistema** serve todos os tenants via Evolution API self-hosted.

---

## 2. Visão Geral da Arquitetura Nova

```
WhatsApp (usuário)
       │
       ▼
Evolution API (self-hosted Docker)
       │  webhook POST /api/webhooks/whatsapp/inbound
       ▼
whatsapp-inbound.service.ts
       │  lookup WhatsAppContato → identifica tenant
       ├── permiteComandos: false → mensagem de negação
       └── permiteComandos: true
              │
              ├── sessão Redis ativa + SIM/NÃO → processarConfirmacao()
              └── texto livre → interpretarComando() via Gemini
                        │
                        ├── NOVO_INSUMO → cria Ingredient + IngredientMovement
                        └── NOVO_PRODUTO → cria Product + ProductIngredient links
```

**Envio outbound** (alertas, resumo diário, iFood, teste):
```
Hook (alerta/AI/iFood) ──→ whatsapp-messages.service.ts ──→ evolution.service.ts ──→ Evolution API
```

---

## 3. Mudanças no Banco de Dados (Prisma)

### Removido
| Elemento | Motivo |
|---|---|
| `WhatsAppStatus` enum | Sem mais status por tenant |
| `WhatsAppIntegration` model | Credenciais não são mais por tenant |
| `Tenant.whatsappIntegracao` relation | Substituída por `whatsappContatos` |

### Adicionado
| Elemento | Descrição |
|---|---|
| `WhatsAppContato` model | Contatos cadastrados por tenant com flags de notificação |
| `Tenant.whatsappContatos` relation | Um tenant → muitos contatos |

### Alterado
| Elemento | Antes | Depois |
|---|---|---|
| `WhatsAppMsgTipo` | `ALERTA, RESUMO_DIARIO, PEDIDO_IFOOD` | `ALERTA_CRITICO, ALERTA_ALTO, ESTOQUE_BAIXO, RESUMO_DIARIO, LIMITE_IA, CONFIRMACAO_BOT, RESPOSTA_BOT, TESTE` |
| `WhatsAppMsgStatus` | `ENVIADO, FALHOU` | `ENVIADO, FALHOU, PENDENTE` |
| `WhatsAppLog.mensagem` | Campo `mensagem` | Campo renomeado para `conteudo` |
| `WhatsAppLog` | FK para `WhatsAppIntegration` | Standalone (sem FK — preserva histórico ao deletar tenant) |

### Migração aplicada
```
prisma/migrations/20260602120000_refactor_whatsapp_evolution/migration.sql
```

---

## 4. Novos Arquivos Criados

### Serviços (`src/lib/whatsapp/`)

| Arquivo | Responsabilidade |
|---|---|
| `evolution.service.ts` | HTTP client para Evolution API. Rate limit via pipeline Redis (atômico, 10 msgs/hora/tenant). Nunca lança exceção (fire-and-forget safe). |
| `whatsapp-messages.service.ts` | Orquestração de envio outbound. Anti-spam com `SET NX` atômico (TTL 7200s). Queries de contatos via `WhatsAppContato`. Logs com `conteudo`. |
| `whatsapp-inbound.service.ts` | Processa payloads do Evolution API. Filtra echo, grupos, texto vazio. Lookup de contato com `orderBy: { createdAt: 'asc' }` (determinístico). |
| `whatsapp-bot.service.ts` | Bot Gemini (`GEMINI_API_KEY`). Intents: `NOVO_INSUMO` e `NOVO_PRODUTO`. Sessões Redis TTL 600s. `prisma.$transaction` para atomicidade. Delete-before-write para prevenir double-submission. |

### Testes (`src/lib/whatsapp/__tests__/`)

| Arquivo | Cobertura |
|---|---|
| `evolution.service.test.ts` | Rate limit, envio, erros de rede/Redis, verificação de conexão |
| `whatsapp-inbound.service.test.ts` | Echo, grupos, permissões, routing de sessão, texto vazio |
| `whatsapp-bot.service.test.ts` | Intents Gemini, missing fields, sessão expirada, duplo envio, criação de insumo/produto |

**Total de novos testes: 28** (suite total: 304, todos passando)

### Infraestrutura

| Arquivo | Descrição |
|---|---|
| `docker-compose.evolution.yml` | Container Evolution API self-hosted |
| `docs/EVOLUTION_SETUP.md` | Guia de configuração da Evolution API |

---

## 5. Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` | Schema completo (ver seção 3) |
| `src/app/api/integracoes/whatsapp/status/route.ts` | Reescrito: retorna `{ conectado: boolean }` via `verificarConexao()` |
| `src/app/api/integracoes/whatsapp/test/route.ts` | Aceita `{ numero }` no body; fallback para primeiro contato ativo |
| `src/app/api/integracoes/whatsapp/logs/route.ts` | Novos valores do enum `WhatsAppMsgTipo` |
| `src/jobs/whatsapp/whatsapp-daily-report.job.ts` | Itera sobre `WhatsAppContato` com `recebeResumoDiario: true` + `distinct: ['tenantId']` |
| `src/jobs/alerts/utils.ts` | Import path: `@/lib/whatsapp/...` |
| `src/services/ai/ai-usage.service.ts` | Import path: `@/lib/whatsapp/...` |
| `src/services/integrations/ifood/ifood-orders.service.ts` | Import path: `@/lib/whatsapp/...` |
| `src/app/(dashboard)/configuracoes/integracoes/whatsapp/page.tsx` | Redesign completo (4 blocos — ver seção 7) |
| `src/app/(dashboard)/ajuda/page.tsx` | Seção WhatsApp atualizada para Evolution API |
| `.env.example` | Novas variáveis Evolution API |

---

## 6. Arquivos Deletados

| Arquivo | Substituído por |
|---|---|
| `src/services/integrations/whatsapp/zapi.service.ts` | `src/lib/whatsapp/evolution.service.ts` |
| `src/services/integrations/whatsapp/whatsapp-messages.service.ts` | `src/lib/whatsapp/whatsapp-messages.service.ts` |
| `src/app/api/integracoes/whatsapp/connect/route.ts` | Removido (sem conexão por tenant) |
| `src/app/api/integracoes/whatsapp/disconnect/route.ts` | Removido (sem desconexão por tenant) |

---

## 7. Novas Rotas de API

### Rotas protegidas (NextAuth — roles: SUPER_ADMIN, ADMIN, MANAGER)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/integracoes/whatsapp/status` | Status do sistema `{ conectado: boolean }` |
| `GET` | `/api/integracoes/whatsapp/contatos` | Lista contatos ativos do tenant |
| `POST` | `/api/integracoes/whatsapp/contatos` | Cria contato (validação E.164, reativa soft-deleted) |
| `PATCH` | `/api/integracoes/whatsapp/contatos/[id]` | Atualiza nome/flags do contato |
| `DELETE` | `/api/integracoes/whatsapp/contatos/[id]` | Soft delete (`ativo: false`) |
| `POST` | `/api/integracoes/whatsapp/test` | Envia teste para número ou primeiro contato ativo |
| `GET` | `/api/integracoes/whatsapp/logs` | Histórico de mensagens com filtro por tipo |

### Rota pública (sem autenticação NextAuth)

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/webhooks/whatsapp/inbound` | Webhook da Evolution API. HMAC-SHA256 (`timingSafeEqual`). Fire-and-forget. Retorna 200 imediatamente. |

---

## 8. Página de Configuração — Novo Design

A página em `Configurações → WhatsApp` foi completamente redesenhada de 398 para 213 linhas:

| Bloco | Antes | Depois |
|---|---|---|
| **Status** | Status por tenant (CONECTADO/DESCONECTADO/ERRO) com QR Code e credenciais Z-API | Badge somente leitura do status do sistema (número centralizado) |
| **Contatos** | Toggles + inputs de número em JSON por tipo de notificação | Tabela CRUD de `WhatsAppContato` com modal add/edit e soft-delete |
| **Histórico** | Tabela com filtros ALERTA/RESUMO_DIARIO/PEDIDO_IFOOD | Tabela com novos filtros por tipo (Alertas/Resumos/Bot) |
| **Teste** | Botão fixo que usava primeiro número de alertas | Dropdown dos contatos cadastrados + botão de envio |
| **Removido** | Campos Instance ID + Token, QR Code, botão Desconectar | — |

---

## 9. Bot de Comandos WhatsApp

Novidade: usuários cadastrados com `permiteComandos: true` podem enviar comandos via WhatsApp que criam registros no sistema após confirmação.

### Fluxo
```
Usuário envia mensagem
     ↓
Gemini extrai intenção (NOVO_INSUMO / NOVO_PRODUTO / DESCONHECIDO)
     ↓
Bot responde com resumo + "Responda SIM para confirmar ou NÃO para cancelar"
     ↓ sessão salva no Redis (TTL 10 min)
Usuário responde SIM
     ↓ del atômico antes das escritas (evita double-submit)
Banco de dados atualizado → confirmação enviada
```

### Exemplos de comandos
```
"Novo insumo: Farinha de trigo, kg, R$ 4,50"
→ Cria Ingredient + IngredientMovement (se quantidade > 0)

"Novo produto: X-Burguer | pão 1un, carne 150g, queijo 2un"
→ Cria Product + ProductIngredient links
```

---

## 10. Variáveis de Ambiente

### Novas (adicionar ao `.env`)
```env
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua_chave_aqui
EVOLUTION_INSTANCE=the-finance
EVOLUTION_SERVER_URL=https://seu-dominio.com
WHATSAPP_WEBHOOK_SECRET=secret_para_validar_webhook
WHATSAPP_RATE_LIMIT_PER_HOUR=10
```

### Removidas
```env
ZAPI_BASE_URL=...        # removida
```

---

## 11. Decisões Técnicas Notáveis

| Decisão | Razão |
|---|---|
| Rate limit via pipeline Redis (atômico) | Evita race condition entre `INCR` e `EXPIRE` sob carga concorrente |
| Anti-spam com `SET NX` (atômico) | Evita envio duplicado de alertas sob carga concorrente |
| Delete-before-write para sessões do bot | Evita double-submission em retentativas/webhooks duplicados |
| `prisma.$transaction` para insumo+movimentação | Evita insumo com quantidade > 0 sem histórico de movimentação |
| Lazy import do bot service no inbound | Evita dependência circular em tempo de módulo |
| `orderBy: { createdAt: 'asc' }` no lookup de contato | Comportamento determinístico quando mesmo número existe em mais de um tenant |
| `timingSafeEqual` na validação do webhook | Defesa contra timing attacks na comparação HMAC |
| `WhatsAppLog` sem FK para `Tenant` | Preserva histórico de auditoria quando tenant é deletado |

---

## 12. Métricas da Implementação

| Métrica | Valor |
|---|---|
| Arquivos criados | 14 |
| Arquivos modificados | 12 |
| Arquivos deletados | 4 |
| Linhas adicionadas | +1.347 |
| Linhas removidas | −700 |
| Novos testes | 28 |
| Total de testes | 304 (todos passando) |
| Erros TypeScript | 0 |
| Referências a Z-API remanescentes | 0 |
| Commits na branch | 18 |

---

## 13. Checklist de Ativação em Produção

- [ ] Subir Evolution API via Docker: `docker compose -f docker-compose.evolution.yml up -d`
- [ ] Configurar as 6 variáveis de ambiente no servidor
- [ ] Acessar `{EVOLUTION_SERVER_URL}/manager`, criar instância `the-finance`
- [ ] Escanear QR Code com o número WhatsApp do sistema
- [ ] Verificar status via `GET /api/integracoes/whatsapp/status` → `{ "conectado": true }`
- [ ] Adicionar primeiro contato em `Configurações → WhatsApp`
- [ ] Enviar mensagem de teste e confirmar recebimento
- [ ] Configurar `WHATSAPP_WEBHOOK_SECRET` (segurança obrigatória em produção)
- [ ] Testar bot enviando "Novo insumo: Sal, kg, R$ 1,00" e confirmando com "SIM"

---

*Relatório gerado automaticamente em 03/06/2026.*
