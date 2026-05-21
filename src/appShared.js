export const AVAILABLE_LANGS = [
  { code: 'en', label: 'Englisch', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'sw', label: 'Swahili', flag: '🇰🇪' },
  { code: 'th', label: 'Thai', flag: '🇹🇭' },
  { code: 'es', label: 'Spanisch', flag: '🇪🇸' },
  { code: 'fr', label: 'Französisch', flag: '🇫🇷' },
  { code: 'ar', label: 'Arabisch', flag: '🇸🇦' },
  { code: 'tr', label: 'Türkisch', flag: '🇹🇷' },
  { code: 'pt', label: 'Portugiesisch', flag: '🇵🇹' },
]

export const TOPICS_LIST = [
  { key: 'kochen',      emoji: '🍳', de: 'Kochen',      en: 'Cooking'     },
  { key: 'liebe',       emoji: '❤️', de: 'Liebe',       en: 'Love'        },
  { key: 'sport',       emoji: '💪', de: 'Sport',       en: 'Sport'       },
  { key: 'film',        emoji: '🎬', de: 'Film',        en: 'Film'        },
  { key: 'musik',       emoji: '🎵', de: 'Musik',       en: 'Music'       },
  { key: 'reisen',      emoji: '✈️', de: 'Reisen',      en: 'Travel'      },
  { key: 'business',    emoji: '💼', de: 'Business',    en: 'Business'    },
  { key: 'natur',       emoji: '🌿', de: 'Natur',       en: 'Nature'      },
  { key: 'tech',        emoji: '💻', de: 'Tech',        en: 'Tech'        },
  { key: 'gesundheit',  emoji: '🏥', de: 'Gesundheit',  en: 'Health'      },
  { key: 'psychologie', emoji: '🧠', de: 'Psychologie', en: 'Psychology'  },
  { key: 'ausgehen',    emoji: '🍺', de: 'Ausgehen',    en: 'Going Out'   },
  { key: 'zahlen',      emoji: '🔢', de: 'Zahlen & Mathe', en: 'Numbers & Math' },
  { key: 'unterricht',  emoji: '🏫', de: 'Im Unterricht', en: 'In Class'   },
  { key: 'alphabet',    emoji: '🔤', de: 'Alphabet',    en: 'Alphabet'    },
]

export const CARD_GEN_SYSTEM = `You are a professional native-level translator and linguist.
STRICT RULES:
- NEVER translate word-for-word or literally
- Always use natural idiomatic expressions a native speaker would actually say
- German must sound like real spoken German, not textbook German
- Bad: 'Du musst wahrscheinlich aufhören aufzuschieben' — Good: 'Hör endlich auf zu prokrastinieren!'
- Check: would a native speaker say this? If not, rewrite.
- Prefer natural colloquial over grammatically perfect but unnatural
- Every translation must be 100% grammatically correct
Return ONLY valid JSON, no markdown, no explanation.`

export const MARK_UID = 'aiNZh4Myn8Y0KfYkGGrkNNW0HC72'
export const ELOSY_UID = 'NIX3DYenRdbRjmr2EHsIad9GcqG3'

export const SOCIAL_REGISTERS = [
  { key: 'friends',   emoji: '👥', labelDe: 'Kumpel',      labelEn: 'Friends'    },
  { key: 'couple',    emoji: '💑', labelDe: 'Große Liebe', labelEn: 'Partner'    },
  { key: 'colleague', emoji: '👔', labelDe: 'Kollege',     labelEn: 'Colleague'  },
  { key: 'family',    emoji: '👨‍👩‍👧', labelDe: 'Familie',    labelEn: 'Family'    },
]
export const socialRegisterLabel = (key, lang) => {
  const r = SOCIAL_REGISTERS.find(r => r.key === key) || SOCIAL_REGISTERS[0]
  return `${r.emoji} ${lang === 'de' ? r.labelDe : r.labelEn}`
}
export const socialRegisterContext = (key) => ({
  friends: 'close friends learning together (casual, warm, fun)',
  couple: 'romantic partners (intimate, playful, affectionate)',
  colleague: 'work colleagues (professional, respectful, practical)',
  family: 'family members (warm, supportive, generational)',
}[key] || 'friends')

