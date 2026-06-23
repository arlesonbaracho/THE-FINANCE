# Redesign cozinha + garçom (fiel ao caixa) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (controlador) para implementar tarefa-a-tarefa. Steps usam checkbox (`- [ ]`).

**Goal:** Aplicar a moldura do caixa (topbar logo-chama + aba da função, hero com mascote solto responsivo, rodapé, login card de vidro) e polimento leve em cozinha e garçom, com verde/roxo por função e login laranja.

**Architecture:** Cada `page.tsx` tem sua própria cópia da moldura (não é componente compartilhado). Fonte-da-verdade do padrão = `src/app/[slug]/caixa/page.tsx` (topbar ~l.353, hero ~l.415, rodapé ~l.694, login ~l.731). Adaptar trocando a cor primária (cozinha=`C.green`, garçom=`C.accent`/`accentLight`) e os ícones/labels da função; o login usa as constantes laranja locais idênticas ao caixa.

**Tech Stack:** Next.js 14 client component, React, `temaOperacao`, `AvatarFuncao` (já tem `frame`+`size` string), lucide-react.

## Global Constraints

- **Só camada visual.** NÃO alterar socket/fetch/estado/handlers/`useEffect`/`getSocket`. Verificar por diff.
- Cozinha = verde (`C.green`); garçom = roxo (`C.accent`/`accentLight`); login das duas = laranja (`ORANGE='#e8722e'`, `ORANGE_LIGHT='#f7a368'`, `ORANGE_BG='rgba(232,114,46,0.12)'`).
- Mascote no hero e login: `AvatarFuncao frame={false}` + `clamp()` + posição **absoluta** no hero (padding-right reservado, `pointerEvents:'none'`) — padrão que evita a quebra de layout.
- Não reformular estrutura/fluxo dos corpos (tickets/cardápio).

---

### Task 1: Normalizar paleta do garçom + teste

**Files:**
- Modify: `src/lib/operacao-theme.ts` (objeto `garcom` em `PALETAS`)
- Test: `src/lib/__tests__/operacao-theme.test.ts`

**Interfaces:**
- Produces: paleta `garcom` passa a ter `subtle`, `dim`, `borderLight` (strings hex), além das chaves atuais.

- [ ] **Step 1: Adicionar asserts que falham** em `operacao-theme.test.ts`, dentro do `describe('temaOperacao')`:

```ts
it('garcom tem chaves de moldura (subtle/dim/borderLight)', () => {
  const g = temaOperacao('garcom')
  expect(g.subtle).toBeDefined()
  expect(g.dim).toBeDefined()
  expect(g.borderLight).toBeDefined()
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/__tests__/operacao-theme.test.ts`
Expected: FAIL (subtle/dim/borderLight undefined).

- [ ] **Step 3: Preencher as chaves no objeto `garcom`** de `PALETAS` (manter valores existentes):

```ts
  garcom: {
    pageBg: '#0f0d18', surface: '#131020', surface2: '#0f0c1a', border: '#2a2550', borderLight: '#1c1838',
    txt: '#ede8f8', txt2: '#b8b0d8', muted: '#4a4570', dim: '#3a3560', subtle: '#6a6498',
    accent: '#6d4fc2', accentLight: '#8b6fd4', accentBg: '#1a1530',
    green: '#2a9d6f', amber: '#d97706', purple: '#6d4fc2', red: '#e05252',
  },
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/__tests__/operacao-theme.test.ts`
Expected: PASS (todas).

- [ ] **Step 5: Commit**

```bash
git add src/lib/operacao-theme.ts src/lib/__tests__/operacao-theme.test.ts
git commit -m "feat(operacao): normalizar paleta garcom (subtle/dim/borderLight) p/ moldura"
```

---

### Task 2: Cozinha — moldura + login + polimento

**Files:**
- Modify: `src/app/[slug]/cozinha/page.tsx`
- Reference (read-only): `src/app/[slug]/caixa/page.tsx`

**Interfaces:**
- Consumes: `temaOperacao('cozinha')` (tem `green`, `greenBg`, `subtle`, `dim`, `borderLight`, `muted`), `AvatarFuncao`.

- [ ] **Step 1: Imports e constantes.** No topo do arquivo: garantir lucide imports `Flame, ChevronDown, ChevronRight, ArrowLeft` (além dos já usados `ChefHat, Clock, RefreshCw, Delete`). Adicionar após `const C = temaOperacao('cozinha')`:

```ts
const ORANGE = '#e8722e'
const ORANGE_LIGHT = '#f7a368'
const ORANGE_BG = 'rgba(232,114,46,0.12)'
```

- [ ] **Step 2: Topbar.** No dashboard, substituir a barra superior pela moldura do caixa (copiar do caixa ~l.353–399), trocando: ícone/label da aba para `<ChefHat size={16}/> COZINHA` na cor `C.green` (sublinhado `2px solid ${C.green}`); logo-chama `<Flame size={22} style={{color:'#e8722e'}}/>` + `{(tenant?.name ?? slug).toUpperCase()}`; relógio `timeStr`; "{kitchenUser?.name} ▾" com `<ChevronDown/>`; botão Sair chama o logout existente. ☰ menu abre dropdown (Atualizar pedidos → `loadPedidos`; Sair). NÃO alterar `loadPedidos`/socket.

- [ ] **Step 3: Hero.** Acima da lista/colunas de tickets, inserir o hero do caixa (~l.415): título `Bem-vindo à <span style={{color:C.green}}>Cozinha</span>`, subtítulo "Acompanhe e avance os pedidos em preparo.", e mascote absoluto:

```tsx
<div style={{ position:'absolute', top:-8, right:'clamp(0px,2vw,32px)', pointerEvents:'none', filter:'drop-shadow(0 10px 26px rgba(0,0,0,0.4))' }}>
  <AvatarFuncao funcao="cozinha" size="clamp(130px,17vw,230px)" frame={false} />
</div>
```
Container do hero: `position:'relative'`, `padding:'4px 4px 8px'`, `minHeight:'clamp(120px,15vw,200px)'`; bloco de texto com `paddingRight:'clamp(150px,22vw,300px)'`. (Se já houver hero do F, substituir por este.)

- [ ] **Step 4: Rodapé.** Antes de fechar o container do dashboard, inserir:

```tsx
<div style={{ flexShrink:0, borderTop:`1px solid ${C.border}`, padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, fontSize:11, color:C.muted, flexWrap:'wrap' }}>
  <span>© {new Date().getFullYear()} {tenant?.name ?? slug} • Todos os direitos reservados</span>
  <span>Sistema de Gestão • Versão 1.0.0</span>
</div>
```
Garantir que o container raiz do dashboard seja `display:'flex', flexDirection:'column', minHeight:'100vh'` e a área de tickets `flex:1, overflowY:'auto'`.

- [ ] **Step 5: Login (card de vidro).** Substituir o bloco select/pin pela estrutura do caixa (~l.731–823), adaptando: fundo `radial-gradient(...laranja...)`; mascote `AvatarFuncao funcao="cozinha" size="clamp(220px,34vw,380px)" frame={false}`; título com última palavra do nome em `ORANGE`; subtítulo "Painel da Cozinha"; divisor laranja; "Selecione seu nome para continuar"; linhas de usuário (`users`) com avatar `ORANGE_BG`/`ORANGE_LIGHT`, `<ChevronRight/>`, borda `ORANGE` no selecionado; PIN dots/avatar em `ORANGE`/`ORANGE_LIGHT`. Reusar `selectUser`/`authenticate`/`pressDigit`/`backspace` existentes (não mudar).

- [ ] **Step 6: Polimento do corpo.** Nos cards de ticket, alinhar raios (`borderRadius:12/16`), bordas (`1px solid ${C.border}`) e pills de status (verde) à linguagem do caixa, sem mudar colunas nem os botões de avanço de status.

- [ ] **Step 7: Verificar tsc/lint**

Run: `npx tsc --noEmit` → limpo.
Run: `npx next lint --file "src/app/[slug]/cozinha/page.tsx"` → sem novos erros (aviso `<img>` pré-existente ok).

- [ ] **Step 8: Verificar que a lógica não mudou**

Run: `git diff src/app/[slug]/cozinha/page.tsx` e confirmar que `getSocket`, `useEffect`, `loadPedidos`, handlers de status/reject **não** foram alterados (só JSX/estilos).

- [ ] **Step 9: Commit**

```bash
git add src/app/[slug]/cozinha/page.tsx
git commit -m "feat(cozinha): moldura fiel ao caixa (topbar verde, hero mascote, rodape, login chama)"
```

---

### Task 3: Garçom — moldura + login + polimento

**Files:**
- Modify: `src/app/[slug]/garcom/page.tsx`
- Reference (read-only): `src/app/[slug]/caixa/page.tsx`

