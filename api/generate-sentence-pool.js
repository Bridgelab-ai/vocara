// Sentence pool generator — POST /api/generate-sentence-pool
// Generates 50 exercises per level (1-3) for 3 language pairs = 450 total
export const config = { api: { bodyParser: false } }

const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili' }
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/vocara-ca2b7/databases/(default)/documents'

const PAIRS = [
  { from: 'de', to: 'en' },
  { from: 'en', to: 'de' },
  { from: 'de', to: 'sw' },
]

const LEVEL_SPEC = {
  1: {
    vocab: 'colors (rot/red/nyekundu, blau/blue/bluu, grün/green/kijani), numbers 1-10, basic greetings (Hallo/Danke/Bitte), basic shapes (Kreis/circle/duara, Quadrat/square/mraba)',
    grammar: 'simple present, basic subject-verb, "to be" forms, basic nouns and adjectives',
  },
  2: {
    vocab: 'numbers 11-100, days of week (Montag/Monday/Jumatatu), months (Januar/January/Januari), pronouns (ich/I/mimi, du/you/wewe, er/he/yeye, sie/she/yeye, wir/we/sisi), verbs (sein/be/kuwa, haben/have/kuwa na, gehen/go/kwenda, kommen/come/kuja)',
    grammar: 'present tense conjugation, simple sentences with pronouns, have/be constructions',
  },
  3: {
    vocab: 'common nouns (Tisch/table/meza, Haus/house/nyumba, Auto/car/gari, Wasser/water/maji, Essen/food/chakula, Zeit/time/wakati, Tag/day/siku, Jahr/year/mwaka), adjectives (groß/big/kubwa, klein/small/ndogo, gut/good/nzuri, neu/new/mpya), question words (wer/who/nani, was/what/nini, wo/where/wapi, wann/when/lini, warum/why/kwa nini, wie/how/jinsi gani)',
    grammar: 'question formation, adjective agreement, past tense introduction, common sentence patterns',
  },
}

async function generateBatch(fromLang, toLang, level, batchSize = 25) {
  const fromName = LANG_NAMES[fromLang]
  const toName = LANG_NAMES[toLang]
  const spec = LEVEL_SPEC[level]

  const prompt = `Generate exactly ${batchSize} sentence exercises for a ${fromName} speaker learning ${toName}.
Level ${level} vocabulary focus: ${spec.vocab}.
Grammar focus: ${spec.grammar}.

Mix all 5 types (about ${Math.floor(batchSize/5)} each):
- gap: fill-in-the-blank (question has [___] placeholder)
- order: arrange word chips into correct sentence
- tense: convert sentence to different tense
- conjugation: conjugate given verb+pronoun
- translation: translate full sentence

Rules:
- All questions, hints, explanations MUST be in ${fromName}
- All answers MUST be in ${toName}
- Use ONLY Level ${level} vocabulary listed above
- Keep sentences short (max 7 words)
- For "order" type, put shuffled words in "chips" array

Return ONLY a valid JSON array, no markdown:
[
  {"type":"gap","question":"${fromName === 'German' ? 'Sie [___] Lehrerin.' : fromName === 'English' ? 'She [___] a teacher.' : 'Yeye [___] mwalimu.'}","answer":"${toName === 'English' ? 'is' : toName === 'German' ? 'ist' : 'ni'}","hint":"3. Person Singular von sein","explanation":"'${toName === 'English' ? 'is' : toName === 'German' ? 'ist' : 'ni'}' ist die 3. Person Singular."},
  {"type":"order","question":"Ordne die Wörter:","chips":["${toName === 'English' ? 'I' : toName === 'German' ? 'Ich' : 'Mimi'}","${toName === 'English' ? 'am' : toName === 'German' ? 'bin' : 'ni'}","${toName === 'English' ? 'happy' : toName === 'German' ? 'glücklich' : 'mfurahi'}"],"answer":"${toName === 'English' ? 'I am happy.' : toName === 'German' ? 'Ich bin glücklich.' : 'Mimi ni mfurahi.'}","explanation":"Satzstellung: Subjekt + Verb + Adjektiv."},
  {"type":"translation","question":"Übersetze: '${fromName === 'German' ? 'Das Haus ist groß.' : fromName === 'English' ? 'The house is big.' : 'Nyumba ni kubwa.'}'","answer":"${toName === 'English' ? 'The house is big.' : toName === 'German' ? 'Das Haus ist groß.' : 'Nyumba ni kubwa.'}","hint":"Adjektiv nach 'ist'","explanation":"Das Adjektiv folgt dem Verb 'to be'."}
]`

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
      system: 'You are a language education expert. Generate high-quality grammar exercises. Return ONLY a valid JSON array with no markdown fences.',
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  const raw = (data.content?.[0]?.text || '').trim()
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []
  try { return JSON.parse(match[0]).slice(0, batchSize) } catch { return [] }
}

