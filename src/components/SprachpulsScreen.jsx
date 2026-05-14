import React, { useState, useEffect, useRef } from 'react'
import { getDocs, collection, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { resolveTheme, makeStyles } from '../theme'

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1']
const CEFR_EMOJI = { A1: '🌱', A2: '🌿', B1: '🌳', B2: '🚀', C1: '⭐' }
const QUESTIONS_PER_LEVEL = 5
const PASS_THRESHOLD = 3

const CEFR_DESCRIPTIONS = {
  A1: { title: 'Einsteiger', short: 'Du kennst erste Wörter und einfachste Phrasen.', detail: 'Du kannst vertraute Wörter und ganz einfache Sätze verstehen und verwenden.' },
  A2: { title: 'Grundkenntnisse', short: 'Du kannst einfache Alltagssituationen meistern.', detail: 'Du verstehst Sätze zu vertrauten Themen wie Familie, Einkaufen und Arbeit.' },
  B1: { title: 'Mittelstufe', short: 'Du kannst dich in vertrauten Situationen verständigen.', detail: 'Du verstehst die Hauptaussagen klarer Texte zu bekannten Themen.' },
  B2: { title: 'Obere Mittelstufe', short: 'Du kannst komplexere Themen diskutieren.', detail: 'Du verstehst komplexe Texte und kannst dich spontan und fließend unterhalten.' },
  C1: { title: 'Fortgeschritten', short: 'Du sprichst fließend und spontan.', detail: 'Du kannst anspruchsvolle Texte verstehen und implizite Bedeutungen erfassen.' },
}

function SprachpulsScreen({ user, myData, setMyData, theme, th: thProp, s: sProp, lightMode, lang, onBack, onComplete }) {
  const th = thProp || resolveTheme(theme, lightMode ?? false)
  const s = sProp || makeStyles(th)
  const isDE = lang === 'de'

  const currentCEFR = myData?.cefr || myData?.sprachkompassResult || 'A2'
  const currentIdx = Math.max(0, Math.min(CEFR_LEVELS.length - 1, CEFR_LEVELS.indexOf(currentCEFR)))
  const belowIdx = Math.max(0, currentIdx - 1)
  const aboveIdx = Math.min(CEFR_LEVELS.length - 1, currentIdx + 1)
  const testLevels = [...new Set([CEFR_LEVELS[belowIdx], CEFR_LEVELS[currentIdx], CEFR_LEVELS[aboveIdx]])]

  const [phase, setPhase] = useState('intro')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [questionsByLevel, setQuestionsByLevel] = useState({})
  const [levelScores, setLevelScores] = useState({})
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0)
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [levelCorrect, setLevelCorrect] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [determinedLevel, setDeterminedLevel] = useState(null)
  const [trend, setTrend] = useState(null)
  const [saving, setSaving] = useState(false)
  const [usedIds, setUsedIds] = useState([])
  const advanceTimer = useRef(null)

  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current) }, [])

  const currentLevel = testLevels[currentLevelIdx]
  const currentQuestions = questionsByLevel[currentLevel] || []
  const currentQuestion = currentQuestions[currentQuestionIdx]
  const answeredSoFar = testLevels.slice(0, currentLevelIdx).reduce((n, l) => n + (questionsByLevel[l]?.length || QUESTIONS_PER_LEVEL), 0) + currentQuestionIdx
  const totalQuestions = testLevels.length * QUESTIONS_PER_LEVEL

  const loadQuestions = async () => {
    setLoading(true); setLoadError(null)
    try {
      const fromLang = (myData?.fromLang || 'de').toLowerCase()
      const toLangs = myData?.toLangs?.length > 0 ? myData.toLangs.map(l => l.lang) : [myData?.toLang || 'en']
      const toLang = toLangs[0].toLowerCase()
      const usedHistory = myData?.sprachpulsHistory || []

      const snap = await getDocs(collection(db, 'testCards'))
      const byLevel = {}
      snap.forEach(d => {
        const data = d.data()
        if (data.testType !== 'sprachpuls') return
        if ((data.fromLang || '').toLowerCase() !== fromLang) return
        if ((data.toLang || '').toLowerCase() !== toLang) return
        if (!data.cefrLevel || !data.questions?.length) return
        if (!testLevels.includes(data.cefrLevel)) return
        const available = data.questions.filter(q => !usedHistory.includes(q.id))
        if (available.length > 0) byLevel[data.cefrLevel] = available.slice(0, QUESTIONS_PER_LEVEL)
      })

      if (Object.keys(byLevel).length === 0) {
        setLoadError(isDE
          ? 'Keine Sprachpuls-Fragen gefunden. Bitte zuerst den Pool im Admin-Bereich generieren.'
          : 'No Sprachpuls questions found. Please generate the pool in Admin first.')
        setLoading(false); return
      }

      const ids = Object.values(byLevel).flat().map(q => q.id).filter(Boolean)
      setUsedIds(ids)
      setQuestionsByLevel(byLevel)
      setPhase('testing')
    } catch (e) {
      setLoadError(isDE ? 'Fehler beim Laden. Bitte erneut versuchen.' : 'Load error. Please try again.')
    }
    setLoading(false)
  }

  const handleAnswer = (choice) => {
    if (selectedAnswer !== null || !currentQuestion) return
    const isCorrect = choice === currentQuestion.correct
    setSelectedAnswer(choice)
    setFeedback(isCorrect ? 'correct' : 'wrong')
    const newLevelCorrect = isCorrect ? levelCorrect + 1 : levelCorrect

    advanceTimer.current = setTimeout(() => {
      setSelectedAnswer(null); setFeedback(null)
      const nextQuestionIdx = currentQuestionIdx + 1
      const levelDone = nextQuestionIdx >= currentQuestions.length || nextQuestionIdx >= QUESTIONS_PER_LEVEL

      if (!levelDone) {
        setCurrentQuestionIdx(nextQuestionIdx)
        if (isCorrect) setLevelCorrect(newLevelCorrect)
        return
      }

      if (isCorrect) setLevelCorrect(0)
      const finalCorrect = newLevelCorrect
      const newLevelScores = { ...levelScores, [currentLevel]: finalCorrect }
      setLevelScores(newLevelScores)

      const nextLevelIdx = currentLevelIdx + 1
      if (nextLevelIdx < testLevels.length) {
        setCurrentLevelIdx(nextLevelIdx)
        setCurrentQuestionIdx(0)
        setLevelCorrect(0)
        return
      }

      // All done — determine result
      const topLevel = testLevels[testLevels.length - 1]
      const midLevel = testLevels[Math.floor(testLevels.length / 2)]
      const botLevel = testLevels[0]

      let determined
      if ((newLevelScores[topLevel] ?? 0) >= PASS_THRESHOLD) {
        determined = topLevel
      } else if ((newLevelScores[midLevel] ?? 0) >= PASS_THRESHOLD) {
        determined = midLevel
      } else {
        determined = botLevel
      }

      const prevIdx = CEFR_LEVELS.indexOf(myData?.cefr || myData?.sprachkompassResult || 'A2')
      const newIdx = CEFR_LEVELS.indexOf(determined)
      setDeterminedLevel(determined)
      setTrend(newIdx > prevIdx ? 'up' : newIdx < prevIdx ? 'down' : 'stable')
      setPhase('result')
    }, 1000)

    if (isCorrect) setLevelCorrect(newLevelCorrect)
  }

  const handleSaveAndComplete = async () => {
    if (!determinedLevel) return
    setSaving(true)
    const today = new Date().toISOString().slice(0, 10)
    const totalScore = Object.values(levelScores).reduce((a, b) => a + b, 0)
    const resultEntry = { date: today, cefrLevel: determinedLevel, score: `${totalScore}/${testLevels.length * QUESTIONS_PER_LEVEL}`, trend }
    try {
      const newResults = [...(myData?.sprachpulsResults || []), resultEntry]
      const newHistory = [...new Set([...(myData?.sprachpulsHistory || []), ...usedIds])]
      await updateDoc(doc(db, 'users', user.uid), {
        sprachpulsHistory: newHistory,
        sprachpulsResults: newResults,
        sprachkompassResult: determinedLevel,
        cefr: determinedLevel,
      })
      if (setMyData) setMyData(d => ({ ...d, sprachpulsHistory: newHistory, sprachpulsResults: newResults, sprachkompassResult: determinedLevel, cefr: determinedLevel }))
    } catch (e) { console.warn('SprachpulsScreen save failed:', e) }
    setSaving(false)
    onComplete?.(determinedLevel)
  }

  // ── INTRO ──────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div style={{ minHeight: '100vh', background: th.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }} className="vocara-screen">
        <div style={{ width: '100%', maxWidth: '440px', textAlign: 'center', animation: 'vocaraFadeIn 0.4s ease both' }}>
          <p style={{ fontSize: '4rem', margin: '0 0 16px' }}>📊</p>
          <h1 style={{ color: th.text, fontSize: '1.6rem', fontWeight: '800', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
            {isDE ? 'Sprachpuls' : 'Language Pulse'}
          </h1>
          <p style={{ color: th.sub, fontSize: '0.95rem', lineHeight: '1.7', margin: '0 0 8px' }}>
            {isDE
              ? `${totalQuestions} Fragen · ~5 Minuten · Aktueller Stand: ${currentCEFR}`
              : `${totalQuestions} questions · ~5 minutes · Current level: ${currentCEFR}`}
          </p>
          <p style={{ color: th.sub, fontSize: '0.85rem', lineHeight: '1.6', margin: '0 0 28px', opacity: 0.7 }}>
            {isDE
              ? 'Wir testen, ob du dich verbessert hast, stabil bist oder aufholen musst.'
              : 'We check if you have improved, are stable, or need to catch up.'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '28px', flexWrap: 'wrap' }}>
            {testLevels.map(l => (
              <span key={l} style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700', background: l === currentCEFR ? `${th.accent}20` : 'rgba(255,255,255,0.07)', color: l === currentCEFR ? th.accent : th.sub, border: `1px solid ${l === currentCEFR ? th.accent + '40' : th.border}` }}>{CEFR_EMOJI[l]} {l}</span>
            ))}
          </div>
          {loadError && <p style={{ color: '#e06c75', fontSize: '0.85rem', margin: '0 0 16px', padding: '10px 14px', background: 'rgba(224,108,117,0.1)', borderRadius: '10px', border: '1px solid rgba(224,108,117,0.25)' }}>{loadError}</p>}
          <button onClick={loadQuestions} disabled={loading}
            style={{ width: '100%', padding: '16px', borderRadius: '14px', fontSize: '1rem', fontWeight: '700', cursor: loading ? 'default' : 'pointer', background: th.accent, color: '#fff', border: 'none', opacity: loading ? 0.6 : 1, marginBottom: '12px' }}>
            {loading ? (isDE ? 'Laden…' : 'Loading…') : (isDE ? 'Puls messen →' : 'Measure pulse →')}
          </button>
          <button onClick={onBack}
            style={{ width: '100%', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', cursor: 'pointer', background: 'transparent', color: th.sub, border: `1px solid ${th.border}` }}>
            {isDE ? 'Zurück' : 'Back'}
          </button>
        </div>
      </div>
    )
  }

  // ── TESTING ────────────────────────────────────────────────────
  if (phase === 'testing') {
    if (!currentQuestion) return (
      <div style={{ minHeight: '100vh', background: th.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: th.sub }}>
        {isDE ? 'Keine Fragen für dieses Level…' : 'No questions for this level…'}
      </div>
    )
    const options = Object.entries(currentQuestion.options || {})
    const progressPct = Math.round((answeredSoFar / totalQuestions) * 100)

    return (
      <div style={{ minHeight: '100vh', background: th.bg, display: 'flex', flexDirection: 'column', padding: '0' }} className="vocara-screen">
        <div style={{ height: '3px', background: th.border, position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: th.accent, transition: 'width 0.4s ease', borderRadius: '0 2px 2px 0' }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 20px 32px', maxWidth: '520px', margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '700', background: `${th.accent}20`, color: th.accent, border: `1px solid ${th.accent}40` }}>
              {CEFR_EMOJI[currentLevel]} {currentLevel}
            </span>
            <span style={{ color: th.sub, fontSize: '0.75rem' }}>{answeredSoFar + 1} / {totalQuestions}</span>
          </div>
          <div style={{ ...s.card, width: '100%', textAlign: 'center', marginBottom: '20px', padding: '24px 20px' }}>
            <p style={{ color: th.text, fontSize: '1.05rem', fontWeight: '600', lineHeight: '1.5', margin: 0 }}>{currentQuestion.question}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
            {options.map(([key, text]) => {
              const isSelected = selectedAnswer === key
              const isCorrectOption = key === currentQuestion.correct
              let bg = 'rgba(255,255,255,0.05)', border = th.border, color = th.text
              if (feedback && isSelected && feedback === 'correct') { bg = 'rgba(40,180,80,0.18)'; border = '#81c784'; color = '#81c784' }
              if (feedback && isSelected && feedback === 'wrong') { bg = 'rgba(220,40,40,0.18)'; border = '#e06c75'; color = '#e06c75' }
              if (feedback && !isSelected && isCorrectOption) { bg = 'rgba(40,180,80,0.10)'; border = '#81c784'; color = '#81c784' }
              return (
                <button key={key} onClick={() => handleAnswer(key)} disabled={selectedAnswer !== null}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: '600', cursor: selectedAnswer !== null ? 'default' : 'pointer', background: bg, color, border: `1px solid ${border}`, textAlign: 'left', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: '800', opacity: 0.6, minWidth: '16px' }}>{key.toUpperCase()}</span>
                  {text}
                </button>
              )
            })}
          </div>
          {feedback && currentQuestion.explanation && (
            <div style={{ marginTop: '16px', padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${th.border}`, width: '100%' }}>
              <p style={{ color: th.sub, fontSize: '0.82rem', margin: 0, lineHeight: '1.5' }}>{currentQuestion.explanation}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── RESULT ─────────────────────────────────────────────────────
  if (phase === 'result' && determinedLevel) {
    const desc = CEFR_DESCRIPTIONS[determinedLevel]
    const trendEmoji = trend === 'up' ? '📈' : trend === 'down' ? '📉' : '➡️'
    const trendText = trend === 'up' ? (isDE ? 'Verbessert' : 'Improved') : trend === 'down' ? (isDE ? 'Nachgelassen' : 'Declined') : (isDE ? 'Stabil' : 'Stable')
    const trendColor = trend === 'up' ? '#81c784' : trend === 'down' ? '#e06c75' : th.sub
    const totalScore = Object.values(levelScores).reduce((a, b) => a + b, 0)
    const lastResult = (myData?.sprachpulsResults || []).slice(-1)[0]

    return (
      <div style={{ minHeight: '100vh', background: th.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }} className="vocara-screen">
        <div style={{ width: '100%', maxWidth: '440px', textAlign: 'center', animation: 'vocaraFadeIn 0.5s ease both' }}>
          <p style={{ fontSize: '5rem', margin: '0 0 8px', animation: 'vocaraFadeIn 0.6s 0.2s ease both' }}>{CEFR_EMOJI[determinedLevel]}</p>
          <p style={{ color: th.sub, fontSize: '0.85rem', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px' }}>
            {isDE ? 'Dein ungefähres Niveau' : 'Your approximate level'}
          </p>
          <h1 style={{ color: th.accent, fontSize: '3.5rem', fontWeight: '900', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            {determinedLevel} — {isDE ? desc.title : desc.title}
          </h1>
          <p style={{ color: th.sub, fontSize: '0.88rem', lineHeight: '1.6', margin: '0 0 20px' }}>{isDE ? desc.short : desc.detail}</p>

          {/* Trend card */}
          <div style={{ ...s.card, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px', padding: '14px 20px' }}>
            <span style={{ fontSize: '1.6rem' }}>{trendEmoji}</span>
            <div style={{ textAlign: 'left' }}>
              <p style={{ color: trendColor, fontWeight: '700', fontSize: '1rem', margin: 0 }}>{trendText}</p>
              <p style={{ color: th.sub, fontSize: '0.75rem', margin: '2px 0 0' }}>{totalScore}/{testLevels.length * QUESTIONS_PER_LEVEL} {isDE ? 'korrekt' : 'correct'}</p>
            </div>
          </div>

          {/* Per-level breakdown */}
          <div style={{ ...s.card, textAlign: 'left', marginBottom: '16px', padding: '14px 16px' }}>
            <p style={{ color: th.sub, fontSize: '0.7rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>
              {isDE ? 'Ergebnis nach Level' : 'Score by level'}
            </p>
            {testLevels.map(lvl => {
              const score = levelScores[lvl] ?? 0
              const pct = Math.round((score / QUESTIONS_PER_LEVEL) * 100)
              const barColor = pct >= 60 ? '#81c784' : pct >= 40 ? '#D4AF00' : '#e06c75'
              return (
                <div key={lvl} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: '700', minWidth: '36px', color: th.sub }}>{CEFR_EMOJI[lvl]} {lvl}</span>
                  <div style={{ flex: 1, height: '6px', background: th.border, borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: '3px', transition: 'width 0.6s ease' }} />
                  </div>
                  <span style={{ fontSize: '0.72rem', color: th.sub, minWidth: '32px', textAlign: 'right' }}>{score}/{QUESTIONS_PER_LEVEL}</span>
                </div>
              )
            })}
          </div>

          {lastResult && (
            <p style={{ color: th.sub, fontSize: '0.78rem', margin: '0 0 20px', opacity: 0.7 }}>
              {isDE ? `Letzter Test: ${lastResult.date}` : `Last test: ${lastResult.date}`}
            </p>
          )}

          <button onClick={handleSaveAndComplete} disabled={saving}
            style={{ width: '100%', padding: '16px', borderRadius: '14px', fontSize: '1rem', fontWeight: '700', cursor: saving ? 'default' : 'pointer', background: th.accent, color: '#fff', border: 'none', opacity: saving ? 0.6 : 1, marginBottom: '12px' }}>
            {saving ? '…' : (isDE ? 'Lernpfad anpassen →' : 'Apply learning path →')}
          </button>
          <button onClick={onBack}
            style={{ width: '100%', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', cursor: 'pointer', background: 'transparent', color: th.sub, border: `1px solid ${th.border}` }}>
            {isDE ? 'Überspringen' : 'Skip'}
          </button>
        </div>
      </div>
    )
  }

  return null
}

export default SprachpulsScreen
