# THE FINANCE — Relatório Técnico do Projeto

**Data de geração:** 27/05/2026  
**Versão do sistema:** 0.1.0  
**Status:** Em desenvolvimento

---

## 1. Visão Geral

THE FINANCE é um sistema SaaS multi-tenant de gestão operacional para restaurantes e lanchonetes. Oferece controle de estoque com custo médio ponderado (CMP), cardápio digital com fichas técnicas, painéis operacionais (cozinha, caixa, estoque, garçom) com acesso por PIN, gestão de pedidos com PDV completo, gestão de usuários com controle de acesso granular e um módulo financeiro integrado.

O sistema é dividido em quatro camadas de acesso independentes:

| Camada | Rota base | Autenticação |
|--------|-----------|--------------|
| Landing page pública | `/` | Nenhuma |
| Painel do restaurante | `/dashboard`, `/estoque`, `/configuracoes` | NextAuth (JWT, 8h) |
| Painéis operacionais | `/{slug}/cozinha`, `/{slug}/caixa`, `/{slug}/estoque`, `/{slug}/garcom` | PIN de 4 dígitos (state-only) |
| Super Admin | `/admin` | JWT próprio (8h) + TOTP 2FA |

---

## 2. Stack Tecnológica

### Runtime e Framework
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Next.js | 14.2.35 | Framework full-stack (App Router) |
| React | 18 | UI |
| TypeScript | 5 | Tipagem estática |
| Node.js | 20 | Runtime |

### Banco de Dados e ORM
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| PostgreSQL | — | Banco principal |
| Prisma | 7.8.0 | ORM + migrações |
| @prisma/adapter-pg | 7.8.0 | Adapter nativo para pg |

### Autenticação e Segurança
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| NextAuth.js | 4.24.14 | Autenticação de usuários tenant |
| Jose | 6.2.3 | JWT para admin e impersonação |
| bcryptjs | 3.0.3 | Hash de senhas e PINs (12 rounds) |
| otplib | 12.0.1 | TOTP (2FA) para super admin |
| qrcode | 1.5.4 | QR code para setup 2FA |

### UI e Estilo
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Tailwind CSS | 4.2.4 | Estilos utilitários |
| shadcn/ui | 4.6.0 | Componentes base (Radix UI) |
| Lucide React | 1.14.0 | Ícones |
| Recharts | 3.8.1 | Gráficos (MRR, signups, distribuição de planos) |
| Sonner | 2.0.7 | Notificações toast |
| next-themes | — | Suporte a tema claro/escuro |

### Comunicação e Email
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Resend | 6.12.2 | Envio de emails transacionais (prioridade) |
| Nodemailer | 7.0.13 | Fallback SMTP quando Resend não configurado |
| @react-email/components | 1.0.12 | Templates de email em React |
| Socket.IO | 4.8.3 | WebSocket para KDS em tempo real |

### Validação e Utilidades
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Zod | 4.4.2 | Validação de schemas |
| date-fns | 4.1.0 | Manipulação de datas |
| React Hook Form | 7.75.0 | Gerenciamento de formulários |

### Testes
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Vitest | 4.1.5 | Test runner |
| @vitest/coverage-v8 | 4.1.5 | Cobertura de código |

---

## 3. Arquitetura

### Estrutura de Pastas

