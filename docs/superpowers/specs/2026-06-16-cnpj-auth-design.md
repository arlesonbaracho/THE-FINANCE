# Spec: CNPJ no cadastro + login por CNPJ (Sub-projeto A)

**Data:** 2026-06-16
**Status:** Aprovado
**Roadmap:** Sub-projeto A de 7 (A=CNPJ/auth, B=captura NF, C=emissão NF-e, D=conformidade Receita, E=import cardápio iFood, F=redesign cozinha/caixa/garçom, G=conformidade LGPD).

---

## Contexto

O sistema precisa de CNPJ obrigatório no cadastro (fundação de todo o módulo fiscal — B/C/D) e login que aceite CNPJ além de email. Hoje:
- CNPJ existe só em `Supplier` (não no `Tenant`/`User`).
- Login é por email/senha (`authorize` em `src/lib/auth.ts`) ou PIN.
- Registro em `src/app/api/auth/register/route.ts` (cria `Tenant` + usuário `ADMIN`), validado por `registerSchema` (`src/lib/validations.ts`). Há fluxo de verificação por código (`register/send-code`, `register/verify-code`).

## Decisões tomadas no brainstorming

- **Login:** campo único aceita **email ou CNPJ** + senha. Se CNPJ → resolve para a conta `ADMIN` da empresa.
- **Validação:** dígitos verificadores offline (sempre bloqueia se inválido) + consulta **BrasilAPI** (fallback **ReceitaWS**) para confirmar ativo e pré-preencher razão social/nome fantasia.
- **Tenants antigos:** bloqueio suave com carência de 14 dias (banner persistente + modal 1x/sessão); após 14 dias o modal vira bloqueante até preencher.
- **Unicidade:** um CNPJ por empresa (`@unique` no nível do banco).
- **Modelo de dados:** `cnpj` direto no `Tenant` (login rápido/único); dados fiscais enriquecidos em nova `TenantFiscal` 1:1 (lar da config fiscal de C/D).

---

## Seção 1 — Modelo de dados

### `Tenant` (modificar)
```prisma
cnpj        String?  @unique   // normalizado: 14 dígitos, sem máscara; nullable p/ tenants antigos
fiscal      TenantFiscal?
// índice implícito pelo @unique
```

### `TenantFiscal` (novo, 1:1)
```prisma
model TenantFiscal {
  id                String   @id @default(cuid())
  tenantId          String   @unique
  tenant            Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  razaoSocial       String?
  nomeFantasia      String?
  situacaoCadastral String?   // ex: "ATIVA", "BAIXADA"
  cnpjVerifiedAt    DateTime? // null = dígitos válidos mas lookup não confirmado (API fora do ar)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

CNPJ é **sempre armazenado normalizado** (14 dígitos). Exibição com máscara é responsabilidade da UI.
Migration Prisma nova; coluna `cnpj` nullable (não quebra tenants existentes).

---

## Seção 2 — Serviço de CNPJ (`src/services/fiscal/cnpj.service.ts`)

```typescript
export function normalizeCnpj(raw: string): string      // só dígitos
export function formatCnpj(digits: string): string       // 00.000.000/0000-00
export function isValidCnpj(raw: string): boolean         // 14 dígitos + DV (offline, sempre)

export type CnpjLookup = {
  razaoSocial: string | null
  nomeFantasia: string | null
  situacaoCadastral: string | null
  ativo: boolean
}
export type CnpjLookupResult =
  | { status: 'ok'; data: CnpjLookup }       // encontrado
  | { status: 'inactive'; data: CnpjLookup } // encontrado mas não ATIVA
  | { status: 'not_found' }                  // CNPJ inexistente
  | { status: 'unavailable' }                // API fora do ar → não bloqueia

export async function lookupCnpj(digits: string): Promise<CnpjLookupResult>
```

- `lookupCnpj`: GET `https://brasilapi.com.br/api/cnpj/v1/{digits}` (server-side, sem chave). Em falha de rede/5xx, fallback `https://www.receitaws.com.br/v1/cnpj/{digits}`. Timeout curto (~5s). Se ambos falharem → `unavailable`.
- Regra de bloqueio: `isValidCnpj` falso → **bloqueia sempre**. `not_found`/`inactive` → bloqueia com mensagem específica. `unavailable` → **não bloqueia**; grava `cnpjVerifiedAt = null` (a confirmar depois).
- Chamado apenas no servidor (rota de registro / settings) → **sem mudança de CSP**.

---

## Seção 3 — Cadastro obrigatório

