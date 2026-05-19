# ╔══════════════════════════════════════════════════════════════╗
# ║        THE FINANCE — MASTER PROMPT (Next.js Edition)         ║
# ║        Sistema Financeiro para Restaurantes                  ║
# ║        Cole no Claude Code para implementar o sistema        ║
# ╚══════════════════════════════════════════════════════════════╝

---

# 1. CONTEXTO DO PROJETO

```
Sistema:    THE FINANCE — gestão financeira para restaurantes
Stack:      Next.js 14 (App Router) · TypeScript · Tailwind CSS v4
DB/ORM:     PostgreSQL · Prisma 7.8
Auth:       NextAuth.js (JWT, strategy:'jwt', sessão 8h)
UI Base:    shadcn/ui · @base-ui/react (Sheet, AlertDialog, DropdownMenu)
Ícones:     lucide-react
Validação:  Zod v4 · React Hook Form v7 · @hookform/resolvers v5
Temas:      next-themes (classes .dark/.light no <html>)
Testes:     Vitest
Emails:     Resend (via src/lib/email/email.service.ts)
Versão:     1.0.0
```

## Convenções de arquivo
```
src/app/(dashboard)/…/page.tsx   — páginas do painel (requer auth)
src/app/api/…/route.ts           — API Routes (GET/POST/PATCH/DELETE)
src/components/…                 — componentes reutilizáveis
src/lib/…                        — utilitários, prisma, auth, validations
prisma/schema.prisma             — schema do banco
```

---

# 2. IDENTIDADE VISUAL — BRAND SYSTEM

## Monograma TF (SVG)
```tsx
// Símbolo geométrico: 3 retângulos em viewBox 72×72
// Barra superior (T):   x=10 y=10 w=52 h=11
// Haste vertical (T+F): x=30 y=10 w=11 h=52
// Barra do F (meio):    x=41 y=34 w=21 h=9

function TFMark({ size = 40, main = '#2D6A4F', accent = '#52b788' }) {
  const s = size / 72
  const r = (v: number) => v * s
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none">
      <rect x={r(10)} y={r(10)} width={r(52)} height={r(11)} fill={main}   />
      <rect x={r(30)} y={r(10)} width={r(11)} height={r(52)} fill={main}   />
      <rect x={r(41)} y={r(34)} width={r(21)} height={r(9)}  fill={accent} />
    </svg>
  )
}
```

## Tipografia
```
Interface / Corpo:  Inter (next/font/google) · weights 300, 400, 500, 600, 700
```

---

# 3. TOKENS DE COR — DOIS TEMAS

O sistema usa **CSS variables** declaradas em `src/app/globals.css`.
Nunca use valores hex hardcoded fora do globals.css — use sempre `var(--tf-*)`.

## Como o tema funciona
```
- next-themes gerencia a classe .dark no <html>
- globals.css define :root (Normal/Light) e .dark (Dark) 
- Tailwind v4: @custom-variant dark (&:is(.dark *))
- shadcn/ui usa tokens --background, --foreground, --primary, etc.
- THE FINANCE usa tokens --tf-* para componentes customizados
```

## Tokens shadcn/ui (base — use via Tailwind classes)
```css
/* Light (:root) / Dark (.dark) */
--background:        #F2F2F7  / #1C1C1E   → bg-background
--foreground:        #1C1C1E  / #FFFFFF   → text-foreground
--card:              #FFFFFF  / #252528   → bg-card
--card-foreground:   #1C1C1E  / #FFFFFF   → text-card-foreground
--primary:           #2D6A4F  / #2D6A4F   → bg-primary / text-primary
--primary-dark:      #1B4332  / #1B4332
--primary-foreground:#FFFFFF  / #FFFFFF   → text-primary-foreground
--muted:             #E5E5EA  / #3A3A3C   → bg-muted
--muted-foreground:  #636366  / #8E8E93   → text-muted-foreground
--border:            rgba(0,0,0,0.08) / rgba(255,255,255,0.08)  → border-border
--destructive:       #dc2663  / #0411a3
--sidebar:           #FFFFFF  / #252528   → bg-sidebar
--sidebar-border:    rgba(0,0,0,0.07) / rgba(255,255,255,0.07) → border-sidebar
```

## Tokens --tf-* (componentes customizados — use via style={{ }})

### Estrutura
| Token                | Normal     | Dark       |
|---------------------|------------|------------|
| `--tf-content-bg`   | `#f0f4f8`  | `#07100c`  |
| `--tf-surface`      | `#ffffff`  | `#0e1a14`  |
| `--tf-surface2`     | `#f7fafc`  | `#162219`  |
| `--tf-border-color` | `#dbe8f0`  | `#1a3028`  |
| `--tf-border-light` | `#eaf1f7`  | `#162219`  |

