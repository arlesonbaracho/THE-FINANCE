# Spec: Redesign cozinha + garçom fiel ao caixa (Sub-projeto F.2)

**Data:** 2026-06-22
**Status:** Aprovado (via brainstorming)

---

## Contexto

O caixa (`src/app/[slug]/caixa/page.tsx`) recebeu acabamento fiel aos comps: topbar com logo-chama + aba da função sublinhada, hero com mascote solto responsivo, rodapé, login com card de vidro (brand laranja/chama). Cozinha e garçom já têm a base do redesign F (mesmo esqueleto: `temaOperacao`, `AvatarFuncao`, login select/pin, hero), mas **sem** esse acabamento. Este sub-projeto aplica a **mesma moldura** nas duas telas, derivada do caixa (não há comps próprios), com polimento leve do corpo — **sem** alterar estrutura/fluxo nem lógica de socket/pedido.

Arquivos: `src/app/[slug]/cozinha/page.tsx`, `src/app/[slug]/garcom/page.tsx`, tema `src/lib/operacao-theme.ts`, avatar `src/components/operacao/avatares.tsx` (já tem `frame` + `size` string).

## Decisões (confirmadas)

- **Origem do design:** derivar do padrão do caixa, adaptado por função (sem comps próprios).
- **Profundidade:** moldura compartilhada + polimento leve do corpo; **não** reformular a estrutura dos corpos.
- **Cores por função:** **cozinha = verde** (`C.green`); **garçom = roxo/índigo** (`C.accent`/`accentLight`). **Login das duas = chama/laranja** como brand comum (igual caixa).
- **Sem** mexer em socket/pedido/estado — só camada visual.

## Alvo (mesma linguagem do caixa)

### 1. Topbar
☰ menu (atualizar / sair) — no garçom, **seta voltar** quando estiver em `cardapio`/`pedido` — + logo-chama 🔥 (laranja) + nome do restaurante em maiúsculas + **aba da função** (ícone + label) sublinhada na cor da função + relógio + "{usuário} ▾" + botão Sair. (Cozinha usa `ChefHat`; garçom usa `UtensilsCrossed`.)

### 2. Hero
"Bem-vindo à **Cozinha**" / "Bem-vindo ao **Garçom**" (palavra na cor da função) + subtítulo curto. **Mascote solto** (`AvatarFuncao frame={false}`) responsivo (`clamp`) **posicionado absoluto** no topo-direita, com `padding-right` reservado no texto e `pointerEvents:'none'` — mesmo padrão que evita a quebra de layout vista no caixa.

### 3. Rodapé
© {ano} {restaurante} • Todos os direitos reservados (esq.) · "Sistema de Gestão • Versão 1.0.0" (dir.).

### 4. Login (card de vidro)
Fundo escuro com **glow de chama** (radial-gradient laranja) + mascote solto grande + card de vidro (blur): nome do restaurante (última palavra em **laranja**) + "Painel da Cozinha" / "Painel do Garçom" + divisor laranja + "Selecione seu nome para continuar" + lista de usuários (avatar inicial laranja + nome + chevron; selecionado com borda laranja). PIN com dots/avatar em laranja. Rodapé curto embaixo.

### 5. Polimento leve do corpo
- **Cozinha:** tickets/colunas por status com raios, bordas e pills consistentes (verde) — sem mudar colunas nem o fluxo de avanço de status.
- **Garçom:** mesas/cardápio/carrinho com o mesmo acabamento (roxo) — sem mudar o fluxo de 3 passos.

## Normalização do tema (`operacao-theme.ts`)
A moldura é escrita em cada `page.tsx` (não é componente compartilhado), então cada página referencia tokens da sua própria paleta. Faltam algumas chaves:
- **garçom:** adicionar `subtle`, `dim`, `borderLight` (usados pela moldura para hierarquia de texto e divisórias).
- **cozinha:** já cobre os tokens que a moldura usa (verde, `subtle`, `dim`, `borderLight`, `muted`); nada a adicionar.

Valores existentes ficam **intactos**. Constantes de brand laranja (`ORANGE`, `ORANGE_LIGHT`, `ORANGE_BG`) são locais de cada página (como no caixa) ou podem ser extraídas — manter local para não acoplar.

## Restrições
- Camada visual apenas; **nenhuma** lógica de socket/fetch/estado/pedido alterada.
- Verificar via diff que handlers/`useEffect`/`getSocket` não mudaram.

## Testes
- Testes existentes (391) seguem verdes.
- `operacao-theme.test.ts` ganha asserts para as chaves novas do garçom (`subtle`/`dim`/`borderLight`).
- Sem teste de UI; verificação visual pelo usuário no `npm run dev` (cozinha e garçom), comparando a consistência com o caixa.

## Arquivos afetados
| Arquivo | Mudança |
|---|---|
| `src/lib/operacao-theme.ts` | + `subtle`/`dim`/`borderLight` no garçom |
| `src/lib/__tests__/operacao-theme.test.ts` | asserts das chaves novas |
| `src/app/[slug]/cozinha/page.tsx` | topbar, hero, rodapé, login card de vidro, polimento |
| `src/app/[slug]/garcom/page.tsx` | topbar, hero, rodapé, login card de vidro, polimento |

## Critérios de aceite
- [ ] Cozinha e garçom com topbar (logo-chama + aba da função), hero (mascote solto responsivo), rodapé e login card de vidro — consistentes com o caixa.
- [ ] Cozinha em verde; garçom em roxo; login das duas em laranja.
- [ ] Corpo polido sem mudança de estrutura/fluxo.
- [ ] Lógica de socket/pedido intacta; 391 testes verdes; tsc/lint limpos.

## Fora de escopo
Reformular a estrutura dos corpos (tickets/cardápio) no estilo "abas + cards grandes" do caixa (era a opção 2). Comps próprios. Mudanças de fluxo.