export const TENSE_THRESHOLDS = { past: 20, future: 50 }
export const getTenseUnlocks = (mastered) => ({
  present: true,
  past:    mastered >= TENSE_THRESHOLDS.past,
  future:  mastered >= TENSE_THRESHOLDS.future,
})
export const TENSE_LABELS = {
  present: { de: 'Präsens',        en: 'Present', emoji: '⚡' },
  past:    { de: 'Vergangenheit',  en: 'Past',    emoji: '📖' },
  future:  { de: 'Zukunft',       en: 'Future',  emoji: '🔮' },
}

export const SPEECH_LANGS = { en: 'en-GB', de: 'de-DE', sw: 'sw-TZ', th: 'th-TH', fr: 'fr-FR', es: 'es-ES', ar: 'ar-SA', tr: 'tr-TR', pt: 'pt-PT' }

export function getToLangText(card, userToLang) {
  if (!card) return null
  const toLang = (userToLang || card.targetLang || card.langA || 'en').toLowerCase()
  if ((card.langA || '').toLowerCase() === toLang) return { text: card.front, langCode: toLang }
  if ((card.langB || '').toLowerCase() === toLang) return { text: card?.back, langCode: toLang }
  return null
}

export async function speak(text, langCode) {
  if (!window.speechSynthesis || !text) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const langTag = SPEECH_LANGS[langCode] || 'en-GB'
  u.lang = langTag; u.rate = 0.85
  const voices = await new Promise(resolve => {
    const v = window.speechSynthesis.getVoices()
    if (v.length) { resolve(v); return }
    window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices())
  })
  const preferred = voices.find(v => v.lang === langTag && v.name.toLowerCase().includes('google'))
    || voices.find(v => v.lang === langTag && !v.localService)
    || voices.find(v => v.lang.startsWith(langTag.split('-')[0]) && v.name.toLowerCase().includes('google'))
    || voices.find(v => v.lang.startsWith(langTag.split('-')[0]))
  if (preferred) { u.voice = preferred }
  else if (langTag === 'sw-TZ') { return } // no Swahili voice — silent is better than wrong pronunciation
  window.speechSynthesis.speak(u)
}

export function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0))
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}
export function fuzzyWordMatch(expected, got) {
  const e = expected.toLowerCase().replace(/[^\w]/g, '')
  const g = got.toLowerCase().replace(/[^\w]/g, '')
  if (!e || !g) return false
  const maxDist = Math.max(1, Math.floor(e.length * 0.4))
  return levenshtein(e, g) <= maxDist
}

export function todayStr() { return new Date().toISOString().split('T')[0] }

export function getISOWeekStr(date = new Date()) {
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

export function calcStreak(history) {
  if (!history || history.length === 0) return 0
  const dates = [...new Set(history.map(h => h.date))].sort().reverse()
  const today = todayStr()
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0] })()
  if (dates[0] !== today && dates[0] !== yesterday) return 0
  let streak = 0; let check = dates[0] === today ? today : yesterday
  for (const date of dates) {
    if (date === check) { streak++; const d = new Date(check); d.setDate(d.getDate() - 1); check = d.toISOString().split('T')[0] }
    else break
  }
  return streak
}

export function calcLongestStreak(history) {
  if (!history?.length) return 0
  const dates = [...new Set(history.map(h => h.date))].sort()
  if (!dates.length) return 0
  let maxStreak = 1, streak = 1
  for (let i = 1; i < dates.length; i++) {
    const [py, pm, pd] = dates[i - 1].split('-').map(Number)
    const prev = new Date(py, pm - 1, pd); prev.setDate(prev.getDate() + 1)
    const [cy, cm, cd] = dates[i].split('-').map(Number)
    const curr = new Date(cy, cm - 1, cd)
    if (prev.getTime() === curr.getTime()) { streak++; maxStreak = Math.max(maxStreak, streak) }
    else streak = 1
  }
  return maxStreak
}

const CAT_LEVEL_THRESHOLDS = [0, 1, 5, 10, 15, 20, 30, 40, 50, 65, 80]
export function getCatLevelFromCount(masteredCount) {
  let lv = 0
  for (let i = 1; i <= 10; i++) { if (masteredCount >= CAT_LEVEL_THRESHOLDS[i]) lv = i }
  return lv
}

