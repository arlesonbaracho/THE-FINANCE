# THE FINANCE — Release Notes
## Agente 4 (Multi-Unidade) + Agente 5 (Super Admin Fase 3)
**Data:** 2026-06-05 | **Branch:** `feature/multi-unit-super-admin` → `main`

---

## Resumo Executivo

Esta release adiciona dois módulos maiores ao sistema:

| Módulo | Plano | Descrição |
|--------|-------|-----------|
| **Multi-Unidade** | Enterprise | Dashboard consolidado, cardápio compartilhado, compras centralizadas e benchmark de rede |
| **Super Admin Fase 3** | Interno | Saúde da plataforma, gestão de uso de IA, integrações e financeiro SaaS |

**Testes:** 328 passando / 0 falhas  
**Arquivos criados/modificados:** 65  
**Linhas adicionadas:** +4.810

---

## Agente 4 — Multi-Unidade

### Como funciona

O módulo Multi-Unidade é ativado quando o `Plan.features.multiUnit === true` (configurado pelo Super Admin). Ao fazer login, o usuário recebe `brandId` na sessão JWT, e o Header automaticamente exibe o seletor de rede.

### Funcionalidades

#### 1. Header — Seletor de Unidade
**Arquivo:** `src/components/layout/header.tsx`

- Para usuários Enterprise, o nome do restaurante vira um dropdown clicável
- Opções: **Visão consolidada →** (vai para `/rede/dashboard`) ou qualquer unidade da rede
- A seleção persiste via cookie `active-brand-unit` (8 horas, sem localStorage)
- Usuários sem plano Enterprise: header sem alteração

#### 2. Dashboard Consolidado (`/rede/dashboard`)
**Arquivo:** `src/app/(dashboard)/rede/dashboard/page.tsx`

- **Filtro de período:** 7d / 15d / 30d / 90d
- **4 KPI Cards:** Vendas totais, Total de pedidos, Ticket médio, CMV% (agregado de todas as unidades)
- **Destaques:** Melhor unidade (badge verde) e unidade em atenção (badge âmbar), calculados por faturamento
- **Tabela comparativa:** Todas as unidades com Vendas, Pedidos, Ticket, CMV%, Alertas ativos. Clique na linha navega para o `/dashboard` da unidade
- **Gráfico de barras:** Toggle entre 4 métricas (Vendas / Pedidos / CMV / Ticket), barras agrupadas por unidade
- **Mapa Google Maps Embed:** Marcadores coloridos por performance (verde=top, âmbar=mid, vermelho=baixo)
  - Requer `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` no `.env`

**Dados:** Aggregados via `DashboardSnapshot` (snapshots diários existentes de cada unidade)

#### 3. Cardápio Compartilhado (`/rede/cardapio`)
**Arquivo:** `src/app/(dashboard)/rede/cardapio/page.tsx`

- **Aba "Cardápio da rede":** CRUD de produtos `isShared = true` vinculados à Brand
  - Botão "Sincronizar" limpa todos os `ProdutoOverride.preco` daquele produto nas unidades
- **Aba "Overrides por unidade":** Seletor de unidade + edição inline de preço e status por produto
  - Campo vazio = usa preço base da rede
  - Toggle ativo/inativo por unidade
  - Salvo via `upsert` em `ProdutoOverride`

#### 4. Compras Centralizadas (`/rede/compras`)
**Arquivo:** `src/app/(dashboard)/rede/compras/page.tsx`

**Como gerar um pedido:**
1. Selecionar fornecedor (lista os fornecedores do tenant HQ)
2. Clicar "Gerar pedido de compra"
3. O sistema varre alertas `tipo: ESTOQUE / status: NAO_LIDO` em todas as unidades
4. Agrupa por `ingredientId`, soma as quantidades, registra `distribuicaoPorUnidade` em JSON
5. Cria `PurchaseOrder` com status `RASCUNHO`

**Histórico de pedidos:**
- Status: `RASCUNHO` → `ENVIADO` → `RECEBIDO`
- Botão PDF: gera via `@react-pdf/renderer` com itens e fornecedor
- Botão Excel: gera via `xlsx` (SheetJS) com planilha de itens
- Botão "✓": marca como `RECEBIDO`

#### 5. Relatórios de Benchmark (`/rede/relatorios`)
**Arquivo:** `src/app/(dashboard)/rede/relatorios/page.tsx`