**Interfaces:**
- Consumes: `temaOperacao('garcom')` (agora com `subtle`/`dim`/`borderLight` da Task 1; tem `accent`/`accentLight`/`accentBg`), `AvatarFuncao`.

- [ ] **Step 1: Imports e constantes.** Garantir lucide `Flame, ChevronDown, ChevronRight, ArrowLeft, Clock, RefreshCw` (além dos usados). Adicionar após `const C = temaOperacao('garcom')` as mesmas constantes `ORANGE`/`ORANGE_LIGHT`/`ORANGE_BG`.

- [ ] **Step 2: Topbar.** Moldura do caixa adaptada: aba `<UtensilsCrossed size={16}/> GARÇOM` na cor `C.accentLight` (sublinhado `2px solid ${C.accent}`); logo-chama + nome maiúsculo; **seta voltar** (`<ArrowLeft/>`) quando `step` ∈ {`cardapio`,`pedido`} (volta pro passo anterior reusando os setters de step existentes) e ☰ menu (atualizar/sair) quando em `mesas`; relógio; "{garcomUser?.name} ▾"; Sair. NÃO mudar a navegação de `step` (só ligar os botões aos setters já existentes).

- [ ] **Step 3: Hero.** Na view de mesas, hero: `Bem-vindo ao <span style={{color:C.accentLight}}>Garçom</span>`, subtítulo "Selecione uma mesa para abrir ou continuar um pedido.", mascote absoluto `AvatarFuncao funcao="garcom" size="clamp(130px,17vw,230px)" frame={false}` (mesmo container `position:relative`/paddings do Task 2 Step 3).

- [ ] **Step 4: Rodapé.** Mesmo rodapé do Task 2 Step 4 (usando `C.border`/`C.muted` do garçom). Garantir container raiz `flex column min-h-100vh` e área de conteúdo `flex:1, overflowY:auto`.

- [ ] **Step 5: Login (card de vidro).** Igual Task 2 Step 5, com `funcao="garcom"` e subtítulo "Painel do Garçom". Reusar a lista `users`, `selectUser`, `PinKeyboard`/handlers existentes (não mudar a lógica).

- [ ] **Step 6: Polimento do corpo.** Mesas/cardápio/carrinho: alinhar raios, bordas e pills (roxo) à linguagem do caixa; usar `mesaStatusColor` existente (livre verde / ocupada âmbar / outros roxo). Sem mudar o fluxo de 3 passos.

- [ ] **Step 7: Verificar tsc/lint**

Run: `npx tsc --noEmit` → limpo.
Run: `npx next lint --file "src/app/[slug]/garcom/page.tsx"` → sem novos erros.

- [ ] **Step 8: Verificar que a lógica não mudou**

Run: `git diff src/app/[slug]/garcom/page.tsx` e confirmar `getSocket`/`useEffect`/handlers de carrinho/pedido/step **não** alterados (só JSX/estilos).

- [ ] **Step 9: Commit**

```bash
git add src/app/[slug]/garcom/page.tsx
git commit -m "feat(garcom): moldura fiel ao caixa (topbar roxo, hero mascote, rodape, login chama)"
```

---

### Task 4: Verificação final

**Files:** nenhum (só verificação)

- [ ] **Step 1: tsc**

Run: `npx tsc --noEmit`
Expected: limpo (TSC_OK).

- [ ] **Step 2: Suíte completa**

Run: `npx vitest run`
Expected: todos verdes (391 + o assert novo do garçom).

- [ ] **Step 3: Lint**

Run: `npx next lint --file "src/app/[slug]/cozinha/page.tsx" --file "src/app/[slug]/garcom/page.tsx" --file "src/lib/operacao-theme.ts"`
Expected: sem novos erros.

- [ ] **Step 4: Verificação visual (usuário)** — `npm run dev`, abrir `/{slug}/cozinha` e `/{slug}/garcom` (login + dashboard) e comparar a consistência com o caixa. Depois: finishing-a-development-branch.

---

## Self-Review

- **Cobertura da spec:** topbar/hero/rodapé/login/polimento → Tasks 2 e 3; normalização do tema → Task 1; verificação/diff → Tasks 2.8, 3.8, 4. ✔
- **Placeholders:** nenhum "TBD"; os passos de UI referenciam linhas concretas do caixa como template (DRY: não duplico o arquivo inteiro). ✔
- **Consistência de tipos:** `AvatarFuncao frame/size` já existe; tokens referenciados existem após Task 1. ✔
