# Task 2 Report: Serviço `dados-pessoais.service.ts`

## Status
**COMPLETE** — All steps executed successfully.

## Deliverables

### Files Created
- `src/services/lgpd/dados-pessoais.service.ts` — Implementation with 4 exports:
  - `exportarDadosUsuario(userId)` — exports user profile, consents, and access logs (no password/pin)
  - `anonimizarUsuario(userId)` — clears personal data, sets email to pseudo-anon format, inactivates user
  - `contarAdminsAtivos(tenantId)` — counts active non-anonymized ADMINs
  - `podeAnonimizar(usuario, totalAdminsAtivos)` — pure guard preventing last admin from being anonymized

- `src/services/lgpd/__tests__/dados-pessoais.service.test.ts` — 5 passing tests covering:
  - podeAnonimizar guards (blocks last admin, allows others)
  - exportarDadosUsuario excludes password/pin from select and result
  - anonimizarUsuario clears PII, sets anon email, inactivates, timestamps deletion

### Commit
- Hash: `4c9c9a3`
- Branch: `feat/lgpd-g2b`
- Message: `feat(lgpd): servico de exportacao/anonimizacao de dados do titular`

## Test Results
```
 Test Files  1 passed (1)
      Tests  5 passed (5)
```

## TypeScript Check
```
npx tsc --noEmit
```
Clean — no errors.

## Implementation Notes
- Mocked prisma dependencies in test (user, consentRecord, userAccessLog)
- Service uses selective `select` to exclude sensitive fields from queries
- `anonimizarUsuario` also clears `image` field (not in test but in impl per brief)
- `contarAdminsAtivos` filters by `anonimizadoEm: null` to exclude previously deleted admins
- Guard `podeAnonimizar` is pure (no async, no side effects)

## Concerns
None — specification was complete and unambiguous; implementation matches brief exactly.

---

# Security Fix Report: SUPER_ADMIN guard in `podeAnonimizar` / `contarAdminsAtivos`

## Issue
`contarAdminsAtivos` counted only `role: 'ADMIN'`, ignoring `SUPER_ADMIN`. `podeAnonimizar` only gated `ADMIN` by the count. A sole `SUPER_ADMIN` could self-anonymize, leaving the tenant with zero admins.

## Changes

### `contarAdminsAtivos` — BEFORE
```ts
where: { tenantId, role: 'ADMIN', status: 'ACTIVE', anonimizadoEm: null },
```

### `contarAdminsAtivos` — AFTER
```ts
where: { tenantId, role: { in: ['ADMIN', 'SUPER_ADMIN'] }, status: 'ACTIVE', anonimizadoEm: null },
```

### `podeAnonimizar` — BEFORE
```ts
if (usuario.role === 'ADMIN') return totalAdminsAtivos > 1
return true
```

### `podeAnonimizar` — AFTER
```ts
if (usuario.role === 'ADMIN' || usuario.role === 'SUPER_ADMIN') return totalAdminsAtivos > 1
return true
```

## New Test Cases (regression)
```ts
it('bloqueia o unico SUPER_ADMIN ativo', () => {
  expect(podeAnonimizar({ role: 'SUPER_ADMIN', tenantId: 't1' }, 1)).toBe(false)
})
it('permite SUPER_ADMIN quando ha outro admin', () => {
  expect(podeAnonimizar({ role: 'SUPER_ADMIN', tenantId: 't1' }, 2)).toBe(true)
})
```

## Test Command & Result
```
npx vitest run src/services/lgpd/__tests__/dados-pessoais.service.test.ts
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

## TypeScript Check
```
npx tsc --noEmit
```
Clean — no errors.

## Commit
- Branch: `feat/lgpd-g2b`
- Hash: `97ee726`
