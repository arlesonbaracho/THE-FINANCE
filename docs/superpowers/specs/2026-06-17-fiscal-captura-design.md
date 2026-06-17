# Spec: Captura fiscal de NF-e (Sub-projeto B)

**Data:** 2026-06-17
**Status:** Aprovado
**Roadmap:** Sub-projeto B (de A–G). Track fiscal compartilha provedor com C (emissão) e D (conformidade). Ver [[project-fiscal-roadmap]].

---

## Contexto

O restaurante compra insumos e recebe NF-e de fornecedores. Hoje a entrada de NF é manual (foto/PDF → IA Gemini → estoque) via `NfProcessada` + `nf-processor.service.ts`. O sub-projeto B adiciona **captura automática** das NF-e que a SEFAZ tem **destinadas ao CNPJ** do tenant (Distribuição de DF-e / manifestação), via uma **API fiscal terceira**, e também prepara o arquivamento das notas **próprias** (saídas) que virão da emissão (C).

Pré-requisitos já no projeto: `TenantFiscal` (sub-projeto A), `cnpj.service`, `src/lib/crypto.ts` (`encrypt`/`decrypt`, AES-256-GCM), worker BullMQ (`src/jobs/worker.ts`) com jobs agendados (padrão em `src/jobs/ifood/ifood-catalog-sync.job.ts`).

## Decisões do brainstorming

- **Escopo:** capturar NF-e de **entrada** da SEFAZ **e** arquivar as **próprias emitidas** (modelo unificado; saídas populam-se com C).
- **Provedor:** **Focus NFe** (sandbox/homologação gratuito), atrás de um **adapter** (`FiscalProvider`) para não acoplar.
- **Destino das capturas:** arquivar/listar todas; **importar para o estoque sob demanda**, com tela de confirmação do de-para (modo configurável, não automático).
- **Certificado A1:** **híbrido** — enviar para a Focus NFe **e** guardar backup cifrado (AES via `crypto.ts`) na `TenantFiscal`. Admin-only, cifrado em repouso, com auditoria. (Ponto crítico de LGPD → sub-projeto G.)
- **Tabela:** **estender `NfProcessada`** (lista única de NFs), não criar tabela nova.

---

## Seção 1 — Modelo de dados (estender `NfProcessada` + `TenantFiscal`)

`enum NfOrigem`: adicionar `SEFAZ` (e `EMISSAO` reservado para C).
`enum NfStatus`: adicionar `CAPTURADA` (capturada da SEFAZ, ainda não importada ao estoque).

`NfProcessada` — novos campos (todos opcionais p/ não quebrar registros de IA existentes):
```prisma
chaveAcesso       String?  @unique   // 44 dígitos — idempotência da captura
xml               String?  @db.Text
modelo            String?            // "NFe" | "NFCe"
tipo              NfTipo?            // ENTRADA | SAIDA
importadoEstoqueEm DateTime?
```
`rawResponseIa Json` → tornar **nullable** (capturas SEFAZ não têm resposta de IA).
Novo `enum NfTipo { ENTRADA SAIDA }`.

`TenantFiscal` — config do certificado/emitente:
```prisma
certificadoCifrado     String?  @db.Text   // .pfx (base64) cifrado via crypto.ts
certificadoSenhaCifrada String? @db.Text   // senha cifrada via crypto.ts
certificadoValidade    DateTime?
certificadoStatus      String?             // "ATIVO" | "EXPIRADO" | "PENDENTE"
focusEmpresaId         String?             // referência do emitente na Focus NFe
ultimaSincronizacaoNf  DateTime?           // marco para captura incremental
```
Migration nova (tudo nullable/aditivo).

---

## Seção 2 — Adapter Focus NFe (`src/services/fiscal/focus-nfe.adapter.ts`)

Interface única:
```typescript
export interface FiscalProvider {
  registrarEmitente(params: { cnpj: string; certificadoBase64: string; senha: string }): Promise<{ focusEmpresaId: string; validade: Date | null }>
  consultarNotasDestinadas(params: { cnpj: string; desde?: Date }): Promise<NotaDestinada[]>
  baixarXml(chaveAcesso: string): Promise<string>
}
export type NotaDestinada = { chaveAcesso: string; numero: string; emitenteNome: string; valorTotal: number; dataEmissao: Date; modelo: string }
```
`FocusNfeAdapter implements FiscalProvider` usando a REST da Focus. Env: `FOCUS_NFE_TOKEN`, `FOCUS_NFE_BASE_URL` (sandbox vs prod). Todas as chamadas server-side. Erros de rede tratados (retornam erro tipado; não derrubam o job).

---

## Seção 3 — Onboarding do certificado (Configurações fiscais, admin-only)

Rota `POST /api/fiscal/certificado` (admin): recebe `.pfx` (base64) + senha →
1. valida e extrai validade;
2. cifra `.pfx` e senha (`crypto.ts`) → grava em `TenantFiscal` (backup);
3. chama `adapter.registrarEmitente` → grava `focusEmpresaId`, `certificadoValidade`, `certificadoStatus`.
Auditoria via `UserAccessLog`/log. UI: aba/seção em Configurações fiscais (admin-only), mostra status/validade; sem exibir o segredo.

