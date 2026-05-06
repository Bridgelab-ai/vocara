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

const TENSE_THRESHOLDS = { past: 20, future: 50 }
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
