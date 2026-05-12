import React, { useState } from 'react'
import { THEMES, makeStyles, resolveTheme } from '../theme'
import { LANG_FLAGS } from '../appShared'

const TEAL = '#00D4AA'
const LANG_NAMES = { de: 'Deutsch', en: 'English', sw: 'Swahili', th: 'Thai', es: 'Español', fr: 'Français', ar: 'عربي', tr: 'Türkçe', pt: 'Português' }
const CAT_INFO = [
  { key: 'vocabulary', emoji: '📖', de: 'Wörter', en: 'Words' },
  { key: 'sentence',   emoji: '💬', de: 'Sätze',  en: 'Sentences' },
  { key: 'street',     emoji: '🏙️', de: 'Straße', en: 'Street' },
  { key: 'home',       emoji: '🏠', de: 'Zuhause', en: 'Home' },
  { key: 'basics',     emoji: '🔤', de: 'Grundlagen', en: 'Basics' },
]

function ProgressRing({ pct, size = 72, stroke = 7, color = TEAL, children }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <foreignObject x={0} y={0} width={size} height={size} style={{ transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px` }}>
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </div>
      </foreignObject>
    </svg>
  )
}

function LanguageProgressScreen({ user, myData, allCards, lang, theme, onBack }) {
  const lightMode = false
  const th = resolveTheme(theme, lightMode)
  const s = makeStyles(th)
  const isDE = lang === 'de'
  const [expandedLang, setExpandedLang] = useState(null)

  const cardProgress = myData?.cardProgress || {}
  const sessionHistory = myData?.sessionHistory || []

  // Collect unique target langs from allCards
  const targetLangs = [...new Set(allCards.map(c => c.targetLang).filter(Boolean))]

  const buildStats = (targetLang) => {
    const cards = allCards.filter(c => c.targetLang === targetLang && !/_r(_\d+)?$/.test(c.id))
    const total = cards.length
    const mastered = cards.filter(c => (cardProgress[c.id]?.interval || 0) >= 1).length
    const learning = cards.filter(c => {
      const p = cardProgress[c.id]
      return p && (p.interval || 0) >= 1 && (p.interval || 0) < 7
    }).length
    const pct = total > 0 ? Math.round((mastered / total) * 100) : 0
    let lastActive = null
    ;[...sessionHistory].sort((a, b) => b.date.localeCompare(a.date)).forEach(h => {
      if (!lastActive && h.date) lastActive = h.date
    })
    return { total, mastered, learning, pct, lastActive }
  }

  const buildCatStats = (targetLang) => {
    return CAT_INFO.map(cat => {
      const cards = allCards.filter(c => c.targetLang === targetLang && c.category === cat.key && !/_r(_\d+)?$/.test(c.id))
      const total = cards.length
      const mastered = cards.filter(c => (cardProgress[c.id]?.interval || 0) >= 1).length
      return { ...cat, total, mastered }
    }).filter(c => c.total > 0)
  }

  const fromLang = myData?.fromLang || lang
  const toLangCode = myData?.toLang || (lang === 'de' ? 'en' : 'de')

  // Primary pair first, then others
  const sortedLangs = [
    toLangCode,
    ...targetLangs.filter(l => l !== toLangCode),
  ].filter(l => targetLangs.includes(l))

  const totalMastered = Object.values(cardProgress).filter(p => (p?.interval || 0) >= 7).length
  const totalCards = allCards.filter(c => !/_r(_\d+)?$/.test(c.id)).length

  return (
    <div style={s.container} className="vocara-screen">
      <div style={s.homeBox}>
        <button style={s.backBtn} onClick={onBack}>← {isDE ? 'Zurück' : 'Back'}</button>

        <div style={{ textAlign: 'center', marginBottom: '20px', paddingTop: '8px' }}>
          <p style={{ fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif", fontSize: '1.4rem', fontWeight: '700', color: TEAL, margin: '0 0 4px', letterSpacing: '-0.5px' }}>
            🌍 {isDE ? 'Meine Sprachen' : 'My Languages'}
          </p>
          <p style={{ color: th.sub, fontSize: '0.78rem', margin: 0 }}>
            {totalMastered} {isDE ? 'von' : 'of'} {totalCards} {isDE ? 'Karten gemeistert' : 'cards mastered'}
          </p>
        </div>

        {sortedLangs.length === 0 && (
          <p style={{ color: th.sub, textAlign: 'center', fontSize: '0.88rem' }}>
            {isDE ? 'Noch keine Karten vorhanden.' : 'No cards yet.'}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sortedLangs.map(targetLang => {
            const stats = buildStats(targetLang)
            const isPrimary = targetLang === toLangCode
            const flag = LANG_FLAGS[targetLang] || '🌐'
            const name = LANG_NAMES[targetLang] || targetLang.toUpperCase()
            const isExpanded = expandedLang === targetLang
            const catStats = isExpanded ? buildCatStats(targetLang) : []
            return (
              <div key={targetLang} style={{
                background: isPrimary ? `${TEAL}0F` : th.card,
                border: `1px solid ${isPrimary ? TEAL + '44' : th.border}`,
                borderRadius: '18px', overflow: 'hidden',
              }}>
                <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
                  onClick={() => setExpandedLang(isExpanded ? null : targetLang)}>
                  <div style={{ flexShrink: 0 }}>
                    <ProgressRing pct={stats.pct} color={isPrimary ? TEAL : '#7a8aaa'}>
                      <span style={{ fontSize: '1.3rem', display: 'block' }}>{flag}</span>
                    </ProgressRing>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '4px' }}>
                      <span style={{ fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif", color: isPrimary ? TEAL : th.text, fontWeight: '700', fontSize: '1rem' }}>{name}</span>
                      {isPrimary && <span style={{ fontSize: '0.6rem', color: TEAL, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.8 }}>{isDE ? 'Primär' : 'Primary'}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ color: TEAL, fontSize: '0.78rem', fontWeight: '700' }}>✓ {stats.mastered}</span>
                      <span style={{ color: th.sub, fontSize: '0.78rem' }}>📖 {stats.learning}</span>
                      <span style={{ color: th.sub, fontSize: '0.78rem' }}>∑ {stats.total}</span>
                    </div>
                    <div style={{ marginTop: '8px', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${stats.pct}%`, background: isPrimary ? TEAL : '#7a8aaa', borderRadius: '2px', transition: 'width 0.6s ease' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                      <span style={{ color: th.sub, fontSize: '0.65rem' }}>{stats.pct}% {isDE ? 'gemeistert' : 'mastered'}</span>
                      {stats.lastActive && <span style={{ color: th.sub, fontSize: '0.65rem', opacity: 0.6 }}>{stats.lastActive}</span>}
                    </div>
                  </div>
                  <span style={{ color: th.sub, fontSize: '0.75rem', flexShrink: 0, paddingRight: '2px' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
                {isExpanded && catStats.length > 0 && (
                  <div style={{ borderTop: `1px solid ${isPrimary ? TEAL + '22' : th.border}`, padding: '10px 18px 14px', animation: 'vocaraFadeIn 0.2s ease both' }}>
                    <p style={{ color: th.sub, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px', fontWeight: '600' }}>
                      {isDE ? 'Nach Kategorie' : 'By category'}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {catStats.map(c => {
                        const pct = c.total > 0 ? Math.round((c.mastered / c.total) * 100) : 0
                        return (
                          <div key={c.key}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                              <span style={{ color: th.text, fontSize: '0.72rem' }}>{c.emoji} {isDE ? c.de : c.en}</span>
                              <span style={{ color: th.sub, fontSize: '0.65rem' }}>{c.mastered}/{c.total}</span>
                            </div>
                            <div style={{ height: '2px', background: 'rgba(255,255,255,0.08)', borderRadius: '1px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: isPrimary ? TEAL : '#7a8aaa', borderRadius: '1px', transition: 'width 0.5s ease' }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div style={{ marginTop: '20px', padding: '14px 16px', background: th.card, border: `1px solid ${th.border}`, borderRadius: '14px' }}>
          <p style={{ color: th.sub, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px', fontWeight: '600' }}>
            {isDE ? 'Gesamt-Fortschritt' : 'Overall progress'}
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'space-around' }}>
            {[
              { val: totalMastered, label: isDE ? 'Gemeistert' : 'Mastered', color: TEAL },
              { val: totalCards - totalMastered, label: isDE ? 'In Arbeit' : 'In progress', color: th.gold },
              { val: totalCards, label: isDE ? 'Gesamt' : 'Total', color: th.sub },
            ].map(({ val, label, color }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <p style={{ color, fontSize: '1.5rem', fontWeight: '700', margin: '0 0 2px', fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif" }}>{val}</p>
                <p style={{ color: th.sub, fontSize: '0.65rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LanguageProgressScreen