### Texto
| Token          | Normal     | Dark       |
|----------------|------------|------------|
| `--tf-txt`     | `#111827`  | `#f0ebe1`  |
| `--tf-txt2`    | `#4b6070`  | `#4a7a5f`  |
| `--tf-txt3`    | `#94a3b8`  | `#4a7a5f`  |
| `--tf-muted`   | `#4b6070`  | `#4a7a5f`  |

### Botão primário
| Token              | Normal     | Dark       |
|--------------------|------------|------------|
| `--tf-primary`     | `#2a9d6f`  | `#2d6a4f`  |
| `--tf-primary-hov` | `#207d58`  | `#1b4332`  |
| `--tf-primary-txt` | `#ffffff`  | `#52b788`  |

### Sidebar
| Token                    | Normal     | Dark                   |
|--------------------------|------------|------------------------|
| `--tf-sidebar-bg`        | `#1a2e3a`  | `#0e1a14`              |
| `--tf-sidebar-bd`        | `#243848`  | `#1a3028`              |
| `--tf-sidebar-txt`       | `#94afc0`  | `#4a7a5f`              |
| `--tf-sidebar-txt-on`    | `#ffffff`  | `#52b788`              |
| `--tf-sidebar-hov-bg`    | `#1f3749`  | `rgba(45,106,79,0.10)` |
| `--tf-sidebar-active-bg` | `#162636`  | `rgba(45,106,79,0.12)` |

### Semânticos (status)
```
--tf-yellow / --tf-yellow-bg / --tf-yellow-bd
  Normal: #b45309 / #fffbeb / #fde68a
  Dark:   #d4a017 / #1c1500 / #3a2c00

--tf-red / --tf-red-bg / --tf-red-bd
  Normal: #dc2626 / #fef2f2 / #fecaca
  Dark:   #e05a5a / #1c0808 / #3a1212

--tf-green-ok / --tf-green-ok-bg / --tf-green-ok-bd
  Normal: #16a34a / #f0fdf4 / #bbf7d0
  Dark:   #52b788 / #071a0f / #1e3528
```

---

# 4. SISTEMA DE TEMAS

## Toggle de tema (componente)
```tsx
'use client'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--tf-txt2)', padding: 6,
      }}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}
```

## Provedor (já configurado em src/app/layout.tsx)
```tsx
// ThemeProvider com attribute="class" e defaultTheme="light"
// Não é necessário criar ThemeContext — usar useTheme() do next-themes
```

---

# 5. REGRAS GERAIS DE INTERFACE

## Área de conteúdo — padrão de tokens

| Elemento            | Background              | Border                           | Texto              |
|---------------------|-------------------------|----------------------------------|--------------------|
| Cards de métrica    | `var(--tf-surface)`     | `1px solid var(--tf-border-color)` | `var(--tf-txt)`    |
| Input / Select      | `var(--tf-surface)`     | `1px solid var(--tf-border-color)` | `var(--tf-txt)`    |
| Tabela wrapper      | `var(--tf-surface)`     | `1px solid var(--tf-border-color)` | `var(--tf-txt)`    |
| Cabeçalho de tabela | `var(--tf-surface2)`    | `border-bottom var(--tf-border-color)` | `var(--tf-txt3)` |
| Linhas de tabela    | transparent             | `border-bottom var(--tf-border-light)` | `var(--tf-txt)`  |
| Hover de linha      | `var(--tf-surface2)`    | —                                | —                  |
| Botão outline       | `var(--tf-surface)`     | `1px solid var(--tf-border-color)` | `var(--tf-txt2)` |
| Botão primário      | `var(--tf-primary)`     | `1px solid var(--tf-primary)`    | `var(--tf-primary-txt)` |
| Título da página    | —                       | —                                | `var(--tf-txt)`    |
| Subtítulo           | —                       | —                                | `var(--tf-txt3)`   |

## Border-radius padrão
```
Botões:  7px   Inputs:  7px   Selects:  7px
Cards:   8px   Tabela:  8px   Badges:   9999px (pill)
Ícone-box: 8px  Modal/Sheet: 8px  Avatar: 50%
```

## Focus em inputs
```tsx
onFocus={e => { e.target.style.borderColor = 'var(--tf-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(42,157,111,0.1)' }}
onBlur={e  => { e.target.style.borderColor = 'var(--tf-border-color)'; e.target.style.boxShadow = 'none' }}
```

