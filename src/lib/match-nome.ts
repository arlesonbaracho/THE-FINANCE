import levenshtein from 'fast-levenshtein'

export function melhorMatchPorNome(
  termo: string,
  candidatos: { id: string; name: string }[],
): { id: string; name: string; score: number } | null {
  if (candidatos.length === 0) return null
  const t = termo.toLowerCase()
  const scored = candidatos.map((c) => {
    const name = c.name.toLowerCase()
    const dist = levenshtein.get(t, name)
    const maxLen = Math.max(t.length, name.length)
    const score = maxLen === 0 ? 0 : Math.round((1 - dist / maxLen) * 100)
    return { id: c.id, name: c.name, score: Math.max(0, Math.min(100, score)) }
  })
  return scored.sort((a, b) => b.score - a.score)[0]
}
