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

const ALL_MARK_CARDS = [
  { id: 'en_1', front: "What's the catch?", back: "Wo ist der Haken?", lang: 'en' },
  { id: 'en_2', front: "Long story short...", back: "Um es kurz zu machen...", lang: 'en' },
  { id: 'en_3', front: "I'm down.", back: "Ich bin dabei.", lang: 'en' },
  { id: 'en_4', front: "I'm heading out.", back: "Ich mache mich auf den Weg.", lang: 'en' },
  { id: 'en_5', front: "Give me a heads up.", back: "Gib mir kurz Bescheid.", lang: 'en' },
  { id: 'en_6', front: "I'm on it.", back: "Ich kümmere mich darum.", lang: 'en' },
  { id: 'en_7', front: "I'm devastated.", back: "Ich bin am Boden zerstört.", lang: 'en' },
  { id: 'en_8', front: "Never mind.", back: "Vergiss es. / Schon gut.", lang: 'en' },
  { id: 'en_9', front: "I'm on my way.", back: "Ich bin unterwegs.", lang: 'en' },
  { id: 'en_10', front: "What's going on?", back: "Was ist hier los?", lang: 'en' },
  { id: 'en_11', front: "To be honest...", back: "Um ehrlich zu sein...", lang: 'en' },
  { id: 'en_12', front: "Take care!", back: "Pass auf dich auf!", lang: 'en' },
  { id: 'en_13', front: "Keep me posted.", back: "Halt mich auf dem Laufenden.", lang: 'en' },
  { id: 'en_14', front: "I'll let you know.", back: "Ich gebe dir Bescheid.", lang: 'en' },
  { id: 'en_15', front: "It's up to you.", back: "Es liegt an dir.", lang: 'en' },
  { id: 'en_16', front: "I'll keep you posted.", back: "Ich halte dich auf dem Laufenden.", lang: 'en' },
  { id: 'en_17', front: "Make up your mind!", back: "Entscheide dich!", lang: 'en' },
  { id: 'en_18', front: "I'm literally starving!", back: "Ich habe Riesenhunger!", lang: 'en' },
  { id: 'en_19', front: "For real?", back: "Echt jetzt? / Im Ernst?", lang: 'en' },
  { id: 'en_20', front: "Piece of cake!", back: "Ein Kinderspiel!", lang: 'en' },
  { id: 'en_21', front: "No biggie.", back: "Kein Ding.", lang: 'en' },
  { id: 'en_22', front: "My bad.", back: "Mein Fehler.", lang: 'en' },
  { id: 'en_23', front: "No way!", back: "Auf keinen Fall!", lang: 'en' },
  { id: 'en_24', front: "Make it clear.", back: "Mach es unmissverständlich klar.", lang: 'en' },
  { id: 'en_25', front: "Let's make up.", back: "Lass uns uns versöhnen.", lang: 'en' },
  { id: 'en_26', front: "Bear with me.", back: "Hab Geduld mit mir.", lang: 'en' },
  { id: 'en_27', front: "Cut it out!", back: "Hör auf damit!", lang: 'en' },
  { id: 'en_28', front: "Hang in there.", back: "Halte durch.", lang: 'en' },
  { id: 'en_29', front: "Actually", back: "Eigentlich / Tatsächlich", lang: 'en' },
  { id: 'en_30', front: "Basically", back: "Im Grunde / Grundsätzlich", lang: 'en' },
  { id: 'en_31', front: "Eventually", back: "Schließlich / Irgendwann", lang: 'en' },
  { id: 'en_32', front: "Probably", back: "Wahrscheinlich", lang: 'en' },
  { id: 'en_33', front: "Definitely", back: "Definitiv / Auf jeden Fall", lang: 'en' },
  { id: 'en_34', front: "Anyway", back: "Wie auch immer / Jedenfalls", lang: 'en' },
  { id: 'en_35', front: "Exactly", back: "Genau / Exakt", lang: 'en' },
  { id: 'en_36', front: "My treat.", back: "Ich lade dich ein.", lang: 'en' },
  { id: 'en_37', front: "No cap.", back: "Kein Witz / Ungelogen.", lang: 'en' },
  { id: 'en_38', front: "Under the weather.", back: "Kränklich / Nicht auf der Höhe.", lang: 'en' },
  { id: 'en_39', front: "Break a leg!", back: "Hals- und Beinbruch!", lang: 'en' },
  { id: 'en_40', front: "That's a bummer.", back: "Das ist schade / blöd.", lang: 'en' },
  { id: 'en_41', front: "I'm swamped.", back: "Ich bin total überlastet.", lang: 'en' },
  { id: 'en_42', front: "Hit me up.", back: "Meld dich bei mir.", lang: 'en' },
  { id: 'en_43', front: "It's not my cup of tea.", back: "Das ist nicht mein Ding.", lang: 'en' },
  { id: 'sw_1', front: "Jambo", back: "Hallo (Aussprache: DSHAM-bo)", lang: 'sw' },
  { id: 'sw_2', front: "Asante", back: "Danke (Aussprache: ah-SAHN-teh)", lang: 'sw' },
  { id: 'sw_3', front: "Hapana", back: "Nein (Aussprache: ha-PAH-na)", lang: 'sw' },
  { id: 'sw_4', front: "Ndiyo", back: "Ja (Aussprache: NDI-yo)", lang: 'sw' },
  { id: 'sw_5', front: "Tafadhali", back: "Bitte (Aussprache: ta-fad-HA-li)", lang: 'sw' },
  { id: 'sw_6', front: "Habari yako?", back: "Wie geht es dir? (Aussprache: ha-BAH-ri YAH-ko)", lang: 'sw' },
  { id: 'sw_7', front: "Anakuja", back: "Er/Sie kommt (Aussprache: a-na-KU-ja)", lang: 'sw' },
  { id: 'sw_8', front: "Ninakuja", back: "Ich komme (Aussprache: ni-na-KU-ja)", lang: 'sw' },
  { id: 'sw_9', front: "Nakuja", back: "Ich komme – Kurzform (Aussprache: na-KU-ja)", lang: 'sw' },
  { id: 'sw_10', front: "Nipee", back: "Gib mir (Aussprache: ni-PEH-eh)", lang: 'sw' },
  { id: 'sw_11', front: "Sitaki", back: "Ich will nicht (Aussprache: si-TAH-ki)", lang: 'sw' },
  { id: 'sw_12', front: "Chakula", back: "Essen (Aussprache: cha-KU-la)", lang: 'sw' },
  { id: 'sw_13', front: "Sahani", back: "Teller (Aussprache: sa-HA-ni)", lang: 'sw' },
  { id: 'sw_14', front: "Ninakupenda", back: "Ich liebe dich (Aussprache: ni-na-ku-PEN-da)", lang: 'sw' },
  { id: 'sw_15', front: "Nakukosa", back: "Ich vermisse dich (Aussprache: na-ku-KO-sa)", lang: 'sw' },
  { id: 'sw_16', front: "Lala salama", back: "Schlaf gut (Aussprache: LA-la sa-LA-ma)", lang: 'sw' },
]

