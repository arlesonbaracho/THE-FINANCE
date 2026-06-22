# Redesign das telas operacionais (Sub-projeto F) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refinar as 3 telas operacionais (caixa/cozinha/garçom) mantendo a identidade dark/toque de cada uma: tema centralizado, avatar da função no header, cards/tickets mais densos e legíveis, estados em tempo real mais claros — sem tocar a lógica de socket/estado.

**Architecture:** Um módulo `operacao-theme.ts` centraliza as 3 paletas (valores preservados) e expõe `temaOperacao(funcao)` + `funcaoMeta`. Um `OperacaoHeader` com avatar. Cada página troca seu `const C` pelo tema central, ganha o header e refinos visuais — preservando 100% dos handlers.

**Tech Stack:** Next.js 14, React, TypeScript, Vitest 4. Imagens em `public/` (Caixa.png, Cozinheiro.png, Garçom.png).

## Global Constraints

- **NÃO alterar** nenhuma lógica de socket/estado/fetch/handlers nas páginas — apenas a camada visual (JSX/estilos) e a troca do `const C`.
- Cores apenas do `temaOperacao` (sem inventar hex fora da paleta central).
- Sem novas dependências.
- Cada página é grande (600–712 linhas) e SEM teste de UI — preservar comportamento é prioridade; verificação visual manual por tela.
- Sem bloqueio externo — tudo construível/verificável agora.

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `src/lib/operacao-theme.ts` (+teste) | criar (paletas centralizadas + meta) |
| `src/components/operacao/OperacaoHeader.tsx` (+teste) | criar |
| `src/app/[slug]/caixa/page.tsx` | tema central + header + cards densos + estado PAGAMENTO |
| `src/app/[slug]/cozinha/page.tsx` | tema + header + tickets/estados |
| `src/app/[slug]/garcom/page.tsx` | tema + header + toque/carrinho |

---

## Task 1: Módulo de tema centralizado (TDD)

**Files:** Create `src/lib/operacao-theme.ts`, `src/lib/__tests__/operacao-theme.test.ts`

**Interfaces:**
- Produces: `type FuncaoOperacao = 'caixa' | 'cozinha' | 'garcom'`; `temaOperacao(funcao: FuncaoOperacao): Record<string, string>`; `funcaoMeta(funcao): { label: string; avatar: string }`.

- [ ] **Step 1: Teste** (`src/lib/__tests__/operacao-theme.test.ts`)
```typescript
import { describe, it, expect } from 'vitest'
import { temaOperacao, funcaoMeta } from '../operacao-theme'

describe('temaOperacao', () => {
  it('caixa = paleta dourada', () => {
    expect(temaOperacao('caixa').accent).toBe('#b48a2a')
    expect(temaOperacao('caixa').pageBg).toBe('#131009')
  })
  it('cozinha = paleta verde', () => {
    expect(temaOperacao('cozinha').green).toBe('#2a9d6f')
    expect(temaOperacao('cozinha').pageBg).toBe('#0f1714')
  })
  it('garcom = paleta roxa', () => {
    expect(temaOperacao('garcom').accent).toBe('#6d4fc2')
    expect(temaOperacao('garcom').pageBg).toBe('#0f0d18')
  })
})

describe('funcaoMeta', () => {
  it('retorna avatar e label por função', () => {
    expect(funcaoMeta('caixa').avatar).toBe('/Caixa.png')
    expect(funcaoMeta('cozinha').avatar).toBe('/Cozinheiro.png')
    expect(funcaoMeta('garcom').avatar).toBe('/Garçom.png')
  })
})
```

- [ ] **Step 2: Run, confirm FAIL**
```bash
npx vitest run src/lib/__tests__/operacao-theme.test.ts
```

