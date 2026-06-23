# Spec: LGPD — Transparência & Consentimento (Sub-projeto G2a)

**Data:** 2026-06-22
**Status:** Aprovado (via brainstorming)

---

## Contexto

O "sub-projeto G" foi dividido em **G1 (segurança, ✅ feito)** e **G2 (LGPD)**. O G2, por ser grande, foi decomposto em fatias: **G2a (transparência & consentimento)**, **G2b (direitos da própria conta)**, **G2c (ferramentas de operador + retenção + log de acesso)**. Esta spec cobre **só o G2a**.

Distinção de papéis (LGPD): a **plataforma é controladora** dos dados dos próprios usuários (donos/staff: `User.email/phone`, `Tenant`) e **operadora** dos dados dos clientes finais do restaurante (`Reserva`, `Pedido.enderecoEntrega`, `WhatsAppContato`). O G2a trata da relação **controladora ↔ usuários da conta**.

Estado atual: **não existe** nada de LGPD (sem política, termos, consentimento, DPO, cookie notice). Sem analytics/tracking de terceiros; os únicos cookies são **essenciais** (NextAuth, admin-auth, impersonation, active-brand-unit) — pela ANPD não exigem consentimento prévio, só aviso informativo.

## Decisões (confirmadas)

- **Conteúdo legal:** texto-modelo LGPD completo, com banner "minuta — revisar com jurídico antes de produção". Eu escrevo; o usuário ajusta depois com advogado.
- **Registro de consentimento:** modelo dedicado `ConsentRecord` (versionável, auditável).
- **Re-consentimento:** sim — no login, se a versão aceita for menor que a atual, exigir novo aceite.
- **Cookie notice:** banner informativo dispensável (não há cookies não-essenciais; sem gerenciador de opt-in).
- **DPO:** constante a nível de plataforma.

## Componentes

### 1. Páginas legais
- Rotas públicas `/privacidade` e `/termos` (server components, conteúdo estático + banner de minuta).
- Conteúdo (texto-modelo): dados coletados, finalidades, **bases legais**, direitos do titular, **retenção**, **compartilhamento com operadores** (Focus NFe, iFood, Mercado Pago, WhatsApp/Evolution, Cloudinary), seção **cookies** (lista os essenciais), **contato do Encarregado (DPO)**.
- Versões via constantes em `src/lib/legal.ts`: `POLITICA_VERSAO`, `TERMOS_VERSAO` (formato data `'2026-06-22'`), `DPO_CONTATO`.
- Links no **rodapé** (público + dashboard) e na tela de cadastro.

### 2. Modelo `ConsentRecord` (Prisma + migração)
```
model ConsentRecord {
  id        String   @id @default(cuid())
  userId    String
  tenantId  String?
  documento ConsentDoc   // POLITICA | TERMOS
  versao    String
  aceitoEm  DateTime @default(now())
  ip        String?
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@index([userId, documento])
}
enum ConsentDoc { POLITICA TERMOS }
```
Relação inversa em `User`. Migração **aditiva** (escrita à mão + `migrate deploy` se `migrate dev` não rodar em TTY — padrão do projeto; `ADD VALUE` de enum fora de transação se necessário, mas aqui é enum novo).

### 3. Consentimento no cadastro
- Checkbox **obrigatório** "Li e aceito a Política de Privacidade e os Termos" no formulário de registro (client) — bloqueia submit sem marcar.
- `registerSchema` (em `src/lib/validations.ts`) ganha `aceiteLgpd: z.literal(true)` (ou boolean validado true) → 400 se ausente/falso.
- Em `register/route.ts`, ao criar `Tenant`+`User`, gravar dois `ConsentRecord` (POLITICA e TERMOS) com versão atual + `ip` via `getClientIp`, na mesma transação da criação.
- Mesmo mecanismo no **aceite de convite** de staff (rota/fluxo `convite/[token]`), pois o convidado também é titular.

### 4. Re-consentimento por versão
- Helper puro `precisaReconsentir(aceitas: {documento,versao}[], atuais: {documento,versao}[]): boolean` em `src/lib/legal.ts`.
- No login/entrada do dashboard: se `precisaReconsentir` para o usuário, redirecionar para `/consentimento` (página que lista o que mudou e exige novo aceite → grava novos `ConsentRecord`). Implementar a checagem no ponto de entrada do dashboard (middleware ou layout do dashboard), reusando a sessão; não quebrar o fluxo de login existente.

### 5. Cookie notice
- Componente client dispensável (banner inferior) "Usamos apenas cookies essenciais…" + link `/privacidade`. Dispensa em `localStorage` (`tf-cookie-notice`), sem novo cookie. Montado no layout público + dashboard.

## Testes
- `precisaReconsentir`: versão aceita < atual → true; igual/maior → false; documento faltando → true.
- `registerSchema` rejeita sem `aceiteLgpd`.
- `register/route.ts`: cria 2 `ConsentRecord` (POLITICA+TERMOS) com versão+ip (mock prisma).
- Aceite de convite grava consentimento.
- Regressão: suíte verde; tsc/lint limpos. Migração aplica limpa.

## Arquivos afetados (previsto)
| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` | + `ConsentRecord`, enum `ConsentDoc`, relação em `User` |
| `prisma/migrations/**` | migração aditiva |
| `src/lib/legal.ts` | versões, DPO, `precisaReconsentir`, textos/metadados |
| `src/app/privacidade/page.tsx`, `src/app/termos/page.tsx` | páginas |
| `src/app/consentimento/page.tsx` | re-aceite |
| `src/components/legal/cookie-notice.tsx` | banner |
| `src/lib/validations.ts` | `aceiteLgpd` no `registerSchema` |
| formulário de cadastro (client) | checkbox |
| `src/app/api/auth/register/route.ts` | gravar consentimento |
| fluxo de convite | checkbox + gravar consentimento |
| layouts (público/dashboard) + rodapé | links + cookie notice + checagem de re-consentimento |
| testes | conforme acima |

## Critérios de aceite
- [ ] `/privacidade` e `/termos` publicadas, com banner de minuta e conteúdo-modelo LGPD + DPO + cookies.
- [ ] Cadastro exige aceite; grava `ConsentRecord` (POLITICA+TERMOS, versão, ip). Convite idem.
- [ ] Re-consentimento exigido quando a versão muda (`precisaReconsentir` testado + redirecionamento).
- [ ] Cookie notice informativo dispensável.
- [ ] Links no rodapé/cadastro. Migração limpa; suíte verde; tsc/lint limpos.

## Fora de escopo
G2b (exportação/exclusão da própria conta), G2c (ferramentas de cliente final, retenção/expurgo automático, log de acesso a PII), gerenciador de opt-in de cookies. Texto jurídico definitivo (a minuta exige revisão de advogado).