const ALL_ELOSY_CARDS = [
  { id: 'de_1', front: "Guten Morgen", back: "Good morning", lang: 'de' },
  { id: 'de_2', front: "Guten Abend", back: "Good evening", lang: 'de' },
  { id: 'de_3', front: "Wie geht es dir?", back: "How are you?", lang: 'de' },
  { id: 'de_4', front: "Danke schön", back: "Thank you very much", lang: 'de' },
  { id: 'de_5', front: "Bitte", back: "Please / You're welcome", lang: 'de' },
  { id: 'de_6', front: "Ich liebe dich", back: "I love you", lang: 'de' },
  { id: 'de_7', front: "Ich vermisse dich", back: "I miss you", lang: 'de' },
  { id: 'de_8', front: "Bis bald", back: "See you soon", lang: 'de' },
  { id: 'de_9', front: "Ich bin müde", back: "I am tired", lang: 'de' },
  { id: 'de_10', front: "Ich bin glücklich", back: "I am happy", lang: 'de' },
  { id: 'de_11', front: "Was machst du?", back: "What are you doing?", lang: 'de' },
  { id: 'de_12', front: "Ich denke an dich", back: "I am thinking of you", lang: 'de' },
  { id: 'de_13', front: "Schlaf gut", back: "Sleep well", lang: 'de' },
  { id: 'de_14', front: "Ich komme bald", back: "I am coming soon", lang: 'de' },
  { id: 'de_15', front: "Du fehlst mir", back: "I miss you (deeply)", lang: 'de' },
  { id: 'de_16', front: "Entschuldigung", back: "Sorry / Excuse me", lang: 'de' },
  { id: 'de_17', front: "Ich verstehe nicht", back: "I don't understand", lang: 'de' },
  { id: 'de_18', front: "Kannst du das wiederholen?", back: "Can you repeat that?", lang: 'de' },
  { id: 'de_19', front: "Wie heißt du?", back: "What is your name?", lang: 'de' },
  { id: 'de_20', front: "Ich heiße...", back: "My name is...", lang: 'de' },
  { id: 'de_21', front: "Woher kommst du?", back: "Where are you from?", lang: 'de' },
  { id: 'de_22', front: "Ich komme aus Kenia", back: "I come from Kenya", lang: 'de' },
  { id: 'de_23', front: "Wie spät ist es?", back: "What time is it?", lang: 'de' },
  { id: 'de_24', front: "Ich bin hungrig", back: "I am hungry", lang: 'de' },
  { id: 'de_25', front: "Das ist lecker", back: "That is delicious", lang: 'de' },
  { id: 'de_26', front: "Ich bin stolz auf dich", back: "I am proud of you", lang: 'de' },
  { id: 'de_27', front: "Alles wird gut", back: "Everything will be okay", lang: 'de' },
  { id: 'de_28', front: "Ich freue mich", back: "I am looking forward to it", lang: 'de' },
  { id: 'de_29', front: "Gute Nacht", back: "Good night", lang: 'de' },
  { id: 'de_30', front: "Ich lerne Deutsch", back: "I am learning German", lang: 'de' },
]

