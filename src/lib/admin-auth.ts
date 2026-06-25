import { SignJWT, jwtVerify } from 'jose'
import { cookies, type UnsafeUnwrappedCookies } from 'next/headers';

const COOKIE_NAME = 'admin_token'
const IMPERSONATION_COOKIE = 'impersonation_token'
const ALGORITHM = 'HS256'

function getAdminSecret(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET
  if (!secret) throw new Error('ADMIN_JWT_SECRET environment variable is not set')
  return new TextEncoder().encode(secret)
}

export interface AdminTokenPayload {
  sub: string       // AdminUser.id
  email: string
  role: string
}

export interface ImpersonationPayload {
  tenantId: string
  tenantName: string
  adminId: string
}

// ── Issue / Revoke ────────────────────────────────────────────────────────────

export async function signAdminToken(payload: AdminTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getAdminSecret())
}

export async function signImpersonationToken(payload: ImpersonationPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(getAdminSecret())
}

export function setAdminCookie(token: string): void {
  (cookies() as unknown as UnsafeUnwrappedCookies).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60,
    path: '/',
  })
}

export function setImpersonationCookie(token: string): void {
  (cookies() as unknown as UnsafeUnwrappedCookies).set(IMPERSONATION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 2 * 60 * 60,
    path: '/',
  })
}

export function clearAdminCookie(): void {
  (cookies() as unknown as UnsafeUnwrappedCookies).delete(COOKIE_NAME)
}

export function clearImpersonationCookie(): void {
  (cookies() as unknown as UnsafeUnwrappedCookies).delete(IMPERSONATION_COOKIE)
}

// ── Verify ────────────────────────────────────────────────────────────────────

export async function verifyAdminToken(token: string): Promise<AdminTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAdminSecret())
    return payload as unknown as AdminTokenPayload
  } catch {
    return null
  }
}

export async function verifyImpersonationToken(token: string): Promise<ImpersonationPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAdminSecret())
    return payload as unknown as ImpersonationPayload
  } catch {
    return null
  }
}

// ── Session helpers ───────────────────────────────────────────────────────────

export async function getAdminSession(): Promise<AdminTokenPayload | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyAdminToken(token)
}

export async function getImpersonationSession(): Promise<ImpersonationPayload | null> {
  const token = (await cookies()).get(IMPERSONATION_COOKIE)?.value
  if (!token) return null
  return verifyImpersonationToken(token)
}
