// Weekly auto-pool: generates 20 cards per active language pair, runs via Vercel cron every Sunday 3am
export const config = { api: { bodyParser: false } }

const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili', fr: 'French', es: 'Spanish', th: 'Thai' }
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/vocara-ca2b7/databases/(default)/documents'

const CARD_TOPICS = [
  'everyday situations (shopping, transport, greetings)',
  'emotions and relationships',
  'food and cooking',
  'work and career',
  'travel and directions',
  'health and body',
  'weather and nature',
  'technology and modern life',
  'culture and traditions',
  'time and planning',
]

async function generateCards(fromLang, toLang, topic) {
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
      max_tokens: 1500,
      system: 'You are a language learning expert. Generate vocabulary flashcards. Return ONLY valid JSON array, no markdown.',
      messages: [{
        role: 'user',
        content: `Generate 20 ${fromName}→${toName} flashcards about: ${topic}.
Return a JSON array of objects: [{"front":"word/phrase in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic hint or empty","category":"vocabulary|sentence|street|home|basics|urlaub"}]
Use natural, modern, useful language. Mix single words and short phrases. Vary difficulty. No duplicates.`,
      }],
    }),
  })
  const data = await res.json()
  const raw = (data.content?.[0]?.text || '').trim()
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []
  try {
    return JSON.parse(match[0]).slice(0, 20)
  } catch { return [] }
}

async function writePoolToFirestore(fromLang, toLang, cards, weekStr) {
  const langPair = `${fromLang}_${toLang}`
  const docPath = `${FIRESTORE_BASE}/sharedCards/${langPair}_${weekStr}`
  const fields = {
    fromLang: { stringValue: fromLang },
    toLang: { stringValue: toLang },
    weekStr: { stringValue: weekStr },
    generatedAt: { stringValue: new Date().toISOString() },
    cards: {
      arrayValue: {
        values: cards.map(c => ({
          mapValue: {
            fields: {
              id: { stringValue: `pool_${weekStr}_${fromLang}_${toLang}_${Math.random().toString(36).slice(2, 8)}` },
              front: { stringValue: c.front || '' },
              back: { stringValue: c.back || '' },
              pronunciation: { stringValue: c.pronunciation || '' },
              category: { stringValue: c.category || 'vocabulary' },
              langA: { stringValue: fromLang },
              langB: { stringValue: toLang },
              source: { stringValue: 'weekly-pool' },
              createdAt: { integerValue: Date.now().toString() },
            }
          }
        }))
      }
    }
  }

  await fetch(`${docPath}?updateMask.fieldPaths=fromLang&updateMask.fieldPaths=toLang&updateMask.fieldPaths=weekStr&updateMask.fieldPaths=generatedAt&updateMask.fieldPaths=cards`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
}

function getISOWeekStr(d = new Date()) {
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
  const diff = d - startOfWeek1
  const week = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

export default async function handler(req, res) {
  // Allow GET (cron) or POST (manual trigger)
  const LANG_PAIRS = [
    { from: 'de', to: 'en' },
    { from: 'en', to: 'de' },
    { from: 'de', to: 'sw' },
    { from: 'en', to: 'sw' },
  ]

  const weekStr = getISOWeekStr()
  const topic = CARD_TOPICS[new Date().getDay() % CARD_TOPICS.length]
  const results = []

  for (const { from, to } of LANG_PAIRS) {
    try {
      const cards = await generateCards(from, to, topic)
      if (cards.length > 0) {
        await writePoolToFirestore(from, to, cards, weekStr)
        results.push({ pair: `${from}→${to}`, count: cards.length })
      }
    } catch (e) {
      results.push({ pair: `${from}→${to}`, error: e.message })
    }
  }

  res.status(200).json({ week: weekStr, topic, results })
}
