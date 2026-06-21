# Spec: Emissão de NFC-e (Sub-projeto C)

**Data:** 2026-06-21
**Status:** Aprovado
**Roadmap:** Sub-projeto C. Reusa a fundação fiscal do B (Focus NFe adapter, `TenantFiscal`, `NfProcessada`, `crypto.ts`). Ver [[project-fiscal-roadmap]].

---

## Contexto

O restaurante precisa emitir **NFC-e** (modelo 65, nota de consumidor) a cada venda no caixa. Hoje não há emissão; o B trouxe captura de entrada + adapter Focus NFe + modelo `NfProcessada` já preparado para saídas (`origem=EMISSAO`, `tipo=SAIDA`). O `Product` não tem campos fiscais; o `TenantFiscal` tem só os campos de certificado. A finalização do pedido ocorre em `src/app/api/pedidos/[id]/finalizar/route.ts` (cria `Pagamento`, baixa estoque, marca `FINALIZADO`, emite sockets).

## Decisões do brainstorming

- **Modelo:** **NFC-e** primeiro (modelo 65). NF-e (55) fica para depois, reusando a fundação.
- **Dados fiscais:** **padrões no `TenantFiscal`** (regime, NCM/CFOP/CST padrão) + **override opcional por `Product`**, com fallback ao padrão.
- **Gatilho:** **configurável** — padrão **automático na finalização** (não-bloqueante) + botão **emitir/reemitir** sempre disponível. Flag `nfceAutomatica` no tenant.
- **Integração:** Opção 1 (emissão assíncrona logo após finalizar, status rastreado) **+ retry via worker BullMQ** para falhas/rejeições.
- **Provedor:** Focus NFe (estende o adapter do B).
- **Idempotência:** **uma NFC-e por pedido** (`pedidoId @unique` no registro fiscal).

---

## Seção 1 — Modelo de dados

`enum RegimeTributario { SIMPLES_NACIONAL NORMAL }`
`enum NfStatus`: adicionar `AUTORIZADA`, `REJEITADA`, `CANCELADA`.

`TenantFiscal` (estender):
```prisma
  regimeTributario      RegimeTributario?
  inscricaoEstadual     String?
  cscNfce               String?   @db.Text   // CSC cifrado via crypto.ts (segredo)
  cscIdNfce             String?
  serieNfce             Int?      @default(1)
  proximoNumeroNfce     Int?      @default(1)
  nfceAutomatica        Boolean   @default(true)
  ncmPadrao             String?
  cfopPadrao            String?   // ex: "5102"
  cstCsosnPadrao        String?   // CSOSN (Simples) ou CST (normal)
  origemMercadoriaPadrao String?  @default("0")
```

`Product` (estender — todos opcionais, fallback ao padrão do tenant):
```prisma
  ncm               String?
  cfop              String?
  cstCsosn          String?
  origemMercadoria  String?
  unidadeTributavel String?
```

`NfProcessada` (reusar para saídas) — adicionar:
```prisma
  pedidoId            String?   @unique         // idempotência: 1 NFC-e por pedido
  pedido              Pedido?   @relation(fields: [pedidoId], references: [id])
  danfeUrl            String?
  qrCode              String?   @db.Text
  protocoloAutorizacao String?
  motivoRejeicao      String?
  refExterna          String?                   // ref enviada à Focus
```
`Pedido` ganha a relação inversa `nfce NfProcessada?`. Migration aditiva.

---

## Seção 2 — Adapter (estender `src/services/fiscal/focus-nfe.adapter.ts`)

Acrescentar à interface `FiscalProvider` e ao `FocusNfeAdapter`:
```typescript
emitirNfce(ref: string, payload: NfcePayload): Promise<NfceResultado>
consultarNfce(ref: string): Promise<NfceResultado>
cancelarNfce(ref: string, justificativa: string): Promise<NfceResultado>
```
`NfceResultado = { status: 'autorizado'|'processando'|'erro'|'cancelado'; chaveAcesso?, danfeUrl?, xml?, protocolo?, motivo? }`. Endpoints Focus: `POST /v2/nfce?ref=`, `GET /v2/nfce/{ref}`, `DELETE /v2/nfce/{ref}`. Mapeamento isolado no adapter (ajuste contra sandbox na verificação bloqueada).

---

## Seção 3 — Serviço de emissão (`src/services/fiscal/nfce-emissao.service.ts`)

- `montarPayloadNfce(pedido, tenantFiscal, produtosFiscais)` — **função pura testável**: monta o JSON da NFC-e a partir do pedido (cada item → NCM/CFOP/CST por override-ou-padrão; `pagamentos` → formas de pagamento; totais). Resolve o fiscal de cada produto com fallback ao padrão do tenant.
- `emitirNfceParaPedido(pedidoId, provider?)`:
  1. carrega pedido (itens+produtos+pagamentos) + `TenantFiscal`;
  2. **idempotência**: se já existe `NfProcessada` com esse `pedidoId` e status `AUTORIZADA`/`PROCESSANDO`, retorna sem reemitir;
  3. aloca `serieNfce`/`proximoNumeroNfce` (incrementa atômico);
  4. `montarPayloadNfce` → `provider.emitirNfce(ref, payload)`;
  5. cria/atualiza `NfProcessada` (`origem=EMISSAO`, `tipo=SAIDA`, `pedidoId`, status `PROCESSANDO`→`AUTORIZADA`/`REJEITADA`, `chaveAcesso`/`danfeUrl`/`qrCode`/`protocolo`/`motivo`).
  Provider injetado (default `FocusNfeAdapter`) para teste.

