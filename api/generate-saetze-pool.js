// Saetze pool generator — POST /api/generate-saetze-pool
// Generates sentence flashcards (category: 'saetze') for all 6 language pairs
import { POOL_STRUCTURE, LANGUAGE_PAIRS, getRarity, markImportant } from './_poolStructure.js'
export const config = { api: { bodyParser: false } }

const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili', fr: 'French', es: 'Spanish', th: 'Thai' }
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/vocara-ca2b7/databases/(default)/documents'

const LANG_PAIRS = LANGUAGE_PAIRS.map(p => { const [from, to] = p.split('_'); return { from, to } })

const LEVEL_CONTENT = {
  1: (fromName, toName) =>
    `Generate exactly 20 Level 1 Saetze flashcards for a ${fromName} speaker learning ${toName}.
20 unique sentences using ONLY subject + am/is/are/have/has. Max 3 words each. Examples: I am happy. She has water. We are here.
All ${fromName} fronts, all ${toName} backs. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"sentence in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","category":"saetze","level":1,"wordType":"phrase","tense":"present"}]`,

  2: (fromName, toName) =>
    `Generate exactly 20 Level 2 Saetze flashcards for a ${fromName} speaker learning ${toName}.
20 unique sentences: subject + verb + object. Max 4 words. Use only basic vocabulary (numbers/colors/family/food/animals). Examples: I see the dog. We have bread. She wants water.
All ${fromName} fronts, all ${toName} backs. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"sentence in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","category":"saetze","level":2,"wordType":"phrase","tense":"present"}]`,

  3: (fromName, toName) =>
    `Generate exactly 20 Level 3 Saetze flashcards for a ${fromName} speaker learning ${toName}.
20 unique sentences with negation (not/no/never). Max 5 words. Examples: I have no water. He does not go. She never sleeps.
All ${fromName} fronts, all ${toName} backs. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"sentence in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","category":"saetze","level":3,"wordType":"phrase","tense":"present"}]`,

  4: (fromName, toName) =>
    `Generate exactly 20 Level 4 Saetze flashcards for a ${fromName} speaker learning ${toName}.
20 unique question sentences using who/what/where/when/how. Max 5 words. Examples: Where is the house? What do you see? Who has bread?
All ${fromName} fronts, all ${toName} backs. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"sentence in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","category":"saetze","level":4,"wordType":"question","tense":"present"}]`,

  5: (fromName, toName) =>
    `Generate exactly 20 Level 5 Saetze flashcards for a ${fromName} speaker learning ${toName}.
20 unique sentences with prepositions (in/at/on/from/to/with). Max 6 words. Examples: I am in the school. She comes from the city. He is at home.
All ${fromName} fronts, all ${toName} backs. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"sentence in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","category":"saetze","level":5,"wordType":"phrase","tense":"present"}]`,

  6: (fromName, toName) =>
    `Generate exactly 20 Level 6 Saetze flashcards for a ${fromName} speaker learning ${toName}.
20 unique sentences with time expressions (today/yesterday/tomorrow/now/later/always/never). Max 6 words. Examples: Today I go to school. Yesterday she was tired. We always eat bread.
All ${fromName} fronts, all ${toName} backs. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"sentence in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","category":"saetze","level":6,"wordType":"phrase","tense":"present"}]`,

  7: (fromName, toName) =>
    `Generate exactly 20 Level 7 Saetze flashcards for a ${fromName} speaker learning ${toName}.
20 unique past tense sentences (was/were/had/went/came/made). Max 7 words. Examples: I was tired yesterday. She had no money. We went to the market.
All ${fromName} fronts, all ${toName} backs. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"sentence in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","category":"saetze","level":7,"wordType":"phrase","tense":"past"}]`,

  8: (fromName, toName) =>
    `Generate exactly 20 Level 8 Saetze flashcards for a ${fromName} speaker learning ${toName}.
20 unique future and wish sentences (want to/would like to/will/going to). Max 7 words. Examples: I want to go home. She would like water. We will come tomorrow.
All ${fromName} fronts, all ${toName} backs. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"sentence in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","category":"saetze","level":8,"wordType":"phrase","tense":"future"}]`,

  9: (fromName, toName) =>
    `Generate exactly 20 Level 9 Saetze flashcards for a ${fromName} speaker learning ${toName}.
20 unique compound sentences joined by and/but/because/so. Max 10 words. Examples: I am tired but I go. She is happy because she has bread. He wants to eat so he goes to the market.
All ${fromName} fronts, all ${toName} backs. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"sentence in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","category":"saetze","level":9,"wordType":"phrase","tense":"present"}]`,

  10: (fromName, toName) =>
    `Generate exactly 20 Level 10 Saetze flashcards for a ${fromName} speaker learning ${toName}.
20 unique polite and complex everyday sentences. Max 12 words. Examples: Can you please help me? I would like to know where the station is. Could you tell me what time it is?
All ${fromName} fronts, all ${toName} backs. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"sentence in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","category":"saetze","level":10,"wordType":"phrase","tense":"present"}]`,
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
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: 'You are a language educator creating sentence flashcards. Each card must be a complete simple sentence built exclusively from basic vocabulary (numbers, colors, pronouns, greetings, family, body parts, basic verbs, food, animals, places, time, feelings). Sentences must be natural and used in everyday life. Every sentence must be unique. Return ONLY valid JSON array, no markdown.',
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  const raw = (data.content?.[0]?.text || '').trim()
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []
  try { return JSON.parse(match[0]).slice(0, POOL_STRUCTURE.saetze.cardsPerLevel) } catch { return [] }
}

