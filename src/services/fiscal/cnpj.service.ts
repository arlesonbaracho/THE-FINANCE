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

export type CnpjLookup = {
  razaoSocial: string | null
  nomeFantasia: string | null
  situacaoCadastral: string | null
  ativo: boolean
}
export type CnpjLookupResult =
  | { status: 'ok'; data: CnpjLookup }
  | { status: 'inactive'; data: CnpjLookup }
  | { status: 'not_found' }
  | { status: 'unavailable' }

async function fetchJson(url: string, timeoutMs = 5000): Promise<unknown | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (res.status === 404) return { __notFound: true }
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

export async function lookupCnpj(digits: string): Promise<CnpjLookupResult> {
  const cnpj = normalizeCnpj(digits)
  let raw = await fetchJson(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
  if (raw && (raw as { __notFound?: boolean }).__notFound) return { status: 'not_found' }
  if (!raw) {
    raw = await fetchJson(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`)
    if (raw && (raw as { __notFound?: boolean }).__notFound) return { status: 'not_found' }
  }
  if (!raw) return { status: 'unavailable' }

  const o = raw as Record<string, unknown>
  const situacao = String(o.descricao_situacao_cadastral ?? o.situacao ?? '').toUpperCase()
  const ativo = situacao.includes('ATIVA')
  const data: CnpjLookup = {
    razaoSocial: (o.razao_social ?? o.nome ?? null) as string | null,
    nomeFantasia: (o.nome_fantasia ?? o.fantasia ?? null) as string | null,
    situacaoCadastral: situacao || null,
    ativo,
  }
  return { status: ativo ? 'ok' : 'inactive', data }
}
