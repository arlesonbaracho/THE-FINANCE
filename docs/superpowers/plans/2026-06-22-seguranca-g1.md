# Dívidas de segurança (G1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`).

**Goal:** Fechar dívidas de segurança concretas: gap cross-tenant no import iFood, auditoria de authz de mutação (documentada), remoção de rota órfã, e correções seguras de dependências.

**Architecture:** Mudanças cirúrgicas, focadas em segurança, sem refactor amplo. Cada fix de código com teste. O codebase usa o padrão **fetch-then-check** (`findFirst({where:{id, tenantId}})` → 404 → muta por id) — a auditoria confirma/documenta isso e corrige exceções.

**Tech Stack:** Next.js 14 route handlers, Prisma, Vitest, `src/lib/rate-limit.ts` (já existente).

## Global Constraints

- Foco em segurança; **sem** refactor não relacionado.
- Cada fix de código com teste quando viável (Vitest, mock de `@/lib/prisma`).
- **Não** rodar `npm audit fix --force`; **não** substituir `xlsx`; **não** baixar credencial/serviço externo.
- Tenant-scoping: toda mutação por `id` deve ter (a) `findFirst({where:{id, tenantId}})` de ownership antes, ou (b) `tenantId` no `where` da mutação, ou (c) `updateMany`/`deleteMany` com `tenantId` no `where`.
- Suíte completa (392+) verde; `tsc`/`lint` limpos ao final.
- Rate limiting de cadastro **já existe** (send-code 3/h por IP; verify-code 10/h por e-mail) — não mexer; apenas registrar no checklist.

---

### Task 1: Fix authz cross-tenant no iFood `casar`

**Files:**
- Modify: `src/services/integrations/ifood/ifood-import.service.ts` (função `confirmarImportacaoCardapio`, branch `else if (d.acao === 'casar' && d.produtoId)`, ~linhas 82-89)
- Test: `src/services/integrations/ifood/__tests__/ifood-import.service.test.ts` (adicionar casos; criar arquivo se não existir — verificar primeiro)

**Interfaces:**
- `confirmarImportacaoCardapio(tenantId: string, decisoes: DecisaoImport[]): Promise<{ criados: number; mapeados: number }>` (assinatura inalterada).

- [ ] **Step 1: Teste que falha.** Em `__tests__/ifood-import.service.test.ts`, com `vi.mock('@/lib/prisma', () => ({ prisma: { product: { findFirst: vi.fn(), create: vi.fn() }, iFoodItemMap: { upsert: vi.fn() }, category: { findUnique: vi.fn(), create: vi.fn() } } }))`:

```ts
it('casar rejeita produtoId que não é do tenant', async () => {
  const mp = prisma as any
  mp.product.findFirst.mockResolvedValue(null) // produto não pertence ao tenant
  await expect(
    confirmarImportacaoCardapio('t1', [{ acao: 'casar', ifoodItemId: 'if1', ifoodItemNome: 'X', preco: 1, produtoId: 'P-de-outro-tenant' }] as any)
  ).rejects.toThrow(/não pertence/i)
  expect(mp.iFoodItemMap.upsert).not.toHaveBeenCalled()
})

it('casar aceita produtoId do próprio tenant', async () => {
  const mp = prisma as any
  mp.product.findFirst.mockResolvedValue({ id: 'P1' })
  mp.iFoodItemMap.upsert.mockResolvedValue({})
  const r = await confirmarImportacaoCardapio('t1', [{ acao: 'casar', ifoodItemId: 'if1', ifoodItemNome: 'X', preco: 1, produtoId: 'P1' }] as any)
  expect(mp.product.findFirst).toHaveBeenCalledWith({ where: { id: 'P1', tenantId: 't1' }, select: { id: true } })
  expect(mp.iFoodItemMap.upsert).toHaveBeenCalled()
  expect(r.mapeados).toBe(1)
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/services/integrations/ifood/__tests__/ifood-import.service.test.ts`
Expected: FAIL (upsert chamado mesmo sem produto do tenant / sem o findFirst).

- [ ] **Step 3: Implementar o guard.** Trocar o branch por:

```ts
    } else if (d.acao === 'casar' && d.produtoId) {
      const produtoDoTenant = await prisma.product.findFirst({
        where: { id: d.produtoId, tenantId },
        select: { id: true },
      })
      if (!produtoDoTenant) {
        throw new Error('Produto selecionado não pertence a este restaurante.')
      }
      await prisma.iFoodItemMap.upsert({
        where: { tenantId_ifoodItemId: { tenantId, ifoodItemId: d.ifoodItemId } },
        create: { tenantId, ifoodItemId: d.ifoodItemId, ifoodItemNome: d.ifoodItemNome, produtoId: d.produtoId },
        update: { produtoId: d.produtoId },
      })
      mapeados++
    }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/services/integrations/ifood/__tests__/ifood-import.service.test.ts`
Expected: PASS (ambos).

- [ ] **Step 5: tsc**

Run: `npx tsc --noEmit`
Expected: limpo.

- [ ] **Step 6: Commit**

```bash
git add src/services/integrations/ifood/ifood-import.service.ts src/services/integrations/ifood/__tests__/ifood-import.service.test.ts
git commit -m "fix(security): validar produtoId do tenant no casar do import iFood"
```

---

### Task 2: Auditoria de authz de mutação + checklist

**Files:**
- Create: `docs/superpowers/notes/2026-06-22-authz-checklist.md`
- Modify: qualquer rota de mutação onde a auditoria encontrar gap REAL (sem fetch-then-check nem `tenantId` no where). Esperado: poucos/nenhum, pois o padrão é disciplinado.

**Interfaces:** nenhuma (auditoria + doc).

