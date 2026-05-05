// Vocab pool generator — POST /api/generate-vocab-pool
// Body: { level: 1-22, from?, to? } — Writes to sharedCards/{pair}_vocab_level{N}
import { POOL_STRUCTURE, getRarity, markImportant } from './_poolStructure.js'
export const config = { api: { bodyParser: false } }

const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili' }
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/vocara-ca2b7/databases/(default)/documents'

const PAIRS = [
  { from: 'de', to: 'en' },
  { from: 'en', to: 'de' },
  { from: 'de', to: 'sw' },
]

// 12 level definitions: topic focus + difficulty progression
const LEVEL_SPEC = {
  1:  { focus: 'basic greetings and farewells, yes/no/please/thank you/sorry, numbers 1-10, simple colors (red/blue/green/yellow/white/black)', count: 60, diff: 'A1 absolute beginner' },
  2:  { focus: 'family members, common household objects (table/chair/door/window/bed/kitchen), body parts (head/hand/eye/ear/mouth/foot)', count: 65, diff: 'A1 beginner' },
  3:  { focus: 'daily routine verbs (eat/sleep/work/go/come/want/need/have/be/see/know/like), time words (today/tomorrow/yesterday/now/later/always/never/morning/evening)', count: 65, diff: 'A1-A2' },
  4:  { focus: 'food and drinks (bread/water/coffee/tea/milk/fruit/vegetables/meat/rice/soup), weather (rain/sun/wind/cloud/hot/cold/warm)', count: 65, diff: 'A2 elementary' },
  5:  { focus: 'emotions and feelings (happy/sad/angry/tired/excited/nervous/proud/scared/bored/surprised/grateful/frustrated/lonely/calm)', count: 65, diff: 'A2' },
  6:  { focus: 'nature (tree/flower/river/mountain/ocean/forest/sky/grass/stone/animal/bird/fish), seasons and natural phenomena', count: 65, diff: 'A2-B1' },
  7:  { focus: 'work and school vocabulary (job/office/meeting/email/deadline/homework/teacher/student/grade/project/colleague/boss/computer)', count: 67, diff: 'B1 intermediate' },
  8:  { focus: 'travel (passport/airport/hotel/train/bus/map/tourist/visa/customs/ticket/reservation/platform/departure/arrival)', count: 67, diff: 'B1' },
  9:  { focus: 'abstract concepts (freedom/justice/peace/change/future/memory/dream/idea/trust/hope/responsibility/opportunity/challenge/success)', count: 67, diff: 'B1-B2' },
  10: { focus: 'discourse and opinion markers (furthermore/however/therefore/although/despite/whereas/provided/assuming/consequently/meanwhile/notably/alternatively)', count: 67, diff: 'B2 upper-intermediate' },
  11: { focus: 'nuanced descriptive language — precise adjectives and verbs that express subtle distinctions (gleaming/faint/sturdy/bold/frail/vivid/subtle/harsh/crisp/peculiar)', count: 67, diff: 'B2-C1' },
  12: { focus: 'sophisticated academic and literary vocabulary — words for complex ideas, precise descriptions, elevated registers', count: 67, diff: 'C1 advanced' },
}

async function generateLevel(fromLang, toLang, level) {
  const fromName = LANG_NAMES[fromLang]
  const toName = LANG_NAMES[toLang]
  const spec = LEVEL_SPEC[level] || LEVEL_SPEC[12]
  const count = POOL_STRUCTURE.vocab.cardsPerLevel
  const prompt = `Generate exactly ${count} vocabulary flashcards (Level ${level}, ${spec.diff}) for a ${fromName} speaker learning ${toName}.
Focus: ${spec.focus}

Rules:
- front: word/short phrase in ${fromName} (source language)
- back: accurate natural translation in ${toName}
- pronunciation: German-style phonetic syllables for ${toName} (e.g. "GU-ten TAG") — empty string if not helpful
- wordType: noun|verb|adjective|adverb|phrase
- level: ${level}
- All translations 100% accurate and natural, never literal

Return ONLY a valid JSON array (no markdown):
[{"front":"...","back":"...","pronunciation":"...","wordType":"noun"}]`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6', max_tokens: 5000,
      system: 'You are a professional language educator. Generate accurate vocabulary flashcards. Return ONLY valid JSON array, no markdown fences.',
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  const raw = (data.content?.[0]?.text || '').trim()
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []
  try { return JSON.parse(match[0]).slice(0, count) } catch { return [] }
}

function cardToFirestore(c, fromLang, toLang, level) {
  return {
    mapValue: {
      fields: {
        id: { stringValue: `vocab_l${level}_${fromLang}_${toLang}_${Math.random().toString(36).slice(2, 8)}` },
        front: { stringValue: c.front || '' },
        back: { stringValue: c.back || '' },
        pronunciation: { stringValue: c.pronunciation || '' },
        category: { stringValue: 'vocabulary' },
        wordType: { stringValue: c.wordType || 'noun' },
        level: { integerValue: String(level) },
        tense: { stringValue: 'present' },
        register: { stringValue: 'neutral' },
        langA: { stringValue: fromLang },
        langB: { stringValue: toLang },
        source: { stringValue: 'vocab-pool' },
        rarity: { stringValue: getRarity(level) },
        important: { booleanValue: markImportant(level) },
        createdAt: { integerValue: Date.now().toString() },
      }
    }
  }
}

async function writePool(fromLang, toLang, level, cards) {
  const docId = `${fromLang}_${toLang}_vocab_level${level}`
  const docPath = `${FIRESTORE_BASE}/sharedCards/${docId}`
  const fields = {
    fromLang: { stringValue: fromLang }, toLang: { stringValue: toLang },
    category: { stringValue: 'vocabulary' }, level: { integerValue: String(level) },
    generatedAt: { stringValue: new Date().toISOString() },
    count: { integerValue: String(cards.length) },
    cards: { arrayValue: { values: cards } },
  }
  const mask = ['fromLang', 'toLang', 'category', 'level', 'generatedAt', 'count', 'cards']
    .map(f => `updateMask.fieldPaths=${f}`).join('&')
  const r = await fetch(`${docPath}?${mask}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }),
  })
  if (!r.ok) throw new Error(`Firestore write failed: ${r.status}`)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  let body = {}
  try { const chunks = []; for await (const chunk of req) chunks.push(chunk); body = JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch {}
  const level = Math.min(POOL_STRUCTURE.vocab.totalLevels, Math.max(1, body.level || 1))
  const pairsToRun = (body.from && body.to) ? [{ from: body.from, to: body.to }] : PAIRS
  const results = []
  for (const { from, to } of pairsToRun) {
    try {
      const cards = await generateLevel(from, to, level)
      if (cards.length > 0) {
        const mapped = cards.map(c => cardToFirestore(c, from, to, level))
        await writePool(from, to, level, mapped)
        results.push({ pair: `${from}→${to}`, level, count: cards.length })
      } else {
        results.push({ pair: `${from}→${to}`, level, error: 'No cards generated' })
      }
    } catch (e) { results.push({ pair: `${from}→${to}`, level, error: e.message }) }
  }
  res.status(200).json({ generated: results, total: results.reduce((s, r) => s + (r.count || 0), 0) })
}