## Regra crítica: visibilidade responsiva
```
NUNCA use style={{ display: 'none' }} para ocultar elementos responsivamente.
inline style sempre sobrepõe classes Tailwind (especificidade mais alta).

CORRETO:   className="hidden md:flex"
ERRADO:    style={{ display: 'none' }} + className="md:flex"
```

---

# 6. PADRÕES DE CÓDIGO

## API Route
```ts
// src/app/api/[rota]/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { tenantId } = session.user
  // Todas as queries filtram por tenantId — multi-tenancy obrigatório
  const items = await prisma.model.findMany({ where: { tenantId } })
  return NextResponse.json(items)
}
```

## Params em route handler (Next.js 14)
```ts
// params é uma Promise — await obrigatório
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
}
```

## Session no cliente
```tsx
'use client'
import { useSession } from 'next-auth/react'

export function Component() {
  const { data: session } = useSession()
  // session.user.id, session.user.tenantId, session.user.role, session.user.name
}
```

## Validação com Zod v4 + React Hook Form
```tsx
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { zodErrorResponse } from '@/lib/validations'

const schema = z.object({ name: z.string().min(1) })
type FormData = z.infer<typeof schema>

export function MyForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })
}
```

> **Zod v4 nota**: `z.enum()` usa `{ error: '...' }`, não `{ message: '...' }`.
> `toLowerCase()` e `trim()` são métodos disponíveis em `z.string()`.

## Fetch de dados no cliente
```tsx
// Sem React Query — use fetch + useState + useEffect
const [data, setData] = useState<Item[]>([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  fetch('/api/rota')
    .then(r => r.json())
    .then(setData)
    .finally(() => setLoading(false))
}, [])
```

---

# 7. COMPONENTES UI COMPARTILHADOS

## StatusBadge
```tsx
// Variantes: 'ok' | 'reposicao' | 'critico' | 'ativo' | 'inativo' | 'pendente'
// Formato: pill (border-radius 9999px), padding 3px 9px, font 10.5px weight 500
// ok/ativo    → var(--tf-green-ok-bg), var(--tf-green-ok), var(--tf-green-ok-bd)
// reposicao   → var(--tf-yellow-bg), var(--tf-yellow), var(--tf-yellow-bd)
// critico     → var(--tf-red-bg), var(--tf-red), var(--tf-red-bd)
// inativo/pendente → var(--tf-surface2), var(--tf-txt3), var(--tf-border-color)
```

## StockBar
```tsx
// Props: current, minimum, width? (default 80px)
// Altura: 3px · Trilha: var(--tf-border-color) · border-radius: 2px
// cobertura = Math.min((current / minimum) * 100, 100)
// >= 60% → var(--tf-green-ok) | >= 20% → var(--tf-yellow) | < 20% → var(--tf-red)
```

## MargemDisplay
```tsx
// Props: margem (0–100), showBar? (default true)
// Valor: font-weight 600, 13px
// Barra: 3px, 56px
// >= 30% → var(--tf-green-ok) | >= 15% → var(--tf-yellow) | < 15% → var(--tf-red)
```

## MetricCard
```tsx
// background: var(--tf-surface) · border: 1px solid var(--tf-border-color) · border-radius: 8px
// padding: 16px 18px · gap: 12px (ícone + texto)
// Ícone 36×36px, border-radius 8px:
//   green   → var(--tf-green-ok-bg) + var(--tf-green-ok)
//   yellow  → var(--tf-yellow-bg)   + var(--tf-yellow)
//   red     → var(--tf-red-bg)      + var(--tf-red)
//   neutral → var(--tf-surface2)    + var(--tf-txt3)
// Valor: 20px font-weight 600 · Label: 10px uppercase letter-spacing .03em
```

## DataTable
```tsx
// Wrapper: var(--tf-surface), var(--tf-border-color), border-radius 8px, overflow hidden
// th: var(--tf-surface2), var(--tf-txt3), uppercase 10.5px weight 500, border-bottom
// td: 13px 16px padding, border-bottom var(--tf-border-light), color var(--tf-txt)
// tr hover: bg var(--tf-surface2)
// tr:last-child → sem border-bottom
// tfoot: var(--tf-surface2), var(--tf-txt3), border-top, padding 10px 16px
//        flex justify-between (contagem esq · totais dir)
```

