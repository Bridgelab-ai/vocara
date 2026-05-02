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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const results = []
  for (const level of [1, 2, 3]) {
    for (const { from, to } of PAIRS) {
      try {
        // Generate in two batches of 25 to avoid token limits
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