---

## Seção 4 — Gatilho + retry

- **Finalização** (`src/app/api/pedidos/[id]/finalizar/route.ts`): após a transação e antes do `return`, se `tenantFiscal.nfceAutomatica`, dispara `void emitirNfceParaPedido(params.id)` **não-bloqueante** (padrão fire-and-forget já usado no auto-sync iFood em `products/[id]`). Falha não derruba a finalização.
- **Manual/reemissão:** `POST /api/fiscal/nfce/emitir` `{ pedidoId }` (admin/MANAGER) — chama o serviço; reemite se a anterior falhou.
- **Cancelamento:** `POST /api/fiscal/nfce/cancelar` `{ pedidoId, justificativa }` (admin) → `adapter.cancelarNfce` → status `CANCELADA`.
- **Retry job:** `src/jobs/fiscal/nfce-retry.job.ts` reprocessa `NfProcessada` com `status=REJEITADA`/`ERRO` e `origem=EMISSAO`, com tentativas limitadas; registrado no worker como repeatable (env `NFCE_RETRY_INTERVAL_MIN`, default 15).

---

## Seção 5 — UI

- **Caixa** (`src/app/[slug]/caixa/page.tsx`): após finalizar, exibir status da NFC-e (Processando/Autorizada/Falha) + link DANFE/QR + botão "Emitir/Reemitir" quando aplicável. Polling curto de status (`GET /api/fiscal/nfce/status/[pedidoId]`).
- **Config fiscal NFC-e** (Configurações, admin-only): regime, IE, CSC/idCSC (input secreto, nunca exibido de volta), série, flag automática, padrões NCM/CFOP/CST. Mesmo padrão `--tf-*` das abas CNPJ/certificado.
- **Produto** (formulário em `estoque/produtos`): campos fiscais de override (NCM/CFOP/CST/origem/unidade), opcionais.

---

## Seção 6 — Segurança, testes e bloqueio

**Testes (Vitest):**
- `montarPayloadNfce` (puro): override-vs-padrão por item, formas de pagamento, totais.
- `emitirNfceParaPedido`: idempotência (não reemite autorizada), alocação de número, mapeamento de status (adapter/prisma mockados).
- Adapter: `emitirNfce`/`consultarNfce`/`cancelarNfce` com HTTP mockado.
- Round-trip da cifra do CSC.

**Vulnerabilidades:**
- CSC cifrado em repouso (`crypto.ts`); config fiscal e rotas de emissão/cancelamento admin/MANAGER-only; CSC nunca em log/resposta.
- Idempotência por `pedidoId @unique` → sem NFC-e duplicada.
- Numeração de NFC-e alocada de forma atômica (evitar número duplicado em concorrência).
- LGPD: nota de consumidor pode conter CPF — anotar para o sub-projeto **G**.

**Verificação:** `npm test` + `tsc` + `lint` + `npm audit`. ⚠️ **Execução end-to-end BLOQUEADA**: precisa de `FOCUS_NFE_TOKEN` + certificado + **CSC** em homologação (junto da pendência do B). Tudo mais coberto por mocks.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `prisma/schema.prisma` | campos em `TenantFiscal`/`Product`/`NfProcessada`, enums + migration |
| `src/services/fiscal/focus-nfe.adapter.ts` (+tipos) | métodos NFC-e |
| `src/services/fiscal/nfce-emissao.service.ts` (+testes) | criar |
| `src/app/api/fiscal/nfce/emitir/route.ts`, `cancelar`, `status/[pedidoId]` | criar |
| `src/app/api/pedidos/[id]/finalizar/route.ts` | gatilho automático não-bloqueante |
| `src/jobs/fiscal/nfce-retry.job.ts` + worker | criar/registrar |
| `src/app/[slug]/caixa/page.tsx` | status/emitir NFC-e |
| config fiscal NFC-e + campos fiscais de produto (UI) | criar/editar (`--tf-*`) |

---

## Critérios de aceite

- [ ] Config fiscal NFC-e (regime, IE, CSC cifrado, série, padrões, flag auto) admin-only.
- [ ] `montarPayloadNfce` resolve fiscal por override-ou-padrão e monta o payload correto.
- [ ] Finalização dispara emissão automática não-bloqueante quando `nfceAutomatica`.
- [ ] Emissão idempotente (uma NFC-e por pedido); numeração atômica.
- [ ] Manual emitir/reemitir/cancelar (admin/MANAGER); status visível no caixa.
- [ ] Retry job reprocessa rejeições.
- [ ] CSC nunca exposto; cifrado em repouso.
- [ ] `npm test`/`tsc`/`lint` verdes; sem vuln nova.
- [ ] (Bloqueado) emissão real em homologação Focus quando houver token+certificado+CSC.

## Fora de escopo
NF-e modelo 55 (B2B), contingência offline, conformidade/SPED (D). A fundação (config fiscal, adapter, dados de produto) já nasce reaproveitável por eles.