// ── CONSTANTS ─────────────────────────────────────────────────
export const APP_VERSION = 'V01.092.171'

export const POOL_STRUCTURE = {
  grundlagen:   { totalLevels: 10, cardsPerLevel: 20 },
  vocab:        { totalLevels: 22, cardsPerLevel: 30 },
  street:       { totalLevels: 12, cardsPerLevel: 25 },
  home:         { totalLevels: 14, cardsPerLevel: 22 },
  urlaub:       { totalLevels: 10, cardsPerLevel: 20 },
  satztraining: { totalLevels: 14, cardsPerLevel: 22 },
  saetze:       { totalLevels: 10, cardsPerLevel: 20 },
}

export function getCatLevelKey(category, langPair) {
  return `${category}_${langPair}`
}

export function getCatLevel(categoryLevels, category, langPair) {
  const newKey = getCatLevelKey(category, langPair)
  const newVal = categoryLevels?.[newKey]
  if (newVal !== undefined) return newVal
  const legacyVal = categoryLevels?.[category]
  return legacyVal || 1
}

export function getActiveLangPairs(myData) {
  const fromLang = (myData?.fromLang || 'de').toLowerCase()
  const toLangs = myData?.toLangs?.length > 0
    ? myData.toLangs.map(l => l.lang.toLowerCase())
    : [myData?.toLang || 'en']
  return toLangs.map(to => `${fromLang}_${to}`)
}
export const SESSION_SIZE = 15
export const NEW_CARDS_BATCH = 3
export const MASTERY_THRESHOLD = 0.85
export const MONTHLY_TEST_DAYS = 30

export const PLANS = {
  free:      { label: 'Free',        features: ['grundlagen', 'alphabet', 'zahlen'] },
  premium:   { label: 'Premium',     price: '0.99€', features: ['all_categories', 'satztraining', 'sprachpuls'] },
  unlimited: { label: 'Unbegrenzt',  features: ['everything'] }
}

export function hasFeature(myData, feature) {
  const plan = myData?.plan || 'free'
  if (plan === 'unlimited') return true
  if (plan === 'premium') return PLANS.premium.features.includes(feature) || PLANS.free.features.includes(feature)
  return PLANS.free.features.includes(feature)
}

export const LANG_FLAGS = { en: '🇬🇧', de: '🇩🇪', sw: '🇰🇪', th: '🇹🇭', es: '🇪🇸', fr: '🇫🇷', ar: '🇸🇦', tr: '🇹🇷', pt: '🇵🇹' }

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
export const CEFR_COLORS = { A1: '#81c784', A2: '#4CAF50', B1: '#29b6f6', B2: '#1976d2', C1: '#ab47bc', C2: '#e53935' }
export const CEFR_MASTERY_REQ = { A1: 0, A2: 30, B1: 70, B2: 150, C1: 260, C2: 400 }
export const CEFR_DESC = {
  de: { A1: 'Anfänger', A2: 'Grundlagen', B1: 'Mittelstufe', B2: 'Fortgeschritten', C1: 'Kompetent', C2: 'Meister' },
  en: { A1: 'Beginner', A2: 'Elementary', B1: 'Intermediate', B2: 'Upper-Intermediate', C1: 'Advanced', C2: 'Mastery' },
}

const LEVEL_NAMES = [
  { upTo: 20,  de: 'Hafen-Neuling',   en: 'Harbor Newcomer' },
  { upTo: 50,  de: 'Elbe-Entdecker',  en: 'Elbe Explorer'   },
  { upTo: 100, de: 'Swahili-Freund',  en: 'Swahili Friend'  },
  { upTo: 200, de: 'Nairobi-Kenner',  en: 'Nairobi Expert'  },
  { upTo: 300, de: 'Brücken-Bauer',   en: 'Bridge Builder'  },
  { upTo: Infinity, de: 'Vocara-Meister', en: 'Vocara Master' },
]
export function getLevelName(masteredCount, lang) {
  const lv = LEVEL_NAMES.find(l => masteredCount <= l.upTo) || LEVEL_NAMES[LEVEL_NAMES.length - 1]
  return lang === 'de' ? lv.de : lv.en
}

