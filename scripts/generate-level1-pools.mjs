// One-shot script: generate Level 1 card pools for all categories + language pairs
// Run: node scripts/generate-level1-pools.mjs
const BASE = 'https://vocara-peach.vercel.app'
const delay = ms => new Promise(r => setTimeout(r, ms))

const JOBS = [
  // Grundlagen (base pool) — per pair
  { label: 'Base Grundlagen de→en L1', url: '/api/generate-base-pool', body: { level: 1, from: 'de', to: 'en' } },
  { label: 'Base Grundlagen en→de L1', url: '/api/generate-base-pool', body: { level: 1, from: 'en', to: 'de' } },
  { label: 'Base Grundlagen de→sw L1', url: '/api/generate-base-pool', body: { level: 1, from: 'de', to: 'sw' } },
  // Vocab — all pairs via single call
  { label: 'Vocab L1 (all pairs)', url: '/api/generate-vocab-pool', body: { level: 1 } },
  // Street — all pairs
  { label: 'Street L1 (all pairs)', url: '/api/generate-street-pool', body: { level: 1 } },
  // Home — all pairs
  { label: 'Home L1 (all pairs)', url: '/api/generate-home-pool', body: { level: 1 } },
  // Sentence flashcards — all pairs
  { label: 'Sentence FC L1 (all pairs)', url: '/api/generate-sentence-pool', body: { type: 'flashcards', level: 1 } },
  // Sentence training exercises — all pairs
  { label: 'Satz Training L1 (all pairs)', url: '/api/generate-sentence-training-pool', body: { level: 1 } },
]

async function run() {
  console.log(`\n▶ Generating Level 1 pools — ${JOBS.length} jobs\n`)
  const results = []
  for (const { label, url, body } of JOBS) {
    process.stdout.write(`  ▶ ${label}… `)
    try {
      const res = await fetch(`${BASE}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        console.log(`✕ HTTP ${res.status}: ${JSON.stringify(data).slice(0, 120)}`)
        results.push({ label, ok: false, status: res.status })
      } else {
        const summary = data.results
          ? data.results.map(r => `${r.langPair || r.pair || ''} L${r.level || ''}: ${r.count ?? r.error ?? '?'}`).join(' | ')
          : data.generated
            ? data.generated.map(r => `${r.pair}: ${r.count ?? r.level ?? r.error ?? '?'} ${r.total ? '('+r.total+')' : ''}`).join(' | ')
            : data.total !== undefined
              ? `total=${data.total}`
              : JSON.stringify(data).slice(0, 100)
        console.log(`✓ ${summary}`)
        results.push({ label, ok: true, summary })
      }
    } catch (e) {
      console.log(`✕ NETWORK: ${e.message}`)
      results.push({ label, ok: false, error: e.message })
    }
    await delay(2000)
  }

  console.log('\n── Summary ──────────────────────────────────────────')
  results.forEach(r => console.log(`  ${r.ok ? '✓' : '✕'} ${r.label}${r.ok ? ` → ${r.summary}` : ` → ${r.error || 'HTTP error'}`}`))
  const ok = results.filter(r => r.ok).length
  console.log(`\n  ${ok}/${results.length} succeeded\n`)
}

run().catch(e => { console.error('Fatal:', e); process.exit(1) })