function getSpeed(seconds) {
  if (seconds < VERY_FAST_S) return 'very_fast'
  if (seconds < FAST_S) return 'fast'
  if (seconds < MEDIUM_S) return 'medium'
  return 'slow'
}

function getNewInterval(speed, progress) {
  const cf = progress?.consecutiveFast || 0
  if (speed === 'very_fast') {
    if (cf >= 3) return 30
    if (cf >= 2) return 15
    return 7
  }
  if (speed === 'fast') return 5
  if (speed === 'medium') return 2
  return 1
}

function getNextReview(intervalDays) {
  const d = new Date()
  d.setDate(d.getDate() + intervalDays)
  return d.toISOString().split('T')[0]
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function buildSession(allCards, cardProgress) {
  const today = todayStr()
  const forced = []
  const due = []
  const newCards = []
  allCards.forEach(card => {
    const p = cardProgress[card.id]
    if (!p) newCards.push(card)
    else if (p.wrongSessions > 0) forced.push(card)
    else if (p.nextReview <= today) due.push(card)
  })
  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)
  return [...shuffle(forced), ...shuffle(due), ...shuffle(newCards)].slice(0, SESSION_SIZE)
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
  const cards = allCards.filter(c => c.lang === langCode)
  const active = cards.filter(c => cardProgress[c.id])
  const mastered = active.filter(c => (cardProgress[c.id]?.interval || 0) >= 7)
  return { total: cards.length, active: active.length, mastered: mastered.length }
}

const T = {
  de: {
    hello: 'Hallo', slogan: 'Die Stimme ist die Brücke.', login: 'Mit Google anmelden',
    myProgress: 'Dein Fortschritt', partnerLearning: 'Elosy lernt gerade',
    notActive: 'Elosy noch nicht aktiv', myCards: 'Lernen starten',
    logout: 'Abmelden', card: 'Karte', of: 'von', showSolution: 'Lösung anzeigen',
    correct: 'Richtig', wrong: 'Falsch', stop: '✕ Beenden',
    stopConfirm: 'Session wirklich beenden?', done: 'Fertig!', back: 'Zurück',
    masteryMsg: '85% gemeistert — 5 neue Karten freigeschaltet!',
    mastered: 'Gemeistert', active: 'Aktiv', total: 'Gesamt',
  },
  en: {
    hello: 'Hello', slogan: 'The voice is the bridge.', login: 'Sign in with Google',
    myProgress: 'Your progress', partnerLearning: 'Mark is learning',
    notActive: 'Mark not active yet', myCards: 'Start learning',
    logout: 'Sign out', card: 'Card', of: 'of', showSolution: 'Show answer',
    correct: 'Correct', wrong: 'Wrong', stop: '✕ Stop',
    stopConfirm: 'Stop this session?', done: 'Done!', back: 'Back',
    masteryMsg: '85% mastered — 5 new cards unlocked!',
    mastered: 'Mastered', active: 'Active', total: 'Total',
  }
}

