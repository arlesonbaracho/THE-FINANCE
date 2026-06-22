# Spec: Redesign das telas operacionais (caixa/cozinha/garçom) — Sub-projeto F

**Data:** 2026-06-21
**Status:** Aprovado
**Roadmap:** Sub-projeto F. Independente. Ver [[project-fiscal-roadmap]] / [[project-theme-css-vars]].

---

## Contexto

Três telas operacionais de toque, em tempo real (socket), cada uma em arquivo grande com paleta `C` **própria e hardcoded** (dark):
- `src/app/[slug]/caixa/page.tsx` (691 linhas) — dourado/marrom.
- `src/app/[slug]/cozinha/page.tsx` (598 linhas) — verde-escuro (KDS).
- `src/app/[slug]/garcom/page.tsx` (712 linhas) — roxo/índigo.

Em `public/` há os personagens por função: **`Caixa.png`, `Cozinheiro.png`, `Garçom.png`** (e `fundo.png`).

## Decisão do brainstorming

- **Direção:** refinar mantendo a identidade **dark/toque** de cada tela (não migrar para `--tf-*` do dashboard; operação ≠ escritório). Ganho em **usabilidade + consistência interna + branding** (avatares), sem perder leitura "de relance".
- Mockup do caixa aprovado pelo usuário (hero com avatar, faixa de status, cards de mesa densos com tempo/total, estado "PAGAMENTO").
- **Camada visual apenas** — toda a lógica de socket/estado/fetch é preservada.

---

## Seção 1 — Módulo de tema compartilhado

Consolidar as 3 paletas `C` num único módulo `src/lib/operacao-theme.ts`:
- Tokens **base** comuns (escala dark: `pageBg`, `surface`, `surface2`, `border`, `borderLight`, `txt`, `txt2`, `muted`, `dim`, `subtle`) — uma escala neutra dark única.
- **Accent por função:** `caixa` (dourado `#b48a2a`/`#d4a84b`), `cozinha` (verde `#2a9d6f`/`#4bc994`), `garcom` (roxo `#6d4fc2`/`#8b6fd4`).
- Semânticos comuns: `red #e05252`, `green #2a9d6f`, `amber #d97706`.
- Export: `temaOperacao(funcao: 'caixa'|'cozinha'|'garcom')` retorna o objeto `C` (base + accent), mantendo as MESMAS chaves já usadas nas páginas (drop-in: cada página troca seu `const C = {...}` por `const C = temaOperacao('caixa')`). Sem mudança de comportamento.

## Seção 2 — Avatares por função (hero)

Componente `OperacaoHeader` (ou bloco no topo de cada página) com o avatar da função (`/Caixa.png` etc. via `next/image` ou `<img>`), saudação personalizada ("Bem-vindo, {nome}") e subtítulo. Substitui o ícone/círculo genérico atual. Fallback: se a imagem faltar, ícone Lucide da função.

## Seção 3 — Refinos por tela (camada visual)

**Caixa** (conforme mockup aprovado):
- Hero com avatar + faixa de status (chips Ocupadas / Livres / Em aberto, derivados do estado já carregado).
- Grade de mesas **mais densa** (`minmax(~160px)`), cards compactos com: status pill, número grande, **tempo de ocupação** + **total parcial** (já há os pedidos no estado), CTA. Estado visual extra **"PAGAMENTO"** (mesa aguardando conta) com "Finalizar".
- Manter tabs Todas/Ocupadas/Livres e toda a lógica de seleção/pedido.

**Cozinha (KDS):**
- Tickets de pedido mais legíveis "de relance": estado claro (Novo / Em preparo / Pronto / **Atrasado** por tempo), tempo decorrido em destaque, lista de itens com tipografia maior, cor de borda por urgência. Avatar do cozinheiro no header.
- Alvos de toque maiores nos botões de avançar status.

**Garçom:**
- Tomada de pedido com **alvos de toque maiores**, carrinho/itens mais claros (quantidade +/- proeminente), confirmação visível. Avatar do garçom no header.
- Manter o fluxo mesa → itens → enviar.

## Seção 4 — Implementação (uma tela por vez)

Cada tela é uma task independente: trocar o `C` local pelo `temaOperacao(funcao)`, aplicar o header com avatar, e refinar os blocos visuais descritos — **sem tocar** os handlers de socket/estado/fetch. Ordem: caixa → cozinha → garçom (o caixa valida o módulo de tema + header, reusados pelas outras).

## Seção 5 — Testes e verificação

- **Sem testes unitários de layout** (são telas visuais); os testes existentes (382) devem continuar verdes (a lógica não muda).
- Um teste leve para `temaOperacao` (retorna chaves esperadas por função).
- Verificação: `tsc --noEmit` + `next lint` + suíte. Verificação visual manual de cada tela (claro que o usuário confere no `npm run dev`).
- **Sem bloqueio externo** — 100% construível e verificável agora.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/operacao-theme.ts` (+teste) | criar (paleta compartilhada por função) |
| `src/components/operacao/OperacaoHeader.tsx` | criar (avatar + saudação) |
| `src/app/[slug]/caixa/page.tsx` | tema compartilhado + header + cards densos + estado PAGAMENTO |
| `src/app/[slug]/cozinha/page.tsx` | tema + header + tickets/estados/atraso |
| `src/app/[slug]/garcom/page.tsx` | tema + header + toque/carrinho |

---

## Critérios de aceite

- [ ] `temaOperacao('caixa'|'cozinha'|'garcom')` retorna a paleta certa (base + accent), drop-in nas 3 páginas.
- [ ] As 3 telas exibem o avatar da função no header com saudação.
- [ ] Caixa: faixa de status + cards densos com tempo/total + estado PAGAMENTO.
- [ ] Cozinha: tickets legíveis com estados/atraso e toque maior.
- [ ] Garçom: toque maior + carrinho claro.
- [ ] Lógica de socket/estado/fetch intocada; 382 testes continuam verdes.
- [ ] `tsc`/`lint` limpos; sem cor nova fora da paleta compartilhada.

## Fora de escopo
Migração para `--tf-*`; reescrita de fluxo/navegação; mudanças de backend/socket. Apenas a camada visual das 3 telas + módulo de tema + avatares.