## Botões
```tsx
// Primário:
<button style={{
  background: 'var(--tf-primary)', color: 'var(--tf-primary-txt)',
  border: '1px solid var(--tf-primary)', borderRadius: 7,
  padding: '8px 16px', fontSize: 12.5, fontWeight: 500,
}}
  onMouseEnter={e => e.currentTarget.style.background = 'var(--tf-primary-hov)'}
  onMouseLeave={e => e.currentTarget.style.background = 'var(--tf-primary)'}
>

// Outline:
<button style={{
  background: 'var(--tf-surface)', border: '1px solid var(--tf-border-color)',
  color: 'var(--tf-txt2)', borderRadius: 7,
  padding: '8px 16px', fontSize: 12.5, fontWeight: 500,
}}
  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--tf-primary)'; e.currentTarget.style.color = 'var(--tf-primary)' }}
  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--tf-border-color)'; e.currentTarget.style.color = 'var(--tf-txt2)' }}
>

// Ghost:
<button style={{ background: 'transparent', border: 'none', color: 'var(--tf-txt3)', cursor: 'pointer' }}
  onMouseEnter={e => e.currentTarget.style.background = 'var(--tf-surface2)'}
  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
>
```

## DropdownMenu (@base-ui/react)
```tsx
import * as DropdownMenu from '@base-ui-components/react/dropdown-menu'

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--tf-txt3)' }}>
      <MoreHorizontal size={16} />
    </button>
  </DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Positioner>
      <DropdownMenu.Popup style={{
        background: 'var(--tf-surface)', border: '1px solid var(--tf-border-color)',
        borderRadius: 8, padding: '4px', minWidth: 160, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      }}>
        <DropdownMenu.Item style={{ padding: '8px 12px', fontSize: 13, color: 'var(--tf-txt)', cursor: 'pointer', borderRadius: 6 }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--tf-surface2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          Editar
        </DropdownMenu.Item>
      </DropdownMenu.Popup>
    </DropdownMenu.Positioner>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
```

## Sheet (@base-ui/react) — para formulários laterais
```tsx
import * as Dialog from '@base-ui-components/react/dialog'

// Sheet = Dialog com posicionamento lateral
// Largura padrão: className="sm:max-w-[460px]"
// DialogTrigger NÃO suporta asChild — use wrapper

<Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Trigger>
    <button style={{ ... }}>Abrir</button>
  </Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Backdrop />
    <Dialog.Popup
      className="sm:max-w-[460px]"
      style={{ background: 'var(--tf-surface)', borderLeft: '1px solid var(--tf-border-color)' }}
    >
      <Dialog.Title style={{ fontSize: 17, fontWeight: 600, color: 'var(--tf-txt)' }}>
        Título
      </Dialog.Title>
      {/* conteúdo */}
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```

## AlertDialog (@base-ui/react) — para confirmações destrutivas
```tsx
import * as AlertDialog from '@base-ui-components/react/alert-dialog'

<AlertDialog.Root open={open} onOpenChange={setOpen}>
  <AlertDialog.Trigger>
    <button>Excluir</button>
  </AlertDialog.Trigger>
  <AlertDialog.Portal>
    <AlertDialog.Backdrop />
    <AlertDialog.Popup style={{
      background: 'var(--tf-surface)', borderRadius: 12,
      border: '1px solid var(--tf-border-color)', padding: 24, maxWidth: 400,
    }}>
      <AlertDialog.Title>Confirmar exclusão</AlertDialog.Title>
      <AlertDialog.Description>Esta ação não pode ser desfeita.</AlertDialog.Description>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
        <AlertDialog.Close><button>Cancelar</button></AlertDialog.Close>
        <button onClick={handleConfirm} style={{ color: 'var(--tf-red)' }}>Excluir</button>
      </div>
    </AlertDialog.Popup>
  </AlertDialog.Portal>
</AlertDialog.Root>
```

---

# 8. LAYOUT — SIDEBAR + HEADER

## Sidebar (src/components/layout/sidebar.tsx)
```tsx
// Componente já implementado — não recriar
// Navegação: Dashboard · Estoque (Insumos, Produtos, Inventário) · Configurações (Usuários, Perfil, Assinatura)
// Fundo: var(--tf-sidebar-bg) · Border-right: 1px solid var(--tf-sidebar-bd)
// Item normal:  color var(--tf-sidebar-txt), hover var(--tf-sidebar-hov-bg)
// Item ativo:   bg var(--tf-sidebar-active-bg), color var(--tf-sidebar-txt-on), font-weight 500
// Grupos expansíveis com ChevronDown/ChevronRight (lucide-react)
// Logo: TFMark + "THE FINANCE"
```

## Header (src/components/layout/header.tsx)
```tsx
// Topbar com nome do restaurante (esquerda) + ThemeToggle + avatar (direita)
// Fundo: var(--tf-surface) · Border-bottom: 1px solid var(--tf-border-color)
// Altura: 52px
```