```
src/
├── app/
│   ├── (admin)/          ← Painel Super Admin (layout próprio)
│   │   └── admin/
│   │       ├── page.tsx           ← Dashboard
│   │       ├── restaurantes/      ← CRUD tenants
│   │       ├── planos/            ← Gestão de planos
│   │       └── logs/              ← Auditoria de ações
│   ├── (dashboard)/      ← Painel do restaurante (layout próprio)
│   │   ├── loading.tsx            ← Skeleton genérico (fallback Suspense)
│   │   ├── dashboard/
│   │   │   └── loading.tsx        ← Skeleton do home dashboard
│   │   ├── estoque/
│   │   │   ├── loading.tsx        ← Skeleton do estoque
│   │   │   ├── insumos/           ← Gestão de ingredientes
│   │   │   ├── produtos/          ← Gestão de produtos/cardápio
│   │   │   └── inventario/        ← Contagem física de estoque
│   │   ├── configuracoes/
│   │   │   ├── loading.tsx        ← Skeleton de configurações
│   │   │   ├── perfil/            ← Perfil do usuário
│   │   │   ├── usuarios/          ← Usuários e cargos
│   │   │   ├── restaurante/       ← Configurações do restaurante (nome, logo)
│   │   │   └── assinatura/        ← Gerenciar assinatura
│   │   └── plano-bloqueado/       ← Tela de plano suspenso
│   ├── [slug]/           ← Painéis operacionais (acesso público por PIN)
│   │   ├── cozinha/      ← KDS — tema escuro/verde, ícone ChefHat
│   │   ├── caixa/        ← Painel do Caixa — tema âmbar, ícone ShoppingCart
│   │   ├── estoque/      ← Painel do Estoquista — tema azul, ícone Package
│   │   └── garcom/       ← Painel do Garçom — tema roxo, ícone UtensilsCrossed
│   ├── admin/            ← Auth admin (fora do layout admin)
│   │   ├── login/
│   │   ├── setup-2fa/
│   │   └── recuperar-senha/
│   ├── auth/             ← Auth do restaurante
│   │   ├── login/        ← Inclui seção "Acesso por PIN" unificada (4 cargos)
│   │   ├── register/
│   │   ├── recuperar-senha/
│   │   └── convite/[token]/
│   ├── api/              ← Todos os endpoints REST
│   └── page.tsx          ← Landing page
├── components/
│   ├── admin/            ← Componentes do painel admin
│   ├── ingredients/      ← Formulários de insumos
│   ├── landing/          ← Landing page completa
│   ├── layout/           ← Header, Sidebar, banners
│   ├── products/         ← Formulários de produtos
│   ├── usuarios/         ← InviteSheet, UserCard, OtpInput, ResetPinSheet
│   └── ui/               ← Componentes shadcn/ui
├── hooks/                ← usePermissions, usePlanFeatures
├── lib/
│   ├── auth.ts           ← NextAuth config
│   ├── admin-auth.ts     ← JWT admin
│   ├── permissions.ts    ← Verificação de permissões
│   ├── permissions-constants.ts ← Definições de permissões e roles padrão
│   ├── pdv.ts            ← Lógica pura do PDV (sem acesso ao banco)
│   ├── plan-features.ts  ← Feature flags de plano
│   ├── rate-limit.ts     ← Rate limiter em memória
│   ├── totp.ts           ← TOTP 2FA
│   ├── admin-logger.ts   ← Log de auditoria admin
│   ├── email/
│   │   ├── email.service.ts     ← Abstração multi-provedor (Resend → SMTP → Console)
│   │   └── templates/           ← React Email templates
│   └── __tests__/        ← Testes unitários (Vitest)
├── types/                ← Tipos TypeScript globais
└── middleware.ts         ← Guarda de rotas (NextAuth + admin JWT)
```

### Modelo Multi-Tenant

Cada restaurante é um **Tenant** isolado. Todo dado de negócio (ingredientes, produtos, usuários, pedidos, mesas) carrega `tenantId`. A sessão do usuário, via NextAuth, inclui o `tenantId` e todas as queries de API filtram por ele.

```
Tenant (restaurante)
  ├── Users (funcionários com roles)
  ├── TenantSubscription (plano atual)
  ├── Ingredients (estoque)
  ├── Products (cardápio)
  ├── Categories
  ├── Suppliers
  ├── IngredientMovements
  ├── Inventarios (contagens físicas)
  ├── Invoices (faturas)
  ├── Ambientes (áreas do restaurante)
  ├── Mesas (mesas por ambiente)
  ├── Pedidos (pedidos com itens e pagamentos)
  ├── Reservas (reservas de mesa)
  └── SessoesCaixa (sessões de abertura/fechamento)
```

### Fluxo de Autenticação

```
Usuário tenant:
  POST /api/auth/register → cria Tenant + User (ADMIN)
  POST /auth/login (NextAuth) → sessão JWT 8h
  Middleware verifica token → redireciona se expirado
  Sessão invalidada se senha alterada após emissão do token

Painéis operacionais (PIN):
  GET /api/{area}/auth?slug=X → lista funcionários ativos com PIN do cargo
  POST /api/{area}/auth → verifica PIN com bcrypt → retorna dados do usuário
  Sessão mantida em React state — refresh = logout automático

Super Admin:
  POST /api/admin/auth/login
    → bcrypt verify + lockout check
    → TOTP verify (obrigatório)
    → JWT 8h em cookie HttpOnly
  Middleware verifica admin_token antes do NextAuth
```

### Serviço de Email Multi-Provedor

O envio de e-mails usa uma abstração em `email.service.ts` com fallback automático:

```
1. Resend (RESEND_API_KEY definida)   → prioridade
2. SMTP via Nodemailer                → fallback
3. Console log                        → desenvolvimento local
```

### Skeletons de Carregamento (loading.tsx)

Cada nível do dashboard tem um `loading.tsx` que serve como boundary Suspense do Next.js, exibindo esqueletos animados imediatamente durante a navegação (sem atraso de TTFB):

| Arquivo | Contexto |
|---------|---------|
| `(dashboard)/loading.tsx` | Fallback genérico para qualquer rota do painel |
| `(dashboard)/dashboard/loading.tsx` | Home — título + 4 cards de estatísticas |
| `(dashboard)/estoque/loading.tsx` | Estoque — stats + toolbar + tabela de 8 linhas |
| `(dashboard)/configuracoes/loading.tsx` | Configurações — título + lista com avatares circulares |

Todos usam `animate-pulse` (Tailwind) e variáveis CSS `--tf-surface` / `--tf-border`.

---

## 4. Módulos do Sistema

### 4.1 Estoque de Insumos

**Rota:** `/estoque/insumos`  
**API:** `/api/ingredients`, `/api/suppliers`, `/api/categories`

