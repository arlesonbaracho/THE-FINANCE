# Plano: Fechamento fiscal — Pacote do contador (Sub-projeto D)

Spec: `docs/superpowers/specs/2026-06-22-fiscal-fechamento-design.md`
Branch: `feat/fiscal-fechamento`

Contexto técnico verificado:
- Auth: `getSession()` (`src/lib/session.ts`); `session.user.role` ∈ {SUPER_ADMIN, ADMIN, MANAGER, ...}; padrão `isAdmin = role===ADMIN||SUPER_ADMIN` (ver `config-nfce/route.ts`). Para fechamento: permitir MANAGER também.
- `prisma.nfProcessada` campos: `tipo` (`NfTipo?` ENTRADA/SAIDA), `status` (`NfStatus`), `xml`, `chaveAcesso`, `modelo`, `numeroNf`, `fornecedorNome`, `valorTotal` (Decimal?), `dataEmissao`.
- `xlsx@0.18.5` já instalado. `jszip` a instalar.

---

## T1 — Dependência JSZip
- `npm install jszip` (+ `@types/jszip` se necessário; JSZip já traz tipos).
- **Verificação:** `npm ls jszip` resolve; `npx tsc --noEmit` limpo.

## T2 — Serviço `fechamento-fiscal.service.ts`
Arquivo: `src/services/fiscal/fechamento-fiscal.service.ts`.
- `export type ResultadoFechamento = { buffer: Buffer; totalNotas; totalEntradas; totalSaidas; totalCanceladas; ignoradas }`.
- `export async function gerarFechamentoFiscal({ tenantId, inicio, fim }: { tenantId: string; inicio: Date; fim: Date }): Promise<ResultadoFechamento>`:
  1. `findMany({ where: { tenantId, dataEmissao: { gte: inicio, lte: fim }, status: { in: [AUTORIZADA, CAPTURADA, CANCELADA] } }, orderBy: { dataEmissao: 'asc' } })`.
  2. Separar válidas (`xml != null`) das `ignoradas` (sem xml).
  3. XLSX (lib `xlsx`): `aoa_to_sheet` com cabeçalho + linhas + linha de total; `book_append_sheet` "Notas"; `XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })`.
  4. JSZip: pasta por `tipo` (`SAIDA`→`saidas/`, `ENTRADA`/null→`entradas/`); nome `<chaveAcesso ?? id>.xml`; adicionar o `.xlsx` na raiz; `generateAsync({ type: 'nodebuffer' })`.
  5. Contadores + return.
- Helpers puros internos: `formatStatus`, `nomeArquivoXml`, `pastaPorTipo`.
- **Verificação:** compila; coberto por T3.

## T3 — Testes do serviço
Arquivo: `src/services/fiscal/__tests__/fechamento-fiscal.service.test.ts`.
- Mock `@/lib/prisma` (`vi.mock`) retornando linhas fixas (saída autorizada, entrada capturada, cancelada c/ xml, rejeitada sem xml).
- Asserts: ler o ZIP de volta (JSZip.loadAsync) → arquivos esperados em `saidas/`/`entradas/` + `relatorio-*.xlsx`; rejeitada/sem-xml ausente; `ignoradas===1`; contadores corretos; cancelada presente.
- **Verificação:** `npx vitest run src/services/fiscal/__tests__/fechamento-fiscal.service.test.ts` verde.

## T4 — Rota `GET /api/fiscal/fechamento`
Arquivo: `src/app/api/fiscal/fechamento/route.ts`.
- `isManagerOrAdmin(role)` = role ∈ {SUPER_ADMIN, ADMIN, MANAGER}.
- Auth: sem `tenantId` → 401; sem papel → 403.
- Ler `inicio`/`fim` de `searchParams`; validar (presentes, datas válidas, `inicio <= fim`) → 400.
- Guarda de volume: `count` com mesmo `where`; `> 5000` → 422 `{ error }`.
- `count === 0` → 422 `{ error: 'Nenhuma nota no período.' }`.
- Chamar serviço; responder `new NextResponse(buffer, { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': attachment; filename } })`. Nome: `fechamento-fiscal-<YYYY-MM ou YYYYMMDD-YYYYMMDD>.zip`.
- **Verificação:** `npx tsc --noEmit` limpo.

## T5 — UI `/fiscal/fechamento`
Arquivo: `src/app/(dashboard)/fiscal/fechamento/page.tsx` (client component, tema `--tf-*` como as outras telas dashboard).
- Toggle modo: **Mês/ano** (selects) vs **Intervalo** (2 date inputs).
- Traduzir mês/ano → `inicio` (1º dia 00:00) / `fim` (último dia 23:59:59).
- Botão "Gerar fechamento" → `fetch(url)`; se ok → `blob()` → âncora download; se !ok → mostrar `error` do JSON. Estados loading/erro.
- **Verificação:** `npx tsc --noEmit` + `npx next lint` na pasta limpos.

## T6 — Link na navegação fiscal
- Adicionar item "Fechamento fiscal" onde estão os links fiscais (mesma navegação que leva a `/fiscal/notas`).
- **Verificação:** link aparece; navega.

## T7 — Verificação final
- `npx tsc --noEmit` limpo.
- `npx vitest run` → todos verdes (386 + novos).
- `npx next lint` sem novos erros.
- Commit. Depois: finishing-a-development-branch.