## Layout do dashboard (src/app/(dashboard)/layout.tsx)
```tsx
// Sidebar fixo à esquerda + área de conteúdo à direita (flex)
// Proteção de rota via middleware.ts ou getServerSession
// background da área de conteúdo: var(--tf-content-bg)
```

---

# 9. ARQUITETURA — MULTI-TENANCY & RBAC

## Multi-tenancy
```
Cada restaurante = um Tenant
Todos os models têm tenantId (obrigatório)
Toda query Prisma filtra por session.user.tenantId
Nunca expor dados de outro tenant
```

## Roles (enum UserRole no Prisma)
```
SUPER_ADMIN — acesso admin global (painel /admin)
ADMIN       — dono do restaurante (acesso total)
MANAGER     — gerente (acesso operacional)
STAFF       — funcionário (acesso restrito)
```

## Custom Roles (tabela Role)
```prisma
model Role {
  id          String @id @default(cuid())
  tenantId    String
  name        String
  permissions Json   // { estoque: boolean, produtos: boolean, ... }
}
```

## Sessão NextAuth (campos disponíveis)
```ts
session.user = {
  id: string
  name: string
  email: string
  tenantId: string
  tenantName: string
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF'
  customRoleId?: string
  image?: string
  subscriptionStatus?: string
  planId?: string
}
```

## Proteção de API Route
```ts
const session = await getServerSession(authOptions)
if (!session?.user?.tenantId) {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
}
// Verificar permissão de role quando necessário:
if (session.user.role !== 'ADMIN' && session.user.role !== 'MANAGER') {
  return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
}
```

---

# 10. USUÁRIOS — TIPOS E FLUXOS

## Tipos de usuário
```
Email+senha — funcionários normais (ADMIN, MANAGER, STAFF)
  Cadastro: convite por email → /auth/convite/[token]
  Login: /auth/login com email+senha
  Reset de senha: /auth/recuperar-senha (auto) ou admin aciona reset

PIN (cozinheiros) — sem email, acesso via PIN de 4 dígitos
  Cadastro: admin cria diretamente com nome + PIN
  Login: via link exclusivo do restaurante + PIN
  Reset de PIN: admin faz no painel de usuários
```

## API Routes de usuários
```
GET  /api/usuarios       — lista users + pending invites do tenant
POST /api/usuarios       — cria user por PIN ou envia convite por email
DELETE /api/usuarios/[id] — desativa user ou cancela convite (id: 'invite_${id}')
POST /api/usuarios/[id]/reset-senha — admin aciona reset de senha (envia email)
```

## Convites
```
Invite.token (cuid) → URL: ${NEXTAUTH_URL}/auth/convite/${token}
GET /api/convite/validate/[token] → { valid, email, role, tenantName }
POST /api/convite/[token]         → aceita convite (cria senha, ativa user)
```

## Pending invites como virtual users
```ts
// GET /api/usuarios retorna [...users, ...inviteUsers]
// inviteUsers têm id: `invite_${invite.id}`, status: 'PENDING'
// DELETE /api/usuarios/invite_${id} cancela o convite (Prisma: invite.delete)
```

---

# 11. VALIDAÇÕES (src/lib/validations.ts)

## Schemas disponíveis
```ts
registerSchema          // cadastro de restaurante (name, email, password, restaurantName)
ingredientSchema        // insumo (name, unit, currentQty, minimumQty, unitCost + campos avançados)
movementSchema          // movimentação de estoque (type, quantity, unitCost?, reason?, note?)
productSchema           // produto (name, salePrice, categoryId?, active?)
productIngredientSchema // vínculo produto-insumo (ingredientId, quantity)
convidarFuncionarioSchema  // convite por email (email, roleId?)
convidarCozinheiroSchema   // criar cozinheiro por PIN (name, pin, roleId?)
redefinirPinSchema         // redefinir PIN (pin: 4 dígitos numéricos)
resetSenhaAdminSchema      // reset de senha pelo admin (userId: cuid)
```

## Unidades válidas
```ts
VALID_UNITS          = ['KG', 'G', 'L', 'ML', 'UN']
VALID_MOVEMENT_TYPES = ['IN', 'OUT', 'ADJUSTMENT', 'LOSS', 'EXPIRY', 'INTERNAL_USE']
```

## Uso nos API Routes
```ts
import { ingredientSchema, zodErrorResponse } from '@/lib/validations'

const body = await req.json()
const parsed = ingredientSchema.safeParse(body)
if (!parsed.success) {
  return NextResponse.json(zodErrorResponse(parsed.error), { status: 400 })
}
const data = parsed.data
```

