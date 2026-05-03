// Standalone Level 1 pool generator — calls Anthropic + Firestore REST directly
// No server needed. Reads ANTHROPIC_KEY from .env.local
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// ── Load .env.local ───────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dir, '..', '.env.local')
const envLines = readFileSync(envPath, 'utf8').split('\n')
for (const line of envLines) {
  const m = line.match(/^([A-Z_]+)="?([^"]*)"?$/)
  if (m) process.env[m[1]] = m[2]
}
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY
if (!ANTHROPIC_KEY) { console.error('No ANTHROPIC_KEY found'); process.exit(1) }

const FIRESTORE = 'https://firestore.googleapis.com/v1/projects/vocara-ca2b7/databases/(default)/documents'
const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili' }
const PAIRS = [{ from: 'de', to: 'en' }, { from: 'en', to: 'de' }, { from: 'de', to: 'sw' }]
const delay = ms => new Promise(r => setTimeout(r, ms))

// ── Anthropic call ────────────────────────────────────────────
async function callClaude(prompt, maxTokens = 4000, model = 'claude-haiku-4-5-20251001') {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Anthropic error: ${data.error?.message || res.status}`)
  const raw = (data.content?.[0]?.text || '').trim()
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON array in response')
  return JSON.parse(match[0])
}

// ── Firestore PATCH ───────────────────────────────────────────
async function patchDoc(path, fields, fieldMask) {
  const mask = fieldMask.map(f => `updateMask.fieldPaths=${f}`).join('&')
  const r = await fetch(`${FIRESTORE}/${path}?${mask}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }),
  })
  if (!r.ok) throw new Error(`Firestore ${r.status}: ${await r.text()}`)
}

// ── Helper: convert card to Firestore mapValue ────────────────
function cardMap(fields) {
  const out = {}
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === 'number') out[k] = { integerValue: String(v) }
    else out[k] = { stringValue: String(v ?? '') }
  }
  return { mapValue: { fields: out } }
}

const rnd = () => Math.random().toString(36).slice(2, 8)

// ══════════════════════════════════════════════════════════════
// GENERATORS
// ══════════════════════════════════════════════════════════════

async function genBase(from, to) {
  const fn = LANG_NAMES[from], tn = LANG_NAMES[to]
  const prompt = `Generate exactly 20 Level 1 Grundlagen flashcards for a ${fn} speaker learning ${tn}.
Cover equally: numbers 1-10, basic greetings (hello/goodbye/thanks/please), colors (red/blue/green/yellow/white), family members (mother/father/brother/sister).
All ${fn} fronts, ${tn} backs. Include phonetic pronunciation for ${tn}.
Return ONLY a valid JSON array (no markdown):
[{"front":"...","back":"...","pronunciation":"...","wordType":"number|greeting|color|family","category":"grundlagen","level":1}]`
  const cards = await callClaude(prompt)
  const values = cards.slice(0, 20).map(c => cardMap({
    id: `grundlagen_1_${from}_${to}_${rnd()}`,
    front: c.front || '', back: c.back || '', pronunciation: c.pronunciation || '',
    category: 'grundlagen', level: 1, tense: 'present', wordType: c.wordType || '',
    langA: from, langB: to, source: 'base-pool',
  }))
  const fields = {
    fromLang: { stringValue: from }, toLang: { stringValue: to },
    level: { integerValue: '1' }, category: { stringValue: 'grundlagen' },
    generatedAt: { stringValue: new Date().toISOString() },
    count: { integerValue: String(values.length) },
    cards: { arrayValue: { values } },
  }
  await patchDoc(`sharedCards/${from}_${to}_grundlagen_1`, fields, ['fromLang','toLang','level','category','generatedAt','count','cards'])
  return values.length
}

async function genVocab(from, to) {
  const fn = LANG_NAMES[from], tn = LANG_NAMES[to]
  const prompt = `Generate exactly 20 A1 beginner vocabulary flashcards for a ${fn} speaker learning ${tn}.
Cover: basic greetings (hello/goodbye/thank you/please/sorry), numbers 1-10, simple colors, family members (mother/father/sister/brother), basic objects (book/table/door/water/food).
Rules: front=word in ${fn}, back=accurate natural ${tn} translation, pronunciation=German-style phonetic for ${tn}, wordType=noun|verb|adjective|adverb|phrase, level=1.
Return ONLY a valid JSON array (no markdown):
[{"front":"...","back":"...","pronunciation":"...","wordType":"noun"}]`
  const cards = await callClaude(prompt)
  const values = cards.slice(0, 20).map(c => cardMap({
    id: `vocab_l1_${from}_${to}_${rnd()}`,
    front: c.front || '', back: c.back || '', pronunciation: c.pronunciation || '',
    category: 'vocabulary', wordType: c.wordType || 'noun', level: 1,
    tense: 'present', register: 'neutral', langA: from, langB: to, source: 'vocab-pool',
  }))
  const fields = {
    fromLang: { stringValue: from }, toLang: { stringValue: to },
    category: { stringValue: 'vocabulary' }, level: { integerValue: '1' },
    generatedAt: { stringValue: new Date().toISOString() },
    count: { integerValue: String(values.length) },
    cards: { arrayValue: { values } },
  }
  await patchDoc(`sharedCards/${from}_${to}_vocab_level1`, fields, ['fromLang','toLang','category','level','generatedAt','count','cards'])
  return values.length
}

