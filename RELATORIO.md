# THE FINANCE — Relatório Técnico do Projeto

**Data de geração:** 06/05/2026  
**Versão do sistema:** 0.1.0  
**Status:** Em desenvolvimento

---

## 1. Visão Geral

THE FINANCE é um sistema SaaS multi-tenant de gestão operacional para restaurantes e lanchonetes. Oferece controle de estoque com custo médio ponderado (CMP), cardápio digital com fichas técnicas, painel de cozinha (KDS) em tempo real, gestão de usuários com controle de acesso granular e um módulo financeiro integrado.

O sistema é dividido em três camadas de acesso independentes:

| Camada | Rota base | Autenticação |
|--------|-----------|--------------|
| Landing page pública | `/` | Nenhuma |
| Painel do restaurante | `/dashboard`, `/estoque`, `/configuracoes` | NextAuth (JWT, 8h) |
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
| bcryptjs | 3.0.3 | Hash de senhas (12 rounds) |
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

### Comunicação e Email
| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Resend | 6.12.2 | Envio de emails transacionais |
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
│   │   ├── dashboard/             ← Visão geral
│   │   ├── estoque/
│   │   │   ├── insumos/           ← Gestão de ingredientes
│   │   │   ├── produtos/          ← Gestão de produtos/cardápio
│   │   │   └── inventario/        ← Contagem física de estoque
│   │   ├── configuracoes/
│   │   │   ├── perfil/            ← Perfil do usuário
│   │   │   ├── usuarios/          ← Usuários e cargos
│   │   │   └── assinatura/        ← Gerenciar assinatura
│   │   └── plano-bloqueado/       ← Tela de plano suspenso
│   ├── [slug]/cozinha/   ← KDS público (acesso por PIN)
│   ├── admin/            ← Auth admin (fora do layout admin)
│   │   ├── login/
│   │   ├── setup-2fa/
│   │   └── recuperar-senha/
│   ├── auth/             ← Auth do restaurante
│   │   ├── login/
│   │   └── register/
│   ├── api/              ← Todos os endpoints REST
│   └── page.tsx          ← Landing page
├── components/
│   ├── admin/            ← Componentes do painel admin
│   ├── ingredients/      ← Formulários de insumos
│   ├── landing/          ← Landing page completa
│   ├── layout/           ← Header, Sidebar, banners
│   ├── products/         ← Formulários de produtos
│   └── ui/               ← Componentes shadcn/ui
├── hooks/                ← usePermissions, usePlanFeatures
├── lib/                  ← Utilitários, auth, prisma, validações
├── types/                ← Tipos TypeScript globais
└── middleware.ts         ← Guarda de rotas (NextAuth + admin JWT)
```

### Modelo Multi-Tenant

Cada restaurante é um **Tenant** isolado. Todo dado de negócio (ingredientes, produtos, usuários, pedidos) carrega `tenantId`. A sessão do usuário, via NextAuth, inclui o `tenantId` e todas as queries de API filtram por ele.

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
  └── Invoices (faturas)
```

### Fluxo de Autenticação

```
Usuário tenant:
  POST /api/auth/register → cria Tenant + User (ADMIN)
  POST /auth/login (NextAuth) → sessão JWT 8h
  Middleware verifica token → redireciona se expirado

Super Admin:
  POST /api/admin/auth/login
    → bcrypt verify + lockout check
    → TOTP verify (obrigatório)
    → JWT 8h em cookie HttpOnly
  Middleware verifica admin_token antes do NextAuth
```

---

## 4. Módulos do Sistema

### 4.1 Estoque de Insumos

**Rota:** `/estoque/insumos`  
**API:** `/api/ingredients`

Funcionalidades:
- Cadastro de ingredientes com unidade (KG, G, L, ML, UN), custo unitário, código interno, quantidade mínima, data de validade, fornecedor primário e secundário
- **Custo Médio Ponderado (CMP):** Calculado automaticamente a cada entrada de estoque
- Movimentações: Entrada, Saída, Ajuste, Perda, Vencimento, Uso Interno
- Status de estoque: `ok`, `low`, `critical`, `expiring`, `expired`
- Busca por nome, filtro por categoria e status
- Histórico completo de movimentações por insumo

