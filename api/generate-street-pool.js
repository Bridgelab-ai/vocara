// Street pool generator — POST /api/generate-street-pool
// 12 levels, ~42 cards each. Body: { level: 1-12, from?, to? }
// Writes to sharedCards/{pair}_street_level{N}
export const config = { api: { bodyParser: false } }

const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili' }
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/vocara-ca2b7/databases/(default)/documents'

const PAIRS = [
  { from: 'de', to: 'en' },
  { from: 'en', to: 'de' },
  { from: 'de', to: 'sw' },
]

const LEVEL_SPEC = {
  1:  { focus: 'basic informal greetings and reactions: casual "hi/bye/cool/no way/got it/sure/whatever/awesome/cheers", simple everyday expressions that are more natural than textbook language', count: 35, diff: 'A1-A2 basic casual' },
  2:  { focus: 'casual agreement and disagreement: expressions for "yes exactly/not really/absolutely/fair enough/no chance/kind of/sort of/definitely", party/social starters', count: 38, diff: 'A2 casual' },
  3:  { focus: 'everyday slang for everyday situations: saying things are bad or good informally, talking about being tired/busy/stressed, casual work phrases', count: 40, diff: 'A2-B1 colloquial' },
  4:  { focus: 'basic idioms with clear meanings: "break the ice", "cost an arm and a leg", "under the weather", "piece of cake", "at the drop of a hat", "hit the sack", "piece of the action"', count: 40, diff: 'B1 basic idioms' },
  5:  { focus: 'body and food idioms: expressions using body parts and food metaphorically — natural in everyday speech but not taught in textbooks', count: 40, diff: 'B1 idioms' },
  6:  { focus: 'time and weather idioms: expressions about time passing, weather metaphors, opportunity idioms — commonly used in natural conversation', count: 40, diff: 'B1 intermediate idioms' },
  7:  { focus: 'modern informal speech: filler words (like/you know/I mean/basically/literally/honestly/anyway/so yeah), hedging phrases, casual conversation management', count: 42, diff: 'B1-B2 informal' },
  8:  { focus: 'youth slang and internet-era expressions: modern terms for cool/uncool, reactions like "no cap/lowkey/vibe/slay/it hits different", casual compliments and teasing among friends', count: 42, diff: 'B2 youth language' },
  9:  { focus: 'phrasal verbs in context: common phrasal verbs that native speakers use constantly — with natural sentences showing how they are used casually', count: 42, diff: 'B2 phrasal verbs' },
  10: { focus: 'humor and sarcasm expressions: phrases used for light sarcasm, understatement, irony in casual speech — that are funny or understated in the target language', count: 42, diff: 'B2-C1 humor/irony' },
  11: { focus: 'workplace and social culture slang: expressions used in professional-casual settings, office banter, networking small talk that sounds natural to native speakers', count: 42, diff: 'C1 professional casual' },
  12: { focus: 'advanced cultural expressions: deeply rooted cultural idioms, regional sayings, literary allusions that native speakers use — difficult to understand without cultural context', count: 42, diff: 'C1-C2 cultural' },
}

async function generateLevel(fromLang, toLang, level) {
  const fromName = LANG_NAMES[fromLang]
  const toName = LANG_NAMES[toLang]
  const spec = LEVEL_SPEC[level]
  const prompt = `Generate exactly ${spec.count} street language flashcards (Level ${level}/12, ${spec.diff}) for a ${fromName} speaker learning ${toName}.
Focus: ${spec.focus}

Rules:
- front: phrase/expression in ${fromName} with brief context note in parentheses if needed
- back: natural equivalent in ${toName} (give the equivalent expression, not always literal)
- pronunciation: German-style phonetic for ${toName} phrase (only if helpful, else empty string)
- wordType: always "phrase"
- register: "slang" | "informal" | "casual"
- level: ${level}
- All content appropriate (no offensive slurs or profanity)
- Make it real — phrases native speakers actually use

Return ONLY a valid JSON array (no markdown):
[{"front":"...","back":"...","pronunciation":"...","wordType":"phrase","register":"informal"}]`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6', max_tokens: 4000,
      system: 'You are a native-speaker language coach who knows authentic street language. Return ONLY valid JSON array, no markdown fences.',
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  const raw = (data.content?.[0]?.text || '').trim()
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []
  try { return JSON.parse(match[0]).slice(0, spec.count) } catch { return [] }
}

function cardToFirestore(c, fromLang, toLang, level) {
  return {
    mapValue: {
      fields: {
        id: { stringValue: `street_l${level}_${fromLang}_${toLang}_${Math.random().toString(36).slice(2, 8)}` },
        front: { stringValue: c.front || '' },
        back: { stringValue: c.back || '' },
        pronunciation: { stringValue: c.pronunciation || '' },
        category: { stringValue: 'street' },
        wordType: { stringValue: 'phrase' },
        level: { integerValue: String(level) },
        tense: { stringValue: 'present' },
        register: { stringValue: c.register || 'informal' },
        langA: { stringValue: fromLang },
        langB: { stringValue: toLang },
        source: { stringValue: 'street-pool' },
        createdAt: { integerValue: Date.now().toString() },
      }
    }
  }
}

async function writePool(fromLang, toLang, level, cards) {
  const docId = `${fromLang}_${toLang}_street_level${level}`
  const docPath = `${FIRESTORE_BASE}/sharedCards/${docId}`
  const fields = {
    fromLang: { stringValue: fromLang }, toLang: { stringValue: toLang },
    category: { stringValue: 'street' }, level: { integerValue: String(level) },
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
  const level = Math.min(12, Math.max(1, body.level || 1))
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
