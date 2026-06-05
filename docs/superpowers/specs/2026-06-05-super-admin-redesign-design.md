# Super Admin Redesign + Create/Edit Plans

**Date:** 2026-06-05  
**Scope:** Full visual redesign of the super admin panel + create/edit plan functionality

---

## Overview

The super admin currently has inconsistent styling (some pages use Tailwind classes, others use inline styles), a sidebar color scheme that clashes with the main content area, and no way to create or edit plans from the UI. This spec covers a unified visual redesign (modern/clean dark theme) and adds the missing create/edit plan workflow.

---

## Architecture

No new routes or API endpoints are needed. All API routes already exist:

- `POST /api/admin/plans` — create plan
- `PUT /api/admin/plans/:id` — update plan
- `DELETE /api/admin/plans/:id` — delete plan (already wired)

The implementation is purely frontend: new/updated components and pages.

---

## Components

### New: `src/components/admin/plan-form-modal.tsx`

Client Component. A single reusable modal for both creating and editing plans.

**Props:**
```ts
interface PlanFormModalProps {
  plan?: {
    id: string
    name: string
    description: string | null
    monthlyPrice: number
    annualPrice: number
    maxUsers: number
    maxProducts: number
    maxOrdersMonth: number
    features: {
      aiAgent: boolean
      advancedReports: boolean
      multiUnit: boolean
      prioritySupport: boolean
      exportReports: boolean
    }
  }
  trigger: React.ReactNode
}
```

**Behavior:**
- `plan` undefined → create mode (POST to `/api/admin/plans`, title "Novo Plano")
- `plan` defined → edit mode (PUT to `/api/admin/plans/:id`, title "Editar Plano")
- On success: `toast.success(...)` + `router.refresh()`
- On error: `toast.error(d.error ?? 'Erro')`
- Uses the existing `Dialog` component from `@/components/ui/dialog`
- Uses `Input` from `@/components/ui/input`

**Form fields:**
| Field | Type | Validation |
|-------|------|-----------|
| Nome | text | min 2, max 80 |
| Descrição | text | max 300, optional |
| Preço Mensal (R$) | number | min 0 |
| Preço Anual (R$) | number | min 0 |
| Máx. Usuários | number integer | min 1 |
| Máx. Produtos | number integer | min 1 |
| Máx. Pedidos/mês (k) | number integer | min 1 |
| Features (5 checkboxes) | boolean | — |

Features labels match `featureLabels` in the plans page: Agente IA, Relatórios Avançados, Multi-unidade, Suporte Prioritário, Exportação.

---

## Modified Components

### `src/components/admin/plan-actions.tsx`

Add "Editar plano" item to the dropdown menu (above "Excluir plano"). Renders a `PlanFormModal` with `plan` prop pre-filled. Requires the page to pass the full plan object as prop instead of just `planId`.

Updated props:
```ts
interface Props {
  plan: PlanData  // full plan object (replaces planId + planName)
  subCount: number
}
```

The plans page currently passes `planId` and `planName` separately — update the call site to pass the full `plan` object.

---

## Visual Redesign

### Color System Changes

| Element | Current | New |
|---------|---------|-----|
| App background | `bg-slate-900` | `bg-[#0a0d14]` |
| Sidebar background | `bg-slate-950` | `bg-[#060810]` |
| Card surface | `bg-slate-800/60` | `bg-slate-900` |
| Card border | `border-slate-700` | `border-slate-800` |
| Table header | `bg-slate-800` | `bg-slate-900/80` |
| Table rows | `bg-slate-900` | `bg-[#0a0d14]` |
| Nav item active | `bg-slate-800 text-white` | `bg-indigo-600/20 text-indigo-400 border-l-2 border-indigo-500` |
| Logo accent | `bg-emerald-700` | `bg-indigo-600` |
| Main padding | `p-6` | `p-8` |

### Sidebar (`components/admin/sidebar.tsx`)

- Width: `w-56` (was `w-60`)
- Logo: indigo accent, same triangle SVG
- Nav grouped into 2 labeled sections:
  - **Principal**: Dashboard, Restaurantes, Planos, Financeiro
  - **Sistema**: Saúde, Uso de IA, Integrações, Logs
- Active state: left border + indigo tint
- Section labels: `text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 mb-1`

### Header (`components/admin/header.tsx`)

- Remove "MODO ADMIN" red chip
- Add `SUPER ADMIN` badge in indigo (subtle, smaller)
- Bell icon: `animate-pulse` ring when `count > 0`
- Left side: badge only; center: empty; right: bell

### Layout (`app/(admin)/layout.tsx`)

- `bg-[#0a0d14]` background
- `main` padding: `p-8`

### Page titles

All page `<h1>` elements: `text-2xl font-bold text-white` (was `text-xl font-semibold`)

### Inline-style pages → Tailwind

Four pages currently use `style={{}}` inline styles and reference CSS vars like `var(--tf-surface)`. Migrate to Tailwind:

- `src/app/(admin)/admin/saude/saude-client.tsx`
- `src/app/(admin)/admin/financeiro/financeiro-client.tsx`
- `src/app/(admin)/admin/uso-ia/uso-ia-client.tsx`
- `src/app/(admin)/admin/integracoes/integracoes-client.tsx`

For each: replace inline `style={{}}` props with equivalent Tailwind classes using the new color tokens.

---

## Plans Page Updates (`app/(admin)/admin/planos/page.tsx`)

- Add `+ Novo Plano` button in the header row (right side)
- Button renders `<PlanFormModal trigger={<Button>+ Novo Plano</Button>} />`
- Update `<PlanActions>` call to pass full `plan` object

---

## Error Handling

- Client-side form validation: required fields checked before fetch
- Server errors displayed via `toast.error()`
- Delete guard (subCount > 0) already exists in `PlanActions` — no change needed

---

## Out of Scope

- No new API routes
- No mobile/responsive layout changes
- No dark/light mode toggle for admin (admin is always dark)
- No login page redesign