**Cálculo de CMP:**
```
Novo CMP = (Qtd atual × CMP atual + Qtd entrada × Custo entrada)
           ─────────────────────────────────────────────────────
                    Qtd atual + Qtd entrada
```

### 4.2 Produtos e Fichas Técnicas

**Rota:** `/estoque/produtos`  
**API:** `/api/products`

Funcionalidades:
- Cadastro de produtos com preço de venda, categoria, foto
- Ficha técnica: vinculação de ingredientes com quantidade por unidade produzida
- **Custo automático:** soma do (CMP × quantidade) de cada insumo da ficha
- **Margem de contribuição:** `(preço − custo) / preço × 100`
- Controle de desconto de estoque por venda (integração futura com PDV)

### 4.3 Inventário Físico

**Rota:** `/estoque/inventario`  
**API:** `/api/inventarios`

Funcionalidades:
- Criação de inventário (status: ABERTO → FINALIZADO / CANCELADO)
- Contagem física item a item
- Variância: `contado − sistema`
- Ao finalizar: ajusta quantidade atual do estoque com movimentação `ADJUSTMENT`

### 4.4 Usuários e Controle de Acesso

**Rota:** `/configuracoes/usuarios`  
**API:** `/api/usuarios`, `/api/roles`

Sistema de roles:
| Role padrão | Acesso |
|------------|--------|
| ADMIN | Total |
| GERENTE | Tudo exceto gestão de usuários avançada |
| CAIXA | PDV, produtos (leitura), relatórios básicos |
| COZINHEIRO | Cozinha, produtos (leitura) |
| ESTOQUISTA | Estoque completo |

Permissões granulares disponíveis (16 no total):
- Estoque: visualizar, criar, editar, excluir, movimentar
- Produtos: visualizar, criar, editar, excluir
- Usuários: visualizar, gerenciar
- Relatórios: visualizar
- Configurações: visualizar, editar
- Cozinha: visualizar, gerenciar

Sistema de convites:
- Admin convida por email → token único (48h)
- Convidado define senha ao aceitar → status: PENDING → ACTIVE

PIN para cozinha:
- Cada usuário pode ter PIN de 4 dígitos
- Acesso ao KDS via `/{slug}/cozinha` sem login completo

### 4.5 Painel da Cozinha (KDS)

**Rota:** `/{slug}/cozinha`  
**Autenticação:** PIN numérico

- Acesso público por slug do restaurante
- Autenticação por PIN de 4 dígitos
- Atualização em tempo real via Socket.IO
- Interface limpa sem sidebar/header para uso em tablets

### 4.6 Configurações de Perfil

**Rota:** `/configuracoes/perfil`

- Edição de nome
- Troca de senha com indicador de força
- Visualização de permissões do cargo
- Log de últimos acessos com IP

### 4.7 Assinatura

**Rota:** `/configuracoes/assinatura`  
**API:** `/api/assinatura`

- Visualização do plano atual e status
- Upgrade/downgrade de plano
- Solicitação de cancelamento com motivo
- Tela `/plano-bloqueado` para tenants suspensos

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
  - Ver detalhes (dados, uso, faturas)
  - Impersonar (acessa o painel como se fosse o tenant por 2h)
  - Suspender / Reativar
  - Resetar senha do admin do restaurante (gera senha temporária)
  - Excluir (soft delete)

### 5.3 Gestão de Planos

- Criar/editar/excluir planos
- Campos: nome, descrição, preço mensal, preço anual, maxUsers, maxProducts, maxOrdersMonth
- Features booleanas: aiAgent, advancedReports, multiUnit, prioritySupport, exportReports
- Proteção: plano com assinaturas ativas não pode ser excluído

### 5.4 Log de Auditoria

Todas as ações do admin são registradas com:
- Timestamp, email do admin, tipo de ação, IP, detalhes

Tipos de ação rastreados:
`LOGOUT` · `UPDATE_TENANT` · `DELETE_TENANT` · `SUSPEND_TENANT` · `REACTIVATE_TENANT` · `IMPERSONATE_TENANT` · `RESET_TENANT_PASSWORD` · `CREATE_PLAN` · `UPDATE_PLAN` · `DELETE_PLAN` · `CREATE_INVOICE`