export const WEEK_AREAS = [
  { key: 'vocabulary',   labelDe: 'Wörter',     labelEn: 'Words',     tipDe: 'Meine Worte – diese Woche noch nicht geübt',    tipEn: 'My Words – not practiced this week' },
  { key: 'saetze',       labelDe: 'Sätze',      labelEn: 'Sentences', tipDe: 'Werden Sätze – diese Woche noch nicht geübt',   tipEn: 'Sentences – not practiced this week' },
  { key: 'street',       labelDe: 'Straße',     labelEn: 'Street',    tipDe: 'Auf der Straße – diese Woche noch nicht geübt', tipEn: 'On the Street – not practiced this week' },
  { key: 'home',         labelDe: 'Zuhause',    labelEn: 'Home',      tipDe: 'Zu Hause – diese Woche noch nicht geübt',       tipEn: 'At Home – not practiced this week' },
  { key: 'satztraining', labelDe: 'Training',   labelEn: 'Training',  tipDe: 'Satztraining – diese Woche noch nicht geübt',   tipEn: 'Sentence Training – not practiced this week' },
  { key: 'basics',       labelDe: 'Grundlagen', labelEn: 'Basics',    tipDe: 'Grundlagen – noch nicht geübt',                 tipEn: 'Basics – not practiced yet' },
]

export function daysSince(dateStr) {
  if (!dateStr) return 9999
  return Math.floor((Date.now() - new Date(dateStr)) / 86400000)
}

// ── CARD CATEGORIES ───────────────────────────────────────────
export const VALID_CATEGORIES = [
  'vocabulary', 'sentence', 'street', 'home', 'basics',
  'grundlagen', 'vocab', 'saetze', 'urlaub', 'satztraining',
  'kochen', 'liebe', 'sport', 'film', 'musik', 'reisen',
  'business', 'natur', 'tech', 'gesundheit', 'psychologie', 'ausgehen'
]
export const VALID_CATEGORY_SET = new Set(VALID_CATEGORIES)

const DE_VOCAB_WHITELIST = new Set([
  'schließlich','jedoch','deshalb','trotzdem','eigentlich','vielleicht','natürlich',
  'außerdem','dennoch','daher','folglich','inzwischen','mittlerweile','allerdings',
  'meistens','manchmal','häufig','selten','bereits','wirklich','tatsächlich','leider',
  'hoffentlich','wahrscheinlich','offensichtlich','übrigens','zumindest','sogar',
  'vorher','nachher','seitdem','anschließend','zunächst','bisher','plötzlich',
  'irgendwie','irgendwann','irgendwo','ungefähr','überhaupt','sowieso','ohnehin',
  'jedenfalls','immerhin','schon','noch','wieder','weiterhin','gleichzeitig',
  'ansonsten','andererseits','einerseits','insgesamt','grundsätzlich','tatsächlich',
  'beispielsweise','beziehungsweise','normalerweise','üblicherweise','regelmäßig',
  'gelegentlich','ständig','dauerhaft','vorwiegend','hauptsächlich','besonders',
  'lediglich','ausschließlich','laut','gegenüber','entsprechend','bezüglich',
])
export function ruleCategory(card) {
  const front = card?.front || ''
  const back = card?.back || ''
  const words = front.trim().split(/\s+/).filter(Boolean)
  const backWords = back.trim().split(/\s+/).filter(Boolean)
  if (words.length === 1 && DE_VOCAB_WHITELIST.has(front.trim().toLowerCase())) return 'vocabulary'
  const swahiliRe = /\b(habari|yako|nzuri|asante|karibu|pole|sawa|jambo|mambo|rafiki|wewe|mimi|nina|hii|hilo|chakula|maji|nyumba|watoto|upendo)\b/i
  if (card.langA === 'sw' || card.pronunciation || swahiliRe.test(front)) return 'street'
  if (/['']/.test(front) || /\b(im|youre|its|lets|dont|cant|wont|ive|theyre|were|thats|whats|theres|ill|youll)\b/i.test(front)) return 'street'
  if (words.length === 1 && backWords.length >= 3) return 'street'
  if (words.length === 1) return 'vocabulary'
  if (/^to\s/i.test(front)) return 'vocabulary'
  if (front.trim().endsWith('?')) {
    const homeRe = /\b(love|miss|okay|home|eat|sleep|baby|darling|babe|honey)\b/i
    return homeRe.test(front) ? 'home' : 'sentence'
  }
  if (words.length >= 3) return 'sentence'
  return 'sentence'
}

