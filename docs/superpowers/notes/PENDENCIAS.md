# ⚠️ AVISO — Pendências em aberto

**Atualizado:** 2026-06-27

Estado geral: o roadmap **A–G está completo** e o upgrade **Next 15 + React 19** foi feito; tudo na `main` e **pushado** (`origin/main` em sincronia). Os itens abaixo **continuam pendentes** — a maioria depende do usuário ou de credenciais/etapas externas, não de código a escrever.

---

## 1. ⛔ Minutas legais (LGPD) — bloqueado no usuário
As páginas `/privacidade` e `/termos` estão como **MINUTA** (com `MinutaBanner` avisando) e **precisam de revisão jurídica** antes de produção. Faltam **dados reais da empresa mantenedora** que não podem ser inventados:
- **Razão social**
- **CNPJ**
- **Comarca (Cidade/UF)** do foro — `src/app/termos/page.tsx` (§8)
- **Nome + e-mail do Encarregado (DPO)** — `src/lib/legal.ts` (`DPO_CONTATO`, hoje genérico)

**Como retomar:** quando houver CNPJ, preencher os 4 campos em `src/app/privacidade/page.tsx` (§1), `src/app/termos/page.tsx` (§1 e §8) e `src/lib/legal.ts`, e remover o banner de minuta após o aval jurídico. O usuário informou que **ainda não tem CNPJ** → item parado até abrir a empresa.

## 2. 🔓 `nodemailer` — 1 vulnerabilidade HIGH residual — bloqueado pelo next-auth@4
O fix existe (**nodemailer@9.0.1**), mas conflita com o peer `nodemailer@^7` do `@auth/core` (transitivo do `next-auth@4.24.14`) → ERESOLVE. **Resolver junto com o upgrade para next-auth v5** (sub-projeto próprio). Mitigação atual: uso interno (e-mails de templates próprios, destinatários controlados; os CVEs são injeção via dados controlados pelo atacante, que não ocorre aqui). Detalhes em `2026-06-22-deps-seguranca.md`.

## 3. 🧪 E2E fiscal (Focus NFe) — bloqueado em credenciais
Captura de NF-e (sub-projeto B) e emissão de NFC-e (C) estão implementadas, mas a **validação ponta-a-ponta** precisa de credenciais de **homologação Focus**: `FOCUS_NFE_TOKEN` (sandbox) + **certificado A1** + **CSC**. Os nomes de rotas/campos da Focus estão isolados no `focus-nfe.adapter.ts` pra ajustar contra a doc/sandbox real.

## 4. 💳 Pagamentos (Stripe/Mercado Pago) — WIP do usuário
Há código **não-rastreado** (`src/app/api/pagamentos/`, `src/services/payments/mercadopago.service.ts`) — WIP do usuário. O Stripe já é **lazy** (`getStripe()`), então `next build` não depende mais de `STRIPE_SECRET_KEY`; mas o fluxo real precisa das envs dos provedores no runtime/CI.

## 5. 🚀 Deploy / ambientes
- **Nada foi configurado de CI/CD** aqui; ao fazer deploy, garantir as envs (DB, NEXTAUTH, ADMIN_JWT, provedores de e-mail/pagamento/Focus).
- **Migrações LGPD** (`ConsentRecord`, `User.anonimizadoEm`, `PiiAccessLog`) aplicadas só no **banco local** — rodar `npx prisma migrate deploy` nos demais ambientes.
- **Smoke test completo:** validei boot + render HTTP das rotas no Next 15; o **click-through real** (login, caixa em tempo real) ainda vale conferir manualmente.

---

## Dívidas técnicas pré-existentes (do relatório, ainda válidas)
- Rate limiter e Socket.IO **em memória/sem cluster** → trocar por Redis/adapter pra escala horizontal.
- CSP ainda com `unsafe-eval`/`unsafe-inline` (revisar pra produção).
- Sem CDN pra assets.

> Pendências também resumidas na **seção 15 do `RELATORIO.md`** (raiz do projeto).
