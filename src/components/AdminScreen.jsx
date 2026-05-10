import React, { useState, useEffect } from 'react'
import { getDocs, collection, doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { THEMES, makeStyles } from '../theme'
import { todayStr, getISOWeekStr } from '../appShared'

function AdminScreen({ user, lang, theme, onBack }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const isDE = lang === 'de'
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)

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

  useEffect(() => { load() }, [])

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
          <button onClick={load} style={{ background: 'transparent', border: `1px solid ${th.border}`, color: th.sub, borderRadius: '8px', padding: '5px 10px', fontSize: '0.75rem', cursor: 'pointer' }}>↺</button>
          <button onClick={exportCSV} style={{ background: `${th.gold}18`, border: `1px solid ${th.gold}44`, color: th.gold, borderRadius: '10px', padding: '6px 12px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer' }}>↓ CSV</button>
        </div>
      </div>
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
    </div></div>
  )
}

export default AdminScreen
