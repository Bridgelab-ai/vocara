import React, { useState, useEffect, useRef, Component } from 'react'
import { auth, db } from './firebase'
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore'
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
    bg: '#0D0800', card: '#1A0F00', text: '#FFF5E0', sub: '#C8860A', border: '#3A2800',
    accent: '#C8860A', gold: '#F5C842', glowColor: '#F5C842', btnTextColor: '#1A0800',
    bgGrad: 'radial-gradient(ellipse at 50% 100%, #5C3000 0%, #2A1200 35%, #0D0800 65%), radial-gradient(ellipse at 65% 75%, #3A1800 0%, transparent 45%), radial-gradient(ellipse at 30% 55%, #1E0C00 0%, transparent 45%)',
    metalGrad: 'linear-gradient(145deg, #F5C842 0%, #C8860A 30%, #7A4F00 52%, #C8860A 72%, #F5C842 100%)',
    metalText: 'linear-gradient(90deg, #7A4F00 0%, #F5D060 16%, #C8860A 33%, #F5C842 50%, #7A4F00 66%, #F5D060 83%, #C8860A 100%)',
    btnFaceGrad: 'linear-gradient(90deg, #7A4F00 0%, #C8860A 20%, #E8A020 40%, #F5C842 50%, #E8A020 60%, #C8860A 80%, #7A4F00 100%)',
    shadow3d: '0 1px 0 rgba(245,200,66,0.4) inset, 0 -1px 0 rgba(0,0,0,0.5) inset, 0 4px 0 #7A4F00, 0 6px 0 #5A3800, 0 8px 0 #3A2000, 0 10px 20px rgba(20,10,0,0.8)',
    shadowPressed: '0 1px 0 rgba(245,200,66,0.2) inset, 0 -1px 0 rgba(0,0,0,0.4) inset, 0 1px 0 #7A4F00, 0 3px 8px rgba(20,10,0,0.6)',
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
  lyon: {
    name: '🍷 Lyon',
    bg: '#0D0000', card: '#1A0505', text: '#F5EDE0', sub: '#A0706A', border: '#3A1010',
    accent: '#8B1A1A', gold: '#D4A017', glowColor: '#C0392B', btnTextColor: '#F5EDE0',
    bgGrad: 'radial-gradient(ellipse at 50% 20%, #3A0808 0%, #1A0404 50%, #0D0000 100%)',
    metalGrad: 'linear-gradient(145deg, #D4A017 0%, #8B1A1A 30%, #3D0C0C 52%, #8B1A1A 72%, #D4A017 100%)',
    metalText: 'linear-gradient(90deg, #3D0C0C 0%, #D4A017 16%, #8B1A1A 33%, #D4A017 50%, #3D0C0C 66%, #D4A017 83%, #8B1A1A 100%)',
    btnFaceGrad: 'linear-gradient(90deg, #3D0C0C 0%, #8B1A1A 20%, #B02020 40%, #D4A017 50%, #B02020 60%, #8B1A1A 80%, #3D0C0C 100%)',
    shadow3d: '0 1px 0 rgba(212,160,23,0.4) inset, 0 -1px 0 rgba(0,0,0,0.5) inset, 0 4px 0 #5A0A0A, 0 6px 0 #3D0505, 0 8px 0 #200000, 0 10px 20px rgba(20,0,0,0.8)',
    shadowPressed: '0 1px 0 rgba(212,160,23,0.2) inset, 0 -1px 0 rgba(0,0,0,0.4) inset, 0 1px 0 #5A0A0A, 0 3px 8px rgba(20,0,0,0.6)',
  },
  sevilla: {
    name: '💃 Sevilla',
    bg: '#0D0500', card: '#1A0A02', text: '#FFF0E0', sub: '#A07050', border: '#3A1800',
    accent: '#C0392B', gold: '#F39C12', glowColor: '#E67E22', btnTextColor: '#FFF0E0',
    bgGrad: 'radial-gradient(ellipse at 50% 20%, #3A1200 0%, #1A0700 50%, #0D0500 100%)',
    metalGrad: 'linear-gradient(145deg, #F39C12 0%, #C0392B 30%, #6E1A0C 52%, #C0392B 72%, #F39C12 100%)',
    metalText: 'linear-gradient(90deg, #6E1A0C 0%, #F39C12 16%, #C0392B 33%, #F39C12 50%, #6E1A0C 66%, #F39C12 83%, #C0392B 100%)',
    btnFaceGrad: 'linear-gradient(90deg, #6E1A0C 0%, #C0392B 20%, #D45030 40%, #F39C12 50%, #D45030 60%, #C0392B 80%, #6E1A0C 100%)',
    shadow3d: '0 1px 0 rgba(243,156,18,0.4) inset, 0 -1px 0 rgba(0,0,0,0.5) inset, 0 4px 0 #7A1500, 0 6px 0 #560E00, 0 8px 0 #300500, 0 10px 20px rgba(20,5,0,0.8)',
    shadowPressed: '0 1px 0 rgba(243,156,18,0.2) inset, 0 -1px 0 rgba(0,0,0,0.4) inset, 0 1px 0 #7A1500, 0 3px 8px rgba(20,5,0,0.6)',
  },
  chiangmai: {
    name: '🏯 Chiang Mai',
    bg: '#2C1810', card: '#3D2318', text: '#FFF0D8', sub: '#D4A017', border: '#5C3820',
    accent: '#D4A017', gold: '#FFD700', glowColor: '#D4A017', btnTextColor: '#2C1810',
    bgGrad: 'radial-gradient(ellipse at 50% 20%, #6B3A20 0%, #3D2318 50%, #2C1810 100%)',
    metalGrad: 'linear-gradient(145deg, #FFD700 0%, #D4A017 30%, #8B4513 52%, #D4A017 72%, #FFD700 100%)',
    metalText: 'linear-gradient(90deg, #8B4513 0%, #FFD700 16%, #D4A017 33%, #FFD700 50%, #8B4513 66%, #FFD700 83%, #D4A017 100%)',
    btnFaceGrad: 'linear-gradient(90deg, #5C3820 0%, #8B4513 20%, #C0832A 40%, #D4A017 50%, #C0832A 60%, #8B4513 80%, #5C3820 100%)',
    shadow3d: '0 1px 0 rgba(255,215,0,0.4) inset, 0 -1px 0 rgba(0,0,0,0.5) inset, 0 4px 0 #5C3820, 0 6px 0 #3D2318, 0 8px 0 #2C1810, 0 10px 20px rgba(30,10,0,0.8)',
    shadowPressed: '0 1px 0 rgba(255,215,0,0.2) inset, 0 -1px 0 rgba(0,0,0,0.4) inset, 0 1px 0 #5C3820, 0 3px 8px rgba(30,10,0,0.6)',
  },
}

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

async function speak(text, langCode) {
  if (!window.speechSynthesis || !text) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const langTag = SPEECH_LANGS[langCode] || 'en-GB'
  u.lang = langTag; u.rate = 1.1
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
async function saveSessionHistory(uid, correct, total, currentHistory) {
  const entry = { date: todayStr(), correct, total, ts: Date.now() }
  const updated = [entry, ...(currentHistory || [])].slice(0, 60)
  await updateDoc(doc(db, 'users', uid), { sessionHistory: updated })
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
@keyframes vocaraCardFlip {
  0%   { transform: rotateY(0deg); }
  45%  { transform: rotateY(90deg); opacity: 0.6; }
  55%  { transform: rotateY(-90deg); opacity: 0.6; }
  100% { transform: rotateY(0deg); }
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
      const maxRadius = 80 + Math.random() * 220;          // 80–300 px
      const speed = 0.4 + Math.random() * 1.1;             // 0.4–1.5
      const startOpacity = 0.12 + Math.random() * 0.06;    // 0.12–0.18
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
    answerRow: { display: 'flex', gap: '10px', width: '100%' },
    wrongBtn: {
      flex: 1, background: 'rgba(224,108,117,0.12)', color: '#e06c75', border: '1px solid rgba(224,108,117,0.4)',
      padding: '12px', borderRadius: '50px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold',
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)',
    },
    easyBtn: {
      flex: '0 0 auto', background: `rgba(255,255,255,0.06)`, color: th.gold, border: `1px solid ${th.gold}55`,
      padding: '8px 14px', borderRadius: '50px', fontSize: '0.8rem', cursor: 'pointer',
      fontWeight: 'bold', alignSelf: 'center',
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      boxShadow: '0 3px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
    },
    rightBtn: {
      flex: 1, background: `linear-gradient(135deg, ${th.accent}35, ${th.accent}18)`,
      color: th.text, border: `1px solid ${th.accent}55`,
      padding: '12px', borderRadius: '50px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold',
      backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.12)',
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
    correct: 'Richtig', wrong: 'Falsch', easy: '⚡ Easy', stop: '✕ Beenden',
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
    menuGrundlagen: 'Die\nGrundlagen',
    menuKi: 'KI-Gespräch', menuSatz: 'Satztraining',
    menuAddCards: 'Karten hinzufügen', menuCategorize: 'Kategorisieren', menuSettings: 'Einstellungen', menuSignOut: 'Abmelden',
    menuPartnerConnect: 'Partner verbinden', menuPartnerLabel: 'Partner',
    weekGoalTitle: 'Wochenziel', weekGoalDone: 'Heute: vollständig. ✓',
  },
  en: {
    hello: 'Hello', mySession: '🃏 My session', whereAmI: '🎯 Where do I stand?',
    aiChat: '🤖 AI conversation', dailyPhrase: '☀️ Phrase of the day',
    progressBtn: '📈 Progress', logout: 'Sign out',
    myProgress: 'Your progress', notActive: 'No partner yet',
    card: 'Card', of: 'of', showSolution: 'Show answer',
    correct: 'Correct', wrong: 'Wrong', easy: '⚡ Easy', stop: '✕ Stop',
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
    menuGrundlagen: 'The\nBasics',
    menuKi: 'AI Chat', menuSatz: 'Sentence training',
    menuAddCards: 'Add cards', menuCategorize: 'Categorize', menuSettings: 'Settings', menuSignOut: 'Sign out',
    menuPartnerConnect: 'Connect partner', menuPartnerLabel: 'Partner',
    weekGoalTitle: 'Weekly goal', weekGoalDone: 'Today: complete. ✓',
  }
}

