// Test pool generator — POST /api/generate-test-pool
// Generates multiple-choice CEFR assessment questions for Sprachkompass/Sprachpuls
// Body: { testType, cefrLevel, pair, from, to }
import { TEST_STRUCTURE, SPRACHKOMPASS_LEVEL_CONTENT } from './_testStructure.js'

const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/vocara-ca2b7/databases/(default)/documents'
const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili', fr: 'French', es: 'Spanish', th: 'Thai' }

async function generateQuestions(testType, cefrLevel, fromLang, toLang) {
  const fromName = LANG_NAMES[fromLang] || fromLang
  const toName = LANG_NAMES[toLang] || toLang
  const basePrompt = testType === 'sprachkompass'
    ? SPRACHKOMPASS_LEVEL_CONTENT[cefrLevel]
    : `Generate 3 multiple-choice questions at ${cefrLevel} level for a ${fromName} speaker learning ${toName}. Each question: 1 correct + 3 wrong answers.`

  const prompt = `${basePrompt}

Language pair: ${fromName} speaker learning ${toName}.
Return ONLY a valid JSON array of question objects (no markdown, no explanation outside JSON):
[{"id":"q1","question":"...","options":{"a":"...","b":"...","c":"...","d":"..."},"correct":"a","explanation":"...","cefrLevel":"${cefrLevel}"}]`

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
      system: 'You are a language assessment expert. Generate accurate multiple-choice test questions. Return ONLY valid JSON array of question objects, no markdown.',
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  const raw = (data.content?.[0]?.text || '').trim()
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) return []
  try {
    const { questionsPerLevel } = TEST_STRUCTURE[testType] || { questionsPerLevel: 4 }
    return JSON.parse(match[0]).slice(0, questionsPerLevel)
  } catch { return [] }
}

async function writeToFirestore(fromLang, toLang, testType, cefrLevel, questions) {
  const docPath = `${FIRESTORE_BASE}/testCards/${fromLang}_${toLang}_${testType}_${cefrLevel}`
  const fields = {
    fromLang: { stringValue: fromLang },
    toLang: { stringValue: toLang },
    testType: { stringValue: testType },
    cefrLevel: { stringValue: cefrLevel },
    generatedAt: { stringValue: new Date().toISOString() },
    count: { integerValue: String(questions.length) },
    questions: {
      arrayValue: {
        values: questions.map((q, i) => ({
          mapValue: {
            fields: {
              id: { stringValue: q.id || `q${i + 1}` },
              question: { stringValue: q.question || '' },
              options: {
                mapValue: {
                  fields: {
                    a: { stringValue: q.options?.a || '' },
                    b: { stringValue: q.options?.b || '' },
                    c: { stringValue: q.options?.c || '' },
                    d: { stringValue: q.options?.d || '' },
                  }
                }
              },
              correct: { stringValue: q.correct || 'a' },
              explanation: { stringValue: q.explanation || '' },
              cefrLevel: { stringValue: cefrLevel },
            }
          }
        }))
      }
    },
  }
  const mask = ['fromLang', 'toLang', 'testType', 'cefrLevel', 'generatedAt', 'count', 'questions']
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

  const { testType = 'sprachkompass', cefrLevel, from, to } = body
  if (!cefrLevel || !from || !to) return res.status(400).json({ error: 'cefrLevel, from, to required' })

  try {
    const questions = await generateQuestions(testType, cefrLevel, from, to)
    if (questions.length === 0) return res.status(200).json({ error: 'No questions generated', count: 0 })
    await writeToFirestore(from, to, testType, cefrLevel, questions)
    return res.status(200).json({ count: questions.length, pair: `${from}_${to}`, testType, cefrLevel })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
