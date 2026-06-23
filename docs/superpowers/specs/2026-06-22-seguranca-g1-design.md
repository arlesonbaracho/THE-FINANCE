# Spec: Dívidas de segurança (Sub-projeto G1)

**Data:** 2026-06-22
**Status:** Aprovado (via brainstorming)

---

## Contexto

O "sub-projeto G" do roadmap (`project_fiscal_roadmap.md`) junta duas frentes distintas: **G1 — dívidas de segurança** (código, concreto, testável) e **G2 — conformidade LGPD** (produto/legal, maior). Decisão: **G1 primeiro** (concreto, limitado, reduz risco já, base pro G2). Esta spec cobre **só o G1**.

Dívidas conhecidas (de sub-projetos anteriores) + varredura focada:
- Authz cross-tenant no import de cardápio iFood (`casar` confia no `produtoId` do cliente).
- Enumeração de e-mail no cadastro (`send-code`/`verify-code` retornam 409 "já cadastrado").
- Dependências vulneráveis (`npm audit`: *high*/*moderate*, incl. advisory do Hono e `xlsx`).
- Rota legada órfã do iFood (`/api/integracoes/ifood/cardapio` base).

## Decisões (confirmadas)

- **Amplitude authz:** direcionada — corrigir o gap conhecido + varrer rotas de **mutação** (POST/PUT/DELETE) por filtro `tenantId` ausente, corrigir o que achar, documentar o resto num checklist.
- **Enumeração de e-mail:** **rate limiting** (reusar `src/lib/rate-limit.ts`), não mudar a UX/mensagem.
- **Dependências:** correções seguras (`npm audit fix`) + bump manual das *high* com correção limpa; documentar as que exigiriam breaking change (xlsx) com nota de mitigação. **Não** forçar `--force`.
- Foco em segurança; sem refactor amplo não relacionado; nada de baixar credencial/serviço externo.

## Componentes

### 1. Authz cross-tenant no iFood `casar`
`src/services/integrations/ifood/ifood-import.service.ts` (`confirmarImportacaoCardapio`/`casar`): antes de gravar `IFoodItemMap` com um `produtoId` informado, validar que o produto é do tenant (`prisma.product.findFirst({ where: { id: produtoId, tenantId } })`); se não, rejeitar (erro claro, não 500). Não alterar o fluxo de match por similaridade.
- **Teste:** `produtoId` de outro tenant → rejeitado; do próprio tenant → aceito.

### 2. Varredura direcionada de authz + checklist
Varrer rotas **POST/PUT/DELETE** em `src/app/api/**` e os acessos Prisma por trás (`findFirst`/`findUnique`/`update`/`delete`/`updateMany`/`deleteMany`) procurando operação sobre recurso identificado por id **sem** escopo de `tenantId`. Corrigir gaps reais (teste por gap quando for código). Registrar achados/pendências em `docs/superpowers/notes/2026-06-22-authz-checklist.md`.
- **Teste:** por gap corrigido, um caso cross-tenant rejeitado.

### 3. Rate limiting no cadastro
`src/app/api/auth/register/send-code/route.ts` e `verify-code/route.ts`: aplicar `rateLimit(key, { limit, windowMs })` de `src/lib/rate-limit.ts` com `getClientIp`. Chave combina IP + e-mail. Estourar → 429 + header `Retry-After`. Manter mensagens atuais no caminho normal. Limites sugeridos: send-code ~5/10min por IP+e-mail; verify-code ~10/10min (ajustar no plano).
- **Teste:** N+1 chamadas → 429 com `Retry-After`.

### 4. Rota legada órfã do iFood
Confirmar por busca que `src/app/api/integracoes/ifood/cardapio/route.ts` (base, sem `/preview`|`/importar`) não tem consumidor (UI usa preview/importar). Se órfã, **remover**. Se houver consumidor, manter e anotar no checklist.
- **Verificação:** `grep` por `fetch('/api/integracoes/ifood/cardapio'` sem subpath; build/tsc seguem limpos após remoção.

### 5. Dependências vulneráveis
- `npm audit` (registrar saída antes), `npm audit fix` (sem `--force`).
- Bump manual das *high* com correção limpa disponível (ex.: a dep que traz o Hono vulnerável, se houver versão corrigida sem breaking change).
- `xlsx`: **documentar** em `docs/superpowers/notes/2026-06-22-deps-seguranca.md` (advisory + mitigação: uso server-side a partir de dados próprios do tenant, sem input de terceiros; substituição adiada).
- Registrar `npm audit` depois; comparar contagens.
- **Verificação:** `npx tsc --noEmit` + `npx vitest run` (392) verdes após os bumps.

## Testes e verificação
- Vitest: itens 1, 2 (por gap), 3.
- Regressão: suíte completa verde (392 + novos); tsc/lint limpos.
- `npm audit`: contagem antes/depois nas notas.

## Arquivos afetados (previsto)
| Arquivo | Mudança |
|---|---|
| `src/services/integrations/ifood/ifood-import.service.ts` | validar `produtoId` do tenant |
| rotas de mutação com gap | adicionar escopo `tenantId` |
| `src/app/api/auth/register/send-code/route.ts` | rate limit |
| `src/app/api/auth/register/verify-code/route.ts` | rate limit |
| `src/app/api/integracoes/ifood/cardapio/route.ts` | remover se órfã |
| `package.json` / `package-lock.json` | bumps seguros |
| `docs/superpowers/notes/2026-06-22-authz-checklist.md` | checklist |
| `docs/superpowers/notes/2026-06-22-deps-seguranca.md` | nota de deps |
| `src/**/__tests__/*` | testes dos fixes |

## Critérios de aceite
- [ ] `casar` rejeita `produtoId` de outro tenant (com teste).
- [ ] Gaps de authz de mutação encontrados corrigidos; restante no checklist.
- [ ] Cadastro com rate limit (429 + Retry-After), UX normal preservada (com teste).
- [ ] Rota legada órfã removida (ou justificada no checklist).
- [ ] `audit fix` seguro aplicado + high limpas bumpadas; xlsx documentado; contagem antes/depois.
- [ ] 392+ testes verdes; tsc/lint limpos.

## Fora de escopo
G2 (LGPD: direitos do titular, política/consentimento, retenção, DPO, log de acesso a PII). Refactor de auth. Substituir `xlsx`. Rate limiting Redis-backed (in-memory atual basta; nota pra multi-instância no futuro).