---

## Seção 4 — Captura agendada + manual

`src/services/fiscal/nf-capture.service.ts` → `sincronizarNotasDestinadas(tenantId)`:
1. lê `TenantFiscal` (cnpj, `focusEmpresaId`, `ultimaSincronizacaoNf`);
2. `adapter.consultarNotasDestinadas({ cnpj, desde: ultimaSincronizacaoNf })`;
3. para cada `chaveAcesso` **não existente** em `NfProcessada` (idempotência): `baixarXml`, cria `NfProcessada` (`origem=SEFAZ`, `tipo=ENTRADA`, `status=CAPTURADA`, campos do cabeçalho + `xml`);
4. atualiza `ultimaSincronizacaoNf`.

Disparo: job BullMQ no worker existente (padrão **a cada 6h**, configurável por env) + `POST /api/fiscal/sincronizar` (admin) para "Sincronizar agora". Idempotência garantida por `chaveAcesso @unique`.

---

## Seção 5 — Importar para o estoque (sob demanda)

Extrair a lógica de de-para item→insumo (hoje em `enriquecerItens` do `nf-processor`) + aplicação de `IngredientMovement`/custo médio para um módulo compartilhado reutilizável. O fluxo SEFAZ parseia os itens do XML e chama o mesmo de-para. UI: lista fiscal unificada (capturadas SEFAZ + uploads IA) com ação **"Importar para estoque"** → tela de confirmação do de-para → ao confirmar, gera movimentações, atualiza custo médio e marca `importadoEstoqueEm` + `status=CONCLUIDA`.

---

## Seção 6 — Segurança, testes e vulnerabilidade

**Testes (Vitest):**
- Adapter: HTTP mockado para `consultarNotasDestinadas`, `baixarXml`, `registrarEmitente` (sucesso + erro).
- `nf-capture.service`: idempotência (pula `chaveAcesso` existente), criação correta de `NfProcessada`, atualização de `ultimaSincronizacaoNf` (prisma + adapter mockados).
- Certificado: round-trip `encrypt`/`decrypt` do `.pfx`/senha; nunca logar segredo.
- Import: de-para item→insumo (reuso dos testes do `nf-processor`).

**Vulnerabilidades tratadas:**
- Certificado/senha cifrados em repouso (`crypto.ts`); rotas de certificado e sync **admin-only**; segredo nunca em log/resposta.
- `FOCUS_NFE_TOKEN` em env, não no código.
- Captura **idempotente** (`chaveAcesso @unique`) → sem estoque duplicado.
- URLs do adapter montadas só com dados validados (sem SSRF/injeção).
- Nota LGPD: o backup do certificado concentra segredo sensível → revisão no sub-projeto **G** (retenção, acesso, possibilidade de migrar para "só na Focus").

**Verificação:** `npm test` + `tsc --noEmit` + `next lint` + `npm audit`. ⚠️ **Execução end-to-end bloqueada** até haver `FOCUS_NFE_TOKEN` (sandbox) + certificado de teste; tudo o mais é coberto por testes com mocks.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` | campos em `NfProcessada`/`TenantFiscal`, enums `NfTipo`/novos valores + migration |
| `src/services/fiscal/focus-nfe.adapter.ts` (+ tipos) | criar |
| `src/services/fiscal/nf-capture.service.ts` | criar |
| `src/services/fiscal/__tests__/*.test.ts` | criar |
| `src/services/fiscal/nf-import.service.ts` (extração do de-para) | criar/refatorar a partir do `nf-processor` |
| `src/app/api/fiscal/certificado/route.ts` | criar (admin) |
| `src/app/api/fiscal/sincronizar/route.ts` | criar (admin) |
| `src/jobs/fiscal/nf-capture.job.ts` + registro no worker | criar |
| `src/app/(dashboard)/...` lista fiscal + onboarding certificado | criar/editar (tokens `--tf-*`) |

---

## Critérios de aceite

- [ ] `NfProcessada` estendida; migração aditiva não quebra registros existentes.
- [ ] Adapter Focus NFe implementa `FiscalProvider`, com testes mockados.
- [ ] Captura cria `NfProcessada` SEFAZ idempotente (não duplica por `chaveAcesso`).
- [ ] Certificado: upload admin-only, cifrado em repouso, registrado na Focus; segredo nunca exposto.
- [ ] Sync agendado (6h) + manual admin.
- [ ] Import para estoque sob demanda com confirmação do de-para.
- [ ] `npm test`/`tsc`/`lint` verdes; sem vulnerabilidade nova.
- [ ] (Bloqueado) verificação end-to-end no sandbox Focus quando houver token + certificado.

## Fora de escopo
Emissão de NFC-e/NF-e (C), conformidade/SPED (D). O modelo unificado e o adapter já nascem preparados para eles.
