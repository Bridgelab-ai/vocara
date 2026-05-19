// Vocab pool generator — POST /api/generate-vocab-pool
// Body: { level: 1-22, from?, to? } — Writes to sharedCards/{pair}_vocab_level{N}
import { POOL_STRUCTURE, LANGUAGE_PAIRS, getRarity, markImportant } from './_poolStructure.js'
export const config = { api: { bodyParser: false } }

const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili' }
const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/vocara-ca2b7/databases/(default)/documents'

const PAIRS = LANGUAGE_PAIRS.map(p => { const [from, to] = p.split('_'); return { from, to } })

// 22 level definitions: topic focus + difficulty progression (pairs share same focus)
const LEVEL_SPEC = {
  1:  { focus: 'Action verbs in infinitive only — 30 unique verbs: run/jump/throw/catch/push/pull/hit/carry/drop/lift/climb/swim/drive/fly/cut/open/close/build/break/fix/wash/clean/cook/pour/mix/stir/chop/fry/bake/serve', diff: 'A1' },
  2:  { focus: 'Action verbs in infinitive only — 30 unique verbs: run/jump/throw/catch/push/pull/hit/carry/drop/lift/climb/swim/drive/fly/cut/open/close/build/break/fix/wash/clean/cook/pour/mix/stir/chop/fry/bake/serve', diff: 'A1' },
  3:  { focus: 'Communication verbs in infinitive only — 30 unique verbs: say/ask/answer/explain/tell/describe/discuss/argue/agree/disagree/promise/warn/suggest/advise/complain/praise/greet/introduce/invite/refuse/announce/confirm/deny/demand/request/repeat/translate/summarize/quote/respond', diff: 'A1-A2' },
  4:  { focus: 'Communication verbs in infinitive only — 30 unique verbs: say/ask/answer/explain/tell/describe/discuss/argue/agree/disagree/promise/warn/suggest/advise/complain/praise/greet/introduce/invite/refuse/announce/confirm/deny/demand/request/repeat/translate/summarize/quote/respond', diff: 'A2' },
  5:  { focus: 'Emotion verbs in infinitive only — 30 unique verbs: love/hate/fear/hope/miss/enjoy/prefer/regret/forgive/trust/doubt/envy/admire/celebrate/mourn/suffer/comfort/encourage/inspire/disappoint/worry/relax/surprise/shock/impress/bore/amuse/upset/frustrate/satisfy', diff: 'A2' },
  6:  { focus: 'Emotion verbs in infinitive only — 30 unique verbs: love/hate/fear/hope/miss/enjoy/prefer/regret/forgive/trust/doubt/envy/admire/celebrate/mourn/suffer/comfort/encourage/inspire/disappoint/worry/relax/surprise/shock/impress/bore/amuse/upset/frustrate/satisfy', diff: 'A2-B1' },
  7:  { focus: 'Cognitive verbs in infinitive only — 30 unique verbs: think/believe/understand/forget/remember/know/learn/study/imagine/realize/consider/decide/choose/plan/expect/notice/recognize/assume/conclude/wonder/analyze/compare/evaluate/judge/predict/solve/create/invent/discover/explore', diff: 'B1' },
  8:  { focus: 'Cognitive verbs in infinitive only — 30 unique verbs: think/believe/understand/forget/remember/know/learn/study/imagine/realize/consider/decide/choose/plan/expect/notice/recognize/assume/conclude/wonder/analyze/compare/evaluate/judge/predict/solve/create/invent/discover/explore', diff: 'B1' },
  9:  { focus: 'Separable verbs infinitive form — 30 unique: aufmachen/anrufen/mitnehmen/zurückgehen/einladen/aufhören/anfangen/vorstellen/zuhören/abholen/ausgehen/einkaufen/umziehen/aufstehen/weitermachen/vorbereiten/herunterladen/aufräumen/anziehen/ausziehen/einschlafen/aufwachen/zurückkommen/weitergehen/hinzufügen/herausfinden/nachdenken/mitmachen/aufpassen/durchführen', diff: 'B1-B2' },
  10: { focus: 'Separable verbs infinitive form — 30 unique: aufmachen/anrufen/mitnehmen/zurückgehen/einladen/aufhören/anfangen/vorstellen/zuhören/abholen/ausgehen/einkaufen/umziehen/aufstehen/weitermachen/vorbereiten/herunterladen/aufräumen/anziehen/ausziehen/einschlafen/aufwachen/zurückkommen/weitergehen/hinzufügen/herausfinden/nachdenken/mitmachen/aufpassen/durchführen', diff: 'B2' },
  11: { focus: 'Reflexive verbs with sich — 30 unique: sich freuen/sich waschen/sich erinnern/sich vorstellen/sich ärgern/sich beeilen/sich interessieren/sich kümmern/sich befinden/sich erholen/sich entscheiden/sich verlieben/sich beschweren/sich irren/sich treffen/sich gewöhnen/sich fühlen/sich setzen/sich legen/sich bewegen/sich ändern/sich entwickeln/sich unterscheiden/sich handeln/sich ereignen/sich ergeben/sich herausstellen/sich anmelden/sich abmelden/sich verspäten', diff: 'B2' },
  12: { focus: 'Reflexive verbs with sich — 30 unique: sich freuen/sich waschen/sich erinnern/sich vorstellen/sich ärgern/sich beeilen/sich interessieren/sich kümmern/sich befinden/sich erholen/sich entscheiden/sich verlieben/sich beschweren/sich irren/sich treffen/sich gewöhnen/sich fühlen/sich setzen/sich legen/sich bewegen/sich ändern/sich entwickeln/sich unterscheiden/sich handeln/sich ereignen/sich ergeben/sich herausstellen/sich anmelden/sich abmelden/sich verspäten', diff: 'B2-C1' },
  13: { focus: 'Modal and auxiliary verbs with short example phrases — 30 unique entries: können (ich kann schwimmen)/müssen (du musst gehen)/wollen (er will essen)/sollen (sie soll kommen)/dürfen (wir dürfen bleiben)/mögen (ich mag Musik)/werden (es wird regnen)/lassen (lass mich)/haben+Partizip (ich habe gegessen)/sein+Partizip (er ist gegangen) — expand to 30 unique examples', diff: 'B2' },
  14: { focus: 'Modal and auxiliary verbs with short example phrases — 30 unique entries: können (ich kann schwimmen)/müssen (du musst gehen)/wollen (er will essen)/sollen (sie soll kommen)/dürfen (wir dürfen bleiben)/mögen (ich mag Musik)/werden (es wird regnen)/lassen (lass mich)/haben+Partizip (ich habe gegessen)/sein+Partizip (er ist gegangen) — expand to 30 unique examples', diff: 'B2-C1' },
  15: { focus: 'Nouns only — 30 unique: clothing (shirt/pants/dress/shoes/hat/coat/scarf/gloves/socks/underwear/jacket/belt/bag/glasses/ring/tie/skirt/boots/swimsuit/pajamas) + household items (table/chair/bed/window/door/lamp/mirror/carpet/curtain/shelf/sink/toilet/shower/oven/fridge/washing machine/dishwasher/vacuum/iron/broom)', diff: 'B1' },
  16: { focus: 'Nouns only — 30 unique: clothing (shirt/pants/dress/shoes/hat/coat/scarf/gloves/socks/underwear/jacket/belt/bag/glasses/ring/tie/skirt/boots/swimsuit/pajamas) + household items (table/chair/bed/window/door/lamp/mirror/carpet/curtain/shelf/sink/toilet/shower/oven/fridge/washing machine/dishwasher/vacuum/iron/broom)', diff: 'B1-B2' },
  17: { focus: 'Nouns only — 30 unique: nature (tree/flower/river/mountain/sea/sky/cloud/stone/grass/forest/desert/island/volcano/waterfall/rainbow/sand/mud/cave/glacier/swamp) + technology (computer/phone/internet/electricity/engine/robot/satellite/vaccine/atom/DNA/microscope/telescope/battery/solar panel/network)', diff: 'B2' },
  18: { focus: 'Nouns only — 30 unique: nature (tree/flower/river/mountain/sea/sky/cloud/stone/grass/forest/desert/island/volcano/waterfall/rainbow/sand/mud/cave/glacier/swamp) + technology (computer/phone/internet/electricity/engine/robot/satellite/vaccine/atom/DNA/microscope/telescope/battery/solar panel/network)', diff: 'B2' },
  19: { focus: 'Adjectives only — 30 unique opposite pairs: hot-cold/fast-slow/big-small/heavy-light/hard-soft/rough-smooth/loud-quiet/bright-dark/rich-poor/strong-weak/deep-shallow/thick-thin/sharp-blunt/sweet-bitter/fresh-stale/wet-dry/full-empty/safe-dangerous/simple-complex/natural-artificial/modern-ancient/public-private/legal-illegal/positive-negative/real-fake', diff: 'B1' },
  20: { focus: 'Adjectives only — 30 unique opposite pairs: hot-cold/fast-slow/big-small/heavy-light/hard-soft/rough-smooth/loud-quiet/bright-dark/rich-poor/strong-weak/deep-shallow/thick-thin/sharp-blunt/sweet-bitter/fresh-stale/wet-dry/full-empty/safe-dangerous/simple-complex/natural-artificial/modern-ancient/public-private/legal-illegal/positive-negative/real-fake', diff: 'B1-B2' },
  21: { focus: 'Abstract nouns and complex linking words — 30 unique: freedom/justice/peace/love/hate/truth/lies/power/time/space/memory/dream/fear/hope/fate/luck/success/failure/change/progress — plus: despite/although/whereas/unless/provided that/as long as/in order to/due to/according to/instead of', diff: 'B2-C1' },
  22: { focus: 'Abstract nouns and complex linking words — 30 unique: freedom/justice/peace/love/hate/truth/lies/power/time/space/memory/dream/fear/hope/fate/luck/success/failure/change/progress — plus: despite/although/whereas/unless/provided that/as long as/in order to/due to/according to/instead of', diff: 'C1' },
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
        back: { stringValue: c?.back || '' },
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
