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
  1: (fromName, toName) =>
    `Generate exactly 50 Level 1 Grundlagen flashcards for a ${fromName} speaker learning ${toName}.
Cover in this order:
- Numbers 1-10: one, two, three, four, five, six, seven, eight, nine, ten (10 cards)
- Basic greetings: hello, goodbye, good morning, good evening, good night, thank you, please, sorry, yes, no (10 cards)
- Colors: red, blue, green, yellow, white, black, orange, purple, pink, brown (10 cards)
- Family members: mother, father, brother, sister, grandmother, grandfather, son, daughter, husband, wife (10 cards)
- Basic classroom words: book, pen, table, chair, door, window, teacher, student, school, word (10 cards)
All ${fromName} fronts, all ${toName} backs. 100% accurate. Include phonetic pronunciation for the ${toName} word.
Return ONLY a valid JSON array (no markdown):
[{"front":"word in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic for ${toName}","category":"grundlagen","level":1,"wordType":"number|greeting|color|family|noun","tense":"present"}]`,

  2: (fromName, toName) =>
    `Generate exactly 50 Level 2 Grundlagen flashcards for a ${fromName} speaker learning ${toName}.
Cover in this order:
- Numbers 11-100: eleven, twelve, thirteen, twenty, thirty, forty, fifty, sixty, seventy, eighty, hundred (11 cards)
- Days of the week: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday (7 cards)
- Months: January, February, March, April, May, June, July, August, September, October, November, December (12 cards)
- Personal pronouns: I, you, he, she, we, you(plural), they (7 cards — use the ${toName} equivalents)
- Basic verbs in present tense: to be, to have, to go, to come, to eat, to drink, to see, to want, to know, to need, to like, to say, to make (13 cards)
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
    `Generate exactly 20 Level 4 Grundlagen flashcards (A2+) for a ${fromName} speaker learning ${toName}.
Cover these 3 groups:
1. Modal verbs (8 cards): can/können, must/müssen, may/dürfen, should/sollen, want/wollen, like/mögen, need to/brauchen zu, be allowed to/dürfen — use the natural ${toName} equivalent with a short example sentence as front
2. Comparative & superlative (6 cards): bigger/größer, smaller/kleiner, faster/schneller, better/besser, worse/schlechter, more expensive/teurer — front in ${fromName}, back in ${toName}
3. Time expressions (6 cards): yesterday/gestern, tomorrow/morgen, soon/bald, already/schon, still/noch, sometimes/manchmal — front in ${fromName}, back in ${toName}
All ${fromName} fronts, all ${toName} backs. 100% accurate. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"short phrase in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","category":"grundlagen","level":4,"wordType":"modal|adjective|adverb","tense":"present"}]`,

  5: (fromName, toName) =>
    `Generate exactly 20 Level 5 Grundlagen flashcards (B1) for a ${fromName} speaker learning ${toName}.
Cover these 3 groups:
1. Subordinating conjunctions (7 cards): because/weil, although/obwohl, so that/damit, while/während, if/wenn, after/nachdem, as soon as/sobald — give the ${toName} conjunction with a short example
2. Common B1 connectors & discourse markers (7 cards): moreover/außerdem, nevertheless/trotzdem, therefore/deswegen, on the other hand/andererseits, firstly/zunächst, finally/schließlich, overall/insgesamt
3. Everyday B1 phrases (6 cards): that depends/das kommt darauf an, I mean/ich meine, in my opinion/meiner Meinung nach, you're right/du hast recht, I'm not sure/ich bin nicht sicher, that makes sense/das macht Sinn
All ${fromName} fronts, all ${toName} backs. 100% accurate. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"phrase in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic for ${toName}","category":"grundlagen","level":5,"wordType":"conjunction|phrase","tense":"present"}]`,

  6: (fromName, toName) =>
    `Generate exactly 20 Level 6 Grundlagen flashcards (B1+) for a ${fromName} speaker learning ${toName}.
Cover these 3 groups:
1. Passive voice constructions (7 cards): is being built/wird gebaut, was done/wurde gemacht, it is said/es wird gesagt, has been found/wurde gefunden, is known/ist bekannt, will be opened/wird geöffnet, can be seen/kann gesehen werden — give the ${toName} passive phrase and its ${fromName} meaning
2. Relative clause starters (6 cards): the man who/der Mann, der; the woman who/die Frau, die; the thing that/das Ding, das; the people who/die Leute, die; the reason why/der Grund, warum; the day when/der Tag, als
3. Common idioms (7 cards): to keep fingers crossed/Daumen drücken, to get to the point/auf den Punkt kommen, to hit the nail on the head/ins Schwarze treffen, to be on the same page/einer Meinung sein, to cost an arm and a leg/ein Vermögen kosten, once in a blue moon/alle Jubeljahre, to break the ice/das Eis brechen
All ${fromName} fronts, all ${toName} backs. 100% accurate. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"phrase in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic for ${toName}","category":"grundlagen","level":6,"wordType":"phrase|idiom","tense":"present"}]`,

  7: (fromName, toName) =>
    `Generate exactly 20 Level 7 Grundlagen flashcards (B1-B2 intermediate-upper) for a ${fromName} speaker learning ${toName}.
Focus on: passive constructions, reported speech markers (he said that.../she asked whether...), complex sentence connectors (not only...but also, either...or, neither...nor, as soon as, as long as), expressing cause and effect.
All ${fromName} fronts, all ${toName} backs. 100% accurate. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"phrase in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic for ${toName}","category":"grundlagen","level":7,"wordType":"phrase","tense":"present"}]`,

  8: (fromName, toName) =>
    `Generate exactly 20 Level 8 Grundlagen flashcards (B2 upper-intermediate) for a ${fromName} speaker learning ${toName}.
Focus on: subjunctive/conditional mood (if I were.../I wish.../it would be better if...), expressing regret and wishes about past events, formal versus informal register switching, nuanced ways to agree/disagree/express doubt.
All ${fromName} fronts, all ${toName} backs. 100% accurate. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"phrase in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic for ${toName}","category":"grundlagen","level":8,"wordType":"phrase","tense":"present"}]`,

  9: (fromName, toName) =>
    `Generate exactly 20 Level 9 Grundlagen flashcards (B2-C1 advanced) for a ${fromName} speaker learning ${toName}.
Focus on: expressing nuanced emotions and states (I tend to.../I can't help but.../I'm inclined to.../I can't stand.../it occurs to me that...), academic discourse markers, phrases for presenting arguments, conceding points, and building complex reasoning.
All ${fromName} fronts, all ${toName} backs. 100% accurate. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"phrase in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic for ${toName}","category":"grundlagen","level":9,"wordType":"phrase","tense":"present"}]`,

  10: (fromName, toName) =>
    `Generate exactly 20 Level 10 Grundlagen flashcards (C1 advanced) for a ${fromName} speaker learning ${toName}.
Focus on: sophisticated register variation (formal/informal/literary), complex participial phrases, literary and elevated vocabulary that educated native speakers use naturally, subtle pragmatic markers that control tone and attitude in discourse.
All ${fromName} fronts, all ${toName} backs. 100% accurate. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"phrase in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic for ${toName}","category":"grundlagen","level":10,"wordType":"phrase","tense":"present"}]`,
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
      system: 'You are a professional language educator. Generate accurate beginner flashcards. Return ONLY valid JSON array, no markdown.',
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  const raw = (data.content?.[0]?.text || '').trim()
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []
  try { return JSON.parse(match[0]).slice(0, 50) } catch { return [] }
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
    const level = body.level || 5
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
