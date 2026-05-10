import React, { useState, useRef } from 'react'
import { db } from '../firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { THEMES, makeStyles } from '../theme'
import { MARK_UID, ELOSY_UID } from '../appShared'

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
        await updateDoc(doc(db, 'users', myPartnerUID), {
          surpriseCard: { ...card, sharedBy: senderName, sharedAt: Date.now() },
          surpriseSeenDate: null
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

export default KarteErstellenScreen