---

## 6. Segurança

### Autenticação
- Senhas com bcrypt (12 rounds)
- Bloqueio após 5 tentativas falhas (15 min) — usuários tenant e admin
- Timing-safe: sempre executa bcrypt mesmo se usuário não existe (previne enumeração)
- Sessões invalidadas ao trocar senha (`passwordChangedAt` vs `iat` do token)

### Autorização
- Middleware Next.js verifica JWT antes de qualquer request a rotas protegidas
- Admin e tenant têm sistemas de sessão completamente separados
- Impersonação com token dedicado (2h), sem elevar privilégios do tenant

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

Tenant ─┬─── User ──── Role
        ├─── TenantSubscription ──── Plan
        ├─── Invoice ──────────────── Plan
        ├─── Ingredient ─┬─── Category
        │                ├─── Supplier
        │                └─── IngredientMovement
        ├─── Product ────┬─── Category
        │                └─── ProductIngredient ──── Ingredient
        ├─── Inventario ─── InventarioItem ──── Ingredient
        ├─── PlanHistory
        ├─── CancellationRequest
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
| GET/POST | `/api/products` | Listar / criar produtos |
| GET/PATCH/DELETE | `/api/products/[id]` | Detalhe / editar / excluir produto |
| POST/DELETE | `/api/products/[id]/ingredients` | Vincular / desvincular insumo |
| GET/POST | `/api/categories` | Listar / criar categorias |
| GET/POST | `/api/suppliers` | Listar / criar fornecedores |
| GET/POST | `/api/inventarios` | Listar / iniciar inventário |
| GET/PATCH | `/api/inventarios/[id]` | Detalhe / atualizar contagem |
| POST | `/api/inventarios/[id]/finalizar` | Finalizar inventário |
| GET/PATCH | `/api/perfil` | Perfil do usuário |
| PUT | `/api/perfil` | Trocar senha |
| GET | `/api/perfil/permissions` | Permissões do usuário |
| GET/POST | `/api/usuarios` | Listar / convidar usuários |
| GET/PATCH/DELETE | `/api/usuarios/[id]` | Detalhe / editar / remover usuário |
| PUT | `/api/usuarios/[id]/pin` | Definir PIN |
| GET/POST | `/api/roles` | Listar / criar cargos |
| GET/PATCH/DELETE | `/api/roles/[id]` | Detalhe / editar / remover cargo |
| GET/POST | `/api/assinatura` | Consultar / criar assinatura |
| POST | `/api/assinatura/cancelar` | Solicitar cancelamento |
| POST | `/api/convite/[token]` | Aceitar convite |
| POST | `/api/recuperar-senha` | Solicitar reset de senha |
| POST | `/api/recuperar-senha/[token]` | Confirmar reset |
| GET | `/api/estoque/dashboard` | Estatísticas do estoque |

