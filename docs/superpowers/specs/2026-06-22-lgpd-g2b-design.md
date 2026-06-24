# Spec: LGPD — Direitos do titular da própria conta (Sub-projeto G2b)

**Data:** 2026-06-22
**Status:** Aprovado (via brainstorming)

---

## Contexto

Continuação do G2 (LGPD). O G2a entregou transparência & consentimento. O **G2b** dá ao **titular** (usuário do restaurante — staff/manager/admin) os direitos de **acesso/portabilidade** (exportar os próprios dados) e **eliminação** (excluir a própria conta). A plataforma é **controladora** desses dados. Direito de eliminação tem exceção quando há obrigação legal/fiscal de reter — por isso "excluir" = **anonimizar**, preservando referências operacionais/fiscais (pedidos servidos, sessões de caixa, ordens de compra).

`User` é referenciado por: filhos em cascata (Account, Session, UserAccessLog, ConsentRecord, PasswordResetToken, ChatMessage) e por registros operacionais (`Pedido` garcom, `SessaoCaixa`, `PurchaseOrder` criador, `Brand` admin) que NÃO podem ser perdidos.

## Decisões (confirmadas)

- **Exclusão = anonimização** (não hard-delete): limpa dados pessoais, inativa, mantém id + referências operacionais.
- **Guarda do dono:** o **único ADMIN ativo** do tenant **não** pode se auto-anonimizar (orfanaria a conta com dados fiscais ativos) → 409 com orientação; staff/manager e admin-não-único podem.
- **Exportação:** JSON com **perfil + consentimentos + logs de acesso** do próprio titular (sem `password`/`pin`).
- **Confirmação de exclusão:** digitar `EXCLUIR` (sem exigir re-senha/2FA no G2b).

## Componentes

### 1. Schema — `User.anonimizadoEm DateTime?`
Distingue "anonimizado por direito LGPD" de apenas `INACTIVE`. Migração additiva escrita à mão (`prisma migrate dev` não roda em TTY; usar formato das migrações existentes; `prisma generate` p/ o client + tsc). Timestamp > `20260623140000`.

### 2. Serviço `src/services/lgpd/dados-pessoais.service.ts`
- `exportarDadosUsuario(userId: string): Promise<DadosExportados>` — busca o `User` (select sem `password`/`pin`), `consentRecords`, `accessLogs`; retorna objeto serializável.
- `anonimizarUsuario(userId: string): Promise<void>` — `update` do `User`: `name=null`/placeholder, `email='anonimizado+<id>@removido.local'` (preserva `@unique`), `avatarUrl=null`, `pin=null`, `password=null`, `image=null`, `status='INACTIVE'`, `anonimizadoEm=now`. Mantém `id` e FKs operacionais. (Não toca em Pedido/SessaoCaixa/PurchaseOrder.)
- `podeAnonimizar(userId, tenantId): Promise<boolean>` (helper testável) — `false` se o usuário é `ADMIN` e o nº de ADMINs ativos (`status=ACTIVE`, não anonimizados) do tenant é ≤ 1; senão `true`. (A lógica de contagem é pura sobre os dados; o acesso ao banco fica isolável.)

### 3. Rotas (sessão do próprio usuário; `getSession`)
- `GET /api/conta/exportar` — 401 sem sessão; chama `exportarDadosUsuario(session.user.id)`; responde JSON com `Content-Disposition: attachment; filename="meus-dados.json"`.
- `POST /api/conta/excluir` — 401 sem sessão; se `!podeAnonimizar` → 409 `{ error: 'Você é o único administrador...' }`; senão `anonimizarUsuario` e retorna `{ ok: true }`. O cliente faz `signOut` no sucesso.

### 4. UI — "Privacidade e meus dados" (Configurações)
Card numa página de configurações (seguir navegação existente de `configuracoes`): botão **"Baixar meus dados"** (fetch → blob → download); bloco **"Excluir minha conta"** com aviso de irreversibilidade + input de confirmação (`EXCLUIR`) + botão; no sucesso `signOut({ callbackUrl: '/auth/login' })`; se 409, mostra a mensagem de bloqueio.

### 5. Testes (vitest)
- `exportarDadosUsuario`: retorna perfil+consentimentos+logs; **não** contém `password`/`pin`.
- `anonimizarUsuario`: limpa campos pessoais, seta `status=INACTIVE`+`anonimizadoEm`, preserva `id`; e-mail vira o placeholder único.
- `podeAnonimizar`: único admin → false; admin com 2+ admins ativos → true; staff/manager → true.
- Rota `excluir`: último admin → 409 e `update` NÃO chamado; caso ok → anonimiza.
- Regressão: suíte completa verde; tsc/lint limpos.

## Arquivos afetados (previsto)
| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` + nova migração | `User.anonimizadoEm` |
| `src/services/lgpd/dados-pessoais.service.ts` (+ teste) | export/anonimização/guarda |
| `src/app/api/conta/exportar/route.ts` | download JSON |
| `src/app/api/conta/excluir/route.ts` (+ teste) | anonimização + guarda |
| `src/app/(dashboard)/configuracoes/.../page.tsx` | UI "Privacidade e meus dados" |

## Critérios de aceite
- [ ] Titular baixa seus dados (JSON, sem `password`/`pin`).
- [ ] Titular se anonimiza (campos pessoais limpos, `status`/`anonimizadoEm`, referências preservadas).
- [ ] Único ADMIN é bloqueado (409) com orientação.
- [ ] Sessão encerrada após exclusão.
- [ ] Testes verdes; tsc/lint limpos; migração additiva.

## Fora de escopo
G2c (dados do cliente final, retenção/expurgo, log de acesso a PII). Encerramento de conta do dono / transferência de administração (nota). Re-senha/2FA antes de excluir. Hard-delete.
