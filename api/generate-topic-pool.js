// Topic pool generator — POST /api/generate-topic-pool
// Body: { topicKey, level, langPair }  e.g. { topicKey:'cooking', level:2, langPair:'de_en' }
// Writes to sharedCards/{langPair}_topic_{topicKey}_{level}
import { POOL_STRUCTURE, getRarity, markImportant } from './_poolStructure.js'

export const config = { api: { bodyParser: false } }

const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili', fr: 'French', es: 'Spanish', th: 'Thai' }
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/vocara-ca2b7/databases/(default)/documents'

const TOPICS_CONFIG = {
  cooking:  { en: 'Cooking & Food', de: 'Kochen & Essen' },
  sports:   { en: 'Sports & Football', de: 'Sport & Fußball' },
  music:    { en: 'Music & Instruments', de: 'Musik & Instrumente' },
  travel:   { en: 'Travel & Transport', de: 'Reisen & Transport' },
  tech:     { en: 'Technology & Gadgets', de: 'Technik & Gadgets' },
  business: { en: 'Business & Work', de: 'Business & Arbeit' },
  nature:   { en: 'Nature & Environment', de: 'Natur & Umwelt' },
}

function buildPrompt(fromLang, toLang, topicKey, level) {
  const fromName = LANG_NAMES[fromLang] || fromLang
  const toName = LANG_NAMES[toLang] || toLang
  const topicEn = TOPICS_CONFIG[topicKey]?.en || topicKey
  const levels = {
    1: `basic beginner vocabulary (A1): the 15 most common, essential words and simple phrases`,
    2: `elementary vocabulary (A2): everyday words and short useful phrases`,
    3: `pre-intermediate (A2-B1): practical phrases and common collocations`,
    4: `intermediate (B1): idiomatic expressions and useful conversational phrases`,
    5: `upper-intermediate (B1-B2): nuanced vocabulary, phrasal verbs, and collocations`,
    6: `advanced (B2): sophisticated vocabulary, idioms, and domain-specific terms`,
    7: `advanced (B2-C1): rare but natural expressions and professional vocabulary`,
    8: `near-native (C1): highly nuanced expressions and subtle distinctions`,
    9: `near-native (C1-C2): near-native collocations and rare sophisticated terms`,
    10: `native-level (C2): the most nuanced, culturally rich vocabulary`,
  }
  const levelDesc = levels[level] || levels[1]
  return `Generate exactly 15 flashcards on the topic "${topicEn}" for a ${fromName} speaker learning ${toName}.
Level: ${levelDesc}.
All fronts in ${fromName}, all backs in ${toName}. 100% accurate, natural expressions.
Include a short phonetic pronunciation for each ${toName} word/phrase.
Return ONLY a valid JSON array (no markdown):
[{"front":"phrase in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic for ${toName}","wordType":"noun|verb|phrase|adjective","register":"neutral|formal|informal"}]`
}

async function generateCards(fromLang, toLang, topicKey, level) {
  const prompt = buildPrompt(fromLang, toLang, topicKey, level)
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6', max_tokens: 3000,
      system: 'You are a professional language educator. Return ONLY valid JSON array, no markdown.',
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  const raw = (data.content?.[0]?.text || '').trim()
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []
  try { return JSON.parse(match[0]).slice(0, POOL_STRUCTURE.topics.cardsPerLevel) } catch { return [] }
}

async function writeToFirestore(fromLang, toLang, topicKey, level, cards) {
  const langPair = `${fromLang}_${toLang}`
  const docPath = `${FIRESTORE_BASE}/sharedCards/${langPair}_topic_${topicKey}_${level}`
  const fields = {
    fromLang: { stringValue: fromLang },
    toLang: { stringValue: toLang },
    level: { integerValue: String(level) },
    category: { stringValue: 'topics' },
    topicKey: { stringValue: topicKey },
    langPair: { stringValue: langPair },
    generatedAt: { stringValue: new Date().toISOString() },
    cards: {
      arrayValue: {
        values: cards.map(c => ({
          mapValue: {
            fields: {
              id: { stringValue: `topic_${topicKey}_${level}_${fromLang}_${toLang}_${Math.random().toString(36).slice(2, 8)}` },
              front: { stringValue: c.front || '' },
              back: { stringValue: c.back || '' },
              pronunciation: { stringValue: c.pronunciation || '' },
              category: { stringValue: 'topics' },
              topicKey: { stringValue: topicKey },
              level: { integerValue: String(level) },
              wordType: { stringValue: c.wordType || '' },
              register: { stringValue: c.register || 'neutral' },
              langA: { stringValue: fromLang },
              langB: { stringValue: toLang },
              langPair: { stringValue: langPair },
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
  const mask = ['fromLang','toLang','level','category','topicKey','langPair','generatedAt','count','cards']
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
  let body = {}
  try { const chunks = []; for await (const chunk of req) chunks.push(chunk); body = JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch {}

  const { topicKey, level: rawLevel, langPair } = body
  if (!topicKey || !langPair) return res.status(400).json({ error: 'topicKey and langPair required' })
  if (!TOPICS_CONFIG[topicKey]) return res.status(400).json({ error: `Unknown topic: ${topicKey}` })

  const level = Math.min(POOL_STRUCTURE.topics.totalLevels, Math.max(1, Number(rawLevel) || 1))
  const [fromLang, toLang] = langPair.split('_')
  if (!fromLang || !toLang) return res.status(400).json({ error: 'Invalid langPair' })

  try {
    const cards = await generateCards(fromLang, toLang, topicKey, level)
    if (cards.length === 0) return res.status(200).json({ error: 'No cards generated', count: 0 })
    await writeToFirestore(fromLang, toLang, topicKey, level, cards)
    res.status(200).json({ topicKey, level, langPair, count: cards.length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
