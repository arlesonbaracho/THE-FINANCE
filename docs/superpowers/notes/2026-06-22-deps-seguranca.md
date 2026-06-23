# Dependências vulneráveis — correções seguras

**Data:** 2026-06-22
**Branch:** feat/seguranca-g1
**Executor:** Claude (task-4)

---

## Estado inicial (antes do `npm audit fix`)

```
30 vulnerabilities (2 low, 18 moderate, 10 high)
```

Resumo dos advisories HIGH iniciais:

| Pacote | Severidade | Advisory | Fix disponível |
|---|---|---|---|
| `@babel/core` <=7.29.0 | high | GHSA-4x5r-pxfx-6jf8 — Arbitrary File Read via sourceMappingURL | `npm audit fix` |
| `fast-uri` <=3.1.1 | high | GHSA-q3j6-qgpj-74h6, GHSA-v39h-62p7-jpjc — Path traversal / host confusion | `npm audit fix` |
| `glob` 10.2.0–10.4.5 | high | GHSA-5j98-mcp5-4vw2 — Command injection via CLI | somente `--force` (breaking: eslint-config-next) |
| `hono` <=4.12.24 | high (12 CVEs) | CSS injection, JWT bypass, cache leakage, etc. | `npm audit fix` |
| `next` 9.3.4-canary.0–16.3.0-canary.5 | high (14 CVEs) | DoS, SSR injection, SSRF, XSS, cache poisoning | somente `--force` (breaking: next@16) |
| `nodemailer` <=9.0.0 | high (6 CVEs) | SMTP injection, SSRF, TLS bypass | sem fix disponível |
| `vite` 8.0.0–8.0.15 | high | GHSA-v6wh-96g9-6wx3, GHSA-fx2h-pf6j-xcff — hash disclosure, fs.deny bypass | `npm audit fix` |
| `ws` 8.0.0–8.20.1 | high | GHSA-58qx-3vcg-4xpx, GHSA-96hv-2xvq-fx4p — memória não inicializada, DoS | `npm audit fix` |
| `xlsx` * | high | GHSA-4r6h-8v6p-xvw6, GHSA-5pgg-2g8v-p4x9 — Prototype Pollution, ReDoS | sem fix sem breaking change |

---

## Correção aplicada

```bash
npm audit fix
```

Resultado: **removed 2 packages, changed 40 packages** (apenas transitive — `package.json` não mudou).
Apenas `package-lock.json` foi alterado.

### Pacotes transitive atualizados (amostra pelo diff do lock):

- `@babel/core` — bump seguro para versão >=7.29.1
- `fast-uri` — bump para >=3.1.2
- `hono` — bump para >=4.12.25
- `vite` — bump para >=8.0.16
- `ws` — bump para >=8.21.0
- `ip-address` / `express-rate-limit` — bump seguro
- `brace-expansion` — bump seguro
- `js-yaml` — bump seguro
- `qs` — bump seguro
- `fast-levenshtein` — bump seguro

---

## Verificação pós-fix

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | **LIMPO** (sem erros) |
| `npx vitest run` | **398/398 testes verdes** (39 arquivos) |

---

## Estado final (após `npm audit fix`)

```
15 vulnerabilities (1 low, 8 moderate, 6 high)
```

**Redução: 30 → 15 vulnerabilidades (-15).**

---

## HIGH residuais (sem fix seguro disponível)

### 1. `xlsx` *

- **Advisories:** GHSA-4r6h-8v6p-xvw6 (Prototype Pollution), GHSA-5pgg-2g8v-p4x9 (ReDoS)
- **Status:** Sem fix disponível. O upgrade para ExcelJS ou SheetJS Pro exigiria breaking changes na API.
- **Mitigação aplicável:** uso server-side a partir de dados próprios do tenant, sem input de terceiros; sem fix sem breaking change — adiado.
- **Ação futura:** avaliar migração para `exceljs` em sub-projeto dedicado.

### 2. `nodemailer` <=9.0.0

- **Advisories:** GHSA-c7w3-x93f-qmm8, GHSA-vvjj-xcjg-gr5g, GHSA-268h-hp4c-crq3, GHSA-wqvq-jvpq-h66f, GHSA-r7g4-qg5f-qqm2, GHSA-p6gq-j5cr-w38f
- **Status:** "No fix available" — versão atual 9.x ainda tem CVEs abertos.
- **Mitigação:** `nodemailer` é usado via `next-auth` (transitivo) para fluxo de e-mail interno. Nenhum input externo não-sanitizado chega ao transporte. Monitorar releases do pacote.
- **Ação futura:** quando houver versão corrigida do `nodemailer`, fazer upgrade e re-auditar.

### 3. `glob` 10.2.0–10.4.5 (via `eslint-config-next`)

- **Advisory:** GHSA-5j98-mcp5-4vw2 — Command injection via CLI (`-c/--cmd`)
- **Status:** Fix disponível somente via `--force` (quebraria `eslint-config-next` → `next@16`).
- **Mitigação:** Vulnerabilidade é na CLI do `glob`, não na API usada pelo ESLint. Sem execução de CLI do `glob` em produção ou CI sem args controlados.
- **Ação futura:** aguardar upgrade do `eslint-config-next` para versão compatível com Next.js 14.x ou migrar para Next 15+.

### 4. `next` (múltiplos CVEs)

- **Status:** Fix somente via `--force` (next@16 é breaking change).
- **Versão atual:** 14.2.35 (pinada no projeto).
- **Mitigação:** monitorar patch releases no branch 14.x. A maioria das CVEs envolve Server Components DoS e cache poisoning — mitigáveis com configuração adequada de cache e rate-limiting (já em implementação na rota de segurança).
- **Ação futura:** sub-projeto de upgrade Next.js 15.x planejado.

### 5. `postcss` <8.5.10 (transitivo via `next/node_modules/postcss`)

- **Advisory:** GHSA-qx2v-qp2m-jg93 — XSS via CSS stringify
- **Status:** Fix somente via `--force` (quebraria `next`).
- **Mitigação:** afeta somente build-time (SSR HTML generation), não runtime produção direta.
- **Ação futura:** resolvido automaticamente ao fazer upgrade do Next.js.

---

## MODERATE residuais (principais)

| Pacote | Advisory | Observação |
|---|---|---|
| `@hono/node-server` | GHSA-92pp-h63x-v22m | Fix via `--force` (prisma@6, breaking) — adiado |
| `cookie` via `@auth/core` | GHSA-pxg6-pf52-xh8x | Sem fix; tratamento de cookie interno next-auth |
| `uuid` via `svix`/`resend` | GHSA-w5hq-g745-h8pq | Fix via `--force` (next-auth@1, breaking) — adiado |

---

## Resumo executivo

| | Antes | Depois |
|---|---|---|
| Total | 30 | 15 |
| High | 10 | 6 |
| Moderate | 18 | 8 |
| Low | 2 | 1 |

Os 15 vulnerabilidades restantes **não têm fix semver-safe**: todos exigem `--force` (breaking) ou não têm fix disponível. A redução de 50% das vulnerabilidades foi obtida sem nenhuma quebra de build ou testes.

**Status: DONE_WITH_CONCERNS** — correções seguras aplicadas; residuais documentados; `tsc` limpo; 398 testes verdes.
