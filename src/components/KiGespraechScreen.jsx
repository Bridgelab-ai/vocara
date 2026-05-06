import React, { useState, useRef, useEffect } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { MARK_UID, ELOSY_UID, SOCIAL_REGISTERS, socialRegisterContext, getTenseUnlocks, speak } from '../appShared'

const KI_SCENARIOS = [
  { key: 'hotel',      emoji: '🏨', de: 'Hotel einchecken',      en: 'Hotel check-in',      role: 'hotel receptionist' },
  { key: 'car',        emoji: '🚗', de: 'Auto mieten',            en: 'Car rental',          role: 'car rental agent' },
  { key: 'directions', emoji: '🗺️', de: 'Nach dem Weg fragen',    en: 'Ask for directions',  role: 'local passerby' },
  { key: 'restaurant', emoji: '🍽️', de: 'Restaurant bestellen',   en: 'Restaurant order',    role: 'waiter' },
  { key: 'shopping',   emoji: '🛍️', de: 'Einkaufen',              en: 'Shopping',            role: 'shop assistant' },
  { key: 'airport',    emoji: '✈️', de: 'Am Flughafen',           en: 'At the airport',      role: 'airline agent' },
  { key: 'office',     emoji: '💼', de: 'Im Büro',                en: 'At the office',       role: 'colleague' },
  { key: 'home',       emoji: '🏠', de: 'Zu Hause',               en: 'At home',             role: 'flatmate or partner' },
  { key: 'school',     emoji: '🎓', de: 'In der Schule',          en: 'At school',           role: 'teacher or classmate' },
  { key: 'smalltalk',  emoji: '💬', de: 'Smalltalk',              en: 'Small talk',          role: 'friendly stranger' },
]