const WEEK_AREAS = [
  { key: 'vocabulary', labelDe: 'Wörter', labelEn: 'Words', tipDe: 'Meine Worte – diese Woche noch nicht geübt', tipEn: 'My Words – not practiced this week' },
  { key: 'sentence', labelDe: 'Sätze', labelEn: 'Sentences', tipDe: 'Sätze – diese Woche noch nicht geübt', tipEn: 'Sentences – not practiced this week' },
  { key: 'street', labelDe: 'Straße', labelEn: 'Street', tipDe: 'Auf der Straße – diese Woche noch nicht geübt', tipEn: 'On the Street – not practiced this week' },
  { key: 'home', labelDe: 'Zuhause', labelEn: 'Home', tipDe: 'Zu Hause – diese Woche noch nicht geübt', tipEn: 'At Home – not practiced this week' },
  { key: 'satztraining', labelDe: 'Training', labelEn: 'Training', tipDe: 'Satztraining – diese Woche noch nicht geübt', tipEn: 'Sentence Training – not practiced this week' },
  { key: 'basics', labelDe: 'Grundlagen', labelEn: 'Basics', tipDe: 'Grundlagen – noch nicht geübt', tipEn: 'Basics – not practiced yet' },
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

// ── KI-GESPRÄCH ───────────────────────────────────────────────
function KiGespraechScreen({ lang, theme, onBack, userName }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [translations, setTranslations] = useState({})
  const [translating, setTranslating] = useState(null)
  const bottomRef = useRef(null)
  const isMarkLang = lang === 'de'
  const targetLang = isMarkLang ? 'English' : 'German'
  const nativeLang = isMarkLang ? 'German' : 'English'
  const ttsLangCode = isMarkLang ? 'en' : 'de'
  const systemPrompt = `You are Vocara, a friendly language tutor helping ${userName} learn ${targetLang}. You must respond ONLY in ${targetLang}. Never use ${nativeLang} in your response. If the user writes in ${nativeLang}, still respond entirely in ${targetLang} and gently encourage them to try in ${targetLang} too. If the user makes a grammar mistake in ${targetLang}, have a natural conversation first, then add a short gentle correction at the end like "💡 Small tip: ..." Keep responses short (2-4 sentences). Be warm and natural — like a friend who happens to be a language expert. The Vocara philosophy: The voice is the bridge.`

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return
    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages); setInput(''); setLoading(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 300,
          system: systemPrompt,
          messages: newMessages,
        })
      })
      const data = await response.json()
      const reply = data.content?.[0]?.text || '...'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Verbindungsfehler. Bitte versuche es erneut.' }])
    }
    setLoading(false)
  }

  const translateMessage = async (msgIndex, text) => {
    setTranslating(msgIndex)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 200,
          messages: [{ role: 'user', content: `Translate this ${targetLang} text to ${nativeLang}. Return ONLY the translation, no explanation:\n\n"${text}"` }],
        })
      })
      const data = await res.json()
      const translation = (data.content?.[0]?.text || '').trim()
      setTranslations(prev => ({ ...prev, [msgIndex]: translation }))
    } catch (e) {
      setTranslations(prev => ({ ...prev, [msgIndex]: '⚠️ Übersetzung fehlgeschlagen' }))
    }
    setTranslating(null)
  }

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: th.bg }} className="vocara-screen">
      <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <div style={{ padding: '16px 20px 10px', background: th.bg, borderBottom: `1px solid ${th.border}`, display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <button style={{ ...s.backBtn, marginBottom: 0 }} onClick={onBack}>←</button>
          <div>
            <p style={{ color: th.text, fontWeight: 'bold', margin: 0, fontSize: '1rem' }}>🤖 KI-Gespräch</p>
            <p style={{ color: th.sub, fontSize: '0.75rem', margin: 0 }}>{isMarkLang ? `Übe Englisch mit KI` : 'Practice German with AI'}</p>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: '40px' }}>
              <p style={{ color: th.sub, fontSize: '0.9rem', lineHeight: '1.6' }}>
                {isMarkLang ? `Schreib auf Englisch oder Deutsch — die KI antwortet immer auf Englisch.` : 'Write in German or English — the AI always responds in German.'}
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: msg.role === 'user' ? th.accent : th.card, border: msg.role === 'assistant' ? `1px solid ${th.border}` : 'none', color: th.text, fontSize: '0.9rem', lineHeight: '1.5' }}>
                {msg.content}
              </div>
              {msg.role === 'assistant' && (
                <div style={{ maxWidth: '85%', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={() => speak(msg.content, ttsLangCode)}
                    style={{ background: 'none', border: 'none', color: th.sub, fontSize: '1rem', cursor: 'pointer', padding: '2px 4px', opacity: 0.6, flexShrink: 0 }}
                  >🔊</button>
                  {translations[i] ? (
                    <p style={{ color: th.sub, fontSize: '0.78rem', margin: 0, lineHeight: '1.4', fontStyle: 'italic', padding: '0 4px' }}>{translations[i]}</p>
                  ) : (
                    <button
                      onClick={() => translateMessage(i, msg.content)}
                      disabled={translating === i}
                      style={{ background: 'none', border: 'none', color: th.sub, fontSize: '0.75rem', cursor: 'pointer', padding: '2px 4px', opacity: translating === i ? 0.5 : 0.7, textDecoration: 'underline' }}
                    >
                      {translating === i ? '...' : isMarkLang ? '🌐 Übersetzen' : '🌐 Translate'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: th.card, border: `1px solid ${th.border}`, color: th.sub, fontSize: '1.2rem', letterSpacing: '4px' }}>···</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div style={{ padding: '12px 16px', background: th.bg, borderTop: `1px solid ${th.border}`, display: 'flex', gap: '8px', alignItems: 'flex-end', flexShrink: 0 }}>
          <textarea
            style={{ flex: 1, padding: '10px 14px', borderRadius: '12px', border: `1px solid ${th.border}`, background: th.card, color: th.text, fontSize: '0.95rem', resize: 'none', minHeight: '44px', maxHeight: '120px', fontFamily: 'inherit', outline: 'none', lineHeight: '1.4' }}
            placeholder={isMarkLang ? 'Schreib auf Englisch...' : 'Write in German...'}
            value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} rows={1}
          />
          <button style={{ background: th.accent, border: 'none', borderRadius: '12px', width: '44px', height: '44px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '1.1rem', opacity: loading ? 0.5 : 1, flexShrink: 0, color: '#fff' }} onClick={sendMessage} disabled={loading}>➤</button>
        </div>
      </div>
    </div>
  )
}

function SatzTrainingScreen({ lang, theme, onBack, allCards, cardProgress, userName }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const isMarkLang = lang === 'de'
  const [exercises, setExercises] = useState([])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [scrambleOrder, setScrambleOrder] = useState([])
  const [scrambleBank, setScrambleBank] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const masteredVocab = allCards
    .filter(c => (cardProgress[c.id]?.interval || 0) >= 7 && !c.id.includes('_r'))
    .map(c => c.front)
    .slice(0, 30)

  useEffect(() => {
    if (masteredVocab.length < 5) { setError('not_enough'); setLoading(false); return }
    generateExercises()
  }, [])

  const ttsLangCode = isMarkLang ? 'en' : 'de'

  const generateExercises = async () => {
    setLoading(true); setError(null)
    const targetLang = isMarkLang ? 'English' : 'German'
    const nativeLang = isMarkLang ? 'German' : 'English'
    const prompt = `Generate exactly 8 sentence exercises for a ${targetLang} learner (B1 level) whose native language is ${nativeLang}. Use these mastered vocabulary words where possible: ${masteredVocab.join(', ')}.

Mix these 3 types:
- "scramble": a ${targetLang} sentence split into shuffled word chips, user puts them in order
- "fill_blank": a ${targetLang} sentence with one blank, 4 multiple choice options
- "translate": a ${nativeLang} sentence to translate to ${targetLang}, 4 multiple choice options

Return ONLY a valid JSON array. No markdown. No explanation. Example format:
[
  {"type":"scramble","sentence":"I am on my way","shuffled":["my","am","way","on","I"],"vocab":"I'm on my way"},
  {"type":"fill_blank","blank_sentence":"She ___ very tired today.","options":["is","are","am","be"],"correct_index":0,"vocab":"tired"},
  {"type":"translate","prompt_sentence":"Ich bin dabei.","options":["I am in.","I'm down.","I am here.","I will come."],"correct_index":1,"vocab":"I'm down"}
]`

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setExercises(parsed)
      if (parsed[0]?.type === 'scramble') initScramble(parsed[0])
    } catch (e) { setError('api') }
    setLoading(false)
  }

  const initScramble = (ex) => {
    const shuffled = [...ex.shuffled].sort(() => Math.random() - 0.5)
    setScrambleBank(shuffled.map((w, i) => ({ word: w, id: i })))
    setScrambleOrder([])
  }

  const ex = exercises[index]

  const handleNext = (wasCorrect) => {
    if (wasCorrect) setScore(s => s + 1)
    const next = index + 1
    if (next >= exercises.length) { setDone(true); return }
    setIndex(next); setSelected(null); setRevealed(false)
    if (exercises[next]?.type === 'scramble') initScramble(exercises[next])
  }

  const checkScramble = () => {
    const answer = scrambleOrder.map(w => w.word).join(' ')
    const correct = answer.trim().toLowerCase() === ex.sentence.trim().toLowerCase()
    setRevealed(true); setSelected(correct ? 'correct' : 'wrong')
    speak(ex.sentence, ttsLangCode)
  }

  const addWord = (item) => {
    setScrambleOrder(o => [...o, item])
    setScrambleBank(b => b.filter(w => w.id !== item.id))
  }
  const removeWord = (item) => {
    setScrambleBank(b => [...b, item])
    setScrambleOrder(o => o.filter(w => w.id !== item.id))
  }

  if (loading) return (
    <div style={s.container} className="vocara-screen">
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: th.accent, fontSize: '1.4rem', marginBottom: '12px' }}>✦</p>
        <p style={{ color: th.sub, fontSize: '0.9rem' }}>{isMarkLang ? 'KI erstellt deine Satzübungen...' : 'AI is preparing your sentence exercises...'}</p>
      </div>
    </div>
  )

  if (error) return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>← {isMarkLang ? 'Zurück' : 'Back'}</button>
      <p style={{ color: th.accent, fontSize: '2rem', marginBottom: '12px' }}>⚠️</p>
      <p style={{ color: th.text, marginBottom: '16px' }}>
        {error === 'not_enough'
          ? (isMarkLang ? 'Du musst zuerst mindestens 5 Karten meistern.' : 'Master at least 5 cards first.')
          : (isMarkLang ? 'Verbindungsfehler. Bitte erneut versuchen.' : 'Connection error. Please try again.')}
      </p>
      {error === 'api' && <button style={s.button} onClick={generateExercises}>{isMarkLang ? 'Erneut versuchen' : 'Try again'}</button>}
      <button style={s.logoutBtn} onClick={onBack}>{isMarkLang ? 'Zurück' : 'Back'}</button>
    </div></div>
  )

  if (done) return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <h1 style={s.title}>{isMarkLang ? 'Fertig! 🎉' : 'Done! 🎉'}</h1>
      <div style={{ ...s.card, textAlign: 'center', padding: '24px' }}>
        <p style={{ color: th.gold, fontSize: '3rem', fontWeight: 'bold', margin: 0 }}>{score}/{exercises.length}</p>
        <p style={{ color: th.sub, fontSize: '0.9rem', marginTop: '8px' }}>
          {score === exercises.length ? '🏆 Perfekt!' : score >= exercises.length * 0.7 ? '💪 Sehr gut!' : '📚 Weiter üben!'}
        </p>
      </div>
      <button style={s.button} onClick={() => { setIndex(0); setScore(0); setDone(false); setLoading(true); generateExercises() }}>
        {isMarkLang ? '🔄 Neue Übungen' : '🔄 New exercises'}
      </button>
      <button style={s.logoutBtn} onClick={onBack}>{isMarkLang ? 'Zurück' : 'Back'}</button>
    </div></div>
  )

  if (!ex) return null

  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <div style={s.cardHeader}>
        <p style={s.greeting}>{index + 1} / {exercises.length}</p>
        <button style={s.stopBtn} onClick={onBack}>✕</button>
      </div>
      <div style={s.progressBar}><div style={{ ...s.progressFill, width: `${((index) / exercises.length) * 100}%` }} /></div>

      <p style={{ color: th.sub, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', margin: '12px 0 8px 0' }}>
        {ex.type === 'scramble' ? (isMarkLang ? '🔀 Richtige Reihenfolge' : '🔀 Correct order') :
         ex.type === 'fill_blank' ? (isMarkLang ? '✏️ Lückentext' : '✏️ Fill the blank') :
         (isMarkLang ? '🌐 Übersetzen' : '🌐 Translate')}
      </p>

      {ex.type === 'scramble' && (
        <>
          <div style={{ ...s.bigCard, minHeight: '80px', flexWrap: 'wrap', gap: '8px', padding: '16px', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
            {scrambleOrder.length === 0
              ? <p style={{ color: th.sub, fontSize: '0.85rem', margin: 'auto' }}>{isMarkLang ? 'Tippe auf Wörter unten' : 'Tap words below'}</p>
              : scrambleOrder.map((w) => (
                <button key={w.id} onClick={() => !revealed && removeWord(w)}
                  style={{ background: th.accent + '33', color: th.text, border: `1px solid ${th.accent}`, borderRadius: '8px', padding: '6px 12px', fontSize: '0.95rem', cursor: revealed ? 'default' : 'pointer' }}>
                  {w.word}
                </button>
              ))
            }
          </div>
          {revealed && (
            <p style={{ color: selected === 'correct' ? '#4CAF50' : '#f44336', fontWeight: 'bold', margin: '4px 0 12px 0' }}>
              {selected === 'correct' ? '✓' : `✗  ${ex.sentence}`}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
            {scrambleBank.map(w => (
              <button key={w.id} onClick={() => !revealed && addWord(w)}
                style={{ background: th.card, color: th.text, border: `1px solid ${th.border}`, borderRadius: '8px', padding: '6px 12px', fontSize: '0.95rem', cursor: revealed ? 'default' : 'pointer' }}>
                {w.word}
              </button>
            ))}
          </div>
          {!revealed
            ? <button style={{ ...s.button, opacity: scrambleOrder.length === 0 ? 0.4 : 1 }} onClick={checkScramble} disabled={scrambleOrder.length === 0}>
                {isMarkLang ? 'Prüfen' : 'Check'}
              </button>
            : <button style={s.button} onClick={() => handleNext(selected === 'correct')}>
                {index + 1 < exercises.length ? (isMarkLang ? 'Weiter →' : 'Next →') : (isMarkLang ? 'Fertig' : 'Finish')}
              </button>
          }
        </>
      )}

      {(ex.type === 'fill_blank' || ex.type === 'translate') && (
        <>
          <div style={{ ...s.bigCard, minHeight: '80px' }}>
            <p style={{ ...s.cardFront, marginBottom: 0 }}>{ex.type === 'fill_blank' ? ex.blank_sentence : ex.prompt_sentence}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {ex.options.map((opt, i) => {
              let bg = th.card; let border = `1px solid ${th.border}`
              if (revealed && i === ex.correct_index) { bg = '#4CAF5022'; border = '2px solid #4CAF50' }
              else if (revealed && selected === i) { bg = '#f4433622'; border = '2px solid #f44336' }
              else if (selected === i) { bg = th.accent + '22'; border = `2px solid ${th.accent}` }
              return (
                <button key={i} onClick={() => { if (!revealed) { setSelected(i); setRevealed(true); speak(ex.options[ex.correct_index], ttsLangCode) } }}
                  style={{ background: bg, color: th.text, border, borderRadius: '10px', padding: '13px 16px', fontSize: '0.95rem', cursor: revealed ? 'default' : 'pointer', textAlign: 'left' }}>
                  {opt}
                </button>
              )
            })}
          </div>
          {revealed && <button style={s.button} onClick={() => handleNext(selected === ex.correct_index)}>
            {index + 1 < exercises.length ? (isMarkLang ? 'Weiter →' : 'Next →') : (isMarkLang ? 'Fertig' : 'Finish')}
          </button>}
        </>
      )}
    </div></div>
  )
}

function PlacementTest({ lang, theme, user, onBack, onSaveCefr }) {
  const th = THEMES[theme]; const s = makeStyles(th); const t = T[lang]
  const questions = lang === 'de' ? PLACEMENT_EN : PLACEMENT_DE
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [wrongStreak, setWrongStreak] = useState(0)
  const [scores, setScores] = useState({})
  const [done, setDone] = useState(false)
  const [finalLevel, setFinalLevel] = useState(null)
  const [stopped, setStopped] = useState(false)
  const q = questions[index]
  const calcLevel = (sc) => {
    for (let i = CEFR_LEVELS.length - 1; i >= 0; i--) {
      const lvl = CEFR_LEVELS[i]; const data = sc[lvl]
      if (data && data.correct / data.total >= 0.6) return lvl
    }
    return 'A1'
  }
  const handleSelect = (optIdx) => {
    if (revealed) return
    setSelected(optIdx); setRevealed(true)
    const isCorrect = optIdx === q.correct
    const lvl = q.level; const prev = scores[lvl] || { correct: 0, total: 0 }
    const newScores = { ...scores, [lvl]: { correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 } }
    setScores(newScores)
    const newStreak = isCorrect ? 0 : wrongStreak + 1
    setTimeout(() => {
      if (newStreak >= 3 || index + 1 >= questions.length) {
        try {
          const level = calcLevel(newScores)
          try { onSaveCefr(level) } catch(e) { console.warn('[Vocara] onSaveCefr error:', e) }
          window.location.reload()
        } catch(completionErr) {
          console.error('[Vocara] test completion crashed:', completionErr)
          window.location.reload()
        }
      } else { setWrongStreak(newStreak); setIndex(i => i + 1); setSelected(null); setRevealed(false) }
    }, 1200)
  }
  if (done) {
    const totalCorrect = Object.values(scores).reduce((a, b) => a + b.correct, 0)
    const totalQ = Object.values(scores).reduce((a, b) => a + b.total, 0)
    return (
      <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
        <button style={s.backBtn} onClick={onBack}>← {t.back}</button>
        <h2 style={{ color: th.gold, fontSize: '1.3rem', marginBottom: '8px' }}>{t.testDone}</h2>
        <div style={{ background: CEFR_COLORS[finalLevel] + '22', border: `2px solid ${CEFR_COLORS[finalLevel]}`, borderRadius: '16px', padding: '24px', marginBottom: '16px' }}>
          <p style={{ color: CEFR_COLORS[finalLevel], fontSize: '3rem', fontWeight: 'bold', margin: 0 }}>{finalLevel}</p>
          <p style={{ color: th.text, margin: '8px 0 0 0', fontSize: '1.1rem' }}>{CEFR_DESC[lang][finalLevel]}</p>
        </div>
        {stopped && <p style={{ color: th.sub, fontSize: '0.85rem', marginBottom: '12px' }}>{t.testStop3}</p>}
        <div style={s.card}>
          {CEFR_LEVELS.map(lvl => scores[lvl] ? (
            <div key={lvl} style={{ ...s.langRow, marginBottom: '8px' }}>
              <span style={{ color: CEFR_COLORS[lvl], fontWeight: 'bold', fontSize: '0.9rem' }}>{lvl}</span>
              <span style={s.langPct}>{scores[lvl].correct}/{scores[lvl].total}</span>
            </div>
          ) : null)}
          <div style={{ ...s.langRow, marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${th.border}` }}>
            <span style={s.lang}>{t.testScore}</span><span style={s.langPct}>{totalCorrect}/{totalQ}</span>
          </div>
        </div>
        <button style={s.button} onClick={onBack}>← Zurück zur Startseite</button>
      </div></div>
    )
  }
  const pct = (index / questions.length) * 100
  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <div style={s.cardHeader}>
        <div>
          <p style={s.greeting}>{t.testQuestion} {index + 1} {t.testOf} {questions.length}</p>
          <span style={{ color: CEFR_COLORS[q.level], fontSize: '0.75rem', fontWeight: 'bold' }}>{q.level}</span>
        </div>
        <button style={s.stopBtn} onClick={onBack}>{t.stop}</button>
      </div>
      <div style={s.progressBar}><div style={{ ...s.progressFill, width: `${pct}%`, background: CEFR_COLORS[q.level] }} /></div>
      <div style={{ ...s.bigCard, marginTop: '12px', minHeight: '100px' }}>
        <p style={{ ...s.cardFront, marginBottom: 0 }}>{q.question}</p>
      </div>
      {q.options.map((opt, i) => (
        <button key={i} style={s.optionBtn(selected === i, i === q.correct, revealed)} onClick={() => handleSelect(i)}>
          {String.fromCharCode(65 + i)}. {opt ?? '—'}
        </button>
      ))}
    </div></div>
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
        <h1 style={s.logoTitle}>Vocara</h1>
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
      <h1 style={{ ...s.logoTitle, marginBottom: '8px' }}>Vocara</h1>
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
      getDoc(doc(db, 'users', inviteUID)).then(snap => { if (snap.exists()) setPendingData({ uid: inviteUID, ...snap.data() }) })
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
    const partnerSnap = await getDoc(doc(db, 'users', partnerUID))
    const partnerName = partnerSnap.exists() ? partnerSnap.data().name : 'Partner'
    await updateDoc(doc(db, 'users', user.uid), { partnerUID, partnerName })
    await updateDoc(doc(db, 'users', partnerUID), { partnerUID: user.uid, partnerName: user.displayName })
    onPartnerUpdate(partnerUID); setPendingData(null); window.history.replaceState({}, '', window.location.pathname)
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
function RhythmusScreen({ lang, theme, onBack, allCards, cardProgress }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const isDE = lang === 'de'
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

  const speak = (text) => {
    if (!text || !window.speechSynthesis) return
    const utt = new SpeechSynthesisUtterance(text)
    const voices = window.speechSynthesis.getVoices()
    const goog = voices.find(v => v.name.toLowerCase().includes('google') && !v.name.includes('UK'))
    if (goog) utt.voice = goog
    utt.rate = 0.85; utt.pitch = 1
    window.speechSynthesis.speak(utt)
  }

  const startMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setMicState('unsupported'); return }
    const rec = new SR()
    rec.lang = sentence?.langB === 'de' ? 'de-DE' : sentence?.langB === 'sw' ? 'sw-KE' : 'en-US'
    rec.interimResults = false; rec.maxAlternatives = 1
    setMicState('listening'); setTranscript(''); setScore(null)
    rec.onresult = (e) => {
      const heard = e.results[0][0].transcript.toLowerCase().trim()
      setTranscript(heard)
      const target = (sentence?.back || '').toLowerCase()
      const tWords = target.split(/\s+/)
      const hWords = heard.split(/\s+/)
      const correct = tWords.filter(w => hWords.some(h => h.includes(w) || w.includes(h))).length
      setScore({ correct, total: tWords.length })
      setMicState('done')
    }
    rec.onerror = () => setMicState('idle')
    rec.start()
  }

  if (loading) return <div style={s.container}><div style={s.homeBox}><p style={{ color: th.sub, textAlign: 'center', marginTop: '40px' }}>…</p></div></div>

  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>← {isDE ? 'Zurück' : 'Back'}</button>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <p style={{ color: th.gold, fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 6px' }}>🎵 {isDE ? 'Sprachrhythmus' : 'Speech Rhythm'}</p>
        <p style={{ color: th.sub, fontSize: '0.82rem', margin: 0 }}>{isDE ? 'Höre zu — dann sprich nach' : 'Listen — then repeat'}</p>
      </div>
      {!sentence ? (
        <div style={s.card}>
          <p style={{ color: th.sub, textAlign: 'center', fontSize: '0.88rem' }}>{isDE ? 'Lerne mehr Satz-Karten, um Rhythmus-Training freizuschalten.' : 'Learn more sentence cards to unlock rhythm training.'}</p>
        </div>
      ) : (
        <>
          <div style={{ ...s.card, textAlign: 'center', position: 'relative' }}>
            <p style={{ color: th.sub, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px' }}>{isDE ? 'Spreche nach:' : 'Repeat after me:'}</p>
            <p style={{ color: th.text, fontSize: '1.15rem', fontWeight: '600', margin: '0 0 14px', lineHeight: 1.4 }}>{sentence.back}</p>
            <p style={{ color: th.sub, fontSize: '0.82rem', fontStyle: 'italic', margin: '0 0 16px' }}>{sentence.front}</p>
            <button onClick={() => speak(sentence.back)} style={{ background: 'transparent', border: `1px solid ${th.border}`, borderRadius: '12px', padding: '8px 18px', color: th.sub, fontSize: '0.82rem', cursor: 'pointer' }}>
              🔊 {isDE ? 'Anhören' : 'Listen'}
            </button>
          </div>

          <div style={{ ...s.card, textAlign: 'center' }}>
            {micState === 'idle' && (
              <button onClick={startMic} style={{ ...s.button, background: `linear-gradient(135deg, ${th.accent}40, ${th.accent}20)`, border: `1px solid ${th.accent}66`, color: th.text, width: '100%' }}>
                🎤 {isDE ? 'Jetzt sprechen' : 'Speak now'}
              </button>
            )}
            {micState === 'listening' && (
              <p style={{ color: th.gold, fontSize: '0.9rem', animation: 'vocaraPulse 0.8s infinite' }}>🎤 {isDE ? 'Zuhören…' : 'Listening…'}</p>
            )}
            {micState === 'unsupported' && (
              <p style={{ color: '#ff9800', fontSize: '0.82rem' }}>{isDE ? 'Bitte Chrome verwenden' : 'Please use Chrome'}</p>
            )}
            {micState === 'done' && score && (
              <div style={{ animation: 'vocaraFadeIn 0.3s ease both' }}>
                <p style={{ color: th.sub, fontSize: '0.78rem', marginBottom: '8px' }}>{isDE ? 'Du hast gesagt:' : 'You said:'} <em style={{ color: th.text }}>{transcript}</em></p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '12px' }}>
                  {(sentence.back || '').split(/\s+/).map((w, i) => {
                    const heard = transcript.split(/\s+/)
                    const hit = heard.some(h => h.includes(w.toLowerCase()) || w.toLowerCase().includes(h))
                    return <span key={i} style={{ color: hit ? '#4CAF50' : '#e53935', fontSize: '1rem', fontWeight: '600' }}>{w}</span>
                  })}
                </div>
                <p style={{ color: score.correct === score.total ? '#4CAF50' : th.gold, fontSize: '0.9rem', fontWeight: '700', margin: '0 0 12px' }}>
                  {score.correct}/{score.total} {isDE ? 'Wörter korrekt' : 'words correct'}
                </p>
                <button onClick={() => { setMicState('idle'); setTranscript(''); setScore(null) }} style={{ background: 'transparent', border: `1px solid ${th.border}`, borderRadius: '10px', padding: '7px 16px', color: th.sub, fontSize: '0.82rem', cursor: 'pointer' }}>
                  🔄 {isDE ? 'Nochmal' : 'Try again'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div></div>
  )
}

function CardScreen({ session, onBack, onFinish, lang, cardProgress, s, onSaveState, onSaveSessionProgress, onStop, onSaveExample, mode = 'all', startIndex = 0, startProgress = null }) {
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
  const [flipPhase, setFlipPhase] = useState(false) // true = mid-flip (card turned sideways)
  const [patternTip, setPatternTip] = useState(null) // null | 'loading' | string
  const wrongCardsRef = useRef([]) // accumulates wrong cards for pattern analysis
  const [kiExplanation, setKiExplanation] = useState(null) // null | 'loading' | string
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [kontextVariation, setKontextVariation] = useState(null) // null | 'loading' | {formal,informal,romantic}
  const [kontextOpen, setKontextOpen] = useState(false)
  const animLock = useRef(false)
  const startTime = useRef(Date.now())
  const answeredIds = useRef(new Set())
  const easyCountRef = useRef(0)
  const cardStatsRef = useRef({})

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
  // Always speak the back (toLang) text in its language
  const speakBack = (mode = ttsMode) => {
    if (mode === 1) speakSyllable(item.back, item.langB)
    else speak(item.back, item.langB)
  }
  const cycleTtsMode = () => setTtsMode(m => (m + 1) % 2)
  const handleSpeakerTap = () => { speakBack(ttsMode); cycleTtsMode() }

  const handleMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setMicState('unsupported'); return }
    setMicState('listening'); setMicResult(null)
    const rec = new SR()
    rec.lang = SPEECH_LANGS[item.langB] || 'en-GB'
    rec.interimResults = false; rec.maxAlternatives = 1
    const timeout = setTimeout(() => { try { rec.stop() } catch(e) {} }, 4000)
    rec.onresult = (e) => {
      clearTimeout(timeout)
      const transcript = e.results[0][0].transcript.trim()
      const expWords = item.back.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean)
      const gotWords = transcript.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean)
      const words = expWords.map((w, i) => ({ word: item.back.split(/\s+/)[i] || w, correct: gotWords.includes(w) }))
      const score = words.filter(w => w.correct).length
      setMicResult({ score, total: expWords.length, words })
      setMicState('done')
    }
    rec.onerror = () => { clearTimeout(timeout); setMicState('idle') }
    rec.onend = () => { clearTimeout(timeout); setMicState(s => s === 'listening' ? 'idle' : s) }
    rec.start()
  }

  useEffect(() => {
    if (!revealed) { setMicState('idle'); setMicResult(null); return }
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

  // Load note for current card
  useEffect(() => {
    setNoteText(cardProgress[item.id]?._note || '')
    setNoteOpen(false)
    setKiExplanation(null)
    setKontextVariation(null); setKontextOpen(false)
    setMicState('idle'); setMicResult(null)
  }, [index])

  // ── FEHLER-MUSTER ANALYSE (#33) ──────────────────────────────
  useEffect(() => {
    if (wrong < 10 || patternTip !== null) return
    setPatternTip('loading')
    const cards = wrongCardsRef.current.slice(0, 10)
    const cardList = cards.map(c => `"${c.front}" → "${c.back}"`).join('; ')
    const tipLang = lang === 'de' ? 'German' : 'English'
    fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 100,
        messages: [{ role: 'user', content: `A language learner answered these ${cards.length} cards incorrectly: ${cardList}. In exactly 1 sentence in ${tipLang}, name one specific grammar pattern or memory tip connecting these mistakes. Be concrete and brief, not generic.` }]
      })
    }).then(r => r.json()).then(d => {
      const tip = d.content?.[0]?.text?.trim()
      setPatternTip(tip || null)
    }).catch(() => setPatternTip(null))
  }, [wrong])

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

  const triggerAnim = (anim, delay, cb) => {
    if (animLock.current) return
    animLock.current = true
    setCardAnim(anim)
    setTimeout(() => { setCardAnim(null); animLock.current = false; cb() }, delay)
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
    const prev = newProgress[cardId] || { interval: 0, consecutiveFast: 0, wrongSessions: 0 }
    const easyInterval = Math.max(7, (prev.interval || 0) + 3)
    const newCorrectCount = (prev.correctCount || 0) + 1
    const isGolden = easyInterval >= 4 && newCorrectCount >= 5
    const updatedProgress = { ...prev, interval: easyInterval, consecutiveFast: 0, wrongSessions: Math.max(0, (prev.wrongSessions || 0) - 1), nextReview: getNextReview(easyInterval), correctCount: newCorrectCount, isGolden }
    const finalProgress = { ...newProgress, [cardId]: updatedProgress }
    setNewProgress(finalProgress)
    const newCorrect = correct + 1; setCorrect(newCorrect)
    if (index + 1 >= queue.length) { onFinish(finalProgress, newCorrect, wrong, easyCountRef.current, cardStatsRef.current); return }
    setIndex(i => i + 1); setRevealed(false)
    onSaveState?.(queue, index + 1, finalProgress)
  }
  const handleAnswer = (isCorrect) => {
    const elapsed = (Date.now() - startTime.current) / 1000
    const speed = getSpeed(elapsed)
    const cardId = item.id
    answeredIds.current.add(cardId)
    const st = cardStatsRef.current[cardId] || { wrongs: 0, fastestMs: Infinity }
    if (!isCorrect) {
      cardStatsRef.current[cardId] = { ...st, wrongs: st.wrongs + 1 }
      const prev = newProgress[cardId] || { interval: 0, consecutiveFast: 0, wrongSessions: 0 }
      const updatedProgress = { ...prev, interval: 0, consecutiveFast: 0, wrongSessions: 3, nextReview: todayStr() }
      const finalNewProgress = { ...newProgress, [cardId]: updatedProgress }
      const newQueue = [...queue]; newQueue.splice(index, 1); newQueue.push({ ...item })
      wrongCardsRef.current.push({ front: item.front, back: item.back })
      setQueue(newQueue); setNewProgress(finalNewProgress); setWrong(w => w + 1); setRevealed(false)
      onSaveState?.(newQueue, index, finalNewProgress)
    } else {
      cardStatsRef.current[cardId] = { ...st, fastestMs: Math.min(st.fastestMs, elapsed * 1000) }
      const prev = newProgress[cardId] || { interval: 0, consecutiveFast: 0, wrongSessions: 0 }
      const newCF = speed === 'very_fast' ? (prev.consecutiveFast || 0) + 1 : 0
      const interval = getNewInterval(speed, { consecutiveFast: newCF })
      const newCorrectCount = (prev.correctCount || 0) + 1
      const isGolden = interval >= 4 && newCorrectCount >= 5
      const updatedProgress = { ...prev, interval, consecutiveFast: newCF, wrongSessions: Math.max(0, (prev.wrongSessions || 0) - 1), nextReview: getNextReview(interval), correctCount: newCorrectCount, isGolden }
      const finalProgress = { ...newProgress, [cardId]: updatedProgress }
      setNewProgress(finalProgress)
      const newCorrect = correct + 1; setCorrect(newCorrect)
      if (index + 1 >= queue.length) { onFinish(finalProgress, newCorrect, wrong, easyCountRef.current, cardStatsRef.current); return }
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
      // Fetch KI explanation
      setKiExplanation('loading')
      fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 100,
          messages: [{ role: 'user', content: `The user got this card wrong. Front: "${item.front}" Back: "${item.back}". In 1-2 short sentences in ${fromLang === 'de' ? 'German' : 'English'}, explain the grammar rule or memory trick that helps remember this. Be brief and encouraging.` }]
        })
      }).then(r => r.json()).then(d => setKiExplanation(d.content?.[0]?.text?.trim() || null)).catch(() => setKiExplanation(null))
    }
    const anim = isCorrect ? 'flyRight' : 'shake'
    const delay = isCorrect ? 350 : 480
    triggerAnim(anim, delay, () => handleAnswer(isCorrect))
  }
  const handleEasyAnimated = () => {
    haptic([30, 40, 30, 40, 30])
    triggerAnim('flyUp', 320, () => handleEasy())
  }

  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
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
      {/* ── FLIP CARD ── */}
      <div style={{ width: '100%', marginBottom: '16px', perspective: '900px',
        animation: cardAnim ? `vocara${cardAnim.charAt(0).toUpperCase() + cardAnim.slice(1)} ${cardAnim === 'shake' ? '0.48s' : '0.35s'} ease forwards` : undefined,
      }}>
        <div className="vocara-big-card" style={{
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
          {/* Note icon — bottom-right of card */}
          <button onClick={() => setNoteOpen(o => !o)} style={{ position: 'absolute', bottom: '8px', right: '10px', background: noteText ? 'rgba(255,255,255,0.10)' : 'transparent', border: noteText ? '1px solid rgba(255,255,255,0.18)' : 'none', borderRadius: '8px', padding: '3px 7px', color: noteText ? '#e0c060' : '#8A8A9A', fontSize: '0.75rem', cursor: 'pointer', opacity: 0.85, lineHeight: 1, zIndex: 2 }}>
            📝
          </button>
          <p style={s.dirLabel}>{LANG_FLAGS[fromLang]} → {LANG_FLAGS[toLang]}</p>
          <p style={s.cardFront}>{question}</p>
          {!revealed && (
            <button style={s.revealBtn} onClick={handleReveal}>{t.showSolution}</button>
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
                  <span style={{ fontSize: '0.58rem', color: micState === 'listening' ? '#e53935' : '#8A8A9A', fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '0.3px' }}>{micState === 'listening' ? '…' : micState === 'done' ? `${micResult?.score}/${micResult?.total}` : 'Mic'}</span>
                </div>
              </div>
              {micState === 'unsupported' && (
                <p style={{ color: '#ff9800', fontSize: '0.75rem', fontStyle: 'italic', marginTop: '6px', textAlign: 'center' }}>Dein Browser unterstützt keine Spracherkennung — bitte Chrome verwenden</p>
              )}
              {micResult && (
                <div style={{ marginTop: '8px', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.78rem', color: '#8A8A9A', marginBottom: '4px' }}>Aussprache: {micResult.score}/{micResult.total} Wörter korrekt</p>
                  <p style={{ fontSize: '1rem', letterSpacing: '2px' }}>
                    {micResult.words.map((w, i) => (
                      <span key={i} style={{ color: w.correct ? '#4CAF50' : '#e53935', marginRight: '4px' }}>{w.word}</span>
                    ))}
                  </p>
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
        <div style={{ width: '100%', marginBottom: '8px', background: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.22)', borderRadius: '12px', padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            {kiExplanation === 'loading'
              ? <p style={{ color: '#8A8A9A', fontSize: '0.78rem', margin: 0 }}>💡 {lang === 'de' ? 'KI erklärt…' : 'AI explaining…'}</p>
              : <p style={{ color: '#81c784', fontSize: '0.78rem', margin: 0, lineHeight: 1.5 }}>💡 {kiExplanation}</p>
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
        <div style={{ ...s.answerRow, alignItems: 'flex-end' }}>
          <button style={s.wrongBtn} onClick={() => handleAnswerAnimated(false)}>✗ {t.wrong}</button>
          <button style={s.easyBtn} onClick={handleEasyAnimated}>{t.easy}</button>
          <button style={s.rightBtn} onClick={() => handleAnswerAnimated(true)}>✓ {t.correct}</button>
        </div>
      )}
    </div></div>
  )
}

function ResultScreen({ correct, wrong, easy, weakestCard, strongestCard, masteryUnlocked, t, lang, onBack, onReplay, s, th }) {
  const isMarkLang = lang === 'de'
  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <h1 style={s.title}>{t.done} 🎉</h1>
      {masteryUnlocked && <div style={{ ...s.card, borderLeft: '3px solid #4CAF50' }}><p style={{ color: '#4CAF50', margin: 0, fontSize: '0.85rem' }}>{t.masteryMsg}</p></div>}
      <div style={s.card}>
        <div style={s.langRow}><span style={s.lang}>{t.correct}</span><span style={{ ...s.langPct, color: '#4CAF50' }}>{correct}</span></div>
        <div style={s.langRow}><span style={s.lang}>{t.wrong}</span><span style={{ ...s.langPct, color: '#f44336' }}>{wrong}</span></div>
        {easy > 0 && <div style={s.langRow}><span style={s.lang}>Easy ⚡</span><span style={{ ...s.langPct, color: th?.gold || '#FFD700' }}>{easy}</span></div>}
      </div>
      {(weakestCard || strongestCard) && (
        <div style={s.card}>
          {weakestCard && (
            <div style={{ marginBottom: strongestCard ? '14px' : 0 }}>
              <p style={{ ...s.cardLabel, marginBottom: '5px', color: '#e06c75' }}>⚠️ {isMarkLang ? 'Schwächste Karte' : 'Weakest card'}</p>
              <p style={{ color: th?.text || '#fff', fontSize: '0.9rem', margin: 0, fontWeight: '500' }}>{weakestCard.front}</p>
              <p style={{ color: th?.sub || '#888', fontSize: '0.8rem', margin: '2px 0 0' }}>{weakestCard.back}</p>
            </div>
          )}
          {strongestCard && (
            <div>
              <p style={{ ...s.cardLabel, marginBottom: '5px', color: '#4CAF50' }}>⚡ {isMarkLang ? 'Stärkste Karte' : 'Strongest card'}</p>
              <p style={{ color: th?.text || '#fff', fontSize: '0.9rem', margin: 0, fontWeight: '500' }}>{strongestCard.front}</p>
              <p style={{ color: th?.sub || '#888', fontSize: '0.8rem', margin: '2px 0 0' }}>{strongestCard.back}</p>
            </div>
          )}
        </div>
      )}
      {onReplay && (
        <button style={{ ...s.button, marginBottom: '8px' }} onClick={onReplay}>
          🔁 {isMarkLang ? 'Nochmal' : 'Again'}
        </button>
      )}
      <button style={{ background: 'transparent', color: th?.sub || '#888', border: `1px solid ${th?.border || '#333'}`, padding: '12px 28px', borderRadius: '50px', fontSize: '0.95rem', cursor: 'pointer', fontWeight: '600', width: '100%' }} onClick={onBack}>
        {isMarkLang ? 'Weiter' : 'Continue'}
      </button>
    </div></div>
  )
}

function SettingsScreen({ t, s, theme, onThemeChange, onBack, user, myData, setMyData, allCards, lang, onPartner, onLightModeChange, onCardSizeChange }) {
  const th = THEMES[theme]
  const pausedLanguages = myData?.pausedLanguages || []
  const uniqueTargetLangs = [...new Set((allCards || []).map(c => c.targetLang).filter(Boolean))]
  const isDE = lang === 'de'
  const [premiumModal, setPremiumModal] = useState(false)

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

      {/* ── TAGESZIEL ── */}
      <div style={s.card}>
        <p style={{ ...s.cardLabel, marginBottom: '12px' }}>{isDE ? 'Tägliches Lernziel' : 'Daily learning goal'}</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[5, 10, 15, 20].map(n => (
            <button key={n}
              onClick={async () => { await updateDoc(doc(db, 'users', user.uid), { dailyGoal: n }); setMyData(d => ({ ...d, dailyGoal: n })) }}
              style={{ flex: 1, padding: '10px 0', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem', background: (myData?.dailyGoal || 10) === n ? th.accent : 'transparent', color: (myData?.dailyGoal || 10) === n ? (th.btnTextColor || '#111') : th.sub, border: `1px solid ${(myData?.dailyGoal || 10) === n ? th.accent : th.border}` }}
            >{n}</button>
          ))}
        </div>
        <p style={{ color: th.sub, fontSize: '0.72rem', marginTop: '7px', marginBottom: 0 }}>{isDE ? 'Karten pro Tag' : 'Cards per day'}</p>
      </div>

      {/* ── SPRACHE PAUSIEREN ── */}
      {uniqueTargetLangs.length > 0 && (
        <div style={s.card}>
          <p style={{ ...s.cardLabel, marginBottom: '14px' }}>{isDE ? 'Sprachen' : 'Languages'}</p>
          {uniqueTargetLangs.map(langCode => {
            const info = AVAILABLE_LANGS.find(l => l.code === langCode)
            const paused = pausedLanguages.includes(langCode)
            return (
              <div key={langCode} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ color: th.text, fontSize: '1rem' }}>{info?.flag} {info?.label || langCode}</span>
                <button onClick={() => togglePause(langCode)}
                  style={{ background: paused ? 'transparent' : th.accent, color: paused ? th.sub : (th.btnTextColor || '#111'), border: `1px solid ${paused ? th.border : th.accent}`, borderRadius: '20px', padding: '5px 14px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}>
                  {paused ? (isDE ? 'Pausiert' : 'Paused') : (isDE ? 'Aktiv' : 'Active')}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── DARK/LIGHT MODE ── */}
      {(() => {
        const { lightMode } = React.useContext(AppPrefsContext)
        return (
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ ...s.cardLabel, marginBottom: '2px' }}>{isDE ? '☀️ Dark / Light Mode' : '☀️ Dark / Light Mode'}</p>
                <p style={{ color: th.sub, fontSize: '0.75rem', margin: 0 }}>{lightMode ? (isDE ? 'Hell' : 'Light') : (isDE ? 'Dunkel' : 'Dark')}</p>
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
            <p style={{ ...s.cardLabel, marginBottom: '12px' }}>{isDE ? '📐 Kartengröße' : '📐 Card size'}</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {sizes.map(sz => (
                <button key={sz.key} onClick={() => onCardSizeChange && onCardSizeChange(sz.key)}
                  style={{ flex: 1, padding: '9px 0', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem', background: cardSize === sz.key ? th.accent : 'transparent', color: cardSize === sz.key ? (th.btnTextColor || '#111') : th.sub, border: `1px solid ${cardSize === sz.key ? th.accent : th.border}`, transition: 'all 0.2s' }}>
                  {isDE ? sz.labelDE : sz.labelEN}
                </button>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── STREAK FREEZE ── */}
      <div style={s.card}>
        <p style={{ ...s.cardLabel, marginBottom: '12px' }}>🧊 {isDE ? 'Streak-Schutz' : 'Streak Protection'}</p>
        {(() => {
          const isAvail = freezeAvailable || (freeze.lastReset !== currentMonth)
          return (
            <>
              <p style={{ color: th.text, fontSize: '0.9rem', marginBottom: '8px' }}>
                {isDE ? 'Verfügbar diesen Monat:' : 'Available this month:'} <strong style={{ color: isAvail ? '#4CAF50' : th.sub }}>{isAvail ? '1x ✓' : (isDE ? 'verwendet' : 'used')}</strong>
              </p>
              {isAvail && (
                <button onClick={() => { if (window.confirm(isDE ? 'Streak Freeze jetzt verwenden? (1x pro Monat)' : 'Use Streak Freeze now? (1x/month)')) handleStreakFreeze() }}
                  style={{ ...s.logoutBtn, marginTop: 0, color: '#81c784', border: '1px solid rgba(76,175,80,0.35)' }}>
                  🧊 {isDE ? 'Freeze aktivieren' : 'Activate Freeze'}
                </button>
              )}
              {freeze.usedAt && !isAvail && <p style={{ color: th.sub, fontSize: '0.75rem', marginTop: '4px' }}>{isDE ? `Verwendet am ${freeze.usedAt}` : `Used on ${freeze.usedAt}`}</p>}
            </>
          )
        })()}
      </div>

      {/* ── PARTNER VERBINDEN ── */}
      <button style={{ ...s.card, cursor: 'pointer', width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={onPartner}>
        <span style={{ color: th.text, fontSize: '0.9rem' }}>🤝 {isDE ? 'Partner verbinden' : 'Connect partner'}</span>
        <span style={{ color: th.sub }}>→</span>
      </button>

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

      {/* ── ABMELDEN ── */}
      <button style={{ ...s.logoutBtn, marginTop: '8px', color: '#e06c75', border: '1px solid rgba(224,108,117,0.35)' }}
        onClick={() => { if (window.confirm(isDE ? 'Wirklich abmelden?' : 'Sign out?')) signOut(auth) }}>
        {isDE ? 'Abmelden' : 'Sign out'}
      </button>

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

function StatsScreen({ user, myData, partnerData, allCards, lang, theme, onBack, cardProgress }) {
  const th = THEMES[theme]; const s = makeStyles(th); const t = T[lang]
  const isMarkLang = lang === 'de'
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
  const partnerStreak = calcStreak(partnerHistory)
  const partnerTodayCorrect = partnerHistory.filter(h => h.date === today).reduce((a, b) => a + (b.correct || 0), 0)
  const partnerTodaySessions = partnerHistory.filter(h => h.date === today).length
  const partnerProgress = partnerData?.cardProgress || {}
  const partnerMastered = Object.values(partnerProgress).filter(p => (p?.interval || 0) >= 7).length
  const partnerActive = Object.keys(partnerProgress).length

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
  const AREA_LABEL_MAP = { vocabulary: isMarkLang ? 'Worte' : 'Words', sentence: isMarkLang ? 'Sätze' : 'Sentences', street: isMarkLang ? 'Straße' : 'Street', home: isMarkLang ? 'Zuhause' : 'Home' }
  const getFavArea = (progress) => {
    const counts = {}
    Object.keys(progress).forEach(id => {
      const card = allCards.find(c => c.id === id)
      if (card?.category) counts[card.category] = (counts[card.category] || 0) + 1
    })
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    return top ? (AREA_LABEL_MAP[top[0]] || top[0]) : '—'
  }
  const myFavArea = getFavArea(cardProgress)
  const partnerFavArea = getFavArea(partnerProgress)

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
          ← {isMarkLang ? 'Zurück' : 'Back'}
        </button>
        <span style={{ color: th.text, fontWeight: '600', fontSize: '1rem', marginLeft: '8px' }}>
          {isMarkLang ? 'Statistiken' : 'Statistics'}
        </span>
      </div>
      <div style={{ ...s.homeBox, paddingTop: '68px' }}>

      {/* ── TOP STATS GRID ── */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
        {statBox(isMarkLang ? 'Heute gelernt' : 'Learned today', todayCorrect, isMarkLang ? `${todaySessions} Session${todaySessions !== 1 ? 's' : ''}` : `${todaySessions} session${todaySessions !== 1 ? 's' : ''}`)}
        {statBox(isMarkLang ? 'Streak' : 'Streak', myStreak > 0 ? `🔥 ${myStreak}` : '—', isMarkLang ? 'Tage' : 'days')}
      </div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {statBox(isMarkLang ? 'Karten gesamt' : 'Total cards', totalCards, `${myMastered} ✓`)}
        {statBox(isMarkLang ? 'Morgen fällig' : 'Due tomorrow', dueTomorrow, '')}
      </div>

      {/* ── 7-DAY CHART ── */}
      <div style={{ ...s.card, marginBottom: '16px' }}>
        <StreakWidget history={sessionHistory} th={th} t={t} />
      </div>

      {/* ── PARTNER COMPARISON ── */}
      {hasPartner && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: th.accent, fontWeight: '700', fontSize: '0.9rem' }}>{myName}</span>
            <span style={{ color: th.sub, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', alignSelf: 'center' }}>vs</span>
            <span style={{ color: th.gold, fontWeight: '700', fontSize: '0.9rem' }}>{partnerName}</span>
          </div>
          {compRow(isMarkLang ? 'Heute gelernt' : 'Today', todayCorrect, partnerTodayCorrect)}
          {compRow(isMarkLang ? 'Sessions heute' : 'Sessions today', todaySessions, partnerTodaySessions)}
          {compRow(isMarkLang ? 'Streak 🔥' : 'Streak 🔥', myStreak, partnerStreak)}
          {compRow(isMarkLang ? 'Gemeistert ✓' : 'Mastered ✓', myMastered, partnerMastered)}
          {compRow(isMarkLang ? 'Aktive Karten' : 'Active cards', Object.keys(cardProgress).length, partnerActive)}
          {compRow(isMarkLang ? 'Gesamt gelernt' : 'Total learned', myTotalLearned, partnerTotalLearned)}
          {compRow(isMarkLang ? 'Längster Streak 🏆' : 'Best streak 🏆', myLongestStreak, partnerLongestStreak)}
          {compRow(isMarkLang ? 'Lerntage gesamt' : 'Total learning days', myLearningDays, partnerLearningDays)}
          {compRow(isMarkLang ? 'Lieblingsbereich' : 'Favourite area', myFavArea, partnerFavArea)}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0 0' }}>
            <span style={{ color: th.text, fontWeight: '600', fontSize: '0.85rem', minWidth: '60px', textAlign: 'center' }}>{fmtMin(myWeekLearnSec)}</span>
            <span style={{ color: th.sub, fontSize: '0.75rem', flex: 1, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{isMarkLang ? 'Lernzeit Woche' : 'Study time week'}</span>
            <span style={{ color: th.text, fontWeight: '600', fontSize: '0.85rem', minWidth: '60px', textAlign: 'center' }}>{fmtMin(partnerWeekLearnSec)}</span>
          </div>
        </div>
      )}
    </div></div>
  )
}

function MenuScreen({ user, myData, setMyData, partnerData, allCards, lang, onSaveProgress, theme, onThemeChange, onLightModeChange, onCardSizeChange, onPartnerUpdate, onSaveCefr, onBack }) {
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
  const [satzLoading, setSatzLoading] = useState(false)
  const [weekGoalCelebration, setWeekGoalCelebration] = useState(false)
  const [monthlyUnlockNotification, setMonthlyUnlockNotification] = useState(false)
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
  const [karteMenu, setKarteMenu] = useState(false)
  const [dotTooltip, setDotTooltip] = useState(null) // area key
  const [pendingGift, setPendingGift] = useState(null) // gift object
  const [coachMsg, setCoachMsg] = useState(null)
  const [basicsLoading, setBasicsLoading] = useState(false)
  const VALID_SCREENS = new Set(['menu','cards','result','settings','partner','test','impressum','stats','ki','satz','diary','meinekarten','geschenkkarte','karteerstellen'])
  if (!VALID_SCREENS.has(screen)) { setScreen('menu'); return null }

  // ── COACHING BANNER ──────────────────────────────────────────
  useEffect(() => {
    if (coachMsg !== null) return
    const sessionHistory = myData?.sessionHistory || []
    const streak = calcStreak(sessionHistory)
    const dueCount = Object.values(myData?.cardProgress || {}).filter(p => p.nextReview <= todayStr()).length
    const weeklyDone = weeklyGoals?.completed?.length || 0
    const weeklyTotal = WEEK_AREAS.length
    const partnerName = myData?.partnerName || 'Partner'
    const partnerTodayActive = partnerData?.sessionHistory?.some(h => h.date === todayStr())
    const partnerCtx = partnerTodayActive ? `${partnerName} lernt gerade auch.` : ''
    fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 40,
        messages: [{ role: 'user', content: `You are Vocara's coaching voice. Write ONE short motivating message (max 15 words) in German. Style: poetic, Bridgelab — vary metaphors: voices, harbor, sun, nearness, growth. Use "Brücke" at most once. Stats: ${streak}-day streak, ${dueCount} cards due, ${weeklyDone}/${weeklyTotal} weekly areas done. ${partnerCtx} Reference the actual numbers naturally. Never generic. Return ONLY the message, no quotes or markdown.` }]
      })
    }).then(r => r.json()).then(d => {
      const msg = d.content?.[0]?.text?.trim()
      if (msg) setCoachMsg(msg)
    }).catch(() => setCoachMsg(''))
  }, [])

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
        // Try partner's card first
        if (myData?.partnerUID) {
          try {
            const pSnap = await getDoc(doc(db, 'users', myData.partnerUID))
            if (pSnap.exists() && pSnap.data()?.dailyCard?.date === todayD) {
              const pc = pSnap.data().dailyCard
              setDailyCard(pc)
              await updateDoc(doc(db, 'users', user.uid), { dailyCard: pc }).catch(() => {})
              setMyData(d => ({ ...d, dailyCard: pc }))
              return
            }
          } catch (e) {}
        }
        const relType = myData?.relationshipType || 'couple'
        const homeCity = myData?.homeCity || (isMarkLang ? 'Hamburg' : 'Nairobi')
        const partnerCity = myData?.partnerCity || (isMarkLang ? 'Nairobi' : 'Hamburg')
        const toneMap = {
          couple:     `romantic and warm, for a couple connecting ${homeCity} and ${partnerCity}`,
          friends:    `fun, casual and friendly`,
          family:     `warm, family-oriented and caring`,
          colleagues: `professional, motivating and workplace-relevant`,
        }
        const tone = toneMap[relType] || toneMap.couple
        const langPair = isMarkLang ? 'German/English' : 'English/German'
        const res = await fetch('/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001', max_tokens: 150,
            messages: [{ role: 'user', content: `Create ONE short phrase card for language learning (${langPair}). Tone: ${tone}. Return ONLY JSON (no markdown): {"front":"<phrase in source lang>","back":"<translation>","context":"<1 short line: when you'd say this>"}` }]
          })
        })
        const data = await res.json()
        const raw = data.content?.[0]?.text?.trim() || '{}'
        const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
        if (parsed.front && parsed.back) {
          const card = { front: parsed.front, back: parsed.back, context: parsed.context || '', date: todayD, relType }
          setDailyCard(card)
          await updateDoc(doc(db, 'users', user.uid), { dailyCard: card }).catch(() => {})
          setMyData(d => ({ ...d, dailyCard: card }))
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
    const masteredCards = allCards.filter(c =>
      !/_r(_\d+)?$/.test(c.id) && (cardProgress[c.id]?.interval || 0) >= 7
    )
    if (masteredCards.length === 0) return
    const picked = masteredCards[Math.floor(Math.random() * masteredCards.length)]
    const task = { word: picked.back, front: picked.front, date: todayD, done: false }
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
  const t = T[lang]; const th = resolveTheme(theme, lightMode); const s = makeStyles(th)
  const firstName = user.displayName?.split(' ')[0] || user.displayName
  const cardProgress = myData?.cardProgress || {}
  const isMarkLang = lang === 'de'
  const cefr = myData?.cefr
  const sessionHistory = myData?.sessionHistory || []
  const partnerName = myData?.partnerName || partnerData?.name?.split(' ')[0] || 'Partner'
  const today = todayStr()
  const yd = new Date(); yd.setDate(yd.getDate() - 1)
  const yesterday = `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, '0')}-${String(yd.getDate()).padStart(2, '0')}`
  const pausedLanguages = myData?.pausedLanguages || []
  const uniqueTargetLangs = [...new Set(allCards.map(c => c.targetLang).filter(Boolean))]
  const activeCards = pausedLanguages.length > 0
    ? allCards.filter(c => !pausedLanguages.includes(c.targetLang))
    : allCards

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
    allCards.forEach(card => {
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
      ...allCards.map(c => c.front),
      ...(freshData.aiCards || []).map(c => c.front),
    ]
    const exclusionList = [...new Set(allFronts.map(f => (f || '').toLowerCase().trim()))]
      .filter(Boolean).slice(0, 120).join(', ')

    const langA = isMarkLang ? 'en' : 'de'
    const langB = isMarkLang ? 'de' : 'en'

    const prompt = isMarkLang
      ? `Generate 10 useful single English words for a German speaker learning English.
NOT phrases, NOT sentences — only single words or simple infinitives like 'to run'.
Avoid these already known words: ${exclusionList}
Return ONLY JSON: [{"front": "English word", "back": "Deutsche Übersetzung", "category": "vocabulary"}]`
      : `Generate 10 useful single German words for an English speaker learning German.
NOT phrases, NOT sentences — only single words or simple infinitives like 'to run'.
Avoid these already known words: ${exclusionList}
Return ONLY JSON: [{"front": "German word", "back": "English translation", "category": "vocabulary"}]`

    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, messages: [{ role: 'user', content: prompt }] })
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
    if (cards.length === 0) {
      setEmptyCategoryMsg(isMarkLang ? 'Hier wartet noch nichts — aber das ändert sich.' : 'Nothing here yet — but that changes now.')
      setTimeout(() => setEmptyCategoryMsg(null), 3500)
      return
    }
    const sp = myData?.sessionProgress
    if (sp?.mode === category && sp.cardIds?.length > 0) {
      setResumeDialog({ category, cards })
      return
    }
    let sess = buildSession(cards, cardProgress)
    console.log('[Vocara] buildSession result:', sess.length)
    // Fallback: if nothing is due (all reviewed, none overdue), practice all category cards
    if (sess.length === 0) {
      const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)
      sess = shuffle(cards).slice(0, SESSION_SIZE)
      console.log('[Vocara] fallback session (all cards):', sess.length)
    }
    if (sess.length === 0) return
    setCurrentSessionMode(category)
    // Show Wort des Tages banner for 2.5s before starting session
    if (wordOfDay && category !== 'all') {
      setWordOfDayBanner(wordOfDay)
      setTimeout(() => {
        setWordOfDayBanner(null)
        setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
        if (['vocabulary', 'street', 'home', 'basics'].includes(category)) markAreaDone(category)
      }, 2500)
    } else {
      setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
      if (['vocabulary', 'street', 'home'].includes(category)) markAreaDone(category)
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
    const toLangName = isMarkLang ? 'English' : 'German'
    const fromLangName = isMarkLang ? 'German' : 'English'
    const prompt = `Generate exactly 12 basic vocabulary flashcards covering: colors (rot/red, blau/blue, grün/green, gelb/yellow), numbers (1-5), shapes (Kreis/circle, Quadrat/square), and basic greetings (Hallo, Danke, Bitte).
Front language: ${fromLangName}. Back language: ${toLangName}. Category: basics.
Return ONLY valid JSON array: [{"front":"...","back":"...","category":"basics","context":"..."}]`
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }) })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      const ts = Date.now()
      const newCards = parsed.map((c, i) => ({ ...c, id: `basics_${ts}_${i}`, langA: isMarkLang ? 'de' : 'en', langB: isMarkLang ? 'en' : 'de', source: 'ai-basics', createdAt: ts }))
      const updatedAiCards = [...(myData?.aiCards || []), ...newCards]
      await updateDoc(doc(db, 'users', user.uid), { aiCards: updatedAiCards })
      setMyData(d => ({ ...d, aiCards: updatedAiCards }))
      const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)
      const sess = shuffle(newCards).slice(0, SESSION_SIZE)
      setCurrentSessionMode('basics'); setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
      markAreaDone('basics')
    } catch(e) { console.warn('Failed to generate basics:', e) }
    setBasicsLoading(false)
  }

  const startSatzSession = async () => {
    const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili' }
    // Only cards with mastery >= 2 (answered correctly at least twice = interval >= 2)
    const knownVocabCards = activeCards.filter(c =>
      c.category === 'vocabulary' &&
      !/_r(_\d+)?$/.test(c.id) &&
      (cardProgress[c.id]?.interval || 0) >= 2
    )
    if (knownVocabCards.length < 5) {
      setEmptyCategoryMsg(isMarkLang
        ? 'Übe zuerst mehr Wörter in Meine Worte — du brauchst mindestens 5 gefestigte Wörter!'
        : 'Practice more words in My Words first — you need at least 5 solid words!')
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
        body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
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
      setSession(sessionCards); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
      markAreaDone('sentence')
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
          updateDoc(doc(db, 'users', user.uid), { monthlyGoal: newMonthly, unlockedGimmicks: newGimmicks, weeklyGoals: updated }).catch(() => {})
          setMyData(d => ({ ...d, monthlyGoal: newMonthly, unlockedGimmicks: newGimmicks, weeklyGoals: updated }))
          setMonthlyUnlockNotification(true)
          setTimeout(() => setMonthlyUnlockNotification(false), 5000)
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
    const knownFrontsSet = new Set(allCards.map(c => c.front.toLowerCase().trim()))

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
          body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
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

  const handleFinish = async (finalProgress, correct, wrong, easy, cardStats) => {
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
    const updatedHistory = await saveSessionHistory(user.uid, correct, correct + wrong, sessionHistory)
    setMyData(d => ({ ...d, sessionHistory: updatedHistory }))
    await clearSessionState(user.uid)
    const statsEntries = Object.entries(cardStats || {})
    const weakestEntry = statsEntries.filter(([, v]) => v.wrongs > 0).sort((a, b) => b[1].wrongs - a[1].wrongs)[0]
    const strongestEntry = statsEntries.filter(([, v]) => v.wrongs === 0 && v.fastestMs < Infinity).sort((a, b) => a[1].fastestMs - b[1].fastestMs)[0]
    const weakestCard = weakestEntry ? session?.find(c => c.id === weakestEntry[0]) : null
    const strongestCard = strongestEntry ? session?.find(c => c.id === strongestEntry[0]) : null
    setResult({ correct, wrong, easy: easy || 0, weakestCard, strongestCard, originalSession: session })
    // #31 After sentence session, offer rhythm training before result
    if (currentSessionMode === 'sentence') {
      setScreen('rhythmus')
    } else {
      setScreen('result')
    }
  }

  if (screen === 'cards' && session) return <>{homeFloat}<CardScreen session={session} onBack={() => setScreen('menu')} onFinish={handleFinish} lang={lang} cardProgress={cardProgress} s={s} onSaveState={handleSaveState} onSaveSessionProgress={saveSessionProgress} onStop={handleSessionStop} onSaveExample={handleSaveExample} mode={currentSessionMode} startIndex={resumeStartIndex} startProgress={resumeStartProgress} /></>
  if (screen === 'rhythmus') return <>{homeFloat}<RhythmusScreen lang={lang} theme={theme} onBack={() => { setScreen('result') }} allCards={allCards} cardProgress={cardProgress} /></>
  if (screen === 'result') return <>{homeFloat}<ResultScreen correct={result.correct} wrong={result.wrong} easy={result.easy} weakestCard={result.weakestCard} strongestCard={result.strongestCard} masteryUnlocked={masteryUnlocked} t={t} lang={lang} onBack={() => { setScreen('menu'); setSession(null) }} onReplay={result.originalSession ? () => { setSession(result.originalSession); setResumeStartIndex(0); setResumeStartProgress(null); setScreen('cards') } : null} s={s} th={th} /></>
  if (screen === 'settings') return <>{homeFloat}<SettingsScreen t={t} s={s} theme={theme} onThemeChange={onThemeChange} onBack={() => setScreen('menu')} user={user} myData={myData} setMyData={setMyData} allCards={allCards} lang={lang} onPartner={() => setScreen('partner')} onLightModeChange={onLightModeChange} onCardSizeChange={onCardSizeChange} /></>
  if (screen === 'meinekarten') return <>{homeFloat}<MeineKartenScreen user={user} myData={myData} setMyData={setMyData} allCards={allCards} cardProgress={cardProgress} lang={lang} theme={theme} onBack={() => setScreen('menu')} /></>
  if (screen === 'geschenkkarte') return <>{homeFloat}<GeschenkkarteScreen user={user} myData={myData} lang={lang} theme={theme} onBack={() => setScreen('menu')} allCards={allCards} cardProgress={cardProgress} /></>
  if (screen === 'karteerstellen') return <>{homeFloat}<KarteErstellenScreen user={user} myData={myData} setMyData={setMyData} allCards={allCards} lang={lang} theme={theme} onBack={() => setScreen('menu')} /></>
  if (screen === 'partner') return <>{homeFloat}<PartnerScreen user={user} myData={myData} lang={lang} theme={theme} onBack={() => setScreen('menu')} onPartnerUpdate={(uid) => { onPartnerUpdate(uid); setScreen('menu') }} /></>
  if (screen === 'test') return <>{homeFloat}<PlacementTest lang={lang} theme={theme} user={user} onBack={() => setScreen('menu')} onSaveCefr={onSaveCefr} /></>
  if (screen === 'impressum') return <>{homeFloat}<ImpressumScreen lang={lang} theme={theme} onBack={() => setScreen('menu')} /></>
  if (screen === 'stats') return <>{homeFloat}<StatsScreen user={user} myData={myData} partnerData={partnerData} allCards={allCards} lang={lang} theme={theme} onBack={() => setScreen('menu')} cardProgress={cardProgress} /></>
  if (screen === 'ki') return <>{homeFloat}<KiGespraechScreen lang={lang} theme={theme} onBack={() => setScreen('menu')} userName={user.displayName?.split(' ')[0] || 'du'} /></>
  if (screen === 'satz') return <>{homeFloat}<SatzTrainingScreen lang={lang} theme={theme} onBack={() => setScreen('menu')} allCards={allCards} cardProgress={cardProgress} userName={user.displayName?.split(' ')[0] || 'du'} /></>
  if (screen === 'diary') return <>{homeFloat}<DiaryScreen user={user} myData={myData} setMyData={setMyData} partnerData={partnerData} lang={lang} theme={theme} onBack={() => setScreen('menu')} /></>

  return (
    <div style={s.container} className="vocara-screen vocara-home-outer"><div style={{ ...s.homeBox, paddingTop: '12px' }} className="vocara-home-box">

      {/* ── LOGO ── */}
      <div className="vocara-logo-section" style={{ textAlign: 'center', paddingTop: '20px', paddingBottom: '16px' }}>
        <h1 className="vocara-logo-title" style={{ ...s.logoTitle, fontSize: 'clamp(4rem, 17vw, 6.5rem)', lineHeight: 1, marginBottom: '10px' }}>Vocara</h1>
        <p className="vocara-logo-greeting" style={{ ...s.greeting, marginBottom: uniqueTargetLangs.length > 0 ? '6px' : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
          {t.hello}, {firstName}
          {partnerActivityStatus && (
            <span style={{ fontSize: '0.72rem', color: partnerActivityStatus.color, fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              {partnerActivityStatus.dot} {partnerActivityStatus.label}
            </span>
          )}
        </p>
        {(onBack || uniqueTargetLangs.length > 0) && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', position: 'relative' }}>
            {onBack && (
              <button onClick={onBack} style={{ position: 'absolute', left: 0, background: 'transparent', border: 'none', color: th.sub, cursor: 'pointer', fontSize: '0.82rem', padding: '4px 0', fontWeight: '600', WebkitTapHighlightColor: 'transparent' }}>← Zurück</button>
            )}
            {uniqueTargetLangs.map(l => {
              const info = AVAILABLE_LANGS.find(a => a.code === l)
              const paused = pausedLanguages.includes(l)
              return (
                <span key={l} title={info?.label || l} style={{ fontSize: '1.1rem', opacity: paused ? 0.25 : 1, filter: paused ? 'grayscale(1)' : 'none', transition: 'opacity 0.3s' }}>
                  {info?.flag || l}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* ── MONTHLY TEST BANNER ── */}
      {testDue && (
        <button style={{ ...s.menuBtnWarning, marginBottom: '12px' }} onClick={() => setScreen('test')}>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 'bold', color: '#f44336' }}>{t.monthlyTestBanner}</span>
            <span style={{ fontSize: '0.75rem', color: th.sub }}>{t.monthlyTestSub}</span>
          </span>
          <span style={{ color: '#f44336' }}>→</span>
        </button>
      )}

      {/* ── KI COACHING BANNER ── */}
      {coachMsg && (
        <div style={{ background: `${th.card}bb`, border: `1px solid ${th.gold}33`, borderRadius: '12px', padding: '10px 16px', marginBottom: '12px' }}>
          <p style={{ color: th.gold, fontSize: '0.85rem', fontStyle: 'italic', margin: 0, lineHeight: 1.6, opacity: 0.92 }}>{coachMsg}</p>
        </div>
      )}

      {/* ── STREAK WARNING ── */}
      {streakStatus === 'warning' && (
        <div style={{ background: 'rgba(255,165,0,0.1)', border: '1px solid rgba(255,165,0,0.4)', borderRadius: '12px', padding: '10px 14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.1rem' }}>⚠️</span>
          <span style={{ color: '#FFA500', fontWeight: '600', fontSize: '0.88rem', flex: 1 }}>{isMarkLang ? 'Die Verbindung braucht dich.' : 'Your streak is at risk!'}</span>
          {freezeAvailable && (
            <button
              onClick={() => { if (window.confirm(isMarkLang ? 'Streak Freeze jetzt verwenden? (1x/Monat)' : 'Use Streak Freeze now? (1x/month)')) handleStreakFreeze() }}
              style={{ background: 'rgba(100,200,255,0.12)', border: '1px solid rgba(100,200,255,0.35)', color: '#7ec8e3', borderRadius: '20px', padding: '5px 12px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700', whiteSpace: 'nowrap', flexShrink: 0 }}
            >🧊 Freeze</button>
          )}
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
            <p style={{ color: th.text, fontWeight: '700', margin: '0 0 3px', fontSize: '0.92rem' }}>{dailyCard.front}</p>
            <p style={{ color: th.accent, fontWeight: '600', margin: '0 0 3px', fontSize: '1rem' }}>{dailyCard.back}</p>
            {dailyCard.context && <p style={{ color: th.sub, fontSize: '0.75rem', fontStyle: 'italic', margin: 0, lineHeight: 1.4 }}>„{dailyCard.context}"</p>}
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

      {/* ── 5-BUTTON GRID ── */}
      <div className="vocara-cat-grid" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="vocara-cat-btn" style={{ ...s.catBtn, '--gleam-delay': '0s' }} onClick={() => startCategorySession('vocabulary')}>
            {t.menuWorte.split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
          </button>
          <button className="vocara-cat-btn" style={{ ...s.catBtn, '--gleam-delay': '1.8s', opacity: satzLoading ? 0.6 : 1 }} onClick={startSatzSession} disabled={satzLoading}>
            {satzLoading ? '...' : t.menuSaetze.split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="vocara-cat-btn" style={{ ...s.catBtn, '--gleam-delay': '3.5s' }} onClick={() => startCategorySession('street')}>
            {t.menuStraße.split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
          </button>
          <button className="vocara-cat-btn" style={{ ...s.catBtn, '--gleam-delay': '5.2s' }} onClick={() => startCategorySession('home')}>
            {t.menuHause.split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
          </button>
        </div>
        <button className="vocara-alle-btn" style={{ ...s.button, padding: '13px 28px', fontSize: '0.9rem', letterSpacing: '0.2px', marginBottom: 0, '--gleam-delay': '2.5s' }} onClick={() => startCategorySession('all')}>
          {t.menuAlle}
        </button>
        <button className="vocara-cat-btn" style={{ ...s.catBtn, '--gleam-delay': '6.8s', width: '100%', opacity: basicsLoading ? 0.6 : 1 }} onClick={startBasicsSession} disabled={basicsLoading}>
          {basicsLoading ? '...' : (t.menuGrundlagen || 'Die\nGrundlagen').split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
        </button>
      </div>

      {/* ── KARTE BUTTON ── */}
      <button style={{ ...s.navBtn, marginBottom: karteMenu ? '2px' : '12px', fontSize: '0.9rem', fontWeight: '600', textAlign: 'center' }}
        onClick={() => setKarteMenu(m => !m)}>
        🃏 {isMarkLang ? 'Karte' : 'Card'} {karteMenu ? '▲' : '▼'}
      </button>
      {karteMenu && (
        <div style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: '14px', padding: '4px', marginBottom: '12px', animation: 'vocaraFadeIn 0.2s ease both' }}>
          <button style={{ ...s.navBtn, marginBottom: '2px', textAlign: 'left', paddingLeft: '16px' }} onClick={() => { setKarteMenu(false); setScreen('meinekarten') }}>
            📋 {isMarkLang ? 'Meine Karten' : 'My Cards'}
          </button>
          <button style={{ ...s.navBtn, marginBottom: '2px', textAlign: 'left', paddingLeft: '16px' }} onClick={() => { setKarteMenu(false); setScreen('karteerstellen') }}>
            ✏️ {isMarkLang ? 'Karte erstellen' : 'Create card'}
          </button>
          <button style={{ ...s.navBtn, marginBottom: 0, textAlign: 'left', paddingLeft: '16px', opacity: myData?.partnerUID ? 1 : 0.4 }}
            onClick={() => { if (!myData?.partnerUID) return; setKarteMenu(false); setScreen('geschenkkarte') }}>
            🎁 {isMarkLang ? 'Geschenkkarte senden' : 'Send gift card'}
          </button>
        </div>
      )}

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
                background: done ? th.accent : 'transparent',
                border: done ? 'none' : `2px solid ${th.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.3s ease',
                boxShadow: done ? `0 0 10px ${th.glowColor}66` : 'none',
                animation: done ? 'dotPop 0.4s ease both' : 'none',
                flexShrink: 0,
              }}>
                {done && <span style={{ color: th.btnTextColor || '#111', fontSize: '11px', fontWeight: '900', lineHeight: 1 }}>✓</span>}
              </div>
              <span style={{ fontSize: '8px', color: done ? th.accent : th.sub, fontWeight: done ? '700' : '400', textAlign: 'center', lineHeight: 1.2, maxWidth: '46px', transition: 'color 0.3s ease' }}>
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

      {/* ── SECONDARY NAVIGATION ── */}
      <div className="vocara-nav-section" style={{ marginTop: '4px', marginBottom: '10px' }}>
        <button className="vocara-nav-btn" style={{ ...s.navBtn, opacity: satzLoading ? 0.6 : 1 }} onClick={startSatzSession} disabled={satzLoading}>
          ✍️ {satzLoading ? '…' : t.menuSatz}
        </button>
        <button className="vocara-nav-btn" style={s.navBtn} onClick={() => setScreen('ki')}>{t.menuKi}</button>
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
          📔 {isMarkLang ? 'Tagebuch' : 'Diary'}
        </button>
        <button className="vocara-nav-btn" style={s.navBtn} onClick={() => setScreen('partner')}>
          {myData?.partnerUID ? `${t.menuPartnerLabel}: ${partnerName}` : t.menuPartnerConnect}
        </button>
        <button className="vocara-nav-btn" style={s.navBtn} onClick={() => setScreen('settings')}>{t.menuSettings}</button>
        <button className="vocara-nav-btn" style={{ ...s.navBtn, marginBottom: 0 }} onClick={() => signOut(auth)}>{t.menuSignOut}</button>
      </div>

      <button style={s.legalBtn} onClick={() => setScreen('impressum')}>{t.impressumLink}</button>
      <button
        onClick={() => setScreen('impressum')}
        style={{ background: 'transparent', border: 'none', color: th.sub, cursor: 'pointer', fontSize: '0.68rem', opacity: 0.38, padding: '4px 8px', display: 'block', width: '100%', textAlign: 'center', marginTop: '2px', marginBottom: '6px', fontFamily: "'Inter', system-ui, sans-serif" }}
      >
        🇩🇪 Made in Germany
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
                  setMyData(d => ({ ...d, aiCards: updated, pendingGift: null, pendingGiftSeenDate: todayStr() }))
                  setPendingGift(null)
                }}
                style={{ flex: 1, background: `${th.accent}25`, color: th.text, border: `1px solid ${th.accent}55`, borderRadius: '14px', padding: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem' }}>
                ➕ {isMarkLang ? 'Zum Deck' : 'Add to deck'}
              </button>
              <button
                onClick={async () => {
                  await updateDoc(doc(db, 'users', user.uid), { pendingGift: null, pendingGiftSeenDate: todayStr() }).catch(() => {})
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

function DiaryScreen({ user, myData, setMyData, partnerData, lang, theme, onBack }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const isDE = lang === 'de'
  const [myEntry, setMyEntry] = useState('')
  const [feedback, setFeedback] = useState(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const today = todayStr()

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
              <input
                style={{ ...s.input, marginBottom: '8px' }}
                placeholder={isDE ? `Dein Satz auf ${isDE ? 'Englisch' : 'Deutsch'}…` : 'Your sentence in German…'}
                value={myEntry}
                onChange={e => setMyEntry(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveEntry()}
              />
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
  const [saveStatus, setSaveStatus] = useState(null)

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

  const openEdit = (card) => { setEditCard(card); setEditFront(card.front); setEditBack(card.back); setEditCat(card.category || 'vocabulary') }

  const saveEdit = async () => {
    if (!editFront.trim() || !editBack.trim()) return
    const updated = (myData?.aiCards || []).map(c => c.id === editCard.id ? { ...c, front: editFront.trim(), back: editBack.trim(), category: editCat } : c)
    try {
      await updateDoc(doc(db, 'users', user.uid), { aiCards: updated })
      setMyData(d => ({ ...d, aiCards: updated }))
      setEditCard(null)
      setSaveStatus(isDE ? 'Gespeichert ✓' : 'Saved ✓')
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
          <input style={{ ...s.input, marginBottom: '12px' }} value={editBack} onChange={e => setEditBack(e.target.value)} placeholder={isDE ? 'Rückseite' : 'Back'} />
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <button onClick={() => setEditCat('vocabulary')} style={{ flex: 1, padding: '7px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.78rem', background: editCat !== 'street' ? 'rgba(140,140,155,0.25)' : 'transparent', color: editCat !== 'street' ? '#A0A0B8' : th.sub, border: `1px solid ${editCat !== 'street' ? 'rgba(140,140,155,0.45)' : th.border}` }}>Hochsprache</button>
            <button onClick={() => setEditCat('street')} style={{ flex: 1, padding: '7px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.78rem', background: editCat === 'street' ? 'rgba(180,120,30,0.2)' : 'transparent', color: editCat === 'street' ? '#C8922A' : th.sub, border: `1px solid ${editCat === 'street' ? 'rgba(180,120,30,0.4)' : th.border}` }}>Slang</button>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ flex: 1, background: th.accent, color: th.btnTextColor || '#111', border: 'none', padding: '9px', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '0.88rem' }} onClick={saveEdit}>{isDE ? 'Speichern' : 'Save'}</button>
            <button style={{ flex: '0 0 auto', background: '#f4433618', color: '#e06c75', border: '1px solid rgba(224,108,117,0.5)', padding: '9px 14px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem' }} onClick={() => deleteCard(editCard)}>{isDE ? 'Löschen' : 'Delete'}</button>
            <button style={{ flex: '0 0 auto', background: 'transparent', color: th.sub, border: `1px solid ${th.border}`, padding: '9px 12px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem' }} onClick={() => setEditCard(null)}>✕</button>
          </div>
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

function KarteErstellenScreen({ user, myData, setMyData, allCards, lang, theme, onBack }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const isDE = lang === 'de'
  const [forPartner, setForPartner] = useState(false)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [backLoading, setBackLoading] = useState(false)
  const [cat, setCat] = useState('vocabulary')
  const [status, setStatus] = useState(null)
  const translateTimerRef = useRef(null)
  const lastTranslatedFront = useRef('')
  const myPartnerUID = myData?.partnerUID || (user.uid === MARK_UID ? ELOSY_UID : user.uid === ELOSY_UID ? MARK_UID : null)
  const partnerName = myData?.partnerName || (user.uid === MARK_UID ? 'Elosy' : user.uid === ELOSY_UID ? 'Mark' : null)

  // Determine language pair: for Mark (de), front=EN, back=DE
  const baseCard = (allCards || []).find(c => !/_r(_\d+)?$/.test(c.id))
  const langA = baseCard?.langA || (lang === 'de' ? 'en' : 'de')
  const langB = baseCard?.langB || lang
  const LANG_NAMES = { en: 'Englisch', de: 'Deutsch', sw: 'Swahili', fr: 'Französisch', es: 'Spanisch', th: 'Thai' }
  const LANG_NAMES_EN = { en: 'English', de: 'German', sw: 'Swahili', fr: 'French', es: 'Spanish', th: 'Thai' }
  const fromLangName = LANG_NAMES_EN[langA] || langA
  const toLangName = LANG_NAMES_EN[langB] || langB

  const autoTranslate = async (text) => {
    if (!text.trim() || text === lastTranslatedFront.current) return
    setBackLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 60,
          messages: [{ role: 'user', content: `Translate "${text}" from ${fromLangName} to ${toLangName} as a natural short phrase or word. Return ONLY the translation, nothing else, no quotes, no explanation.` }]
        })
      })
      const data = await res.json()
      const translation = (data.content?.[0]?.text || '').trim()
      if (translation) {
        setBack(translation)
        lastTranslatedFront.current = text
      }
    } catch (e) {
      console.warn('Auto-translate failed:', e)
    }
    setBackLoading(false)
  }

  const handleFrontChange = (val) => {
    setFront(val)
    if (translateTimerRef.current) clearTimeout(translateTimerRef.current)
    if (val.trim().length >= 2) {
      translateTimerRef.current = setTimeout(() => autoTranslate(val.trim()), 500)
    }
  }

  const handleFrontBlur = () => {
    if (front.trim().length >= 2) {
      if (translateTimerRef.current) clearTimeout(translateTimerRef.current)
      autoTranslate(front.trim())
    }
  }

  const save = async () => {
    if (!front.trim() || !back.trim()) return
    const card = { id: `custom_${Date.now()}`, front: front.trim(), back: back.trim(), category: cat, langA, langB, source: 'custom', createdAt: Date.now() }
    try {
      if (forPartner && myPartnerUID) {
        const senderName = user.displayName?.split(' ')[0] || 'Partner'
        // Write as daily surprise card — partner will see animated popup
        await updateDoc(doc(db, 'users', myPartnerUID), {
          surpriseCard: { ...card, sharedBy: senderName, sharedAt: Date.now() },
          surpriseSeenDate: null // reset so partner sees it today
        })
        setStatus(isDE ? `🎁 Überraschungskarte an ${partnerName} gesendet ✓` : `🎁 Surprise card sent to ${partnerName} ✓`)
      } else {
        const updated = [...(myData?.aiCards || []), card]
        await updateDoc(doc(db, 'users', user.uid), { aiCards: updated })
        setMyData(d => ({ ...d, aiCards: updated }))
        setStatus(isDE ? 'Karte gespeichert ✓' : 'Card saved ✓')
      }
      setFront(''); setBack(''); setCat('vocabulary'); lastTranslatedFront.current = ''
      setTimeout(() => setStatus(null), 2500)
    } catch (e) { console.warn(e); setStatus(isDE ? 'Fehler' : 'Error') }
  }

  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>← {isDE ? 'Zurück' : 'Back'}</button>
      <h2 style={{ color: th.text, marginBottom: '16px', fontSize: '1.2rem', fontFamily: "'Playfair Display', Georgia, serif" }}>
        ✏️ {isDE ? 'Neue Karte' : 'New Card'}
      </h2>
      <div style={{ ...s.card, marginBottom: '10px' }}>
        <p style={{ ...s.cardLabel, marginBottom: '10px' }}>{isDE ? 'Für wen?' : 'For whom?'}</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setForPartner(false)}
            style={{ flex: 1, padding: '9px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', background: !forPartner ? th.accent : 'transparent', color: !forPartner ? (th.btnTextColor || '#111') : th.sub, border: `1px solid ${!forPartner ? th.accent : th.border}` }}>
            {isDE ? 'Für mich' : 'For me'}
          </button>
          {myPartnerUID && (
            <button onClick={() => setForPartner(true)}
              style={{ flex: 1, padding: '9px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', background: forPartner ? th.accent : 'transparent', color: forPartner ? (th.btnTextColor || '#111') : th.sub, border: `1px solid ${forPartner ? th.accent : th.border}` }}>
              🎁 {isDE ? `Für ${partnerName}` : `For ${partnerName}`}
            </button>
          )}
        </div>
      </div>
      <div style={s.card}>
        <p style={{ ...s.cardLabel, marginBottom: '6px' }}>
          {LANG_NAMES[langA] || langA} → {LANG_NAMES[langB] || langB}
        </p>
        <input
          style={{ ...s.input, marginBottom: '8px' }}
          placeholder={isDE ? `${LANG_NAMES[langA] || langA} — Vorderseite` : `${LANG_NAMES_EN[langA] || langA} — front`}
          value={front}
          onChange={e => handleFrontChange(e.target.value)}
          onBlur={handleFrontBlur}
        />
        {/* Back field with auto-translate indicator */}
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <input
            style={{ ...s.input, marginBottom: 0, paddingRight: backLoading ? '36px' : undefined }}
            placeholder={backLoading
              ? (isDE ? 'KI übersetzt…' : 'AI translating…')
              : (isDE ? `${LANG_NAMES[langB] || langB} — Rückseite (KI-Vorschlag)` : `${LANG_NAMES_EN[langB] || langB} — back (AI suggestion)`)
            }
            value={back}
            onChange={e => { setBack(e.target.value); lastTranslatedFront.current = '' }}
          />
          {backLoading && (
            <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', border: `2px solid ${th.gold}44`, borderTopColor: th.gold, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button onClick={() => setCat('vocabulary')} style={{ flex: 1, padding: '8px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem', background: cat !== 'street' ? 'rgba(140,140,155,0.25)' : 'transparent', color: cat !== 'street' ? '#A0A0B8' : th.sub, border: `1px solid ${cat !== 'street' ? 'rgba(140,140,155,0.45)' : th.border}` }}>Hochsprache</button>
          <button onClick={() => setCat('street')} style={{ flex: 1, padding: '8px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem', background: cat === 'street' ? 'rgba(180,120,30,0.2)' : 'transparent', color: cat === 'street' ? '#C8922A' : th.sub, border: `1px solid ${cat === 'street' ? 'rgba(180,120,30,0.4)' : th.border}` }}>Slang</button>
        </div>
        <button style={{ ...s.button, marginBottom: 0, opacity: (!front.trim() || !back.trim() || backLoading) ? 0.45 : 1 }} onClick={save} disabled={!front.trim() || !back.trim() || backLoading}>
          {forPartner && partnerName ? (isDE ? `🎁 An ${partnerName} senden` : `🎁 Send to ${partnerName}`) : (isDE ? 'Karte speichern' : 'Save card')}
        </button>
        {status && <p style={{ color: th.accent, fontSize: '0.82rem', marginTop: '8px', textAlign: 'center' }}>{status}</p>}
      </div>
    </div></div>
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
      const gift = { front: selectedCard.front, back: selectedCard.back, category: selectedCard.category, langA: selectedCard.langA, langB: selectedCard.langB, message: message.trim().slice(0, 100), fromName, sentAt: Date.now(), date: todayStr() }
      await updateDoc(doc(db, 'users', myPartnerUID), { pendingGift: gift })
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

function MainSelectionScreen({ lang, theme, firstName, uniqueTargetLangs, pausedLanguages, onSprechen, onEntdecken, onHorizont }) {
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
        {glassBtn('entdecken', onEntdecken, 'Katara', isDE ? 'Professionelles Lernen' : 'Professional Learning', isDE ? 'Lernkarten für den Beruf' : 'Flashcards for work', false)}
        {glassBtn('horizont', onHorizont, isDE ? 'Horizont' : 'Horizon', null, isDE ? 'Kultur & Auswandern' : 'Culture & emigration', true)}
      </div>
    </div>
  )
}

function HorizontScreen({ lang, theme, onBack }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const isDE = lang === 'de'
  return (
    <div style={s.container} className="vocara-screen">
      <div style={{ ...s.homeBox, paddingTop: '24px' }}>
        <button style={s.backBtn} onClick={onBack}>← {isDE ? 'Zurück' : 'Back'}</button>
        <div style={{ textAlign: 'center', marginTop: '60px' }}>
          <span style={{ fontSize: '3rem' }}>🌐</span>
          <h2 style={{ color: th.text, fontSize: '1.8rem', fontFamily: "'Playfair Display', Georgia, serif", margin: '16px 0 10px', fontWeight: '700' }}>{isDE ? 'Horizont' : 'Horizon'}</h2>
          <p style={{ color: th.sub, fontSize: '0.95rem', marginBottom: '24px', lineHeight: 1.6 }}>{isDE ? 'Kultur & Auswandern' : 'Culture & emigration'}</p>
          <div style={{ background: `${th.gold}12`, border: `1px solid ${th.gold}33`, borderRadius: '20px', padding: '20px 24px', display: 'inline-block' }}>
            <p style={{ color: th.gold, fontWeight: '700', fontSize: '1rem', margin: 0 }}>{isDE ? 'Bald verfügbar' : 'Coming soon'}</p>
          </div>
        </div>
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
          model: 'claude-haiku-4-5-20251001', max_tokens: 800,
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

  // ── Create set view ──
  if (innerScreen === 'create') {
    return (
      <div style={s.container} className="vocara-screen">
        <div style={{ ...s.homeBox, paddingTop: '16px' }}>
          <button style={s.backBtn} onClick={() => setInnerScreen('list')}>← {isDE ? 'Zurück' : 'Back'}</button>
          <h2 style={{ color: th.text, fontSize: '1.2rem', fontWeight: '700', marginBottom: '20px', textAlign: 'left' }}>{isDE ? 'Neues Set' : 'New set'}</h2>
          <div style={s.card}>
            <input style={{ ...s.input, marginBottom: '12px' }} placeholder={isDE ? 'Name des Sets' : 'Set name'} value={newSetName} onChange={e => setNewSetName(e.target.value)} />
            <p style={{ ...s.cardLabel, marginBottom: '10px' }}>{isDE ? 'Symbol wählen' : 'Pick an icon'}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              {iconOptions.map(ic => (
                <button key={ic} onClick={() => setNewSetIcon(ic)} style={{ padding: '8px', borderRadius: '10px', cursor: 'pointer', fontSize: '1.3rem', background: newSetIcon === ic ? `${th.accent}22` : 'transparent', border: `1px solid ${newSetIcon === ic ? th.accent : th.border}` }}>{ic}</button>
              ))}
            </div>
            <button style={s.button} onClick={createSet}>{isDE ? 'Set erstellen' : 'Create set'}</button>
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

        {sets.length === 0 ? (
          <div style={{ ...s.card, textAlign: 'center', padding: '36px 20px' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>📚</span>
            <p style={{ color: th.sub, fontSize: '0.9rem', margin: 0 }}>{isDE ? 'Noch keine Sets — erstelle dein erstes!' : 'No sets yet — create your first one!'}</p>
          </div>
        ) : (
          sets.map((set, idx) => {
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
          })
        )}

        {sets.length < FREE_LIMIT ? (
          <button style={{ ...s.button, marginTop: '8px' }} onClick={() => setInnerScreen('create')}>+ {isDE ? 'Neues Set erstellen' : 'Create new set'}</button>
        ) : (
          <div style={{ ...s.card, opacity: 0.55, marginTop: '8px', textAlign: 'center', padding: '14px' }}>
            <p style={{ color: th.sub, fontSize: '0.82rem', margin: 0 }}>🔒 {isDE ? `Mehr als ${FREE_LIMIT} Sets — Premium` : `More than ${FREE_LIMIT} sets — Premium`}</p>
          </div>
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
    })
    return () => { if (unsubRef.current) unsubRef.current() }
  }, [coupleId])

  const startSession = async () => {
    if (!liveRef.current) return
    const cardIds = sessionCards.map(c => c.id)
    await setDoc(liveRef.current, {
      hostUID: user.uid,
      cardIndex: 0,
      cardIds,
      answers: {},
      startedAt: Date.now(),
      active: true,
    })
    setStatus('active')
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

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [myData, setMyData] = useState(null)
  const [partnerData, setPartnerData] = useState(null)
  const [theme, setTheme] = useState('nairobi')
  const [lightMode, setLightMode] = useState(false)
  const [cardSize, setCardSize] = useState('normal')
  const [needsLangSetup, setNeedsLangSetup] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [mainNav, setMainNav] = useState('main') // 'main' | 'sprechen' | 'entdecken' | 'horizont' | 'livesession'

  useEffect(() => {
    const id = 'vocara-global-css'
    if (!document.getElementById(id)) {
      const el = document.createElement('style'); el.id = id; el.textContent = GLOBAL_CSS
      document.head.appendChild(el)
    }
  }, [])

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
      try {
        if (u) {
          const userRef = doc(db, 'users', u.uid)
          await setDoc(userRef, { name: u.displayName, email: u.email, lastActive: todayStr() }, { merge: true })
          const code = u.uid.slice(0, 8).toUpperCase()
          await setDoc(doc(db, 'inviteCodes', code), { uid: u.uid }, { merge: true })
          const snap = await getDoc(userRef)
          if (snap.exists()) {
            const data = snap.data()
            if (data.theme) setTheme(data.theme)
            if (data.lightMode !== undefined) setLightMode(!!data.lightMode)
            if (data.cardSize) setCardSize(data.cardSize)
            // ── BATCH CATEGORY FIX: vocabulary + 3+ words → sentence ─
            // Runs on EVERY app load. Direct rule, no ruleCategory needed.
            // After any changes: awaits a fresh Firestore re-fetch.
            try {
              const baseCards = u.uid === ELOSY_UID ? ALL_ELOSY_CARDS_BASE : ALL_MARK_CARDS_BASE
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
                const freshSnap = await getDoc(userRef)
                if (freshSnap.exists()) {
                  const freshData = freshSnap.data()
                  data.cardCategories = freshData.cardCategories || newCats
                  console.log('[category] Batch fix saved + re-fetched. Total entries:', Object.keys(data.cardCategories).length)
                }
              } else {
                console.log('[category] No changes needed')
              }
            } catch (catErr) {
              console.error('[Vocara] category batch fix failed:', catErr)
            }
            setMyData(data)
            const isKnown = u.uid === MARK_UID || u.uid === ELOSY_UID
            if (!isKnown) {
              if (!data.onboardingDone) setNeedsOnboarding(true)
              if (!data.languages || data.languages.length === 0) setNeedsLangSetup(true)
            }
            try {
              if (data.partnerUID) {
                const pSnap = await getDoc(doc(db, 'users', data.partnerUID))
                if (pSnap.exists()) setPartnerData(pSnap.data())
              } else {
                const partnerUID = u.uid === MARK_UID ? ELOSY_UID : u.uid === ELOSY_UID ? MARK_UID : null
                if (partnerUID) {
                  const pSnap = await getDoc(doc(db, 'users', partnerUID))
                  if (pSnap.exists()) setPartnerData(pSnap.data())
                }
              }
            } catch (partnerErr) {
              console.error('[Vocara] partner load failed, skipping:', partnerErr)
            }
          }
        }
      } catch (initErr) {
        console.error('[Vocara] app init failed, falling back to defaults:', initErr)
      }
      setUser(u); setLoading(false)
    })
    return unsubscribe
  }, [])

  const saveProgress = async (finalProgress) => {
    const ref = doc(db, 'users', user.uid)
    await updateDoc(ref, { cardProgress: finalProgress })
    const snap = await getDoc(ref); if (snap.exists()) setMyData(snap.data())
  }
  const handleThemeChange = async (newTheme) => {
    setTheme(newTheme)
    if (user) await updateDoc(doc(db, 'users', user.uid), { theme: newTheme })
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
    const ref = doc(db, 'users', user.uid)
    const snap = await getDoc(ref); if (snap.exists()) setMyData(snap.data())
    if (partnerUID) { const pSnap = await getDoc(doc(db, 'users', partnerUID)); if (pSnap.exists()) setPartnerData(pSnap.data()) }
    else setPartnerData(null)
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
  const isElosy = user?.uid === ELOSY_UID
  const lang = isElosy ? 'en' : 'de'

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: th.bg, color: th.text }}>Laden...</div>
  if (!user) return <LoginScreen theme={theme} />

  // Onboarding: show for new users before lang setup
  if (needsOnboarding) return <OnboardingScreen lang={lang} theme={theme} onDone={handleOnboardingDone} />

  if (needsLangSetup) return <LangSetupScreen user={user} lang={lang} theme={theme} onDone={(langs) => { setNeedsLangSetup(false); setMyData(d => ({ ...d, languages: langs })) }} />

  const cardCategories = myData?.cardCategories || {}
  const allCards = [
    ...(isElosy ? ALL_ELOSY_CARDS : ALL_MARK_CARDS),
    ...(myData?.aiCards || []).flatMap(buildCardPair),
    ...(myData?.sharedCards || []),
  ].map(card => {
    const baseId = card.id.replace(/_r(_\d+)?$/, '')
    const aiCat = cardCategories[baseId]
    return aiCat ? { ...card, category: aiCat } : card
  })

  const hour = new Date().getHours()
  const timeOverlay = hour >= 0 && hour < 6
    ? 'rgba(0,20,50,0.08)'         // 00–06: deep night blue (#46)
    : hour >= 6 && hour < 12
      ? 'rgba(255,200,50,0.04)'    // 06–12: warm golden morning (#46)
      : hour >= 18
        ? 'rgba(255,100,0,0.05)'   // 18–24: deeper warm evening (#46)
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
        <WaterCanvas />
        {(theme === 'nairobi' || theme === 'welt') && <ParticleCanvas theme={theme} />}
        {timeOverlay && <div style={{ position: 'fixed', inset: 0, background: timeOverlay, pointerEvents: 'none', zIndex: 2 }} />}
        {seasonOverlay && <div style={{ position: 'fixed', inset: 0, background: seasonOverlay, pointerEvents: 'none', zIndex: 3 }} />}
        {mainNav === 'main' && (
          <MainSelectionScreen
            lang={lang} theme={theme} firstName={firstNameAll}
            uniqueTargetLangs={uniqueTargetLangsAll} pausedLanguages={myData?.pausedLanguages || []}
            onSprechen={() => setMainNav('sprechen')}
            onEntdecken={() => { window.location.href = 'https://katara-eta.vercel.app'; }}
            onHorizont={() => setMainNav('horizont')}
          />
        )}
        {mainNav === 'sprechen' && (
          <MenuScreen user={user} myData={myData} setMyData={setMyData} partnerData={partnerData}
            allCards={allCards}
            lang={lang} onSaveProgress={saveProgress}
            theme={theme} onThemeChange={handleThemeChange}
            onLightModeChange={handleLightModeChange} onCardSizeChange={handleCardSizeChange}
            onPartnerUpdate={handlePartnerUpdate} onSaveCefr={handleSaveCefr}
            onBack={() => setMainNav('main')} />
        )}
        {mainNav === 'entdecken' && (
          <SetsScreen user={user} myData={myData} setMyData={setMyData} partnerData={partnerData}
            lang={lang} theme={theme} allCards={allCards} cardProgress={myData?.cardProgress || {}}
            coupleId={coupleId}
            onBack={() => setMainNav('main')} onLiveSession={() => setMainNav('livesession')} />
        )}
        {mainNav === 'horizont' && (
          <HorizontScreen lang={lang} theme={theme} onBack={() => setMainNav('main')} />
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
