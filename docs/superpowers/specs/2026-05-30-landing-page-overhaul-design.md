# Landing Page Overhaul — THE FINANCE
**Data:** 2026-05-30  
**Status:** Aprovado  
**Escopo:** Redesign completo da landing page (`src/components/landing/`)

---

## 1. Objetivo

Substituir a landing page atual por uma versão ultra-moderna no estilo fintech premium: fundo preto, acentos neon verde esmeralda, glassmorphism, mascote 3D centralizado com animações, canvas com partículas/grid/anéis e cards de métricas flutuantes.

---

## 2. Arquitetura

### Abordagem
**Option B — Multi-file split + Canvas + CSS Hybrid**  
Nenhuma dependência nova. Canvas nativo para efeitos de fundo; CSS keyframes para animações; `IntersectionObserver` para scroll-reveal.

### Estrutura de arquivos

```
src/components/landing/
├── LandingPage.tsx          # Orquestrador fino (sem lógica visual)
├── CanvasBackground.tsx     # Canvas fixo: partículas, grid 3D, anéis, rede neural
├── HeroSection.tsx          # Mascote, cards flutuantes, headline, CTAs, skyline
├── ModulesSection.tsx       # Grid bento glassmorphism
├── PricingSection.tsx       # Cards de planos com shimmer no Pro
├── TestimonialsSection.tsx  # Cards glassmorphism, scroll horizontal mobile
├── CTASection.tsx           # CTA final cinematic
├── Footer.tsx               # Footer dois tons
├── Navbar.tsx               # Extraído do LandingPage (sem mudanças visuais)
└── DemoModal.tsx            # Extraído do LandingPage (sem mudanças visuais)
```

### Adições ao `globals.css`
Novos keyframes na seção LP:
- `lp-float` — oscilação vertical suave (±12px, 5s)
- `lp-ring-pulse` — anel escala 1→1.2 com fade opacity
- `lp-shimmer` — shimmer percorrendo borda do card Pro
- `lp-glow-pulse` — variação de intensidade do glow verde
- `lp-counter-reveal` — entrada dos contadores animados
- `lp-scroll-reveal` — fadeUp via IntersectionObserver

### Mascote
- Arquivo: `public/mascot.png` (pose: apontando dedo para cima)
- Deve ser colocado manualmente em `public/` antes do build

---

## 3. Design por Seção

### 3.1 CanvasBackground

**Tecnologia:** `<canvas>` fixo, `z-index: -1`, cobrindo 100vw × 100vh.

**Elementos animados:**
| Elemento | Detalhes |
|---|---|
| Partículas | ~70 pontos brancos/verdes, tamanho 1–3px, opacidade 0.15–0.6, velocidade aleatória |
| Grid floor | Grade de perspectiva convergindo ao horizonte, linhas `rgba(45,183,106,0.15)`, vanishing point centralizado |
| Anéis de energia | 3 anéis concêntricos expandindo do centro do canvas, `rgba(74,222,128,0.2)` → fade, raio 80→300px |
| Rede neural | ~15 nós brancos conectados por linhas finas verdes; nós derivam lentamente; conexões aparecem/somem |

**Performance:** `requestAnimationFrame` com delta time. Canvas re-renderiza somente quando visível (`IntersectionObserver`). Sem Three.js.

---

### 3.2 HeroSection

**Layout:** coluna centralizada, `min-height: 100vh`, `padding-top: 120px`.

**Camadas (de baixo para cima):**
1. Canvas (z-index -1)
2. Skyline city SVG — silhueta de prédios `#0a0a0a` com glow verde na base (`background: radial-gradient`)
3. Mascote + anéis + glow
4. Cards flutuantes
5. Texto + CTAs
6. Strip de estatísticas

**Mascote:**
```
<img src="/mascot.png" alt="The Finance mascot" />
```
- Largura: `clamp(260px, 30vw, 420px)`
- `animation: lp-float 5s ease-in-out infinite`
- `filter: drop-shadow(0 0 60px rgba(74,222,128,0.55))`
- Dois anéis CSS atrás: anel externo `animation: lp-ring-pulse 3s ease-in-out infinite`, interno com delay `1.5s`
- Glow radial atrás: `radial-gradient(ellipse 60% 40% at 50% 70%, rgba(74,222,128,0.18), transparent)`

**Cards flutuantes (posicionados em absoluto):**

*Card esquerdo — Pedidos hoje:*
- Posição: `left: clamp(0px, 5vw, 80px)`, `top: 35%`
- Conteúdo: label "Pedidos hoje", valor `1.285`, badge `↑ 23%` verde, sparkline SVG
- Estilo: glassmorphism (`backdrop-filter: blur(16px)`, `background: rgba(255,255,255,0.06)`, `border: 1px solid rgba(255,255,255,0.10)`)
- `animation: lp-float 6s ease-in-out infinite 0.8s`

*Card direito — Estoque preciso:*
- Posição: `right: clamp(0px, 5vw, 80px)`, `top: 38%`
- Conteúdo: label "Estoque preciso", valor `98%`, badge `↑ 12%`, barra de progresso verde
- Mesma estética glassmorphism
- `animation: lp-float 7s ease-in-out infinite 1.4s`

*Mini card revenue (bottom-right do mascote):*
- Ícone de gráfico de barras (lucide `TrendingUp`), valor `↑ 18%`
- Menor e mais sutil

