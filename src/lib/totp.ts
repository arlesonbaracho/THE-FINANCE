import { authenticator } from 'otplib'
import QRCode from 'qrcode'

const APP_NAME = 'THE FINANCE'

// Allow 1 time-step of clock skew
authenticator.options = { window: 1 }

export function generateTotpSecret(): string {
  return authenticator.generateSecret(20)
}

export function generateTotpToken(secret: string): string {
  return authenticator.generate(secret)
}

export function verifyTotpToken(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token, secret })
  } catch {
    return false
  }
}

export async function generateQrCodeDataUrl(email: string, secret: string): Promise<string> {
  const otpauth = authenticator.keyuri(email, APP_NAME, secret)
  return QRCode.toDataURL(otpauth)
}
