import React, { useState } from 'react'
import { THEMES, makeStyles, resolveTheme } from '../theme'
import { LANG_FLAGS, getActiveLangPairs } from '../appShared'

const TEAL = '#00D4AA'
const GOLD = '#FFD700'
const LANG_NAMES = { de: 'Deutsch', en: 'English', sw: 'Swahili', th: 'Thai', es: 'Español', fr: 'Français', ar: 'عربي', tr: 'Türkçe', pt: 'Português' }
const CAT_INFO = [
  { key: 'vocabulary', emoji: '📖', de: 'Wörter', en: 'Words' },
  { key: 'sentence',   emoji: '💬', de: 'Sätze',  en: 'Sentences' },
  { key: 'street',     emoji: '🏙️', de: 'Straße', en: 'Street' },
  { key: 'home',       emoji: '🏠', de: 'Zuhause', en: 'Home' },
  { key: 'basics',     emoji: '🔤', de: 'Grundlagen', en: 'Basics' },
  { key: 'grundlagen', emoji: '🔤', de: 'Grundlagen', en: 'Basics' },
  { key: 'saetze',     emoji: '💬', de: 'Sätze',  en: 'Sentences' },
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
  const fromLang = myData?.fromLang || lang
  const toLangCode = myData?.toLang || (lang === 'de' ? 'en' : 'de')

  const activePairs = getActiveLangPairs(myData)

  // Count tiers from cardProgress directly (not allCards — pool cards not in allCards)
  // Filter to active lang pairs: pool card IDs embed langPair (e.g. vocab_de_en_1_5)
  const allProgressEntries = Object.entries(cardProgress).filter(([id]) => {
    if (/_r(_\d+)?$/.test(id)) return false
    if (activePairs.length === 0) return true
    if (activePairs.some(lp => id.includes(`_${lp}_`) || id.endsWith(`_${lp}`))) return true
    const card = (allCards || []).find(c => c.id === id)
    if (card?.langA && card?.langB) {
      return activePairs.includes(`${card.langA}_${card.langB}`) || activePairs.includes(`${card.langB}_${card.langA}`)
    }
    return true
  })
  const gesehen   = allProgressEntries.filter(([, p]) => (p?.interval || 0) >= 1).length
  const bekannt   = allProgressEntries.filter(([, p]) => (p?.interval || 0) >= 3).length
  const gemeistert = allProgressEntries.filter(([, p]) => (p?.interval || 0) >= 7).length

  const totalCards = allProgressEntries.length

  // Per-category counts from cardProgress using ID prefix heuristics
  const buildCatStats = () => {
    const catPrefixMap = {
      vocabulary: ['vocab_'],
      sentence:   ['sentence_', 'urlaub_'],
      street:     ['street_'],
      home:       ['home_'],
      grundlagen: ['grundlagen_'],
      saetze:     ['saetze_'],
    }
    return CAT_INFO.filter((c, i, arr) => arr.findIndex(x => x.key === c.key) === i).map(cat => {
      const prefixes = catPrefixMap[cat.key] || []
      const entries = allProgressEntries.filter(([id]) =>
        prefixes.some(p => id.startsWith(p)) ||
        (allCards || []).some(c => c.id === id && c.category === cat.key)
      )
      const total = entries.length
      const catGesehen    = entries.filter(([, p]) => (p?.interval || 0) >= 1).length
      const catBekannt    = entries.filter(([, p]) => (p?.interval || 0) >= 3).length
      const catGemeistert = entries.filter(([, p]) => (p?.interval || 0) >= 7).length
      return { ...cat, total, catGesehen, catBekannt, catGemeistert }
    }).filter(c => c.total > 0)
  }

  // Detect target langs: primary from myData, secondary from allCards
  const extraLangs = [...new Set((allCards || []).map(c => c.targetLang).filter(Boolean))]
  const sortedLangs = [toLangCode, ...extraLangs.filter(l => l !== toLangCode)].filter(Boolean)

  let lastActive = null
  ;[...sessionHistory].sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach(h => {
    if (!lastActive && h.date) lastActive = h.date
  })

  const pctGesehen    = totalCards > 0 ? Math.round((gesehen / totalCards) * 100) : 0
  const pctBekannt    = totalCards > 0 ? Math.round((bekannt / totalCards) * 100) : 0
  const pctGemeistert = totalCards > 0 ? Math.round((gemeistert / totalCards) * 100) : 0

  const catStats = buildCatStats()

  return (
    <div style={s.container} className="vocara-screen">
      <div style={s.homeBox}>
        <button style={s.backBtn} onClick={onBack}>← {isDE ? 'Zurück' : 'Back'}</button>

        <div style={{ textAlign: 'center', marginBottom: '20px', paddingTop: '8px' }}>
          <p style={{ fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif", fontSize: '1.4rem', fontWeight: '700', color: TEAL, margin: '0 0 4px', letterSpacing: '-0.5px' }}>
            🌍 {isDE ? 'Meine Sprachen' : 'My Languages'}
          </p>
          <p style={{ color: th.sub, fontSize: '0.78rem', margin: 0 }}>
            {gemeistert} {isDE ? 'von' : 'of'} {totalCards} {isDE ? 'Karten gemeistert' : 'cards mastered'}
          </p>
        </div>

        {/* ── Primary language card ── */}
        {sortedLangs.map(targetLang => {
          const isPrimary = targetLang === toLangCode
          const flag = LANG_FLAGS[targetLang] || '🌐'
          const name = LANG_NAMES[targetLang] || targetLang.toUpperCase()
          const isExpanded = expandedLang === targetLang
          return (
            <div key={targetLang} style={{
              background: isPrimary ? `${TEAL}0F` : th.card,
              border: `1px solid ${isPrimary ? TEAL + '44' : th.border}`,
              borderRadius: '18px', overflow: 'hidden', marginBottom: '12px',
            }}>
              <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
                onClick={() => setExpandedLang(isExpanded ? null : targetLang)}>
                <div style={{ flexShrink: 0 }}>
                  <ProgressRing pct={pctGemeistert} color={isPrimary ? TEAL : '#7a8aaa'}>
                    <span style={{ fontSize: '1.3rem', display: 'block' }}>{flag}</span>
                  </ProgressRing>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '6px' }}>
                    <span style={{ fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif", color: isPrimary ? TEAL : th.text, fontWeight: '700', fontSize: '1rem' }}>{name}</span>
                    {isPrimary && <span style={{ fontSize: '0.6rem', color: TEAL, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', opacity: 0.8 }}>{isDE ? 'Primär' : 'Primary'}</span>}
                  </div>
                  {/* Three-tier progress bars */}
                  {[
                    { label: isDE ? '👁️ Gesehen' : '👁️ Seen',      count: gesehen,    pct: pctGesehen,    color: '#7a8aaa' },
                    { label: isDE ? '📖 Bekannt' : '📖 Known',      count: bekannt,    pct: pctBekannt,    color: GOLD },
                    { label: isDE ? '⭐ Gemeistert' : '⭐ Mastered', count: gemeistert, pct: pctGemeistert, color: TEAL },
                  ].map(({ label, count, pct, color }) => (
                    <div key={label} style={{ marginBottom: '5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                        <span style={{ color: th.sub, fontSize: '0.65rem' }}>{label}</span>
                        <span style={{ color, fontSize: '0.65rem', fontWeight: '700' }}>{count} ({pct}%)</span>
                      </div>
                      <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  ))}
                  {lastActive && <span style={{ color: th.sub, fontSize: '0.62rem', opacity: 0.6, display: 'block', marginTop: '4px' }}>{lastActive}</span>}
                </div>
                <span style={{ color: th.sub, fontSize: '0.75rem', flexShrink: 0, paddingRight: '2px' }}>{isExpanded ? '▲' : '▼'}</span>
              </div>
              {isExpanded && catStats.length > 0 && (
                <div style={{ borderTop: `1px solid ${isPrimary ? TEAL + '22' : th.border}`, padding: '10px 18px 14px', animation: 'vocaraFadeIn 0.2s ease both' }}>
                  <p style={{ color: th.sub, fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px', fontWeight: '600' }}>
                    {isDE ? 'Nach Kategorie' : 'By category'}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {catStats.map(c => (
                      <div key={c.key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span style={{ color: th.text, fontSize: '0.72rem' }}>{c.emoji} {isDE ? c.de : c.en}</span>
                          <span style={{ color: th.sub, fontSize: '0.62rem' }}>
                            👁️{c.catGesehen} · 📖{c.catBekannt} · ⭐{c.catGemeistert}
                          </span>
                        </div>
                        <div style={{ height: '2px', background: 'rgba(255,255,255,0.08)', borderRadius: '1px', overflow: 'hidden', position: 'relative' }}>
                          <div style={{ position: 'absolute', height: '100%', width: `${c.total > 0 ? Math.round((c.catGesehen / c.total) * 100) : 0}%`, background: '#7a8aaa', borderRadius: '1px' }} />
                          <div style={{ position: 'absolute', height: '100%', width: `${c.total > 0 ? Math.round((c.catBekannt / c.total) * 100) : 0}%`, background: GOLD, borderRadius: '1px' }} />
                          <div style={{ position: 'absolute', height: '100%', width: `${c.total > 0 ? Math.round((c.catGemeistert / c.total) * 100) : 0}%`, background: TEAL, borderRadius: '1px' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {sortedLangs.length === 0 && (
          <p style={{ color: th.sub, textAlign: 'center', fontSize: '0.88rem', margin: '20px 0' }}>
            {isDE ? 'Noch keine Karten vorhanden.' : 'No cards yet.'}
          </p>
        )}

        {/* ── Gesamt-Fortschritt ── */}
        <div style={{ marginTop: '8px', padding: '14px 16px', background: th.card, border: `1px solid ${th.border}`, borderRadius: '14px' }}>
          <p style={{ color: th.sub, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px', fontWeight: '600' }}>
            {isDE ? 'Gesamt-Fortschritt' : 'Overall progress'}
          </p>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-around' }}>
            {[
              { val: gesehen,    label: isDE ? '👁️ Gesehen'    : '👁️ Seen',    color: '#7a8aaa' },
              { val: bekannt,    label: isDE ? '📖 Bekannt'    : '📖 Known',    color: GOLD },
              { val: gemeistert, label: isDE ? '⭐ Gemeistert' : '⭐ Mastered', color: TEAL },
            ].map(({ val, label, color }) => (
              <div key={label} style={{ textAlign: 'center', flex: 1 }}>
                <p style={{ color, fontSize: '1.4rem', fontWeight: '700', margin: '0 0 2px', fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif" }}>{val}</p>
                <p style={{ color: th.sub, fontSize: '0.6rem', margin: 0, letterSpacing: '0.2px' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default LanguageProgressScreen
