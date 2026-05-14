import React, { useState, useEffect, useRef, Component } from 'react'
import { auth, db } from './firebase'
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, collection, addDoc, getDocs } from 'firebase/firestore'
import './App.css'
import SettingsScreen from './components/SettingsScreen'
import StatsScreen from './components/StatsScreen'
import SatzTrainingScreen from './components/SatzTrainingScreen'
import CardScreen from './components/CardScreen'
import ResultScreen from './components/ResultScreen'
import AdminScreen from './components/AdminScreen'
import OnboardingScreen from './components/OnboardingScreen'
import MenuScreen from './components/MenuScreen'
import { AppPrefsContext } from './context'

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

const APP_VERSION = 'V01.086.156'
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
// Returns { text, langCode } for the TARGET language side of a card.
// userToLang (from Firestore profile) takes priority over card.targetLang.
// All comparisons are case-insensitive (Firestore may store 'EN' or 'en').
// Returns null only if the card has no text at all — callers should handle null.
function getToLangText(card, userToLang) {
  if (!card) return null
  const toLang = (userToLang || card.targetLang || card.langA || 'en').toLowerCase()
  if ((card.langA || '').toLowerCase() === toLang) return { text: card.front, langCode: toLang }
  if ((card.langB || '').toLowerCase() === toLang) return { text: card?.back, langCode: toLang }
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

  const meanings = (card.back || '').split(' / ').map(m => m.trim()).filter(Boolean)
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
      front: card?.back,
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
async function saveSessionHistory(uid, correct, total, currentHistory, extraUpdate) {
  const entry = { date: todayStr(), correct, total, ts: Date.now() }
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
    correct: 'Richtig', wrong: 'Falsch', fast: 'Fast', easy: '⚡ Easy', stop: '✕ Beenden',
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
    correct: 'Correct', wrong: 'Wrong', fast: 'Fast', easy: '⚡ Easy', stop: '✕ Stop',
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

function VocaraLogoSVG({ withSlogans = false, animate = false, isDE = true }) {
  return (
    <div style={{ textAlign: 'center' }}>
      {withSlogans && (
        <p style={{ color: 'rgba(245,200,66,0.55)', fontSize: '10px', fontWeight: '700', letterSpacing: '7px', textTransform: 'uppercase', margin: '0 0 10px', fontFamily: "'Inter', system-ui, sans-serif" }}>
          DIE STIMME IST DIE BRÜCKE
        </p>
      )}
      <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '2.8rem', fontWeight: '700', color: '#FFD700', margin: 0, letterSpacing: '4px', lineHeight: 1 }}>
        Vocara
      </p>
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

function KarteErstellenScreen({ user, myData, setMyData, allCards, lang, theme, onBack }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const isDE = lang === 'de'
  const [forPartner, setForPartner] = useState(false)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [backLoading, setBackLoading] = useState(false)
  const [kiPartnerLoading, setKiPartnerLoading] = useState(false)
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

  const kiFillPartnerCard = async () => {
    if (!front.trim()) return
    setKiPartnerLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: 100,
          messages: [{ role: 'user', content: `For a language learning card with front: "${front}" (${fromLangName}), provide: 1) translation to ${toLangName}, 2) category (vocabulary or street). Reply as JSON: {"back":"...","category":"vocabulary|street"}. No explanation.` }]
        })
      })
      const data = await res.json()
      const raw = (data.content?.[0]?.text || '').trim()
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        if (parsed.back) setBack(parsed.back)
        if (parsed.category === 'street') setCat('street')
        else setCat('vocabulary')
        lastTranslatedFront.current = front
      }
    } catch (e) { console.warn('KI fill failed:', e) }
    setKiPartnerLoading(false)
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
      <div style={{ ...s.card, marginBottom: '10px', ...(forPartner ? { border: `1px solid`, borderImage: `linear-gradient(135deg, ${th.gold}, #4ECDC4) 1`, borderRadius: '14px', animation: 'goldShimmer 2.5s ease-in-out infinite' } : {}) }}>
        <p style={{ ...s.cardLabel, marginBottom: '10px' }}>{isDE ? 'Für wen?' : 'For whom?'}</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setForPartner(false)}
            style={{ flex: 1, padding: '9px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', background: !forPartner ? th.accent : 'transparent', color: !forPartner ? (th.btnTextColor || '#111') : th.sub, border: `1px solid ${!forPartner ? th.accent : th.border}` }}>
            {isDE ? 'Für mich' : 'For me'}
          </button>
          {myPartnerUID && (
            <button onClick={() => setForPartner(true)}
              style={{ flex: 1, padding: '9px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', background: forPartner ? `linear-gradient(135deg, ${th.gold}30, #4ECDC420)` : 'transparent', color: forPartner ? th.gold : th.sub, border: `1px solid ${forPartner ? th.gold : th.border}` }}>
              🎁 {isDE ? `Für ${partnerName}` : `For ${partnerName}`}
            </button>
          )}
        </div>
        {forPartner && front.trim().length >= 2 && (
          <button onClick={kiFillPartnerCard} disabled={kiPartnerLoading}
            style={{ marginTop: '8px', width: '100%', background: `${th.gold}15`, border: `1px solid ${th.gold}44`, color: th.gold, borderRadius: '10px', padding: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', opacity: kiPartnerLoading ? 0.6 : 1 }}>
            {kiPartnerLoading ? '🤖 …' : `🤖 ${isDE ? 'KI ausfüllen' : 'AI fill'}`}
          </button>
        )}
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
      const gift = { front: selectedCard.front, back: selectedCard?.back, category: selectedCard.category, langA: selectedCard.langA, langB: selectedCard.langB, message: message.trim().slice(0, 100), fromName, sentAt: Date.now(), date: todayStr() }
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
            <span style={{ color: th.sub, fontSize: '0.78rem', marginLeft: '8px', flexShrink: 0 }}>→ {card?.back}</span>
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
        {glassBtn('entdecken', onEntdecken, 'Katara', 'Strukturiertes Lernen', 'Lern was du willst. Wann du willst.', false)}
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
          model: 'claude-haiku-4-5-20251001', max_tokens: 800,
          messages: [{ role: 'user', content: `Create exactly 10 flashcards about: "${kiTopic.trim()}". Return ONLY a JSON array, no markdown:\n[{"front":"<term or question>","back":"<translation or answer>"}]` }]
        })
      })
      const data = await res.json()
      const raw = data.content?.[0]?.text?.trim() || '[]'
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
      const ts = Date.now()
      const newCards = parsed.slice(0, 10).map((c, i) => ({ id: `sc_ki_${ts}_${i}`, front: c.front, back: c?.back }))
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
      const newCards = parsed.slice(0, 50).map((c, i) => ({ id: `sc_imp_${ts}_${i}`, front: c.front, back: c?.back }))
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
                    <span style={{ color: th.accent, fontSize: '0.85rem' }}>{c?.back}</span>
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
                    <span style={{ color: th.accent, fontSize: '0.82rem', flex: 1, textAlign: 'right' }}>{c?.back}</span>
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
            <p style={{ ...s.cardBack }}>{currentCard?.back}</p>
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
  const partnerUnsubRef = useRef(null)
  const [theme, setTheme] = useState('nairobi')
  const [lightMode, setLightMode] = useState(false)
  const [cardSize, setCardSize] = useState('normal')
  const [needsLangSetup, setNeedsLangSetup] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [isNewUser, setIsNewUser] = useState(false)
  const [mainNav, setMainNav] = useState('main') // 'main' | 'sprechen' | 'entdecken' | 'horizont' | 'livesession'
  const CAT_NORMALIZE_POOL = { vocabulary: 'vocab', sentence: 'urlaub' }
  // Maps caller's category key → what generators actually write as data.category
  const CAT_ALIASES = { urlaub: 'sentence', vocabulary: 'vocab', satztraining: 'sentence' }
  const loadCardsForCategory = async (category, level) => {
    const snap = await Promise.race([
      getDocs(collection(db, 'sharedCards')),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 10000))
    ])
    const cards = []
    const userFromLang = (myData?.fromLang || 'de').toLowerCase()
    snap.forEach(d => {
      const data = d.data()
      if (category) {
        const docCat = CAT_NORMALIZE_POOL[data.category] || data.category
        const wantCat = CAT_ALIASES[category] || category
        if (data.category !== category && docCat !== category && data.category !== wantCat) return
      }
      if (level && String(data.level) !== String(level)) return
      ;(data.cards || []).forEach(c => {
        if (
          (c.langA || '').toLowerCase() !== userFromLang &&
          (c.langB || '').toLowerCase() !== userFromLang
        ) return
        buildCardPair({ ...c, targetLang: data.toLang || c.langB }).forEach(p => cards.push(p))
      })
    })
    return cards
  }

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
      if (!u) {
        // LOGOUT: clear all local state so next user starts fresh
        if (partnerUnsubRef.current) { partnerUnsubRef.current(); partnerUnsubRef.current = null }
        setMyData(null); setPartnerData(null)
        setNeedsOnboarding(false); setNeedsLangSetup(false); setIsNewUser(false)
        setMainNav('main')
        setUser(null); setLoading(false)
        return
      }
      try {
        const userRef = doc(db, 'users', u.uid)
        const code = u.uid.slice(0, 8).toUpperCase()
        await setDoc(doc(db, 'inviteCodes', code), { uid: u.uid }, { merge: true })
        const snap = await getDoc(userRef)

        // ── NEW USER: first login, no profile with createdAt yet
        if (!snap.exists() || !snap.data()?.createdAt) {
          const defaultFromLang = u.uid === ELOSY_UID ? 'en' : 'de'
          const profile = { name: u.displayName, email: u.email, createdAt: Date.now(), language: defaultFromLang, fromLang: defaultFromLang, lastActive: todayStr() }
          await setDoc(userRef, profile)
          setMyData(profile)
          setIsNewUser(true)
          setUser(u); setLoading(false)
          return
        }

        // ── RETURNING USER: update presence and load data
        await updateDoc(userRef, { name: u.displayName, email: u.email, lastActive: todayStr() })
        const freshSnap = await getDoc(userRef)
        if (freshSnap.exists()) {
          const data = freshSnap.data()
          if (data.theme) setTheme(data.theme)
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
          setMyData(data)
          const isKnown = u.uid === MARK_UID || u.uid === ELOSY_UID
          if (!isKnown) {
            if (!data.onboardingDone) setNeedsOnboarding(true)
            if (!data.languages || data.languages.length === 0) setNeedsLangSetup(true)
          }
          if (partnerUnsubRef.current) { partnerUnsubRef.current(); partnerUnsubRef.current = null }
          const resolvedPartnerUID = data.partnerUID || (u.uid === MARK_UID ? ELOSY_UID : u.uid === ELOSY_UID ? MARK_UID : null)
          if (resolvedPartnerUID) {
            partnerUnsubRef.current = onSnapshot(doc(db, 'users', resolvedPartnerUID),
              snap => { if (snap.exists()) setPartnerData(snap.data()) },
              () => {}
            )
          }
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
    const ref = doc(db, 'users', user.uid)
    try {
      await updateDoc(ref, { cardProgress: finalProgress })
      console.log('[PROGRESS DEBUG] cardProgress written, keys:', Object.keys(finalProgress).length)
      const snap = await getDoc(ref); if (snap.exists()) setMyData(snap.data())
    } catch (err) {
      console.error('[PROGRESS ERROR]', err)
    }
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
    ...(myData?.aiCards || []).flatMap(buildCardPair),
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
            categoryLevels={myData?.categoryLevels || {}}
            onBack={() => setMainNav('main')} loadCardsForCategory={loadCardsForCategory} />
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
