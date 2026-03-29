import { useState, useEffect, useRef } from 'react'
import { auth, db } from './firebase'
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore'
import './App.css'

const MARK_UID = 'aiNZh4Myn8Y0KfYkGGrkNNW0HC72'
const ELOSY_UID = 'NIX3DYenRdbRjmr2EHsIad9GcqG3'
const SESSION_SIZE = 15
const MASTERY_THRESHOLD = 0.85
const NEW_CARDS_BATCH = 5
const VERY_FAST_S = 3
const FAST_S = 7
const MEDIUM_S = 15

const THEMES = {
  nairobi: { name: '🌙 Nairobi', bg: '#0f0a05', card: '#1a1208', accent: '#E8873A', gold: '#D4AF37', text: '#fff', sub: '#8a7060', border: '#2a1f10' },
  hamburg: { name: '☀️ Hamburg', bg: '#f0f4f8', card: '#ffffff', accent: '#5b8fd4', gold: '#4a7abf', text: '#1a2a3a', sub: '#7a8a9a', border: '#d0dae4' },
  welt: { name: '🎨 Welt', bg: '#1a1a2e', card: '#16213e', accent: '#e94560', gold: '#f5a623', text: '#fff', sub: '#8888aa', border: '#0f3460' },
}

const ALL_MARK_CARDS = [
  { id: 'en_1', front: "What's the catch?", back: "Wo ist der Haken?", langA: 'en', langB: 'de' },
  { id: 'en_2', front: "Long story short...", back: "Um es kurz zu machen...", langA: 'en', langB: 'de' },
  { id: 'en_3', front: "I'm down.", back: "Ich bin dabei.", langA: 'en', langB: 'de' },
  { id: 'en_4', front: "I'm heading out.", back: "Ich mache mich auf den Weg.", langA: 'en', langB: 'de' },
  { id: 'en_5', front: "Give me a heads up.", back: "Gib mir kurz Bescheid.", langA: 'en', langB: 'de' },
  { id: 'en_6', front: "I'm on it.", back: "Ich kümmere mich darum.", langA: 'en', langB: 'de' },
  { id: 'en_7', front: "I'm devastated.", back: "Ich bin am Boden zerstört.", langA: 'en', langB: 'de' },
  { id: 'en_8', front: "Never mind.", back: "Vergiss es. / Schon gut.", langA: 'en', langB: 'de' },
  { id: 'en_9', front: "I'm on my way.", back: "Ich bin unterwegs.", langA: 'en', langB: 'de' },
  { id: 'en_10', front: "What's going on?", back: "Was ist hier los?", langA: 'en', langB: 'de' },
  { id: 'en_11', front: "To be honest...", back: "Um ehrlich zu sein...", langA: 'en', langB: 'de' },
  { id: 'en_12', front: "Take care!", back: "Pass auf dich auf!", langA: 'en', langB: 'de' },
  { id: 'en_13', front: "Keep me posted.", back: "Halt mich auf dem Laufenden.", langA: 'en', langB: 'de' },
  { id: 'en_14', front: "I'll let you know.", back: "Ich gebe dir Bescheid.", langA: 'en', langB: 'de' },
  { id: 'en_15', front: "It's up to you.", back: "Es liegt an dir.", langA: 'en', langB: 'de' },
  { id: 'en_16', front: "I'll keep you posted.", back: "Ich halte dich auf dem Laufenden.", langA: 'en', langB: 'de' },
  { id: 'en_17', front: "Make up your mind!", back: "Entscheide dich!", langA: 'en', langB: 'de' },
  { id: 'en_18', front: "I'm literally starving!", back: "Ich habe Riesenhunger!", langA: 'en', langB: 'de' },
  { id: 'en_19', front: "For real?", back: "Echt jetzt? / Im Ernst?", langA: 'en', langB: 'de' },
  { id: 'en_20', front: "Piece of cake!", back: "Ein Kinderspiel!", langA: 'en', langB: 'de' },
  { id: 'en_21', front: "No biggie.", back: "Kein Ding.", langA: 'en', langB: 'de' },
  { id: 'en_22', front: "My bad.", back: "Mein Fehler.", langA: 'en', langB: 'de' },
  { id: 'en_23', front: "No way!", back: "Auf keinen Fall!", langA: 'en', langB: 'de' },
  { id: 'en_24', front: "Make it clear.", back: "Mach es unmissverständlich klar.", langA: 'en', langB: 'de' },
  { id: 'en_25', front: "Let's make up.", back: "Lass uns uns versöhnen.", langA: 'en', langB: 'de' },
  { id: 'en_26', front: "Bear with me.", back: "Hab Geduld mit mir.", langA: 'en', langB: 'de' },
  { id: 'en_27', front: "Cut it out!", back: "Hör auf damit!", langA: 'en', langB: 'de' },
  { id: 'en_28', front: "Hang in there.", back: "Halte durch.", langA: 'en', langB: 'de' },
  { id: 'en_29', front: "Actually", back: "Eigentlich / Tatsächlich", langA: 'en', langB: 'de' },
  { id: 'en_30', front: "Basically", back: "Im Grunde / Grundsätzlich", langA: 'en', langB: 'de' },
  { id: 'en_31', front: "Eventually", back: "Schließlich / Irgendwann", langA: 'en', langB: 'de' },
  { id: 'en_32', front: "Probably", back: "Wahrscheinlich", langA: 'en', langB: 'de' },
  { id: 'en_33', front: "Definitely", back: "Definitiv / Auf jeden Fall", langA: 'en', langB: 'de' },
  { id: 'en_34', front: "Anyway", back: "Wie auch immer / Jedenfalls", langA: 'en', langB: 'de' },
  { id: 'en_35', front: "Exactly", back: "Genau / Exakt", langA: 'en', langB: 'de' },
  { id: 'en_36', front: "My treat.", back: "Ich lade dich ein.", langA: 'en', langB: 'de' },
  { id: 'en_37', front: "No cap.", back: "Kein Witz / Ungelogen.", langA: 'en', langB: 'de' },
  { id: 'en_38', front: "Under the weather.", back: "Kränklich / Nicht auf der Höhe.", langA: 'en', langB: 'de' },
  { id: 'en_39', front: "Break a leg!", back: "Hals- und Beinbruch!", langA: 'en', langB: 'de' },
  { id: 'en_40', front: "That's a bummer.", back: "Das ist schade / blöd.", langA: 'en', langB: 'de' },
  { id: 'en_41', front: "I'm swamped.", back: "Ich bin total überlastet.", langA: 'en', langB: 'de' },
  { id: 'en_42', front: "Hit me up.", back: "Meld dich bei mir.", langA: 'en', langB: 'de' },
  { id: 'en_43', front: "It's not my cup of tea.", back: "Das ist nicht mein Ding.", langA: 'en', langB: 'de' },
  { id: 'sw_1', front: "Jambo", back: "Hallo (Aussprache: DSHAM-bo)", langA: 'sw', langB: 'de' },
  { id: 'sw_2', front: "Asante", back: "Danke (Aussprache: ah-SAHN-teh)", langA: 'sw', langB: 'de' },
  { id: 'sw_3', front: "Hapana", back: "Nein (Aussprache: ha-PAH-na)", langA: 'sw', langB: 'de' },
  { id: 'sw_4', front: "Ndiyo", back: "Ja (Aussprache: NDI-yo)", langA: 'sw', langB: 'de' },
  { id: 'sw_5', front: "Tafadhali", back: "Bitte (Aussprache: ta-fad-HA-li)", langA: 'sw', langB: 'de' },
  { id: 'sw_6', front: "Habari yako?", back: "Wie geht es dir? (Aussprache: ha-BAH-ri YAH-ko)", langA: 'sw', langB: 'de' },
  { id: 'sw_7', front: "Anakuja", back: "Er/Sie kommt (Aussprache: a-na-KU-ja)", langA: 'sw', langB: 'de' },
  { id: 'sw_8', front: "Ninakuja", back: "Ich komme (Aussprache: ni-na-KU-ja)", langA: 'sw', langB: 'de' },
  { id: 'sw_9', front: "Nakuja", back: "Ich komme – Kurzform (Aussprache: na-KU-ja)", langA: 'sw', langB: 'de' },
  { id: 'sw_10', front: "Nipee", back: "Gib mir (Aussprache: ni-PEH-eh)", langA: 'sw', langB: 'de' },
  { id: 'sw_11', front: "Sitaki", back: "Ich will nicht (Aussprache: si-TAH-ki)", langA: 'sw', langB: 'de' },
  { id: 'sw_12', front: "Chakula", back: "Essen (Aussprache: cha-KU-la)", langA: 'sw', langB: 'de' },
  { id: 'sw_13', front: "Sahani", back: "Teller (Aussprache: sa-HA-ni)", langA: 'sw', langB: 'de' },
  { id: 'sw_14', front: "Ninakupenda", back: "Ich liebe dich (Aussprache: ni-na-ku-PEN-da)", langA: 'sw', langB: 'de' },
  { id: 'sw_15', front: "Nakukosa", back: "Ich vermisse dich (Aussprache: na-ku-KO-sa)", langA: 'sw', langB: 'de' },
  { id: 'sw_16', front: "Lala salama", back: "Schlaf gut (Aussprache: LA-la sa-LA-ma)", langA: 'sw', langB: 'de' },
]