---

# 12. MODAL — NOVO INSUMO

## Interface Prisma
```ts
// Modelo Ingredient no Prisma:
id, name, unit (KG|G|L|ML|UN), currentQty, minimumQty, unitCost
unidadeCompra?, fatorConversao, pontoReposicao, quantidadeMaxima?
subcategoria?, localizacao?, foto?, dataValidade?, supplierId?
tenantId, createdAt, updatedAt
```

## Campos do form
```
Nome *                  → input text
Unidade de medida *     → select (KG | G | L | ML | UN)
Custo unitário (R$) *   → number (min 0)
Qtd. Atual + Qtd. Mínima → grid 2 colunas

Campos avançados (expansível):
  Unidade de compra     → select (mesmas opções)
  Ponto de reposição    → number
  Subcategoria          → input text
  Localização           → input text
```

## Validação
```
Usar ingredientSchema de @/lib/validations
Erro inline abaixo do campo: fontSize 11, color var(--tf-red)
```

---

# 13. MODAL — NOVO PRODUTO

## Interface Prisma
```ts
// Modelo Product:
id, name, salePrice, active, categoryId?
tenantId, createdAt, updatedAt
// Relacionamento N:N via ProductIngredient:
//   productId, ingredientId, quantity
```

## Estrutura (3 abas com stepper)

### Barra de progresso
```
[1 Detalhes] ──── [2 Insumos ⚠] ──── [3 Financeiro]
Step Insumos: vermelho quando vazio, verde com ✓ quando preenchido
```

### Aba 1 — Detalhes
```
Nome *              → input text
Preço de venda *    → number (min 0)
Disponível          → toggle switch (checked padrão)
[Próximo: adicionar insumos →]
```

### Aba 2 — Insumos (OBRIGATÓRIA)
```
Alerta VAZIO:      fundo var(--tf-red-bg) — "Adicione ao menos 1 insumo"
Alerta PREENCHIDO: fundo var(--tf-green-ok-bg) — "X insumo(s) vinculado(s)"

Lista: nome · qty (input) · unidade · custo calculado · [lixeira]
Botão "+ Adicionar insumo" (dashed border)
  → busca/select dos insumos do tenant (excluindo já adicionados)
  → qty padrão = 1

Rodapé: "Custo total dos insumos: R$ X,XX"
```

### Aba 3 — Financeiro
```
Preço de venda    → sincronizado com aba 1
Custo dos insumos → calculado
Lucro bruto       → precoVenda - custoTotal (verde ≥ 0, vermelho < 0)

Barra de margem (0–100%):
  >= 40% → "✓ Margem excelente"    (var(--tf-green-ok))
  >= 25% → "✓ Margem saudável"     (var(--tf-green-ok))
  >= 10% → "⚠ Margem baixa"        (var(--tf-yellow))
  <  10% → "✗ Margem crítica"      (var(--tf-red))

Simulador: margem desejada (%) → preço sugerido = custo / (1 - margem/100)
```

## Cálculos
```ts
custoItem     = ingredient.unitCost × quantity
custoTotal    = sum(custoItem)
lucro         = salePrice - custoTotal
margem        = salePrice > 0 ? (lucro / salePrice) * 100 : 0
precoSugerido = custoTotal > 0 ? custoTotal / (1 - margemDesejada / 100) : 0

// Formatação BR
const fmt = (v: number) =>
  'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
```

## Validação — botão "Criar produto"
```
Habilitado somente: nome !== '' && salePrice > 0 && ingredients.length >= 1
Ao tentar salvar sem insumos: navega para aba 2, marca step com ! vermelho
```

---

# 14. TELA — INSUMOS (/estoque/insumos)

## Métricas (4 cards)
```
Total de insumos  · neutral   (count)
Valor em estoque  · green     (sum: currentQty × unitCost)
Em reposição      · yellow    (count onde currentQty < minimumQty && >= minimumQty * 0.5)
Crítico / Vencido · red       (count onde currentQty < minimumQty * 0.5 ou dataValidade passada)
```

## Status calculado
```ts
// currentQty >= minimumQty         → 'ok'
// currentQty >= minimumQty * 0.5   → 'reposicao'
// currentQty < minimumQty * 0.5    → 'critico'
```

## Tabela
```
Código (INS-XXXX) | Nome | Unidade | Qtd Atual + StockBar |
Qtd Mínima | Custo Unit. | Valor Total | Status | Ações (···)
```

## Ações (DropdownMenu)
```
Editar · Registrar entrada · Ver movimentações · Excluir (AlertDialog)
```