**Texto (acima do mascote):**
1. Pílula tagline: `Novo · Gestão completa para restaurantes — THE FINANCE v1.0`
2. `<h1>` — `clamp(42px,7vw,88px)`: "Gerencie seu restaurante com **inteligência** e controle total" — *inteligência* em `<em style="color: #4ADE80; font-style: italic">`
3. `<p>` — subtítulo: "Controle estoque, vendas, financeiro e cozinha em tempo real com IA."
4. Feature chips: Agente de IA · KDS em tempo real · Multi-usuário · Controle financeiro
5. Botões CTA:
   - Primário: `"Começar Gratuitamente"` — `background: #16a34a`, `box-shadow: 0 4px 24px rgba(74,222,128,0.4)`, hover eleva
   - Secundário: `"Assistir Demonstração"` — borda sólida `rgba(74,222,128,0.5)`, fundo transparente

**Stats strip (border-top, dentro do hero):**
```
+12k pedidos | 98% estoque | 3x eficiência | 500+ restaurantes
```
- Cada item: ícone lucide + valor em branco bold + label muted
- Separados por divisores verticais `rgba(255,255,255,0.1)`

---

### 3.3 ModulesSection

- Título: "Tudo que seu restaurante precisa" + subtítulo
- Layout: CSS grid bento — card "Agente de IA" ocupa `grid-column: span 2` (destaque); demais 1×1
- Cada card: `backdrop-filter: blur(20px)`, `background: rgba(255,255,255,0.04)`, `border-radius: 20px`
- Hover: `border-color` anima para `rgba(74,222,128,0.4)`, card `translateY(-4px)`, `box-shadow: 0 8px 32px rgba(74,222,128,0.12)`
- Ícones lucide (substituem emojis) com círculo de fundo `rgba(74,222,128,0.15)`
- Scroll-reveal: `IntersectionObserver` aplica `.lp-revealed` que dispara `lp-fadeUp`

---

### 3.4 PricingSection

- Dados mantidos exatamente: Básico R$149/R$119 · Pro R$299/R$239 · Enterprise sob consulta
- Toggle mensal/anual: pílula deslizante com transição CSS
- Card Pro (highlight):
  - Borda `2px solid #16a34a`
  - Shimmer: pseudo-elemento `::before` com `background: linear-gradient(90deg, transparent, rgba(74,222,128,0.15), transparent)`, `animation: lp-shimmer 2.5s linear infinite`
  - `box-shadow: 0 0 48px rgba(74,222,128,0.2)`
- Badge "Mais popular" com glow verde
- Ícone ✓ substitui texto por `<Check size={14}>` lucide em verde

---

### 3.5 TestimonialsSection

- Título: "O que nossos clientes dizem"
- Desktop: grid 3 colunas. Mobile: scroll horizontal (`overflow-x: auto`, `scroll-snap-type: x mandatory`)
- Cards: glassmorphism, hover eleva + borda verde suave
- ★ estrelas em `#4ADE80` tamanho 16px
- Avatar: círculo com `background: linear-gradient(135deg, #16a34a, #052e16)`, inicial centralizada

---

### 3.6 CTASection

- Fundo full-width, `overflow: hidden`
- Orbe verde: `width: 800px, height: 500px`, `filter: blur(120px)`, `animation: lp-glow-pulse 10s ease-in-out infinite`
- Headline: "Pronto para transformar sua operação?"
- Subtítulo + par de botões (mesmo padrão do hero)
- Nota: "14 dias grátis · Sem cartão · Cancele quando quiser"

---

### 3.7 Footer

- Fundo: `#0d0d0d` (ligeiramente mais escuro que o resto da página)
- Linha separadora no topo: `1px solid rgba(255,255,255,0.06)`
- Coluna da marca: logo + tagline curta + badges "Dados protegidos" e "SSL"
- 3 colunas de links (Produto, Empresa, Suporte) — links hover em branco
- Rodapé final: copyright à esquerda, "Feito com ♥ para restaurantes brasileiros" à direita

---

## 4. Sistema de Animações

| Classe/Keyframe | Uso |
|---|---|
| `.lp-scroll-reveal` | Aplicada via JS; `IntersectionObserver` adiciona `.lp-revealed` que dispara fadeUp |
| `lp-float` | Oscilação do mascote e cards flutuantes |
| `lp-ring-pulse` | Anéis de energia ao redor do mascote |
| `lp-shimmer` | Borda do card Pro na seção de planos |
| `lp-glow-pulse` | Orbe do CTA final e do hero |
| `lp-fadeUp` | Animação base de entrada (já existe) |
| `lp-spin` | Spinner do modal de demo (já existe) |

---

## 5. Responsividade

| Breakpoint | Ajustes |
|---|---|
| `< 768px` | Cards flutuantes ocultados; mascote reduzido; grid bento vira 1 coluna; planos em coluna única |
| `768px–1024px` | Cards flutuantes visíveis mas menores; bento 2 colunas |
| `> 1024px` | Layout completo |

---

## 6. Restrições

- Nenhuma dependência nova (sem Framer Motion, sem Three.js, sem GSAP)
- Mascote requer `public/mascot.png` colocado manualmente
- Canvas desativado se `prefers-reduced-motion: reduce` (fallback: fundo sólido)
- Toda lógica de negócio (preços, textos, planos, links) mantida idêntica à versão atual
- Arquivos `Navbar.tsx` e `DemoModal.tsx` são extrações puras do `LandingPage.tsx` atual sem alterações visuais