Funcionalidades:
- Cadastro de ingredientes com unidade (KG, G, L, ML, UN), custo unitário, código interno, quantidade mínima, data de validade, fornecedor primário e secundário
- **Custo Médio Ponderado (CMP):** Calculado automaticamente a cada entrada de estoque
- Movimentações: Entrada (IN), Saída (OUT), Ajuste (ADJUSTMENT), Perda (LOSS), Vencimento (EXPIRY), Uso Interno (INTERNAL_USE)
- Status de estoque: `ok`, `low`, `critical`, `expiring`, `expired`
- Busca por nome, filtro por categoria e status
- Histórico completo de movimentações por insumo
- Gestão de fornecedores (CRUD)
- Categorias de ingredientes (CRUD)

**Cálculo de CMP:**
```
Novo CMP = (Qtd atual × CMP atual + Qtd entrada × Custo entrada)
           ─────────────────────────────────────────────────────
                    Qtd atual + Qtd entrada
```

### 4.2 Produtos e Fichas Técnicas

**Rota:** `/estoque/produtos`  
**API:** `/api/products`, `/api/products/[id]/ingredients`

Funcionalidades:
- Cadastro de produtos com preço de venda, categoria, foto, status (ativo/inativo)
- Ficha técnica: vinculação de ingredientes com quantidade por unidade produzida
- **Custo automático:** soma do (CMP × quantidade) de cada insumo da ficha
- **Margem de contribuição:** `(preço − custo) / preço × 100`
- Verificação de disponibilidade com base no estoque atual dos insumos vinculados
- Categorias de produtos (CRUD)
- Desconto de estoque por venda (integrado com PDV)

### 4.3 Inventário Físico

**Rota:** `/estoque/inventario`  
**API:** `/api/inventarios`, `/api/inventarios/[id]`, `/api/inventarios/[id]/finalizar`

Funcionalidades:
- Criação de inventário (status: `ABERTO` → `FINALIZADO` / `CANCELADO`)
- Contagem física item a item com campo de quantidade contada
- Variância calculada: `contado − sistema`
- Ao finalizar: ajusta quantidade atual do estoque com movimentação `ADJUSTMENT`
- Histórico de inventários com data e responsável

### 4.4 Usuários e Controle de Acesso

**Rota:** `/configuracoes/usuarios`  
**API:** `/api/usuarios`, `/api/roles`

Sistema de roles padrão (criadas automaticamente ao registrar um restaurante):

| Role padrão | Acesso |
|------------|--------|
| ADMIN_RESTAURANTE | Total (todas as 16 permissões) |
| GERENTE | Estoque + produtos + usuários + relatórios + cozinha |
| CAIXA | PDV, produtos (leitura), estoque (leitura), cozinha (leitura) |
| COZINHEIRO | Cozinha + gerenciar cozinha, estoque (leitura) |
| ESTOQUISTA | Estoque completo, produtos (leitura), relatórios |
| GARCOM | Criar pedidos, visualizar produtos |

Permissões granulares disponíveis (16 no total):
- **Estoque:** visualizar, criar, editar, excluir, movimentar
- **Produtos:** visualizar, criar, editar, excluir
- **Usuários:** visualizar, gerenciar
- **Relatórios:** visualizar
- **Configurações:** visualizar, editar
- **Cozinha:** visualizar, gerenciar

Sistema de convites:
- **Por email:** Admin convida → token único (48h) → convidado define senha → status: `PENDING → ACTIVE`
- **Por PIN:** Admin cria diretamente com nome + PIN de 4 dígitos (hash bcrypt 12 rounds) — sem email. Disponível para cargos operacionais (Cozinheiro, Estoquista, Caixa, Garçom)
- **Reset de PIN:** Admin pode redefinir o PIN de qualquer usuário operacional

Banners de acesso rápido na página de usuários:
- **Verde** — `/{slug}/cozinha` (copiar link para o KDS)
- **Azul** — `/{slug}/estoque` (copiar link para o painel do estoquista)
- **Âmbar** — `/{slug}/caixa` (copiar link para o painel do caixa)
- **Roxo** — `/{slug}/garcom` (copiar link para o painel do garçom)

### 4.5 Painel da Cozinha (KDS)

**Rota:** `/{slug}/cozinha`  
**Tema:** escuro/verde (`accent: #2a9d6f`)  
**API:** `/api/cozinha/auth`  
**Autenticação:** PIN numérico — todos os usuários ativos com PIN do tenant

Funcionalidades:
- Acesso público por slug do restaurante, sem login email/senha
- Seleção de funcionário + autenticação por PIN de 4 dígitos (bcrypt compare)
- Exibe pedidos em tempo real via Socket.IO, separados por status
- Permite marcar itens de pedido como preparados
- Interface limpa sem sidebar/header para uso em tablets
- Sessão em React state — refresh da página = logout automático (comportamento intencional para tablets compartilhados)
- Fluxo de telas: `'select'` → `'pin'` → `'dashboard'`

### 4.6 Painel do Estoquista

**Rota:** `/{slug}/estoque`  
**Tema:** azul (`accent: #2a6fb4` / `#4b8fd4`)  
**API:** `/api/estoque/auth`  
**Autenticação:** PIN numérico — filtra por `customRole.name` contendo `"estoquista"` (case-insensitive)

