import React, { useState } from 'react'
import { db } from '../firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { THEMES, makeStyles } from '../theme'
import { MARK_UID, ELOSY_UID, todayStr } from '../appShared'

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

export default GeschenkkarteScreen
