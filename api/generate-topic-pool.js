// Topic pool generator — POST /api/generate-topic-pool
// Body: { topic, level, pair, from, to }  e.g. { topic:'kochen', level:1, pair:'de_en', from:'de', to:'en' }
// Writes to sharedCards/{from}_{to}_{topic}_{level}  with category: topic (e.g. 'kochen')
import { TOPIC_STRUCTURE, TOPIC_LEVEL_CONTENT, TOPIC_NAMES } from './_topicStructure.js'
import { getRarity, markImportant } from './_poolStructure.js'
export const config = { api: { bodyParser: false } }

const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili', fr: 'French', es: 'Spanish', th: 'Thai' }
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/vocara-ca2b7/databases/(default)/documents'

async function generateCards(fromLang, toLang, topic, level) {
  const fromName = LANG_NAMES[fromLang] || fromLang
  const toName = LANG_NAMES[toLang] || toLang
  const topicEn = TOPIC_NAMES[topic]?.en || topic
  const prompt = TOPIC_LEVEL_CONTENT[level](topicEn, fromName, toName)
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
      system: 'You are a professional language educator creating topic-specific flashcards. Every card must be unique and natural. Return ONLY valid JSON array, no markdown, no explanation.',
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  const raw = (data.content?.[0]?.text || '').trim()
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []
  try { return JSON.parse(match[0]).slice(0, TOPIC_STRUCTURE[topic].cardsPerLevel) } catch { return [] }
}

async function writeToFirestore(fromLang, toLang, topic, level, cards) {
  const langPair = `${fromLang}_${toLang}`
  const docPath = `${FIRESTORE_BASE}/sharedCards/${langPair}_${topic}_${level}`
  const fields = {
    fromLang: { stringValue: fromLang },
    toLang: { stringValue: toLang },
    level: { integerValue: String(level) },
    category: { stringValue: topic },
    generatedAt: { stringValue: new Date().toISOString() },
    cards: {
      arrayValue: {
        values: cards.map(c => ({
          mapValue: {
            fields: {
              id: { stringValue: `${topic}_${level}_${fromLang}_${toLang}_${Math.random().toString(36).slice(2, 8)}` },
              front: { stringValue: c.front || '' },
              back: { stringValue: c.back || '' },
              pronunciation: { stringValue: c.pronunciation || '' },
              category: { stringValue: topic },
              level: { integerValue: String(level) },
              wordType: { stringValue: c.wordType || '' },
              register: { stringValue: c.register || 'neutral' },
              langA: { stringValue: fromLang },
              langB: { stringValue: toLang },
              source: { stringValue: 'topic-pool' },
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
  console.log('[TOPIC-POOL] called with body:', JSON.stringify(body))
  const { topic, level: rawLevel, pair, from: fromLang, to: toLang } = body
  if (!topic) return res.status(400).json({ error: 'topic required' })
  if (!TOPIC_STRUCTURE[topic]) return res.status(400).json({ error: `Unknown topic: ${topic}` })
  const fromL = fromLang || pair?.split('_')[0]
  const toL = toLang || pair?.split('_')[1]
  if (!fromL || !toL) return res.status(400).json({ error: 'from/to or pair required' })
  const level = Math.min(TOPIC_STRUCTURE[topic].totalLevels, Math.max(1, Number(rawLevel) || 1))
  try {
    const cards = await generateCards(fromL, toL, topic, level)
    if (cards.length === 0) return res.status(200).json({ error: 'No cards generated', count: 0 })
    await writeToFirestore(fromL, toL, topic, level, cards)
    res.status(200).json({ topic, level, pair: `${fromL}_${toL}`, count: cards.length })
  } catch (err) {
    console.error('[TOPIC-POOL FATAL]', err.message, err.stack)
    return res.status(500).json({ error: err.message })
  }
}
