import { useState, useEffect } from 'react'
import { auth, db } from './firebase'
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import './App.css'

// ============ KARTEN ============
const MARK_CARDS = [
  { id: 1, front: "What's the catch?", back: "Wo ist der Haken?" },
  { id: 2, front: "Long story short...", back: "Um es kurz zu machen..." },
  { id: 3, front: "I'm down.", back: "Ich bin dabei." },
  { id: 4, front: "I'm heading out.", back: "Ich mache mich auf den Weg." },
  { id: 5, front: "Give me a heads up.", back: "Gib mir kurz Bescheid." },
  { id: 6, front: "I'm on it.", back: "Ich kümmere mich darum." },
  { id: 7, front: "Never mind.", back: "Vergiss es. / Schon gut." },
  { id: 8, front: "Take care!", back: "Pass auf dich auf!" },
  { id: 9, front: "Keep me posted.", back: "Halt mich auf dem Laufenden." },
  { id: 10, front: "It's up to you.", back: "Es liegt an dir." },
  { id: 11, front: "My bad.", back: "Mein Fehler." },
  { id: 12, front: "No way!", back: "Auf keinen Fall!" },
  { id: 13, front: "Hang in there.", back: "Halte durch." },
  { id: 14, front: "Piece of cake!", back: "Ein Kinderspiel!" },
  { id: 15, front: "No biggie.", back: "Kein Ding." },
]

const ELOSY_CARDS = [
  { id: 1, front: "Guten Morgen", back: "Good morning" },
  { id: 2, front: "Guten Abend", back: "Good evening" },
  { id: 3, front: "Wie geht es dir?", back: "How are you?" },
  { id: 4, front: "Danke schön", back: "Thank you very much" },
  { id: 5, front: "Bitte", back: "Please / You're welcome" },
  { id: 6, front: "Ich liebe dich", back: "I love you" },
  { id: 7, front: "Ich vermisse dich", back: "I miss you" },
  { id: 8, front: "Bis bald", back: "See you soon" },
  { id: 9, front: "Ich bin müde", back: "I am tired" },
  { id: 10, front: "Ich bin glücklich", back: "I am happy" },
  { id: 11, front: "Was machst du?", back: "What are you doing?" },
  { id: 12, front: "Ich denke an dich", back: "I am thinking of you" },
  { id: 13, front: "Schlaf gut", back: "Sleep well" },
  { id: 14, front: "Ich komme bald", back: "I am coming soon" },
  { id: 15, front: "Du fehlst mir", back: "I miss you (deeply)" },
]

// ============ LOGIN ============
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
        <p style={styles.slogan}>Die Stimme ist die Brücke.</p>
        <button style={styles.button} onClick={handleLogin}>Mit Google anmelden</button>
        {error && <p style={styles.error}>{error}</p>}
      </div>
    </div>
  )
}

// ============ KARTEN-SCREEN ============
function CardScreen({ cards, onBack, label }) {
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [done, setDone] = useState(false)

  const card = cards[index]

  const handleAnswer = (isCorrect) => {
    if (isCorrect) setCorrect(c => c + 1)
    else setWrong(w => w + 1)
    if (index + 1 >= cards.length) {
      setDone(true)
    } else {
      setIndex(i => i + 1)
      setRevealed(false)
    }
  }

  if (done) return (
    <div style={styles.container}>
      <div style={styles.homeBox}>
        <h1 style={styles.title}>Session fertig! 🎉</h1>
        <div style={styles.card}>
          <div style={styles.langRow}>
            <span style={styles.lang}>Richtig</span>
            <span style={{...styles.langPct, color: '#4CAF50'}}>{correct}</span>
          </div>
          <div style={styles.langRow}>
            <span style={styles.lang}>Falsch</span>
            <span style={{...styles.langPct, color: '#f44336'}}>{wrong}</span>
          </div>
        </div>
        <button style={styles.button} onClick={onBack}>Zurück zum Menü</button>
      </div>
    </div>
  )

  return (
    <div style={styles.container}>
      <div style={styles.homeBox}>
        <p style={styles.greeting}>{label} — Karte {index + 1} von {cards.length}</p>
        <div style={styles.bigCard}>
          <p style={styles.cardFront}>{card.front}</p>
          {revealed && <p style={styles.cardBack}>{card.back}</p>}
          {!revealed && (
            <button style={styles.revealBtn} onClick={() => setRevealed(true)}>
              Lösung anzeigen
            </button>
          )}
          {revealed && (
            <div style={styles.answerRow}>
              <button style={styles.wrongBtn} onClick={() => handleAnswer(false)}>✗ Falsch</button>
              <button style={styles.rightBtn} onClick={() => handleAnswer(true)}>✓ Richtig</button>
            </div>
          )}
        </div>
        <button style={styles.logoutBtn} onClick={onBack}>Abbrechen</button>
      </div>
    </div>
  )
}

