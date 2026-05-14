import React, { useState, useEffect, useRef } from 'react'
import { SPEECH_LANGS, getToLangText, speak, fuzzyWordMatch } from '../appShared'

const LANG_FLAGS = { en: '🇬🇧', de: '🇩🇪', sw: '🇰🇪', th: '🇹🇭', es: '🇪🇸', fr: '🇫🇷', ar: '🇸🇦', tr: '🇹🇷', pt: '🇵🇹' }

function getNextReview(days) {
  const d = new Date(); d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function todayStr() { return new Date().toISOString().split('T')[0] }

async function speakSyllable(text, langCode) {
  if (!window.speechSynthesis || !text) return
  window.speechSynthesis.cancel()
  const langTag = SPEECH_LANGS[langCode] || 'en-GB'
  const voices = await new Promise(resolve => {
    const v = window.speechSynthesis.getVoices()
    if (v.length) { resolve(v); return }
    window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices())
  })
  const preferred = voices.find(v => v.lang === langTag && v.name.toLowerCase().includes('google'))
    || voices.find(v => v.lang === langTag && !v.localService)
    || voices.find(v => v.lang.startsWith(langTag.split('-')[0]) && v.name.toLowerCase().includes('google'))
    || voices.find(v => v.lang.startsWith(langTag.split('-')[0]))
  const swFallback = (!preferred && langTag === 'sw-KE')
    ? (voices.find(v => v.lang === 'en-US') || voices.find(v => v.lang.startsWith('en-')))
    : null
  const effectiveLang = swFallback ? 'en-US' : langTag
  const effectiveVoice = preferred || swFallback || null
  const words = text.trim().split(/\s+/).filter(Boolean)
  words.forEach((word, i) => {
    setTimeout(() => {
      const u = new SpeechSynthesisUtterance(word)
      u.lang = effectiveLang; u.rate = 0.9
      if (effectiveVoice) u.voice = effectiveVoice
      window.speechSynthesis.speak(u)
    }, i * 400)
  })
}

const THAI_MIDDLE = new Set('กจดตฎฏบปอ')
const THAI_HIGH_LOW = new Set('ขฃฉฐถผฝศษสหคฅฆงชซฌญณทธนพฟภมยรลวฬฮ')

function ThaiColorPronunciation({ text }) {
  return (
    <>
      {[...text].map((ch, i) => {
        const code = ch.charCodeAt(0)
        if (THAI_MIDDLE.has(ch)) return <span key={i} style={{ color: '#4CAF50' }}>{ch}</span>
        if (THAI_HIGH_LOW.has(ch)) return <span key={i} style={{ color: '#9C27B0' }}>{ch}</span>
        if (code >= 0x0E48 && code <= 0x0E4B) return <span key={i} style={{ color: '#9C27B0' }}>{ch}</span>
        if (code >= 0x0E30 && code <= 0x0E47) return <span key={i} style={{ color: '#f44336' }}>{ch}</span>
        return <span key={i}>{ch}</span>
      })}
    </>
  )
}