async function genStreet(from, to) {
  const fn = LANG_NAMES[from], tn = LANG_NAMES[to]
  const prompt = `Generate exactly 20 A1-A2 basic casual phrase flashcards for a ${fn} speaker learning ${tn}.
Focus: casual greetings (hi/hey/sup), simple reactions (cool/wow/nice/sure/got it/ok), casual goodbyes, basic agreement/disagreement phrases that sound natural among friends.
Rules: front=phrase in ${fn} with brief context note in parentheses if needed, back=natural ${tn} equivalent (not literal), register=slang|informal|casual, level=1.
Return ONLY a valid JSON array (no markdown):
[{"front":"...","back":"...","pronunciation":"...","wordType":"phrase","register":"informal"}]`
  const cards = await callClaude(prompt)
  const values = cards.slice(0, 20).map(c => cardMap({
    id: `street_l1_${from}_${to}_${rnd()}`,
    front: c.front || '', back: c.back || '', pronunciation: c.pronunciation || '',
    category: 'street', wordType: 'phrase', level: 1, tense: 'present',
    register: c.register || 'informal', langA: from, langB: to, source: 'street-pool',
  }))
  const fields = {
    fromLang: { stringValue: from }, toLang: { stringValue: to },
    category: { stringValue: 'street' }, level: { integerValue: '1' },
    generatedAt: { stringValue: new Date().toISOString() },
    count: { integerValue: String(values.length) },
    cards: { arrayValue: { values } },
  }
  await patchDoc(`sharedCards/${from}_${to}_street_level1`, fields, ['fromLang','toLang','category','level','generatedAt','count','cards'])
  return values.length
}

async function genHome(from, to) {
  const fn = LANG_NAMES[from], tn = LANG_NAMES[to]
  const prompt = `Generate exactly 20 A1 basic home/household flashcards for a ${fn} speaker learning ${tn}.
Focus: absolute home basics — greetings like "Good morning", "How are you?", "Thank you", simple yes/no phrases at home, asking for help (please/come here/sit down), basic room names (kitchen/bedroom/bathroom).
Rules: front=natural phrase or sentence in ${fn}, back=natural ${tn} equivalent, tense=present, context=one short usage note in ${fn} max 6 words, level=1.
Return ONLY a valid JSON array (no markdown):
[{"front":"...","back":"...","tense":"present","context":"..."}]`
  const cards = await callClaude(prompt)
  const values = cards.slice(0, 20).map(c => cardMap({
    id: `home_l1_${from}_${to}_${rnd()}`,
    front: c.front || '', back: c.back || '',
    category: 'home', tense: c.tense || 'present', context: c.context || '',
    level: 1, langA: from, langB: to, source: 'home-pool',
  }))
  const fields = {
    fromLang: { stringValue: from }, toLang: { stringValue: to },
    category: { stringValue: 'home' }, level: { integerValue: '1' },
    generatedAt: { stringValue: new Date().toISOString() },
    count: { integerValue: String(values.length) },
    cards: { arrayValue: { values } },
  }
  await patchDoc(`sharedCards/${from}_${to}_home_level1`, fields, ['fromLang','toLang','category','level','generatedAt','count','cards'])
  return values.length
}

async function genSentenceFC(from, to) {
  const fn = LANG_NAMES[from], tn = LANG_NAMES[to]
  const THEMES = [
    { key: 'alltag', label: 'Alltag', theme: 'everyday situations: daily routines, shopping, weather, home life' },
    { key: 'reisen', label: 'Reisen', theme: 'travel: directions, transport basics' },
    { key: 'familie', label: 'Familie', theme: 'family and social life: simple family conversation' },
    { key: 'smalltalk', label: 'Smalltalk', theme: 'small talk: simple greetings and polite phrases' },
  ]
  const allCards = []
  for (const cat of THEMES) {
    const prompt = `Generate exactly 5 A1 sentence flashcards for a ${fn} speaker learning ${tn}.
Level 1/12 — very simple present tense sentences (5-7 words). Category: ${cat.label} — ${cat.theme}.
Rules: front=simple sentence in ${fn}, back=natural ${tn} translation, vocabCategory="${cat.key}".
Return ONLY a valid JSON array (no markdown):
[{"front":"...","back":"...","vocabCategory":"${cat.key}"}]`
    const cards = await callClaude(prompt, 1500)
    allCards.push(...cards.slice(0, 5))
    await delay(500)
  }
  const values = allCards.slice(0, 20).map(c => cardMap({
    id: `sentence_l1_${from}_${to}_${rnd()}`,
    front: c.front || '', back: c.back || '',
    category: 'sentence', vocabCategory: c.vocabCategory || '',
    level: 1, langA: from, langB: to, source: 'sentence-pool',
  }))
  const fields = {
    fromLang: { stringValue: from }, toLang: { stringValue: to },
    category: { stringValue: 'sentence' }, level: { integerValue: '1' },
    generatedAt: { stringValue: new Date().toISOString() },
    count: { integerValue: String(values.length) },
    cards: { arrayValue: { values } },
  }
  await patchDoc(`sharedCards/${from}_${to}_sentence_level1`, fields, ['fromLang','toLang','category','level','generatedAt','count','cards'])
  return values.length
}