const ALL_ELOSY_CARDS = [
  { id: 'de_1', front: "Guten Morgen", back: "Good morning", langA: 'de', langB: 'en' },
  { id: 'de_2', front: "Guten Abend", back: "Good evening", langA: 'de', langB: 'en' },
  { id: 'de_3', front: "Wie geht es dir?", back: "How are you?", langA: 'de', langB: 'en' },
  { id: 'de_4', front: "Danke schön", back: "Thank you very much", langA: 'de', langB: 'en' },
  { id: 'de_5', front: "Bitte", back: "Please / You're welcome", langA: 'de', langB: 'en' },
  { id: 'de_6', front: "Ich liebe dich", back: "I love you", langA: 'de', langB: 'en' },
  { id: 'de_7', front: "Ich vermisse dich", back: "I miss you", langA: 'de', langB: 'en' },
  { id: 'de_8', front: "Bis bald", back: "See you soon", langA: 'de', langB: 'en' },
  { id: 'de_9', front: "Ich bin müde", back: "I am tired", langA: 'de', langB: 'en' },
  { id: 'de_10', front: "Ich bin glücklich", back: "I am happy", langA: 'de', langB: 'en' },
  { id: 'de_11', front: "Was machst du?", back: "What are you doing?", langA: 'de', langB: 'en' },
  { id: 'de_12', front: "Ich denke an dich", back: "I am thinking of you", langA: 'de', langB: 'en' },
  { id: 'de_13', front: "Schlaf gut", back: "Sleep well", langA: 'de', langB: 'en' },
  { id: 'de_14', front: "Ich komme bald", back: "I am coming soon", langA: 'de', langB: 'en' },
  { id: 'de_15', front: "Du fehlst mir", back: "I miss you (deeply)", langA: 'de', langB: 'en' },
  { id: 'de_16', front: "Entschuldigung", back: "Sorry / Excuse me", langA: 'de', langB: 'en' },
  { id: 'de_17', front: "Ich verstehe nicht", back: "I don't understand", langA: 'de', langB: 'en' },
  { id: 'de_18', front: "Kannst du das wiederholen?", back: "Can you repeat that?", langA: 'de', langB: 'en' },
  { id: 'de_19', front: "Wie heißt du?", back: "What is your name?", langA: 'de', langB: 'en' },
  { id: 'de_20', front: "Ich heiße...", back: "My name is...", langA: 'de', langB: 'en' },
  { id: 'de_21', front: "Woher kommst du?", back: "Where are you from?", langA: 'de', langB: 'en' },
  { id: 'de_22', front: "Ich komme aus Kenia", back: "I come from Kenya", langA: 'de', langB: 'en' },
  { id: 'de_23', front: "Wie spät ist es?", back: "What time is it?", langA: 'de', langB: 'en' },
  { id: 'de_24', front: "Ich bin hungrig", back: "I am hungry", langA: 'de', langB: 'en' },
  { id: 'de_25', front: "Das ist lecker", back: "That is delicious", langA: 'de', langB: 'en' },
  { id: 'de_26', front: "Ich bin stolz auf dich", back: "I am proud of you", langA: 'de', langB: 'en' },
  { id: 'de_27', front: "Alles wird gut", back: "Everything will be okay", langA: 'de', langB: 'en' },
  { id: 'de_28', front: "Ich freue mich", back: "I am looking forward to it", langA: 'de', langB: 'en' },
  { id: 'de_29', front: "Gute Nacht", back: "Good night", langA: 'de', langB: 'en' },
  { id: 'de_30', front: "Ich lerne Deutsch", back: "I am learning German", langA: 'de', langB: 'en' },
]

