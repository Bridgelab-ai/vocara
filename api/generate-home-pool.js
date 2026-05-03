// POST /api/generate-home-pool
// Generates 60 home/household flashcards per language pair across 6 topics (10 each)
// Writes to sharedCards/{langPair}_home
export const config = { api: { bodyParser: false } }

const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili' }
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/vocara-ca2b7/databases/(default)/documents'

const PAIRS = [
  { from: 'de', to: 'en' },
  { from: 'en', to: 'de' },
  { from: 'de', to: 'sw' },
]

const TOPICS = [
  { key: 'kochen', count: 10, prompt: 'cooking and kitchen vocabulary — preparing meals, following recipes, kitchen utensils, describing food, asking about ingredients, saying something smells or tastes good, common phrases while cooking together' },
  { key: 'putzen', count: 10, prompt: 'cleaning and tidying the home — vacuuming, doing laundry, washing dishes, taking out the trash, asking someone to clean up, complaining about mess, household chores and who does them' },
  { key: 'wohnen', count: 10, prompt: 'living space and home vocabulary — rooms of the house, furniture, describing your apartment, moving in or out, paying rent, talking about neighbours, home repairs and things breaking' },
  { key: 'familie', count: 10, prompt: 'family life and relationships — talking about family members, daily routines with family, discussing plans and responsibilities, expressing affection, mild disagreements, family traditions and holidays' },
  { key: 'alltag', count: 10, prompt: 'everyday home routines — morning and evening routines, watching TV together, going to bed, waking up, getting ready, relaxing at home, small talk between housemates or partners during the day' },
  { key: 'haustiere', count: 10, prompt: 'pets and animals at home — talking about your pet, feeding and caring for animals, describing animal behaviour, going to the vet, asking if someone has a pet, common pet-related expressions' },
]

async function generateTopic(fromLang, toLang, topic) {
  const fromName = LANG_NAMES[fromLang]
  const toName = LANG_NAMES[toLang]
  const prompt = `Generate exactly ${topic.count} home/household flashcards for a ${fromName} speaker learning ${toName}.
Topic: ${topic.key} — focus: ${topic.prompt}

Rules:
- front: natural phrase or sentence in ${fromName} (may include brief context note in parentheses)
- back: natural equivalent in ${toName} — give the expression a native speaker would actually use
- tense: "present" | "past" | "future"
- context: one short usage note in ${fromName} (max 6 words)
- All phrases should feel natural in a real home setting
- Vary difficulty: mix short simple phrases with slightly longer ones
- No offensive content

Return ONLY a valid JSON array (no markdown):
[{"front":"...","back":"...","tense":"present","context":"..."}]`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: 'You are a native-speaker language teacher specializing in everyday home vocabulary. Return ONLY a valid JSON array, no markdown fences.',
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  const raw = (data.content?.[0]?.text || '').trim()
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []
  try { return JSON.parse(match[0]).slice(0, topic.count) } catch { return [] }
}

function cardToFirestore(c, fromLang, toLang, topicKey) {
  return {
    mapValue: {
      fields: {
        id: { stringValue: `home_${topicKey}_${fromLang}_${toLang}_${Math.random().toString(36).slice(2, 8)}` },
        front: { stringValue: c.front || '' },
        back: { stringValue: c.back || '' },
        category: { stringValue: 'home' },
        tense: { stringValue: c.tense || 'present' },
        context: { stringValue: c.context || '' },
        homeCategory: { stringValue: topicKey },
        langA: { stringValue: fromLang },
        langB: { stringValue: toLang },
        source: { stringValue: 'home-pool' },
        createdAt: { integerValue: Date.now().toString() },
      }
    }
  }
}

async function writePool(fromLang, toLang, cards) {
  const docId = `${fromLang}_${toLang}_home`
  const docPath = `${FIRESTORE_BASE}/sharedCards/${docId}`
  const fields = {
    fromLang: { stringValue: fromLang },
    toLang: { stringValue: toLang },
    category: { stringValue: 'home' },
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
  if (!r.ok) throw new Error(`Firestore write failed: ${r.status} ${await r.text()}`)
}

async function processPair(from, to) {
  const topicResults = []
  for (const topic of TOPICS) {
    try {
      const cards = await generateTopic(from, to, topic)
      topicResults.push({ topic, cards, mapped: cards.map(c => cardToFirestore(c, from, to, topic.key)) })
    } catch (e) {
      topicResults.push({ topic, cards: [], mapped: [], error: e.message })
    }
    await new Promise(r => setTimeout(r, 500))
  }
  const allCards = topicResults.flatMap(r => r.mapped)
  const summary = topicResults.map(r => ({ topic: r.topic.key, count: r.cards.length, ...(r.error ? { error: r.error } : {}) }))
  if (allCards.length === 0) return { pair: `${from}→${to}`, error: 'No cards generated', topics: summary }
  await writePool(from, to, allCards)
  return { pair: `${from}→${to}`, total: allCards.length, topics: summary }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  let body = {}
  try { const chunks = []; for await (const chunk of req) chunks.push(chunk); body = JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch {}
  const pairsToRun = (body.from && body.to) ? [{ from: body.from, to: body.to }] : PAIRS
  const results = []
  for (const { from, to } of pairsToRun) {
    try {
      const r = await processPair(from, to)
      results.push(r)
    } catch (e) {
      results.push({ pair: `${from}→${to}`, error: e.message })
    }
  }
  res.status(200).json({
    generated: results,
    total: results.reduce((s, r) => s + (r.total || 0), 0),
  })
}