Funcionalidades:
- Acesso público por slug do restaurante, sem login email/senha
- Ícone: `Package` (Lucide)
- Seção pós-login: "MOVIMENTAÇÕES RECENTES" — entradas e saídas recentes do estoque
- Mesma arquitetura de estado da cozinha: `'select' | 'pin' | 'dashboard'`

### 4.7 Painel do Caixa

**Rota:** `/{slug}/caixa`  
**Tema:** âmbar (`accent: #b48a2a` / `#d4a84b`)  
**API:** `/api/caixa/auth`  
**Autenticação:** PIN numérico — filtra por `customRole.name` contendo `"caixa"` (case-insensitive)

Funcionalidades:
- Acesso público por slug do restaurante, sem login email/senha
- Ícone: `ShoppingCart` (Lucide)
- Abertura e fechamento de sessão de caixa (`SessaoCaixa`) com valor de abertura
- Registro de sangrias durante a sessão
- Seção pós-login: "PEDIDOS DO DIA" — pedidos prontos aguardando pagamento
- Processamento de pagamentos com múltiplos métodos (Dinheiro, Débito, Crédito, Pix)
- Fechamento de caixa com relatório da sessão
- Mesma arquitetura de estado da cozinha: `'select' | 'pin' | 'dashboard'`

### 4.8 Painel do Garçom

**Rota:** `/{slug}/garcom`  
**Tema:** roxo (`accent` roxo, ícone `UtensilsCrossed`)  
**API:** `/api/garcom/auth`, `/api/mesas`, `/api/pedidos`  
**Autenticação:** PIN numérico — filtra por `customRole.name` contendo `"garcom"` (case-insensitive)

Funcionalidades:
- Acesso público por slug do restaurante, sem login email/senha
- Visualização de mesas por ambiente (área) com status: `LIVRE`, `OCUPADA`, `RESERVADA`
- Abertura de pedido vinculado a uma mesa
- Adição de itens do cardápio ao pedido com quantidade e observações
- Envio de pedido para a cozinha (status `EM_PREPARO`)
- Visualização de pedidos em aberto por mesa
- Mesma arquitetura de estado da cozinha: `'select' | 'pin' | 'dashboard'`

### 4.9 PDV — Gestão de Mesas e Ambientes

**API:** `/api/mesas`, `/api/ambientes`, `/api/config-pdv`  
**Gerenciado via:** configurações do restaurante / painel do garçom

Funcionalidades:
- Cadastro de **ambientes** (ex: Salão, Varanda, Mezanino) com capacidade
- Cadastro de **mesas** por ambiente com número identificador e capacidade
- Status de mesa: `LIVRE`, `OCUPADA`, `RESERVADA`
- Configuração do PDV: taxa de serviço (%), nome do restaurante exibido nos painéis
- Reservas com data, horário, número de pessoas e observações

### 4.10 PDV — Pedidos e Pagamentos

**API:** `/api/pedidos`, `/api/pedidos/[id]`, `/api/pedidos/[id]/itens`, `/api/pedidos/[id]/finalizar`

Funcionalidades:
- Criação de pedidos vinculados a mesas ou balcão
- Adição e remoção de itens com quantidade e observações individuais
- Status do pedido: `ABERTO` → `EM_PREPARO` → `PRONTO` → `ENTREGUE` → `FINALIZADO` / `CANCELADO`
- Status por item de pedido para controle da cozinha
- Cálculo automático de total com taxa de serviço configurável
- Métodos de pagamento: Dinheiro, Débito, Crédito, Pix
- Suporte a pagamento parcial e múltiplos métodos no mesmo pedido
- Ao finalizar: desconta automaticamente os ingredientes das fichas técnicas dos produtos vendidos
- Histórico de pedidos por dia/período

### 4.11 Configurações de Perfil

**Rota:** `/configuracoes/perfil`  
**API:** `/api/perfil`, `/api/perfil/permissions`, `/api/perfil/tenant`

Funcionalidades:
- Edição de nome e dados pessoais
- Troca de senha com indicador de força
- Visualização das permissões do cargo atual
- Log de últimos acessos com IP e timestamp
- Visualização dos dados do restaurante vinculado

### 4.12 Configurações do Restaurante

**Rota:** `/configuracoes/restaurante`  
**API:** `/api/perfil/tenant`

Funcionalidades:
- Edição de nome do restaurante
- Upload de logo
- Configuração de telefone de contato
- Visível apenas para usuários com permissão `configuracoes.editar`

### 4.13 Assinatura

**Rota:** `/configuracoes/assinatura`  
**API:** `/api/assinatura`, `/api/assinatura/cancelar`

Funcionalidades:
- Visualização do plano atual e status (`TRIAL`, `ACTIVE`, `OVERDUE`, `SUSPENDED`, `CANCELLED`)
- Contagem regressiva do período de trial
- Upgrade/downgrade de plano (self-service)
- Solicitação de cancelamento com motivo
- Histórico de planos (`PlanHistory`)
- Tela `/plano-bloqueado` para tenants com assinatura suspensa

