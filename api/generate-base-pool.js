// Base pool generator — POST /api/generate-base-pool
// Generates Level 1-3 Grundlagen cards for all 6 language pairs → 540 cards total
// Level 1 already generated; this run adds Level 2 + Level 3 (skips Level 1)
export const config = { api: { bodyParser: false } }

const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili', fr: 'French', es: 'Spanish', th: 'Thai' }
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/vocara-ca2b7/databases/(default)/documents'

const LANG_PAIRS = [
  { from: 'de', to: 'en' },
  { from: 'de', to: 'sw' },
  { from: 'en', to: 'de' },
  { from: 'en', to: 'sw' },
  { from: 'sw', to: 'de' },
  { from: 'sw', to: 'en' },
]

const LEVEL_CONTENT = {
  2: (fromName, toName) =>
    `Generate exactly 30 Level 2 Grundlagen flashcards for a ${fromName} speaker learning ${toName}.
Cover in this order:
- Numbers 11-100: eleven, twelve, thirteen, twenty, thirty, forty, fifty, sixty, seventy, eighty (10 cards)
- Days of the week: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday (7 cards)
- Months: January, February, March, April, May (5 cards)
- Personal pronouns: I, you, he, she, we, you(plural), they (4 cards — use the ${toName} equivalents)
- Basic verbs in present tense: to be, to have, to go, to come (4 cards)
All ${fromName} fronts, all ${toName} backs. 100% accurate. Include phonetic pronunciation for the ${toName} word.
Return ONLY a valid JSON array (no markdown):
[{"front":"word/phrase in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic for ${toName}","category":"grundlagen","level":2,"wordType":"number|day|month|pronoun|verb","tense":"present"}]`,

  3: (fromName, toName) =>
    `Generate exactly 30 Level 3 Grundlagen flashcards for a ${fromName} speaker learning ${toName}.
Cover in this order:
- Common nouns: table, door, house, car, water, food, time, day, year, city (10 cards)
- Basic adjectives: big, small, good, bad, new, old, beautiful, fast, slow, hot (10 cards)
- Question words: who, what, where, when, why, how, how much, how many (8 cards)
- Useful phrases: please repeat, I don't understand (2 cards)
All ${fromName} fronts, all ${toName} backs. 100% accurate. Include phonetic pronunciation for the ${toName} word.
Return ONLY a valid JSON array (no markdown):
[{"front":"word/phrase in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic for ${toName}","category":"grundlagen","level":3,"wordType":"noun|adjective|question|phrase","tense":"present"}]`,
}

async function generateCards(fromLang, toLang, level) {
  const fromName = LANG_NAMES[fromLang] || fromLang
  const toName = LANG_NAMES[toLang] || toLang
  const prompt = LEVEL_CONTENT[level](fromName, toName)
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: 'You are a professional language educator. Generate accurate beginner flashcards. Return ONLY valid JSON array, no markdown.',
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  const raw = (data.content?.[0]?.text || '').trim()
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []
  try { return JSON.parse(match[0]).slice(0, 30) } catch { return [] }
}

async function writeToFirestore(fromLang, toLang, level, cards) {
  const langPair = `${fromLang}_${toLang}`
  const docPath = `${FIRESTORE_BASE}/sharedCards/${langPair}_grundlagen_${level}`
  const fields = {
    fromLang: { stringValue: fromLang },
    toLang: { stringValue: toLang },
    level: { integerValue: String(level) },
    category: { stringValue: 'grundlagen' },
    generatedAt: { stringValue: new Date().toISOString() },
    cards: {
      arrayValue: {
        values: cards.map(c => ({
          mapValue: {
            fields: {
              id: { stringValue: `grundlagen_${level}_${fromLang}_${toLang}_${Math.random().toString(36).slice(2, 8)}` },
              front: { stringValue: c.front || '' },
              back: { stringValue: c.back || '' },
              pronunciation: { stringValue: c.pronunciation || '' },
              category: { stringValue: 'grundlagen' },
              level: { integerValue: String(level) },
              tense: { stringValue: 'present' },
              wordType: { stringValue: c.wordType || '' },
              langA: { stringValue: fromLang },
              langB: { stringValue: toLang },
              source: { stringValue: 'base-pool' },
              createdAt: { integerValue: Date.now().toString() },
            }
          }
        }))
      }
    }
  }
  const mask = ['fromLang','toLang','level','category','generatedAt','cards']
    .map(f => `updateMask.fieldPaths=${f}`).join('&')
  await fetch(`${docPath}?${mask}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' })
  }
  const results = []
  // Generate levels 2 and 3 (level 1 already exists)
  for (const level of [2, 3]) {
    for (const { from, to } of LANG_PAIRS) {
      try {
        const cards = await generateCards(from, to, level)
        if (cards.length > 0) {
          await writeToFirestore(from, to, level, cards)
          results.push({ pair: `${from}→${to}`, level, count: cards.length })
        } else {
          results.push({ pair: `${from}→${to}`, level, error: 'No cards generated' })
        }
      } catch (e) {
        results.push({ pair: `${from}→${to}`, level, error: e.message })
      }
    }
  }
  res.status(200).json({ generated: results, total: results.filter(r => r.count).reduce((s, r) => s + r.count, 0) })
}
