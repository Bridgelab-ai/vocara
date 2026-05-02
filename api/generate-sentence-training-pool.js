// POST /api/generate-sentence-training-pool
// Generates 30 sentence training exercises per difficulty level (leicht/mittel/schwer)
// for all language pairs → writes to Firestore sharedExercises/{langPair}_satz_{level}
export const config = { api: { bodyParser: true } }

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/vocara-ca2b7/databases/(default)/documents'
const PAIRS = [{ from: 'de', to: 'en' }, { from: 'en', to: 'de' }, { from: 'de', to: 'sw' }]
const LEVELS = ['leicht', 'mittel', 'schwer']
const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili' }

const LEVEL_SPEC = {
  leicht: {
    desc: 'beginner (A1-A2)',
    grammar: 'simple present tense, basic subject-verb structure, "to be" forms, basic nouns and adjectives',
    vocab: 'colors, numbers 1-20, greetings (hello/goodbye/thank you), family members (mother/father/brother/sister), basic objects (house/car/book/water/food)',
  },
  mittel: {
    desc: 'intermediate (B1)',
    grammar: 'present and past tense, modal verbs (can/must/should/want), question formation with W-words, subordinate clauses (because/when/that)',
    vocab: 'daily routines, food and drink, travel, work and school, common adjectives (happy/tired/hungry/busy/interesting)',
  },
  schwer: {
    desc: 'advanced (B2-C1)',
    grammar: 'passive voice, subjunctive/conditional, complex subordinate clauses, reported speech, participial constructions, Konjunktiv II',
    vocab: 'idiomatic expressions, phrasal verbs, abstract nouns (ambition/frustration/dedication), nuanced vocabulary for opinions, arguments and emotions',
  },
}

async function generateBatch(fromLang, toLang, level) {
  const fromName = LANG_NAMES[fromLang]
  const toName = LANG_NAMES[toLang]
  const spec = LEVEL_SPEC[level]

  const prompt = `Generate exactly 30 sentence training exercises for a ${fromName} speaker learning ${toName}.
Difficulty: ${spec.desc}
Grammar focus: ${spec.grammar}
Vocabulary focus: ${spec.vocab}

Mix these 5 exercise types (6 each):
- gap: fill-in-the-blank — question sentence has [___] placeholder for missing word
- order: word chip arrangement — user arranges shuffled chips into correct sentence
- tense: tense conversion — user rewrites sentence in a different tense as instructed
- conjugation: verb conjugation — user conjugates verb for given pronoun/subject
- translation: full sentence translation from ${fromName} to ${toName}

Rules:
- Questions, hints, and explanations MUST be written in ${fromName}
- Answers MUST be in ${toName}
- Keep answers short and natural (max 10 words)
- For "order" type: "chips" array must contain the shuffled words of the answer sentence
- Every exercise must have "hint" (brief grammar label in ${fromName}) and "explanation" (1-sentence grammar rule in ${fromName})
- Vary topics: daily life, travel, work, nature, feelings

Return ONLY a valid JSON array (no markdown, no extra text):
[{"type":"gap","question":"...","answer":"...","hint":"...","explanation":"..."},
{"type":"order","question":"Arrange the words:","chips":["word1","word2","word3"],"answer":"word1 word2 word3.","hint":"...","explanation":"..."},
{"type":"tense","question":"...","answer":"...","hint":"...","explanation":"..."},
{"type":"conjugation","question":"...","answer":"...","hint":"...","explanation":"..."},
{"type":"translation","question":"...","answer":"...","hint":"...","explanation":"..."}]`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 5000, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await res.json()
  const text = (data.content?.[0]?.text || '[]').trim()
  return JSON.parse(text.replace(/```json\n?|```/g, '').trim())
}

function toFirestoreValue(v) {
  if (Array.isArray(v)) return { arrayValue: { values: v.map(w => ({ stringValue: String(w) })) } }
  return { stringValue: String(v ?? '') }
}

async function writeToFirestore(langPair, level, exercises) {
  const docId = `${langPair}_satz_${level}`
  const url = `${FIRESTORE_BASE}/sharedExercises/${docId}`
  const fields = {
    exercises: {
      arrayValue: {
        values: exercises.map(ex => ({
          mapValue: {
            fields: Object.fromEntries(Object.entries(ex).map(([k, v]) => [k, toFirestoreValue(v)]))
          }
        }))
      }
    },
    updatedAt: { stringValue: new Date().toISOString() },
    langPair: { stringValue: langPair },
    level: { stringValue: level },
    count: { integerValue: String(exercises.length) },
  }
  const patchRes = await fetch(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  return patchRes.ok
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { pair, level: onlyLevel } = req.body || {}
  const pairsToRun = pair ? [PAIRS.find(p => `${p.from}_${p.to}` === pair)].filter(Boolean) : PAIRS
  const levelsToRun = onlyLevel ? [onlyLevel] : LEVELS
  const results = []
  for (const p of pairsToRun) {
    for (const lv of levelsToRun) {
      const langPair = `${p.from}_${p.to}`
      try {
        const exercises = await generateBatch(p.from, p.to, lv)
        const ok = await writeToFirestore(langPair, lv, exercises)
        results.push({ langPair, level: lv, count: exercises.length, ok })
        await new Promise(r => setTimeout(r, 1000))
      } catch (e) {
        results.push({ langPair, level: lv, error: e.message })
      }
    }
  }
  res.json({ ok: true, results })
}