const LANG_FLAGS = { en: '🇬🇧', de: '🇩🇪', sw: '🇰🇪' }

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
  // Zufällige Richtung pro Karte
  const addDirection = cards => cards.map(c => ({ ...c, reversed: Math.random() > 0.5 }))
  return addDirection([...shuffle(forced), ...shuffle(due), ...shuffle(newCards)].slice(0, SESSION_SIZE))
}

function checkMastery(allCards, cardProgress, sessionCorrect, sessionTotal) {
  const active = allCards.filter(c => cardProgress[c.id])
  if (active.length < 10) return false
  if (sessionTotal > 0 && sessionCorrect / sessionTotal < 0.6) return false
  const mastered = active.filter(c => (cardProgress[c.id]?.interval || 0) >= 7)
  return mastered.length / active.length >= MASTERY_THRESHOLD
}
function getNextNewCards(allCards, cardProgress, count) {
  return allCards.filter(c => !cardProgress[c.id]).slice(0, count)
}
function getLangStats(allCards, cardProgress, langCode) {
  const cards = allCards.filter(c => c.langA === langCode)
  const active = cards.filter(c => cardProgress[c.id])
  const mastered = active.filter(c => (cardProgress[c.id]?.interval || 0) >= 7)
  return { total: cards.length, active: active.length, mastered: mastered.length }
}

