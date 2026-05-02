// Base pool generator — run ONCE via POST /api/generate-base-pool
// Generates Level 1 Grundlagen cards for all language pairs and writes to Firestore
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

async function generateGrundlagenCards(fromLang, toLang) {
  const fromName = LANG_NAMES[fromLang] || fromLang
  const toName = LANG_NAMES[toLang] || toLang
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      system: 'You are a professional language educator. Generate accurate beginner flashcards. Return ONLY valid JSON array, no markdown.',
      messages: [{
        role: 'user',
        content: `Generate 30 Level 1 Grundlagen flashcards for ${fromName}→${toName} learners.
Cover exactly: colors (10 cards), numbers 1-10 (10 cards), basic greetings (5 cards), simple shapes (5 cards).
100% accurate translations, natural expressions, include phonetic pronunciation guide.
Return ONLY JSON array:
[{"front":"word in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic hint for ${toName} word","category":"grundlagen","level":1,"wordType":"noun|verb|greeting|number|color|shape","tense":"present"}]`,
      }],
    }),
  })
  const data = await res.json()
  const raw = (data.content?.[0]?.text || '').trim()
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []
  try { return JSON.parse(match[0]).slice(0, 30) } catch { return [] }
}

async function writeToFirestore(fromLang, toLang, cards) {
  const langPair = `${fromLang}_${toLang}`
  const docPath = `${FIRESTORE_BASE}/sharedCards/${langPair}_grundlagen_1`
  const fields = {
    fromLang: { stringValue: fromLang },
    toLang: { stringValue: toLang },
    level: { integerValue: '1' },
    category: { stringValue: 'grundlagen' },
    generatedAt: { stringValue: new Date().toISOString() },
    cards: {
      arrayValue: {
        values: cards.map(c => ({
          mapValue: {
            fields: {
              id: { stringValue: `grundlagen_1_${fromLang}_${toLang}_${Math.random().toString(36).slice(2, 8)}` },
              front: { stringValue: c.front || '' },
              back: { stringValue: c.back || '' },
              pronunciation: { stringValue: c.pronunciation || '' },
              category: { stringValue: 'grundlagen' },
              level: { integerValue: '1' },
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
  await fetch(`${docPath}?updateMask.fieldPaths=fromLang&updateMask.fieldPaths=toLang&updateMask.fieldPaths=level&updateMask.fieldPaths=category&updateMask.fieldPaths=generatedAt&updateMask.fieldPaths=cards`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only — run once to populate base pool' })
  }
  const results = []
  for (const { from, to } of LANG_PAIRS) {
    try {
      const cards = await generateGrundlagenCards(from, to)
      if (cards.length > 0) {
        await writeToFirestore(from, to, cards)
        results.push({ pair: `${from}→${to}`, count: cards.length })
      } else {
        results.push({ pair: `${from}→${to}`, error: 'No cards generated' })
      }
    } catch (e) {
      results.push({ pair: `${from}→${to}`, error: e.message })
    }
  }
  res.status(200).json({ generated: results })
}