async function genSatzTraining(from, to) {
  const fn = LANG_NAMES[from], tn = LANG_NAMES[to]
  const prompt = `Generate exactly 20 A1 beginner sentence training exercises (Level 1/12) for a ${fn} speaker learning ${tn}.
Grammar: simple present "to be/have", basic subject-verb. Vocab: colors, numbers 1-10, greetings, basic objects.
Mix 4 types (5 each): gap (fill [___]), order (arrange word chips), translation (full sentence), conjugation (conjugate verb).
Rules: questions/hints/explanations in ${fn}, answers in ${tn}, max 8 words per answer.
For "order" type: include "chips" array with shuffled words of the answer.
Return ONLY a valid JSON array (no markdown):
[{"type":"gap","question":"...","answer":"...","hint":"...","explanation":"..."},
{"type":"order","question":"Arrange:","chips":["w1","w2","w3"],"answer":"w1 w2 w3.","hint":"...","explanation":"..."}]`
  const exercises = await callClaude(prompt, 4000)
  const withLevel = exercises.slice(0, 20).map(ex => ({
    ...ex, level: 1,
  }))

  function toFsVal(v) {
    if (Array.isArray(v)) return { arrayValue: { values: v.map(w => ({ stringValue: String(w) })) } }
    if (typeof v === 'number') return { integerValue: String(v) }
    return { stringValue: String(v ?? '') }
  }

  const values = withLevel.map(ex => ({
    mapValue: {
      fields: Object.fromEntries(Object.entries(ex).map(([k, v]) => [k, toFsVal(v)]))
    }
  }))
  const fields = {
    exercises: { arrayValue: { values } },
    updatedAt: { stringValue: new Date().toISOString() },
    langPair: { stringValue: `${from}_${to}` },
    level: { integerValue: '1' },
    count: { integerValue: String(values.length) },
  }
  await patchDoc(`sharedExercises/${from}_${to}_satz_level1`, fields, ['exercises','updatedAt','langPair','level','count'])
  return values.length
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════

const JOBS = [
  // Base / Grundlagen — one per pair
  ...PAIRS.map(p => ({ label: `Base Grundlagen L1 ${p.from}→${p.to}`, fn: () => genBase(p.from, p.to) })),
  // Multi-pair generators
  ...PAIRS.map(p => ({ label: `Vocab L1 ${p.from}→${p.to}`, fn: () => genVocab(p.from, p.to) })),
  ...PAIRS.map(p => ({ label: `Street L1 ${p.from}→${p.to}`, fn: () => genStreet(p.from, p.to) })),
  ...PAIRS.map(p => ({ label: `Home L1 ${p.from}→${p.to}`, fn: () => genHome(p.from, p.to) })),
  ...PAIRS.map(p => ({ label: `Sentence FC L1 ${p.from}→${p.to}`, fn: () => genSentenceFC(p.from, p.to) })),
  ...PAIRS.map(p => ({ label: `Satz Training L1 ${p.from}→${p.to}`, fn: () => genSatzTraining(p.from, p.to) })),
]

async function main() {
  console.log(`\n▶ Level 1 pool generation — ${JOBS.length} jobs\n`)
  const results = []
  for (const { label, fn } of JOBS) {
    process.stdout.write(`  ▶ ${label}… `)
    try {
      const count = await fn()
      console.log(`✓ ${count} cards/exercises`)
      results.push({ label, ok: true, count })
    } catch (e) {
      console.log(`✕ ${e.message}`)
      results.push({ label, ok: false, error: e.message })
    }
    await delay(2000)
  }
  console.log('\n── Summary ──────────────────────────────────────────')
  results.forEach(r => {
    const icon = r.ok ? '✓' : '✕'
    const detail = r.ok ? `${r.count} items` : r.error
    console.log(`  ${icon} ${r.label} → ${detail}`)
  })
  const ok = results.filter(r => r.ok).length
  console.log(`\n  ${ok}/${results.length} succeeded\n`)
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