- [ ] **Step 3: Implement `src/lib/operacao-theme.ts`** (valores VERBATIM das paletas atuais das páginas)
```typescript
export type FuncaoOperacao = 'caixa' | 'cozinha' | 'garcom'

const PALETAS: Record<FuncaoOperacao, Record<string, string>> = {
  caixa: {
    pageBg: '#131009', surface: '#1a1608', surface2: '#130f07', border: '#2e2410', borderLight: '#1e1808',
    txt: '#f0ece8', txt2: '#dcd4c8', muted: '#604830', dim: '#503a20', subtle: '#7a6040',
    accent: '#b48a2a', accentLight: '#d4a84b', accentBg: '#2b1f0d',
    red: '#e05252', green: '#2a9d6f', amber: '#d97706', purple: '#6d4fc2',
  },
  cozinha: {
    pageBg: '#0f1714', surface: '#111a16', surface2: '#0d1410', border: '#1e2e26', borderLight: '#141e19',
    txt: '#e8f0ec', txt2: '#c8dcd2', muted: '#3d6050', dim: '#2d5040', subtle: '#5a7a6a',
    green: '#2a9d6f', greenLight: '#4bc994', greenBg: '#0d2b1f',
    red: '#e05252', redBg: '#1f0a0a',
  },
  garcom: {
    pageBg: '#0f0d18', surface: '#131020', surface2: '#0f0c1a', border: '#2a2550',
    txt: '#ede8f8', txt2: '#b8b0d8', muted: '#4a4570',
    accent: '#6d4fc2', accentLight: '#8b6fd4', accentBg: '#1a1530',
    green: '#2a9d6f', amber: '#d97706', purple: '#6d4fc2', red: '#e05252',
  },
}

const META: Record<FuncaoOperacao, { label: string; avatar: string }> = {
  caixa: { label: 'Caixa', avatar: '/Caixa.png' },
  cozinha: { label: 'Cozinha', avatar: '/Cozinheiro.png' },
  garcom: { label: 'Garçom', avatar: '/Garçom.png' },
}

export function temaOperacao(funcao: FuncaoOperacao): Record<string, string> {
  return PALETAS[funcao]
}
export function funcaoMeta(funcao: FuncaoOperacao): { label: string; avatar: string } {
  return META[funcao]
}
```

- [ ] **Step 4: Run green + tsc + commit**
```bash
npx vitest run src/lib/__tests__/operacao-theme.test.ts
npx tsc --noEmit
git add src/lib/operacao-theme.ts src/lib/__tests__/operacao-theme.test.ts
git commit -m "feat(operacao): centralized theme palette + função metadata"
```

---

## Task 2: Componente OperacaoHeader (TDD)

**Files:** Create `src/components/operacao/OperacaoHeader.tsx`, `src/components/operacao/__tests__/OperacaoHeader.test.tsx`

**Interfaces:**
- Consumes: `temaOperacao`, `funcaoMeta`.
- Produces: `OperacaoHeader({ funcao, nome, subtitulo, direita }: { funcao: FuncaoOperacao; nome: string; subtitulo?: string; direita?: React.ReactNode })`.

- [ ] **Step 1: Teste** (`__tests__/OperacaoHeader.test.tsx`) — usa @testing-library/react se disponível; senão um teste de render simples. PRIMEIRO verifique se `@testing-library/react` está nas devDependencies; se NÃO estiver, pule o teste de componente e faça um teste mínimo só de `funcaoMeta` já coberto na Task 1 — então este componente não terá teste unitário (aceitável; é visual). Se ESTIVER disponível:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OperacaoHeader } from '../OperacaoHeader'