### Endpoints do Admin

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/admin/auth/login` | Login admin |
| POST | `/api/admin/auth/logout` | Logout admin |
| POST | `/api/admin/auth/setup-2fa` | Ativar 2FA |
| POST/GET | `/api/admin/auth/recuperar-senha` | Reset senha admin |
| GET | `/api/admin/dashboard` | Métricas gerais |
| GET | `/api/admin/tenants` | Listar restaurantes (com filtros) |
| GET/PUT/DELETE | `/api/admin/tenants/[id]` | Detalhe / editar / excluir tenant |
| POST | `/api/admin/tenants/[id]/suspend` | Suspender / reativar |
| POST | `/api/admin/tenants/[id]/impersonate` | Impersonar |
| POST | `/api/admin/tenants/[id]/stop-impersonation` | Parar impersonação |
| POST | `/api/admin/tenants/[id]/reset-password` | Resetar senha do admin do tenant |
| GET/POST | `/api/admin/plans` | Listar / criar planos |
| GET/PUT/DELETE | `/api/admin/plans/[id]` | Detalhe / editar / excluir plano |
| GET | `/api/admin/invoices` | Listar faturas |
| GET | `/api/admin/logs` | Log de auditoria |
| GET | `/api/admin/notifications` | Alertas de inadimplência |

---

## 9. Templates de Email

Implementados com React Email + Resend:

| Template | Gatilho |
|----------|---------|
| `welcome-invite.tsx` | Convite para novo usuário |
| `password-reset.tsx` | Solicitação de reset de senha (tenant) |
| `admin-password-reset.tsx` | Reset de senha do super admin |
| `password-changed.tsx` | Confirmação de senha alterada |
| `account-locked.tsx` | Conta bloqueada por tentativas |
| `base-layout.tsx` | Layout base compartilhado |

---

## 10. Testes Automatizados

Localização: `src/lib/__tests__/`

| Arquivo de Teste | O que testa |
|-----------------|-------------|
| `admin-jwt.test.ts` | Geração e verificação de tokens admin |
| `cost-calculation.test.ts` | Cálculo de CMP e custo de produtos |
| `plan-features.test.ts` | Parsing e verificação de features do plano |
| `plan-selfservice.test.ts` | Lógica de auto-serviço de planos |
| `rate-limit.test.ts` | Janela deslizante do rate limiter |
| `stock-enhanced.test.ts` | Movimentações e status de estoque |
| `totp.test.ts` | Geração e verificação de tokens TOTP |
| `utils.test.ts` | Formatação de moeda, datas, slugify |
| `validations.test.ts` | Schemas Zod (registro, ingredientes, produtos) |

Comando: `npm test` (Vitest)

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
| `RESEND_API_KEY` | Chave da API Resend para emails |
| `EMAIL_FROM` | Remetente dos emails transacionais |
| `PASSWORD_RESET_SECRET` | Secret adicional para tokens de reset |

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
| `npm run seed` | Popular banco com dados iniciais |

---

## 13. Módulos Planejados / Em Desenvolvimento

Com base na estrutura existente e nos planos cadastrados, os seguintes módulos estão previstos:

| Módulo | Status | Indicador |
|--------|--------|-----------|
| Estoque (insumos) | ✅ Implementado | Páginas + API completos |
| Produtos / Fichas técnicas | ✅ Implementado | Páginas + API completos |
| Inventário físico | ✅ Implementado | Páginas + API completos |
| Usuários e cargos | ✅ Implementado | Páginas + API completos |
| Landing page | ✅ Implementado | Página completa com design system |
| Painel Super Admin | ✅ Implementado | Dashboard, tenants, planos, logs |
| KDS (Painel da Cozinha) | 🔄 Parcial | Rota existe, Socket.IO instalado |
| Agente IA (leitura de NF) | 📋 Planejado | Feature flag `aiAgent` no plano |
| PDV / Cardápio digital | 📋 Planejado | Feature prevista no schema |
| Financeiro / DRE | 📋 Planejado | Invoices no schema, sem painel |
| Multi-unidade | 📋 Planejado | Feature flag `multiUnit` no plano |
| Exportação PDF/Excel | 📋 Planejado | Feature flag `exportReports` no plano |

---

## 14. Pontos de Atenção

### Limitações Conhecidas

1. **Rate limiter em memória** — O módulo `rate-limit.ts` usa `Map` em memória. Em ambientes com múltiplas instâncias (load balancer), o limite por IP não é compartilhado. Para produção com escala horizontal, substituir por Redis.

2. **Socket.IO sem cluster** — A instância do Socket.IO não tem adapter configurado. Com múltiplos processos Node, eventos não serão propagados entre instâncias. Requer `socket.io-redis` para escalabilidade.

3. **Seed do admin** — As credenciais iniciais do super admin (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) ficam no `.env`. Após o primeiro login, o 2FA deve ser configurado obrigatoriamente.

4. **Sem CDN para assets** — Imagens e arquivos são servidos diretamente pelo Next.js. Em produção, considerar Cloudflare ou S3 + CloudFront.

### Segurança em Produção

- Garantir `NEXTAUTH_SECRET` e `ADMIN_JWT_SECRET` com entropia mínima de 256 bits
- Habilitar `secure: true` nos cookies (automático quando `NODE_ENV=production`)
- Revisar CSP para remover `unsafe-eval` e `unsafe-inline`
- Configurar backup automatizado do banco PostgreSQL
- Habilitar SSL/TLS no `DATABASE_URL`

---

*Gerado automaticamente — THE FINANCE v0.1.0*
