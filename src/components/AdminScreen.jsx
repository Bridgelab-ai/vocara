import React, { useState, useEffect } from 'react'
import { getDocs, collection, doc, updateDoc, deleteField, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { THEMES, makeStyles } from '../theme'
import { todayStr, getISOWeekStr, MARK_UID, ELOSY_UID } from '../appShared'

const BASE_URL = 'https://vocara-peach.vercel.app'

const POOL_STRUCTURE = {
  grundlagen:   { endpoint: 'generate-base-pool',              totalLevels: 10, cardsPerLevel: 20 },
  vocab:        { endpoint: 'generate-vocab-pool',             totalLevels: 22, cardsPerLevel: 30 },
  street:       { endpoint: 'generate-street-pool',            totalLevels: 12, cardsPerLevel: 25 },
  home:         { endpoint: 'generate-home-pool',              totalLevels: 14, cardsPerLevel: 22 },
  urlaub:       { endpoint: 'generate-sentence-pool',          totalLevels: 10, cardsPerLevel: 20 },
  satztraining: { endpoint: 'generate-sentence-training-pool', totalLevels: 14, cardsPerLevel: 22 },
  saetze:       { endpoint: 'generate-saetze-pool',            totalLevels: 10, cardsPerLevel: 20 },
}
const TOPICS_LIST = [
  { key: 'kochen',      emoji: '🍳', label: 'Kochen'      },
  { key: 'liebe',       emoji: '❤️', label: 'Liebe'       },
  { key: 'sport',       emoji: '💪', label: 'Sport'       },
  { key: 'film',        emoji: '🎬', label: 'Film'        },
  { key: 'musik',       emoji: '🎵', label: 'Musik'       },
  { key: 'reisen',      emoji: '✈️', label: 'Reisen'      },
  { key: 'business',    emoji: '💼', label: 'Business'    },
  { key: 'natur',       emoji: '🌿', label: 'Natur'       },
  { key: 'tech',        emoji: '💻', label: 'Tech'        },
  { key: 'gesundheit',  emoji: '🏥', label: 'Gesundheit'  },
  { key: 'psychologie', emoji: '🧠', label: 'Psychologie' },
  { key: 'ausgehen',    emoji: '🍺', label: 'Ausgehen'    },
]
const LANGUAGE_PAIRS = ['de_en','de_sw','en_de','en_sw','sw_de','sw_en']

function AdminScreen({ user, lang, theme, onBack }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const isDE = lang === 'de'
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)
  const [poolLevel, setPoolLevel] = useState(1)
  const [batchLevel, setBatchLevel] = useState(1)
  const [batchLevelTopic, setBatchLevelTopic] = useState(1)
  const [poolLoading, setPoolLoading] = useState(null)   // category key while running
  const [poolStatus, setPoolStatus] = useState(null)
  const [poolCounts, setPoolCounts] = useState({})       // cat -> level -> langPair -> count
  const [deleteAllLoading, setDeleteAllLoading] = useState(false)
  const [deleteAllStatus, setDeleteAllStatus] = useState(null)
  const [resetTarget, setResetTarget] = useState('mark')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetStatus, setResetStatus] = useState(null)
  const [topicLoading, setTopicLoading] = useState(null)   // topicKey while running
  const [topicStatus, setTopicStatus] = useState(null)
  const [topicResetLoading, setTopicResetLoading] = useState(false)
  const [topicResetStatus, setTopicResetStatus] = useState(null)
  const [deleteNoLevelLoading, setDeleteNoLevelLoading] = useState(false)
  const [deleteNoLevelStatus, setDeleteNoLevelStatus] = useState(null)
  const [expandedCat, setExpandedCat] = useState(null)
  const [expandedTopic, setExpandedTopic] = useState(null)

  // ── Pool status ────────────────────────────────────────────────
  const loadPoolStatus = async () => {
    try {
      const [cardsSnap, exSnap] = await Promise.all([
        getDocs(collection(db, 'sharedCards')),
        getDocs(collection(db, 'sharedExercises')),
      ])
      console.log('[ADMIN DEBUG] sharedCards docs found:', cardsSnap.docs.length)
      const counts = buildCounts(cardsSnap)
      // satztraining pool lives in sharedExercises — merge counts separately
      exSnap.docs.forEach(d => {
        const data = d.data()
        if (data.level == null || !data.langPair) return
        const level = String(data.level)
        const lp = data.langPair
        if (!counts['satztraining']) counts['satztraining'] = {}
        if (!counts['satztraining'][level]) counts['satztraining'][level] = {}
        counts['satztraining'][level][lp] = data.count ?? 1
      })
      setPoolCounts(counts)
    } catch (e) { console.warn('loadPoolStatus failed:', e) }
  }

  const BLUE   = { background: 'rgba(40,100,220,0.15)', color: '#6fa3ef', border: '1px solid rgba(40,100,220,0.35)' }
  const YELLOW = { background: 'rgba(220,180,40,0.15)', color: '#D4AF00', border: '1px solid rgba(220,180,40,0.35)' }
  const GREEN  = { background: 'rgba(40,180,80,0.15)',  color: '#81c784', border: '1px solid rgba(40,180,80,0.35)' }

  const getBtnStyle = (cat) => {
    const { cardsPerLevel } = POOL_STRUCTURE[cat]
    const lvl = String(poolLevel)
    const catCounts = poolCounts[cat]?.[lvl] || {}
    const full = LANGUAGE_PAIRS.filter(lp => (catCounts[lp] ?? 0) >= cardsPerLevel).length
    if (full === 0)                    return BLUE
    if (full === LANGUAGE_PAIRS.length) return GREEN
                                        return YELLOW
  }

  const getBtnTopicStyle = (topicKey) => {
    const lvl = String(poolLevel)
    const catCounts = poolCounts[topicKey]?.[lvl] || {}
    const full = LANGUAGE_PAIRS.filter(lp => (catCounts[lp] ?? 0) >= 15).length
    if (full === 0)                    return BLUE
    if (full === LANGUAGE_PAIRS.length) return GREEN
                                        return YELLOW
  }

  const getLevelBtnStyle = (cat, lvl) => {
    const { cardsPerLevel } = POOL_STRUCTURE[cat]
    const catCounts = poolCounts[cat]?.[String(lvl)] || {}
    const full = LANGUAGE_PAIRS.filter(lp => (catCounts[lp] ?? 0) >= cardsPerLevel).length
    if (full === 0)                     return BLUE
    if (full === LANGUAGE_PAIRS.length) return GREEN
                                         return YELLOW
  }

  const getTopicLevelBtnStyle = (topicKey, lvl) => {
    const catCounts = poolCounts[topicKey]?.[String(lvl)] || {}
    const full = LANGUAGE_PAIRS.filter(lp => (catCounts[lp] ?? 0) >= 15).length
    if (full === 0)                     return BLUE
    if (full === LANGUAGE_PAIRS.length) return GREEN
                                         return YELLOW
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

  const PLAN_OPTIONS = [
    { value: '',           label: 'Free' },
    { value: 'premium',   label: 'Premium (1.99€)' },
    { value: 'pro',       label: 'Pro (3.99€)' },
    { value: 'unlimited', label: 'Unbegrenzt' },
  ]

  const setPlan = async (uid, value) => {
    setToggling(uid)
    const plan = value || null
    try {
      await updateDoc(doc(db, 'users', uid), { userPlan: plan })
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, userPlan: plan } : u))
    } catch (e) { console.warn('setPlan failed:', e) }
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

  // ── Build live counts from a Firestore snapshot ───────────────
  // CAT_NORMALIZE maps generator-written category names → AdminScreen POOL_STRUCTURE keys
  // generate-vocab-pool writes 'vocabulary', generate-sentence-pool writes 'sentence'
  const CAT_NORMALIZE = { vocabulary: 'vocab', sentence: 'urlaub' }

  const buildCounts = (snap) => {
    const counts = {}
    snap.docs.forEach(d => {
      const data = d.data()
      // generators write fromLang+toLang separately; only generate-topic-pool writes langPair
      const lp = data.langPair || (data.fromLang && data.toLang ? `${data.fromLang}_${data.toLang}` : null)
      if (data.level == null || !lp) return   // null/undefined level → skip (flat pool docs have no level)
      const level = String(data.level)
      const rawCat = (data.category === 'topics' && data.topicKey)
        ? data.topicKey
        : data.category
      const cat = CAT_NORMALIZE[rawCat] || rawCat
      if (!cat) return
      if (!counts[cat]) counts[cat] = {}
      if (!counts[cat][level]) counts[cat][level] = {}
      counts[cat][level][lp] = data.cards?.length ?? data.count ?? 1
    })
    return counts
  }

  // ── Pool generation — all lang pairs, skip existing ───────────
  const generatePool = async (category) => {
    const { endpoint, cardsPerLevel } = POOL_STRUCTURE[category]
    setPoolLoading(category); setPoolStatus(null)
    const lvl = String(poolLevel)

    // Fresh read before starting — ensures duplicate check is not stale
    const freshSnap = await getDocs(collection(db, 'sharedCards'))
    const liveCounts = buildCounts(freshSnap)
    setPoolCounts(liveCounts)

    let generated = 0, skipped = 0
    for (const lp of LANGUAGE_PAIRS) {
      const existing = liveCounts[category]?.[lvl]?.[lp] ?? 0
      if (existing >= cardsPerLevel) {
        console.log(`[generatePool] übersprungen: ${category} ${lp} L${lvl} (${existing} >= ${cardsPerLevel})`)
        skipped++; continue
      }
      setPoolStatus(`⟳ ${category} ${lp} L${poolLevel}… (${generated + skipped + 1}/${LANGUAGE_PAIRS.length})`)
      try {
        const res = await fetch(`${BASE_URL}/api/${endpoint}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level: poolLevel, pair: lp, from: lp.split('_')[0], to: lp.split('_')[1], ...(category === 'urlaub' ? {type:'flashcards'} : category === 'satztraining' ? {type:'sentence'} : {}) })
        })
        const data = await res.json()
        generated++
        liveCounts[category] = liveCounts[category] || {}
        liveCounts[category][lvl] = liveCounts[category][lvl] || {}
        liveCounts[category][lvl][lp] = data.count ?? data.cards?.length ?? cardsPerLevel
        setPoolCounts({ ...liveCounts })
      } catch (e) { console.warn(`generatePool ${category} ${lp}:`, e) }
    }
    setPoolStatus(`✓ ${category} L${poolLevel}: ${generated} generiert, ${skipped} übersprungen`)
    await loadPoolStatus()   // authoritative refresh — includes sharedExercises for satztraining
    setPoolLoading(null)
  }

  const generateAtLevel = async (cat, lvl) => {
    const { endpoint, cardsPerLevel } = POOL_STRUCTURE[cat]
    const loadingKey = `${cat}_${lvl}`
    setPoolLoading(loadingKey); setPoolStatus(null)
    const freshSnap = await getDocs(collection(db, 'sharedCards'))
    const liveCounts = buildCounts(freshSnap)
    setPoolCounts(liveCounts)
    let generated = 0, skipped = 0
    for (const lp of LANGUAGE_PAIRS) {
      const existing = liveCounts[cat]?.[String(lvl)]?.[lp] ?? 0
      if (existing >= cardsPerLevel) { skipped++; continue }
      setPoolStatus(`⟳ ${cat} ${lp} L${lvl}… (${generated + skipped + 1}/${LANGUAGE_PAIRS.length})`)
      try {
        const res = await fetch(`${BASE_URL}/api/${endpoint}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level: lvl, pair: lp, from: lp.split('_')[0], to: lp.split('_')[1], ...(cat === 'urlaub' ? {type:'flashcards'} : cat === 'satztraining' ? {type:'sentence'} : {}) })
        })
        const data = await res.json()
        generated++
        liveCounts[cat] = liveCounts[cat] || {}
        liveCounts[cat][String(lvl)] = liveCounts[cat][String(lvl)] || {}
        liveCounts[cat][String(lvl)][lp] = data.count ?? data.cards?.length ?? cardsPerLevel
        setPoolCounts({ ...liveCounts })
      } catch (e) { console.warn(`generateAtLevel ${cat} L${lvl} ${lp}:`, e) }
    }
    setPoolStatus(`✓ ${cat} L${lvl}: ${generated} generiert, ${skipped} übersprungen`)
    await loadPoolStatus()
    setPoolLoading(null)
  }

  const generateStufe = async () => {
    const lvl = batchLevel
    setPoolLoading('__all__'); setPoolStatus(null)
    const freshSnap = await getDocs(collection(db, 'sharedCards'))
    const liveCounts = buildCounts(freshSnap)
    setPoolCounts(liveCounts)
    let totalGenerated = 0, totalSkipped = 0

    for (const [cat, { endpoint, totalLevels, cardsPerLevel }] of Object.entries(POOL_STRUCTURE)) {
      if (lvl > totalLevels) continue
      for (const lp of LANGUAGE_PAIRS) {
        const existing = liveCounts[cat]?.[String(lvl)]?.[lp] ?? 0
        if (existing >= cardsPerLevel) { totalSkipped++; continue }
        setPoolStatus(`⟳ ${cat} L${lvl} ${lp}…`)
        try {
          const res = await fetch(`${BASE_URL}/api/${endpoint}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level: lvl, pair: lp, from: lp.split('_')[0], to: lp.split('_')[1], ...(cat === 'urlaub' ? {type:'flashcards'} : cat === 'satztraining' ? {type:'sentence'} : {}) })
          })
          const data = await res.json()
          totalGenerated++
          liveCounts[cat] = liveCounts[cat] || {}
          liveCounts[cat][String(lvl)] = liveCounts[cat][String(lvl)] || {}
          liveCounts[cat][String(lvl)][lp] = data.count ?? data.cards?.length ?? cardsPerLevel
          setPoolCounts({ ...liveCounts })
        } catch (e) { console.warn(`generateStufe ${cat} L${lvl} ${lp}:`, e) }
      }
    }

    setPoolStatus(`✓ Stufe ${lvl}: ${totalGenerated} generiert, ${totalSkipped} übersprungen`)
    await loadPoolStatus()
    setPoolLoading(null)
  }

  const generateTopicStufe = async () => {
    const lvl = batchLevelTopic
    setTopicLoading('__all__'); setTopicStatus(null)
    const freshSnap = await getDocs(collection(db, 'sharedCards'))
    const liveCounts = buildCounts(freshSnap)
    setPoolCounts(liveCounts)
    let totalGenerated = 0, totalSkipped = 0
    for (const { key: topicKey } of TOPICS_LIST) {
      for (const lp of LANGUAGE_PAIRS) {
        const existing = liveCounts[topicKey]?.[String(lvl)]?.[lp] ?? 0
        if (existing >= 15) { totalSkipped++; continue }
        setTopicStatus(`⟳ ${topicKey} L${lvl} ${lp}…`)
        try {
          const res = await fetch(`${BASE_URL}/api/generate-topic-pool`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic: topicKey, level: lvl, pair: lp, from: lp.split('_')[0], to: lp.split('_')[1] })
          })
          const data = await res.json()
          totalGenerated++
          liveCounts[topicKey] = liveCounts[topicKey] || {}
          liveCounts[topicKey][String(lvl)] = liveCounts[topicKey][String(lvl)] || {}
          liveCounts[topicKey][String(lvl)][lp] = data.count ?? 15
          setPoolCounts({ ...liveCounts })
        } catch (e) { console.warn(`generateTopicStufe ${topicKey} L${lvl} ${lp}:`, e) }
      }
    }
    setTopicStatus(`✓ Themen Stufe ${lvl}: ${totalGenerated} generiert, ${totalSkipped} übersprungen`)
    await loadPoolStatus()
    setTopicLoading(null)
  }

  // ── Topic pool generation ─────────────────────────────────────
  const generateTopicPool = async (topicKey) => {
    setTopicLoading(topicKey); setTopicStatus(null)
    const lvl = poolLevel
    const cardsPerLevel = 15

    // Fresh read before starting
    const freshSnap = await getDocs(collection(db, 'sharedCards'))
    const liveCounts = buildCounts(freshSnap)
    setPoolCounts(liveCounts)

    let generated = 0, skipped = 0
    const key = topicKey
    for (const lp of LANGUAGE_PAIRS) {
      const existing = liveCounts[key]?.[String(lvl)]?.[lp] ?? 0
      if (existing >= cardsPerLevel) {
        console.log(`[generateTopicPool] übersprungen: ${topicKey} ${lp} L${lvl} (${existing} >= ${cardsPerLevel})`)
        skipped++; continue
      }
      setTopicStatus(`⟳ ${topicKey} ${lp} L${lvl}… (${generated + skipped + 1}/${LANGUAGE_PAIRS.length})`)
      try {
        const res = await fetch(`${BASE_URL}/api/generate-topic-pool`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: topicKey, level: lvl, pair: lp, from: lp.split('_')[0], to: lp.split('_')[1] })
        })
        const data = await res.json()
        generated++
        liveCounts[key] = liveCounts[key] || {}
        liveCounts[key][String(lvl)] = liveCounts[key][String(lvl)] || {}
        liveCounts[key][String(lvl)][lp] = data.count ?? cardsPerLevel
        setPoolCounts({ ...liveCounts })
      } catch (e) { console.warn(`generateTopicPool ${topicKey} ${lp}:`, e) }
    }
    setTopicStatus(`✓ ${topicKey} L${lvl}: ${generated} generiert, ${skipped} übersprungen`)
    await loadPoolStatus()
    setTopicLoading(null)
  }

  const generateTopicAtLevel = async (topicKey, lvl) => {
    const lkey = `${topicKey}_${lvl}`
    setTopicLoading(lkey); setTopicStatus(null)
    const freshSnap = await getDocs(collection(db, 'sharedCards'))
    const liveCounts = buildCounts(freshSnap)
    setPoolCounts(liveCounts)
    let generated = 0, skipped = 0
    for (const lp of LANGUAGE_PAIRS) {
      const existing = liveCounts[topicKey]?.[String(lvl)]?.[lp] ?? 0
      if (existing >= 15) { skipped++; continue }
      setTopicStatus(`⟳ ${topicKey} ${lp} L${lvl}… (${generated + skipped + 1}/${LANGUAGE_PAIRS.length})`)
      try {
        const res = await fetch(`${BASE_URL}/api/generate-topic-pool`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: topicKey, level: lvl, pair: lp, from: lp.split('_')[0], to: lp.split('_')[1] })
        })
        const data = await res.json()
        generated++
        liveCounts[topicKey] = liveCounts[topicKey] || {}
        liveCounts[topicKey][String(lvl)] = liveCounts[topicKey][String(lvl)] || {}
        liveCounts[topicKey][String(lvl)][lp] = data.count ?? 15
        setPoolCounts({ ...liveCounts })
      } catch (e) { console.warn(`generateTopicAtLevel ${topicKey} L${lvl} ${lp}:`, e) }
    }
    setTopicStatus(`✓ ${topicKey} L${lvl}: ${generated} generiert, ${skipped} übersprungen`)
    await loadPoolStatus()
    setTopicLoading(null)
  }

  // ── Topic user reset ───────────────────────────────────────────
  const resetTopics = async () => {
    const uid = resetTarget === 'mark' ? MARK_UID : ELOSY_UID
    const name = resetTarget === 'mark' ? 'Mark' : 'Elosy'
    if (!window.confirm(`Wirklich ${name}s Themen-Fortschritt zurücksetzen? (unlockedTopics, topicProgress, topicCards)`)) return
    setTopicResetLoading(true); setTopicResetStatus(null)
    try {
      await updateDoc(doc(db, 'users', uid), {
        unlockedTopics: deleteField(),
        topicProgress: deleteField(),
        topicCards: deleteField(),
        topicLevels: deleteField(),
      })
      setTopicResetStatus(`✓ ${name} Themen zurückgesetzt`)
    } catch (e) { setTopicResetStatus(`✗ ${e.message}`) }
    setTopicResetLoading(false)
  }

  // ── Delete user cards without level field ─────────────────────
  const deleteCardsWithoutLevel = async () => {
    if (!window.confirm('Alle Karten ohne Level-Feld für Mark UND Elosy löschen?')) return
    setDeleteNoLevelLoading(true); setDeleteNoLevelStatus(null)
    let totalDeleted = 0
    for (const uid of [MARK_UID, ELOSY_UID]) {
      try {
        const snap = await getDocs(collection(db, 'users', uid, 'cards'))
        const toDelete = snap.docs.filter(d => d.data().level == null)
        for (let i = 0; i < toDelete.length; i += 500) {
          const batch = writeBatch(db)
          toDelete.slice(i, i + 500).forEach(d => batch.delete(d.ref))
          await batch.commit()
          totalDeleted += toDelete.slice(i, i + 500).length
        }
      } catch (e) { console.warn(`deleteCardsWithoutLevel uid=${uid}:`, e) }
    }
    setDeleteNoLevelStatus(`✓ ${totalDeleted} Karten ohne Level gelöscht`)
    setDeleteNoLevelLoading(false)
  }

  // ── Delete all sharedCards ─────────────────────────────────────
  const deleteAllCards = async () => {
    if (!window.confirm('Alle sharedCards unwiderruflich löschen?')) return
    setDeleteAllLoading(true); setDeleteAllStatus(null)
    try {
      console.log('[deleteAllCards] fetching collection sharedCards…')
      const snap = await getDocs(collection(db, 'sharedCards'))
      console.log('[deleteAllCards] snap.size:', snap.size, '| snap.docs.length:', snap.docs.length)

      if (snap.empty) {
        console.warn('[deleteAllCards] collection returned empty — no docs found')
        setDeleteAllStatus('⚠ Keine Dokumente gefunden (Sammlung leer oder kein Zugriff)')
        setDeleteAllLoading(false)
        return
      }

      let deleted = 0
      for (let i = 0; i < snap.docs.length; i += 500) {
        const chunk = snap.docs.slice(i, i + 500)
        console.log(`[deleteAllCards] batch ${Math.floor(i / 500) + 1}: ${chunk.length} docs — first IDs:`, chunk.slice(0, 3).map(d => d.id))
        try {
          const batch = writeBatch(db)
          chunk.forEach(d => batch.delete(d.ref))
          await batch.commit()
          deleted += chunk.length
          console.log(`[deleteAllCards] batch committed — ${deleted}/${snap.docs.length} deleted`)
        } catch (batchErr) {
          console.error('[deleteAllCards] batch commit failed:', batchErr)
          setDeleteAllStatus(`✗ Batch-Fehler bei doc ${i}–${i + chunk.length}: ${batchErr.message}`)
          setDeleteAllLoading(false)
          return
        }
      }

      setPoolCounts({})
      setDeleteAllStatus(`✓ ${deleted} Dokumente gelöscht`)
      console.log('[deleteAllCards] done — total deleted:', deleted)
      setTimeout(() => window.location.reload(), 1200)
    } catch (e) {
      console.error('[deleteAllCards] outer error:', e)
      setDeleteAllStatus(`✗ ${e.message}`)
    }
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
        sessionHistory: [],
        weeklyGoals: { week: '', completed: [] },
        aiCards: [],
      })
      setResetStatus(`✓ ${name} vollständig zurückgesetzt`)
      load()
      setTimeout(() => window.location.reload(), 1200)
    } catch (e) { setResetStatus(`✗ ${e.message}`) }
    setResetLoading(false)
  }

  const thisWeek = getISOWeekStr()
  const activeThisWeek = users.filter(u => (u.sessionHistory || []).some(h => {
    try { return getISOWeekStr(new Date(...h.date.split('-').map((v,i)=>i===1?v-1:+v))) === thisWeek } catch { return false }
  })).length
  const premiumCount = users.filter(u => u.userPlan && u.userPlan !== '').length

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
            const plan = u.userPlan || ''
            const planColor = plan === 'unlimited' ? '#a855f7' : plan === 'pro' ? '#aaa' : plan === 'premium' ? th.gold : th.sub
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
                  <select
                    value={plan}
                    onChange={e => setPlan(u.uid, e.target.value)}
                    disabled={toggling === u.uid}
                    style={{ marginLeft: 'auto', background: th.card, color: planColor, border: `1px solid ${plan ? th.gold+'44' : th.border}`, borderRadius: '8px', padding: '2px 6px', fontSize: '0.65rem', fontWeight: '700', cursor: 'pointer', opacity: toggling === u.uid ? 0.5 : 1 }}>
                    {PLAN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
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
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
          <select value={batchLevel} onChange={e => setBatchLevel(Number(e.target.value))}
            disabled={!!poolLoading}
            style={{ background: th.card, color: th.text, border: `1px solid ${th.border}`, borderRadius: '8px', padding: '6px 8px', fontSize: '0.78rem', cursor: 'pointer', flex: '0 0 auto' }}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>Stufe {n}</option>)}
          </select>
          <button onClick={generateStufe} disabled={!!poolLoading}
            style={{ flex: 1, padding: '8px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: '700', cursor: poolLoading ? 'default' : 'pointer', opacity: poolLoading && poolLoading !== '__all__' ? 0.5 : 1, background: 'rgba(0,212,170,0.12)', color: '#00D4AA', border: '1px solid rgba(0,212,170,0.35)' }}>
            {poolLoading === '__all__' ? `⟳ ${poolStatus || ''}` : `⚡ Stufe ${batchLevel} generieren`}
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {Object.entries(POOL_STRUCTURE).map(([cat, { totalLevels }]) => {
            const isExp = expandedCat === cat
            return (
              <div key={cat} style={{ border: `1px solid ${th.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                <button onClick={() => setExpandedCat(isExp ? null : cat)}
                  style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: th.text, fontSize: '0.82rem', fontWeight: '600' }}>{cat}</span>
                  <span style={{ color: th.sub, fontSize: '0.7rem' }}>{totalLevels}L {isExp ? '▲' : '▼'}</span>
                </button>
                {isExp && (
                  <div style={{ borderTop: `1px solid ${th.border}`, padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {Array.from({ length: totalLevels }, (_, i) => i + 1).map(lvl => {
                      const bs = getLevelBtnStyle(cat, lvl)
                      const lkey = `${cat}_${lvl}`
                      return (
                        <button key={lvl} onClick={() => generateAtLevel(cat, lvl)} disabled={!!poolLoading}
                          style={{ padding: '4px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '700', cursor: poolLoading ? 'default' : 'pointer', opacity: poolLoading && poolLoading !== lkey ? 0.5 : 1, ...bs }}>
                          {poolLoading === lkey ? '⟳' : `L${lvl}`}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {poolStatus && poolLoading !== '__all__' && <p style={{ color: poolStatus.startsWith('✓') ? '#81c784' : poolStatus.startsWith('⟳') ? th.sub : '#e06c75', fontSize: '0.75rem', margin: '8px 0 0' }}>{poolStatus}</p>}
      </div>

      {/* Themen Pool */}
      <div style={{ ...s.card, marginTop: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <p style={{ color: th.text, fontSize: '0.88rem', fontWeight: '700', margin: 0 }}>🎯 Themen Pool</p>
          <span style={{ color: th.sub, fontSize: '0.68rem' }}>🔵 leer&nbsp; 🟡 teilweise&nbsp; 🟢 voll</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
          <select value={batchLevelTopic} onChange={e => setBatchLevelTopic(Number(e.target.value))}
            disabled={!!topicLoading}
            style={{ background: th.card, color: th.text, border: `1px solid ${th.border}`, borderRadius: '8px', padding: '6px 8px', fontSize: '0.78rem', cursor: 'pointer', flex: '0 0 auto' }}>
            {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>Stufe {n}</option>)}
          </select>
          <button onClick={generateTopicStufe} disabled={!!topicLoading || !!poolLoading}
            style={{ flex: 1, padding: '8px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: '700', cursor: (topicLoading || poolLoading) ? 'default' : 'pointer', opacity: (topicLoading || poolLoading) && topicLoading !== '__all__' ? 0.5 : 1, background: 'rgba(0,212,170,0.12)', color: '#00D4AA', border: '1px solid rgba(0,212,170,0.35)' }}>
            {topicLoading === '__all__' ? `⟳ ${topicStatus || ''}` : `⚡ Stufe ${batchLevelTopic} generieren`}
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {TOPICS_LIST.map(t => {
            const isExp = expandedTopic === t.key
            return (
              <div key={t.key} style={{ border: `1px solid ${th.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                <button onClick={() => setExpandedTopic(isExp ? null : t.key)}
                  style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: th.text, fontSize: '0.82rem', fontWeight: '600' }}>{t.emoji} {t.label}</span>
                  <span style={{ color: th.sub, fontSize: '0.7rem' }}>8L {isExp ? '▲' : '▼'}</span>
                </button>
                {isExp && (
                  <div style={{ borderTop: `1px solid ${th.border}`, padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {[1,2,3,4,5,6,7,8].map(lvl => {
                      const bs = getTopicLevelBtnStyle(t.key, lvl)
                      const lkey = `${t.key}_${lvl}`
                      return (
                        <button key={lvl} onClick={() => generateTopicAtLevel(t.key, lvl)} disabled={!!topicLoading || !!poolLoading}
                          style={{ padding: '4px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: '700', cursor: (topicLoading || poolLoading) ? 'default' : 'pointer', opacity: topicLoading && topicLoading !== lkey ? 0.5 : 1, ...bs }}>
                          {topicLoading === lkey ? '⟳' : `L${lvl}`}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {topicStatus && <p style={{ color: topicStatus.startsWith('✓') ? '#81c784' : topicStatus.startsWith('⟳') ? th.sub : '#e06c75', fontSize: '0.75rem', margin: '8px 0 0' }}>{topicStatus}</p>}
      </div>

      {/* Delete All sharedCards */}
      <div style={{ ...s.card, marginTop: '12px' }}>
        <p style={{ color: th.text, fontSize: '0.88rem', fontWeight: '700', margin: '0 0 10px' }}>🗑️ sharedCards löschen</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button onClick={deleteAllCards} disabled={deleteAllLoading}
            style={{ padding: '7px 16px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', opacity: deleteAllLoading ? 0.5 : 1, background: 'rgba(220,40,40,0.15)', color: '#e06c75', border: '1px solid rgba(220,40,40,0.35)' }}>
            {deleteAllLoading ? '…' : '🗑️ Alle sharedCards löschen'}
          </button>
          <button onClick={deleteCardsWithoutLevel} disabled={deleteNoLevelLoading}
            style={{ padding: '7px 16px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', opacity: deleteNoLevelLoading ? 0.5 : 1, background: 'rgba(220,40,40,0.15)', color: '#e06c75', border: '1px solid rgba(220,40,40,0.35)' }}>
            {deleteNoLevelLoading ? '…' : '🗑️ Alte Karten ohne Level löschen'}
          </button>
        </div>
        {deleteAllStatus && <p style={{ color: deleteAllStatus.startsWith('✓') ? '#81c784' : '#e06c75', fontSize: '0.75rem', margin: '8px 0 0' }}>{deleteAllStatus}</p>}
        {deleteNoLevelStatus && <p style={{ color: deleteNoLevelStatus.startsWith('✓') ? '#81c784' : '#e06c75', fontSize: '0.75rem', margin: '4px 0 0' }}>{deleteNoLevelStatus}</p>}
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

      {/* Themen Reset */}
      <div style={{ ...s.card, marginTop: '12px' }}>
        <p style={{ color: th.text, fontSize: '0.88rem', fontWeight: '700', margin: '0 0 10px' }}>🎯 Themen zurücksetzen</p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select value={resetTarget} onChange={e => setResetTarget(e.target.value)}
            style={{ background: th.card, color: th.text, border: `1px solid ${th.border}`, borderRadius: '8px', padding: '5px 8px', fontSize: '0.78rem', cursor: 'pointer' }}>
            <option value="mark">Mark</option>
            <option value="elosy">Elosy</option>
          </select>
          <button onClick={resetTopics} disabled={topicResetLoading}
            style={{ padding: '7px 14px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', opacity: topicResetLoading ? 0.5 : 1, background: 'rgba(220,40,40,0.15)', color: '#e06c75', border: '1px solid rgba(220,40,40,0.35)' }}>
            {topicResetLoading ? '…' : 'Themen zurücksetzen'}
          </button>
        </div>
        <p style={{ color: th.sub, fontSize: '0.68rem', margin: '6px 0 0' }}>unlockedTopics, topicProgress, topicCards, topicLevels löschen</p>
        {topicResetStatus && <p style={{ color: topicResetStatus.startsWith('✓') ? '#81c784' : '#e06c75', fontSize: '0.75rem', margin: '6px 0 0' }}>{topicResetStatus}</p>}
      </div>

    </div></div>
  )
}

export default AdminScreen
