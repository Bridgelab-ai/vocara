const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function getCards(key) {
  try {
    const raw = localStorage.getItem(`vocara_cache_${key}`)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL_MS) {
      localStorage.removeItem(`vocara_cache_${key}`)
      return null
    }
    return data
  } catch { return null }
}

export function setCards(key, data) {
  try {
    localStorage.setItem(`vocara_cache_${key}`, JSON.stringify({ data, ts: Date.now() }))
  } catch (e) { console.warn('[CardCache] setCards failed:', e.message) }
}

export function invalidateCache(key) {
  try { localStorage.removeItem(`vocara_cache_${key}`) } catch {}
}
