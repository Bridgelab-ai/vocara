import React, { useState, useEffect, useRef, useCallback, Component } from 'react'
import { auth, db } from './firebase'
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, collection, addDoc, getDocs } from 'firebase/firestore'
import './App.css'

// ── APP PREFS CONTEXT (lightMode, cardSize) ─────────────────────
const AppPrefsContext = React.createContext({ lightMode: false, cardSize: 'normal' })

// ── THEME RESOLVER (applies light mode overrides) ─────────────
function resolveTheme(themeKey, lightMode = false) {
  const th = THEMES[themeKey] || THEMES.nairobi
  if (!lightMode) return th
  return {
    ...th,
    bg: '#F2F2F4',
    card: 'rgba(255,255,255,0.90)',
    text: '#1a1a1a',
    sub: '#666',
    border: 'rgba(0,0,0,0.10)',
    bgGrad: `radial-gradient(ellipse at 50% 0%, ${th.accent}18 0%, #EDEDF0 40%, #F2F2F4 100%)`,
  }
}

// ── SEASONAL OVERLAY ─────────────────────────────────────────
function getSeasonOverlay(themeKey) {
  const month = new Date().getMonth() + 1 // 1–12
  const isWinter = month === 12 || month <= 2
  const isSpring = month >= 3 && month <= 5
  const isSummer = month >= 6 && month <= 8
  if (themeKey === 'hamburg') {
    if (isWinter) return 'rgba(180,215,255,0.06)' // icy blue
    if (isSpring) return 'rgba(100,200,120,0.05)'  // soft green
    if (isSummer) return 'rgba(50,140,255,0.05)'   // bright blue
    return 'rgba(220,140,0,0.06)'                  // autumn amber
  }
  if (themeKey === 'nairobi') {
    if (isWinter) return 'rgba(210,160,60,0.07)'   // dry dusty warm
    if (isSpring) return 'rgba(0,160,60,0.06)'     // long rains green
    if (isSummer) return 'rgba(255,210,60,0.06)'   // crisp gold
    return 'rgba(140,160,180,0.06)'                // misty short rains
  }
  return null
}

const APP_VERSION = 'V01.032.023'

// Returns a language instruction appended to KI prompts so the AI responds in the user's native language
const kiRespondIn = (lang) => lang === 'de' ? 'Antworte auf Deutsch.' : 'Respond in English.'

// ── KATEGORIE-LEVELS (1-10) ─────────────────────────────────────
const CAT_LEVEL_THRESHOLDS = [0, 1, 5, 10, 15, 20, 30, 40, 50, 65, 80] // index = level; value = min mastered to reach it
const CAT_LEVEL_NAMES = {
  de: ['', 'Anfänger', 'Grundlagen', 'Aufbau', 'Mittelstufe', 'Fortgeschritten', 'Sicher', 'Gewandt', 'Kompetent', 'Experte', 'Fließend'],
  en: ['', 'Beginner', 'Basics', 'Building', 'Intermediate', 'Advanced', 'Confident', 'Fluent', 'Competent', 'Expert', 'Fluent'],
}
const getCatLevel = (masteredCount) => {
  let lv = 0
  for (let i = 1; i <= 10; i++) { if (masteredCount >= CAT_LEVEL_THRESHOLDS[i]) lv = i }
  return lv
}
const CAT_LEVEL_COLORS = ['','#81c784','#81c784','#4CAF50','#29b6f6','#1976d2','#7c4dff','#9c27b0','#e91e63','#ff5722','#FFD700']

// ── THEMEN (Unlock-System) ──────────────────────────────────────
const TOPICS_LIST = [
  { key: 'cooking',  emoji: '🍳', de: 'Kochen',    en: 'Cooking'   },
  { key: 'sports',   emoji: '⚽', de: 'Fußball',   en: 'Football'  },
  { key: 'music',    emoji: '🎵', de: 'Musik',     en: 'Music'     },
  { key: 'travel',   emoji: '✈️', de: 'Reisen',    en: 'Travel'    },
  { key: 'tech',     emoji: '💻', de: 'Technik',   en: 'Tech'      },
  { key: 'business', emoji: '💼', de: 'Business',  en: 'Business'  },
  { key: 'nature',   emoji: '🌿', de: 'Natur',     en: 'Nature'    },
]

// ── SOZIALES REGISTER ───────────────────────────────────────────
const SOCIAL_REGISTERS = [
  { key: 'friends',   emoji: '👥', labelDe: 'Kumpel',      labelEn: 'Friends'    },
  { key: 'couple',    emoji: '💑', labelDe: 'Große Liebe', labelEn: 'Partner'    },
  { key: 'colleague', emoji: '👔', labelDe: 'Kollege',     labelEn: 'Colleague'  },
  { key: 'family',    emoji: '👨‍👩‍👧', labelDe: 'Familie',    labelEn: 'Family'    },
]
const socialRegisterLabel = (key, lang) => {
  const r = SOCIAL_REGISTERS.find(r => r.key === key) || SOCIAL_REGISTERS[0]
  return `${r.emoji} ${lang === 'de' ? r.labelDe : r.labelEn}`
}
const socialRegisterContext = (key) => ({
  friends: 'close friends learning together (casual, warm, fun)',
  couple: 'romantic partners (intimate, playful, affectionate)',
  colleague: 'work colleagues (professional, respectful, practical)',
  family: 'family members (warm, supportive, generational)',
}[key] || 'friends')

// ── ZEITFORMEN STUFEN ───────────────────────────────────────────
const TENSE_THRESHOLDS = { past: 20, future: 50 }
const getTenseUnlocks = (mastered) => ({
  present: true,
  past:    mastered >= TENSE_THRESHOLDS.past,
  future:  mastered >= TENSE_THRESHOLDS.future,
})
const TENSE_LABELS = {
  present: { de: 'Präsens',        en: 'Present', emoji: '⚡' },
  past:    { de: 'Vergangenheit',  en: 'Past',    emoji: '📖' },
  future:  { de: 'Zukunft',       en: 'Future',  emoji: '🔮' },
}
const MARK_UID = 'aiNZh4Myn8Y0KfYkGGrkNNW0HC72'
const ELOSY_UID = 'NIX3DYenRdbRjmr2EHsIad9GcqG3'
const SESSION_SIZE = 15
const MASTERY_THRESHOLD = 0.85
const NEW_CARDS_BATCH = 3
const VERY_FAST_S = 3
const FAST_S = 7
const MEDIUM_S = 15
const MONTHLY_TEST_DAYS = 30

const THEMES = {
  nairobi: {
    name: '🌙 Nairobi',
    bg: '#0A0800', card: '#0F0C00', text: '#FFFFFF', sub: '#B8860B', border: '#2A2200',
    accent: '#FFD700', gold: '#FFD700', glowColor: '#FFD700', btnTextColor: '#0A0800',
    bgGrad: 'radial-gradient(ellipse at 50% 100%, #1C1800 0%, #0F0C00 40%, #0A0800 70%), radial-gradient(ellipse at 65% 60%, #141000 0%, transparent 50%), radial-gradient(ellipse at 30% 40%, #0D0A00 0%, transparent 50%)',
    metalGrad: 'linear-gradient(145deg, #FFF0A0 0%, #FFD700 30%, #B8860B 52%, #FFD700 72%, #FFF0A0 100%)',
    metalText: 'linear-gradient(90deg, #B8860B 0%, #FFF0A0 16%, #FFD700 33%, #FFF0A0 50%, #B8860B 66%, #FFF0A0 83%, #FFD700 100%)',
    btnFaceGrad: 'linear-gradient(90deg, #B8860B 0%, #FFD700 20%, #FFF0A0 40%, #FFD700 50%, #FFF0A0 60%, #FFD700 80%, #B8860B 100%)',
    shadow3d: '0 1px 0 rgba(255,240,160,0.5) inset, 0 -1px 0 rgba(0,0,0,0.7) inset, 0 4px 0 #B8860B, 0 6px 0 #8B6800, 0 8px 0 #5C4400, 0 10px 20px rgba(0,0,0,0.85)',
    shadowPressed: '0 1px 0 rgba(255,240,160,0.25) inset, 0 -1px 0 rgba(0,0,0,0.6) inset, 0 1px 0 #B8860B, 0 3px 8px rgba(0,0,0,0.75)',
  },
  hamburg: {
    name: '🌊 Hamburg',
    bg: '#050D18', card: '#0D1E30', text: '#E8F4FF', sub: '#5A9AC0', border: '#1B3A5C',
    accent: '#2E6B9E', gold: '#7AB8E8', glowColor: '#2E6B9E', btnTextColor: '#FFFFFF',
    bgGrad: 'radial-gradient(ellipse at 50% 0%, #1E4D8C 0%, #091E38 30%, #030C18 65%), radial-gradient(ellipse at 20% 95%, #0A1E38 0%, transparent 50%), radial-gradient(ellipse at 80% 85%, #06152A 0%, transparent 50%)',
    metalGrad: 'linear-gradient(145deg, #A8D8F0 0%, #4A8EC4 20%, #2E6B9E 40%, #1B3A5C 60%, #2E6B9E 80%, #A8D8F0 100%)',
    metalText: 'linear-gradient(90deg, #4A8EC4 0%, #A8D8F0 16%, #2E6B9E 33%, #E0F4FF 50%, #4A8EC4 66%, #A8D8F0 83%, #2E6B9E 100%)',
    btnFaceGrad: 'linear-gradient(90deg, #1B3A5C 0%, #2E6B9E 20%, #4A8EC4 40%, #7AB8E8 50%, #4A8EC4 60%, #2E6B9E 80%, #1B3A5C 100%)',
    shadow3d: '0 1px 0 rgba(168,216,240,0.4) inset, 0 -1px 0 rgba(0,0,0,0.5) inset, 0 4px 0 #1B3A5C, 0 6px 0 #112440, 0 8px 0 #081828, 0 10px 20px rgba(0,20,60,0.8)',
    shadowPressed: '0 1px 0 rgba(168,216,240,0.2) inset, 0 -1px 0 rgba(0,0,0,0.4) inset, 0 1px 0 #1B3A5C, 0 3px 8px rgba(0,20,60,0.6)',
  },
  welt: {
    name: '🌍 Welt',
    bg: '#060410', card: '#0e0a1e', text: '#fff', sub: '#7A70A0', border: '#1A1430',
    accent: '#FF6B6B', gold: '#FFD93D', glowColor: '#C77DFF', btnTextColor: '#fff',
    rainbow: true,
    bgGrad: [
      'radial-gradient(ellipse at 15% 40%, #FF6B6B28 0%, transparent 45%)',
      'radial-gradient(ellipse at 85% 20%, #4D96FF28 0%, transparent 45%)',
      'radial-gradient(ellipse at 50% 85%, #6BCB7728 0%, transparent 45%)',
      'radial-gradient(ellipse at 75% 65%, #C77DFF28 0%, transparent 40%)',
      'radial-gradient(ellipse at 30% 70%, #FFD93D22 0%, transparent 40%)',
      '#060410',
    ].join(', '),
    metalGrad: 'linear-gradient(145deg, #FF6B6B, #FFD93D, #6BCB77, #4D96FF, #C77DFF, #FF6B6B)',
    metalText: 'linear-gradient(90deg, #C77DFF 0%, #FF6B6B 16%, #FFD93D 33%, #6BCB77 50%, #4D96FF 66%, #C77DFF 83%, #FF6B6B 100%)',
    btnFaceGrad: 'linear-gradient(90deg, #C77DFF 0%, #FF6B6B 16%, #FFD93D 33%, #6BCB77 50%, #4D96FF 66%, #C77DFF 83%, #FF6B6B 100%)',
    shadow3d: '0 1px 0 rgba(255,255,255,0.3) inset, 0 -1px 0 rgba(0,0,0,0.5) inset, 0 4px 0 #9B3BFF, 0 6px 0 #7B1BDF, 0 8px 0 #3D008F, 0 10px 20px rgba(0,0,0,0.75)',
    shadowPressed: '0 1px 0 rgba(255,255,255,0.15) inset, 0 -1px 0 rgba(0,0,0,0.4) inset, 0 1px 0 #7B1BDF, 0 3px 8px rgba(0,0,0,0.6)',
  },
}

const VOICE_MAP = {
  'EN': ['en-GB', 'en-US'],
  'DE': ['de-DE', 'de-AT', 'de-CH'],
  'SW': ['sw-KE', 'sw-TZ'],
}

const CARD_GEN_SYSTEM = `You are a professional native-level translator and linguist.
STRICT RULES:
- NEVER translate word-for-word or literally
- Always use natural idiomatic expressions a native speaker would actually say
- German must sound like real spoken German, not textbook German
- Bad: 'Du musst wahrscheinlich aufhören aufzuschieben' — Good: 'Hör endlich auf zu prokrastinieren!'
- Check: would a native speaker say this? If not, rewrite.
- Prefer natural colloquial over grammatically perfect but unnatural
- Every translation must be 100% grammatically correct
Return ONLY valid JSON, no markdown, no explanation.`

const AVAILABLE_LANGS = [
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

const LANG_FLAGS = { en: '🇬🇧', de: '🇩🇪', sw: '🇰🇪', th: '🇹🇭', es: '🇪🇸', fr: '🇫🇷', ar: '🇸🇦', tr: '🇹🇷', pt: '🇵🇹' }

const SPEECH_LANGS = { en: 'en-GB', de: 'de-DE', sw: 'sw-KE', th: 'th-TH', fr: 'fr-FR', es: 'es-ES', ar: 'ar-SA', tr: 'tr-TR', pt: 'pt-PT' }
// Returns { text, langCode } for the TARGET language side of a card.
// userToLang (from Firestore profile) takes priority over card.targetLang.
// All comparisons are case-insensitive (Firestore may store 'EN' or 'en').
// Returns null only if the card has no text at all — callers should handle null.
function getToLangText(card, userToLang) {
  if (!card) return null
  const toLang = (userToLang || card.targetLang || card.langA || 'en').toLowerCase()
  if ((card.langA || '').toLowerCase() === toLang) return { text: card.front, langCode: toLang }
  if ((card.langB || '').toLowerCase() === toLang) return { text: card.back, langCode: toLang }
  return null // never guess — silence is better than speaking the wrong language
}

async function speak(text, langCode) {
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
    // No Swahili voice available — fall back to en-US to avoid system default (e.g. de-DE)
    const enFallback = voices.find(v => v.lang === 'en-US') || voices.find(v => v.lang.startsWith('en-'))
    if (enFallback) u.voice = enFallback
    u.lang = 'en-US'
  }
  window.speechSynthesis.speak(u)
}
async function speakSyllable(text, langCode) {
  if (!window.speechSynthesis || !text) return
  window.speechSynthesis.cancel()
  const langTag = SPEECH_LANGS[langCode] || 'en-GB'
  const voices = await new Promise(resolve => {
    const v = window.speechSynthesis.getVoices()
    if (v.length) { resolve(v); return }
    window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices())
  })
  const preferred = voices.find(v => v.lang === langTag && v.name.toLowerCase().includes('google'))
    || voices.find(v => v.lang === langTag && !v.localService)
    || voices.find(v => v.lang.startsWith(langTag.split('-')[0]) && v.name.toLowerCase().includes('google'))
    || voices.find(v => v.lang.startsWith(langTag.split('-')[0]))
  const swFallback = (!preferred && langTag === 'sw-KE')
    ? (voices.find(v => v.lang === 'en-US') || voices.find(v => v.lang.startsWith('en-')))
    : null
  const effectiveLang = swFallback ? 'en-US' : langTag
  const effectiveVoice = preferred || swFallback || null
  const words = text.trim().split(/\s+/).filter(Boolean)
  words.forEach((word, i) => {
    setTimeout(() => {
      const u = new SpeechSynthesisUtterance(word)
      u.lang = effectiveLang; u.rate = 0.9
      if (effectiveVoice) u.voice = effectiveVoice
      window.speechSynthesis.speak(u)
    }, i * 400)
  })
}

const PLACEMENT_EN = [
  { id: 'p_en_1', level: 'A1', question: 'What does "Hello" mean?', options: ['Hallo', 'Tschüss', 'Danke', 'Bitte'], correct: 0 },
  { id: 'p_en_2', level: 'A1', question: 'What does "I am tired" mean?', options: ['Ich bin hungrig', 'Ich bin müde', 'Ich bin glücklich', 'Ich bin krank'], correct: 1 },
  { id: 'p_en_3', level: 'A1', question: 'How do you say "Good morning"?', options: ['Good night', 'Good evening', 'Good morning', 'Goodbye'], correct: 2 },
  { id: 'p_en_4', level: 'A1', question: '"What is your name?" means...', options: ['Wie alt bist du?', 'Wo wohnst du?', 'Wie heißt du?', 'Was machst du?'], correct: 2 },
  { id: 'p_en_5', level: 'A1', question: 'Which is correct: "I ___ a student."', options: ['am', 'is', 'are', 'be'], correct: 0 },
  { id: 'p_en_6', level: 'A1', question: '"Thank you" auf Deutsch:', options: ['Entschuldigung', 'Bitte', 'Danke', 'Hallo'], correct: 2 },
  { id: 'p_en_7', level: 'A1', question: 'What does "Where are you from?" mean?', options: ['Wie geht es dir?', 'Woher kommst du?', 'Was machst du?', 'Wo bist du?'], correct: 1 },
  { id: 'p_en_8', level: 'A1', question: 'Which word means "house"?', options: ['Car', 'House', 'Tree', 'Book'], correct: 1 },
  { id: 'p_en_9', level: 'A1', question: '"She ___ to school every day."', options: ['go', 'goes', 'going', 'gone'], correct: 1 },
  { id: 'p_en_10', level: 'A1', question: '"Goodbye" auf Deutsch:', options: ['Hallo', 'Auf Wiedersehen', 'Bitte', 'Danke'], correct: 1 },
  { id: 'p_en_11', level: 'A2', question: '"I have been waiting for an hour." Was bedeutet das?', options: ['Ich warte seit einer Stunde', 'Ich habe eine Stunde gewartet und bin fertig', 'Ich will eine Stunde warten', 'Ich warte nicht'], correct: 0 },
  { id: 'p_en_12', level: 'A2', question: 'Which sentence is in the past tense?', options: ['I go to work', 'I am going to work', 'I went to work', 'I will go to work'], correct: 2 },
  { id: 'p_en_13', level: 'A2', question: '"Never mind" bedeutet...', options: ['Niemals denken', 'Vergiss es / Schon gut', 'Auf keinen Fall', 'Keine Ahnung'], correct: 1 },
  { id: 'p_en_14', level: 'A2', question: 'Complete: "She ___ (not) like coffee."', options: ["don't", "doesn't", "isn't", "aren't"], correct: 1 },
  { id: 'p_en_15', level: 'A2', question: '"What\'s the catch?" bedeutet...', options: ['Was ist das?', 'Fang es!', 'Wo ist der Haken?', 'Was kostet das?'], correct: 2 },
  { id: 'p_en_16', level: 'A2', question: 'Which is correct?', options: ['I have saw this film', 'I have seen this film', 'I have see this film', 'I seen this film'], correct: 1 },
  { id: 'p_en_17', level: 'A2', question: '"I\'m on it" means...', options: ['Ich bin drauf', 'Ich kümmere mich darum', 'Ich bin dabei', 'Ich bin weg'], correct: 1 },
  { id: 'p_en_18', level: 'A2', question: 'Choose the correct question:', options: ['Where you live?', 'Where do you live?', 'Where lives you?', 'Where you are living?'], correct: 1 },
  { id: 'p_en_19', level: 'A2', question: '"Hang in there" means...', options: ['Häng es dort auf', 'Halte durch', 'Komm her', 'Warte kurz'], correct: 1 },
  { id: 'p_en_20', level: 'A2', question: '"I\'ll keep you posted" bedeutet...', options: ['Ich schreibe dir Postkarten', 'Ich halte dich auf dem Laufenden', 'Ich folge dir', 'Ich bleibe'], correct: 1 },
  { id: 'p_en_21', level: 'B1', question: '"Despite the rain, we ___ the game."', options: ['finished', 'have been finishing', 'are finishing', 'had finish'], correct: 0 },
  { id: 'p_en_22', level: 'B1', question: '"Under the weather" means...', options: ['Draußen im Regen', 'Kränklich / Nicht auf der Höhe', 'Bei schlechtem Wetter', 'Wettervorhersage'], correct: 1 },
  { id: 'p_en_23', level: 'B1', question: 'Which word fits? "The meeting was ___."', options: ['bored', 'boring', 'bore', 'boringly'], correct: 1 },
  { id: 'p_en_24', level: 'B1', question: '"I\'m swamped" means...', options: ['Ich bin nass', 'Ich bin total überlastet', 'Ich bin erschöpft', 'Ich bin verloren'], correct: 1 },
  { id: 'p_en_25', level: 'B1', question: 'Complete: "If I ___ you, I would apologize."', options: ['am', 'was', 'were', 'be'], correct: 2 },
  { id: 'p_en_26', level: 'B1', question: '"Bear with me" means...', options: ['Komm mit mir', 'Hab Geduld mit mir', 'Kämpf mit mir', 'Bleib bei mir'], correct: 1 },
  { id: 'p_en_27', level: 'B1', question: 'Correct passive: "The report ___ by Tuesday."', options: ['will complete', 'will be completing', 'will be completed', 'will have complete'], correct: 2 },
  { id: 'p_en_28', level: 'B1', question: '"Break a leg!" means...', options: ['Brich dir ein Bein!', 'Hals- und Beinbruch!', 'Beeil dich!', 'Pass auf!'], correct: 1 },
  { id: 'p_en_29', level: 'B1', question: 'Which is most formal?', options: ["I can't make it", 'I am unable to attend', "I won't be there", "I'm not coming"], correct: 1 },
  { id: 'p_en_30', level: 'B1', question: '"Let\'s make up" means...', options: ['Lass uns schminken', 'Lass uns etwas erfinden', 'Lass uns versöhnen', 'Lass uns aufhören'], correct: 2 },
  { id: 'p_en_31', level: 'B2', question: '"The project ___ by the time the client arrives."', options: ['will finish', 'will have been finished', 'will be finishing', 'finishes'], correct: 1 },
  { id: 'p_en_32', level: 'B2', question: 'What does "ambiguous" mean?', options: ['Eindeutig', 'Mehrdeutig / Zweideutig', 'Unmöglich', 'Unbekannt'], correct: 1 },
  { id: 'p_en_33', level: 'B2', question: '"Had she known, she ___ differently."', options: ['would act', 'would have acted', 'will act', 'acted'], correct: 1 },
  { id: 'p_en_34', level: 'B2', question: '"It\'s not my cup of tea" means...', options: ['Ich mag keinen Tee', 'Das ist nicht meins / nicht mein Ding', 'Das ist zu teuer', 'Das gehört mir nicht'], correct: 1 },
  { id: 'p_en_35', level: 'B2', question: 'Which word means "to postpone"?', options: ['To hasten', 'To defer', 'To cancel', 'To confirm'], correct: 1 },
  { id: 'p_en_36', level: 'B2', question: '"That\'s a bummer" is...', options: ['Formell', 'Umgangssprachlich', 'Beleidigend', 'Fachsprachlich'], correct: 1 },
  { id: 'p_en_37', level: 'B2', question: '"The more you practice, ___ you become."', options: ['the better', 'the more better', 'more better', 'better'], correct: 0 },
  { id: 'p_en_38', level: 'B2', question: '"No cap" means...', options: ['Keine Mütze', 'Im Ernst / Kein Witz', 'Kein Problem', 'Keine Möglichkeit'], correct: 1 },
  { id: 'p_en_39', level: 'B2', question: 'Correct use of "despite"?', options: ['Despite of the cost, we proceeded', 'Despite the cost, we proceeded', 'Despite that the cost, we proceeded', 'Despite to the cost, we proceeded'], correct: 1 },
  { id: 'p_en_40', level: 'B2', question: '"Piece of cake" refers to...', options: ['Ein Kuchen', 'Eine leichte Aufgabe', 'Ein Stück Arbeit', 'Etwas Süßes'], correct: 1 },
  { id: 'p_en_41', level: 'C1', question: '"The legislation was enacted ___ public opposition."', options: ['despite of', 'in spite', 'notwithstanding', 'regardless'], correct: 2 },
  { id: 'p_en_42', level: 'C1', question: 'What does "to corroborate" mean?', options: ['Widersprechen', 'Bestätigen / Bekräftigen', 'Untersuchen', 'Verweigern'], correct: 1 },
  { id: 'p_en_43', level: 'C1', question: 'Identify the subjunctive: "I suggest that he ___ present."', options: ['is', 'was', 'be', 'were'], correct: 2 },
  { id: 'p_en_44', level: 'C1', question: '"Ostensibly" means...', options: ['Offensichtlich falsch', 'Dem Anschein nach', 'Tatsächlich', 'Heimlich'], correct: 1 },
  { id: 'p_en_45', level: 'C1', question: '"She was ___ in her refusal to compromise."', options: ['adamant', 'ambivalent', 'amenable', 'apathetic'], correct: 0 },
  { id: 'p_en_46', level: 'C1', question: 'Which is a cleft sentence?', options: ['I saw John yesterday', 'It was John that I saw yesterday', 'John I saw yesterday', 'Yesterday John was seen'], correct: 1 },
  { id: 'p_en_47', level: 'C1', question: '"To prevaricate" means...', options: ['Voraus planen', 'Ausweichen / Herumreden', 'Übertreiben', 'Vorhersagen'], correct: 1 },
  { id: 'p_en_48', level: 'C1', question: '"Not only ___ the proposal, but she also funded it."', options: ['she supported', 'did she support', 'she did support', 'supported she'], correct: 1 },
  { id: 'p_en_49', level: 'C1', question: '"Equivocal" means...', options: ['Eindeutig', 'Gleichwertig', 'Zweideutig', 'Gleichmütig'], correct: 2 },
  { id: 'p_en_50', level: 'C1', question: 'Which uses an absolute phrase?', options: ['Running quickly, he caught the bus', 'The task completed, they left the office', 'She was tired but kept working', 'Although tired, she kept working'], correct: 1 },
  { id: 'p_en_51', level: 'C2', question: '"The ___ of the argument lay in its internal contradictions."', options: ['fallacy', 'premise', 'corollary', 'axiom'], correct: 0 },
  { id: 'p_en_52', level: 'C2', question: 'What is a "hapax legomenon"?', options: ['Ein häufiges Wort', 'Ein Wort das nur einmal belegt ist', 'Ein veraltetes Wort', 'Ein Lehnwort'], correct: 1 },
  { id: 'p_en_53', level: 'C2', question: '"Perspicacious" means...', options: ['Hartnäckig', 'Scharfsinnig / Klug', 'Weitschweifig', 'Unbeständig'], correct: 1 },
  { id: 'p_en_54', level: 'C2', question: '"___ he may be talented, his work ethic leaves much to be desired."', options: ['Although', 'Albeit', 'Granted', 'Despite'], correct: 1 },
  { id: 'p_en_55', level: 'C2', question: '"Tendentious" describes writing that is...', options: ['Ausgewogen', 'Subjektiv / Tendenziös', 'Akademisch', 'Kreativ'], correct: 1 },
  { id: 'p_en_56', level: 'C2', question: 'What does "to gainsay" mean?', options: ['Beipflichten', 'Widersprechen / Leugnen', 'Bestätigen', 'Aussagen'], correct: 1 },
  { id: 'p_en_57', level: 'C2', question: '"The proposal was met with ___ from all quarters."', options: ['approbation', 'opprobrium', 'equanimity', 'probity'], correct: 1 },
  { id: 'p_en_58', level: 'C2', question: 'Identify the zeugma:', options: ['"She lost her keys and her temper"', '"He spoke quickly and loudly"', '"She was tall and elegant"', '"He walked fast and far"'], correct: 0 },
  { id: 'p_en_59', level: 'C2', question: '"Solipsistic" means...', options: ['Sozial', 'Egozentrisch / Nur auf sich selbst fokussiert', 'Altruistisch', 'Philosophisch'], correct: 1 },
  { id: 'p_en_60', level: 'C2', question: '"Weltanschauung" in English refers to...', options: ['World record', 'World view / Philosophy of life', 'World travel', 'World war'], correct: 1 },
]

const PLACEMENT_DE = [
  { id: 'p_de_1', level: 'A1', question: '"Hallo" auf Englisch:', options: ['Goodbye', 'Hello', 'Please', 'Thank you'], correct: 1 },
  { id: 'p_de_2', level: 'A1', question: '"Ich bin müde" means...', options: ['I am hungry', 'I am happy', 'I am tired', 'I am sick'], correct: 2 },
  { id: 'p_de_3', level: 'A1', question: 'Which article is correct? "___ Buch"', options: ['der', 'die', 'das', 'den'], correct: 2 },
  { id: 'p_de_4', level: 'A1', question: '"Wie heißt du?" means...', options: ['How old are you?', 'Where are you from?', 'What is your name?', 'How are you?'], correct: 2 },
  { id: 'p_de_5', level: 'A1', question: 'Complete: "Ich ___ aus Kenia."', options: ['bin', 'komme', 'wohne', 'heiße'], correct: 1 },
  { id: 'p_de_6', level: 'A1', question: '"Danke schön" means...', options: ['Excuse me', 'Please', 'Thank you very much', 'Sorry'], correct: 2 },
  { id: 'p_de_7', level: 'A1', question: 'Which is correct? "Ich ___ Elosy."', options: ['bin', 'heiße', 'habe', 'bin heiße'], correct: 1 },
  { id: 'p_de_8', level: 'A1', question: '"Guten Morgen" means...', options: ['Good night', 'Good afternoon', 'Good morning', 'Good evening'], correct: 2 },
  { id: 'p_de_9', level: 'A1', question: 'What is "Wasser" in English?', options: ['Food', 'Water', 'Wine', 'Milk'], correct: 1 },
  { id: 'p_de_10', level: 'A1', question: '"Ich verstehe nicht" means...', options: ['I do not speak', 'I do not want', 'I do not understand', 'I do not know'], correct: 2 },
  { id: 'p_de_11', level: 'A2', question: 'Complete: "Gestern ___ ich ins Kino gegangen."', options: ['habe', 'bin', 'hatte', 'wurde'], correct: 1 },
  { id: 'p_de_12', level: 'A2', question: '"Ich freue mich" means...', options: ['I am sad', 'I am bored', 'I am looking forward to it', 'I am surprised'], correct: 2 },
  { id: 'p_de_13', level: 'A2', question: 'Which case? "Ich gebe ___ Mann das Buch."', options: ['der', 'die', 'dem', 'den'], correct: 2 },
  { id: 'p_de_14', level: 'A2', question: '"Du fehlst mir" means...', options: ['You forgot me', 'I miss you', 'You are missing something', 'You are wrong'], correct: 1 },
  { id: 'p_de_15', level: 'A2', question: 'Complete: "Das ist ___ teuer." (too)', options: ['sehr', 'viel', 'zu', 'mehr'], correct: 2 },
  { id: 'p_de_16', level: 'A2', question: '"Kannst du das wiederholen?" means...', options: ['Can you translate that?', 'Can you repeat that?', 'Can you explain that?', 'Can you write that?'], correct: 1 },
  { id: 'p_de_17', level: 'A2', question: 'Correct plural: "das Kind →"', options: ['die Kinds', 'die Kinder', 'die Kinde', 'die Kindern'], correct: 1 },
  { id: 'p_de_18', level: 'A2', question: '"Ich bin stolz auf dich" means...', options: ['I am angry at you', 'I am thinking of you', 'I am proud of you', 'I am waiting for you'], correct: 2 },
  { id: 'p_de_19', level: 'A2', question: 'Complete: "___ du Deutsch?"', options: ['Kannst', 'Sprichst', 'Machst', 'Lernst'], correct: 1 },
  { id: 'p_de_20', level: 'A2', question: '"Alles wird gut" means...', options: ['All is lost', 'Everything is fine now', 'Everything will be okay', 'All is well'], correct: 2 },
  { id: 'p_de_21', level: 'B1', question: 'Complete: "Wenn ich Zeit ___, käme ich."', options: ['habe', 'hatte', 'hätte', 'haben'], correct: 2 },
  { id: 'p_de_22', level: 'B1', question: '"Das ist lecker" means...', options: ['That is expensive', 'That is delicious', 'That is interesting', 'That is strange'], correct: 1 },
  { id: 'p_de_23', level: 'B1', question: 'Correct reflexive: "Ich ___ die Hände."', options: ['wasche mir', 'wasche mich', 'wasche', 'wäsche mir'], correct: 0 },
  { id: 'p_de_24', level: 'B1', question: '"Ich lerne Deutsch, ___ ich in Deutschland arbeiten möchte."', options: ['aber', 'weil', 'obwohl', 'wenn'], correct: 1 },
  { id: 'p_de_25', level: 'B1', question: 'Passive: "Man baut das Haus." →', options: ['Das Haus wird gebaut', 'Das Haus ist gebaut', 'Das Haus baut sich', 'Das Haus wurde bauen'], correct: 0 },
  { id: 'p_de_26', level: 'B1', question: '"Entschuldigung" is used to...', options: ['Greet someone', 'Say goodbye', 'Apologize or get attention', 'Express joy'], correct: 2 },
  { id: 'p_de_27', level: 'B1', question: 'Complete: "Er sagte, er ___ krank."', options: ['ist', 'sei', 'war', 'wäre'], correct: 1 },
  { id: 'p_de_28', level: 'B1', question: '"Bis bald" means...', options: ['See you tomorrow', 'See you soon', 'See you later today', 'Goodbye forever'], correct: 1 },
  { id: 'p_de_29', level: 'B1', question: '"Trotz ___ Regens gingen wir spazieren."', options: ['der', 'dem', 'des', 'die'], correct: 2 },
  { id: 'p_de_30', level: 'B1', question: '"Was machst du?" formally becomes...', options: ['Was machen Sie?', 'Was macht ihr?', 'Was machst du?', 'Was machen wir?'], correct: 0 },
  { id: 'p_de_31', level: 'B2', question: '"Angesichts der Lage ___ wir handeln."', options: ['müssen', 'müssten', 'muss', 'müsste'], correct: 0 },
  { id: 'p_de_32', level: 'B2', question: 'What does "die Nachhaltigkeit" mean?', options: ['Die Vergangenheit', 'Die Zukunft', 'Die Nachhaltigkeit', 'Sustainability'], correct: 3 },
  { id: 'p_de_33', level: 'B2', question: '"Wenn er früher gekommen ___, hätten wir mehr Zeit gehabt."', options: ['war', 'wäre', 'ist', 'würde'], correct: 1 },
  { id: 'p_de_34', level: 'B2', question: '"Zweischneidiges Schwert" means...', options: ['Ein scharfes Schwert', 'Double-edged sword', 'Eine Waffe', 'Ein altes Sprichwort'], correct: 1 },
  { id: 'p_de_35', level: 'B2', question: 'Correct Genitiv?', options: ['Das Auto meiner Mutter', 'Das Auto von meine Mutter', "Das Auto meiner Mutter's", 'Das Auto meiner Mutters'], correct: 0 },
  { id: 'p_de_36', level: 'B2', question: '"Schließlich" is best translated as...', options: ['Finally / Eventually', 'Unfortunately', 'Nevertheless', 'Meanwhile'], correct: 0 },
  { id: 'p_de_37', level: 'B2', question: 'Correct Relativsatz?', options: ['Das Buch, das ich lese, ist interessant.', 'Das Buch, was ich lese, ist interessant.', 'Das Buch, den ich lese, ist interessant.', 'Das Buch, die ich lese, ist interessant.'], correct: 0 },
  { id: 'p_de_38', level: 'B2', question: '"Ungeachtet" means...', options: ['Trotzdem', 'Deswegen', 'Infolgedessen', 'Regardless of'], correct: 3 },
  { id: 'p_de_39', level: 'B2', question: '"Je mehr man lernt, ___ man weiß."', options: ['desto mehr', 'umso viel', 'desto viel', 'je mehr'], correct: 0 },
  { id: 'p_de_40', level: 'B2', question: '"Auf dem Laufenden bleiben" means...', options: ['Weiter rennen', 'Stay informed', 'Stay on track', 'Keep running'], correct: 1 },
  { id: 'p_de_41', level: 'C1', question: '"Zeitigt" in "Die Maßnahme zeitigt Erfolge" means...', options: ['Verzögert', 'Zeigt / Bringt hervor', 'Beendet', 'Gefährdet'], correct: 1 },
  { id: 'p_de_42', level: 'C1', question: '"Das Problem ___ noch nicht ___." (Zustandspassiv)', options: ['ist / gelöst', 'wird / gelöst', 'hat / gelöst', 'wäre / gelöst'], correct: 0 },
  { id: 'p_de_43', level: 'C1', question: '"Inwiefern" asks...', options: ['Why', 'In what way / To what extent', 'How often', 'Since when'], correct: 1 },
  { id: 'p_de_44', level: 'C1', question: '"Gleichwohl" is a synonym for...', options: ['Deswegen', 'Nichtsdestotrotz / Nevertheless', 'Folglich', 'Einerseits'], correct: 1 },
  { id: 'p_de_45', level: 'C1', question: 'Correct "als ob" usage?', options: ['Er tut so, als ob er schläft.', 'Er tut so, als ob er schläfe.', 'Er tut so, als ob er schlafen.', 'Er tut so, als er schläft.'], correct: 1 },
  { id: 'p_de_46', level: 'C1', question: '"Subtil" means...', options: ['Offensichtlich', 'Fein / Kaum wahrnehmbar', 'Grob', 'Laut'], correct: 1 },
  { id: 'p_de_47', level: 'C1', question: 'The "Fugenelement" in "Arbeitsplatz" is...', options: ['-s-', '-en-', '-e-', null], correct: 0 },
  { id: 'p_de_48', level: 'C1', question: '"Dessen ungeachtet" means...', options: ['Infolgedessen', 'Regardless of that', 'Thanks to that', 'As a result'], correct: 1 },
  { id: 'p_de_49', level: 'C1', question: 'Correct "brauchen" usage?', options: ['Du brauchst nicht zu kommen.', 'Du brauchst nicht kommen.', 'Du nicht brauchst zu kommen.', 'Du brauchst kommen nicht.'], correct: 0 },
  { id: 'p_de_50', level: 'C1', question: '"Ambivalent" means...', options: ['Eindeutig positiv', 'Zwiespältig / Gemischt', 'Klar ablehnend', 'Vollkommen neutral'], correct: 1 },
  { id: 'p_de_51', level: 'C2', question: '"Zirkelschluss" means...', options: ['Kreisförmige Bewegung', 'Circular reasoning', 'Abschluss einer Debatte', 'Runder Tisch'], correct: 1 },
  { id: 'p_de_52', level: 'C2', question: '"Konzedieren" means...', options: ['Konzentrieren', 'Einräumen / Zugeben', 'Konzipieren', 'Kritisieren'], correct: 1 },
  { id: 'p_de_53', level: 'C2', question: 'Which is an "Anakoluth"?', options: ['Ein Satz ohne Verb', 'Ein grammatisch nicht zu Ende geführter Satz', 'Ein Palindrom', 'Ein Satz mit doppelter Verneinung'], correct: 1 },
  { id: 'p_de_54', level: 'C2', question: '"Lapidar" means...', options: ['Lang und ausführlich', 'Kurz und treffend / knapp', 'Unverständlich', 'Feierlich'], correct: 1 },
  { id: 'p_de_55', level: 'C2', question: '"Das Haar in der Suppe suchen" means...', options: ['Kochen', 'An allem etwas auszusetzen haben', 'Sauber sein', 'Kleinigkeiten genießen'], correct: 1 },
  { id: 'p_de_56', level: 'C2', question: '"Apodiktisch" describes...', options: ['Fragend', 'Unbedingt wahr / Unbestreitbar', 'Vermutend', 'Widersprüchlich'], correct: 1 },
  { id: 'p_de_57', level: 'C2', question: 'What is a "Hendiadyoin"?', options: ['Ein Wortspiel', 'Ausdruck eines Begriffs durch zwei Wörter', 'Ein Fremdwort', 'Eine Übertreibung'], correct: 1 },
  { id: 'p_de_58', level: 'C2', question: '"Perspektivisch" in academic writing means...', options: ['In Bezug auf Farbe', 'Aus einer bestimmten Sichtweise betrachtet', 'Langfristig geplant', 'Geometrisch'], correct: 1 },
  { id: 'p_de_59', level: 'C2', question: '"Distinktion" means...', options: ['Unterscheidung / Feine Differenz', 'Auszeichnung allein', 'Ablehnung', 'Zustimmung'], correct: 0 },
  { id: 'p_de_60', level: 'C2', question: '"Tautologisch" describes...', options: ['Etwas Widersprüchliches', 'Etwas das dasselbe zweimal sagt', 'Etwas Unbekanntes', 'Etwas Übertriebenes'], correct: 1 },
]

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const CEFR_COLORS = { A1: '#81c784', A2: '#4CAF50', B1: '#29b6f6', B2: '#1976d2', C1: '#ab47bc', C2: '#e53935' }
// Cards mastered needed to REACH that level
const CEFR_MASTERY_REQ = { A1: 0, A2: 30, B1: 70, B2: 150, C1: 260, C2: 400 }
const LEVEL_NAMES = [
  { upTo: 20,  de: 'Hafen-Neuling',   en: 'Harbor Newcomer' },
  { upTo: 50,  de: 'Elbe-Entdecker',  en: 'Elbe Explorer'   },
  { upTo: 100, de: 'Swahili-Freund',  en: 'Swahili Friend'  },
  { upTo: 200, de: 'Nairobi-Kenner',  en: 'Nairobi Expert'  },
  { upTo: 300, de: 'Brücken-Bauer',   en: 'Bridge Builder'  },
  { upTo: Infinity, de: 'Vocara-Meister', en: 'Vocara Master' },
]
function getLevelName(masteredCount, lang) {
  const lv = LEVEL_NAMES.find(l => masteredCount <= l.upTo) || LEVEL_NAMES[LEVEL_NAMES.length - 1]
  return lang === 'de' ? lv.de : lv.en
}
const CEFR_DESC = {
  de: { A1: 'Anfänger', A2: 'Grundlagen', B1: 'Mittelstufe', B2: 'Fortgeschritten', C1: 'Kompetent', C2: 'Meister' },
  en: { A1: 'Beginner', A2: 'Elementary', B1: 'Intermediate', B2: 'Upper-Intermediate', C1: 'Advanced', C2: 'Mastery' },
}

// ── TAGES-PHRASE ─────────────────────────────────────────────
const DAILY_PHRASES_EN = [
  { phrase: "Every day is a step forward.", translation: "Jeder Tag ist ein Schritt nach vorne." },
  { phrase: "You don't have to be perfect to be amazing.", translation: "Du musst nicht perfekt sein, um großartig zu sein." },
  { phrase: "Small progress is still progress.", translation: "Kleiner Fortschritt ist immer noch Fortschritt." },
  { phrase: "The best time to learn was yesterday. The second best is now.", translation: "Der beste Zeitpunkt zu lernen war gestern. Der zweitbeste ist jetzt." },
  { phrase: "Mistakes are proof that you are trying.", translation: "Fehler beweisen, dass du es versuchst." },
  { phrase: "A new word is a new world.", translation: "Ein neues Wort ist eine neue Welt." },
  { phrase: "Language is the road map of a culture.", translation: "Sprache ist die Landkarte einer Kultur." },
  { phrase: "You are closer than you think.", translation: "Du bist näher dran als du denkst." },
  { phrase: "Keep going. You are doing great.", translation: "Mach weiter. Du machst das großartig." },
  { phrase: "One language sets you in a corridor for life.", translation: "Eine Sprache setzt dich in einen Korridor fürs Leben." },
  { phrase: "To learn a language is to have one more window.", translation: "Eine Sprache zu lernen bedeutet, ein Fenster mehr zu haben." },
  { phrase: "Fluency comes one word at a time.", translation: "Fließend sprechen kommt Wort für Wort." },
  { phrase: "The bridge begins with a single word.", translation: "Die Brücke beginnt mit einem einzigen Wort." },
  { phrase: "Consistency beats perfection every time.", translation: "Beständigkeit schlägt Perfektion jedes Mal." },
  { phrase: "Your effort today is tomorrow's confidence.", translation: "Dein Einsatz heute ist das Selbstvertrauen von morgen." },
  { phrase: "Every expert was once a beginner.", translation: "Jeder Experte war einmal ein Anfänger." },
  { phrase: "Learning never exhausts the mind.", translation: "Lernen erschöpft den Geist nie." },
  { phrase: "The more you learn, the more places you belong.", translation: "Je mehr du lernst, desto mehr Orte gehören dir." },
  { phrase: "Words are the currency of connection.", translation: "Worte sind die Währung der Verbindung." },
  { phrase: "You are building something beautiful.", translation: "Du baust etwas Wunderschönes auf." },
  { phrase: "A different language is a different vision of life.", translation: "Eine andere Sprache ist eine andere Sicht auf das Leben." },
  { phrase: "The voice is the bridge.", translation: "Die Stimme ist die Brücke." },
]
const DAILY_PHRASES_DE = [
  { phrase: "Jeder Tag ist eine neue Chance.", translation: "Every day is a new chance." },
  { phrase: "Kleine Schritte führen zu großen Zielen.", translation: "Small steps lead to big goals." },
  { phrase: "Fortschritt, nicht Perfektion.", translation: "Progress, not perfection." },
  { phrase: "Du lernst nicht nur eine Sprache — du baust eine Brücke.", translation: "You are not just learning a language — you are building a bridge." },
  { phrase: "Fehler sind der Anfang des Lernens.", translation: "Mistakes are the beginning of learning." },
  { phrase: "Heute besser als gestern.", translation: "Better today than yesterday." },
  { phrase: "Eine Sprache öffnet eine Tür zur Welt.", translation: "One language opens a door to the world." },
  { phrase: "Übung macht den Meister.", translation: "Practice makes perfect." },
  { phrase: "Du bist stärker als du denkst.", translation: "You are stronger than you think." },
  { phrase: "Wer aufhört zu lernen, hört auf zu wachsen.", translation: "Those who stop learning stop growing." },
  { phrase: "Jedes Wort bringt dich näher.", translation: "Every word brings you closer." },
  { phrase: "Die Stimme ist die Brücke.", translation: "The voice is the bridge." },
  { phrase: "Sprache ist das Herz der Verbindung.", translation: "Language is the heart of connection." },
  { phrase: "Bleib dran — es lohnt sich.", translation: "Keep going — it's worth it." },
  { phrase: "Mut beginnt mit einem einzigen Wort.", translation: "Courage begins with a single word." },
]
function getDailyPhrase(lang) {
  const pool = lang === 'de' ? DAILY_PHRASES_EN : DAILY_PHRASES_DE
  const today = new Date()
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000)
  return pool[dayOfYear % pool.length]
}

const ALL_MARK_CARDS_BASE = [
  { id: 'en_1', front: "What's the catch?", back: "Wo ist der Haken?", context: "Sie bot mir alles an — ich fragte trotzdem: What's the catch? Manchmal ist Vorsicht die klügere Brücke.", langA: 'en', langB: 'de' },
  { id: 'en_2', front: "Long story short...", back: "Um es kurz zu machen...", context: "Drei Stunden, zwei Länder, ein Missverständnis — long story short: wir lachten am Ende.", langA: 'en', langB: 'de' },
  { id: 'en_3', front: "I'm down.", back: "Ich bin dabei.", context: "Spontaner Ausflug um Mitternacht? I'm down — manche Entscheidungen trifft man mit dem Herzen.", langA: 'en', langB: 'de' },
  { id: 'en_4', front: "I'm heading out.", back: "Ich mache mich auf den Weg.", context: "I'm heading out — der Zug wartet nicht, aber Gedanken reisen schneller als jeder Fahrplan.", langA: 'en', langB: 'de' },
  { id: 'en_5', front: "Give me a heads up.", back: "Gib mir kurz Bescheid.", context: "Wenn du kommst, give me a heads up — ich möchte da sein, wenn du ankommst.", langA: 'en', langB: 'de' },
  { id: 'en_6', front: "I'm on it.", back: "Ich kümmere mich darum.", context: "Keine Sorge — I'm on it. Manchmal ist das die stärkste Antwort, die man geben kann.", langA: 'en', langB: 'de' },
  { id: 'en_7', front: "I'm devastated.", back: "Ich bin am Boden zerstört.", context: "Als der Zug abfuhr ohne sie — I'm devastated. Aber Züge kommen wieder.", langA: 'en', langB: 'de' },
  { id: 'en_8', front: "Never mind.", back: "Vergiss es. / Schon gut.", context: "Never mind — manchmal ist Loslassen klüger als jede Erklärung.", langA: 'en', langB: 'de' },
  { id: 'en_9', front: "I'm on my way.", back: "Ich bin unterwegs.", context: "I'm on my way — drei Wörter, die alles bedeuten können.", langA: 'en', langB: 'de' },
  { id: 'en_10', front: "What's going on?", back: "Was ist hier los?", context: "Sie hörte die Stille durch die Leitung. What's going on? — manchmal fragt man und meint: Ich vermisse dich.", langA: 'en', langB: 'de' },
  { id: 'en_11', front: "To be honest...", back: "Um ehrlich zu sein...", context: "To be honest — der mutigste Satzanfang, den es gibt. Sprache beginnt, wo Masken fallen.", langA: 'en', langB: 'de' },
  { id: 'en_12', front: "Take care!", back: "Pass auf dich auf!", context: "Take care — nicht nur Abschied. Ein kleines Versprechen, das man mit auf den Weg gibt.", langA: 'en', langB: 'de' },
  { id: 'en_13', front: "Keep me posted.", back: "Halt mich auf dem Laufenden.", context: "Keep me posted — weil Entfernung kein Grund ist, nicht dabei zu sein.", langA: 'en', langB: 'de' },
  { id: 'en_14', front: "I'll let you know.", back: "Ich gebe dir Bescheid.", context: "I'll let you know sobald ich lande — die Brücke beginnt mit einem einzigen Satz.", langA: 'en', langB: 'de' },
  { id: 'en_15', front: "It's up to you.", back: "Es liegt an dir.", context: "It's up to you — die schwersten Worte, die man jemandem schenken kann: echte Freiheit.", langA: 'en', langB: 'de' },
  { id: 'en_16', front: "I'll keep you posted.", back: "Ich halte dich auf dem Laufenden.", context: "I'll keep you posted — Verbindung braucht keine Nähe, nur den Willen, Worte zu schicken.", langA: 'en', langB: 'de' },
  { id: 'en_17', front: "Make up your mind!", back: "Entscheide dich!", context: "Make up your mind — das Leben wartet eine Weile. Aber nicht ewig.", langA: 'en', langB: 'de' },
  { id: 'en_18', front: "I'm literally starving!", back: "Ich habe Riesenhunger!", context: "Nach zwölf Stunden im Führerstand: I'm literally starving — und das ist kein bisschen übertrieben.", langA: 'en', langB: 'de' },
  { id: 'en_19', front: "For real?", back: "Echt jetzt? / Im Ernst?", context: "For real? — manchmal ist echtes Staunen die ehrlichste Reaktion auf eine gute Nachricht.", langA: 'en', langB: 'de' },
  { id: 'en_20', front: "Piece of cake!", back: "Ein Kinderspiel!", context: "Das Formular ausfüllen? Piece of cake — sagte er, bevor er dreimal von vorne anfing.", langA: 'en', langB: 'de' },
  { id: 'en_21', front: "No biggie.", back: "Kein Ding.", context: "No biggie — die Kunst, Gelassenheit zu zeigen, obwohl man innerlich tief aufatmet.", langA: 'en', langB: 'de' },
  { id: 'en_22', front: "My bad.", back: "Mein Fehler.", context: "My bad — kurz, klar, aufrichtig. Mehr braucht es manchmal nicht.", langA: 'en', langB: 'de' },
  { id: 'en_23', front: "No way!", back: "Auf keinen Fall!", context: "No way! — ob Überraschung oder Ablehnung: der Tonfall entscheidet alles.", langA: 'en', langB: 'de' },
  { id: 'en_24', front: "Make it clear.", back: "Mach es unmissverständlich klar.", context: "Make it clear — Missverständnisse wachsen im Schweigen. Worte sind das Licht dagegen.", langA: 'en', langB: 'de' },
  { id: 'en_25', front: "Let's make up.", back: "Lass uns uns versöhnen.", context: "Nach jedem Sturm: let's make up — die Brücke trägt mehr als Worte.", langA: 'en', langB: 'de' },
  { id: 'en_26', front: "Bear with me.", back: "Hab Geduld mit mir.", context: "Bear with me — ich finde die richtigen Worte. Ich verspreche es.", langA: 'en', langB: 'de' },
  { id: 'en_27', front: "Cut it out!", back: "Hör auf damit!", context: "Cut it out! — manchmal braucht es nur drei Worte, um alles zum Stillstand zu bringen.", langA: 'en', langB: 'de' },
  { id: 'en_28', front: "Hang in there.", back: "Halte durch.", context: "Hang in there — der schwierigste Rat, den man geben kann. Und der wichtigste.", langA: 'en', langB: 'de' },
  { id: 'en_29', front: "Actually", back: "Eigentlich / Tatsächlich", context: "I actually missed you more than I expected — manche Wahrheiten kommen langsam ans Licht.", langA: 'en', langB: 'de' },
  { id: 'en_30', front: "Basically", back: "Im Grunde / Grundsätzlich", context: "Basically — wenn man aufhört zu reden und zum Kern kommt. Das ist die eigentliche Brücke.", langA: 'en', langB: 'de' },
  { id: 'en_31', front: "Eventually", back: "Schließlich / Irgendwann", context: "Eventually wird die Entfernung kleiner — Schritt für Schritt, Wort für Wort.", langA: 'en', langB: 'de' },
  { id: 'en_32', front: "Probably", back: "Wahrscheinlich", context: "Probably the best decision I ever made — Gewissheit braucht manchmal einen Anlauf.", langA: 'en', langB: 'de' },
  { id: 'en_33', front: "Definitely", back: "Definitiv / Auf jeden Fall", context: "Definitely — wenn man ohne Zögern antwortet, weiß man, dass man es wirklich meint.", langA: 'en', langB: 'de' },
  { id: 'en_34', front: "Anyway", back: "Wie auch immer / Jedenfalls", context: "Anyway — das Wort, mit dem man weitermacht, auch wenn nichts nach Plan lief.", langA: 'en', langB: 'de' },
  { id: 'en_35', front: "Exactly", back: "Genau / Exakt", context: "Exactly — wenn zwei Menschen dasselbe denken, ohne es abgesprochen zu haben.", langA: 'en', langB: 'de' },
  { id: 'en_36', front: "My treat.", back: "Ich lade dich ein.", context: "My treat — weil Großzügigkeit keine Entfernung kennt und kein Anlass braucht.", langA: 'en', langB: 'de' },
  { id: 'en_37', front: "No cap.", back: "Kein Witz / Ungelogen.", context: "No cap — ich denke wirklich an dich. Jeden Tag. Das ist keine Floskel.", langA: 'en', langB: 'de' },
  { id: 'en_38', front: "Under the weather.", back: "Kränklich / Nicht auf der Höhe.", context: "Er klang under the weather — aber seine Stimme war trotzdem Heimat.", langA: 'en', langB: 'de' },
  { id: 'en_39', front: "Break a leg!", back: "Hals- und Beinbruch!", context: "Break a leg — gesagt mit echtem Stolz, nicht als Floskel, sondern als Glaube.", langA: 'en', langB: 'de' },
  { id: 'en_40', front: "That's a bummer.", back: "Das ist schade / blöd.", context: "That's a bummer — klein genug für Alltag, groß genug, dass man es teilen möchte.", langA: 'en', langB: 'de' },
  { id: 'en_41', front: "I'm swamped.", back: "Ich bin total überlastet.", context: "I'm swamped this week — aber kein Grund, die Verbindung abreißen zu lassen.", langA: 'en', langB: 'de' },
  { id: 'en_42', front: "Hit me up.", back: "Meld dich bei mir.", context: "Hit me up wenn du Zeit hast — die Tür steht immer offen, auch über Kontinente hinweg.", langA: 'en', langB: 'de' },
  { id: 'en_43', front: "It's not my cup of tea.", back: "Das ist nicht mein Ding.", context: "It's not my cup of tea — und das ist in Ordnung. Ehrlichkeit ist auch eine Brücke.", langA: 'en', langB: 'de' },
  { id: 'sw_1', front: "Jambo", back: "Hallo", pronunciation: "DSHAM-bo", context: "Jambo! — das erste Wort, das Nairobi dir entgegenwirft. Eine ganze Wärme in zwei Silben.", langA: 'sw', langB: 'de' },
  { id: 'sw_2', front: "Asante", back: "Danke", pronunciation: "ah-SAHN-teh", context: "Asante — weil Dankbarkeit in jeder Sprache dasselbe Gewicht trägt.", langA: 'sw', langB: 'de' },
  { id: 'sw_3', front: "Hapana", back: "Nein", pronunciation: "ha-PAH-na", context: "Hapana — klar, ruhig, respektvoll. Grenzen klingen auf Swahili genauso würdevoll.", langA: 'sw', langB: 'de' },
  { id: 'sw_4', front: "Ndiyo", back: "Ja", pronunciation: "NDI-yo", context: "Ndiyo — ein Wort, das Türen öffnet. Manchmal ist Zustimmung der Anfang von allem.", langA: 'sw', langB: 'de' },
  { id: 'sw_5', front: "Tafadhali", back: "Bitte", pronunciation: "ta-fad-HA-li", context: "Tafadhali — Höflichkeit braucht keine Übersetzung, sie fühlt sich überall gleich an.", langA: 'sw', langB: 'de' },
  { id: 'sw_6', front: "Habari yako?", back: "Wie geht es dir?", pronunciation: "ha-BAH-ri YAH-ko", context: "Habari yako? — mehr als eine Frage. Eine Einladung, sich zu zeigen.", langA: 'sw', langB: 'de' },
  { id: 'sw_7', front: "Anakuja", back: "Er/Sie kommt", pronunciation: "a-na-KU-ja", context: "Anakuja — drei Silben, die Vorfreude bedeuten. Jemand ist auf dem Weg.", langA: 'sw', langB: 'de' },
  { id: 'sw_8', front: "Ninakuja", back: "Ich komme", pronunciation: "ni-na-KU-ja", context: "Ninakuja — das Versprechen, das zählt. Ich bin unterwegs zu dir.", langA: 'sw', langB: 'de' },
  { id: 'sw_9', front: "Nakuja", back: "Ich komme (Kurzform)", pronunciation: "na-KU-ja", context: "Nakuja — kürzer, aber genauso aufrichtig. Die Stimme ist die Brücke.", langA: 'sw', langB: 'de' },
  { id: 'sw_10', front: "Nipee", back: "Gib mir", pronunciation: "ni-PEH-eh", context: "Nipee — eine direkte Bitte, ohne Umwege. Manchmal ist Klarheit das Größte.", langA: 'sw', langB: 'de' },
  { id: 'sw_11', front: "Sitaki", back: "Ich will nicht", pronunciation: "si-TAH-ki", context: "Sitaki — auch Nein sagen ist Kommunikation. Grenzen bauen Vertrauen.", langA: 'sw', langB: 'de' },
  { id: 'sw_12', front: "Chakula", back: "Essen", pronunciation: "cha-KU-la", context: "Chakula — Essen verbindet Menschen überall auf der Welt, auch über Ozeane hinweg.", langA: 'sw', langB: 'de' },
  { id: 'sw_13', front: "Sahani", back: "Teller", pronunciation: "sa-HA-ni", context: "Sahani — ein Teller geteilt ist eine Geste, die keine Übersetzung braucht.", langA: 'sw', langB: 'de' },
  { id: 'sw_14', front: "Ninakupenda", back: "Ich liebe dich", pronunciation: "ni-na-ku-PEN-da", context: "Ninakupenda — das wichtigste Wort, das man lernen kann. In jeder Sprache.", langA: 'sw', langB: 'de' },
  { id: 'sw_15', front: "Nakukosa", back: "Ich vermisse dich", pronunciation: "na-ku-KO-sa", context: "Nakukosa — Sehnsucht auf Swahili. Fünf Silben, die alles sagen.", langA: 'sw', langB: 'de' },
  { id: 'sw_16', front: "Lala salama", back: "Schlaf gut", pronunciation: "LA-la sa-LA-ma", context: "Lala salama — Gute Nacht über tausend Kilometer hinweg. Die Stimme überbrückt die Nacht.", langA: 'sw', langB: 'de' },
  { id: 'sw_17', front: "Pole pole", back: "Langsam / Sachte", pronunciation: "POH-leh POH-leh", context: "Pole pole — Nairobi erinnert dich manchmal: Nicht alles muss schnell gehen. Manche Dinge brauchen Zeit.", langA: 'sw', langB: 'de' },
  { id: 'sw_18', front: "Karibu", back: "Willkommen / Bitte (Einladung)", pronunciation: "ka-REE-bu", context: "Karibu — das wärmste Wort Kenias. Eine Einladung, die sagt: Du gehörst hierher.", langA: 'sw', langB: 'de' },
  { id: 'sw_19', front: "Samahani", back: "Entschuldigung / Tut mir leid", pronunciation: "sa-ma-HA-ni", context: "Samahani — Verzeihung braucht keine lange Erklärung. Manchmal reicht ein einziges Wort.", langA: 'sw', langB: 'de' },
  { id: 'sw_20', front: "Ninapenda", back: "Ich mag / Ich liebe", pronunciation: "ni-na-PEN-da", context: "Ninapenda — ohne Objekt gesagt, klingt es nach einem offenen Geheimnis. Die Brücke, die sich selbst erklärt.", langA: 'sw', langB: 'de' },
  { id: 'sw_21', front: "Wewe ni rafiki yangu", back: "Du bist mein Freund / meine Freundin", pronunciation: "WEH-weh ni ra-FEE-ki YAN-gu", context: "Wewe ni rafiki yangu — Freundschaft über Kontinente beginnt damit, sie auszusprechen.", langA: 'sw', langB: 'de' },
  { id: 'sw_22', front: "Tutaonana", back: "Bis bald / Wir sehen uns", pronunciation: "tu-ta-oh-NA-na", context: "Tutaonana — kein Abschied, sondern ein Versprechen. Wir sehen uns wieder.", langA: 'sw', langB: 'de' },
  { id: 'en_44', front: "I'm all in.", back: "Ich bin voll dabei.", context: "I'm all in — wenn die Entscheidung fällt, gibt es kein Halbherzig mehr. Ganz oder gar nicht.", langA: 'en', langB: 'de' },
  { id: 'en_45', front: "That's out of the question.", back: "Das kommt nicht in Frage.", context: "That's out of the question — manche Grenzen zieht man ruhig, aber unmissverständlich.", langA: 'en', langB: 'de' },
  { id: 'en_46', front: "Let's call it a day.", back: "Machen wir Schluss für heute.", context: "Let's call it a day — der Zug steht still, die Schicht ist vorbei. Manchmal ist aufhören Stärke.", langA: 'en', langB: 'de' },
  { id: 'en_47', front: "I'm on the fence.", back: "Ich bin unentschlossen.", context: "I'm on the fence — zwischen zwei Welten stehen und noch nicht wissen, auf welche Seite man springt.", langA: 'en', langB: 'de' },
  { id: 'en_48', front: "It's now or never.", back: "Jetzt oder nie.", context: "It's now or never — manche Momente kommen nicht zurück. Die Stimme ist die Brücke, aber man muss sprechen.", langA: 'en', langB: 'de' },
  { id: 'en_49', front: "Don't take it personally.", back: "Nimm es nicht persönlich.", context: "Don't take it personally — leichter gesagt als getan. Aber manchmal ist Distanz das Klügste.", langA: 'en', langB: 'de' },
  { id: 'en_50', front: "You're overthinking it.", back: "Du denkst zu viel nach.", context: "You're overthinking it — der Kopf baut Hindernisse, die das Herz längst überwunden hat.", langA: 'en', langB: 'de' },
  { id: 'en_51', front: "I couldn't agree more.", back: "Da stimme ich vollkommen zu.", context: "I couldn't agree more — der Satz, der sagt: Du hast genau das getroffen, was ich dachte.", langA: 'en', langB: 'de' },
  { id: 'en_52', front: "Fair enough.", back: "Fair genug. / Schon gut.", context: "Fair enough — keine perfekte Antwort, aber eine ehrliche. Manchmal reicht das völlig.", langA: 'en', langB: 'de' },
  { id: 'en_53', front: "You've got a point.", back: "Da hast du recht. / Das stimmt.", context: "You've got a point — zuhören bedeutet auch, umdenken zu können. Das ist die echte Brücke.", langA: 'en', langB: 'de' },
  { id: 'en_54', front: "Out of nowhere.", back: "Aus dem Nichts. / Plötzlich.", context: "Out of nowhere — manchmal kommen die besten Momente ohne Ankündigung.", langA: 'en', langB: 'de' },
  { id: 'en_55', front: "I'm at a loss.", back: "Ich weiß nicht weiter.", context: "I'm at a loss — nicht Schwäche, sondern Ehrlichkeit. Der erste Schritt zur Lösung.", langA: 'en', langB: 'de' },
  { id: 'en_56', front: "Let it go.", back: "Lass es los.", context: "Let it go — manche Dinge trägt man zu lange mit sich. Das Loslassen ist kein Verlust.", langA: 'en', langB: 'de' },
  { id: 'en_57', front: "I'm dead serious.", back: "Ich meine das todernst.", context: "I'm dead serious — wenn Worte Gewicht haben, spürt man es sofort.", langA: 'en', langB: 'de' },
  { id: 'en_58', front: "What's on your mind?", back: "Was beschäftigt dich?", context: "What's on your mind? — die Frage, die sagt: Ich bin hier. Ich höre zu. Erzähl mir.", langA: 'en', langB: 'de' },
  { id: 'en_59', front: "Think outside the box.", back: "Über den Tellerrand denken.", context: "Think outside the box — Hamburg und Nairobi zu verbinden war auch außerhalb aller Boxen.", langA: 'en', langB: 'de' },
  { id: 'en_60', front: "I wasn't expecting that.", back: "Das hatte ich nicht erwartet.", context: "I wasn't expecting that — Überraschungen sind manchmal die ehrlichsten Momente des Lebens.", langA: 'en', langB: 'de' },
  { id: 'en_61', front: "You had me worried.", back: "Du hast mich besorgt.", context: "You had me worried — Sorge ist eine Form von Liebe, die sich nicht verbergen lässt.", langA: 'en', langB: 'de' },
  { id: 'en_62', front: "I'll make it work.", back: "Ich kriege das hin.", context: "I'll make it work — nicht Optimismus, sondern Entschlossenheit. Der Unterschied liegt im Ton.", langA: 'en', langB: 'de' },
  { id: 'en_63', front: "Something came up.", back: "Etwas ist dazwischengekommen.", context: "Something came up — das Leben plant mit. Manchmal hat es eigene Ideen.", langA: 'en', langB: 'de' },
  { id: 'en_64', front: "I'm not buying it.", back: "Das glaube ich dir nicht.", context: "I'm not buying it — manchmal liest man zwischen den Zeilen mehr als in den Worten selbst.", langA: 'en', langB: 'de' },
  { id: 'en_65', front: "We're on the same page.", back: "Wir sind einer Meinung. / Wir verstehen uns.", context: "We're on the same page — zwei Kontinente, eine Sprache der Verbindung.", langA: 'en', langB: 'de' },
  { id: 'en_66', front: "I owe you one.", back: "Das bin ich dir schuldig.", context: "I owe you one — kleine Schulden des Herzens. Die schönsten, die man tragen kann.", langA: 'en', langB: 'de' },
  { id: 'en_67', front: "That's the last straw.", back: "Das ist der Tropfen, der das Fass zum Überlaufen bringt.", context: "That's the last straw — manche Dinge stauen sich, bis einer sagt: Jetzt reicht es.", langA: 'en', langB: 'de' },
  { id: 'en_68', front: "I can't wrap my head around it.", back: "Ich kann es nicht begreifen.", context: "I can't wrap my head around it — manche Dinge versteht man erst mit dem Herzen.", langA: 'en', langB: 'de' },
  { id: 'en_69', front: "You read my mind.", back: "Du hast mir die Gedanken gelesen.", context: "You read my mind — Verbindung braucht manchmal keine Worte. Sie ist einfach da.", langA: 'en', langB: 'de' },
  { id: 'en_70', front: "It was a wake-up call.", back: "Es war ein Weckruf.", context: "It was a wake-up call — manche Erfahrungen verändern alles. Danach ist man ein anderer.", langA: 'en', langB: 'de' },
  { id: 'en_71', front: "I'm in over my head.", back: "Ich bin überfordert.", context: "I'm in over my head — das zu sagen braucht Mut. Und ist meistens der Beginn einer Lösung.", langA: 'en', langB: 'de' },
  { id: 'en_72', front: "Just go with the flow.", back: "Geh einfach mit dem Strom.", context: "Just go with the flow — Hamburg am Hafen. Nairobi im Regen. Manchmal ist Loslassen die beste Navigation.", langA: 'en', langB: 'de' },
  { id: 'en_73', front: "I blew it.", back: "Ich habe es vermasselt.", context: "I blew it — ehrlich gesagt, ohne Ausrede. Das ist der schnellste Weg nach vorne.", langA: 'en', langB: 'de' },
  { id: 'en_74', front: "We need to talk.", back: "Wir müssen reden.", context: "We need to talk — vier Worte, die alles anhalten. Weil Stille manchmal lauter ist.", langA: 'en', langB: 'de' },
  { id: 'en_75', front: "It goes without saying.", back: "Es versteht sich von selbst.", context: "It goes without saying — und doch sagt man es. Weil manche Dinge laut sein dürfen.", langA: 'en', langB: 'de' },
  { id: 'en_76', front: "I'm running late.", back: "Ich komme zu spät.", context: "I'm running late — der Lokführer sagt es selten. Aber das Leben macht keine Ausnahmen.", langA: 'en', langB: 'de' },
  { id: 'en_77', front: "You're a lifesaver.", back: "Du rettest mir den Tag. / Du bist ein Lebensretter.", context: "You're a lifesaver — manchmal braucht es nur ein Wort im richtigen Moment.", langA: 'en', langB: 'de' },
  { id: 'en_78', front: "I've got a lot on my plate.", back: "Ich habe sehr viel um die Ohren.", context: "I've got a lot on my plate — der Zug fährt, die App wächst, das Herz schlägt. Immer alles gleichzeitig.", langA: 'en', langB: 'de' },
  { id: 'en_79', front: "Let's meet halfway.", back: "Lass uns einen Kompromiss finden.", context: "Let's meet halfway — Hamburg und Nairobi treffen sich irgendwo in der Mitte. Das ist die Brücke.", langA: 'en', langB: 'de' },
  { id: 'en_80', front: "I lost track of time.", back: "Ich habe die Zeit vergessen.", context: "I lost track of time — die schönsten Gespräche haben kein Ende. Nur ein Weitermachen.", langA: 'en', langB: 'de' },
  { id: 'en_81', front: "Don't get me wrong.", back: "Versteh mich nicht falsch.", context: "Don't get me wrong — manchmal braucht eine Wahrheit einen Rahmen, damit sie landet.", langA: 'en', langB: 'de' },
  { id: 'en_82', front: "It's on me.", back: "Ich lade ein. / Das geht auf meine Rechnung.", context: "It's on me — Großzügigkeit braucht keine Entfernung. Sie überquert Ozeane.", langA: 'en', langB: 'de' },
  { id: 'en_83', front: "You deserve it.", back: "Das hast du verdient.", context: "You deserve it — gesagt mit echtem Stolz, nicht als Floskel. Weil man es wirklich meint.", langA: 'en', langB: 'de' },
  { id: 'en_84', front: "I've made up my mind.", back: "Ich habe mich entschieden.", context: "I've made up my mind — kein Zögern mehr. Die Brücke ist gebaut. Man geht jetzt drüber.", langA: 'en', langB: 'de' },
  { id: 'en_85', front: "That means a lot to me.", back: "Das bedeutet mir sehr viel.", context: "That means a lot to me — manche Worte trägt man tage-, wochenlang mit sich. Dieser Satz ist einer davon.", langA: 'en', langB: 'de' },
  { id: 'en_86', front: "I'll be there for you.", back: "Ich bin für dich da.", context: "I'll be there for you — über jeden Ozean, durch jede Zeitzone. Das ist das Versprechen hinter der Stimme.", langA: 'en', langB: 'de' },
]

const VALID_CATEGORIES = ['vocabulary', 'sentence', 'street', 'home', 'basics']
const VALID_CATEGORY_SET = new Set(VALID_CATEGORIES)

function autoCategory(front) {
  const words = front.trim().split(/\s+/).filter(Boolean)
  return words.length <= 2 ? 'vocabulary' : 'sentence'
}

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
function ruleCategory(card) {
  const front = card.front || ''
  const back = card.back || ''
  const words = front.trim().split(/\s+/).filter(Boolean)
  const backWords = back.trim().split(/\s+/).filter(Boolean)
  // Rule 0: German common-word whitelist → always vocabulary
  if (words.length === 1 && DE_VOCAB_WHITELIST.has(front.trim().toLowerCase())) return 'vocabulary'
  // Rule 1: Swahili card, pronunciation field, or common Swahili words → street
  const swahiliRe = /\b(habari|yako|nzuri|asante|karibu|pole|sawa|jambo|mambo|rafiki|wewe|mimi|nina|hii|hilo|chakula|maji|nyumba|watoto|upendo)\b/i
  if (card.langA === 'sw' || card.pronunciation || swahiliRe.test(front)) return 'street'
  // Rule 2: apostrophes or contractions → street
  if (/['']/.test(front) || /\b(im|youre|its|lets|dont|cant|wont|ive|theyre|were|thats|whats|theres|ill|youll)\b/i.test(front)) return 'street'
  // Rule 3: single front word but back is 3+ words → street (single word that expands to phrase)
  if (words.length === 1 && backWords.length >= 3) return 'street'
  // Rule 4: exactly 1 word OR starts with "to " → vocabulary
  if (words.length === 1) return 'vocabulary'
  if (/^to\s/i.test(front)) return 'vocabulary'
  // Rule 5: question ending with "?" containing domestic/personal words → home
  if (front.trim().endsWith('?')) {
    const homeRe = /\b(love|miss|okay|home|eat|sleep|baby|darling|babe|honey)\b/i
    return homeRe.test(front) ? 'home' : 'sentence'
  }
  // Rule 6: 3+ words → sentence
  if (words.length >= 3) return 'sentence'
  // 2-word fallback → sentence
  return 'sentence'
}

// ── CARD GENERATION: split reversed cards on " / " ────────────
// EN→DE (forward): show all meanings together as-is
// DE→EN (reversed): split each " / " meaning into its own card
function buildCardPair(card) {
  const targetLang = card.langA
  const raw = card.category || ruleCategory(card)
  const category = VALID_CATEGORY_SET.has(raw) ? raw : 'vocabulary'
  const forwardCard = { ...card, targetLang, category }

  const meanings = card.back.split(' / ').map(m => m.trim()).filter(Boolean)
  let reversedCards
  if (meanings.length > 1) {
    reversedCards = meanings.map((meaning, i) => ({
      ...card,
      id: `${card.id}_r_${i}`,
      front: meaning,
      back: card.front,
      langA: card.langB,
      langB: card.langA,
      targetLang,
      category,
    }))
  } else {
    reversedCards = [{
      ...card,
      id: `${card.id}_r`,
      front: card.back,
      back: card.front,
      langA: card.langB,
      langB: card.langA,
      targetLang,
      category,
    }]
  }
  return [forwardCard, ...reversedCards]
}

const ALL_MARK_CARDS = ALL_MARK_CARDS_BASE.flatMap(buildCardPair)

const ALL_ELOSY_CARDS_BASE = [
  { id: 'de_1', front: "Guten Morgen", back: "Good morning", context: "Guten Morgen — the first bridge of the day. Said with warmth, it means: I thought of you when I woke up.", langA: 'de', langB: 'en' },
  { id: 'de_2', front: "Guten Abend", back: "Good evening", context: "Guten Abend — the day winds down, but connection doesn't. A greeting that says: I'm still here.", langA: 'de', langB: 'en' },
  { id: 'de_3', front: "Wie geht es dir?", back: "How are you?", context: "Wie geht es dir? — more than small talk. In German, it's an invitation to be honest.", langA: 'de', langB: 'en' },
  { id: 'de_4', front: "Danke schön", back: "Thank you very much", context: "Danke schön — the extra syllable matters. It says: I really mean it.", langA: 'de', langB: 'en' },
  { id: 'de_5', front: "Bitte", back: "Please / You're welcome", context: "Bitte does double duty — asking and receiving, both with grace. One word, two bridges.", langA: 'de', langB: 'en' },
  { id: 'de_6', front: "Ich liebe dich", back: "I love you", context: "Ich liebe dich — the most important sentence in any language. Said slowly, it lands.", langA: 'de', langB: 'en' },
  { id: 'de_7', front: "Ich vermisse dich", back: "I miss you", context: "Ich vermisse dich — longing has a sound in German. It's soft and honest at once.", langA: 'de', langB: 'en' },
  { id: 'de_8', front: "Bis bald", back: "See you soon", context: "Bis bald — not goodbye. A promise that this isn't the end.", langA: 'de', langB: 'en' },
  { id: 'de_9', front: "Ich bin müde", back: "I am tired", context: "Ich bin müde — simple words, but saying them out loud to someone who listens is everything.", langA: 'de', langB: 'en' },
  { id: 'de_10', front: "Ich bin glücklich", back: "I am happy", context: "Ich bin glücklich — happiness spoken is happiness shared. Let the bridge carry it.", langA: 'de', langB: 'en' },
  { id: 'de_11', front: "Was machst du?", back: "What are you doing?", context: "Was machst du? — a small question that says: I'm thinking about your day, even from far away.", langA: 'de', langB: 'en' },
  { id: 'de_12', front: "Ich denke an dich", back: "I am thinking of you", context: "Ich denke an dich — four words that cross any distance without a ticket.", langA: 'de', langB: 'en' },
  { id: 'de_13', front: "Schlaf gut", back: "Sleep well", context: "Schlaf gut — said at the end of the night, it means: you are safe in my thoughts.", langA: 'de', langB: 'en' },
  { id: 'de_14', front: "Ich komme bald", back: "I am coming soon", context: "Ich komme bald — the sentence that turns waiting into anticipation.", langA: 'de', langB: 'en' },
  { id: 'de_15', front: "Du fehlst mir", back: "I miss you (deeply)", context: "Du fehlst mir — literally 'you are missing from me'. German puts the gap right in the grammar.", langA: 'de', langB: 'en' },
  { id: 'de_16', front: "Entschuldigung", back: "Sorry / Excuse me", context: "Entschuldigung — long word, but it carries real weight. Germans mean it when they say it.", langA: 'de', langB: 'en' },
  { id: 'de_17', front: "Ich verstehe nicht", back: "I don't understand", context: "Ich verstehe nicht — the bravest sentence a learner can say. Confusion is the first step.", langA: 'de', langB: 'en' },
  { id: 'de_18', front: "Kannst du das wiederholen?", back: "Can you repeat that?", context: "Kannst du das wiederholen? — asking again is not weakness. It's how bridges get built properly.", langA: 'de', langB: 'en' },
  { id: 'de_19', front: "Wie heißt du?", back: "What is your name?", context: "Wie heißt du? — the first question. Names are the first bridge between two people.", langA: 'de', langB: 'en' },
  { id: 'de_20', front: "Ich heiße...", back: "My name is...", context: "Ich heiße — the moment you introduce yourself in a new language, something shifts.", langA: 'de', langB: 'en' },
  { id: 'de_21', front: "Woher kommst du?", back: "Where are you from?", context: "Woher kommst du? — geography as curiosity. Every answer opens a new world.", langA: 'de', langB: 'en' },
  { id: 'de_22', front: "Ich komme aus Kenia", back: "I come from Kenya", context: "Ich komme aus Kenia — said in German, it plants a piece of home into a new language.", langA: 'de', langB: 'en' },
  { id: 'de_23', front: "Wie spät ist es?", back: "What time is it?", context: "Wie spät ist es? — time zones separate us. But the question connects us across them.", langA: 'de', langB: 'en' },
  { id: 'de_24', front: "Ich bin hungrig", back: "I am hungry", context: "Ich bin hungrig — basic needs, honestly said, bring people closer than long speeches.", langA: 'de', langB: 'en' },
  { id: 'de_25', front: "Das ist lecker", back: "That is delicious", context: "Das ist lecker — food is culture. Saying this in German makes any meal a shared moment.", langA: 'de', langB: 'en' },
  { id: 'de_26', front: "Ich bin stolz auf dich", back: "I am proud of you", context: "Ich bin stolz auf dich — pride said out loud is a gift. Don't keep it to yourself.", langA: 'de', langB: 'en' },
  { id: 'de_27', front: "Alles wird gut", back: "Everything will be okay", context: "Alles wird gut — not a guarantee, but a choice to believe. Said together, it's stronger.", langA: 'de', langB: 'en' },
  { id: 'de_28', front: "Ich freue mich", back: "I am looking forward to it", context: "Ich freue mich — joy in anticipation. The German language celebrates waiting too.", langA: 'de', langB: 'en' },
  { id: 'de_29', front: "Gute Nacht", back: "Good night", context: "Gute Nacht — the last word of the day. In any language, it means: until tomorrow.", langA: 'de', langB: 'en' },
  { id: 'de_30', front: "Ich lerne Deutsch", back: "I am learning German", context: "Ich lerne Deutsch — five words that change everything. The bridge is being built, one word at a time.", langA: 'de', langB: 'en' },
  { id: 'de_31', front: "Ich habe keine Zeit", back: "I don't have time", context: "Ich habe keine Zeit — honest and direct. German respects clarity, even when the answer is no.", langA: 'de', langB: 'en' },
  { id: 'de_32', front: "Das macht Spaß", back: "That's fun / I enjoy this", context: "Das macht Spaß — learning a language should feel like this. Joy is the best teacher.", langA: 'de', langB: 'en' },
  { id: 'de_33', front: "Ich bin einverstanden", back: "I agree", context: "Ich bin einverstanden — four syllables of yes. A full commitment, not just a nod.", langA: 'de', langB: 'en' },
  { id: 'de_34', front: "Das ist nicht einfach", back: "That is not easy", context: "Das ist nicht einfach — learning German, crossing distances, building bridges. None of it is. But worth it.", langA: 'de', langB: 'en' },
  { id: 'de_35', front: "Ich brauche Hilfe", back: "I need help", context: "Ich brauche Hilfe — asking for help is its own kind of strength. Say it without hesitation.", langA: 'de', langB: 'en' },
  { id: 'de_36', front: "Warte mal kurz", back: "Wait a moment", context: "Warte mal kurz — the tiny pause before something important. Hamburg knows this well.", langA: 'de', langB: 'en' },
  { id: 'de_37', front: "Das stimmt", back: "That's right / That's correct", context: "Das stimmt — simple, clean, certain. One of the most satisfying things to say in any language.", langA: 'de', langB: 'en' },
  { id: 'de_38', front: "Ich bin nicht sicher", back: "I'm not sure", context: "Ich bin nicht sicher — honesty about uncertainty is the beginning of real conversation.", langA: 'de', langB: 'en' },
  { id: 'de_39', front: "Wie bitte?", back: "Pardon? / Could you repeat that?", context: "Wie bitte? — always ask again. Understanding matters more than appearing to understand.", langA: 'de', langB: 'en' },
  { id: 'de_40', front: "Das ist wunderschön", back: "That is beautiful", context: "Das ist wunderschön — wonder + beautiful, combined. German sometimes says exactly what it means.", langA: 'de', langB: 'en' },
  { id: 'de_41', front: "Ich werde bald kommen", back: "I will come soon", context: "Ich werde bald kommen — a promise traveling thousands of kilometers, arriving intact.", langA: 'de', langB: 'en' },
  { id: 'de_42', front: "Was bedeutet das?", back: "What does that mean?", context: "Was bedeutet das? — the most important question a learner can ask. Never stop asking it.", langA: 'de', langB: 'en' },
  { id: 'de_43', front: "Ich spreche ein bisschen Deutsch", back: "I speak a little German", context: "Ich spreche ein bisschen Deutsch — a little is more than nothing. And it grows every day.", langA: 'de', langB: 'en' },
  { id: 'de_44', front: "Du siehst gut aus", back: "You look good", context: "Du siehst gut aus — simple compliments land the hardest. Especially across time zones.", langA: 'de', langB: 'en' },
  { id: 'de_45', front: "Ich warte auf dich", back: "I am waiting for you", context: "Ich warte auf dich — waiting is not passive. It's a form of love that holds space.", langA: 'de', langB: 'en' },
  { id: 'de_46', front: "Das klingt gut", back: "That sounds good", context: "Das klingt gut — agreement with warmth. The German version of 'I'm in'.", langA: 'de', langB: 'en' },
  { id: 'de_47', front: "Keine Sorge", back: "No worries / Don't worry", context: "Keine Sorge — two words that carry a whole hug. Light, warm, reassuring.", langA: 'de', langB: 'en' },
  { id: 'de_48', front: "Ich bin so froh", back: "I am so glad / happy", context: "Ich bin so froh — happiness with emphasis. The 'so' makes it real.", langA: 'de', langB: 'en' },
  { id: 'de_49', front: "Das war wunderbar", back: "That was wonderful", context: "Das war wunderbar — looking back at something shared. The memory already glowing.", langA: 'de', langB: 'en' },
  { id: 'de_50', front: "Ich habe dich vermisst", back: "I missed you", context: "Ich habe dich vermisst — past tense, but the feeling is present. Still here.", langA: 'de', langB: 'en' },
  { id: 'de_51', front: "Wann kommst du?", back: "When are you coming?", context: "Wann kommst du? — the question behind every quiet evening, every unanswered message.", langA: 'de', langB: 'en' },
  { id: 'de_52', front: "Wie war dein Tag?", back: "How was your day?", context: "Wie war dein Tag? — the small question that says: your day matters to me.", langA: 'de', langB: 'en' },
  { id: 'de_53', front: "Das macht nichts", back: "That doesn't matter / Never mind", context: "Das macht nichts — forgiveness in three words. Small ones carry the most weight.", langA: 'de', langB: 'en' },
  { id: 'de_54', front: "Ich freue mich auf dich", back: "I'm looking forward to seeing you", context: "Ich freue mich auf dich — anticipation as a love language. German has a word for everything.", langA: 'de', langB: 'en' },
  { id: 'de_55', front: "Du bist wichtig für mich", back: "You are important to me", context: "Du bist wichtig für mich — not dramatic, just true. The kind of sentence that changes things.", langA: 'de', langB: 'en' },
  { id: 'de_56', front: "Ich denke oft an dich", back: "I often think of you", context: "Ich denke oft an dich — often. Not sometimes. The word 'oft' carries the whole weight.", langA: 'de', langB: 'en' },
  { id: 'de_57', front: "Bis morgen", back: "See you tomorrow / Until tomorrow", context: "Bis morgen — the smallest promise. And sometimes the most important one.", langA: 'de', langB: 'en' },
  { id: 'de_58', front: "Ich bin auf dem Weg", back: "I am on my way", context: "Ich bin auf dem Weg — movement toward someone. Three words that change the waiting.", langA: 'de', langB: 'en' },
  { id: 'de_59', front: "Das höre ich gern", back: "I love to hear that / That's good to hear", context: "Das höre ich gern — the German way of saying: keep going, I needed that.", langA: 'de', langB: 'en' },
  { id: 'de_60', front: "Du machst mich glücklich", back: "You make me happy", context: "Du machst mich glücklich — simple, direct, complete. Some sentences don't need translation.", langA: 'de', langB: 'en' },
]

const ALL_ELOSY_CARDS = ALL_ELOSY_CARDS_BASE.flatMap(buildCardPair)

function getSpeed(s) {
  if (s < VERY_FAST_S) return 'very_fast'
  if (s < FAST_S) return 'fast'
  if (s < MEDIUM_S) return 'medium'
  return 'slow'
}
function getNewInterval(speed, progress) {
  const cf = progress?.consecutiveFast || 0
  if (speed === 'very_fast') { if (cf >= 3) return 30; if (cf >= 2) return 15; return 7 }
  if (speed === 'fast') return 5
  if (speed === 'medium') return 2
  return 1
}
function getNextReview(days) {
  const d = new Date(); d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}
function todayStr() { return new Date().toISOString().split('T')[0] }
function getISOWeekStr(date = new Date()) {
  const d = new Date(date); d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function daysSince(dateStr) {
  if (!dateStr) return 9999
  return Math.floor((Date.now() - new Date(dateStr)) / 86400000)
}

function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0))
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}
function fuzzyWordMatch(expected, got) {
  const e = expected.toLowerCase().replace(/[^\w]/g, '')
  const g = got.toLowerCase().replace(/[^\w]/g, '')
  if (!e || !g) return false
  const maxDist = Math.max(1, Math.floor(e.length * 0.4))
  return levenshtein(e, g) <= maxDist
}

function calcStreak(history) {
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
function calcLongestStreak(history) {
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
function getLast7Days(history) {
  const result = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    const sessions = history?.filter(h => h.date === dateStr) || []
    result.push({ date: dateStr, done: sessions.length > 0, total: sessions.reduce((a, b) => a + (b.total || 0), 0), correct: sessions.reduce((a, b) => a + (b.correct || 0), 0) })
  }
  return result
}
async function saveSessionHistory(uid, correct, total, currentHistory, extraUpdate, area) {
  const entry = { date: todayStr(), correct, total, ts: Date.now(), ...(area ? { area } : {}) }
  const updated = [entry, ...(currentHistory || [])].slice(0, 60)
  await updateDoc(doc(db, 'users', uid), { sessionHistory: updated, ...(extraUpdate || {}) })
  return updated
}
function buildSession(allCards, cardProgress) {
  const today = todayStr()
  const forced = [], due = [], newCards = []
  allCards.forEach(card => {
    const p = cardProgress[card.id]
    if (!p) newCards.push(card)
    else if (p.wrongSessions > 0) forced.push(card)
    else if (p.nextReview <= today) due.push(card)
  })
  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)
  // Most overdue first: sort by nextReview ascending (oldest date first)
  const sortedDue = due.slice().sort((a, b) => {
    const pa = cardProgress[a.id]?.nextReview || ''
    const pb = cardProgress[b.id]?.nextReview || ''
    return pa < pb ? -1 : pa > pb ? 1 : 0
  })
  const reviews = [...shuffle(forced), ...sortedDue]
  // New cards only when review queue < 10; always at end, max 5
  const newBatch = reviews.length < 10 ? shuffle(newCards).slice(0, 5) : []
  return [...reviews, ...newBatch].slice(0, SESSION_SIZE)
}
function checkMastery(allCards, cardProgress, sessionCorrect, sessionTotal) {
  const active = allCards.filter(c => {
    const p = cardProgress[c.id]
    return p && (p.interval > 0 || p.wrongSessions > 0)
  })
  if (active.length < 20) return false
  if (sessionTotal > 0 && sessionCorrect / sessionTotal < 0.6) return false
  const mastered = active.filter(c => (cardProgress[c.id]?.interval || 0) >= 7)
  return mastered.length / active.length >= MASTERY_THRESHOLD
}
function getNextNewCards(allCards, cardProgress, count) {
  const unstarted = allCards.filter(c => !cardProgress[c.id])
  const unstartedEN = unstarted.filter(c => c.targetLang === 'en')
  const unstartedSW = unstarted.filter(c => c.targetLang === 'sw')
  if (unstartedEN.length >= count) return unstartedEN.slice(0, count)
  const maxSW = Math.max(0, Math.floor(count * 0.2))
  const swCards = unstartedSW.slice(0, Math.min(maxSW, count - unstartedEN.length))
  return [...unstartedEN, ...swCards].slice(0, count)
}
function getLangStats(allCards, cardProgress, langCode) {
  const cards = allCards.filter(c => c.targetLang === langCode)
  // Only count as "active" if answered at least once (interval > 0 OR wrongSessions > 0)
  // Cards that are unlocked but never answered (interval:0, wrongSessions:0) do NOT count
  const active = cards.filter(c => {
    const p = cardProgress[c.id]
    return p && (p.interval > 0 || p.wrongSessions > 0)
  })
  const mastered = active.filter(c => (cardProgress[c.id]?.interval || 0) >= 7)
  return { total: cards.length, active: active.length, mastered: mastered.length }
}
async function saveSessionState(uid, queue, index, newProgress) {
  try { await setDoc(doc(db, 'users', uid, 'session', 'current'), { queue, index, newProgress, savedAt: Date.now() }) }
  catch (e) { console.warn('Could not save session state:', e) }
}
async function clearSessionState(uid) {
  try { await deleteDoc(doc(db, 'users', uid, 'session', 'current')) }
  catch (e) { console.warn('Could not clear session state:', e) }
}

const GLOBAL_CSS = `
html, body, #root {
  background-color: #0a0a0a !important;
  min-height: 100vh;
  min-height: 100dvh;
}
@keyframes vocaraFadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes vocaraKontextGlow {
  0%, 100% { box-shadow: 0 0 10px rgba(0,191,165,0.3), 0 0 0 2px rgba(0,191,165,0.06); }
  50%       { box-shadow: 0 0 22px rgba(0,191,165,0.6), 0 0 0 4px rgba(0,191,165,0.12); }
}
@keyframes vocaraFadeOut {
  from { opacity: 1; }
  to   { opacity: 0; }
}
@keyframes spin {
  to { transform: translateY(-50%) rotate(360deg); }
}
@keyframes metalFlow {
  0%   { background-position: 0% center; }
  100% { background-position: 100% center; }
}
@keyframes goldShimmer {
  0%   { box-shadow: 0 0 10px rgba(255,215,0,0.30), inset 0 0 14px rgba(255,215,0,0.10); }
  50%  { box-shadow: 0 0 24px rgba(255,215,0,0.65), inset 0 0 28px rgba(255,215,0,0.22); }
  100% { box-shadow: 0 0 10px rgba(255,215,0,0.30), inset 0 0 14px rgba(255,215,0,0.10); }
}
@keyframes vocaraCelebrate {
  0%   { opacity: 0; transform: translateX(-50%) scale(0.85) translateY(8px); }
  15%  { opacity: 1; transform: translateX(-50%) scale(1.05) translateY(0); }
  80%  { opacity: 1; transform: translateX(-50%) scale(1.0) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) scale(0.95) translateY(-4px); }
}
@keyframes vocaraPulse {
  0%   { opacity: 1; transform: scale(1); }
  50%  { opacity: 0.5; transform: scale(1.25); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes vocaraFlyRight {
  0%   { opacity: 1; transform: translateX(0) rotate(0deg); }
  100% { opacity: 0; transform: translateX(130%) rotate(18deg); }
}
@keyframes vocaraFlyUp {
  0%   { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-80%) scale(0.85); }
}
@keyframes vocaraShake {
  0%,100% { transform: translateX(0); }
  15%  { transform: translateX(-10px); }
  30%  { transform: translateX(10px); }
  45%  { transform: translateX(-8px); }
  60%  { transform: translateX(8px); }
  75%  { transform: translateX(-4px); }
  90%  { transform: translateX(4px); }
}
@keyframes dotPop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.6); }
  100% { transform: scale(1); }
}
@keyframes vocaraSlideIn {
  0%   { opacity: 0; transform: translateX(-60px) scale(0.95); }
  100% { opacity: 1; transform: translateX(0) scale(1); }
}
@keyframes particleBurst {
  0%   { opacity: 1; transform: translate(0,0) scale(1); }
  100% { opacity: 0; transform: translate(var(--px), var(--py)) scale(0); }
}
@keyframes sparkleRing {
  0%   { opacity: 0.9; transform: scale(0.5); }
  60%  { opacity: 0.6; transform: scale(1.8); }
  100% { opacity: 0; transform: scale(2.5); }
}
@keyframes vocaraCardFlip {
  0%   { transform: rotateY(0deg); }
  45%  { transform: rotateY(90deg); opacity: 0.6; }
  55%  { transform: rotateY(-90deg); opacity: 0.6; }
  100% { transform: rotateY(0deg); }
}

@keyframes vocaraRayHamburg {
  0%   { transform: translateX(-120%) rotate(22deg); opacity: 0; }
  18%  { opacity: 0.55; }
  82%  { opacity: 0.45; }
  100% { transform: translateX(240%) rotate(22deg); opacity: 0; }
}
@keyframes vocaraNairobiParticle {
  0%   { transform: translateY(-10px) scale(0.6); opacity: 0.9; }
  100% { transform: translateY(110vh) scale(1.1); opacity: 0; }
}
@keyframes vocaraAuroraWelt {
  0%   { transform: scale(0.4) rotate(-10deg); opacity: 0; }
  40%  { transform: scale(1.6) rotate(8deg); opacity: 0.85; }
  100% { transform: scale(2.8) rotate(20deg); opacity: 0; }
}
@keyframes rainbowCardBorder {
  0%   { box-shadow: 0 0 0 2px #FF6B6B, 0 0 20px #FF6B6B55, inset 0 0 30px #FF6B6B18; }
  20%  { box-shadow: 0 0 0 2px #FFD93D, 0 0 20px #FFD93D55, inset 0 0 30px #FFD93D18; }
  40%  { box-shadow: 0 0 0 2px #6BCB77, 0 0 20px #6BCB7755, inset 0 0 30px #6BCB7718; }
  60%  { box-shadow: 0 0 0 2px #4D96FF, 0 0 20px #4D96FF55, inset 0 0 30px #4D96FF18; }
  80%  { box-shadow: 0 0 0 2px #C77DFF, 0 0 20px #C77DFF55, inset 0 0 30px #C77DFF18; }
  100% { box-shadow: 0 0 0 2px #FF6B6B, 0 0 20px #FF6B6B55, inset 0 0 30px #FF6B6B18; }
}

.vocara-screen {
  animation: vocaraFadeIn 0.3s ease both;
  position: relative;
}
.vocara-screen::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 160px 160px;
  opacity: 0.022;
  pointer-events: none;
  z-index: 9999;
}

@media (max-width: 767px) {
  .vocara-logo-title {
    filter: drop-shadow(0 0 10px rgba(255,215,0,0.70)) drop-shadow(0 0 36px rgba(255,215,0,0.38)) drop-shadow(0 0 2px rgba(255,215,0,0.60)) !important;
  }
  .vocara-bridgelab-title {
    font-size: clamp(3.2rem, 14vw, 5.5rem) !important;
    letter-spacing: 0.10em !important;
    padding-right: 0.12em !important;
    filter: drop-shadow(0 0 20px rgba(255,215,0,0.70)) drop-shadow(0 0 50px rgba(255,215,0,0.40)) drop-shadow(0 0 4px rgba(255,215,0,0.80)) !important;
    -webkit-background-clip: text !important;
    background-clip: text !important;
    -webkit-text-fill-color: transparent !important;
  }
  button {
    -webkit-backdrop-filter: blur(30px) saturate(220%) !important;
    backdrop-filter: blur(30px) saturate(220%) !important;
  }
  .vocara-alle-btn, .vocara-nav-btn {
    border-color: rgba(255,255,255,0.25) !important;
    box-shadow: 0 6px 20px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.20) !important;
  }
  .vocara-big-card {
    box-shadow: inset 0 0 42px var(--card-glow, rgba(200,160,20,0.40)), inset 0 0 1px 1px var(--card-accent, rgba(200,160,20,0.70)), 0 0 36px var(--card-accent, rgba(200,160,20,0.28)), 0 10px 40px rgba(0,0,0,0.65) !important;
  }
}
@media (min-width: 768px) {
  .vocara-home-outer { align-items: flex-start !important; }
  .vocara-home-box { padding-top: 8px !important; padding-bottom: 8px !important; }
  .vocara-logo-section { padding-top: 6px !important; padding-bottom: 4px !important; }
  .vocara-logo-title {
    font-size: 2.8rem !important;
    margin-bottom: 4px !important;
    filter: drop-shadow(0 0 7px rgba(200,200,255,0.22)) !important;
  }
  .vocara-logo-greeting { font-size: 0.82rem !important; margin-bottom: 0 !important; }
  .vocara-cat-grid { gap: 8px !important; margin-bottom: 6px !important; }
  .vocara-cat-grid > div { gap: 8px !important; }
  .vocara-cat-btn { padding: 9px 8px !important; font-size: 0.78rem !important; }
  .vocara-alle-btn { padding: 8px 16px !important; font-size: 0.82rem !important; }
  .vocara-dots-row { margin-bottom: 5px !important; }
  .vocara-nav-section { margin-top: 0 !important; margin-bottom: 2px !important; }
  .vocara-nav-btn { padding: 7px 12px !important; font-size: 0.82rem !important; margin-bottom: 3px !important; }
  .vocara-home-box { max-width: 700px !important; }
  .vocara-card-screen-box { max-width: 600px !important; }
  .vocara-answer-row { gap: 10px !important; }
}
@media (min-width: 1024px) {
  .vocara-home-box { max-width: 960px !important; }
  .vocara-cat-grid { display: grid !important; grid-template-columns: 1fr 1fr !important; }
  .vocara-cat-grid > div { display: contents !important; }
  .vocara-card-screen-box { max-width: 720px !important; }
  .vocara-logo-title { font-size: 3.2rem !important; }
}

.vocara-big-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.vocara-big-card:hover {
  transform: translateY(-3px) !important;
}

button {
  transition: transform 0.07s ease, box-shadow 0.07s ease;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  font-family: 'Inter', system-ui, sans-serif;
  position: relative;
  overflow: hidden;
}
button:active {
  transform: scale(0.97) translateY(1px) !important;
  box-shadow: 0 1px 8px rgba(0,0,0,0.5) !important;
}
.vocara-cat-btn:active {
  transform: scale(0.95) translateY(3px) !important;
  box-shadow: 0 1px 0 rgba(0,0,0,0.5) !important;
}
.vocara-alle-btn:active {
  transform: scale(0.96) translateY(2px) !important;
  box-shadow: 0 1px 4px rgba(0,0,0,0.5) !important;
}
.vocara-nav-btn:active {
  transform: scale(0.97) !important;
  box-shadow: none !important;
  opacity: 0.8 !important;
}
`

const WaterCanvas = () => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const rings = [];

    const addDrop = () => {
      const ringCount = 2 + Math.floor(Math.random() * 4); // 2–5 rings
      const maxRadius = 60 + Math.random() * 240;          // 60–300 px
      const speed = 0.4 + Math.random() * 1.1;             // 0.4–1.5
      const startOpacity = 0.15 + Math.random() * 0.10;    // 0.15–0.25
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const spacing = maxRadius / (ringCount + 1);
      for (let k = 0; k < ringCount; k++) {
        rings.push({
          x, y,
          radius: k * spacing,
          maxRadius,
          opacity: startOpacity * Math.max(0.6, 1 - k * 0.12),
          speed,
          fadeRate: (startOpacity * 0.9) / (maxRadius / speed),
        });
      }
      setTimeout(addDrop, 2000 + Math.random() * 3500);
    };

    addDrop();
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.radius += r.speed;
        r.opacity -= r.fadeRate;
        if (r.radius > r.maxRadius || r.opacity <= 0) { rings.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${r.opacity})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      requestAnimationFrame(animate);
    };
    animate();
  }, []);
  return <canvas ref={canvasRef} style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',zIndex:9999,pointerEvents:'none',mixBlendMode:'screen'}} />;
};

const ParticleCanvas = ({ theme }) => {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = window.innerWidth; canvas.height = window.innerHeight
    const isWelt = theme === 'welt'
    const colors = isWelt
      ? ['255,100,100','100,200,120','100,160,255','200,100,255','255,220,80']
      : ['255,215,0','245,200,66','250,185,40']
    const particles = []
    let rafId; let lastAdd = Date.now()
    const add = () => {
      const c = colors[Math.floor(Math.random() * colors.length)]
      particles.push({ x: Math.random() * canvas.width, y: canvas.height * 0.75 + Math.random() * canvas.height * 0.25,
        vx: (Math.random() - 0.5) * 0.35, vy: -(0.28 + Math.random() * 0.45),
        opacity: 0, maxOpacity: 0.22 + Math.random() * 0.22, size: 1.4 + Math.random() * 1.6,
        color: c, life: 0, maxLife: 260 + Math.random() * 180 })
    }
    add()
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const now = Date.now()
      if (particles.length < 3 && now - lastAdd > 2200 + Math.random() * 2500) { add(); lastAdd = now }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx; p.y += p.vy; p.life++
        if (p.life < 55) p.opacity = (p.life / 55) * p.maxOpacity
        else if (p.life > p.maxLife - 55) p.opacity = Math.max(0, ((p.maxLife - p.life) / 55) * p.maxOpacity)
        if (p.life > p.maxLife || p.y < -20) { particles.splice(i, 1); continue }
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3.5)
        g.addColorStop(0, `rgba(${p.color},${p.opacity})`)
        g.addColorStop(0.4, `rgba(${p.color},${p.opacity * 0.4})`)
        g.addColorStop(1, `rgba(${p.color},0)`)
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 3.5, 0, Math.PI * 2)
        ctx.fillStyle = g; ctx.fill()
      }
      rafId = requestAnimationFrame(animate)
    }
    animate()
    return () => cancelAnimationFrame(rafId)
  }, [theme])
  return <canvas ref={canvasRef} style={{position:'fixed',top:0,left:0,width:'100%',height:'100%',zIndex:1,pointerEvents:'none'}} />
}

function makeStyles(th) {
  return {
    container: { minHeight: '100vh', minHeight: '100dvh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: th.bgGrad, backgroundColor: th.bg, '--card-glow': th.glowColor + '55', '--card-accent': th.accent + '99' },
    homeBox: { textAlign: 'center', padding: '20px', width: '100%', maxWidth: '420px' },
    greeting: { color: th.sub, fontSize: '0.95rem', marginBottom: '2px' },
    title: {
      fontSize: 'clamp(1.8rem, 7vw, 2.6rem)', marginBottom: '20px', fontWeight: '900',
      fontFamily: "'Playfair Display', Georgia, serif",
      background: th.metalText,
      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
      backgroundSize: '300% auto',
      animation: 'metalFlow 8s linear infinite',
      filter: `drop-shadow(0 0 6px ${th.gold}55) drop-shadow(0 0 16px ${th.gold}2A) drop-shadow(0 0 2px ${th.gold}44)`,
    },
    logoTitle: {
      fontSize: 'clamp(1.8rem, 7vw, 2.6rem)', marginBottom: '20px', fontWeight: '900',
      fontFamily: "'Playfair Display', Georgia, serif",
      letterSpacing: '-0.02em',
      background: 'linear-gradient(90deg, #B8860B 0%, #FFD700 25%, #FFF0A0 50%, #FFD700 75%, #B8860B 100%)',
      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
      backgroundSize: '300% auto',
      animation: 'metalFlow 8s linear infinite',
      filter: 'drop-shadow(0 0 8px rgba(255,215,0,0.65)) drop-shadow(0 0 24px rgba(255,215,0,0.30)) drop-shadow(0 0 2px rgba(255,215,0,0.5))',
    },
    slogan: { color: th.sub, fontSize: '1rem', marginBottom: '32px', lineHeight: '1.8' },
    card: {
      background: th.card, borderRadius: '14px', padding: '16px', marginBottom: '10px', textAlign: 'left',
      border: `1px solid ${th.border}`,
      boxShadow: `inset 0 0 18px ${th.glowColor}14, 0 0 0 1px ${th.accent}20, 0 2px 12px rgba(0,0,0,0.4)`,
    },
    bigCard: {
      background: `radial-gradient(ellipse at 50% 35%, transparent 20%, rgba(0,0,0,0.38) 100%), ${th.card}`,
      borderRadius: '18px', padding: '28px 20px', marginBottom: '16px',
      textAlign: 'center', minHeight: '180px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      border: th.rainbow ? '2px solid transparent' : `1px solid ${th.accent}55`,
      boxShadow: th.rainbow ? undefined : `inset 0 0 30px ${th.glowColor}30, inset 0 0 1px 1px ${th.accent}60, 0 0 28px ${th.accent}22, 0 0 0 1px ${th.accent}35, 0 8px 32px rgba(0,0,0,0.6)`,
      animation: th.rainbow ? 'rainbowCardBorder 4s linear infinite' : undefined,
      position: 'relative', overflow: 'hidden',
    },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', width: '100%' },
    cardLabel: { color: th.sub, fontSize: '0.75rem', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' },
    langRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
    lang: { color: th.text, fontSize: '0.95rem' },
    langPct: { color: th.gold, fontSize: '0.85rem' },
    noPartner: { color: th.sub, fontSize: '0.85rem', fontStyle: 'italic', margin: 0 },
    cardFront: { color: th.text, fontSize: 'clamp(1rem, 4vw, 1.3rem)', marginBottom: '16px', fontWeight: 'bold' },
    cardBack: { color: th.accent, fontSize: 'clamp(1.4rem, 5vw, 1.8rem)', fontWeight: 'bold', marginBottom: '8px' },
    cardPronunciation: { color: th.gold, fontSize: '0.78rem', marginBottom: '10px', letterSpacing: '0.5px' },
    cardContext: { color: th.sub, fontSize: '0.8rem', fontStyle: 'italic', lineHeight: '1.55', marginBottom: '18px', maxWidth: '310px', textAlign: 'center' },
    dirLabel: { fontSize: '0.8rem', color: th.sub, marginBottom: '12px', letterSpacing: '1px' },
    progressBar: { height: '4px', background: th.border, borderRadius: '2px', marginTop: '4px', overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: '2px', transition: 'width 0.5s ease', background: th.accent },
    button: {
      background: 'linear-gradient(145deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
      color: 'white', border: '1px solid rgba(255,255,255,0.22)',
      padding: '13px 28px', borderRadius: '20px', fontSize: '1rem', cursor: 'pointer',
      fontWeight: '600', width: '100%', marginBottom: '8px',
      fontFamily: "'Inter', system-ui, sans-serif",
      backdropFilter: 'blur(24px) saturate(200%)', WebkitBackdropFilter: 'blur(24px) saturate(200%)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.25)',
    },
    menuBtn: {
      background: 'linear-gradient(145deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)',
      color: th.text, border: '1px solid rgba(255,255,255,0.14)',
      padding: '14px 16px', borderRadius: '16px', fontSize: '0.95rem', cursor: 'pointer',
      fontWeight: '500', width: '100%', marginBottom: '8px', textAlign: 'left',
      display: 'flex', alignItems: 'center', gap: '10px',
      fontFamily: "'Inter', system-ui, sans-serif",
      backdropFilter: 'blur(24px) saturate(200%)', WebkitBackdropFilter: 'blur(24px) saturate(200%)',
      boxShadow: '0 6px 24px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.18)',
    },
    menuBtnDisabled: {
      background: 'rgba(255,255,255,0.02)', color: th.sub, border: '1px solid rgba(255,255,255,0.06)',
      padding: '14px 16px', borderRadius: '16px', fontSize: '0.95rem', cursor: 'not-allowed',
      fontWeight: '400', width: '100%', marginBottom: '8px', textAlign: 'left',
      display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.45,
    },
    menuBtnActive: {
      background: `linear-gradient(135deg, ${th.accent}25, ${th.accent}10)`, color: th.text,
      border: `1px solid ${th.accent}60`,
      padding: '14px 16px', borderRadius: '16px', fontSize: '0.95rem', cursor: 'pointer',
      fontWeight: '600', width: '100%', marginBottom: '8px', textAlign: 'left',
      display: 'flex', alignItems: 'center', gap: '10px',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      boxShadow: `0 4px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12), 0 0 0 1px ${th.accent}20`,
    },
    menuBtnWarning: {
      background: '#f4433611', color: th.text, border: '1px solid #f44336',
      padding: '14px 16px', borderRadius: '14px', fontSize: '0.95rem', cursor: 'pointer',
      fontWeight: '500', width: '100%', marginBottom: '8px', textAlign: 'left',
      display: 'flex', alignItems: 'center', gap: '10px',
      boxShadow: '0 3px 0 #8b0000, 0 5px 10px rgba(0,0,0,0.3)',
    },
    optionBtn: (selected, correct, revealed) => {
      let bg = th.card; let border = `1px solid ${th.border}`; let shadow = `0 2px 0 ${th.border}`
      if (revealed && correct) { bg = '#4CAF5022'; border = '2px solid #4CAF50'; shadow = '0 2px 0 #2e7d32' }
      else if (revealed && selected && !correct) { bg = '#f4433622'; border = '2px solid #f44336'; shadow = '0 2px 0 #8b0000' }
      else if (selected) { bg = th.accent + '22'; border = `2px solid ${th.accent}`; shadow = `0 2px 0 ${th.sub}` }
      return { background: bg, color: th.text, border, padding: '12px 16px', borderRadius: '12px', fontSize: '0.9rem', cursor: revealed ? 'default' : 'pointer', width: '100%', marginBottom: '8px', textAlign: 'left', boxShadow: shadow }
    },
    revealBtn: {
      background: `linear-gradient(135deg, ${th.accent}35, ${th.accent}20)`,
      color: th.text, border: `1px solid ${th.accent}60`,
      padding: '12px 28px', borderRadius: '50px', fontSize: '1rem', cursor: 'pointer', fontWeight: '700',
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      boxShadow: `0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.14)`,
    },
    answerRow: { display: 'flex', gap: '8px', width: '100%', flexWrap: 'wrap' },
    wrongBtn: {
      flex: 1, background: 'rgba(224,108,117,0.12)', color: '#e06c75', border: '1px solid rgba(224,108,117,0.4)',
      padding: '12px 8px', borderRadius: '50px', fontSize: '0.95rem', cursor: 'pointer', fontWeight: 'bold',
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
      minWidth: '0',
    },
    fastBtn: {
      flex: 1, background: 'rgba(255,165,0,0.12)', color: '#FFA500', border: '1px solid rgba(255,165,0,0.4)',
      padding: '12px 8px', borderRadius: '50px', fontSize: '0.95rem', cursor: 'pointer', fontWeight: 'bold',
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
      minWidth: '0',
    },
    easyBtn: {
      flex: 1, background: `rgba(255,255,255,0.06)`, color: th.gold, border: `1px solid ${th.gold}55`,
      padding: '12px 8px', borderRadius: '50px', fontSize: '0.95rem', cursor: 'pointer',
      fontWeight: 'bold',
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      boxShadow: '0 3px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
      minWidth: '0',
    },
    rightBtn: {
      flex: 1, background: `linear-gradient(135deg, ${th.accent}35, ${th.accent}18)`,
      color: th.text, border: `1px solid ${th.accent}55`,
      padding: '12px 8px', borderRadius: '50px', fontSize: '0.95rem', cursor: 'pointer', fontWeight: 'bold',
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12)',
      minWidth: '0',
    },
    stopBtn: {
      background: 'transparent', color: '#f44336', border: '1px solid #f44336',
      padding: '5px 12px', borderRadius: '50px', fontSize: '0.8rem', cursor: 'pointer',
      boxShadow: '0 2px 0 #8b0000',
    },
    logoutBtn: {
      background: 'rgba(255,255,255,0.05)', color: th.sub, border: `1px solid rgba(255,255,255,0.1)`,
      padding: '10px 24px', borderRadius: '50px', fontSize: '0.85rem', cursor: 'pointer',
      width: '100%', marginTop: '4px',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
    },
    legalBtn: {
      background: 'transparent', color: th.sub, border: 'none',
      padding: '8px', fontSize: '0.75rem', cursor: 'pointer', width: '100%', marginTop: '8px', opacity: 0.5,
    },
    error: { color: '#ff6b6b', fontSize: '0.85rem', marginTop: '16px' },
    themeRow: { display: 'flex', gap: '8px', marginBottom: '12px' },
    themeBtn: (active, color) => ({
      flex: 1, padding: '10px 4px', borderRadius: '50px',
      border: active ? `2px solid ${color}` : `1px solid ${th.border}`,
      background: active ? color + '22' : th.card, color: th.text,
      cursor: 'pointer', fontSize: '0.75rem', fontWeight: active ? 'bold' : 'normal',
      boxShadow: active ? `0 3px 0 ${th.sub}` : `0 2px 0 ${th.border}`,
    }),
    backBtn: {
      background: 'transparent', color: th.sub, border: 'none',
      padding: '6px 0', fontSize: '0.9rem', cursor: 'pointer', marginBottom: '12px',
      textAlign: 'left', display: 'block',
    },
    headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' },
    input: { width: '100%', padding: '12px', borderRadius: '12px', border: `1px solid ${th.border}`, background: th.card, color: th.text, fontSize: '1rem', marginBottom: '10px', boxSizing: 'border-box' },
    langSelectBtn: (selected) => ({
      padding: '10px 14px', borderRadius: '12px',
      border: selected ? `2px solid ${th.accent}` : `1px solid ${th.border}`,
      background: selected ? th.accent + '22' : th.card, color: th.text,
      cursor: 'pointer', fontSize: '0.9rem', marginBottom: '8px', width: '100%',
      textAlign: 'left', display: 'flex', justifyContent: 'space-between',
      boxShadow: selected ? `0 2px 0 ${th.sub}` : `0 2px 0 ${th.border}`,
    }),
    infoBox: { background: th.accent + '18', border: `1px solid ${th.accent}`, borderRadius: '12px', padding: '12px', marginBottom: '10px', color: th.text, fontSize: '0.9rem' },
    resumeBanner: { background: th.card, border: `1px solid ${th.accent}`, borderRadius: '14px', padding: '14px 16px', marginBottom: '12px', textAlign: 'left' },
    catBtn: {
      background: th.btnFaceGrad, color: th.btnTextColor, border: 'none',
      padding: '14px 10px', borderRadius: '20px', fontSize: '0.84rem', cursor: 'pointer',
      fontWeight: '700', flex: 1, lineHeight: '1.3', textAlign: 'center',
      boxShadow: th.shadow3d,
      fontFamily: "'Playfair Display', Georgia, serif",
      letterSpacing: '0.1px',
    },
    navBtn: {
      background: 'linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
      color: th.sub, border: `1px solid rgba(255,255,255,0.10)`,
      padding: '11px 16px', borderRadius: '12px', fontSize: '0.88rem', cursor: 'pointer',
      fontWeight: '500', width: '100%', marginBottom: '6px', textAlign: 'center',
      backdropFilter: 'blur(16px) saturate(180%)', WebkitBackdropFilter: 'blur(16px) saturate(180%)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.10)',
      fontFamily: "'Inter', system-ui, sans-serif",
      WebkitAppearance: 'none', appearance: 'none',
    },
  }
}

const T = {
  de: {
    hello: 'Hallo', mySession: '🃏 Meine Session', whereAmI: '🎯 Wo stehe ich?',
    aiChat: '🤖 KI-Gespräch', dailyPhrase: '☀️ Tages-Phrase',
    progressBtn: '📈 Fortschritt', logout: 'Abmelden',
    myProgress: 'Dein Fortschritt', notActive: 'Noch kein Partner',
    card: 'Karte', of: 'von', showSolution: 'Lösung anzeigen',
    correct: 'Richtig', wrong: 'Falsch', fast: 'Fast', easy: 'Easy', stop: '✕ Beenden',
    stopConfirm: 'Session wirklich beenden?', done: 'Heute. Gut gemacht.', back: 'Zurück',
    masteryMsg: 'Deine Stimme wächst. 3 neue Karten.',
    comingSoon: 'Kommt bald', chooseTheme: 'Wähle dein Theme', settingsTitle: 'Einstellungen',
    partnerTitle: '🤝 Partner verbinden', partnerInvite: 'Teile diesen Link mit deinem Partner:',
    partnerCopy: 'Link kopieren', partnerCopied: '✓ Kopiert!', partnerCode: 'Oder gib den Code deines Partners ein:',
    partnerConnect: 'Verbinden', partnerConnected: 'Partner verbunden ✓',
    partnerDisconnect: 'Verbindung trennen', partnerAccept: 'Annehmen', partnerDecline: 'Ablehnen',
    langSetupTitle: 'Welche Sprachen lernst du?', langSetupSub: 'Wähle 1 bis 3 Sprachen', langSetupDone: 'Weiter',
    testQuestion: 'Frage', testOf: 'von', testDone: 'Geschätztes Niveau:',
    testBack: 'Zurück zum Menü', testScore: 'Richtig beantwortet', testStop3: '3 falsch hintereinander — Test endet hier.',
    resumeTitle: 'Weitermachen wo du aufgehört hast?', resumeOf: 'von', resumeCards: 'Karten beantwortet',
    resumeContinue: 'Weiter', resumeDiscard: 'Neu starten',
    pronunciation: 'Aussprache',
    streak: 'Tage in Folge', streakNone: 'Noch kein Streak', historyLabel: 'Letzte 7 Tage',
    impressumLink: 'Impressum & Datenschutz',
    impressumTitle: 'Impressum',
    datenschutzTitle: 'Datenschutzerklärung',
    monthlyTestBanner: '🎯 Monatlicher Level-Check fällig!',
    monthlyTestSub: 'Teste dein aktuelles Niveau',
    menuWorte: 'Meine\nWorte', menuSaetze: 'werden\nSätze', menuStraße: 'Auf der\nStraße', menuHause: 'und zu\nHause',
    menuAlle: 'Wir lernen alles, überall',
    menuGrundlagen: 'Die\nGrundlagen', menuUrlaub: 'Im\nUrlaub',
    menuKi: 'KI-Gespräch', menuSatz: 'Satztraining',
    menuAddCards: 'Karten hinzufügen', menuCategorize: 'Kategorisieren', menuSettings: 'Einstellungen', menuSignOut: 'Abmelden',
    menuPartnerConnect: 'Partner verbinden', menuPartnerLabel: 'Partner',
    weekGoalTitle: 'Wochenziel', weekGoalDone: 'Heute: vollständig. ✓',
    // ResultScreen
    weakestCard: 'Schwächste Karte', strongestCard: 'Stärkste Karte',
    urlaubLocked: '3 von 10 Karten freigeschaltet', urlaubPremiumNote: 'Premium schaltet alle Reisephrasen frei.',
    rhythmusBtn: 'Rhythmus üben', again: 'Nochmal', finishDone: 'Fertig',
    // Settings
    music: 'Hintergrundmusik', musicOn: 'An', musicOff: 'Aus', volumeLabel: 'Lautstärke',
    dailyGoalLabel: 'Tägliches Lernziel', cardsPerDay: 'Karten pro Tag',
    languagesLabel: 'Sprachen', paused: 'Pausiert', active: 'Aktiv',
    learnLanguages: '🌍 Lernsprachen & Anteile', addLanguage: 'Sprache hinzufügen:',
    darkModeLabel: 'Dunkel', lightModeLabel: 'Hell', cardSizeLabel: '📐 Kartengröße',
    streakProtection: 'Streak-Schutz', streakFree0: '0 Freezes verfügbar — Premium: 1x/Monat',
    freezeAvailThis: 'Verfügbar diesen Monat:', freezeUsed: 'verwendet', freezeActivate: 'Freeze aktivieren',
    socialRegisterLabel: 'Soziales Register', socialRegisterNote: 'Wie lernst ihr zusammen? Beeinflusst den Ton der KI.',
    relationshipType: 'Beziehungstyp', relationshipNote: 'Prägt den Ton eurer Tageskarte.',
    // SatzTraining
    satzNotEnough: 'Noch nicht genug Wörter',
    satzNotEnoughDesc: 'Übe zuerst mehr Wörter in Meine Worte — du brauchst mindestens 5 Wörter mit Mastery ≥ 2.',
    generating: 'KI erstellt deine Grammatik-Übungen…', connectionError: 'Verbindungsfehler. Bitte erneut versuchen.',
    retry: 'Erneut versuchen', satzDone: 'Fertig! 🎉', newExercises: '🔄 Neue Übungen',
    yourAnswer: 'Deine Antwort…', tapWords: 'Tippe auf Wörter unten',
    checkBtn: 'Prüfen', nextBtn: 'Weiter →', finishBtn: 'Fertig',
    // Rhythmus
    rhythmusTitle: 'Sprachrhythmus', rhythmusSub: 'Höre zu — dann sprich nach',
    rhythmusNoCards: 'Lerne mehr Satz-Karten, um Rhythmus-Training freizuschalten.',
    repeatAfter: 'Spreche nach:', listen: 'Anhören', speakNow: 'Jetzt sprechen',
    listening: 'Zuhören…', useChrome: 'Bitte Chrome verwenden',
    youSaid: 'Du hast gesagt:', tryAgain: 'Nochmal', pronouncePct: 'Aussprache: ',
    // Kontextwechsel
    kontextTitle: 'Kontextwechsel', kontextGenerating: 'KI erstellt Varianten…',
    kontextUnavail: 'Varianten nicht verfügbar.', kontextChoose: 'Wähle einen Kontext zum Hinzufügen:',
    learn: 'Lernen', variantSaved: 'Variante gespeichert!',
    // Stats
    statistics: 'Statistiken', learnedToday: 'Heute gelernt', statDays: 'Tage',
    totalCards: 'Karten gesamt', dueTomorrow: 'Morgen fällig',
    studyTime: '⏱ Lernzeit', week: 'Woche', month: 'Monat', total: 'Gesamt',
    favArea: 'Lieblingsbereich', tenseLevel: '📚 Zeitformen-Level',
    reactionTime: '⚡ Reaktionszeit', average: 'Durchschnitt', fastest: 'Schnellste',
    hardestCard: 'Schwierigste Karte',
    // Tense celebration
    tenseUnlocked: 'Neue Zeitform freigeschaltet!', gotIt: 'Verstanden ✓',
    // KI
    kiTranslate: '🌐 Übersetzen',
    // Karte erstellen / partner
    noPartnerConnected: 'Verbinde zuerst deinen Partner.', chooseMasteredCard: 'Wähle eine gemeisterte Karte:',
    noMasteredCards: 'Noch keine gemeisterten Karten.', personalMessage: 'Persönliche Nachricht (optional):',
    // General extras
    saving: 'Speichern…', sessionDone: 'Session beendet!', results: 'Ergebnis',
    cards: 'Karten', noCardsYet: 'Noch keine Karten — füge welche hinzu!',
    categories: 'Kategorien', newCategory: 'Neue Kategorie',
    noCategoriesYet: 'Noch keine Kategorien — erstelle deine erste!',
    manual: 'Manuell', front: 'Vorderseite', backLabel: 'Rückseite',
    addCard: 'Karte hinzufügen', generate10: '10 Karten generieren',
    topicPlaceholder: 'Thema (z.B. Farben auf Spanisch)', deleteSet: 'Set löschen',
    share: 'Teilen', categoryName: 'Name der Kategorie', createCategory: 'Kategorie erstellen',
    thisWeekTogether: 'Diese Woche zusammen', bothGoalsDone: '✓ Beide Ziele erreicht!',
    changeGoal: 'Ziel ändern', ourCards: 'Unsere Karten', learnTogether: 'Jetzt zusammen lernen',
    learnTogetherSub: 'Gleiche Karten — gleichzeitig',
    sessionResult: 'Session beendet!', sessionBack: '← Zurück',
    readyJointSession: 'Bereit für eine gemeinsame Session?',
    jointDesc: 'Beide sehen dieselben Karten gleichzeitig.',
    startSession: '🚀 Session starten', partnerStarted: ' hat eine Session gestartet.',
    joinBtn: 'Beitreten', sync: 'Synchron', answering: 'antwortet…', waitingFor: 'Wartet auf ',
    endBtn: 'Beenden', learnToge: '⚡ Gemeinsam lernen',
  },
  en: {
    hello: 'Hello', mySession: '🃏 My session', whereAmI: '🎯 Where do I stand?',
    aiChat: '🤖 AI conversation', dailyPhrase: '☀️ Phrase of the day',
    progressBtn: '📈 Progress', logout: 'Sign out',
    myProgress: 'Your progress', notActive: 'No partner yet',
    card: 'Card', of: 'of', showSolution: 'Show answer',
    correct: 'Correct', wrong: 'Wrong', fast: 'Fast', easy: 'Easy', stop: '✕ Stop',
    stopConfirm: 'Stop this session?', done: 'Well done.', back: 'Back',
    masteryMsg: 'Your voice is growing. 3 new cards.',
    comingSoon: 'Coming soon', chooseTheme: 'Choose your theme', settingsTitle: 'Settings',
    partnerTitle: '🤝 Connect partner', partnerInvite: 'Share this link with your partner:',
    partnerCopy: 'Copy link', partnerCopied: '✓ Copied!', partnerCode: "Or enter your partner's code:",
    partnerConnect: 'Connect', partnerConnected: 'Partner connected ✓',
    partnerDisconnect: 'Disconnect', partnerAccept: 'Accept', partnerDecline: 'Decline',
    langSetupTitle: 'Which languages are you learning?', langSetupSub: 'Choose 1 to 3 languages', langSetupDone: 'Continue',
    testQuestion: 'Question', testOf: 'of', testDone: 'Estimated level:',
    testBack: 'Back to menu', testScore: 'Correct answers', testStop3: '3 wrong in a row — test ends here.',
    resumeTitle: 'Continue where you left off?', resumeOf: 'of', resumeCards: 'cards answered',
    resumeContinue: 'Continue', resumeDiscard: 'Start fresh',
    pronunciation: 'Pronunciation',
    streak: 'days in a row', streakNone: 'No streak yet', historyLabel: 'Last 7 days',
    impressumLink: 'Imprint & Privacy',
    impressumTitle: 'Imprint',
    datenschutzTitle: 'Privacy Policy',
    monthlyTestBanner: '🎯 Monthly level check due!',
    monthlyTestSub: 'Test your current level',
    menuWorte: 'My\nWords', menuSaetze: 'become\nSentences', menuStraße: 'On the\nStreet', menuHause: 'and at\nHome',
    menuAlle: 'We learn everything, everywhere',
    menuGrundlagen: 'The\nBasics', menuUrlaub: 'On\nVacation',
    menuKi: 'AI Chat', menuSatz: 'Sentence training',
    menuAddCards: 'Add cards', menuCategorize: 'Categorize', menuSettings: 'Settings', menuSignOut: 'Sign out',
    menuPartnerConnect: 'Connect partner', menuPartnerLabel: 'Partner',
    weekGoalTitle: 'Weekly goal', weekGoalDone: 'Today: complete. ✓',
    // ResultScreen
    weakestCard: 'Weakest card', strongestCard: 'Strongest card',
    urlaubLocked: '3 of 10 cards unlocked', urlaubPremiumNote: 'Premium unlocks all travel phrases.',
    rhythmusBtn: 'Rhythm practice', again: 'Again', finishDone: 'Done',
    // Settings
    music: 'Background music', musicOn: 'On', musicOff: 'Off', volumeLabel: 'Volume',
    dailyGoalLabel: 'Daily learning goal', cardsPerDay: 'Cards per day',
    languagesLabel: 'Languages', paused: 'Paused', active: 'Active',
    learnLanguages: '🌍 Learning languages & share', addLanguage: 'Add language:',
    darkModeLabel: 'Dark', lightModeLabel: 'Light', cardSizeLabel: '📐 Card size',
    streakProtection: 'Streak Protection', streakFree0: '0 freezes available — Premium: 1x/month',
    freezeAvailThis: 'Available this month:', freezeUsed: 'used', freezeActivate: 'Activate Freeze',
    socialRegisterLabel: 'Social Register', socialRegisterNote: 'How do you learn together? Affects AI tone.',
    relationshipType: 'Relationship type', relationshipNote: 'Shapes the tone of your daily card.',
    // SatzTraining
    satzNotEnough: 'Not enough words yet',
    satzNotEnoughDesc: 'Practice more words in My Words first — you need at least 5 words with mastery ≥ 2.',
    generating: 'AI is preparing your grammar exercises…', connectionError: 'Connection error. Please try again.',
    retry: 'Try again', satzDone: 'Done! 🎉', newExercises: '🔄 New exercises',
    yourAnswer: 'Your answer…', tapWords: 'Tap words below',
    checkBtn: 'Check', nextBtn: 'Next →', finishBtn: 'Finish',
    // Rhythmus
    rhythmusTitle: 'Speech Rhythm', rhythmusSub: 'Listen — then repeat',
    rhythmusNoCards: 'Learn more sentence cards to unlock rhythm training.',
    repeatAfter: 'Repeat after me:', listen: 'Listen', speakNow: 'Speak now',
    listening: 'Listening…', useChrome: 'Please use Chrome',
    youSaid: 'You said:', tryAgain: 'Try again', pronouncePct: 'Pronunciation: ',
    // Kontextwechsel
    kontextTitle: 'Context Switch', kontextGenerating: 'AI generating variants…',
    kontextUnavail: 'Variants not available.', kontextChoose: 'Choose a context to add:',
    learn: 'Learn', variantSaved: 'Variant saved!',
    // Stats
    statistics: 'Statistics', learnedToday: 'Learned today', statDays: 'days',
    totalCards: 'Total cards', dueTomorrow: 'Due tomorrow',
    studyTime: '⏱ Study time', week: 'Week', month: 'Month', total: 'Total',
    favArea: 'Favourite area', tenseLevel: '📚 Tense Level',
    reactionTime: '⚡ Reaction time', average: 'Average', fastest: 'Fastest',
    hardestCard: 'Hardest card',
    // Tense celebration
    tenseUnlocked: 'New tense unlocked!', gotIt: 'Got it ✓',
    // KI
    kiTranslate: '🌐 Translate',
    // Karte erstellen / partner
    noPartnerConnected: 'Connect a partner first.', chooseMasteredCard: 'Choose a mastered card:',
    noMasteredCards: 'No mastered cards yet.', personalMessage: 'Personal message (optional):',
    // General extras
    saving: 'Saving…', sessionDone: 'Session done!', results: 'Results',
    cards: 'cards', noCardsYet: 'No cards yet — add some!',
    categories: 'Categories', newCategory: 'New category',
    noCategoriesYet: 'No categories yet — create your first one!',
    manual: 'Manual', front: 'Front', backLabel: 'Back',
    addCard: 'Add card', generate10: 'Generate 10 cards',
    topicPlaceholder: 'Topic (e.g. Colors in Spanish)', deleteSet: 'Delete set',
    share: 'Share', categoryName: 'Category name', createCategory: 'Create category',
    thisWeekTogether: 'This week together', bothGoalsDone: '✓ Both goals reached!',
    changeGoal: 'Change goal', ourCards: 'Our Cards', learnTogether: 'Learn together now',
    learnTogetherSub: 'Same cards — at the same time',
    sessionResult: 'Session done!', sessionBack: '← Back',
    readyJointSession: 'Ready for a joint session?',
    jointDesc: 'Both see the same cards at the same time.',
    startSession: '🚀 Start session', partnerStarted: ' started a session.',
    joinBtn: 'Join', sync: 'Sync', answering: 'answering…', waitingFor: 'Waiting for ',
    endBtn: 'End', learnToge: '⚡ Learn together',
  }
}

const loadLocale = async (lang) => {
  try {
    const r = await fetch('/locales/' + (lang || 'de').toLowerCase() + '.json')
    return r.json()
  } catch { return {} }
}

// Check Firestore sharedCards pool before individual KI generation
const fetchSharedCards = async (fromLang, toLang) => {
  try {
    const weekStr = getISOWeekStr()
    const langPair = `${fromLang}_${toLang}`
    const snap = await getDoc(doc(db, 'sharedCards', `${langPair}_${weekStr}`))
    if (!snap.exists()) return null
    const cards = snap.data()?.cards
    return Array.isArray(cards) && cards.length > 0 ? cards : null
  } catch { return null }
}

// Load base pool (grundlagen level 1) cards for a language pair
const fetchGrundlagenPool = async (fromLang, toLang, level = 1) => {
  try {
    const snap = await getDoc(doc(db, 'sharedCards', `${fromLang}_${toLang}_grundlagen_${level}`))
    if (!snap.exists()) return null
    const cards = snap.data()?.cards
    return Array.isArray(cards) && cards.length > 0 ? cards : null
  } catch { return null }
}

const WEEK_AREAS = [
  { key: 'vocabulary', labelDe: 'Wörter', labelEn: 'Words', tipDe: 'Meine Worte – diese Woche noch nicht geübt', tipEn: 'My Words – not practiced this week' },
  { key: 'sentence', labelDe: 'Sätze', labelEn: 'Sentences', tipDe: 'Sätze – diese Woche noch nicht geübt', tipEn: 'Sentences – not practiced this week' },
  { key: 'street', labelDe: 'Straße', labelEn: 'Street', tipDe: 'Auf der Straße – diese Woche noch nicht geübt', tipEn: 'On the Street – not practiced this week' },
  { key: 'home', labelDe: 'Zuhause', labelEn: 'Home', tipDe: 'Zu Hause – diese Woche noch nicht geübt', tipEn: 'At Home – not practiced this week' },
  { key: 'satztraining', labelDe: 'Training', labelEn: 'Training', tipDe: 'Satztraining – diese Woche noch nicht geübt', tipEn: 'Sentence Training – not practiced this week' },
  { key: 'basics', labelDe: 'Grundlagen', labelEn: 'Basics', tipDe: 'Grundlagen – noch nicht geübt', tipEn: 'Basics – not practiced yet' },
  { key: 'urlaub', labelDe: 'Im Urlaub', labelEn: 'Travel', tipDe: 'Im Urlaub – noch nicht geübt', tipEn: 'Travel – not practiced yet' },
]

// ── ONBOARDING SCREEN ─────────────────────────────────────────
const ONBOARDING_SLIDES_DE = [
  {
    emoji: '🌉',
    title: 'Willkommen bei Vocara',
    text: 'Die Stimme ist die Brücke.\nVocara hilft dir, eine neue Sprache Schritt für Schritt aufzubauen — gemeinsam mit deinem Partner.',
  },
  {
    emoji: '🃏',
    title: 'Intelligente Karteikarten',
    text: 'Vocara zeigt dir Karten genau dann, wenn du sie brauchst. Schnelle Antworten = längere Pause. Schwierige Karten kommen öfter zurück.',
  },
  {
    emoji: '🤝',
    title: 'Lernt zusammen',
    text: 'Verbinde dich mit deinem Partner. Ihr seht gegenseitig euren Fortschritt — egal wie weit ihr voneinander entfernt seid.',
  },
  {
    emoji: '🚀',
    title: 'Bereit?',
    text: 'Mach zuerst einen kurzen Level-Check, damit wir wissen wo du startest. Es dauert nur 2 Minuten.',
  },
]
const ONBOARDING_SLIDES_EN = [
  {
    emoji: '🌉',
    title: 'Welcome to Vocara',
    text: 'The voice is the bridge.\nVocara helps you build a new language step by step — together with your partner.',
  },
  {
    emoji: '🃏',
    title: 'Smart flashcards',
    text: 'Vocara shows you cards exactly when you need them. Fast answers = longer break. Difficult cards come back more often.',
  },
  {
    emoji: '🤝',
    title: 'Learn together',
    text: "Connect with your partner. You can see each other's progress — no matter how far apart you are.",
  },
  {
    emoji: '🚀',
    title: 'Ready?',
    text: 'First, take a quick level check so we know where you start. It only takes 2 minutes.',
  },
]

function OnboardingScreen({ lang, theme, onDone }) {
  const th = THEMES[theme]
  const slides = lang === 'de' ? ONBOARDING_SLIDES_DE : ONBOARDING_SLIDES_EN
  const [index, setIndex] = useState(0)
  const [showCities, setShowCities] = useState(false)
  const [showRelType, setShowRelType] = useState(false)
  const [homeCity, setHomeCity] = useState('')
  const [partnerCity, setPartnerCity] = useState('')
  const [pendingCityData, setPendingCityData] = useState({})
  const isLast = index === slides.length - 1
  const slide = slides[index]

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '1rem', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }
  const relBtnStyle = (active) => ({
    width: '100%', padding: '14px 16px', borderRadius: '14px', cursor: 'pointer', fontSize: '1rem',
    fontWeight: active ? '700' : '500', marginBottom: '10px',
    background: active ? `${th.accent}25` : 'rgba(255,255,255,0.05)',
    color: active ? th.text : th.sub,
    border: `1px solid ${active ? th.accent : 'rgba(255,255,255,0.1)'}`,
    textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  })

  if (showRelType) {
    const REL_OPTIONS = [
      { key: 'couple',     emoji: '💑', de: 'Romantisches Paar',  en: 'Romantic couple'     },
      { key: 'friends',    emoji: '👫', de: 'Freunde',             en: 'Friends'             },
      { key: 'family',     emoji: '👨‍👩‍👧', de: 'Familie',             en: 'Family'             },
      { key: 'colleagues', emoji: '👔', de: 'Kollegen / Business', en: 'Colleagues / Business'},
    ]
    return (
      <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: th.bg }} className="vocara-screen">
        <div style={{ textAlign: 'center', padding: '32px 24px', width: '100%', maxWidth: '420px', animation: 'vocaraFadeIn 0.3s ease both' }}>
          <p style={{ fontSize: '3.5rem', margin: '0 0 16px 0' }}>🤝</p>
          <h2 style={{ color: th.gold, fontSize: '1.5rem', fontWeight: 'bold', margin: '0 0 10px 0' }}>
            {lang === 'de' ? 'Was verbindet euch?' : 'What connects you?'}
          </h2>
          <p style={{ color: th.sub, fontSize: '0.9rem', lineHeight: '1.6', margin: '0 0 24px 0' }}>
            {lang === 'de' ? 'Das beeinflusst den Ton eurer täglichen Karten.' : 'This shapes the tone of your daily cards.'}
          </p>
          {REL_OPTIONS.map(opt => (
            <button key={opt.key} style={relBtnStyle(false)}
              onClick={() => onDone({ ...pendingCityData, relationshipType: opt.key })}>
              <span style={{ fontSize: '1.5rem' }}>{opt.emoji}</span>
              <span>{lang === 'de' ? opt.de : opt.en}</span>
            </button>
          ))}
          <button style={{ background: 'transparent', color: th.sub, border: 'none', padding: '8px', fontSize: '0.85rem', cursor: 'pointer', width: '100%', marginTop: '4px' }}
            onClick={() => onDone(pendingCityData)}>
            {lang === 'de' ? 'Überspringen' : 'Skip'}
          </button>
        </div>
      </div>
    )
  }

  if (showCities) {
    return (
      <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: th.bg }} className="vocara-screen">
        <div style={{ textAlign: 'center', padding: '32px 24px', width: '100%', maxWidth: '420px', animation: 'vocaraFadeIn 0.3s ease both' }}>
          <p style={{ fontSize: '3.5rem', margin: '0 0 16px 0' }}>🏙️</p>
          <h2 style={{ color: th.gold, fontSize: '1.5rem', fontWeight: 'bold', margin: '0 0 10px 0' }}>
            {lang === 'de' ? 'Eure Städte' : 'Your cities'}
          </h2>
          <p style={{ color: th.sub, fontSize: '0.95rem', lineHeight: '1.6', margin: '0 0 28px 0' }}>
            {lang === 'de'
              ? 'Damit die KI-Karten persönliche Geschichten über euch erzählen können.'
              : 'So the AI cards can tell personal stories about you.'}
          </p>
          <input
            style={inputStyle}
            placeholder={lang === 'de' ? '🏠 Deine Stadt (z.B. Hamburg)' : '🏠 Your city (e.g. Hamburg)'}
            value={homeCity}
            onChange={e => setHomeCity(e.target.value)}
          />
          <input
            style={inputStyle}
            placeholder={lang === 'de' ? '✈️ Stadt deines Partners (z.B. Nairobi)' : "✈️ Partner's city (e.g. Nairobi)"}
            value={partnerCity}
            onChange={e => setPartnerCity(e.target.value)}
          />
          <button
            style={{ background: th.accent, color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '10px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold', width: '100%', marginBottom: '12px' }}
            onClick={() => {
              const cityData = { homeCity: homeCity.trim() || undefined, partnerCity: partnerCity.trim() || undefined }
              setPendingCityData(cityData)
              setShowRelType(true)
            }}
          >
            {lang === 'de' ? 'Weiter →' : 'Next →'}
          </button>
          <button
            style={{ background: 'transparent', color: th.sub, border: 'none', padding: '8px', fontSize: '0.85rem', cursor: 'pointer', width: '100%' }}
            onClick={() => onDone({})}
          >
            {lang === 'de' ? 'Überspringen' : 'Skip'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: th.bg }} className="vocara-screen">
      <div style={{ textAlign: 'center', padding: '32px 24px', width: '100%', maxWidth: '420px' }}>
        {/* Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
          {slides.map((_, i) => (
            <div key={i} style={{ width: i === index ? '24px' : '8px', height: '8px', borderRadius: '4px', background: i === index ? th.accent : th.border, transition: 'all 0.3s ease' }} />
          ))}
        </div>

        {/* Slide content */}
        <div key={index} style={{ animation: 'vocaraFadeIn 0.3s ease both' }}>
          <p style={{ fontSize: '4rem', margin: '0 0 16px 0' }}>{slide.emoji}</p>
          <h2 style={{ color: th.gold, fontSize: '1.5rem', fontWeight: 'bold', margin: '0 0 16px 0' }}>{slide.title}</h2>
          <p style={{ color: th.sub, fontSize: '1rem', lineHeight: '1.7', margin: '0 0 40px 0', whiteSpace: 'pre-line' }}>{slide.text}</p>
        </div>

        {/* Buttons */}
        <button
          style={{ background: th.accent, color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '10px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold', width: '100%', marginBottom: '12px' }}
          onClick={() => isLast ? setShowCities(true) : setIndex(i => i + 1)}
        >
          {isLast ? (lang === 'de' ? 'Weiter →' : 'Next →') : (lang === 'de' ? 'Weiter →' : 'Next →')}
        </button>
        {!isLast && (
          <button
            style={{ background: 'transparent', color: th.sub, border: 'none', padding: '8px', fontSize: '0.85rem', cursor: 'pointer', width: '100%' }}
            onClick={() => onDone({})}
          >
            {lang === 'de' ? 'Überspringen' : 'Skip'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── IMPRESSUM SCREEN ──────────────────────────────────────────
function ImpressumScreen({ lang, theme, onBack }) {
  const th = THEMES[theme]; const s = makeStyles(th); const t = T[lang]
  const p = () => ({ color: th.sub, fontSize: '0.85rem', lineHeight: '1.7', margin: '0 0 10px 0' })
  return (
    <div style={s.container} className="vocara-screen"><div style={{ ...s.homeBox, textAlign: 'left' }}>
      <button style={s.backBtn} onClick={onBack}>← {t.back}</button>
      <h2 style={{ color: th.gold, fontSize: '1.2rem', marginBottom: '4px' }}>{t.impressumTitle}</h2>
      <div style={s.card}>
        <p style={p()}>Angaben gemäß § 5 TMG</p>
        <p style={{ ...p(), color: th.text, fontWeight: '500' }}>Mark Reimer<br />Winsener Str. 145<br />21077 Hamburg</p>
        <p style={p()}>E-Mail: mark.reimer@mail.de</p>
        <p style={{ ...p(), fontSize: '0.75rem' }}>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV: Mark Reimer, Anschrift wie oben.</p>
      </div>
      <h2 style={{ color: th.gold, fontSize: '1.2rem', margin: '20px 0 4px 0' }}>{t.datenschutzTitle}</h2>
      <div style={s.card}>
        <p style={{ color: th.sub, fontSize: '0.8rem', fontWeight: 'bold', margin: '0 0 4px 0' }}>Verantwortlicher</p>
        <p style={p()}>Mark Reimer, Winsener Str. 145, 21077 Hamburg<br />E-Mail: mark.reimer@mail.de</p>
        <p style={{ color: th.sub, fontSize: '0.8rem', fontWeight: 'bold', margin: '0 0 4px 0' }}>Gespeicherte Daten</p>
        <p style={p()}>• Google-Konto Name und E-Mail-Adresse (Login)<br />• Lernfortschritt und Karteikarten-Statistiken<br />• Theme-Einstellung und Sprachpräferenzen</p>
        <p style={{ color: th.sub, fontSize: '0.8rem', fontWeight: 'bold', margin: '0 0 4px 0' }}>Speicherort</p>
        <p style={p()}>Alle Daten werden in Google Firebase (EU-Server, Frankfurt) gespeichert. Es erfolgt keine Weitergabe an Dritte.</p>
        <p style={{ color: th.sub, fontSize: '0.8rem', fontWeight: 'bold', margin: '0 0 4px 0' }}>Ihre Rechte</p>
        <p style={p()}>Sie haben das Recht auf Auskunft, Löschung und Berichtigung Ihrer Daten. Anfragen per E-Mail an: mark.reimer@mail.de</p>
        <p style={{ color: th.sub, fontSize: '0.8rem', fontWeight: 'bold', margin: '0 0 4px 0' }}>Cookies</p>
        <p style={{ ...p(), marginBottom: 0 }}>Vocara verwendet keine Tracking-Cookies.</p>
      </div>
      <h2 style={{ color: th.gold, fontSize: '1.2rem', margin: '20px 0 4px 0' }}>KI-Disclaimer</h2>
      <div style={s.card}>
        <p style={p()}>Vocara verwendet Künstliche Intelligenz (KI) für die Generierung von Lernkarten, Aussprachehinweisen, Grammatikfeedback und Gesprächsübungen. Die KI-generierten Inhalte können Fehler enthalten und ersetzen keinen professionellen Sprachunterricht.</p>
        <p style={p()}>KI-Antworten werden durch die Claude API von Anthropic bereitgestellt. Inhalte werden nicht dauerhaft auf KI-Servern gespeichert. Nutzereingaben im KI-Gespräch werden ausschließlich zur Generierung der jeweiligen Antwort verwendet.</p>
        <p style={{ ...p(), marginBottom: 0 }}>Sprachliche Korrektheit: Obwohl die KI-Inhalte sorgfältig generiert werden, übernimmt Bridgelab keine Haftung für etwaige Fehler in den KI-generierten Texten.</p>
      </div>
      <h2 style={{ color: th.gold, fontSize: '1.2rem', margin: '20px 0 4px 0' }}>Haftungsausschluss</h2>
      <div style={s.card}>
        <p style={p()}>Die Nutzung von Vocara erfolgt auf eigene Verantwortung. Bridgelab übernimmt keine Haftung für Schäden, die durch die Nutzung der App entstehen könnten.</p>
        <p style={{ ...p(), marginBottom: 0 }}>Externe Links: Für Inhalte externer Webseiten, auf die Vocara verlinkt, übernimmt Bridgelab keine Haftung. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft.</p>
      </div>
      <h2 style={{ color: th.gold, fontSize: '1.2rem', margin: '20px 0 4px 0' }}>Nutzerinhalte (UGC)</h2>
      <div style={s.card}>
        <p style={p()}>Nutzer können eigene Lernkarten, Tagebucheinträge und Kommentare erstellen. Diese Inhalte werden in der persönlichen Firebase-Datenbank des Nutzers gespeichert und sind nur für verbundene Partner sichtbar.</p>
        <p style={{ ...p(), marginBottom: 0 }}>Bridgelab ist nicht verantwortlich für die von Nutzern erstellten Inhalte. Nutzer sind verpflichtet, keine rechtswidrigen, beleidigenden oder urheberrechtlich geschützten Inhalte einzustellen.</p>
      </div>
      <h2 style={{ color: th.gold, fontSize: '1.2rem', margin: '20px 0 4px 0' }}>Jugendschutz (COPPA)</h2>
      <div style={s.card}>
        <p style={{ ...p(), marginBottom: 0 }}>Vocara richtet sich nicht an Kinder unter 13 Jahren. Wir erheben wissentlich keine personenbezogenen Daten von Kindern unter 13 Jahren. Wenn Sie glauben, dass ein Kind unter 13 Jahren Daten übermittelt hat, kontaktieren Sie uns bitte unter mark.reimer@mail.de.</p>
      </div>
      <button style={s.button} onClick={onBack}>{t.back}</button>
    </div></div>
  )
}

const THAI_MIDDLE = new Set('กจดตฎฏบปอ')
const THAI_HIGH_LOW = new Set('ขฃฉฐถผฝศษสหคฅฆงชซฌญณทธนพฟภมยรลวฬฮ')
function ThaiColorPronunciation({ text }) {
  return (
    <>
      {[...text].map((ch, i) => {
        const code = ch.charCodeAt(0)
        if (THAI_MIDDLE.has(ch)) return <span key={i} style={{ color: '#4CAF50' }}>{ch}</span>
        if (THAI_HIGH_LOW.has(ch)) return <span key={i} style={{ color: '#9C27B0' }}>{ch}</span>
        if (code >= 0x0E48 && code <= 0x0E4B) return <span key={i} style={{ color: '#9C27B0' }}>{ch}</span>
        if (code >= 0x0E30 && code <= 0x0E47) return <span key={i} style={{ color: '#f44336' }}>{ch}</span>
        return <span key={i}>{ch}</span>
      })}
    </>
  )
}

function StreakWidget({ history, th, t }) {
  const streak = calcStreak(history)
  const days = getLast7Days(history)
  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
  const today = todayStr()
  return (
    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${th.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ color: th.sub, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{t.historyLabel}</span>
        <span style={{ color: streak > 0 ? th.gold : th.sub, fontSize: '0.85rem', fontWeight: streak > 0 ? 'bold' : 'normal' }}>
          {streak > 0 ? `🔥 ${streak} ${t.streak}` : t.streakNone}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '4px', justifyContent: 'space-between' }}>
        {days.map((day, i) => {
          const isToday = day.date === today
          const pct = day.total > 0 ? Math.round((day.correct / day.total) * 100) : 0
          const [dy, dm, dd] = day.date.split('-').map(Number)
          const d = new Date(dy, dm - 1, dd)
          const dayLabel = weekDays[d.getDay() === 0 ? 6 : d.getDay() - 1]
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
              <div style={{ width: '100%', height: '32px', borderRadius: '6px', background: day.done ? (pct >= 70 ? th.accent : th.accent + '66') : th.border, border: isToday ? `2px solid ${th.gold}` : '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: day.done ? '#fff' : th.sub, fontWeight: 'bold' }}>
                {day.done ? (day.total > 0 ? `${pct}%` : '✓') : ''}
              </div>
              <span style={{ color: isToday ? th.gold : th.sub, fontSize: '0.65rem' }}>{dayLabel}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── KI-GESPRÄCH 2.0 SZENARIEN ──────────────────────────────────
const KI_SCENARIOS = [
  { key: 'hotel',      emoji: '🏨', de: 'Hotel einchecken',      en: 'Hotel check-in',      role: 'hotel receptionist' },
  { key: 'car',        emoji: '🚗', de: 'Auto mieten',            en: 'Car rental',          role: 'car rental agent' },
  { key: 'directions', emoji: '🗺️', de: 'Nach dem Weg fragen',    en: 'Ask for directions',  role: 'local passerby' },
  { key: 'restaurant', emoji: '🍽️', de: 'Restaurant bestellen',   en: 'Restaurant order',    role: 'waiter' },
  { key: 'shopping',   emoji: '🛍️', de: 'Einkaufen',              en: 'Shopping',            role: 'shop assistant' },
  { key: 'airport',    emoji: '✈️', de: 'Am Flughafen',           en: 'At the airport',      role: 'airline agent' },
  { key: 'office',     emoji: '💼', de: 'Im Büro',                en: 'At the office',       role: 'colleague' },
  { key: 'home',       emoji: '🏠', de: 'Zu Hause',               en: 'At home',             role: 'flatmate or partner' },
  { key: 'school',     emoji: '🎓', de: 'In der Schule',          en: 'At school',           role: 'teacher or classmate' },
  { key: 'smalltalk',  emoji: '💬', de: 'Smalltalk',              en: 'Small talk',          role: 'friendly stranger' },
]

// ── KI-GESPRÄCH ───────────────────────────────────────────────
function KiGespraechScreen({ lang, theme, onBack, userName, userToLang = 'en', socialRegister = 'friends', myData, partnerData, user, t: tProp }) {
  const th = THEMES[theme]; const s = makeStyles(th); const t = tProp || T[lang] || T.en
  const isDE = lang === 'de'
  const isPremium = (user?.uid === MARK_UID || user?.uid === ELOSY_UID) || (myData?.plan && myData.plan !== 'free')
  const [scenario, setScenario] = useState(null) // null = pick, object = active scenario
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [translations, setTranslations] = useState({})
  const [translating, setTranslating] = useState(null)
  const [feedback, setFeedback] = useState(null) // null | { strengths, weaknesses, level }
  const [loadingFeedback, setLoadingFeedback] = useState(false)
  const bottomRef = useRef(null)
  const exchangeCount = messages.filter(m => m.role === 'user').length
  const ttsLangCode = userToLang.toLowerCase()
  const LANG_NAMES_FULL = { en: 'English', de: 'German', sw: 'Swahili', th: 'Thai', es: 'Spanish', fr: 'French', ar: 'Arabic', tr: 'Turkish', pt: 'Portuguese' }
  const targetLang = LANG_NAMES_FULL[ttsLangCode] || ttsLangCode
  const nativeLang = LANG_NAMES_FULL[lang] || lang

  const getSystemPrompt = (sc) => {
    if (!sc) return ''
    return `You are playing the role of a ${sc.role} in a ${isDE ? sc.de : sc.en} scenario. The user ${userName} is practicing ${targetLang}.
Stay in character throughout. Respond ONLY in ${targetLang}. Never switch to ${nativeLang}.
If the user makes a grammar mistake, continue naturally, then add a brief tip like "💡 Tip: ..."
Keep each response to 1-3 sentences. Be realistic and helpful for the scenario.
After the user has sent 10 messages, add "---END---" at the end of your response.`
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  // Auto-generate feedback when scenario ends
  useEffect(() => {
    if (!scenario || feedback || loadingFeedback) return
    const lastAI = messages.filter(m => m.role === 'assistant').slice(-1)[0]
    if (lastAI?.content?.includes('---END---')) fetchFeedback()
  }, [messages]) // eslint-disable-line

  const startScenario = async (sc) => {
    // Weekly limit check: free users get 1 scenario/week
    if (!isPremium) {
      const nowWeek = (() => { const d = new Date(); const jan4 = new Date(d.getFullYear(), 0, 4); const w = Math.floor((d - jan4) / (7*24*60*60*1000)) + 1; return `${d.getFullYear()}-W${String(w).padStart(2,'0')}` })()
      const usedThisWeek = myData?.kiScenarioWeekStr === nowWeek ? (myData?.kiScenarioCount || 0) : 0
      if (usedThisWeek >= 1) {
        // Show paywall - can't directly call setSoftPaywall here, use alert as fallback
        alert(isDE ? 'Freie Nutzer: 1 Szenario pro Woche. Premium für unbegrenzte Szenarien.' : 'Free: 1 scenario/week. Premium for unlimited.')
        return
      }
      // Increment count
      if (user) {
        const nowWeekStr = (() => { const d = new Date(); const jan4 = new Date(d.getFullYear(), 0, 4); const w = Math.floor((d - jan4) / (7*24*60*60*1000)) + 1; return `${d.getFullYear()}-W${String(w).padStart(2,'0')}` })()
        try { await updateDoc(doc(db, 'users', user.uid), { kiScenarioWeekStr: nowWeekStr, kiScenarioCount: usedThisWeek + 1 }) } catch(_) {}
      }
    }
    setScenario(sc); setMessages([]); setFeedback(null); setInput('')
    // Save to conversation history
    if (user) {
      const entry = { scenarioKey: sc.key, startedAt: Date.now(), lang: targetLang }
      try { await setDoc(doc(db, 'users', user.uid, 'conversationHistory', String(Date.now())), entry) } catch(_) {}
    }
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading || feedback) return
    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages); setInput(''); setLoading(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 250, system: getSystemPrompt(scenario), messages: newMessages })
      })
      const data = await response.json()
      const reply = data.content?.[0]?.text || '...'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Verbindungsfehler.' }])
    }
    setLoading(false)
  }

  const fetchFeedback = async () => {
    setLoadingFeedback(true)
    const conversation = messages.map(m => `${m.role === 'user' ? userName : 'AI'}: ${m.content}`).join('\n')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: 300,
          messages: [{ role: 'user', content: `Analyse this ${targetLang} conversation by a learner. Respond in ${nativeLang}.
Conversation:
${conversation}

Return ONLY JSON: {"strengths":"2-3 things they did well (1-2 sentences)","weaknesses":"1-2 things to practice (1-2 sentences)","level":"A1|A2|B1|B2|C1"}` }]
        })
      })
      const d = await res.json()
      const raw = (d.content?.[0]?.text || '').trim()
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) setFeedback(JSON.parse(match[0]))
    } catch(_) {}
    setLoadingFeedback(false)
  }

  const translateMessage = async (msgIndex, text) => {
    setTranslating(msgIndex)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 150, messages: [{ role: 'user', content: `Translate to ${nativeLang}. Return ONLY translation:\n"${text}"` }] })
      })
      const d = await res.json()
      setTranslations(prev => ({ ...prev, [msgIndex]: (d.content?.[0]?.text || '').trim() }))
    } catch (_) { setTranslations(prev => ({ ...prev, [msgIndex]: '⚠️' })) }
    setTranslating(null)
  }

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }

  // ── SCENARIO PICKER ──
  if (!scenario) return (
    <div style={{ ...s.container, minHeight: '100vh' }} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>← {t.back}</button>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <p style={{ color: th.accent, fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 6px' }}>🤖 KI-Gespräch 2.0</p>
        <p style={{ color: th.text, fontSize: '1.1rem', fontWeight: '700', margin: '0 0 4px' }}>{isDE ? 'Wähle ein Szenario:' : 'Choose a scenario:'}</p>
        <p style={{ color: th.sub, fontSize: '0.8rem', margin: 0 }}>{isDE ? '10–15 Austausche · 5–8 Minuten' : '10–15 exchanges · 5–8 minutes'}</p>
        {!isPremium && <p style={{ color: th.gold, fontSize: '0.72rem', margin: '6px 0 0', fontWeight: '600' }}>{isDE ? '🔓 Kostenfrei: 1 Szenario/Woche' : '🔓 Free: 1 scenario/week'}</p>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {KI_SCENARIOS.map(sc => (
          <button key={sc.key} onClick={() => startScenario(sc)}
            style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: '14px', padding: '14px 10px', cursor: 'pointer', textAlign: 'center', WebkitTapHighlightColor: 'transparent', transition: 'border-color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = th.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = th.border}>
            <p style={{ color: th.text, fontSize: '0.78rem', fontWeight: '600', margin: 0, lineHeight: 1.3 }}>{isDE ? sc.de : sc.en}</p>
          </button>
        ))}
      </div>
    </div></div>
  )

  // ── FEEDBACK SCREEN ──
  if (feedback) return (
    <div style={{ ...s.container, minHeight: '100vh' }} className="vocara-screen"><div style={s.homeBox}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <span style={{ fontSize: '2.5rem' }}>🎓</span>
        <p style={{ color: th.accent, fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '8px 0 4px' }}>{isDE ? 'Feedback' : 'Feedback'}</p>
        <p style={{ color: th.text, fontSize: '1.1rem', fontWeight: '700', margin: '0 0 4px' }}>{isDE ? `Dein Niveau: ${feedback.level}` : `Your level: ${feedback.level}`}</p>
      </div>
      <div style={{ ...s.card, borderLeft: '3px solid #4CAF50', marginBottom: '12px' }}>
        <p style={{ color: '#81c784', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', margin: '0 0 6px', letterSpacing: '0.5px' }}>{isDE ? '✓ Was gut war:' : '✓ What went well:'}</p>
        <p style={{ color: th.text, fontSize: '0.88rem', margin: 0, lineHeight: 1.55 }}>{feedback.strengths}</p>
      </div>
      <div style={{ ...s.card, borderLeft: '3px solid #FFA500', marginBottom: '20px' }}>
        <p style={{ color: '#FFA500', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', margin: '0 0 6px', letterSpacing: '0.5px' }}>{isDE ? '💡 Was du üben kannst:' : '💡 Things to practice:'}</p>
        <p style={{ color: th.text, fontSize: '0.88rem', margin: 0, lineHeight: 1.55 }}>{feedback.weaknesses}</p>
      </div>
      <button style={s.button} onClick={() => { setScenario(null); setMessages([]); setFeedback(null) }}>{isDE ? '🔄 Neues Szenario' : '🔄 New scenario'}</button>
      <button style={{ ...s.button, background: 'transparent', color: th.sub, border: `1px solid ${th.border}` }} onClick={onBack}>{t.back}</button>
    </div></div>
  )

  // ── CHAT SCREEN ──
  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: th.bg }} className="vocara-screen">
      <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <div style={{ padding: '12px 16px 10px', background: th.bg, borderBottom: `1px solid ${th.border}`, display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <button style={{ ...s.backBtn, marginBottom: 0 }} onClick={() => setScenario(null)}>←</button>
          <div style={{ flex: 1 }}>
            <p style={{ color: th.text, fontWeight: 'bold', margin: 0, fontSize: '0.95rem' }}>{isDE ? scenario.de : scenario.en}</p>
            <p style={{ color: th.sub, fontSize: '0.72rem', margin: 0 }}>{isDE ? `KI spielt: ${scenario.role}` : `AI plays: ${scenario.role}`} · {exchangeCount}/10</p>
          </div>
          {exchangeCount >= 6 && !loadingFeedback && (
            <button onClick={fetchFeedback} style={{ background: `${th.accent}22`, border: `1px solid ${th.accent}55`, color: th.accent, borderRadius: '10px', padding: '5px 10px', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer' }}>
              {isDE ? 'Feedback' : 'Feedback'}
            </button>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: '40px' }}>
              <p style={{ color: th.sub, fontSize: '0.88rem', lineHeight: 1.6 }}>{isDE ? `Starte das Gespräch auf ${targetLang}!` : `Start the conversation in ${targetLang}!`}</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: msg.role === 'user' ? th.accent : th.card, border: msg.role === 'assistant' ? `1px solid ${th.border}` : 'none', color: msg.role === 'user' ? (th.btnTextColor || '#111') : th.text, fontSize: '0.9rem', lineHeight: 1.5 }}>
                {msg.content.replace('---END---', '').trim()}
              </div>
              {msg.role === 'assistant' && (
                <div style={{ maxWidth: '85%', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button onClick={() => speak(msg.content, ttsLangCode)} style={{ background: 'none', border: 'none', color: th.sub, fontSize: '1rem', cursor: 'pointer', padding: '2px 4px', opacity: 0.6 }}>🔊</button>
                  {translations[i] ? (
                    <p style={{ color: th.sub, fontSize: '0.75rem', margin: 0, fontStyle: 'italic' }}>{translations[i]}</p>
                  ) : (
                    <button onClick={() => translateMessage(i, msg.content)} disabled={translating === i} style={{ background: 'none', border: 'none', color: th.sub, fontSize: '0.72rem', cursor: 'pointer', opacity: translating === i ? 0.5 : 0.7, textDecoration: 'underline' }}>
                      {translating === i ? '...' : t.kiTranslate}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {loading && <div style={{ display: 'flex' }}><div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: th.card, border: `1px solid ${th.border}`, color: th.sub, fontSize: '1.2rem', letterSpacing: '4px' }}>···</div></div>}
          {loadingFeedback && <div style={{ textAlign: 'center', padding: '20px' }}><p style={{ color: th.sub, fontSize: '0.85rem', animation: 'vocaraPulse 1.2s infinite' }}>🎓 {isDE ? 'Feedback wird generiert…' : 'Generating feedback…'}</p></div>}
          <div ref={bottomRef} />
        </div>
        <div style={{ padding: '12px 16px', background: th.bg, borderTop: `1px solid ${th.border}`, display: 'flex', gap: '8px', alignItems: 'flex-end', flexShrink: 0 }}>
          <textarea style={{ flex: 1, padding: '10px 14px', borderRadius: '12px', border: `1px solid ${th.border}`, background: th.card, color: th.text, fontSize: '0.95rem', resize: 'none', minHeight: '44px', maxHeight: '120px', fontFamily: 'inherit', outline: 'none', lineHeight: 1.4 }}
            placeholder={isDE ? `Antworte auf ${targetLang}…` : `Reply in ${targetLang}…`}
            value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} rows={1} />
          <button style={{ background: th.accent, border: 'none', borderRadius: '12px', width: '44px', height: '44px', cursor: (loading || feedback) ? 'not-allowed' : 'pointer', fontSize: '1.1rem', opacity: (loading || feedback) ? 0.5 : 1, flexShrink: 0, color: '#fff' }} onClick={sendMessage} disabled={loading || !!feedback}>➤</button>
        </div>
      </div>
    </div>
  )
}

function SatzTrainingScreen({ lang, theme, onBack, allCards, cardProgress, userName, userToLang = 'en', t: tProp }) {
  const th = THEMES[theme]; const s = makeStyles(th); const t = tProp || T[lang] || T.en
  const LANG_NAMES_FULL = { en: 'English', de: 'German', sw: 'Swahili', th: 'Thai', es: 'Spanish', fr: 'French', ar: 'Arabic', tr: 'Turkish', pt: 'Portuguese' }
  const ttsLangCode = userToLang.toLowerCase()
  const targetLang = LANG_NAMES_FULL[ttsLangCode] || ttsLangCode
  const fromLang = LANG_NAMES_FULL[lang] || lang

  const knownVocab = allCards.filter(c =>
    c.category === 'vocabulary' && !/_r(_\d+)?$/.test(c.id) && (cardProgress[c.id]?.interval || 0) >= 2
  )

  const [exercises, setExercises] = useState([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [userInput, setUserInput] = useState('')
  const [chipBank, setChipBank] = useState([])
  const [chipOrder, setChipOrder] = useState([])
  const [revealed, setRevealed] = useState(false)
  const [selfRating, setSelfRating] = useState(null)
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)
  const [semanticResult, setSemanticResult] = useState(null) // null | 'loading' | {ok, feedback}
  const [difficultyScore, setDifficultyScore] = useState(0) // 0-10

  const ex = exercises[index]

  useEffect(() => { if (knownVocab.length >= 5) generateExercises() }, [])

  const levenshtein = (a, b) => {
    const m = a.length, n = b.length
    const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0))
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1])
    return dp[m][n]
  }

  const generateExercises = async () => {
    setLoading(true); setError(null); setIndex(0); setDone(false)
    setCorrect(0); setRevealed(false); setSelfRating(null); setUserInput(''); setSemanticResult(null)
    const wordList = knownVocab.map(c => c.back).slice(0, 30).join(', ')
    const prompt = `Create 8 varied grammar exercises for a ${targetLang} learner (${fromLang} native speaker).
Use these known words where possible: ${wordList}
Mix all 5 types equally. Return ONLY valid JSON array, no markdown:
[{"type":"gap","question":"She [___] to school every day.","answer":"goes","hint":"3rd person singular present","explanation":"Add -s/-es in 3rd person singular present."},
{"type":"order","question":"Arrange the words:","chips":["goes","she","school","to","every","day"],"answer":"She goes to school every day.","explanation":"English word order: Subject + Verb + Object."},
{"type":"tense","question":"She goes to school. (Past →)","answer":"She went to school.","hint":"irregular verb","explanation":"go → went (irregular)."},
{"type":"conjugation","question":"sein + wir →","answer":"sind","hint":"irregular","explanation":"wir sind (irregular)."},
{"type":"translation","question":"Translate: 'I want to go home.'","answer":"Ich möchte nach Hause gehen.","hint":"use möchten","explanation":"möchten = would like to / want to."}]`
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 2200, messages: [{ role: 'user', content: prompt }] })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      const shuffled = [...parsed].sort(() => Math.random() - 0.5)
      setExercises(shuffled)
      if (shuffled[0]?.type === 'order') initChips(shuffled[0])
    } catch (e) { setError('api') }
    setLoading(false)
  }

  const initChips = (exercise) => {
    const chips = [...(exercise.chips || exercise.answer.split(' '))]
      .sort(() => Math.random() - 0.5)
      .map((w, i) => ({ word: w, id: i }))
    setChipBank(chips); setChipOrder([])
  }

  const needsSemanticEval = (type) => type === 'tense' || type === 'translation'

  const handleCheck = async () => {
    const hasInput = ex.type === 'order' ? chipOrder.length > 0 : userInput.trim()
    if (!hasInput) return
    speak(ex.answer, ttsLangCode)
    setRevealed(true)
    if (needsSemanticEval(ex.type)) {
      setSemanticResult('loading')
      try {
        const evalPrompt = ex.type === 'translation'
          ? `Exercise: "${ex.question}"\nExpected: "${ex.answer}"\nUser wrote: "${userInput.trim()}"\nIs the meaning the same (minor grammar differences OK)? Reply ONLY JSON: {"ok":true/false,"feedback":"1 short ${fromLang} sentence"}`
          : `Exercise: "${ex.question}"\nExpected: "${ex.answer}"\nUser wrote: "${userInput.trim()}"\nIs the tense conversion correct? Reply ONLY JSON: {"ok":true/false,"feedback":"1 short grammar tip in ${fromLang}"}`
        const evalRes = await fetch('/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 100, messages: [{ role: 'user', content: evalPrompt }] })
        })
        const evalData = await evalRes.json()
        const evalText = (evalData.content?.[0]?.text || '').trim()
        setSemanticResult(JSON.parse(evalText.replace(/```json|```/g, '').trim()))
      } catch { setSemanticResult({ ok: false, feedback: '' }) }
    }
  }

  const handleRate = (rating) => {
    setSelfRating(rating)
    if (rating === 'right' || rating === 'easy') { setCorrect(c => c + 1); setDifficultyScore(d => Math.min(10, d + 1)) }
    else setDifficultyScore(d => Math.max(0, d - 1))
  }

  const handleNext = () => {
    const next = index + 1
    if (next >= exercises.length) { setDone(true); return }
    setIndex(next); setUserInput(''); setRevealed(false); setSelfRating(null); setSemanticResult(null)
    const nextEx = exercises[next]
    if (nextEx?.type === 'order') initChips(nextEx)
    else { setChipBank([]); setChipOrder([]) }
  }

  const addChip = (chip) => { if (revealed) return; setChipOrder(o => [...o, chip]); setChipBank(b => b.filter(c => c.id !== chip.id)) }
  const removeChip = (chip) => { if (revealed) return; setChipBank(b => [...b, chip]); setChipOrder(o => o.filter(c => c.id !== chip.id)) }

  const isAnswerCorrect = () => {
    if (ex.type === 'order') return chipOrder.map(c => c.word).join(' ').toLowerCase() === ex.answer.toLowerCase()
    if (needsSemanticEval(ex.type)) return semanticResult && semanticResult !== 'loading' ? semanticResult.ok : null
    const norm = str => str.trim().toLowerCase().replace(/[.,!?]/g, '')
    const u = norm(userInput), a = norm(ex.answer)
    if (ex.type === 'conjugation') return u === a || levenshtein(u, a) <= 1
    return u === a
  }

  const typeLabel = (type) => ({
    gap: lang === 'de' ? '✏️ Lückentext' : '✏️ Fill the gap',
    order: lang === 'de' ? '🔀 Wortstellung' : '🔀 Word order',
    tense: lang === 'de' ? '⏰ Zeitformen' : '⏰ Tense',
    conjugation: lang === 'de' ? '🔤 Konjugation' : '🔤 Conjugation',
    translation: lang === 'de' ? '🌐 Übersetzung' : '🌐 Translation',
  })[type] || type

  if (knownVocab.length < 5) return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>←</button>
      <p style={{ color: th.accent, fontSize: '2rem', marginBottom: '12px' }}>📚</p>
      <p style={{ color: th.text, fontSize: '1rem', marginBottom: '8px', fontWeight: '600' }}>{t.satzNotEnough}</p>
      <p style={{ color: th.sub, fontSize: '0.88rem', marginBottom: '20px', lineHeight: 1.5 }}>{t.satzNotEnoughDesc}</p>
      <button style={s.logoutBtn} onClick={onBack}>{t.back}</button>
    </div></div>
  )

  if (loading) return (
    <div style={s.container} className="vocara-screen">
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: th.accent, fontSize: '1.4rem', marginBottom: '12px' }}>✦</p>
        <p style={{ color: th.sub, fontSize: '0.9rem' }}>{t.generating}</p>
      </div>
    </div>
  )

  if (error) return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>←</button>
      <p style={{ color: th.text, marginBottom: '16px' }}>{t.connectionError}</p>
      <button style={s.button} onClick={generateExercises}>{t.retry}</button>
      <button style={s.logoutBtn} onClick={onBack}>{t.back}</button>
    </div></div>
  )

  if (done) return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <h1 style={s.title}>{t.satzDone}</h1>
      <div style={{ ...s.card, textAlign: 'center', padding: '24px' }}>
        <p style={{ color: th.gold, fontSize: '3rem', fontWeight: 'bold', margin: 0 }}>{correct}/{exercises.length}</p>
        <p style={{ color: th.sub, fontSize: '0.9rem', marginTop: '8px' }}>
          {correct === exercises.length ? '🏆 Perfekt!' : correct >= exercises.length * 0.7 ? '💪 Sehr gut!' : '📚 Weiter üben!'}
        </p>
        {difficultyScore >= 6 && <p style={{ color: th.accent, fontSize: '0.78rem', marginTop: '8px' }}>⬆️ {lang === 'de' ? 'Schwierigkeitsgrad steigt' : 'Difficulty increasing'}</p>}
      </div>
      <button style={s.button} onClick={generateExercises}>{t.newExercises}</button>
      <button style={s.logoutBtn} onClick={onBack}>{t.back}</button>
    </div></div>
  )

  if (!ex) return null
  const correct_bool = revealed && semanticResult !== 'loading' ? isAnswerCorrect() : null

  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <div style={s.cardHeader}>
        <p style={s.greeting}>{index + 1} / {exercises.length}</p>
        <button style={s.stopBtn} onClick={onBack}>✕</button>
      </div>
      <div style={s.progressBar}><div style={{ ...s.progressFill, width: `${(index / exercises.length) * 100}%` }} /></div>

      <p style={{ color: th.sub, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', margin: '14px 0 10px' }}>
        {typeLabel(ex.type)}
        {difficultyScore >= 4 && <span style={{ marginLeft: '6px', color: th.gold }}>{'★'.repeat(Math.min(3, Math.floor(difficultyScore / 3)))}</span>}
      </p>

      {/* QUESTION CARD */}
      <div style={{ ...s.bigCard, minHeight: '80px', marginBottom: '14px' }}>
        <p style={{ ...s.cardFront, marginBottom: ex.hint ? '6px' : 0 }}>{ex.question}</p>
        {ex.hint && <p style={{ color: th.sub, fontSize: '0.72rem', fontStyle: 'italic', margin: 0 }}>💡 {ex.hint}</p>}
      </div>

      {/* INPUT AREA — gap / tense / conjugation / translation */}
      {(ex.type === 'gap' || ex.type === 'tense' || ex.type === 'conjugation' || ex.type === 'translation') && (
        <div style={{ marginBottom: '14px' }}>
          <input
            value={userInput}
            onChange={e => !revealed && setUserInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !revealed && userInput.trim()) handleCheck() }}
            placeholder={ex.type === 'translation' ? (lang === 'de' ? 'Übersetzung eingeben…' : 'Enter translation…') : t.yourAnswer}
            disabled={revealed}
            style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: `1px solid ${revealed ? (correct_bool === null ? th.border : correct_bool ? '#4CAF50' : '#f44336') : th.border}`, background: th.card, color: th.text, fontSize: '1rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            autoFocus
          />
        </div>
      )}

      {/* CHIP AREA — order type */}
      {ex.type === 'order' && (
        <>
          <div style={{ ...s.bigCard, minHeight: '60px', flexWrap: 'wrap', gap: '8px', padding: '12px', justifyContent: 'flex-start', alignItems: 'flex-start', marginBottom: '8px' }}>
            {chipOrder.length === 0
              ? <p style={{ color: th.sub, fontSize: '0.85rem', margin: 'auto' }}>{t.tapWords}</p>
              : chipOrder.map(chip => (
                <button key={chip.id} onClick={() => removeChip(chip)}
                  style={{ background: th.accent + '33', color: th.text, border: `1px solid ${th.accent}`, borderRadius: '8px', padding: '6px 12px', fontSize: '0.95rem', cursor: revealed ? 'default' : 'pointer' }}>
                  {chip.word}
                </button>
              ))
            }
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '14px' }}>
            {chipBank.map(chip => (
              <button key={chip.id} onClick={() => addChip(chip)}
                style={{ background: th.card, color: th.text, border: `1px solid ${th.border}`, borderRadius: '8px', padding: '6px 12px', fontSize: '0.95rem', cursor: revealed ? 'default' : 'pointer' }}>
                {chip.word}
              </button>
            ))}
          </div>
        </>
      )}

      {/* SEMANTIC EVAL LOADING */}
      {revealed && semanticResult === 'loading' && (
        <p style={{ color: th.sub, fontSize: '0.78rem', textAlign: 'center', marginBottom: '10px' }}>✦ {lang === 'de' ? 'KI bewertet…' : 'AI evaluating…'}</p>
      )}

      {/* REVEAL RESULT */}
      {revealed && semanticResult !== 'loading' && (
        <div style={{ marginBottom: '14px', animation: 'vocaraFadeIn 0.3s ease both' }}>
          <p style={{ color: correct_bool ? '#4CAF50' : '#f44336', fontWeight: 'bold', fontSize: '1rem', marginBottom: '8px' }}>
            {correct_bool ? `✓ ${ex.answer}` : `✗ ${lang === 'de' ? 'Lösung' : 'Answer'}: ${ex.answer}`}
          </p>
          {semanticResult?.feedback && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${th.border}`, borderRadius: '10px', padding: '8px 12px', marginBottom: '6px' }}>
              <p style={{ color: correct_bool ? '#81c784' : '#FFB74D', fontSize: '0.78rem', margin: 0, lineHeight: 1.5 }}>💬 {semanticResult.feedback}</p>
            </div>
          )}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${th.border}`, borderRadius: '10px', padding: '10px 14px' }}>
            <p style={{ color: th.sub, fontSize: '0.78rem', margin: 0, lineHeight: 1.6 }}>📖 {ex.explanation}</p>
          </div>
        </div>
      )}

      {/* CHECK BUTTON */}
      {!revealed && (
        <button
          style={{ ...s.button, opacity: (ex.type === 'order' ? chipOrder.length > 0 : userInput.trim().length > 0) ? 1 : 0.4 }}
          onClick={handleCheck}
          disabled={ex.type === 'order' ? chipOrder.length === 0 : !userInput.trim()}
        >
          {t.checkBtn}
        </button>
      )}

      {/* SELF RATING AFTER REVEAL */}
      {revealed && semanticResult !== 'loading' && !selfRating && (
        <div style={{ ...s.answerRow, marginTop: '8px' }}>
          <button style={s.wrongBtn} onClick={() => handleRate('wrong')}>{t.wrong}</button>
          <button style={s.fastBtn} onClick={() => handleRate('fast')}>{t.fast}</button>
          <button style={s.rightBtn} onClick={() => handleRate('right')}>{t.correct}</button>
          <button style={s.easyBtn} onClick={() => handleRate('easy')}>{t.easy}</button>
        </div>
      )}

      {/* NEXT BUTTON after rating */}
      {revealed && semanticResult !== 'loading' && selfRating && (
        <button style={s.button} onClick={handleNext}>
          {index + 1 < exercises.length ? t.nextBtn : t.finishBtn}
        </button>
      )}
    </div></div>
  )
}

function PlacementTest({ lang, theme, user, onBack, onSaveCefr }) {
  const th = THEMES[theme]; const s = makeStyles(th); const t = T[lang]
  const [questions, setQuestions] = useState(null)
  const [seenIds, setSeenIds] = useState(new Set())
  const [testCount, setTestCount] = useState(1)
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [wrongStreak, setWrongStreak] = useState(0)
  const [scores, setScores] = useState({})
  const [stopped, setStopped] = useState(false)
  const answerChoicesRef = useRef([]) // track which option-index user picks for pattern detection
  const [patternWarning, setPatternWarning] = useState(null)

  useEffect(() => {
    const init = async () => {
      let seen = new Set(); let count = 0
      if (user) {
        try {
          const snap = await getDoc(doc(db, 'users', user.uid, 'testHistory', 'placement'))
          if (snap.exists()) {
            seen = new Set(snap.data()?.seenIds || [])
            count = snap.data()?.testCount || 0
          }
        } catch {}
      }
      setSeenIds(seen); setTestCount(count + 1)
      const base = lang === 'de' ? PLACEMENT_EN : PLACEMENT_DE
      const sh = arr => [...arr].sort(() => Math.random() - 0.5)
      const byLevel = {}
      for (const q of base) { if (!byLevel[q.level]) byLevel[q.level] = []; byLevel[q.level].push(q) }
      const picked = []
      for (const lvl of CEFR_LEVELS) {
        const pool = byLevel[lvl] || []
        const unseen = pool.filter(q => !seen.has(q.id))
        picked.push(...sh(unseen.length >= 5 ? unseen : pool).slice(0, 10))
      }
      const shuffled = picked.map(q => {
        const opts = q.options.map((opt, i) => ({ opt, isCorrect: i === q.correct }))
        const shOpts = sh(opts)
        return { ...q, options: shOpts.map(x => x.opt), correct: shOpts.findIndex(x => x.isCorrect) }
      })
      setQuestions(shuffled)
    }
    init()
  }, []) // eslint-disable-line

  const q = questions?.[index]
  const calcLevel = (sc) => {
    for (let i = CEFR_LEVELS.length - 1; i >= 0; i--) {
      const lvl = CEFR_LEVELS[i]; const data = sc[lvl]
      if (data && data.correct / data.total >= 0.6) return lvl
    }
    return 'A1'
  }

  const checkAnswerPattern = (choices) => {
    if (choices.length < 5) return
    const last5 = choices.slice(-5)
    const allSame = last5.every(c => c === last5[0])
    if (allSame) {
      const optLetter = String.fromCharCode(65 + last5[0])
      setPatternWarning(lang === 'de'
        ? `Tipp: Du wählst oft Option ${optLetter} — überprüfe dein Wissen sorgfältig!`
        : `Hint: You often pick option ${optLetter} — review carefully!`)
      setTimeout(() => setPatternWarning(null), 4000)
    }
  }

  const handleSelect = (optIdx) => {
    if (revealed || !q || !questions) return
    const newChoices = [...answerChoicesRef.current, optIdx]
    answerChoicesRef.current = newChoices
    checkAnswerPattern(newChoices)
    setSelected(optIdx); setRevealed(true)
    const isCorrect = optIdx === q.correct
    const lvl = q.level; const prev = scores[lvl] || { correct: 0, total: 0 }
    const newScores = { ...scores, [lvl]: { correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 } }
    setScores(newScores)
    const newStreak = isCorrect ? 0 : wrongStreak + 1
    if (newStreak >= 3) setStopped(true)
    setTimeout(() => {
      if (newStreak >= 3 || index + 1 >= questions.length) {
        try {
          const level = calcLevel(newScores)
          if (user) {
            const base = lang === 'de' ? PLACEMENT_EN : PLACEMENT_DE
            const shownIds = questions.slice(0, index + 1).map(q => q.id)
            const allSeen = [...seenIds, ...shownIds]
            const finalSeen = allSeen.length > base.length * 0.75 ? [] : [...new Set(allSeen)]
            setDoc(doc(db, 'users', user.uid, 'testHistory', 'placement'), { seenIds: finalSeen, lastTest: todayStr(), testCount }, { merge: true }).catch(() => {})
          }
          try { onSaveCefr(level) } catch(e) { console.warn('[Vocara] onSaveCefr error:', e) }
          window.location.reload()
        } catch(completionErr) { console.error('[Vocara] test completion crashed:', completionErr); window.location.reload() }
      } else { setWrongStreak(newStreak); setIndex(i => i + 1); setSelected(null); setRevealed(false) }
    }, 1200)
  }

  if (!questions) return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <p style={{ color: th.sub, textAlign: 'center', padding: '40px', fontSize: '1.1rem', animation: 'vocaraPulse 1.2s infinite' }}>…</p>
    </div></div>
  )
  const pct = (index / questions.length) * 100
  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <div style={s.cardHeader}>
        <div>
          <p style={s.greeting}>{t.testQuestion} {index + 1} {t.testOf} {questions.length}</p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: CEFR_COLORS[q.level], fontSize: '0.75rem', fontWeight: 'bold' }}>{q.level}</span>
            <span style={{ color: th.sub, fontSize: '0.65rem', opacity: 0.7 }}>Test #{testCount}</span>
          </div>
        </div>
        <button style={s.stopBtn} onClick={onBack}>{t.stop}</button>
      </div>
      {patternWarning && (
        <div style={{ background: 'rgba(255,165,0,0.12)', border: '1px solid rgba(255,165,0,0.35)', borderRadius: '10px', padding: '8px 12px', marginBottom: '8px', animation: 'vocaraFadeIn 0.3s ease both' }}>
          <p style={{ color: '#FFA500', fontSize: '0.75rem', margin: 0 }}>💡 {patternWarning}</p>
        </div>
      )}
      <div style={s.progressBar}><div style={{ ...s.progressFill, width: `${pct}%`, background: CEFR_COLORS[q.level] }} /></div>
      <div style={{ ...s.bigCard, marginTop: '12px', minHeight: '100px' }}>
        <p style={{ ...s.cardFront, marginBottom: 0 }}>{q.question}</p>
      </div>
      {q.options.map((opt, i) => (
        <button key={i} style={s.optionBtn(selected === i, i === q.correct, revealed)} onClick={() => handleSelect(i)}>
          {String.fromCharCode(65 + i)}. {opt ?? '—'}
        </button>
      ))}
      {stopped && <p style={{ color: th.sub, fontSize: '0.78rem', textAlign: 'center', marginTop: '8px' }}>{t.testStop3}</p>}
    </div></div>
  )
}

function WelcomeScreen({ user, theme, onContinue }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const firstName = user?.displayName?.split(' ')[0] || user?.displayName || ''
  return (
    <div style={s.container} className="vocara-screen">
      <div style={{ textAlign: 'center', padding: '32px 24px', maxWidth: '380px', width: '100%' }}>
        <h1 style={s.logoTitle}>Katara</h1>
        <div style={{ ...s.card, marginBottom: '24px', padding: '28px 20px' }}>
          <p style={{ color: th.text, fontSize: '1.2rem', fontWeight: '700', marginBottom: '12px' }}>
            Willkommen{firstName ? `, ${firstName}` : ''}!
          </p>
          <p style={{ color: th.sub, fontSize: '0.95rem', lineHeight: '1.5', margin: 0 }}>
            Erstelle deine erste Kategorie und beginne zu lernen.
          </p>
        </div>
        <button style={s.button} onClick={onContinue}>
          Erste Kategorie erstellen →
        </button>
      </div>
    </div>
  )
}

function LoginScreen({ theme }) {
  const [error, setError] = useState(null)
  const th = THEMES[theme]; const s = makeStyles(th)
  const handleLogin = async () => {
    setError(null)
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    try { await signInWithPopup(auth, provider) }
    catch (err) { setError(err.message) }
  }
  return (
    <div style={s.container} className="vocara-screen">
      <div style={{ textAlign: 'center', padding: '24px', maxWidth: '380px', width: '100%' }}>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: '42px', fontWeight: '700', color: '#FFD700', margin: '0 0 8px', letterSpacing: '3px', lineHeight: 1 }}>Vocara</p>
        <p style={s.slogan}>Die Stimme ist die Brücke.<br /><span style={{ fontSize: '0.85rem' }}>The voice is the bridge.</span></p>
        <button style={s.button} onClick={handleLogin}>Mit Google anmelden / Sign in with Google</button>
        {error && <p style={s.error}>{error}</p>}
      </div>
    </div>
  )
}

function LangSetupScreen({ user, lang, theme, onDone }) {
  const th = THEMES[theme]; const s = makeStyles(th); const t = T[lang]
  const [selected, setSelected] = useState([])
  const toggle = (code) => {
    if (selected.includes(code)) setSelected(selected.filter(c => c !== code))
    else if (selected.length < 3) setSelected([...selected, code])
  }
  const handleDone = async () => {
    if (selected.length === 0) return
    await updateDoc(doc(db, 'users', user.uid), { languages: selected }); onDone(selected)
  }
  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <p style={{ fontFamily: 'Georgia, serif', fontSize: '42px', fontWeight: '700', color: '#FFD700', margin: '0 0 8px', letterSpacing: '3px', lineHeight: 1, textAlign: 'center' }}>Vocara</p>
      <p style={{ color: th.text, fontWeight: 'bold', marginBottom: '4px' }}>{t.langSetupTitle}</p>
      <p style={{ color: th.sub, fontSize: '0.85rem', marginBottom: '16px' }}>{t.langSetupSub}</p>
      <div style={s.card}>
        {AVAILABLE_LANGS.map(l => (
          <button key={l.code} style={s.langSelectBtn(selected.includes(l.code))} onClick={() => toggle(l.code)}>
            <span>{l.flag} {l.label}</span>
            {selected.includes(l.code) && <span style={{ color: th.accent }}>✓ #{selected.indexOf(l.code) + 1}</span>}
          </button>
        ))}
      </div>
      <button style={{ ...s.button, opacity: selected.length === 0 ? 0.5 : 1 }} onClick={handleDone} disabled={selected.length === 0}>{t.langSetupDone} →</button>
    </div></div>
  )
}

function PartnerScreen({ user, myData, lang, theme, onBack, onPartnerUpdate }) {
  const th = THEMES[theme]; const s = makeStyles(th); const t = T[lang]
  const [codeInput, setCodeInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState('')
  const [pendingData, setPendingData] = useState(null)
  const inviteLink = `${window.location.origin}?invite=${user.uid}`
  const myInviteCode = user.uid.slice(0, 8).toUpperCase()
  const hasPartner = !!myData?.partnerUID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const inviteUID = params.get('invite')
    if (inviteUID && inviteUID !== user.uid && !hasPartner) {
      getDoc(doc(db, 'users', inviteUID)).then(snap => { if (snap.exists()) setPendingData({ uid: inviteUID, ...snap.data() }) }).catch(e => console.warn('[Vocara] invite read skipped (users/' + inviteUID + '):', e?.code))
    }
  }, [])
  const copyLink = () => { navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  const connectByCode = async () => {
    const code = codeInput.trim().toUpperCase()
    if (code.length < 6) return; setStatus('Suche...')
    try {
      const snap = await getDoc(doc(db, 'inviteCodes', code))
      if (!snap.exists()) { setStatus('Code nicht gefunden.'); return }
      await acceptConnection(snap.data().uid)
    } catch { setStatus('Fehler.') }
  }
  const acceptConnection = async (partnerUID) => {
    try {
      const partnerSnap = await getDoc(doc(db, 'users', partnerUID)).catch(() => null)
      const partnerName = partnerSnap?.exists() ? partnerSnap.data().name : 'Partner'
      const isNewPartner = myData?.partnerUID && myData.partnerUID !== partnerUID
      const connectedAt = Date.now()
      // Reset comparison stats on new partner; keep ALL personal data
      const resetFields = isNewPartner
        ? { weeklyMinutesComparison: null, streakComparison: null, partnerConnectedAt: connectedAt }
        : { partnerConnectedAt: connectedAt }
      await updateDoc(doc(db, 'users', user.uid), { partnerUID, partnerName, ...resetFields })
      if (isNewPartner) {
        setDoc(doc(db, 'users', user.uid, 'partnerStats'), { connectedAt, comparisonWeeklyMinutes: 0 }, { merge: true }).catch(() => {})
      }
      try {
        await updateDoc(doc(db, 'users', partnerUID), { partnerUID: user.uid, partnerName: user.displayName, partnerConnectedAt: connectedAt })
      } catch (e) { console.warn('[Vocara] partner link write skipped (users/' + partnerUID + '):', e?.code || e?.message) }
      onPartnerUpdate(partnerUID); setPendingData(null); window.history.replaceState({}, '', window.location.pathname)
    } catch (e) { setStatus('Verbindung fehlgeschlagen / Connection failed.') }
  }
  const disconnect = async () => {
    if (!window.confirm('Partner wirklich trennen?')) return
    const partnerUID = myData.partnerUID
    await updateDoc(doc(db, 'users', user.uid), { partnerUID: null, partnerName: null })
    if (partnerUID) { try { await updateDoc(doc(db, 'users', partnerUID), { partnerUID: null, partnerName: null }) } catch {} }
    onPartnerUpdate(null)
  }
  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>← {t.back}</button>
      <h2 style={{ color: th.gold, fontSize: '1.3rem', marginBottom: '20px' }}>{t.partnerTitle}</h2>
      {pendingData && (
        <div style={s.infoBox}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>{pendingData.name} möchte sich verbinden</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ ...s.rightBtn, flex: 1, padding: '10px' }} onClick={() => acceptConnection(pendingData.uid)}>{t.partnerAccept}</button>
            <button style={{ ...s.wrongBtn, flex: 1, padding: '10px' }} onClick={() => { setPendingData(null); window.history.replaceState({}, '', window.location.pathname) }}>{t.partnerDecline}</button>
          </div>
        </div>
      )}
      {hasPartner ? (
        <div style={s.card}>
          <p style={s.cardLabel}>{t.partnerConnected}</p>
          <p style={{ color: th.text, margin: '0 0 12px 0', fontWeight: 'bold' }}>{myData.partnerName || 'Partner'}</p>
          <button style={{ ...s.logoutBtn, color: '#f44336', borderColor: '#f44336' }} onClick={disconnect}>{t.partnerDisconnect}</button>
          {/* Mehrere Partner — Premium/Pro */}
          <div style={{ marginTop: '12px', padding: '10px 12px', background: `${th.gold}08`, border: `1px solid ${th.gold}22`, borderRadius: '10px' }}>
            <p style={{ color: th.sub, fontSize: '0.78rem', margin: '0 0 6px' }}>{lang === 'de' ? '👥 Mehrere Partner:' : '👥 Multiple partners:'}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.45 }}>
                <span style={{ color: th.sub, fontSize: '0.75rem' }}>＋ {lang === 'de' ? 'Weiteren verbinden' : 'Connect another'}</span>
                <span style={{ background: `${th.gold}18`, color: th.gold, border: `1px solid ${th.gold}44`, borderRadius: '8px', padding: '1px 7px', fontSize: '0.65rem', fontWeight: '700' }}>Premium</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.3 }}>
                <span style={{ color: th.sub, fontSize: '0.75rem' }}>＋＋ {lang === 'de' ? 'Bis zu 5 Partner' : 'Up to 5 partners'}</span>
                <span style={{ background: 'rgba(200,200,255,0.1)', color: '#aaa', border: '1px solid rgba(200,200,255,0.2)', borderRadius: '8px', padding: '1px 7px', fontSize: '0.65rem', fontWeight: '700' }}>Pro</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div style={s.card}>
            <p style={s.cardLabel}>{t.partnerInvite}</p>
            <p style={{ color: th.sub, fontSize: '0.75rem', wordBreak: 'break-all', marginBottom: '8px' }}>{inviteLink}</p>
            <button style={s.button} onClick={copyLink}>{copied ? t.partnerCopied : t.partnerCopy}</button>
            <p style={{ color: th.sub, fontSize: '0.8rem', marginTop: '8px' }}>Dein Code: <strong style={{ color: th.gold }}>{myInviteCode}</strong></p>
          </div>
          <div style={s.card}>
            <p style={s.cardLabel}>{t.partnerCode}</p>
            <input style={s.input} placeholder="Code..." value={codeInput} onChange={e => setCodeInput(e.target.value.toUpperCase())} maxLength={8} />
            <button style={s.button} onClick={connectByCode}>{t.partnerConnect}</button>
            {status && <p style={{ color: th.accent, fontSize: '0.85rem', margin: '4px 0 0 0' }}>{status}</p>}
          </div>
        </>
      )}
    </div></div>
  )
}

// ── SPRACHRHYTHMUS-TRAINING (#31) ──────────────────────────────
function RhythmusScreen({ lang, theme, onBack, allCards, cardProgress, userToLang = 'en', t: tProp }) {
  const th = THEMES[theme]; const s = makeStyles(th); const t = tProp || T[lang] || T.en
  const [sentence, setSentence] = useState(null)
  const [micState, setMicState] = useState('idle') // idle | listening | done
  const [transcript, setTranscript] = useState('')
  const [score, setScore] = useState(null) // { correct, total }
  const [loading, setLoading] = useState(true)

  // Pick a mastered sentence card
  useEffect(() => {
    const sentenceCards = (allCards || []).filter(c => {
      const cat = c.category || 'vocabulary'
      const interval = cardProgress[c.id]?.interval || 0
      return (cat === 'sentence' || cat === 'home') && interval >= 3 && c.front && c.back
    })
    if (sentenceCards.length === 0) {
      setSentence(null); setLoading(false); return
    }
    const dayIdx = Math.floor(Date.now() / 86400000)
    setSentence(sentenceCards[dayIdx % sentenceCards.length])
    setLoading(false)
  }, [])

  const startMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setMicState('unsupported'); return }
    const rec = new SR()
    const { langCode: toLang } = getToLangText(sentence, userToLang) || { langCode: userToLang }
    rec.lang = SPEECH_LANGS[toLang] || 'en-GB'
    rec.interimResults = false; rec.maxAlternatives = 1
    setMicState('listening'); setTranscript(''); setScore(null)
    rec.onresult = (e) => {
      const heard = e.results[0][0].transcript.trim()
      setTranscript(heard)
      const { text: toLangText } = getToLangText(sentence, userToLang) || { text: sentence.back }
      const tWords = (toLangText || '').split(/\s+/)
      const hWords = heard.toLowerCase().split(/\s+/)
      const correct = tWords.filter(w => hWords.some(h => fuzzyWordMatch(w, h))).length
      const pct = Math.round((correct / Math.max(tWords.length, 1)) * 100)
      setScore({ correct, total: tWords.length, pct })
      setMicState('done')
    }
    rec.onerror = () => setMicState('idle')
    rec.start()
  }

  if (loading) return <div style={s.container}><div style={s.homeBox}><p style={{ color: th.sub, textAlign: 'center', marginTop: '40px' }}>…</p></div></div>

  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>← {t.back}</button>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <p style={{ color: th.gold, fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 6px' }}>🎵 {t.rhythmusTitle}</p>
        <p style={{ color: th.sub, fontSize: '0.82rem', margin: 0 }}>{t.rhythmusSub}</p>
      </div>
      {!sentence ? (
        <div style={s.card}>
          <p style={{ color: th.sub, textAlign: 'center', fontSize: '0.88rem' }}>{t.rhythmusNoCards}</p>
        </div>
      ) : (
        <>
          {(() => {
            const { text: toText, langCode: toLCode } = getToLangText(sentence, userToLang) || { text: sentence.back, langCode: userToLang }
            const nativeText = sentence.langA?.toLowerCase() === toLCode ? sentence.back : sentence.front
            return (
              <div style={{ ...s.card, textAlign: 'center', position: 'relative' }}>
                <p style={{ color: th.sub, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px' }}>{t.repeatAfter}</p>
                <p style={{ color: th.text, fontSize: '1.15rem', fontWeight: '600', margin: '0 0 14px', lineHeight: 1.4 }}>{toText}</p>
                <p style={{ color: th.sub, fontSize: '0.82rem', fontStyle: 'italic', margin: '0 0 16px' }}>{nativeText}</p>
                <button onClick={() => speak(toText, toLCode)} style={{ background: 'transparent', border: `1px solid ${th.border}`, borderRadius: '12px', padding: '8px 18px', color: th.sub, fontSize: '0.82rem', cursor: 'pointer' }}>
                  🔊 {t.listen}
                </button>
              </div>
            )
          })()}

          <div style={{ ...s.card, textAlign: 'center' }}>
            {micState === 'idle' && (
              <button onClick={startMic} style={{ ...s.button, background: `linear-gradient(135deg, ${th.accent}40, ${th.accent}20)`, border: `1px solid ${th.accent}66`, color: th.text, width: '100%' }}>
                🎤 {t.speakNow}
              </button>
            )}
            {micState === 'listening' && (
              <p style={{ color: th.gold, fontSize: '0.9rem', animation: 'vocaraPulse 0.8s infinite' }}>🎤 {t.listening}</p>
            )}
            {micState === 'unsupported' && (
              <p style={{ color: '#ff9800', fontSize: '0.82rem' }}>{t.useChrome}</p>
            )}
            {micState === 'done' && score && (
              <div style={{ animation: 'vocaraFadeIn 0.3s ease both' }}>
                <p style={{ color: th.sub, fontSize: '0.78rem', marginBottom: '8px' }}>{t.youSaid} <em style={{ color: th.text }}>{transcript}</em></p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '12px' }}>
                  {(sentence.back || '').split(/\s+/).map((w, i) => {
                    const heard = transcript.split(/\s+/)
                    const hit = heard.some(h => h.includes(w.toLowerCase()) || w.toLowerCase().includes(h))
                    return <span key={i} style={{ color: hit ? '#4CAF50' : '#e53935', fontSize: '1rem', fontWeight: '600' }}>{w}</span>
                  })}
                </div>
                <p style={{ color: (score.pct || 0) >= 80 ? '#4CAF50' : (score.pct || 0) >= 50 ? '#FFA500' : th.gold, fontSize: '1rem', fontWeight: '700', margin: '0 0 12px' }}>
                  {t.pronouncePct}{score.pct ?? Math.round(score.correct/Math.max(score.total,1)*100)}%
                </p>
                <button onClick={() => { setMicState('idle'); setTranscript(''); setScore(null) }} style={{ background: 'transparent', border: `1px solid ${th.border}`, borderRadius: '10px', padding: '7px 16px', color: th.sub, fontSize: '0.82rem', cursor: 'pointer' }}>
                  🔄 {t.tryAgain}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div></div>
  )
}

// ── KONTEXTWECHSEL SCREEN ──────────────────────────────────────
function KontextwechselScreen({ card, lang, theme, userToLang = 'en', user, onBack, onSaveCard, t: tProp }) {
  const th = THEMES[theme]; const s = makeStyles(th); const t = tProp || T[lang] || T.en
  const [variants, setVariants] = useState(null) // [{type, prompt, answer}]
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(new Set()) // set of saved variant types

  const VARIANT_DEFS = [
    { type: 'formal',   icon: '👔', labelDe: 'Formell',   labelEn: 'Formal',   promptDe: `Wie sagst du "${card?.front}" in einer formellen E-Mail oder einem Meeting?`, promptEn: `How would you use "${card?.front}" in a formal email or meeting?` },
    { type: 'informal', icon: '😄', labelDe: 'Informell',  labelEn: 'Informal', promptDe: `Wie sagst du "${card?.front}" zu einem guten Freund?`, promptEn: `How would you say "${card?.front}" to a close friend?` },
    { type: 'romantic', icon: '💑', labelDe: 'Romantisch', labelEn: 'Romantic', promptDe: `Wie verwendest du "${card?.front}" mit deinem Partner?`, promptEn: `How would you use "${card?.front}" with your partner?` },
  ]

  useEffect(() => {
    if (!card) { setLoading(false); return }
    const toLangName = { en: 'English', de: 'German', sw: 'Swahili', fr: 'French', es: 'Spanish', th: 'Thai' }[userToLang] || userToLang
    fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 300,
        system: 'You are a language teacher. Generate context variants for vocabulary. Return ONLY valid JSON. Never add markdown or explanation.',
        messages: [{
          role: 'user',
          content: `For "${card.front}" (translation: "${card.back}"), give 3 context variants in ${toLangName}. MAX 1 SHORT SENTENCE each. Include the translation in brackets.
Return ONLY JSON array:
[
  {"type":"formal","sentence":"ONE short formal sentence [translation]"},
  {"type":"informal","sentence":"ONE short casual sentence [translation]"},
  {"type":"romantic","sentence":"ONE short romantic sentence [translation]"}
]`
        }]
      })
    }).then(r => r.json()).then(data => {
      const raw = (data.content?.[0]?.text || '').trim()
      const match = raw.match(/\[[\s\S]*\]/)
      if (match) {
        try {
          const parsed = JSON.parse(match[0])
          setVariants(parsed)
        } catch(e) { setVariants(null) }
      }
      setLoading(false)
    }).catch(() => { setVariants(null); setLoading(false) })
  }, []) // eslint-disable-line

  const handleSave = async (variant) => {
    if (!user || !card || saved.has(variant.type)) return
    const newCard = {
      id: `kontext_${card.id}_${variant.type}_${Date.now()}`,
      front: card.front,
      back: variant.sentence,
      category: card.category || 'vocabulary',
      langA: card.langA, langB: card.langB || userToLang,
      source: 'kontext', createdAt: Date.now(),
      kontextType: variant.type,
    }
    await onSaveCard(newCard)
    setSaved(prev => new Set([...prev, variant.type]))
  }

  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>← {t.back}</button>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <p style={{ color: '#00BFA5', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 6px' }}>🔄 {t.kontextTitle}</p>
        <p style={{ color: th.text, fontSize: '1.1rem', fontWeight: '700', margin: '0 0 4px' }}>{card?.front}</p>
        <p style={{ color: th.sub, fontSize: '0.85rem', margin: 0, fontStyle: 'italic' }}>{card?.back}</p>
      </div>
      {loading ? (
        <div style={{ ...s.card, textAlign: 'center', padding: '32px' }}>
          <p style={{ color: th.sub, fontSize: '0.88rem', animation: 'vocaraPulse 1.2s infinite' }}>🔄 {t.kontextGenerating}</p>
        </div>
      ) : !variants ? (
        <div style={{ ...s.card, textAlign: 'center' }}>
          <p style={{ color: th.sub, fontSize: '0.88rem' }}>{t.kontextUnavail}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ color: th.sub, fontSize: '0.78rem', textAlign: 'center', margin: '0 0 4px' }}>{t.kontextChoose}</p>
          {VARIANT_DEFS.map(def => {
            const v = variants.find(x => x.type === def.type)
            if (!v) return null
            const isSaved = saved.has(def.type)
            return (
              <div key={def.type} style={{ ...s.card, border: isSaved ? '1px solid #00BFA5' : `1px solid ${th.border}`, background: isSaved ? 'rgba(0,191,165,0.1)' : th.card, position: 'relative', paddingTop: '28px' }}>
                {/* Variant type badge top-left */}
                <div style={{ position: 'absolute', top: '8px', left: '10px', background: def.type === 'formal' ? 'rgba(60,140,200,0.16)' : def.type === 'romantic' ? 'rgba(220,80,180,0.16)' : 'rgba(180,120,30,0.16)', color: def.type === 'formal' ? '#70b0d8' : def.type === 'romantic' ? '#e080c0' : '#C8922A', border: `1px solid ${def.type === 'formal' ? 'rgba(60,140,200,0.30)' : def.type === 'romantic' ? 'rgba(220,80,180,0.30)' : 'rgba(180,120,30,0.30)'}`, borderRadius: '6px', padding: '2px 7px', fontSize: '9px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  {def.icon} {lang === 'de' ? def.labelDe : def.labelEn}
                </div>
                {/* Hochsprache/Slang register badge top-right */}
                <div style={{ position: 'absolute', top: '8px', right: '10px', background: def.type === 'informal' || def.type === 'romantic' ? 'rgba(180,120,30,0.14)' : 'rgba(140,140,155,0.14)', color: def.type === 'informal' || def.type === 'romantic' ? '#C8922A' : '#8A8A9A', border: `1px solid ${def.type === 'informal' || def.type === 'romantic' ? 'rgba(180,120,30,0.28)' : 'rgba(140,140,155,0.22)'}`, borderRadius: '6px', padding: '2px 7px', fontSize: '9px', fontWeight: '600', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                  {def.type === 'informal' || def.type === 'romantic' ? 'Slang' : 'Hochsprache'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: th.text, fontSize: '0.9rem', fontWeight: '500', margin: '0 0 4px', lineHeight: 1.4 }}>{v.sentence}</p>
                    {v.note && <p style={{ color: th.sub, fontSize: '0.75rem', margin: 0, fontStyle: 'italic' }}>{v.note}</p>}
                  </div>
                  <button onClick={() => handleSave(v)} disabled={isSaved}
                    style={{ background: isSaved ? 'rgba(0,191,165,0.2)' : `${th.accent}22`, border: `1px solid ${isSaved ? '#00BFA5' : th.accent}55`, color: isSaved ? '#00BFA5' : th.accent, borderRadius: '10px', padding: '6px 12px', fontSize: '0.75rem', fontWeight: '700', cursor: isSaved ? 'default' : 'pointer', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }}>
                    {isSaved ? '✓' : t.learn}
                  </button>
                </div>
              </div>
            )
          })}
          {saved.size > 0 && (
            <div style={{ textAlign: 'center', animation: 'vocaraFadeIn 0.3s ease both', marginTop: '8px' }}>
              <p style={{ color: '#00BFA5', fontSize: '0.85rem', fontWeight: '600', margin: '0 0 12px' }}>✓ {t.variantSaved}</p>
              <button style={{ ...s.button }} onClick={onBack}>{t.finishDone}</button>
            </div>
          )}
        </div>
      )}
    </div></div>
  )
}

function CardScreen({ user, session, onBack, onFinish, lang, cardProgress, s, onSaveState, onSaveSessionProgress, onStop, onSaveExample, mode = 'all', startIndex = 0, startProgress = null, userToLang = 'en', socialRegister = 'friends', onNeverLearn, onKontext }) {
  const [index, setIndex] = useState(startIndex)
  const [queue, setQueue] = useState(session)
  const [revealed, setRevealed] = useState(false)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [newProgress, setNewProgress] = useState(startProgress || { ...cardProgress })
  const [cardTilt, setCardTilt] = useState({ x: 0, y: 0 })
  const [ttsMode, setTtsMode] = useState(0)
  const [micState, setMicState] = useState('idle') // 'idle' | 'listening' | 'done' | 'unsupported'
  const [micResult, setMicResult] = useState(null) // { score, total, words: [{word, correct}] }
  const [phoneticCache, setPhoneticCache] = useState({})
  const [cardAnim, setCardAnim] = useState(null) // null | 'flyRight' | 'flyUp' | 'shake'
  const [cardSlideIn, setCardSlideIn] = useState(false) // slide-in for next card
  const [burstParticles, setBurstParticles] = useState([]) // [{id,x,y,color,dx,dy}]
  const [flipPhase, setFlipPhase] = useState(false) // true = mid-flip (card turned sideways)
  const [patternTip, setPatternTip] = useState(null) // null | 'loading' | string
  const wrongCardsRef = useRef([]) // accumulates wrong cards for pattern analysis
  const reactionTimesRef = useRef({}) // cardId → ms
  const [kiExplanation, setKiExplanation] = useState(null) // null | 'loading' | string
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [reportedCards, setReportedCards] = useState(new Set()) // set of reported card ids
  const [kontextVariation, setKontextVariation] = useState(null) // null | 'loading' | {formal,informal,romantic}
  const [kontextOpen, setKontextOpen] = useState(false)
  const animLock = useRef(false)
  const startTime = useRef(Date.now())
  const answeredIds = useRef(new Set())
  const easyCountRef = useRef(0)
  const fastCountRef = useRef(0)
  const cardStatsRef = useRef({})
  const longPressTimer = useRef(null)
  const handleCardPressStart = () => {
    if (!onNeverLearn) return
    longPressTimer.current = setTimeout(() => { if (onNeverLearn) onNeverLearn(item) }, 700)
  }
  const handleCardPressEnd = () => { clearTimeout(longPressTimer.current) }

  useEffect(() => {
    if (!window.DeviceOrientationEvent) return
    const handle = (e) => {
      const gamma = Math.max(-12, Math.min(12, e.gamma || 0))
      const beta = Math.max(-12, Math.min(12, (e.beta || 0) - 45))
      setCardTilt({ x: beta, y: gamma })
    }
    window.addEventListener('deviceorientation', handle)
    return () => window.removeEventListener('deviceorientation', handle)
  }, [])
  const t = T[lang]
  const item = queue[index]
  const question = item.front
  const answer = item.back
  const fromLang = item.langA
  const toLang = item.langB
  const showPronunciation = item.pronunciation

  const selectVoiceForLang = useCallback((langCode) => {
    const voices = window.speechSynthesis.getVoices()
    const key = (langCode || 'en').toUpperCase()
    const preferred = VOICE_MAP[key] || ['en-GB']
    let voice = voices.find(v => preferred.some(p => v.lang === p))
    if (!voice) voice = voices.find(v => preferred.some(p => v.lang.startsWith(p.split('-')[0])))
    return voice || voices[0]
  }, [])

  const speakTargetLanguageOnly = useCallback((text, langCode) => {
    if (!text || !langCode) return
    const key = (langCode || 'en').toUpperCase()
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = selectVoiceForLang(key)
    utterance.voice = voice
    utterance.lang = VOICE_MAP[key]?.[0] || 'en-GB'
    utterance.rate = 0.85
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }, [selectVoiceForLang])

  // Always speak the TARGET language side of the card, never native language
  const speakBack = (mode = ttsMode) => {
    const result = getToLangText(item, userToLang)
    if (!result) return
    if (mode === 1) speakSyllable(result.text, result.langCode)
    else speak(result.text, result.langCode)
  }
  const cycleTtsMode = () => setTtsMode(m => (m + 1) % 2)
  const handleSpeakerTap = () => { speakBack(ttsMode); cycleTtsMode() }

  const handleMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setMicState('unsupported'); return }
    setMicState('listening'); setMicResult(null)
    const rec = new SR()
    const toLangResult = getToLangText(item, userToLang) || { text: item.back, langCode: userToLang }
    const { text: toLangText, langCode: toLangCode } = toLangResult
    // Fix: detect question language so mic uses the answer language, not the question language
    const questionLang = item.langA || toLangCode
    const questionIsInToLang = questionLang === userToLang
    const fromLangForMic = lang || 'de' // user's native language
    rec.lang = questionIsInToLang ? (SPEECH_LANGS[fromLangForMic] || 'de-DE') : (SPEECH_LANGS[toLangCode] || 'en-GB')
    rec.interimResults = false; rec.maxAlternatives = 3
    const timeout = setTimeout(() => { try { rec.stop() } catch(e) {} }, 5000)
    rec.onresult = (e) => {
      clearTimeout(timeout)
      const alts = []
      for (let r = 0; r < e.results.length; r++)
        for (let a = 0; a < e.results[r].length; a++) alts.push(e.results[r][a].transcript.trim())
      const transcript = alts[0] || ''
      const expWords = toLangText.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean)
      const gotWords = alts.join(' ').toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean)
      const origWords = toLangText.split(/\s+/)
      const words = expWords.map((w, i) => ({
        word: origWords[i] || w,
        correct: gotWords.some(g => fuzzyWordMatch(w, g))
      }))
      const pct = Math.round((words.filter(w => w.correct).length / Math.max(words.length, 1)) * 100)
      setMicResult({ score: pct, words, transcript })
      setMicState('done')
      // track pronunciation score history per card for coaching
      setNewProgress(prev => {
        const hist = prev[item.id]?._pronunciationHistory || []
        return { ...prev, [item.id]: { ...prev[item.id], _pronunciationHistory: [...hist, pct].slice(-10) } }
      })
    }
    rec.onerror = () => { clearTimeout(timeout); setMicState('idle') }
    rec.onend = () => { clearTimeout(timeout); setMicState(s => s === 'listening' ? 'idle' : s) }
    rec.start()
  }

  useEffect(() => {
    if (!revealed) return // mic state preserved when flipping — index change effect resets it
    if (fromLang !== 'de' || toLang !== 'en') return
    if (phoneticCache[item.id] !== undefined) return
    setPhoneticCache(c => ({ ...c, [item.id]: '' })) // mark as loading
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 60,
        messages: [{ role: 'user', content: `Give ONLY the German-phonetic pronunciation guide for this English word or short phrase: "${item.back}". Output only the phonetic spelling (how a German speaker would read it to sound like English), nothing else. Examples: swamped→swompt, through→thruu, though→dhoo, world→wörld, knight→nait` }]
      })
    }).then(r => r.json()).then(d => {
      const ph = d.content?.[0]?.text?.trim() || ''
      setPhoneticCache(c => ({ ...c, [item.id]: ph }))
    }).catch(() => {})
  }, [revealed, index])

  // Load note for current card (newProgress takes priority — written in this session)
  useEffect(() => {
    setNoteText(newProgress[item.id]?._note || cardProgress[item.id]?._note || '')
    setNoteOpen(false)
    setKiExplanation(null)
    setKontextVariation(null); setKontextOpen(false)
    setMicState('idle'); setMicResult(null)
  }, [index])

  // ── FEHLER-MUSTER ANALYSE (Sonnet after 10 wrong) ────────────
  useEffect(() => {
    if (wrong < 10 || patternTip !== null) return
    setPatternTip('loading')
    const cards = wrongCardsRef.current.slice(0, 10)
    const cardList = cards.map(c => `"${c.front}" → "${c.back}" (reacted in ${c.reactionMs ? Math.round(c.reactionMs/1000)+'s' : '?'})`).join('; ')
    const tipLang = lang === 'de' ? 'German' : 'English'
    const regCtx = socialRegisterContext(socialRegister)
    fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 120,
        messages: [{ role: 'user', content: `A language learner (social context: ${regCtx}) answered these ${cards.length} cards incorrectly: ${cardList}. In exactly 1 sentence in ${tipLang}, name the specific grammar pattern or memory trick that connects these mistakes. Consider reaction times — slow reactions signal active recall failure, not just gaps. Suggest an appropriate tense focus (present/past/future). Be concrete, practical, not generic.` }]
      })
    }).then(r => r.json()).then(async d => {
      const tip = d.content?.[0]?.text?.trim()
      setPatternTip(tip || null)
      // Save to Firestore errorPatterns
      if (user && tip) {
        const entry = { tip, date: todayStr(), wrongCards: cards.slice(0, 5).map(c => c.front), register: socialRegister }
        updateDoc(doc(db, 'users', user.uid), { errorPatterns: [entry] }).catch(() => {
          setDoc(doc(db, 'users', user.uid, 'analysis', 'errorPatterns'), { patterns: [entry] }, { merge: true }).catch(() => {})
        })
      }
    }).catch(() => setPatternTip(null))
  }, [wrong]) // eslint-disable-line

  // Example sentence for vocabulary cards
  const [exampleSentence, setExampleSentence] = useState(null)
  useEffect(() => {
    setExampleSentence(cardProgress[item.id]?._example || null)
  }, [index])
  useEffect(() => {
    if (!revealed || item.category !== 'vocabulary') return
    if (cardProgress[item.id]?._example) { setExampleSentence(cardProgress[item.id]._example); return }
    if (exampleSentence) return
    const fromL = fromLang === 'de' ? 'German' : fromLang === 'en' ? 'English' : fromLang === 'sw' ? 'Swahili' : fromLang
    const toL = toLang === 'de' ? 'German' : toLang === 'en' ? 'English' : toLang === 'sw' ? 'Swahili' : toLang
    fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 120,
        messages: [{ role: 'user', content: `For the vocabulary word: "${item.front}" (${fromL}) = "${item.back}" (${toL}), write exactly ONE short natural example sentence in ${fromL} using this word, then translate it to ${toL}. Return ONLY valid JSON: {"from":"sentence in ${fromL}","to":"sentence in ${toL}"}` }]
      })
    }).then(r => r.json()).then(d => {
      try {
        const text = d.content?.[0]?.text?.trim() || ''
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
        if (parsed.from && parsed.to) {
          setExampleSentence(parsed)
          onSaveExample?.(item.id, parsed)
        }
      } catch(e) {}
    }).catch(() => {})
  }, [revealed, index])

  const triggerBurst = (isEasy) => {
    const count = isEasy ? 14 : 9
    const colors = isEasy
      ? ['#FFD700','#FFD700','#FFF700','#FF9900','#FFFFFF']
      : ['#00E676','#69F0AE','#FFFFFF','#B9F6CA']
    const particles = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * 2 * Math.PI
      const dist = 55 + Math.random() * 45
      return { id: i, color: colors[i % colors.length], dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist }
    })
    setBurstParticles(particles)
    setTimeout(() => setBurstParticles([]), 600)
  }

  const triggerAnim = (anim, delay, cb) => {
    if (animLock.current) return
    animLock.current = true
    setCardAnim(anim)
    setTimeout(() => {
      setCardAnim(null)
      animLock.current = false
      setCardSlideIn(true)
      setTimeout(() => setCardSlideIn(false), 350)
      cb()
    }, delay)
  }

  const handleReveal = () => {
    startTime.current = Date.now()
    setFlipPhase(true)
    setTimeout(() => {
      setRevealed(true)
      setFlipPhase(false)
      speakBack(ttsMode)
    }, 230)
  }
  const handleStop = () => {
    onSaveState?.(queue, index, newProgress)
    if (onStop) {
      onStop(newProgress, answeredIds.current.size)
    } else {
      if (answeredIds.current.size > 0) {
        onSaveSessionProgress?.(Array.from(answeredIds.current), mode)
      }
      onBack()
    }
  }
  const handleEasy = () => {
    const cardId = item.id
    answeredIds.current.add(cardId)
    easyCountRef.current += 1
    const st = cardStatsRef.current[cardId] || { wrongs: 0, fastestMs: Infinity }
    cardStatsRef.current[cardId] = { ...st, fastestMs: Math.min(st.fastestMs, 500) }
    const prev = newProgress[cardId] || { interval: 0, consecutiveRight: 0, wrongSessions: 0 }
    const prevEasyCount = (prev.easyCount || 0) + 1
    const wasMastered = !!prev.mastered
    const nowMastered = prevEasyCount >= 5 || wasMastered
    let easyInterval
    if (wasMastered) {
      const mrc = (prev.masteredReviewCount || 0) + 1
      const masteredIntervals = [30, 60, 90, 180]
      easyInterval = masteredIntervals[Math.min(mrc - 1, masteredIntervals.length - 1)]
    } else if (prevEasyCount >= 5) {
      easyInterval = 30
    } else if (prevEasyCount === 1) {
      easyInterval = 5
    } else if (prevEasyCount === 2) {
      easyInterval = 10
    } else {
      easyInterval = 21
    }
    const masteredReviewCount = wasMastered ? (prev.masteredReviewCount || 0) + 1 : (nowMastered ? 1 : 0)
    const isGolden = nowMastered || easyInterval >= 14
    const updatedProgress = {
      ...prev, interval: easyInterval, consecutiveRight: 0,
      wrongSessions: Math.max(0, (prev.wrongSessions || 0) - 1),
      nextReview: getNextReview(easyInterval), easyCount: prevEasyCount,
      mastered: nowMastered,
      masteredAt: nowMastered && !wasMastered ? todayStr() : (prev.masteredAt || null),
      masteredReviewCount, isGolden
    }
    const finalProgress = { ...newProgress, [cardId]: updatedProgress }
    setNewProgress(finalProgress)
    const newCorrect = correct + 1; setCorrect(newCorrect)
    if (index + 1 >= queue.length) { onFinish(finalProgress, newCorrect, wrong, easyCountRef.current, fastCountRef.current, cardStatsRef.current); return }
    setIndex(i => i + 1); setRevealed(false)
    onSaveState?.(queue, index + 1, finalProgress)
  }
  const handleFast = () => {
    const cardId = item.id
    answeredIds.current.add(cardId)
    fastCountRef.current += 1
    const st = cardStatsRef.current[cardId] || { wrongs: 0, fastestMs: Infinity }
    cardStatsRef.current[cardId] = { ...st, fastestMs: Math.min(st.fastestMs, Date.now()) }
    const prev = newProgress[cardId] || { interval: 0, consecutiveRight: 0, wrongSessions: 0 }
    const updatedProgress = {
      ...prev, interval: 1, consecutiveRight: 0,
      wrongSessions: Math.max(0, (prev.wrongSessions || 0) - 1),
      nextReview: getNextReview(1), fastCount: (prev.fastCount || 0) + 1
    }
    const finalProgress = { ...newProgress, [cardId]: updatedProgress }
    setNewProgress(finalProgress)
    if (index + 1 >= queue.length) { onFinish(finalProgress, correct, wrong, easyCountRef.current, fastCountRef.current, cardStatsRef.current); return }
    setIndex(i => i + 1); setRevealed(false)
    onSaveState?.(queue, index + 1, finalProgress)
  }
  const handleAnswer = (isCorrect) => {
    const elapsed = (Date.now() - startTime.current) / 1000
    const elapsedMs = elapsed * 1000
    const cardId = item.id
    answeredIds.current.add(cardId)
    reactionTimesRef.current[cardId] = elapsedMs
    const st = cardStatsRef.current[cardId] || { wrongs: 0, fastestMs: Infinity }
    if (!isCorrect) {
      cardStatsRef.current[cardId] = { ...st, wrongs: st.wrongs + 1 }
      const prev = newProgress[cardId] || { interval: 0, consecutiveRight: 0, wrongSessions: 0 }
      const updatedProgress = { ...prev, interval: 0, consecutiveRight: 0, wrongSessions: 3, nextReview: todayStr(), wrongCount: (prev.wrongCount || 0) + 1, _lastReactionMs: Math.round(elapsedMs) }
      const finalNewProgress = { ...newProgress, [cardId]: updatedProgress }
      const newQueue = [...queue]
      newQueue.splice(index, 1)
      newQueue.splice(Math.min(index + 5, newQueue.length), 0, { ...item })
      wrongCardsRef.current.push({ front: item.front, back: item.back, reactionMs: Math.round(elapsedMs) })
      setQueue(newQueue); setNewProgress(finalNewProgress); setWrong(w => w + 1); setRevealed(false)
      onSaveState?.(newQueue, index, finalNewProgress)
    } else {
      cardStatsRef.current[cardId] = { ...st, fastestMs: Math.min(st.fastestMs, elapsedMs) }
      const prev = newProgress[cardId] || { interval: 0, consecutiveRight: 0, wrongSessions: 0 }
      const newCR = (prev.consecutiveRight || 0) + 1
      const baseInterval = Math.max(2, (prev.interval || 0) + 1)
      let interval
      if (newCR >= 5) interval = Math.max(4, (prev.interval || 0) + 3)
      else if (newCR >= 3) interval = Math.max(3, (prev.interval || 0) + 2)
      else interval = baseInterval
      // Reaction time modifier: fast <3s = boost, slow >10s = slight reduce
      if (elapsed < 3 && interval > 1) interval = Math.min(interval + 1, interval + 1)
      else if (elapsed > 10) interval = Math.max(1, interval - 1)
      const isGolden = interval >= 14
      const updatedProgress = { ...prev, interval, consecutiveRight: newCR, wrongSessions: Math.max(0, (prev.wrongSessions || 0) - 1), nextReview: getNextReview(interval), rightCount: (prev.rightCount || 0) + 1, isGolden, _lastReactionMs: Math.round(elapsedMs) }
      const finalProgress = { ...newProgress, [cardId]: updatedProgress }
      setNewProgress(finalProgress)
      const newCorrect = correct + 1; setCorrect(newCorrect)
      if (index + 1 >= queue.length) { onFinish(finalProgress, newCorrect, wrong, easyCountRef.current, fastCountRef.current, cardStatsRef.current); return }
      setIndex(i => i + 1); setRevealed(false)
      onSaveState?.(queue, index + 1, finalProgress)
    }
  }

  const haptic = (pattern) => { try { if (navigator.vibrate) navigator.vibrate(pattern) } catch(e) {} }

  const handleAnswerAnimated = (isCorrect) => {
    if (animLock.current) return
    if (isCorrect) {
      haptic(50)
    } else {
      haptic([100, 100, 100])
      // Fetch KI explanation for wrong answer
      setKiExplanation('loading')
      const fromLangName = fromLang === 'de' ? 'German' : 'English'
      fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 80,
          messages: [{ role: 'user', content: `The learner forgot this card. Question: "${item.front}". Correct answer: "${item.back}". Explain in ${fromLangName} in max 2 sentences why "${item.back}" is the correct answer. Be specific about the grammar rule or meaning. No intro — start directly with the explanation. ${kiRespondIn(fromLang)}` }]
        })
      }).then(r => r.json()).then(d => setKiExplanation(d.content?.[0]?.text?.trim() || null)).catch(() => setKiExplanation(null))
    }
    const anim = isCorrect ? 'flyRight' : 'shake'
    const delay = isCorrect ? 350 : 480
    if (isCorrect) triggerBurst(false)
    triggerAnim(anim, delay, () => handleAnswer(isCorrect))
  }
  const handleEasyAnimated = () => {
    haptic([30, 40, 30, 40, 30])
    triggerBurst(true)
    triggerAnim('flyUp', 320, () => handleEasy())
  }
  const handleFastAnimated = () => {
    haptic([30, 60, 30])
    triggerAnim('flyRight', 350, () => handleFast())
  }

  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox} className="vocara-card-screen-box">
      <div style={s.cardHeader}>
        <p style={s.greeting}>{t.card} {index + 1} {t.of} {queue.length}</p>
        <button style={s.stopBtn} onClick={handleStop}>{t.stop}</button>
      </div>
      {/* ── REVIEW STATS ── */}
      {(() => {
        const today = todayStr()
        const tom = new Date(); tom.setDate(tom.getDate() + 1)
        const tomorrow = tom.toISOString().slice(0, 10)
        const rToday = Object.values(cardProgress).filter(p => p.nextReview === today).length
        const rTom = Object.values(cardProgress).filter(p => p.nextReview === tomorrow).length
        return (
          <p style={{ ...s.greeting, fontSize: '0.72rem', marginBottom: '6px', textAlign: 'center', opacity: 0.7 }}>
            Wiederholungen heute: {rToday} · Morgen: {rTom}
          </p>
        )
      })()}
      {/* ── PARTICLE BURST (#47) ── */}
      {burstParticles.length > 0 && (
        <div style={{ position: 'fixed', top: '38%', left: '50%', pointerEvents: 'none', zIndex: 999 }}>
          {burstParticles.map(p => (
            <div key={p.id} style={{
              position: 'absolute', width: '8px', height: '8px', borderRadius: '50%', background: p.color,
              '--px': `${p.dx}px`, '--py': `${p.dy}px`,
              animation: 'particleBurst 0.55s ease-out forwards',
            }} />
          ))}
          <div style={{ position: 'absolute', width: '44px', height: '44px', borderRadius: '50%', border: '2px solid rgba(255,215,0,0.6)', top: '-22px', left: '-22px', animation: 'sparkleRing 0.5s ease-out forwards' }} />
        </div>
      )}
      {/* ── KONTEXT BUTTON ABOVE CARD ── */}
      {onKontext && (
        <button onClick={() => onKontext(item)} style={{ width: '100%', marginBottom: '10px', padding: '8px 16px', background: 'rgba(0,191,165,0.10)', border: '1.5px solid rgba(0,191,165,0.45)', borderRadius: '12px', color: '#00BFA5', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', animation: 'vocaraKontextGlow 2s ease-in-out infinite', WebkitTapHighlightColor: 'transparent', letterSpacing: '0.3px' }}>
          🔄 {lang === 'de' ? `Kontext: "${item.front}"` : `Context: "${item.front}"`}
        </button>
      )}
      {/* ── FLIP CARD ── */}
      <div style={{ width: '100%', marginBottom: '16px', perspective: '900px',
        animation: cardAnim
          ? `vocara${cardAnim.charAt(0).toUpperCase() + cardAnim.slice(1)} ${cardAnim === 'shake' ? '0.48s' : '0.35s'} ease forwards`
          : cardSlideIn ? 'vocaraSlideIn 0.32s ease-out forwards' : undefined,
      }}>
        <div className="vocara-big-card"
          onTouchStart={handleCardPressStart} onTouchEnd={handleCardPressEnd} onTouchMove={handleCardPressEnd}
          onMouseDown={handleCardPressStart} onMouseUp={handleCardPressEnd} onMouseLeave={handleCardPressEnd}
          style={{
          ...s.bigCard,
          border: (newProgress[item.id]?.isGolden || cardProgress[item.id]?.isGolden)
            ? '1px solid rgba(255,215,0,0.60)'
            : revealed ? `1px solid ${s.progressFill.background}` : `1px solid ${s.progressBar.background}`,
          boxShadow: (newProgress[item.id]?.isGolden || cardProgress[item.id]?.isGolden)
            ? undefined
            : s.bigCard.boxShadow,
          animation: (newProgress[item.id]?.isGolden || cardProgress[item.id]?.isGolden) && !flipPhase
            ? 'goldShimmer 2.4s ease-in-out infinite'
            : undefined,
          transition: flipPhase ? 'transform 0.23s ease-in, border-color 0.3s ease' : 'transform 0.23s ease-out, border-color 0.3s ease',
          minHeight: '220px',
          transform: flipPhase
            ? `rotateX(${-cardTilt.x * 0.5}deg) rotateY(90deg)`
            : `rotateX(${-cardTilt.x * 1.5}deg) rotateY(${cardTilt.y * 1.5}deg)`,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}>
          {/* specular highlight — moves opposite to tilt, simulates light reflection */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
            background: `radial-gradient(circle at ${50 - cardTilt.y * 3.5}% ${50 - cardTilt.x * 3.5}%, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.04) 35%, transparent 65%)`,
            transition: 'background 0.1s ease-out',
          }} />
          {/* register badge */}
          <div style={{
            position: 'absolute', top: '8px', left: '10px',
            background: item.category === 'street' ? 'rgba(180,120,30,0.22)' : 'rgba(140,140,155,0.18)',
            color: item.category === 'street' ? '#C8922A' : '#8A8A9A',
            border: `1px solid ${item.category === 'street' ? 'rgba(180,120,30,0.35)' : 'rgba(140,140,155,0.28)'}`,
            borderRadius: '6px', padding: '2px 7px',
            fontSize: '9px', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase',
            pointerEvents: 'none',
          }}>
            {item.category === 'street' ? 'Slang' : 'Hochsprache'}
          </div>
          {(newProgress[item.id]?.isGolden || cardProgress[item.id]?.isGolden) && (
            <div style={{ position: 'absolute', top: '8px', right: '10px', background: 'rgba(255,215,0,0.15)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.40)', borderRadius: '6px', padding: '2px 7px', fontSize: '9px', fontWeight: '600', letterSpacing: '0.3px', pointerEvents: 'none', animation: 'goldShimmer 2.4s ease-in-out infinite' }}>
              ⭐ Gold
            </div>
          )}
          {item.sharedBy && !cardProgress[item.id] && (
            <div style={{ position: 'absolute', top: '8px', right: '10px', background: 'rgba(255,215,0,0.18)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.35)', borderRadius: '6px', padding: '2px 7px', fontSize: '9px', fontWeight: '600', letterSpacing: '0.3px', pointerEvents: 'none' }}>
              🎁 {item.sharedBy}
            </div>
          )}
          {/* Tense tag — bottom-left of card (only when not present tense) */}
          {item.tense && item.tense !== 'present' && TENSE_LABELS[item.tense] && (
            <div style={{ position: 'absolute', bottom: '8px', left: '10px', background: 'rgba(100,80,200,0.15)', border: '1px solid rgba(100,80,200,0.28)', borderRadius: '6px', padding: '2px 7px', fontSize: '9px', fontWeight: '600', letterSpacing: '0.4px', color: '#9c7bf0', pointerEvents: 'none' }}>
              {TENSE_LABELS[item.tense].emoji} {lang === 'de' ? TENSE_LABELS[item.tense].de : TENSE_LABELS[item.tense].en}
            </div>
          )}
          {/* WordType tag — top-right, only when no gold/gift badge */}
          {item.wordType && !(newProgress[item.id]?.isGolden || cardProgress[item.id]?.isGolden) && !item.sharedBy && (
            <div style={{ position: 'absolute', top: '8px', right: '10px', background: 'rgba(60,140,200,0.14)', color: '#70b0d8', border: '1px solid rgba(60,140,200,0.28)', borderRadius: '6px', padding: '2px 7px', fontSize: '9px', fontWeight: '600', letterSpacing: '0.4px', pointerEvents: 'none' }}>
              {item.article ? `${item.article} · ` : ''}{item.wordType}
            </div>
          )}
          {/* Note icon — bottom-right of card */}
          <button onClick={() => setNoteOpen(o => !o)} style={{ position: 'absolute', bottom: '8px', right: '32px', background: noteText ? 'rgba(255,255,255,0.10)' : 'transparent', border: noteText ? '1px solid rgba(255,255,255,0.18)' : 'none', borderRadius: '8px', padding: '3px 7px', color: noteText ? '#e0c060' : '#8A8A9A', fontSize: '0.75rem', cursor: 'pointer', opacity: 0.85, lineHeight: 1, zIndex: 2 }}>
            📝
          </button>
          {/* Report translation button — bottom-right */}
          <button onClick={async () => {
            if (reportedCards.has(item.id)) return
            setReportedCards(prev => new Set([...prev, item.id]))
            try { await setDoc(doc(db, 'reports', `${item.id}_${Date.now()}`), { cardId: item.id, front: item.front, back: item.back, reportedBy: user?.uid, ts: Date.now() }) } catch(_) {}
          }} style={{ position: 'absolute', bottom: '8px', right: '10px', background: 'transparent', border: 'none', borderRadius: '8px', padding: '3px 5px', color: reportedCards.has(item.id) ? '#e57373' : '#8A8A9A', fontSize: '0.7rem', cursor: reportedCards.has(item.id) ? 'default' : 'pointer', opacity: reportedCards.has(item.id) ? 1 : 0.6, lineHeight: 1, zIndex: 2 }} title={lang === 'de' ? 'Übersetzung melden' : 'Report translation'}>
            🚩
          </button>
          <p style={s.dirLabel}>{LANG_FLAGS[fromLang]} → {LANG_FLAGS[toLang]}</p>
          <p style={s.cardFront}>{question}</p>
          {!revealed && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%' }}>
              {/* ── PRE-REVEAL MIC ── */}
              {micState !== 'unsupported' && (
                <button
                  onClick={handleMic}
                  disabled={micState === 'listening'}
                  style={{ background: micState === 'listening' ? 'rgba(229,57,53,0.12)' : 'transparent', border: `1px solid ${micState === 'listening' ? 'rgba(229,57,53,0.35)' : 'rgba(140,140,155,0.22)'}`, borderRadius: '12px', padding: '7px 20px', color: micState === 'listening' ? '#e53935' : '#8A8A9A', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', animation: micState === 'listening' ? 'vocaraPulse 0.8s infinite' : 'none', WebkitTapHighlightColor: 'transparent' }}
                >
                  🎤 {micState === 'listening' ? (lang === 'de' ? 'Höre zu…' : 'Listening…') : (lang === 'de' ? 'Antwort sprechen' : 'Speak your answer')}
                </button>
              )}
              {micResult && (
                <div style={{ textAlign: 'center', animation: 'vocaraFadeIn 0.3s ease both', width: '100%' }}>
                  <p style={{ fontSize: '0.88rem', fontWeight: '700', margin: '0 0 2px', color: micResult.score >= 80 ? '#4CAF50' : micResult.score >= 50 ? '#FFA500' : '#e53935' }}>
                    {micResult.score}%
                  </p>
                  <p style={{ fontSize: '0.72rem', margin: '0 0 8px', fontStyle: 'italic', color: micResult.score >= 80 ? '#4CAF50' : micResult.score >= 50 ? '#FFA500' : '#e53935' }}>
                    {micResult.score >= 80 ? (lang === 'de' ? 'Sehr gut verständlich' : 'Very clearly understandable') : micResult.score >= 50 ? (lang === 'de' ? 'Gut, aber noch etwas üben' : 'Good, but keep practicing') : (lang === 'de' ? 'Nochmal versuchen' : 'Try again')}
                  </p>
                  {micResult.score >= 70
                    ? <button onClick={() => handleAnswerAnimated(true)} style={{ background: 'rgba(76,175,80,0.18)', border: '1px solid rgba(76,175,80,0.45)', borderRadius: '12px', padding: '8px 22px', color: '#4CAF50', fontSize: '0.85rem', cursor: 'pointer', fontWeight: '600', WebkitTapHighlightColor: 'transparent' }}>✅ {lang === 'de' ? 'Richtig — weiter' : 'Correct — next'}</button>
                    : <button style={s.revealBtn} onClick={handleReveal}>{lang === 'de' ? 'Lösung anzeigen' : 'Show solution'}</button>
                  }
                </div>
              )}
              {!micResult && (
                <button style={s.revealBtn} onClick={handleReveal}>{t.showSolution}</button>
              )}
            </div>
          )}
          {revealed && (
            <div style={{ animation: 'vocaraFadeIn 0.3s ease both', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
                <p style={{ ...s.cardBack, margin: 0 }}>{answer}</p>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <button onClick={handleSpeakerTap} style={{ background: 'transparent', border: 'none', fontSize: '1.3rem', cursor: 'pointer', padding: '4px', opacity: 0.8 }}>🔊</button>
                  <span style={{ background: 'transparent', border: `1px solid rgba(140,140,155,0.35)`, borderRadius: '4px', fontSize: '0.58rem', padding: '1px 5px', color: '#8A8A9A', fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '0.3px', userSelect: 'none' }}>{ttsMode === 0 ? 'Satz' : 'Silbe'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <button onClick={handleMic} style={{ background: 'transparent', border: 'none', fontSize: '1.3rem', cursor: 'pointer', padding: '4px', opacity: micState === 'listening' ? 1 : 0.7, animation: micState === 'listening' ? 'vocaraPulse 0.8s infinite' : 'none' }}>🎤</button>
                  <span style={{ fontSize: '0.58rem', color: micState === 'listening' ? '#e53935' : micState === 'done' ? (micResult?.score >= 80 ? '#4CAF50' : micResult?.score >= 50 ? '#FFA500' : '#e53935') : '#8A8A9A', fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '0.3px' }}>{micState === 'listening' ? '…' : micState === 'done' ? `${micResult?.score}%` : 'Mic'}</span>
                </div>
              </div>
              {micState === 'unsupported' && (
                <p style={{ color: '#ff9800', fontSize: '0.75rem', fontStyle: 'italic', marginTop: '6px', textAlign: 'center' }}>Dein Browser unterstützt keine Spracherkennung — bitte Chrome verwenden</p>
              )}
              {micResult && (
                <div style={{ marginTop: '8px', textAlign: 'center', animation: 'vocaraFadeIn 0.3s ease both' }}>
                  <p style={{ fontSize: '0.88rem', fontWeight: '700', margin: '0 0 2px', color: micResult.score >= 80 ? '#4CAF50' : micResult.score >= 50 ? '#FFA500' : '#e53935' }}>
                    {lang === 'de' ? 'Aussprache: ' : 'Pronunciation: '}{micResult.score}%
                  </p>
                  <p style={{ fontSize: '0.75rem', margin: '0 0 6px', fontStyle: 'italic', color: micResult.score >= 80 ? '#4CAF50' : micResult.score >= 50 ? '#FFA500' : '#e53935' }}>
                    {micResult.score >= 80 ? (lang === 'de' ? 'Sehr gut verständlich' : 'Very clearly understandable') : micResult.score >= 50 ? (lang === 'de' ? 'Gut, aber noch etwas üben' : 'Good, but keep practicing') : (lang === 'de' ? 'Nochmal versuchen' : 'Try again')}
                  </p>
                  <p style={{ fontSize: '1rem', letterSpacing: '2px', margin: '0 0 6px' }}>
                    {micResult.words.map((w, i) => (
                      <span key={i} style={{ color: w.correct ? '#4CAF50' : '#e53935', marginRight: '4px' }}>{w.word}</span>
                    ))}
                  </p>
                  {micResult.transcript && <p style={{ fontSize: '0.68rem', color: '#8A8A9A', margin: '0 0 6px', fontStyle: 'italic' }}>„{micResult.transcript}"</p>}
                  <button onClick={() => { setMicState('idle'); setMicResult(null) }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '4px 12px', color: '#8A8A9A', fontSize: '0.72rem', cursor: 'pointer' }}>
                    🔄 {lang === 'de' ? 'Nochmal' : 'Try again'}
                  </button>
                </div>
              )}
              {showPronunciation && (
                <p style={s.cardPronunciation}>
                  🔊 {t.pronunciation}:{' '}
                  {(item.langA === 'th' || item.langB === 'th')
                    ? <ThaiColorPronunciation text={item.pronunciation} />
                    : item.pronunciation}
                </p>
              )}
              {fromLang === 'de' && toLang === 'en' && phoneticCache[item.id] && (
                <p style={{ ...s.cardPronunciation, fontStyle: 'italic', marginTop: '2px' }}>🗣 /{phoneticCache[item.id]}/</p>
              )}
              {!phoneticCache[item.id] && cardProgress[item.id]?._phonetic && (
                <p style={{ ...s.cardPronunciation, fontStyle: 'italic', marginTop: '2px', color: 'rgba(255,255,255,0.4)' }}>🗣 /{cardProgress[item.id]._phonetic}/</p>
              )}
              {item.context && <p style={s.cardContext}>„{item.context}"</p>}
              {item.category === 'vocabulary' && exampleSentence && (
                <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', maxWidth: '310px', textAlign: 'center' }}>
                  <p style={{ color: s.cardFront.color || '#fff', fontSize: '0.78rem', margin: '0 0 4px', fontStyle: 'italic', opacity: 0.85 }}>{exampleSentence.from}</p>
                  <p style={{ color: s.cardContext?.color || '#888', fontSize: '0.72rem', margin: 0, fontStyle: 'italic' }}>{exampleSentence.to}</p>
                </div>
              )}
              {item.category === 'vocabulary' && !exampleSentence && revealed && (
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.68rem', marginTop: '6px', fontStyle: 'italic' }}>…</p>
              )}
              {noteText && <p style={{ color: '#8A8A9A', fontSize: '0.75rem', fontStyle: 'italic', marginTop: '6px', maxWidth: '300px', textAlign: 'center' }}>📝 {noteText}</p>}
            </div>
          )}
        </div>
      </div>
      {noteOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 8800, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 16px 40px' }}
          onClick={() => setNoteOpen(false)}>
          <div style={{ width: '100%', maxWidth: '440px', background: 'rgba(20,20,28,0.96)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '20px', padding: '18px 16px', animation: 'vocaraFadeIn 0.2s ease both' }}
            onClick={e => e.stopPropagation()}>
            <p style={{ color: '#8A8A9A', fontSize: '0.75rem', marginBottom: '10px', letterSpacing: '0.3px' }}>📝 {lang === 'de' ? 'Persönliche Notiz' : 'Personal note'}</p>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              maxLength={150}
              rows={3}
              placeholder={lang === 'de' ? 'Notiz zu dieser Karte…' : 'Note about this card…'}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '10px 12px', color: '#ccc', fontSize: '0.88rem', backdropFilter: 'blur(8px)', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <span style={{ color: '#8A8A9A', fontSize: '0.7rem' }}>{noteText.length}/150</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setNoteOpen(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '7px 14px', color: '#8A8A9A', fontSize: '0.82rem', cursor: 'pointer' }}>
                  {lang === 'de' ? 'Abbrechen' : 'Cancel'}
                </button>
                <button onClick={async () => {
                  const updated = { ...newProgress, [item.id]: { ...(newProgress[item.id] || {}), _note: noteText } }
                  setNewProgress(updated); setNoteOpen(false)
                  // Immediate Firestore write so note persists even if session is abandoned
                  if (user) updateDoc(doc(db, 'users', user.uid), { [`cardProgress.${item.id}._note`]: noteText }).catch(() => {})
                  await onSaveState?.(queue, index, updated)
                }} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', padding: '7px 16px', color: '#e0e0e0', fontSize: '0.82rem', cursor: 'pointer', fontWeight: '600' }}>
                  ✓ {lang === 'de' ? 'Speichern' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {kiExplanation && (
        <div style={{ width: '100%', marginBottom: '8px', background: 'rgba(229,57,53,0.07)', border: '1px solid rgba(229,57,53,0.22)', borderRadius: '12px', padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '8px', animation: 'vocaraFadeIn 0.3s ease both' }}>
          <div style={{ flex: 1 }}>
            {kiExplanation === 'loading'
              ? <p style={{ color: '#8A8A9A', fontSize: '0.78rem', margin: 0, animation: 'vocaraPulse 1.2s infinite' }}>💡 {lang === 'de' ? 'KI erklärt…' : 'AI explaining…'}</p>
              : <>
                  <p style={{ color: '#e57373', fontSize: '0.68rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 4px' }}>💡 {lang === 'de' ? 'KI erklärt:' : 'AI explains:'}</p>
                  <p style={{ color: '#ffcdd2', fontSize: '0.8rem', margin: 0, lineHeight: 1.55 }}>{kiExplanation}</p>
                </>
            }
          </div>
          {kiExplanation !== 'loading' && (
            <button onClick={() => setKiExplanation(null)} style={{ background: 'transparent', border: 'none', color: '#8A8A9A', cursor: 'pointer', fontSize: '0.9rem', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>✕</button>
          )}
        </div>
      )}
      {patternTip && (
        <div style={{ width: '100%', marginBottom: '8px', background: 'rgba(255,200,50,0.07)', border: '1px solid rgba(255,200,50,0.24)', borderRadius: '12px', padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '8px', animation: 'vocaraFadeIn 0.4s ease both' }}>
          <div style={{ flex: 1 }}>
            <p style={{ color: s.easyBtn.color, fontSize: '0.7rem', fontWeight: '700', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              {patternTip === 'loading' ? `💡 ${lang === 'de' ? 'KI analysiert Muster…' : 'AI analysing pattern…'}` : `💡 ${lang === 'de' ? 'KI hat ein Muster erkannt' : 'AI spotted a pattern'}`}
            </p>
            {patternTip !== 'loading' && (
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.78rem', margin: 0, lineHeight: 1.5 }}>{patternTip}</p>
            )}
          </div>
          {patternTip !== 'loading' && (
            <button onClick={() => setPatternTip(null)} style={{ background: 'transparent', border: 'none', color: '#8A8A9A', cursor: 'pointer', fontSize: '0.9rem', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>✕</button>
          )}
        </div>
      )}
      {/* ── KONTEXT-WECHSEL (#32) — mastered cards only ── */}
      {revealed && (newProgress[item.id]?.interval || cardProgress[item.id]?.interval || 0) >= 3 && (
        <div style={{ width: '100%', marginBottom: '8px' }}>
          {!kontextVariation && (
            <button onClick={async () => {
              setKontextVariation('loading')
              try {
                const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                  model: 'claude-haiku-4-5-20251001', max_tokens: 180,
                  messages: [{ role: 'user', content: `For the phrase "${item.front}" (meaning: "${item.back}"), give 3 very short context variants in ${item.langA === 'de' ? 'German' : 'English'}:\n1. Formal (1 example sentence)\n2. Informal (1 example sentence)\n3. Romantic (1 example sentence)\nFormat: formal: ...\ninformal: ...\nromantic: ...` }]
                })})
                const text = (await res.json()).content?.[0]?.text?.trim() || ''
                const formal = text.match(/formal:\s*(.+)/i)?.[1]?.trim() || ''
                const informal = text.match(/informal:\s*(.+)/i)?.[1]?.trim() || ''
                const romantic = text.match(/romantic:\s*(.+)/i)?.[1]?.trim() || ''
                setKontextVariation({ formal, informal, romantic })
                setKontextOpen(true)
              } catch { setKontextVariation(null) }
            }} style={{ background: 'rgba(100,120,255,0.08)', border: '1px solid rgba(100,120,255,0.22)', borderRadius: '10px', padding: '6px 12px', color: '#9A9AFF', fontSize: '0.72rem', cursor: 'pointer', fontWeight: '600', letterSpacing: '0.3px' }}>
              🔄 {lang === 'de' ? 'Kontext' : 'Context'}
            </button>
          )}
          {kontextVariation === 'loading' && <p style={{ color: '#9A9AFF', fontSize: '0.72rem', margin: '4px 0' }}>🔄 {lang === 'de' ? 'Kontext wird geladen…' : 'Loading context…'}</p>}
          {kontextVariation && kontextVariation !== 'loading' && (
            <div style={{ background: 'rgba(100,120,255,0.07)', border: '1px solid rgba(100,120,255,0.20)', borderRadius: '12px', padding: '10px 14px', animation: 'vocaraFadeIn 0.3s ease both' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <p style={{ color: '#9A9AFF', fontSize: '0.7rem', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '0.6px' }}>🔄 {lang === 'de' ? 'Kontextvarianten' : 'Context variants'}</p>
                <button onClick={() => { setKontextVariation(null); setKontextOpen(false) }} style={{ background: 'transparent', border: 'none', color: '#8A8A9A', cursor: 'pointer', fontSize: '0.9rem', padding: '0 2px' }}>✕</button>
              </div>
              {kontextOpen && (
                <>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', margin: '0 0 3px' }}><span style={{ color: '#9A9AFF', fontWeight: '600' }}>Formell:</span> {kontextVariation.formal}</p>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', margin: '0 0 3px' }}><span style={{ color: '#9A9AFF', fontWeight: '600' }}>Informell:</span> {kontextVariation.informal}</p>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', margin: 0 }}><span style={{ color: '#e88aff', fontWeight: '600' }}>Romantisch:</span> {kontextVariation.romantic}</p>
                </>
              )}
              {!kontextOpen && <button onClick={() => setKontextOpen(true)} style={{ background: 'transparent', border: 'none', color: '#9A9AFF', fontSize: '0.72rem', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>{lang === 'de' ? 'anzeigen' : 'show'}</button>}
            </div>
          )}
        </div>
      )}
      {revealed && (
        <div style={s.answerRow}>
          <button style={s.wrongBtn} onClick={() => handleAnswerAnimated(false)}>{t.wrong}</button>
          <button style={s.fastBtn} onClick={handleFastAnimated}>{t.fast}</button>
          <button style={s.rightBtn} onClick={() => handleAnswerAnimated(true)}>{t.correct}</button>
          <button style={s.easyBtn} onClick={handleEasyAnimated}>{t.easy}</button>
        </div>
      )}
    </div></div>
  )
}

function ResultScreen({ correct, wrong, fast, easy, weakestCard, strongestCard, masteryUnlocked, t, lang, onBack, onReplay, onRhythmus, onKontext, showRhythmus, urlaubNote, onUnlockUrlaub, kontextCard, s, th }) {
  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <h1 style={s.title}>{t.done} 🎉</h1>
      {masteryUnlocked && <div style={{ ...s.card, borderLeft: '3px solid #4CAF50' }}><p style={{ color: '#4CAF50', margin: 0, fontSize: '0.85rem' }}>{t.masteryMsg}</p></div>}
      {kontextCard && onKontext && (
        <button
          style={{ ...s.button, background: 'rgba(0,191,165,0.12)', color: '#00BFA5', marginBottom: '8px',
            border: '1.5px solid #00BFA5', boxShadow: '0 0 12px rgba(0,191,165,0.35), 0 0 0 2px rgba(0,191,165,0.08)',
            animation: 'vocaraKontextGlow 2s ease-in-out infinite' }}
          onClick={onKontext}>
          🔄 {lang === 'de' ? `Kontext: "${kontextCard.front}"` : `Context: "${kontextCard.front}"`}
        </button>
      )}
      <div style={s.card}>
        <div style={s.langRow}><span style={s.lang}>❌ {t.wrong}</span><span style={{ ...s.langPct, color: '#e06c75' }}>{wrong}</span></div>
        {fast > 0 && <div style={s.langRow}><span style={s.lang}>😕 {t.fast}</span><span style={{ ...s.langPct, color: '#FFA500' }}>{fast}</span></div>}
        <div style={s.langRow}><span style={s.lang}>✅ {t.correct}</span><span style={{ ...s.langPct, color: '#4CAF50' }}>{correct}</span></div>
        {easy > 0 && <div style={s.langRow}><span style={s.lang}>⚡ Easy</span><span style={{ ...s.langPct, color: th?.gold || '#FFD700' }}>{easy}</span></div>}
      </div>
      {(weakestCard || strongestCard) && (
        <div style={s.card}>
          {weakestCard && (
            <div style={{ marginBottom: strongestCard ? '14px' : 0 }}>
              <p style={{ ...s.cardLabel, marginBottom: '5px', color: '#e06c75' }}>⚠️ {t.weakestCard}</p>
              <p style={{ color: th?.text || '#fff', fontSize: '0.9rem', margin: 0, fontWeight: '500' }}>{weakestCard.front}</p>
              <p style={{ color: th?.sub || '#888', fontSize: '0.8rem', margin: '2px 0 0' }}>{weakestCard.back}</p>
            </div>
          )}
          {strongestCard && (
            <div>
              <p style={{ ...s.cardLabel, marginBottom: '5px', color: '#4CAF50' }}>⚡ {t.strongestCard}</p>
              <p style={{ color: th?.text || '#fff', fontSize: '0.9rem', margin: 0, fontWeight: '500' }}>{strongestCard.front}</p>
              <p style={{ color: th?.sub || '#888', fontSize: '0.8rem', margin: '2px 0 0' }}>{strongestCard.back}</p>
            </div>
          )}
        </div>
      )}
      {urlaubNote && (
        <div style={{ ...s.card, borderLeft: `3px solid ${th?.accent || '#FFD700'}`, marginBottom: '8px' }}>
          <p style={{ color: th?.text || '#fff', fontWeight: '600', fontSize: '0.85rem', margin: '0 0 6px' }}>✈️ {t.urlaubLocked}</p>
          <p style={{ color: th?.sub || '#888', fontSize: '0.78rem', margin: '0 0 10px' }}>{t.urlaubPremiumNote}</p>
          {onUnlockUrlaub && <button onClick={onUnlockUrlaub} style={{ background: `${th?.accent || '#FFD700'}22`, border: `1px solid ${th?.accent || '#FFD700'}55`, color: th?.accent || '#FFD700', borderRadius: '10px', padding: '6px 16px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>✨ Premium</button>}
        </div>
      )}
      {showRhythmus && onRhythmus && (
        <button style={{ ...s.button, background: `rgba(103,58,183,0.15)`, border: '1px solid rgba(103,58,183,0.4)', color: '#9c7bf0', marginBottom: '8px' }} onClick={onRhythmus}>
          🎵 {t.rhythmusBtn}
        </button>
      )}
      {onReplay && (
        <button style={{ ...s.button, marginBottom: '8px' }} onClick={onReplay}>
          🔁 {t.again}
        </button>
      )}
      <button style={{ background: 'transparent', color: th?.sub || '#888', border: `1px solid ${th?.border || '#333'}`, padding: '12px 28px', borderRadius: '50px', fontSize: '0.95rem', cursor: 'pointer', fontWeight: '600', width: '100%' }} onClick={onBack}>
        {t.finishDone}
      </button>
    </div></div>
  )
}

function SettingsScreen({ t, s, theme, onThemeChange, onBack, user, myData, setMyData, allCards, lang, onPartner, onLightModeChange, onCardSizeChange, musicEnabled, musicVolume, onMusicToggle, onMusicVolume }) {
  const th = THEMES[theme]
  const isDE = lang === 'de'
  const pausedLanguages = myData?.pausedLanguages || []
  const uniqueTargetLangs = [...new Set((allCards || []).map(c => c.targetLang).filter(Boolean))]
  const [premiumModal, setPremiumModal] = useState(false)

  // ── ZIELSPRACHEN MIT ANTEILEN ────────────────────────────────
  const initToLangs = () => {
    if (myData?.toLangs && myData.toLangs.length > 0) return myData.toLangs
    const raw = myData?.toLang
    if (Array.isArray(raw) && raw.length > 1) {
      const n = raw.length
      return raw.map((l, i) => ({ lang: l.toLowerCase(), percent: i === 0 ? Math.round(100 / n + (100 % n)) : Math.floor(100 / n) }))
    }
    return [{ lang: (Array.isArray(raw) ? raw[0] : raw || 'en').toLowerCase(), percent: 100 }]
  }
  const [toLangs, setToLangsLocal] = useState(initToLangs)

  const saveToLangs = async (updated) => {
    setToLangsLocal(updated)
    try {
      await updateDoc(doc(db, 'users', user.uid), { toLangs: updated })
      setMyData(d => ({ ...d, toLangs: updated }))
    } catch (e) { console.warn('saveToLangs failed:', e) }
  }

  const updatePercent = (langCode, newPct) => {
    const clamped = Math.max(10, Math.min(90, newPct))
    const others = toLangs.filter(l => l.lang !== langCode)
    if (others.length === 0) return
    const remaining = 100 - clamped
    const totalOther = others.reduce((s, l) => s + l.percent, 0)
    const updated = toLangs.map(l => {
      if (l.lang === langCode) return { ...l, percent: clamped }
      return { ...l, percent: totalOther > 0 ? Math.round(l.percent / totalOther * remaining) : Math.floor(remaining / others.length) }
    })
    const sum = updated.reduce((s, l) => s + l.percent, 0)
    if (sum !== 100) updated[updated.length - 1].percent += 100 - sum
    saveToLangs(updated)
  }

  const addToLang = (langCode) => {
    if (toLangs.find(l => l.lang === langCode)) return
    if (toLangs.length >= 3) return
    const newPct = 30
    const updated = [
      ...toLangs.map(l => ({ ...l, percent: Math.round(l.percent * (100 - newPct) / 100) })),
      { lang: langCode, percent: newPct }
    ]
    const sum = updated.reduce((s, l) => s + l.percent, 0)
    if (sum !== 100) updated[0].percent += 100 - sum
    saveToLangs(updated)
  }

  const removeToLang = (langCode) => {
    if (toLangs.length <= 1) return
    const removed = toLangs.find(l => l.lang === langCode)?.percent || 0
    const rest = toLangs.filter(l => l.lang !== langCode)
    const total = rest.reduce((s, l) => s + l.percent, 0)
    const updated = rest.map(l => ({ ...l, percent: Math.round(l.percent / total * 100) }))
    const sum = updated.reduce((s, l) => s + l.percent, 0)
    if (sum !== 100) updated[0].percent += 100 - sum
    saveToLangs(updated)
  }

  const togglePause = async (langCode) => {
    const newPaused = pausedLanguages.includes(langCode)
      ? pausedLanguages.filter(l => l !== langCode)
      : [...pausedLanguages, langCode]
    try {
      await updateDoc(doc(db, 'users', user.uid), { pausedLanguages: newPaused })
      setMyData(d => ({ ...d, pausedLanguages: newPaused }))
    } catch (e) { console.warn('Failed to save paused languages:', e) }
  }

  const currentMonth = new Date().toISOString().slice(0, 7)
  const freeze = myData?.streakFreeze || {}
  const freezeAvailable = freeze.lastReset !== currentMonth ? true : (freeze.available ?? false)
  const handleStreakFreeze = async () => {
    const update = { streakFreeze: { available: false, lastReset: currentMonth, usedAt: todayStr() } }
    try {
      await updateDoc(doc(db, 'users', user.uid), update)
      setMyData(d => ({ ...d, ...update }))
    } catch (e) { console.warn('Streak freeze failed:', e) }
  }

  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>← {t.back}</button>
      <h2 style={{ color: th.text, marginBottom: '20px', fontSize: '1.3rem' }}>⚙️ {t.settingsTitle}</h2>

      {/* ── THEME ── */}
      <div style={s.card}>
        <p style={s.cardLabel}>{t.chooseTheme}</p>
        <div style={s.themeRow}>
          {Object.entries(THEMES).map(([key, thm]) => (
            <button key={key} style={s.themeBtn(theme === key, thm.accent)} onClick={() => onThemeChange(key)}>{thm.name}</button>
          ))}
        </div>
      </div>

      {/* ── MUSIK ── */}
      {onMusicToggle && (
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ ...s.cardLabel, margin: 0 }}>🎵 {t.music}</p>
            <span style={{ background: `${th.gold}18`, color: th.sub, border: `1px solid ${th.border}`, borderRadius: '20px', padding: '3px 12px', fontSize: '0.75rem', opacity: 0.7 }}>
              {isDE ? 'Kommt bald' : 'Coming soon'}
            </span>
          </div>
          <p style={{ color: th.sub, fontSize: '0.72rem', margin: '6px 0 0', opacity: 0.6 }}>
            {isDE ? 'Hintergrundmusik wird in einem kommenden Update verfügbar.' : 'Background music will be available in an upcoming update.'}
          </p>
        </div>
      )}

      {/* ── TAGESZIEL ── */}
      <div style={s.card}>
        <p style={{ ...s.cardLabel, marginBottom: '12px' }}>{t.dailyGoalLabel}</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[5, 10, 15, 20].map(n => (
            <button key={n}
              onClick={async () => { await updateDoc(doc(db, 'users', user.uid), { dailyGoal: n }); setMyData(d => ({ ...d, dailyGoal: n })) }}
              style={{ flex: 1, padding: '10px 0', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem', background: (myData?.dailyGoal || 10) === n ? th.accent : 'transparent', color: (myData?.dailyGoal || 10) === n ? (th.btnTextColor || '#111') : th.sub, border: `1px solid ${(myData?.dailyGoal || 10) === n ? th.accent : th.border}` }}
            >{n}</button>
          ))}
        </div>
        <p style={{ color: th.sub, fontSize: '0.72rem', marginTop: '7px', marginBottom: 0 }}>{t.cardsPerDay}</p>
      </div>

      {/* ── SPRACHE PAUSIEREN ── */}
      {uniqueTargetLangs.length > 0 && (
        <div style={s.card}>
          <p style={{ ...s.cardLabel, marginBottom: '14px' }}>{t.languagesLabel}</p>
          {uniqueTargetLangs.map(langCode => {
            const info = AVAILABLE_LANGS.find(l => l.code === langCode)
            const paused = pausedLanguages.includes(langCode)
            return (
              <div key={langCode} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ color: th.text, fontSize: '1rem' }}>{info?.flag} {info?.label || langCode}</span>
                <button onClick={() => togglePause(langCode)}
                  style={{ background: paused ? 'transparent' : th.accent, color: paused ? th.sub : (th.btnTextColor || '#111'), border: `1px solid ${paused ? th.border : th.accent}`, borderRadius: '20px', padding: '5px 14px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}>
                  {paused ? t.paused : t.active}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── ZIELSPRACHEN ANTEILE ── */}
      <div style={s.card}>
        <p style={{ ...s.cardLabel, marginBottom: '14px' }}>{t.learnLanguages}</p>
        {toLangs.map(({ lang: lc, percent }) => {
          const info = AVAILABLE_LANGS.find(l => l.code === lc) || { flag: '🌐', label: lc.toUpperCase() }
          return (
            <div key={lc} style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ color: th.text, fontSize: '0.9rem' }}>{info.flag} {info.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: th.gold, fontWeight: '700', fontSize: '0.85rem', minWidth: '36px', textAlign: 'right' }}>{percent}%</span>
                  {toLangs.length > 1 && (
                    <button onClick={() => removeToLang(lc)} style={{ background: 'transparent', border: 'none', color: th.sub, fontSize: '0.85rem', cursor: 'pointer', padding: '2px 4px', opacity: 0.6 }}>✕</button>
                  )}
                </div>
              </div>
              {toLangs.length > 1 && (
                <input type="range" min="10" max="90" step="5" value={percent}
                  onChange={e => updatePercent(lc, parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: th.accent, cursor: 'pointer' }}
                />
              )}
            </div>
          )
        })}
        {toLangs.length < 3 && (
          <div style={{ marginTop: '8px' }}>
            <p style={{ color: th.sub, fontSize: '0.72rem', marginBottom: '8px' }}>{t.addLanguage}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {AVAILABLE_LANGS.filter(l => !toLangs.find(t => t.lang === l.code)).map(l => (
                <button key={l.code} onClick={() => addToLang(l.code)}
                  style={{ background: 'transparent', border: `1px solid ${th.border}`, borderRadius: '16px', padding: '4px 10px', color: th.sub, fontSize: '0.75rem', cursor: 'pointer' }}>
                  {l.flag} {l.code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── DARK/LIGHT MODE ── */}
      {(() => {
        const { lightMode } = React.useContext(AppPrefsContext)
        return (
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ ...s.cardLabel, marginBottom: '2px' }}>☀️ Dark / Light Mode</p>
                <p style={{ color: th.sub, fontSize: '0.75rem', margin: 0 }}>{lightMode ? t.lightModeLabel : t.darkModeLabel}</p>
              </div>
              <button onClick={() => onLightModeChange && onLightModeChange(!lightMode)}
                style={{ background: lightMode ? th.accent : 'rgba(255,255,255,0.08)', border: `1px solid ${lightMode ? th.accent : th.border}`, borderRadius: '22px', width: '52px', height: '28px', cursor: 'pointer', position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}>
                <span style={{ position: 'absolute', top: '3px', left: lightMode ? '27px' : '3px', width: '22px', height: '22px', borderRadius: '50%', background: lightMode ? '#fff' : th.sub, transition: 'left 0.2s', display: 'block' }} />
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── KARTENGRÖSSE ── */}
      {(() => {
        const { cardSize } = React.useContext(AppPrefsContext)
        const sizes = [{ key: 'small', labelDE: 'Klein', labelEN: 'Small' }, { key: 'normal', labelDE: 'Normal', labelEN: 'Normal' }, { key: 'large', labelDE: 'Groß', labelEN: 'Large' }]
        return (
          <div style={s.card}>
            <p style={{ ...s.cardLabel, marginBottom: '12px' }}>{t.cardSizeLabel}</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {sizes.map(sz => (
                <button key={sz.key} onClick={() => onCardSizeChange && onCardSizeChange(sz.key)}
                  style={{ flex: 1, padding: '9px 0', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem', background: cardSize === sz.key ? th.accent : 'transparent', color: cardSize === sz.key ? (th.btnTextColor || '#111') : th.sub, border: `1px solid ${cardSize === sz.key ? th.accent : th.border}`, transition: 'all 0.2s' }}>
                  {lang === 'de' ? sz.labelDE : sz.labelEN}
                </button>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── STREAK FREEZE ── */}
      <div style={s.card}>
        <p style={{ ...s.cardLabel, marginBottom: '12px' }}>🧊 {t.streakProtection}</p>
        {(() => {
          const sfIsPremium = (user.uid === MARK_UID || user.uid === ELOSY_UID) || (myData?.plan && myData.plan !== 'free')
          if (!sfIsPremium) return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: th.sub, fontSize: '0.85rem', flex: 1 }}>{t.streakFree0}</span>
              <span style={{ background: `${th.gold}18`, color: th.gold, border: `1px solid ${th.gold}44`, borderRadius: '20px', padding: '2px 10px', fontSize: '0.7rem', fontWeight: '700', whiteSpace: 'nowrap' }}>Premium</span>
            </div>
          )
          const isAvail = freezeAvailable || (freeze.lastReset !== currentMonth)
          return (
            <>
              <p style={{ color: th.text, fontSize: '0.9rem', marginBottom: '8px' }}>
                {t.freezeAvailThis} <strong style={{ color: isAvail ? '#4CAF50' : th.sub }}>{isAvail ? '1x ✓' : t.freezeUsed}</strong>
              </p>
              {isAvail && (
                <button onClick={() => { if (window.confirm(lang === 'de' ? 'Streak Freeze jetzt verwenden? (1x pro Monat)' : 'Use Streak Freeze now? (1x/month)')) handleStreakFreeze() }}
                  style={{ ...s.logoutBtn, marginTop: 0, color: '#81c784', border: '1px solid rgba(76,175,80,0.35)' }}>
                  🧊 {t.freezeActivate}
                </button>
              )}
              {freeze.usedAt && !isAvail && <p style={{ color: th.sub, fontSize: '0.75rem', marginTop: '4px' }}>{lang === 'de' ? `Verwendet am ${freeze.usedAt}` : `Used on ${freeze.usedAt}`}</p>}
            </>
          )
        })()}
      </div>

      {/* ── SOZIALES REGISTER ── */}
      <div style={s.card}>
        <p style={{ ...s.cardLabel, marginBottom: '12px' }}>🗣 {t.socialRegisterLabel}</p>
        <p style={{ color: th.sub, fontSize: '0.75rem', marginBottom: '8px' }}>{t.socialRegisterNote}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {SOCIAL_REGISTERS.map(r => {
            const active = (myData?.socialRegister || 'friends') === r.key
            return (
              <button key={r.key} onClick={async () => {
                await updateDoc(doc(db, 'users', user.uid), { socialRegister: r.key }).catch(() => {})
                setMyData(d => ({ ...d, socialRegister: r.key }))
              }} style={{ padding: '7px 12px', borderRadius: '20px', fontSize: '0.82rem', cursor: 'pointer', fontWeight: active ? '700' : '400', background: active ? th.accent : 'transparent', color: active ? (th.btnTextColor || '#111') : th.sub, border: `1px solid ${active ? th.accent : th.border}`, WebkitTapHighlightColor: 'transparent' }}>
                {r.emoji} {lang === 'de' ? r.labelDe : r.labelEn}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── BEZIEHUNGSTYP ── */}
      <div style={s.card}>
        <p style={{ ...s.cardLabel, marginBottom: '8px' }}>❤️ {t.relationshipType}</p>
        <p style={{ color: th.sub, fontSize: '0.75rem', marginBottom: '8px' }}>{t.relationshipNote}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {[{ key:'couple',labelDe:'Paar',labelEn:'Couple',emoji:'💑' },{ key:'friends',labelDe:'Freunde',labelEn:'Friends',emoji:'👫' },{ key:'family',labelDe:'Familie',labelEn:'Family',emoji:'👨‍👩‍👧' },{ key:'colleagues',labelDe:'Kollegen',labelEn:'Colleagues',emoji:'👔' }].map(r => {
            const active = (myData?.relationshipType || 'couple') === r.key
            return (
              <button key={r.key} onClick={async () => {
                await updateDoc(doc(db, 'users', user.uid), { relationshipType: r.key }).catch(() => {})
                setMyData(d => ({ ...d, relationshipType: r.key }))
              }} style={{ padding: '7px 12px', borderRadius: '20px', fontSize: '0.82rem', cursor: 'pointer', fontWeight: active ? '700' : '400', background: active ? `${th.gold}22` : 'transparent', color: active ? th.gold : th.sub, border: `1px solid ${active ? th.gold : th.border}`, WebkitTapHighlightColor: 'transparent' }}>
                {r.emoji} {isDE ? r.labelDe : r.labelEn}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── PARTNER VERBINDEN ── */}
      <button style={{ ...s.card, cursor: 'pointer', width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={onPartner}>
        <span style={{ color: th.text, fontSize: '0.9rem' }}>🤝 {t.partnerTitle}</span>
        <span style={{ color: th.sub }}>→</span>
      </button>

      {/* ── SPRACHE EINSTELLEN (REQUIRED) ── */}
      {(() => {
        const currentFromLang = (myData?.fromLang || '').toLowerCase()
        const currentToLang = (Array.isArray(myData?.toLang) ? myData.toLang[0] : (myData?.toLang || '')).toLowerCase()
        const missingToLang = !currentToLang
        const saveLangs = async (newFrom, newTo) => {
          try {
            await updateDoc(doc(db, 'users', user.uid), { fromLang: newFrom, toLang: newTo })
            setMyData(d => ({ ...d, fromLang: newFrom, toLang: newTo }))
          } catch (e) { console.warn('saveLangs failed:', e) }
        }
        return (
          <div style={{ ...s.card, border: missingToLang ? `1px solid rgba(255,152,0,0.5)` : undefined }}>
            {missingToLang && (
              <p style={{ color: '#ff9800', fontSize: '0.78rem', marginBottom: '10px', fontWeight: '600' }}>
                ⚠️ {isDE ? 'Bitte lege deine Zielsprache fest — TTS und Mikrofon benötigen diese Information.' : 'Please set your target language — TTS and microphone require this.'}
              </p>
            )}
            <p style={{ ...s.cardLabel, marginBottom: '14px' }}>🗣 {isDE ? 'Meine Sprachen' : 'My languages'}</p>
            <p style={{ color: th.sub, fontSize: '0.75rem', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {isDE ? 'Meine Sprache (Ausgangssprache):' : 'My language (native):'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
              {AVAILABLE_LANGS.map(l => (
                <button key={l.code} onClick={() => saveLangs(l.code, currentToLang || '')}
                  style={{ padding: '6px 12px', borderRadius: '10px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: currentFromLang === l.code ? '700' : '400', background: currentFromLang === l.code ? th.accent : 'transparent', color: currentFromLang === l.code ? (th.btnTextColor || '#111') : th.sub, border: `1px solid ${currentFromLang === l.code ? th.accent : th.border}`, transition: 'all 0.2s' }}>
                  {l.flag} {isDE ? l.label : l.label}
                </button>
              ))}
            </div>
            <p style={{ color: th.sub, fontSize: '0.75rem', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {isDE ? 'Ich lerne (Zielsprache):' : 'I am learning (target language):'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {AVAILABLE_LANGS.filter(l => l.code !== currentFromLang).map(l => (
                <button key={l.code} onClick={() => saveLangs(currentFromLang || 'de', l.code)}
                  style={{ padding: '6px 12px', borderRadius: '10px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: currentToLang === l.code ? '700' : '400', background: currentToLang === l.code ? th.gold + '33' : 'transparent', color: currentToLang === l.code ? th.gold : th.sub, border: `1px solid ${currentToLang === l.code ? th.gold + '88' : th.border}`, transition: 'all 0.2s' }}>
                  {l.flag} {isDE ? l.label : l.label}
                </button>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── WEITERE SPRACHEN (PREMIUM) ── */}
      <div style={s.card}>
        <p style={{ ...s.cardLabel, marginBottom: '12px' }}>🌍 {isDE ? 'Weitere Sprachen' : 'More languages'}</p>
        <button onClick={() => setPremiumModal(true)}
          style={{ width: '100%', background: `${th.gold}0E`, border: `1px solid ${th.gold}33`, borderRadius: '12px', padding: '12px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: th.text, fontSize: '0.88rem' }}>🔒 {isDE ? 'Hauptsprache · Weitere Sprache' : 'Main language · More language'}</span>
          <span style={{ background: `${th.gold}18`, color: th.gold, border: `1px solid ${th.gold}44`, borderRadius: '12px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: '700', flexShrink: 0, marginLeft: '8px' }}>Premium</span>
        </button>
      </div>

      {/* ── PUSH NOTIFICATIONS (#9) ── */}
      {(() => {
        const times = ['off', '08:00', '12:00', '18:00', '20:00']
        const currentTime = myData?.notificationTime || 'off'
        const hasSupport = 'Notification' in window
        return (
          <div style={s.card}>
            <p style={{ ...s.cardLabel, marginBottom: '12px' }}>🔔 {isDE ? 'Tägliche Erinnerung' : 'Daily reminder'}</p>
            {!hasSupport ? (
              <p style={{ color: th.sub, fontSize: '0.8rem' }}>{isDE ? 'Nicht unterstützt in diesem Browser' : 'Not supported in this browser'}</p>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  {times.map(t => (
                    <button key={t} onClick={async () => {
                      if (t !== 'off' && Notification.permission === 'default') {
                        const perm = await Notification.requestPermission()
                        if (perm !== 'granted') return
                      }
                      const updated = { ...myData, notificationTime: t }
                      setMyData(updated)
                      await updateDoc(doc(db, 'users', user.uid), { notificationTime: t })
                    }}
                      style={{ padding: '6px 12px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.78rem', background: currentTime === t ? th.accent : 'transparent', color: currentTime === t ? (th.btnTextColor || '#111') : th.sub, border: `1px solid ${currentTime === t ? th.accent : th.border}`, transition: 'all 0.2s' }}>
                      {t === 'off' ? (isDE ? 'Aus' : 'Off') : t}
                    </button>
                  ))}
                </div>
                {Notification.permission === 'granted' && currentTime !== 'off' && (
                  <p style={{ color: '#4CAF50', fontSize: '0.72rem', margin: 0 }}>✓ {isDE ? `Erinnerung um ${currentTime} Uhr` : `Reminder at ${currentTime}`}</p>
                )}
                {Notification.permission === 'denied' && (
                  <p style={{ color: '#e06c75', fontSize: '0.72rem', margin: 0 }}>{isDE ? 'Benachrichtigungen blockiert — bitte in Browser-Einstellungen erlauben' : 'Notifications blocked — enable in browser settings'}</p>
                )}
              </>
            )}
          </div>
        )
      })()}

      {/* ── GIMMIK ÜBERSICHT ── */}
      <div style={s.card}>
        <p style={{ ...s.cardLabel, marginBottom: '12px' }}>🎁 {isDE ? 'Meine Gimmiks' : 'My Gimmicks'}</p>
        {(() => {
          const total = myData?.unlockedGimmicks || 0
          const history = myData?.gimmickHistory || []
          const themeNames = { nairobi: '🌙 Nairobi', hamburg: '⚓ Hamburg', welt: '🌍 Welt' }
          if (total === 0) return <p style={{ color: th.sub, fontSize: '0.82rem', margin: 0 }}>{isDE ? 'Noch keine Gimmiks freigeschaltet.' : 'No gimmicks unlocked yet.'}</p>
          return (
            <>
              <p style={{ color: th.text, fontSize: '0.88rem', marginBottom: '10px' }}>{total} {isDE ? `Gimmik${total !== 1 ? 's' : ''} freigeschaltet` : `gimmick${total !== 1 ? 's' : ''} unlocked`}</p>
              {Object.entries(themeNames).map(([key, name]) => {
                const count = history.filter(g => g.theme === key).length
                if (count === 0) return null
                return (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: th.text, fontSize: '0.82rem' }}>{name}</span>
                    <span style={{ color: th.gold, fontSize: '0.82rem', fontWeight: '700' }}>{'⭐'.repeat(count)}</span>
                  </div>
                )
              })}
            </>
          )
        })()}
      </div>

      {/* ── AUSGESCHLOSSENE KARTEN ── */}
      {(() => {
        const excludedMap = myData?.excludedCards || {}
        const excludedIds = Object.keys(excludedMap)
        if (excludedIds.length === 0) return null
        return (
          <div style={s.card}>
            <p style={{ ...s.cardLabel, marginBottom: '10px' }}>🚫 {isDE ? `Ausgeschlossene Karten (${excludedIds.length})` : `Hidden cards (${excludedIds.length})`}</p>
            {excludedIds.slice(0, 10).map(id => {
              const card = (allCards || []).find(c => c.id === id)
              if (!card) return null
              return (
                <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${th.border}` }}>
                  <span style={{ color: th.text, fontSize: '0.82rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>„{card.front}"</span>
                  <button style={{ background: 'transparent', border: `1px solid ${th.border}`, borderRadius: '8px', padding: '3px 10px', color: th.sub, fontSize: '0.72rem', cursor: 'pointer', flexShrink: 0, marginLeft: '8px' }} onClick={async () => {
                    const updated = { ...excludedMap }
                    delete updated[id]
                    try {
                      await updateDoc(doc(db, 'users', user.uid), { excludedCards: updated })
                      setMyData(d => ({ ...d, excludedCards: updated }))
                    } catch(e) {}
                  }}>
                    {isDE ? 'Wiederherstellen' : 'Restore'}
                  </button>
                </div>
              )
            })}
            {excludedIds.length > 10 && <p style={{ color: th.sub, fontSize: '0.72rem', marginTop: '6px', opacity: 0.6 }}>+{excludedIds.length - 10} {isDE ? 'weitere' : 'more'}</p>}
          </div>
        )
      })()}

      {/* ── MEINE THEMEN ── */}
      {(() => {
        const unlockedTopics = myData?.unlockedTopics || []
        const myMasteredTotal = Object.values(myData?.cardProgress || {}).filter(p => (p?.interval || 0) >= 7).length
        const canUnlock = (user.uid === MARK_UID || user.uid === ELOSY_UID) || myMasteredTotal >= 5
        const [generatingTopic, setGeneratingTopic] = React.useState(null)
        const generateTopicCards = async (topic) => {
          setGeneratingTopic(topic.key)
          const langA = isDE ? 'en' : 'de'
          const langB = isDE ? 'de' : 'en'
          const fromLang = isDE ? 'German' : 'English'
          const toLang = isDE ? 'English' : 'German'
          try {
            const res = await fetch('/api/chat', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 700, system: CARD_GEN_SYSTEM,
                messages: [{ role: 'user', content: `Generate 15 useful vocabulary cards about "${topic.de}" (${topic.en}) for a ${fromLang} speaker learning ${toLang}. Mix words and short phrases. Return ONLY JSON: [{"front":"${toLang} word","back":"${fromLang} translation","category":"vocabulary","tense":"present","wordType":"Noun|Verb|Adjective|Phrase","article":""}]` }]
              })
            })
            const raw = ((await res.json()).content?.[0]?.text || '[]').trim()
            const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
            const ts = Date.now()
            const newCards = parsed.slice(0, 15).map((c, i) => ({ id: `topic_${topic.key}_${ts}_${i}`, front: c.front?.trim(), back: c.back?.trim(), category: 'vocabulary', tense: 'present', wordType: c.wordType || null, article: c.article || null, langA, langB, source: `topic-${topic.key}`, topic: topic.key, createdAt: ts })).filter(c => c.front && c.back)
            const updatedCards = [...(myData?.aiCards || []), ...newCards]
            const updatedTopics = [...new Set([...unlockedTopics, topic.key])]
            await updateDoc(doc(db, 'users', user.uid), { aiCards: updatedCards, unlockedTopics: updatedTopics })
            setMyData(d => ({ ...d, aiCards: updatedCards, unlockedTopics: updatedTopics }))
          } catch(e) { console.warn('topic generate failed:', e) }
          setGeneratingTopic(null)
        }
        return (
          <div style={s.card}>
            <p style={{ ...s.cardLabel, marginBottom: '12px' }}>🎯 {isDE ? 'Meine Themen' : 'My Topics'}</p>
            <p style={{ color: th.sub, fontSize: '0.75rem', marginBottom: '12px', lineHeight: 1.4 }}>
              {isDE ? 'Themen freispielen und 15 Karten generieren lassen.' : 'Unlock topics and generate 15 cards each.'}
              {!canUnlock && <span style={{ color: th.gold, display: 'block', marginTop: '4px' }}>{isDE ? '⭐ Premium oder 5+ gemeisterte Karten nötig.' : '⭐ Premium or 5+ mastered cards required.'}</span>}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {TOPICS_LIST.map(topic => {
                const isUnlocked = unlockedTopics.includes(topic.key)
                const isGenerating = generatingTopic === topic.key
                return (
                  <button key={topic.key} disabled={!canUnlock || isGenerating} onClick={() => !isUnlocked ? generateTopicCards(topic) : null}
                    style={{ padding: '8px 12px', borderRadius: '12px', fontSize: '0.82rem', cursor: canUnlock && !isUnlocked ? 'pointer' : 'default', fontWeight: isUnlocked ? '700' : '400', background: isUnlocked ? `${th.gold}18` : canUnlock ? `${th.card}` : 'transparent', color: isUnlocked ? th.gold : canUnlock ? th.text : th.sub, border: `1px solid ${isUnlocked ? th.gold + '55' : canUnlock ? th.border : 'rgba(255,255,255,0.08)'}`, opacity: !canUnlock && !isUnlocked ? 0.45 : 1, transition: 'all 0.2s' }}>
                    {isGenerating ? '…' : isUnlocked ? '✓ ' : canUnlock ? '' : ''}{isDE ? topic.de : topic.en}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── ABMELDEN ── */}
      <button style={{ ...s.logoutBtn, marginTop: '8px', color: '#e06c75', border: '1px solid rgba(224,108,117,0.35)' }}
        onClick={() => { if (window.confirm(isDE ? 'Wirklich abmelden?' : 'Sign out?')) signOut(auth) }}>
        {isDE ? 'Abmelden' : 'Sign out'}
      </button>

      {/* ── VERSION ── */}
      <p style={{ color: th.sub, fontSize: '0.62rem', opacity: 0.35, textAlign: 'center', margin: '12px 0 0', letterSpacing: '0.5px' }}>{APP_VERSION}</p>

      {/* ── PREMIUM MODAL ── */}
      {premiumModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(6px)' }}
          onClick={() => setPremiumModal(false)}>
          <div style={{ background: th.card, border: `1px solid ${th.gold}44`, borderRadius: '24px', padding: '28px 24px', maxWidth: '340px', width: '100%', textAlign: 'center', boxShadow: `0 0 40px ${th.gold}22`, animation: 'vocaraFadeIn 0.3s ease both' }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: '2rem', margin: '0 0 10px' }}>🌍</p>
            <p style={{ color: th.text, fontWeight: '700', fontSize: '1.1rem', marginBottom: '8px' }}>{isDE ? 'Mehr Sprachen mit Premium' : 'More languages with Premium'}</p>
            <p style={{ color: th.sub, fontSize: '0.88rem', marginBottom: '20px', lineHeight: 1.5 }}>
              {isDE ? 'Mit Premium kannst du Spanisch, Französisch, Thai und mehr lernen.' : 'With Premium you can learn Spanish, French, Thai and more.'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
              {['🇪🇸 Español', '🇫🇷 Français', '🇹🇭 ภาษาไทย', '🇵🇹 Português', '🇹🇷 Türkçe'].map(l => (
                <span key={l} style={{ background: `${th.gold}12`, color: th.text, border: `1px solid ${th.gold}33`, borderRadius: '20px', padding: '4px 12px', fontSize: '0.82rem' }}>{l}</span>
              ))}
            </div>
            <button style={{ ...s.button, marginBottom: '8px', background: `linear-gradient(135deg, ${th.gold}40, ${th.gold}20)`, color: th.text, border: `1px solid ${th.gold}66` }}>
              ✨ {isDE ? 'Premium freischalten' : 'Unlock Premium'}
            </button>
            <button onClick={() => setPremiumModal(false)} style={{ background: 'transparent', border: 'none', color: th.sub, cursor: 'pointer', fontSize: '0.82rem', padding: '4px 8px' }}>
              {isDE ? 'Schließen' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div></div>
  )
}

function StatRow({ label, mastered, active, total, s }) {
  const pct = active > 0 ? Math.round((mastered / active) * 100) : 0
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={s.langRow}>
        <span style={{ ...s.lang, fontSize: '0.9rem' }}>{label}</span>
        <span style={{ ...s.langPct, fontSize: '0.8rem' }}>{mastered}/{active} ✓ · {active}/{total}</span>
      </div>
      <div style={s.progressBar}><div style={{ ...s.progressFill, width: `${pct}%` }} /></div>
    </div>
  )
}

function StatsScreen({ user, myData, partnerData, allCards, lang, theme, onBack, cardProgress, t: tProp }) {
  const th = THEMES[theme]; const s = makeStyles(th); const t = tProp || T[lang] || T.en
  const today = todayStr()
  const tom = new Date(); tom.setDate(tom.getDate() + 1)
  const tomorrow = tom.toISOString().slice(0, 10)

  const sessionHistory = myData?.sessionHistory || []
  const todayCorrect = sessionHistory.filter(h => h.date === today).reduce((a, b) => a + (b.correct || 0), 0)
  const todaySessions = sessionHistory.filter(h => h.date === today).length
  const myStreak = calcStreak(sessionHistory)
  const totalCards = allCards.filter(c => !/_r(_\d+)?$/.test(c.id)).length
  const dueTomorrow = Object.values(cardProgress).filter(p => p.nextReview === tomorrow).length
  const myMastered = Object.values(cardProgress).filter(p => (p?.interval || 0) >= 7).length

  const partnerHistory = partnerData?.sessionHistory || []
  const partnerStreak = partnerData?.streak ?? calcStreak(partnerHistory)
  const partnerTodayCorrect = partnerHistory.filter(h => h.date === today).reduce((a, b) => a + (b.correct || 0), 0)
  const partnerTodaySessions = partnerHistory.filter(h => h.date === today).length
  const partnerProgress = partnerData?.cardProgress || {}
  const partnerMastered = partnerData?.masteredCards ?? Object.values(partnerProgress).filter(p => (p?.interval || 0) >= 7).length
  const partnerActive = partnerData?.totalCards ?? Object.keys(partnerProgress).length

  // Extended comparison stats
  const myTotalLearned = sessionHistory.reduce((a, b) => a + (b.correct || 0), 0)
  const partnerTotalLearned = partnerHistory.reduce((a, b) => a + (b.correct || 0), 0)
  const myLearningDays = new Set(sessionHistory.map(h => h.date)).size
  const partnerLearningDays = new Set(partnerHistory.map(h => h.date)).size
  const myLongestStreak = calcLongestStreak(sessionHistory)
  const partnerLongestStreak = calcLongestStreak(partnerHistory)
  const currentWeekStr = getISOWeekStr()
  const weekFilter = (h) => getISOWeekStr(new Date(...h.date.split('-').map((v, i) => i === 1 ? v - 1 : +v))) === currentWeekStr
  const myWeekSessions = sessionHistory.filter(weekFilter).length
  const partnerWeekSessions = partnerHistory.filter(weekFilter).length
  const myWeekLearnSec = sessionHistory.filter(weekFilter).reduce((a, b) => a + (b.total || 0) * 15, 0)
  const partnerWeekLearnSec = partnerHistory.filter(weekFilter).reduce((a, b) => a + (b.total || 0) * 15, 0)
  const fmtMin = (s) => s < 60 ? `${s}s` : `${Math.round(s / 60)} min`
  const AREA_LABEL_MAP = { vocabulary: lang === 'de' ? 'Worte' : 'Words', sentence: lang === 'de' ? 'Sätze' : 'Sentences', street: lang === 'de' ? 'Straße' : 'Street', home: lang === 'de' ? 'Zuhause' : 'Home', basics: lang === 'de' ? 'Grundlagen' : 'Basics', urlaub: lang === 'de' ? '✈️ Urlaub' : '✈️ Travel' }
  const getFavArea = (progress) => {
    const counts = {}
    Object.keys(progress).forEach(id => {
      const card = allCards.find(c => c.id === id)
      if (card?.category) counts[card.category] = (counts[card.category] || 0) + 1
    })
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    return top ? (AREA_LABEL_MAP[top[0]] || top[0]) : '—'
  }
  const getWeeklyFavArea = (history) => {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
    const weekStr = weekAgo.toISOString().slice(0, 10)
    const counts = {}
    history.filter(h => h.date >= weekStr && h.area).forEach(h => {
      counts[h.area] = (counts[h.area] || 0) + 1
    })
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    return top ? (AREA_LABEL_MAP[top[0]] || top[0]) : null
  }
  const myFavArea = getFavArea(cardProgress)
  const partnerFavArea = getFavArea(partnerProgress)
  const myWeeklyFavArea = getWeeklyFavArea(sessionHistory)
  const partnerWeeklyFavArea = getWeeklyFavArea(partnerHistory)

  const myName = myData?.name?.split(' ')[0] || user.displayName?.split(' ')[0] || 'Ich'
  const partnerName = myData?.partnerName || partnerData?.name?.split(' ')[0] || 'Partner'
  const hasPartner = !!myData?.partnerUID || !!partnerData

  const statBox = (label, value, sub) => (
    <div style={{ flex: 1, background: th.card, borderRadius: '14px', padding: '16px 12px', border: `1px solid ${th.border}`, textAlign: 'center' }}>
      <p style={{ color: th.gold, fontSize: '1.8rem', fontWeight: '900', margin: 0, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ color: th.accent, fontSize: '0.72rem', margin: '2px 0 4px', fontWeight: '600' }}>{sub}</p>}
      <p style={{ color: th.sub, fontSize: '0.72rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
    </div>
  )

  const compRow = (label, myVal, partnerVal) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${th.border}` }}>
      <span style={{ color: th.text, fontWeight: '600', fontSize: '0.85rem', minWidth: '60px', textAlign: 'center' }}>{myVal}</span>
      <span style={{ color: th.sub, fontSize: '0.75rem', flex: 1, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      <span style={{ color: th.text, fontWeight: '600', fontSize: '0.85rem', minWidth: '60px', textAlign: 'center' }}>{partnerVal}</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', minHeight: '100dvh', width: '100%', background: th.bgGrad, backgroundColor: th.bg, display: 'flex', flexDirection: 'column', alignItems: 'center' }} className="vocara-screen">
      {/* ── FIXED BACK BAR ── */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: th.bg, borderBottom: `1px solid ${th.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', minHeight: '52px' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: th.accent, cursor: 'pointer', fontSize: '1.1rem', fontWeight: '700', padding: '12px 8px 12px 0', display: 'flex', alignItems: 'center', gap: '6px', WebkitTapHighlightColor: 'transparent' }}
        >
          ← {t.back}
        </button>
        <span style={{ color: th.text, fontWeight: '600', fontSize: '1rem', marginLeft: '8px' }}>
          {t.statistics}
        </span>
      </div>
      <div style={{ ...s.homeBox, paddingTop: '68px' }}>

      {/* ── TOP STATS GRID ── */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
        {statBox(t.learnedToday, todayCorrect, `${todaySessions} Session${todaySessions !== 1 ? 's' : ''}`)}
        {statBox('Streak', myStreak > 0 ? `🔥 ${myStreak}` : '—', t.statDays)}
      </div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {statBox(t.totalCards, totalCards, `${myMastered} ✓`)}
        {statBox(t.dueTomorrow, dueTomorrow, '')}
      </div>

      {/* ── LERNZEIT ── */}
      {(() => {
        const nowMonth = new Date().toISOString().slice(0, 7)
        const nowWeek = getISOWeekStr()
        const wMin = myData?.learningWeek === nowWeek ? (myData?.weeklyMinutes || 0) : 0
        const mMin = myData?.learningMonth === nowMonth ? (myData?.monthlyMinutes || 0) : 0
        const tMin = myData?.totalMinutes || 0
        if (tMin === 0) return null
        return (
          <div style={{ ...s.card, marginBottom: '12px' }}>
            <p style={{ ...s.cardLabel, marginBottom: '10px' }}>{t.studyTime}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {[
                [t.week, wMin],
                [t.month, mMin],
                [t.total, tMin],
              ].map(([label, min]) => (
                <div key={label} style={{ textAlign: 'center', flex: 1 }}>
                  <p style={{ color: th.gold, fontSize: '1.3rem', fontWeight: '700', margin: '0 0 2px', lineHeight: 1 }}>{min < 60 ? `${min}m` : `${Math.round(min/60)}h`}</p>
                  <p style={{ color: th.sub, fontSize: '0.68rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── 7-DAY CHART ── */}
      <div style={{ ...s.card, marginBottom: '16px' }}>
        <StreakWidget history={sessionHistory} th={th} t={t} />
      </div>

      {/* ── LIEBLINGSBEREICH solo (#29) ── */}
      {!hasPartner && (myFavArea !== '—' || myWeeklyFavArea) && (
        <div style={{ ...s.card, marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            {myFavArea !== '—' && (
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, color: th.sub, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🔥 {t.favArea}</p>
                <p style={{ margin: '3px 0 0', color: th.text, fontWeight: '700', fontSize: '0.95rem' }}>{myFavArea}</p>
              </div>
            )}
            {myWeeklyFavArea && (
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, color: th.sub, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📅 {lang === 'de' ? 'Diese Woche' : 'This week'}</p>
                <p style={{ margin: '3px 0 0', color: th.accent, fontWeight: '700', fontSize: '0.95rem' }}>{myWeeklyFavArea}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ZEITFORMEN FORTSCHRITT ── */}
      {(() => {
        const unlocks = getTenseUnlocks(myMastered)
        const unlockedTenses = Object.entries(unlocks).filter(([, v]) => v).map(([k]) => k)
        const nextTense = !unlocks.past ? 'past' : !unlocks.future ? 'future' : null
        return (
          <div style={{ ...s.card, marginBottom: '16px' }}>
            <p style={{ ...s.cardLabel, marginBottom: '10px' }}>{t.tenseLevel}</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: nextTense ? '10px' : 0 }}>
              {['present','past','future'].map(tn => {
                const tl = TENSE_LABELS[tn]; const on = unlocks[tn]
                return (
                  <div key={tn} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: '10px', background: on ? `${th.accent}20` : th.border, border: `1px solid ${on ? th.accent : 'transparent'}`, opacity: on ? 1 : 0.4 }}>
                    <div style={{ fontSize: '1.2rem' }}>{tl.emoji}</div>
                    <div style={{ color: on ? th.accent : th.sub, fontSize: '0.7rem', fontWeight: '600', marginTop: '2px' }}>{lang === 'de' ? tl.de : tl.en}</div>
                  </div>
                )
              })}
            </div>
            {nextTense && (() => {
              const threshold = nextTense === 'past' ? TENSE_THRESHOLDS.past : TENSE_THRESHOLDS.future
              const prev = nextTense === 'past' ? 0 : TENSE_THRESHOLDS.past
              const pct = Math.min(100, Math.round(((myMastered - prev) / (threshold - prev)) * 100))
              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: th.sub, fontSize: '0.72rem' }}>{lang === 'de' ? `→ ${TENSE_LABELS[nextTense].de} freischalten` : `→ Unlock ${TENSE_LABELS[nextTense].en}`}</span>
                    <span style={{ color: th.sub, fontSize: '0.72rem' }}>{myMastered}/{threshold}</span>
                  </div>
                  <div style={{ height: '5px', background: th.border, borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: th.accent, borderRadius: '4px', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              )
            })()}
          </div>
        )
      })()}

      {/* ── REAKTIONSZEIT & KARTEN-RECORDS ── */}
      {(() => {
        const entries = Object.entries(cardProgress)
        const withReaction = entries.filter(([, p]) => p?._lastReactionMs > 0)
        if (withReaction.length === 0) return null
        const fastest = withReaction.sort((a, b) => a[1]._lastReactionMs - b[1]._lastReactionMs)[0]
        const hardest = entries.filter(([, p]) => (p?.wrongCount || 0) > 0).sort((a, b) => (b[1].wrongCount || 0) - (a[1].wrongCount || 0))[0]
        const avgMs = Math.round(withReaction.reduce((s, [, p]) => s + p._lastReactionMs, 0) / withReaction.length)
        const fastCard = allCards.find(c => c.id === fastest?.[0])
        const hardCard = allCards.find(c => c.id === hardest?.[0])
        return (
          <div style={{ ...s.card, marginBottom: '16px' }}>
            <p style={{ ...s.cardLabel, marginBottom: '10px' }}>{t.reactionTime}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: th.gold, fontSize: '1.4rem', fontWeight: '700', margin: '0 0 2px' }}>{(avgMs/1000).toFixed(1)}s</p>
                <p style={{ color: th.sub, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>{t.average}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#4CAF50', fontSize: '1.4rem', fontWeight: '700', margin: '0 0 2px' }}>{(fastest[1]._lastReactionMs/1000).toFixed(1)}s</p>
                <p style={{ color: th.sub, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>{t.fastest}</p>
              </div>
            </div>
            {fastCard && <p style={{ color: th.sub, fontSize: '0.75rem', margin: '0 0 6px', textAlign: 'center', fontStyle: 'italic' }}>⚡ "{fastCard.front}"</p>}
            {hardCard && (
              <div style={{ padding: '8px 10px', background: `${th.accent}12`, borderRadius: '8px', border: `1px solid ${th.accent}30` }}>
                <p style={{ color: th.sub, fontSize: '0.72rem', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🎯 {t.hardestCard}
                </p>
                <p style={{ color: th.text, fontSize: '0.82rem', fontWeight: '600', margin: 0 }}>"{hardCard.front}" · {hardest[1].wrongCount}✗</p>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── PARTNER COMPARISON ── */}
      {hasPartner && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: th.accent, fontWeight: '700', fontSize: '0.9rem' }}>{myName}</span>
            <span style={{ color: th.sub, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', alignSelf: 'center' }}>vs</span>
            <span style={{ color: th.gold, fontWeight: '700', fontSize: '0.9rem' }}>{partnerName}</span>
          </div>
          {compRow(t.learnedToday, todayCorrect, partnerTodayCorrect)}
          {compRow(lang === 'de' ? 'Sessions heute' : 'Sessions today', todaySessions, partnerTodaySessions)}
          {compRow('Streak 🔥', myStreak, partnerStreak)}
          {compRow(lang === 'de' ? 'Gemeistert ✓' : 'Mastered ✓', myMastered, partnerMastered)}
          {compRow(lang === 'de' ? 'Aktive Karten' : 'Active cards', Object.keys(cardProgress).length, partnerActive)}
          {compRow(lang === 'de' ? 'Gesamt gelernt' : 'Total learned', myTotalLearned, partnerTotalLearned)}
          {compRow(lang === 'de' ? 'Längster Streak 🏆' : 'Best streak 🏆', myLongestStreak, partnerLongestStreak)}
          {compRow(lang === 'de' ? 'Lerntage gesamt' : 'Total learning days', myLearningDays, partnerLearningDays)}
          {compRow(t.favArea, myFavArea, partnerFavArea)}
          {(myWeeklyFavArea || partnerWeeklyFavArea) && compRow(lang === 'de' ? '📅 Diese Woche' : '📅 This week', myWeeklyFavArea || '—', partnerWeeklyFavArea || '—')}
          {/* ── LERNZEIT BARS ── */}
          {(() => {
            const nowWeek = getISOWeekStr()
            const nowMonth = new Date().toISOString().slice(0, 7)
            // My stats from myData (up-to-date)
            const myW = myData?.learningWeek === nowWeek ? (myData?.weeklyMinutes || 0) : 0
            const myM = myData?.learningMonth === nowMonth ? (myData?.monthlyMinutes || 0) : 0
            const myT = myData?.totalMinutes || 0
            // Partner stats from partnerData (published to userProfiles after each session)
            const pW = partnerData?.learningWeek === nowWeek ? (partnerData?.weeklyMinutes || 0) : 0
            const pM = partnerData?.learningMonth === nowMonth ? (partnerData?.monthlyMinutes || 0) : 0
            const pT = partnerData?.totalMinutes || 0
            const fmtM = (m) => m < 60 ? `${m}m` : `${Math.round(m/60)}h`
            const BarPair = ({ label, myVal, pVal }) => {
              const maxVal = Math.max(myVal, pVal, 1)
              const myPct = Math.round(myVal / maxVal * 100)
              const pPct = Math.round(pVal / maxVal * 100)
              return (
                <div style={{ padding: '8px 0', borderBottom: `1px solid ${th.border}` }}>
                  <p style={{ color: th.sub, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center', margin: '0 0 6px' }}>{label}</p>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      <p style={{ color: th.accent, fontWeight: '700', fontSize: '0.82rem', margin: '0 0 3px' }}>{fmtM(myVal)}</p>
                      <div style={{ height: '28px', background: th.border, borderRadius: '4px 4px 0 0', overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
                        <div style={{ width: `${myPct}%`, height: '100%', background: th.accent, borderRadius: '4px 4px 0 0', transition: 'width 0.6s ease', marginLeft: 'auto' }} />
                      </div>
                    </div>
                    <div style={{ width: '1px', background: th.border, height: '28px', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ color: th.gold, fontWeight: '700', fontSize: '0.82rem', margin: '0 0 3px' }}>{fmtM(pVal)}</p>
                      <div style={{ height: '28px', background: th.border, borderRadius: '4px 4px 0 0', overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
                        <div style={{ width: `${pPct}%`, height: '100%', background: th.gold, borderRadius: '4px 4px 0 0', transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            }
            return (
              <div style={{ marginTop: '8px' }}>
                <BarPair label={lang === 'de' ? 'Diese Woche' : 'This week'} myVal={myW} pVal={pW} />
                <BarPair label={lang === 'de' ? 'Dieser Monat' : 'This month'} myVal={myM} pVal={pM} />
                <div style={{ padding: '8px 0 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: th.accent, fontWeight: '700', fontSize: '0.82rem' }}>{fmtM(myT)}</span>
                    <span style={{ color: th.sub, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.total}</span>
                    <span style={{ color: th.gold, fontWeight: '700', fontSize: '0.82rem' }}>{fmtM(pT)}</span>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div></div>
  )
}

function VocaraLogoSVG({ withSlogans = false, animate = false, isDE = true }) {
  return (
    <div style={{ textAlign: 'center' }}>
      {withSlogans && (
        <p style={{ color: 'rgba(245,200,66,0.55)', fontSize: '10px', fontWeight: '700', letterSpacing: '7px', textTransform: 'uppercase', margin: '0 0 10px', fontFamily: "'Inter', system-ui, sans-serif" }}>
          DIE STIMME IST DIE BRÜCKE
        </p>
      )}
      <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '2.8rem', fontWeight: '700', color: '#FFD700', margin: 0, letterSpacing: '4px', lineHeight: 1 }}>Vocara</p>
      {withSlogans && (
        <>
          <p style={{ color: 'rgba(245,200,66,0.40)', fontSize: '9px', fontWeight: '600', letterSpacing: '2px', textTransform: 'uppercase', margin: '10px 0 2px', fontFamily: "'Inter', system-ui, sans-serif" }}>
            WIR BAUEN KEINE APPS. WIR BAUEN BRÜCKEN.
          </p>
          <p style={{ color: 'rgba(245,200,66,0.25)', fontSize: '8px', fontWeight: '500', letterSpacing: '3px', textTransform: 'uppercase', margin: 0, fontFamily: "'Inter', system-ui, sans-serif" }}>
            BY BRIDGELAB
          </p>
        </>
      )}
    </div>
  )
}

function MenuScreen({ user, myData, setMyData, partnerData, allCards, lang, onSaveProgress, theme, onThemeChange, onLightModeChange, onCardSizeChange, onPartnerUpdate, onSaveCefr, musicEnabled, musicVolume, onMusicToggle, onMusicVolume, onBack }) {
  const [screen, setScreen] = useState('menu')
  const [session, setSession] = useState(null)
  const [result, setResult] = useState(null)
  const [masteryUnlocked, setMasteryUnlocked] = useState(false)
  const [aiNotification, setAiNotification] = useState(null)
  const [stopToast, setStopToast] = useState(null)
  const [surpriseCard, setSurpriseCard] = useState(null) // {front, back, sharedBy, ...}
  const [pendingSession, setPendingSession] = useState(null)
  const [resumeStartIndex, setResumeStartIndex] = useState(0)
  const [resumeStartProgress, setResumeStartProgress] = useState(null)
  const [emptyCategoryMsg, setEmptyCategoryMsg] = useState(null)
  const [resumeDialog, setResumeDialog] = useState(null)
  const [currentSessionMode, setCurrentSessionMode] = useState('all')
  const [activeToLang, setActiveToLang] = useState(() => {
    try {
      const tls = myData?.toLangs
      if (tls && tls.length > 0 && tls[0]?.lang) return tls[0].lang.toLowerCase()
      const t = myData?.toLang
      return Array.isArray(t) ? (t[0] || 'en').toLowerCase() : (t || 'en').toLowerCase()
    } catch { return 'en' }
  })
  const [satzLoading, setSatzLoading] = useState(false)
  const [weekGoalCelebration, setWeekGoalCelebration] = useState(false)
  const [monthlyUnlockNotification, setMonthlyUnlockNotification] = useState(false)
  const [gimmickPopup, setGimmickPopup] = useState(false)
  const [weeklyGoals, setWeeklyGoals] = useState(() => {
    const currentWeek = getISOWeekStr()
    const stored = myData?.weeklyGoals
    return stored?.week === currentWeek ? stored : { week: currentWeek, completed: [] }
  })
  const [dailyCard, setDailyCard] = useState(null)
  const [dailyCardDismissed, setDailyCardDismissed] = useState(false)
  const [miniTask, setMiniTask] = useState(null)
  const [miniTaskInput, setMiniTaskInput] = useState('')
  const [miniTaskLoading, setMiniTaskLoading] = useState(false)
  const [reactionPrompt, setReactionPrompt] = useState(null) // {name, count}
  const [floatingReaction, setFloatingReaction] = useState(null) // emoji string
  const [replyInput, setReplyInput] = useState('')
  const [showReplyInput, setShowReplyInput] = useState(false)
  const [floatingMessage, setFloatingMessage] = useState(null) // incoming whisper text
  const [wordOfDayBanner, setWordOfDayBanner] = useState(null) // {front, back}
  const [freezeAvailable, setFreezeAvailable] = useState(true)
const [dotTooltip, setDotTooltip] = useState(null) // area key
  const [pendingGift, setPendingGift] = useState(null) // gift object
  const [coachMsg, setCoachMsg] = useState(null)
  const [tutorCollapsed, setTutorCollapsed] = useState(() => !!(myData?.tutorCollapsed))
  const [tutorRecommendedArea, setTutorRecommendedArea] = useState(null)
  const [sessionCompleteCount, setSessionCompleteCount] = useState(0)
  const [basicsLoading, setBasicsLoading] = useState(false)
  const [kontextCard, setKontextCard] = useState(null)
  const [kontextPrevScreen, setKontextPrevScreen] = useState('result')
  const [tenseUnlockCelebration, setTenseUnlockCelebration] = useState(null) // 'past' | 'future' | null
  const [neverLearnModal, setNeverLearnModal] = useState(null) // card object | null
  const VALID_SCREENS = new Set(['menu','cards','result','settings','partner','test','impressum','stats','ki','satz','diary','meinekarten','geschenkkarte','karteerstellen','admin','rhythmus','kontext'])
  if (!VALID_SCREENS.has(screen)) { setScreen('menu'); return null }

  // ── KI-TUTOR BANNER ──────────────────────────────────────────
  const fetchTutorMsg = (freshCardProg, freshSessionHistory) => {
    const cardProg = freshCardProg || myData?.cardProgress || {}
    const sessionHistory = freshSessionHistory || myData?.sessionHistory || []
    const isDE = lang === 'de'
    const streak = calcStreak(sessionHistory)
    const masteredCount = Object.values(cardProg).filter(p => (p?.interval || 0) >= 7).length
    const level = getLevelName(masteredCount, lang)
    const fromLangName = isDE ? 'German' : 'English'
    const toLangName = isDE ? 'English' : 'German'
    const CATS = [
      { key: 'vocabulary', label: isDE ? 'Wörter' : 'Words' },
      { key: 'street', label: 'Slang' },
      { key: 'home', label: isDE ? 'Zuhause' : 'Home' },
      { key: 'sentence', label: isDE ? 'Sätze' : 'Sentences' },
      { key: 'basics', label: isDE ? 'Grundlagen' : 'Basics' },
    ]
    const todayD = todayStr()
    const catStats = CATS.map(({ key, label }) => {
      const cats = (allCards || []).filter(c => !/_r/.test(c.id) && c.category === key)
      const mastered = cats.filter(c => (cardProg[c.id]?.interval || 0) >= 7).length
      const due = cats.filter(c => (cardProg[c.id]?.nextReview || '0') <= todayD).length
      return `${label}:${mastered}mastered,${due}due`
    }).join('; ')
    const lastSessions = [...sessionHistory].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
    const sessionsStr = lastSessions.length > 0 ? lastSessions.map(s => `${s.correct}/${s.total}`).join(',') : 'none'
    const phoneticCards = Object.values(cardProg).filter(p => p?._phonetic).length
    const phoneticStr = phoneticCards > 0 ? ` ${phoneticCards} cards have pronunciation guides.` : ''
    const noteCards = Object.entries(cardProg).filter(([, p]) => p?._note).slice(0, 3)
    const notesStr = noteCards.length > 0 ? ` User notes on ${noteCards.length} card(s): ${noteCards.map(([id, p]) => `"${p._note}"`).join(', ')}.` : ''
    const weakPronunciationCards = Object.entries(cardProg)
      .filter(([, p]) => (p?.interval || 0) >= 7 && Array.isArray(p?._pronunciationHistory) && p._pronunciationHistory.length >= 2)
      .map(([id, p]) => {
        const avg = Math.round(p._pronunciationHistory.reduce((a, b) => a + b, 0) / p._pronunciationHistory.length)
        const card = (allCards || []).find(c => c.id === id)
        return { avg, front: card?.front }
      }).filter(x => x.avg < 65 && x.front).slice(0, 3)
    const pronunciationNote = weakPronunciationCards.length > 0
      ? ` Pronunciation weak on mastered words: ${weakPronunciationCards.map(x => `"${x.front}" (${x.avg}%)`).join(', ')}.`
      : ''
    const AREA_KEYS = ['vocabulary','street','home','sentence','basics']
    let bestArea = 'vocabulary'; let bestDue = -1
    AREA_KEYS.forEach(key => {
      const due = (allCards || []).filter(c => !/_r/.test(c.id) && c.category === key && (cardProg[c.id]?.nextReview || '0') <= todayD).length
      if (due > bestDue) { bestDue = due; bestArea = key }
    })
    setTutorRecommendedArea(bestArea)
    setCoachMsg(null)
    fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 45,
        messages: [{ role: 'user', content: `You are a personal language tutor for a ${fromLangName} speaker learning ${toLangName}. Stats: ${catStats}. Last sessions: ${sessionsStr}. Streak: ${streak} days. Level: ${level}.${phoneticStr}${notesStr}${pronunciationNote} Give ONE specific coaching tip (max 20 words) in ${fromLangName} about what to focus on NOW to speak ${toLangName} faster. If user has pronunciation weaknesses, prioritize that. Bridgelab tone: warm, no fluff. Return ONLY the tip, no quotes or markdown. ${kiRespondIn(lang)}` }]
      })
    }).then(r => r.json()).then(d => {
      const msg = d.content?.[0]?.text?.trim()
      setCoachMsg(msg || '')
    }).catch(() => setCoachMsg(''))
  }
  useEffect(() => { fetchTutorMsg() }, [sessionCompleteCount]) // eslint-disable-line

  // ── EXAMPLE SENTENCE SAVE ────────────────────────────────────
  const handleSaveExample = async (cardId, example) => {
    try {
      const updated = { ...myData?.cardProgress, [cardId]: { ...(myData?.cardProgress?.[cardId] || {}), _example: example } }
      await updateDoc(doc(db, 'users', user.uid), { cardProgress: updated })
      setMyData(d => ({ ...d, cardProgress: updated }))
    } catch(e) { console.warn('Failed to save example:', e) }
  }

  // Check for surprise card from partner on mount
  useEffect(() => {
    const sc = myData?.surpriseCard
    if (!sc) return
    const seenToday = myData?.surpriseSeenDate === todayStr()
    if (!seenToday) setSurpriseCard(sc)
  }, [])

  // ── STREAK FREEZE ─────────────────────────────────────────
  useEffect(() => {
    const freeze = myData?.streakFreeze || {}
    const month = new Date().toISOString().slice(0, 7)
    setFreezeAvailable(freeze.lastReset !== month ? true : (freeze.available ?? true))
  }, [myData?.streakFreeze])

  // ── PENDING GIFT CHECK ────────────────────────────────────
  useEffect(() => {
    const gift = myData?.pendingGift
    if (!gift || myData?.pendingGiftSeenDate === todayStr()) return
    setPendingGift(gift)
  }, [])

  // ── DAILY CARD ────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'menu') return
    const todayD = todayStr()
    const stored = myData?.dailyCard
    if (stored?.date === todayD) { setDailyCard(stored); return }
    const loadDailyCard = async () => {
      try {
        // Check Firestore subcollection for today's already-generated card
        const cardRef = doc(db, 'users', user.uid, 'dailyCards', todayD)
        const cardSnap = await getDoc(cardRef).catch(() => null)
        if (cardSnap?.exists()) {
          const card = cardSnap.data()
          setDailyCard(card)
          setMyData(d => ({ ...d, dailyCard: card }))
          return
        }
        // Try partner's subcollection card
        if (myData?.partnerUID) {
          try {
            const pCardRef = doc(db, 'users', myData.partnerUID, 'dailyCards', todayD)
            const pSnap = await getDoc(pCardRef)
            if (pSnap.exists()) {
              const pc = pSnap.data()
              setDailyCard(pc)
              await setDoc(cardRef, pc).catch(() => {})
              await updateDoc(doc(db, 'users', user.uid), { dailyCard: pc }).catch(() => {})
              setMyData(d => ({ ...d, dailyCard: pc }))
              return
            }
          } catch (e) {}
        }
        // Generate new card with date-based category rotation
        const DAILY_CATS = ['vocabulary', 'street', 'home', 'sentence', 'basics']
        const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
        const category = DAILY_CATS[dayOfYear % DAILY_CATS.length]
        const masteredCount = Object.values(myData?.cardProgress || {}).filter(p => (p?.interval || 0) >= 7).length
        const level = getLevelName(masteredCount, lang)
        const toLangFull = isMarkLang ? 'English' : 'German'
        const fromLangFull = isMarkLang ? 'German' : 'English'
        const toLangCode = isMarkLang ? 'en' : 'de'
        const fromLangCode = isMarkLang ? 'de' : 'en'
        const recentFronts = (myData?.recentDailyFronts || []).slice(-30).join(', ')
        const relType = myData?.relationshipType || 'couple'
        const relContext = { couple: 'romantic couple', friends: 'close friends', family: 'family members', colleagues: 'colleagues' }[relType] || 'couple'
        const res = await fetch('/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001', max_tokens: 150,
            messages: [{ role: 'user', content: `Today is ${todayD}. Generate ONE unique daily phrase card for a ${fromLangFull} speaker learning ${toLangFull} at level: ${level}. Category: ${category}. Context: two ${relContext} learning together. Front MUST be in ${toLangFull}, back in ${fromLangFull}. Avoid these recent fronts: ${recentFronts || 'none'}. Make the phrase emotionally resonant for ${relContext}. Return ONLY JSON (no markdown): {"front":"...","back":"...","context":"...","category":"${category}","relType":"${relType}"}` }]
          })
        })
        const data = await res.json()
        const raw = data.content?.[0]?.text?.trim() || '{}'
        const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
        if (parsed.front && parsed.back) {
          const card = { front: parsed.front, back: parsed.back, context: parsed.context || '', date: todayD, category, langA: toLangCode, langB: fromLangCode }
          setDailyCard(card)
          await setDoc(doc(db, 'users', user.uid, 'dailyCards', todayD), card).catch(() => {})
          const recentArr = [...(myData?.recentDailyFronts || []), parsed.front].slice(-30)
          await updateDoc(doc(db, 'users', user.uid), { dailyCard: card, recentDailyFronts: recentArr }).catch(() => {})
          setMyData(d => ({ ...d, dailyCard: card, recentDailyFronts: recentArr }))
        }
      } catch (e) { console.warn('Daily card failed:', e) }
    }
    loadDailyCard()
  }, [screen])

  // ── MINI TASK ─────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'menu') return
    const todayD = todayStr()
    const stored = myData?.miniTask
    if (stored?.date === todayD) { setMiniTask(stored); return }
    // Pick only cards where front is in the target language (not native/SW)
    const targetLangA = lang === 'de' ? 'en' : 'de'
    const masteredCards = (allCards || []).filter(c =>
      !/_r(_\d+)?$/.test(c.id) &&
      (cardProgress[c.id]?.interval || 0) >= 7 &&
      c.langA === targetLangA
    )
    if (masteredCards.length === 0) return
    const picked = masteredCards[Math.floor(Math.random() * masteredCards.length)]
    const task = { word: picked.front, date: todayD, done: false }
    setMiniTask(task)
    updateDoc(doc(db, 'users', user.uid), { miniTask: task }).catch(() => {})
    setMyData(d => ({ ...d, miniTask: task }))
  }, [screen])

  // ── PARTNER REACTION + INCOMING MESSAGE ─────────────────────
  useEffect(() => {
    const todayD = todayStr()
    // Show incoming partner message as floating whisper
    const pm = myData?.pendingMessage
    if (pm?.date === todayD && pm?.text) {
      setFloatingMessage(pm.text)
      setTimeout(() => setFloatingMessage(null), 8000)
      updateDoc(doc(db, 'users', user.uid), { pendingMessage: null }).catch(() => {})
      setMyData(d => ({ ...d, pendingMessage: null }))
    }
    // Show floating emoji if we received an emoji reaction
    const pr = myData?.pendingReaction
    if (pr?.date === todayD && pr?.emoji) {
      setFloatingReaction(pr.emoji)
      setTimeout(() => setFloatingReaction(null), 3500)
      updateDoc(doc(db, 'users', user.uid), { pendingReaction: null }).catch(() => {})
      setMyData(d => ({ ...d, pendingReaction: null }))
    }
    // Prompt to respond to partner's learning activity
    if (!partnerData) return
    const partnerTodayCorrect = (partnerData.sessionHistory || [])
      .filter(h => h.date === todayD).reduce((a, b) => a + (b.correct || 0), 0)
    if (partnerTodayCorrect > 0 && myData?.lastPartnerReactionDate !== todayD) {
      const name = myData?.partnerName || partnerData?.name?.split(' ')[0] || 'Partner'
      setReactionPrompt({ name, count: partnerTodayCorrect })
    }
  }, [])

  const sendPartnerMessage = async () => {
    const text = replyInput.trim().slice(0, 20)
    if (!text || !myData?.partnerUID) return
    try {
      const message = { text, from: user.displayName?.split(' ')[0] || 'Partner', date: todayStr() }
      await updateDoc(doc(db, 'users', myData.partnerUID), { pendingMessage: message })
      await updateDoc(doc(db, 'users', user.uid), { lastPartnerReactionDate: todayStr() })
      setMyData(d => ({ ...d, lastPartnerReactionDate: todayStr() }))
    } catch (e) { console.warn('sendPartnerMessage failed:', e) }
    setReactionPrompt(null)
    setReplyInput('')
    setShowReplyInput(false)
  }

  const sendReaction = async (emoji) => {
    if (!myData?.partnerUID) return
    try {
      const reaction = { emoji, from: user.displayName?.split(' ')[0] || 'Partner', date: todayStr() }
      await updateDoc(doc(db, 'users', myData.partnerUID), { pendingReaction: reaction })
      await updateDoc(doc(db, 'users', user.uid), { lastPartnerReactionDate: todayStr() })
      setMyData(d => ({ ...d, lastPartnerReactionDate: todayStr() }))
    } catch (e) { console.warn('sendReaction failed:', e) }
    setReactionPrompt(null)
  }

  const dismissSurprise = async (addToDeck) => {
    if (addToDeck && surpriseCard) {
      const card = { ...surpriseCard, id: `surprise_deck_${Date.now()}`, source: 'surprise' }
      const updated = [...(myData?.aiCards || []), card]
      await updateDoc(doc(db, 'users', user.uid), { aiCards: updated, surpriseSeenDate: todayStr() }).catch(() => {})
      setMyData(d => ({ ...d, aiCards: updated, surpriseSeenDate: todayStr() }))
    } else {
      await updateDoc(doc(db, 'users', user.uid), { surpriseSeenDate: todayStr() }).catch(() => {})
      setMyData(d => ({ ...d, surpriseSeenDate: todayStr() }))
    }
    setSurpriseCard(null)
  }

  const homeFloat = (
    <button onClick={() => setScreen('menu')} title="Zurück zur Startseite" style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999, background: 'rgba(0,0,0,0.55)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: '46px', height: '46px', fontSize: '1.3rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>🏠</button>
  )

  const { lightMode, cardSize } = React.useContext(AppPrefsContext)
  const [t, setT] = useState(() => T[lang] || T.en)
  const th = resolveTheme(theme, lightMode); const s = makeStyles(th)
  useEffect(() => { loadLocale(lang).then(loaded => setT({ ...(T[lang] || T.en), ...loaded })).catch(() => {}) }, [lang])
  const firstName = user.displayName?.split(' ')[0] || user.displayName
  const cardProgress = myData?.cardProgress || {}
  const isMarkLang = lang === 'de'
  const cefr = myData?.cefr
  const sessionHistory = myData?.sessionHistory || []
  const partnerName = myData?.partnerName || partnerData?.name?.split(' ')[0] || 'Partner'
  // Free/Premium plan — Mark and Elosy always premium
  const userPlan = (user.uid === MARK_UID || user.uid === ELOSY_UID) ? 'premium' : (myData?.plan || 'free')
  const isPremium = userPlan !== 'free'
  const [softPaywall, setSoftPaywall] = useState(null) // null | {area, used, limit}

  // Free usage: count unique cards with any progress per category (derived from existing data)
  const freeUsed = (category) => {
    if (isPremium) return 0
    return (allCards || []).filter(c => c.category === category && (cardProgress[c.id]?.interval || 0) > 0).length
  }
  const FREE_LIMITS = { street: 5, home: 5, urlaub: 3 }

  const checkFreeLimit = (category) => {
    if (isPremium) return true
    const limit = FREE_LIMITS[category]
    if (!limit) return true
    const used = freeUsed(category)
    if (used >= limit) {
      setSoftPaywall({ area: category, used, limit })
      // Also write to Firestore usage subcollection
      setDoc(doc(db, 'users', user.uid, 'usage', category), { used, limit, updatedAt: Date.now() }, { merge: true }).catch(() => {})
      return false
    }
    return true
  }
  useEffect(() => {
    if (!user) return
    const settingsRef = doc(db, 'users', user.uid, 'settings', 'preferences')
    getDoc(settingsRef).then(snap => {
      if (snap.exists() && snap.data().activeToLang) setActiveToLang(snap.data().activeToLang)
    }).catch(() => {})
  }, [user?.uid])

  const handleChangeActiveToLang = async (newLang) => {
    setActiveToLang(newLang)
    if (user) {
      const settingsRef = doc(db, 'users', user.uid, 'settings', 'preferences')
      await setDoc(settingsRef, { activeToLang: newLang }, { merge: true }).catch(() => {})
    }
  }

  const today = todayStr()
  const yd = new Date(); yd.setDate(yd.getDate() - 1)
  const yesterday = `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, '0')}-${String(yd.getDate()).padStart(2, '0')}`
  const pausedLanguages = myData?.pausedLanguages || []
  const excludedCardIds = new Set(Object.keys(myData?.excludedCards || {}))
  const safeCards = allCards || []
  const uniqueTargetLangs = [...new Set(safeCards.map(c => c.targetLang).filter(Boolean))]
  const activeCards = safeCards
    .filter(c => !excludedCardIds.has(c.id))
    .filter(c => pausedLanguages.length === 0 || !pausedLanguages.includes(c.targetLang))

  // ── WORT DES TAGES ────────────────────────────────────────
  const wordOfDay = (() => {
    const mastered = activeCards.filter(c => !/_r(_\d+)?$/.test(c.id) && (cardProgress[c.id]?.interval || 0) >= 7)
    if (mastered.length === 0) return null
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
    return mastered[dayOfYear % mastered.length]
  })()

  // ── STREAK STATUS ─────────────────────────────────────────
  const sessionDates = [...new Set(sessionHistory.map(h => h.date))].sort()
  const lastSessionDate = sessionDates[sessionDates.length - 1]
  const streakStatus = !lastSessionDate ? null
    : lastSessionDate >= today ? 'safe'
    : lastSessionDate === yesterday ? 'warning'
    : 'lost'

  // ── DAILY GOAL ────────────────────────────────────────────
  const todayCorrect = sessionHistory.filter(h => h.date === today).reduce((a, b) => a + (b.correct || 0), 0)
  const dailyGoal = myData?.dailyGoal || 10

  // ── PARTNER ONLINE STATUS ─────────────────────────────────
  const partnerLastActive = partnerData?.lastActive
  const partnerOnline = !!(partnerData && (partnerLastActive === today || partnerLastActive === yesterday))
  const partnerActivityStatus = (() => {
    if (!partnerData || !partnerLastActive) return null
    const lastActiveMs = new Date(partnerLastActive).getTime()
    const nowMs = Date.now()
    const diffMin = (nowMs - lastActiveMs) / 60000
    if (diffMin <= 30) return { label: isMarkLang ? `${partnerName} lernt gerade` : `${partnerName} is learning now`, color: '#4CAF50', dot: '🟢' }
    if (partnerLastActive === today) return { label: isMarkLang ? `${partnerName} war heute aktiv` : `${partnerName} was active today`, color: '#FFC107', dot: '🟡' }
    if (partnerLastActive === yesterday) return { label: isMarkLang ? `${partnerName} war gestern aktiv` : `${partnerName} was active yesterday`, color: th.sub, dot: '⚪' }
    return { label: isMarkLang ? `${partnerName} zuletzt: ${partnerLastActive}` : `${partnerName} last seen: ${partnerLastActive}`, color: th.sub, dot: '⚪' }
  })()

  // ── CEFR PROGRESS ─────────────────────────────────────────
  const myMasteredCount = Object.values(cardProgress).filter(p => (p?.interval || 0) >= 7).length

  // ── TENSE UNLOCK CELEBRATION (fires once per threshold) ───
  useEffect(() => {
    if (!user || !myData || myMasteredCount === 0) return
    const seen = myData?.tenseUnlockSeen || {}
    if (myMasteredCount >= TENSE_THRESHOLDS.future && !seen.future) {
      setTenseUnlockCelebration('future')
      updateDoc(doc(db, 'users', user.uid), { 'tenseUnlockSeen.future': true }).catch(() => {})
      setMyData(d => ({ ...d, tenseUnlockSeen: { ...(d?.tenseUnlockSeen || {}), future: true } }))
    } else if (myMasteredCount >= TENSE_THRESHOLDS.past && !seen.past) {
      setTenseUnlockCelebration('past')
      updateDoc(doc(db, 'users', user.uid), { 'tenseUnlockSeen.past': true }).catch(() => {})
      setMyData(d => ({ ...d, tenseUnlockSeen: { ...(d?.tenseUnlockSeen || {}), past: true } }))
    }
  }, [myMasteredCount]) // eslint-disable-line
  const cefrIdx = cefr ? CEFR_LEVELS.indexOf(cefr) : -1
  const nextCefr = cefrIdx >= 0 && cefrIdx < CEFR_LEVELS.length - 1 ? CEFR_LEVELS[cefrIdx + 1] : null
  const cefrFrom = cefr ? (CEFR_MASTERY_REQ[cefr] || 0) : 0
  const cefrTo = nextCefr ? CEFR_MASTERY_REQ[nextCefr] : cefrFrom
  const cefrPct = cefrTo > cefrFrom ? Math.min(100, Math.round(((myMasteredCount - cefrFrom) / (cefrTo - cefrFrom)) * 100)) : 100
  const cefrBar = (() => {
    const filled = Math.max(0, Math.min(5, Math.round(cefrPct / 20))); const empty = Math.max(0, 5 - filled)
    return '▓'.repeat(filled) + '░'.repeat(empty)
  })()

  // ── MONTHLY TEST CHECK ────────────────────────────────────
  const testDue = !myData?.cefr || daysSince(myData?.lastTestDate) >= MONTHLY_TEST_DAYS

  const sessionPreview = (() => {
    let due = 0, newC = 0
    ;(allCards || []).forEach(card => {
      const p = cardProgress[card.id]
      if (!p) newC++
      else if (p.wrongSessions > 0 || p.nextReview <= today) due++
    })
    return { due, new: newC }
  })()

  useEffect(() => {
    if (screen !== 'menu') return
    const checkPending = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid, 'session', 'current'))
        setPendingSession(snap.exists() ? snap.data() : null)
      } catch (e) { console.warn('Could not check pending session:', e) }
    }
    checkPending()
  }, [screen])

  const startSession = () => {
    const sess = buildSession(activeCards, cardProgress)
    setCurrentSessionMode('all')
    setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
  }

  // ── VOCAB WORD GENERATOR: generates 10 single words, saves, starts session ─
  // Called when vocab cards < 5 (empty state) AND at 85% mastery
  const generateVocabWords = async (existingVocabCards = []) => {
    setEmptyCategoryMsg(isMarkLang ? 'Noch keine Wörter hier — die KI erstellt gleich deine ersten Karten.' : 'No words yet — AI is creating your first cards…')

    // Fetch fresh Firestore state
    const freshSnap = await getDoc(doc(db, 'users', user.uid))
    const freshData = freshSnap.exists() ? freshSnap.data() : {}

    // Exclusion list: ALL existing card fronts (for the AI), but full list for dedup
    const allFronts = [
      ...(allCards || []).map(c => c.front),
      ...(freshData.aiCards || []).map(c => c.front),
    ]
    const exclusionList = [...new Set(allFronts.map(f => (f || '').toLowerCase().trim()))]
      .filter(Boolean).slice(0, 120).join(', ')

    const langA = isMarkLang ? 'en' : 'de'
    const langB = isMarkLang ? 'de' : 'en'

    // Check weekly shared pool before calling AI
    const poolVocab = await fetchSharedCards(langA, langB)
    if (poolVocab?.length > 0) {
      const existingFrontsSet = new Set(allFronts.map(f => (f || '').toLowerCase().trim()))
      const ts = Date.now()
      const newCards = poolVocab
        .filter(c => c.front?.trim() && c.back?.trim())
        .filter(c => { const w = c.front.trim().split(' ').filter(Boolean); return w.length === 1 || (w.length === 2 && w[0].toLowerCase() === 'to') })
        .filter(c => { const k = c.front.trim().toLowerCase(); if (existingFrontsSet.has(k)) return false; existingFrontsSet.add(k); return true })
        .slice(0, 10)
        .map((c, i) => ({ id: `vocab_pool_${ts}_${i}`, front: c.front.trim(), back: c.back.trim(), category: 'vocabulary', tense: c.tense || 'present', langA, langB, source: 'weekly-pool', createdAt: ts }))
      if (newCards.length > 0) {
        const snap2 = await getDoc(doc(db, 'users', user.uid))
        const data2 = snap2.exists() ? snap2.data() : {}
        const updatedAiCards = [...(data2.aiCards || []), ...newCards]
        const updatedProgress = { ...(data2.cardProgress || {}) }
        newCards.forEach(c => { updatedProgress[c.id] = { interval: 0, consecutiveFast: 0, wrongSessions: 0, nextReview: todayStr() } })
        await updateDoc(doc(db, 'users', user.uid), { aiCards: updatedAiCards, cardProgress: updatedProgress })
        setMyData(d => ({ ...d, aiCards: updatedAiCards, cardProgress: updatedProgress }))
        setEmptyCategoryMsg(t.firstWordsReady || 'Deine ersten Wörter sind bereit ✓')
        setTimeout(() => setEmptyCategoryMsg(null), 2000)
        const allVocabForSession = [...existingVocabCards, ...newCards.flatMap(buildCardPair)]
        const sess = [...allVocabForSession].sort(() => Math.random() - 0.5).slice(0, SESSION_SIZE)
        setCurrentSessionMode('vocabulary')
        setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
        return
      }
    }

    const tenseUnlocks = getTenseUnlocks(myMasteredCount)
    const tenseNote = !tenseUnlocks.past ? 'Use present tense only (infinitive/base forms).' : !tenseUnlocks.future ? 'May use present or past tense forms.' : 'May use present, past, or future tense forms.'
    const prompt = isMarkLang
      ? `Generate 10 useful single English words for a German speaker learning English.
NOT phrases, NOT sentences — only single words or simple infinitives like 'to run'.
Avoid these already known words: ${exclusionList}
${tenseNote}
For each word: wordType = one of Noun/Verb/Adjective/Adverb/Phrase. For Nouns: article = "the" or "a". Others: article = "".
Return ONLY JSON: [{"front":"English word","back":"Deutsche Übersetzung","category":"vocabulary","tense":"present","wordType":"Noun","article":"the"}]`
      : `Generate 10 useful single German words for an English speaker learning German.
NOT phrases, NOT sentences — only single words or simple infinitives like 'laufen'.
Avoid these already known words: ${exclusionList}
${tenseNote}
For each word: wordType = one of Nomen/Verb/Adjektiv/Adverb/Phrase. For Nomen: article = "der"|"die"|"das". Others: article = "".
Return ONLY JSON: [{"front":"German word","back":"English translation","category":"vocabulary","tense":"present","wordType":"Nomen","article":"der"}]`

    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 500, system: CARD_GEN_SYSTEM, messages: [{ role: 'user', content: prompt }] })
      })
      const raw = ((await res.json()).content?.[0]?.text || '[]').trim()
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())

      const existingFrontsSet = new Set(allFronts.map(f => (f || '').toLowerCase().trim()))
      const ts = Date.now()

      const newCards = parsed
        .filter(c => {
          if (!c.front?.trim() || !c.back?.trim()) return false
          const words = c.front.trim().split(' ').filter(Boolean)
          // Allow single words OR "to X" infinitives — reject everything else
          const isInfinitive = words.length === 2 && words[0].toLowerCase() === 'to'
          if (words.length > 2 || (words.length > 1 && !isInfinitive)) {
            console.log('[vocabWords] Rejected phrase:', c.front)
            return false
          }
          // Exact case-insensitive dedup only — no fuzzy matching
          const key = c.front.trim().toLowerCase()
          if (existingFrontsSet.has(key)) {
            console.log('[vocabWords] Exact duplicate skipped:', c.front)
            return false
          }
          existingFrontsSet.add(key)
          return true
        })
        .slice(0, 10)
        .map((c, i) => ({
          id: `vocab_ai_${ts}_${i}`,
          front: c.front.trim(),
          back: c.back.trim(),
          category: 'vocabulary',
          tense: c.tense || 'present',
          wordType: c.wordType || null,
          article: c.article || null,
          langA, langB,
          source: 'ai-vocab',
          createdAt: ts,
        }))

      if (newCards.length === 0) {
        setEmptyCategoryMsg(isMarkLang ? 'Keine neuen Wörter generiert — versuche es später.' : 'No new words generated — try again later.')
        setTimeout(() => setEmptyCategoryMsg(null), 3500)
        return
      }

      // Write to Firestore with fresh fetch to avoid race conditions
      const snap2 = await getDoc(doc(db, 'users', user.uid))
      const data2 = snap2.exists() ? snap2.data() : {}
      const updatedAiCards = [...(data2.aiCards || []), ...newCards]
      const updatedProgress = { ...(data2.cardProgress || {}) }
      newCards.forEach(c => {
        updatedProgress[c.id] = { interval: 0, consecutiveFast: 0, wrongSessions: 0, nextReview: todayStr() }
        console.log('[vocabWords] Saved:', c.front, '→', c.back)
      })
      await updateDoc(doc(db, 'users', user.uid), { aiCards: updatedAiCards, cardProgress: updatedProgress })
      setMyData(d => ({ ...d, aiCards: updatedAiCards, cardProgress: updatedProgress }))

      // Brief success message, then start session
      setEmptyCategoryMsg(isMarkLang ? 'Deine ersten Wörter sind bereit ✓' : 'Your first words are ready ✓')
      setTimeout(() => setEmptyCategoryMsg(null), 2000)

      // Session = existing vocab cards + new ones
      const allVocabForSession = [...existingVocabCards, ...newCards.flatMap(buildCardPair)]
      const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)
      const sess = shuffle(allVocabForSession).slice(0, SESSION_SIZE)
      setCurrentSessionMode('vocabulary')
      setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
    } catch (e) {
      console.error('[vocabWords] Generation failed:', e)
      setEmptyCategoryMsg(isMarkLang ? 'KI-Generierung fehlgeschlagen — versuche es erneut.' : 'AI generation failed — try again.')
      setTimeout(() => setEmptyCategoryMsg(null), 3500)
    }
  }

  const generateCategoryCards = async (category) => {
    const isStreet = category === 'street'
    const isHome = category === 'home'
    const langA = isMarkLang ? 'de' : 'en'
    const langB = isMarkLang ? 'en' : 'de'
    const fromLangName = isMarkLang ? 'German' : 'English'
    const toLangName = isMarkLang ? 'English' : 'German'
    // Home category: level-aware content generation (10 levels)
    const HOME_LEVEL_DESCS = [
      'absolute basics: greetings like "Guten Morgen", "Wie geht\'s?", "Danke schön", simple yes/no phrases',
      'basic household phrases: asking for help, naming rooms, simple requests at home',
      'daily family conversation: talking about meals, plans for the day, describing family members',
      'household activities: cooking instructions, chores, shopping lists, describing your home',
      'feelings and relationships at home: expressing emotions, talking about relationships, conflicts',
      'leisure at home: hobbies, watching TV, music, reading — natural everyday small talk',
      'deeper domestic conversations: discussing living arrangements, home improvements, routines in detail',
      'nuanced household language: subtle expressions, indirect requests, polite disagreements at home',
      'cultural home expressions: idioms and phrases about family life, customs, traditions',
      'near-native home vocabulary: complex family dynamics, formal and informal registers mixed',
    ]
    let homeLevelNote = ''
    if (isHome) {
      const homeMastered = (activeCards || []).filter(c => c.category === 'home' && (cardProgress[c.id]?.interval || 0) >= 7).length
      const homeLevel = getCatLevel(homeMastered)
      homeLevelNote = ` Current learner level ${homeLevel + 1}/10. Generate content for: ${HOME_LEVEL_DESCS[Math.min(homeLevel, HOME_LEVEL_DESCS.length - 1)]}.`
    }
    const typeDesc = isStreet
      ? 'slang, street language, informal expressions, youth language'
      : `home, family, everyday domestic expressions.${homeLevelNote}`
    const label = isStreet
      ? (isMarkLang ? 'Auf der Straße — KI erstellt erste Phrasen…' : 'On the Street — AI creating first phrases…')
      : (isMarkLang ? 'Und zu Hause — KI erstellt erste Phrasen…' : 'At Home — AI creating first phrases…')
    setEmptyCategoryMsg(label)

    // Check weekly shared pool before calling AI
    const poolCat = await fetchSharedCards(langA, langB)
    const poolCatFiltered = poolCat?.filter(c => c.category === category || !c.category)
    if (poolCatFiltered?.length > 0) {
      const ts = Date.now()
      const newCards = poolCatFiltered.slice(0, 5).map((c, i) => ({
        ...c, id: `${category}_pool_${ts}_${i}`, langA, langB, source: `weekly-pool`, createdAt: ts,
        category, tense: c.tense || 'present',
      }))
      const updatedAiCards = [...(myData?.aiCards || []), ...newCards]
      const updatedProgress = { ...(myData?.cardProgress || {}) }
      newCards.forEach(c => { updatedProgress[c.id] = { interval: 0, consecutiveRight: 0, wrongSessions: 0, nextReview: todayStr() } })
      await updateDoc(doc(db, 'users', user.uid), { aiCards: updatedAiCards, cardProgress: updatedProgress })
      setMyData(d => ({ ...d, aiCards: updatedAiCards, cardProgress: updatedProgress }))
      setEmptyCategoryMsg(t.phrasesReady || 'Erste Phrasen bereit ✓')
      setTimeout(() => setEmptyCategoryMsg(null), 2000)
      const sess = [...newCards.flatMap(buildCardPair)].sort(() => Math.random() - 0.5).slice(0, SESSION_SIZE)
      setCurrentSessionMode(category)
      setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
      return
    }

    const catTenseUnlocks = getTenseUnlocks(myMasteredCount)
    const catTenseNote = !catTenseUnlocks.past ? 'Use present tense only.' : !catTenseUnlocks.future ? 'May use present or past tense.' : 'May use present, past, or future tense.'
    const prompt = `Generate exactly 5 natural ${typeDesc} flashcards for a ${toLangName} learner whose native language is ${fromLangName}.
Front language: ${fromLangName}. Back language: ${toLangName}. Category: ${category}.
For street/slang: use real informal expressions. For home: use family/romantic/daily household phrases.
${catTenseNote}
Return ONLY valid JSON: [{"front":"...","back":"...","category":"${category}","tense":"present|past|future","context":"usage note in 1 sentence"}]`
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 600, system: CARD_GEN_SYSTEM, messages: [{ role: 'user', content: prompt }] }) })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      const ts = Date.now()
      const newCards = parsed.map((c, i) => ({
        ...c, id: `${category}_ai_${ts}_${i}`, langA, langB, source: `ai-${category}`, createdAt: ts,
        targetLang: langB, tense: c.tense || 'present',
      }))
      const updatedAiCards = [...(myData?.aiCards || []), ...newCards]
      const updatedProgress = { ...(myData?.cardProgress || {}) }
      newCards.forEach(c => { updatedProgress[c.id] = { interval: 0, consecutiveRight: 0, wrongSessions: 0, nextReview: todayStr() } })
      await updateDoc(doc(db, 'users', user.uid), { aiCards: updatedAiCards, cardProgress: updatedProgress })
      setMyData(d => ({ ...d, aiCards: updatedAiCards, cardProgress: updatedProgress }))
      setEmptyCategoryMsg(isMarkLang ? 'Erste Phrasen bereit ✓' : 'First phrases ready ✓')
      setTimeout(() => setEmptyCategoryMsg(null), 2000)
      const sessionCards = newCards.flatMap(buildCardPair)
      const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)
      const sess = shuffle(sessionCards).slice(0, SESSION_SIZE)
      setCurrentSessionMode(category)
      setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
    } catch(e) {
      setEmptyCategoryMsg(isMarkLang ? 'KI-Generierung fehlgeschlagen.' : 'AI generation failed.')
      setTimeout(() => setEmptyCategoryMsg(null), 3000)
    }
  }

  const generateUrlaubCards = async () => {
    const langA = activeToLang || 'en'
    const fromLangCode = lang
    const _LNF = { en: 'English', de: 'German', sw: 'Swahili', th: 'Thai', es: 'Spanish', fr: 'French' }
    const toLangFull = _LNF[langA] || langA
    const fromLangFull = _LNF[fromLangCode] || fromLangCode
    setEmptyCategoryMsg(isMarkLang ? '✈️ Im Urlaub — KI erstellt Reisephrasen…' : '✈️ Travel — AI creating phrases…')

    // Check weekly shared pool before calling AI
    const poolUrlaub = await fetchSharedCards(fromLangCode, langA)
    const poolUrlaubFiltered = poolUrlaub?.filter(c => c.category === 'urlaub' || !c.category)
    if (poolUrlaubFiltered?.length > 0) {
      const ts = Date.now()
      const newCards = poolUrlaubFiltered.filter(c => c.front && c.back).slice(0, 10).map((c, i) => ({
        ...c, id: `urlaub_pool_${ts}_${i}`, langA: fromLangCode, langB: langA, category: 'urlaub', source: 'weekly-pool', createdAt: ts,
      }))
      if (newCards.length > 0) {
        const updatedAiCards = [...(myData?.aiCards || []), ...newCards]
        const updatedProgress = { ...(myData?.cardProgress || {}) }
        newCards.forEach(c => { updatedProgress[c.id] = { interval: 0, consecutiveRight: 0, wrongSessions: 0, nextReview: todayStr() } })
        await updateDoc(doc(db, 'users', user.uid), { aiCards: updatedAiCards, cardProgress: updatedProgress })
        setMyData(d => ({ ...d, aiCards: updatedAiCards, cardProgress: updatedProgress }))
        setEmptyCategoryMsg(t.travelReady || 'Reisephrasen bereit ✓')
        setTimeout(() => setEmptyCategoryMsg(null), 2000)
        const sessionCards = isPremium ? newCards : newCards.slice(0, 3)
        const sess = [...sessionCards.flatMap(buildCardPair)].sort(() => Math.random() - 0.5).slice(0, SESSION_SIZE)
        setCurrentSessionMode('urlaub')
        setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
        return
      }
    }

    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 900, system: CARD_GEN_SYSTEM,
          messages: [{ role: 'user', content: `Generate 10 essential travel phrases for a ${fromLangFull} speaker in a ${toLangFull}-speaking country. Cover: hotel check-in, ordering food, asking directions, emergencies, transport, shopping, banking. Natural, practical, not textbook. Front language: ${fromLangFull}. Back language: ${toLangFull}. Return ONLY a valid JSON array: [{"front":"...","back":"...","pronunciation":"...","category":"urlaub","tense":"present","register":"formal"}]` }]
        })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      const ts = Date.now()
      const newCards = parsed.filter(c => c.front && c.back).map((c, i) => ({
        ...c, id: `urlaub_ai_${ts}_${i}`, langA: fromLangCode, langB: langA, category: 'urlaub', source: 'ai-urlaub', createdAt: ts
      }))
      const updatedAiCards = [...(myData?.aiCards || []), ...newCards]
      const updatedProgress = { ...(myData?.cardProgress || {}) }
      newCards.forEach(c => { updatedProgress[c.id] = { interval: 0, consecutiveRight: 0, wrongSessions: 0, nextReview: todayStr() } })
      await updateDoc(doc(db, 'users', user.uid), { aiCards: updatedAiCards, cardProgress: updatedProgress })
      setMyData(d => ({ ...d, aiCards: updatedAiCards, cardProgress: updatedProgress }))
      setEmptyCategoryMsg(isMarkLang ? 'Reisephrasen bereit ✓' : 'Travel phrases ready ✓')
      setTimeout(() => setEmptyCategoryMsg(null), 2000)
      const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)
      const sessionCards = isPremium ? newCards : newCards.slice(0, 3)
      const sess = shuffle(sessionCards.flatMap(buildCardPair)).slice(0, SESSION_SIZE)
      setCurrentSessionMode('urlaub')
      setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
    } catch(e) {
      setEmptyCategoryMsg(isMarkLang ? 'KI-Generierung fehlgeschlagen.' : 'AI generation failed.')
      setTimeout(() => setEmptyCategoryMsg(null), 3000)
    }
  }

  const startCategorySession = (category) => {
    console.log('[Vocara] startCategorySession:', category)
    // ── MEINE WORTE HARD FILTER ─────────────────────────────────
    // Only single-word or max 2-word fronts are allowed in vocabulary.
    // basics are always excluded. Any sentence slipping through is rejected here.
    const vocabGuard = (c) => {
      if (c.category === 'basics') return false
      return (
        c.category === 'vocabulary' && !c.front?.trim().includes(' ')
      ) || (
        c.category === 'vocabulary' && c.front?.trim().split(' ').length <= 2
      )
    }
    const cards = category === 'all'
      ? activeCards
      : category === 'vocabulary'
        ? activeCards.filter(c => {
            const pass = vocabGuard(c)
            if (!pass && c.category === 'vocabulary') {
              console.log(`[Meine Worte GUARD] silently rejected: "${c.front}" (${c.front?.trim().split(' ').length} words)`)
            }
            return pass
          })
        : activeCards.filter(c => c.category === category)
    if (category !== 'all') {
      const excluded = activeCards.filter(c => c.category !== category)
      console.log('[Vocara] cards in category:', cards.length, '| excluded:', excluded.length, '| total:', activeCards.length)
      excluded.slice(0, 20).forEach(c => console.log(`  [filtered out] "${c.front}" → category:${c.category} id:${c.id}`))
    } else {
      console.log('[Vocara] cards (all):', cards.length)
    }
    if (category === 'vocabulary' && cards.length < 5) {
      generateVocabWords(cards) // pass existing cards so they're included in the session
      return
    }
    if (category === 'urlaub' && cards.length < 10) { generateUrlaubCards(); return }
    if (cards.length === 0) {
      if (category === 'street') { generateCategoryCards('street'); return }
      if (category === 'home') { generateCategoryCards('home'); return }
      setEmptyCategoryMsg(isMarkLang ? 'Hier wartet noch nichts — aber das ändert sich.' : 'Nothing here yet — but that changes now.')
      setTimeout(() => setEmptyCategoryMsg(null), 3500)
      return
    }
    const sp = myData?.sessionProgress
    if (sp?.mode === category && sp.cardIds?.length > 0) {
      setResumeDialog({ category, cards })
      return
    }
    const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)
    // Percentage-based mixing: target languages (toLangs) and source languages (fromLangs)
    const toLangsConfig = myData?.toLangs
    const fromLangsConfig = myData?.fromLangs
    let sess
    if (fromLangsConfig && fromLangsConfig.length > 1) {
      // Source-language weighted mixing: cards by langA
      const mixed = []
      for (const { lang: lc, percent } of fromLangsConfig) {
        const langCards = cards.filter(c => (c.langA || '').toLowerCase() === lc)
        if (langCards.length === 0) continue
        const count = Math.max(1, Math.round(percent / 100 * SESSION_SIZE))
        const built = buildSession(langCards, cardProgress)
        mixed.push(...(built.length > 0 ? built.slice(0, count) : shuffle(langCards).slice(0, count)))
      }
      sess = mixed.length > 0 ? shuffle(mixed).slice(0, SESSION_SIZE) : buildSession(cards, cardProgress)
    } else if (toLangsConfig && toLangsConfig.length > 1) {
      const mixed = []
      for (const { lang: lc, percent } of toLangsConfig) {
        const langCards = cards.filter(c => (c.langB || c.targetLang || '').toLowerCase() === lc || (c.langA || '').toLowerCase() === lc)
        const count = Math.max(1, Math.round(percent / 100 * SESSION_SIZE))
        const built = buildSession(langCards, cardProgress)
        mixed.push(...(built.length > 0 ? built.slice(0, count) : shuffle(langCards).slice(0, count)))
      }
      sess = shuffle(mixed).slice(0, SESSION_SIZE)
    } else {
      sess = buildSession(cards, cardProgress)
    }
    console.log('[Vocara] buildSession result:', sess.length)
    // Fallback: if nothing is due (all reviewed, none overdue), practice all category cards
    if (sess.length === 0) {
      sess = shuffle(cards).slice(0, SESSION_SIZE)
      console.log('[Vocara] fallback session (all cards):', sess.length)
    }
    if (sess.length === 0) return
    setCurrentSessionMode(category)
    // Show Wort des Tages banner for 2s before starting any session
    const startSession = () => {
      setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
      if (['vocabulary', 'street', 'home', 'basics', 'urlaub'].includes(category)) markAreaDone(category)
    }
    if (wordOfDay) {
      setWordOfDayBanner(wordOfDay)
      setTimeout(() => { setWordOfDayBanner(null); startSession() }, 2000)
    } else {
      startSession()
    }
  }
  const startBasicsSession = async () => {
    const existingBasics = activeCards.filter(c => c.category === 'basics')
    if (existingBasics.length > 0) {
      const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)
      const sess = buildSession(existingBasics, cardProgress)
      const finalSess = sess.length > 0 ? sess : shuffle(existingBasics).slice(0, SESSION_SIZE)
      setCurrentSessionMode('basics'); setSession(finalSess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
      markAreaDone('basics'); return
    }
    setBasicsLoading(true)
    const isMarkLang = lang === 'de'
    const langA = isMarkLang ? 'de' : 'en'
    const langB = isMarkLang ? 'en' : 'de'
    const toLangName = isMarkLang ? 'English' : 'German'
    const fromLangName = isMarkLang ? 'German' : 'English'
    // Try base pool first (api/generate-base-pool.js pre-populated Firestore)
    const poolBasics = await fetchGrundlagenPool(langA, langB, 1)
    if (poolBasics?.length > 0) {
      const ts = Date.now()
      const newCards = poolBasics.filter(c => c.front && c.back).slice(0, 20).map((c, i) => ({
        ...c, id: `basics_pool_${ts}_${i}`, langA, langB, category: 'basics', source: 'base-pool', createdAt: ts
      }))
      const updatedAiCards = [...(myData?.aiCards || []), ...newCards]
      const updatedProgress = { ...(myData?.cardProgress || {}) }
      newCards.forEach(c => { updatedProgress[c.id] = { interval: 0, consecutiveRight: 0, wrongSessions: 0, nextReview: todayStr() } })
      await updateDoc(doc(db, 'users', user.uid), { aiCards: updatedAiCards, cardProgress: updatedProgress })
      setMyData(d => ({ ...d, aiCards: updatedAiCards, cardProgress: updatedProgress }))
      const sess = [...newCards].sort(() => Math.random() - 0.5).slice(0, SESSION_SIZE)
      setCurrentSessionMode('basics'); setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
      markAreaDone('basics'); setBasicsLoading(false); return
    }
    const prompt = `Generate exactly 12 basic vocabulary flashcards covering: colors (rot/red, blau/blue, grün/green, gelb/yellow), numbers (1-5), shapes (Kreis/circle, Quadrat/square), and basic greetings (Hallo, Danke, Bitte).
Front language: ${fromLangName}. Back language: ${toLangName}. Category: basics.
Return ONLY valid JSON array: [{"front":"...","back":"...","category":"basics","context":"..."}]`
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 800, system: CARD_GEN_SYSTEM, messages: [{ role: 'user', content: prompt }] }) })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      const ts = Date.now()
      const newCards = parsed.map((c, i) => ({ ...c, id: `basics_${ts}_${i}`, langA, langB, source: 'ai-basics', createdAt: ts }))
      const updatedAiCards = [...(myData?.aiCards || []), ...newCards]
      await updateDoc(doc(db, 'users', user.uid), { aiCards: updatedAiCards })
      setMyData(d => ({ ...d, aiCards: updatedAiCards }))
      const sess = [...newCards].sort(() => Math.random() - 0.5).slice(0, SESSION_SIZE)
      setCurrentSessionMode('basics'); setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
      markAreaDone('basics')
    } catch(e) { console.warn('Failed to generate basics:', e) }
    setBasicsLoading(false)
  }

  const startSatzSession = async () => {
    // Free tier: 5 satz sessions / month
    if (!isPremium) {
      const nowMonth = new Date().toISOString().slice(0, 7)
      const used = myData?.satzMonthStr === nowMonth ? (myData?.satzMonthCount || 0) : 0
      if (used >= 5) {
        setSoftPaywall({ area: 'satz', used, limit: 5 })
        setDoc(doc(db, 'users', user.uid, 'usage', 'satz'), { used, limit: 5, month: nowMonth }, { merge: true }).catch(() => {})
        return
      }
      const newCount = used + 1
      updateDoc(doc(db, 'users', user.uid), { satzMonthCount: newCount, satzMonthStr: nowMonth }).catch(() => {})
      setMyData(d => ({ ...d, satzMonthCount: newCount, satzMonthStr: nowMonth }))
    }
    const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili' }
    // Only cards with mastery >= 2 (answered correctly at least twice = interval >= 2)
    const knownVocabCards = activeCards.filter(c =>
      c.category === 'vocabulary' &&
      !/_r(_\d+)?$/.test(c.id) &&
      (cardProgress[c.id]?.interval || 0) >= 2
    )
    if (knownVocabCards.length < 5) {
      setEmptyCategoryMsg(isMarkLang
        ? `Lerne zuerst mehr Wörter — du brauchst 5 gefestigte Wörter (du hast ${knownVocabCards.length}).`
        : `Learn more words first — need 5 solid words (you have ${knownVocabCards.length}).`)
      setTimeout(() => setEmptyCategoryMsg(null), 3500)
      return
    }
    setSatzLoading(true)
    try {
      // Use the toLang text (back) — the target language words the user has actually learned
      const wordList = knownVocabCards.map(c => c.back).slice(0, 60).join(', ')
      const toLangCode = isMarkLang ? 'de' : 'en'
      const fromLangCode = isMarkLang ? 'en' : 'de'
      const toLangName = LANG_NAMES[toLangCode]
      const fromLangName = LANG_NAMES[fromLangCode]
      const prompt = `You are a language learning assistant. The user knows these words and phrases in ${toLangName}: ${wordList}

Build exactly 5 short, natural, everyday sentences in ${toLangName} using vocabulary from that list plus only basic grammar words (articles, prepositions, conjunctions, common verbs). Max 8 words per sentence.

For each sentence also write the ${fromLangName} translation.

Return ONLY a valid JSON array with no markdown or explanation:
[{"front":"<sentence in ${fromLangName}>","back":"<sentence in ${toLangName}>","context":"<1 sentence explaining when you'd say this>"}]`

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 800, system: CARD_GEN_SYSTEM, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      const raw = data.content?.[0]?.text || ''
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
      const ts = Date.now()
      const sessionCards = parsed.slice(0, 5).map((card, i) => ({
        id: `satz_temp_${ts}_${i}`,
        front: card.front,
        back: card.back,
        context: card.context || '',
        category: 'sentence',
        langA: fromLangCode,
        langB: toLangCode,
        targetLang: toLangCode,
        source: 'satz-session',
      }))
      setCurrentSessionMode('sentence')
      if (wordOfDay) {
        setWordOfDayBanner(wordOfDay)
        setTimeout(() => {
          setWordOfDayBanner(null)
          setSession(sessionCards); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
          markAreaDone('sentence')
        }, 2000)
      } else {
        setSession(sessionCards); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
        markAreaDone('sentence')
      }
    } catch (e) {
      console.warn('Satz session generation failed:', e)
      setEmptyCategoryMsg(isMarkLang ? 'Fehler beim Generieren der Sätze.' : 'Failed to generate sentences.')
      setTimeout(() => setEmptyCategoryMsg(null), 3500)
    } finally {
      setSatzLoading(false)
    }
  }
  const continueSession = async () => {
    const { category, cards } = resumeDialog
    const answeredSet = new Set(myData?.sessionProgress?.cardIds || [])
    const remaining = cards.filter(c => !answeredSet.has(c.id))
    const pool = remaining.length > 0 ? remaining : cards
    const sess = buildSession(pool, cardProgress)
    try { await updateDoc(doc(db, 'users', user.uid), { sessionProgress: null }); setMyData(d => ({ ...d, sessionProgress: null })) } catch (e) {}
    setCurrentSessionMode(category)
    setResumeDialog(null)
    if (sess.length === 0) return
    setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
  }
  const startFresh = async () => {
    const { category, cards } = resumeDialog
    try { await updateDoc(doc(db, 'users', user.uid), { sessionProgress: null }); setMyData(d => ({ ...d, sessionProgress: null })) } catch (e) {}
    const sess = buildSession(cards, cardProgress)
    setCurrentSessionMode(category)
    setResumeDialog(null)
    if (sess.length === 0) return
    setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
  }
  const resumeSession = () => {
    if (!pendingSession) return
    setSession(pendingSession.queue); setResumeStartIndex(pendingSession.index || 0)
    setResumeStartProgress(pendingSession.newProgress || null); setPendingSession(null); setScreen('cards')
  }
  const discardSession = async () => { await clearSessionState(user.uid); setPendingSession(null) }
  const handleSessionStop = async (finalProgress, answeredCount) => {
    setScreen('menu'); setSession(null)
    if (answeredCount > 0) {
      try {
        await onSaveProgress(finalProgress)
        const msg = `${answeredCount} Karte${answeredCount !== 1 ? 'n' : ''} gespeichert ✓`
        setStopToast(msg)
        setTimeout(() => setStopToast(null), 3000)
      } catch(e) { console.warn('handleSessionStop save failed:', e) }
    }
  }
  const markAreaDone = (area) => {
    const currentWeek = getISOWeekStr()
    setWeeklyGoals(prev => {
      const base = prev?.week === currentWeek ? prev : { week: currentWeek, completed: [] }
      if (base.completed.includes(area)) return base
      const updated = { week: currentWeek, completed: [...base.completed, area] }
      updateDoc(doc(db, 'users', user.uid), { weeklyGoals: updated }).catch(() => {})
      if (updated.completed.length === 5) {
        const currentMonth = new Date().toISOString().slice(0, 7)
        const storedMonthly = myData?.monthlyGoal || {}
        const prevCompleted = storedMonthly.lastUnlock === currentMonth ? 0 : (storedMonthly.completedWeeks || 0)
        const newWeekCount = prevCompleted + 1
        setWeekGoalCelebration(true)
        try { if (navigator.vibrate) navigator.vibrate(300) } catch(e) {}
        setTimeout(() => setWeekGoalCelebration(false), 4500)
        if (newWeekCount >= 5) {
          const newGimmicks = (myData?.unlockedGimmicks || 0) + 1
          const newMonthly = { completedWeeks: 0, lastUnlock: currentMonth }
          const gimmickEntry = { theme, date: todayStr() }
          const gimmickHistory = [...(myData?.gimmickHistory || []), gimmickEntry]
          updateDoc(doc(db, 'users', user.uid), { monthlyGoal: newMonthly, unlockedGimmicks: newGimmicks, weeklyGoals: updated, gimmickHistory }).catch(() => {})
          setMyData(d => ({ ...d, monthlyGoal: newMonthly, unlockedGimmicks: newGimmicks, weeklyGoals: updated, gimmickHistory }))
          setMonthlyUnlockNotification(true)
          setTimeout(() => setMonthlyUnlockNotification(false), 5000)
          setGimmickPopup(true)
          setTimeout(() => setGimmickPopup(false), 6000)
        } else {
          const newMonthly = { completedWeeks: newWeekCount, lastUnlock: storedMonthly.lastUnlock || null }
          updateDoc(doc(db, 'users', user.uid), { monthlyGoal: newMonthly, weeklyGoals: updated }).catch(() => {})
          setMyData(d => ({ ...d, monthlyGoal: newMonthly, weeklyGoals: updated }))
        }
      } else {
        setMyData(d => ({ ...d, weeklyGoals: updated }))
      }
      return updated
    })
  }
  const submitMiniTask = async () => {
    if (!miniTaskInput.trim() || !miniTask) return
    setMiniTaskLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: 80,
          messages: [{ role: 'user', content: `The user was asked to use "${miniTask.word}" in a sentence. They wrote: "${miniTaskInput.trim()}". In 1 short sentence in ${isMarkLang ? 'German' : 'English'}, give brief encouraging grammar feedback. Be kind and very concise.` }]
        })
      })
      const data = await res.json()
      const feedback = data.content?.[0]?.text?.trim() || ''
      const updated = { ...miniTask, done: true, answer: miniTaskInput.trim(), feedback }
      setMiniTask(updated); setMiniTaskInput('')
      await updateDoc(doc(db, 'users', user.uid), { miniTask: updated }).catch(() => {})
      setMyData(d => ({ ...d, miniTask: updated }))
    } catch (e) { console.warn('miniTask submit failed:', e) }
    finally { setMiniTaskLoading(false) }
  }

  const handleStreakFreeze = async () => {
    const month = new Date().toISOString().slice(0, 7)
    const update = { streakFreeze: { available: false, lastReset: month, usedAt: todayStr() } }
    try {
      await updateDoc(doc(db, 'users', user.uid), update)
      setMyData(d => ({ ...d, ...update }))
      setFreezeAvailable(false)
    } catch (e) { console.warn('Streak freeze failed:', e) }
  }

  const handleSaveState = async (queue, index, newProgress) => { await saveSessionState(user.uid, queue, index, newProgress) }
  const saveSessionProgress = async (cardIds, mode) => {
    const sp = { cardIds, mode, timestamp: Date.now() }
    try { await updateDoc(doc(db, 'users', user.uid), { sessionProgress: sp }); setMyData(d => ({ ...d, sessionProgress: sp })) } catch (e) { console.warn('Session progress save failed:', e) }
  }
  const generateAICards = async () => {
    const homeCity = myData?.homeCity || (isMarkLang ? 'Hamburg' : 'Nairobi')
    const partnerCity = myData?.partnerCity || (isMarkLang ? 'Nairobi' : 'Hamburg')
    const existingAI = myData?.aiCards || []
    const knownFrontsSet = new Set((allCards || []).map(c => c.front.toLowerCase().trim()))

    // Enforce 80/20 ratio: at most 1 SW card per 5 generated
    const totalAIAfter = existingAI.length + 5
    const maxSW = Math.floor(totalAIAfter * 0.2)
    const currentAISW = existingAI.filter(c => c.langA === 'sw').length
    const swCount = isMarkLang ? Math.min(1, Math.max(0, maxSW - currentAISW)) : 0

    const requests = isMarkLang
      ? [
          { langA: 'en', langB: 'de', count: 5 - swCount },
          ...(swCount > 0 ? [{ langA: 'sw', langB: 'de', count: swCount }] : []),
        ]
      : [{ langA: 'de', langB: 'en', count: 5 }]

    const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili' }
    let allNewCards = []
    const ts = Date.now()

    // Exclusion list: single/2-word fronts only (sending phrases confuses the AI)
    const knownFrontsArr = [...knownFrontsSet].filter(f => f.split(' ').length <= 2)

    // In vocabulary mode (85% mastery from vocab session): generate single words, not phrases
    const isVocabMode = currentSessionMode === 'vocabulary'

    for (const req of requests) {
      const knownList = knownFrontsArr.slice(0, 80).join(', ')
      const isSwahili = req.langA === 'sw'
      const isEnglish = req.langA === 'en'
      const needsPronunciation = isSwahili || isEnglish

      let prompt
      if (isVocabMode) {
        // Vocab mode: single words only, same as generateVocabWords
        prompt = isMarkLang
          ? `Generate 10 useful single English words for a German speaker learning English.
NOT phrases, NOT sentences — only single words or simple infinitives like 'to run'.
Avoid these already known words: ${knownList}
Return ONLY JSON: [{"front": "English word", "back": "Deutsche Übersetzung", "category": "vocabulary"}]`
          : `Generate 10 useful single German words for an English speaker learning German.
NOT phrases, NOT sentences — only single words or simple infinitives like 'to run'.
Avoid these already known words: ${knownList}
Return ONLY JSON: [{"front": "German word", "back": "English translation", "category": "vocabulary"}]`
      } else {
        prompt = `Generate exactly ${req.count} vocabulary flashcard${req.count > 1 ? 's' : ''} for a language learner.
Front language: ${LANG_NAMES[req.langA]}
Back language: ${LANG_NAMES[req.langB]}
Learner's home city: ${homeCity}
Partner's city: ${partnerCity}

Rules:
- Choose common, useful everyday phrases or expressions (intermediate level, not basic words like "hello")
- The "context" field: 1-2 sentences in ${LANG_NAMES[req.langB]} telling a short personal story that mentions ${homeCity} and/or ${partnerCity}
- Avoid these already known phrases: ${knownList}
- Return ONLY a valid JSON array, no markdown, no explanation${isSwahili ? `
- Add a "pronunciation" field with German-phonetic pronunciation guide for the Swahili front text
- German phonetics only: "a" like German "Vater", "e" like "Bett", "i" like "mit", rolled "r"
- No English sounds — never use "ay", "oh", "ee"; use "e", "o", "i" instead
- Example: "habari" → "ha-BA-ri", "asante" → "a-SAN-te"` : ''}${isEnglish ? `
- Add a "pronunciation" field with German-friendly phonetic spelling for the English front text
- Use German phonetics: "ä" for short "e", "i" for "ee", "o" for "oh", syllable breaks with "-", stress with CAPS
- Example: "weather" → "WE-dser", "thought" → "Ssot", "through" → "Ssru"` : ''}

Format: [{"front":"...","back":"...","context":"...","category":"..."${needsPronunciation ? ',"pronunciation":"..."' : ''}}]`
      }

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 600, system: CARD_GEN_SYSTEM, messages: [{ role: 'user', content: prompt }] }),
        })
        const data = await res.json()
        const raw = data.content?.[0]?.text || ''
        const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
        parsed.slice(0, req.count).forEach((card, i) => {
          allNewCards.push({
            id: `ai_${req.langA}_${ts}_${i}`,
            front: card.front,
            back: card.back,
            context: card.context || '',
            category: VALID_CATEGORY_SET.has(card.category) ? card.category : 'vocabulary',
            langA: req.langA,
            langB: req.langB,
            source: 'ai-generated',
            createdAt: ts,
            ...(card.pronunciation ? { pronunciation: card.pronunciation } : {}),
          })
        })
      } catch (e) {
        console.warn('AI card generation failed for', req.langA, e)
      }
    }

    // In vocab mode: reject any phrase that slipped through (must be single word or "to X")
    if (isVocabMode) {
      allNewCards = allNewCards.filter(card => {
        const words = (card.front || '').trim().split(' ').filter(Boolean)
        const isInfinitive = words.length === 2 && words[0].toLowerCase() === 'to'
        if (words.length > 2 || (words.length > 1 && !isInfinitive)) {
          console.log('[generateAICards] Vocab mode: rejected phrase:', card.front)
          return false
        }
        return true
      })
    }
    // Deduplicate by exact front text (case-insensitive)
    allNewCards = allNewCards.filter(card => {
      const key = card.front.toLowerCase().trim()
      if (knownFrontsSet.has(key)) {
        console.log('[generateAICards] Card skipped (duplicate front):', card.front)
        return false
      }
      knownFrontsSet.add(key)
      return true
    })
    if (allNewCards.length === 0) {
      console.log('[generateAICards] All cards were duplicates — nothing to save')
      return
    }

    console.log(`[generateAICards] Attempting to save ${allNewCards.length} cards:`, allNewCards.map(c => c.front))

    const newProgressEntries = {}
    allNewCards.forEach(card => {
      newProgressEntries[card.id] = { interval: 0, consecutiveFast: 0, wrongSessions: 0, nextReview: todayStr() }
    })

    const doSave = async () => {
      // Fetch FRESH data from Firestore to avoid race condition with onSaveProgress
      const freshSnap = await getDoc(doc(db, 'users', user.uid))
      const freshData = freshSnap.exists() ? freshSnap.data() : {}
      const freshAiCards = freshData.aiCards || []
      const freshProgress = freshData.cardProgress || {}

      // Deduplicate again against current Firestore state (handles race with other tabs/saves)
      const firestoreFronts = new Set(freshAiCards.map(c => (c.front || '').toLowerCase().trim()))
      const cardsToSave = allNewCards.filter(c => {
        const key = c.front.toLowerCase().trim()
        if (firestoreFronts.has(key)) {
          console.log('[generateAICards] Skipping (already in Firestore):', c.front)
          return false
        }
        return true
      })
      if (cardsToSave.length === 0) {
        console.log('[generateAICards] All cards already exist in Firestore — skipping write')
        return { success: true, count: 0 }
      }

      const updatedAiCards = [...freshAiCards, ...cardsToSave]
      // Merge fresh Firestore progress with new entries — never lose existing progress
      const updatedProgress = { ...freshProgress, ...newProgressEntries }

      cardsToSave.forEach(c => console.log('[generateAICards] Saving:', c.front, '| id:', c.id, '| category:', c.category))
      await updateDoc(doc(db, 'users', user.uid), { aiCards: updatedAiCards, cardProgress: updatedProgress })
      cardsToSave.forEach(c => console.log('[generateAICards] Saved successfully:', c.front))
      return { success: true, count: cardsToSave.length, updatedAiCards, updatedProgress }
    }

    try {
      let result = await doSave()
      if (!result.success) throw new Error('Save returned unsuccessful')

      // Retry once if something went wrong
      if (result.count === 0) {
        console.log('[generateAICards] No cards saved on first attempt — retrying once')
        result = await doSave()
      }

      // Force re-fetch to ensure local state matches Firestore exactly
      const snap = await getDoc(doc(db, 'users', user.uid))
      const fresh = snap.exists() ? snap.data() : {}
      console.log(`[generateAICards] Firestore now has ${fresh.aiCards?.length ?? 0} AI cards, ${Object.keys(fresh.cardProgress || {}).length} progress entries`)
      setMyData(d => ({
        ...d,
        aiCards: fresh.aiCards || d.aiCards,
        cardProgress: fresh.cardProgress || d.cardProgress,
      }))
      if (result.count > 0) {
        const msg = isMarkLang
          ? `✨ ${result.count} neue KI-Karten hinzugefügt!`
          : `✨ ${result.count} new AI cards added!`
        setAiNotification(msg)
        setTimeout(() => setAiNotification(null), 4000)
      }
    } catch (e) {
      console.error('[generateAICards] Save failed:', e)
      // One final retry
      try {
        console.log('[generateAICards] Final retry after error...')
        await doSave()
        console.log('[generateAICards] Final retry succeeded')
      } catch (e2) {
        console.error('[generateAICards] Final retry also failed:', e2)
      }
    }
  }

  const handleFinish = async (finalProgress, correct, wrong, easy, fast, cardStats) => {
    let unlocked = false
    if (checkMastery(allCards, finalProgress, correct, correct + wrong)) {
      const newBatch = getNextNewCards(allCards, finalProgress, NEW_CARDS_BATCH)
      if (newBatch.length > 0) {
        newBatch.forEach(card => {
          // New cards available immediately
          finalProgress[card.id] = { interval: 0, consecutiveFast: 0, wrongSessions: 0, nextReview: todayStr() }
        })
        unlocked = true
      }
      generateAICards()
    }
    setMasteryUnlocked(unlocked)
    await onSaveProgress(finalProgress)
    // ── Learning time tracking ─────────────────────────────
    const sessionMinutes = Math.max(1, Math.round((correct + wrong) * 30 / 60))
    const nowMonth = new Date().toISOString().slice(0, 7)
    const nowWeek = getISOWeekStr()
    const prevMonthly = myData?.learningMonth === nowMonth ? (myData?.monthlyMinutes || 0) : 0
    const prevWeekly = myData?.learningWeek === nowWeek ? (myData?.weeklyMinutes || 0) : 0
    const newMonthlyMinutes = prevMonthly + sessionMinutes
    const newWeeklyMinutes = prevWeekly + sessionMinutes
    const newTotalMinutes = (myData?.totalMinutes || 0) + sessionMinutes
    const timeUpdate = { monthlyMinutes: newMonthlyMinutes, weeklyMinutes: newWeeklyMinutes, totalMinutes: newTotalMinutes, learningMonth: nowMonth, learningWeek: nowWeek }
    const updatedHistory = await saveSessionHistory(user.uid, correct, correct + wrong, sessionHistory, timeUpdate, currentSessionMode)
    setMyData(d => ({ ...d, sessionHistory: updatedHistory, ...timeUpdate }))
    // Publish full stats to public profile so partner can read them
    const myMasteredNow = Object.values(finalProgress).filter(p => (p?.interval || 0) >= 7).length
    const myStreakNow = calcStreak([...(sessionHistory || []), { date: todayStr(), correct, total: correct + wrong }])
    const pubStats = { weeklyMinutes: newWeeklyMinutes, monthlyMinutes: newMonthlyMinutes, totalMinutes: newTotalMinutes, learningWeek: nowWeek, learningMonth: nowMonth, totalCards: allCards.filter(c => !/_r(_\d+)?$/.test(c.id)).length, masteredCards: myMasteredNow, streak: myStreakNow, lastActive: todayStr(), name: user.displayName?.split(' ')[0] || 'Partner' }
    setDoc(doc(db, 'userProfiles', user.uid), pubStats, { merge: true }).catch(() => {})
    setDoc(doc(db, 'users', user.uid, 'profile', 'data'), pubStats, { merge: true }).catch(() => {})
    // Notify partner of activity via Firestore pendingNotifs subcollection
    if (myData?.partnerUID) {
      const notifId = `session_${user.uid}_${Date.now()}`
      setDoc(doc(db, 'userProfiles', myData.partnerUID, 'pendingNotifs', notifId), {
        type: 'partner_session', fromName: user.displayName?.split(' ')[0] || 'Partner',
        cards: correct + wrong, ts: Date.now()
      }).catch(() => {})
    }
    await clearSessionState(user.uid)
    const statsEntries = Object.entries(cardStats || {})
    const weakestEntry = statsEntries.filter(([, v]) => v.wrongs > 0).sort((a, b) => b[1].wrongs - a[1].wrongs)[0]
    const strongestEntry = statsEntries.filter(([, v]) => v.wrongs === 0 && v.fastestMs < Infinity).sort((a, b) => a[1].fastestMs - b[1].fastestMs)[0]
    const weakestCard = weakestEntry ? session?.find(c => c.id === weakestEntry[0]) : null
    const strongestCard = strongestEntry ? session?.find(c => c.id === strongestEntry[0]) : null
    // ── Kontext: find a card mastered in this session (interval >= 3)
    const masteredInSession = session?.filter(c => !/_r(_\d+)?$/.test(c.id) && (finalProgress[c.id]?.interval || 0) >= 3) || []
    const kontextCard = masteredInSession.length > 0 ? masteredInSession[Math.floor(Math.random() * masteredInSession.length)] : null
    setResult({
      correct, wrong, easy: easy || 0, fast: fast || 0, weakestCard, strongestCard, originalSession: session,
      showRhythmus: currentSessionMode === 'sentence',
      urlaubNote: currentSessionMode === 'urlaub' && !isPremium,
      kontextCard,
    })
    // Refresh tutor with fresh progress & history so due counts are accurate post-session
    fetchTutorMsg(finalProgress, updatedHistory)
    setSessionCompleteCount(n => n + 1)
    setScreen('result')
  }

  if (screen === 'cards' && session) return <>{homeFloat}<CardScreen user={user} session={session} onBack={() => setScreen('menu')} onFinish={handleFinish} lang={lang} cardProgress={cardProgress} s={s} onSaveState={handleSaveState} onSaveSessionProgress={saveSessionProgress} onStop={handleSessionStop} onSaveExample={handleSaveExample} mode={currentSessionMode} startIndex={resumeStartIndex} startProgress={resumeStartProgress} userToLang={activeToLang} socialRegister={myData?.socialRegister || 'friends'} onNeverLearn={(card) => setNeverLearnModal(card)} onKontext={(card) => { setKontextCard(card); setKontextPrevScreen('cards'); setScreen('kontext') }} /></>
  if (screen === 'rhythmus') return <>{homeFloat}<RhythmusScreen lang={lang} theme={theme} onBack={() => { setScreen('result') }} allCards={allCards} cardProgress={cardProgress} userToLang={activeToLang} t={t} /></>
  if (screen === 'kontext' && kontextCard) return <>{homeFloat}<KontextwechselScreen card={kontextCard} lang={lang} theme={theme} userToLang={activeToLang} user={user} onBack={() => setScreen(kontextPrevScreen)} onSaveCard={async (newCard) => { const updated = [...(myData?.aiCards || []), newCard]; await updateDoc(doc(db, 'users', user.uid), { aiCards: updated }).catch(() => {}); setMyData(d => ({ ...d, aiCards: updated })) }} t={t} /></>
  if (screen === 'result' && result) return <>{homeFloat}<ResultScreen correct={result.correct} wrong={result.wrong} fast={result.fast} easy={result.easy} weakestCard={result.weakestCard} strongestCard={result.strongestCard} masteryUnlocked={masteryUnlocked} showRhythmus={result.showRhythmus} urlaubNote={result.urlaubNote} kontextCard={result.kontextCard} onUnlockUrlaub={() => setSoftPaywall({ area: 'urlaub', used: 3, limit: 10 })} onRhythmus={() => setScreen('rhythmus')} onKontext={result.kontextCard ? () => { setKontextCard(result.kontextCard); setKontextPrevScreen('result'); setScreen('kontext') } : null} t={t} lang={lang} onBack={() => { setScreen('menu'); setSession(null) }} onReplay={result.originalSession ? () => { setSession(result.originalSession); setResumeStartIndex(0); setResumeStartProgress(null); setScreen('cards') } : null} s={s} th={th} /></>
  if (screen === 'settings') return <>{homeFloat}<SettingsScreen t={t} s={s} theme={theme} onThemeChange={onThemeChange} onBack={() => setScreen('menu')} user={user} myData={myData} setMyData={setMyData} allCards={allCards} lang={lang} onPartner={() => setScreen('partner')} onLightModeChange={onLightModeChange} onCardSizeChange={onCardSizeChange} musicEnabled={musicEnabled} musicVolume={musicVolume} onMusicToggle={onMusicToggle} onMusicVolume={onMusicVolume} /></>
  if (screen === 'meinekarten') return <>{homeFloat}<MeineKartenScreen user={user} myData={myData} setMyData={setMyData} allCards={allCards} cardProgress={cardProgress} lang={lang} theme={theme} onBack={() => setScreen('menu')} /></>
  if (screen === 'geschenkkarte') return <>{homeFloat}<GeschenkkarteScreen user={user} myData={myData} lang={lang} theme={theme} onBack={() => setScreen('menu')} allCards={allCards} cardProgress={cardProgress} /></>
  if (screen === 'karteerstellen') return <>{homeFloat}<KarteErstellenScreen user={user} myData={myData} setMyData={setMyData} allCards={allCards} lang={lang} theme={theme} onBack={() => setScreen('menu')} socialRegister={myData?.socialRegister || 'friends'} t={t} /></>
  if (screen === 'partner') return <>{homeFloat}<PartnerScreen user={user} myData={myData} lang={lang} theme={theme} onBack={() => setScreen('menu')} onPartnerUpdate={(uid) => { onPartnerUpdate(uid); setScreen('menu') }} /></>
  if (screen === 'test') return <>{homeFloat}<PlacementTest lang={lang} theme={theme} user={user} onBack={() => setScreen('menu')} onSaveCefr={onSaveCefr} /></>
  if (screen === 'impressum') return <>{homeFloat}<ImpressumScreen lang={lang} theme={theme} onBack={() => setScreen('menu')} /></>
  if (screen === 'stats') return <>{homeFloat}<StatsScreen user={user} myData={myData} partnerData={partnerData} allCards={allCards} lang={lang} theme={theme} onBack={() => setScreen('menu')} cardProgress={cardProgress} t={t} /></>
  if (screen === 'ki') return <>{homeFloat}<KiGespraechScreen lang={lang} theme={theme} onBack={() => setScreen('menu')} userName={user.displayName?.split(' ')[0] || 'du'} userToLang={activeToLang} socialRegister={myData?.socialRegister || 'friends'} myData={myData} partnerData={partnerData} user={user} t={t} /></>
  if (screen === 'satz') return <>{homeFloat}<SatzTrainingScreen lang={lang} theme={theme} onBack={() => setScreen('menu')} allCards={allCards} cardProgress={cardProgress} userName={user.displayName?.split(' ')[0] || 'du'} userToLang={activeToLang} t={t} /></>
  if (screen === 'diary') return <>{homeFloat}<DiaryScreen user={user} myData={myData} setMyData={setMyData} partnerData={partnerData} lang={lang} theme={theme} onBack={() => setScreen('menu')} /></>
  if (screen === 'admin' && user.uid === MARK_UID) return <>{homeFloat}<AdminScreen user={user} lang={lang} theme={theme} onBack={() => setScreen('menu')} /></>

  return (
    <div style={s.container} className="vocara-screen vocara-home-outer"><div style={{ ...s.homeBox, paddingTop: '12px' }} className="vocara-home-box">

      {/* ── LOGO ── */}
      <div className="vocara-logo-section" style={{ textAlign: 'center', paddingTop: '16px', paddingBottom: '10px', position: 'relative' }}>
        {onMusicToggle && (
          <button
            onClick={() => onMusicToggle(!musicEnabled)}
            title={musicEnabled ? (isMarkLang ? 'Musik aus' : 'Music off') : (isMarkLang ? 'Musik an' : 'Music on')}
            style={{ position: 'absolute', top: 0, right: 0, background: musicEnabled ? `${th.accent}22` : 'transparent', border: `1px solid ${musicEnabled ? th.accent : th.border}`, borderRadius: '10px', padding: '5px 9px', color: musicEnabled ? th.accent : th.sub, fontSize: '1rem', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', lineHeight: 1 }}>
            {musicEnabled ? '🎵' : '🔇'}
          </button>
        )}
        <p style={{ fontFamily: 'Georgia, serif', fontSize: '42px', fontWeight: '700', color: '#FFD700', margin: '0 auto', letterSpacing: '3px', lineHeight: 1 }}>Vocara</p>
        <p style={{ color: th.sub, fontSize: '0.55rem', opacity: 0.3, margin: '2px 0 0', letterSpacing: '1px', textAlign: 'center' }}>{APP_VERSION}</p>
        <p className="vocara-logo-greeting" style={{ ...s.greeting, marginTop: '8px', marginBottom: uniqueTargetLangs.length > 0 ? '6px' : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
          {t.hello}, {firstName}
          {partnerActivityStatus && (
            <span style={{ fontSize: '0.72rem', color: partnerActivityStatus.color, fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              {partnerActivityStatus.dot} {partnerActivityStatus.label}
            </span>
          )}
        </p>
      </div>

      {/* ── MONTHLY TEST BANNER ── */}
      {testDue && (
        <button onClick={() => setScreen('test')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: `${th.card}88`, border: `1px solid ${th.border}`, borderRadius: '10px', padding: '8px 12px', marginBottom: '10px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
          <span style={{ color: th.sub, fontSize: '0.75rem' }}>🎯 {isMarkLang ? 'Level-Check verfügbar' : 'Level check available'}</span>
          <span style={{ color: th.sub, fontSize: '0.72rem', opacity: 0.6 }}>→</span>
        </button>
      )}

      {/* ── KI-TUTOR PANEL ── */}
      {coachMsg !== null && (
        <div style={{ background: `${th.card}bb`, border: `1px solid ${th.gold}33`, borderRadius: '14px', padding: '11px 15px', marginBottom: '12px', animation: 'vocaraFadeIn 0.4s ease both' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: tutorCollapsed ? 0 : '5px' }}>
            <span style={{ color: th.gold, fontSize: '0.62rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>🎓 {isMarkLang ? 'KI-Tutor' : 'AI Tutor'}{tutorCollapsed ? ' ▸' : ''}</span>
            {!tutorCollapsed && calcStreak(sessionHistory) > 0 && (
              <span style={{ color: th.sub, fontSize: '0.62rem', marginLeft: 'auto', opacity: 0.55 }}>🔥 {calcStreak(sessionHistory)} {isMarkLang ? 'Tage' : 'days'}</span>
            )}
            <button onClick={async () => {
              const next = !tutorCollapsed
              setTutorCollapsed(next)
              updateDoc(doc(db, 'users', user.uid), { tutorCollapsed: next }).catch(() => {})
            }} style={{ background: 'transparent', border: 'none', color: th.sub, cursor: 'pointer', fontSize: '0.75rem', padding: '0 0 0 8px', marginLeft: tutorCollapsed ? 'auto' : '8px', opacity: 0.6, WebkitTapHighlightColor: 'transparent' }}>
              {tutorCollapsed ? '＋' : '−'}
            </button>
          </div>
          {!tutorCollapsed && (
            <>
              {coachMsg
                ? <p style={{ color: th.text, fontSize: '0.84rem', fontStyle: 'italic', margin: 0, lineHeight: 1.55, opacity: 0.88 }}>{coachMsg.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ')}</p>
                : <p style={{ color: th.sub, fontSize: '0.8rem', margin: 0, opacity: 0.5 }}>…</p>
              }
              {coachMsg && tutorRecommendedArea && (
                <button onClick={() => {
                  if (tutorRecommendedArea === 'sentence') { startSatzSession() }
                  else if (tutorRecommendedArea === 'ki') { setScreen('ki') }
                  else if (tutorRecommendedArea === 'diary') { setScreen('diary') }
                  else { startCategorySession(tutorRecommendedArea) }
                }} style={{ marginTop: '8px', background: `${th.gold}18`, border: `1px solid ${th.gold}44`, color: th.gold, borderRadius: '20px', padding: '4px 12px', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                  ▶ {isMarkLang ? 'Starten' : 'Start'}
                </button>
              )}
              {(() => {
                const todayDiaryDone = !!(myData?.diaryEntries?.find(e => e.date === todayStr()))
                if (!todayDiaryDone) return (
                  <button onClick={() => setScreen('diary')} style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '5px', background: `${th.gold}14`, border: `1px solid ${th.gold}30`, borderRadius: '20px', color: th.gold, fontSize: '0.72rem', fontWeight: '600', cursor: 'pointer', padding: '4px 12px', WebkitTapHighlightColor: 'transparent', opacity: 0.85 }}>
                    📔 {isMarkLang ? 'Tagebuch schreiben →' : 'Write diary →'}
                  </button>
                )
                return null
              })()}
            </>
          )}
        </div>
      )}

      {/* ── STREAK WARNING ── */}
      {streakStatus === 'warning' && (
        <div style={{ background: 'rgba(255,165,0,0.10)', border: '1px solid rgba(255,165,0,0.45)', borderRadius: '14px', padding: '12px 14px', marginBottom: '12px', animation: 'vocaraFadeIn 0.4s ease both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.1rem' }}>⚠️</span>
            <span style={{ color: '#FFA500', fontWeight: '700', fontSize: '0.9rem', flex: 1 }}>{isMarkLang ? 'Die Verbindung braucht dich heute.' : 'Your streak needs you today.'}</span>
            {freezeAvailable && (
              <button
                onClick={() => { if (window.confirm(isMarkLang ? 'Streak Freeze jetzt verwenden? (1x/Monat)' : 'Use Streak Freeze now? (1x/month)')) handleStreakFreeze() }}
                style={{ background: 'rgba(100,200,255,0.12)', border: '1px solid rgba(100,200,255,0.35)', color: '#7ec8e3', borderRadius: '20px', padding: '5px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700', whiteSpace: 'nowrap', flexShrink: 0 }}
              >🧊</button>
            )}
          </div>
          <button
            onClick={() => {
              const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)
              const quick = shuffle(activeCards.filter(c => cardProgress[c.id]?.nextReview <= today || !cardProgress[c.id])).slice(0, 5)
              if (quick.length === 0) return
              setCurrentSessionMode('all'); setSession(quick); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
            }}
            style={{ background: 'linear-gradient(135deg, rgba(255,165,0,0.25), rgba(255,165,0,0.12))', border: '1px solid rgba(255,165,0,0.5)', color: '#FFA500', borderRadius: '20px', padding: '8px 16px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: '700', width: '100%', fontFamily: 'inherit' }}
          >
            ⚡ {isMarkLang ? 'Jetzt lernen →' : 'Learn now →'} (5 {isMarkLang ? 'Karten' : 'cards'})
          </button>
        </div>
      )}
      {streakStatus === 'lost' && (
        <div style={{ background: 'rgba(136,136,136,0.1)', border: `1px solid ${th.border}`, borderRadius: '12px', padding: '10px 14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: th.sub, fontWeight: '600', fontSize: '0.88rem' }}>{isMarkLang ? 'Streak verloren — neu starten! 💪' : 'Streak lost — start fresh! 💪'}</span>
        </div>
      )}

      {/* ── TAGES-KARTE ── */}
      {(() => {
        if (!dailyCard || dailyCardDismissed) return null
        const relEmoji = { couple: '💑', friends: '👫', family: '👨‍👩‍👧', colleagues: '👔' }[dailyCard.relType] || '✨'
        return (
          <div style={{ background: `${th.gold}0D`, border: `1px solid ${th.gold}2E`, borderRadius: '16px', padding: '13px 15px', marginBottom: '12px', animation: 'vocaraFadeIn 0.4s ease both', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
              <span style={{ color: th.gold, fontSize: '0.68rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                {relEmoji} {isMarkLang ? 'Karte des Tages' : 'Card of the day'}
              </span>
              <button onClick={() => setDailyCardDismissed(true)} style={{ background: 'transparent', border: 'none', color: th.sub, cursor: 'pointer', fontSize: '0.9rem', padding: '0 2px', lineHeight: 1 }}>✕</button>
            </div>
            {(() => {
              // Always show DE on top, EN below for Mark; for others show front/back as-is
              const deSide = dailyCard.langA === 'de' ? dailyCard.front : dailyCard.langB === 'de' ? dailyCard.back : dailyCard.front
              const enSide = dailyCard.langA === 'en' ? dailyCard.front : dailyCard.langB === 'en' ? dailyCard.back : dailyCard.back
              const topText = isMarkLang ? deSide : dailyCard.front
              const botText = isMarkLang ? enSide : dailyCard.back
              // Truncate context to max 2 sentences, skip if UI is DE (context tends to be in EN)
              const rawCtx = dailyCard.context || ''
              const ctxSentences = rawCtx.split(/(?<=[.!?])\s+/).filter(Boolean)
              const ctxTrimmed = ctxSentences.slice(0, 2).join(' ')
              const showCtx = !isMarkLang && ctxTrimmed
              return (
                <>
                  <p style={{ color: th.text, fontWeight: '700', margin: '0 0 3px', fontSize: '0.92rem' }}>{topText}</p>
                  <p style={{ color: th.accent, fontWeight: '600', margin: showCtx ? '0 0 3px' : 0, fontSize: '1rem' }}>{botText}</p>
                  {showCtx && <p style={{ color: th.sub, fontSize: '0.75rem', fontStyle: 'italic', margin: 0, lineHeight: 1.4 }}>„{ctxTrimmed}"</p>}
                </>
              )
            })()}
          </div>
        )
      })()}

      {/* ── SESSION RESUME DIALOG ── */}
      {resumeDialog && (
        <div style={{ ...s.resumeBanner, marginBottom: '12px' }}>
          <p style={{ color: th.text, margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: '600' }}>
            {t.resumeTitle}
          </p>
          <p style={{ color: th.sub, margin: '0 0 10px 0', fontSize: '0.8rem' }}>
            {(myData?.sessionProgress?.cardIds?.length || 0)} Karten bereits beantwortet
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ ...s.button, marginBottom: 0, flex: 1, padding: '10px' }} onClick={continueSession}>{t.resumeContinue}</button>
            <button style={{ ...s.logoutBtn, marginTop: 0, flex: 1, padding: '10px', textAlign: 'center' }} onClick={startFresh}>{t.resumeDiscard}</button>
          </div>
        </div>
      )}

      {/* ── PENDING SESSION BANNER ── */}
      {pendingSession && (
        <div style={{ ...s.resumeBanner, marginBottom: '12px' }}>
          <p style={{ color: th.text, margin: '0 0 10px 0', fontSize: '0.9rem' }}>
            {t.resumeTitle} — {pendingSession.index ?? '?'} {t.resumeOf} {pendingSession.queue?.length ?? '?'} {t.resumeCards}
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ ...s.button, marginBottom: 0, flex: 1, padding: '10px' }} onClick={resumeSession}>{t.resumeContinue}</button>
            <button style={{ ...s.logoutBtn, marginTop: 0, flex: 1, padding: '10px', textAlign: 'center' }} onClick={discardSession}>{t.resumeDiscard}</button>
          </div>
        </div>
      )}

      {/* ── CARD CONTEXT MENU (long-press) ── */}
      {neverLearnModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setNeverLearnModal(null)}>
          <div style={{ ...s.card, maxWidth: '340px', width: '100%', padding: '20px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <p style={{ color: th.sub, fontSize: '0.78rem', marginBottom: '4px', opacity: 0.7 }}>
              „{neverLearnModal.front}"
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px' }}>
              {/* Favorit */}
              <button style={{ ...s.button, marginBottom: 0, padding: '11px', background: 'rgba(255,215,0,0.12)', color: th.gold, border: `1px solid rgba(255,215,0,0.35)`, textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={async () => {
                const cardId = neverLearnModal.id
                const isFav = !!(myData?.favoriteCards?.[cardId])
                const updated = { ...(myData?.favoriteCards || {}) }
                if (isFav) delete updated[cardId]; else updated[cardId] = true
                try {
                  await updateDoc(doc(db, 'users', user.uid), { favoriteCards: updated })
                  setMyData(d => ({ ...d, favoriteCards: updated }))
                } catch(e) {}
                setNeverLearnModal(null)
              }}>
                <span>⭐</span>
                <span>{myData?.favoriteCards?.[neverLearnModal.id] ? (isMarkLang ? 'Favorit entfernen' : 'Remove favourite') : (isMarkLang ? 'Als Favorit markieren' : 'Mark as favourite')}</span>
              </button>
              {/* Nie wieder lernen */}
              <button style={{ ...s.button, marginBottom: 0, padding: '11px', background: 'rgba(244,67,54,0.10)', color: '#f44336', border: '1px solid rgba(244,67,54,0.35)', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={async () => {
                const cardId = neverLearnModal.id
                try {
                  const excl = { ...(myData?.excludedCards || {}), [cardId]: true }
                  await updateDoc(doc(db, 'users', user.uid), { excludedCards: excl })
                  setMyData(d => ({ ...d, excludedCards: excl }))
                } catch (e) { console.warn('excludeCard failed:', e) }
                setNeverLearnModal(null)
              }}>
                <span>🚫</span>
                <span>{isMarkLang ? 'Nie wieder lernen' : 'Never learn again'}</span>
              </button>
              {/* Abbrechen */}
              <button style={{ ...s.logoutBtn, marginTop: 0, padding: '10px', textAlign: 'center' }} onClick={() => setNeverLearnModal(null)}>{t.cancel}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6-BUTTON GRID ── */}
      {(() => {
        // Soft hint badge for free users near limit
        const freeBadge = (category) => {
          if (isPremium) return null
          const limit = FREE_LIMITS[category]
          if (!limit) return null
          const used = freeUsed(category)
          if (used === 0) return null
          return (
            <div style={{ position: 'absolute', bottom: '5px', right: '6px', background: used >= limit ? `${th.gold}22` : 'rgba(0,0,0,0.35)', borderRadius: '8px', padding: '1px 5px', pointerEvents: 'none' }}>
              <span style={{ color: used >= limit ? th.gold : 'rgba(255,255,255,0.55)', fontSize: '0.58rem', fontWeight: '700' }}>{used}/{limit}</span>
            </div>
          )
        }
        // Stufen badge: 10-level system per category
        const levelBadge = (category) => {
          const n = safeCards.filter(c => {
            const baseId = c.id.replace(/_r(_\d+)?$/, '')
            return c.category === category && !/_r(_\d+)?$/.test(c.id) && (cardProgress[baseId]?.interval || cardProgress[c.id]?.interval || 0) >= 3
          }).length
          if (n === 0) return null
          // Category-specific level thresholds
          let lv
          if (category === 'urlaub') {
            lv = Math.min(10, Math.floor(n / 6))  // 60% of 10 cards = 6 mastered per level
          } else if (category === 'home') {
            lv = Math.min(10, Math.floor(n / 8))  // 80% of 10 cards = 8 mastered per level
          } else {
            lv = getCatLevel(n)
          }
          if (lv === 0) return null
          const col = CAT_LEVEL_COLORS[Math.min(lv, CAT_LEVEL_COLORS.length - 1)] || '#81c784'
          return (
            <div style={{ position: 'absolute', top: '5px', left: '6px', background: 'rgba(0,0,0,0.45)', borderRadius: '6px', padding: '2px 6px', pointerEvents: 'none' }}>
              <span style={{ color: col, fontSize: '0.54rem', fontWeight: '700', display: 'block', lineHeight: 1.2 }}>Lvl {lv}/10</span>
            </div>
          )
        }
        return (
          <div className="vocara-cat-grid" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="vocara-cat-btn" style={{ ...s.catBtn, '--gleam-delay': '0s', position: 'relative' }} onClick={() => startCategorySession('vocabulary')}>
                {t.menuWorte.split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
                {levelBadge('vocabulary')}
              </button>
              <button className="vocara-cat-btn" style={{ ...s.catBtn, '--gleam-delay': '1.8s', opacity: satzLoading ? 0.6 : 1, position: 'relative' }} onClick={startSatzSession} disabled={satzLoading}>
                {satzLoading ? '...' : t.menuSaetze.split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
                {!satzLoading && levelBadge('sentence')}
              </button>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="vocara-cat-btn" style={{ ...s.catBtn, '--gleam-delay': '3.5s', position: 'relative' }}
                onClick={() => checkFreeLimit('street') && startCategorySession('street')}>
                {t.menuStraße.split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
                {levelBadge('street')}{freeBadge('street')}
              </button>
              <button className="vocara-cat-btn" style={{ ...s.catBtn, '--gleam-delay': '5.2s', position: 'relative' }}
                onClick={() => checkFreeLimit('home') && startCategorySession('home')}>
                {t.menuHause.split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
                {levelBadge('home')}{freeBadge('home')}
              </button>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="vocara-cat-btn" style={{ ...s.catBtn, '--gleam-delay': '6.8s', opacity: basicsLoading ? 0.6 : 1, position: 'relative' }}
                onClick={startBasicsSession} disabled={basicsLoading}>
                {basicsLoading ? '...' : (t.menuGrundlagen || 'Die\nGrundlagen').split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
                {!basicsLoading && levelBadge('basics')}
              </button>
              <button className="vocara-cat-btn" style={{ ...s.catBtn, '--gleam-delay': '8.2s', position: 'relative' }}
                onClick={() => checkFreeLimit('urlaub') && startCategorySession('urlaub')}>
                {(t.menuUrlaub || 'Im\nUrlaub').split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
                {levelBadge('urlaub')}{freeBadge('urlaub')}
              </button>
            </div>
            {/* ── MEINE THEMEN BUTTON ── */}
            {(() => {
              const unlockedTopics = myData?.unlockedTopics || []
              const anyLvl2 = ['vocabulary','street','home','sentence','basics'].some(cat => {
                const n = safeCards.filter(c => c.category === cat && !/_r(_\d+)?$/.test(c.id) && (cardProgress[c.id?.replace(/_r(_\d+)?$/,'')]?.interval || cardProgress[c.id]?.interval || 0) >= 3).length
                return getCatLevel(n) >= 2
              })
              const topicsUnlocked = isPremium || anyLvl2
              const topicCards = safeCards.filter(c => c.topic && (unlockedTopics.includes(c.topic) || topicsUnlocked) && !excludedCardIds.has(c.id))
              if (topicCards.length === 0 && !topicsUnlocked) return null
              return (
                <button className="vocara-cat-btn" style={{ ...s.catBtn, '--gleam-delay': '9.5s', position: 'relative', width: '100%', justifyContent: 'center', background: `linear-gradient(135deg, ${th.accent}22, ${th.gold}15)`, border: `1px solid ${th.accent}44` }}
                  onClick={() => {
                    if (!topicsUnlocked) { setSoftPaywall({ area: 'topics', used: 0, limit: 1 }); return }
                    if (topicCards.length === 0) { setScreen('settings'); return }
                    const sess = [...topicCards.flatMap(buildCardPair)].sort(() => Math.random() - 0.5).slice(0, SESSION_SIZE)
                    setCurrentSessionMode('topics'); setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
                  }}>
                  <span>Meine{'\n'}Themen</span>
                  {topicCards.length > 0 && <div style={{ position: 'absolute', top: '5px', left: '6px', background: 'rgba(0,0,0,0.45)', borderRadius: '6px', padding: '2px 6px' }}><span style={{ color: th.accent, fontSize: '0.54rem', fontWeight: '700' }}>{topicCards.length}</span></div>}
                </button>
              )
            })()}
            <button className="vocara-alle-btn" style={{ ...s.button, padding: '13px 28px', fontSize: '0.9rem', letterSpacing: '0.2px', marginBottom: 0, '--gleam-delay': '2.5s' }} onClick={() => startCategorySession('all')}>
              {t.menuAlle}
            </button>
          </div>
        )
      })()}


      {/* ── TÄGLICHES LERNZIEL ── */}
      <div style={{ marginBottom: '14px', padding: '0 2px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
          <span style={{ color: th.sub, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{isMarkLang ? 'Tagesziel' : 'Daily goal'}</span>
          <span style={{ color: todayCorrect >= dailyGoal ? th.accent : th.sub, fontSize: '0.7rem', fontWeight: todayCorrect >= dailyGoal ? '700' : '400' }}>
            {todayCorrect >= dailyGoal ? '✓ ' : ''}{todayCorrect} / {dailyGoal}
          </span>
        </div>
        <div style={{ height: '3px', background: th.border, borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, (todayCorrect / dailyGoal) * 100)}%`, background: todayCorrect >= dailyGoal ? th.accent : th.gold, borderRadius: '2px', transition: 'width 0.5s ease' }} />
        </div>
      </div>

      {/* ── TÄGLICHE MINIAUFGABE ── */}
      {miniTask && (
        <div style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: '14px', padding: '11px 13px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: miniTask.done ? '#4CAF50' : th.gold }}>
              {miniTask.done ? '✅' : '⚡'} {isMarkLang ? 'Aufgabe des Tages' : 'Task of the day'}
            </span>
          </div>
          {!miniTask.done ? (
            <>
              <p style={{ color: th.text, fontSize: '0.85rem', margin: '0 0 7px', lineHeight: 1.4 }}>
                {isMarkLang ? `Benutze „${miniTask.word}" in einem Satz:` : `Use "${miniTask.word}" in a sentence:`}
              </p>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: `1px solid ${th.border}`, borderRadius: '10px', padding: '8px 12px', color: th.text, fontSize: '0.83rem', outline: 'none', fontFamily: "'Inter', system-ui, sans-serif" }}
                  placeholder={isMarkLang ? 'Schreib deinen Satz…' : 'Write your sentence…'}
                  value={miniTaskInput}
                  onChange={e => setMiniTaskInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitMiniTask()}
                />
                <button
                  onClick={submitMiniTask}
                  disabled={!miniTaskInput.trim() || miniTaskLoading}
                  style={{ background: `${th.accent}22`, border: `1px solid ${th.accent}55`, color: th.text, borderRadius: '10px', padding: '8px 14px', cursor: miniTaskInput.trim() && !miniTaskLoading ? 'pointer' : 'default', fontSize: '0.82rem', fontWeight: '600', opacity: miniTaskLoading ? 0.6 : 1 }}
                >{miniTaskLoading ? '…' : '→'}</button>
              </div>
              {miniTask.feedback && <p style={{ color: '#81c784', fontSize: '0.75rem', margin: '6px 0 0', lineHeight: 1.4 }}>💡 {miniTask.feedback}</p>}
            </>
          ) : (
            <div>
              <p style={{ color: '#4CAF50', fontSize: '0.85rem', margin: 0, fontStyle: 'italic' }}>„{miniTask.answer}"</p>
              {miniTask.feedback && <p style={{ color: th.sub, fontSize: '0.75rem', margin: '4px 0 0', lineHeight: 1.4 }}>💡 {miniTask.feedback}</p>}
            </div>
          )}
        </div>
      )}

      {/* ── WOCHENZIEL DOTS ── */}
      <div className="vocara-dots-row" style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '20px', alignItems: 'flex-start' }}>
        {WEEK_AREAS.map(area => {
          const done = weeklyGoals.completed.includes(area.key)
          const active = dotTooltip === area.key
          return (
            <div key={area.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
              onClick={() => setDotTooltip(active ? null : area.key)}>
              <div style={{
                width: '22px', height: '22px', borderRadius: '50%',
                background: done ? '#00BFA5' : 'transparent',
                border: done ? 'none' : '2px solid rgba(180,180,200,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.3s ease',
                boxShadow: done ? '0 0 10px rgba(0,191,165,0.4)' : 'none',
                animation: done ? 'dotPop 0.4s ease both' : 'none',
                flexShrink: 0,
              }}>
                {done && <span style={{ color: '#fff', fontSize: '11px', fontWeight: '900', lineHeight: 1 }}>✓</span>}
              </div>
              <span style={{ fontSize: '8px', color: done ? '#00BFA5' : th.sub, fontWeight: done ? '700' : '400', textAlign: 'center', lineHeight: 1.2, maxWidth: '46px', transition: 'color 0.3s ease' }}>
                {lang === 'de' ? area.labelDe : area.labelEn}
              </span>
              {active && (
                <span style={{ fontSize: '7.5px', color: done ? '#4CAF50' : th.sub, textAlign: 'center', maxWidth: '60px', lineHeight: 1.3, padding: '3px 6px', background: th.card, border: `1px solid ${th.border}`, borderRadius: '6px', marginTop: '2px', animation: 'vocaraFadeIn 0.2s ease both' }}>
                  {done ? (isMarkLang ? '✓ Diese Woche geübt' : '✓ Practiced this week') : (lang === 'de' ? area.tipDe : area.tipEn)}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* ── GOLDEN CARDS COUNT (#20) ── */}
      {(() => {
        const goldenCount = Object.values(cardProgress).filter(p => p?.isGolden).length
        if (goldenCount === 0) return null
        return (
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={{ color: 'rgba(255,215,0,0.8)', fontSize: '0.78rem', fontWeight: '700', letterSpacing: '0.3px', animation: 'goldShimmer 2.4s ease-in-out infinite', display: 'inline-block', padding: '3px 10px', borderRadius: '20px', border: '1px solid rgba(255,215,0,0.28)', background: 'rgba(255,215,0,0.06)' }}>
              ⭐ {goldenCount} {isMarkLang ? 'goldene Karte' + (goldenCount !== 1 ? 'n' : '') + ' gemeistert' : `golden card${goldenCount !== 1 ? 's' : ''} mastered`}
            </span>
          </div>
        )
      })()}

      {/* ── KI-TANK ENERGIE-BALKEN ── */}
      {(() => {
        const nowWeek = getISOWeekStr()
        const usedKi = myData?.kiWeekStr === nowWeek ? (myData?.kiWeekCount || 0) : 0
        const kiLimit = 3
        const pct = isPremium ? 100 : Math.max(0, Math.round(((kiLimit - usedKi) / kiLimit) * 100))
        const barColor = usedKi >= kiLimit ? '#555' : '#00BFA5'
        return (
          <div style={{ marginBottom: '14px', padding: '10px 14px', background: th.card, border: `1px solid ${th.border}`, borderRadius: '14px', cursor: 'pointer' }}
            onClick={() => { if (!isPremium && usedKi >= kiLimit) setSoftPaywall({ area: 'ki', used: usedKi, limit: kiLimit, weekly: true }) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ color: th.text, fontSize: '0.78rem', fontWeight: '600' }}>⚡ KI-Tank</span>
              <span style={{ color: isPremium ? '#00BFA5' : usedKi >= kiLimit ? '#666' : '#00BFA5', fontSize: '0.75rem', fontWeight: '600' }}>
                {isPremium ? (isMarkLang ? 'Unbegrenzt' : 'Unlimited') : `${kiLimit - usedKi}/${kiLimit} ${isMarkLang ? 'diese Woche' : 'this week'}`}
              </span>
            </div>
            <div style={{ height: '4px', background: th.border, borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '4px', transition: 'width 0.5s ease' }} />
            </div>
          </div>
        )
      })()}


      {/* ── SECONDARY NAVIGATION ── */}
      <div className="vocara-nav-section" style={{ marginTop: '4px', marginBottom: '10px' }}>
        <button className="vocara-nav-btn" style={{ ...s.navBtn, opacity: satzLoading ? 0.6 : 1 }} onClick={startSatzSession} disabled={satzLoading}>
          ✍️ {satzLoading ? '…' : t.menuSatz}
        </button>
        <button className="vocara-nav-btn" style={s.navBtn} onClick={() => {
          if (!isPremium) {
            const nowWeek = getISOWeekStr()
            const usedThisWeek = myData?.kiWeekStr === nowWeek ? (myData?.kiWeekCount || 0) : 0
            if (usedThisWeek >= 3) {
              setSoftPaywall({ area: 'ki', used: usedThisWeek, limit: 3, weekly: true })
              return
            }
            const newCount = usedThisWeek + 1
            updateDoc(doc(db, 'users', user.uid), { kiWeekCount: newCount, kiWeekStr: nowWeek }).catch(() => {})
            setMyData(d => ({ ...d, kiWeekCount: newCount, kiWeekStr: nowWeek }))
          }
          setScreen('ki')
        }}>{t.menuKi}{!isPremium && (() => { const w = getISOWeekStr(); const n = myData?.kiWeekStr === w ? (myData?.kiWeekCount || 0) : 0; return n > 0 ? ` (${n}/3)` : '' })()}</button>
        <button className="vocara-nav-btn" style={s.navBtn} onClick={() => setScreen('stats')}>
          {t.progressBtn}
          <span style={{ marginLeft: '6px', fontSize: '0.76rem', color: th.gold }}>
            {getLevelName(myMasteredCount, lang)}
          </span>
          {cefr && (
            <span style={{ marginLeft: '4px', fontFamily: 'monospace', fontSize: '0.75rem', color: CEFR_COLORS[cefr] || th.accent }}>
              · {cefr} {cefrBar} {cefrPct}%
            </span>
          )}
        </button>
        <button className="vocara-nav-btn" style={s.navBtn} onClick={() => setScreen('diary')}>
          📖 {isMarkLang ? 'Unser Tagebuch' : 'Our Diary'}
        </button>
        <button className="vocara-nav-btn" style={s.navBtn} onClick={() => setScreen('partner')}>
          {myData?.partnerUID ? `${t.menuPartnerLabel}: ${partnerName}` : t.menuPartnerConnect}
        </button>
        <button className="vocara-nav-btn" style={s.navBtn} onClick={() => setScreen('karteerstellen')}>＋ {isMarkLang ? 'Karte kreieren' : 'Create card'}</button>
        <button className="vocara-nav-btn" style={s.navBtn} onClick={() => setScreen('meinekarten')}>📋 {isMarkLang ? 'Meine Karten' : 'My Cards'}</button>
        {myData?.partnerUID && <button className="vocara-nav-btn" style={s.navBtn} onClick={() => setScreen('geschenkkarte')}>🎁 {isMarkLang ? 'Geschenkkarte senden' : 'Send gift card'}</button>}
        <button className="vocara-nav-btn" style={s.navBtn} onClick={() => setScreen('settings')}>{t.menuSettings}</button>
        <button className="vocara-nav-btn" style={{ ...s.navBtn, marginBottom: 0 }} onClick={() => signOut(auth)}>{t.menuSignOut}</button>
      </div>

      <button style={s.legalBtn} onClick={() => setScreen('impressum')}>{t.impressumLink}</button>
      {user.uid === MARK_UID && (
        <button onClick={() => setScreen('admin')} style={{ background: 'transparent', border: 'none', color: th.sub, cursor: 'pointer', fontSize: '0.65rem', opacity: 0.3, padding: '2px 8px', display: 'block', width: '100%', textAlign: 'center', marginTop: '2px', fontFamily: "'Inter', system-ui, sans-serif" }}>
          ⚙ Admin
        </button>
      )}
      <button
        onClick={() => setScreen('impressum')}
        style={{ background: 'transparent', border: 'none', color: th.sub, cursor: 'pointer', fontSize: '0.68rem', opacity: 0.38, padding: '4px 8px', display: 'block', width: '100%', textAlign: 'center', marginTop: '2px', marginBottom: '6px', fontFamily: "'Inter', system-ui, sans-serif" }}
      >
        🇩🇪 Made in Germany · {APP_VERSION}
      </button>

      {stopToast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#2e7d32', color: '#fff', padding: '10px 20px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', zIndex: 1001, animation: 'vocaraFadeIn 0.3s ease both', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {stopToast}
        </div>
      )}
      {aiNotification && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: th.accent, color: '#111', padding: '10px 20px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', zIndex: 1000, animation: 'vocaraFadeIn 0.3s ease both', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {aiNotification}
        </div>
      )}
      {emptyCategoryMsg && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: th.card, color: th.text, border: `1px solid ${th.border}`, padding: '12px 20px', borderRadius: '16px', fontSize: '0.85rem', fontWeight: '500', zIndex: 1000, animation: 'vocaraFadeIn 0.3s ease both', maxWidth: '90vw', textAlign: 'center', pointerEvents: 'none' }}>
          {emptyCategoryMsg}
        </div>
      )}
      {weekGoalCelebration && (
        <div style={{ position: 'fixed', bottom: '80px', left: '50%', background: th.accent, color: '#111', padding: '14px 28px', borderRadius: '28px', fontSize: '1rem', fontWeight: 'bold', zIndex: 1000, animation: 'vocaraCelebrate 4.5s ease both', whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: `0 6px 28px ${th.glowColor}AA` }}>
          {t.weekGoalDone}
        </div>
      )}
      {monthlyUnlockNotification && (
        <div style={{ position: 'fixed', bottom: '130px', left: '50%', background: '#FFD700', color: '#111', padding: '14px 28px', borderRadius: '28px', fontSize: '1rem', fontWeight: 'bold', zIndex: 1001, animation: 'vocaraCelebrate 5s ease both', whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 6px 28px rgba(255,215,0,0.6)' }}>
          🎉 {lang === 'de' ? 'Monatsbonus freigeschaltet!' : 'Monthly bonus unlocked!'}
        </div>
      )}

      {/* ── TENSE UNLOCK CELEBRATION ── */}
      {tenseUnlockCelebration && (() => {
        const tl = TENSE_LABELS[tenseUnlockCelebration]
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', animation: 'vocaraFadeIn 0.3s ease both' }}
            onClick={() => setTenseUnlockCelebration(null)}>
            <div style={{ background: th.card, border: `1px solid ${th.accent}66`, borderRadius: '24px', padding: '36px 28px', maxWidth: '340px', width: '100%', textAlign: 'center', animation: 'vocaraFadeIn 0.4s ease both' }}
              onClick={e => e.stopPropagation()}>
              <p style={{ fontSize: '3rem', margin: '0 0 12px', lineHeight: 1 }}>{tl.emoji}</p>
              <p style={{ color: th.accent, fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px' }}>
                {t.tenseUnlocked}
              </p>
              <p style={{ color: th.text, fontSize: '1.4rem', fontWeight: '800', margin: '0 0 8px', fontFamily: "'Playfair Display', Georgia, serif" }}>
                {lang === 'de' ? tl.de : tl.en}
              </p>
              <p style={{ color: th.sub, fontSize: '0.85rem', lineHeight: 1.5, margin: '0 0 24px' }}>
                {lang === 'de'
                  ? tenseUnlockCelebration === 'past'
                    ? `Du hast ${TENSE_THRESHOLDS.past} Karten gemeistert. Ab jetzt erscheinen auch Vergangenheits-Formen in deinen Karten.`
                    : `Du hast ${TENSE_THRESHOLDS.future} Karten gemeistert. Alle drei Zeitformen sind jetzt aktiv.`
                  : tenseUnlockCelebration === 'past'
                    ? `You've mastered ${TENSE_THRESHOLDS.past} cards. Past tense will now appear in your cards.`
                    : `You've mastered ${TENSE_THRESHOLDS.future} cards. All three tenses are now active.`
                }
              </p>
              <button onClick={() => setTenseUnlockCelebration(null)} style={{ ...s.button, marginBottom: 0 }}>
                {t.gotIt}
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── SOFT PAYWALL MODAL ── */}
      {softPaywall && (() => {
        const areaLabels = { street: isMarkLang ? 'Straße' : 'Street', home: isMarkLang ? 'Zuhause' : 'Home', urlaub: isMarkLang ? 'Im Urlaub' : 'Travel', ki: isMarkLang ? 'KI-Gespräch' : 'AI Chat', satz: isMarkLang ? 'Satztraining' : 'Sentence Training' }
        const areaLabel = areaLabels[softPaywall.area] || softPaywall.area
        const isWeekly = softPaywall.weekly
        const limitText = isWeekly
          ? (isMarkLang ? `Du hast ${softPaywall.limit}/${softPaywall.limit} KI-Gespräche diese Woche genutzt` : `You've used ${softPaywall.limit}/${softPaywall.limit} AI chats this week`)
          : (isMarkLang ? `Du hast ${softPaywall.used} von ${softPaywall.limit} kostenlosen ${areaLabel}-Karten genutzt` : `You've used ${softPaywall.used} of ${softPaywall.limit} free ${areaLabel} cards`)
        const cta = isMarkLang ? 'Unbegrenzt mit Premium weitermachen' : 'Go unlimited with Premium'
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 24px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', animation: 'vocaraFadeIn 0.25s ease both' }}
            onClick={() => setSoftPaywall(null)}>
            <div style={{ background: th.card, border: `1px solid ${th.accent}55`, borderRadius: '24px 24px 20px 20px', padding: '28px 24px 20px', maxWidth: '420px', width: '100%', animation: 'vocaraSlideIn 0.3s ease both', boxShadow: `0 -8px 40px ${th.glowColor}44` }}
              onClick={e => e.stopPropagation()}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '2.2rem' }}>✨</span>
                <h3 style={{ color: th.text, fontSize: '1.1rem', fontWeight: '700', margin: '8px 0 6px', fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {isMarkLang ? 'Premium freischalten' : 'Unlock Premium'}
                </h3>
                <p style={{ color: th.sub, fontSize: '0.88rem', margin: 0, lineHeight: 1.5 }}>{limitText}</p>
              </div>
              <div style={{ background: `${th.accent}11`, border: `1px solid ${th.accent}33`, borderRadius: '14px', padding: '14px 16px', marginBottom: '16px' }}>
                <p style={{ color: th.text, fontSize: '0.85rem', margin: 0, lineHeight: 1.6, fontWeight: '500' }}>
                  {cta}
                </p>
                <ul style={{ color: th.sub, fontSize: '0.78rem', margin: '8px 0 0', paddingLeft: '18px', lineHeight: 1.7 }}>
                  <li>{isMarkLang ? 'Alle Lernbereiche unlimitiert' : 'All areas unlimited'}</li>
                  <li>{isMarkLang ? 'Unbegrenzte KI-Gespräche' : 'Unlimited AI conversations'}</li>
                  <li>{isMarkLang ? 'Satztraining ohne Limit' : 'Sentence training without limits'}</li>
                </ul>
              </div>
              <button style={{ width: '100%', background: `linear-gradient(135deg, ${th.accent}, ${th.gold})`, color: '#111', border: 'none', borderRadius: '14px', padding: '13px', fontSize: '0.95rem', fontWeight: '700', cursor: 'pointer', marginBottom: '8px', fontFamily: "'Inter', system-ui, sans-serif" }}
                onClick={() => { setSoftPaywall(null); setScreen('settings') }}>
                {isMarkLang ? 'Premium testen →' : 'Try Premium →'}
              </button>
              <button style={{ width: '100%', background: 'transparent', color: th.sub, border: 'none', borderRadius: '12px', padding: '10px', fontSize: '0.83rem', cursor: 'pointer', fontFamily: "'Inter', system-ui, sans-serif" }}
                onClick={() => setSoftPaywall(null)}>
                {isMarkLang ? 'Vielleicht später' : 'Maybe later'}
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── GIMMICK FREISCHALTUNG POPUP ── */}
      {gimmickPopup && (() => {
        const gimmickContent = {
          hamburg: { emoji: '⚓', title: isMarkLang ? 'Hafen-Gimmick freigeschaltet!' : 'Harbor gimmick unlocked!', desc: isMarkLang ? 'Die Elbe rauscht. Du hast 5 Wochen durchgehalten.' : 'The harbor is yours. 5 weeks completed.', bg: 'linear-gradient(135deg, #0a1a2e, #1a3a5e)', border: '#4ECDC4' },
          nairobi: { emoji: '🌅', title: isMarkLang ? 'Savanna-Gimmick freigeschaltet!' : 'Savanna gimmick unlocked!', desc: isMarkLang ? 'Die Sonne über Nairobi. Deine Stimme trägt weiter.' : 'The savanna glows. Your voice carries further.', bg: 'linear-gradient(135deg, #2d1a00, #5a3800)', border: '#FFB347' },
          welt: { emoji: '🌌', title: isMarkLang ? 'Aurora-Gimmick freigeschaltet!' : 'Aurora gimmick unlocked!', desc: isMarkLang ? 'Ein Nordlicht für deine Sprache. 5 Wochen.' : 'Northern lights for your language. 5 weeks.', bg: 'linear-gradient(135deg, #0a001a, #1a003a)', border: '#B088F9' },
        }
        const g = gimmickContent[theme] || gimmickContent.welt
        const themeAnim = {
          hamburg: (
            [1,2,3].map(i => (
              <div key={i} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: `linear-gradient(${20+i*8}deg, transparent 30%, rgba(255,215,0,${0.12+i*0.04}) 50%, transparent 70%)`, animation: `vocaraRayHamburg ${1.2+i*0.4}s ease ${i*0.3}s both`, pointerEvents: 'none' }} />
            ))
          ),
          nairobi: (
            [10,20,35,50,65,75,88,45].map((left, i) => (
              <div key={i} style={{ position: 'absolute', top: '-5%', left: `${left}%`, width: `${6+i%4*4}px`, height: `${6+i%4*4}px`, borderRadius: '50%', background: `rgba(255,${120+i*10},30,0.75)`, animation: `vocaraNairobiParticle ${1.2+i*0.18}s ease ${i*0.12}s both`, pointerEvents: 'none' }} />
            ))
          ),
          welt: (
            ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#C77DFF','#FF9F43'].map((c, i) => (
              <div key={i} style={{ position: 'absolute', top: '50%', left: '50%', width: '60vw', height: '60vw', marginTop: '-30vw', marginLeft: '-30vw', borderRadius: '50%', background: `radial-gradient(circle, ${c}44 0%, transparent 70%)`, animation: `vocaraAuroraWelt ${1.4+i*0.2}s ease ${i*0.15}s both`, pointerEvents: 'none' }} />
            ))
          ),
        }
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', animation: 'vocaraFadeIn 0.5s ease both', overflow: 'hidden' }}
            onClick={() => setGimmickPopup(false)}>
            {/* Theme-specific animation overlay */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              {themeAnim[theme] || null}
            </div>
            <div style={{ position: 'relative', zIndex: 1, background: g.bg, border: `2px solid ${g.border}`, borderRadius: '24px', padding: '32px 28px', maxWidth: '340px', width: '100%', textAlign: 'center', boxShadow: `0 0 60px ${g.border}55, 0 0 120px ${g.border}22`, animation: 'vocaraFadeIn 0.4s ease 0.15s both' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '12px', animation: 'vocaraCelebrate 1s ease both' }}>{g.emoji}</div>
              <p style={{ color: g.border, fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 8px' }}>🎉 {isMarkLang ? 'Gimmick freigeschaltet' : 'Gimmick unlocked'}</p>
              <p style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '700', margin: '0 0 10px', lineHeight: 1.3 }}>{g.title}</p>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem', fontStyle: 'italic', margin: '0 0 16px', lineHeight: 1.5 }}>{g.desc}</p>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem', margin: 0 }}>{isMarkLang ? 'Tippen zum Schließen' : 'Tap to close'}</p>
            </div>
          </div>
        )
      })()}

      {/* ── PARTNER ACTIVITY BANNER (elegant) ── */}
      {reactionPrompt && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 8900, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px', animation: 'vocaraFadeIn 0.4s ease both' }}>
          <div style={{ background: `${th.card}F0`, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: `1px solid ${th.border}`, width: '100%', maxWidth: '420px', padding: '14px 18px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ color: th.text, fontSize: '0.9rem', margin: 0 }}>
                <span style={{ fontWeight: '700' }}>{reactionPrompt.name}</span>
                {isMarkLang ? ` hat heute ${reactionPrompt.count} Karten gelernt.` : ` learned ${reactionPrompt.count} cards today.`}
              </p>
              <button onClick={() => { setReactionPrompt(null); setShowReplyInput(false); setReplyInput('') }}
                style={{ background: 'transparent', border: 'none', color: th.sub, cursor: 'pointer', fontSize: '1rem', padding: '0 0 0 10px', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }}>✕</button>
            </div>
            {!showReplyInput ? (
              <button onClick={() => setShowReplyInput(true)}
                style={{ marginTop: '8px', background: 'transparent', border: 'none', color: th.gold, fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', padding: 0, WebkitTapHighlightColor: 'transparent' }}>
                ✨ {isMarkLang ? 'Antworten' : 'Reply'}
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px', borderBottom: `1px solid ${th.gold}66`, paddingBottom: '4px' }}>
                <input
                  autoFocus maxLength={20}
                  value={replyInput}
                  onChange={e => setReplyInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') sendPartnerMessage() }}
                  placeholder={isMarkLang ? `Schreib ${reactionPrompt.name} etwas…` : `Write something to ${reactionPrompt.name}…`}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: th.text, fontSize: '0.88rem', padding: '2px 0', fontFamily: "'Inter', sans-serif" }}
                />
                <button onClick={sendPartnerMessage}
                  style={{ background: 'transparent', border: 'none', color: th.gold, cursor: 'pointer', fontSize: '1.1rem', padding: '0 4px', WebkitTapHighlightColor: 'transparent' }}>→</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FLOATING INCOMING WHISPER ── */}
      {floatingMessage && (
        <div style={{ position: 'fixed', top: '14px', left: '50%', transform: 'translateX(-50%)', zIndex: 9200, pointerEvents: 'none', animation: 'vocaraFadeIn 0.5s ease both, vocaraFadeOut 1s ease 7s both', maxWidth: '90vw' }}>
          <div style={{ background: `${th.card}EE`, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${th.gold}44`, borderRadius: '22px', padding: '10px 20px', boxShadow: `0 4px 20px ${th.glowColor}33` }}>
            <p style={{ color: th.text, fontSize: '0.9rem', margin: 0, fontStyle: 'italic' }}>„{floatingMessage}"</p>
          </div>
        </div>
      )}

      {/* ── FLOATING RECEIVED REACTION ── */}
      {floatingReaction && (
        <div style={{ position: 'fixed', top: '22%', left: '50%', transform: 'translateX(-50%)', fontSize: '4rem', zIndex: 9100, pointerEvents: 'none', animation: 'vocaraCelebrate 3.5s ease both' }}>
          {floatingReaction}
        </div>
      )}

      {/* ── WORT DES TAGES BANNER ── */}
      {wordOfDayBanner && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 8800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'vocaraFadeIn 0.4s ease both' }}>
          <div style={{ background: th.card, border: `1px solid ${th.gold}44`, borderRadius: '22px', padding: '28px 24px', maxWidth: '340px', width: '100%', textAlign: 'center', boxShadow: `0 0 40px ${th.glowColor}33` }}>
            <p style={{ color: th.gold, fontSize: '0.72rem', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 12px' }}>{isMarkLang ? "Heute's Wort" : "Word of the day"}</p>
            <p style={{ color: th.text, fontSize: '1.4rem', fontWeight: '700', margin: '0 0 6px' }}>{wordOfDayBanner.front}</p>
            <p style={{ color: th.accent, fontSize: '1rem', margin: '0 0 14px' }}>{wordOfDayBanner.back}</p>
            <p style={{ color: th.sub, fontSize: '0.78rem', margin: 0, lineHeight: 1.5, fontStyle: 'italic' }}>
              {isMarkLang ? '— heute begegnet es dir überall.' : '— it will appear in every area today.'}
            </p>
          </div>
        </div>
      )}

      {/* ── GESCHENKKARTE POPUP ── */}
      {pendingGift && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(6px)' }}>
          <div style={{ background: th.card, border: `2px solid ${th.gold}66`, borderRadius: '24px', padding: '28px 24px', maxWidth: '360px', width: '100%', textAlign: 'center', boxShadow: `0 0 40px ${th.glowColor}44`, animation: 'vocaraFadeIn 0.4s ease both' }}>
            <p style={{ fontSize: '2.5rem', margin: '0 0 8px' }}>🎁</p>
            <p style={{ color: th.gold, fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '6px' }}>{isMarkLang ? `Geschenk von ${pendingGift.fromName}!` : `Gift from ${pendingGift.fromName}!`}</p>
            {pendingGift.message && <p style={{ color: th.sub, fontSize: '0.85rem', marginBottom: '10px', fontStyle: 'italic' }}>„{pendingGift.message}"</p>}
            <div style={{ background: th.bg, borderRadius: '14px', padding: '16px', margin: '10px 0', border: `1px solid ${th.border}` }}>
              <p style={{ color: th.text, fontWeight: 'bold', fontSize: '1.1rem', margin: '0 0 8px' }}>{pendingGift.front}</p>
              <div style={{ height: '1px', background: th.border, margin: '8px 0' }} />
              <p style={{ color: th.accent, fontWeight: 'bold', fontSize: '1.3rem', margin: 0 }}>{pendingGift.back}</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={async () => {
                  const giftCard = { id: `gift_${Date.now()}`, front: pendingGift.front, back: pendingGift.back, category: pendingGift.category || 'vocabulary', langA: pendingGift.langA || 'de', langB: pendingGift.langB || 'en', source: 'gift', sharedBy: pendingGift.fromName }
                  const updated = [...(myData?.aiCards || []), giftCard]
                  await updateDoc(doc(db, 'users', user.uid), { aiCards: updated, pendingGift: null, pendingGiftSeenDate: todayStr() }).catch(() => {})
                  if (pendingGift._incomingId) deleteDoc(doc(db, 'users', user.uid, 'incomingCards', pendingGift._incomingId)).catch(() => {})
                  setMyData(d => ({ ...d, aiCards: updated, pendingGift: null, pendingGiftSeenDate: todayStr() }))
                  setPendingGift(null)
                }}
                style={{ flex: 1, background: `${th.accent}25`, color: th.text, border: `1px solid ${th.accent}55`, borderRadius: '14px', padding: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem' }}>
                ➕ {isMarkLang ? 'Zum Deck' : 'Add to deck'}
              </button>
              <button
                onClick={async () => {
                  await updateDoc(doc(db, 'users', user.uid), { pendingGift: null, pendingGiftSeenDate: todayStr() }).catch(() => {})
                  if (pendingGift._incomingId) deleteDoc(doc(db, 'users', user.uid, 'incomingCards', pendingGift._incomingId)).catch(() => {})
                  setMyData(d => ({ ...d, pendingGift: null, pendingGiftSeenDate: todayStr() }))
                  setPendingGift(null)
                }}
                style={{ flex: '0 0 auto', background: 'rgba(255,255,255,0.06)', color: th.sub, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '12px 16px', cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ÜBERRASCHUNGSKARTE POPUP ── */}
      {surpriseCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(6px)' }}>
          <div style={{ background: th.card, border: `2px solid ${th.gold}66`, borderRadius: '24px', padding: '28px 24px', maxWidth: '360px', width: '100%', textAlign: 'center', boxShadow: `0 0 40px ${th.glowColor}44`, animation: 'vocaraFadeIn 0.4s ease both' }}>
            <p style={{ fontSize: '2.5rem', margin: '0 0 8px' }}>🎁</p>
            <p style={{ color: th.gold, fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '6px' }}>Überraschung von {surpriseCard.sharedBy}!</p>
            <div style={{ background: th.bg, borderRadius: '14px', padding: '18px', margin: '14px 0', border: `1px solid ${th.border}` }}>
              <p style={{ color: th.text, fontWeight: 'bold', fontSize: '1.1rem', margin: '0 0 8px' }}>{surpriseCard.front}</p>
              <div style={{ height: '1px', background: th.border, margin: '8px 0' }} />
              <p style={{ color: th.accent, fontWeight: 'bold', fontSize: '1.3rem', margin: 0 }}>{surpriseCard.back}</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => dismissSurprise(true)} style={{ flex: 1, background: `${th.accent}25`, color: th.text, border: `1px solid ${th.accent}55`, borderRadius: '14px', padding: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem', backdropFilter: 'blur(8px)' }}>
                ➕ Zum Deck hinzufügen
              </button>
              <button onClick={() => dismissSurprise(false)} style={{ flex: '0 0 auto', background: 'rgba(255,255,255,0.06)', color: th.sub, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '12px 16px', cursor: 'pointer', fontSize: '0.9rem', backdropFilter: 'blur(8px)' }}>
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div></div>
  )
}

function AdminScreen({ user, lang, theme, onBack }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const isDE = lang === 'de'
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'users'))
      const data = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
        .sort((a, b) => (b.lastActive || '').localeCompare(a.lastActive || ''))
      setUsers(data)
    } catch (e) { console.warn('Admin load failed:', e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const togglePlan = async (uid, currentPlan) => {
    setToggling(uid)
    const next = currentPlan === 'pro' ? null : currentPlan === 'premium' ? 'pro' : 'premium'
    try {
      await updateDoc(doc(db, 'users', uid), { plan: next })
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, plan: next } : u))
    } catch (e) { console.warn('togglePlan failed:', e) }
    setToggling(null)
  }

  const exportCSV = () => {
    const headers = ['uid','name','email','streak','cards','lastActive','partnerUID']
    const rows = users.map(u => {
      const hist = u.sessionHistory || []
      const streak = hist.length > 0 ? (() => {
        let s = 0; let d = new Date()
        for (let i = 0; i < 60; i++) {
          const ds = d.toISOString().slice(0,10)
          if (hist.some(h => h.date === ds)) { s++; d.setDate(d.getDate()-1) } else break
        }
        return s
      })() : 0
      const cards = Object.keys(u.cardProgress || {}).length
      return [u.uid, u.name||'', u.email||'', streak, cards, u.lastActive||'', u.partnerUID||''].join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,'+encodeURIComponent(csv)
    a.download = `vocara_users_${todayStr()}.csv`; a.click()
  }

  const calcSimpleStreak = (hist) => {
    if (!hist || hist.length === 0) return 0
    let streak = 0; let d = new Date()
    for (let i = 0; i < 60; i++) {
      const ds = d.toISOString().slice(0,10)
      if (hist.some(h => h.date === ds)) { streak++; d.setDate(d.getDate()-1) } else break
    }
    return streak
  }

  const thisWeek = getISOWeekStr()
  const activeThisWeek = users.filter(u => (u.sessionHistory || []).some(h => {
    try { return getISOWeekStr(new Date(...h.date.split('-').map((v,i)=>i===1?v-1:+v))) === thisWeek } catch { return false }
  })).length
  const premiumCount = users.filter(u => u.plan === 'premium' || u.plan === 'pro').length

  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>← {isDE ? 'Zurück' : 'Back'}</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h2 style={{ color: th.text, fontSize: '1.2rem', margin: 0 }}>⚙ Admin</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={load} style={{ background: 'transparent', border: `1px solid ${th.border}`, color: th.sub, borderRadius: '8px', padding: '5px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>↺</button>
          <button onClick={exportCSV} style={{ background: `${th.gold}18`, border: `1px solid ${th.gold}44`, color: th.gold, borderRadius: '10px', padding: '6px 12px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}>↓ CSV</button>
        </div>
      </div>
      {/* Quick stats */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {[
          [users.length, isDE ? 'Nutzer' : 'Users'],
          [activeThisWeek, isDE ? 'Aktiv Woche' : 'Active week'],
          [premiumCount, 'Premium/Pro'],
        ].map(([val, label]) => (
          <div key={label} style={{ flex: 1, background: th.card, border: `1px solid ${th.border}`, borderRadius: '12px', padding: '10px 6px', textAlign: 'center' }}>
            <p style={{ color: th.gold, fontSize: '1.4rem', fontWeight: '700', margin: '0 0 2px' }}>{val}</p>
            <p style={{ color: th.sub, fontSize: '0.6rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</p>
          </div>
        ))}
      </div>
      {loading ? (
        <p style={{ color: th.sub, textAlign: 'center' }}>…</p>
      ) : (
        <div style={s.card}>
          {users.map((u, i) => {
            const streak = calcSimpleStreak(u.sessionHistory)
            const cards = Object.keys(u.cardProgress || {}).length
            const mastered = Object.values(u.cardProgress || {}).filter(p => (p?.interval || 0) >= 7).length
            const plan = u.plan || null
            return (
              <div key={u.uid} style={{ paddingBottom: '10px', marginBottom: '10px', borderBottom: i < users.length-1 ? `1px solid ${th.border}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: th.text, fontWeight: '600', fontSize: '0.88rem' }}>{u.name || u.uid.slice(0,8)}</span>
                  <span style={{ color: th.sub, fontSize: '0.7rem' }}>{u.lastActive || '—'}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: '#FFA500', fontSize: '0.72rem' }}>🔥 {streak}</span>
                  <span style={{ color: th.sub, fontSize: '0.72rem' }}>📋 {cards} ({mastered}✓)</span>
                  {u.partnerUID && <span style={{ color: th.gold, fontSize: '0.72rem' }}>🤝</span>}
                  <button onClick={() => togglePlan(u.uid, plan)} disabled={toggling === u.uid}
                    style={{ marginLeft: 'auto', background: plan === 'pro' ? 'rgba(200,200,255,0.12)' : plan === 'premium' ? `${th.gold}18` : 'transparent', color: plan === 'pro' ? '#aaa' : plan === 'premium' ? th.gold : th.sub, border: `1px solid ${plan ? th.gold+'44' : th.border}`, borderRadius: '8px', padding: '2px 8px', fontSize: '0.65rem', fontWeight: '700', cursor: 'pointer', opacity: toggling === u.uid ? 0.5 : 1 }}>
                    {plan === 'pro' ? 'Pro' : plan === 'premium' ? 'Premium' : 'Free'} ↻
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div></div>
  )
}

function DiaryScreen({ user, myData, setMyData, partnerData, lang, theme, onBack }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const isDE = lang === 'de'
  const [myEntry, setMyEntry] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [langWarning, setLangWarning] = useState(null)
  const today = todayStr()
  // Target language for diary: Mark=EN, Elosy=DE
  const targetLang = lang === 'de' ? 'en' : 'de'
  const targetLangLabel = targetLang === 'en' ? (isDE ? 'Englisch' : 'English') : (isDE ? 'Deutsch' : 'German')
  const DE_WORDS = ['ich','du','er','sie','es','wir','ihr','und','oder','aber','nicht','ist','sind','war','haben','sein','mit','von','auf','bei','für','das','die','der','ein','eine','einen','einen','zu','in','an','im','am','dem','den','diese','diese','mein','dein']
  const EN_WORDS = ['i','you','he','she','it','we','they','and','or','but','not','is','are','was','have','be','with','from','on','at','for','the','a','an','to','in','this','my','your','that']
  const detectWrongLang = (text) => {
    if (!text || text.trim().split(/\s+/).length < 3) return false
    const words = text.toLowerCase().replace(/[^a-züöäß\s]/g,'').split(/\s+/)
    const deCount = words.filter(w => DE_WORDS.includes(w)).length
    const enCount = words.filter(w => EN_WORDS.includes(w)).length
    if (targetLang === 'en' && deCount > enCount) return true
    if (targetLang === 'de' && enCount > deCount) return true
    return false
  }

  const diaryEntries = myData?.diaryEntries || []
  const todayMyEntry = diaryEntries.find(e => e.date === today)
  const partnerEntries = partnerData?.diaryEntries || []
  const hasPartner = !!(myData?.partnerUID || partnerData)
  const partnerName = myData?.partnerName || partnerData?.name?.split(' ')[0] || 'Partner'
  const myFirstName = user.displayName?.split(' ')[0] || 'Ich'

  const saveEntry = async () => {
    if (!myEntry.trim()) return
    const entry = { date: today, text: myEntry.trim() }
    const updated = [...diaryEntries.filter(e => e.date !== today), entry]
    await updateDoc(doc(db, 'users', user.uid), { diaryEntries: updated }).catch(() => {})
    setMyData(d => ({ ...d, diaryEntries: updated }))
    const saved = myEntry.trim(); setMyEntry('')
    setFeedbackLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: 80,
          messages: [{ role: 'user', content: `The user wrote this sentence in ${isDE ? 'German' : 'English'}: "${saved}". In 1 very short sentence in ${isDE ? 'German' : 'English'}, give kind grammar feedback or encouragement. Be concise.` }]
        })
      })
      const data = await res.json()
      setFeedback(data.content?.[0]?.text?.trim() || null)
    } catch (e) {}
    finally { setFeedbackLoading(false) }
  }

  const allDates = [...new Set([...diaryEntries.map(e => e.date), ...partnerEntries.map(e => e.date)])]
    .sort().reverse().slice(0, 7)

  return (
    <div style={s.container} className="vocara-screen">
      <div style={{ ...s.homeBox, paddingTop: '16px' }}>
        <button style={s.backBtn} onClick={onBack}>← {isDE ? 'Zurück' : 'Back'}</button>
        <div style={{ textAlign: 'left', marginBottom: '18px' }}>
          <h2 style={{ color: th.text, fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.3rem', fontWeight: '700', margin: '0 0 4px' }}>
            📔 {isDE ? 'Gemeinsames Tagebuch' : 'Shared Diary'}
          </h2>
          <p style={{ color: th.sub, fontSize: '0.8rem', margin: 0 }}>
            {isDE ? 'Ein Satz pro Tag in eurer Zielsprache.' : 'One sentence per day in your target language.'}
          </p>
        </div>

        {/* Today's entry */}
        <div style={{ ...s.card, marginBottom: '14px' }}>
          <p style={{ ...s.cardLabel, marginBottom: '10px' }}>{isDE ? 'Heute' : 'Today'} — {today}</p>
          {todayMyEntry ? (
            <p style={{ color: th.accent, fontWeight: '600', fontSize: '0.92rem', margin: 0, fontStyle: 'italic' }}>„{todayMyEntry.text}"</p>
          ) : (
            <>
              <p style={{ color: th.sub, fontSize: '0.72rem', margin: '0 0 6px', opacity: 0.7 }}>
                {isDE ? `Schreib auf ${targetLangLabel}` : `Write in ${targetLangLabel}`}
              </p>
              <input
                style={{ ...s.input, marginBottom: '8px', borderColor: langWarning ? 'rgba(255,160,0,0.6)' : undefined }}
                placeholder={targetLang === 'en' ? (isDE ? 'Your sentence in English…' : 'Your sentence in English…') : (isDE ? 'Dein Satz auf Deutsch…' : 'Dein Satz auf Deutsch…')}
                value={myEntry}
                onChange={e => { setMyEntry(e.target.value); setLangWarning(detectWrongLang(e.target.value)) }}
                onKeyDown={e => e.key === 'Enter' && saveEntry()}
              />
              {langWarning && (
                <p style={{ color: '#FFA500', fontSize: '0.72rem', margin: '-4px 0 8px', animation: 'vocaraFadeIn 0.2s ease both' }}>
                  ⚠️ {isDE ? `Bitte auf ${targetLangLabel} schreiben` : `Please write in ${targetLangLabel}`}
                </p>
              )}
              <button style={{ ...s.button, marginBottom: 0 }} onClick={saveEntry}>{isDE ? 'Eintragen' : 'Save'}</button>
            </>
          )}
          {feedbackLoading && <p style={{ color: th.sub, fontSize: '0.75rem', margin: '8px 0 0' }}>💡 …</p>}
          {feedback && <p style={{ color: '#81c784', fontSize: '0.75rem', margin: '8px 0 0', lineHeight: 1.4 }}>💡 {feedback}</p>}
        </div>

        {/* Timeline */}
        {allDates.length > 0 && (
          <div style={s.card}>
            {hasPartner && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: th.accent, fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase' }}>{myFirstName}</span>
                <span style={{ color: th.gold, fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase' }}>{partnerName}</span>
              </div>
            )}
            {allDates.map(date => {
              const my = diaryEntries.find(e => e.date === date)
              const partner = partnerEntries.find(e => e.date === date)
              return (
                <div key={date} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: `1px solid ${th.border}` }}>
                  <p style={{ color: th.sub, fontSize: '0.68rem', fontWeight: '600', margin: '0 0 5px', letterSpacing: '0.4px' }}>{date}</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      {my
                        ? <p style={{ color: th.text, fontSize: '0.82rem', margin: 0, fontStyle: 'italic' }}>„{my.text}"</p>
                        : <p style={{ color: th.border, fontSize: '0.75rem', margin: 0 }}>—</p>}
                    </div>
                    {hasPartner && (
                      <div style={{ flex: 1 }}>
                        {partner
                          ? <p style={{ color: th.gold, fontSize: '0.82rem', margin: 0, fontStyle: 'italic' }}>„{partner.text}"</p>
                          : <p style={{ color: th.border, fontSize: '0.75rem', margin: 0 }}>—</p>}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {allDates.length === 0 && (
          <div style={{ ...s.card, textAlign: 'center', padding: '36px 20px' }}>
            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '10px' }}>📔</span>
            <p style={{ color: th.sub, fontSize: '0.88rem', margin: 0 }}>{isDE ? 'Noch keine Einträge — schreib den ersten!' : 'No entries yet — write the first one!'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function MeineKartenScreen({ user, myData, setMyData, allCards, cardProgress, lang, theme, onBack }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const isDE = lang === 'de'
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [editCard, setEditCard] = useState(null)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')
  const [editCat, setEditCat] = useState('vocabulary')
  const [editPronunciation, setEditPronunciation] = useState('')
  const [saveStatus, setSaveStatus] = useState(null)
  const myPartnerUID = myData?.partnerUID || (user.uid === MARK_UID ? ELOSY_UID : user.uid === ELOSY_UID ? MARK_UID : null)

  const userCards = (myData?.aiCards || []).filter(c => !/_r(_\d+)?$/.test(c.id))

  const masteryStars = (id) => {
    const interval = cardProgress[id]?.interval || 0
    if (interval >= 14) return 5
    if (interval >= 7) return 4
    if (interval >= 3) return 3
    if (interval >= 1) return 2
    return 0
  }

  const filtered = userCards.filter(c => {
    const matchSearch = !search.trim() || c.front.toLowerCase().includes(search.toLowerCase()) || c.back.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat === 'all' || c.category === filterCat
    return matchSearch && matchCat
  })

  const openEdit = (card) => { setEditCard(card); setEditFront(card.front); setEditBack(card.back); setEditCat(card.category || 'vocabulary'); setEditPronunciation(card.pronunciation || '') }

  const saveEdit = async () => {
    if (!editFront.trim() || !editBack.trim()) return
    const updated = (myData?.aiCards || []).map(c => c.id === editCard.id
      ? { ...c, front: editFront.trim(), back: editBack.trim(), category: editCat, ...(editPronunciation.trim() ? { pronunciation: editPronunciation.trim() } : {}) }
      : c)
    try {
      await updateDoc(doc(db, 'users', user.uid), { aiCards: updated })
      setMyData(d => ({ ...d, aiCards: updated }))
      setEditCard(null)
      setSaveStatus(isDE ? 'Gespeichert ✓' : 'Saved ✓')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (e) { console.warn(e) }
  }

  const shareWithPartner = async (card) => {
    if (!myPartnerUID) return
    const myFirstName = user.displayName?.split(' ')[0] || 'Partner'
    const gift = { front: card.front, back: card.back, category: card.category || 'vocabulary', langA: card.langA, langB: card.langB, fromName: myFirstName, message: '' }
    try {
      await updateDoc(doc(db, 'users', myPartnerUID), { pendingGift: gift })
      setSaveStatus(isDE ? 'Geteilt ✓' : 'Shared ✓')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (e) { console.warn(e) }
  }

  const deleteCard = async (card) => {
    if (!window.confirm(isDE ? `„${card.front}" löschen?` : `Delete "${card.front}"?`)) return
    const updated = (myData?.aiCards || []).filter(c => c.id !== card.id)
    try {
      await updateDoc(doc(db, 'users', user.uid), { aiCards: updated })
      setMyData(d => ({ ...d, aiCards: updated }))
      if (editCard?.id === card.id) setEditCard(null)
    } catch (e) { console.warn(e) }
  }

  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>← {isDE ? 'Zurück' : 'Back'}</button>
      <h2 style={{ color: th.text, marginBottom: '16px', fontSize: '1.2rem', fontFamily: "'Playfair Display', Georgia, serif" }}>
        📋 {isDE ? `Meine Karten (${userCards.length})` : `My Cards (${userCards.length})`}
      </h2>
      <input style={{ ...s.input, marginBottom: '8px' }} placeholder={isDE ? 'Suchen…' : 'Search…'} value={search} onChange={e => setSearch(e.target.value)} />
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {[['all', isDE ? 'Alle' : 'All'], ['vocabulary', 'Hochsprache'], ['street', 'Slang'], ['sentence', isDE ? 'Sätze' : 'Sentences'], ['home', isDE ? 'Zuhause' : 'Home']].map(([key, label]) => (
          <button key={key} onClick={() => setFilterCat(key)}
            style={{ padding: '4px 11px', borderRadius: '20px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: filterCat === key ? '700' : '400', background: filterCat === key ? th.accent : 'transparent', color: filterCat === key ? (th.btnTextColor || '#111') : th.sub, border: `1px solid ${filterCat === key ? th.accent : th.border}` }}>
            {label}
          </button>
        ))}
      </div>
      {editCard && (
        <div style={{ ...s.card, border: `1px solid ${th.accent}55`, marginBottom: '12px', animation: 'vocaraFadeIn 0.2s ease both' }}>
          <p style={{ ...s.cardLabel, marginBottom: '12px' }}>{isDE ? 'Karte bearbeiten' : 'Edit card'}</p>
          <input style={{ ...s.input, marginBottom: '8px' }} value={editFront} onChange={e => setEditFront(e.target.value)} placeholder={isDE ? 'Vorderseite' : 'Front'} />
          <input style={{ ...s.input, marginBottom: '8px' }} value={editBack} onChange={e => setEditBack(e.target.value)} placeholder={isDE ? 'Rückseite' : 'Back'} />
          <input style={{ ...s.input, marginBottom: '12px', fontSize: '0.82rem', fontStyle: 'italic' }} value={editPronunciation} onChange={e => setEditPronunciation(e.target.value)} placeholder={isDE ? 'Aussprache (z.B. WE-dser) — optional' : 'Pronunciation (e.g. WE-dser) — optional'} />
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <button onClick={() => setEditCat('vocabulary')} style={{ flex: 1, padding: '7px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.78rem', background: editCat !== 'street' ? 'rgba(140,140,155,0.25)' : 'transparent', color: editCat !== 'street' ? '#A0A0B8' : th.sub, border: `1px solid ${editCat !== 'street' ? 'rgba(140,140,155,0.45)' : th.border}` }}>Hochsprache</button>
            <button onClick={() => setEditCat('street')} style={{ flex: 1, padding: '7px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.78rem', background: editCat === 'street' ? 'rgba(180,120,30,0.2)' : 'transparent', color: editCat === 'street' ? '#C8922A' : th.sub, border: `1px solid ${editCat === 'street' ? 'rgba(180,120,30,0.4)' : th.border}` }}>Slang</button>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <button style={{ flex: 1, background: th.accent, color: th.btnTextColor || '#111', border: 'none', padding: '9px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '0.88rem' }} onClick={saveEdit}>{isDE ? 'Speichern' : 'Save'}</button>
            <button style={{ flex: '0 0 auto', background: '#f4433618', color: '#e06c75', border: '1px solid rgba(224,108,117,0.5)', padding: '9px 14px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem' }} onClick={() => deleteCard(editCard)}>{isDE ? 'Löschen' : 'Delete'}</button>
            <button style={{ flex: '0 0 auto', background: 'transparent', color: th.sub, border: `1px solid ${th.border}`, padding: '9px 12px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem' }} onClick={() => setEditCard(null)}>✕</button>
          </div>
          {myPartnerUID && (
            <button style={{ width: '100%', background: 'transparent', color: th.gold, border: `1px solid ${th.gold}44`, padding: '8px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }} onClick={() => shareWithPartner(editCard)}>
              🎁 {isDE ? 'Mit Partner teilen' : 'Share with partner'}
            </button>
          )}
          {saveStatus && <p style={{ color: th.accent, fontSize: '0.8rem', marginTop: '8px', textAlign: 'center' }}>{saveStatus}</p>}
        </div>
      )}
      {filtered.length === 0 ? (
        <div style={{ ...s.card, textAlign: 'center', padding: '32px 20px' }}>
          <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>📋</span>
          <p style={{ color: th.sub, fontSize: '0.88rem', margin: 0 }}>{isDE ? 'Keine Karten gefunden.' : 'No cards found.'}</p>
        </div>
      ) : (
        <div style={s.card}>
          {filtered.map((card, i) => {
            const interval = cardProgress[card.id]?.interval || 0
            const stars = masteryStars(card.id)
            const isGold = interval >= 14
            return (
              <div key={card.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: i < filtered.length - 1 ? `1px solid ${th.border}` : 'none' }}>
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => openEdit(card)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                    <p style={{ color: th.text, fontSize: '0.88rem', margin: 0, fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.front}</p>
                    {isGold && <span style={{ fontSize: '0.68rem', flexShrink: 0 }}>⭐</span>}
                  </div>
                  <p style={{ color: th.sub, fontSize: '0.77rem', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.back}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ background: card.category === 'street' ? 'rgba(180,120,30,0.2)' : 'rgba(140,140,155,0.15)', color: card.category === 'street' ? '#C8922A' : '#8A8A9A', borderRadius: '4px', padding: '1px 6px', fontSize: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px', flexShrink: 0 }}>
                      {card.category === 'street' ? 'Slang' : 'Hochsprache'}
                    </span>
                    <span style={{ fontSize: '0.68rem', letterSpacing: '1px', color: isGold ? '#FFD700' : stars > 0 ? th.accent : th.border }}>
                      {'★'.repeat(Math.max(0, stars))}{'☆'.repeat(Math.max(0, 5 - stars))}
                    </span>
                  </div>
                </div>
                <button onClick={() => deleteCard(card)} style={{ background: 'transparent', border: '1px solid rgba(224,108,117,0.3)', color: '#e06c75', borderRadius: '8px', padding: '5px 8px', cursor: 'pointer', fontSize: '0.75rem', flexShrink: 0, opacity: 0.75 }}>✕</button>
              </div>
            )
          })}
        </div>
      )}
    </div></div>
  )
}

function KarteErstellenScreen({ user, myData, setMyData, allCards, lang, theme, onBack, socialRegister = 'friends', t: tProp }) {
  const th = THEMES[theme]; const s = makeStyles(th); const t = tProp || T[lang] || T.en; const isDE = lang === 'de'

  const LANG_NAMES = { en: 'Englisch', de: 'Deutsch', sw: 'Swahili', fr: 'Französisch', es: 'Spanisch', th: 'Thai' }
  const LANG_NAMES_EN = { en: 'English', de: 'German', sw: 'Swahili', fr: 'French', es: 'Spanish', th: 'Thai' }
  const LANG_LIST = [
    { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'sw', label: 'Swahili', flag: '🇰🇪' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'th', label: 'ภาษาไทย', flag: '🇹🇭' },
  ]

  const myPartnerUID = myData?.partnerUID || (user.uid === MARK_UID ? ELOSY_UID : user.uid === ELOSY_UID ? MARK_UID : null)
  const partnerName = myData?.partnerName || (user.uid === MARK_UID ? 'Elosy' : user.uid === ELOSY_UID ? 'Mark' : null)

  // ── STEP 1: Language preferences ─────────────────────────
  const initSrcLangs = () => {
    if (myData?.fromLangs?.length > 0) return myData.fromLangs
    return [{ lang: lang === 'de' ? 'de' : 'en', percent: 100 }]
  }
  const initTgtLang = () => myData?.cardTgtLang || (lang === 'de' ? 'en' : 'de')

  const [srcLangs, setSrcLangs] = useState(initSrcLangs)
  const [tgtLang, setTgtLang] = useState(initTgtLang)

  const saveLangPrefs = async (newSrc, newTgt) => {
    try {
      await setDoc(doc(db, 'users', user.uid, 'settings', 'langWeights'), { fromLangs: newSrc, tgtLang: newTgt }, { merge: true }).catch(() => {})
      await updateDoc(doc(db, 'users', user.uid), { fromLangs: newSrc, cardTgtLang: newTgt }).catch(() => {})
      setMyData(d => ({ ...d, fromLangs: newSrc, cardTgtLang: newTgt }))
    } catch(e) {}
  }

  const addSrcLang = (code) => {
    if (srcLangs.find(l => l.lang === code) || srcLangs.length >= 4) return
    const pct = 30
    const adj = srcLangs.map(l => ({ ...l, percent: Math.round(l.percent * (100 - pct) / 100) }))
    const next = [...adj, { lang: code, percent: pct }]
    const diff = 100 - next.reduce((a, b) => a + b.percent, 0)
    next[0].percent += diff
    setSrcLangs(next); saveLangPrefs(next, tgtLang)
  }

  const removeSrcLang = (code) => {
    if (srcLangs.length <= 1) return
    const rest = srcLangs.filter(l => l.lang !== code)
    const total = rest.reduce((a, b) => a + b.percent, 0)
    const next = rest.map(l => ({ ...l, percent: Math.round(l.percent * 100 / total) }))
    const diff = 100 - next.reduce((a, b) => a + b.percent, 0)
    if (next.length > 0) next[0].percent += diff
    setSrcLangs(next); saveLangPrefs(next, tgtLang)
    if (activeSrcLang === code) setActiveSrcLang(next[0]?.lang || 'de')
  }

  const updateSrcPercent = (code, raw) => {
    const pct = Math.max(10, Math.min(80, raw))
    const others = srcLangs.filter(l => l.lang !== code)
    const rest = 100 - pct
    const otherTotal = others.reduce((a, b) => a + b.percent, 0)
    const adj = otherTotal === 0
      ? others.map(l => ({ ...l, percent: Math.round(rest / others.length) }))
      : others.map(l => ({ ...l, percent: Math.round(l.percent * rest / otherTotal) }))
    const diff = 100 - pct - adj.reduce((a, b) => a + b.percent, 0)
    if (adj.length > 0) adj[adj.length - 1].percent += diff
    const next = srcLangs.map(l => l.lang === code ? { ...l, percent: pct } : (adj.find(a => a.lang === l.lang) || l))
    setSrcLangs(next)
    clearTimeout(window.__lwSave)
    window.__lwSave = setTimeout(() => saveLangPrefs(next, tgtLang), 700)
  }

  const setTgtAndSave = (code) => { setTgtLang(code); saveLangPrefs(srcLangs, code) }

  // ── STEP 2: Card input ────────────────────────────────────
  const [inputSide, setInputSide] = useState('source') // 'source' | 'target'
  const [activeSrcLang, setActiveSrcLang] = useState(() => srcLangs[0]?.lang || (lang === 'de' ? 'de' : 'en'))
  const [frontText, setFrontText] = useState('')
  const [backText, setBackText] = useState('')
  const [pronunciation, setPronunciation] = useState('')
  const [detectedCat, setDetectedCat] = useState(null)
  const [kiLoading, setKiLoading] = useState(false)
  const [kiDone, setKiDone] = useState(false)

  // ── STEP 3: Category + destination ────────────────────────
  const [cat, setCat] = useState('vocabulary')
  const [destination, setDestination] = useState('me') // 'me' | 'partner' | 'both'

  // ── Save ─────────────────────────────────────────────────
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)

  const entryLang = inputSide === 'source' ? activeSrcLang : tgtLang
  const otherLang = inputSide === 'source' ? tgtLang : activeSrcLang

  const kiFill = async () => {
    if (!frontText.trim() || kiLoading) return
    setKiLoading(true)
    try {
      const fromName = LANG_NAMES_EN[entryLang] || entryLang
      const toName = LANG_NAMES_EN[otherLang] || otherLang
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: 150, system: CARD_GEN_SYSTEM,
          messages: [{ role: 'user', content: `Translate "${frontText.trim()}" from ${fromName} to ${toName}. Context: ${socialRegisterContext(socialRegister)}. Return ONLY a JSON: {"front":"${frontText.trim()}","back":"[translation]","pronunciation":"[German-style phonetic syllables e.g. WI-der-SE-hen, or empty string if not needed]","category":"vocabulary|sentence|slang|formal"}. 100% accurate, natural, tone-appropriate, never literal.` }]
        })
      })
      const data = await res.json()
      const raw = (data.content?.[0]?.text || '').trim()
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        const p = JSON.parse(match[0])
        if (p.back) setBackText(p.back)
        if (p.pronunciation) setPronunciation(p.pronunciation)
        const validCats = ['vocabulary','sentence','slang','formal']
        if (p.category && validCats.includes(p.category)) { setDetectedCat(p.category); setCat(p.category === 'slang' ? 'street' : p.category) }
        setKiDone(true)
      }
    } catch(e) { console.warn('KI fill failed:', e) }
    setKiLoading(false)
  }

  const save = async () => {
    if (!frontText.trim() || !backText.trim() || saving) return
    setSaving(true)
    const isEntrySource = inputSide === 'source'
    const card = {
      id: `custom_${Date.now()}`,
      front: isEntrySource ? frontText.trim() : backText.trim(),
      back: isEntrySource ? backText.trim() : frontText.trim(),
      ...(pronunciation.trim() ? { pronunciation: pronunciation.trim() } : {}),
      category: cat === 'slang' ? 'street' : cat,
      langA: isEntrySource ? entryLang : otherLang,
      langB: isEntrySource ? otherLang : entryLang,
      source: 'custom', createdAt: Date.now()
    }
    try {
      const senderName = user.displayName?.split(' ')[0] || 'Partner'
      if ((destination === 'partner' || destination === 'both') && myPartnerUID) {
        await updateDoc(doc(db, 'users', myPartnerUID), {
          surpriseCard: { ...card, sharedBy: senderName, sharedAt: Date.now() },
          surpriseSeenDate: null
        })
      }
      if (destination === 'me' || destination === 'both') {
        const updated = [...(myData?.aiCards || []), card]
        await updateDoc(doc(db, 'users', user.uid), { aiCards: updated })
        setMyData(d => ({ ...d, aiCards: updated }))
      }
      setStatus(
        destination === 'partner' ? (isDE ? `🎁 An ${partnerName} gesendet ✓` : `🎁 Sent to ${partnerName} ✓`) :
        destination === 'both' ? (isDE ? '💫 Für dich & Partner ✓' : '💫 For you & partner ✓') :
        (isDE ? 'Karte gespeichert ✓' : 'Card saved ✓')
      )
      setFrontText(''); setBackText(''); setPronunciation(''); setKiDone(false); setDetectedCat(null)
      setTimeout(() => setStatus(null), 2500)
    } catch(e) { console.warn(e); setStatus(isDE ? 'Fehler' : 'Error') }
    setSaving(false)
  }

  const stepBadge = (n) => (
    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: th.accent, color: th.btnTextColor || '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: '800', flexShrink: 0 }}>{n}</div>
  )
  const sectionHead = (n, title) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
      {stepBadge(n)}
      <p style={{ ...s.cardLabel, margin: 0 }}>{title}</p>
    </div>
  )

  return (
    <div style={s.container} className="vocara-screen">
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: th.bg, borderBottom: `1px solid ${th.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', minHeight: '52px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: th.accent, cursor: 'pointer', fontSize: '1.1rem', fontWeight: '700', padding: '12px 8px 12px 0', WebkitTapHighlightColor: 'transparent' }}>←</button>
        <span style={{ color: th.text, fontWeight: '700', fontSize: '1rem', fontFamily: "'Playfair Display', Georgia, serif" }}>✏️ {isDE ? 'Neue Karte' : 'New Card'}</span>
      </div>
      <div style={{ ...s.homeBox, paddingTop: '68px' }}>

      {/* ── SECTION 1: SPRACHEN ── */}
      <div style={{ ...s.card, marginBottom: '12px' }}>
        {sectionHead('1', isDE ? 'Sprachen' : 'Languages')}

        <p style={{ color: th.sub, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
          {isDE ? 'Ausgangssprache(n)' : 'Source language(s)'}
        </p>
        {srcLangs.map(({ lang: lc, percent }) => {
          const info = LANG_LIST.find(l => l.code === lc)
          return (
            <div key={lc} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: srcLangs.length > 1 ? '4px' : '0' }}>
                <span style={{ fontSize: '1.1rem' }}>{info?.flag || ''}</span>
                <span style={{ color: th.text, fontSize: '0.88rem', fontWeight: '600', flex: 1 }}>{info?.label || lc}</span>
                {srcLangs.length > 1 && <span style={{ color: th.accent, fontWeight: '700', fontSize: '0.85rem', minWidth: '34px', textAlign: 'right' }}>{percent}%</span>}
                {srcLangs.length > 1 && (
                  <button onClick={() => removeSrcLang(lc)} style={{ background: 'transparent', border: 'none', color: th.sub, cursor: 'pointer', fontSize: '0.75rem', padding: '2px 6px', WebkitTapHighlightColor: 'transparent' }}>✕</button>
                )}
              </div>
              {srcLangs.length > 1 && (
                <input type="range" min={10} max={80} value={percent} onChange={e => updateSrcPercent(lc, parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: th.accent, cursor: 'pointer' }} />
              )}
            </div>
          )
        })}
        {srcLangs.length < 4 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px', marginBottom: '14px' }}>
            {LANG_LIST.filter(l => !srcLangs.find(s2 => s2.lang === l.code) && l.code !== tgtLang).map(l => (
              <button key={l.code} onClick={() => addSrcLang(l.code)}
                style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', cursor: 'pointer', background: 'transparent', color: th.sub, border: `1px solid ${th.border}`, WebkitTapHighlightColor: 'transparent' }}>
                + {l.flag} {l.label}
              </button>
            ))}
          </div>
        )}

        <p style={{ color: th.sub, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
          {isDE ? 'Zielsprache' : 'Target language'}
        </p>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {LANG_LIST.filter(l => !srcLangs.find(s2 => s2.lang === l.code)).map(l => (
            <button key={l.code} onClick={() => setTgtAndSave(l.code)}
              style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '0.82rem', cursor: 'pointer', fontWeight: tgtLang === l.code ? '700' : '400', background: tgtLang === l.code ? th.accent : 'transparent', color: tgtLang === l.code ? (th.btnTextColor || '#111') : th.sub, border: `1px solid ${tgtLang === l.code ? th.accent : th.border}`, WebkitTapHighlightColor: 'transparent' }}>
              {l.flag} {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── SECTION 2: KARTE EINGEBEN ── */}
      <div style={{ ...s.card, marginBottom: '12px' }}>
        {sectionHead('2', isDE ? 'Karte eingeben' : 'Enter card')}

        {/* Side toggle */}
        <div style={{ display: 'flex', gap: '4px', background: `${th.border}55`, borderRadius: '10px', padding: '3px', marginBottom: '12px' }}>
          {['source', 'target'].map(side => {
            const lc = side === 'source' ? activeSrcLang : tgtLang
            const info = LANG_LIST.find(l => l.code === lc)
            const active = inputSide === side
            return (
              <button key={side} onClick={() => setInputSide(side)}
                style={{ flex: 1, padding: '7px 6px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: active ? '700' : '400', background: active ? th.accent : 'transparent', color: active ? (th.btnTextColor || '#111') : th.sub, fontSize: '0.78rem', transition: 'all 0.18s', WebkitTapHighlightColor: 'transparent' }}>
                {isDE ? 'Ich tippe' : 'I type'}: {info?.flag} {info?.label || lc}
              </button>
            )
          })}
        </div>

        {/* Active source lang picker when multiple */}
        {srcLangs.length > 1 && inputSide === 'source' && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {srcLangs.map(({ lang: lc }) => {
              const info = LANG_LIST.find(l => l.code === lc)
              return (
                <button key={lc} onClick={() => setActiveSrcLang(lc)}
                  style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: activeSrcLang === lc ? '700' : '400', background: activeSrcLang === lc ? `${th.accent}30` : 'transparent', color: activeSrcLang === lc ? th.accent : th.sub, border: `1px solid ${activeSrcLang === lc ? th.accent : th.border}`, WebkitTapHighlightColor: 'transparent' }}>
                  {info?.flag} {info?.label || lc}
                </button>
              )
            })}
          </div>
        )}

        {/* Input field */}
        <p style={{ color: th.sub, fontSize: '0.72rem', marginBottom: '4px' }}>
          {LANG_LIST.find(l => l.code === entryLang)?.flag} {LANG_NAMES[entryLang] || entryLang}
        </p>
        <textarea
          style={{ ...s.input, minHeight: '68px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5', marginBottom: '10px' }}
          placeholder={isDE ? 'Wort oder Satz eingeben…' : 'Enter word or sentence…'}
          value={frontText}
          onChange={e => { setFrontText(e.target.value); setKiDone(false) }}
        />

        {/* KI button */}
        <button onClick={kiFill} disabled={!frontText.trim() || kiLoading}
          style={{ width: '100%', padding: '11px', borderRadius: '10px', border: `1px solid ${th.gold}55`, background: kiDone ? `${th.accent}18` : `${th.gold}12`, color: kiDone ? th.accent : th.gold, fontWeight: '700', fontSize: '0.88rem', cursor: frontText.trim() ? 'pointer' : 'not-allowed', opacity: (!frontText.trim() || kiLoading) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', WebkitTapHighlightColor: 'transparent' }}>
          {kiLoading
            ? <><div style={{ width: '14px', height: '14px', border: `2px solid ${th.gold}44`, borderTopColor: th.gold, borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />{isDE ? 'KI übersetzt…' : 'AI translating…'}</>
            : kiDone ? `✓ ${isDE ? 'KI hat ergänzt — nochmal' : 'AI filled — redo'}` : `🤖 ${isDE ? 'KI ergänzt den Rest' : 'AI fills the rest'}`}
        </button>

        {/* Translation + pronunciation */}
        {kiDone && (
          <div style={{ marginTop: '12px', animation: 'vocaraFadeIn 0.3s ease both' }}>
            <p style={{ color: th.sub, fontSize: '0.72rem', marginBottom: '4px' }}>
              {LANG_LIST.find(l => l.code === otherLang)?.flag} {LANG_NAMES[otherLang] || otherLang}
            </p>
            <textarea
              style={{ ...s.input, minHeight: '56px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5', marginBottom: '6px' }}
              value={backText}
              onChange={e => setBackText(e.target.value)}
              placeholder={isDE ? 'Übersetzung…' : 'Translation…'}
            />
            {pronunciation && (
              <>
                <p style={{ color: th.sub, fontSize: '0.72rem', marginBottom: '4px' }}>🔉 {isDE ? 'Aussprache' : 'Pronunciation'}</p>
                <input style={{ ...s.input, fontSize: '0.82rem', fontStyle: 'italic', marginBottom: 0 }}
                  value={pronunciation} onChange={e => setPronunciation(e.target.value)} />
              </>
            )}
          </div>
        )}
      </div>

      {/* ── SECTION 3: KATEGORIE & ZIEL ── */}
      {kiDone && backText && (
        <div style={{ ...s.card, marginBottom: '12px', animation: 'vocaraFadeIn 0.25s ease both' }}>
          {sectionHead('3', isDE ? 'Kategorie & Ziel' : 'Category & Destination')}

          <p style={{ color: th.sub, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            {isDE ? 'Kategorie' : 'Category'}
            {detectedCat && <span style={{ color: th.accent, marginLeft: '8px', fontStyle: 'italic', fontWeight: '600', textTransform: 'none', letterSpacing: 0 }}>· KI: {detectedCat}</span>}
          </p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {[
              ['vocabulary', isDE ? 'Meine Worte' : 'Word', '#8A8A9A'],
              ['sentence', isDE ? 'Satz' : 'Sentence', '#6A9BBA'],
              ['street', 'Slang', '#C8922A'],
              ['home', isDE ? 'Zuhause' : 'Home', '#7A8A6A'],
            ].map(([key, label, color]) => (
              <button key={key} onClick={() => setCat(key)}
                style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: cat === key ? '700' : '400', background: cat === key ? `${color}22` : 'transparent', color: cat === key ? color : th.sub, border: `1px solid ${cat === key ? color : th.border}`, WebkitTapHighlightColor: 'transparent' }}>
                {label}
              </button>
            ))}
          </div>

          <p style={{ color: th.sub, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            {isDE ? 'Für wen?' : 'For whom?'}
          </p>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => setDestination('me')}
              style={{ flex: 1, padding: '8px 6px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem', background: destination === 'me' ? th.accent : 'transparent', color: destination === 'me' ? (th.btnTextColor || '#111') : th.sub, border: `1px solid ${destination === 'me' ? th.accent : th.border}`, WebkitTapHighlightColor: 'transparent' }}>
              {isDE ? 'Für mich' : 'For me'}
            </button>
            {myPartnerUID && <>
              <button onClick={() => setDestination('partner')}
                style={{ flex: 1, padding: '8px 6px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem', background: destination === 'partner' ? `${th.gold}22` : 'transparent', color: destination === 'partner' ? th.gold : th.sub, border: `1px solid ${destination === 'partner' ? th.gold : th.border}`, animation: destination === 'partner' ? 'goldShimmer 2.5s ease-in-out infinite' : undefined, WebkitTapHighlightColor: 'transparent' }}>
                🎁 {partnerName}
              </button>
              <button onClick={() => setDestination('both')}
                style={{ flex: 1, padding: '8px 6px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem', background: destination === 'both' ? `linear-gradient(135deg,${th.accent}22,${th.gold}18)` : 'transparent', color: destination === 'both' ? th.accent : th.sub, border: `1px solid ${destination === 'both' ? th.accent : th.border}`, WebkitTapHighlightColor: 'transparent' }}>
                💫 {isDE ? 'Beide' : 'Both'}
              </button>
            </>}
          </div>
        </div>
      )}

      {/* ── SECTION 4: SPEICHERN ── */}
      {kiDone && frontText && backText && (
        <div style={{ marginBottom: '40px', animation: 'vocaraFadeIn 0.25s ease both' }}>
          <button style={{ ...s.button, marginBottom: 0, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving}>
            {saving ? (isDE ? 'Speichern…' : 'Saving…') :
              destination === 'partner' ? (isDE ? `🎁 An ${partnerName} senden` : `🎁 Send to ${partnerName}`) :
              destination === 'both' ? (isDE ? '💫 Für dich & Partner' : '💫 For you & partner') :
              (isDE ? 'Karte speichern ✓' : 'Save card ✓')}
          </button>
          {status && (
            <p style={{ color: th.accent, fontSize: '0.88rem', marginTop: '10px', textAlign: 'center', fontWeight: '600', animation: 'vocaraFadeIn 0.3s ease both' }}>{status}</p>
          )}
        </div>
      )}

      </div>
    </div>
  )
}

function GeschenkkarteScreen({ user, myData, lang, theme, onBack, allCards, cardProgress }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const isDE = lang === 'de'
  const [selectedCard, setSelectedCard] = useState(null)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState(null)
  const [sending, setSending] = useState(false)
  const myPartnerUID = myData?.partnerUID || (user.uid === MARK_UID ? ELOSY_UID : user.uid === ELOSY_UID ? MARK_UID : null)
  const partnerName = myData?.partnerName || (user.uid === MARK_UID ? 'Elosy' : user.uid === ELOSY_UID ? 'Mark' : null)
  const fromName = user.displayName?.split(' ')[0] || 'Partner'

  const masteredCards = (allCards || []).filter(c => !/_r(_\d+)?$/.test(c.id) && (cardProgress[c.id]?.interval || 0) >= 7).slice(0, 20)

  const send = async () => {
    if (!selectedCard || !myPartnerUID) return
    setSending(true)
    try {
      const ts = Date.now()
      const gift = { front: selectedCard.front, back: selectedCard.back, category: selectedCard.category, langA: selectedCard.langA, langB: selectedCard.langB, message: message.trim().slice(0, 100), fromName, fromUid: user.uid, sentAt: ts, date: todayStr() }
      // Write to both pendingGift (legacy) and incomingCards subcollection
      await Promise.all([
        updateDoc(doc(db, 'users', myPartnerUID), { pendingGift: gift }),
        setDoc(doc(db, 'users', myPartnerUID, 'incomingCards', `gift_${ts}`), gift),
      ])
      setStatus(isDE ? `🎁 Geschenkt an ${partnerName} ✓` : `🎁 Gifted to ${partnerName} ✓`)
      setSelectedCard(null); setMessage('')
      setTimeout(() => { setStatus(null); onBack() }, 2000)
    } catch (e) { console.warn(e); setStatus(isDE ? 'Fehler beim Senden' : 'Error sending') }
    finally { setSending(false) }
  }

  if (!myPartnerUID) return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>← {isDE ? 'Zurück' : 'Back'}</button>
      <div style={{ textAlign: 'center', marginTop: '60px' }}>
        <p style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🤝</p>
        <p style={{ color: th.sub }}>{isDE ? 'Verbinde zuerst deinen Partner.' : 'Connect a partner first.'}</p>
      </div>
    </div></div>
  )

  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>← {isDE ? 'Zurück' : 'Back'}</button>
      <h2 style={{ color: th.text, marginBottom: '16px', fontSize: '1.2rem', fontFamily: "'Playfair Display', Georgia, serif" }}>
        🎁 {isDE ? `Geschenk für ${partnerName}` : `Gift for ${partnerName}`}
      </h2>
      <div style={s.card}>
        <p style={{ ...s.cardLabel, marginBottom: '12px' }}>{isDE ? 'Wähle eine gemeisterte Karte:' : 'Choose a mastered card:'}</p>
        {masteredCards.length === 0 ? (
          <p style={{ color: th.sub, fontSize: '0.85rem' }}>{isDE ? 'Noch keine gemeisterten Karten.' : 'No mastered cards yet.'}</p>
        ) : masteredCards.map(card => (
          <button key={card.id} onClick={() => setSelectedCard(selectedCard?.id === card.id ? null : card)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '9px 12px', marginBottom: '6px', borderRadius: '10px', cursor: 'pointer', background: selectedCard?.id === card.id ? `${th.accent}22` : 'transparent', border: `1px solid ${selectedCard?.id === card.id ? th.accent : th.border}`, textAlign: 'left' }}>
            <span style={{ color: th.text, fontSize: '0.85rem', fontWeight: '500' }}>{card.front}</span>
            <span style={{ color: th.sub, fontSize: '0.78rem', marginLeft: '8px', flexShrink: 0 }}>→ {card.back}</span>
          </button>
        ))}
      </div>
      {selectedCard && (
        <div style={{ ...s.card, animation: 'vocaraFadeIn 0.2s ease both' }}>
          <p style={{ ...s.cardLabel, marginBottom: '10px' }}>{isDE ? 'Persönliche Nachricht (optional):' : 'Personal message (optional):'}</p>
          <input style={{ ...s.input, marginBottom: '0' }}
            placeholder={isDE ? 'z.B. „Dieses Wort gefällt mir für dich…"' : 'e.g. "I thought you\'d like this word…"'}
            value={message} maxLength={100} onChange={e => setMessage(e.target.value)} />
          <p style={{ color: th.sub, fontSize: '0.7rem', textAlign: 'right', margin: '4px 0 12px' }}>{message.length}/100</p>
          <button style={{ ...s.button, marginBottom: 0, opacity: sending ? 0.6 : 1 }} onClick={send} disabled={sending}>
            {sending ? '…' : (isDE ? `🎁 An ${partnerName} senden` : `🎁 Send to ${partnerName}`)}
          </button>
          {status && <p style={{ color: th.accent, fontSize: '0.82rem', marginTop: '8px', textAlign: 'center' }}>{status}</p>}
        </div>
      )}
    </div></div>
  )
}

function MainSelectionScreen({ lang, theme, firstName, uniqueTargetLangs, pausedLanguages, onSprechen, onEntdecken }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const isDE = lang === 'de'
  const [pressedBtn, setPressedBtn] = React.useState(null)

  const glassBtn = (id, onClick, titleMain, titleSub, desc, disabled) => {
    const isPressed = pressedBtn === id
    return (
      <button
        key={id}
        onClick={disabled ? undefined : onClick}
        onMouseDown={() => !disabled && setPressedBtn(id)}
        onMouseUp={() => setPressedBtn(null)}
        onMouseLeave={() => setPressedBtn(null)}
        onTouchStart={() => !disabled && setPressedBtn(id)}
        onTouchEnd={() => setPressedBtn(null)}
        style={{
          background: disabled
            ? 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))'
            : 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: `1px solid ${disabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.20)'}`,
          borderRadius: '20px',
          boxShadow: disabled ? 'none' : isPressed
            ? '0 2px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)'
            : '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
          padding: '22px 20px 18px',
          cursor: disabled ? 'default' : 'pointer',
          width: '100%', marginBottom: '12px',
          textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
          opacity: disabled ? 0.4 : 1,
          transform: isPressed ? 'scale(0.96)' : 'scale(1)',
          transition: 'transform 0.12s ease, box-shadow 0.12s ease',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.75rem', fontWeight: '700', letterSpacing: '0.4px', color: 'white', lineHeight: 1.1 }}>{titleMain}</span>
        {titleSub && <span style={{ fontSize: '1.1rem', fontWeight: '600', color: th.accent, letterSpacing: '0.3px' }}>{titleSub}</span>}
        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>{desc}</span>
        {disabled && (
          <span style={{ marginTop: '4px', background: `${th.gold}18`, color: th.gold, border: `1px solid ${th.gold}44`, borderRadius: '20px', padding: '2px 12px', fontSize: '0.7rem', fontWeight: '700' }}>
            {isDE ? 'Bald verfügbar' : 'Coming soon'}
          </span>
        )}
      </button>
    )
  }

  return (
    <div style={{ ...s.container, position: 'relative', zIndex: 10 }} className="vocara-screen">
      <div style={{ ...s.homeBox, paddingTop: '24px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', paddingBottom: '32px', paddingTop: '24px' }}>
          <h1 className="vocara-bridgelab-title" style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(2.8rem, 12vw, 4.5rem)',
            fontWeight: '900',
            letterSpacing: '0.08em',
            background: 'linear-gradient(90deg, #B8860B 0%, #FFD700 25%, #FFF0A0 50%, #FFD700 75%, #B8860B 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            backgroundSize: '300% auto', animation: 'metalFlow 8s linear infinite',
            lineHeight: 1, marginBottom: '12px',
            filter: 'drop-shadow(0 0 8px rgba(255,215,0,0.55)) drop-shadow(0 0 22px rgba(255,215,0,0.28))',
          }}>Bridgelab</h1>
          <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.82rem', fontStyle: 'italic', letterSpacing: '0.03em', marginBottom: '0' }}>
            {isDE ? 'Wir bauen keine Apps. Wir bauen Brücken.' : 'We don\'t build apps. We build bridges.'}
          </p>
        </div>
        {glassBtn('vocara', onSprechen, 'Vocara', isDE ? 'Sprache' : 'Language', isDE ? 'Wörter, Sätze & Gespräche' : 'Words, sentences & conversation', false)}
        {glassBtn('entdecken', onEntdecken, 'Katara', 'Strukturiertes Lernen', 'Lern was du willst. Wann du willst.', false)}
      </div>
    </div>
  )
}


function SetsScreen({ user, myData, setMyData, partnerData, lang, theme, allCards, cardProgress, coupleId, onBack, onLiveSession }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const isDE = lang === 'de'
  const [innerScreen, setInnerScreen] = useState('list') // 'list' | 'create' | 'set'
  const [activeSet, setActiveSet] = useState(null)
  const [setAction, setSetAction] = useState(null) // 'manual' | 'ki' | null
  const [newSetName, setNewSetName] = useState('')
  const [newSetIcon, setNewSetIcon] = useState('📚')
  const [cardFront, setCardFront] = useState('')
  const [cardBack, setCardBack] = useState('')
  const [kiTopic, setKiTopic] = useState('')
  const [kiLoading, setKiLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [status, setStatus] = useState(null)
  const [challengeInput, setChallengeInput] = useState('')
  const [challengeSaving, setChallengeSaving] = useState(false)
  const fileRef = useRef(null)
  const [categories, setCategories] = useState([])
  const [newCatName, setNewCatName] = useState('')
  const [catError, setCatError] = useState('')
  const [catSaving, setCatSaving] = useState(false)

  const sets = myData?.cardSets || []
  const FREE_LIMIT = 2

  // ── PAAR-CHALLENGE helpers ──────────────────────────────────
  const weekStr = getISOWeekStr()
  const weekFilter = (h) => {
    try { return getISOWeekStr(new Date(...h.date.split('-').map((v, i) => i === 1 ? v - 1 : +v))) === weekStr }
    catch(e) { return false }
  }
  const myChallenge = myData?.weekChallenge?.week === weekStr ? myData.weekChallenge : null
  const partnerChallenge = partnerData?.weekChallenge?.week === weekStr ? partnerData.weekChallenge : null
  const myWeekCards = (myData?.sessionHistory || []).filter(weekFilter).reduce((a, b) => a + (b.correct || 0), 0)
  const partnerWeekCards = (partnerData?.sessionHistory || []).filter(weekFilter).reduce((a, b) => a + (b.correct || 0), 0)
  const hasPartner = !!(myData?.partnerUID || partnerData)
  const partnerName = myData?.partnerName || partnerData?.name?.split(' ')[0] || 'Partner'
  const myName = user?.displayName?.split(' ')[0] || 'Du'
  const challengeTarget = myChallenge?.target || partnerChallenge?.target || 0
  const myPct = challengeTarget > 0 ? Math.min(100, Math.round(myWeekCards / challengeTarget * 100)) : 0
  const partnerPct = challengeTarget > 0 ? Math.min(100, Math.round(partnerWeekCards / challengeTarget * 100)) : 0
  const bothDone = challengeTarget > 0 && myWeekCards >= challengeTarget && partnerWeekCards >= challengeTarget

  const saveChallenge = async () => {
    const target = parseInt(challengeInput, 10)
    if (!target || target < 1) return
    setChallengeSaving(true)
    const challenge = { week: weekStr, target }
    try {
      await updateDoc(doc(db, 'users', user.uid), { weekChallenge: challenge })
      setMyData(d => ({ ...d, weekChallenge: challenge }))
      // Also write to partner if connected so they see the same target
      if (myData?.partnerUID) {
        await updateDoc(doc(db, 'users', myData.partnerUID), { weekChallenge: challenge }).catch(() => {})
      }
    } catch(e) { console.warn('saveChallenge failed:', e) }
    setChallengeSaving(false)
    setChallengeInput('')
  }

  const iconOptions = ['📚','🎯','✈️','🍽️','💼','🏠','🎵','🌿','🏋️','🧠','💬','🛒','❤️','🌍','🎓']

  const saveSet = async (updatedSets) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), { cardSets: updatedSets })
      setMyData(d => ({ ...d, cardSets: updatedSets }))
    } catch (e) { console.warn('saveSet failed:', e) }
  }

  const createSet = async () => {
    if (!newSetName.trim()) return
    if (sets.length >= FREE_LIMIT) return
    const newSet = { id: `set_${Date.now()}`, name: newSetName.trim(), icon: newSetIcon, cards: [], createdAt: Date.now() }
    const updated = [...sets, newSet]
    await saveSet(updated)
    setNewSetName(''); setNewSetIcon('📚')
    setActiveSet(newSet); setInnerScreen('set')
  }

  const loadCategories = async () => {
    console.log('[Vocara] loadCategories — fetching users/' + user.uid + '/categories')
    try {
      const snap = await getDocs(collection(db, 'users', user.uid, 'categories'))
      const cats = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      console.log('[Vocara] loadCategories — got', cats.length, 'categories:', cats.map(c => c.name))
      setCategories(cats)
    } catch (e) { console.error('[Vocara] loadCategories failed:', e) }
  }

  useEffect(() => { loadCategories() }, [user?.uid]) // eslint-disable-line

  const createKategorie = async () => {
    console.log('[Vocara] createKategorie — input value:', JSON.stringify(newCatName))
    if (!newCatName.trim()) {
      console.log('[Vocara] createKategorie — input empty, showing validation error')
      setCatError('Bitte einen Namen eingeben')
      return
    }
    setCatError('')
    setCatSaving(true)
    try {
      console.log('[Vocara] createKategorie — writing to Firestore: users/' + user.uid + '/categories')
      await addDoc(collection(db, 'users', user.uid, 'categories'), {
        name: newCatName.trim(),
        createdAt: Date.now(),
      })
      console.log('[Vocara] createKategorie — Firestore write successful ✓')
      setNewCatName('')
      setCatError('')
      setInnerScreen('list')
      console.log('[Vocara] createKategorie — refreshing category list...')
      await loadCategories()
      console.log('[Vocara] createKategorie — list refreshed ✓')
    } catch (e) {
      console.error('[Vocara] createKategorie — addDoc failed:', e)
      setCatError(isDE ? 'Fehler beim Speichern. Bitte erneut versuchen.' : 'Error saving. Please try again.')
    }
    setCatSaving(false)
  }

  const addCardToSet = async () => {
    if (!cardFront.trim() || !cardBack.trim() || !activeSet) return
    const card = { id: `sc_${Date.now()}`, front: cardFront.trim(), back: cardBack.trim() }
    const updatedSet = { ...activeSet, cards: [...(activeSet.cards || []), card] }
    const updated = sets.map(s => s.id === activeSet.id ? updatedSet : s)
    await saveSet(updated)
    setActiveSet(updatedSet); setCardFront(''); setCardBack('')
    setStatus(isDE ? 'Karte hinzugefügt ✓' : 'Card added ✓')
    setTimeout(() => setStatus(null), 2000)
  }

  const deleteCardFromSet = async (cardId) => {
    const updatedSet = { ...activeSet, cards: activeSet.cards.filter(c => c.id !== cardId) }
    const updated = sets.map(s => s.id === activeSet.id ? updatedSet : s)
    await saveSet(updated); setActiveSet(updatedSet)
  }

  const deleteSet = async (setId) => {
    if (!window.confirm(isDE ? 'Set wirklich löschen?' : 'Delete this set?')) return
    const updated = sets.filter(s => s.id !== setId)
    await saveSet(updated); setInnerScreen('list'); setActiveSet(null)
  }

  const generateKiCards = async () => {
    if (!kiTopic.trim() || !activeSet) return
    setKiLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6', max_tokens: 800, system: CARD_GEN_SYSTEM,
          messages: [{ role: 'user', content: `Create exactly 10 flashcards about: "${kiTopic.trim()}". Return ONLY a JSON array, no markdown:\n[{"front":"<term or question>","back":"<translation or answer>"}]` }]
        })
      })
      const data = await res.json()
      const raw = data.content?.[0]?.text?.trim() || '[]'
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
      const ts = Date.now()
      const newCards = parsed.slice(0, 10).map((c, i) => ({ id: `sc_ki_${ts}_${i}`, front: c.front, back: c.back }))
      const updatedSet = { ...activeSet, cards: [...(activeSet.cards || []), ...newCards] }
      const updated = sets.map(s => s.id === activeSet.id ? updatedSet : s)
      await saveSet(updated); setActiveSet(updatedSet); setKiTopic('')
      setStatus(isDE ? `${newCards.length} KI-Karten hinzugefügt ✓` : `${newCards.length} AI cards added ✓`)
      setTimeout(() => setStatus(null), 3000)
    } catch (e) {
      setStatus(isDE ? 'Fehler bei KI-Generierung' : 'AI generation failed')
      setTimeout(() => setStatus(null), 3000)
    } finally { setKiLoading(false); setSetAction(null) }
  }

  const handleImport = async (file) => {
    if (!file || !activeSet) return
    setImportLoading(true)
    try {
      const text = await file.text()
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: 1200,
          messages: [{ role: 'user', content: `Parse this text into flashcard pairs. Each line or entry should become one card. Return ONLY a JSON array, no markdown:\n[{"front":"...","back":"..."}]\n\nText:\n${text.slice(0, 3000)}` }]
        })
      })
      const data = await res.json()
      const raw = data.content?.[0]?.text?.trim() || '[]'
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
      const ts = Date.now()
      const newCards = parsed.slice(0, 50).map((c, i) => ({ id: `sc_imp_${ts}_${i}`, front: c.front, back: c.back }))
      const updatedSet = { ...activeSet, cards: [...(activeSet.cards || []), ...newCards] }
      const updated = sets.map(s => s.id === activeSet.id ? updatedSet : s)
      await saveSet(updated); setActiveSet(updatedSet)
      setStatus(isDE ? `${newCards.length} Karten importiert ✓` : `${newCards.length} cards imported ✓`)
      setTimeout(() => setStatus(null), 3000)
    } catch (e) {
      setStatus(isDE ? 'Import fehlgeschlagen' : 'Import failed')
      setTimeout(() => setStatus(null), 3000)
    } finally { setImportLoading(false); setSetAction(null) }
  }

  const shareSetWithPartner = async (set) => {
    if (!myData?.partnerUID) return
    try {
      const pSnap = await getDoc(doc(db, 'users', myData.partnerUID))
      if (!pSnap.exists()) return
      const existing = pSnap.data()?.cardSets || []
      const shared = { ...set, id: `set_shared_${Date.now()}`, sharedBy: user.displayName?.split(' ')[0] || 'Partner', sharedAt: Date.now() }
      await updateDoc(doc(db, 'users', myData.partnerUID), { cardSets: [...existing, shared] })
      setStatus(isDE ? 'Set geteilt ✓' : 'Set shared ✓'); setTimeout(() => setStatus(null), 2500)
    } catch (e) { setStatus(isDE ? 'Teilen fehlgeschlagen' : 'Share failed'); setTimeout(() => setStatus(null), 2500) }
  }

  // ── SET detail view ──
  if (innerScreen === 'set' && activeSet) {
    return (
      <div style={s.container} className="vocara-screen">
        <div style={{ ...s.homeBox, paddingTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
            <button style={s.backBtn} onClick={() => { setInnerScreen('list'); setActiveSet(null); setSetAction(null) }}>← {isDE ? 'Zurück' : 'Back'}</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <span style={{ fontSize: '1.8rem' }}>{activeSet.icon}</span>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <h2 style={{ color: th.text, fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>{activeSet.name}</h2>
              <p style={{ color: th.sub, fontSize: '0.8rem', margin: 0 }}>{activeSet.cards?.length || 0} {isDE ? 'Karten' : 'cards'}</p>
            </div>
            {myData?.partnerUID && (
              <button onClick={() => shareSetWithPartner(activeSet)} style={{ background: 'transparent', border: `1px solid ${th.border}`, color: th.gold, borderRadius: '10px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.75rem' }}>↗ {isDE ? 'Teilen' : 'Share'}</button>
            )}
          </div>

          {/* ── Action buttons ── */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <button onClick={() => setSetAction(a => a === 'manual' ? null : 'manual')} style={{ flex: 1, padding: '10px 6px', borderRadius: '12px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', background: setAction === 'manual' ? `${th.accent}25` : 'transparent', color: setAction === 'manual' ? th.text : th.sub, border: `1px solid ${setAction === 'manual' ? th.accent : th.border}` }}>+ {isDE ? 'Manuell' : 'Manual'}</button>
            <button onClick={() => setSetAction(a => a === 'ki' ? null : 'ki')} style={{ flex: 1, padding: '10px 6px', borderRadius: '12px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', background: setAction === 'ki' ? `${th.accent}25` : 'transparent', color: setAction === 'ki' ? th.text : th.sub, border: `1px solid ${setAction === 'ki' ? th.accent : th.border}` }}>🤖 {isDE ? 'KI' : 'AI'}</button>
            <button onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: '10px 6px', borderRadius: '12px', cursor: importLoading ? 'default' : 'pointer', fontSize: '0.78rem', fontWeight: '600', background: 'transparent', color: importLoading ? th.sub : th.sub, border: `1px solid ${th.border}` }}>
              {importLoading ? '...' : `📄 ${isDE ? 'Import' : 'Import'}`}
            </button>
            <input ref={fileRef} type="file" accept=".txt,.csv" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) handleImport(e.target.files[0]); e.target.value = '' }} />
          </div>

          {setAction === 'manual' && (
            <div style={{ ...s.card, marginBottom: '12px' }}>
              <input style={{ ...s.input, marginBottom: '8px' }} placeholder={isDE ? 'Vorderseite' : 'Front'} value={cardFront} onChange={e => setCardFront(e.target.value)} />
              <input style={{ ...s.input, marginBottom: '10px' }} placeholder={isDE ? 'Rückseite' : 'Back'} value={cardBack} onChange={e => setCardBack(e.target.value)} />
              <button style={{ ...s.button, marginBottom: 0 }} onClick={addCardToSet}>{isDE ? 'Karte hinzufügen' : 'Add card'}</button>
            </div>
          )}

          {setAction === 'ki' && (
            <div style={{ ...s.card, marginBottom: '12px' }}>
              <input style={{ ...s.input, marginBottom: '10px' }} placeholder={isDE ? 'Thema (z.B. Farben auf Spanisch)' : 'Topic (e.g. Colors in Spanish)'} value={kiTopic} onChange={e => setKiTopic(e.target.value)} />
              <button style={{ ...s.button, marginBottom: 0, opacity: kiLoading ? 0.6 : 1 }} onClick={generateKiCards} disabled={kiLoading}>{kiLoading ? '...' : isDE ? '10 Karten generieren' : 'Generate 10 cards'}</button>
            </div>
          )}

          {status && <p style={{ color: th.accent, fontSize: '0.85rem', textAlign: 'center', marginBottom: '10px' }}>{status}</p>}

          {/* ── Card list ── */}
          {(activeSet.cards || []).length === 0 ? (
            <div style={{ ...s.card, textAlign: 'center', padding: '28px' }}>
              <p style={{ color: th.sub, fontSize: '0.9rem', margin: 0 }}>{isDE ? 'Noch keine Karten — füge welche hinzu!' : 'No cards yet — add some!'}</p>
            </div>
          ) : (
            <div style={s.card}>
              {(activeSet.cards || []).map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${th.border}` }}>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <span style={{ color: th.text, fontSize: '0.85rem', fontWeight: '600' }}>{c.front}</span>
                    <span style={{ color: th.sub, fontSize: '0.82rem' }}> → </span>
                    <span style={{ color: th.accent, fontSize: '0.85rem' }}>{c.back}</span>
                  </div>
                  <button onClick={() => deleteCardFromSet(c.id)} style={{ background: 'transparent', border: 'none', color: '#f4433666', cursor: 'pointer', fontSize: '1rem', padding: '4px 8px' }}>✕</button>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => deleteSet(activeSet.id)} style={{ ...s.logoutBtn, marginTop: '16px', color: '#f44336', borderColor: '#f4433644' }}>{isDE ? 'Set löschen' : 'Delete set'}</button>
        </div>
      </div>
    )
  }

  // ── Create category view ──
  if (innerScreen === 'create') {
    return (
      <div style={s.container} className="vocara-screen">
        <div style={{ ...s.homeBox, paddingTop: '16px' }}>
          <button style={s.backBtn} onClick={() => { setInnerScreen('list'); setNewCatName(''); setCatError('') }}>← {isDE ? 'Zurück' : 'Back'}</button>
          <h2 style={{ color: th.text, fontSize: '1.2rem', fontWeight: '700', marginBottom: '20px', textAlign: 'left' }}>{isDE ? 'Neue Kategorie' : 'New category'}</h2>
          <div style={s.card}>
            <input
              style={{ ...s.input, marginBottom: catError ? '6px' : '14px', borderColor: catError ? '#f44336' : undefined }}
              placeholder={isDE ? 'Name der Kategorie' : 'Category name'}
              value={newCatName}
              onChange={e => { setNewCatName(e.target.value); if (catError) setCatError('') }}
              onKeyDown={e => { if (e.key === 'Enter') createKategorie() }}
              autoFocus
            />
            {catError && (
              <p style={{ color: '#f44336', fontSize: '0.8rem', marginBottom: '12px', marginTop: 0 }}>{catError}</p>
            )}
            <button
              style={{ ...s.button, opacity: catSaving ? 0.6 : 1 }}
              onClick={createKategorie}
              disabled={catSaving}
            >
              {catSaving ? (isDE ? 'Speichern…' : 'Saving…') : (isDE ? 'Kategorie erstellen' : 'Create category')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Set list view ──
  return (
    <div style={s.container} className="vocara-screen">
      <div style={{ ...s.homeBox, paddingTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '18px' }}>
          <button style={{ ...s.backBtn, marginBottom: 0, marginRight: '8px' }} onClick={onBack}>← {isDE ? 'Zurück' : 'Back'}</button>
          <h2 style={{ color: th.text, fontSize: '1.2rem', fontWeight: '700', flex: 1, textAlign: 'center', margin: 0 }}>Katara</h2>
        </div>

        {/* ── PAAR-CHALLENGE ── */}
        {hasPartner && (
          <div style={{ ...s.card, marginBottom: '18px', padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span style={{ fontSize: '1.3rem' }}>🤝</span>
              <p style={{ color: th.text, fontWeight: '700', fontSize: '0.95rem', margin: 0 }}>
                {isDE ? 'Diese Woche zusammen' : 'This week together'}
              </p>
              {bothDone && <span style={{ marginLeft: 'auto', fontSize: '1.2rem' }}>🎉</span>}
            </div>
            {challengeTarget > 0 ? (
              <>
                {/* My progress */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: th.sub, fontSize: '0.78rem' }}>{myName}</span>
                    <span style={{ color: myWeekCards >= challengeTarget ? th.gold : th.text, fontSize: '0.78rem', fontWeight: '600' }}>{myWeekCards} / {challengeTarget}</span>
                  </div>
                  <div style={{ height: '6px', background: `${th.border}`, borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${myPct}%`, background: myWeekCards >= challengeTarget ? th.gold : th.accent, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
                {/* Partner progress */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: th.sub, fontSize: '0.78rem' }}>{partnerName}</span>
                    <span style={{ color: partnerWeekCards >= challengeTarget ? th.gold : th.text, fontSize: '0.78rem', fontWeight: '600' }}>{partnerWeekCards} / {challengeTarget}</span>
                  </div>
                  <div style={{ height: '6px', background: `${th.border}`, borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${partnerPct}%`, background: partnerWeekCards >= challengeTarget ? th.gold : `${th.accent}99`, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
                {bothDone && (
                  <p style={{ color: th.gold, fontSize: '0.82rem', fontWeight: '700', textAlign: 'center', marginTop: '10px', marginBottom: 0 }}>
                    {isDE ? '✓ Beide Ziele erreicht!' : '✓ Both goals reached!'}
                  </p>
                )}
                <button onClick={() => setChallengeInput(String(challengeTarget))}
                  style={{ background: 'transparent', border: 'none', color: th.sub, fontSize: '0.72rem', cursor: 'pointer', padding: '6px 0 0', WebkitTapHighlightColor: 'transparent' }}>
                  {isDE ? 'Ziel ändern' : 'Change goal'}
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number" min="1" max="500"
                  placeholder={isDE ? 'Ziel (z.B. 50)' : 'Goal (e.g. 50)'}
                  value={challengeInput}
                  onChange={e => setChallengeInput(e.target.value)}
                  style={{ ...s.input, flex: 1, marginBottom: 0, fontSize: '0.9rem', padding: '10px 12px' }}
                />
                <button onClick={saveChallenge} disabled={challengeSaving || !challengeInput}
                  style={{ ...s.button, padding: '10px 16px', fontSize: '0.85rem', marginBottom: 0, opacity: (!challengeInput || challengeSaving) ? 0.5 : 1 }}>
                  {isDE ? 'Setzen' : 'Set'}
                </button>
              </div>
            )}
            {challengeInput && challengeTarget > 0 && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                <input
                  type="number" min="1" max="500"
                  placeholder={isDE ? 'Neues Ziel' : 'New goal'}
                  value={challengeInput}
                  onChange={e => setChallengeInput(e.target.value)}
                  style={{ ...s.input, flex: 1, marginBottom: 0, fontSize: '0.9rem', padding: '10px 12px' }}
                />
                <button onClick={saveChallenge} disabled={challengeSaving}
                  style={{ ...s.button, padding: '10px 16px', fontSize: '0.85rem', marginBottom: 0 }}>
                  ✓
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── GEMEINSAME KARTEN-SAMMLUNG (#13) ── */}
        {hasPartner && partnerData && (() => {
          const myMasteredFronts = new Set(
            (allCards || [])
              .filter(c => !/_r(_\d+)?$/.test(c.id) && (cardProgress[c.id]?.interval || 0) >= 3)
              .map(c => (c.front || '').trim().toLowerCase())
          )
          const partnerProgress = partnerData.cardProgress || {}
          const sharedMastered = (allCards || []).filter(c => {
            if (/_r(_\d+)?$/.test(c.id)) return false
            const front = (c.front || '').trim().toLowerCase()
            return myMasteredFronts.has(front) && (partnerProgress[c.id]?.interval || 0) >= 3
          })
          if (sharedMastered.length === 0) return null
          return (
            <div style={{ ...s.card, marginBottom: '18px', padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '1.3rem' }}>💑</span>
                <p style={{ color: th.text, fontWeight: '700', fontSize: '0.95rem', margin: 0 }}>
                  {isDE ? 'Unsere Karten' : 'Our Cards'}
                </p>
                <span style={{ marginLeft: 'auto', background: `${th.gold}18`, color: th.gold, border: `1px solid ${th.gold}44`, borderRadius: '12px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: '700' }}>
                  {sharedMastered.length}
                </span>
              </div>
              <p style={{ color: th.sub, fontSize: '0.78rem', margin: '0 0 10px' }}>
                {isDE ? `Beide gemeistert · ${partnerName} & Du` : `Both mastered · ${partnerName} & you`}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                {sharedMastered.slice(0, 20).map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: `${th.gold}08`, borderRadius: '10px', border: `1px solid ${th.gold}22` }}>
                    <span style={{ color: th.text, fontSize: '0.82rem', fontWeight: '600', flex: 1 }}>{c.front}</span>
                    <span style={{ color: th.sub, fontSize: '0.72rem' }}>→</span>
                    <span style={{ color: th.accent, fontSize: '0.82rem', flex: 1, textAlign: 'right' }}>{c.back}</span>
                    <span style={{ fontSize: '0.7rem', flexShrink: 0 }}>💑</span>
                  </div>
                ))}
                {sharedMastered.length > 20 && (
                  <p style={{ color: th.sub, fontSize: '0.72rem', textAlign: 'center', margin: '4px 0 0' }}>+{sharedMastered.length - 20} {isDE ? 'weitere' : 'more'}</p>
                )}
              </div>
            </div>
          )
        })()}

        {/* ── SYNCHRONES LERNEN ── */}
        {hasPartner && coupleId && onLiveSession && (
          <button onClick={onLiveSession}
            style={{ ...s.card, display: 'flex', alignItems: 'center', gap: '14px', width: '100%', cursor: 'pointer', marginBottom: '18px', padding: '16px', textAlign: 'left', border: `1px solid ${th.gold}44`, background: `${th.gold}08` }}>
            <span style={{ fontSize: '1.8rem', flexShrink: 0 }}>⚡</span>
            <div style={{ flex: 1 }}>
              <p style={{ color: th.text, fontWeight: '700', margin: '0 0 2px', fontSize: '0.95rem' }}>{isDE ? 'Jetzt zusammen lernen' : 'Learn together now'}</p>
              <p style={{ color: th.sub, fontSize: '0.78rem', margin: 0 }}>{isDE ? 'Gleiche Karten — gleichzeitig' : 'Same cards — at the same time'}</p>
            </div>
            <span style={{ color: th.gold, fontSize: '1rem' }}>›</span>
          </button>
        )}

        {/* ── KATEGORIEN ── */}
        <div style={{ marginBottom: '8px' }}>
          <p style={{ color: th.sub, fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>
            {isDE ? 'Kategorien' : 'Categories'} {categories.length > 0 && `(${categories.length})`}
          </p>
          {categories.length === 0 ? (
            <div style={{ ...s.card, textAlign: 'center', padding: '28px 20px', marginBottom: '10px' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>📂</span>
              <p style={{ color: th.sub, fontSize: '0.85rem', margin: 0 }}>{isDE ? 'Noch keine Kategorien — erstelle deine erste!' : 'No categories yet — create your first one!'}</p>
            </div>
          ) : (
            categories.map(cat => (
              <div key={cat.id}
                style={{ ...s.card, display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px', padding: '14px 16px' }}>
                <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>📂</span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: th.text, fontWeight: '700', margin: '0 0 2px', fontSize: '0.95rem' }}>{cat.name}</p>
                  <p style={{ color: th.sub, fontSize: '0.75rem', margin: 0 }}>{cat.createdAt ? new Date(cat.createdAt).toLocaleDateString('de-DE') : ''}</p>
                </div>
              </div>
            ))
          )}
          <button style={{ ...s.button, marginTop: '4px', marginBottom: '20px' }} onClick={() => setInnerScreen('create')}>
            + {isDE ? 'Neue Kategorie' : 'New category'}
          </button>
        </div>

        {/* ── SETS ── */}
        {sets.length > 0 && (
          <>
            <p style={{ color: th.sub, fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>Sets</p>
            {sets.map((set, idx) => {
              const isLocked = idx >= FREE_LIMIT
              return (
                <button key={set.id} onClick={isLocked ? undefined : () => { setActiveSet(set); setInnerScreen('set') }}
                  style={{ ...s.card, display: 'flex', alignItems: 'center', gap: '14px', width: '100%', cursor: isLocked ? 'default' : 'pointer', opacity: isLocked ? 0.5 : 1, marginBottom: '10px', padding: '16px', textAlign: 'left' }}>
                  <span style={{ fontSize: '1.8rem', flexShrink: 0 }}>{set.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: th.text, fontWeight: '700', margin: '0 0 2px', fontSize: '0.95rem' }}>{set.name}</p>
                    <p style={{ color: th.sub, fontSize: '0.78rem', margin: 0 }}>{set.cards?.length || 0} {isDE ? 'Karten' : 'cards'}</p>
                  </div>
                  {isLocked ? (
                    <span style={{ background: `${th.gold}18`, color: th.gold, border: `1px solid ${th.gold}44`, borderRadius: '12px', padding: '3px 10px', fontSize: '0.72rem', fontWeight: '600', flexShrink: 0 }}>🔒 Premium</span>
                  ) : (
                    <span style={{ color: th.sub, fontSize: '1rem' }}>›</span>
                  )}
                </button>
              )
            })}
          </>
        )}

        {status && <p style={{ color: th.accent, fontSize: '0.85rem', textAlign: 'center', marginTop: '10px' }}>{status}</p>}
      </div>
    </div>
  )
}

// ── LIVE SESSION SCREEN (#41) ────────────────────────────────
function LiveSessionScreen({ user, myData, partnerData, coupleId, allCards, lang, theme, onBack }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const isDE = lang === 'de'
  const partnerName = myData?.partnerName || partnerData?.name?.split(' ')[0] || 'Partner'
  const myName = user.displayName?.split(' ')[0] || 'Ich'
  const [liveData, setLiveData] = useState(null) // Firestore live session doc
  const [myAnswer, setMyAnswer] = useState(null) // 'correct'|'wrong'
  const [status, setStatus] = useState('waiting') // 'waiting'|'active'|'done'
  const liveRef = useRef(null)
  const unsubRef = useRef(null)

  // Pick cards: up to 10 mastered vocabulary cards, deterministic for today
  const sessionCards = (() => {
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
    const cardProgress = myData?.cardProgress || {}
    const pool = allCards.filter(c => !/_r(_\d+)?$/.test(c.id) && (cardProgress[c.id]?.interval || 0) >= 1)
    const shuffled = [...pool].sort((a, b) => (a.id + dayOfYear).localeCompare(b.id))
    return shuffled.slice(0, 10)
  })()

  useEffect(() => {
    if (!coupleId) return
    liveRef.current = doc(db, 'shared', coupleId, 'liveSession', 'current')
    // Subscribe to live updates
    try {
      unsubRef.current = onSnapshot(liveRef.current, (snap) => {
        if (snap.exists()) {
          const data = snap.data()
          setLiveData(data)
          if (data.active === false) setStatus('done')
          else setStatus('active')
        } else {
          setLiveData(null)
          setStatus('waiting')
        }
      }, (e) => { console.warn('[Vocara] shared/ snapshot denied (shared/' + coupleId + '):', e?.code || e?.message); setStatus('waiting') })
    } catch (e) { console.warn('[Vocara] shared/ subscribe failed:', e?.code || e?.message) }
    return () => { if (unsubRef.current) unsubRef.current() }
  }, [coupleId])

  const startSession = async () => {
    if (!liveRef.current) return
    const cardIds = sessionCards.map(c => c.id)
    try {
      await setDoc(liveRef.current, {
        hostUID: user.uid,
        cardIndex: 0,
        cardIds,
        answers: {},
        startedAt: Date.now(),
        active: true,
      })
      setStatus('active')
    } catch (e) { console.warn('[Vocara] shared/ startSession denied (shared/' + coupleId + '):', e?.code || e?.message) }
  }

  const recordAnswer = async (correct) => {
    if (!liveRef.current || !liveData) return
    const idx = liveData.cardIndex || 0
    const answerKey = `${user.uid}_${idx}`
    setMyAnswer(correct ? 'correct' : 'wrong')
    const updates = { [`answers.${answerKey}`]: correct ? 'correct' : 'wrong' }
    // Both answered? Advance card or finish
    const partnerUID = myData?.partnerUID || (user.uid === MARK_UID ? ELOSY_UID : ELOSY_UID === user.uid ? MARK_UID : null)
    const partnerKey = partnerUID ? `${partnerUID}_${idx}` : null
    const partnerAnswered = partnerKey && liveData.answers?.[partnerKey]
    if (partnerAnswered) {
      const next = idx + 1
      if (next >= (liveData.cardIds?.length || 0)) {
        updates.active = false
      } else {
        updates.cardIndex = next
      }
      setMyAnswer(null)
    }
    await updateDoc(liveRef.current, updates).catch(console.warn)
  }

  const endSession = async () => {
    if (liveRef.current) await updateDoc(liveRef.current, { active: false }).catch(console.warn)
    onBack()
  }

  const currentIdx = liveData?.cardIndex || 0
  const currentCardId = liveData?.cardIds?.[currentIdx]
  const currentCard = sessionCards.find(c => c.id === currentCardId) || sessionCards[currentIdx]
  const totalCards = liveData?.cardIds?.length || sessionCards.length
  const partnerUID = myData?.partnerUID || (user.uid === MARK_UID ? ELOSY_UID : user.uid === ELOSY_UID ? MARK_UID : null)
  const myAnswerNow = liveData?.answers?.[`${user.uid}_${currentIdx}`]
  const partnerAnswerNow = partnerUID ? liveData?.answers?.[`${partnerUID}_${currentIdx}`] : null

  if (status === 'done') {
    const myCorrect = Object.entries(liveData?.answers || {}).filter(([k, v]) => k.startsWith(user.uid) && v === 'correct').length
    const partnerCorrect = partnerUID ? Object.entries(liveData?.answers || {}).filter(([k, v]) => k.startsWith(partnerUID) && v === 'correct').length : 0
    return (
      <div style={s.container} className="vocara-screen"><div style={{ ...s.homeBox, paddingTop: '40px' }}>
        <div style={{ textAlign: 'center', animation: 'vocaraFadeIn 0.4s ease both' }}>
          <p style={{ fontSize: '3rem', marginBottom: '16px' }}>🎉</p>
          <h2 style={{ color: th.text, fontSize: '1.4rem', fontWeight: '700', marginBottom: '20px' }}>{isDE ? 'Session beendet!' : 'Session done!'}</h2>
          <div style={{ ...s.card, marginBottom: '12px' }}>
            <p style={{ color: th.sub, fontSize: '0.78rem', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '1px' }}>{isDE ? 'Ergebnis' : 'Results'}</p>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: th.text, fontWeight: '700', fontSize: '1.6rem', margin: '0 0 4px' }}>{myCorrect}</p>
                <p style={{ color: th.sub, fontSize: '0.78rem', margin: 0 }}>{myName}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: th.text, fontWeight: '700', fontSize: '1.6rem', margin: '0 0 4px' }}>{partnerCorrect}</p>
                <p style={{ color: th.sub, fontSize: '0.78rem', margin: 0 }}>{partnerName}</p>
              </div>
            </div>
          </div>
          <button style={s.button} onClick={onBack}>{isDE ? '← Zurück' : '← Back'}</button>
        </div>
      </div></div>
    )
  }

  return (
    <div style={s.container} className="vocara-screen"><div style={{ ...s.homeBox, paddingTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <button style={{ ...s.backBtn, marginBottom: 0 }} onClick={endSession}>← {isDE ? 'Beenden' : 'End'}</button>
        <p style={{ color: th.text, fontWeight: '700', fontSize: '1rem', flex: 1, textAlign: 'center', margin: 0 }}>
          {isDE ? '⚡ Gemeinsam lernen' : '⚡ Learn together'}
        </p>
      </div>

      {status === 'waiting' && !liveData && (
        <div style={{ ...s.card, textAlign: 'center', padding: '36px 24px' }}>
          <p style={{ fontSize: '2.5rem', marginBottom: '14px' }}>⚡</p>
          <p style={{ color: th.text, fontWeight: '700', fontSize: '1rem', marginBottom: '8px' }}>{isDE ? 'Bereit für eine gemeinsame Session?' : 'Ready for a joint session?'}</p>
          <p style={{ color: th.sub, fontSize: '0.85rem', marginBottom: '20px' }}>
            {isDE ? `Beide sehen dieselben Karten gleichzeitig.` : `Both see the same cards at the same time.`}
          </p>
          <button style={s.button} onClick={startSession}>{isDE ? '🚀 Session starten' : '🚀 Start session'}</button>
        </div>
      )}

      {status === 'waiting' && liveData?.active && (
        <div style={{ ...s.card, textAlign: 'center', padding: '24px' }}>
          <p style={{ color: th.sub, fontSize: '0.9rem' }}>{partnerName} {isDE ? 'hat eine Session gestartet.' : 'started a session.'}</p>
          <button style={{ ...s.button, marginTop: '12px' }} onClick={() => setStatus('active')}>{isDE ? 'Beitreten' : 'Join'}</button>
        </div>
      )}

      {status === 'active' && currentCard && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: th.sub, fontSize: '0.78rem' }}>{currentIdx + 1} / {totalCards}</span>
            <span style={{ color: th.sub, fontSize: '0.78rem' }}>{isDE ? 'Synchron' : 'Sync'} ⚡</span>
          </div>
          <div style={{ ...s.bigCard, marginBottom: '20px' }}>
            <p style={{ ...s.cardFront, marginBottom: '10px' }}>{currentCard.front}</p>
            <div style={{ height: '1px', background: th.border, width: '60%', margin: '8px auto' }} />
            <p style={{ ...s.cardBack }}>{currentCard.back}</p>
          </div>
          {/* Partner status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', padding: '0 4px' }}>
            <span style={{ color: myAnswerNow === 'correct' ? '#4CAF50' : myAnswerNow === 'wrong' ? th.accent : th.sub, fontSize: '0.82rem' }}>
              {myName}: {myAnswerNow === 'correct' ? '✓' : myAnswerNow === 'wrong' ? '✗' : (isDE ? 'antwortet…' : 'answering…')}
            </span>
            <span style={{ color: partnerAnswerNow === 'correct' ? '#4CAF50' : partnerAnswerNow === 'wrong' ? th.accent : th.sub, fontSize: '0.82rem' }}>
              {partnerName}: {partnerAnswerNow === 'correct' ? '✓' : partnerAnswerNow === 'wrong' ? '✗' : (isDE ? 'antwortet…' : 'answering…')}
            </span>
          </div>
          {!myAnswerNow && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => recordAnswer(true)}
                style={{ ...s.button, flex: 1, background: 'rgba(76,175,80,0.15)', border: '1px solid rgba(76,175,80,0.4)', color: '#81c784', marginBottom: 0 }}>✓ {isDE ? 'Gewusst' : 'Correct'}</button>
              <button onClick={() => recordAnswer(false)}
                style={{ ...s.button, flex: 1, background: `${th.accent}15`, border: `1px solid ${th.accent}44`, color: th.accent, marginBottom: 0 }}>✗ {isDE ? 'Nicht gewusst' : 'Wrong'}</button>
            </div>
          )}
          {myAnswerNow && (
            <p style={{ color: th.sub, fontSize: '0.85rem', textAlign: 'center', fontStyle: 'italic' }}>
              {isDE ? `Wartet auf ${partnerName}…` : `Waiting for ${partnerName}…`}
            </p>
          )}
        </>
      )}
    </div></div>
  )
}

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err, info) {
    console.error('[Vocara] render crash — message:', err?.message)
    console.error('[Vocara] render crash — stack:', err?.stack)
    console.error('[Vocara] component stack:', info?.componentStack)
  }
  render() {
    if (this.state.hasError) return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', color: '#fff', gap: '20px', padding: '24px', textAlign: 'center' }}>
        <p style={{ fontSize: '1.1rem', color: '#aaa' }}>Etwas ist schiefgelaufen.</p>
        <button onClick={() => { try { localStorage.clear(); sessionStorage.clear() } catch(e) {} window.location.reload() }} style={{ background: '#1a1a1a', color: '#fff', border: '1px solid #444', borderRadius: '14px', padding: '14px 28px', fontSize: '1rem', cursor: 'pointer' }}>🏠 Zur Startseite</button>
      </div>
    )
    return this.props.children
  }
}

// ── AMBIENT AUDIO ENGINE — DISABLED (oscillator hum removed) ──────────────────
// Music feature is pending proper streaming integration. All audio noop for now.
function ambientEnableMubert() {}
function ambientDisableAll() {}
function ambientSwitchThemeMubert() {}
function ambientSetVol() {}

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [myData, setMyData] = useState(null)
  const [partnerData, setPartnerData] = useState(null)
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('vocara_theme') || 'nairobi' } catch { return 'nairobi' }
  })
  const [lightMode, setLightMode] = useState(false)
  const [cardSize, setCardSize] = useState('normal')
  const [needsLangSetup, setNeedsLangSetup] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [isNewUser, setIsNewUser] = useState(false)
  const [mainNav, setMainNav] = useState('main')
  const [musicEnabled, setMusicEnabled] = useState(() => { try { return localStorage.getItem('vocara_music') === 'true' } catch { return false } })
  const [musicVolume, setMusicVolume] = useState(() => { try { return parseFloat(localStorage.getItem('vocara_music_vol') || '0.35') } catch { return 0.35 } })
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const id = 'vocara-global-css'
    if (!document.getElementById(id)) {
      const el = document.createElement('style'); el.id = id; el.textContent = GLOBAL_CSS
      document.head.appendChild(el)
    }
  }, [])

  // ── OFFLINE DETECTION ─────────────────────────────────────
  useEffect(() => {
    const on = () => setIsOffline(false); const off = () => setIsOffline(true)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // ── MUSIC CONTROL ─────────────────────────────────────────
  useEffect(() => {
    if (musicEnabled && user) ambientEnableMubert(theme, musicVolume)
    else ambientDisableAll()
  }, [musicEnabled, musicVolume, user]) // eslint-disable-line

  const prevThemeRef = useRef(theme)
  useEffect(() => {
    if (theme !== prevThemeRef.current) {
      prevThemeRef.current = theme
      if (musicEnabled) ambientSwitchThemeMubert(theme, musicVolume)
    }
  }, [theme]) // eslint-disable-line

  const handleMusicToggle = async (val) => {
    setMusicEnabled(val)
    try { localStorage.setItem('vocara_music', val ? 'true' : 'false') } catch {}
    if (user) setDoc(doc(db, 'users', user.uid, 'settings', 'music'), { enabled: val }, { merge: true }).catch(() => {})
  }
  const handleMusicVolume = async (vol) => {
    setMusicVolume(vol)
    try { localStorage.setItem('vocara_music_vol', String(vol)) } catch {}
    if (musicEnabled) ambientSetVol(vol)
    if (user) setDoc(doc(db, 'users', user.uid, 'settings', 'music'), { volume: vol }, { merge: true }).catch(() => {})
  }

  // Auto-generate German-phonetic pronunciation for aiCards missing it
  useEffect(() => {
    if (!user || !myData) return
    const aiCards = (myData.aiCards || []).filter(c => !/_r(_\d+)?$/.test(c.id) && !c.pronunciation)
    const cardProg = myData.cardProgress || {}
    const needsPhonetic = aiCards.filter(c => !cardProg[c.id]?._phonetic).slice(0, 5)
    if (needsPhonetic.length === 0) return
    const generate = async () => {
      for (const card of needsPhonetic) {
        try {
          const res = await fetch('/api/chat', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001', max_tokens: 30,
              messages: [{ role: 'user', content: `Give ONLY the German-phonetic pronunciation for this word/phrase: "${card.front}". Output only the phonetic spelling, nothing else. Example: "weather" → "WE-dser", "through" → "Ssru"` }]
            })
          })
          const data = await res.json()
          const phonetic = data.content?.[0]?.text?.trim()
          if (phonetic && phonetic.length < 60) {
            const update = {}
            update[`cardProgress.${card.id}._phonetic`] = phonetic
            await updateDoc(doc(db, 'users', user.uid), update).catch(() => {})
            setMyData(d => {
              const cp = { ...(d.cardProgress || {}) }
              cp[card.id] = { ...cp[card.id], _phonetic: phonetic }
              return { ...d, cardProgress: cp }
            })
          }
        } catch(e) {}
      }
    }
    generate()
  }, [myData?.aiCards?.length, user?.uid])

  // Batch-detect wordType for vocabulary aiCards missing it (max 10/day)
  useEffect(() => {
    if (!user || !myData) return
    const today = todayStr()
    if (myData.lastWordTypeBatch === today) return
    const vocabCards = (myData.aiCards || []).filter(c => c.category === 'vocabulary' && !/_r(_\d+)?$/.test(c.id) && !c.wordType)
    const batch = vocabCards.slice(0, 10)
    if (batch.length === 0) return
    const detect = async () => {
      const isMarkLang = (myData.fromLang || 'de').toLowerCase() === 'de'
      const langInstr = isMarkLang ? 'English' : 'German'
      const list = batch.map(c => `"${c.front}"`).join(', ')
      try {
        const res = await fetch('/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001', max_tokens: 400,
            messages: [{ role: 'user', content: `For each ${langInstr} word/phrase, return its word type and (for nouns) the article. Word types: ${isMarkLang ? 'Noun/Verb/Adjective/Adverb/Phrase' : 'Nomen/Verb/Adjektiv/Adverb/Phrase'}. Return ONLY JSON array: [{"front":"word","wordType":"Noun","article":"the"}]. Words: [${list}]` }]
          })
        })
        const data = await res.json()
        const raw = (data.content?.[0]?.text || '').trim()
        const match = raw.match(/\[[\s\S]*\]/)
        if (!match) return
        const results = JSON.parse(match[0])
        const updatedCards = (myData.aiCards || []).map(c => {
          const r = results.find(r => r.front?.toLowerCase() === c.front?.toLowerCase())
          if (!r || c.wordType) return c
          return { ...c, wordType: r.wordType || null, article: r.article || null }
        })
        await updateDoc(doc(db, 'users', user.uid), { aiCards: updatedCards, lastWordTypeBatch: today })
        setMyData(d => ({ ...d, aiCards: updatedCards, lastWordTypeBatch: today }))
      } catch(e) {}
    }
    detect()
  }, [myData?.aiCards?.length, user?.uid]) // eslint-disable-line

  // #9 Schedule daily notification based on notificationTime setting
  useEffect(() => {
    if (!myData?.notificationTime || myData.notificationTime === 'off') return
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const [hStr, mStr] = myData.notificationTime.split(':')
    const now = new Date()
    const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hStr), parseInt(mStr), 0)
    if (target <= now) target.setDate(target.getDate() + 1) // schedule for tomorrow if time already passed
    const ms = target - now
    const tid = setTimeout(() => {
      new Notification('Vocara', { body: 'Zeit zum Lernen! 🌍 Deine Karten warten.', icon: '/vite.svg' })
    }, ms)
    return () => clearTimeout(tid)
  }, [myData?.notificationTime])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        // LOGOUT: clear all local state so next user starts fresh
        setMyData(null); setPartnerData(null)
        setNeedsOnboarding(false); setNeedsLangSetup(false); setIsNewUser(false)
        setMainNav('main')
        setUser(null); setLoading(false)
        return
      }
      try {
        const userRef = doc(db, 'users', u.uid)
        const code = u.uid.slice(0, 8).toUpperCase()
        try { await setDoc(doc(db, 'inviteCodes', code), { uid: u.uid }, { merge: true }) }
        catch (e) { console.warn('[Vocara] inviteCodes write skipped (path: inviteCodes/' + code + '):', e?.code || e?.message) }
        const snap = await getDoc(userRef)

        // ── NEW USER: first login, no profile with createdAt yet
        // NEVER treat known UIDs as new users — protects Elosy/Mark data
        const isKnownUID = u.uid === MARK_UID || u.uid === ELOSY_UID
        if (!isKnownUID && (!snap.exists() || !snap.data()?.createdAt)) {
          const defaultFromLang = u.uid === ELOSY_UID ? 'en' : 'de'
          const profile = { name: u.displayName, email: u.email, createdAt: Date.now(), language: defaultFromLang, fromLang: defaultFromLang, lastActive: todayStr() }
          await setDoc(userRef, profile, { merge: true })
          setMyData(profile)
          setIsNewUser(true)
          setUser(u); setLoading(false)
          return
        }

        // ── RETURNING USER: update presence and load data
        // Use setDoc+merge so it works even if doc exists but some fields were lost
        await setDoc(userRef, { name: u.displayName, email: u.email, lastActive: todayStr() }, { merge: true })
        const freshSnap = await getDoc(userRef)
        if (freshSnap.exists()) {
          const data = freshSnap.data()
          if (data.theme) { setTheme(data.theme); try { localStorage.setItem('vocara_theme', data.theme) } catch {} }
          if (data.lightMode !== undefined) setLightMode(!!data.lightMode)
          if (data.cardSize) setCardSize(data.cardSize)
          // ── BATCH CATEGORY FIX: vocabulary + 3+ words → sentence ─
          // baseCards only for Mark/Elosy; other users only process their aiCards
          try {
            const baseCards = u.uid === MARK_UID ? ALL_MARK_CARDS_BASE : u.uid === ELOSY_UID ? ALL_ELOSY_CARDS_BASE : []
            const aiCards = data.aiCards || []
            const existingCats = data.cardCategories || {}
            const newCats = { ...existingCats }
            let batchChanged = false

            for (const card of [...baseCards, ...aiCards]) {
              const front = card.front || ''
              const wordCount = front.trim().split(' ').filter(Boolean).length
              const current = newCats[card.id]

              // basics are untouchable
              if (card.category === 'basics' || card.source === 'ai-basics') {
                if (current !== 'basics') {
                  console.log('Reclassified:', front, '→ basics (protected)')
                  newCats[card.id] = 'basics'
                  batchChanged = true
                }
                continue
              }

              // DIRECT RULE: vocabulary + 3+ words = sentence, always
              if (current === 'vocabulary' && wordCount >= 3 && !DE_VOCAB_WHITELIST.has(front.trim().toLowerCase())) {
                console.log('Reclassified:', front, '→ sentence')
                newCats[card.id] = 'sentence'
                batchChanged = true
                continue
              }

              // Run ruleCategory for anything else that looks wrong
              const back = card.back || ''
              const backWordCount = back.trim().split(/\s+/).filter(Boolean).length
              const swahiliRe = /\b(habari|yako|nzuri|asante|karibu|pole|sawa|jambo|mambo|rafiki|wewe|mimi|nina|hii|hilo|chakula|maji|nyumba|watoto|upendo)\b/i
              const isSwahiliCard = card.pronunciation || swahiliRe.test(front) || card.langA === 'sw'
              const needsRun = !current || current === '' ||
                (wordCount === 1 && DE_VOCAB_WHITELIST.has(front.trim().toLowerCase()) && current !== 'vocabulary') ||
                (isSwahiliCard && current !== 'street') ||
                (current === 'vocabulary' && wordCount === 1 && backWordCount >= 3)
              if (!needsRun) continue
              const newCat = ruleCategory(card)
              if (current !== newCat) {
                console.log('Reclassified:', front, '→', newCat)
                newCats[card.id] = newCat
                batchChanged = true
              }
            }

            if (batchChanged) {
              await updateDoc(userRef, { cardCategories: newCats })
              // Re-fetch fresh from Firestore after batch fix
              const refetchSnap = await getDoc(userRef)
              if (refetchSnap.exists()) {
                const refetchData = refetchSnap.data()
                data.cardCategories = refetchData.cardCategories || newCats
                console.log('[category] Batch fix saved + re-fetched. Total entries:', Object.keys(data.cardCategories).length)
              }
            } else {
              console.log('[category] No changes needed')
            }
          } catch (catErr) {
            console.error('[Vocara] category batch fix failed:', catErr)
          }
          // One-time migration: write fromLang to Elosy's profile if missing
          if (u.uid === ELOSY_UID && !data.fromLang) {
            try {
              await updateDoc(userRef, { fromLang: 'en', toLang: 'de' })
              data.fromLang = 'en'; data.toLang = 'de'
            } catch (_) {}
          }
          const isKnown = u.uid === MARK_UID || u.uid === ELOSY_UID
          if (!isKnown) {
            if (!data.onboardingDone) setNeedsOnboarding(true)
            if (!data.languages || data.languages.length === 0) setNeedsLangSetup(true)
          }
          // ── PARTNER CONNECTION: cost-optimized — only write when partnerUid actually changed ──
          const CORRECT_PARTNER = u.uid === MARK_UID ? ELOSY_UID : u.uid === ELOSY_UID ? MARK_UID : null
          const CORRECT_PARTNER_NAME = u.uid === MARK_UID ? 'Elosy' : u.uid === ELOSY_UID ? 'Mark' : null
          if (CORRECT_PARTNER && data.partnerUID !== CORRECT_PARTNER) {
            data.partnerUID = CORRECT_PARTNER; data.partnerName = CORRECT_PARTNER_NAME
            try { await setDoc(userRef, { partnerUID: CORRECT_PARTNER, partnerName: CORRECT_PARTNER_NAME }, { merge: true }) } catch (_) {}
          }
          const pUid = data.partnerUID || data.partnerUid || (u.uid === MARK_UID ? ELOSY_UID : u.uid === ELOSY_UID ? MARK_UID : null) || null
          if (pUid) {
            try { localStorage.setItem('vocara_partnerUID_' + u.uid, pUid) } catch (_) {}
            const cachedPartnerUid = (() => { try { return localStorage.getItem('vocara_partnerUid') } catch(_) { return null } })()
            if (cachedPartnerUid !== pUid) {
              // Only Firestore-write when partnerUid changed — reduces costs
              console.log('[Vocara] Partner sync: writing to Firestore', u.uid, '→', pUid)
              await Promise.all([
                setDoc(doc(db, 'users', u.uid, 'profile', 'data'), { partnerUid: pUid, partnerName: data.partnerName || null, uid: u.uid, updatedAt: Date.now() }, { merge: true }).catch(() => {}),
                setDoc(doc(db, 'userProfiles', u.uid), { partnerUID: pUid, partnerName: data.partnerName || null }, { merge: true }).catch(() => {}),
              ])
              try { localStorage.setItem('vocara_partnerUid', pUid) } catch (_) {}
            } else {
              console.log('[Vocara] Partner sync: skipped (no change), partnerUid =', pUid)
            }
            // Debug: log both profiles for diagnosis
            ;(async () => {
              try {
                const [myPub, myProf, pPub, pProf] = await Promise.all([
                  getDoc(doc(db, 'userProfiles', u.uid)).catch(() => null),
                  getDoc(doc(db, 'users', u.uid, 'profile', 'data')).catch(() => null),
                  getDoc(doc(db, 'userProfiles', pUid)).catch(() => null),
                  getDoc(doc(db, 'users', pUid, 'profile', 'data')).catch(() => null),
                ])
                console.log('[Vocara] MY  userProfiles/' + u.uid + ':', myPub?.exists() ? myPub.data() : 'MISSING')
                console.log('[Vocara] MY  users/' + u.uid + '/profile/data:', myProf?.exists() ? myProf.data() : 'MISSING')
                console.log('[Vocara] PTR userProfiles/' + pUid + ':', pPub?.exists() ? pPub.data() : 'MISSING')
                console.log('[Vocara] PTR users/' + pUid + '/profile/data:', pProf?.exists() ? pProf.data() : 'MISSING')
              } catch(e) { console.warn('[Vocara] profile debug failed', e) }
            })()
          }
          // ── CHECK INCOMING CARDS (subcollection) ──
          try {
            const incomingSnap = await getDocs(collection(db, 'users', u.uid, 'incomingCards'))
            if (!incomingSnap.empty && !data.pendingGift) {
              const firstCard = incomingSnap.docs[0]
              data.pendingGift = { ...firstCard.data(), _incomingId: firstCard.id }
            }
          } catch (_) {}
          // Write full public profile to userProfiles/{uid} (readable by partner)
          // Never write partnerUID: null for known UIDs — only write if we have a value
          try {
            const pubProfile = {
              displayName: u.displayName, name: data.name || u.displayName,
              email: u.email, photoURL: u.photoURL || null, lastActive: todayStr()
            }
            if (data.partnerUID) { pubProfile.partnerUID = data.partnerUID; pubProfile.partnerName = data.partnerName || null }
            await setDoc(doc(db, 'userProfiles', u.uid), pubProfile, { merge: true })
          } catch (e) { console.warn('[Vocara] userProfiles write skipped:', e?.code) }
          setMyData(data)
          // Load music settings from Firestore
          getDoc(doc(db, 'users', u.uid, 'settings', 'music')).then(mSnap => {
            if (!mSnap.exists()) return
            const md = mSnap.data()
            if (md.enabled !== undefined) { setMusicEnabled(md.enabled); try { localStorage.setItem('vocara_music', md.enabled ? 'true' : 'false') } catch {} }
            if (md.volume !== undefined) { setMusicVolume(md.volume); try { localStorage.setItem('vocara_music_vol', String(md.volume)) } catch {} }
          }).catch(() => {})
          // Load partner from 3 sources in order: localStorage → userProfiles → users/ → hardcoded
          const loadPartner = async (partnerUID) => {
            // 1. Try localStorage (fastest, no network)
            try {
              const lsName = localStorage.getItem('vocara_partnerName_' + partnerUID)
              if (lsName) { setPartnerData({ name: lsName, displayName: lsName, _fromCache: true }); }
            } catch (_) {}
            // 2. Try userProfiles/{uid} (public, always up to date)
            try {
              const pubSnap = await getDoc(doc(db, 'userProfiles', partnerUID))
              if (pubSnap.exists()) { setPartnerData(pubSnap.data()); try { localStorage.setItem('vocara_partnerName_' + partnerUID, pubSnap.data().name || pubSnap.data().displayName || '') } catch {} ; return }
            } catch (_) {}
            // 3. Try users/{partnerUID}/profile/data subcollection
            try {
              const profSnap = await getDoc(doc(db, 'users', partnerUID, 'profile', 'data'))
              if (profSnap.exists()) { setPartnerData(profSnap.data()); return }
            } catch (_) {}
            // 4. Try shared/{uid}
            try {
              const sharedSnap = await getDoc(doc(db, 'shared', partnerUID))
              if (sharedSnap.exists()) { setPartnerData(sharedSnap.data()); return }
            } catch (_) {}
            // 5. Try users/{uid}
            try {
              const pSnap = await getDoc(doc(db, 'users', partnerUID))
              if (pSnap.exists()) { setPartnerData(pSnap.data()); return }
            } catch (_) {}
            // 6. Hardcoded fallback — never crash
            if (partnerUID === ELOSY_UID) setPartnerData({ name: 'Elosy', displayName: 'Elosy', lastActive: null })
            else if (partnerUID === MARK_UID) setPartnerData({ name: 'Mark', displayName: 'Mark', lastActive: null })
            else console.warn('[Vocara] partner load failed for uid=' + partnerUID)
          }
          const resolvedPartnerUID = data.partnerUID || data.partnerUid ||
            (u.uid === MARK_UID ? ELOSY_UID : u.uid === ELOSY_UID ? MARK_UID : null)
          if (resolvedPartnerUID) await loadPartner(resolvedPartnerUID)
          // ── CHECK PARTNER ACTIVITY NOTIFS ──
          try {
            const notifSnap = await getDocs(collection(db, 'userProfiles', u.uid, 'pendingNotifs'))
            if (!notifSnap.empty) {
              notifSnap.docs.forEach(async (nd) => {
                const n = nd.data()
                if (n.type === 'partner_session' && 'Notification' in window && Notification.permission === 'granted') {
                  const isDE = (data.language || data.fromLang || 'de') === 'de'
                  const body = isDE
                    ? `${n.fromName} hat gerade ${n.cards} Karten gelernt! 💪`
                    : `${n.fromName} just practiced ${n.cards} cards! 💪`
                  new Notification('Vocara', { body, icon: '/vite.svg' })
                }
                try { await deleteDoc(nd.ref) } catch (_) {}
              })
            }
          } catch (_) {}
        }
      } catch (initErr) {
        console.error('[Vocara] app init failed, falling back to defaults:', initErr)
      }
      // Update lastActive timestamp for partner visibility
      try { await updateDoc(doc(db, 'users', u.uid), { lastActive: new Date().toISOString() }) } catch(e) {}
      setUser(u); setLoading(false)
    })
    return unsubscribe
  }, [])

  const saveProgress = async (finalProgress) => {
    try {
      const ref = doc(db, 'users', user.uid)
      await updateDoc(ref, { cardProgress: finalProgress })
      const snap = await getDoc(ref); if (snap.exists()) setMyData(snap.data())
    } catch (e) { console.error('[Vocara] saveProgress failed (users/' + user?.uid + '):', e?.code || e?.message) }
  }
  const handleThemeChange = async (newTheme) => {
    setTheme(newTheme)
    try { localStorage.setItem('vocara_theme', newTheme) } catch {}
    if (user) await updateDoc(doc(db, 'users', user.uid), { theme: newTheme }).catch(e => console.warn('[Vocara] theme save failed:', e?.code))
  }
  const handleLightModeChange = async (val) => {
    setLightMode(val)
    if (user) await updateDoc(doc(db, 'users', user.uid), { lightMode: val }).catch(() => {})
  }
  const handleCardSizeChange = async (val) => {
    setCardSize(val)
    if (user) await updateDoc(doc(db, 'users', user.uid), { cardSize: val }).catch(() => {})
  }
  const handlePartnerUpdate = async (partnerUID) => {
    try {
      const ref = doc(db, 'users', user.uid)
      const snap = await getDoc(ref); if (snap.exists()) setMyData(snap.data())
    } catch (e) { console.warn('[Vocara] own data reload failed:', e?.code) }
    if (partnerUID) {
      let loaded = false
      try { const pub = await getDoc(doc(db, 'userProfiles', partnerUID)); if (pub.exists()) { setPartnerData(pub.data()); loaded = true } } catch (_) {}
      if (!loaded) {
        try { const p = await getDoc(doc(db, 'users', partnerUID)); if (p.exists()) setPartnerData(p.data()) }
        catch (e) { console.warn('[Vocara] partner load skipped (uid=' + partnerUID + '):', e?.code) }
      }
    } else setPartnerData(null)
  }
  const handleSaveCefr = async (level) => {
    try {
      const update = { cefr: level, lastTestDate: todayStr() }
      await updateDoc(doc(db, 'users', user.uid), update)
      setMyData(d => ({ ...d, ...update }))
    } catch(e) { console.warn('saveCefr failed:', e) }
  }
  const handleOnboardingDone = async (cityData = {}) => {
    const update = { onboardingDone: true }
    if (cityData.homeCity) update.homeCity = cityData.homeCity
    if (cityData.partnerCity) update.partnerCity = cityData.partnerCity
    if (cityData.relationshipType) update.relationshipType = cityData.relationshipType
    await updateDoc(doc(db, 'users', user.uid), update)
    setMyData(d => ({ ...d, ...update }))
    setNeedsOnboarding(false)
  }


  const th = THEMES[theme]
  const isMarkUser = user?.uid === MARK_UID
  const isElosyUser = user?.uid === ELOSY_UID
  // fromLang is the user's native language (the UI language), stored as e.g. "EN" or "en"
  // Priority: fromLang (Firestore) > identity-based default > legacy language field > 'de'
  // Known users (Elosy/Mark) bypass the legacy 'language' field so a stale 'de' default never overrides
  const langRaw = myData?.fromLang || (isElosyUser ? 'en' : isMarkUser ? 'de' : myData?.language || 'de')
  const lang = langRaw.toLowerCase()

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: th.bg, color: th.text }}>Laden...</div>
  if (!user) return <LoginScreen theme={theme} />

  // New user: show welcome screen with call to action
  if (isNewUser) return <WelcomeScreen user={user} theme={theme} onContinue={() => { setIsNewUser(false); setMainNav('entdecken') }} />

  // Onboarding: show for new users before lang setup
  if (needsOnboarding) return <OnboardingScreen lang={lang} theme={theme} onDone={handleOnboardingDone} />

  if (needsLangSetup) return <LangSetupScreen user={user} lang={lang} theme={theme} onDone={(langs) => { setNeedsLangSetup(false); setMyData(d => ({ ...d, languages: langs })) }} />

  const cardCategories = myData?.cardCategories || {}
  const allCards = [
    ...(isMarkUser ? ALL_MARK_CARDS : isElosyUser ? ALL_ELOSY_CARDS : []),
    ...(myData?.aiCards || []).flatMap(buildCardPair),
    ...(myData?.sharedCards || []),
  ].map(card => {
    const baseId = card.id.replace(/_r(_\d+)?$/, '')
    const aiCat = cardCategories[baseId]
    return aiCat ? { ...card, category: aiCat } : card
  })

  const hour = new Date().getHours()
  const timeOverlay = hour >= 0 && hour < 6
    ? 'rgba(0,20,50,0.06)'         // 00–06: deep night blue (#46)
    : hour >= 6 && hour < 12
      ? 'rgba(255,200,50,0.03)'    // 06–12: warm golden morning (#46)
      : hour >= 18
        ? 'rgba(255,100,0,0.04)'   // 18–24: deeper warm evening (#46)
        : null                     // 12–18: normal, no overlay

  const seasonOverlay = getSeasonOverlay(theme)
  const uniqueTargetLangsAll = [...new Set(allCards.map(c => c.targetLang).filter(Boolean))]
  const firstNameAll = user?.displayName?.split(' ')[0] || user?.displayName || ''

  // Compute coupleId for live session
  const partnerUID = myData?.partnerUID || (user?.uid === MARK_UID ? ELOSY_UID : user?.uid === ELOSY_UID ? MARK_UID : null)
  const coupleId = partnerUID ? [user.uid, partnerUID].sort().join('_') : null

  return (
    <AppPrefsContext.Provider value={{ lightMode, cardSize }}>
      <ErrorBoundary>
        {/* ── BRIDGELAB BACK BUTTON (fixed, all screens) ── */}
        <button
          onClick={() => { window.location.href = 'https://vocara-peach.vercel.app' }}
          style={{
            position: 'fixed', top: 10, left: 10, zIndex: 9999,
            background: 'rgba(0,0,0,0.45)', color: 'rgba(255,255,255,0.55)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px', padding: '5px 11px',
            fontSize: '0.72rem', fontWeight: '500',
            cursor: 'pointer', backdropFilter: 'blur(6px)',
            WebkitTapHighlightColor: 'transparent',
            letterSpacing: '0.02em',
          }}
        >
          ← Bridgelab
        </button>
        <WaterCanvas />
        {(theme === 'nairobi' || theme === 'welt') && <ParticleCanvas theme={theme} />}
        {timeOverlay && <div style={{ position: 'fixed', inset: 0, background: timeOverlay, pointerEvents: 'none', zIndex: 2 }} />}
        {seasonOverlay && <div style={{ position: 'fixed', inset: 0, background: seasonOverlay, pointerEvents: 'none', zIndex: 3 }} />}
        {mainNav === 'main' && (
          <MainSelectionScreen
            lang={lang} theme={theme} firstName={firstNameAll}
            uniqueTargetLangs={uniqueTargetLangsAll} pausedLanguages={myData?.pausedLanguages || []}
            onSprechen={() => setMainNav('sprechen')}
            onEntdecken={() => { window.open('https://katara-eta.vercel.app', '_blank'); }}
          />
        )}
        {mainNav === 'sprechen' && (
          <MenuScreen user={user} myData={myData} setMyData={setMyData} partnerData={partnerData}
            allCards={allCards}
            lang={lang} onSaveProgress={saveProgress}
            theme={theme} onThemeChange={handleThemeChange}
            onLightModeChange={handleLightModeChange} onCardSizeChange={handleCardSizeChange}
            onPartnerUpdate={handlePartnerUpdate} onSaveCefr={handleSaveCefr}
            musicEnabled={musicEnabled} musicVolume={musicVolume}
            onMusicToggle={handleMusicToggle} onMusicVolume={handleMusicVolume}
            onBack={() => setMainNav('main')} />
        )}
        {isOffline && (
          <div style={{ position: 'fixed', top: '10px', right: '10px', background: 'rgba(50,50,60,0.92)', color: '#bbb', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '5px 12px', fontSize: '0.72rem', fontWeight: '600', zIndex: 9998, backdropFilter: 'blur(8px)' }}>
            📵 Offline
          </div>
        )}
        {mainNav === 'entdecken' && (
          <SetsScreen user={user} myData={myData} setMyData={setMyData} partnerData={partnerData}
            lang={lang} theme={theme} allCards={allCards} cardProgress={myData?.cardProgress || {}}
            coupleId={coupleId}
            onBack={() => setMainNav('main')} onLiveSession={() => setMainNav('livesession')} />
        )}
{mainNav === 'livesession' && coupleId && (
          <LiveSessionScreen user={user} myData={myData} partnerData={partnerData} coupleId={coupleId}
            allCards={allCards} lang={lang} theme={theme} onBack={() => setMainNav('entdecken')} />
        )}
      </ErrorBoundary>
    </AppPrefsContext.Provider>
  )
}

export default App
