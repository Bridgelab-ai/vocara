// Base pool generator — POST /api/generate-base-pool
// Generates Grundlagen Level 4 + vocab_emotions cards for all 6 language pairs
// Levels 1-3 already generated; this run adds Level 4 + emotions focus vocab
import { POOL_STRUCTURE, LANGUAGE_PAIRS, getRarity, markImportant } from './_poolStructure.js'
export const config = { api: { bodyParser: false } }

const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili', fr: 'French', es: 'Spanish', th: 'Thai' }
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/vocara-ca2b7/databases/(default)/documents'

const LANG_PAIRS = LANGUAGE_PAIRS.map(p => { const [from, to] = p.split('_'); return { from, to } })

const LEVEL_CONTENT = {
  1: (fromName, toName) =>
    `Generate exactly 20 Level 1 Grundlagen flashcards for a ${fromName} speaker learning ${toName}.
Single words only: numbers 1-10, basic colors (red/blue/green/yellow/black/white/orange/purple/brown/pink), personal pronouns (I/you/he/she/it/we/they). Exactly 20 unique words.
All ${fromName} fronts, all ${toName} backs. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"word in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","category":"grundlagen","level":1,"wordType":"number|color|pronoun","tense":"present","hint":"for pronouns only: disambiguation e.g. sie = she / they / Sie (formal)"}]`,

  2: (fromName, toName) =>
    `Generate exactly 20 Level 2 Grundlagen flashcards for a ${fromName} speaker learning ${toName}.
Single words only: greetings (hello/goodbye/good morning/good evening/good night), politeness words (thank you/please/excuse me/sorry/yes/no/you're welcome/of course/no problem). Exactly 20 unique words.
All ${fromName} fronts, all ${toName} backs. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"word in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","category":"grundlagen","level":2,"wordType":"greeting|phrase","tense":"present"}]`,

  3: (fromName, toName) =>
    `Generate exactly 20 Level 3 Grundlagen flashcards for a ${fromName} speaker learning ${toName}.
Single words only: family members (mother/father/sister/brother/grandmother/grandfather/son/daughter/baby/aunt/uncle/cousin/husband/wife), body parts (head/hand/foot/eye/ear/nose/mouth/heart/back/leg). Exactly 20 unique words.
All ${fromName} fronts, all ${toName} backs. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"word in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","category":"grundlagen","level":3,"wordType":"noun","tense":"present"}]`,

  4: (fromName, toName) =>
    `Generate exactly 20 Level 4 Grundlagen flashcards for a ${fromName} speaker learning ${toName}.
Single words only: numbers 11-100 (eleven/twenty/thirty/forty/fifty/sixty/seventy/eighty/ninety/hundred), days of week, months January-June. Exactly 20 unique words.
All ${fromName} fronts, all ${toName} backs. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"word in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","category":"grundlagen","level":4,"wordType":"number|day|month","tense":"present"}]`,

  5: (fromName, toName) =>
    `Generate exactly 20 Level 5 Grundlagen flashcards for a ${fromName} speaker learning ${toName}.
Single words only — essential verbs in infinitive: to be/to have/to go/to come/to make/to say/to see/to want/to can/to must/to give/to take/to know/to think/to like/to need/to work/to live/to eat/to drink. Exactly 20 unique verbs.
All ${fromName} fronts, all ${toName} backs. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"verb in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","category":"grundlagen","level":5,"wordType":"verb","tense":"present"}]`,

  6: (fromName, toName) =>
    `Generate exactly 20 Level 6 Grundlagen flashcards for a ${fromName} speaker learning ${toName}.
Single words only: food and drinks (water/bread/milk/meat/fruit/vegetable/coffee/tea/rice/egg/sugar/salt/fish/chicken/soup), animals (dog/cat/bird/horse/cow/elephant/lion/monkey/rabbit/snake). Exactly 20 unique words.
All ${fromName} fronts, all ${toName} backs. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"word in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","category":"grundlagen","level":6,"wordType":"noun","tense":"present"}]`,

  7: (fromName, toName) =>
    `Generate exactly 20 Level 7 Grundlagen flashcards for a ${fromName} speaker learning ${toName}.
Single words only: places (house/school/market/city/hospital/church/beach/forest/airport/station/park/hotel/restaurant/bank/pharmacy), directions (left/right/straight/near/far). Exactly 20 unique words.
All ${fromName} fronts, all ${toName} backs. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"word in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","category":"grundlagen","level":7,"wordType":"noun|adverb","tense":"present"}]`,

  8: (fromName, toName) =>
    `Generate exactly 20 Level 8 Grundlagen flashcards for a ${fromName} speaker learning ${toName}.
Single words only: time expressions (today/yesterday/tomorrow/now/later/always/never/sometimes/soon/already/still/again/before/after/during/early/late/every day/last week/next year). Exactly 20 unique words or short phrases.
All ${fromName} fronts, all ${toName} backs. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"word/phrase in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","category":"grundlagen","level":8,"wordType":"adverb|phrase","tense":"present"}]`,

  9: (fromName, toName) =>
    `Generate exactly 20 Level 9 Grundlagen flashcards for a ${fromName} speaker learning ${toName}.
Single words only: feelings (happy/sad/tired/hungry/thirsty/angry/scared/surprised/bored/sick/excited/nervous/proud/lonely/confused), weather (sun/rain/wind/snow/hot/cold/cloudy/storm/warm/fog). Exactly 20 unique words.
All ${fromName} fronts, all ${toName} backs. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"word in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","category":"grundlagen","level":9,"wordType":"adjective|noun","tense":"present"}]`,

  10: (fromName, toName) =>
    `Generate exactly 20 Level 10 Grundlagen flashcards for a ${fromName} speaker learning ${toName}.
Single words only: question words (who/what/where/when/how/why/which/how much/how many/how long/how often/how far), basic adjectives (big/small/good/bad/new/old/fast/slow/beautiful/ugly/clean/dirty). Exactly 20 unique words.
All ${fromName} fronts, all ${toName} backs. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"word in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","category":"grundlagen","level":10,"wordType":"question|adjective","tense":"present"}]`,
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
      max_tokens: 6000,
      system: 'You are a professional language educator creating flashcards for language learners from absolute beginner to fluent. Generate ONLY the requested content type — single words or short phrases, never full sentences unless explicitly required. Every card must be unique — never repeat a word already in this level. Return ONLY valid JSON array, no markdown, no explanation.\nQUALITY RULES: All words must be natural, correct language as used by native speakers. Never invent words or use incorrect forms (e.g. "Danke viel" is wrong, use "Danke sehr" or "Vielen Dank"). Double-check every translation for accuracy. Verbs in English always with "to": "to read", "to write". Each card must be unique — no duplicate translations within one level.',
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  const raw = (data.content?.[0]?.text || '').trim()
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []
  try { return JSON.parse(match[0]).slice(0, POOL_STRUCTURE.grundlagen.cardsPerLevel) } catch { return [] }
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
              back: { stringValue: c?.back || '' },
              pronunciation: { stringValue: c.pronunciation || '' },
              category: { stringValue: 'grundlagen' },
              level: { integerValue: String(level) },
              tense: { stringValue: 'present' },
              wordType: { stringValue: c.wordType || '' },
              langA: { stringValue: fromLang },
              langB: { stringValue: toLang },
              source: { stringValue: 'base-pool' },
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
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 4000, system: 'You are a professional language educator. Return ONLY valid JSON array, no markdown.', messages: [{ role: 'user', content: prompt }] }),
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
      front: { stringValue: c.front || '' }, back: { stringValue: c?.back || '' },
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  // Accept body: { level: 4|5 } or { type: 'vocab_emotions' } to run one task at a time
  let body = {}
  try { const chunks = []; for await (const chunk of req) chunks.push(chunk); body = JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch {}
  const results = []

  if (body.type === 'vocab_emotions') {
    for (const { from, to } of LANG_PAIRS) {
      try {
        const cards = await generateVocabEmotions(from, to)
        if (cards.length > 0) { await writeVocabEmotions(from, to, cards); results.push({ pair: `${from}→${to}`, type: 'vocab_emotions', count: cards.length }) }
        else results.push({ pair: `${from}→${to}`, type: 'vocab_emotions', error: 'No cards generated' })
      } catch (e) { results.push({ pair: `${from}→${to}`, type: 'vocab_emotions', error: e.message }) }
    }
  } else {
    const level = Math.min(POOL_STRUCTURE.grundlagen.totalLevels, Math.max(1, body.level || 5))
    const pairsToRun = body.pair
      ? LANG_PAIRS.filter(p => `${p.from}_${p.to}` === body.pair)
      : LANG_PAIRS
    for (const { from, to } of pairsToRun) {
      try {
        const cards = await generateCards(from, to, level)
        if (cards.length > 0) { await writeToFirestore(from, to, level, cards); results.push({ pair: `${from}→${to}`, level, count: cards.length }) }
        else results.push({ pair: `${from}→${to}`, level, error: 'No cards generated' })
      } catch (e) { results.push({ pair: `${from}→${to}`, level, error: e.message }) }
    }
  }
  res.status(200).json({ generated: results, total: results.filter(r => r.count).reduce((s, r) => s + r.count, 0) })
}
