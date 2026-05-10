import React, { useState, useEffect } from 'react'
import { getDocs, collection, doc, updateDoc, deleteField, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { THEMES, makeStyles } from '../theme'
import { todayStr, getISOWeekStr, MARK_UID, ELOSY_UID } from '../appShared'

const BASE_URL = 'https://vocara-peach.vercel.app'

const POOL_STRUCTURE = {
  grundlagen:   { endpoint: 'generate-base-pool',              totalLevels: 10, cardsPerLevel: 20 },
  vocab:        { endpoint: 'generate-vocab-pool',             totalLevels: 22, cardsPerLevel: 30 },
  street:       { endpoint: 'generate-street-pool',            totalLevels: 18, cardsPerLevel: 25 },
  home:         { endpoint: 'generate-home-pool',              totalLevels: 14, cardsPerLevel: 22 },
  urlaub:       { endpoint: 'generate-sentence-pool',          totalLevels: 10, cardsPerLevel: 20 },
  satztraining: { endpoint: 'generate-sentence-training-pool', totalLevels: 14, cardsPerLevel: 22 },
}
const LANGUAGE_PAIRS = ['de_en','de_sw','en_de','en_sw','sw_de','sw_en']

function AdminScreen({ user, lang, theme, onBack }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const isDE = lang === 'de'
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)
  const [poolLevel, setPoolLevel] = useState(1)
  const [poolLoading, setPoolLoading] = useState(null)   // category key while running
  const [poolStatus, setPoolStatus] = useState(null)
  const [poolCounts, setPoolCounts] = useState({})       // cat -> level -> langPair -> count
  const [deleteAllLoading, setDeleteAllLoading] = useState(false)
  const [deleteAllStatus, setDeleteAllStatus] = useState(null)
  const [resetTarget, setResetTarget] = useState('mark')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetStatus, setResetStatus] = useState(null)

  // ── Pool status ────────────────────────────────────────────────
  const loadPoolStatus = async () => {
    try {
      const snap = await getDocs(collection(db, 'sharedCards'))
      const counts = {}
      snap.docs.forEach(d => {
        const data = d.data()
        const cat = data.category
        const level = String(data.level)
        const lp = data.langPair
        if (!cat || !level || !lp) return
        if (!counts[cat]) counts[cat] = {}
        if (!counts[cat][level]) counts[cat][level] = {}
        counts[cat][level][lp] = data.cards?.length ?? data.count ?? 1
      })
      setPoolCounts(counts)
    } catch (e) { console.warn('loadPoolStatus failed:', e) }
  }

  const getBtnStyle = (cat) => {
    const { cardsPerLevel } = POOL_STRUCTURE[cat]
    const lvl = String(poolLevel)
    const catCounts = poolCounts[cat]?.[lvl] || {}
    const total = LANGUAGE_PAIRS.reduce((sum, lp) => sum + (catCounts[lp] ?? 0), 0)
    const target = cardsPerLevel * LANGUAGE_PAIRS.length
    if (total === 0)     return { background: 'rgba(40,100,220,0.15)', color: '#6fa3ef', border: '1px solid rgba(40,100,220,0.35)' }
    if (total >= target) return { background: 'rgba(40,180,80,0.15)',  color: '#81c784', border: '1px solid rgba(40,180,80,0.35)' }
                         return { background: 'rgba(220,180,40,0.15)', color: '#D4AF00', border: '1px solid rgba(220,180,40,0.35)' }
  }

  // ── User list ──────────────────────────────────────────────────
  const load = async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'users'))
      const data = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
        .sort((a, b) => (b.lastActive || '').localeCompare(a.lastActive || ''))
      setUsers(data)
    } catch (e) { console.warn('Admin load failed:', e) }
    setLoading(false)
  }

  useEffect(() => { load(); loadPoolStatus() }, [])

  const togglePlan = async (uid, currentPlan) => {
    setToggling(uid)
    const next = currentPlan === 'pro' ? null : currentPlan === 'premium' ? 'pro' : 'premium'
    try {
      await updateDoc(doc(db, 'users', uid), { plan: next })
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, plan: next } : u))
    } catch (e) { console.warn('togglePlan failed:', e) }
    setToggling(null)
  }

  const exportCSV = () => {
    const headers = ['uid','name','email','streak','cards','lastActive','partnerUID']
    const rows = users.map(u => {
      const hist = u.sessionHistory || []
      const streak = hist.length > 0 ? (() => {
        let s = 0; let d = new Date()
        for (let i = 0; i < 60; i++) {
          const ds = d.toISOString().slice(0,10)
          if (hist.some(h => h.date === ds)) { s++; d.setDate(d.getDate()-1) } else break
        }
        return s
      })() : 0
      const cards = Object.keys(u.cardProgress || {}).length
      return [u.uid, u.name||'', u.email||'', streak, cards, u.lastActive||'', u.partnerUID||''].join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const a = document.createElement('a'); a.href = 'data:text/csv;charset=utf-8,'+encodeURIComponent(csv)
    a.download = `vocara_users_${todayStr()}.csv`; a.click()
  }

  const calcSimpleStreak = (hist) => {
    if (!hist || hist.length === 0) return 0
    let streak = 0; let d = new Date()
    for (let i = 0; i < 60; i++) {
      const ds = d.toISOString().slice(0,10)
      if (hist.some(h => h.date === ds)) { streak++; d.setDate(d.getDate()-1) } else break
    }
    return streak
  }

  // ── Pool generation — all lang pairs, skip existing ───────────
  const generatePool = async (category) => {
    const { endpoint, cardsPerLevel } = POOL_STRUCTURE[category]
    setPoolLoading(category); setPoolStatus(null)
    const lvl = String(poolLevel)
    let generated = 0, skipped = 0
    for (const lp of LANGUAGE_PAIRS) {
      const existing = poolCounts[category]?.[lvl]?.[lp] ?? 0
      if (existing >= cardsPerLevel) { skipped++; continue }
      setPoolStatus(`⟳ ${category} ${lp} L${poolLevel}… (${generated + skipped + 1}/${LANGUAGE_PAIRS.length})`)
      try {
        const res = await fetch(`${BASE_URL}/api/${endpoint}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level: poolLevel, langPair: lp })
        })
        const data = await res.json()
        generated++
        setPoolCounts(prev => {
          const copy = JSON.parse(JSON.stringify(prev))
          if (!copy[category]) copy[category] = {}
          if (!copy[category][lvl]) copy[category][lvl] = {}
          copy[category][lvl][lp] = data.count ?? data.cards?.length ?? cardsPerLevel
          return copy
        })
      } catch (e) { console.warn(`generatePool ${category} ${lp}:`, e) }
    }
    setPoolStatus(`✓ ${category} L${poolLevel}: ${generated} generiert, ${skipped} übersprungen`)
    await loadPoolStatus()
    setPoolLoading(null)
  }

  // ── Delete all sharedCards ─────────────────────────────────────
  const deleteAllCards = async () => {
    if (!window.confirm('Alle sharedCards unwiderruflich löschen?')) return
    setDeleteAllLoading(true); setDeleteAllStatus(null)
    try {
      const snap = await getDocs(collection(db, 'sharedCards'))
      for (let i = 0; i < snap.docs.length; i += 500) {
        const batch = writeBatch(db)
        snap.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref))
        await batch.commit()
      }
      setPoolCounts({})
      setDeleteAllStatus(`✓ ${snap.docs.length} Dokumente gelöscht`)
    } catch (e) { setDeleteAllStatus(`✗ ${e.message}`) }
    setDeleteAllLoading(false)
  }

  // ── User reset ─────────────────────────────────────────────────
  const resetUser = async () => {
    const uid = resetTarget === 'mark' ? MARK_UID : ELOSY_UID
    const name = resetTarget === 'mark' ? 'Mark' : 'Elosy'
    if (!window.confirm(`Wirklich ${name} vollständig zurücksetzen? (categoryLevels → 1, cardProgress, publicStats)`)) return
    setResetLoading(true); setResetStatus(null)
    const catLevels = Object.fromEntries(Object.keys(POOL_STRUCTURE).map(k => [k, 1]))
    try {
      await updateDoc(doc(db, 'users', uid), {
        categoryLevels: catLevels,
        cardProgress: {},
        publicStats: deleteField(),
      })
      setResetStatus(`✓ ${name} vollständig zurückgesetzt`)
      load()
    } catch (e) { setResetStatus(`✗ ${e.message}`) }
    setResetLoading(false)
  }

  const thisWeek = getISOWeekStr()
  const activeThisWeek = users.filter(u => (u.sessionHistory || []).some(h => {
    try { return getISOWeekStr(new Date(...h.date.split('-').map((v,i)=>i===1?v-1:+v))) === thisWeek } catch { return false }
  })).length
  const premiumCount = users.filter(u => u.plan === 'premium' || u.plan === 'pro').length

  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>← {isDE ? 'Zurück' : 'Back'}</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h2 style={{ color: th.text, fontSize: '1.2rem', margin: 0 }}>⚙ Admin</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => { load(); loadPoolStatus() }} style={{ background: 'transparent', border: `1px solid ${th.border}`, color: th.sub, borderRadius: '8px', padding: '5px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>↺</button>
          <button onClick={exportCSV} style={{ background: `${th.gold}18`, border: `1px solid ${th.gold}44`, color: th.gold, borderRadius: '10px', padding: '6px 12px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}>↓ CSV</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {[
          [users.length, isDE ? 'Nutzer' : 'Users'],
          [activeThisWeek, isDE ? 'Aktiv Woche' : 'Active week'],
          [premiumCount, 'Premium/Pro'],
        ].map(([val, label]) => (
          <div key={label} style={{ flex: 1, background: th.card, border: `1px solid ${th.border}`, borderRadius: '12px', padding: '10px 6px', textAlign: 'center' }}>
            <p style={{ color: th.gold, fontSize: '1.4rem', fontWeight: '700', margin: '0 0 2px' }}>{val}</p>
            <p style={{ color: th.sub, fontSize: '0.6rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* User list */}
      {loading ? (
        <p style={{ color: th.sub, textAlign: 'center' }}>…</p>
      ) : (
        <div style={s.card}>
          {users.map((u, i) => {
            const streak = calcSimpleStreak(u.sessionHistory)
            const cards = Object.keys(u.cardProgress || {}).length
            const mastered = Object.values(u.cardProgress || {}).filter(p => (p?.interval || 0) >= 7).length
            const plan = u.plan || null
            return (
              <div key={u.uid} style={{ paddingBottom: '10px', marginBottom: '10px', borderBottom: i < users.length-1 ? `1px solid ${th.border}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: th.text, fontWeight: '600', fontSize: '0.88rem' }}>{u.name || u.uid.slice(0,8)}</span>
                  <span style={{ color: th.sub, fontSize: '0.7rem' }}>{u.lastActive || '—'}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: '#FFA500', fontSize: '0.72rem' }}>🔥 {streak}</span>
                  <span style={{ color: th.sub, fontSize: '0.72rem' }}>📋 {cards} ({mastered}✓)</span>
                  {u.partnerUID && <span style={{ color: th.gold, fontSize: '0.72rem' }}>🤝</span>}
                  <button onClick={() => togglePlan(u.uid, plan)} disabled={toggling === u.uid}
                    style={{ marginLeft: 'auto', background: plan === 'pro' ? 'rgba(200,200,255,0.12)' : plan === 'premium' ? `${th.gold}18` : 'transparent', color: plan === 'pro' ? '#aaa' : plan === 'premium' ? th.gold : th.sub, border: `1px solid ${plan ? th.gold+'44' : th.border}`, borderRadius: '8px', padding: '2px 8px', fontSize: '0.65rem', fontWeight: '700', cursor: 'pointer', opacity: toggling === u.uid ? 0.5 : 1 }}>
                    {plan === 'pro' ? 'Pro' : plan === 'premium' ? 'Premium' : 'Free'} ↻
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pool Generation */}
      <div style={{ ...s.card, marginTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <p style={{ color: th.text, fontSize: '0.88rem', fontWeight: '700', margin: 0 }}>Pool Generieren</p>
          <span style={{ color: th.sub, fontSize: '0.68rem' }}>🔵 leer&nbsp; 🟡 teilweise&nbsp; 🟢 voll</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <span style={{ color: th.sub, fontSize: '0.75rem' }}>Level:</span>
          <input type="number" min={1} max={22} value={poolLevel} onChange={e => setPoolLevel(Number(e.target.value))}
            style={{ background: th.card, color: th.text, border: `1px solid ${th.border}`, borderRadius: '8px', padding: '5px 6px', fontSize: '0.78rem', width: '54px', textAlign: 'center' }} />
          <span style={{ color: th.sub, fontSize: '0.68rem', marginLeft: '4px' }}>alle {LANGUAGE_PAIRS.length} Paare</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {Object.keys(POOL_STRUCTURE).map(cat => {
            const bs = getBtnStyle(cat)
            return (
              <button key={cat} onClick={() => generatePool(cat)} disabled={!!poolLoading}
                style={{ padding: '7px 12px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: '600', cursor: poolLoading ? 'default' : 'pointer', opacity: poolLoading && poolLoading !== cat ? 0.4 : 1, ...bs }}>
                {poolLoading === cat ? '⟳' : cat}
              </button>
            )
          })}
        </div>
        {poolStatus && <p style={{ color: poolStatus.startsWith('✓') ? '#81c784' : poolStatus.startsWith('⟳') ? th.sub : '#e06c75', fontSize: '0.75rem', margin: '8px 0 0' }}>{poolStatus}</p>}
      </div>

      {/* Delete All sharedCards */}
      <div style={{ ...s.card, marginTop: '12px' }}>
        <p style={{ color: th.text, fontSize: '0.88rem', fontWeight: '700', margin: '0 0 10px' }}>🗑️ sharedCards löschen</p>
        <button onClick={deleteAllCards} disabled={deleteAllLoading}
          style={{ padding: '7px 16px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', opacity: deleteAllLoading ? 0.5 : 1, background: 'rgba(220,40,40,0.15)', color: '#e06c75', border: '1px solid rgba(220,40,40,0.35)' }}>
          {deleteAllLoading ? '…' : '🗑️ Alle sharedCards löschen'}
        </button>
        {deleteAllStatus && <p style={{ color: deleteAllStatus.startsWith('✓') ? '#81c784' : '#e06c75', fontSize: '0.75rem', margin: '8px 0 0' }}>{deleteAllStatus}</p>}
      </div>

      {/* Reset User */}
      <div style={{ ...s.card, marginTop: '12px' }}>
        <p style={{ color: th.text, fontSize: '0.88rem', fontWeight: '700', margin: '0 0 10px' }}>⚠ Vollständig zurücksetzen</p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select value={resetTarget} onChange={e => setResetTarget(e.target.value)}
            style={{ background: th.card, color: th.text, border: `1px solid ${th.border}`, borderRadius: '8px', padding: '5px 8px', fontSize: '0.78rem', cursor: 'pointer' }}>
            <option value="mark">Mark</option>
            <option value="elosy">Elosy</option>
          </select>
          <button onClick={resetUser} disabled={resetLoading}
            style={{ padding: '7px 14px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', opacity: resetLoading ? 0.5 : 1, background: 'rgba(220,40,40,0.15)', color: '#e06c75', border: '1px solid rgba(220,40,40,0.35)' }}>
            {resetLoading ? '…' : 'Vollständig zurücksetzen'}
          </button>
        </div>
        <p style={{ color: th.sub, fontSize: '0.68rem', margin: '6px 0 0' }}>categoryLevels → 1, cardProgress löschen, publicStats löschen</p>
        {resetStatus && <p style={{ color: resetStatus.startsWith('✓') ? '#81c784' : '#e06c75', fontSize: '0.75rem', margin: '6px 0 0' }}>{resetStatus}</p>}
      </div>

    </div></div>
  )
}

export default AdminScreen
