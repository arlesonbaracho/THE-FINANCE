# Spec: LGPD — Log de acesso a PII (Sub-projeto G2c-3)

**Data:** 2026-06-22
**Status:** Aprovado (via brainstorming)

---

## Contexto

Última peça do G2 (LGPD). O G2c-2 deu ao operador ferramentas para consultar/exportar/excluir dados de cliente final. O **G2c-3** registra **quem acessou essa PII, quando e o quê** (accountability), com uma tela read-only, e inclui esse log na retenção do G2c-1.

## Decisões (confirmadas)

- **Escopo:** só as 3 operações do G2c-2 (`/api/clientes/dados`, `/exportar`, `/excluir`).
- **Visualização:** seção "Histórico de acessos (LGPD)" na própria página `configuracoes/dados-clientes` (sem nova entrada na sidebar).
- **Retenção:** `PiiAccessLog` entra no expurgo do G2c-1 (12 meses).
- Instrumentação **não-bloqueante** (falha no log não quebra a operação).

## Componentes

### 1. Schema — `PiiAccessLog` + enum `AcaoPii`
```prisma
enum AcaoPii { CONSULTA EXPORTACAO EXCLUSAO }

model PiiAccessLog {
  id        String   @id @default(cuid())
  tenantId  String
  userId    String
  acao      AcaoPii
  alvo      String
  detalhe   String?
  ip        String?
  createdAt DateTime @default(now())

  @@index([tenantId])
  @@index([tenantId, createdAt])
}
```
Migração additiva à mão (timestamp > `20260624100000`; CreateEnum + CreateTable + 2 CreateIndex). `prisma generate` p/ o client + tsc.

### 2. Serviço `src/services/lgpd/pii-access-log.service.ts`
- `registrarAcessoPii(p: { tenantId: string; userId: string; acao: 'CONSULTA'|'EXPORTACAO'|'EXCLUSAO'; alvo: string; detalhe?: string; ip?: string | null }): Promise<void>` → `prisma.piiAccessLog.create(...)`.
- `listarAcessosPii(tenantId: string, opts?: { limit?: number }): Promise<PiiAccessLogItem[]>` → `findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: limit ?? 100 })`.

### 3. Instrumentação nas rotas do G2c-2 (não-bloqueante)
Em cada rota, após a operação bem-sucedida, registrar o acesso com `getClientIp` (de `@/lib/rate-limit`) e `session.user.id`:
- `GET /api/clientes/dados` → `CONSULTA`, `alvo` = telefone (+nome), `detalhe` = total achado (soma das 3 listas).
- `GET .../exportar` → `EXPORTACAO`, mesmo alvo.
- `POST .../excluir` → `EXCLUSAO`, `detalhe` = contagens apagadas.
- Padrão: `void registrarAcessoPii({...}).catch((e) => console.error('[pii-log]', ...))` — não aguardar/não falhar a resposta.

### 4. Visualização
- Rota `GET /api/clientes/acessos-pii` (mesmo guard admin/MANAGER, tenant-scoped) → `listarAcessosPii(session.user.tenantId)`.
- Na página `configuracoes/dados-clientes/page.tsx`: nova **seção read-only "Histórico de acessos (LGPD)"** que no mount carrega `GET /api/clientes/acessos-pii` e lista: data/hora, autor (userId — exibir o id; nome fica fora de escopo), ação, alvo, IP. Atualiza após uma exclusão.

### 5. Retenção (estende G2c-1)
`src/services/lgpd/expurgo.service.ts`: adicionar `prisma.piiAccessLog.deleteMany({ where: { createdAt: { lt: corte } } })`; estender `ResultadoExpurgo` com `logsPii: number`; atualizar o log do job (`expurgo.job.ts`) e o teste do serviço.

## Testes (vitest)
- `registrarAcessoPii` chama `create` com os campos; `listarAcessosPii` ordena desc + take (mock prisma).
- Rota `excluir` chama `registrarAcessoPii` com `acao: 'EXCLUSAO'` e `userId`/`tenantId` da sessão (mock do serviço de log); a resposta não falha se o log rejeitar.
- `expurgarDadosAntigos` passa a apagar `piiAccessLog` (novo `deleteMany` + contagem no retorno).
- Regressão: suíte verde; tsc/lint limpos.

## Arquivos afetados (previsto)
| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` + migração | `PiiAccessLog` + enum |
| `src/services/lgpd/pii-access-log.service.ts` (+ teste) | registrar/listar |
| `src/app/api/clientes/dados/route.ts` / `exportar` / `excluir` | instrumentação não-bloqueante |
| `src/app/api/clientes/acessos-pii/route.ts` | listagem (admin/MANAGER) |
| `src/app/(dashboard)/configuracoes/dados-clientes/page.tsx` | seção histórico |
| `src/services/lgpd/expurgo.service.ts` + `expurgo.job.ts` (+ testes) | retenção do PiiAccessLog |

## Critérios de aceite
- [ ] Consultar/exportar/excluir dados de cliente grava um `PiiAccessLog` (não-bloqueante).
- [ ] Página mostra o histórico (tenant-scoped, admin/MANAGER).
- [ ] Expurgo apaga `PiiAccessLog` além de 12 meses.
- [ ] Testes verdes; tsc/lint limpos; migração additiva.

## Fora de escopo
Logar G2b/own-account ou telas amplas. Exibir nome do autor (só userId). Alertas/exportação do log. Imutabilidade criptográfica.
