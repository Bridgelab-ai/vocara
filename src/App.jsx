import { useState, useEffect } from 'react'
import { auth, db } from './firebase'
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore'
import './App.css'

function LoginScreen() {
  const [error, setError] = useState(null)

  const handleLogin = async () => {
    setError(null)
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    try {
      await signInWithPopup(auth, provider)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.loginBox}>
        <h1 style={styles.title}>Vocara</h1>
        <p style={styles.slogan}>Die Stimme ist die Brücke.</p>
        <button style={styles.button} onClick={handleLogin}>
          Mit Google anmelden
        </button>
        {error && <p style={styles.error}>{error}</p>}
      </div>
    </div>
  )
}

function HomeScreen({ user, partnerData }) {
  const firstName = user.displayName?.split(' ')[0] || 'Mark'

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
            <>
              <div style={styles.langRow}>
                <span style={styles.lang}>Deutsch</span>
                <span style={styles.langPct}>{partnerData.cardsLearned || 0} Karten</span>
              </div>
              <div style={styles.langRow}>
                <span style={styles.lang}>Zuletzt aktiv</span>
                <span style={styles.langPct}>{partnerData.lastActive || '—'}</span>
              </div>
            </>
          ) : (
            <p style={styles.noPartner}>Elosy noch nicht angemeldet</p>
          )}
        </div>

        <button style={styles.button} onClick={() => alert('Karten kommen als nächstes!')}>
          Lernen starten
        </button>

        <button style={styles.logoutBtn} onClick={() => signOut(auth)}>
          Abmelden
        </button>
      </div>
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [partnerData, setPartnerData] = useState(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Nutzerprofil in Firestore anlegen/aktualisieren
        await setDoc(doc(db, 'users', u.uid), {
          name: u.displayName,
          email: u.email,
          lastActive: new Date().toLocaleDateString('de-DE'),
        }, { merge: true })

        // Elosys Profil live beobachten (wird gefunden sobald sie sich anmeldet)
        const partnerRef = doc(db, 'users', 'elosy-placeholder')
        const partnerSnap = await getDoc(partnerRef)
        if (partnerSnap.exists()) {
          setPartnerData(partnerSnap.data())
        }
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
  homeBox: { textAlign: 'center', padding: '24px', width: '100%', maxWidth: '400px' },
  greeting: { color: '#aaa', fontSize: '1rem', marginBottom: '4px' },
  title: { color: '#D4AF37', fontSize: 'clamp(2rem, 8vw, 3rem)', marginBottom: '32px', fontWeight: 'bold' },
  slogan: { color: '#aaa', fontSize: 'clamp(0.9rem, 3vw, 1.1rem)', marginBottom: '40px' },
  card: { background: '#2a2a2a', borderRadius: '12px', padding: '20px', marginBottom: '16px', textAlign: 'left' },
  cardLabel: { color: '#aaa', fontSize: '0.8rem', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' },
  langRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  lang: { color: '#fff', fontSize: '1rem' },
  langPct: { color: '#D4AF37', fontSize: '0.9rem' },
  noPartner: { color: '#555', fontSize: '0.9rem', fontStyle: 'italic' },
  button: { background: '#D4AF37', color: '#1a1a1a', border: 'none', padding: '14px 32px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold', width: '100%', marginBottom: '12px' },
  logoutBtn: { background: 'transparent', color: '#666', border: '1px solid #333', padding: '10px 24px', borderRadius: '8px', fontSize: '0.9rem', cursor: 'pointer', width: '100%' },
  error: { color: '#ff6b6b', fontSize: '0.85rem', marginTop: '20px' }
}

export default App