- Tabela de benchmark com CMV%, Ticket Médio e Margem Bruta por unidade
- Badge **"Líder"** na melhor unidade de cada coluna
- Badge **"Abaixo da média"** para unidades com ticket < 80% da média da rede
- Linha de média da rede no rodapé da tabela
- Filtro de período: 7d / 30d / 90d

### Schema adicionado (Agent 4)
```
Brand              — entidade de rede (slug único, adminUserId, planId)
PurchaseOrder      — pedido consolidado de compra
PurchaseOrderItem  — item do pedido com distribuicaoPorUnidade JSON
ProdutoOverride    — preço/status por unidade (unique[tenantId, produtoId])

Tenant += brandId, isHeadquarters
Product += brandId, isShared
```

### Variáveis de ambiente necessárias
```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=   # Para o mapa do dashboard
GOOGLE_MAPS_API_KEY=               # (backend se necessário)
```

### Guard de acesso
- **Middleware:** `/rede/*` protegido por NextAuth (requer sessão)
- **Layout:** `src/app/(dashboard)/rede/layout.tsx` redireciona para `/dashboard` se `session.user.brandId` for nulo
- **API:** Todas as rotas `/api/rede/*` chamam `checkMultiUnitFeature(tenantId)` que verifica `Plan.features.multiUnit === true`

---

## Agente 5 — Super Admin Fase 3

### Como funciona

O Super Admin acessa `/admin/*` com autenticação JWT separada (`admin_token` cookie). As 4 novas seções são acessadas pelo sidebar do admin. Os dados são coletados por workers BullMQ rodando em background.

### Funcionalidades

#### 1. Saúde da Plataforma (`/admin/saude`)
**Arquivo:** `src/app/(admin)/admin/saude/`

- **5 cards de status:** API uptime%, Latência média, DB conexões, Redis memória/hit rate, AI tokens/dia
  - Cor da borda por status: verde=OK, âmbar=ALERTA, vermelho=CRÍTICO
- **Gráfico de latência:** LineChart (recharts) das últimas 24h, 1 ponto a cada 5 minutos, linha de referência em 2000ms
- **Alertas ativos:** Tabela com tipo, título, severidade, horário e botão "Resolver"
- **Dados:** Lidos de `PlatformHealthLog` (coletado pelo worker BullMQ a cada 5 minutos)

**Thresholds de alerta:**

| Métrica | ALERTA | CRÍTICO |
|---------|--------|---------|
| Uptime 24h | < 95% | < 50% |
| Latência (ms) | > 1000 | > 3000 |
| DB conexões | > 50 | > 100 |
| Redis memória | > 70% | > 90% |
| Redis hit rate | < 70% | < 50% |
| iFood webhooks falhos/24h | > 10 | — |

#### 2. Uso de IA (`/admin/uso-ia`)
**Arquivo:** `src/app/(admin)/admin/uso-ia/`

- **4 cards resumo:** Total tokens hoje (plataforma), Custo estimado mês, Tenants acima do limite, Próximos do limite
- **Gráfico:** BarChart com Top 10 tenants por consumo de tokens
- **Tabela completa:** Tenant, Plano, Tokens input/output, Custo R$, Limite, % usado
  - Badge vermelho "100%" quando acima do limite
  - Badge âmbar quando ≥ 80% do limite
- **Ações por tenant:**
  - **Editar limite** — Modal com input numérico (0 = ilimitado)
  - **Resetar contador** — Zera tokens input/output/custoEstimado (com confirmação)

#### 3. Integrações (`/admin/integracoes`)
**Arquivo:** `src/app/(admin)/admin/integracoes/`

- **Tabela:** Lista todos os tenants com status iFood e WhatsApp
- **Linha expandível (clique):** Detalhes inline
  - **iFood:** Merchant ID, última sincronização, botão "Forçar desconexão"
  - **WhatsApp:** Último envio, botão "Forçar desconexão"
- **Desconexão forçada:**
  - iFood: atualiza `IFoodIntegration.status = DESCONECTADO`, limpa tokens
  - WhatsApp: chama `DELETE /instance/logout/:tenantId` na Evolution API

#### 4. Financeiro SaaS (`/admin/financeiro`)
**Arquivo:** `src/app/(admin)/admin/financeiro/`

4 abas independentes:

**Aba MRR:**
- Card MRR total + ARR projetado (MRR × 12) + breakdown por planId
- Gráfico de área (recharts AreaChart) com histórico dos últimos 12 meses de `SaasMetricsSnapshot`