const T = {
  de: {
    hello: 'Hallo', login: 'Mit Google anmelden',
    mySession: '🃏 Meine Session', whereAmI: '🎯 Wo stehe ich?',
    aiChat: '🤖 KI-Gespräch', dailyPhrase: '☀️ Tages-Phrase',
    progressBtn: '📈 Fortschritt', settings: '⚙️ Einstellungen', logout: 'Abmelden',
    myProgress: 'Dein Fortschritt', partnerLearning: 'Elosy lernt gerade',
    notActive: 'Elosy noch nicht aktiv',
    card: 'Karte', of: 'von', showSolution: 'Lösung anzeigen',
    correct: 'Richtig', wrong: 'Falsch', stop: '✕ Beenden',
    stopConfirm: 'Session wirklich beenden?', done: 'Fertig!', back: 'Zurück',
    masteryMsg: '85% gemeistert — 5 neue Karten freigeschaltet!',
    comingSoon: 'Kommt bald', chooseTheme: 'Wähle dein Theme', settingsTitle: 'Einstellungen',
    translate: 'Gesucht', active: 'aktiv von', total: 'gesamt', mastered: 'gemeistert',
  },
  en: {
    hello: 'Hello', login: 'Sign in with Google',
    mySession: '🃏 My session', whereAmI: '🎯 Where do I stand?',
    aiChat: '🤖 AI conversation', dailyPhrase: '☀️ Phrase of the day',
    progressBtn: '📈 Progress', settings: '⚙️ Settings', logout: 'Sign out',
    myProgress: 'Your progress', partnerLearning: 'Mark is learning',
    notActive: 'Mark not active yet',
    card: 'Card', of: 'of', showSolution: 'Show answer',
    correct: 'Correct', wrong: 'Wrong', stop: '✕ Stop',
    stopConfirm: 'Stop this session?', done: 'Done!', back: 'Back',
    masteryMsg: '85% mastered — 5 new cards unlocked!',
    comingSoon: 'Coming soon', chooseTheme: 'Choose your theme', settingsTitle: 'Settings',
    translate: 'Translate to', active: 'active of', total: 'total', mastered: 'mastered',
  }
}