- [ ] **Step 1: Levantar candidatos.** Rodar:

```bash
grep -rnE "prisma\.[a-zA-Z]+\.(update|delete|updateMany|deleteMany)\(" src/app/api src/services 2>/dev/null | grep -vi "tenantId"
```
Ignorar rotas `src/app/api/admin/**` (usam sessão **AdminUser**, não tenant — escopo diferente) e mutações por id já obtido de um `findFirst`/`findUnique` tenant-scoped imediatamente acima (padrão fetch-then-check) ou por token secreto (`convite/[token]`).

- [ ] **Step 2: Verificar cada candidato não-admin.** Para cada rota, ler o handler e classificar:
  - **SEGURO** se há `findFirst({ where: { id..., tenantId } })` (ou equivalente) antes da mutação, OU `tenantId` no `where` da mutação, OU `updateMany/deleteMany` com `tenantId` no where.
  - **GAP** caso contrário.
  Já verificados SEGUROS (fetch-then-check): `ambientes/[id]`, `ingredients/[id]`, `integracoes/whatsapp/contatos/[id]`. Verificar os demais: `inventarios/[id]`, `alert-configs/[id]`, `alertas/[id]`, `assinatura/*`, e serviços em `src/services/**` que mutam por id.

- [ ] **Step 3: Corrigir gaps reais (se houver).** Para um gap, aplicar o padrão mínimo: adicionar ownership check antes da mutação:

```ts
const dono = await prisma.<model>.findFirst({ where: { id: params.id, tenantId }, select: { id: true } })
if (!dono) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
```
Cada gap corrigido em código ganha um teste (cross-tenant → 404/erro), seguindo o mock de `@/lib/prisma` do projeto.

- [ ] **Step 4: Escrever o checklist.** Em `docs/superpowers/notes/2026-06-22-authz-checklist.md`: tabela rota → veredito (SEGURO/GAP-corrigido) + nota de que `admin/**` é AdminUser-scoped + nota de que rate limiting de cadastro já existe (send-code 3/h IP, verify-code 10/h e-mail) + qualquer pendência adiada.

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit` (limpo) e, se houve fix com teste, `npx vitest run <arquivo>` (verde).

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/notes/2026-06-22-authz-checklist.md <rotas corrigidas + testes>
git commit -m "docs(security): checklist de authz de mutacao (+ fixes de gaps reais)"
```

---

### Task 3: Remover rota legada órfã do iFood

**Files:**
- Delete: `src/app/api/integracoes/ifood/cardapio/route.ts`

**Interfaces:** nenhuma.

- [ ] **Step 1: Reconfirmar que é órfã.** Rodar:

```bash
grep -rn "api/integracoes/ifood/cardapio'" src/ ; grep -rn "ifood/cardapio\"" src/
```
Esperado: nenhuma referência à rota base sem subpath (a página usa só `/preview` e `/importar`). Se aparecer consumidor da base, **abortar** esta task e anotar no checklist.

- [ ] **Step 2: Remover o arquivo**

```bash
git rm src/app/api/integracoes/ifood/cardapio/route.ts
```

- [ ] **Step 3: Verificar build/tsc**

Run: `npx tsc --noEmit`
Expected: limpo (sem import quebrado).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(security): remover rota legada orfa /api/integracoes/ifood/cardapio (GET)"
```

---

### Task 4: Dependências vulneráveis (correções seguras)

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `docs/superpowers/notes/2026-06-22-deps-seguranca.md`

**Interfaces:** nenhuma.

- [ ] **Step 1: Registrar estado atual.** Rodar `npm audit` e salvar a contagem inicial (hoje: **30 (10 high, 18 moderate, 2 low)**) no topo de `docs/superpowers/notes/2026-06-22-deps-seguranca.md`.

- [ ] **Step 2: Correções seguras.**

```bash
npm audit fix
```
(NUNCA `--force`.) Anotar quais pacotes subiram.

- [ ] **Step 3: Verificar que nada quebrou**

Run: `npx tsc --noEmit` (limpo) e `npx vitest run` (392+ verdes).
Se algo quebrar, reverter o bump específico e anotar como adiado.

- [ ] **Step 4: Documentar o residual.** No mesmo doc: rodar `npm audit` de novo, registrar a contagem final; listar as *high* remanescentes; para `xlsx`, registrar o advisory + mitigação ("uso server-side a partir de dados próprios do tenant, sem input de terceiros; substituição/upgrade adiada — não há fix sem breaking change"). Idem para qualquer transitiva sem fix limpo.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json docs/superpowers/notes/2026-06-22-deps-seguranca.md
git commit -m "chore(security): npm audit fix seguro + nota de deps residuais"
```

---

### Task 5: Verificação final

- [ ] **Step 1:** `npx tsc --noEmit` → limpo.
- [ ] **Step 2:** `npx vitest run` → todos verdes (392 + novos).
- [ ] **Step 3:** `npx next lint` (ou nos arquivos tocados) → sem novos erros.
- [ ] **Step 4:** Depois: finishing-a-development-branch.

---

## Self-Review

- **Cobertura da spec:** item 1 (casar) → Task 1; item 2 (varredura + checklist) → Task 2; item 4 (rota órfã) → Task 3; item 5 (deps) → Task 4. Item 3 (rate limit) **removido do escopo** — já implementado; registrado no checklist (Task 2 Step 4). ✔
- **Placeholders:** Task 2 é investigativa por natureza (auditoria), mas tem metodologia concreta, critério de SEGURO/GAP explícito, padrão de fix com código, e candidatos já triados. Sem "TODO". ✔
- **Consistência:** assinatura de `confirmarImportacaoCardapio` inalterada; padrão de ownership check idêntico ao já usado no codebase. ✔
