import { randomInt } from 'crypto'

/**
 * Generates a cryptographically secure 6-digit numeric verification code.
 * Range: 100000–999999 (always exactly 6 digits, no leading zeros).
 */
export function generateVerificationCode(): string {
  return randomInt(100000, 1000000).toString()
}