function makeStyles(th) {
  return {
    container: { minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: th.bg },
    homeBox: { textAlign: 'center', padding: '20px', width: '100%', maxWidth: '420px' },
    greeting: { color: th.sub, fontSize: '0.95rem', marginBottom: '2px' },
    title: { color: th.gold, fontSize: 'clamp(1.8rem, 7vw, 2.6rem)', marginBottom: '20px', fontWeight: 'bold' },
    slogan: { color: th.sub, fontSize: '1rem', marginBottom: '32px', lineHeight: '1.8' },
    card: { background: th.card, borderRadius: '12px', padding: '16px', marginBottom: '10px', textAlign: 'left', border: `1px solid ${th.border}` },
    bigCard: { background: th.card, borderRadius: '16px', padding: '28px 20px', marginBottom: '16px', textAlign: 'center', minHeight: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `1px solid ${th.border}` },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', width: '100%' },
    cardLabel: { color: th.sub, fontSize: '0.75rem', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' },
    langRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
    lang: { color: th.text, fontSize: '0.95rem' },
    langPct: { color: th.gold, fontSize: '0.85rem' },
    sub: { color: th.sub },
    noPartner: { color: th.sub, fontSize: '0.85rem', fontStyle: 'italic', margin: 0 },
    cardFront: { color: th.text, fontSize: 'clamp(1.1rem, 4vw, 1.4rem)', marginBottom: '16px', fontWeight: 'bold' },
    cardBack: { color: th.accent, fontSize: 'clamp(0.95rem, 3vw, 1.2rem)', marginBottom: '20px' },
    dirLabel: { fontSize: '0.8rem', color: th.sub, marginBottom: '12px', letterSpacing: '1px' },
    progressBar: { height: '4px', background: th.border, borderRadius: '2px', marginTop: '4px', overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: '2px', transition: 'width 0.5s ease', background: th.accent },
    button: { background: th.gold, color: '#1a1a1a', border: 'none', padding: '13px 28px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold', width: '100%', marginBottom: '8px' },
    menuBtn: { background: th.card, color: th.text, border: `1px solid ${th.border}`, padding: '14px 16px', borderRadius: '10px', fontSize: '0.95rem', cursor: 'pointer', fontWeight: '500', width: '100%', marginBottom: '8px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' },
    menuBtnDisabled: { background: th.card, color: th.sub, border: `1px solid ${th.border}`, padding: '14px 16px', borderRadius: '10px', fontSize: '0.95rem', cursor: 'not-allowed', fontWeight: '400', width: '100%', marginBottom: '8px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.45 },
    menuBtnActive: { background: th.accent + '22', color: th.text, border: `1px solid ${th.accent}`, padding: '14px 16px', borderRadius: '10px', fontSize: '0.95rem', cursor: 'pointer', fontWeight: '500', width: '100%', marginBottom: '8px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' },
    revealBtn: { background: th.border, color: th.text, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' },
    answerRow: { display: 'flex', gap: '10px', width: '100%' },
    wrongBtn: { flex: 1, background: '#f44336', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' },
    rightBtn: { flex: 1, background: '#4CAF50', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' },
    stopBtn: { background: 'transparent', color: '#f44336', border: '1px solid #f44336', padding: '5px 10px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' },
    logoutBtn: { background: 'transparent', color: th.sub, border: `1px solid ${th.border}`, padding: '10px 24px', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer', width: '100%', marginTop: '4px' },
    error: { color: '#ff6b6b', fontSize: '0.85rem', marginTop: '16px' },
    themeRow: { display: 'flex', gap: '8px', marginBottom: '12px' },
    themeBtn: (active, color) => ({ flex: 1, padding: '10px 4px', borderRadius: '8px', border: active ? `2px solid ${color}` : `1px solid ${th.border}`, background: active ? color + '22' : th.card, color: th.text, cursor: 'pointer', fontSize: '0.75rem', fontWeight: active ? 'bold' : 'normal' }),
    backBtn: { background: 'transparent', color: th.sub, border: 'none', padding: '6px 0', fontSize: '0.9rem', cursor: 'pointer', marginBottom: '12px', textAlign: 'left', display: 'block' },
    headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' },
  }
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
    <div style={s.container}>
      <div style={{ textAlign: 'center', padding: '24px' }}>
        <h1 style={s.title}>Vocara</h1>
        <p style={s.slogan}>Die Stimme ist die Brücke.<br /><span style={{ fontSize: '0.85rem' }}>The voice is the bridge.</span></p>
        <button style={s.button} onClick={handleLogin}>Mit Google anmelden / Sign in with Google</button>
        {error && <p style={s.error}>{error}</p>}
      </div>
    </div>
  )
}

function CardScreen({ session, onBack, onFinish, lang, cardProgress, s }) {
  const [index, setIndex] = useState(0)
  const [queue, setQueue] = useState(session)
  const [revealed, setRevealed] = useState(false)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [newProgress, setNewProgress] = useState({ ...cardProgress })
  const startTime = useRef(Date.now())
  const t = T[lang]
  const item = queue[index]
  const isReversed = item.reversed
  const question = isReversed ? item.back : item.front
  const answer = isReversed ? item.front : item.back
  const fromLang = isReversed ? item.langB : item.langA
  const toLang = isReversed ? item.langA : item.langB

  const handleReveal = () => { startTime.current = Date.now(); setRevealed(true) }
  const handleStop = () => { if (window.confirm(t.stopConfirm)) onBack() }

  const handleAnswer = (isCorrect) => {
    const elapsed = (Date.now() - startTime.current) / 1000
    const speed = getSpeed(elapsed)
    const cardId = item.id
    const prev = newProgress[cardId] || { interval: 0, consecutiveFast: 0, wrongSessions: 0 }
    let updatedProgress

    if (!isCorrect) {
      updatedProgress = { ...prev, interval: 0, consecutiveFast: 0, wrongSessions: 3, nextReview: todayStr() }
      setWrong(w => w + 1)
      const newQueue = [...queue]; newQueue.splice(index, 1)
      newQueue.push({ ...item, reversed: Math.random() > 0.5 })
      setQueue(newQueue); setRevealed(false)
      setNewProgress(p => ({ ...p, [cardId]: updatedProgress }))
    } else {
      const newCF = speed === 'very_fast' ? (prev.consecutiveFast || 0) + 1 : 0
      const interval = getNewInterval(speed, { consecutiveFast: newCF })
      updatedProgress = { ...prev, interval, consecutiveFast: newCF, wrongSessions: Math.max(0, (prev.wrongSessions || 0) - 1), nextReview: getNextReview(interval) }
      const finalProgress = { ...newProgress, [cardId]: updatedProgress }
      setNewProgress(finalProgress)
      const newCorrect = correct + 1; setCorrect(newCorrect)
      if (index + 1 >= queue.length) { onFinish(finalProgress, newCorrect, wrong); return }
      setIndex(i => i + 1); setRevealed(false)
    }
  }

  return (
    <div style={s.container}>
      <div style={s.homeBox}>
        <div style={s.cardHeader}>
          <p style={s.greeting}>{t.card} {index + 1} {t.of} {queue.length}</p>
          <button style={s.stopBtn} onClick={handleStop}>{t.stop}</button>
        </div>
        <div style={s.bigCard}>
          <p style={s.dirLabel}>{LANG_FLAGS[fromLang]} → {LANG_FLAGS[toLang]}</p>
          <p style={s.cardFront}>{question}</p>
          {revealed && <p style={s.cardBack}>{answer}</p>}
          {!revealed && <button style={s.revealBtn} onClick={handleReveal}>{t.showSolution}</button>}
          {revealed && (
            <div style={s.answerRow}>
              <button style={s.wrongBtn} onClick={() => handleAnswer(false)}>✗ {t.wrong}</button>
              <button style={s.rightBtn} onClick={() => handleAnswer(true)}>✓ {t.correct}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultScreen({ correct, wrong, masteryUnlocked, t, onBack, s }) {
  return (
    <div style={s.container}>
      <div style={s.homeBox}>
        <h1 style={s.title}>{t.done} 🎉</h1>
        {masteryUnlocked && (
          <div style={{ ...s.card, borderLeft: '3px solid #4CAF50' }}>
            <p style={{ color: '#4CAF50', margin: 0, fontSize: '0.85rem' }}>{t.masteryMsg}</p>
          </div>
        )}
        <div style={s.card}>
          <div style={s.langRow}><span style={s.lang}>{t.correct}</span><span style={{ ...s.langPct, color: '#4CAF50' }}>{correct}</span></div>
          <div style={s.langRow}><span style={s.lang}>{t.wrong}</span><span style={{ ...s.langPct, color: '#f44336' }}>{wrong}</span></div>
        </div>
        <button style={s.button} onClick={onBack}>{t.back}</button>
      </div>
    </div>
  )
}

function SettingsScreen({ t, s, theme, onThemeChange, onBack }) {
  return (
    <div style={s.container}>
      <div style={s.homeBox}>
        <button style={s.backBtn} onClick={onBack}>← {t.back}</button>
        <h1 style={{ ...s.title, marginBottom: '20px' }}>⚙️ {t.settingsTitle}</h1>
        <div style={s.card}>
          <p style={s.cardLabel}>{t.chooseTheme}</p>
          <div style={s.themeRow}>
            {Object.entries(THEMES).map(([key, th]) => (
              <button key={key} style={s.themeBtn(theme === key, th.accent)} onClick={() => onThemeChange(key)}>
                {th.name}
              </button>
            ))}
          </div>
        </div>
        <div style={{ ...s.card, opacity: 0.4 }}>
          <p style={s.cardLabel}>{t.comingSoon}</p>
          <p style={s.noPartner}>Partner • Sprachen • Benachrichtigungen • Stumm-Modus</p>
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, mastered, active, total, s }) {
  const pct = active > 0 ? Math.round((mastered / active) * 100) : 0
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={s.langRow}>
        <span style={{ ...s.lang, fontSize: '0.9rem' }}>{label}</span>
        <span style={{ ...s.langPct, fontSize: '0.8rem' }}>{mastered}/{active} ✓ · {active} / {total}</span>
      </div>
      <div style={s.progressBar}><div style={{ ...s.progressFill, width: `${pct}%` }} /></div>
    </div>
  )
}

function MenuScreen({ user, myData, partnerData, allCards, lang, partnerLabel, onSaveProgress, theme, onThemeChange }) {
  const [screen, setScreen] = useState('menu')
  const [session, setSession] = useState(null)
  const [result, setResult] = useState(null)
  const [masteryUnlocked, setMasteryUnlocked] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)
  const t = T[lang]
  const th = THEMES[theme]; const s = makeStyles(th)
  const firstName = user.displayName?.split(' ')[0] || user.displayName
  const cardProgress = myData?.cardProgress || {}
  const isMarkScreen = lang === 'de'

  const enStats = isMarkScreen ? getLangStats(allCards, cardProgress, 'en') : null
  const swStats = isMarkScreen ? getLangStats(allCards, cardProgress, 'sw') : null
  const deStats = !isMarkScreen ? getLangStats(allCards, cardProgress, 'de') : null
  const partnerProgress = partnerData?.cardProgress || {}
  const partnerMastered = Object.values(partnerProgress).filter(p => (p?.interval || 0) >= 7).length
  const partnerActive = Object.keys(partnerProgress).length

  const startSession = () => {
    const sess = buildSession(allCards, cardProgress)
    setSession(sess); setScreen('cards')
  }

  const handleFinish = async (finalProgress, correct, wrong) => {
    let unlocked = false
    if (checkMastery(allCards, finalProgress, correct, correct + wrong)) {
      const newBatch = getNextNewCards(allCards, finalProgress, NEW_CARDS_BATCH)
      if (newBatch.length > 0) {
        newBatch.forEach(card => { finalProgress[card.id] = { interval: 0, consecutiveFast: 0, wrongSessions: 0, nextReview: todayStr() } })
        unlocked = true
      }
    }
    setMasteryUnlocked(unlocked)
    await onSaveProgress(finalProgress)
    setResult({ correct, wrong }); setScreen('result')
  }

  if (screen === 'cards' && session) return <CardScreen session={session} onBack={() => setScreen('menu')} onFinish={handleFinish} lang={lang} cardProgress={cardProgress} s={s} />
  if (screen === 'result') return <ResultScreen correct={result.correct} wrong={result.wrong} masteryUnlocked={masteryUnlocked} t={t} onBack={() => { setScreen('menu'); setSession(null) }} s={s} />
  if (screen === 'settings') return <SettingsScreen t={t} s={s} theme={theme} onThemeChange={onThemeChange} onBack={() => setScreen('menu')} />

  return (
    <div style={s.container}>
      <div style={s.homeBox}>

        <div style={s.headerRow}>
          <p style={s.greeting}>{t.hello}, {firstName} 👋</p>
          <button style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }} onClick={() => setScreen('settings')}>⚙️</button>
        </div>
        <h1 style={s.title}>Vocara</h1>

        {/* Menü Buttons */}
        <button style={s.menuBtn} onClick={() => alert('Kommt bald!')}>{t.whereAmI} <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: s.sub.color }}>bald</span></button>
        <button style={s.menuBtn} onClick={startSession}>{t.mySession}</button>

        {/* Fortschritt aufklappbar */}
        <button style={progressOpen ? s.menuBtnActive : s.menuBtn} onClick={() => setProgressOpen(o => !o)}>
          {t.progressBtn} <span style={{ marginLeft: 'auto' }}>{progressOpen ? '▲' : '▼'}</span>
        </button>
        {progressOpen && (
          <div style={{ ...s.card, marginTop: '-4px', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
            <p style={s.cardLabel}>{t.myProgress}</p>
            {isMarkScreen ? (
              <>
                <StatRow label="Englisch" mastered={enStats.mastered} active={enStats.active} total={enStats.total} s={s} />
                <StatRow label="Swahili" mastered={swStats.mastered} active={swStats.active} total={swStats.total} s={s} />
              </>
            ) : (
              <StatRow label="Deutsch" mastered={deStats.mastered} active={deStats.active} total={deStats.total} s={s} />
            )}
            <div style={{ ...s.langRow, marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${th.border}` }}>
              <span style={{ ...s.lang, fontSize: '0.85rem' }}>{t.partnerLearning}</span>
              <span style={{ ...s.langPct, fontSize: '0.8rem' }}>{partnerMastered}/{partnerActive} ✓</span>
            </div>
          </div>
        )}

        <button style={s.menuBtnDisabled} disabled>{t.aiChat} <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>bald</span></button>
        <button style={s.menuBtnDisabled} disabled>{t.dailyPhrase} <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>bald</span></button>

        <button style={s.logoutBtn} onClick={() => signOut(auth)}>{t.logout}</button>
      </div>
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [myData, setMyData] = useState(null)
  const [partnerData, setPartnerData] = useState(null)
  const [theme, setTheme] = useState('nairobi')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userRef = doc(db, 'users', u.uid)
        await setDoc(userRef, { name: u.displayName, email: u.email, lastActive: todayStr() }, { merge: true })
        const snap = await getDoc(userRef)
        if (snap.exists()) { const data = snap.data(); setMyData(data); if (data.theme) setTheme(data.theme) }
        const partnerUID = u.uid === MARK_UID ? ELOSY_UID : MARK_UID
        const partnerSnap = await getDoc(doc(db, 'users', partnerUID))
        if (partnerSnap.exists()) setPartnerData(partnerSnap.data())
      }
      setUser(u); setLoading(false)
    })
    return unsubscribe
  }, [])

  const saveProgress = async (finalProgress) => {
    const ref = doc(db, 'users', user.uid)
    await updateDoc(ref, { cardProgress: finalProgress })
    const snap = await getDoc(ref)
    if (snap.exists()) setMyData(snap.data())
  }

  const handleThemeChange = async (newTheme) => {
    setTheme(newTheme)
    if (user) await updateDoc(doc(db, 'users', user.uid), { theme: newTheme })
  }

  const th = THEMES[theme]
  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: th.bg, color: th.text }}>Laden...</div>
  if (!user) return <LoginScreen theme={theme} />

  const isElosy = user.uid === ELOSY_UID
  return (
    <MenuScreen
      user={user} myData={myData} partnerData={partnerData}
      allCards={isElosy ? ALL_ELOSY_CARDS : ALL_MARK_CARDS}
      lang={isElosy ? 'en' : 'de'}
      partnerLabel={isElosy ? 'English' : 'Deutsch'}
      onSaveProgress={saveProgress}
      theme={theme} onThemeChange={handleThemeChange}
    />
  )
}

export default App