- `registerSchema` (`src/lib/validations.ts`): adicionar `cnpj` (string) com `.refine(isValidCnpj, ...)`.
- `src/app/api/auth/register/route.ts`: após validar o schema, `normalizeCnpj` → checar unicidade (`tenant.findUnique({ where: { cnpj } })`, mensagem genérica se já existe) → `lookupCnpj` → bloquear se `not_found`/`inactive` → criar `Tenant` com `cnpj` e `TenantFiscal` (razão social/nome fantasia/situação + `cnpjVerifiedAt`).
- Páginas `/auth/cadastro` e `/auth/register`: campo CNPJ com máscara, obrigatório; erro inline.

---

## Seção 4 — Login (email ou CNPJ)

`src/lib/auth.ts`, `authorize`:
- O campo de credencial passa a ser tratado como **identificador**. Se `isValidCnpj(identifier)` (ou casa o padrão de CNPJ) → `normalizeCnpj` → `tenant.findUnique({ where: { cnpj } })` → achar usuário `ADMIN` desse tenant → seguir o fluxo de senha existente sobre esse usuário. Senão → caminho de email atual.
- Preservar a proteção timing-safe (dummy bcrypt hash já existente) e o lockout.
- Mensagem de erro **genérica** em qualquer falha (não revelar se o CNPJ existe) → mitiga enumeração.
- PIN e demais fluxos intocados.

---

## Seção 5 — Gate de carência (tenants antigos)

- Sessão/consulta expõe `cnpjPendente` (tenant sem `cnpj`) e os dias desde `createdAt`/marco de carência.
- **0–14 dias:** banner persistente no dashboard + modal 1x por sessão pedindo para completar. Acesso liberado.
- **>14 dias:** modal bloqueante (não dispensável) até preencher.
- Preenchimento em **Configurações › Restaurante**: mesmo serviço (validação + lookup + grava `cnpj` no `Tenant` e cria/atualiza `TenantFiscal`).
- Implementação do gate: checagem no layout do dashboard (client) consumindo dado do tenant; sem hard-block no middleware para não quebrar APIs.

---

## Seção 6 — Segurança, testes e vulnerabilidade

**Testes (Vitest):**
- `cnpj.service`: `isValidCnpj` (válidos conhecidos, inválidos, DV errado, tamanho errado), `normalizeCnpj`/`formatCnpj`, `lookupCnpj` com `fetch` mockado (ok / inactive / not_found / unavailable + fallback).
- `authorize`: resolução por email vs CNPJ (mock prisma), mensagem genérica em falha.
- `registerSchema`: rejeita CNPJ inválido, aceita válido.

**Vulnerabilidades tratadas:**
- *Enumeração de CNPJ* no login → mensagem genérica + reuso do rate-limit existente (`rateLimit`/`getClientIp`).
- *PII da Receita* (razão social) → guardar o mínimo necessário; marcar gancho para o sub-projeto **G/LGPD**.
- *Sanitização* do input CNPJ (só dígitos antes de qualquer query).
- *Unicidade* garantida no nível do banco (`@unique`), não só no app.
- *SSRF*: lookup só monta URL com dígitos validados (sem input livre).

**Verificação final:** `npm test` + `npx tsc --noEmit` + `npx next lint` + `npm audit` nas dependências.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` | `cnpj` no `Tenant` + modelo `TenantFiscal` + migration |
| `src/services/fiscal/cnpj.service.ts` | criar (validação + lookup) |
| `src/services/fiscal/__tests__/cnpj.service.test.ts` | criar |
| `src/lib/validations.ts` | `cnpj` no `registerSchema` |
| `src/app/api/auth/register/route.ts` | validar + lookup + gravar CNPJ/TenantFiscal |
| `src/lib/auth.ts` | `authorize` aceita email ou CNPJ |
| `src/app/auth/cadastro/page.tsx`, `src/app/auth/register/page.tsx` | campo CNPJ com máscara |
| `src/app/(dashboard)/configuracoes/restaurante/page.tsx` | preencher CNPJ pós-cadastro |
| Layout do dashboard | gate de carência (banner/modal) |

---

## Critérios de aceite

- [ ] Cadastro novo exige CNPJ válido; CNPJ inativo/inexistente é bloqueado; API fora do ar não trava (marca não-verificado).
- [ ] Razão social/nome fantasia pré-preenchidos quando a consulta retorna.
- [ ] Login funciona com email **e** com CNPJ (→ conta admin), com mensagem genérica em falha.
- [ ] CNPJ é único entre empresas (garantido no banco).
- [ ] Tenant antigo sem CNPJ vê banner/modal; após 14 dias, modal bloqueante; preenche em Configurações.
- [ ] `npm test`, `tsc --noEmit`, `next lint` e `npm audit` sem regressões/vulnerabilidades novas.

---

## Fora de escopo (próximos sub-projetos)

Captura de NFs da SEFAZ (B), emissão de NF-e/NFC-e (C), SPED/conformidade Receita (D), import de cardápio iFood (E), redesign de telas (F), hardening LGPD (G). O `TenantFiscal` foi desenhado para receber a config fiscal desses sub-projetos.
