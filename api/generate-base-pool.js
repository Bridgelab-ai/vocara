// Base pool generator — POST /api/generate-base-pool
// Generates Grundlagen Level 4 + vocab_emotions cards for all 6 language pairs
// Levels 1-3 already generated; this run adds Level 4 + emotions focus vocab
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

  4: (fromName, toName) =>
    `Generate exactly 30 Level 4 Grundlagen flashcards for a ${fromName} speaker learning ${toName}.
Cover in this order:
- Connecting/subordinating conjunctions with example short sentences (10 cards): but (aber), because (weil), although (obwohl), nevertheless (trotzdem), so that (damit), while (während), if (wenn), since (seit/da), before (bevor), after (nachdem)
- Common compound words broken into parts with meaning (10 cards): e.g. Handtuch = Hand+Tuch = hand+cloth = towel; Flugzeug, Krankenhaus, Kühlschrank, Jahreszeit, Hausaufgabe, Fahrkarte, Briefkasten, Reisepass, Schreibtisch, Erdgeschoss
- Useful B1-level phrases for expressing opinion/agreement (10 cards): I think that, in my opinion, I agree, I disagree, on the one hand, on the other hand, it depends, generally speaking, as far as I know, to be honest
All ${fromName} fronts, all ${toName} backs. 100% accurate. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"word/phrase in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic for ${toName}","category":"grundlagen","level":4,"wordType":"conjunction|compound|phrase","tense":"present"}]`,
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

async function generateVocabEmotions(fromLang, toLang) {
  const fromName = LANG_NAMES[fromLang] || fromLang
  const toName = LANG_NAMES[toLang] || toLang
  const prompt = `Generate exactly 30 emotion and feeling flashcards for a ${fromName} speaker learning ${toName}.
Focus on nuanced feelings beyond basics: nostalgia, melancholy, serenity, anticipation, relief, irritation, embarrassment, pride, guilt, shame, longing, enthusiasm, frustration, contentment, anxiety, grief, awe, envy, gratitude, resentment, compassion, excitement, boredom, confusion, overwhelmed, nervous, confident, vulnerable, restless, peaceful.
All ${fromName} fronts, all ${toName} backs. 100% accurate and natural. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"word in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic for ${toName}","category":"vocabulary","level":1,"wordType":"adjective","tense":"present","register":"neutral"}]`
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 3000, system: 'You are a professional language educator. Return ONLY valid JSON array, no markdown.', messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await res.json()
  const raw = (data.content?.[0]?.text || '').trim()
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []
  try { return JSON.parse(match[0]).slice(0, 30) } catch { return [] }
}

async function writeVocabEmotions(fromLang, toLang, cards) {
  const docPath = `${FIRESTORE_BASE}/sharedCards/${fromLang}_${toLang}_vocab_emotions`
  const fields = {
    fromLang: { stringValue: fromLang }, toLang: { stringValue: toLang },
    category: { stringValue: 'vocabulary' }, generatedAt: { stringValue: new Date().toISOString() },
    count: { integerValue: String(cards.length) },
    cards: { arrayValue: { values: cards.map(c => ({ mapValue: { fields: {
      id: { stringValue: `emotion_${fromLang}_${toLang}_${Math.random().toString(36).slice(2,8)}` },
      front: { stringValue: c.front || '' }, back: { stringValue: c.back || '' },
      pronunciation: { stringValue: c.pronunciation || '' }, category: { stringValue: 'vocabulary' },
      wordType: { stringValue: 'adjective' }, level: { integerValue: '1' }, tense: { stringValue: 'present' },
      register: { stringValue: 'neutral' }, langA: { stringValue: fromLang }, langB: { stringValue: toLang },
      source: { stringValue: 'emotions-pool' }, vocabCategory: { stringValue: 'emotions' },
      createdAt: { integerValue: Date.now().toString() },
    } } })) } },
  }
  const mask = ['fromLang','toLang','category','generatedAt','count','cards'].map(f=>`updateMask.fieldPaths=${f}`).join('&')
  const r = await fetch(`${docPath}?${mask}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) })
  if (!r.ok) throw new Error(`Firestore write failed: ${r.status}`)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' })
  }
  const results = []
  // Generate Level 4 (levels 1-3 already exist) — parallelize pairs per level
  for (const level of [4]) {
    const levelResults = await Promise.all(LANG_PAIRS.map(async ({ from, to }) => {
      try {
        const cards = await generateCards(from, to, level)
        if (cards.length > 0) {
          await writeToFirestore(from, to, level, cards)
          return { pair: `${from}→${to}`, level, count: cards.length }
        }
        return { pair: `${from}→${to}`, level, error: 'No cards generated' }
      } catch (e) {
        return { pair: `${from}→${to}`, level, error: e.message }
      }
    }))
    results.push(...levelResults)
  }
  // Generate vocab_emotions for all pairs (parallelized)
  const emotionResults = await Promise.all(LANG_PAIRS.map(async ({ from, to }) => {
    try {
      const cards = await generateVocabEmotions(from, to)
      if (cards.length > 0) {
        await writeVocabEmotions(from, to, cards)
        return { pair: `${from}→${to}`, type: 'vocab_emotions', count: cards.length }
      }
      return { pair: `${from}→${to}`, type: 'vocab_emotions', error: 'No cards generated' }
    } catch (e) {
      return { pair: `${from}→${to}`, type: 'vocab_emotions', error: e.message }
    }
  }))
  results.push(...emotionResults)
  res.status(200).json({ generated: results, total: results.filter(r => r.count).reduce((s, r) => s + r.count, 0) })
}