## API
```
GET    /api/insumos              — lista todos do tenant
POST   /api/insumos              — cria (body: ingredientSchema)
PATCH  /api/insumos/[id]         — edita
DELETE /api/insumos/[id]         — exclui (verificar se está em uso em produtos)
POST   /api/insumos/[id]/movimentacoes — registra entrada/saída (body: movementSchema)
GET    /api/insumos/[id]/movimentacoes — histórico de movimentações
```

---

# 15. TELA — PRODUTOS (/estoque/produtos)

## Métricas (3 cards)
```
Total de produtos  · neutral
Ativos             · green
Margem média       · yellow (média dos produtos ativos com salePrice > 0)
```

## Tabela
```
Nome | Insumos (nº vínculos) | Preço de venda | Custo total |
Lucro | Margem + MargemBar | Status | Ações (···)
```

## Regras visuais
```
Produto inativo:  nome e preço em var(--tf-txt3)
Lucro negativo:   cor var(--tf-red)
Margem: >= 30% → var(--tf-green-ok) | >= 15% → var(--tf-yellow) | < 15% → var(--tf-red)
```

## Ações
```
Editar · Ver composição · Ativar/Desativar · Excluir
```

## API
```
GET    /api/produtos             — lista todos do tenant (include: _count de ingredientes)
POST   /api/produtos             — cria (body: productSchema)
PATCH  /api/produtos/[id]        — edita
DELETE /api/produtos/[id]        — exclui
GET    /api/produtos/[id]        — detalhe com ingredientes vinculados
POST   /api/produtos/[id]/ingredientes   — vincula insumo (body: productIngredientSchema)
DELETE /api/produtos/[id]/ingredientes/[ingredienteId] — desvincula
```

---

# 16. TELA — INVENTÁRIO (/estoque/inventario)

## Métricas (4 cards)
```
Total de itens · Estoque OK (green) · Em Reposição (yellow) · Crítico (red)
```

## Abas
```
[Posição do Estoque]  [Contagens Físicas]
```
> Implementar abas via useState — NÃO usar Base UI Tabs (padrão atual do projeto).

## Tabela — Posição do Estoque
```
# | Nome | Unidade | Qtd Atual | Cobertura (barra+%) |
Qtd Mínima | Valor Total | Status | Atualizado

cobertura = (qtdAtual / qtdMinima) × 100
Barra 100px + texto "300%" ou "16%"
Cores: mesmas do StockBar
```

## Aba Contagens — empty state
```
<Package size={40} color="var(--tf-txt3)" />
"Nenhuma contagem em andamento"
<button>Iniciar nova contagem</button>
```

## Rodapé da tabela
```
Esquerda: "X item(s) · Atualizado às HH:MM"
Direita:  "Valor total: R$ X.XXX,XX"
```

---

# 17. CHECKLIST DE QUALIDADE

Antes de considerar qualquer tela/componente concluído:

**Visual**
- [ ] Todos os tokens de cor usam `var(--tf-*)` ou classes Tailwind shadcn/ui — zero hex hardcoded
- [ ] Inputs e cards: `background: var(--tf-surface)`, `border: 1px solid var(--tf-border-color)`
- [ ] Border-radius: botões/inputs = 7px, cards/tabelas/modais = 8px
- [ ] Título da página: `var(--tf-txt)`, fontWeight 600, fontSize 22
- [ ] Subtítulo: `var(--tf-txt3)`, fontSize 12.5
- [ ] Focus de inputs: borda `var(--tf-primary)` + sombra `0 0 0 3px rgba(42,157,111,.1)`
- [ ] Hover de botão outline → `var(--tf-primary)` em borda e cor
- [ ] Tabela: `border-radius 8px` + `overflow: hidden`
- [ ] Última linha da tabela sem `border-bottom`
- [ ] Visibilidade responsiva: SOMENTE className Tailwind (`hidden md:flex`) — nunca `style={{ display }}`

**Funcional**
- [ ] Multi-tenancy: toda query filtra por `session.user.tenantId`
- [ ] Validação Zod em todos os API Routes (body parse + safeParse)
- [ ] Erro de validação retorna `{ error: '...' }` com status 400
- [ ] Não autorizado retorna status 401, sem permissão retorna 403
- [ ] `await params` em todos os route handlers com params dinâmicos
- [ ] Insumos obrigatórios no modal de produto (insumos.length >= 1)
- [ ] Cálculo de custo/margem atualiza em tempo real
- [ ] Formatação de moeda em pt-BR (vírgula decimal, ponto milhar)
- [ ] Modais/Sheets fecham com ESC e botão ×
- [ ] Ações destrutivas (excluir) protegidas por AlertDialog de confirmação
- [ ] Testes unitários Vitest para validações (`src/lib/__tests__/validations.test.ts`)

