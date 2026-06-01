import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/crypto'

const BASE = process.env.IFOOD_API_BASE_URL ?? 'https://merchant-api.ifood.com.br'

async function fetchToken(clientId: string, clientSecret: string) {
  const body = new URLSearchParams({
    grantType: 'client_credentials',
    clientId,
    clientSecret,
  })
  const res = await fetch(`${BASE}/authentication/v1.0/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`iFood OAuth error ${res.status}: ${text}`)
  }
  return res.json() as Promise<{ accessToken: string; expiresIn: number; merchantId?: string }>
}

export async function conectar(tenantId: string, clientId: string, clientSecret: string): Promise<void> {
  const data = await fetchToken(clientId, clientSecret)
  const expiresAt = new Date(Date.now() + data.expiresIn * 1000)

  await prisma.iFoodIntegration.upsert({
    where: { tenantId },
    create: {
      tenantId,
      merchantId: data.merchantId ?? '',
      clientId,
      clientSecretEncrypted: encrypt(clientSecret),
      accessToken: encrypt(data.accessToken),
      tokenExpiresAt: expiresAt,
      status: 'CONECTADO',
    },
    update: {
      clientId,
      merchantId: data.merchantId ?? '',
      clientSecretEncrypted: encrypt(clientSecret),
      accessToken: encrypt(data.accessToken),
      tokenExpiresAt: expiresAt,
      status: 'CONECTADO',
    },
  })
}

export async function refreshToken(tenantId: string): Promise<string> {
  const integration = await prisma.iFoodIntegration.findUniqueOrThrow({ where: { tenantId } })
  const clientSecret = decrypt(integration.clientSecretEncrypted)
  let data: { accessToken: string; expiresIn: number }

  try {
    data = await fetchToken(integration.clientId, clientSecret)
  } catch (err) {
    await prisma.iFoodIntegration.update({ where: { tenantId }, data: { status: 'ERRO' } })
    throw err
  }

  const expiresAt = new Date(Date.now() + data.expiresIn * 1000)
  await prisma.iFoodIntegration.update({
    where: { tenantId },
    data: { accessToken: encrypt(data.accessToken), tokenExpiresAt: expiresAt, status: 'CONECTADO' },
  })
  return data.accessToken
}

export async function getAccessToken(tenantId: string): Promise<string> {
  const integration = await prisma.iFoodIntegration.findUniqueOrThrow({ where: { tenantId } })
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000)
  if (!integration.tokenExpiresAt || integration.tokenExpiresAt < fiveMinFromNow || !integration.accessToken) {
    return refreshToken(tenantId)
  }
  return decrypt(integration.accessToken)
}

export async function desconectar(tenantId: string): Promise<void> {
  await prisma.iFoodIntegration.update({
    where: { tenantId },
    data: { accessToken: null, refreshToken: null, tokenExpiresAt: null, status: 'DESCONECTADO' },
  })
}