function KiGespraechScreen({ lang, theme, onBack, userName, userToLang = 'en', socialRegister = 'friends', myData, partnerData, user, t: tProp, th, s }) {
  const t = tProp
  const isPremium = (user?.uid === MARK_UID || user?.uid === ELOSY_UID) || (myData?.plan && myData.plan !== 'free')
  const MAX_SESSIONS = isPremium ? 3 : 1
  const MAX_EXCHANGES = isPremium ? 15 : 8
  const [sessionRegister, setSessionRegister] = useState(socialRegister)
  const [scenario, setScenario] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [translations, setTranslations] = useState({})
  const [visibleTranslations, setVisibleTranslations] = useState({})
  const [translating, setTranslating] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [loadingFeedback, setLoadingFeedback] = useState(false)
  const [introText, setIntroText] = useState(null)
  const [generatingOpener, setGeneratingOpener] = useState(false)
  const [kiUsageToday, setKiUsageToday] = useState({ sessionCount: 0 })
  const bottomRef = useRef(null)
  const exchangeCount = messages.filter(m => m.role === 'user').length
  const atExchangeLimit = exchangeCount >= MAX_EXCHANGES
  const ttsLangCode = userToLang.toLowerCase()
  const LANG_NAMES_FULL = { en: 'English', de: 'German', sw: 'Swahili', th: 'Thai', es: 'Spanish', fr: 'French', ar: 'Arabic', tr: 'Turkish', pt: 'Portuguese' }
  const targetLang = LANG_NAMES_FULL[ttsLangCode] || ttsLangCode
  const nativeLang = LANG_NAMES_FULL[lang] || lang
  const ui = (de, en) => lang === 'de' ? de : en
  const masteredCount = Object.values(myData?.cardProgress || {}).filter(p => (p?.interval || 0) >= 7).length
  const tenseUnlocks = getTenseUnlocks(masteredCount)
  const tenseRule = !tenseUnlocks.past
    ? 'TENSE RULE: Use only present tense (Präsens/Present tense). Keep all sentences in present tense only.'
    : !tenseUnlocks.future
    ? 'TENSE RULE: Use present and past tense (Präsens + Vergangenheit/Past tense). Avoid future tense.'
    : 'TENSE RULE: You may use all tenses freely (present, past, and future tense).'

  // Load today's KI usage from Firestore on mount
  useEffect(() => {
    if (!user) return
    const today = new Date().toISOString().slice(0, 10)
    getDoc(doc(db, 'users', user.uid, 'kiUsage', today))
      .then(snap => { if (snap.exists()) setKiUsageToday(snap.data()) })
      .catch(() => {})
  }, [user?.uid]) // eslint-disable-line

  const getSystemPrompt = (sc) => {
    if (!sc) return ''
    const regCtx = socialRegisterContext(sessionRegister)
    return `You are playing the role of a ${sc.role} in a ${sc.en} scenario. The user ${userName} is practicing ${targetLang}.
Social register / tone: ${regCtx}. Adapt your vocabulary and formality accordingly.
LANGUAGE RULE: You MUST always respond ONLY in ${targetLang}. Never switch languages regardless of what language the user writes in. If the user writes in ${nativeLang} or any other language, gently remind them to practice ${targetLang} and respond in ${targetLang}.
${tenseRule}
Stay in character throughout.
If the user makes a grammar mistake, continue naturally, then add a brief tip like "💡 Tip: ..."
Keep each response to 1-3 sentences. Be realistic and helpful for the scenario.
After the user has sent ${MAX_EXCHANGES} messages, add "---END---" at the end of your response.`
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  // Auto-generate feedback when scenario ends (---END--- or exchange limit)
  useEffect(() => {
    if (!scenario || feedback || loadingFeedback) return
    const lastAI = messages.filter(m => m.role === 'assistant').slice(-1)[0]
    if (lastAI?.content?.includes('---END---') || atExchangeLimit) fetchFeedback()
  }, [messages]) // eslint-disable-line

  const startScenario = async (sc) => {
    const today = new Date().toISOString().slice(0, 10)
    const usedToday = kiUsageToday?.sessionCount || 0
    if (usedToday >= MAX_SESSIONS) {
      const limitMsg = lang === 'sw'
        ? `Umefika kikomo cha mazungumzo leo (${MAX_SESSIONS}). Jaribu kesho.`
        : ui(`Tageslimit erreicht (${MAX_SESSIONS} Gespräch${MAX_SESSIONS > 1 ? 'e' : ''}/Tag). Morgen wieder verfügbar.`,
             `Daily limit reached (${MAX_SESSIONS} session${MAX_SESSIONS > 1 ? 's' : ''}/day). Come back tomorrow!`)
      alert(limitMsg)
      return
    }
    if (user) {
      const newUsage = { sessionCount: usedToday + 1, lastReset: today }
      setKiUsageToday(newUsage)
      try { await setDoc(doc(db, 'users', user.uid, 'kiUsage', today), newUsage) } catch(_) {}
    }
    setScenario(sc); setMessages([]); setFeedback(null); setInput(''); setIntroText(null); setGeneratingOpener(true)
    if (user) {
      const entry = { scenarioKey: sc.key, startedAt: Date.now(), lang: targetLang }
      try { await setDoc(doc(db, 'users', user.uid, 'conversationHistory', String(Date.now())), entry) } catch(_) {}
    }
    try {
      const introPrompt = `Role-play: ${sc.en}. Character: ${sc.role}. User language: ${nativeLang}. Practice language: ${targetLang}.
Return ONLY valid JSON (no markdown): {"intro":"brief 1-2 sentence situation description in ${nativeLang} — set the scene for the user","opener":"the character's first in-character message in ${targetLang}, short and natural (1-2 sentences)"}`
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 200, messages: [{ role: 'user', content: introPrompt }] })
      })
      const data = await res.json()
      const raw = (data.content?.[0]?.text || '').trim()
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        if (parsed.intro) setIntroText(parsed.intro)
        if (parsed.opener) setMessages([{ role: 'assistant', content: parsed.opener }])
      }
    } catch(_) {}
    setGeneratingOpener(false)
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading || feedback || atExchangeLimit) return
    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages); setInput(''); setLoading(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 250, system: getSystemPrompt(scenario), messages: newMessages })
      })
      const data = await response.json()
      const reply = data.content?.[0]?.text || '...'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      const errMsg = lang === 'sw' ? '⚠️ Hitilafu ya muunganiko.' : ui('⚠️ Verbindungsfehler.', '⚠️ Connection error.')
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg }])
    }
    setLoading(false)
  }

  const fetchFeedback = async () => {
    setLoadingFeedback(true)
    const conversation = messages.map(m => `${m.role === 'user' ? userName : 'AI'}: ${m.content}`).join('\n')
    const feedbackLabels = lang === 'sw'
      ? '1. Mambo mazuri (nguvu 2-3) 2. Mambo ya kufanya kazi (maeneo 1-2) 3. Kiwango: A1/A2/B1/B2/C1/C2'
      : ui(
        '1. Was gut war (2-3 Stärken) 2. Was üben kannst (1-2 Verbesserungen) 3. Geschätztes Niveau: A1/A2/B1/B2/C1/C2',
        '1. What went well (2-3 strengths) 2. What to practice (1-2 improvements) 3. Estimated level: A1/A2/B1/B2/C1/C2'
      )
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6', max_tokens: 400,
          messages: [{ role: 'user', content: `Analyze this language learning conversation. The learner speaks ${nativeLang} and practices ${targetLang}. Give feedback in ${nativeLang}: ${feedbackLabels}. Keep it encouraging and specific. Max 100 words total. Return ONLY valid JSON (no markdown): {"strengths":"...","weaknesses":"...","level":"A1|A2|B1|B2|C1|C2"}\n\nConversation:\n${conversation}` }]
        })
      })
      const d = await res.json()
      const raw = (d.content?.[0]?.text || '').trim()
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) {
        const fb = JSON.parse(match[0])
        setFeedback(fb)
        if (user) {
          const entry = {
            scenarioKey: scenario?.key,
            scenarioName: lang === 'de' ? scenario?.de : scenario?.en,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            feedback: fb,
            lang: targetLang,
            completedAt: Date.now(),
          }
          setDoc(doc(db, 'users', user.uid, 'conversationHistory', String(Date.now())), entry).catch(() => {})
        }
      }
    } catch(_) {}
    setLoadingFeedback(false)
  }

  const translateMessage = async (msgIndex, text) => {
    if (translations[msgIndex]) { setVisibleTranslations(prev => ({ ...prev, [msgIndex]: true })); return }
    setTranslating(msgIndex)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 150, messages: [{ role: 'user', content: `Translate to ${nativeLang}. Return ONLY the translation, nothing else:\n"${text}"` }] })
      })
      const d = await res.json()
      const translated = (d.content?.[0]?.text || '').trim()
      setTranslations(prev => ({ ...prev, [msgIndex]: translated }))
      setVisibleTranslations(prev => ({ ...prev, [msgIndex]: true }))
    } catch (_) {
      setTranslations(prev => ({ ...prev, [msgIndex]: '⚠️' }))
      setVisibleTranslations(prev => ({ ...prev, [msgIndex]: true }))
    }
    setTranslating(null)
  }

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }

  // ── SCENARIO PICKER ──
  if (!scenario) return (
    <div style={{ ...s.container, minHeight: '100vh' }} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>← {t.back}</button>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <p style={{ color: th.accent, fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 6px' }}>🤖 KI-Gespräch 2.0</p>
        <p style={{ color: th.text, fontSize: '1.1rem', fontWeight: '700', margin: '0 0 4px' }}>{ui('Wähle ein Szenario:', 'Choose a scenario:')}</p>
        <p style={{ color: th.sub, fontSize: '0.8rem', margin: '0 0 12px' }}>{MAX_EXCHANGES} {ui('Austausche · 5–8 Minuten', 'exchanges · 5–8 minutes')}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '4px' }}>
          <span style={{ color: th.sub, fontSize: '0.68rem', fontWeight: '600', letterSpacing: '0.3px' }}>{ui('Ton:', 'Tone:')}</span>
          {SOCIAL_REGISTERS.map(r => (
            <button key={r.key} onClick={() => setSessionRegister(r.key)}
              style={{ background: sessionRegister === r.key ? `${th.accent}22` : 'transparent', border: `1px solid ${sessionRegister === r.key ? th.accent : th.border}`, borderRadius: '20px', padding: '3px 10px', fontSize: '0.68rem', fontWeight: sessionRegister === r.key ? '700' : '400', color: sessionRegister === r.key ? th.accent : th.sub, cursor: 'pointer', transition: 'all 0.15s' }}>
              {lang === 'de' ? r.labelDe : r.labelEn}
            </button>
          ))}
        </div>
        {!isPremium && <p style={{ color: th.gold, fontSize: '0.68rem', margin: '6px 0 0', fontWeight: '600' }}>
          {ui(`🔓 Kostenfrei: ${MAX_SESSIONS} Gespräch/Tag · ${MAX_EXCHANGES} Austausche`, `🔓 Free: ${MAX_SESSIONS} session/day · ${MAX_EXCHANGES} exchanges`)}
        </p>}
        {isPremium && <p style={{ color: th.gold, fontSize: '0.68rem', margin: '6px 0 0', fontWeight: '600' }}>
          ⭐ {ui(`Premium: ${MAX_SESSIONS} Gespräche/Tag · ${MAX_EXCHANGES} Austausche`, `Premium: ${MAX_SESSIONS} sessions/day · ${MAX_EXCHANGES} exchanges`)}
        </p>}
        {kiUsageToday.sessionCount > 0 && <p style={{ color: th.sub, fontSize: '0.65rem', margin: '4px 0 0' }}>
          {ui(`Heute: ${kiUsageToday.sessionCount}/${MAX_SESSIONS} genutzt`, `Today: ${kiUsageToday.sessionCount}/${MAX_SESSIONS} used`)}
        </p>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {KI_SCENARIOS.map(sc => (
          <button key={sc.key} onClick={() => startScenario(sc)}
            style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: '14px', padding: '14px 10px', cursor: 'pointer', textAlign: 'center', WebkitTapHighlightColor: 'transparent', transition: 'border-color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = th.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = th.border}>
            <p style={{ color: th.text, fontSize: '0.78rem', fontWeight: '600', margin: 0, lineHeight: 1.3 }}>{lang === 'de' ? sc.de : sc.en}</p>
          </button>
        ))}
      </div>
    </div></div>
  )

  // ── FEEDBACK SCREEN ──
  if (feedback) return (
    <div style={{ ...s.container, minHeight: '100vh' }} className="vocara-screen"><div style={s.homeBox}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <p style={{ color: th.accent, fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 10px' }}>{ui('Gesprächs-Feedback', 'Conversation Feedback')}</p>
        <div style={{ display: 'inline-block', background: `${th.accent}22`, border: `2px solid ${th.accent}88`, borderRadius: '16px', padding: '8px 24px', marginBottom: '6px' }}>
          <p style={{ color: th.text, fontSize: '0.7rem', fontWeight: '600', margin: '0 0 2px', opacity: 0.7 }}>{ui('Dein Niveau in diesem Gespräch', 'Your level in this conversation')}</p>
          <p style={{ color: th.accent, fontSize: '1.8rem', fontWeight: '800', margin: 0, letterSpacing: '2px' }}>{feedback.level}</p>
        </div>
      </div>
      <div style={{ ...s.card, borderLeft: '3px solid #4CAF50', marginBottom: '12px' }}>
        <p style={{ color: '#81c784', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', margin: '0 0 6px', letterSpacing: '0.5px' }}>{ui('✓ Was gut war:', '✓ What went well:')}</p>
        <p style={{ color: th.text, fontSize: '0.88rem', margin: 0, lineHeight: 1.55 }}>{feedback.strengths}</p>
      </div>
      <div style={{ ...s.card, borderLeft: '3px solid #FFA500', marginBottom: '20px' }}>
        <p style={{ color: '#FFA500', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', margin: '0 0 6px', letterSpacing: '0.5px' }}>{ui('💡 Was du üben kannst:', '💡 What to practice next:')}</p>
        <p style={{ color: th.text, fontSize: '0.88rem', margin: 0, lineHeight: 1.55 }}>{feedback.weaknesses}</p>
      </div>
      <button style={s.button} onClick={() => { setScenario(null); setMessages([]); setFeedback(null) }}>{ui('🔄 Neues Szenario', '🔄 New scenario')}</button>
      <button style={{ ...s.button, background: 'transparent', color: th.sub, border: `1px solid ${th.border}` }} onClick={onBack}>{t.back}</button>
    </div></div>
  )

  // ── CHAT SCREEN ──
  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: th.bg }} className="vocara-screen">
      <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <div style={{ padding: '12px 16px 10px', background: th.bg, borderBottom: `1px solid ${th.border}`, display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <button style={{ ...s.backBtn, marginBottom: 0 }} onClick={() => setScenario(null)}>←</button>
          <div style={{ flex: 1 }}>
            <p style={{ color: th.text, fontWeight: 'bold', margin: 0, fontSize: '0.95rem' }}>{lang === 'de' ? scenario.de : scenario.en}</p>
            <p style={{ color: th.sub, fontSize: '0.72rem', margin: 0 }}>{ui(`KI spielt: ${scenario.role}`, `AI plays: ${scenario.role}`)} · <span style={{ color: atExchangeLimit ? th.gold : th.sub }}>{exchangeCount}/{MAX_EXCHANGES}</span></p>
          </div>
          {exchangeCount >= Math.floor(MAX_EXCHANGES * 0.5) && !loadingFeedback && !feedback && (
            <button onClick={fetchFeedback} style={{ background: `${th.accent}22`, border: `1px solid ${th.accent}55`, color: th.accent, borderRadius: '10px', padding: '5px 10px', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer' }}>
              Feedback
            </button>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {introText && (
            <div style={{ background: `${th.accent}11`, border: `1px solid ${th.accent}33`, borderRadius: '12px', padding: '10px 14px' }}>
              <p style={{ color: th.accent, fontSize: '0.62rem', fontWeight: '700', textTransform: 'uppercase', margin: '0 0 4px', letterSpacing: '0.6px' }}>📍 {ui('Situation', 'Situation')}</p>
              <p style={{ color: th.text, fontSize: '0.82rem', margin: 0, lineHeight: 1.5, opacity: 0.85 }}>{introText}</p>
            </div>
          )}
          {generatingOpener && messages.length === 0 && (
            <div style={{ display: 'flex' }}>
              <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: th.card, border: `1px solid ${th.border}`, color: th.sub, fontSize: '1.2rem', letterSpacing: '4px' }}>···</div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: msg.role === 'user' ? th.accent : th.card, border: msg.role === 'assistant' ? `1px solid ${th.border}` : 'none', color: msg.role === 'user' ? (th.btnTextColor || '#111') : th.text, fontSize: '0.9rem', lineHeight: 1.5 }}>
                {msg.content.replace('---END---', '').trim()}
              </div>
              {msg.role === 'assistant' && (
                <div style={{ maxWidth: '85%', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button onClick={() => speak(msg.content, ttsLangCode)} style={{ background: 'none', border: 'none', color: th.sub, fontSize: '1rem', cursor: 'pointer', padding: '2px 4px', opacity: 0.6 }}>🔊</button>
                    <button
                      onClick={() => visibleTranslations[i] ? setVisibleTranslations(prev => ({ ...prev, [i]: false })) : translateMessage(i, msg.content)}
                      disabled={translating === i}
                      style={{ background: 'none', border: 'none', color: th.sub, fontSize: '0.72rem', cursor: 'pointer', opacity: translating === i ? 0.5 : 0.7, textDecoration: 'underline' }}>
                      {translating === i ? '...' : visibleTranslations[i] ? `🌐 ${ui('Ausblenden', 'Hide')}` : `🌐 ${ui('Übersetzen', 'Translate')}`}
                    </button>
                  </div>
                  {visibleTranslations[i] && translations[i] && (
                    <p style={{ color: th.sub, fontSize: '0.75rem', margin: '4px 0 0', fontStyle: 'italic', paddingLeft: '4px' }}>{translations[i]}</p>
                  )}
                </div>
              )}
            </div>
          ))}
          {loading && <div style={{ display: 'flex' }}><div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: th.card, border: `1px solid ${th.border}`, color: th.sub, fontSize: '1.2rem', letterSpacing: '4px' }}>···</div></div>}
          {loadingFeedback && <div style={{ textAlign: 'center', padding: '20px' }}><p style={{ color: th.sub, fontSize: '0.85rem', animation: 'vocaraPulse 1.2s infinite' }}>🎓 {ui('Feedback wird generiert…', 'Generating feedback…')}</p></div>}
          {atExchangeLimit && !feedback && !loadingFeedback && (
            <div style={{ textAlign: 'center', padding: '12px', background: `${th.accent}11`, borderRadius: '12px', border: `1px solid ${th.accent}33` }}>
              <p style={{ color: th.accent, fontSize: '0.82rem', margin: 0, fontWeight: '600' }}>
                {ui(`${MAX_EXCHANGES} Austausche erreicht — Feedback wird geladen…`, `${MAX_EXCHANGES} exchanges reached — loading feedback…`)}
              </p>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div style={{ padding: '12px 16px', background: th.bg, borderTop: `1px solid ${th.border}`, display: 'flex', gap: '8px', alignItems: 'flex-end', flexShrink: 0 }}>
          <textarea style={{ flex: 1, padding: '10px 14px', borderRadius: '12px', border: `1px solid ${th.border}`, background: th.card, color: th.text, fontSize: '0.95rem', resize: 'none', minHeight: '44px', maxHeight: '120px', fontFamily: 'inherit', outline: 'none', lineHeight: 1.4 }}
            placeholder={generatingOpener ? ui('KI tippt…', 'AI is typing…') : atExchangeLimit ? ui('Limit erreicht', 'Limit reached') : ui(`Antworte auf ${targetLang}…`, `Reply in ${targetLang}…`)}
            value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} rows={1} disabled={generatingOpener || atExchangeLimit} />
          <button style={{ background: th.accent, border: 'none', borderRadius: '12px', width: '44px', height: '44px', cursor: (loading || feedback || generatingOpener || atExchangeLimit) ? 'not-allowed' : 'pointer', fontSize: '1.1rem', opacity: (loading || feedback || generatingOpener || atExchangeLimit) ? 0.5 : 1, flexShrink: 0, color: '#fff' }} onClick={sendMessage} disabled={loading || !!feedback || generatingOpener || atExchangeLimit}>➤</button>
        </div>
      </div>
    </div>
  )
}

export default KiGespraechScreen