**Performance**
- [ ] Server Components quando não precisa de estado/evento
- [ ] `'use client'` apenas onde necessário
- [ ] Depois de `prisma generate`, reiniciar o servidor de desenvolvimento

---

# 18. PROMPTS DE AJUSTE RÁPIDO

### Implementar nova tela com tabela e métricas
```
Implemente a tela [NOME] em src/app/(dashboard)/[rota]/page.tsx do THE FINANCE.
Use o padrão: 4 MetricCards no topo + DataTable + DropdownMenu de ações por linha.
Tokens: var(--tf-*) conforme especificação. Busca dados de GET /api/[rota].
```

### Adicionar formulário em Sheet lateral
```
Na tela [NOME], adicione um Sheet (@base-ui/react) para criar/editar [ENTIDADE].
Largura: className="sm:max-w-[460px]".
Form: React Hook Form + zodResolver([schema]Schema de @/lib/validations).
POST para /api/[rota] ao salvar. Fechar e refrescar lista após sucesso.
Tokens: var(--tf-surface) no background do Sheet.
```

### Adicionar confirmação destrutiva
```
Na tela [NOME], proteja a ação de excluir com AlertDialog (@base-ui/react).
Texto: "Tem certeza que deseja excluir [X]? Esta ação não pode ser desfeita."
Ao confirmar: DELETE /api/[rota]/[id]. Remover item da lista local após sucesso.
```

### Criar API Route com validação
```
Crie src/app/api/[rota]/route.ts para o THE FINANCE.
GET: lista todos do tenant (session.user.tenantId).
POST: valida body com [schema]Schema do @/lib/validations, cria no Prisma.
Retornar 401 se sem sessão, 400 com zodErrorResponse se inválido, 201 com o objeto criado.
```

### Corrigir inconsistência de tokens
```
Na tela [NOME] do THE FINANCE, substitua todos os valores hex hardcoded
pelos tokens CSS equivalentes:
  #ffffff / #0e1a14  → var(--tf-surface)
  #f7fafc / #162219  → var(--tf-surface2)
  #dbe8f0 / #1a3028  → var(--tf-border-color)
  #111827 / #f0ebe1  → var(--tf-txt)
  #4b6070 / #4a7a5f  → var(--tf-txt2)
  #94a3b8            → var(--tf-txt3)
  #2a9d6f / #2d6a4f  → var(--tf-primary)
```

### Corrigir visibilidade responsiva
```
Na tela [NOME] do THE FINANCE, corrija os elementos que usam style={{ display }} para visibilidade responsiva.
Regra: usar SOMENTE className Tailwind para display (hidden, flex, block).
NUNCA style={{ display: 'none' }} — inline style sobrepõe classes Tailwind.
Correto: className="hidden md:flex"
Errado:  style={{ display: 'none' }} + className="md:flex"
```

### Adicionar campo ao schema Prisma
```
No prisma/schema.prisma do THE FINANCE, adicione o campo [CAMPO] ao model [MODEL].
Em seguida:
1. Crie a migration em prisma/migrations/[timestamp]_[descricao]/migration.sql
2. Execute npx prisma generate para regenerar os tipos do cliente
3. Atualize os API Routes afetados (GET/POST/PATCH) para incluir o novo campo
4. Atualize o schema Zod correspondente em @/lib/validations.ts se necessário
5. Adicione/atualize testes em src/lib/__tests__/validations.test.ts
```

### Adicionar testes Vitest
```
Em src/lib/__tests__/validations.test.ts do THE FINANCE, adicione testes para [SCHEMA].
Cubra: caso válido · campos obrigatórios · limites de valores · normalização (trim/toLowerCase) · tipos de erro com .toMatch().
Execute: npx vitest run --reporter=verbose
```

### Esqueleto de loading
```
Nas tabelas de [TELA(S)], adicione skeleton loading enquanto os dados carregam.
5 linhas, mesmas colunas da tabela real.
Cores: background var(--tf-surface2), border-radius 4px, animação pulse (Tailwind: animate-pulse).
```

### Exportar tabela como CSV
```
Botão "Exportar" no topo da tabela em [TELA].
Gera CSV com todos os dados filtrados visíveis (não apenas a página atual).
Nome do arquivo: [tela]-YYYY-MM-DD.csv
Sem biblioteca externa — usar Blob + URL.createObjectURL.
```