### 4.14 Login Unificado com Acesso por PIN

**Rota:** `/auth/login`

A página de login do restaurante inclui uma seção "Acesso por PIN" que permite redirecionar funcionários operacionais sem precisar de email/senha:

1. Clicar em **Acesso por PIN** (ícone `KeyRound`)
2. Selecionar o cargo: **Cozinheiro**, **Estoquista**, **Caixa** ou **Garçom**
3. Buscar o restaurante pelo nome (pesquisa em `/api/cozinha/buscar`)
4. Ao selecionar, redireciona para `/{slug}/cozinha`, `/{slug}/estoque`, `/{slug}/caixa` ou `/{slug}/garcom`

---

## 5. Painel Super Admin

**Rota base:** `/admin`  
**Autenticação:** JWT próprio + TOTP obrigatório

### 5.1 Dashboard Admin

Métricas em tempo real:
- Total de restaurantes cadastrados
- Subscriptions Ativas / Em Trial / Suspensas
- MRR (Monthly Recurring Revenue) — soma de `contractedPrice` das assinaturas ACTIVE
- Novos cadastros nos últimos 30 dias
- Churns no mês corrente
- Taxa de conversão Trial → Pago

Gráficos (Recharts):
- **MRR** — linha nos últimos 12 meses (baseado em invoices PAID)
- **Novos cadastros** — barras por mês
- **Distribuição por plano** — pizza (ACTIVE + TRIAL)

### 5.2 Gestão de Restaurantes

- Listagem com busca (nome ou email do responsável)
- Filtros: status da assinatura, plano
- Ações por tenant:
  - Ver detalhes (dados do tenant, uso, faturas)
  - **Impersonar** — acessa o painel como se fosse o tenant por 2h (banner de aviso exibido)
  - Suspender / Reativar
  - Resetar senha do admin do restaurante (gera senha temporária enviada por email)
  - Excluir (soft delete)

### 5.3 Gestão de Planos

- Criar/editar/excluir planos
- Campos: nome, descrição, preço mensal, preço anual, `maxUsers`, `maxProducts`, `maxOrdersMonth`
- Features booleanas: `aiAgent`, `advancedReports`, `multiUnit`, `prioritySupport`, `exportReports`
- Proteção: plano com assinaturas ativas não pode ser excluído

### 5.4 Log de Auditoria

Todas as ações do admin são registradas com:
- Timestamp, email do admin, tipo de ação, IP, detalhes JSON

Tipos de ação rastreados:
`LOGOUT` · `UPDATE_TENANT` · `DELETE_TENANT` · `SUSPEND_TENANT` · `REACTIVATE_TENANT` · `IMPERSONATE_TENANT` · `RESET_TENANT_PASSWORD` · `CREATE_PLAN` · `UPDATE_PLAN` · `DELETE_PLAN` · `CREATE_INVOICE`

### 5.5 Notificações de Inadimplência

- **API:** `/api/admin/notifications`
- Alertas de tenants com assinatura `OVERDUE` ou `SUSPENDED`
- Exibidos no header do painel admin

---

## 6. Segurança

### Autenticação
- Senhas e PINs com bcrypt (12 rounds)
- Bloqueio após 5 tentativas falhas (15 min) — usuários tenant e admin
- Timing-safe: sempre executa bcrypt mesmo se usuário não existe (previne enumeração de e-mails)
- Sessões invalidadas ao trocar senha (`passwordChangedAt` vs `iat` do token)
- Painéis operacionais (PIN) sem cookie/JWT — sessão 100% em React state, refresh = logout

### Autorização
- Middleware Next.js verifica JWT antes de qualquer request a rotas protegidas
- Admin e tenant têm sistemas de sessão completamente separados
- Impersonação com token dedicado (2h), sem elevar privilégios do tenant
- Filtro de cargo nos endpoints de PIN usa `contains + mode: 'insensitive'` (robusto a variações de maiúsculo/minúsculo)

### Rate Limiting (in-memory, por IP)
| Endpoint | Limite | Janela |
|----------|--------|--------|
| Admin login | 10 req | 15 min |
| Registro de conta | 5 req | 1h |
| Reset de senha | 3 req | 15 min |
| Uso de token de reset | 5 req | 1h |

### Headers HTTP (next.config.mjs)
- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera, microphone, geolocation: none)

### Cookies
- `admin_token`: HttpOnly, Secure (prod), SameSite=Lax, 8h
- `impersonation_token`: HttpOnly, Secure (prod), SameSite=Lax, 2h

---

## 7. Banco de Dados

### Diagrama de Modelos

```
AdminUser ──── AdminLog
    │
    └── AdminPasswordResetToken

Tenant ─┬─── User ──── Role (customRole)
        │       └── UserAccessLog
        ├─── TenantSubscription ──── Plan
        ├─── PlanHistory
        ├─── CancellationRequest
        ├─── Invoice ──────────────── Plan
        ├─── Ingredient ─┬─── Category (INGREDIENT)
        │                ├─── Supplier
        │                └─── IngredientMovement
        ├─── Product ────┬─── Category (PRODUCT)
        │                └─── ProductIngredient ──── Ingredient
        ├─── Inventario ─── InventarioItem ──── Ingredient
        ├─── Ambiente ───── Mesa
        ├─── Pedido ─┬──── PedidoItem ──── Product
        │            └──── Pagamento
        ├─── Reserva ────── Mesa
        ├─── SessaoCaixa
        ├─── Role (cargos custom do tenant)
        └─── Invite
```