function LoginScreen() {
  const [error, setError] = useState(null)
  const handleLogin = async () => {
    setError(null)
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    try { await signInWithPopup(auth, provider) }
    catch (err) { setError(err.message) }
  }
  return (
    <div style={styles.container}>
      <div style={styles.loginBox}>
        <h1 style={styles.title}>Vocara</h1>
        <p style={styles.slogan}>Die Stimme ist die Brücke.<br /><span style={{ fontSize: '0.9rem' }}>The voice is the bridge.</span></p>
        <button style={styles.button} onClick={handleLogin}>Mit Google anmelden / Sign in with Google</button>
        {error && <p style={styles.error}>{error}</p>}
      </div>
    </div>
  )
}

function CardScreen({ session, onBack, onFinish, label, userUid, lang, cardProgress }) {
  const [index, setIndex] = useState(0)
  const [queue, setQueue] = useState(session)
  const [revealed, setRevealed] = useState(false)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [newProgress, setNewProgress] = useState({ ...cardProgress })
  const startTime = useRef(Date.now())
  const t = T[lang]
  const card = queue[index]

  const handleReveal = () => {
    startTime.current = Date.now()
    setRevealed(true)
  }

  const handleStop = () => {
    if (window.confirm(t.stopConfirm)) onBack()
  }

  const handleAnswer = async (isCorrect) => {
    const elapsed = (Date.now() - startTime.current) / 1000
    const speed = getSpeed(elapsed)
    const cardId = card.id
    const prev = newProgress[cardId] || { interval: 0, consecutiveFast: 0, wrongSessions: 0 }
    let updatedProgress

    if (!isCorrect) {
      updatedProgress = { ...prev, interval: 0, consecutiveFast: 0, wrongSessions: 3, nextReview: todayStr() }
      setWrong(w => w + 1)
      const newQueue = [...queue]
      newQueue.splice(index, 1)
      newQueue.push(card)
      setQueue(newQueue)
      setRevealed(false)
    } else {
      const newCF = speed === 'very_fast' ? (prev.consecutiveFast || 0) + 1 : 0
      const interval = getNewInterval(speed, { consecutiveFast: newCF })
      updatedProgress = {
        ...prev, interval, consecutiveFast: newCF,
        wrongSessions: Math.max(0, (prev.wrongSessions || 0) - 1),
        nextReview: getNextReview(interval),
      }
      const finalProgress = { ...newProgress, [cardId]: updatedProgress }
      setNewProgress(finalProgress)
      const newCorrect = correct + 1
      setCorrect(newCorrect)
      if (index + 1 >= queue.length) {
        onFinish(finalProgress, newCorrect, wrong)
        return
      }
      setIndex(i => i + 1)
      setRevealed(false)
      return
    }
    setNewProgress(p => ({ ...p, [cardId]: updatedProgress }))
  }

  return (
    <div style={styles.container}>
      <div style={styles.homeBox}>
        <div style={styles.cardHeader}>
          <p style={styles.greeting}>{label} — {t.card} {index + 1} {t.of} {queue.length}</p>
          <button style={styles.stopBtn} onClick={handleStop}>{t.stop}</button>
        </div>
        <div style={styles.bigCard}>
          <p style={styles.cardFront}>{card.front}</p>
          {revealed && <p style={styles.cardBack}>{card.back}</p>}
          {!revealed && <button style={styles.revealBtn} onClick={handleReveal}>{t.showSolution}</button>}
          {revealed && (
            <div style={styles.answerRow}>
              <button style={styles.wrongBtn} onClick={() => handleAnswer(false)}>✗ {t.wrong}</button>
              <button style={styles.rightBtn} onClick={() => handleAnswer(true)}>✓ {t.correct}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultScreen({ correct, wrong, masteryUnlocked, t, onBack }) {
  return (
    <div style={styles.container}>
      <div style={styles.homeBox}>
        <h1 style={styles.title}>{t.done} 🎉</h1>
        {masteryUnlocked && (
          <div style={{ ...styles.card, borderLeft: '3px solid #4CAF50' }}>
            <p style={{ color: '#4CAF50', margin: 0, fontSize: '0.95rem' }}>{t.masteryMsg}</p>
          </div>
        )}
        <div style={styles.card}>
          <div style={styles.langRow}>
            <span style={styles.lang}>{t.correct}</span>
            <span style={{ ...styles.langPct, color: '#4CAF50' }}>{correct}</span>
          </div>
          <div style={styles.langRow}>
            <span style={styles.lang}>{t.wrong}</span>
            <span style={{ ...styles.langPct, color: '#f44336' }}>{wrong}</span>
          </div>
        </div>
        <button style={styles.button} onClick={onBack}>{t.back}</button>
      </div>
    </div>
  )
}

function StatRow({ label, mastered, active, total, color }) {
  const pct = active > 0 ? Math.round((mastered / active) * 100) : 0
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={styles.langRow}>
        <span style={{ color: '#fff', fontSize: '0.95rem', fontWeight: 'bold' }}>{label}</span>
        <span style={{ color: color || '#D4AF37', fontSize: '0.85rem' }}>{mastered} / {active} gemeistert</span>
      </div>
      <div style={styles.progressBar}>
        <div style={{ ...styles.progressFill, width: `${pct}%`, background: color || '#4CAF50' }} />
      </div>
      <p style={{ color: '#555', fontSize: '0.75rem', marginTop: '4px' }}>{active} aktiv von {total} gesamt</p>
    </div>
  )
}

function HomeScreen({ user, myData, partnerData, allCards, lang, partnerLabel, onSaveProgress }) {
  const [screen, setScreen] = useState('home')
  const [session, setSession] = useState(null)
  const [result, setResult] = useState(null)
  const [masteryUnlocked, setMasteryUnlocked] = useState(false)
  const t = T[lang]
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
    const s = buildSession(allCards, cardProgress)
    setSession(s)
    setScreen('cards')
  }

  const handleFinish = async (finalProgress, correct, wrong) => {
    let unlocked = false
    if (checkMastery(allCards, finalProgress, correct, correct + wrong)) {
      const newBatch = getNextNewCards(allCards, finalProgress, NEW_CARDS_BATCH)
      if (newBatch.length > 0) {
        newBatch.forEach(card => {
          finalProgress[card.id] = { interval: 0, consecutiveFast: 0, wrongSessions: 0, nextReview: todayStr() }
        })
        unlocked = true
      }
    }
    setMasteryUnlocked(unlocked)
    await onSaveProgress(finalProgress)
    setResult({ correct, wrong })
    setScreen('result')
  }

  if (screen === 'cards' && session) {
    return <CardScreen
      session={session}
      onBack={() => setScreen('home')}
      onFinish={handleFinish}
      label={isMarkScreen ? 'Englisch / Swahili' : 'Deutsch'}
      userUid={user.uid}
      lang={lang}
      cardProgress={cardProgress}
    />
  }

  if (screen === 'result') {
    return <ResultScreen
      correct={result.correct}
      wrong={result.wrong}
      masteryUnlocked={masteryUnlocked}
      t={t}
      onBack={() => { setScreen('home'); setSession(null) }}
    />
  }

  return (
    <div style={styles.container}>
      <div style={styles.homeBox}>
        <p style={styles.greeting}>{t.hello}, {firstName} 👋</p>
        <h1 style={styles.title}>Vocara</h1>

        <div style={styles.card}>
          <p style={styles.cardLabel}>{t.myProgress}</p>
          {isMarkScreen ? (
            <>
              <StatRow label="Englisch" mastered={enStats.mastered} active={enStats.active} total={enStats.total} color="#D4AF37" />
              <StatRow label="Swahili" mastered={swStats.mastered} active={swStats.active} total={swStats.total} color="#E8873A" />
            </>
          ) : (
            <StatRow label="Deutsch" mastered={deStats.mastered} active={deStats.active} total={deStats.total} color="#D4AF37" />
          )}
        </div>

        <div style={styles.card}>
          <p style={styles.cardLabel}>{t.partnerLearning}</p>
          {partnerData ? (
            <div style={styles.langRow}>
              <span style={styles.lang}>{partnerLabel}</span>
              <span style={styles.langPct}>{partnerMastered} / {partnerActive} ✓</span>
            </div>
          ) : (
            <p style={styles.noPartner}>{t.notActive}</p>
          )}
        </div>

        <button style={styles.button} onClick={startSession}>{t.myCards}</button>
        <button style={styles.logoutBtn} onClick={() => signOut(auth)}>{t.logout}</button>
      </div>
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [myData, setMyData] = useState(null)
  const [partnerData, setPartnerData] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userRef = doc(db, 'users', u.uid)
        await setDoc(userRef, { name: u.displayName, email: u.email, lastActive: todayStr() }, { merge: true })
        const snap = await getDoc(userRef)
        if (snap.exists()) setMyData(snap.data())
        const partnerUID = u.uid === MARK_UID ? ELOSY_UID : MARK_UID
        const partnerSnap = await getDoc(doc(db, 'users', partnerUID))
        if (partnerSnap.exists()) setPartnerData(partnerSnap.data())
      }
      setUser(u)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const saveProgress = async (finalProgress) => {
    const ref = doc(db, 'users', user.uid)
    await updateDoc(ref, { cardProgress: finalProgress })
    const snap = await getDoc(ref)
    if (snap.exists()) setMyData(snap.data())
  }

  if (loading) return <div style={styles.center}>Laden...</div>
  if (!user) return <LoginScreen />

  const isElosy = user.uid === ELOSY_UID
  return (
    <HomeScreen
      user={user}
      myData={myData}
      partnerData={partnerData}
      allCards={isElosy ? ALL_ELOSY_CARDS : ALL_MARK_CARDS}
      lang={isElosy ? 'en' : 'de'}
      partnerLabel={isElosy ? 'English' : 'Deutsch'}
      onSaveProgress={saveProgress}
    />
  )
}

const styles = {
  container: { minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a' },
  center: { color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' },
  loginBox: { textAlign: 'center', padding: '24px' },
  homeBox: { textAlign: 'center', padding: '24px', width: '100%', maxWidth: '420px' },
  greeting: { color: '#aaa', fontSize: '1rem', marginBottom: '4px' },
  title: { color: '#D4AF37', fontSize: 'clamp(2rem, 8vw, 3rem)', marginBottom: '24px', fontWeight: 'bold' },
  slogan: { color: '#aaa', fontSize: '1.1rem', marginBottom: '40px', lineHeight: '1.8' },
  card: { background: '#2a2a2a', borderRadius: '12px', padding: '20px', marginBottom: '16px', textAlign: 'left' },
  bigCard: { background: '#2a2a2a', borderRadius: '16px', padding: '32px 24px', marginBottom: '20px', textAlign: 'center', minHeight: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', width: '100%' },
  cardLabel: { color: '#aaa', fontSize: '0.8rem', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' },
  langRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  lang: { color: '#fff', fontSize: '1rem' },
  langPct: { color: '#D4AF37', fontSize: '0.9rem' },
  noPartner: { color: '#555', fontSize: '0.9rem', fontStyle: 'italic' },
  cardFront: { color: '#fff', fontSize: 'clamp(1.1rem, 4vw, 1.5rem)', marginBottom: '20px', fontWeight: 'bold' },
  cardBack: { color: '#D4AF37', fontSize: 'clamp(1rem, 3vw, 1.3rem)', marginBottom: '24px' },
  progressBar: { height: '5px', background: '#333', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: '3px', transition: 'width 0.5s ease' },
  button: { background: '#D4AF37', color: '#1a1a1a', border: 'none', padding: '14px 32px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold', width: '100%', marginBottom: '12px' },
  revealBtn: { background: '#333', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' },
  answerRow: { display: 'flex', gap: '12px', width: '100%' },
  wrongBtn: { flex: 1, background: '#f44336', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' },
  rightBtn: { flex: 1, background: '#4CAF50', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' },
  stopBtn: { background: 'transparent', color: '#f44336', border: '1px solid #f44336', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' },
  logoutBtn: { background: 'transparent', color: '#666', border: '1px solid #333', padding: '10px 24px', borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer', width: '100%' },
  error: { color: '#ff6b6b', fontSize: '0.85rem', marginTop: '20px' }
}

export default App