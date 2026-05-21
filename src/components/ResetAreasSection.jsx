import React, { useState } from 'react'
import { doc, setDoc, writeBatch } from 'firebase/firestore'
import { db, auth } from '../firebase'
import { todayStr, getCatLevelFromCount } from '../appShared'
import { invalidateCache } from '../hooks/useCardCache'

const RESET_AREAS = [
  { key: 'basics',       labelDE: 'Grundlagen',     labelEN: 'Basics'            },
  { key: 'vocabulary',   labelDE: 'Meine Worte',    labelEN: 'My Words'          },
  { key: 'street',       labelDE: 'Auf der Straße', labelEN: 'On the Street'     },
  { key: 'home',         labelDE: 'Und zu Hause',   labelEN: 'At Home'           },
  { key: 'urlaub',       labelDE: 'Im Urlaub',      labelEN: 'Travel'            },
  { key: 'satztraining', labelDE: 'Satztraining',   labelEN: 'Sentence Training' },
  { key: 'sentence',     labelDE: 'Werden Sätze',   labelEN: 'Become Sentences'  },
]

function ResetAreasSection({ myData, setMyData, user, allCards, t, s, th, lang, categoryLevels, setCategoryLevels }) {
  const isDE = lang === 'de'
  const [resetConfirm, setResetConfirm] = useState(null)

  const getLvForArea = (key) => {
    const n = myData?.masteredPerCategory?.[key] || 0
    if (key === 'urlaub') return Math.min(10, Math.floor(n / 6))
    if (key === 'home')   return Math.min(10, Math.floor(n / 8))
    return getCatLevelFromCount(n)
  }

  const handleAreaReset = async (areaKey) => {
    const cp = { ...(myData?.cardProgress || {}) }
    const today = todayStr()
    const isPoolCategory = ['basics', 'home', 'street'].includes(areaKey)
    let updatedAiCards = myData?.aiCards || []
    if (isPoolCategory) {
      const removedIds = updatedAiCards.filter(c => c.category === areaKey).map(c => c.id)
      removedIds.forEach(id => { delete cp[id] })
      updatedAiCards = updatedAiCards.filter(c => c.category !== areaKey)
    } else if (areaKey !== 'satztraining') {
      ;(allCards || []).forEach(c => {
        if (c.category === areaKey && cp[c.id]) {
          cp[c.id] = { ...cp[c.id], interval: 0, consecutiveRight: 0, wrongSessions: 0, nextReview: today, isGolden: false, mastered: false, masteredAt: null, masteredReviewCount: 0 }
        }
      })
    }
    const mpc = { ...(myData?.masteredPerCategory || {}), [areaKey]: 0 }

    if (areaKey === 'basics') {
      ['de_en', 'en_de', 'de_sw'].forEach(pair => {
        [1, 2, 3].forEach(lv => invalidateCache(`grundlagen_${pair}_${lv}`))
      })
    } else {
      invalidateCache(areaKey)
    }

    const AREA_TO_CAT_KEY = { basics: 'grundlagen', vocabulary: 'vocab', sentence: 'satz', street: 'street', home: 'home', urlaub: 'urlaub', satztraining: 'satz' }
    const resetCatKey = AREA_TO_CAT_KEY[areaKey]
    let newCatLevels = categoryLevels
    if (resetCatKey) {
      newCatLevels = { ...categoryLevels, [resetCatKey]: 1 }
      setCategoryLevels(newCatLevels)
      setDoc(doc(db, 'users', user.uid, 'settings', 'categoryLevels'), newCatLevels)
        .catch(e => console.error('[Reset] FAILED categoryLevels:', e.code, e.message))
    }

    setMyData(d => ({
      ...d,
      ...(isPoolCategory ? { aiCards: [...updatedAiCards] } : {}),
      cardProgress: { ...cp },
      masteredPerCategory: { ...mpc },
      ...(areaKey === 'basics' ? { basicsPoolLevel: 1 } : {}),
    }))
    setResetConfirm(null)

    const updates = { masteredPerCategory: { ...mpc }, cardProgress: { ...cp } }
    if (isPoolCategory) updates.aiCards = updatedAiCards
    if (areaKey === 'basics') updates.basicsPoolLevel = 1
    try {
      const batch = writeBatch(db)
      batch.update(doc(db, 'users', user.uid), updates)
      await batch.commit()
    } catch (e) { console.error('[Reset] FAILED:', e.code, e.message) }
    const newMasteredCards = Object.values(cp).filter(p => (p?.interval || 0) >= 7).length
    setDoc(doc(db, 'users', user.uid, 'publicStats', 'data'),
      { masteredCards: newMasteredCards, totalCards: Object.keys(cp).length },
      { merge: true }
    ).catch(e => console.error('[Reset] FAILED publicStats update:', e.code, e.message))
  }

  const confirmArea = RESET_AREAS.find(a => a.key === resetConfirm)
  const confirmLabel = confirmArea ? (isDE ? confirmArea.labelDE : confirmArea.labelEN) : ''

  return (
    <div style={s.card}>
      <p style={{ ...s.cardLabel, marginBottom: '10px' }}>🔄 {isDE ? 'Bereiche zurücksetzen' : 'Reset areas'}</p>
      <p style={{ color: th.sub, fontSize: '0.75rem', marginBottom: '14px', lineHeight: 1.4 }}>
        {isDE ? 'Setze einzelne Lernbereiche auf Level 1 zurück.' : 'Reset individual learning areas to Level 1.'}
      </p>
      {RESET_AREAS.map(area => {
        const lv = Math.max(1, getLvForArea(area.key))
        const label = isDE ? area.labelDE : area.labelEN
        return (
          <div key={area.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${th.border}` }}>
            <span style={{ color: th.text, fontSize: '0.88rem' }}>{label} <span style={{ color: th.sub, fontSize: '0.78rem' }}>Lvl {lv}</span></span>
            <button onClick={() => setResetConfirm(area.key)}
              style={{ background: 'transparent', border: '1px solid rgba(224,108,117,0.4)', borderRadius: '20px', padding: '4px 12px', color: '#e06c75', fontSize: '0.78rem', cursor: 'pointer', fontWeight: '600', flexShrink: 0 }}>
              🔄 Reset
            </button>
          </div>
        )
      })}
      {resetConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backdropFilter: 'blur(4px)' }}
          onClick={() => setResetConfirm(null)}>
          <div style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: '20px', padding: '28px 22px', maxWidth: '320px', width: '100%', textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.45)', animation: 'vocaraFadeIn 0.2s ease both' }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: '2rem', margin: '0 0 12px' }}>🔄</p>
            <p style={{ color: th.text, fontWeight: '700', fontSize: '1rem', marginBottom: '10px' }}>
              {isDE ? `„${confirmLabel}" zurücksetzen?` : `Reset „${confirmLabel}"?`}
            </p>
            <p style={{ color: th.sub, fontSize: '0.85rem', marginBottom: '24px', lineHeight: 1.5 }}>
              {isDE
                ? `Du fängst bei ${confirmLabel} wieder bei Level 1 an. Deine Karten bleiben erhalten.`
                : `You'll restart ${confirmLabel} from Level 1. Your cards are kept.`}
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setResetConfirm(null)}
                style={{ flex: 1, padding: '11px', borderRadius: '12px', border: `1px solid ${th.border}`, background: 'transparent', color: th.sub, fontSize: '0.88rem', cursor: 'pointer' }}>
                {isDE ? 'Abbrechen' : 'Cancel'}
              </button>
              <button onClick={() => handleAreaReset(resetConfirm)}
                style={{ flex: 1, padding: '11px', borderRadius: '12px', border: '1px solid rgba(224,108,117,0.5)', background: 'rgba(224,108,117,0.12)', color: '#e06c75', fontSize: '0.88rem', cursor: 'pointer', fontWeight: '700' }}>
                {isDE ? 'Zurücksetzen' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ResetAreasSection