async function writeToFirestore(fromLang, toLang, level, cards) {
  const langPair = `${fromLang}_${toLang}`
  const docPath = `${FIRESTORE_BASE}/sharedCards/${langPair}_saetze_${level}`
  const fields = {
    fromLang: { stringValue: fromLang },
    toLang: { stringValue: toLang },
    level: { integerValue: String(level) },
    category: { stringValue: 'saetze' },
    generatedAt: { stringValue: new Date().toISOString() },
    cards: {
      arrayValue: {
        values: cards.map(c => ({
          mapValue: {
            fields: {
              id: { stringValue: `saetze_${level}_${fromLang}_${toLang}_${Math.random().toString(36).slice(2, 8)}` },
              front: { stringValue: c.front || '' },
              back: { stringValue: c?.back || '' },
              pronunciation: { stringValue: c.pronunciation || '' },
              category: { stringValue: 'saetze' },
              level: { integerValue: String(level) },
              tense: { stringValue: c.tense || 'present' },
              wordType: { stringValue: c.wordType || 'phrase' },
              langA: { stringValue: fromLang },
              langB: { stringValue: toLang },
              source: { stringValue: 'saetze-pool' },
              rarity: { stringValue: getRarity(level) },
              important: { booleanValue: markImportant(level) },
              createdAt: { integerValue: Date.now().toString() },
            }
          }
        }))
      }
    },
    count: { integerValue: String(cards.length) },
  }
  const mask = ['fromLang','toLang','level','category','generatedAt','count','cards']
    .map(f => `updateMask.fieldPaths=${f}`).join('&')
  await fetch(`${docPath}?${mask}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  let body = {}
  try { const chunks = []; for await (const chunk of req) chunks.push(chunk); body = JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch {}
  console.log('[SAETZE-POOL] called with body:', JSON.stringify(body))
  try {
    const results = []
    const level = Math.min(POOL_STRUCTURE.saetze.totalLevels, Math.max(1, body.level || 1))
    const pairsToRun = body.pair
      ? LANG_PAIRS.filter(p => `${p.from}_${p.to}` === body.pair)
      : LANG_PAIRS
    for (const { from, to } of pairsToRun) {
      try {
        const cards = await generateCards(from, to, level)
        if (cards.length > 0) {
          await writeToFirestore(from, to, level, cards)
          results.push({ pair: `${from}→${to}`, level, count: cards.length })
        } else {
          results.push({ pair: `${from}→${to}`, level, error: 'No cards generated' })
        }
      } catch (e) { results.push({ pair: `${from}→${to}`, level, error: e.message }) }
    }
    res.status(200).json({ generated: results, total: results.filter(r => r.count).reduce((s, r) => s + r.count, 0) })
  } catch (err) {
    console.error('[SAETZE-POOL FATAL]', err.message, err.stack)
    return res.status(500).json({ error: err.message })
  }
}
