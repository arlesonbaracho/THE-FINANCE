# Spec: LGPD — Retenção/expurgo automático (Sub-projeto G2c-1)

**Data:** 2026-06-22
**Status:** Aprovado (via brainstorming)

---

## Contexto

Última frente do G2 (LGPD) decomposta em três: **G2c-1 retenção/expurgo**, **G2c-2 ferramentas do operador** (dados do cliente final), **G2c-3 log de acesso a PII**. Esta spec cobre **só o G2c-1** (recomendado primeiro: concreto, limitado, usa a infra de jobs existente, entrega o princípio de **minimização/retenção** da LGPD).

A política de privacidade (escrita no G2a) já declara retenção de **12 meses** para logs. O job dá efeito a isso.

## Decisões (confirmadas)

- **Abrangência:** transitórios expirados + logs por janela. NÃO inclui `Reserva` (PII de cliente, valor operacional → G2c-2).
- **Janela de logs:** 12 meses, configurável por env. Transitórios: expurgar quando `expiresAt < now`.
- **Escopo:** platform-wide (manutenção, não disparado por tenant). Sem config por tenant; sem botão manual (automático basta).

## Componentes

### 1. Serviço `src/services/lgpd/expurgo.service.ts`
`expurgarDadosAntigos({ retencaoLogsMeses }: { retencaoLogsMeses: number }): Promise<ResultadoExpurgo>`:
- `corte = new Date(now - retencaoLogsMeses meses)` (subtrair meses de forma correta — usar `setMonth`).
- `deleteMany`:
  - `emailVerificationCode` where `{ expiresAt: { lt: now } }`.
  - `passwordResetToken` where `{ expiresAt: { lt: now } }`.
  - `userAccessLog` where `{ createdAt: { lt: corte } }`.
  - `whatsAppLog` where `{ createdAt: { lt: corte } }`.
- Retorna `{ codigosVerificacao, tokensReset, logsAcesso, logsWhatsapp }` (cada = `.count` do respectivo `deleteMany`).
- `ResultadoExpurgo` type exportado.

### 2. Job BullMQ
- `src/jobs/lgpd/expurgo.job.ts`: `processExpurgoJob()` lê `RETENCAO_LOGS_MESES` (default 12), chama o serviço, loga as contagens; `criarExpurgoWorker()` (seguir a forma de `criarNfCaptureWorker` em `src/jobs/fiscal/`). `src/jobs/lgpd/index.ts` reexporta.
- Fila `expurgoQueue` em `src/lib/queues.ts` (seguir o padrão das filas existentes ali — ex.: `nfCaptureQueue`).
- Registro em `src/jobs/worker.ts`: import da fila + `criarExpurgoWorker()` + `await expurgoQueue.upsertJobScheduler('expurgo', { every: EXPURGO_INTERVAL_HOURS * 3600_000 }, { name: 'expurgo' })` (espelhar a chamada existente de `nfCaptureQueue.upsertJobScheduler`). `EXPURGO_INTERVAL_HOURS` default 24.

### 3. Configuração (env)
- `RETENCAO_LOGS_MESES` (default 12).
- `EXPURGO_INTERVAL_HOURS` (default 24).
(Documentar em `.env.example` se existir.)

### 4. Testes (vitest)
- `expurgo.service.test.ts` com `vi.mock('@/lib/prisma')` mockando os 4 `deleteMany` (retornando `{ count: N }`):
  - confere os `where` de cada um (transitórios `expiresAt < now`; logs `createdAt < corte`).
  - confere o corte (12 meses atrás aprox., comparando o mês).
  - confere o retorno com as 4 contagens.
- Regressão: suíte completa verde; tsc/lint limpos.

## Arquivos afetados (previsto)
| Arquivo | Mudança |
|---|---|
| `src/services/lgpd/expurgo.service.ts` (+ teste) | serviço de expurgo |
| `src/jobs/lgpd/expurgo.job.ts` + `index.ts` | job + worker |
| `src/lib/queues.ts` | `expurgoQueue` |
| `src/jobs/worker.ts` | registro do scheduler |
| `.env.example` (se existir) | novas envs |

## Critérios de aceite
- [ ] `expurgarDadosAntigos` apaga transitórios expirados + logs além de 12 meses, retorna contagens.
- [ ] Job registrado e agendado (default 24h) seguindo o padrão existente.
- [ ] Janela e intervalo configuráveis por env.
- [ ] Testes verdes; tsc/lint limpos.

## Fora de escopo
G2c-2 (ferramentas do operador sobre dados do cliente final) e G2c-3 (log de acesso a PII). Expurgo de `Reserva`. Config por tenant. Botão de expurgo manual.
