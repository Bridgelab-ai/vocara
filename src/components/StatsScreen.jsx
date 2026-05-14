import React, { useEffect } from 'react'
import { MARK_UID, ELOSY_UID, getTenseUnlocks, TENSE_LABELS, TENSE_THRESHOLDS, calcStreak, calcLongestStreak, getISOWeekStr, todayStr } from '../appShared'
import StreakWidget from './StreakWidget'

function StatRow({ label, mastered, active, total, s }) {
  const pct = active > 0 ? Math.round((mastered / active) * 100) : 0
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={s.langRow}>
        <span style={{ ...s.lang, fontSize: '0.9rem' }}>{label}</span>
        <span style={{ ...s.langPct, fontSize: '0.8rem' }}>{mastered}/{active} ✓ · {active}/{total}</span>
      </div>
      <div style={s.progressBar}><div style={{ ...s.progressFill, width: `${pct}%` }} /></div>
    </div>
  )
}

function StatsScreen({ user, myData, partnerData, allCards, lang, theme, onBack, cardProgress, t: tProp, onRefreshPartner, th, s }) {
  if (!th || !s) return null
  if (!myData) return null
  const t = tProp
  const today = todayStr()

  useEffect(() => {
    if (!partnerData && onRefreshPartner) {
      const partnerUID = myData?.partnerUID || (user?.uid === MARK_UID ? ELOSY_UID : user?.uid === ELOSY_UID ? MARK_UID : null)
      if (partnerUID) onRefreshPartner(partnerUID)
    }
  }, [])
  const tom = new Date(); tom.setDate(tom.getDate() + 1)
  const tomorrow = tom.toISOString().slice(0, 10)

  const sessionHistory = myData?.sessionHistory || []
  const todayCorrect = sessionHistory.filter(h => h.date === today).reduce((a, b) => a + (b.correct || 0), 0)
  const todaySessions = sessionHistory.filter(h => h.date === today).length
  const myStreak = calcStreak(sessionHistory)
  const totalCards = (allCards ?? []).filter(c => !/_r(_\d+)?$/.test(c.id)).length
  const dueTomorrow = Object.values(cardProgress).filter(p => p.nextReview === tomorrow).length
  const myMastered = Object.values(cardProgress).filter(p => (p?.interval || 0) >= 7).length

  const partnerHistory = partnerData?.sessionHistory || []
  const partnerStreak = partnerData?.streak ?? calcStreak(partnerHistory)
  const partnerTodayCorrect = partnerHistory.filter(h => h.date === today).reduce((a, b) => a + (b.correct || 0), 0)
  const partnerTodaySessions = partnerHistory.filter(h => h.date === today).length
  const partnerProgress = partnerData?.cardProgress || {}
  const partnerMastered = partnerData?.masteredCards ?? Object.values(partnerProgress).filter(p => (p?.interval || 0) >= 7).length
  const partnerActive = partnerData?.totalCards ?? Object.keys(partnerProgress).length

  const myTotalLearned = sessionHistory.reduce((a, b) => a + (b.correct || 0), 0)
  const partnerTotalLearned = partnerHistory.reduce((a, b) => a + (b.correct || 0), 0)
  const myLearningDays = new Set(sessionHistory.map(h => h.date)).size
  const partnerLearningDays = new Set(partnerHistory.map(h => h.date)).size
  const myLongestStreak = calcLongestStreak(sessionHistory)
  const partnerLongestStreak = calcLongestStreak(partnerHistory)
  const currentWeekStr = getISOWeekStr()
  const weekFilter = (h) => getISOWeekStr(new Date(...h.date.split('-').map((v, i) => i === 1 ? v - 1 : +v))) === currentWeekStr
  const myWeekSessions = sessionHistory.filter(weekFilter).length
  const partnerWeekSessions = partnerHistory.filter(weekFilter).length
  const myWeekLearnSec = sessionHistory.filter(weekFilter).reduce((a, b) => a + (b.total || 0) * 15, 0)
  const partnerWeekLearnSec = partnerHistory.filter(weekFilter).reduce((a, b) => a + (b.total || 0) * 15, 0)
  const myWeekCorrect = sessionHistory.filter(weekFilter).reduce((a, b) => a + (b.correct || 0), 0)
  const partnerWeekCorrect = partnerHistory.filter(weekFilter).reduce((a, b) => a + (b.correct || 0), 0)
  const myWeekTotal = sessionHistory.filter(weekFilter).reduce((a, b) => a + (b.total || 0), 0)
  const partnerWeekTotal = partnerHistory.filter(weekFilter).reduce((a, b) => a + (b.total || 0), 0)
  const myWeekAccuracy = myWeekTotal > 0 ? Math.round(myWeekCorrect / myWeekTotal * 100) : 0
  const partnerWeekAccuracy = partnerWeekTotal > 0 ? Math.round(partnerWeekCorrect / partnerWeekTotal * 100) : 0
  const fmtMin = (s) => s < 60 ? `${s}s` : `${Math.round(s / 60)} min`
  const AREA_LABEL_MAP = { vocabulary: lang === 'de' ? 'Worte' : 'Words', sentence: lang === 'de' ? 'Sätze' : 'Sentences', street: lang === 'de' ? 'Straße' : 'Street', home: lang === 'de' ? 'Zuhause' : 'Home', basics: lang === 'de' ? 'Grundlagen' : 'Basics', urlaub: lang === 'de' ? '✈️ Urlaub' : '✈️ Travel' }
  const getFavArea = (progress) => {
    const counts = {}
    Object.keys(progress).forEach(id => {
      const card = (allCards ?? []).find(c => c.id === id)
      if (card?.category) counts[card.category] = (counts[card.category] || 0) + 1
    })
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    return top ? (AREA_LABEL_MAP[top[0]] || top[0]) : '—'
  }
  const getWeeklyFavArea = (history) => {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
    const weekStr = weekAgo.toISOString().slice(0, 10)
    const counts = {}
    history.filter(h => h.date >= weekStr && h.area).forEach(h => {
      counts[h.area] = (counts[h.area] || 0) + 1
    })
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
    return top ? (AREA_LABEL_MAP[top[0]] || top[0]) : null
  }
  const myFavArea = getFavArea(cardProgress)
  const partnerFavArea = getFavArea(partnerProgress)
  const myWeeklyFavArea = getWeeklyFavArea(sessionHistory)
  const partnerWeeklyFavArea = getWeeklyFavArea(partnerHistory)

  const myName = myData?.name?.split(' ')[0] || user.displayName?.split(' ')[0] || 'Ich'
  const partnerName = myData?.partnerName || partnerData?.name?.split(' ')[0] || 'Partner'
  const hasPartner = !!myData?.partnerUID || !!partnerData

  const statBox = (label, value, sub) => (
    <div style={{ flex: 1, background: th.card, borderRadius: '14px', padding: '16px 12px', border: `1px solid ${th.border}`, textAlign: 'center' }}>
      <p style={{ color: th.gold, fontSize: '1.8rem', fontWeight: '900', margin: 0, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ color: th.accent, fontSize: '0.72rem', margin: '2px 0 4px', fontWeight: '600' }}>{sub}</p>}
      <p style={{ color: th.sub, fontSize: '0.72rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
    </div>
  )

  const compRow = (label, myVal, partnerVal) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${th.border}` }}>
      <span style={{ color: th.text, fontWeight: '600', fontSize: '0.85rem', minWidth: '60px', textAlign: 'center' }}>{myVal}</span>
      <span style={{ color: th.sub, fontSize: '0.75rem', flex: 1, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      <span style={{ color: th.text, fontWeight: '600', fontSize: '0.85rem', minWidth: '60px', textAlign: 'center' }}>{partnerVal}</span>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', minHeight: '100dvh', width: '100%', background: th.bgGrad, backgroundColor: th.bg, display: 'flex', flexDirection: 'column', alignItems: 'center' }} className="vocara-screen">
      {/* ── FIXED BACK BAR ── */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: th.bg, borderBottom: `1px solid ${th.border}`, display: 'flex', alignItems: 'center', padding: '0 16px', minHeight: '52px' }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: th.accent, cursor: 'pointer', fontSize: '1.1rem', fontWeight: '700', padding: '12px 8px 12px 0', display: 'flex', alignItems: 'center', gap: '6px', WebkitTapHighlightColor: 'transparent' }}
        >
          ← {t.back}
        </button>
        <span style={{ color: th.text, fontWeight: '600', fontSize: '1rem', marginLeft: '8px' }}>
          {t.statistics}
        </span>
      </div>
      <div style={{ ...s.homeBox, paddingTop: '68px' }}>

      {/* ── TOP STATS GRID ── */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
        {statBox(t.learnedToday, todayCorrect, `${todaySessions} Session${todaySessions !== 1 ? 's' : ''}`)}
        {statBox('Streak', myStreak > 0 ? `🔥 ${myStreak}` : '—', t.statDays)}
      </div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {statBox(t.totalCards, totalCards, `${myMastered} ✓`)}
        {statBox(t.dueTomorrow, dueTomorrow, '')}
      </div>

      {/* ── LERNZEIT ── */}
      {(() => {
        const nowMonth = new Date().toISOString().slice(0, 7)
        const nowWeek = getISOWeekStr()
        const wMin = myData?.learningWeek === nowWeek ? (myData?.weeklyMinutes || 0) : 0
        const mMin = myData?.learningMonth === nowMonth ? (myData?.monthlyMinutes || 0) : 0
        const tMin = myData?.totalMinutes || 0
        if (tMin === 0) return null
        return (
          <div style={{ ...s.card, marginBottom: '12px' }}>
            <p style={{ ...s.cardLabel, marginBottom: '10px' }}>{t.studyTime}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {[
                [t.week, wMin],
                [t.month, mMin],
                [t.total, tMin],
              ].map(([label, min]) => (
                <div key={label} style={{ textAlign: 'center', flex: 1 }}>
                  <p style={{ color: th.gold, fontSize: '1.3rem', fontWeight: '700', margin: '0 0 2px', lineHeight: 1 }}>{min < 60 ? `${min}m` : `${Math.round(min/60)}h`}</p>
                  <p style={{ color: th.sub, fontSize: '0.68rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── 7-DAY CHART ── */}
      <div style={{ ...s.card, marginBottom: '16px' }}>
        <StreakWidget history={sessionHistory} th={th} t={t} />
      </div>

      {/* ── LIEBLINGSBEREICH solo (#29) ── */}
      {!hasPartner && (myFavArea !== '—' || myWeeklyFavArea) && (
        <div style={{ ...s.card, marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            {myFavArea !== '—' && (
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, color: th.sub, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🔥 {t.favArea}</p>
                <p style={{ margin: '3px 0 0', color: th.text, fontWeight: '700', fontSize: '0.95rem' }}>{myFavArea}</p>
              </div>
            )}
            {myWeeklyFavArea && (
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, color: th.sub, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📅 {lang === 'de' ? 'Diese Woche' : 'This week'}</p>
                <p style={{ margin: '3px 0 0', color: th.accent, fontWeight: '700', fontSize: '0.95rem' }}>{myWeeklyFavArea}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ZEITFORMEN FORTSCHRITT ── */}
      {(() => {
        const unlocks = getTenseUnlocks(myMastered)
        const unlockedTenses = Object.entries(unlocks).filter(([, v]) => v).map(([k]) => k)
        const nextTense = !unlocks.past ? 'past' : !unlocks.future ? 'future' : null
        return (
          <div style={{ ...s.card, marginBottom: '16px' }}>
            <p style={{ ...s.cardLabel, marginBottom: '10px' }}>{t.tenseLevel}</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: nextTense ? '10px' : 0 }}>
              {['present','past','future'].map(tn => {
                const tl = TENSE_LABELS[tn]; const on = unlocks[tn]
                return (
                  <div key={tn} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRadius: '10px', background: on ? `${th.accent}20` : th.border, border: `1px solid ${on ? th.accent : 'transparent'}`, opacity: on ? 1 : 0.4 }}>
                    <div style={{ fontSize: '1.2rem' }}>{tl.emoji}</div>
                    <div style={{ color: on ? th.accent : th.sub, fontSize: '0.7rem', fontWeight: '600', marginTop: '2px' }}>{lang === 'de' ? tl.de : tl.en}</div>
                  </div>
                )
              })}
            </div>
            {nextTense && (() => {
              const threshold = nextTense === 'past' ? TENSE_THRESHOLDS.past : TENSE_THRESHOLDS.future
              const prev = nextTense === 'past' ? 0 : TENSE_THRESHOLDS.past
              const pct = Math.min(100, Math.round(((myMastered - prev) / (threshold - prev)) * 100))
              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: th.sub, fontSize: '0.72rem' }}>{lang === 'de' ? `→ ${TENSE_LABELS[nextTense].de} freischalten` : `→ Unlock ${TENSE_LABELS[nextTense].en}`}</span>
                    <span style={{ color: th.sub, fontSize: '0.72rem' }}>{myMastered}/{threshold}</span>
                  </div>
                  <div style={{ height: '5px', background: th.border, borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: th.accent, borderRadius: '4px', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              )
            })()}
          </div>
        )
      })()}

      {/* ── REAKTIONSZEIT & KARTEN-RECORDS ── */}
      {(() => {
        const entries = Object.entries(cardProgress)
        const withReaction = entries.filter(([, p]) => p?._lastReactionMs > 0)
        if (withReaction.length === 0) return null
        const fastest = withReaction.sort((a, b) => a[1]._lastReactionMs - b[1]._lastReactionMs)[0]
        const hardest = entries.filter(([, p]) => (p?.wrongCount || 0) > 0).sort((a, b) => (b[1].wrongCount || 0) - (a[1].wrongCount || 0))[0]
        const avgMs = Math.round(withReaction.reduce((s, [, p]) => s + p._lastReactionMs, 0) / withReaction.length)
        const fastCard = (allCards ?? []).find(c => c.id === fastest?.[0])
        const hardCard = (allCards ?? []).find(c => c.id === hardest?.[0])
        return (
          <div style={{ ...s.card, marginBottom: '16px' }}>
            <p style={{ ...s.cardLabel, marginBottom: '10px' }}>{t.reactionTime}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: th.gold, fontSize: '1.4rem', fontWeight: '700', margin: '0 0 2px' }}>{(avgMs/1000).toFixed(1)}s</p>
                <p style={{ color: th.sub, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>{t.average}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#4CAF50', fontSize: '1.4rem', fontWeight: '700', margin: '0 0 2px' }}>{(fastest[1]._lastReactionMs/1000).toFixed(1)}s</p>
                <p style={{ color: th.sub, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>{t.fastest}</p>
              </div>
            </div>
            {fastCard && <p style={{ color: th.sub, fontSize: '0.75rem', margin: '0 0 6px', textAlign: 'center', fontStyle: 'italic' }}>⚡ "{fastCard?.front}"</p>}
            {hardCard && (
              <div style={{ padding: '8px 10px', background: `${th.accent}12`, borderRadius: '8px', border: `1px solid ${th.accent}30` }}>
                <p style={{ color: th.sub, fontSize: '0.72rem', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🎯 {t.hardestCard}
                </p>
                <p style={{ color: th.text, fontSize: '0.82rem', fontWeight: '600', margin: 0 }}>"{hardCard?.front}" · {hardest[1].wrongCount}✗</p>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── PARTNER COMPARISON ── */}
      {hasPartner && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ color: th.accent, fontWeight: '700', fontSize: '0.9rem' }}>{myName}</span>
            <span style={{ color: th.sub, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', alignSelf: 'center' }}>vs</span>
            <span style={{ color: th.gold, fontWeight: '700', fontSize: '0.9rem' }}>{partnerName}</span>
          </div>
          {/* ── ACHIEVEMENT BADGES ── */}
          {(() => {
            const TEAL = '#00D4AA'
            const badges = [
              { emoji: '🏅', label: lang === 'de' ? 'Fleißigster' : 'Most diligent', myVal: myWeekSessions, pVal: partnerWeekSessions, fmt: v => `${v}` },
              { emoji: '🔥', label: lang === 'de' ? 'Longest Streak' : 'Best streak', myVal: myLongestStreak, pVal: partnerLongestStreak, fmt: v => `${v}d` },
              { emoji: '🎯', label: lang === 'de' ? 'Genauigkeit' : 'Accuracy', myVal: myWeekAccuracy, pVal: partnerWeekAccuracy, fmt: v => `${v}%` },
              { emoji: '📚', label: lang === 'de' ? 'Gemeistert' : 'Mastered', myVal: myMastered, pVal: partnerMastered, fmt: v => `${v}` },
              { emoji: '⚡', label: lang === 'de' ? 'Wochenkarten' : 'Week cards', myVal: myWeekCorrect, pVal: partnerWeekCorrect, fmt: v => `${v}` },
            ]
            return (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {badges.map(({ emoji, label, myVal, pVal, fmt }) => {
                  const myWins = myVal > pVal
                  const pWins = pVal > myVal
                  return (
                    <div key={label} style={{ flex: '1 1 calc(33% - 4px)', minWidth: '80px', textAlign: 'center', padding: '8px 4px', borderRadius: '12px', background: myWins ? `${TEAL}15` : pWins ? `${th.gold}15` : th.card, border: `1px solid ${myWins ? TEAL + '40' : pWins ? th.gold + '40' : th.border}`, boxShadow: myWins ? `0 0 8px ${TEAL}25` : pWins ? `0 0 8px ${th.gold}25` : 'none' }}>
                      <div style={{ fontSize: '1.1rem' }}>{emoji}</div>
                      <div style={{ color: th.sub, fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.4px', margin: '2px 0 4px' }}>{label}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                        <span style={{ color: myWins ? TEAL : th.sub, fontWeight: myWins ? '700' : '500', fontSize: '0.82rem' }}>{fmt(myVal)}</span>
                        <span style={{ color: th.border, fontSize: '0.55rem' }}>:</span>
                        <span style={{ color: pWins ? th.gold : th.sub, fontWeight: pWins ? '700' : '500', fontSize: '0.82rem' }}>{fmt(pVal)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
          {/* ── LERNZEIT BARS ── */}
          {(() => {
            const nowWeek = getISOWeekStr()
            const nowMonth = new Date().toISOString().slice(0, 7)
            const myW = myData?.learningWeek === nowWeek ? (myData?.weeklyMinutes || 0) : 0
            const myM = myData?.learningMonth === nowMonth ? (myData?.monthlyMinutes || 0) : 0
            const myT = myData?.totalMinutes || 0
            const pW = partnerData?.learningWeek === nowWeek ? (partnerData?.weeklyMinutes || 0) : 0
            const pM = partnerData?.learningMonth === nowMonth ? (partnerData?.monthlyMinutes || 0) : 0
            const pT = partnerData?.totalMinutes || 0
            const fmtM = (m) => m < 60 ? `${m}m` : `${Math.round(m/60)}h`
            const BarPair = ({ label, myVal, pVal }) => {
              const maxVal = Math.max(myVal, pVal, 1)
              const myPct = Math.round(myVal / maxVal * 100)
              const pPct = Math.round(pVal / maxVal * 100)
              return (
                <div style={{ padding: '8px 0', borderBottom: `1px solid ${th.border}` }}>
                  <p style={{ color: th.sub, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'center', margin: '0 0 6px' }}>{label}</p>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      <p style={{ color: th.accent, fontWeight: '700', fontSize: '0.82rem', margin: '0 0 3px' }}>{fmtM(myVal)}</p>
                      <div style={{ height: '28px', background: th.border, borderRadius: '4px 4px 0 0', overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
                        <div style={{ width: `${myPct}%`, height: '100%', background: th.accent, borderRadius: '4px 4px 0 0', transition: 'width 0.6s ease', marginLeft: 'auto' }} />
                      </div>
                    </div>
                    <div style={{ width: '1px', background: th.border, height: '28px', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ color: th.gold, fontWeight: '700', fontSize: '0.82rem', margin: '0 0 3px' }}>{fmtM(pVal)}</p>
                      <div style={{ height: '28px', background: th.border, borderRadius: '4px 4px 0 0', overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
                        <div style={{ width: `${pPct}%`, height: '100%', background: th.gold, borderRadius: '4px 4px 0 0', transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            }
            return (
              <div style={{ marginTop: '8px' }}>
                <BarPair label={lang === 'de' ? 'Diese Woche' : 'This week'} myVal={myW} pVal={pW} />
                <BarPair label={lang === 'de' ? 'Dieser Monat' : 'This month'} myVal={myM} pVal={pM} />
                <div style={{ padding: '8px 0 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: th.accent, fontWeight: '700', fontSize: '0.82rem' }}>{fmtM(myT)}</span>
                    <span style={{ color: th.sub, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.total}</span>
                    <span style={{ color: th.gold, fontWeight: '700', fontSize: '0.82rem' }}>{fmtM(pT)}</span>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div></div>
  )
}

export default StatsScreen
