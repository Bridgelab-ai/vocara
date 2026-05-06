import React, { useState, useEffect } from 'react'
import { getToLangText, SPEECH_LANGS, fuzzyWordMatch, speak } from '../appShared'

function RhythmusScreen({ lang, theme, onBack, allCards, cardProgress, userToLang = 'en', t: tProp, th, s }) {
  const t = tProp
  const [sentence, setSentence] = useState(null)
  const [micState, setMicState] = useState('idle') // idle | listening | done
  const [transcript, setTranscript] = useState('')
  const [score, setScore] = useState(null) // { correct, total }
  const [loading, setLoading] = useState(true)

  // Pick a mastered sentence card
  useEffect(() => {
    const sentenceCards = (allCards || []).filter(c => {
      const cat = c.category || 'vocabulary'
      const interval = cardProgress[c.id]?.interval || 0
      return (cat === 'sentence' || cat === 'home') && interval >= 3 && c.front && c.back
    })
    if (sentenceCards.length === 0) {
      setSentence(null); setLoading(false); return
    }
    const dayIdx = Math.floor(Date.now() / 86400000)
    setSentence(sentenceCards[dayIdx % sentenceCards.length])
    setLoading(false)
  }, [])

  const startMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setMicState('unsupported'); return }
    const rec = new SR()
    const { langCode: toLang } = getToLangText(sentence, userToLang) || { langCode: userToLang }
    rec.lang = SPEECH_LANGS[toLang] || 'en-GB'
    rec.interimResults = false; rec.maxAlternatives = 1
    setMicState('listening'); setTranscript(''); setScore(null)
    rec.onresult = (e) => {
      const heard = e.results[0][0].transcript.trim()
      setTranscript(heard)
      const { text: toLangText } = getToLangText(sentence, userToLang) || { text: sentence.back }
      const tWords = (toLangText || '').split(/\s+/)
      const hWords = heard.toLowerCase().split(/\s+/)
      const correct = tWords.filter(w => hWords.some(h => fuzzyWordMatch(w, h))).length
      const pct = Math.round((correct / Math.max(tWords.length, 1)) * 100)
      setScore({ correct, total: tWords.length, pct })
      setMicState('done')
    }
    rec.onerror = () => setMicState('idle')
    rec.start()
  }

  if (loading) return <div style={s.container}><div style={s.homeBox}><p style={{ color: th.sub, textAlign: 'center', marginTop: '40px' }}>…</p></div></div>

  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>← {t.back}</button>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <p style={{ color: th.gold, fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 6px' }}>🎵 {t.rhythmusTitle}</p>
        <p style={{ color: th.sub, fontSize: '0.82rem', margin: 0 }}>{t.rhythmusSub}</p>
      </div>
      {!sentence ? (
        <div style={s.card}>
          <p style={{ color: th.sub, textAlign: 'center', fontSize: '0.88rem' }}>{t.rhythmusNoCards}</p>
        </div>
      ) : (
        <>
          {(() => {
            const { text: toText, langCode: toLCode } = getToLangText(sentence, userToLang) || { text: sentence.back, langCode: userToLang }
            const nativeText = sentence.langA?.toLowerCase() === toLCode ? sentence.back : sentence.front
            return (
              <div style={{ ...s.card, textAlign: 'center', position: 'relative' }}>
                <p style={{ color: th.sub, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px' }}>{t.repeatAfter}</p>
                <p style={{ color: th.text, fontSize: '1.15rem', fontWeight: '600', margin: '0 0 14px', lineHeight: 1.4 }}>{toText}</p>
                <p style={{ color: th.sub, fontSize: '0.82rem', fontStyle: 'italic', margin: '0 0 16px' }}>{nativeText}</p>
                <button onClick={() => speak(toText, toLCode)} style={{ background: 'transparent', border: `1px solid ${th.border}`, borderRadius: '12px', padding: '8px 18px', color: th.sub, fontSize: '0.82rem', cursor: 'pointer' }}>
                  🔊 {t.listen}
                </button>
              </div>
            )
          })()}

          <div style={{ ...s.card, textAlign: 'center' }}>
            {micState === 'idle' && (
              <button onClick={startMic} style={{ ...s.button, background: `linear-gradient(135deg, ${th.accent}40, ${th.accent}20)`, border: `1px solid ${th.accent}66`, color: th.text, width: '100%' }}>
                🎤 {t.speakNow}
              </button>
            )}
            {micState === 'listening' && (
              <p style={{ color: th.gold, fontSize: '0.9rem', animation: 'vocaraPulse 0.8s infinite' }}>🎤 {t.listening}</p>
            )}
            {micState === 'unsupported' && (
              <p style={{ color: '#ff9800', fontSize: '0.82rem' }}>{t.useChrome}</p>
            )}
            {micState === 'done' && score && (
              <div style={{ animation: 'vocaraFadeIn 0.3s ease both' }}>
                <p style={{ color: th.sub, fontSize: '0.78rem', marginBottom: '8px' }}>{t.youSaid} <em style={{ color: th.text }}>{transcript}</em></p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '12px' }}>
                  {(sentence.back || '').split(/\s+/).map((w, i) => {
                    const heard = transcript.split(/\s+/)
                    const hit = heard.some(h => h.includes(w.toLowerCase()) || w.toLowerCase().includes(h))
                    return <span key={i} style={{ color: hit ? '#4CAF50' : '#e53935', fontSize: '1rem', fontWeight: '600' }}>{w}</span>
                  })}
                </div>
                <p style={{ color: (score.pct || 0) >= 80 ? '#4CAF50' : (score.pct || 0) >= 50 ? '#FFA500' : th.gold, fontSize: '1rem', fontWeight: '700', margin: '0 0 12px' }}>
                  {t.pronouncePct}{score.pct ?? Math.round(score.correct/Math.max(score.total,1)*100)}%
                </p>
                <button onClick={() => { setMicState('idle'); setTranscript(''); setScore(null) }} style={{ background: 'transparent', border: `1px solid ${th.border}`, borderRadius: '10px', padding: '7px 16px', color: th.sub, fontSize: '0.82rem', cursor: 'pointer' }}>
                  🔄 {t.tryAgain}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div></div>
  )
}

export default RhythmusScreen
