import React, { useState, useEffect, useRef } from 'react'
import { getDocs, collection, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { THEMES, makeStyles, resolveTheme } from '../theme'

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1']

const CEFR_DESCRIPTIONS = {
  A1: { de: 'Absolute Anfänger · Grundlegende Ausdrücke und einfache Sätze', en: 'Absolute beginner · Basic phrases and simple sentences' },
  A2: { de: 'Grundkenntnisse · Einfache Alltagssituationen meistern', en: 'Elementary · Handle simple everyday situations' },
  B1: { de: 'Mittelstufe · Vertraute Themen verständlich ausdrücken', en: 'Intermediate · Express yourself on familiar topics' },
  B2: { de: 'Gute Mittelstufe · Komplexe Texte verstehen', en: 'Upper intermediate · Understand complex texts' },
  C1: { de: 'Fortgeschritten · Fließend und präzise kommunizieren', en: 'Advanced · Communicate fluently and precisely' },
}

const CEFR_EMOJI = { A1: '🌱', A2: '🌿', B1: '🌳', B2: '🚀', C1: '⭐' }

const CEFR_TO_POOL_LEVEL = {
  A1: { grundlagen: 1,  vocab: 1,  street: 1,  home: 1,  urlaub: 1,  satztraining: 1  },
  A2: { grundlagen: 3,  vocab: 3,  street: 2,  home: 2,  urlaub: 2,  satztraining: 2  },
  B1: { grundlagen: 5,  vocab: 7,  street: 5,  home: 4,  urlaub: 4,  satztraining: 5  },
  B2: { grundlagen: 8,  vocab: 13, street: 9,  home: 8,  urlaub: 7,  satztraining: 9  },
  C1: { grundlagen: 10, vocab: 18, street: 12, home: 12, urlaub: 10, satztraining: 14 },
}

function SprachkompassScreen({ user, myData, setMyData, theme, th: thProp, s: sProp, lightMode, lang, onBack, onComplete }) {
  const th = thProp || resolveTheme(theme, lightMode ?? false)
  const s = sProp || makeStyles(th)
  const isDE = lang === 'de'

  const [phase, setPhase] = useState('intro')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [allQuestions, setAllQuestions] = useState({})
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0)
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [levelCorrect, setLevelCorrect] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [determinedLevel, setDeterminedLevel] = useState(null)
  const [saving, setSaving] = useState(false)
  const advanceTimer = useRef(null)

  const currentLevel = CEFR_LEVELS[currentLevelIdx]
  const currentQuestions = allQuestions[currentLevel] || []
  const currentQuestion = currentQuestions[currentQuestionIdx]
  const totalQuestionsInTest = CEFR_LEVELS.reduce((n, lvl) => n + (allQuestions[lvl]?.length || 4), 0)
  const answeredSoFar = currentLevelIdx * 4 + currentQuestionIdx

  useEffect(() => () => { if (advanceTimer.current) clearTimeout(advanceTimer.current) }, [])

  const loadQuestions = async () => {
    setLoading(true); setLoadError(null)
    try {
      const fromLang = (myData?.fromLang || 'de').toLowerCase()
      const toLangs = myData?.toLangs?.length > 0
        ? myData.toLangs.map(l => l.lang)
        : [myData?.toLang || 'en']
      const toLang = toLangs[0].toLowerCase()

      const snap = await getDocs(collection(db, 'testCards'))
      const byLevel = {}
      snap.forEach(d => {
        const data = d.data()
        if (data.testType !== 'sprachkompass') return
        if ((data.fromLang || '').toLowerCase() !== fromLang) return
        if ((data.toLang || '').toLowerCase() !== toLang) return
        if (!data.cefrLevel || !data.questions?.length) return
        byLevel[data.cefrLevel] = data.questions
      })
      if (Object.keys(byLevel).length === 0) {
        setLoadError(isDE
          ? 'Keine Testfragen gefunden. Bitte zuerst den Pool im Admin-Bereich generieren.'
          : 'No test questions found. Please generate the pool in the Admin section first.')
        setLoading(false); return
      }
      setAllQuestions(byLevel)
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
      const levelDone = nextQuestionIdx >= currentQuestions.length || nextQuestionIdx >= 4

      if (!levelDone) {
        setCurrentQuestionIdx(nextQuestionIdx)
        if (isCorrect) setLevelCorrect(newLevelCorrect)
        return
      }

      // Level complete — evaluate
      if (isCorrect) setLevelCorrect(0)
      const finalCorrect = newLevelCorrect
      const passed = finalCorrect >= 3
      const nextLevelIdx = currentLevelIdx + 1

      if (!passed || nextLevelIdx >= CEFR_LEVELS.length) {
        const determined = passed ? 'C1' : CEFR_LEVELS[currentLevelIdx]
        setDeterminedLevel(determined)
        setPhase('result')
      } else {
        setCurrentLevelIdx(nextLevelIdx)
        setCurrentQuestionIdx(0)
        setLevelCorrect(0)
      }
    }, 1000)

    if (isCorrect) setLevelCorrect(newLevelCorrect)
  }

  const handleSaveAndComplete = async () => {
    if (!determinedLevel) return
    setSaving(true)
    const levels = CEFR_TO_POOL_LEVEL[determinedLevel]
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        categoryLevels: levels,
        cefr: determinedLevel,
        lastTestDate: new Date().toISOString().slice(0, 10),
      })
      if (setMyData) setMyData(d => ({ ...d, categoryLevels: levels, cefr: determinedLevel }))
    } catch (e) { console.warn('SprachkompassScreen save failed:', e) }
    setSaving(false)
    onComplete?.(determinedLevel)
  }

  // ── INTRO ──────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <div style={{ minHeight: '100vh', background: th.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }} className="vocara-screen">
        <div style={{ width: '100%', maxWidth: '440px', textAlign: 'center', animation: 'vocaraFadeIn 0.4s ease both' }}>
          <p style={{ fontSize: '4rem', margin: '0 0 16px' }}>🧭</p>
          <h1 style={{ color: th.text, fontSize: '1.6rem', fontWeight: '800', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
            {isDE ? 'Sprachkompass' : 'Language Compass'}
          </h1>
          <p style={{ color: th.sub, fontSize: '0.95rem', lineHeight: '1.7', margin: '0 0 32px' }}>
            {isDE
              ? '20 Fragen · 5 Niveaus · ~5 Minuten\nWir ermitteln deinen Sprachstand und passen deinen Lernpfad an.'
              : '20 questions · 5 levels · ~5 minutes\nWe determine your level and customize your learning path.'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
            {CEFR_LEVELS.map(l => (
              <span key={l} style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: '700', background: 'rgba(255,255,255,0.07)', color: th.sub, border: `1px solid ${th.border}` }}>{CEFR_EMOJI[l]} {l}</span>
            ))}
          </div>
          {loadError && <p style={{ color: '#e06c75', fontSize: '0.85rem', margin: '0 0 16px', padding: '10px 14px', background: 'rgba(224,108,117,0.1)', borderRadius: '10px', border: '1px solid rgba(224,108,117,0.25)' }}>{loadError}</p>}
          <button onClick={loadQuestions} disabled={loading}
            style={{ width: '100%', padding: '16px', borderRadius: '14px', fontSize: '1rem', fontWeight: '700', cursor: loading ? 'default' : 'pointer', background: th.accent, color: '#fff', border: 'none', opacity: loading ? 0.6 : 1, marginBottom: '12px' }}>
            {loading ? (isDE ? 'Laden…' : 'Loading…') : (isDE ? 'Test starten →' : 'Start test →')}
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
    const progressPct = Math.round((answeredSoFar / 20) * 100)

    return (
      <div style={{ minHeight: '100vh', background: th.bg, display: 'flex', flexDirection: 'column', padding: '0' }} className="vocara-screen">
        {/* Progress bar */}
        <div style={{ height: '3px', background: th.border, position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: th.accent, transition: 'width 0.4s ease', borderRadius: '0 2px 2px 0' }} />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '56px 20px 32px', maxWidth: '520px', margin: '0 auto', width: '100%' }}>
          {/* Level badge + counter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
            <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '700', background: `${th.accent}20`, color: th.accent, border: `1px solid ${th.accent}40` }}>
              {CEFR_EMOJI[currentLevel]} {currentLevel}
            </span>
            <span style={{ color: th.sub, fontSize: '0.75rem' }}>
              {answeredSoFar + 1} / 20
            </span>
          </div>

          {/* Question */}
          <div style={{ ...s.card, width: '100%', textAlign: 'center', marginBottom: '20px', padding: '24px 20px' }}>
            <p style={{ color: th.text, fontSize: '1.05rem', fontWeight: '600', lineHeight: '1.5', margin: 0 }}>
              {currentQuestion.question}
            </p>
          </div>

          {/* Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
            {options.map(([key, text]) => {
              const isSelected = selectedAnswer === key
              const isCorrectOption = key === currentQuestion.correct
              let bg = 'rgba(255,255,255,0.05)'
              let border = th.border
              let color = th.text
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

          {/* Explanation after answer */}
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
    const levels = CEFR_TO_POOL_LEVEL[determinedLevel]
    return (
      <div style={{ minHeight: '100vh', background: th.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }} className="vocara-screen">
        <div style={{ width: '100%', maxWidth: '440px', textAlign: 'center', animation: 'vocaraFadeIn 0.5s ease both' }}>
          <p style={{ fontSize: '5rem', margin: '0 0 8px', animation: 'vocaraFadeIn 0.6s 0.2s ease both' }}>{CEFR_EMOJI[determinedLevel]}</p>
          <p style={{ color: th.sub, fontSize: '0.85rem', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px' }}>
            {isDE ? 'Dein Sprachstand' : 'Your level'}
          </p>
          <h1 style={{ color: th.accent, fontSize: '3.5rem', fontWeight: '900', margin: '0 0 12px', letterSpacing: '-0.02em' }}>
            {determinedLevel}
          </h1>
          <p style={{ color: th.text, fontSize: '0.95rem', lineHeight: '1.6', margin: '0 0 24px' }}>
            {isDE ? desc.de : desc.en}
          </p>

          {/* Category levels preview */}
          <div style={{ ...s.card, textAlign: 'left', marginBottom: '24px', padding: '16px' }}>
            <p style={{ color: th.sub, fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>
              {isDE ? 'Dein Lernpfad' : 'Your learning path'}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.entries(levels).map(([cat, lvl]) => (
                <span key={cat} style={{ padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '600', background: `${th.accent}15`, color: th.accent, border: `1px solid ${th.accent}30` }}>
                  {cat} L{lvl}
                </span>
              ))}
            </div>
          </div>

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

export default SprachkompassScreen