function exToFirestoreMap(ex) {
  const fields = {
    type: { stringValue: ex.type || 'gap' },
    question: { stringValue: ex.question || '' },
    answer: { stringValue: ex.answer || '' },
    hint: { stringValue: ex.hint || '' },
    explanation: { stringValue: ex.explanation || '' },
  }
  if (Array.isArray(ex.chips) && ex.chips.length > 0) {
    fields.chips = { arrayValue: { values: ex.chips.map(c => ({ stringValue: String(c) })) } }
  }
  return { mapValue: { fields } }
}

async function writePool(fromLang, toLang, level, exercises) {
  const docId = `${fromLang}_${toLang}_level${level}`
  const docPath = `${FIRESTORE_BASE}/sharedSentences/${docId}`
  const fields = {
    fromLang: { stringValue: fromLang },
    toLang: { stringValue: toLang },
    level: { integerValue: String(level) },
    generatedAt: { stringValue: new Date().toISOString() },
    count: { integerValue: String(exercises.length) },
    exercises: { arrayValue: { values: exercises.map(exToFirestoreMap) } },
  }
  const mask = ['fromLang', 'toLang', 'level', 'generatedAt', 'count', 'exercises']
    .map(f => `updateMask.fieldPaths=${f}`).join('&')
  const r = await fetch(`${docPath}?${mask}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!r.ok) throw new Error(`Firestore write failed: ${r.status}`)
}

// ── SENTENCE FLASHCARD POOL (sharedCards/{pair}_sentence_level{N}) ────────────

// 12-level difficulty spec for sentence flashcards
const SENTENCE_LEVEL_SPEC = {
  1:  { diff: 'A1: very simple present-tense sentences (5-7 words). Topics: greetings, basic needs, simple descriptions.' },
  2:  { diff: 'A1-A2: simple sentences about family, home, daily routine. May include basic questions.' },
  3:  { diff: 'A2: simple past and future, common daily life topics, basic opinions.' },
  4:  { diff: 'A2-B1: questions, commands, negatives. Shopping, travel basics, asking for help.' },
  5:  { diff: 'B1: work and school topics, expressing preferences and opinions, basic subordinate clauses.' },
  6:  { diff: 'B1: social small talk, expressing emotions, giving advice, making plans.' },
  7:  { diff: 'B1-B2: complex sentences with subordinates (because/when/although), travel and business contexts.' },
  8:  { diff: 'B2: indirect speech, formal register, nuanced opinions, abstract topics.' },
  9:  { diff: 'B2: idiomatic expressions in context, cultural references, complex negotiations.' },
  10: { diff: 'B2-C1: advanced discourse, precise vocabulary, academic and formal contexts.' },
  11: { diff: 'C1: near-native sentence structures, subtle pragmatic markers, elevated register.' },
  12: { diff: 'C1-C2: sophisticated literary/formal sentences, complex rhetoric, native-level fluency.' },
}

const FLASHCARD_THEMES = [
  { key: 'alltag', label: 'Alltag', theme: 'everyday situations: daily routines, shopping, weather, home life' },
  { key: 'reisen', label: 'Reisen', theme: 'travel: directions, booking, transport, sightseeing' },
  { key: 'arbeit', label: 'Arbeit', theme: 'work and professional life: meetings, tasks, colleagues' },
  { key: 'familie', label: 'Familie', theme: 'family and social life: relationships, home, celebrations' },
  { key: 'smalltalk', label: 'Smalltalk', theme: 'small talk: greetings, opinions, hobbies, polite phrases' },
]

async function generateFlashcardCategory(fromLang, toLang, cat, level = 1) {
  const fromName = LANG_NAMES[fromLang]
  const toName = LANG_NAMES[toLang]
  const spec = SENTENCE_LEVEL_SPEC[level] || SENTENCE_LEVEL_SPEC[1]
  const count = Math.ceil(33 / FLASHCARD_THEMES.length)
  const prompt = `Generate exactly ${count} natural sentence flashcards for a ${fromName} speaker learning ${toName}.
Level ${level}/12 — difficulty: ${spec.diff}
Category: ${cat.label} — theme: ${cat.theme}
Rules:
- front: sentence in ${fromName} (native language), difficulty appropriate for Level ${level}
- back: natural ${toName} translation (as a native speaker would say it)
- Vary structure: questions, statements, requests
Return ONLY a valid JSON array (no markdown):
[{"front":"sentence in ${fromName}","back":"sentence in ${toName}","vocabCategory":"${cat.key}"}]`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', max_tokens: 3000,
      system: 'You are a professional language teacher. Return ONLY valid JSON array, no markdown.',
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  const raw = (data.content?.[0]?.text || '').trim()
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []
  try { return JSON.parse(match[0]).slice(0, count) } catch { return [] }
}

async function processFlashcardPair(fromLang, toLang, level = 1) {
  const results = await Promise.all(FLASHCARD_THEMES.map(cat => generateFlashcardCategory(fromLang, toLang, cat, level)))
  return results.flat()
}

async function writeFlashcardPool(fromLang, toLang, level, cards) {
  const docPath = `${FIRESTORE_BASE}/sharedCards/${fromLang}_${toLang}_sentence_level${level}`
  const fields = {
    fromLang: { stringValue: fromLang }, toLang: { stringValue: toLang },
    category: { stringValue: 'sentence' }, level: { integerValue: String(level) },
    generatedAt: { stringValue: new Date().toISOString() },
    count: { integerValue: String(cards.length) },
    cards: {
      arrayValue: {
        values: cards.map(c => ({
          mapValue: {
            fields: {
              id: { stringValue: `sentence_l${level}_${fromLang}_${toLang}_${Math.random().toString(36).slice(2, 9)}` },
              front: { stringValue: c.front || '' }, back: { stringValue: c.back || '' },
              category: { stringValue: 'sentence' }, vocabCategory: { stringValue: c.vocabCategory || '' },
              level: { integerValue: String(level) }, langA: { stringValue: fromLang }, langB: { stringValue: toLang },
              source: { stringValue: 'sentence-pool' }, createdAt: { integerValue: Date.now().toString() },
            }
          }
        }))
      }
    }
  }
  const mask = ['fromLang','toLang','category','level','generatedAt','count','cards'].map(f => `updateMask.fieldPaths=${f}`).join('&')
  const r = await fetch(`${docPath}?${mask}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) })
  if (!r.ok) throw new Error(`Firestore write failed: ${r.status}`)
}

