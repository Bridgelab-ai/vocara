// Street pool generator — POST /api/generate-street-pool
// Generates 100 slang/street phrases per language pair (4 categories)
// Pairs: de→en, en→de, de→sw
export const config = { api: { bodyParser: false } }

const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili' }
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/vocara-ca2b7/databases/(default)/documents'

const PAIRS = [
  { from: 'de', to: 'en' },
  { from: 'en', to: 'de' },
  { from: 'de', to: 'sw' },
]

const CATEGORIES = [
  { key: 'slang',      count: 30, prompt: 'everyday colloquial slang and casual expressions used by native speakers in informal conversation — not offensive, just natural spoken language that textbooks don\'t teach. Examples of what to look for: cool/awesome expressions, ways to agree/disagree casually, informal greetings, reactions, filler words, shortcuts' },
  { key: 'idioms',     count: 30, prompt: 'common idioms and fixed expressions — phrases where the meaning is not literal. Include idioms about weather, body parts, animals, food, colors, numbers. Focus on idioms used in everyday conversation that language learners should recognize' },
  { key: 'youth',      count: 20, prompt: 'modern youth language and internet slang (appropriate, non-offensive) — terms popular among young people, social media expressions, reactions, compliments, playful insults between friends, words for describing things as cool or boring' },
  { key: 'smalltalk',  count: 20, prompt: 'smalltalk phrases and social conversation starters — how to start conversations, respond politely, give compliments, end conversations gracefully, express interest, show empathy, make small jokes, common phrases at parties, work events, shops, public transport' },
]

async function generateCategory(fromLang, toLang, cat) {
  const fromName = LANG_NAMES[fromLang]
  const toName = LANG_NAMES[toLang]
  const prompt = `Generate exactly ${cat.count} street language flashcards for a ${fromName} speaker learning ${toName}.
Category: ${cat.key} — focus: ${cat.prompt}

Rules:
- front: phrase/expression in ${fromName} with a brief context note in parentheses if needed
- back: natural equivalent in ${toName} (not always a direct translation — give the equivalent expression)
- pronunciation: German-style phonetic for ${toName} phrase (only if helpful, else empty string)
- wordType: always "phrase"
- register: "slang" | "informal" | "casual"
- All content must be appropriate (no offensive slurs or profanity)
- Make it real — these should be phrases a native speaker actually uses

Return ONLY a valid JSON array (no markdown):
[{"front":"...","back":"...","pronunciation":"...","wordType":"phrase","register":"informal"}]`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: 'You are a native-speaker language coach who knows authentic street language. Generate real colloquial phrases. Return ONLY valid JSON array, no markdown fences.',
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  const raw = (data.content?.[0]?.text || '').trim()
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []
  try { return JSON.parse(match[0]).slice(0, cat.count) } catch { return [] }
}

function cardToFirestore(c, fromLang, toLang, catKey) {
  return {
    mapValue: {
      fields: {
        id: { stringValue: `street_${catKey}_${fromLang}_${toLang}_${Math.random().toString(36).slice(2, 8)}` },
        front: { stringValue: c.front || '' },
        back: { stringValue: c.back || '' },
        pronunciation: { stringValue: c.pronunciation || '' },
        category: { stringValue: 'street' },
        wordType: { stringValue: 'phrase' },
        level: { integerValue: '1' },
        tense: { stringValue: 'present' },
        register: { stringValue: c.register || 'informal' },
        langA: { stringValue: fromLang },
        langB: { stringValue: toLang },
        source: { stringValue: 'street-pool' },
        streetCategory: { stringValue: catKey },
        createdAt: { integerValue: Date.now().toString() },
      }
    }
  }
}

async function writePool(fromLang, toLang, cards) {
  const docId = `${fromLang}_${toLang}_street`
  const docPath = `${FIRESTORE_BASE}/sharedCards/${docId}`
  const fields = {
    fromLang: { stringValue: fromLang },
    toLang: { stringValue: toLang },
    category: { stringValue: 'street' },
    generatedAt: { stringValue: new Date().toISOString() },
    count: { integerValue: String(cards.length) },
    cards: { arrayValue: { values: cards } },
  }
  const mask = ['fromLang', 'toLang', 'category', 'generatedAt', 'count', 'cards']
    .map(f => `updateMask.fieldPaths=${f}`).join('&')
  const r = await fetch(`${docPath}?${mask}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!r.ok) throw new Error(`Firestore write failed: ${r.status}`)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const results = []
  for (const { from, to } of PAIRS) {
    const allCards = []
    const catResults = []
    for (const cat of CATEGORIES) {
      try {
        const cards = await generateCategory(from, to, cat)
        const mapped = cards.map(c => cardToFirestore(c, from, to, cat.key))
        allCards.push(...mapped)
        catResults.push({ category: cat.key, count: cards.length })
      } catch (e) {
        catResults.push({ category: cat.key, error: e.message })
      }
    }
    if (allCards.length > 0) {
      try {
        await writePool(from, to, allCards)
        results.push({ pair: `${from}→${to}`, total: allCards.length, categories: catResults })
      } catch (e) {
        results.push({ pair: `${from}→${to}`, error: e.message, categories: catResults })
      }
    } else {
      results.push({ pair: `${from}→${to}`, error: 'No cards generated', categories: catResults })
    }
  }
  res.status(200).json({
    generated: results,
    total: results.reduce((s, r) => s + (r.total || 0), 0),
  })
}