### Enums

| Enum | Valores |
|------|---------|
| `UserRole` | SUPER_ADMIN, ADMIN, MANAGER, STAFF |
| `UserStatus` | ACTIVE, INACTIVE, PENDING |
| `SubscriptionStatus` | TRIAL, ACTIVE, OVERDUE, CANCELLED, SUSPENDED |
| `InvoiceStatus` | PAID, PENDING, OVERDUE |
| `AdminRole` | SUPER_ADMIN |
| `Unit` | KG, G, L, ML, UN |
| `MovementType` | IN, OUT, ADJUSTMENT, LOSS, EXPIRY, INTERNAL_USE |
| `CategoryType` | INGREDIENT, PRODUCT |
| `InviteStatus` | PENDING, ACCEPTED, EXPIRED |
| `MesaStatus` | LIVRE, OCUPADA, RESERVADA |
| `PedidoStatus` | ABERTO, EM_PREPARO, PRONTO, ENTREGUE, FINALIZADO, CANCELADO |
| `PagamentoMetodo` | DINHEIRO, DEBITO, CREDITO, PIX |

### Cargos padrão criados por tenant (seed)

| Chave | Nome no banco | Permissões principais |
|-------|--------------|----------------------|
| `ADMIN_RESTAURANTE` | `ADMIN_RESTAURANTE` | Todas (16) |
| `GERENTE` | `GERENTE` | Estoque + produtos + usuários + relatórios + cozinha |
| `CAIXA` | `CAIXA` | produtos.ver, estoque.ver, cozinha.ver |
| `COZINHEIRO` | `COZINHEIRO` | cozinha.ver, cozinha.gerenciar, estoque.ver |
| `ESTOQUISTA` | `ESTOQUISTA` | estoque completo, produtos.ver, relatorios.ver |
| `GARCOM` | `GARCOM` | produtos.ver + criar pedidos |

### Migrações

| Arquivo | Descrição |
|---------|-----------|
| `20260502200240_init` | Estrutura inicial |
| `20260503031947_init` | Ajustes iniciais |
| `20260503163751_add_roles_invites_users` | Roles, convites, usuários |
| `20260504031754_add_password_reset_and_lockout` | Reset de senha, lockout |

---

## 8. API REST

### Endpoints do Restaurante

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/register` | Registrar novo restaurante |
| GET/POST | `/api/ingredients` | Listar / criar insumos |
| GET/PATCH/DELETE | `/api/ingredients/[id]` | Detalhe / editar / excluir insumo |
| POST | `/api/ingredients/[id]/movements` | Registrar movimentação |
| GET | `/api/ingredients/[id]/movimentacoes` | Histórico de movimentações do insumo |
| GET/POST | `/api/products` | Listar / criar produtos |
| GET/PATCH/DELETE | `/api/products/[id]` | Detalhe / editar / excluir produto |
| POST/DELETE | `/api/products/[id]/ingredients` | Vincular / desvincular insumo na ficha |
| GET/POST | `/api/categories` | Listar / criar categorias |
| GET/POST | `/api/suppliers` | Listar / criar fornecedores |
| GET/POST | `/api/inventarios` | Listar / iniciar inventário |
| GET/PATCH | `/api/inventarios/[id]` | Detalhe / atualizar contagem item |
| POST | `/api/inventarios/[id]/finalizar` | Finalizar inventário e ajustar estoque |
| GET | `/api/estoque/dashboard` | Estatísticas do estoque |
| GET/PATCH | `/api/perfil` | Perfil do usuário logado |
| PUT | `/api/perfil` | Trocar senha |
| GET | `/api/perfil/permissions` | Permissões do usuário logado |
| GET | `/api/perfil/tenant` | Dados do tenant (nome, logo) |
| GET/POST | `/api/usuarios` | Listar / convidar usuários |
| GET/PATCH/DELETE | `/api/usuarios/[id]` | Detalhe / editar / remover usuário |
| PUT | `/api/usuarios/[id]/pin` | Definir / atualizar PIN |
| POST | `/api/usuarios/[id]/reset-senha` | Admin reseta senha do usuário |
| GET/POST | `/api/roles` | Listar / criar cargos customizados |
| GET/PATCH/DELETE | `/api/roles/[id]` | Detalhe / editar / remover cargo |
| GET/POST | `/api/assinatura` | Consultar / criar assinatura |
| POST | `/api/assinatura/cancelar` | Solicitar cancelamento |
| POST | `/api/convite/[token]` | Aceitar convite |
| GET | `/api/convite/validate/[token]` | Validar token de convite |
| POST | `/api/recuperar-senha` | Solicitar reset de senha |
| POST | `/api/recuperar-senha/[token]` | Confirmar reset com novo password |
| GET | `/api/recuperar-senha/validate/[token]` | Validar token de reset |

### Endpoints do PDV

| Método | Rota | Descrição |
|--------|------|-----------|
| GET/POST | `/api/ambientes` | Listar / criar ambientes (áreas) |
| GET/PATCH/DELETE | `/api/ambientes/[id]` | Detalhe / editar / excluir ambiente |
| GET/POST | `/api/mesas` | Listar / criar mesas |
| GET/PATCH/DELETE | `/api/mesas/[id]` | Detalhe / editar / excluir mesa |
| GET | `/api/config-pdv` | Configurações do PDV (taxa, nome) |
| GET/POST | `/api/pedidos` | Listar / criar pedidos |
| GET/PATCH | `/api/pedidos/[id]` | Detalhe / atualizar status do pedido |
| POST | `/api/pedidos/[id]/itens` | Adicionar item ao pedido |
| DELETE | `/api/pedidos/[id]/itens/[itemId]` | Remover item do pedido |
| POST | `/api/pedidos/[id]/finalizar` | Finalizar pedido (pagamento + baixa de estoque) |

### Endpoints de Painéis Operacionais (PIN)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/cozinha/auth?slug=X` | Lista usuários ativos com PIN do tenant |
| POST | `/api/cozinha/auth` | Verifica PIN e autentica cozinheiro |
| GET | `/api/cozinha/buscar?q=X` | Busca restaurantes por nome |
| GET | `/api/estoque/auth?slug=X` | Lista estoquistas ativos com PIN |
| POST | `/api/estoque/auth` | Verifica PIN e autentica estoquista |
| GET | `/api/caixa/auth?slug=X` | Lista caixas ativos com PIN |
| POST | `/api/caixa/auth` | Verifica PIN e autentica caixa |
| GET | `/api/garcom/auth?slug=X` | Lista garçons ativos com PIN |
| POST | `/api/garcom/auth` | Verifica PIN e autentica garçom |

