const store = new Map<string, { data: unknown; ts: number }>()

export async function fetchCached<T>(url: string, ttl = 60_000): Promise<T> {
  const hit = store.get(url)
  if (hit && Date.now() - hit.ts < ttl) return hit.data as T
  const res = await fetch(url)
  if (!res.ok) throw new Error(res.statusText)
  const data: T = await res.json()
  store.set(url, { data, ts: Date.now() })
  return data
}

export function invalidateCache(...urls: string[]) {
  for (const url of urls) store.delete(url)
}
