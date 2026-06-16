export function normalizeCnpj(raw: string): string {
  return (raw ?? '').replace(/\D/g, '')
}

export function formatCnpj(digits: string): string {
  const d = normalizeCnpj(digits)
  if (d.length !== 14) return digits
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function calcCheckDigit(base: string): number {
  const weights = base.length === 12
    ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const sum = base
    .split('')
    .reduce((acc, ch, i) => acc + Number(ch) * weights[i], 0)
  const rest = sum % 11
  return rest < 2 ? 0 : 11 - rest
}

export function isValidCnpj(raw: string): boolean {
  const d = normalizeCnpj(raw)
  if (d.length !== 14) return false
  if (/^(\d)\1{13}$/.test(d)) return false
  const dv1 = calcCheckDigit(d.slice(0, 12))
  const dv2 = calcCheckDigit(d.slice(0, 12) + dv1)
  return d.slice(12) === `${dv1}${dv2}`
}