export function buildCardPair(card) {
  if (!card || !card.front || !card.back) return []
  const targetLang = card.langA
  const raw = card.category || ruleCategory(card)
  const category = VALID_CATEGORY_SET.has(raw) ? raw : 'vocabulary'
  const forwardCard = { ...card, targetLang, category }
  const meanings = (card?.back || '').split(' / ').map(m => m.trim()).filter(Boolean)
  let reversedCards
  if (meanings.length > 1) {
    reversedCards = meanings.map((meaning, i) => ({
      ...card, id: `${card.id}_r_${i}`, front: meaning, back: card.front,
      langA: card.langB, langB: card.langA, targetLang, category,
    }))
  } else {
    reversedCards = [{ ...card, id: `${card.id}_r`, front: card?.back, back: card.front, langA: card.langB, langB: card.langA, targetLang, category }]
  }
  return [forwardCard, ...reversedCards]
}

export function buildSession(allCards, cardProgress, maxCards = SESSION_SIZE) {
  const today = todayStr()
  const forced = [], due = [], newCards = []
  allCards.forEach(card => {
    const p = cardProgress[card.id]
    if (!p) newCards.push(card)
    else if (p.wrongSessions > 0) forced.push(card)
    else if (p.nextReview <= today) due.push(card)
  })
  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)
  const alwaysNew = newCards.slice(0, Math.min(3, newCards.length, maxCards))
  const dueCards = [...forced, ...due].slice(0, Math.max(0, maxCards - alwaysNew.length))
  return shuffle([...alwaysNew, ...dueCards]).slice(0, maxCards)
}

export function checkMastery(allCards, cardProgress, sessionCorrect, sessionTotal) {
  const active = allCards.filter(c => {
    const p = cardProgress[c.id]
    return p && (p.interval > 0 || p.wrongSessions > 0)
  })
  if (active.length < 20) return false
  if (sessionTotal > 0 && sessionCorrect / sessionTotal < 0.6) return false
  const mastered = active.filter(c => (cardProgress[c.id]?.interval || 0) >= 7)
  return mastered.length / active.length >= MASTERY_THRESHOLD
}

export function getNextNewCards(allCards, cardProgress, count) {
  const unstarted = allCards.filter(c => !cardProgress[c.id])
  const unstartedEN = unstarted.filter(c => c.targetLang === 'en')
  const unstartedSW = unstarted.filter(c => c.targetLang === 'sw')
  if (unstartedEN.length >= count) return unstartedEN.slice(0, count)
  const maxSW = Math.max(0, Math.floor(count * 0.2))
  const swCards = unstartedSW.slice(0, Math.min(maxSW, count - unstartedEN.length))
  return [...unstartedEN, ...swCards].slice(0, count)
}

// ── SESSION STATE (Firebase) ──────────────────────────────────
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from './firebase'

export async function saveSessionHistory(uid, correct, total, currentHistory, extraUpdate) {
  const entry = { date: todayStr(), correct, total, ts: Date.now() }
  const updated = [entry, ...(currentHistory || [])].slice(0, 60)
  await updateDoc(doc(db, 'users', uid), { sessionHistory: updated, ...(extraUpdate || {}) })
  return updated
}

export async function saveSessionState(uid, queue, index, newProgress) {
  try { await setDoc(doc(db, 'users', uid, 'session', 'current'), { queue, index, newProgress, savedAt: Date.now() }) }
  catch (e) { console.warn('Could not save session state:', e) }
}

export async function clearSessionState(uid) {
  try { await deleteDoc(doc(db, 'users', uid, 'session', 'current')) }
  catch (e) { console.warn('Could not clear session state:', e) }
}
