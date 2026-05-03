// POST /api/generate-sentence-training-pool
// 12 levels, 30 exercises each. Body: { level: 1-12, pair? }
// Writes to sharedExercises/{pair}_satz_level{N}
export const config = { api: { bodyParser: true } }

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/vocara-ca2b7/databases/(default)/documents'
const PAIRS = [{ from: 'de', to: 'en' }, { from: 'en', to: 'de' }, { from: 'de', to: 'sw' }]
const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili' }

const LEVEL_SPEC = {
  1:  { desc: 'A1 absolute beginner', grammar: 'simple present "to be/have", basic subject-verb structure', vocab: 'colors, numbers 1-10, greetings, basic objects (house/water/food)' },
  2:  { desc: 'A1-A2 beginner', grammar: 'present tense with common verbs (go/eat/want/need/like)', vocab: 'family members, home rooms, daily objects (book/door/table/chair)' },
  3:  { desc: 'A2', grammar: 'simple past introduction (was/went/ate), basic question formation', vocab: 'daily routine, food and drink, time words (yesterday/today/tomorrow)' },
  4:  { desc: 'A2-B1', grammar: 'W-question words (who/what/where/when/why/how), imperatives/commands', vocab: 'shopping, transport, asking for help, directions' },
  5:  { desc: 'B1', grammar: 'modal verbs (can/must/should/want/may) with infinitive', vocab: 'work, school, abilities, obligations, everyday necessity' },
  6:  { desc: 'B1', grammar: 'subordinate clauses with because/when/that/although/while', vocab: 'emotions, opinions, explanations, preferences' },
  7:  { desc: 'B1-B2', grammar: 'perfect/past perfect tense, sequential events', vocab: 'travel, experiences, recent activities, narrative linking' },
  8:  { desc: 'B2', grammar: 'passive voice (is done / was done / will be done)', vocab: 'processes, instructions, formal descriptions, news-style reporting' },
  9:  { desc: 'B2', grammar: 'conditional/subjunctive (would/could/should + if-clauses)', vocab: 'hypotheticals, polite requests, imagined scenarios, advice-giving' },
  10: { desc: 'B2', grammar: 'reported/indirect speech (she said that / he asked whether)', vocab: 'quotes, summaries, second-hand information, formal communication' },
  11: { desc: 'C1', grammar: 'complex multi-clause sentences, discourse markers (nevertheless/furthermore/consequently)', vocab: 'abstract topics, academic language, nuanced opinions' },
  12: { desc: 'C1-C2', grammar: 'sophisticated constructions: participial clauses, inversion, advanced subordination', vocab: 'elevated register, precise formal vocabulary, literary expressions' },
}

async function generateBatch(fromLang, toLang, level) {
  const fromName = LANG_NAMES[fromLang]
  const toName = LANG_NAMES[toLang]
  const spec = LEVEL_SPEC[level]

  const prompt = `Generate exactly 30 sentence training exercises (Level ${level}/12, ${spec.desc}) for a ${fromName} speaker learning ${toName}.
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
- Difficulty must match Level ${level}/12: ${spec.desc}

Return ONLY a valid JSON array (no markdown, no extra text):
[{"type":"gap","question":"...","answer":"...","hint":"...","explanation":"..."},
{"type":"order","question":"Arrange the words:","chips":["word1","word2","word3"],"answer":"word1 word2 word3.","hint":"...","explanation":"..."}]`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 5000, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await res.json()
  const text = (data.content?.[0]?.text || '[]').trim()
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []
  try { return JSON.parse(match[0]).slice(0, 30) } catch { return [] }
}

function toFirestoreValue(v) {
  if (Array.isArray(v)) return { arrayValue: { values: v.map(w => ({ stringValue: String(w) })) } }
  return { stringValue: String(v ?? '') }
}

async function writeToFirestore(langPair, level, exercises) {
  const docId = `${langPair}_satz_level${level}`
  const url = `${FIRESTORE_BASE}/sharedExercises/${docId}`
  const fields = {
    exercises: {
      arrayValue: {
        values: exercises.map(ex => ({
          mapValue: {
            fields: {
              ...Object.fromEntries(Object.entries(ex).map(([k, v]) => [k, toFirestoreValue(v)])),
              level: { integerValue: String(level) },
            }
          }
        }))
      }
    },
    updatedAt: { stringValue: new Date().toISOString() },
    langPair: { stringValue: langPair },
    level: { integerValue: String(level) },
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
  const { pair, level: bodyLevel } = req.body || {}
  const level = Math.min(12, Math.max(1, parseInt(bodyLevel) || 1))
  const pairsToRun = pair ? [PAIRS.find(p => `${p.from}_${p.to}` === pair)].filter(Boolean) : PAIRS
  const results = []
  for (const p of pairsToRun) {
    const langPair = `${p.from}_${p.to}`
    try {
      const exercises = await generateBatch(p.from, p.to, level)
      const ok = await writeToFirestore(langPair, level, exercises)
      results.push({ langPair, level, count: exercises.length, ok })
    } catch (e) {
      results.push({ langPair, level, error: e.message })
    }
  }
  res.json({ ok: true, results })
}
