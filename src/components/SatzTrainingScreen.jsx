// cache-bust-v3-SATZ-FIX
import React, { useState, useEffect, useRef } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { THEMES, makeStyles } from '../theme'
import { getCards, setCards } from '../hooks/useCardCache'
import { speak } from '../appShared'

function SatzTrainingScreen({ lang, theme, onBack, allCards, cardProgress, userName, userToLang = 'en', onSatzComplete, t: tProp }) {
  if (!lang || !theme) return null
  const th = THEMES[theme]; const s = makeStyles(th); const t = tProp
  const LANG_NAMES_FULL = { en: 'English', de: 'German', sw: 'Swahili', th: 'Thai', es: 'Spanish', fr: 'French', ar: 'Arabic', tr: 'Turkish', pt: 'Portuguese' }
  const ttsLangCode = userToLang.toLowerCase()
  const targetLang = LANG_NAMES_FULL[ttsLangCode] || ttsLangCode
  const fromLang = LANG_NAMES_FULL[lang] || lang

  const knownVocab = (allCards || []).filter(c =>
    c.category === 'vocabulary' && !/_r(_\d+)?$/.test(c.id) && ((cardProgress || {})[c.id]?.interval || 0) >= 2
  )

  const [exercises, setExercises] = useState([])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [userInput, setUserInput] = useState('')
  const [chipBank, setChipBank] = useState([])
  const [chipOrder, setChipOrder] = useState([])
  const [revealed, setRevealed] = useState(false)
  const [selfRating, setSelfRating] = useState(null)
  const [correct, setCorrect] = useState(0)
  const [done, setDone] = useState(false)
  const [semanticResult, setSemanticResult] = useState(null)
  const [difficultyScore, setDifficultyScore] = useState(0)
  const [difficulty, setDifficulty] = useState('leicht')
  const [autoEasy, setAutoEasy] = useState(false)
  const exerciseStartRef = useRef(Date.now())

  const ex = exercises[index]

  useEffect(() => { generateExercises('leicht') }, [])
  useEffect(() => { if (done && onSatzComplete) onSatzComplete(correct, exercises.length) }, [done])

  const levenshtein = (a, b) => {
    const m = a.length, n = b.length
    const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0))
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1])
    return dp[m][n]
  }

  const generateExercises = async (chosenDifficulty) => {
    setLoading(true); setError(null); setIndex(0); setDone(false)
    setCorrect(0); setRevealed(false); setSelfRating(null); setUserInput(''); setSemanticResult(null); setAutoEasy(false)

    const diffLabel = { leicht: 'beginner (A1-A2)', mittel: 'intermediate (B1)', schwer: 'advanced (B2-C1)' }[chosenDifficulty || 'mittel'] || 'intermediate (B1)'
    const diffKey = chosenDifficulty || 'mittel'
    const langPair = `${lang}_${userToLang}`

    try {
      const DIFF_TO_LEVELS = { leicht: [1,2,3,4], mittel: [5,6,7,8,9,10], schwer: [11,12,13,14] }
      const levels = DIFF_TO_LEVELS[diffKey] || [1,2,3,4]
      const cacheKey = `satz_${lang}_${userToLang}_${diffKey}`
      let rawExercises = getCards(cacheKey)
      console.log('[SATZ] cache check:', cacheKey, 'cached:', getCards(cacheKey))
      if (!rawExercises || rawExercises.length === 0) {
        try {
          const snaps = await Promise.all(levels.map(n => getDoc(doc(db, 'sharedExercises', `${lang}_${userToLang}_satz_level${n}`))))
          console.log('[SATZ] snaps:', snaps.map((s,i) => `level${levels[i]}:${s.exists()?'found':'missing'}`))
          rawExercises = snaps.flatMap(s => s.exists() ? (s.data().exercises || []) : [])
          if (rawExercises.length >= 8) setCards(cacheKey, rawExercises)
        } catch(err) { console.error('[SATZ] error:', err); setError(err.message) }
      }
      if (rawExercises && rawExercises.length >= 8) {
        const pool = rawExercises.map(ex => ({
          ...ex,
          chips: ex.chips && ex.chips.length > 0 ? ex.chips : (ex.type === 'order' ? ex.answer.split(' ') : undefined),
        }))
        const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 10)
        console.log('[SATZ] setting exercises:', rawExercises?.length)
        setExercises(shuffled)
        console.log('[SATZ] first exercise:', shuffled[0], 'index:', 0)
        exerciseStartRef.current = Date.now()
        if (shuffled[0]?.type === 'order') initChips(shuffled[0])
        setLoading(false)
        return
      }
    } catch (e) { console.warn('[Vocara] sharedSentences pool load failed, falling back to KI:', e.message) }

    const wordList = knownVocab.map(c => c?.back).slice(0, 30).join(', ')
    const prompt = `Create 8 varied grammar exercises for a ${targetLang} learner at ${diffLabel} level. Native language: ${fromLang}.
Use these known words where possible: ${wordList}
IMPORTANT: ALL hints, explanations, and question labels must be written in ${fromLang}, not ${targetLang}.
Mix exercise types: gap, order, tense, conjugation, translation. Return ONLY valid JSON array, no markdown:
[{"type":"gap","question":"She [___] to school every day.","answer":"goes","hint":"3. Person Singular Präsens","explanation":"Im Präsens wird bei der 3. Person Singular -s/-es angehängt."},
{"type":"order","question":"Arrange the words:","chips":["goes","she","school","to","every","day"],"answer":"She goes to school every day.","explanation":"Englische Wortstellung: Subjekt + Verb + Objekt."},
{"type":"tense","question":"She goes to school. (Vergangenheit →)","answer":"She went to school.","hint":"unregelmäßiges Verb","explanation":"go → went (unregelmäßig)."},
{"type":"conjugation","question":"sein + wir →","answer":"sind","hint":"unregelmäßig","explanation":"wir sind (unregelmäßige Konjugation)."},
{"type":"translation","question":"Übersetze: 'Ich möchte nach Hause gehen.'","answer":"I want to go home.","hint":"möchten = want to","explanation":"möchten wird mit want to übersetzt."}]`
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2200, messages: [{ role: 'user', content: prompt }] })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      const shuffled = [...parsed].sort(() => Math.random() - 0.5)
      setExercises(shuffled)
      exerciseStartRef.current = Date.now()
      if (shuffled[0]?.type === 'order') initChips(shuffled[0])
    } catch (e) { setError('api') }
    setLoading(false)
  }

  const initChips = (exercise) => {
    const chips = [...(exercise.chips || exercise.answer.split(' '))]
      .sort(() => Math.random() - 0.5)
      .map((w, i) => ({ word: w, id: i }))
    setChipBank(chips); setChipOrder([])
  }

  const needsSemanticEval = (type) => type === 'tense' || type === 'translation'

  const handleCheck = async () => {
    const hasInput = ex.type === 'order' ? chipOrder.length > 0 : userInput.trim()
    if (!hasInput) return
    if (Date.now() - exerciseStartRef.current < 4000) setAutoEasy(true)
    speak(ex.answer, ttsLangCode)
    setRevealed(true)
    if (needsSemanticEval(ex.type)) {
      setSemanticResult('loading')
      try {
        const evalPrompt = ex.type === 'translation'
          ? `Exercise: "${ex.question}"\nExpected: "${ex.answer}"\nUser wrote: "${userInput.trim()}"\nIs the meaning the same (minor grammar differences OK)? Reply ONLY JSON: {"ok":true/false,"feedback":"1 short ${fromLang} sentence"}`
          : `Exercise: "${ex.question}"\nExpected: "${ex.answer}"\nUser wrote: "${userInput.trim()}"\nIs the tense conversion correct? Reply ONLY JSON: {"ok":true/false,"feedback":"1 short grammar tip in ${fromLang}"}`
        const evalRes = await fetch('/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 100, messages: [{ role: 'user', content: evalPrompt }] })
        })
        const evalData = await evalRes.json()
        const evalText = (evalData.content?.[0]?.text || '').trim()
        setSemanticResult(JSON.parse(evalText.replace(/```json|```/g, '').trim()))
      } catch { setSemanticResult({ ok: false, feedback: '' }) }
    }
  }

  const handleRate = (rating) => {
    setSelfRating(rating)
    if (rating === 'right' || rating === 'easy') { setCorrect(c => c + 1); setDifficultyScore(d => Math.min(10, d + 1)) }
    else setDifficultyScore(d => Math.max(0, d - 1))
  }

  const handleNext = () => {
    const next = index + 1
    if (next >= exercises.length) { setDone(true); return }
    setIndex(next); setUserInput(''); setRevealed(false); setSelfRating(null); setSemanticResult(null); setAutoEasy(false)
    exerciseStartRef.current = Date.now()
    const nextEx = exercises[next]
    if (nextEx?.type === 'order') initChips(nextEx)
    else { setChipBank([]); setChipOrder([]) }
  }

  const addChip = (chip) => { if (revealed) return; setChipOrder(o => [...o, chip]); setChipBank(b => b.filter(c => c.id !== chip.id)) }
  const removeChip = (chip) => { if (revealed) return; setChipBank(b => [...b, chip]); setChipOrder(o => o.filter(c => c.id !== chip.id)) }

  const isAnswerCorrect = () => {
    if (ex.type === 'order') return chipOrder.map(c => c.word).join(' ').toLowerCase() === ex.answer.toLowerCase()
    if (needsSemanticEval(ex.type)) return semanticResult && semanticResult !== 'loading' ? semanticResult.ok : null
    const norm = str => str.trim().toLowerCase().replace(/[.,!?]/g, '')
    const u = norm(userInput), a = norm(ex.answer)
    if (ex.type === 'conjugation') return u === a || levenshtein(u, a) <= 1
    return u === a
  }

  const typeLabel = (type) => ({
    gap: lang === 'de' ? '✏️ Lückentext' : '✏️ Fill the gap',
    order: lang === 'de' ? '🔀 Wortstellung' : '🔀 Word order',
    tense: lang === 'de' ? '⏰ Zeitformen' : '⏰ Tense',
    conjugation: lang === 'de' ? '🔤 Konjugation' : '🔤 Conjugation',
    translation: lang === 'de' ? '🌐 Übersetzung' : '🌐 Translation',
  })[type] || type

  if (!difficulty && exercises.length === 0 && !loading) {
    const isDE = lang === 'de'
    const levels = [
      { key: 'leicht', label: t.diffLeicht, sub: t.diffLeichtSub },
      { key: 'mittel', label: t.diffMittel, sub: t.diffMittelSub },
      { key: 'schwer', label: t.diffSchwer, sub: t.diffSchwerSub },
    ]
    return (
      <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
        <button style={s.backBtn} onClick={onBack}>←</button>
        <p style={{ color: th.accent, fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 6px' }}>Satztraining</p>
        <p style={{ color: th.text, fontSize: '1.1rem', fontWeight: '700', margin: '0 0 4px' }}>{t.chooseDifficulty}</p>
        <p style={{ color: th.sub, fontSize: '0.82rem', margin: '0 0 20px' }}>{isDE ? `Übungen auf ${targetLang}` : `Exercises in ${targetLang}`}</p>
        {levels.map(lv => (
          <button key={lv.key} onClick={() => { setDifficulty(lv.key); generateExercises(lv.key) }}
            style={{ ...s.button, marginBottom: '10px', textAlign: 'left', display: 'flex', flexDirection: 'column', padding: '14px 18px' }}>
            <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{lv.label}</span>
            <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.75rem', marginTop: '2px' }}>{lv.sub}</span>
          </button>
        ))}
      </div></div>
    )
  }

  if (knownVocab.length < 5) return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>←</button>
      <p style={{ color: th.accent, fontSize: '2rem', marginBottom: '12px' }}>📚</p>
      <p style={{ color: th.text, fontSize: '1rem', marginBottom: '8px', fontWeight: '600' }}>{t.satzNotEnough}</p>
      <p style={{ color: th.sub, fontSize: '0.88rem', marginBottom: '20px', lineHeight: 1.5 }}>{t.satzNotEnoughDesc}</p>
      <button style={s.logoutBtn} onClick={onBack}>{t.back}</button>
    </div></div>
  )

  if (loading) return (
    <div style={s.container} className="vocara-screen">
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: th.accent, fontSize: '1.4rem', marginBottom: '12px' }}>✦</p>
        <p style={{ color: th.sub, fontSize: '0.9rem' }}>{t.generating}</p>
      </div>
    </div>
  )

  if (error) return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>←</button>
      <p style={{ color: th.text, marginBottom: '16px' }}>{t.connectionError}</p>
      <button style={s.button} onClick={generateExercises}>{t.retry}</button>
      <button style={s.logoutBtn} onClick={onBack}>{t.back}</button>
    </div></div>
  )

  if (done) return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <h1 style={s.title}>{t.satzDone}</h1>
      <div style={{ ...s.card, textAlign: 'center', padding: '24px' }}>
        <p style={{ color: th.gold, fontSize: '3rem', fontWeight: 'bold', margin: 0 }}>{correct}/{exercises.length}</p>
        <p style={{ color: th.sub, fontSize: '0.9rem', marginTop: '8px' }}>
          {correct === exercises.length ? '🏆 Perfekt!' : correct >= exercises.length * 0.7 ? '💪 Sehr gut!' : '📚 Weiter üben!'}
        </p>
        {difficultyScore >= 6 && <p style={{ color: th.accent, fontSize: '0.78rem', marginTop: '8px' }}>⬆️ {lang === 'de' ? 'Schwierigkeitsgrad steigt' : 'Difficulty increasing'}</p>}
      </div>
      <button style={s.button} onClick={() => { setDifficulty(null); setDone(false); setExercises([]); setIndex(0); setCorrect(0) }}>{t.newExercises}</button>
      <button style={s.logoutBtn} onClick={onBack}>{t.back}</button>
    </div></div>
  )

  if (!ex && exercises.length === 0 && !loading) return (
    <div style={{ ...s.screen, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
      <p style={{ color: th.text, fontSize: '1.1rem', textAlign: 'center', marginBottom: '24px' }}>
        ⚠️ Keine Übungen gefunden. Bitte im Admin-Bereich Satztraining generieren.
      </p>
      <button onClick={onBack} style={{ ...s.btn, background: th.accent }}>← Zurück</button>
    </div>
  )
  if (!ex) return null
  const correct_bool = revealed && semanticResult !== 'loading' ? isAnswerCorrect() : null

  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <div style={s.cardHeader}>
        <p style={s.greeting}>{index + 1} / {exercises.length}</p>
        <button style={s.stopBtn} onClick={onBack}>✕</button>
      </div>
      <div style={s.progressBar}><div style={{ ...s.progressFill, width: `${(index / exercises.length) * 100}%` }} /></div>

      <p style={{ color: th.sub, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', margin: '14px 0 10px' }}>
        {typeLabel(ex.type)}
        {difficultyScore >= 4 && <span style={{ marginLeft: '6px', color: th.gold }}>{'★'.repeat(Math.min(3, Math.floor(difficultyScore / 3)))}</span>}
      </p>

      <div style={{ ...s.bigCard, minHeight: '80px', marginBottom: '14px' }}>
        <p style={{ ...s.cardFront, marginBottom: ex.hint ? '6px' : 0 }}>{ex.question}</p>
        {ex.hint && <p style={{ color: th.sub, fontSize: '0.72rem', fontStyle: 'italic', margin: 0 }}>💡 {ex.hint}</p>}
      </div>

      {(ex.type === 'gap' || ex.type === 'tense' || ex.type === 'conjugation' || ex.type === 'translation') && (
        <div style={{ marginBottom: '14px' }}>
          <input
            value={userInput}
            onChange={e => !revealed && setUserInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !revealed && userInput.trim()) handleCheck() }}
            placeholder={ex.type === 'translation' ? (lang === 'de' ? 'Übersetzung eingeben…' : 'Enter translation…') : t.yourAnswer}
            disabled={revealed}
            style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: `1px solid ${revealed ? (correct_bool === null ? th.border : correct_bool ? '#4CAF50' : '#f44336') : th.border}`, background: th.card, color: th.text, fontSize: '1rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            autoFocus
          />
        </div>
      )}

      {ex.type === 'order' && (
        <>
          <div style={{ ...s.bigCard, minHeight: '60px', flexWrap: 'wrap', gap: '8px', padding: '12px', justifyContent: 'flex-start', alignItems: 'flex-start', marginBottom: '8px' }}>
            {chipOrder.length === 0
              ? <p style={{ color: th.sub, fontSize: '0.85rem', margin: 'auto' }}>{t.tapWords}</p>
              : chipOrder.map(chip => (
                <button key={chip.id} onClick={() => removeChip(chip)}
                  style={{ background: th.accent + '33', color: th.text, border: `1px solid ${th.accent}`, borderRadius: '8px', padding: '6px 12px', fontSize: '0.95rem', cursor: revealed ? 'default' : 'pointer' }}>
                  {chip.word}
                </button>
              ))
            }
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '14px' }}>
            {chipBank.map(chip => (
              <button key={chip.id} onClick={() => addChip(chip)}
                style={{ background: th.card, color: th.text, border: `1px solid ${th.border}`, borderRadius: '8px', padding: '6px 12px', fontSize: '0.95rem', cursor: revealed ? 'default' : 'pointer' }}>
                {chip.word}
              </button>
            ))}
          </div>
        </>
      )}

      {revealed && semanticResult === 'loading' && (
        <p style={{ color: th.sub, fontSize: '0.78rem', textAlign: 'center', marginBottom: '10px' }}>✦ {lang === 'de' ? 'KI bewertet…' : 'AI evaluating…'}</p>
      )}

      {revealed && semanticResult !== 'loading' && (
        <div style={{ marginBottom: '14px', animation: 'vocaraFadeIn 0.3s ease both' }}>
          <p style={{ color: correct_bool ? '#4CAF50' : '#f44336', fontWeight: 'bold', fontSize: '1rem', marginBottom: '8px' }}>
            {correct_bool ? `✓ ${ex.answer}` : `✗ ${lang === 'de' ? 'Lösung' : 'Answer'}: ${ex.answer}`}
          </p>
          {semanticResult?.feedback && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${th.border}`, borderRadius: '10px', padding: '8px 12px', marginBottom: '6px' }}>
              <p style={{ color: correct_bool ? '#81c784' : '#FFB74D', fontSize: '0.78rem', margin: 0, lineHeight: 1.5 }}>💬 {semanticResult.feedback}</p>
            </div>
          )}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${th.border}`, borderRadius: '10px', padding: '10px 14px' }}>
            <p style={{ color: th.sub, fontSize: '0.78rem', margin: 0, lineHeight: 1.6 }}>📖 {ex.explanation}</p>
          </div>
        </div>
      )}

      {!revealed && (
        <button
          style={{ ...s.button, opacity: (ex.type === 'order' ? chipOrder.length > 0 : userInput.trim().length > 0) ? 1 : 0.4 }}
          onClick={handleCheck}
          disabled={ex.type === 'order' ? chipOrder.length === 0 : !userInput.trim()}
        >
          {t.checkBtn}
        </button>
      )}

      {revealed && semanticResult !== 'loading' && !selfRating && (
        <div style={{ marginTop: '8px' }}>
          {autoEasy && <p style={{ color: '#FFD700', fontSize: '0.7rem', fontWeight: '700', textAlign: 'center', margin: '0 0 6px', letterSpacing: '0.3px' }}>⚡ {lang === 'de' ? 'Schnelle Antwort!' : 'Quick answer!'}</p>}
          <div style={{ ...s.answerRow }}>
            <button style={s.wrongBtn} onClick={() => handleRate('wrong')}>❌ {lang === 'de' ? 'Falsch' : 'Wrong'}</button>
            <button style={s.fastBtn} onClick={() => handleRate('fast')}>😕 {lang === 'de' ? 'Fast' : 'Almost'}</button>
            <button style={{ ...s.rightBtn }} onClick={() => handleRate(autoEasy ? 'easy' : 'right')}>
              {autoEasy ? '⚡' : '✅'} {lang === 'de' ? 'Richtig' : 'Correct'}
            </button>
          </div>
        </div>
      )}

      {revealed && semanticResult !== 'loading' && selfRating && (
        <button style={s.button} onClick={handleNext}>
          {index + 1 < exercises.length ? t.nextBtn : t.finishBtn}
        </button>
      )}
    </div></div>
  )
}

export default SatzTrainingScreen