// Writes sentence flashcards to the flat sharedCards/{pair}_sentence path (read by startSatzSession)
async function writeFlatSentencePool(fromLang, toLang, level, cards) {
  const docPath = `${FIRESTORE_BASE}/sharedCards/${fromLang}_${toLang}_sentence`
  const fields = {
    fromLang: { stringValue: fromLang }, toLang: { stringValue: toLang },
    category: { stringValue: 'sentence' },
    generatedAt: { stringValue: new Date().toISOString() },
    count: { integerValue: String(cards.length) },
    cards: {
      arrayValue: {
        values: cards.map(c => ({
          mapValue: {
            fields: {
              id: { stringValue: `sentence_l${level}_${fromLang}_${toLang}_${Math.random().toString(36).slice(2, 9)}` },
              front: { stringValue: c.front || '' }, back: { stringValue: c.back || '' },
              category: { stringValue: 'sentence' }, vocabCategory: { stringValue: c.vocabCategory || '' },
              level: { integerValue: String(level) }, langA: { stringValue: fromLang }, langB: { stringValue: toLang },
              source: { stringValue: 'sentence-pool' }, createdAt: { integerValue: Date.now().toString() },
            }
          }
        }))
      }
    }
  }
  const mask = ['fromLang','toLang','category','generatedAt','count','cards'].map(f => `updateMask.fieldPaths=${f}`).join('&')
  const r = await fetch(`${docPath}?${mask}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) })
  if (!r.ok) throw new Error(`Firestore write failed: ${r.status} ${await r.text()}`)
}

async function generateFlatFlashcards(fromLang, toLang, level, count = 20) {
  const fromName = LANG_NAMES[fromLang]
  const toName = LANG_NAMES[toLang]
  const spec = SENTENCE_LEVEL_SPEC[level] || SENTENCE_LEVEL_SPEC[1]
  const prompt = `Generate exactly ${count} natural sentence flashcards for a ${fromName} speaker learning ${toName}.
Level ${level}/12 — difficulty: ${spec.diff}
Rules:
- front: sentence in ${fromName} (native language), difficulty appropriate for Level ${level}
- back: natural ${toName} translation (as a native speaker would say it)
- Vary across themes: daily life, travel, family, work, small talk
- Vary structure: questions, statements, requests, commands
Return ONLY a valid JSON array (no markdown):
[{"front":"sentence in ${fromName}","back":"sentence in ${toName}","vocabCategory":"alltag"}]`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', max_tokens: 3000,
      system: 'You are a professional language teacher. Return ONLY valid JSON array, no markdown.',
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  const raw = (data.content?.[0]?.text || '').trim()
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []
  try { return JSON.parse(match[0]).slice(0, count) } catch { return [] }
}

// ── HANDLER ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  let body = {}
  try { const chunks = []; for await (const chunk of req) chunks.push(chunk); body = JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch {}

  // type: 'sentence' → generate flashcards to flat sharedCards/{pair}_sentence (used by startSatzSession)
  if (body.type === 'sentence') {
    const level = Math.min(12, Math.max(1, body.level || 3))
    const count = Math.min(50, Math.max(5, body.count || 20))
    const pairsToRun = body.pair
      ? PAIRS.filter(p => `${p.from}_${p.to}` === body.pair)
      : PAIRS
    const results = []
    for (const { from, to } of pairsToRun) {
      try {
        const cards = await generateFlatFlashcards(from, to, level, count)
        if (cards.length > 0) {
          await writeFlatSentencePool(from, to, level, cards)
          results.push({ pair: `${from}→${to}`, level, total: cards.length, path: `sharedCards/${from}_${to}_sentence` })
        } else {
          results.push({ pair: `${from}→${to}`, level, error: 'No cards generated' })
        }
      } catch (e) { results.push({ pair: `${from}→${to}`, level, error: e.message }) }
    }
    return res.status(200).json({ generated: results, total: results.reduce((s, r) => s + (r.total || 0), 0) })
  }

  // type: 'flashcards' → generate sentence flashcards to sharedCards/{pair}_sentence_level{N}
  if (body.type === 'flashcards') {
    const level = Math.min(12, Math.max(1, body.level || 1))
    const pairsToRun = body.pair
      ? PAIRS.filter(p => `${p.from}_${p.to}` === body.pair)
      : PAIRS
    const results = []
    for (const { from, to } of pairsToRun) {
      try {
        const cards = await processFlashcardPair(from, to, level)
        if (cards.length > 0) {
          await writeFlashcardPool(from, to, level, cards)
          const byCat = {}
          for (const c of cards) { byCat[c.vocabCategory] = (byCat[c.vocabCategory] || 0) + 1 }
          results.push({ pair: `${from}→${to}`, level, total: cards.length, categories: Object.entries(byCat).map(([k,v]) => ({ category: k, count: v })) })
        } else {
          results.push({ pair: `${from}→${to}`, level, error: 'No cards generated' })
        }
      } catch (e) { results.push({ pair: `${from}→${to}`, level, error: e.message }) }
    }
    return res.status(200).json({ generated: results, total: results.reduce((s, r) => s + (r.total || 0), 0) })
  }

  // Default: generate sentence exercises to sharedSentences/{pair}_level{N}
  let body2 = body
  const results = []
  for (const level of [1, 2, 3]) {
    for (const { from, to } of PAIRS) {
      try {
        const [b1, b2] = await Promise.all([
          generateBatch(from, to, level, 25),
          generateBatch(from, to, level, 25),
        ])
        const all = [...b1, ...b2].slice(0, 50)
        if (all.length > 0) {
          await writePool(from, to, level, all)
          results.push({ pair: `${from}→${to}`, level, count: all.length })
        } else {
          results.push({ pair: `${from}→${to}`, level, error: 'No exercises generated' })
        }
      } catch (e) {
        results.push({ pair: `${from}→${to}`, level, error: e.message })
      }
    }
  }
  res.status(200).json({
    generated: results,
    total: results.filter(r => r.count).reduce((s, r) => s + r.count, 0),
  })
}