describe('OperacaoHeader', () => {
  it('mostra o avatar da função e a saudação', () => {
    render(<OperacaoHeader funcao="caixa" nome="Arleson" />)
    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.getAttribute('src')).toContain('Caixa.png')
    expect(screen.getByText(/Arleson/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Implement `OperacaoHeader.tsx`** (`'use client'`)
```tsx
'use client'
import type { FuncaoOperacao } from '@/lib/operacao-theme'
import { temaOperacao, funcaoMeta } from '@/lib/operacao-theme'

export function OperacaoHeader({
  funcao, nome, subtitulo, direita,
}: { funcao: FuncaoOperacao; nome: string; subtitulo?: string; direita?: React.ReactNode }) {
  const C = temaOperacao(funcao)
  const meta = funcaoMeta(funcao)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: C.accentBg ?? C.greenBg ?? C.surface, border: `2px solid ${C.accent ?? C.green}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={meta.avatar} alt={meta.label} width={64} height={64} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 500, color: C.txt }}>
            Bem-vindo, <span style={{ color: C.accentLight ?? C.greenLight ?? C.accent ?? C.green }}>{nome}</span>
          </div>
          {subtitulo && <div style={{ fontSize: 13, color: C.subtle ?? C.muted }}>{subtitulo}</div>}
        </div>
      </div>
      {direita && <div style={{ display: 'flex', gap: 10 }}>{direita}</div>}
    </div>
  )
}
```

- [ ] **Step 3: Run + tsc + commit**
```bash
npm test
npx tsc --noEmit
git add src/components/operacao/OperacaoHeader.tsx src/components/operacao/__tests__/OperacaoHeader.test.tsx
git commit -m "feat(operacao): OperacaoHeader with role avatar + greeting"
```

---

## Task 3: Caixa — tema central + header + cards densos + estado PAGAMENTO

**Files:** Modify `src/app/[slug]/caixa/page.tsx`

> ⚠️ **NÃO alterar** nenhum `useEffect`, handler de socket, função de fetch, ou lógica de seleção/pedido. Só: trocar o `const C`, inserir o header, e refinar o JSX das mesas + faixa de status.

- [ ] **Step 1: Trocar a paleta local pelo tema central**
READ o arquivo. Adicionar no topo: `import { temaOperacao } from '@/lib/operacao-theme'`. Substituir todo o bloco `const C = { ... }` por:
```typescript
const C = temaOperacao('caixa')
```
(As chaves são idênticas — drop-in. Rodar `npx tsc --noEmit` para confirmar que nada quebrou.)

- [ ] **Step 2: Header com avatar + faixa de status**
Substituir o bloco de "Bem-vindo ao Caixa" (o hero com o círculo/ícone genérico) por `<OperacaoHeader funcao="caixa" nome={nomeDoUsuario} subtitulo="Selecione uma mesa para iniciar ou continuar um pedido" direita={<FaixaStatus .../>} />`. O `nomeDoUsuario` deve vir do estado/sessão já disponível na página (procure como o nome do usuário/garçom já é exibido). A "FaixaStatus" são 3 chips (Ocupadas / Livres / Em aberto) calculados a partir da lista de mesas/pedidos JÁ no estado — exibir contagem de ocupadas, livres, e soma dos totais parciais em aberto. Importar `OperacaoHeader` de `@/components/operacao/OperacaoHeader`.

- [ ] **Step 3: Cards de mesa mais densos + estado PAGAMENTO**
No grid de mesas, reduzir o `minmax` (ex. `repeat(auto-fill, minmax(160px, 1fr))`) e tornar os cards compactos. Em cada card de mesa OCUPADA, exibir o **tempo de ocupação** (a partir do timestamp do pedido já no estado) e o **total parcial** (soma dos itens do pedido já no estado). Adicionar tratamento visual para o estado "aguardando pagamento" quando aplicável (se o modelo de mesa/pedido já tiver esse status; caso não exista um status distinto, manter só OCUPADA/LIVRE e NÃO inventar dados — reportar DONE_WITH_CONCERNS explicando). Preservar os botões e seus `onClick` existentes.

- [ ] **Step 4: Verify + commit**
```bash
npx tsc --noEmit
npx next lint --file "src/app/[slug]/caixa/page.tsx"
npm test
git add "src/app/[slug]/caixa/page.tsx"
git commit -m "feat(caixa): centralized theme + avatar header + denser table cards"
```

- [ ] **Step 5: CHECKPOINT VISUAL** — Reportar ao controlador que o caixa está pronto para o usuário conferir no `npm run dev` ANTES de aplicar o mesmo às outras telas. (O controlador pausa para o usuário validar.)

---

## Task 4: Cozinha (KDS) — tema central + header + tickets legíveis

**Files:** Modify `src/app/[slug]/cozinha/page.tsx`

> ⚠️ NÃO alterar lógica de socket/estado/fetch/handlers.

- [ ] **Step 1: Tema central** — `import { temaOperacao } from '@/lib/operacao-theme'`; substituir `const C = {...}` por `const C = temaOperacao('cozinha')`. `npx tsc --noEmit` (drop-in; chaves idênticas). Se alguma chave usada não existir no tema (ex. uma chave extra só da cozinha), adicione-a ao objeto `cozinha` em `operacao-theme.ts` com o valor original e ajuste o teste.
- [ ] **Step 2: Header** — adicionar `<OperacaoHeader funcao="cozinha" nome={...} subtitulo="Pedidos em preparo" />` no topo, usando o avatar do cozinheiro.
- [ ] **Step 3: Tickets** — refinar os cards de pedido: estado claro (Novo / Em preparo / Pronto) e **destaque de atraso** por tempo decorrido (borda/cor quando passar de um limiar, ex. 15 min — usar o timestamp já no estado, sem mudar a lógica), tipografia maior na lista de itens, alvo de toque maior nos botões de avançar status (preservando os `onClick`).
- [ ] **Step 4: Verify + commit**
```bash
npx tsc --noEmit
npx next lint --file "src/app/[slug]/cozinha/page.tsx"
npm test
git add "src/app/[slug]/cozinha/page.tsx"
git commit -m "feat(cozinha): centralized theme + avatar header + clearer tickets"
```

---

## Task 5: Garçom — tema central + header + toque/carrinho

**Files:** Modify `src/app/[slug]/garcom/page.tsx`

> ⚠️ NÃO alterar lógica de socket/estado/fetch/handlers.

- [ ] **Step 1: Tema central** — `const C = temaOperacao('garcom')` (drop-in; se faltar chave, adicionar ao objeto `garcom` no tema com o valor original).
- [ ] **Step 2: Header** — `<OperacaoHeader funcao="garcom" nome={...} subtitulo="Atendimento de mesas" />` (avatar do garçom).
- [ ] **Step 3: Toque + carrinho** — aumentar alvos de toque (botões de quantidade +/- e enviar), clarear o carrinho/itens selecionados (quantidade proeminente, total visível), preservando o fluxo e os handlers.
- [ ] **Step 4: Verify + commit**
```bash
npx tsc --noEmit
npx next lint --file "src/app/[slug]/garcom/page.tsx"
npm test
git add "src/app/[slug]/garcom/page.tsx"
git commit -m "feat(garcom): centralized theme + avatar header + bigger touch targets"
```

---

## Task 6: Verificação final

**Files:** nenhum

- [ ] **Step 1: Suíte + tipos + lint**
```bash
npm test
npx tsc --noEmit
npx next lint
```
Esperado: 382+ testes verdes (a lógica não mudou), 0 erros de tipo; lint sem novos erros nas 3 páginas + tema + header.

- [ ] **Step 2: Checklist**
- As 3 páginas usam `temaOperacao(funcao)` (paletas centralizadas).
- Header com avatar nas 3.
- Nenhum handler/`useEffect`/socket alterado (revisar os diffs).
- Sem hex novo fora do `operacao-theme.ts`.

- [ ] **Step 3: Verificação visual** — usuário confere as 3 telas em `npm run dev` (caixa já validado no checkpoint da Task 3).

---

## Self-Review

**Cobertura do spec:**
- [x] Módulo de tema centralizado + meta → Task 1
- [x] Header com avatar → Task 2
- [x] Caixa (cards densos + status + PAGAMENTO) → Task 3
- [x] Cozinha (tickets/atraso) → Task 4
- [x] Garçom (toque/carrinho) → Task 5
- [x] Verificação/visual → Task 6

**Placeholders:** Tema e header têm código completo. Tasks 3–5 são refactor de UI em arquivos grandes — instruções com pontos de integração exatos e guardrails fortes ("não tocar lógica"); o implementador lê a página e aplica os refinos descritos. Itens que dependem de dados inexistentes (ex. status "PAGAMENTO" se o modelo não tiver) → reportar DONE_WITH_CONCERNS em vez de inventar.

**Consistência de tipos:** `FuncaoOperacao`/`temaOperacao`/`funcaoMeta` (Task 1) consumidos pelo `OperacaoHeader` (Task 2) e pelas 3 páginas (Tasks 3–5). Chaves do `C` preservadas verbatim → troca drop-in.