// ============ HOME ============
function HomeScreen({ user, partnerData }) {
  const [screen, setScreen] = useState('home')
  const firstName = user.displayName?.split(' ')[0] || 'Mark'

  if (screen === 'mark') return <CardScreen cards={MARK_CARDS} label="Englisch" onBack={() => setScreen('home')} />
  if (screen === 'elosy') return <CardScreen cards={ELOSY_CARDS} label="Elosys Deutsch" onBack={() => setScreen('home')} />

  return (
    <div style={styles.container}>
      <div style={styles.homeBox}>
        <p style={styles.greeting}>Hallo, {firstName} 👋</p>
        <h1 style={styles.title}>Vocara</h1>

        <div style={styles.card}>
          <p style={styles.cardLabel}>Deine Sprachen</p>
          <div style={styles.langRow}>
            <span style={styles.lang}>Englisch</span>
            <span style={styles.langPct}>80%</span>
          </div>
          <div style={styles.langRow}>
            <span style={styles.lang}>Swahili</span>
            <span style={styles.langPct}>20%</span>
          </div>
        </div>

        <div style={styles.card}>
          <p style={styles.cardLabel}>Elosy lernt gerade</p>
          {partnerData ? (
            <div style={styles.langRow}>
              <span style={styles.lang}>Deutsch</span>
              <span style={styles.langPct}>{partnerData.cardsLearned || 0} Karten</span>
            </div>
          ) : (
            <p style={styles.noPartner}>Elosy noch nicht angemeldet</p>
          )}
        </div>

        <button style={styles.button} onClick={() => setScreen('mark')}>
          Meine Karten lernen
        </button>
        <button style={{...styles.button, background: '#555', marginBottom: '12px'}} onClick={() => setScreen('elosy')}>
          Elosys Karten ansehen
        </button>
        <button style={styles.logoutBtn} onClick={() => signOut(auth)}>Abmelden</button>
      </div>
    </div>
  )
}

// ============ APP ============
function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [partnerData, setPartnerData] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        await setDoc(doc(db, 'users', u.uid), {
          name: u.displayName,
          email: u.email,
          lastActive: new Date().toLocaleDateString('de-DE'),
        }, { merge: true })
        const partnerSnap = await getDoc(doc(db, 'users', 'elosy-placeholder'))
        if (partnerSnap.exists()) setPartnerData(partnerSnap.data())
      }
      setUser(u)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  if (loading) return <div style={styles.center}>Laden...</div>
  if (!user) return <LoginScreen />
  return <HomeScreen user={user} partnerData={partnerData} />
}

const styles = {
  container: { minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a' },
  center: { color: '#fff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' },
  loginBox: { textAlign: 'center', padding: '24px' },
  homeBox: { textAlign: 'center', padding: '24px', width: '100%', maxWidth: '420px' },
  greeting: { color: '#aaa', fontSize: '1rem', marginBottom: '4px' },
  title: { color: '#D4AF37', fontSize: 'clamp(2rem, 8vw, 3rem)', marginBottom: '24px', fontWeight: 'bold' },
  slogan: { color: '#aaa', fontSize: '1.1rem', marginBottom: '40px' },
  card: { background: '#2a2a2a', borderRadius: '12px', padding: '20px', marginBottom: '16px', textAlign: 'left' },
  bigCard: { background: '#2a2a2a', borderRadius: '16px', padding: '32px 24px', marginBottom: '20px', textAlign: 'center', minHeight: '200px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  cardLabel: { color: '#aaa', fontSize: '0.8rem', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' },
  langRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  lang: { color: '#fff', fontSize: '1rem' },
  langPct: { color: '#D4AF37', fontSize: '0.9rem' },
  noPartner: { color: '#555', fontSize: '0.9rem', fontStyle: 'italic' },
  cardFront: { color: '#fff', fontSize: 'clamp(1.1rem, 4vw, 1.5rem)', marginBottom: '20px', fontWeight: 'bold' },
  cardBack: { color: '#D4AF37', fontSize: 'clamp(1rem, 3vw, 1.3rem)', marginBottom: '24px' },
  button: { background: '#D4AF37', color: '#1a1a1a', border: 'none', padding: '14px 32px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold', width: '100%', marginBottom: '12px' },
  revealBtn: { background: '#333', color: '#fff', border: 'none', padding: '12px 28px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' },
  answerRow: { display: 'flex', gap: '12px', width: '100%' },
  wrongBtn: { flex: 1, background: '#f44336', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' },
  rightBtn: { flex: 1, background: '#4CAF50', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' },
  logoutBtn: { background: 'transparent', color: '#666', border: '1px solid #333', padding: '10px 24px', borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer', width: '100%' },
  error: { color: '#ff6b6b', fontSize: '0.85rem', marginTop: '20px' }
}

export default App