### Endpoints do Admin

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/admin/auth/login` | Login admin (bcrypt + TOTP) |
| POST | `/api/admin/auth/logout` | Logout admin |
| POST | `/api/admin/auth/setup-2fa` | Ativar TOTP 2FA |
| POST/GET | `/api/admin/auth/recuperar-senha` | Reset senha admin |
| GET | `/api/admin/dashboard` | Métricas gerais (MRR, signups, churn) |
| GET | `/api/admin/tenants` | Listar restaurantes (com filtros e busca) |
| GET/PUT/DELETE | `/api/admin/tenants/[id]` | Detalhe / editar / excluir tenant |
| POST | `/api/admin/tenants/[id]/suspend` | Suspender / reativar tenant |
| POST | `/api/admin/tenants/[id]/impersonate` | Iniciar impersonação |
| POST | `/api/admin/tenants/[id]/stop-impersonation` | Encerrar impersonação |
| POST | `/api/admin/tenants/[id]/reset-password` | Resetar senha do admin do tenant |
| GET/POST | `/api/admin/plans` | Listar / criar planos |
| GET/PUT/DELETE | `/api/admin/plans/[id]` | Detalhe / editar / excluir plano |
| GET | `/api/admin/invoices` | Listar faturas |
| GET | `/api/admin/logs` | Log de auditoria de ações admin |
| GET | `/api/admin/notifications` | Alertas de inadimplência |

---

## 9. Templates de Email

Implementados com React Email + Resend (com fallback para SMTP via Nodemailer):

| Template | Gatilho |
|----------|---------|
| `welcome-invite.tsx` | Convite para novo usuário (contém link com token de 48h) |
| `password-reset.tsx` | Solicitação de reset de senha (tenant) |
| `admin-password-reset.tsx` | Reset de senha do super admin |
| `password-changed.tsx` | Confirmação de senha alterada com sucesso |
| `account-locked.tsx` | Conta bloqueada por excesso de tentativas |
| `base-layout.tsx` | Layout base compartilhado por todos os templates |

---

## 10. Testes Automatizados

Localização: `src/lib/__tests__/`

| Arquivo de Teste | O que testa |
|-----------------|-------------|
| `admin-jwt.test.ts` | Geração e verificação de tokens JWT do admin |
| `auth.test.ts` | Lógica de autenticação (lockout, bcrypt, invalidação por senha) |
| `cost-calculation.test.ts` | Cálculo de CMP e custo de produtos via ficha técnica |
| `pdv.test.ts` | Lógica pura do PDV (cálculo de total, verificação de disponibilidade) |
| `pdv-validations.test.ts` | Validações dos schemas Zod do PDV |
| `plan-features.test.ts` | Parsing e verificação de features do plano |
| `plan-selfservice.test.ts` | Lógica de auto-serviço de planos (upgrade/downgrade) |
| `rate-limit.test.ts` | Janela deslizante do rate limiter em memória |
| `stock-enhanced.test.ts` | Movimentações e cálculo de status de estoque |
| `totp.test.ts` | Geração e verificação de tokens TOTP (2FA) |
| `utils.test.ts` | Formatação de moeda, datas, slugify |
| `validations.test.ts` | Schemas Zod (registro, ingredientes, produtos) |

Comando: `npm test` (Vitest)  
Cobertura: `npm run test:coverage`

---

## 11. Variáveis de Ambiente

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | String de conexão PostgreSQL |
| `NEXTAUTH_URL` | URL base da aplicação |
| `NEXTAUTH_SECRET` | Secret para assinar tokens NextAuth |
| `NEXT_PUBLIC_APP_URL` | URL pública (client-side) |
| `ADMIN_JWT_SECRET` | Secret para tokens JWT do super admin |
| `ADMIN_EMAIL` | Email inicial do super admin (seed) |
| `ADMIN_PASSWORD` | Senha inicial do super admin (seed) |
| `RESEND_API_KEY` | Chave da API Resend (prioridade no envio de emails) |
| `EMAIL_FROM` | Remetente dos emails transacionais |
| `EMAIL_SMTP_HOST` | Host SMTP (fallback quando Resend não configurado) |
| `EMAIL_SMTP_PORT` | Porta SMTP |
| `EMAIL_SMTP_USER` | Usuário SMTP |
| `EMAIL_SMTP_PASS` | Senha SMTP |
| `PASSWORD_RESET_SECRET` | Secret adicional para tokens de reset de senha |

---

## 12. Scripts Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Servidor de produção |
| `npm run lint` | ESLint |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:watch` | Testes em modo watch |
| `npm run test:coverage` | Relatório de cobertura |
| `npm run seed` | Popular banco com dados iniciais (super admin + planos padrão) |

