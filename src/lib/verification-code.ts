/**
 * Generates a cryptographically-simple 6-digit numeric verification code.
 * Range: 100000–999999 (always exactly 6 digits, no leading zeros).
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}
