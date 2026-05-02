// Vocab pool generator — POST /api/generate-vocab-pool
// Generates 200 vocabulary cards per language pair (8 categories)
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
  { key: 'emotions',  count: 30, prompt: 'emotions and feelings: joy, sadness, anger, fear, love, surprise, disgust, shame, pride, hope, anxiety, relief, jealousy, loneliness, excitement, boredom, gratitude, regret, curiosity, confidence, frustration, nostalgia, enthusiasm, compassion, worry, happiness, grief, admiration, envy, contentment' },
  { key: 'everyday',  count: 30, prompt: 'everyday life vocabulary: morning, evening, breakfast, lunch, dinner, work, home, sleep, wake up, shower, cook, clean, shop, walk, drive, phone, computer, meeting, appointment, weekend, holiday, chores, garden, kitchen, bedroom, bathroom, living room, office, school, street' },
  { key: 'family',    count: 20, prompt: 'family and relationships: mother, father, sister, brother, grandmother, grandfather, aunt, uncle, cousin, son, daughter, husband, wife, friend, neighbor, colleague, boss, baby, child, parent, sibling, relative, marriage, divorce, birth, death, wedding, family reunion' },
  { key: 'body',      count: 20, prompt: 'human body parts and health: head, eye, ear, nose, mouth, hair, neck, shoulder, arm, hand, finger, chest, stomach, leg, foot, toe, back, heart, lung, brain, bone, skin, muscle, tooth, knee, elbow, thumb, ankle, hip, wrist' },
  { key: 'nature',    count: 20, prompt: 'nature and environment: sun, moon, star, sky, cloud, rain, snow, wind, tree, flower, grass, river, lake, ocean, mountain, forest, desert, beach, animal, bird, fish, insect, rock, soil, fire, ice, air, light, shadow, season' },
  { key: 'time',      count: 20, prompt: 'time expressions and concepts: now, later, before, after, yesterday, today, tomorrow, always, never, sometimes, often, soon, already, still, again, since, until, during, morning, afternoon, evening, night, hour, minute, second, week, month, year, century, moment' },
  { key: 'travel',    count: 30, prompt: 'travel and transportation: airport, train, bus, taxi, hotel, passport, ticket, luggage, map, tourist, city, country, border, visa, customs, departure, arrival, platform, station, terminal, seat, window, aisle, delay, booking, check-in, checkout, tour, guide, souvenir' },
  { key: 'food',      count: 30, prompt: 'food and cooking: bread, meat, fish, vegetable, fruit, cheese, egg, milk, rice, pasta, soup, salad, dessert, cake, coffee, tea, water, wine, beer, juice, salt, pepper, sugar, oil, butter, garlic, onion, tomato, apple, banana' },
]

async function generateCategory(fromLang, toLang, cat) {
  const fromName = LANG_NAMES[fromLang]
  const toName = LANG_NAMES[toLang]
  const prompt = `Generate exactly ${cat.count} vocabulary flashcards for a ${fromName} speaker learning ${toName}.
Category: ${cat.key} — focus words: ${cat.prompt}

Rules:
- front: word/phrase in ${fromName}
- back: accurate natural translation in ${toName}
- pronunciation: German-style phonetic syllables for ${toName} word (e.g. "GU-ten TAG") — empty string if not needed
- wordType: noun|verb|adjective|adverb|phrase
- All translations must be 100% accurate and natural, never literal

Return ONLY a valid JSON array (no markdown):
[{"front":"...","back":"...","pronunciation":"...","wordType":"noun"}]`

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
      system: 'You are a professional language educator. Generate accurate vocabulary flashcards. Return ONLY valid JSON array, no markdown fences.',
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
        id: { stringValue: `vocab_${catKey}_${fromLang}_${toLang}_${Math.random().toString(36).slice(2, 8)}` },
        front: { stringValue: c.front || '' },
        back: { stringValue: c.back || '' },
        pronunciation: { stringValue: c.pronunciation || '' },
        category: { stringValue: 'vocabulary' },
        wordType: { stringValue: c.wordType || 'noun' },
        level: { integerValue: '1' },
        tense: { stringValue: 'present' },
        register: { stringValue: 'neutral' },
        langA: { stringValue: fromLang },
        langB: { stringValue: toLang },
        source: { stringValue: 'vocab-pool' },
        vocabCategory: { stringValue: catKey },
        createdAt: { integerValue: Date.now().toString() },
      }
    }
  }
}

async function writePool(fromLang, toLang, cards) {
  const docId = `${fromLang}_${toLang}_vocab`
  const docPath = `${FIRESTORE_BASE}/sharedCards/${docId}`
  const fields = {
    fromLang: { stringValue: fromLang },
    toLang: { stringValue: toLang },
    category: { stringValue: 'vocabulary' },
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

async function processPair(from, to) {
  // Parallelize all category requests to avoid timeout
  const catResults = await Promise.all(CATEGORIES.map(async (cat) => {
    try {
      const cards = await generateCategory(from, to, cat)
      return { cat, cards, mapped: cards.map(c => cardToFirestore(c, from, to, cat.key)) }
    } catch (e) {
      return { cat, cards: [], mapped: [], error: e.message }
    }
  }))
  const allCards = catResults.flatMap(r => r.mapped)
  const summary = catResults.map(r => ({ category: r.cat.key, count: r.cards.length, ...(r.error ? { error: r.error } : {}) }))
  if (allCards.length === 0) return { pair: `${from}→${to}`, error: 'No cards generated', categories: summary }
  await writePool(from, to, allCards)
  return { pair: `${from}→${to}`, total: allCards.length, categories: summary }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  // Accept optional body: { from: 'de', to: 'en' } to process a single pair
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