**Aba Métricas:**
- Churn Rate = cancelamentos / ativos no início do mês (por mês/ano)
- LTV = MRR médio por tenant × tempo médio de retenção
- NRR = (MRR retido + expansão − contração) / MRR inicial × 100
- CAC = campo manual, persiste em `AdminSettings { chave: 'cac_mensal', valor: { '2026-06': 350 } }`

**Aba Cohort:**
- Grid: linhas = mês de aquisição, colunas = M0, M1, M2, ... M11
- Células coloridas por taxa de retenção:
  - ≥90%: verde escuro | 70-89%: verde | 50-69%: âmbar | <50%: vermelho

**Aba Projeção:**
- Histórico real (12 meses) + projeção (3 meses) baseada na taxa de crescimento média dos últimos snapshots
- Intervalo de confiança: ±15%
- 3 cards com MRR projetado para meses 1/2/3

### Schema adicionado (Agent 5)
```
PlatformHealthLog  — registro de saúde a cada 5 min (tipo, metrica, valor, status)
SaasMetricsSnapshot — snapshot diário de MRR, churn, tenant count
AdminNotification  — alertas críticos internos (resolvido via PATCH)
AdminSettings      — pares chave-valor admin (ex: cac_mensal)
```

### Worker BullMQ
**Arquivo:** `src/jobs/worker.ts`

**Iniciar o worker:**
```bash
npm run worker
```

| Queue | Agendamento | Ação |
|-------|-------------|------|
| `platform-health` | `*/5 * * * *` (5 min) | Coleta métricas → salva PlatformHealthLog |
| `saas-metrics-snapshot` | `0 1 * * *` (01h) | Calcula MRR/churn → salva SaasMetricsSnapshot |

O worker usa as filas já configuradas em `src/lib/queues.ts` com as mesmas credenciais Redis do sistema.

**Nota:** Sem o worker rodando, os cards de saúde ficam vazios ("SEM DADOS"). Os dados de uso de IA e integrações são lidos direto do banco e não dependem do worker.

### Sidebar Admin
**Arquivo:** `src/components/admin/sidebar.tsx`

Novos itens adicionados:
- ❤ **Saúde** → `/admin/saude`
- ✨ **Uso de IA** → `/admin/uso-ia`
- 🔌 **Integrações** → `/admin/integracoes`
- 📈 **Financeiro** → `/admin/financeiro`

---

## Página de Ajuda Atualizada

**Arquivo:** `src/app/(dashboard)/ajuda/page.tsx`

- Nova seção **"Multi-Unidade (Rede)"** com 6 passos detalhados
- 4 novas perguntas no FAQ:
  - Como acessar o painel da rede
  - Por que o gráfico consolidado está vazio
  - Como funciona o pedido consolidado
  - Como configurar preços diferentes por unidade

---

## Notas de Instalação / Migração

### 1. Migrar o banco de dados
```bash
npx prisma migrate dev
# ou em produção:
npx prisma migrate deploy
```

Duas migrações novas:
- `20260605012816_add_multi_unit_models`
- `20260605014852_add_super_admin_health_saas_models`

### 2. Configurar variável de ambiente (opcional)
```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=sua_chave_aqui
```

### 3. Iniciar o worker BullMQ (obrigatório para `/admin/saude`)
```bash
npm run worker
```

Mantenha o worker rodando em processo separado do Next.js (ex: PM2 ou serviço systemd).

### 4. Criar um plano Enterprise
No Super Admin (`/admin/planos`), edite ou crie um plano com:
```json
{
  "multiUnit": true,
  "aiAgent": true,
  "advancedReports": true,
  "exportReports": true,
  "prioritySupport": true
}
```

### 5. Criar uma Brand e vincular unidades
Atualmente via Prisma Studio ou seed. API futura planejada:
```
POST /api/rede/brands  (requer Super Admin)
POST /api/rede/unidades { tenantId }
```

---

## Itens fora do escopo desta release (planejados)
- Notificação push via WhatsApp quando unidade entra em alerta
- Relatório de agendamentos consolidados por rede
- Endpoint de criação de Brand via API REST (atualmente requer Prisma direto)
- Painel de custo de IA com breakdown por feature (NF, chat, etc.)
- Webhook de saúde para integração com ferramentas externas (PagerDuty, etc.)
