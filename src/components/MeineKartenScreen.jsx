import React, { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { THEMES, makeStyles } from '../theme'
import { MARK_UID, ELOSY_UID } from '../appShared'

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

export default MeineKartenScreen
