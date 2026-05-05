// POST /api/generate-home-pool
// Body: { level: 1-14, from?, to? } — Writes to sharedCards/{pair}_home_level{N}
import { POOL_STRUCTURE, getRarity, markImportant } from './_poolStructure.js'
export const config = { api: { bodyParser: false } }

const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili' }
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/vocara-ca2b7/databases/(default)/documents'

const PAIRS = [
  { from: 'de', to: 'en' },
  { from: 'en', to: 'de' },
  { from: 'de', to: 'sw' },
]

const LEVEL_SPEC = {
  1:  { focus: 'absolute home basics: greetings like "Good morning / Guten Morgen", "How are you?", "Thank you", simple yes/no phrases at home, asking for help', count: 25, diff: 'A1 absolute basics' },
  2:  { focus: 'household phrases: naming rooms (kitchen/bedroom/bathroom/living room), basic requests (please/come here/sit down), simple descriptions of the home', count: 28, diff: 'A1-A2 household basics' },
  3:  { focus: 'daily family conversation: talking about meals (breakfast ready/dinner time), plans for the day, describing family members and what they do', count: 28, diff: 'A2 family talk' },
  4:  { focus: 'household activities: cooking instructions, describing chores (vacuum/wash dishes/take out trash/do laundry), shopping lists, organizing at home', count: 30, diff: 'A2-B1 home activities' },
  5:  { focus: 'feelings and relationships at home: expressing emotions (I am tired/happy/stressed), talking about relationships, mild disagreements, making up', count: 30, diff: 'B1 emotions at home' },
  6:  { focus: 'leisure at home: talking about hobbies, watching TV together, listening to music, reading, relaxing — natural everyday small talk between housemates or family', count: 30, diff: 'B1 leisure' },
  7:  { focus: 'deeper domestic conversations: discussing living arrangements, home improvements, daily routines in detail, future plans at home, longer household negotiations', count: 30, diff: 'B1-B2 detailed home talk' },
  8:  { focus: 'nuanced household language: subtle expressions, indirect requests (Could you perhaps...), polite disagreements, softened criticism, expressing preferences gracefully', count: 30, diff: 'B2 nuanced home language' },
  9:  { focus: 'cultural home expressions: idioms and phrases about family life, customs around meals and hospitality, generational expressions, home-related proverbs', count: 30, diff: 'B2-C1 cultural home expressions' },
  10: { focus: 'near-native home vocabulary: complex family dynamics, mixing formal and informal registers naturally, subtle emotional undertones, very natural expressions', count: 30, diff: 'C1 near-native' },
}

async function generateLevel(fromLang, toLang, level) {
  const fromName = LANG_NAMES[fromLang]
  const toName = LANG_NAMES[toLang]
  const spec = LEVEL_SPEC[level] || LEVEL_SPEC[10]
  const count = POOL_STRUCTURE.home.cardsPerLevel
  const prompt = `Generate exactly ${count} home/household flashcards (Level ${level}, ${spec.diff}) for a ${fromName} speaker learning ${toName}.
Focus: ${spec.focus}

Rules:
- front: natural phrase or sentence in ${fromName} (may include brief context in parentheses)
- back: natural equivalent in ${toName} — what a native speaker would actually say
- tense: "present" | "past" | "future"
- context: one short usage note in ${fromName} (max 6 words)
- level: ${level}
- Phrases should feel natural in a real home setting
- Vary difficulty appropriately for Level ${level}

Return ONLY a valid JSON array (no markdown):
[{"front":"...","back":"...","tense":"present","context":"..."}]`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', max_tokens: 3000,
      system: 'You are a native-speaker language teacher specializing in everyday home vocabulary. Return ONLY a valid JSON array, no markdown fences.',
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
        id: { stringValue: `home_l${level}_${fromLang}_${toLang}_${Math.random().toString(36).slice(2, 8)}` },
        front: { stringValue: c.front || '' },
        back: { stringValue: c.back || '' },
        category: { stringValue: 'home' },
        tense: { stringValue: c.tense || 'present' },
        context: { stringValue: c.context || '' },
        level: { integerValue: String(level) },
        langA: { stringValue: fromLang },
        langB: { stringValue: toLang },
        source: { stringValue: 'home-pool' },
        rarity: { stringValue: getRarity(level) },
        important: { booleanValue: markImportant(level) },
        createdAt: { integerValue: Date.now().toString() },
      }
    }
  }
}

async function writePool(fromLang, toLang, level, cards) {
  const docId = `${fromLang}_${toLang}_home_level${level}`
  const docPath = `${FIRESTORE_BASE}/sharedCards/${docId}`
  const fields = {
    fromLang: { stringValue: fromLang }, toLang: { stringValue: toLang },
    category: { stringValue: 'home' }, level: { integerValue: String(level) },
    generatedAt: { stringValue: new Date().toISOString() },
    count: { integerValue: String(cards.length) },
    cards: { arrayValue: { values: cards } },
  }
  const mask = ['fromLang', 'toLang', 'category', 'level', 'generatedAt', 'count', 'cards']
    .map(f => `updateMask.fieldPaths=${f}`).join('&')
  const r = await fetch(`${docPath}?${mask}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }),
  })
  if (!r.ok) throw new Error(`Firestore write failed: ${r.status} ${await r.text()}`)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  let body = {}
  try { const chunks = []; for await (const chunk of req) chunks.push(chunk); body = JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch {}
  const level = Math.min(POOL_STRUCTURE.home.totalLevels, Math.max(1, body.level || 1))
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