---

## 13. Status dos Módulos

| Módulo | Status | Indicador |
|--------|--------|-----------|
| Estoque (insumos) | ✅ Implementado | Páginas + API completos |
| Produtos / Fichas técnicas | ✅ Implementado | Páginas + API completos |
| Inventário físico | ✅ Implementado | Páginas + API completos |
| Usuários e cargos | ✅ Implementado | Páginas + API completos |
| Landing page | ✅ Implementado | Página completa com design system |
| Painel Super Admin | ✅ Implementado | Dashboard, tenants, planos, logs |
| KDS (Painel da Cozinha) | ✅ Implementado | Acesso por PIN, Socket.IO |
| Painel do Estoquista | ✅ Implementado | `/{slug}/estoque`, PIN, tema azul |
| Painel do Caixa | ✅ Implementado | `/{slug}/caixa`, PIN, tema âmbar, SessaoCaixa |
| Painel do Garçom | ✅ Implementado | `/{slug}/garcom`, PIN, tema roxo, pedidos e mesas |
| PDV — Mesas e Ambientes | ✅ Implementado | CRUD de mesas/ambientes, status |
| PDV — Pedidos e Pagamentos | ✅ Implementado | Ciclo completo de pedido + baixa de estoque |
| Skeletons de carregamento | ✅ Implementado | 4 loading.tsx no dashboard |
| Acesso por PIN unificado | ✅ Implementado | Login page — 4 cargos com seletor |
| Configurações do restaurante | ✅ Implementado | Nome, logo, telefone |
| Email multi-provedor | ✅ Implementado | Resend → SMTP → Console |
| Agente IA (leitura de NF) | 📋 Planejado | Feature flag `aiAgent` no plano |
| Financeiro / DRE | 📋 Planejado | Invoices no schema, sem painel |
| Multi-unidade | 📋 Planejado | Feature flag `multiUnit` no plano |
| Exportação PDF/Excel | 📋 Planejado | Feature flag `exportReports` no plano |

---

## 14. Pontos de Atenção

### Limitações Conhecidas

1. **Rate limiter em memória** — O módulo `rate-limit.ts` usa `Map` em memória. Em ambientes com múltiplas instâncias (load balancer), o limite por IP não é compartilhado. Para produção com escala horizontal, substituir por Redis.

2. **Socket.IO sem cluster** — A instância do Socket.IO não tem adapter configurado. Com múltiplos processos Node, eventos não serão propagados entre instâncias. Requer `socket.io-redis` para escalabilidade.

3. **Seed do admin** — As credenciais iniciais do super admin (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) ficam no `.env`. Após o primeiro login, o 2FA deve ser configurado obrigatoriamente antes de qualquer ação.

4. **Sem CDN para assets** — Imagens e arquivos são servidos diretamente pelo Next.js. Em produção, considerar Cloudflare ou S3 + CloudFront.

5. **Painéis operacionais sem persistência de sessão** — O acesso via PIN é mantido apenas em React state. Qualquer refresh desconecta o funcionário. Comportamento intencional para tablets compartilhados.

### Segurança em Produção

- Garantir `NEXTAUTH_SECRET` e `ADMIN_JWT_SECRET` com entropia mínima de 256 bits
- Habilitar `secure: true` nos cookies (automático quando `NODE_ENV=production`)
- Revisar CSP para remover `unsafe-eval` e `unsafe-inline`
- Configurar backup automatizado do banco PostgreSQL
- Habilitar SSL/TLS no `DATABASE_URL`

---

*Gerado automaticamente — THE FINANCE v0.1.0*
