const store = new Map<string, { data: unknown; ts: number }>()
const TTL = 60_000 // 1 minute

export async function fetchCached<T>(url: string): Promise<T> {
  const hit = store.get(url)
  if (hit && Date.now() - hit.ts < TTL) return hit.data as T
  const res = await fetch(url)
  if (!res.ok) throw new Error(res.statusText)
  const data: T = await res.json()
  store.set(url, { data, ts: Date.now() })
  return data
}

export function invalidateCache(...urls: string[]) {
  for (const url of urls) store.delete(url)
}
