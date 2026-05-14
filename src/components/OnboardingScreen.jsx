import React, { useState } from 'react'
import { THEMES } from '../theme'

const ONBOARDING_SLIDES_DE = [
  {
    emoji: '🌉',
    title: 'Willkommen bei Vocara',
    text: 'Die Stimme ist die Brücke.\nVocara hilft dir, eine neue Sprache Schritt für Schritt aufzubauen — gemeinsam mit deinem Partner.',
  },
  {
    emoji: '🃏',
    title: 'Intelligente Karteikarten',
    text: 'Vocara zeigt dir Karten genau dann, wenn du sie brauchst. Schnelle Antworten = längere Pause. Schwierige Karten kommen öfter zurück.',
  },
  {
    emoji: '🤝',
    title: 'Lernt zusammen',
    text: 'Verbinde dich mit deinem Partner. Ihr seht gegenseitig euren Fortschritt — egal wie weit ihr voneinander entfernt seid.',
  },
  {
    emoji: '🚀',
    title: 'Bereit?',
    text: 'Mach zuerst einen kurzen Level-Check, damit wir wissen wo du startest. Es dauert nur 2 Minuten.',
  },
]
const ONBOARDING_SLIDES_EN = [
  {
    emoji: '🌉',
    title: 'Welcome to Vocara',
    text: 'The voice is the bridge.\nVocara helps you build a new language step by step — together with your partner.',
  },
  {
    emoji: '🃏',
    title: 'Smart flashcards',
    text: 'Vocara shows you cards exactly when you need them. Fast answers = longer break. Difficult cards come back more often.',
  },
  {
    emoji: '🤝',
    title: 'Learn together',
    text: "Connect with your partner. You can see each other's progress — no matter how far apart you are.",
  },
  {
    emoji: '🚀',
    title: 'Ready?',
    text: 'First, take a quick level check so we know where you start. It only takes 2 minutes.',
  },
]

