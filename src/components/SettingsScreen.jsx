import React, { useState } from 'react'
import TutorialTooltip from './TutorialTooltip'
import TopicUnlockSection from './TopicUnlockSection'
import ResetAreasSection from './ResetAreasSection'
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { db, auth } from '../firebase'
import { MARK_UID, ELOSY_UID, SOCIAL_REGISTERS, AVAILABLE_LANGS, TOPICS_LIST, CARD_GEN_SYSTEM, todayStr } from '../appShared'
import { THEMES } from '../theme'

function SettingsScreen({ t, s, theme, onThemeChange, onBack, user, myData, setMyData, allCards, lang, onPartner, onLightModeChange, onCardSizeChange, musicEnabled, musicVolume, onMusicToggle, onMusicVolume, onToLangChange, categoryLevels, setCategoryLevels, lightMode, cardSize, appVersion, onSprachkompass = () => {}, onSprachpuls = () => {} }) {
  const th = THEMES[theme]
  const isDE = lang === 'de'
  const pausedLanguages = myData?.pausedLanguages || []
  const uniqueTargetLangs = [...new Set((allCards || []).map(c => c.targetLang).filter(Boolean))]
  const [premiumModal, setPremiumModal] = useState(false)
  const [langSaveToast, setLangSaveToast] = useState(null) // { msg, ok }

  // ── ZIELSPRACHEN MIT ANTEILEN ────────────────────────────────
  const initToLangs = () => {
    if (myData?.toLangs && myData.toLangs.length > 0) return myData.toLangs
    const raw = myData?.toLang
    if (Array.isArray(raw) && raw.length > 1) {
      const n = raw.length
      return raw.map((l, i) => ({ lang: l.toLowerCase(), percent: i === 0 ? Math.round(100 / n + (100 % n)) : Math.floor(100 / n) }))
    }
    return [{ lang: (Array.isArray(raw) ? raw[0] : raw || 'en').toLowerCase(), percent: 100 }]
  }
  const [toLangs, setToLangsLocal] = useState(initToLangs)

  const saveToLangs = async (updated) => {
    setToLangsLocal(updated)
    try {
      await updateDoc(doc(db, 'users', user.uid), { toLangs: updated })
      setMyData(d => ({ ...d, toLangs: updated }))
    } catch (e) { console.warn('saveToLangs failed:', e) }
  }

  const updatePercent = (langCode, newPct) => {
    const clamped = Math.max(10, Math.min(90, newPct))
    const others = toLangs.filter(l => l.lang !== langCode)
    if (others.length === 0) return
    const remaining = 100 - clamped
    const totalOther = others.reduce((s, l) => s + l.percent, 0)
    const updated = toLangs.map(l => {
      if (l.lang === langCode) return { ...l, percent: clamped }
      return { ...l, percent: totalOther > 0 ? Math.round(l.percent / totalOther * remaining) : Math.floor(remaining / others.length) }
    })
    const sum = updated.reduce((s, l) => s + l.percent, 0)
    if (sum !== 100) updated[updated.length - 1].percent += 100 - sum
    saveToLangs(updated)
  }

  const addToLang = (langCode) => {
    if (toLangs.find(l => l.lang === langCode)) return
    if (toLangs.length >= 3) return
    const newPct = 30
    const updated = [
      ...toLangs.map(l => ({ ...l, percent: Math.round(l.percent * (100 - newPct) / 100) })),
      { lang: langCode, percent: newPct }
    ]
    const sum = updated.reduce((s, l) => s + l.percent, 0)
    if (sum !== 100) updated[0].percent += 100 - sum
    saveToLangs(updated)
  }

  const removeToLang = (langCode) => {
    if (toLangs.length <= 1) return
    const removed = toLangs.find(l => l.lang === langCode)?.percent || 0
    const rest = toLangs.filter(l => l.lang !== langCode)
    const total = rest.reduce((s, l) => s + l.percent, 0)
    const updated = rest.map(l => ({ ...l, percent: Math.round(l.percent / total * 100) }))
    const sum = updated.reduce((s, l) => s + l.percent, 0)
    if (sum !== 100) updated[0].percent += 100 - sum
    saveToLangs(updated)
  }

  const togglePause = async (langCode) => {
    const newPaused = pausedLanguages.includes(langCode)
      ? pausedLanguages.filter(l => l !== langCode)
      : [...pausedLanguages, langCode]
    try {
      await updateDoc(doc(db, 'users', user.uid), { pausedLanguages: newPaused })
      setMyData(d => ({ ...d, pausedLanguages: newPaused }))
    } catch (e) { console.warn('Failed to save paused languages:', e) }
  }

  const currentMonth = new Date().toISOString().slice(0, 7)
  const freeze = myData?.streakFreeze || {}
  const freezeAvailable = freeze.lastReset !== currentMonth ? true : (freeze.available ?? false)
  const handleStreakFreeze = async () => {
    const update = { streakFreeze: { available: false, lastReset: currentMonth, usedAt: todayStr() } }
    try {
      await updateDoc(doc(db, 'users', user.uid), update)
      setMyData(d => ({ ...d, ...update }))
    } catch (e) { console.warn('Streak freeze failed:', e) }
  }

  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>← {t.back}</button>
      <h2 style={{ color: th.text, marginBottom: '20px', fontSize: '1.3rem' }}>⚙️ {t.settingsTitle}</h2>

      {/* ── THEME ── */}
      <div style={s.card}>
        <p style={s.cardLabel}>{t.chooseTheme}</p>
        <div style={s.themeRow}>
          {Object.entries(THEMES).map(([key, thm]) => (
            <button key={key} style={s.themeBtn(theme === key, thm.accent)} onClick={() => onThemeChange(key)}>{thm.name}</button>
          ))}
        </div>
      </div>

      {/* ── MUSIK ── */}
      {onMusicToggle && (
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ ...s.cardLabel, margin: 0 }}>🎵 {t.music}</p>
            <span style={{ background: `${th.gold}18`, color: th.sub, border: `1px solid ${th.border}`, borderRadius: '20px', padding: '3px 12px', fontSize: '0.75rem', opacity: 0.7 }}>
              {t.comingSoon}
            </span>
          </div>
          <p style={{ color: th.sub, fontSize: '0.72rem', margin: '6px 0 0', opacity: 0.6 }}>
            {t.musicComingSoon}
          </p>
        </div>
      )}

      {/* ── TAGESZIEL ── */}
      <div style={s.card}>
        <p style={{ ...s.cardLabel, marginBottom: '12px' }}>{t.dailyGoalLabel}</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[5, 10, 15, 20].map(n => (
            <button key={n}
              onClick={async () => { await updateDoc(doc(db, 'users', user.uid), { dailyGoal: n }); setMyData(d => ({ ...d, dailyGoal: n })) }}
              style={{ flex: 1, padding: '10px 0', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem', background: (myData?.dailyGoal || 10) === n ? th.accent : 'transparent', color: (myData?.dailyGoal || 10) === n ? (th.btnTextColor || '#111') : th.sub, border: `1px solid ${(myData?.dailyGoal || 10) === n ? th.accent : th.border}` }}
            >{n}</button>
          ))}
        </div>
        <p style={{ color: th.sub, fontSize: '0.72rem', marginTop: '7px', marginBottom: 0 }}>{t.cardsPerDay}</p>
      </div>

      {/* ── SESSION-GRÖSSE ── */}
      <div style={s.card}>
        <p style={{ ...s.cardLabel, marginBottom: '12px' }}>{isDE ? 'Karten pro Session' : 'Cards per session'}</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[5, 10, 15, 20].map(n => (
            <button key={n}
              onClick={async () => { await updateDoc(doc(db, 'users', user.uid), { sessionSize: n }); setMyData(d => ({ ...d, sessionSize: n })) }}
              style={{ flex: 1, padding: '10px 0', borderRadius: '10px', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem', background: (myData?.sessionSize || 10) === n ? th.accent : 'transparent', color: (myData?.sessionSize || 10) === n ? (th.btnTextColor || '#111') : th.sub, border: `1px solid ${(myData?.sessionSize || 10) === n ? th.accent : th.border}` }}
            >{n}</button>
          ))}
        </div>
        <p style={{ color: th.sub, fontSize: '0.72rem', marginTop: '7px', marginBottom: 0 }}>{isDE ? 'Karten je Lernsession' : 'Cards per learning session'}</p>
      </div>

      {/* ── SPRACHE PAUSIEREN ── */}
      {uniqueTargetLangs.length > 0 && (
        <div style={s.card}>
          <p style={{ ...s.cardLabel, marginBottom: '14px' }}>{t.languagesLabel}</p>
          {uniqueTargetLangs.map(langCode => {
            const info = AVAILABLE_LANGS.find(l => l.code === langCode)
            const paused = pausedLanguages.includes(langCode)
            return (
              <div key={langCode} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ color: th.text, fontSize: '1rem' }}>{info?.flag} {info?.label || langCode}</span>
                <button onClick={() => togglePause(langCode)}
                  style={{ background: paused ? 'transparent' : th.accent, color: paused ? th.sub : (th.btnTextColor || '#111'), border: `1px solid ${paused ? th.border : th.accent}`, borderRadius: '20px', padding: '5px 14px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}>
                  {paused ? t.paused : t.active}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── ZIELSPRACHEN ANTEILE ── */}
      <div style={s.card}>
        <p style={{ ...s.cardLabel, marginBottom: '14px' }}>{t.learnLanguages}</p>
        {toLangs.map(({ lang: lc, percent }) => {
          const info = AVAILABLE_LANGS.find(l => l.code === lc) || { flag: '🌐', label: lc.toUpperCase() }
          return (
            <div key={lc} style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ color: th.text, fontSize: '0.9rem' }}>{info.flag} {info.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: th.gold, fontWeight: '700', fontSize: '0.85rem', minWidth: '36px', textAlign: 'right' }}>{percent}%</span>
                  {toLangs.length > 1 && (
                    <button onClick={() => removeToLang(lc)} style={{ background: 'transparent', border: 'none', color: th.sub, fontSize: '0.85rem', cursor: 'pointer', padding: '2px 4px', opacity: 0.6 }}>✕</button>
                  )}
                </div>
              </div>
              {toLangs.length > 1 && (
                <input type="range" min="10" max="90" step="5" value={percent}
                  onChange={e => updatePercent(lc, parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: th.accent, cursor: 'pointer' }}
                />
              )}
            </div>
          )
        })}
        {toLangs.length < 3 && (
          <div style={{ marginTop: '8px' }}>
            <p style={{ color: th.sub, fontSize: '0.72rem', marginBottom: '8px' }}>{t.addLanguage}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {AVAILABLE_LANGS.filter(l => !toLangs.find(t => t.lang === l.code)).map(l => (
                <button key={l.code} onClick={() => addToLang(l.code)}
                  style={{ background: 'transparent', border: `1px solid ${th.border}`, borderRadius: '16px', padding: '4px 10px', color: th.sub, fontSize: '0.75rem', cursor: 'pointer' }}>
                  {l.flag} {l.code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── DARK/LIGHT MODE ── */}
      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ ...s.cardLabel, marginBottom: '2px' }}>☀️ Dark / Light Mode</p>
            <p style={{ color: th.sub, fontSize: '0.75rem', margin: 0 }}>{lightMode ? t.lightModeLabel : t.darkModeLabel}</p>
          </div>
          <button onClick={() => onLightModeChange && onLightModeChange(!lightMode)}
            style={{ background: lightMode ? th.accent : 'rgba(255,255,255,0.08)', border: `1px solid ${lightMode ? th.accent : th.border}`, borderRadius: '22px', width: '52px', height: '28px', cursor: 'pointer', position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: '3px', left: lightMode ? '27px' : '3px', width: '22px', height: '22px', borderRadius: '50%', background: lightMode ? '#fff' : th.sub, transition: 'left 0.2s', display: 'block' }} />
          </button>
        </div>
      </div>

      {/* ── KARTENGRÖSSE ── */}
      {(() => {
        const sizes = [{ key: 'small', labelDE: 'Klein', labelEN: 'Small' }, { key: 'normal', labelDE: 'Normal', labelEN: 'Normal' }, { key: 'large', labelDE: 'Groß', labelEN: 'Large' }]
        return (
          <div style={s.card}>
            <p style={{ ...s.cardLabel, marginBottom: '12px' }}>{t.cardSizeLabel}</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {sizes.map(sz => (
                <button key={sz.key} onClick={() => onCardSizeChange && onCardSizeChange(sz.key)}
                  style={{ flex: 1, padding: '9px 0', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem', background: cardSize === sz.key ? th.accent : 'transparent', color: cardSize === sz.key ? (th.btnTextColor || '#111') : th.sub, border: `1px solid ${cardSize === sz.key ? th.accent : th.border}`, transition: 'all 0.2s' }}>
                  {lang === 'de' ? sz.labelDE : sz.labelEN}
                </button>
              ))}
            </div>
          </div>
        )
      })()}

      {/* ── STREAK FREEZE ── */}
      <div style={s.card}>
        <p style={{ ...s.cardLabel, marginBottom: '12px' }}>🧊 {t.streakProtection}</p>
        {(() => {
          const sfIsPremium = (user.uid === MARK_UID || user.uid === ELOSY_UID) || (myData?.plan && myData.plan !== 'free')
          if (!sfIsPremium) return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ color: th.sub, fontSize: '0.85rem', flex: 1 }}>{t.streakFree0}</span>
              <span style={{ background: `${th.gold}18`, color: th.gold, border: `1px solid ${th.gold}44`, borderRadius: '20px', padding: '2px 10px', fontSize: '0.7rem', fontWeight: '700', whiteSpace: 'nowrap' }}>Premium</span>
            </div>
          )
          const isAvail = freezeAvailable || (freeze.lastReset !== currentMonth)
          return (
            <>
              <p style={{ color: th.text, fontSize: '0.9rem', marginBottom: '8px' }}>
                {t.freezeAvailThis} <strong style={{ color: isAvail ? '#4CAF50' : th.sub }}>{isAvail ? '1x ✓' : t.freezeUsed}</strong>
              </p>
              {isAvail && (
                <button onClick={() => { if (window.confirm(lang === 'de' ? 'Ruhetag jetzt einlösen? (1x pro Monat)' : 'Use rest day now? (1x/month)')) handleStreakFreeze() }}
                  style={{ ...s.logoutBtn, marginTop: 0, color: '#81c784', border: '1px solid rgba(76,175,80,0.35)' }}>
                  🌙 {lang === 'de' ? 'Ruhetag einlösen' : 'Use rest day'}
                </button>
              )}
              {freeze.usedAt && !isAvail && <p style={{ color: th.sub, fontSize: '0.75rem', marginTop: '4px' }}>{lang === 'de' ? `Verwendet am ${freeze.usedAt}` : `Used on ${freeze.usedAt}`}</p>}
            </>
          )
        })()}
      </div>

      {/* ── SOZIALES REGISTER ── */}
      <div style={s.card}>
        <p style={{ ...s.cardLabel, marginBottom: '12px' }}>🗣 {t.socialRegisterLabel}</p>
        <p style={{ color: th.sub, fontSize: '0.75rem', marginBottom: '8px' }}>{t.socialRegisterNote}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {SOCIAL_REGISTERS.map(r => {
            const active = (myData?.socialRegister || 'friends') === r.key
            return (
              <button key={r.key} onClick={async () => {
                await updateDoc(doc(db, 'users', user.uid), { socialRegister: r.key }).catch(() => {})
                setMyData(d => ({ ...d, socialRegister: r.key }))
              }} style={{ padding: '7px 12px', borderRadius: '20px', fontSize: '0.82rem', cursor: 'pointer', fontWeight: active ? '700' : '400', background: active ? th.accent : 'transparent', color: active ? (th.btnTextColor || '#111') : th.sub, border: `1px solid ${active ? th.accent : th.border}`, WebkitTapHighlightColor: 'transparent' }}>
                {r.emoji} {lang === 'de' ? r.labelDe : r.labelEn}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── BEZIEHUNGSTYP ── */}
      <div style={s.card}>
        <p style={{ ...s.cardLabel, marginBottom: '8px' }}>❤️ {t.relationshipType}</p>
        <p style={{ color: th.sub, fontSize: '0.75rem', marginBottom: '8px' }}>{t.relationshipNote}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {[{ key:'couple',labelDe:'Paar',labelEn:'Couple',emoji:'💑' },{ key:'friends',labelDe:'Freunde',labelEn:'Friends',emoji:'👫' },{ key:'family',labelDe:'Familie',labelEn:'Family',emoji:'👨‍👩‍👧' },{ key:'colleagues',labelDe:'Kollegen',labelEn:'Colleagues',emoji:'👔' }].map(r => {
            const active = (myData?.relationshipType || 'couple') === r.key
            return (
              <button key={r.key} onClick={async () => {
                await updateDoc(doc(db, 'users', user.uid), { relationshipType: r.key }).catch(() => {})
                setMyData(d => ({ ...d, relationshipType: r.key }))
              }} style={{ padding: '7px 12px', borderRadius: '20px', fontSize: '0.82rem', cursor: 'pointer', fontWeight: active ? '700' : '400', background: active ? `${th.gold}22` : 'transparent', color: active ? th.gold : th.sub, border: `1px solid ${active ? th.gold : th.border}`, WebkitTapHighlightColor: 'transparent' }}>
                {r.emoji} {isDE ? r.labelDe : r.labelEn}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── PARTNER VERBINDEN ── */}
      <button style={{ ...s.card, cursor: 'pointer', width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={onPartner}>
        <span style={{ color: th.text, fontSize: '0.9rem' }}>🤝 {t.partnerTitle}</span>
        <span style={{ color: th.sub }}>→</span>
      </button>

      {/* ── SPRACHE EINSTELLEN (REQUIRED) ── */}
      {(() => {
        const currentFromLang = (myData?.fromLang || '').toLowerCase()
        const currentToLang = (Array.isArray(myData?.toLang) ? myData.toLang[0] : (myData?.toLang || '')).toLowerCase()
        const missingToLang = !currentToLang

        const handleFromLangChange = async (newLang) => {
          if (newLang === currentFromLang) return
          console.log('[Settings] fromLang changed to', newLang)
          setMyData(d => ({ ...d, fromLang: newLang }))
          try {
            await updateDoc(doc(db, 'users', user.uid), { fromLang: newLang })
            const snap = await getDoc(doc(db, 'users', user.uid))
            const saved = snap.data()?.fromLang
            if (saved !== newLang) throw new Error('read-back mismatch')
            setLangSaveToast({ msg: isDE ? `Sprache: ${newLang.toUpperCase()} ✓` : `Language: ${newLang.toUpperCase()} ✓`, ok: true })
          } catch (e) {
            console.warn('[Settings] fromLang save failed:', e)
            setMyData(d => ({ ...d, fromLang: currentFromLang }))
            setLangSaveToast({ msg: t.saveFailed, ok: false })
          }
          setTimeout(() => setLangSaveToast(null), 2500)
        }

        const handleToLangChange = async (newLang) => {
          if (newLang === currentToLang) return
          console.log('[Settings] toLang changed to', newLang)
          setMyData(d => ({ ...d, toLang: newLang }))
          onToLangChange?.(newLang)
          try {
            await updateDoc(doc(db, 'users', user.uid), { toLang: newLang })
            const snap = await getDoc(doc(db, 'users', user.uid))
            const saved = snap.data()?.toLang
            const savedStr = Array.isArray(saved) ? saved[0] : saved
            if (savedStr !== newLang) throw new Error('read-back mismatch')
            setLangSaveToast({ msg: isDE ? `Zielsprache: ${newLang.toUpperCase()} ✓` : `Target: ${newLang.toUpperCase()} ✓`, ok: true })
          } catch (e) {
            console.warn('[Settings] toLang save failed:', e)
            setMyData(d => ({ ...d, toLang: currentToLang }))
            onToLangChange?.(currentToLang)
            setLangSaveToast({ msg: t.saveFailed, ok: false })
          }
          setTimeout(() => setLangSaveToast(null), 2500)
        }

        return (
          <div style={{ ...s.card, border: missingToLang ? `1px solid rgba(255,152,0,0.5)` : undefined, position: 'relative' }}>
            {missingToLang && (
              <p style={{ color: '#ff9800', fontSize: '0.78rem', marginBottom: '10px', fontWeight: '600' }}>
                ⚠️ {t.targetLangRequired}
              </p>
            )}
            {langSaveToast && (
              <div style={{ position: 'absolute', top: '8px', right: '10px', background: langSaveToast.ok ? 'rgba(76,175,80,0.15)' : 'rgba(229,115,115,0.15)', border: `1px solid ${langSaveToast.ok ? 'rgba(76,175,80,0.4)' : 'rgba(229,115,115,0.4)'}`, color: langSaveToast.ok ? '#81c784' : '#e57373', borderRadius: '8px', padding: '3px 10px', fontSize: '0.72rem', fontWeight: '600', zIndex: 10 }}>
                {langSaveToast.msg}
              </div>
            )}
            <p style={{ ...s.cardLabel, marginBottom: '14px' }}>🗣 {t.myLanguages}</p>
            <p style={{ color: th.sub, fontSize: '0.75rem', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t.nativeLanguage}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
              {AVAILABLE_LANGS.map(l => (
                <button key={l.code} onClick={() => handleFromLangChange(l.code)}
                  style={{ padding: '6px 12px', borderRadius: '10px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: currentFromLang === l.code ? '700' : '400', background: currentFromLang === l.code ? th.accent : 'transparent', color: currentFromLang === l.code ? (th.btnTextColor || '#111') : th.sub, border: `1px solid ${currentFromLang === l.code ? th.accent : th.border}`, transition: 'all 0.2s' }}>
                  {l.flag} {l.label}
                </button>
              ))}
            </div>
            <p style={{ color: th.sub, fontSize: '0.75rem', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t.targetLanguage}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {AVAILABLE_LANGS.map(l => {
                const isActive = ['de', 'en', 'sw', 'es'].includes(l.code)
                const isSelected = currentToLang === l.code
                return (
                  <button key={l.code}
                    onClick={() => isActive && handleToLangChange(l.code)}
                    disabled={!isActive}
                    style={{ padding: '6px 12px', borderRadius: '10px', fontSize: '0.8rem',
                      cursor: isActive ? 'pointer' : 'default',
                      fontWeight: isSelected ? '700' : '400',
                      background: isSelected ? th.gold + '33' : 'transparent',
                      color: isSelected ? th.gold : isActive ? th.sub : th.border,
                      border: `1px solid ${isSelected ? th.gold + '88' : isActive ? th.border : th.border + '55'}`,
                      opacity: isActive ? 1 : 0.45,
                      transition: 'all 0.2s', position: 'relative' }}>
                    {l.flag} {l.label}
                    {!isActive && <span style={{ fontSize: '0.6rem', marginLeft: '4px', opacity: 0.7 }}>{lang === 'de' ? 'bald' : 'soon'}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── WEITERE SPRACHEN (PREMIUM) ── */}
      <div style={s.card}>
        <p style={{ ...s.cardLabel, marginBottom: '12px' }}>🌍 {t.moreLanguages}</p>
        <button onClick={() => setPremiumModal(true)}
          style={{ width: '100%', background: `${th.gold}0E`, border: `1px solid ${th.gold}33`, borderRadius: '12px', padding: '12px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: th.text, fontSize: '0.88rem' }}>🔒 {t.languageTypes}</span>
          <span style={{ background: `${th.gold}18`, color: th.gold, border: `1px solid ${th.gold}44`, borderRadius: '12px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: '700', flexShrink: 0, marginLeft: '8px' }}>Premium</span>
        </button>
      </div>

      {/* ── PUSH NOTIFICATIONS (#9) ── */}
      {(() => {
        const times = ['off', '08:00', '12:00', '18:00', '20:00']
        const currentTime = myData?.notificationTime || 'off'
        const hasSupport = 'Notification' in window
        return (
          <div style={s.card}>
            <p style={{ ...s.cardLabel, marginBottom: '12px' }}>🔔 {t.reminderLabel}</p>
            {!hasSupport ? (
              <p style={{ color: th.sub, fontSize: '0.8rem' }}>{t.reminderNotSupported}</p>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  {times.map(t => (
                    <button key={t} onClick={async () => {
                      if (t !== 'off' && Notification.permission === 'default') {
                        const perm = await Notification.requestPermission()
                        if (perm !== 'granted') return
                      }
                      const updated = { ...myData, notificationTime: t }
                      setMyData(updated)
                      await updateDoc(doc(db, 'users', user.uid), { notificationTime: t })
                    }}
                      style={{ padding: '6px 12px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.78rem', background: currentTime === t ? th.accent : 'transparent', color: currentTime === t ? (th.btnTextColor || '#111') : th.sub, border: `1px solid ${currentTime === t ? th.accent : th.border}`, transition: 'all 0.2s' }}>
                      {t === 'off' ? (isDE ? 'Aus' : 'Off') : t}
                    </button>
                  ))}
                </div>
                {Notification.permission === 'granted' && currentTime !== 'off' && (
                  <p style={{ color: '#4CAF50', fontSize: '0.72rem', margin: 0 }}>✓ {isDE ? `Erinnerung um ${currentTime} Uhr` : `Reminder at ${currentTime}`}</p>
                )}
                {Notification.permission === 'denied' && (
                  <p style={{ color: '#e06c75', fontSize: '0.72rem', margin: 0 }}>{t.notificationsBlocked}</p>
                )}
              </>
            )}
          </div>
        )
      })()}

      {/* ── GIMMIK ÜBERSICHT ── */}
      <div style={s.card}>
        <p style={{ ...s.cardLabel, marginBottom: '12px' }}>🎁 {t.myGimmicks}</p>
        {(() => {
          const total = myData?.gimmickUnlockCount || 0
          const history = myData?.gimmickHistory || []
          const themeNames = { nairobi: '🌙 Nairobi', hamburg: '⚓ Hamburg', welt: '🌍 Welt' }
          if (total === 0) return <p style={{ color: th.sub, fontSize: '0.82rem', margin: 0 }}>{t.noGimmicks}</p>
          return (
            <>
              <p style={{ color: th.text, fontSize: '0.88rem', marginBottom: '10px' }}>{total} {isDE ? `Gimmik${total !== 1 ? 's' : ''} freigeschaltet` : `gimmick${total !== 1 ? 's' : ''} unlocked`}</p>
              {Object.entries(themeNames).map(([key, name]) => {
                const count = history.filter(g => g.theme === key).length
                if (count === 0) return null
                return (
                  <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: th.text, fontSize: '0.82rem' }}>{name}</span>
                    <span style={{ color: th.gold, fontSize: '0.82rem', fontWeight: '700' }}>{'⭐'.repeat(count)}</span>
                  </div>
                )
              })}
            </>
          )
        })()}
      </div>

      {/* ── AUSGESCHLOSSENE KARTEN ── */}
      {(() => {
        const excludedMap = myData?.excludedCards || {}
        const excludedIds = Object.keys(excludedMap)
        if (excludedIds.length === 0) return null
        return (
          <div style={s.card}>
            <p style={{ ...s.cardLabel, marginBottom: '10px' }}>🚫 {isDE ? `Ausgeschlossene Karten (${excludedIds.length})` : `Hidden cards (${excludedIds.length})`}</p>
            {excludedIds.slice(0, 10).map(id => {
              const card = (allCards || []).find(c => c.id === id)
              if (!card) return null
              return (
                <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${th.border}` }}>
                  <span style={{ color: th.text, fontSize: '0.82rem', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>„{card.front}"</span>
                  <button style={{ background: 'transparent', border: `1px solid ${th.border}`, borderRadius: '8px', padding: '3px 10px', color: th.sub, fontSize: '0.72rem', cursor: 'pointer', flexShrink: 0, marginLeft: '8px' }} onClick={async () => {
                    const updated = { ...excludedMap }
                    delete updated[id]
                    try {
                      await updateDoc(doc(db, 'users', user.uid), { excludedCards: updated })
                      setMyData(d => ({ ...d, excludedCards: updated }))
                    } catch(e) {}
                  }}>
                    {t.restore}
                  </button>
                </div>
              )
            })}
            {excludedIds.length > 10 && <p style={{ color: th.sub, fontSize: '0.72rem', marginTop: '6px', opacity: 0.6 }}>+{excludedIds.length - 10} {t.more}</p>}
          </div>
        )
      })()}

      {/* ── MEINE THEMEN ── */}
      <TopicUnlockSection myData={myData} setMyData={setMyData} user={user} t={t} s={s} th={th} lang={lang} />

      {/* ── BEREICHE ZURÜCKSETZEN ── */}
      <ResetAreasSection myData={myData} setMyData={setMyData} user={user} allCards={allCards} t={t} s={s} th={th} lang={lang} categoryLevels={categoryLevels} setCategoryLevels={setCategoryLevels} />

      {/* ── SPRACHKOMPASS ── */}
      {onSprachkompass && (
        <>
          <button style={{ ...s.logoutBtn, marginTop: '8px', color: '#00D4AA', border: '1px solid rgba(0,212,170,0.35)' }}
            onClick={onSprachkompass}>
            🧭 {isDE ? 'Sprachkompass starten' : 'Start Language Compass'}
          </button>
          <TutorialTooltip tutorialKey="sprachkompass" title="Sprachkompass" description="Teste deinen Sprachstand — wir stellen deinen Lernpfad automatisch ein." myData={myData} setMyData={setMyData} user={user} th={th} s={s} />
        </>
      )}

      {/* ── SPRACHPULS ── */}
      {onSprachpuls && (() => {
        const lastPuls = (myData?.sprachpulsResults || []).slice(-1)[0]
        return (
          <button style={{ ...s.logoutBtn, marginTop: '8px', color: '#7C9CEF', border: '1px solid rgba(124,156,239,0.35)' }}
            onClick={onSprachpuls}>
            📊 {isDE ? 'Sprachpuls starten' : 'Start Language Pulse'}
            {lastPuls && <span style={{ fontSize: '0.72rem', opacity: 0.65, marginLeft: '6px' }}>· {lastPuls.date}</span>}
          </button>
        )
      })()}

      {/* ── MEIN PLAN ── */}
      {(() => {
        const currentPlan = myData?.plan || 'free'
        const PLAN_FEATURES = isDE ? {
          free: ['Vokabular & Grundlagen', 'KI-Gespräch (5 pro Tag)', 'Lernpartner verbinden'],
          premium: ['Alle Free-Features', 'Alle Themen freigeschaltet', 'Unbegrenzte KI-Gespräche', '🌙 Ruhetag 1×/Monat'],
          unlimited: ['Alle Premium-Features', 'Alle zukünftigen Features', 'Prioritäts-Support'],
        } : {
          free: ['Vocabulary & Basics', 'AI Chat (5 per day)', 'Connect a learning partner'],
          premium: ['All Free features', 'All topics unlocked', 'Unlimited AI conversations', '🌙 Rest day 1×/month'],
          unlimited: ['All Premium features', 'All future features', 'Priority support'],
        }
        return (
          <div style={{ ...s.card, marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <p style={{ ...s.cardLabel, margin: 0 }}>💎 {isDE ? 'Mein Plan' : 'My Plan'}</p>
              {currentPlan === 'unlimited' && <span style={{ background: 'linear-gradient(135deg,#FFD700,#FFA500)', color: '#111', fontSize: '0.63rem', fontWeight: '800', padding: '2px 8px', borderRadius: '8px', letterSpacing: '0.5px' }}>✨ UNBEGRENZT</span>}
              {currentPlan === 'premium' && <span style={{ background: 'rgba(0,212,170,0.18)', color: '#00D4AA', fontSize: '0.63rem', fontWeight: '700', padding: '2px 8px', borderRadius: '8px', border: '1px solid rgba(0,212,170,0.4)' }}>💎 PREMIUM</span>}
              {currentPlan === 'free' && <span style={{ background: 'rgba(140,140,155,0.15)', color: th.sub, fontSize: '0.63rem', fontWeight: '600', padding: '2px 8px', borderRadius: '8px', border: `1px solid ${th.border}` }}>FREE</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: currentPlan !== 'unlimited' ? '12px' : '0' }}>
              {(PLAN_FEATURES[currentPlan] || []).map((f, i) => (
                <span key={i} style={{ color: th.sub, fontSize: '0.78rem' }}>✓ {f}</span>
              ))}
            </div>
            {currentPlan !== 'unlimited' && (
              <button style={{ width: '100%', padding: '10px', borderRadius: '10px', background: 'linear-gradient(135deg,rgba(0,212,170,0.12),rgba(124,156,239,0.12))', border: '1px solid rgba(0,212,170,0.38)', color: '#00D4AA', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}
                onClick={() => setPremiumModal(true)}>
                🚀 {isDE ? 'Plan upgraden' : 'Upgrade plan'}
              </button>
            )}
          </div>
        )
      })()}

      {/* ── ERKLÄRUNGEN ZURÜCKSETZEN ── */}
      <button style={{ ...s.logoutBtn, marginTop: '8px', color: th.sub, border: `1px solid ${th.border}` }}
        onClick={async () => {
          setMyData(d => ({ ...d, seenTutorials: [] }))
          if (user?.uid) await updateDoc(doc(db, 'users', user.uid), { seenTutorials: [] })
        }}>
        🔄 {isDE ? 'Erklärungen zurücksetzen' : 'Reset Explanations'}
      </button>

      {/* ── ABMELDEN ── */}
      <button style={{ ...s.logoutBtn, marginTop: '8px', color: '#e06c75', border: '1px solid rgba(224,108,117,0.35)' }}
        onClick={() => { if (window.confirm(t.signOut)) signOut(auth) }}>
        {t.logout}
      </button>

      {/* ── VERSION ── */}
      <p style={{ color: th.sub, fontSize: '0.62rem', opacity: 0.35, textAlign: 'center', margin: '12px 0 0', letterSpacing: '0.5px' }}>{appVersion}</p>

      {/* ── PREMIUM MODAL ── */}
      {premiumModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(6px)' }}
          onClick={() => setPremiumModal(false)}>
          <div style={{ background: th.card, border: `1px solid ${th.gold}44`, borderRadius: '24px', padding: '28px 24px', maxWidth: '340px', width: '100%', textAlign: 'center', boxShadow: `0 0 40px ${th.gold}22`, animation: 'vocaraFadeIn 0.3s ease both' }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: '2rem', margin: '0 0 10px' }}>🌍</p>
            <p style={{ color: th.text, fontWeight: '700', fontSize: '1.1rem', marginBottom: '8px' }}>{t.unlockPremium}</p>
            <p style={{ color: th.sub, fontSize: '0.88rem', marginBottom: '20px', lineHeight: 1.5 }}>
              {t.premiumDesc}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
              {['🇫🇷 Français', '🇹🇭 ภาษาไทย', '🇵🇹 Português', '🇹🇷 Türkçe'].map(l => (
                <span key={l} style={{ background: `${th.gold}12`, color: th.text, border: `1px solid ${th.gold}33`, borderRadius: '20px', padding: '4px 12px', fontSize: '0.82rem' }}>{l}</span>
              ))}
            </div>
            <button style={{ ...s.button, marginBottom: '8px', background: `linear-gradient(135deg, ${th.gold}40, ${th.gold}20)`, color: th.text, border: `1px solid ${th.gold}66` }}>
              ✨ {t.unlockPremiumBtn}
            </button>
            <button onClick={() => setPremiumModal(false)} style={{ background: 'transparent', border: 'none', color: th.sub, cursor: 'pointer', fontSize: '0.82rem', padding: '4px 8px' }}>
              {t.close}
            </button>
          </div>
        </div>
      )}
    </div></div>
  )
}

export default SettingsScreen
