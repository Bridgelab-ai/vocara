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
  { key: 'cooking',  emoji: '🍳', de: 'Kochen',    en: 'Cooking'   },
  { key: 'sports',   emoji: '⚽', de: 'Fußball',   en: 'Football'  },
  { key: 'music',    emoji: '🎵', de: 'Musik',     en: 'Music'     },
  { key: 'travel',   emoji: '✈️', de: 'Reisen',    en: 'Travel'    },
  { key: 'tech',     emoji: '💻', de: 'Technik',   en: 'Tech'      },
  { key: 'business', emoji: '💼', de: 'Business',  en: 'Business'  },
  { key: 'nature',   emoji: '🌿', de: 'Natur',     en: 'Nature'    },
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

export const SPEECH_LANGS = { en: 'en-GB', de: 'de-DE', sw: 'sw-KE', th: 'th-TH', fr: 'fr-FR', es: 'es-ES', ar: 'ar-SA', tr: 'tr-TR', pt: 'pt-PT' }

export function getToLangText(card, userToLang) {
  if (!card) return null
  const toLang = (userToLang || card.targetLang || card.langA || 'en').toLowerCase()
  if ((card.langA || '').toLowerCase() === toLang) return { text: card.front, langCode: toLang }
  if ((card.langB || '').toLowerCase() === toLang) return { text: card.back, langCode: toLang }
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
  else if (langTag === 'sw-KE') {
    const enFallback = voices.find(v => v.lang === 'en-US') || voices.find(v => v.lang.startsWith('en-'))
    if (enFallback) u.voice = enFallback
    u.lang = 'en-US'
  }
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
export function getCatLevel(masteredCount) {
  let lv = 0
  for (let i = 1; i <= 10; i++) { if (masteredCount >= CAT_LEVEL_THRESHOLDS[i]) lv = i }
  return lv
}
