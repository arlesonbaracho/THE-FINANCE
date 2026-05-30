import { SignJWT, jwtVerify } from 'jose'

const secret = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? 'kds-fallback-secret'
)

export async function signKdsToken(payload: {
  tenantId: string
  userId: string
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret)
}

export async function verifyKdsToken(
  token: string
): Promise<{ tenantId: string; userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as { tenantId: string; userId: string }
  } catch {
    return null
  }
}
