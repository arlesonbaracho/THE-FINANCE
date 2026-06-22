# Spec: Caixa — fidelidade aos comps de design (Sub-projeto F.1)

**Data:** 2026-06-21
**Status:** Aprovado (via screenshots do usuário + decisões)

---

## Contexto

O redesign do caixa (sub-projeto F) ficou mais simples que os comps de referência que o usuário forneceu (2 screenshots: dashboard + login). Este sub-projeto deixa a tela do **caixa** (dashboard + login) **fiel aos comps**. Arquivo: `src/app/[slug]/caixa/page.tsx`. Tema em `src/lib/operacao-theme.ts`, avatar em `src/components/operacao/avatares.tsx`.

## Decisões (confirmadas)

- **Cores (igual às imagens):** caixa usa **verde** como cor principal (palavra "Caixa", aba ativa, mesas livres, brand); **dourado/âmbar** apenas para mesa **OCUPADA**; **login** usa **laranja/chama** (brand do logo).
- **Comportamento:** abas **Todas/Ocupadas/Livres filtram** de verdade; **☰** abre navegação; **⋮** no card abre ações da mesa. Funcionais.
- Implementado pelo controlador (único que viu os comps), não por subagente.
- Camada visual + filtro/navegação; **não alterar** a lógica de socket/pedido/pagamento.

## Alvo — Dashboard (imagem 1)

- **Topbar:** ☰ (menu) · logo-chama (laranja) + "CHURRASCARIA GAÚCHA" · divisor · ícone caixa + **"CAIXA" verde com sublinhado** (aba ativa) · à direita: relógio, "{usuário} ▾" (dropdown: trocar usuário/sair), botão "Sair".
- **Hero:** "Bem-vindo ao **Caixa**" (Caixa em verde) + "Selecione uma mesa para iniciar ou continuar um pedido." Mascote `/Caixa.png` grande no topo-direita.
- **Abas de filtro:** container arredondado com borda; "Todas" (ícone grid), "Ocupadas" (ícone pessoas), "Livres" (ícone cadeira); ativa em verde com sublinhado. Filtra a grade.
- **Cards (grandes):** pill de status no topo-esquerda (OCUPADA âmbar / LIVRE verde), **⋮** no topo-direita (menu de ações), ícone grande de mesa (cor do status), "#N" grande, "Mesa N", dica ("Clique para ver o pedido" / "Clique para iniciar um novo pedido"), e botão largo outline: "Continuar pedido →" (âmbar p/ ocupada) / "Iniciar pedido +" (verde p/ livre).
- **Rodapé:** © {ano} {restaurante} • Todos os direitos reservados (esq.) · "Sistema de Gestão • Versão 1.0.0" (dir.).

## Alvo — Login (imagem 2)

- Fundo escuro com textura de chamas (`/fundo.png`) + glow laranja.
- Mascote `/Caixa.png` centralizado, grande.
- Card "vidro": "Churrascaria **Gaúcha**" ("Gaúcha" laranja) + "Painel do Caixa" + divisor laranja.
- Seção: ícone pessoa + "Selecione seu nome para continuar".
- Linhas de usuário: avatar circular (inicial) + nome + "›"; item selecionado com **borda laranja**. (Reusa a lista `users` já carregada.)
- Mesmo rodapé.

## Implementação

- Usar `C = temaOperacao('caixa')`: **`C.green`/`greenLight`** para o primário do dashboard, **`C.amber`** para ocupada. (As chaves já existem; não precisa mudar o tema.) Para o login, usar laranja/chama — adicionar tokens de chama se necessário (ex.: usar um laranja fixo de brand consistente).
- **Filtro:** novo estado `filtroMesa: 'todas'|'ocupadas'|'livres'`; a grade aplica o filtro. Não altera fetch/socket.
- **☰ menu:** abre um menu simples (trocar usuário / sair / atualizar). **⋮ card:** menu com ações da mesa (ver pedido / liberar, conforme handlers já existentes — sem inventar).
- Login: estrutura nova de card + lista; reusa `selectUser`/`users` existentes.
- Mascote/`fundo.png` via `<img>` com eslint-disable (padrão do projeto).

## Testes e verificação

- Sem teste de UI (visual). Testes existentes (386) continuam verdes. `tsc`/`lint` limpos.
- Verificação visual pelo usuário no `npm run dev` (comparar com os 2 comps).
- Sem bloqueio externo.

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/app/[slug]/caixa/page.tsx` | topbar, hero verde, abas de filtro, cards grandes c/ menu, rodapé, login fiel ao comp |
| `src/lib/operacao-theme.ts` | (se preciso) token de chama/laranja para o login |

## Critérios de aceite
- [ ] Dashboard bate com a imagem 1 (topbar, hero verde, abas, cards grandes, rodapé).
- [ ] Login bate com a imagem 2 (fundo chama, mascote, card vidro laranja, lista de usuários).
- [ ] Abas filtram; ☰ e ⋮ funcionam.
- [ ] Lógica de socket/pedido/pagamento intacta; 386 testes verdes; tsc/lint limpos.

## Fora de escopo
Cozinha/garçom (seguem o mesmo padrão depois, se o usuário quiser comps próprios).
