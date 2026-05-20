import React, { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { THEMES, makeStyles } from '../theme'
import { MARK_UID, ELOSY_UID, todayStr } from '../appShared'

function MeineKartenScreen({ user, myData, setMyData, allCards, cardProgress, lang, theme, onBack }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const isDE = lang === 'de'
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('date')
  const [editCard, setEditCard] = useState(null)
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')
  const [editCat, setEditCat] = useState('vocabulary')
  const [editPronunciation, setEditPronunciation] = useState('')
  const [saveStatus, setSaveStatus] = useState(null)
  const [section, setSection] = useState('cards')
  const myPartnerUID = myData?.partnerUID || (user.uid === MARK_UID ? ELOSY_UID : user.uid === ELOSY_UID ? MARK_UID : null)

  const blockedCards = myData?.blockedCards || []
  const receivedGifts = myData?.receivedGifts || []
  const pendingGift = myData?.pendingGift || null

  // Combine pending + received gifts for display
  const allGifts = [
    ...(pendingGift ? [{ ...pendingGift, _isPending: true, _id: 'pending' }] : []),
    ...receivedGifts.map((g, i) => ({ ...g, _id: `received_${i}` })),
  ]

  const rawCards = (myData?.aiCards || []).filter(c => !/_r(_\d+)?$/.test(c.id))

  const masteryStars = (id) => {
    const interval = cardProgress[id]?.interval || 0
    if (interval >= 14) return 5
    if (interval >= 7) return 4
    if (interval >= 3) return 3
    if (interval >= 1) return 2
    return 0
  }

  const sorted = [...rawCards].filter(c => {
    const t = search.trim().toLowerCase()
    return !t || c.front.toLowerCase().includes(t) || (c?.back || '').toLowerCase().includes(t)
  }).sort((a, b) => {
    if (sort === 'alpha') return (a.front || '').localeCompare(b.front || '')
    if (sort === 'progress') return (cardProgress[b.id]?.interval || 0) - (cardProgress[a.id]?.interval || 0)
    return (b.createdAt || 0) - (a.createdAt || 0)
  })

  const openEdit = (card) => { setEditCard(card); setEditFront(card?.front); setEditBack(card?.back); setEditCat(card?.category || 'vocabulary'); setEditPronunciation(card?.pronunciation || '') }

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
    const gift = { front: card?.front, back: card?.back, category: card?.category || 'vocabulary', langA: card?.langA, langB: card?.langB, fromName: myFirstName, message: '' }
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

  const blockCard = async (card) => {
    const newBlocked = [...new Set([...blockedCards, card.id])]
    try {
      await updateDoc(doc(db, 'users', user.uid), { blockedCards: newBlocked })
      setMyData(d => ({ ...d, blockedCards: newBlocked }))
      setSaveStatus(isDE ? 'Karte blockiert ✓' : 'Card blocked ✓')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (e) { console.warn(e) }
  }

  const unblockCard = async (cardId) => {
    const newBlocked = blockedCards.filter(id => id !== cardId)
    try {
      await updateDoc(doc(db, 'users', user.uid), { blockedCards: newBlocked })
      setMyData(d => ({ ...d, blockedCards: newBlocked }))
    } catch (e) { console.warn(e) }
  }

  const addGiftToPool = async (gift) => {
    const ts = Date.now()
    const newCard = {
      id: `gift_${ts}`,
      front: gift.front,
      back: gift.back,
      category: gift.category || 'vocabulary',
      langA: gift.langA || 'de',
      langB: gift.langB || 'en',
      source: 'gift',
      fromName: gift.fromName || '',
      createdAt: ts,
    }
    const updatedAiCards = [...(myData?.aiCards || []), newCard]
    const newReceived = [...receivedGifts, { ...gift, receivedAt: todayStr() }]
    const updates = { aiCards: updatedAiCards, receivedGifts: newReceived }
    if (gift._isPending) updates.pendingGift = null
    try {
      await updateDoc(doc(db, 'users', user.uid), updates)
      setMyData(d => ({ ...d, ...updates }))
      setSaveStatus(isDE ? 'Zum Lernpool hinzugefügt ✓' : 'Added to pool ✓')
      setTimeout(() => setSaveStatus(null), 2500)
    } catch (e) { console.warn(e) }
  }

  const deleteGift = async (gift) => {
    const newReceived = receivedGifts.filter((_, i) => `received_${i}` !== gift._id)
    const updates = { receivedGifts: newReceived }
    if (gift._isPending) updates.pendingGift = null
    try {
      await updateDoc(doc(db, 'users', user.uid), updates)
      setMyData(d => ({ ...d, ...updates }))
    } catch (e) { console.warn(e) }
  }

  const tabStyle = (key) => ({
    flex: 1, padding: '7px 4px', borderRadius: '10px', cursor: 'pointer', fontWeight: section === key ? '700' : '400',
    fontSize: '0.72rem', border: `1px solid ${section === key ? th.accent + '88' : th.border}`,
    background: section === key ? th.accent + '18' : 'transparent',
    color: section === key ? th.accent : th.sub,
  })

  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>← {isDE ? 'Zurück' : 'Back'}</button>
      <h2 style={{ color: th.text, marginBottom: '14px', fontSize: '1.15rem', fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif", fontWeight: '700' }}>
        📋 {isDE ? 'Meine Karten' : 'My Cards'}
      </h2>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
        <button style={tabStyle('gifts')} onClick={() => setSection('gifts')}>
          🎁 {isDE ? 'Geschenke' : 'Gifts'} {allGifts.length > 0 ? `(${allGifts.length})` : ''}
        </button>
        <button style={tabStyle('cards')} onClick={() => setSection('cards')}>
          📖 {isDE ? 'Meine' : 'Mine'} ({rawCards.length})
        </button>
        <button style={tabStyle('blocked')} onClick={() => setSection('blocked')}>
          🚫 {isDE ? 'Blockiert' : 'Blocked'} {blockedCards.length > 0 ? `(${blockedCards.length})` : ''}
        </button>
      </div>

      {saveStatus && <p style={{ color: th.accent, fontSize: '0.8rem', marginBottom: '8px', textAlign: 'center' }}>{saveStatus}</p>}

      {/* ── SECTION 1: Geschenkkarten ── */}
      {section === 'gifts' && (
        <div>
          {allGifts.length === 0 ? (
            <div style={{ ...s.card, textAlign: 'center', padding: '32px 20px' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>🎁</span>
              <p style={{ color: th.sub, fontSize: '0.88rem', margin: 0 }}>{isDE ? 'Keine Geschenkkarten vorhanden.' : 'No gift cards.'}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {allGifts.map(gift => (
                <div key={gift._id} style={{ ...s.card, padding: '12px 14px' }}>
                  {gift._isPending && (
                    <span style={{ fontSize: '0.6rem', background: 'rgba(255,200,0,0.15)', color: '#FFD700', border: '1px solid rgba(255,200,0,0.3)', borderRadius: '6px', padding: '1px 7px', fontWeight: '700', marginBottom: '6px', display: 'inline-block' }}>
                      {isDE ? 'Neu' : 'New'}
                    </span>
                  )}
                  <p style={{ color: th.text, fontWeight: '700', fontSize: '0.9rem', margin: '0 0 2px' }}>{gift.front}</p>
                  <p style={{ color: th.sub, fontSize: '0.8rem', margin: '0 0 4px' }}>{gift.back}</p>
                  {gift.fromName && <p style={{ color: th.sub, fontSize: '0.68rem', margin: '0 0 8px', fontStyle: 'italic' }}>🎁 {isDE ? 'Von' : 'From'}: {gift.fromName}{gift.receivedAt ? ` · ${gift.receivedAt}` : ''}</p>}
                  <div style={{ display: 'flex', gap: '7px' }}>
                    <button onClick={() => addGiftToPool(gift)}
                      style={{ flex: 1, padding: '7px', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', fontSize: '0.75rem', background: 'rgba(0,212,170,0.12)', color: '#00D4AA', border: '1px solid rgba(0,212,170,0.35)' }}>
                      ✚ {isDE ? 'Zum Lernpool' : 'Add to pool'}
                    </button>
                    <button onClick={() => deleteGift(gift)}
                      style={{ padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.75rem', background: 'rgba(224,108,117,0.08)', color: '#e06c75', border: '1px solid rgba(224,108,117,0.3)' }}>
                      {isDE ? 'Löschen' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SECTION 2: Meine Karten ── */}
      {section === 'cards' && (
        <div>
          {editCard && (
            <div style={{ ...s.card, border: `1px solid ${th.accent}55`, marginBottom: '12px', animation: 'vocaraFadeIn 0.2s ease both' }}>
              <p style={{ ...s.cardLabel, marginBottom: '12px' }}>{isDE ? 'Karte bearbeiten' : 'Edit card'}</p>
              <input style={{ ...s.input, marginBottom: '8px' }} value={editFront} onChange={e => setEditFront(e.target.value)} placeholder={isDE ? 'Vorderseite' : 'Front'} />
              <input style={{ ...s.input, marginBottom: '8px' }} value={editBack} onChange={e => setEditBack(e.target.value)} placeholder={isDE ? 'Rückseite' : 'Back'} />
              <input style={{ ...s.input, marginBottom: '12px', fontSize: '0.82rem', fontStyle: 'italic' }} value={editPronunciation} onChange={e => setEditPronunciation(e.target.value)} placeholder={isDE ? 'Aussprache (optional)' : 'Pronunciation (optional)'} />
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
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
            </div>
          )}

          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', alignItems: 'center' }}>
            <input style={{ ...s.input, flex: 1, marginBottom: 0 }} placeholder={isDE ? 'Suchen…' : 'Search…'} value={search} onChange={e => setSearch(e.target.value)} />
            <select value={sort} onChange={e => setSort(e.target.value)}
              style={{ background: th.card, color: th.text, border: `1px solid ${th.border}`, borderRadius: '8px', padding: '7px 8px', fontSize: '0.72rem', cursor: 'pointer', flexShrink: 0 }}>
              <option value="date">{isDE ? 'Datum' : 'Date'}</option>
              <option value="alpha">{isDE ? 'A–Z' : 'A–Z'}</option>
              <option value="progress">{isDE ? 'Fortschritt' : 'Progress'}</option>
            </select>
          </div>

          {sorted.length === 0 ? (
            <div style={{ ...s.card, textAlign: 'center', padding: '32px 20px' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>📋</span>
              <p style={{ color: th.sub, fontSize: '0.88rem', margin: 0 }}>{isDE ? 'Keine Karten gefunden.' : 'No cards found.'}</p>
            </div>
          ) : (
            <div style={s.card}>
              {sorted.map((card, i) => {
                const interval = cardProgress[card.id]?.interval || 0
                const stars = masteryStars(card.id)
                const isGold = interval >= 14
                const isBlocked = blockedCards.includes(card.id)
                return (
                  <div key={card.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: i < sorted.length - 1 ? `1px solid ${th.border}` : 'none', opacity: isBlocked ? 0.4 : 1 }}>
                    <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => openEdit(card)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '2px' }}>
                        <p style={{ color: th.text, fontSize: '0.88rem', margin: 0, fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.front}</p>
                        {isGold && <span style={{ fontSize: '0.68rem', flexShrink: 0 }}>⭐</span>}
                      </div>
                      <p style={{ color: th.sub, fontSize: '0.77rem', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card?.back}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ background: card.category === 'street' ? 'rgba(180,120,30,0.2)' : 'rgba(140,140,155,0.15)', color: card.category === 'street' ? '#C8922A' : '#8A8A9A', borderRadius: '4px', padding: '1px 6px', fontSize: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px', flexShrink: 0 }}>
                          {card.category === 'street' ? 'Slang' : 'Hochsprache'}
                        </span>
                        <span style={{ fontSize: '0.68rem', letterSpacing: '1px', color: isGold ? '#FFD700' : stars > 0 ? th.accent : th.border }}>
                          {'★'.repeat(Math.max(0, stars))}{'☆'.repeat(Math.max(0, 5 - stars))}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 }}>
                      <button onClick={() => blockCard(card)} title={isDE ? 'Nie mehr fragen' : 'Never ask again'}
                        style={{ background: 'transparent', border: '1px solid rgba(224,108,117,0.25)', color: '#e06c75', borderRadius: '7px', padding: '4px 7px', cursor: 'pointer', fontSize: '0.65rem', opacity: 0.7 }}>
                        🚫
                      </button>
                      <button onClick={() => deleteCard(card)}
                        style={{ background: 'transparent', border: '1px solid rgba(224,108,117,0.2)', color: '#e06c75', borderRadius: '7px', padding: '4px 7px', cursor: 'pointer', fontSize: '0.65rem', opacity: 0.55 }}>
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SECTION 3: Blockierte Karten ── */}
      {section === 'blocked' && (
        <div>
          {blockedCards.length === 0 ? (
            <div style={{ ...s.card, textAlign: 'center', padding: '32px 20px' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>✅</span>
              <p style={{ color: th.sub, fontSize: '0.88rem', margin: 0 }}>{isDE ? 'Keine blockierten Karten.' : 'No blocked cards.'}</p>
            </div>
          ) : (
            <div style={s.card}>
              <p style={{ color: th.sub, fontSize: '0.7rem', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: '600' }}>
                {isDE ? `${blockedCards.length} Karten blockiert — werden in keiner Session angezeigt` : `${blockedCards.length} cards blocked — never shown in sessions`}
              </p>
              {blockedCards.map((cardId, i) => {
                const card = (myData?.aiCards || []).find(c => c.id === cardId)
                return (
                  <div key={cardId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: i < blockedCards.length - 1 ? `1px solid ${th.border}` : 'none' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {card ? (
                        <>
                          <p style={{ color: th.text, fontSize: '0.85rem', margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.5 }}>{card.front}</p>
                          <p style={{ color: th.sub, fontSize: '0.72rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.4 }}>{card.back}</p>
                        </>
                      ) : (
                        <p style={{ color: th.sub, fontSize: '0.72rem', margin: 0, fontFamily: 'monospace', opacity: 0.5 }}>{cardId}</p>
                      )}
                    </div>
                    <button onClick={() => unblockCard(cardId)}
                      style={{ background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.3)', color: '#00D4AA', borderRadius: '7px', padding: '5px 10px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '700', flexShrink: 0 }}>
                      {isDE ? 'Freigeben' : 'Unblock'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div></div>
  )
}

export default MeineKartenScreen
