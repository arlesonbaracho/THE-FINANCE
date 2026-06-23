# Spec: Fechamento fiscal — Pacote do contador (Sub-projeto D)

**Data:** 2026-06-22
**Status:** Aprovado (via brainstorming)

---

## Contexto

`NfProcessada` já guarda **entradas** (capturadas via SEFAZ, sub-projeto B) e **saídas** (NFC-e emitidas, sub-projeto C) com `xml`, `chaveAcesso`, `modelo`, `tipo`, `dataEmissao`, `valorTotal`, `status`. O objetivo do D é entregar ao **contador** um pacote de fechamento mensal — não construir SPED EFD do zero (mesma decisão estratégica da emissão: o SPED é domínio do software do contador, alimentado pelos XMLs).

## Decisões (confirmadas)

- **Caminho:** Pacote do contador (não gerar SPED; não calcular impostos consolidados).
- **Conteúdo:** ZIP com **XMLs + relatório de apoio** (.xlsx). Sem resumo de impostos.
- **Período:** mensal (mês/ano) **e** intervalo de datas livre; filtra por `dataEmissao`.
- **Formato do relatório:** Excel (.xlsx) — lib `xlsx` já existe.
- **Geração/entrega:** **download síncrono** (sem job, sem histórico). XMLs vêm do banco (`NfProcessada.xml`), sem storage externo.
- **Documentos:** **entradas + saídas** no período.
- **Regra de status:** entram no ZIP notas com `xml` e status ∈ {`AUTORIZADA`, `CAPTURADA`, `CANCELADA`}; **canceladas** entram com XML e marcadas no relatório; **rejeitadas/sem XML** ficam fora (contadas como ignoradas).
- **Acesso:** logado + `tenantId`, restrito a **admin/MANAGER** (exportação fiscal sensível).
- Dependência nova: **JSZip** (pure-JS, server-side).

## Arquitetura / fluxo

```
UI /fiscal/fechamento → GET /api/fiscal/fechamento?inicio&fim
   → fechamentoFiscal.gerarFechamentoFiscal({tenantId, inicio, fim})
       → query NfProcessada (dataEmissao no período, xml não-nulo, status regular/cancelada)
       → monta XLSX (relatório) + ZIP (XMLs + relatório)
   → responde ZIP como attachment
```

## Componentes

### Serviço — `src/services/fiscal/fechamento-fiscal.service.ts`
`gerarFechamentoFiscal({ tenantId, inicio, fim })`:
- Busca `NfProcessada` onde `tenantId` + `dataEmissao` ∈ [inicio, fim] + `xml != null` + `status` ∈ {AUTORIZADA, CAPTURADA, CANCELADA}.
- Monta **ZIP** (JSZip): `saidas/<chave>.xml`, `entradas/<chave>.xml`, `relatorio-fechamento-<periodo>.xlsx` na raiz. Fallback de nome de arquivo quando `chaveAcesso` for nulo: `<id>.xml`.
- Retorna `{ buffer: Buffer, totalNotas, totalEntradas, totalSaidas, totalCanceladas, ignoradas }`.
- Tenant-scoped; pura (recebe `inicio/fim` já resolvidos; a UI/rota traduz mês/ano → intervalo).

### Relatório (.xlsx) — 1 aba "Notas"
Colunas: `Modelo` (55/65) · `Tipo` (Entrada/Saída) · `Número` · `Chave de acesso` · `Data emissão` · `Fornecedor/Destinatário` (usa `fornecedorNome`) · `Valor total` · `Status` (Autorizada/Capturada/Cancelada). Linha de **total** de valor ao final. CFOP fora (exigiria parsear XML — YAGNI).

### Rota — `GET /api/fiscal/fechamento`
- Auth: `getSession()` + `tenantId`; exige papel admin/MANAGER.
- Params: `inicio`, `fim` (ISO). Valida presença e ordem.
- **Guarda de volume:** conta antes; acima de **5.000 notas** retorna 422 com mensagem pedindo intervalo menor (porque é síncrono).
- Sucesso: corpo = ZIP, `Content-Type: application/zip`, `Content-Disposition: attachment; filename="fechamento-fiscal-<periodo>.zip"`.

### UI — `src/app/(dashboard)/fiscal/fechamento/page.tsx`
- Seletor de período: **mês/ano** (padrão) com toggle pra **intervalo livre** (duas datas).
- Botão "Gerar fechamento" → dispara o download (fetch → blob → âncora). Estados loading/erro/vazio.
- Link/aba na navegação fiscal.

## Erros
- Período vazio (0 notas) → mensagem "Nenhuma nota no período."
- Volume acima do teto → 422 + mensagem pedindo recorte menor.
- Notas sem XML → puladas, contadas em `ignoradas` (informado ao usuário).
- Params inválidos → 400.

## Testes (vitest)
Unit no serviço com `prisma.nfProcessada.findMany` mockado:
- ZIP contém os XMLs nas pastas certas (`saidas/` vs `entradas/`) + o `.xlsx`.
- XLSX tem as linhas certas e a linha de total.
- Canceladas: incluídas, com XML, marcadas "Cancelada" no relatório.
- Rejeitadas / sem XML: excluídas; contadas em `ignoradas`.
- Contadores (`totalEntradas/totalSaidas/totalCanceladas`) corretos.

## Arquivos afetados
| Arquivo | Mudança |
|---|---|
| `package.json` | + `jszip` |
| `src/services/fiscal/fechamento-fiscal.service.ts` | novo serviço |
| `src/services/fiscal/__tests__/fechamento-fiscal.service.test.ts` | testes |
| `src/app/api/fiscal/fechamento/route.ts` | nova rota de download |
| `src/app/(dashboard)/fiscal/fechamento/page.tsx` | nova página |
| navegação fiscal | link pra nova página |

## Critérios de aceite
- [ ] Gera ZIP com XMLs (entradas+saídas) + relatório .xlsx do período.
- [ ] Mensal e intervalo livre funcionam; filtra por `dataEmissao`.
- [ ] Canceladas marcadas; rejeitadas/sem-XML fora; contadores corretos.
- [ ] Guarda de volume e mensagens de erro/vazio.
- [ ] Tenant-scoped + admin/MANAGER. Testes verdes; tsc/lint limpos.

## Fora de escopo
SPED EFD, cálculo consolidado de impostos, envio por e-mail, histórico de fechamentos, job em background, CFOP no relatório.