function CardScreen({ session, onBack, onFinish, lang, cardProgress, s, onSaveState, onSaveSessionProgress, onStop, onSaveExample, mode = 'all', startIndex = 0, startProgress = null, userToLang = 'en', t: tProp }) {
  const [index, setIndex] = useState(startIndex)
  const [queue, setQueue] = useState(session)
  const [revealed, setRevealed] = useState(false)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [newProgress, setNewProgress] = useState(startProgress || { ...cardProgress })
  const [cardTilt, setCardTilt] = useState({ x: 0, y: 0 })
  const [ttsMode, setTtsMode] = useState(0)
  const [micState, setMicState] = useState('idle')
  const [micResult, setMicResult] = useState(null)
  const [phoneticCache, setPhoneticCache] = useState({})
  const [cardAnim, setCardAnim] = useState(null)
  const [flipPhase, setFlipPhase] = useState(false)
  const [patternTip, setPatternTip] = useState(null)
  const wrongCardsRef = useRef([])
  const [kiExplanation, setKiExplanation] = useState(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [kontextVariation, setKontextVariation] = useState(null)
  const [kontextOpen, setKontextOpen] = useState(false)
  const animLock = useRef(false)
  const startTime = useRef(Date.now())
  const answeredIds = useRef(new Set())
  const easyCountRef = useRef(0)
  const fastCountRef = useRef(0)
  const cardStatsRef = useRef({})

  useEffect(() => {
    if (!window.DeviceOrientationEvent) return
    const handle = (e) => {
      const gamma = Math.max(-12, Math.min(12, e.gamma || 0))
      const beta = Math.max(-12, Math.min(12, (e.beta || 0) - 45))
      setCardTilt({ x: beta, y: gamma })
    }
    window.addEventListener('deviceorientation', handle)
    return () => window.removeEventListener('deviceorientation', handle)
  }, [])
  const t = tProp || {}
  const item = queue[index]
  const question = item.front
  const answer = item?.back
  const fromLang = item.langA
  const toLang = item.langB
  const showPronunciation = item.pronunciation
  const speakBack = (mode = ttsMode) => {
    const result = getToLangText(item, userToLang)
    if (!result) return
    if (mode === 1) speakSyllable(result.text, result.langCode)
    else speak(result.text, result.langCode)
  }
  const cycleTtsMode = () => setTtsMode(m => (m + 1) % 2)
  const handleSpeakerTap = () => { speakBack(ttsMode); cycleTtsMode() }

  const handleMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setMicState('unsupported'); return }
    setMicState('listening'); setMicResult(null)
    const rec = new SR()
    // Expected answer is always item.back, in item.langB (buildCardPair guarantees this for both forward and reverse cards)
    const answerText = item?.back
    rec.lang = SPEECH_LANGS[item.langB] || 'en-GB'
    rec.interimResults = false; rec.maxAlternatives = 3
    const timeout = setTimeout(() => { try { rec.stop() } catch(e) {} }, 5000)
    rec.onresult = (e) => {
      clearTimeout(timeout)
      const alts = []
      for (let r = 0; r < e.results.length; r++)
        for (let a = 0; a < e.results[r].length; a++) alts.push(e.results[r][a].transcript.trim())
      const transcript = alts[0] || ''
      const expWords = answerText.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean)
      const gotWords = alts.join(' ').toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean)
      const origWords = answerText.split(/\s+/)
      const words = expWords.map((w, i) => ({
        word: origWords[i] || w,
        correct: gotWords.some(g => fuzzyWordMatch(w, g))
      }))
      const pct = Math.round((words.filter(w => w.correct).length / Math.max(words.length, 1)) * 100)
      setMicResult({ score: pct, words, transcript })
      setMicState('done')
    }
    rec.onerror = () => { clearTimeout(timeout); setMicState('idle') }
    rec.onend = () => { clearTimeout(timeout); setMicState(s => s === 'listening' ? 'idle' : s) }
    rec.start()
  }

  useEffect(() => {
    if (!revealed) return
    if (fromLang !== 'de' || toLang !== 'en') return
    if (phoneticCache[item.id] !== undefined) return
    setPhoneticCache(c => ({ ...c, [item.id]: '' }))
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 60,
        messages: [{ role: 'user', content: `Give ONLY the German-phonetic pronunciation guide for this English word or short phrase: "${item?.back}". Output only the phonetic spelling (how a German speaker would read it to sound like English), nothing else. Examples: swamped→swompt, through→thruu, though→dhoo, world→wörld, knight→nait` }]
      })
    }).then(r => r.json()).then(d => {
      const ph = d.content?.[0]?.text?.trim() || ''
      setPhoneticCache(c => ({ ...c, [item.id]: ph }))
    }).catch(() => {})
  }, [revealed, index])

  useEffect(() => {
    setNoteText(cardProgress[item.id]?._note || '')
    setNoteOpen(false)
    setKiExplanation(null)
    setKontextVariation(null); setKontextOpen(false)
    setMicState('idle'); setMicResult(null)
  }, [index])

  useEffect(() => {
    if (wrong < 10 || patternTip !== null) return
    setPatternTip('loading')
    const cards = wrongCardsRef.current.slice(0, 10)
    const cardList = cards.map(c => `"${c?.front}" → "${c?.back}"`).join('; ')
    const tipLang = lang === 'de' ? 'German' : 'English'
    fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 100,
        messages: [{ role: 'user', content: `A language learner answered these ${cards.length} cards incorrectly: ${cardList}. In exactly 1 sentence in ${tipLang}, name one specific grammar pattern or memory tip connecting these mistakes. Be concrete and brief, not generic.` }]
      })
    }).then(r => r.json()).then(d => {
      const tip = d.content?.[0]?.text?.trim()
      setPatternTip(tip || null)
    }).catch(() => setPatternTip(null))
  }, [wrong])

  const [exampleSentence, setExampleSentence] = useState(null)
  useEffect(() => {
    setExampleSentence(cardProgress[item.id]?._example || null)
  }, [index])
  useEffect(() => {
    if (!revealed || item.category !== 'vocabulary') return
    if (cardProgress[item.id]?._example) { setExampleSentence(cardProgress[item.id]._example); return }
    if (exampleSentence) return
    const fromL = fromLang === 'de' ? 'German' : fromLang === 'en' ? 'English' : fromLang === 'sw' ? 'Swahili' : fromLang
    const toL = toLang === 'de' ? 'German' : toLang === 'en' ? 'English' : toLang === 'sw' ? 'Swahili' : toLang
    fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 120,
        messages: [{ role: 'user', content: `For the vocabulary word: "${item?.front}" (${fromL}) = "${item?.back}" (${toL}), write exactly ONE short natural example sentence in ${fromL} using this word, then translate it to ${toL}. Return ONLY valid JSON: {"from":"sentence in ${fromL}","to":"sentence in ${toL}"}` }]
      })
    }).then(r => r.json()).then(d => {
      try {
        const text = d.content?.[0]?.text?.trim() || ''
        const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
        if (parsed.from && parsed.to) {
          setExampleSentence(parsed)
          onSaveExample?.(item.id, parsed)
        }
      } catch(e) {}
    }).catch(() => {})
  }, [revealed, index])

  const triggerAnim = (anim, delay, cb) => {
    if (animLock.current) return
    animLock.current = true
    setCardAnim(anim)
    setTimeout(() => { setCardAnim(null); animLock.current = false; cb() }, delay)
  }

  const handleReveal = () => {
    startTime.current = Date.now()
    setFlipPhase(true)
    setTimeout(() => {
      setRevealed(true)
      setFlipPhase(false)
      speakBack(ttsMode)
    }, 230)
  }
  const handleStop = () => {
    onSaveState?.(queue, index, newProgress)
    if (onStop) {
      onStop(newProgress, answeredIds.current.size)
    } else {
      if (answeredIds.current.size > 0) {
        onSaveSessionProgress?.(Array.from(answeredIds.current), mode)
      }
      onBack()
    }
  }
  const handleEasy = () => {
    const cardId = item.id
    answeredIds.current.add(cardId)
    easyCountRef.current += 1
    const st = cardStatsRef.current[cardId] || { wrongs: 0, fastestMs: Infinity }
    cardStatsRef.current[cardId] = { ...st, fastestMs: Math.min(st.fastestMs, 500) }
    const prev = newProgress[cardId] || { interval: 0, consecutiveRight: 0, wrongSessions: 0 }
    const prevEasyCount = (prev.easyCount || 0) + 1
    const wasMastered = !!prev.mastered
    const nowMastered = prevEasyCount >= 5 || wasMastered
    let easyInterval
    if (wasMastered) {
      const mrc = (prev.masteredReviewCount || 0) + 1
      const masteredIntervals = [30, 60, 90, 180]
      easyInterval = masteredIntervals[Math.min(mrc - 1, masteredIntervals.length - 1)]
    } else if (prevEasyCount >= 5) {
      easyInterval = 30
    } else if (prevEasyCount === 4) {
      easyInterval = 12
    } else if (prevEasyCount === 3) {
      easyInterval = 9
    } else if (prevEasyCount === 2) {
      easyInterval = 6
    } else {
      easyInterval = 3
    }
    const masteredReviewCount = wasMastered ? (prev.masteredReviewCount || 0) + 1 : (nowMastered ? 1 : 0)
    const isGolden = nowMastered || easyInterval >= 14
    const updatedProgress = {
      ...prev, interval: easyInterval, consecutiveRight: 0,
      wrongSessions: Math.max(0, (prev.wrongSessions || 0) - 1),
      nextReview: getNextReview(easyInterval), easyCount: prevEasyCount,
      mastered: nowMastered,
      masteredAt: nowMastered && !wasMastered ? todayStr() : (prev.masteredAt || null),
      masteredReviewCount, isGolden
    }
    const finalProgress = { ...newProgress, [cardId]: updatedProgress }
    setNewProgress(finalProgress)
    const newCorrect = correct + 1; setCorrect(newCorrect)
    if (index + 1 >= queue.length) { onFinish(finalProgress, newCorrect, wrong, easyCountRef.current, fastCountRef.current, cardStatsRef.current); return }
    setIndex(i => i + 1); setRevealed(false)
    onSaveState?.(queue, index + 1, finalProgress)
  }
  const handleFast = () => {
    const cardId = item.id
    answeredIds.current.add(cardId)
    fastCountRef.current += 1
    const st = cardStatsRef.current[cardId] || { wrongs: 0, fastestMs: Infinity }
    cardStatsRef.current[cardId] = { ...st, fastestMs: Math.min(st.fastestMs, Date.now()) }
    const prev = newProgress[cardId] || { interval: 0, consecutiveRight: 0, wrongSessions: 0 }
    const updatedProgress = {
      ...prev, interval: 1, consecutiveRight: 0,
      wrongSessions: Math.max(0, (prev.wrongSessions || 0) - 1),
      nextReview: getNextReview(1), fastCount: (prev.fastCount || 0) + 1
    }
    const finalProgress = { ...newProgress, [cardId]: updatedProgress }
    setNewProgress(finalProgress)
    if (index + 1 >= queue.length) { onFinish(finalProgress, correct, wrong, easyCountRef.current, fastCountRef.current, cardStatsRef.current); return }
    setIndex(i => i + 1); setRevealed(false)
    onSaveState?.(queue, index + 1, finalProgress)
  }
  const handleAnswer = (isCorrect) => {
    const elapsed = (Date.now() - startTime.current) / 1000
    const cardId = item.id
    answeredIds.current.add(cardId)
    const st = cardStatsRef.current[cardId] || { wrongs: 0, fastestMs: Infinity }
    if (!isCorrect) {
      cardStatsRef.current[cardId] = { ...st, wrongs: st.wrongs + 1 }
      const prev = newProgress[cardId] || { interval: 0, consecutiveRight: 0, wrongSessions: 0 }
      const updatedProgress = { ...prev, interval: 0, consecutiveRight: 0, wrongSessions: 3, nextReview: todayStr(), wrongCount: (prev.wrongCount || 0) + 1 }
      const finalNewProgress = { ...newProgress, [cardId]: updatedProgress }
      const newQueue = [...queue]
      newQueue.splice(index, 1)
      newQueue.splice(Math.min(index + 5, newQueue.length), 0, { ...item })
      wrongCardsRef.current.push({ front: item.front, back: item?.back })
      setQueue(newQueue); setNewProgress(finalNewProgress); setWrong(w => w + 1); setRevealed(false)
      onSaveState?.(newQueue, index, finalNewProgress)
    } else {
      cardStatsRef.current[cardId] = { ...st, fastestMs: Math.min(st.fastestMs, elapsed * 1000) }
      const prev = newProgress[cardId] || { interval: 0, consecutiveRight: 0, wrongSessions: 0 }
      const newCR = (prev.consecutiveRight || 0) + 1
      const baseInterval = Math.max(2, (prev.interval || 0) + 1)
      let interval
      if (newCR >= 5) interval = Math.max(4, (prev.interval || 0) + 3)
      else if (newCR >= 3) interval = Math.max(3, (prev.interval || 0) + 2)
      else interval = baseInterval
      const isGolden = interval >= 14
      const updatedProgress = { ...prev, interval, consecutiveRight: newCR, wrongSessions: Math.max(0, (prev.wrongSessions || 0) - 1), nextReview: getNextReview(interval), rightCount: (prev.rightCount || 0) + 1, isGolden }
      const finalProgress = { ...newProgress, [cardId]: updatedProgress }
      setNewProgress(finalProgress)
      const newCorrect = correct + 1; setCorrect(newCorrect)
      if (index + 1 >= queue.length) { onFinish(finalProgress, newCorrect, wrong, easyCountRef.current, fastCountRef.current, cardStatsRef.current); return }
      setIndex(i => i + 1); setRevealed(false)
      onSaveState?.(queue, index + 1, finalProgress)
    }
  }

  const haptic = (pattern) => { try { if (navigator.vibrate) navigator.vibrate(pattern) } catch(e) {} }

  const handleAnswerAnimated = (isCorrect) => {
    if (animLock.current) return
    if (isCorrect) {
      haptic(50)
    } else {
      haptic([100, 100, 100])
      setKiExplanation('loading')
      fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 100,
          messages: [{ role: 'user', content: `The user got this card wrong. Front: "${item?.front}" Back: "${item?.back}". In 1-2 short sentences in ${fromLang === 'de' ? 'German' : 'English'}, explain the grammar rule or memory trick that helps remember this. Be brief and encouraging.` }]
        })
      }).then(r => r.json()).then(d => setKiExplanation(d.content?.[0]?.text?.trim() || null)).catch(() => setKiExplanation(null))
    }
    const anim = isCorrect ? 'flyRight' : 'shake'
    const delay = isCorrect ? 350 : 480
    triggerAnim(anim, delay, () => handleAnswer(isCorrect))
  }
  const handleEasyAnimated = () => {
    haptic([30, 40, 30, 40, 30])
    triggerAnim('flyUp', 320, () => handleEasy())
  }
  const handleFastAnimated = () => {
    haptic([30, 60, 30])
    triggerAnim('flyRight', 350, () => handleFast())
  }

  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox} className="vocara-card-screen-box">
      <div style={s.cardHeader}>
        <p style={s.greeting}>{t.card} {index + 1} {t.of} {queue.length}</p>
        <button style={s.stopBtn} onClick={handleStop}>{t.stop}</button>
      </div>
      {(() => {
        const today = todayStr()
        const tom = new Date(); tom.setDate(tom.getDate() + 1)
        const tomorrow = tom.toISOString().slice(0, 10)
        const rToday = Object.values(cardProgress).filter(p => p.nextReview === today).length
        const rTom = Object.values(cardProgress).filter(p => p.nextReview === tomorrow).length
        return (
          <p style={{ ...s.greeting, fontSize: '0.72rem', marginBottom: '6px', textAlign: 'center', opacity: 0.7 }}>
            Wiederholungen heute: {rToday} · Morgen: {rTom}
          </p>
        )
      })()}
      <div style={{ width: '100%', marginBottom: '16px', perspective: '900px',
        animation: cardAnim ? `vocara${cardAnim.charAt(0).toUpperCase() + cardAnim.slice(1)} ${cardAnim === 'shake' ? '0.48s' : '0.35s'} ease forwards` : undefined,
      }}>
        <div className="vocara-big-card" style={{
          ...s.bigCard,
          border: (newProgress[item.id]?.isGolden || cardProgress[item.id]?.isGolden)
            ? '1px solid rgba(255,215,0,0.60)'
            : revealed ? `1px solid ${s.progressFill.background}` : `1px solid ${s.progressBar.background}`,
          boxShadow: (newProgress[item.id]?.isGolden || cardProgress[item.id]?.isGolden)
            ? undefined
            : s.bigCard.boxShadow,
          animation: (newProgress[item.id]?.isGolden || cardProgress[item.id]?.isGolden) && !flipPhase
            ? 'goldShimmer 2.4s ease-in-out infinite'
            : undefined,
          transition: flipPhase ? 'transform 0.23s ease-in, border-color 0.3s ease' : 'transform 0.23s ease-out, border-color 0.3s ease',
          minHeight: '220px',
          transform: flipPhase
            ? `rotateX(${-cardTilt.x * 0.5}deg) rotateY(90deg)`
            : `rotateX(${-cardTilt.x * 1.5}deg) rotateY(${cardTilt.y * 1.5}deg)`,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
            background: `radial-gradient(circle at ${50 - cardTilt.y * 3.5}% ${50 - cardTilt.x * 3.5}%, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.04) 35%, transparent 65%)`,
            transition: 'background 0.1s ease-out',
          }} />
          <div style={{
            position: 'absolute', top: '8px', left: '10px',
            background: item.category === 'street' ? 'rgba(180,120,30,0.22)' : 'rgba(140,140,155,0.18)',
            color: item.category === 'street' ? '#C8922A' : '#8A8A9A',
            border: `1px solid ${item.category === 'street' ? 'rgba(180,120,30,0.35)' : 'rgba(140,140,155,0.28)'}`,
            borderRadius: '6px', padding: '2px 7px',
            fontSize: '9px', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase',
            pointerEvents: 'none',
          }}>
            {item.category === 'street' ? 'Slang' : 'Hochsprache'}
          </div>
          {(newProgress[item.id]?.isGolden || cardProgress[item.id]?.isGolden) && (
            <div style={{ position: 'absolute', top: '8px', right: '10px', background: 'rgba(255,215,0,0.15)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.40)', borderRadius: '6px', padding: '2px 7px', fontSize: '9px', fontWeight: '600', letterSpacing: '0.3px', pointerEvents: 'none', animation: 'goldShimmer 2.4s ease-in-out infinite' }}>
              ⭐ Gold
            </div>
          )}
          {item.sharedBy && !cardProgress[item.id] && (
            <div style={{ position: 'absolute', top: '8px', right: '10px', background: 'rgba(255,215,0,0.18)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.35)', borderRadius: '6px', padding: '2px 7px', fontSize: '9px', fontWeight: '600', letterSpacing: '0.3px', pointerEvents: 'none' }}>
              🎁 {item.sharedBy}
            </div>
          )}
          <button onClick={() => setNoteOpen(o => !o)} style={{ position: 'absolute', bottom: '8px', right: '10px', background: noteText ? 'rgba(255,255,255,0.10)' : 'transparent', border: noteText ? '1px solid rgba(255,255,255,0.18)' : 'none', borderRadius: '8px', padding: '3px 7px', color: noteText ? '#e0c060' : '#8A8A9A', fontSize: '0.75rem', cursor: 'pointer', opacity: 0.85, lineHeight: 1, zIndex: 2 }}>
            📝
          </button>
          <p style={s.dirLabel}>{LANG_FLAGS[fromLang]} → {LANG_FLAGS[toLang]}</p>
          <p style={s.cardFront}>{question}</p>
          {!revealed && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%' }}>
              {micState !== 'unsupported' && (
                <button
                  onClick={handleMic}
                  disabled={micState === 'listening'}
                  style={{ background: micState === 'listening' ? 'rgba(229,57,53,0.12)' : 'transparent', border: `1px solid ${micState === 'listening' ? 'rgba(229,57,53,0.35)' : 'rgba(140,140,155,0.22)'}`, borderRadius: '12px', padding: '7px 20px', color: micState === 'listening' ? '#e53935' : '#8A8A9A', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', animation: micState === 'listening' ? 'vocaraPulse 0.8s infinite' : 'none', WebkitTapHighlightColor: 'transparent' }}
                >
                  🎤 {micState === 'listening' ? (lang === 'de' ? 'Höre zu…' : 'Listening…') : (lang === 'de' ? 'Antwort sprechen' : 'Speak your answer')}
                </button>
              )}
              {micResult && (
                <div style={{ textAlign: 'center', animation: 'vocaraFadeIn 0.3s ease both', width: '100%' }}>
                  <p style={{ fontSize: '0.88rem', fontWeight: '700', margin: '0 0 2px', color: micResult.score >= 80 ? '#4CAF50' : micResult.score >= 50 ? '#FFA500' : '#e53935' }}>
                    {micResult.score}%
                  </p>
                  <p style={{ fontSize: '0.72rem', margin: '0 0 8px', fontStyle: 'italic', color: micResult.score >= 80 ? '#4CAF50' : micResult.score >= 50 ? '#FFA500' : '#e53935' }}>
                    {micResult.score >= 80 ? (lang === 'de' ? 'Sehr gut verständlich' : 'Very clearly understandable') : micResult.score >= 50 ? (lang === 'de' ? 'Gut, aber noch etwas üben' : 'Good, but keep practicing') : (lang === 'de' ? 'Nochmal versuchen' : 'Try again')}
                  </p>
                  {micResult.score >= 70
                    ? <button onClick={() => handleAnswerAnimated(true)} style={{ background: 'rgba(76,175,80,0.18)', border: '1px solid rgba(76,175,80,0.45)', borderRadius: '12px', padding: '8px 22px', color: '#4CAF50', fontSize: '0.85rem', cursor: 'pointer', fontWeight: '600', WebkitTapHighlightColor: 'transparent' }}>✅ {lang === 'de' ? 'Richtig — weiter' : 'Correct — next'}</button>
                    : <button style={s.revealBtn} onClick={handleReveal}>{lang === 'de' ? 'Lösung anzeigen' : 'Show solution'}</button>
                  }
                </div>
              )}
              {!micResult && (
                <button style={s.revealBtn} onClick={handleReveal}>{t.showSolution}</button>
              )}
            </div>
          )}
          {revealed && (
            <div style={{ animation: 'vocaraFadeIn 0.3s ease both', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
                <p style={{ ...s.cardBack, margin: 0 }}>{answer}</p>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <button onClick={handleSpeakerTap} style={{ background: 'transparent', border: 'none', fontSize: '1.3rem', cursor: 'pointer', padding: '4px', opacity: 0.8 }}>🔊</button>
                  <span style={{ background: 'transparent', border: `1px solid rgba(140,140,155,0.35)`, borderRadius: '4px', fontSize: '0.58rem', padding: '1px 5px', color: '#8A8A9A', fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '0.3px', userSelect: 'none' }}>{ttsMode === 0 ? 'Satz' : 'Silbe'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <button onClick={handleMic} style={{ background: 'transparent', border: 'none', fontSize: '1.3rem', cursor: 'pointer', padding: '4px', opacity: micState === 'listening' ? 1 : 0.7, animation: micState === 'listening' ? 'vocaraPulse 0.8s infinite' : 'none' }}>🎤</button>
                  <span style={{ fontSize: '0.58rem', color: micState === 'listening' ? '#e53935' : micState === 'done' ? (micResult?.score >= 80 ? '#4CAF50' : micResult?.score >= 50 ? '#FFA500' : '#e53935') : '#8A8A9A', fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: '0.3px' }}>{micState === 'listening' ? '…' : micState === 'done' ? `${micResult?.score}%` : 'Mic'}</span>
                </div>
              </div>
              {micState === 'unsupported' && (
                <p style={{ color: '#ff9800', fontSize: '0.75rem', fontStyle: 'italic', marginTop: '6px', textAlign: 'center' }}>Dein Browser unterstützt keine Spracherkennung — bitte Chrome verwenden</p>
              )}
              {micResult && (
                <div style={{ marginTop: '8px', textAlign: 'center', animation: 'vocaraFadeIn 0.3s ease both' }}>
                  <p style={{ fontSize: '0.88rem', fontWeight: '700', margin: '0 0 2px', color: micResult.score >= 80 ? '#4CAF50' : micResult.score >= 50 ? '#FFA500' : '#e53935' }}>
                    {lang === 'de' ? 'Aussprache: ' : 'Pronunciation: '}{micResult.score}%
                  </p>
                  <p style={{ fontSize: '0.75rem', margin: '0 0 6px', fontStyle: 'italic', color: micResult.score >= 80 ? '#4CAF50' : micResult.score >= 50 ? '#FFA500' : '#e53935' }}>
                    {micResult.score >= 80 ? (lang === 'de' ? 'Sehr gut verständlich' : 'Very clearly understandable') : micResult.score >= 50 ? (lang === 'de' ? 'Gut, aber noch etwas üben' : 'Good, but keep practicing') : (lang === 'de' ? 'Nochmal versuchen' : 'Try again')}
                  </p>
                  <p style={{ fontSize: '1rem', letterSpacing: '2px', margin: '0 0 6px' }}>
                    {micResult.words.map((w, i) => (
                      <span key={i} style={{ color: w.correct ? '#4CAF50' : '#e53935', marginRight: '4px' }}>{w.word}</span>
                    ))}
                  </p>
                  {micResult.transcript && <p style={{ fontSize: '0.68rem', color: '#8A8A9A', margin: '0 0 6px', fontStyle: 'italic' }}>„{micResult.transcript}"</p>}
                  <button onClick={() => { setMicState('idle'); setMicResult(null) }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '4px 12px', color: '#8A8A9A', fontSize: '0.72rem', cursor: 'pointer' }}>
                    🔄 {lang === 'de' ? 'Nochmal' : 'Try again'}
                  </button>
                </div>
              )}
              {showPronunciation && (
                <p style={s.cardPronunciation}>
                  🔊 {t.pronunciation}:{' '}
                  {(item.langA === 'th' || item.langB === 'th')
                    ? <ThaiColorPronunciation text={item.pronunciation} />
                    : item.pronunciation}
                </p>
              )}
              {fromLang === 'de' && toLang === 'en' && phoneticCache[item.id] && (
                <p style={{ ...s.cardPronunciation, fontStyle: 'italic', marginTop: '2px' }}>🗣 /{phoneticCache[item.id]}/</p>
              )}
              {!phoneticCache[item.id] && cardProgress[item.id]?._phonetic && (
                <p style={{ ...s.cardPronunciation, fontStyle: 'italic', marginTop: '2px', color: 'rgba(255,255,255,0.4)' }}>🗣 /{cardProgress[item.id]._phonetic}/</p>
              )}
              {item.context && <p style={s.cardContext}>„{item.context}"</p>}
              {item.category === 'vocabulary' && exampleSentence && (
                <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', maxWidth: '310px', textAlign: 'center' }}>
                  <p style={{ color: s.cardFront.color || '#fff', fontSize: '0.78rem', margin: '0 0 4px', fontStyle: 'italic', opacity: 0.85 }}>{exampleSentence.from}</p>
                  <p style={{ color: s.cardContext?.color || '#888', fontSize: '0.72rem', margin: 0, fontStyle: 'italic' }}>{exampleSentence.to}</p>
                </div>
              )}
              {item.category === 'vocabulary' && !exampleSentence && revealed && (
                <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.68rem', marginTop: '6px', fontStyle: 'italic' }}>…</p>
              )}
              {noteText && <p style={{ color: '#8A8A9A', fontSize: '0.75rem', fontStyle: 'italic', marginTop: '6px', maxWidth: '300px', textAlign: 'center' }}>📝 {noteText}</p>}
            </div>
          )}
        </div>
      </div>
      {noteOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 8800, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 16px 40px' }}
          onClick={() => setNoteOpen(false)}>
          <div style={{ width: '100%', maxWidth: '440px', background: 'rgba(20,20,28,0.96)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '20px', padding: '18px 16px', animation: 'vocaraFadeIn 0.2s ease both' }}
            onClick={e => e.stopPropagation()}>
            <p style={{ color: '#8A8A9A', fontSize: '0.75rem', marginBottom: '10px', letterSpacing: '0.3px' }}>📝 {lang === 'de' ? 'Persönliche Notiz' : 'Personal note'}</p>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              maxLength={150}
              rows={3}
              placeholder={lang === 'de' ? 'Notiz zu dieser Karte…' : 'Note about this card…'}
              style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '10px 12px', color: '#ccc', fontSize: '0.88rem', backdropFilter: 'blur(8px)', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <span style={{ color: '#8A8A9A', fontSize: '0.7rem' }}>{noteText.length}/150</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setNoteOpen(false)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '7px 14px', color: '#8A8A9A', fontSize: '0.82rem', cursor: 'pointer' }}>
                  {lang === 'de' ? 'Abbrechen' : 'Cancel'}
                </button>
                <button onClick={async () => {
                  const updated = { ...newProgress, [item.id]: { ...(newProgress[item.id] || {}), _note: noteText } }
                  setNewProgress(updated); setNoteOpen(false)
                  await onSaveState?.(queue, index, updated)
                }} style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', padding: '7px 16px', color: '#e0e0e0', fontSize: '0.82rem', cursor: 'pointer', fontWeight: '600' }}>
                  ✓ {lang === 'de' ? 'Speichern' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {kiExplanation && (
        <div style={{ width: '100%', marginBottom: '8px', background: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.22)', borderRadius: '12px', padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            {kiExplanation === 'loading'
              ? <p style={{ color: '#8A8A9A', fontSize: '0.78rem', margin: 0 }}>💡 {lang === 'de' ? 'KI erklärt…' : 'AI explaining…'}</p>
              : <p style={{ color: '#81c784', fontSize: '0.78rem', margin: 0, lineHeight: 1.5 }}>💡 {kiExplanation}</p>
            }
          </div>
          {kiExplanation !== 'loading' && (
            <button onClick={() => setKiExplanation(null)} style={{ background: 'transparent', border: 'none', color: '#8A8A9A', cursor: 'pointer', fontSize: '0.9rem', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>✕</button>
          )}
        </div>
      )}
      {patternTip && (
        <div style={{ width: '100%', marginBottom: '8px', background: 'rgba(255,200,50,0.07)', border: '1px solid rgba(255,200,50,0.24)', borderRadius: '12px', padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '8px', animation: 'vocaraFadeIn 0.4s ease both' }}>
          <div style={{ flex: 1 }}>
            <p style={{ color: s.easyBtn.color, fontSize: '0.7rem', fontWeight: '700', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              {patternTip === 'loading' ? `💡 ${lang === 'de' ? 'KI analysiert Muster…' : 'AI analysing pattern…'}` : `💡 ${lang === 'de' ? 'KI hat ein Muster erkannt' : 'AI spotted a pattern'}`}
            </p>
            {patternTip !== 'loading' && (
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.78rem', margin: 0, lineHeight: 1.5 }}>{patternTip}</p>
            )}
          </div>
          {patternTip !== 'loading' && (
            <button onClick={() => setPatternTip(null)} style={{ background: 'transparent', border: 'none', color: '#8A8A9A', cursor: 'pointer', fontSize: '0.9rem', padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>✕</button>
          )}
        </div>
      )}
      {revealed && item.category === 'sentence' && (newProgress[item.id]?.interval || cardProgress[item.id]?.interval || 0) >= 3 && (
        <div style={{ width: '100%', marginBottom: '8px' }}>
          {!kontextVariation && (
            <button onClick={async () => {
              setKontextVariation('loading')
              try {
                const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                  model: 'claude-haiku-4-5-20251001', max_tokens: 180,
                  messages: [{ role: 'user', content: `For the phrase "${item?.front}" (meaning: "${item?.back}"), give 3 very short context variants in ${item?.langA === 'de' ? 'German' : 'English'}:\n1. Formal (1 example sentence)\n2. Informal (1 example sentence)\n3. Romantic (1 example sentence)\nFormat: formal: ...\ninformal: ...\nromantic: ...` }]
                })})
                const text = (await res.json()).content?.[0]?.text?.trim() || ''
                const formal = text.match(/formal:\s*(.+)/i)?.[1]?.trim() || ''
                const informal = text.match(/informal:\s*(.+)/i)?.[1]?.trim() || ''
                const romantic = text.match(/romantic:\s*(.+)/i)?.[1]?.trim() || ''
                setKontextVariation({ formal, informal, romantic })
                setKontextOpen(true)
              } catch { setKontextVariation(null) }
            }} style={{ background: 'rgba(100,120,255,0.08)', border: '1px solid rgba(100,120,255,0.22)', borderRadius: '10px', padding: '6px 12px', color: '#9A9AFF', fontSize: '0.72rem', cursor: 'pointer', fontWeight: '600', letterSpacing: '0.3px' }}>
              🔄 {lang === 'de' ? 'Kontext' : 'Context'}
            </button>
          )}
          {kontextVariation === 'loading' && <p style={{ color: '#9A9AFF', fontSize: '0.72rem', margin: '4px 0' }}>🔄 {lang === 'de' ? 'Kontext wird geladen…' : 'Loading context…'}</p>}
          {kontextVariation && kontextVariation !== 'loading' && (
            <div style={{ background: 'rgba(100,120,255,0.07)', border: '1px solid rgba(100,120,255,0.20)', borderRadius: '12px', padding: '10px 14px', animation: 'vocaraFadeIn 0.3s ease both' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <p style={{ color: '#9A9AFF', fontSize: '0.7rem', fontWeight: '700', margin: 0, textTransform: 'uppercase', letterSpacing: '0.6px' }}>🔄 {lang === 'de' ? 'Kontextvarianten' : 'Context variants'}</p>
                <button onClick={() => { setKontextVariation(null); setKontextOpen(false) }} style={{ background: 'transparent', border: 'none', color: '#8A8A9A', cursor: 'pointer', fontSize: '0.9rem', padding: '0 2px' }}>✕</button>
              </div>
              {kontextOpen && (
                <>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', margin: '0 0 3px' }}><span style={{ color: '#9A9AFF', fontWeight: '600' }}>Formell:</span> {kontextVariation.formal}</p>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', margin: '0 0 3px' }}><span style={{ color: '#9A9AFF', fontWeight: '600' }}>Informell:</span> {kontextVariation.informal}</p>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem', margin: 0 }}><span style={{ color: '#e88aff', fontWeight: '600' }}>Romantisch:</span> {kontextVariation.romantic}</p>
                </>
              )}
              {!kontextOpen && <button onClick={() => setKontextOpen(true)} style={{ background: 'transparent', border: 'none', color: '#9A9AFF', fontSize: '0.72rem', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>{lang === 'de' ? 'anzeigen' : 'show'}</button>}
            </div>
          )}
        </div>
      )}
      {revealed && (
        <div style={s.answerRow}>
          <button style={s.wrongBtn} onClick={() => handleAnswerAnimated(false)}>❌ {t.wrong}</button>
          <button style={s.fastBtn} onClick={handleFastAnimated}>😕 {t.fast}</button>
          <button style={s.rightBtn} onClick={() => handleAnswerAnimated(true)}>✅ {t.correct}</button>
          <button style={s.easyBtn} onClick={handleEasyAnimated}>{t.easy}</button>
        </div>
      )}
    </div></div>
  )
}

export default CardScreen