function OnboardingScreen({ lang, theme, onDone, onSprachkompass }) {
  const th = THEMES[theme]
  const slides = lang === 'de' ? ONBOARDING_SLIDES_DE : ONBOARDING_SLIDES_EN
  const [index, setIndex] = useState(0)
  const [showCities, setShowCities] = useState(false)
  const [showRelType, setShowRelType] = useState(false)
  const [showSprachkompassOffer, setShowSprachkompassOffer] = useState(false)
  const [pendingDoneData, setPendingDoneData] = useState(null)
  const [homeCity, setHomeCity] = useState('')
  const [partnerCity, setPartnerCity] = useState('')
  const [pendingCityData, setPendingCityData] = useState({})
  const isLast = index === slides.length - 1

  const finishOnboarding = (data) => {
    if (onSprachkompass) { setPendingDoneData(data); setShowSprachkompassOffer(true) }
    else onDone(data)
  }
  const slide = slides[index]

  const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '12px 14px', color: '#fff', fontSize: '1rem', outline: 'none', boxSizing: 'border-box', marginBottom: '12px' }
  const relBtnStyle = (active) => ({
    width: '100%', padding: '14px 16px', borderRadius: '14px', cursor: 'pointer', fontSize: '1rem',
    fontWeight: active ? '700' : '500', marginBottom: '10px',
    background: active ? `${th.accent}25` : 'rgba(255,255,255,0.05)',
    color: active ? th.text : th.sub,
    border: `1px solid ${active ? th.accent : 'rgba(255,255,255,0.1)'}`,
    textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  })

  if (showRelType) {
    const REL_OPTIONS = [
      { key: 'couple',     emoji: '💑', de: 'Romantisches Paar',  en: 'Romantic couple'     },
      { key: 'friends',    emoji: '👫', de: 'Freunde',             en: 'Friends'             },
      { key: 'family',     emoji: '👨‍👩‍👧', de: 'Familie',             en: 'Family'             },
      { key: 'colleagues', emoji: '👔', de: 'Kollegen / Business', en: 'Colleagues / Business'},
    ]
    return (
      <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: th.bg }} className="vocara-screen">
        <div style={{ textAlign: 'center', padding: '32px 24px', width: '100%', maxWidth: '420px', animation: 'vocaraFadeIn 0.3s ease both' }}>
          <p style={{ fontSize: '3.5rem', margin: '0 0 16px 0' }}>🤝</p>
          <h2 style={{ color: th.gold, fontSize: '1.5rem', fontWeight: 'bold', margin: '0 0 10px 0' }}>
            {lang === 'de' ? 'Was verbindet euch?' : 'What connects you?'}
          </h2>
          <p style={{ color: th.sub, fontSize: '0.9rem', lineHeight: '1.6', margin: '0 0 24px 0' }}>
            {lang === 'de' ? 'Das beeinflusst den Ton eurer täglichen Karten.' : 'This shapes the tone of your daily cards.'}
          </p>
          {REL_OPTIONS.map(opt => (
            <button key={opt.key} style={relBtnStyle(false)}
              onClick={() => finishOnboarding({ ...pendingCityData, relationshipType: opt.key })}>
              <span style={{ fontSize: '1.5rem' }}>{opt.emoji}</span>
              <span>{lang === 'de' ? opt.de : opt.en}</span>
            </button>
          ))}
          <button style={{ background: 'transparent', color: th.sub, border: 'none', padding: '8px', fontSize: '0.85rem', cursor: 'pointer', width: '100%', marginTop: '4px' }}
            onClick={() => finishOnboarding(pendingCityData)}>
            {lang === 'de' ? 'Überspringen' : 'Skip'}
          </button>
        </div>
      </div>
    )
  }

  if (showCities) {
    return (
      <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: th.bg }} className="vocara-screen">
        <div style={{ textAlign: 'center', padding: '32px 24px', width: '100%', maxWidth: '420px', animation: 'vocaraFadeIn 0.3s ease both' }}>
          <p style={{ fontSize: '3.5rem', margin: '0 0 16px 0' }}>🏙️</p>
          <h2 style={{ color: th.gold, fontSize: '1.5rem', fontWeight: 'bold', margin: '0 0 10px 0' }}>
            {lang === 'de' ? 'Eure Städte' : 'Your cities'}
          </h2>
          <p style={{ color: th.sub, fontSize: '0.95rem', lineHeight: '1.6', margin: '0 0 28px 0' }}>
            {lang === 'de'
              ? 'Damit die KI-Karten persönliche Geschichten über euch erzählen können.'
              : 'So the AI cards can tell personal stories about you.'}
          </p>
          <input
            style={inputStyle}
            placeholder={lang === 'de' ? '🏠 Deine Stadt (z.B. Hamburg)' : '🏠 Your city (e.g. Hamburg)'}
            value={homeCity}
            onChange={e => setHomeCity(e.target.value)}
          />
          <input
            style={inputStyle}
            placeholder={lang === 'de' ? '✈️ Stadt deines Partners (z.B. Nairobi)' : "✈️ Partner's city (e.g. Nairobi)"}
            value={partnerCity}
            onChange={e => setPartnerCity(e.target.value)}
          />
          <button
            style={{ background: th.accent, color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '10px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold', width: '100%', marginBottom: '12px' }}
            onClick={() => {
              const cityData = { homeCity: homeCity.trim() || undefined, partnerCity: partnerCity.trim() || undefined }
              setPendingCityData(cityData)
              setShowRelType(true)
            }}
          >
            {lang === 'de' ? 'Weiter →' : 'Next →'}
          </button>
          <button
            style={{ background: 'transparent', color: th.sub, border: 'none', padding: '8px', fontSize: '0.85rem', cursor: 'pointer', width: '100%' }}
            onClick={() => onDone({})}
          >
            {lang === 'de' ? 'Überspringen' : 'Skip'}
          </button>
        </div>
      </div>
    )
  }

  if (showSprachkompassOffer) {
    return (
      <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: th.bg }} className="vocara-screen">
        <div style={{ textAlign: 'center', padding: '32px 24px', width: '100%', maxWidth: '420px', animation: 'vocaraFadeIn 0.3s ease both' }}>
          <p style={{ fontSize: '4rem', margin: '0 0 16px 0' }}>🧭</p>
          <h2 style={{ color: th.gold, fontSize: '1.5rem', fontWeight: 'bold', margin: '0 0 12px 0' }}>
            {lang === 'de' ? 'Sprachstand testen?' : 'Test your level?'}
          </h2>
          <p style={{ color: th.sub, fontSize: '0.95rem', lineHeight: '1.6', margin: '0 0 32px 0' }}>
            {lang === 'de'
              ? 'Ein kurzer Test ermittelt deinen Sprachstand und passt deinen Lernpfad automatisch an.'
              : 'A quick test determines your level and automatically adjusts your learning path.'}
          </p>
          <button
            style={{ background: th.accent, color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '10px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold', width: '100%', marginBottom: '12px' }}
            onClick={() => { onDone(pendingDoneData || {}); onSprachkompass() }}>
            {lang === 'de' ? '🧭 Ja, Test starten' : '🧭 Yes, start test'}
          </button>
          <button
            style={{ background: 'transparent', color: th.sub, border: 'none', padding: '8px', fontSize: '0.85rem', cursor: 'pointer', width: '100%' }}
            onClick={() => onDone(pendingDoneData || {})}>
            {lang === 'de' ? 'Überspringen' : 'Skip'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: th.bg }} className="vocara-screen">
      <div style={{ textAlign: 'center', padding: '32px 24px', width: '100%', maxWidth: '420px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
          {slides.map((_, i) => (
            <div key={i} style={{ width: i === index ? '24px' : '8px', height: '8px', borderRadius: '4px', background: i === index ? th.accent : th.border, transition: 'all 0.3s ease' }} />
          ))}
        </div>
        <div key={index} style={{ animation: 'vocaraFadeIn 0.3s ease both' }}>
          <p style={{ fontSize: '4rem', margin: '0 0 16px 0' }}>{slide.emoji}</p>
          <h2 style={{ color: th.gold, fontSize: '1.5rem', fontWeight: 'bold', margin: '0 0 16px 0' }}>{slide.title}</h2>
          <p style={{ color: th.sub, fontSize: '1rem', lineHeight: '1.7', margin: '0 0 40px 0', whiteSpace: 'pre-line' }}>{slide.text}</p>
        </div>
        <button
          style={{ background: th.accent, color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '10px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold', width: '100%', marginBottom: '12px' }}
          onClick={() => isLast ? setShowCities(true) : setIndex(i => i + 1)}
        >
          {lang === 'de' ? 'Weiter →' : 'Next →'}
        </button>
        {!isLast && (
          <button
            style={{ background: 'transparent', color: th.sub, border: 'none', padding: '8px', fontSize: '0.85rem', cursor: 'pointer', width: '100%' }}
            onClick={() => onDone({})}
          >
            {lang === 'de' ? 'Überspringen' : 'Skip'}
          </button>
        )}
      </div>
    </div>
  )
}

export default OnboardingScreen
