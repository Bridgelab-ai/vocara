import React, { useState, useRef } from 'react'
import { db } from '../firebase'
import { doc, updateDoc } from 'firebase/firestore'
import { THEMES, makeStyles } from '../theme'
import { MARK_UID, ELOSY_UID } from '../appShared'

const LANG_NAMES = { en: 'Englisch', de: 'Deutsch', sw: 'Swahili', es: 'Español' }
const LANG_NAMES_EN = { en: 'English', de: 'German', sw: 'Swahili', es: 'Spanish' }
const AVAILABLE_LANGS = [
  { code: 'de', label: 'Deutsch 🇩🇪' },
  { code: 'en', label: 'English 🇬🇧' },
  { code: 'sw', label: 'Swahili 🇰🇪' },
  { code: 'es', label: 'Español 🇪🇸', disabled: true },
]

function KarteErstellenScreen({ user, myData, setMyData, allCards, lang, theme, onBack }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const isDE = lang === 'de'
  const [forPartner, setForPartner] = useState(false)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [pronunciation, setPronunciation] = useState('')
  const [exampleSentence, setExampleSentence] = useState('')
  const [grammarHint, setGrammarHint] = useState('')
  const [fillLoading, setFillLoading] = useState(false)
  const [cat, setCat] = useState('vocabulary')
  const [status, setStatus] = useState(null)
  const [showExtra, setShowExtra] = useState(false)
  const fillTimerRef = useRef(null)
  const lastFilledVal = useRef('')
  const myPartnerUID = myData?.partnerUID || (user.uid === MARK_UID ? ELOSY_UID : user.uid === ELOSY_UID ? MARK_UID : null)
  const partnerName = myData?.partnerName || (user.uid === MARK_UID ? 'Elosy' : user.uid === ELOSY_UID ? 'Mark' : null)

  const [selFrom, setSelFrom] = useState((myData?.fromLang || lang || 'de').toLowerCase())
  const [selTo, setSelTo] = useState((myData?.toLang || (lang === 'de' ? 'en' : 'de')).toLowerCase())

  const fromName = LANG_NAMES_EN[selFrom] || selFrom
  const toName = LANG_NAMES_EN[selTo] || selTo

  const kiFill = async (sourceField, value) => {
    if (!value.trim() || value === lastFilledVal.current) return
    setFillLoading(true)
    try {
      const isFront = sourceField === 'front'
      const srcLang = isFront ? fromName : toName
      const tgtLang = isFront ? toName : fromName
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          system: 'You are a professional language educator. Return ONLY valid JSON, no markdown.',
          messages: [{ role: 'user', content:
            `Create a flashcard for the ${srcLang} word/phrase: "${value}"\n` +
            `Target language: ${tgtLang}\n` +
            `Return JSON: {"translation":"natural ${tgtLang} translation","pronunciation":"phonetic pronunciation of the translation","example":"short example sentence using the original word in ${srcLang}","hint":"brief grammar note (gender, irregular forms, etc.) in 1 phrase","category":"vocabulary|street|sentence"}`
          }]
        })
      })
      const data = await res.json()
      const raw = (data.content?.[0]?.text || '').trim()
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        if (isFront) {
          if (parsed.translation) setBack(parsed.translation)
        } else {
          if (parsed.translation) setFront(parsed.translation)
        }
        if (parsed.pronunciation) setPronunciation(parsed.pronunciation)
        if (parsed.example) { setExampleSentence(parsed.example); setShowExtra(true) }
        if (parsed.hint) { setGrammarHint(parsed.hint); setShowExtra(true) }
        if (parsed.category === 'street') setCat('street')
        else if (parsed.category === 'sentence') setCat('sentence')
        else setCat('vocabulary')
        lastFilledVal.current = value
      }
    } catch (e) { console.warn('KI fill failed:', e) }
    setFillLoading(false)
  }

  const scheduleKiFill = (field, val) => {
    if (fillTimerRef.current) clearTimeout(fillTimerRef.current)
    if (val.trim().length >= 2) fillTimerRef.current = setTimeout(() => kiFill(field, val.trim()), 700)
  }

  const handleFromChange = (code) => {
    setSelFrom(code)
    if (code === selTo) setSelTo(code === 'de' ? 'en' : 'de')
    lastFilledVal.current = ''
  }
  const handleToChange = (code) => {
    setSelTo(code)
    if (code === selFrom) setSelFrom(code === 'de' ? 'en' : 'de')
    lastFilledVal.current = ''
  }

  const clearAll = () => {
    setFront(''); setBack(''); setPronunciation(''); setExampleSentence(''); setGrammarHint('')
    setCat('vocabulary'); lastFilledVal.current = ''; setShowExtra(false)
  }

  const save = async () => {
    if (!front.trim() || !back.trim()) return
    const card = {
      id: `custom_${Date.now()}`,
      front: front.trim(), back: back.trim(),
      category: cat, langA: selFrom, langB: selTo,
      source: 'custom', createdAt: Date.now(),
      ...(pronunciation.trim() ? { pronunciation: pronunciation.trim() } : {}),
      ...(exampleSentence.trim() ? { exampleSentence: exampleSentence.trim() } : {}),
      ...(grammarHint.trim() ? { grammarHint: grammarHint.trim() } : {}),
    }
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
      clearAll()
      setTimeout(() => setStatus(null), 2500)
    } catch (e) { console.warn(e); setStatus(isDE ? 'Fehler' : 'Error') }
  }

  const selectStyle = {
    background: th.card, color: th.text, border: `1px solid ${th.border}`,
    borderRadius: '8px', padding: '7px 8px', fontSize: '0.8rem', cursor: 'pointer', flex: 1,
  }

  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>← {isDE ? 'Zurück' : 'Back'}</button>
      <h2 style={{ color: th.text, marginBottom: '16px', fontSize: '1.2rem', fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif", fontWeight: '700' }}>
        ✏️ {isDE ? 'Neue Karte' : 'New Card'}
      </h2>

      {/* For whom */}
      {myPartnerUID && (
        <div style={{ ...s.card, marginBottom: '10px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setForPartner(false)}
              style={{ flex: 1, padding: '8px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem', background: !forPartner ? th.accent : 'transparent', color: !forPartner ? (th.btnTextColor || '#111') : th.sub, border: `1px solid ${!forPartner ? th.accent : th.border}` }}>
              {isDE ? 'Für mich' : 'For me'}
            </button>
            <button onClick={() => setForPartner(true)}
              style={{ flex: 1, padding: '8px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem', background: forPartner ? `${th.gold}22` : 'transparent', color: forPartner ? th.gold : th.sub, border: `1px solid ${forPartner ? th.gold : th.border}` }}>
              🎁 {isDE ? `Für ${partnerName}` : `For ${partnerName}`}
            </button>
          </div>
        </div>
      )}

      {/* Language pair selector */}
      <div style={{ ...s.card, marginBottom: '10px' }}>
        <p style={{ color: th.sub, fontSize: '0.68rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px', margin: '0 0 8px' }}>
          {isDE ? 'Sprachpaar' : 'Language pair'}
        </p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select value={selFrom} onChange={e => handleFromChange(e.target.value)} style={selectStyle}>
            {AVAILABLE_LANGS.filter(l => !l.disabled || l.code === selFrom).map(l => (
              <option key={l.code} value={l.code} disabled={l.disabled}>{l.label}{l.disabled ? ' (bald)' : ''}</option>
            ))}
          </select>
          <span style={{ color: th.sub, fontSize: '1rem', flexShrink: 0 }}>→</span>
          <select value={selTo} onChange={e => handleToChange(e.target.value)} style={selectStyle}>
            {AVAILABLE_LANGS.filter(l => !l.disabled || l.code === selTo).map(l => (
              <option key={l.code} value={l.code} disabled={l.disabled}>{l.label}{l.disabled ? ' (bald)' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Card fields */}
      <div style={s.card}>
        {/* Front */}
        <input
          style={{ ...s.input, marginBottom: '8px' }}
          placeholder={`${LANG_NAMES[selFrom] || selFrom} — ${isDE ? 'Vorderseite' : 'front'}`}
          value={front}
          onChange={e => { setFront(e.target.value); scheduleKiFill('front', e.target.value) }}
          onBlur={() => { if (front.trim().length >= 2) { if (fillTimerRef.current) clearTimeout(fillTimerRef.current); kiFill('front', front.trim()) } }}
        />
        {/* Back */}
        <div style={{ position: 'relative', marginBottom: '8px' }}>
          <input
            style={{ ...s.input, marginBottom: 0, paddingRight: fillLoading ? '36px' : undefined }}
            placeholder={fillLoading
              ? (isDE ? 'KI generiert…' : 'AI generating…')
              : `${LANG_NAMES[selTo] || selTo} — ${isDE ? 'Rückseite' : 'back'}`}
            value={back}
            onChange={e => { setBack(e.target.value); scheduleKiFill('back', e.target.value); lastFilledVal.current = '' }}
          />
          {fillLoading && (
            <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', border: `2px solid ${th.gold}44`, borderTopColor: th.gold, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          )}
        </div>
        {/* Pronunciation */}
        <input
          style={{ ...s.input, marginBottom: '8px', fontSize: '0.82rem', fontStyle: 'italic' }}
          placeholder={isDE ? 'Aussprache (KI-Vorschlag oder manuell)' : 'Pronunciation (AI suggestion or manual)'}
          value={pronunciation}
          onChange={e => setPronunciation(e.target.value)}
        />
        {/* Extra fields toggle */}
        <button onClick={() => setShowExtra(v => !v)}
          style={{ background: 'transparent', border: 'none', color: th.sub, fontSize: '0.72rem', cursor: 'pointer', padding: '0 0 8px', textDecoration: 'underline' }}>
          {showExtra ? '▲' : '▼'} {isDE ? 'Beispielsatz & Grammatik-Hinweis' : 'Example & Grammar hint'}
        </button>
        {showExtra && (
          <>
            <input
              style={{ ...s.input, marginBottom: '8px', fontSize: '0.82rem' }}
              placeholder={isDE ? 'Beispielsatz (optional)' : 'Example sentence (optional)'}
              value={exampleSentence}
              onChange={e => setExampleSentence(e.target.value)}
            />
            <input
              style={{ ...s.input, marginBottom: '12px', fontSize: '0.82rem' }}
              placeholder={isDE ? 'Grammatik-Hinweis (optional)' : 'Grammar hint (optional)'}
              value={grammarHint}
              onChange={e => setGrammarHint(e.target.value)}
            />
          </>
        )}
        {/* Category */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button onClick={() => setCat('vocabulary')} style={{ flex: 1, padding: '8px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.78rem', background: cat === 'vocabulary' ? 'rgba(140,140,155,0.25)' : 'transparent', color: cat === 'vocabulary' ? '#A0A0B8' : th.sub, border: `1px solid ${cat === 'vocabulary' ? 'rgba(140,140,155,0.45)' : th.border}` }}>Hochsprache</button>
          <button onClick={() => setCat('street')} style={{ flex: 1, padding: '8px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.78rem', background: cat === 'street' ? 'rgba(180,120,30,0.2)' : 'transparent', color: cat === 'street' ? '#C8922A' : th.sub, border: `1px solid ${cat === 'street' ? 'rgba(180,120,30,0.4)' : th.border}` }}>Slang</button>
          <button onClick={() => setCat('sentence')} style={{ flex: 1, padding: '8px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.78rem', background: cat === 'sentence' ? 'rgba(0,212,170,0.15)' : 'transparent', color: cat === 'sentence' ? '#00D4AA' : th.sub, border: `1px solid ${cat === 'sentence' ? 'rgba(0,212,170,0.4)' : th.border}` }}>{isDE ? 'Satz' : 'Phrase'}</button>
        </div>
        {/* Save button */}
        <button style={{ ...s.button, marginBottom: 0, opacity: (!front.trim() || !back.trim() || fillLoading) ? 0.45 : 1 }} onClick={save} disabled={!front.trim() || !back.trim() || fillLoading}>
          {forPartner && partnerName ? (isDE ? `🎁 An ${partnerName} senden` : `🎁 Send to ${partnerName}`) : (isDE ? 'Karte speichern' : 'Save card')}
        </button>
        {status && <p style={{ color: th.accent, fontSize: '0.82rem', marginTop: '8px', textAlign: 'center' }}>{status}</p>}
      </div>
    </div></div>
  )
}

export default KarteErstellenScreen
