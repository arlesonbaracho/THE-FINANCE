# Email Verification on Registration — Design Spec

**Date:** 2026-06-06
**Scope:** Add 6-digit email verification code to the registration flow (two-step: fill form → verify email → account created)

---

## Overview

The current registration flow creates the account immediately after form submission, with no email verification. The new flow adds a second step: after the user submits the form, a 6-digit numeric code is sent to their email. The user enters the code on a verification screen, and only then is the account created. The existing intentionally-vague email-exists error is replaced with an explicit message.

---

## Architecture

No changes to the existing register API route. Two new API routes are added. The register page gains a `step` state to render either the form or the verification screen.

### Data Flow

```
[Form filled] → POST /api/auth/register/send-code
  → validate data (registerSchema)
  → check email exists → 409 if yes ("Este email já está cadastrado")
  → generate 6-digit code
  → upsert EmailVerificationCode { email, code, expiresAt: +15min }
  → send email (emailService.sendEmailVerification)
  → 200 OK

[Code entered] → POST /api/auth/register/verify-code
  → find valid, unused code for email
  → 400 if not found / expired / already used
  → mark code as used (usedAt = now)
  → create tenant + user (emailVerified = now())
  → 201 Created
```

---

## Database

### New model: `EmailVerificationCode`

```prisma
model EmailVerificationCode {
  id        String    @id @default(cuid())
  email     String
  code      String
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([email])
}
```

**Notes:**
- No unique constraint on `email` — multiple codes can exist (only the latest valid one is used)
- `usedAt` null = unused; non-null = already consumed
- Cleanup of expired records is out of scope (Prisma does not handle TTL; records accumulate but are inert)

---

## API Routes

### `POST /api/auth/register/send-code`

**Rate limit:** 3 requests per IP per hour (key: `register-send-code:<ip>`)

**Request body:**
```ts
{
  restaurantName: string  // min 2, max 100
  name: string            // min 2, max 100
  email: string           // valid email
  password: string        // min 6, max 100
}
```

Reuses `registerSchema` from `@/lib/validations` for validation.

**Behavior:**
1. Rate limit check
2. Validate body with `registerSchema` → 400 on failure
3. Check `prisma.user.findUnique({ where: { email } })` → 409 `{ error: 'Este email já está cadastrado.' }` if found
4. Generate code: `Math.floor(100000 + Math.random() * 900000).toString()` (always 6 digits)
5. `prisma.emailVerificationCode.create({ data: { email, code, expiresAt: new Date(Date.now() + 15 * 60 * 1000) } })`
6. `emailService.sendEmailVerification(email, code, name)` — fire-and-forget with error logging, never blocks response
7. Return `200 { message: 'Código enviado' }`

**Error responses:**
- `429` — rate limit exceeded
- `400` — validation failed
- `409` — email already registered
- `500` — internal error

---

### `POST /api/auth/register/verify-code`

**Rate limit:** 10 requests per email per hour (key: `register-verify:<email>`) — prevents brute force

**Request body:**
```ts
{
  restaurantName: string
  name: string
  email: string
  password: string
  code: string  // exactly 6 digits
}
```

**Behavior:**
1. Rate limit check
2. Validate `code` is a 6-digit string
3. Find the most recent valid code:
   ```ts
   prisma.emailVerificationCode.findFirst({
     where: { email, usedAt: null, expiresAt: { gt: new Date() } },
     orderBy: { createdAt: 'desc' },
   })
   ```
4. If not found → `400 { error: 'Código inválido ou expirado.' }`
5. Compare `record.code === code` → `400 { error: 'Código incorreto.' }` if mismatch
6. Mark as used: `prisma.emailVerificationCode.update({ where: { id }, data: { usedAt: new Date() } })`
7. Re-validate full registration data (email exists check again for race condition safety)
8. Hash password with `bcrypt.hash(password, 12)`
9. Create tenant + user with `emailVerified: new Date()`
10. Return `201 { message: 'Conta criada com sucesso', tenantId }`

**Error responses:**
- `429` — rate limit exceeded
- `400` — invalid/expired code, wrong code, or validation failure
- `409` — email registered in the race window (between send-code and verify-code)
- `500` — internal error

---

## Email Template

### New file: `src/lib/email/templates/email-verification.tsx`

Props: `{ code: string; name?: string; expiresInMinutes: number }`

Visual: matches existing dark template style. The 6-digit code is displayed in a large, monospace block (one `<Text>` element with large font, letter-spacing, background highlight). Expiration time shown below the code. Standard warning footer ("Se você não solicitou este cadastro, ignore este email").

### New method on `emailService`:

```ts
async sendEmailVerification(to: string, code: string, userName?: string): Promise<void>
```

Renders `EmailVerificationEmail` and calls the internal `send()` function. Subject: `"Confirme seu email — THE FINANCE"`.

---

## Frontend

### `src/app/auth/register/page.tsx`

Add `step: 'form' | 'verify'` state (default `'form'`).

**Step 1 — Form (unchanged layout):**
- Same 5 fields (restaurantName, name, email, password, confirmPassword)
- Submit button calls `POST /api/auth/register/send-code`
- On `200`: set `step = 'verify'`
- On `409`: show inline error "Este email já está cadastrado."
- On `429`: show inline error with retry message

**Step 2 — Verify (replaces form content):**
- Heading: "Verifique seu email"
- Subtitle: "Enviamos um código de 6 dígitos para **{email}**"
- Single `<input>` (or 6 individual digit inputs) for the code — `maxLength={6}`, `inputMode="numeric"`, `pattern="[0-9]*"`
- "Confirmar" button calls `POST /api/auth/register/verify-code` with all original form data + code
- On `201`: `toast.success('Conta criada!')` + `router.push('/auth/login')`
- On `400`/`429`: inline error below the input
- "Reenviar código" link: re-calls `send-code`, shows countdown timer (60s cooldown)
- "Voltar" link: sets `step = 'form'`

**Code input UX:** Single `<input type="text" maxLength={6} inputMode="numeric">` — simpler than 6 boxes, works on mobile keyboards. The "Confirmar" button is always available; auto-submit does NOT happen automatically (avoids accidental submission mid-correction).

---

## Security Summary

| Control | Value |
|---------|-------|
| Code format | 6 numeric digits |
| Code TTL | 15 minutes |
| Max send attempts | 3 per IP per hour |
| Max verify attempts | 10 per email per hour |
| Code reuse | Blocked (usedAt field) |
| Email enumeration | Explicit error only on registration (accepted trade-off) |

---

## Out of Scope

- Verification of existing unverified accounts (users created before this feature)
- Resending via SMS
- Expired code cleanup job
- Blocking login for unverified emails (not part of this spec)
