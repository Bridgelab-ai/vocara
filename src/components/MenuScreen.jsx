import React, { useState, useEffect, useContext } from 'react'
import { doc, updateDoc, getDoc, setDoc, getDocs, collection, query, where } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { db, auth } from '../firebase'
import { THEMES, makeStyles, resolveTheme } from '../theme'
import {
  todayStr, buildSession, buildCardPair, calcStreak, daysSince, getISOWeekStr,
  clearSessionState, saveSessionHistory, saveSessionState, checkMastery, getNextNewCards,
  CEFR_LEVELS, CEFR_COLORS, CEFR_MASTERY_REQ, WEEK_AREAS, VALID_CATEGORY_SET,
  LANG_FLAGS, NEW_CARDS_BATCH, getLevelName, MARK_UID, ELOSY_UID, APP_VERSION,
  SESSION_SIZE, MONTHLY_TEST_DAYS, getCatLevelFromCount, getCatLevel, getCatLevelKey, getActiveLangPairs, TOPICS_LIST, POOL_STRUCTURE
} from '../appShared'
import { TOPIC_STRUCTURE } from '../../api/_topicStructure.js'
import LanguageProgressScreen from './LanguageProgressScreen'
import CardScreen from './CardScreen'
import ResultScreen from './ResultScreen'
import SettingsScreen from './SettingsScreen'
import SprachkompassScreen from './SprachkompassScreen'
import SprachpulsScreen from './SprachpulsScreen'
import StatsScreen from './StatsScreen'
import SatzTrainingScreen from './SatzTrainingScreen'
import AdminScreen from './AdminScreen'
import TutorialTooltip from './TutorialTooltip'
import KiGespraechScreen from './KiGespraechScreen'
import RhythmusScreen from './RhythmusScreen'
import GeschenkkarteScreen from './GeschenkkarteScreen'
import ImpressumScreen from './ImpressumScreen'
import KarteErstellenScreen from './KarteErstellenScreen'
import PartnerScreen from './PartnerScreen'
import DiaryScreen from './DiaryScreen'
import MeineKartenScreen from './MeineKartenScreen'
import { AppPrefsContext } from '../context'
import { T } from '../translations'

function VocaraLogoSVG({ withSlogans = false, animate = false, isDE = true }) {
  return (
    <div style={{ textAlign: 'center' }}>
      {withSlogans && (
        <p style={{ color: 'rgba(245,200,66,0.55)', fontSize: '10px', fontWeight: '700', letterSpacing: '7px', textTransform: 'uppercase', margin: '0 0 10px', fontFamily: "'Inter', system-ui, sans-serif" }}>
          DIE STIMME IST DIE BRÜCKE
        </p>
      )}
      <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '2.8rem', fontWeight: '700', color: '#FFD700', margin: 0, letterSpacing: '4px', lineHeight: 1 }}>
        Vocara
      </p>
      {withSlogans && (
        <>
          <p style={{ color: 'rgba(245,200,66,0.40)', fontSize: '9px', fontWeight: '600', letterSpacing: '2px', textTransform: 'uppercase', margin: '10px 0 2px', fontFamily: "'Inter', system-ui, sans-serif" }}>
            WIR BAUEN KEINE APPS. WIR BAUEN BRÜCKEN.
          </p>
          <p style={{ color: 'rgba(245,200,66,0.25)', fontSize: '8px', fontWeight: '500', letterSpacing: '3px', textTransform: 'uppercase', margin: 0, fontFamily: "'Inter', system-ui, sans-serif" }}>
            BY BRIDGELAB
          </p>
        </>
      )}
    </div>
  )
}

function MenuScreen({ user, myData, setMyData, partnerData, allCards, lang, onSaveProgress, theme, onThemeChange, onLightModeChange, onCardSizeChange, onPartnerUpdate, onSaveCefr, onBack, categoryLevels, masteredCounts, loadCardsForCategory, clearPoolCache }) {
  const [screen, setScreen] = useState('menu')
  const [session, setSession] = useState(null)
  const [result, setResult] = useState(null)
  const [masteryUnlocked, setMasteryUnlocked] = useState(false)
  const [aiNotification, setAiNotification] = useState(null)
  const [stopToast, setStopToast] = useState(null)
  const [surpriseCard, setSurpriseCard] = useState(null) // {front, back, sharedBy, ...}
  const [pendingSession, setPendingSession] = useState(null)
  const [resumeStartIndex, setResumeStartIndex] = useState(0)
  const [resumeStartProgress, setResumeStartProgress] = useState(null)
  const [emptyCategoryMsg, setEmptyCategoryMsg] = useState(null)
  const [resumeDialog, setResumeDialog] = useState(null)
  const [currentSessionMode, setCurrentSessionMode] = useState('all')
  const [satzLoading, setSatzLoading] = useState(false)
  const [weekGoalCelebration, setWeekGoalCelebration] = useState(false)
  const [monthlyUnlockNotification, setMonthlyUnlockNotification] = useState(false)
  const [gimmickPopup, setGimmickPopup] = useState(false)
  const [weeklyGoals, setWeeklyGoals] = useState(() => {
    const currentWeek = getISOWeekStr()
    const stored = myData?.weeklyGoals
    return stored?.week === currentWeek ? stored : { week: currentWeek, completed: [] }
  })
  const [dailyCard, setDailyCard] = useState(null)
  const [dailyCardDismissed, setDailyCardDismissed] = useState(false)
  const [miniTask, setMiniTask] = useState(null)
  const [miniTaskInput, setMiniTaskInput] = useState('')
  const [miniTaskLoading, setMiniTaskLoading] = useState(false)
  const [reactionPrompt, setReactionPrompt] = useState(null) // {name, count}
  const [floatingReaction, setFloatingReaction] = useState(null) // emoji string
  const [replyInput, setReplyInput] = useState('')
  const [showReplyInput, setShowReplyInput] = useState(false)
  const [floatingMessage, setFloatingMessage] = useState(null) // incoming whisper text
  const [wordOfDayBanner, setWordOfDayBanner] = useState(null) // {front, back}
  const [freezeAvailable, setFreezeAvailable] = useState(true)
  const [karteMenu, setKarteMenu] = useState(false)
  const [themenOpen, setThemenOpen] = useState(false)
  const [topicSessionLoading, setTopicSessionLoading] = useState(null) // topicKey
  const [dotTooltip, setDotTooltip] = useState(null) // area key
  const [pendingGift, setPendingGift] = useState(null) // gift object
  const [coachMsg, setCoachMsg] = useState(null)
  const [tutorCollapsed, setTutorCollapsed] = useState(() => !!(myData?.tutorCollapsed))
  const [tutorRecommendedArea, setTutorRecommendedArea] = useState(null)
  const [sessionCompleteCount, setSessionCompleteCount] = useState(0)
  const [basicsLoading, setBasicsLoading] = useState(false)
  const [catLoading, setCatLoading] = useState(null)
  const [suggestModal, setSuggestModal] = useState(null)
  const VALID_SCREENS = new Set(['menu','cards','result','settings','partner','test','impressum','stats','ki','satz','diary','meinekarten','geschenkkarte','karteerstellen','admin','langprogress','sprachkompass','sprachpuls','suggest'])
  if (!VALID_SCREENS.has(screen)) { setScreen('menu'); return null }

  // ── KI-TUTOR BANNER ──────────────────────────────────────────
  const fetchTutorMsg = (freshCardProg, freshSessionHistory) => {
    const cardProg = freshCardProg || myData?.cardProgress || {}
    const sessionHistory = freshSessionHistory || myData?.sessionHistory || []
    const isDE = lang === 'de'
    const streak = calcStreak(sessionHistory)
    const masteredCount = Object.values(cardProg).filter(p => (p?.interval || 0) >= 7).length
    const level = getLevelName(masteredCount, lang)
    const fromLangName = isDE ? 'German' : 'English'
    const toLangName = isDE ? 'English' : 'German'
    const CATS = [
      { key: 'vocabulary', label: isDE ? 'Wörter' : 'Words' },
      { key: 'street', label: 'Slang' },
      { key: 'home', label: isDE ? 'Zuhause' : 'Home' },
      { key: 'sentence', label: isDE ? 'Sätze' : 'Sentences' },
      { key: 'basics', label: isDE ? 'Grundlagen' : 'Basics' },
    ]
    const todayD = todayStr()
    const catStats = CATS.map(({ key, label }) => {
      const cats = (allCards || []).filter(c => !/_r/.test(c.id) && c.category === key)
      const mastered = cats.filter(c => (cardProg[c.id]?.interval || 0) >= 7).length
      const due = cats.filter(c => (cardProg[c.id]?.nextReview || '0') <= todayD).length
      return `${label}:${mastered}mastered,${due}due`
    }).join('; ')
    const lastSessions = [...sessionHistory].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)
    const sessionsStr = lastSessions.length > 0 ? lastSessions.map(s => `${s.correct}/${s.total}`).join(',') : 'none'
    const phoneticCards = Object.values(cardProg).filter(p => p?._phonetic).length
    const phoneticStr = phoneticCards > 0 ? ` ${phoneticCards} cards have pronunciation guides.` : ''
    const AREA_KEYS = ['vocabulary','street','home','sentence','basics']
    let bestArea = 'vocabulary'; let bestDue = -1
    AREA_KEYS.forEach(key => {
      const due = (allCards || []).filter(c => !/_r/.test(c.id) && c.category === key && (cardProg[c.id]?.nextReview || '0') <= todayD).length
      if (due > bestDue) { bestDue = due; bestArea = key }
    })
    setTutorRecommendedArea(bestArea)
    setCoachMsg(null)
    fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 45,
        messages: [{ role: 'user', content: `You are a personal language tutor for a ${fromLangName} speaker learning ${toLangName}. Stats: ${catStats}. Last sessions: ${sessionsStr}. Streak: ${streak} days. Level: ${level}.${phoneticStr} Give ONE specific coaching tip (max 20 words) in ${fromLangName} about what to focus on NOW to speak ${toLangName} faster. Be practical and direct. Bridgelab tone: warm, no fluff. Return ONLY the tip, no quotes or markdown.` }]
      })
    }).then(r => r.json()).then(d => {
      const msg = d.content?.[0]?.text?.trim()
      setCoachMsg(msg || '')
    }).catch(() => setCoachMsg(''))
  }
  useEffect(() => { fetchTutorMsg() }, [sessionCompleteCount]) // eslint-disable-line

  // ── EXAMPLE SENTENCE SAVE ────────────────────────────────────
  const handleSaveExample = async (cardId, example) => {
    try {
      const updated = { ...myData?.cardProgress, [cardId]: { ...(myData?.cardProgress?.[cardId] || {}), _example: example } }
      await updateDoc(doc(db, 'users', user.uid), { cardProgress: updated })
      setMyData(d => ({ ...d, cardProgress: updated }))
    } catch(e) { console.warn('Failed to save example:', e) }
  }

  // Check for surprise card from partner on mount
  useEffect(() => {
    const sc = myData?.surpriseCard
    if (!sc) return
    const seenToday = myData?.surpriseSeenDate === todayStr()
    if (!seenToday) setSurpriseCard(sc)
  }, [])

  // ── STREAK FREEZE ─────────────────────────────────────────
  useEffect(() => {
    const freeze = myData?.streakFreeze || {}
    const month = new Date().toISOString().slice(0, 7)
    setFreezeAvailable(freeze.lastReset !== month ? true : (freeze.available ?? true))
  }, [myData?.streakFreeze])

  // ── PENDING GIFT CHECK ────────────────────────────────────
  useEffect(() => {
    const gift = myData?.pendingGift
    if (!gift || myData?.pendingGiftSeenDate === todayStr()) return
    setPendingGift(gift)
  }, [])

  // ── DAILY CARD ────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'menu') return
    const todayD = todayStr()
    const stored = myData?.dailyCard
    if (stored?.date === todayD) { setDailyCard(stored); return }
    const loadDailyCard = async () => {
      try {
        // Check Firestore subcollection for today's already-generated card
        const cardRef = doc(db, 'users', user.uid, 'dailyCards', todayD)
        const cardSnap = await getDoc(cardRef).catch(() => null)
        if (cardSnap?.exists()) {
          const card = cardSnap.data()
          setDailyCard(card)
          setMyData(d => ({ ...d, dailyCard: card }))
          return
        }
        // Try partner's subcollection card
        if (myData?.partnerUID) {
          try {
            const pCardRef = doc(db, 'users', myData.partnerUID, 'dailyCards', todayD)
            const pSnap = await getDoc(pCardRef)
            if (pSnap.exists()) {
              const pc = pSnap.data()
              setDailyCard(pc)
              await setDoc(cardRef, pc).catch(() => {})
              await updateDoc(doc(db, 'users', user.uid), { dailyCard: pc }).catch(() => {})
              setMyData(d => ({ ...d, dailyCard: pc }))
              return
            }
          } catch (e) {}
        }
        // Generate new card with date-based category rotation
        const DAILY_CATS = ['vocabulary', 'street', 'home', 'sentence', 'basics']
        const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
        const category = DAILY_CATS[dayOfYear % DAILY_CATS.length]
        const masteredCount = Object.values(myData?.cardProgress || {}).filter(p => (p?.interval || 0) >= 7).length
        const level = getLevelName(masteredCount, lang)
        const toLangFull = isMarkLang ? 'English' : 'German'
        const fromLangFull = isMarkLang ? 'German' : 'English'
        const toLangCode = isMarkLang ? 'en' : 'de'
        const fromLangCode = isMarkLang ? 'de' : 'en'
        const recentFronts = (myData?.recentDailyFronts || []).slice(-30).join(', ')
        const res = await fetch('/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001', max_tokens: 150,
            messages: [{ role: 'user', content: `Today is ${todayD}. Generate ONE unique daily phrase card for a ${fromLangFull} speaker learning ${toLangFull} at level: ${level}. Category: ${category}. Front MUST be in ${toLangFull}, back in ${fromLangFull}. Avoid these recent fronts: ${recentFronts || 'none'}. Be creative, practical, and culturally rich. Return ONLY JSON (no markdown): {"front":"...","back":"...","context":"...","category":"${category}"}` }]
          })
        })
        const data = await res.json()
        const raw = data.content?.[0]?.text?.trim() || '{}'
        const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
        if (parsed?.front && parsed?.back) {
          const card = { front: parsed.front, back: parsed?.back, context: parsed.context || '', date: todayD, category, langA: toLangCode, langB: fromLangCode }
          setDailyCard(card)
          await setDoc(doc(db, 'users', user.uid, 'dailyCards', todayD), card).catch(() => {})
          const recentArr = [...(myData?.recentDailyFronts || []), parsed.front].slice(-30)
          await updateDoc(doc(db, 'users', user.uid), { dailyCard: card, recentDailyFronts: recentArr }).catch(() => {})
          setMyData(d => ({ ...d, dailyCard: card, recentDailyFronts: recentArr }))
        }
      } catch (e) { console.warn('Daily card failed:', e) }
    }
    loadDailyCard()
  }, [screen])

  // ── MINI TASK ─────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'menu') return
    const todayD = todayStr()
    const stored = myData?.miniTask
    if (stored?.date === todayD) { setMiniTask(stored); return }
    // Pick only cards where front is in the target language (not native/SW)
    const targetLangA = lang === 'de' ? 'en' : 'de'
    const masteredCards = allCards.filter(c =>
      !/_r(_\d+)?$/.test(c.id) &&
      (cardProgress[c.id]?.interval || 0) >= 7 &&
      c.langA === targetLangA
    )
    if (masteredCards.length === 0) return
    const picked = masteredCards[Math.floor(Math.random() * masteredCards.length)]
    const task = { word: picked.front, date: todayD, done: false }
    setMiniTask(task)
    updateDoc(doc(db, 'users', user.uid), { miniTask: task }).catch(() => {})
    setMyData(d => ({ ...d, miniTask: task }))
  }, [screen])

  // ── PARTNER REACTION + INCOMING MESSAGE ─────────────────────
  useEffect(() => {
    const todayD = todayStr()
    // Show incoming partner message as floating whisper
    const pm = myData?.pendingMessage
    if (pm?.date === todayD && pm?.text) {
      setFloatingMessage(pm.text)
      setTimeout(() => setFloatingMessage(null), 8000)
      updateDoc(doc(db, 'users', user.uid), { pendingMessage: null }).catch(() => {})
      setMyData(d => ({ ...d, pendingMessage: null }))
    }
    // Show floating emoji if we received an emoji reaction
    const pr = myData?.pendingReaction
    if (pr?.date === todayD && pr?.emoji) {
      setFloatingReaction(pr.emoji)
      setTimeout(() => setFloatingReaction(null), 3500)
      updateDoc(doc(db, 'users', user.uid), { pendingReaction: null }).catch(() => {})
      setMyData(d => ({ ...d, pendingReaction: null }))
    }
    // Prompt to respond to partner's learning activity
    if (!partnerData) return
    const partnerTodayCorrect = (partnerData.sessionHistory || [])
      .filter(h => h.date === todayD).reduce((a, b) => a + (b.correct || 0), 0)
    if (partnerTodayCorrect > 0 && myData?.lastPartnerReactionDate !== todayD) {
      const name = myData?.partnerName || partnerData?.name?.split(' ')[0] || 'Partner'
      setReactionPrompt({ name, count: partnerTodayCorrect })
    }
  }, [])

  const sendPartnerMessage = async () => {
    const text = replyInput.trim().slice(0, 20)
    if (!text || !myData?.partnerUID) return
    try {
      const message = { text, from: user.displayName?.split(' ')[0] || 'Partner', date: todayStr() }
      await updateDoc(doc(db, 'users', myData.partnerUID), { pendingMessage: message })
      await updateDoc(doc(db, 'users', user.uid), { lastPartnerReactionDate: todayStr() })
      setMyData(d => ({ ...d, lastPartnerReactionDate: todayStr() }))
    } catch (e) { console.warn('sendPartnerMessage failed:', e) }
    setReactionPrompt(null)
    setReplyInput('')
    setShowReplyInput(false)
  }

  const sendReaction = async (emoji) => {
    if (!myData?.partnerUID) return
    try {
      const reaction = { emoji, from: user.displayName?.split(' ')[0] || 'Partner', date: todayStr() }
      await updateDoc(doc(db, 'users', myData.partnerUID), { pendingReaction: reaction })
      await updateDoc(doc(db, 'users', user.uid), { lastPartnerReactionDate: todayStr() })
      setMyData(d => ({ ...d, lastPartnerReactionDate: todayStr() }))
    } catch (e) { console.warn('sendReaction failed:', e) }
    setReactionPrompt(null)
  }

  const dismissSurprise = async (addToDeck) => {
    if (addToDeck && surpriseCard) {
      const card = { ...surpriseCard, id: `surprise_deck_${Date.now()}`, source: 'surprise' }
      const updated = [...(myData?.aiCards || []), card]
      await updateDoc(doc(db, 'users', user.uid), { aiCards: updated, surpriseSeenDate: todayStr() }).catch(() => {})
      setMyData(d => ({ ...d, aiCards: updated, surpriseSeenDate: todayStr() }))
    } else {
      await updateDoc(doc(db, 'users', user.uid), { surpriseSeenDate: todayStr() }).catch(() => {})
      setMyData(d => ({ ...d, surpriseSeenDate: todayStr() }))
    }
    setSurpriseCard(null)
  }

  const homeFloat = (
    <button onClick={() => setScreen('menu')} title="Zurück zur Startseite" style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999, background: 'rgba(0,0,0,0.55)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: '46px', height: '46px', fontSize: '1.3rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>🏠</button>
  )

  const { lightMode, cardSize } = React.useContext(AppPrefsContext)
  const t = T[lang]; const th = resolveTheme(theme, lightMode ?? false); const s = makeStyles(th)
  const firstName = user.displayName?.split(' ')[0] || user.displayName
  const cardProgress = myData?.cardProgress || {}
  const isMarkLang = lang === 'de'
  const cefr = myData?.cefr
  const sessionHistory = myData?.sessionHistory || []
  const partnerName = myData?.partnerName || partnerData?.name?.split(' ')[0] || 'Partner'
  const today = todayStr()
  const yd = new Date(); yd.setDate(yd.getDate() - 1)
  const yesterday = `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, '0')}-${String(yd.getDate()).padStart(2, '0')}`
  const pausedLanguages = myData?.pausedLanguages || []
  const uniqueTargetLangs = [...new Set(allCards.map(c => c.targetLang).filter(Boolean))]
  const activeCards = pausedLanguages.length > 0
    ? allCards.filter(c => !pausedLanguages.includes(c.targetLang))
    : allCards

  // ── CATEGORY LEVEL BADGE + PROGRESS BAR ──────────────────
  const CAT_TO_POOL_BAR = { vocabulary: 'vocab', sentence: 'urlaub' }
  const CAT_ID_PREFIX_BAR = { vocabulary: 'vocab_', sentence: 'sentence_', street: 'street_', home: 'home_', grundlagen: 'grundlagen_', saetze: 'saetze_', urlaub: 'sentence_', satztraining: 'satz_temp_' }
  const catLevelBar = (cat) => {
    const poolKey = CAT_TO_POOL_BAR[cat] || cat
    const poolInfo = POOL_STRUCTURE[poolKey] || { cardsPerLevel: 20, totalLevels: 10 }
    const cardsPerLevel = poolInfo.cardsPerLevel
    const activePairs = getActiveLangPairs(myData)
    const currentLevel = activePairs.length > 0
      ? Math.min(...activePairs.map(lp => getCatLevel(categoryLevels, poolKey, lp)))
      : (categoryLevels?.[poolKey] || 1)
    const idPrefix = CAT_ID_PREFIX_BAR[cat]
    let tierSeen = 0, tierBekannt = 0, tierGemeistert = 0, showTiers = false
    const pct = (() => {
      if (!idPrefix || activePairs.length === 0) {
        const count = activeCards.filter(c => c.category === cat && !/_r(_\d+)?$/.test(c.id) && cardProgress[c.id] !== undefined).length
        return Math.min(100, Math.round((count / cardsPerLevel) * 100))
      }
      const mainPair = activePairs[0] || ''
      const [pf, pt] = mainPair.split('_')
      const entries = Object.entries(cardProgress || {})
        .filter(([id]) => id.startsWith(idPrefix) && id.includes(`_${pf}_${pt}_`))
      tierSeen = entries.filter(([, p]) => (p?.interval ?? 0) >= 1).length
      tierBekannt = entries.filter(([, p]) => (p?.interval ?? 0) >= 3).length
      tierGemeistert = entries.filter(([, p]) => (p?.interval ?? 0) >= 7).length
      showTiers = tierSeen > 0
      const perPairPcts = activePairs.map(lp => {
        const [ppf, ppt] = lp.split('_')
        const count = Object.entries(cardProgress || {})
          .filter(([id]) => id.startsWith(idPrefix) && id.includes(`_${ppf}_${ppt}_`))
          .filter(([, p]) => (p?.interval ?? 0) >= 1).length
        return Math.min(100, Math.round((count / cardsPerLevel) * 100))
      })
      return Math.round(perPairPcts.reduce((a, b) => a + b, 0) / perPairPcts.length)
    })()
    return (
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', width: '100%', marginTop: '6px' }}>
        <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.38)', fontWeight: '600', letterSpacing: '0.5px' }}>Lv {currentLevel}/{poolInfo.totalLevels || 10}</span>
        <span style={{ display: 'block', width: '70%', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '1px', overflow: 'hidden' }}>
          <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: '#00D4AA', borderRadius: '1px' }} />
        </span>
        {showTiers && (
          <span style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.32)', letterSpacing: '0.2px' }}>
            👁 {tierSeen} · 📖 {tierBekannt} · ⭐ {tierGemeistert}
          </span>
        )}
      </span>
    )
  }

  // ── WORT DES TAGES ────────────────────────────────────────
  const wordOfDay = (() => {
    const mastered = activeCards.filter(c => !/_r(_\d+)?$/.test(c.id) && (cardProgress[c.id]?.interval || 0) >= 7)
    if (mastered.length === 0) return null
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000)
    return mastered[dayOfYear % mastered.length]
  })()

  // ── STREAK STATUS ─────────────────────────────────────────
  const sessionDates = [...new Set(sessionHistory.map(h => h.date))].sort()
  const lastSessionDate = sessionDates[sessionDates.length - 1]
  const streakStatus = !lastSessionDate ? null
    : lastSessionDate >= today ? 'safe'
    : lastSessionDate === yesterday ? 'warning'
    : 'lost'

  // ── DAILY GOAL ────────────────────────────────────────────
  const todayCorrect = sessionHistory.filter(h => h.date === today).reduce((a, b) => a + (b.correct || 0), 0)
  const dailyGoal = myData?.dailyGoal || 10

  // ── PARTNER ONLINE STATUS ─────────────────────────────────
  const humanTime = (iso) => {
    if (!iso) return ''
    const diff = Date.now() - new Date(iso).getTime()
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor(diff / 3600000)
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return 'gerade eben'
    if (hours < 24) return 'heute'
    if (days === 1) return 'gestern'
    if (days === 2) return 'vorgestern'
    if (days < 7) return `vor ${days} Tagen`
    if (days < 14) return 'letzte Woche'
    if (days < 30) return 'vor 2 Wochen'
    if (days < 60) return 'letzten Monat'
    return 'vor langer Zeit'
  }
  const partnerLastActive = partnerData?.lastActive
  const partnerOnline = !!(partnerData && (partnerLastActive === today || partnerLastActive === yesterday))
  const partnerActivityStatus = (() => {
    if (!partnerData || !partnerLastActive) return null
    const lastActiveMs = new Date(partnerLastActive).getTime()
    const nowMs = Date.now()
    const diffMin = (nowMs - lastActiveMs) / 60000
    if (diffMin <= 30) return { label: isMarkLang ? `${partnerName} lernt gerade` : `${partnerName} is learning now`, color: '#4CAF50', dot: '🟢' }
    if (partnerLastActive === today) return { label: isMarkLang ? `${partnerName} war heute aktiv` : `${partnerName} was active today`, color: '#FFC107', dot: '🟡' }
    if (partnerLastActive === yesterday) return { label: isMarkLang ? `${partnerName} war gestern aktiv` : `${partnerName} was active yesterday`, color: th.sub, dot: '⚪' }
    return { label: isMarkLang ? `${partnerName} zuletzt aktiv: ${humanTime(partnerLastActive)}` : `${partnerName} last seen: ${humanTime(partnerLastActive)}`, color: th.sub, dot: '⚪' }
  })()

  // ── CEFR PROGRESS ─────────────────────────────────────────
  const myMasteredCount = Object.values(cardProgress).filter(p => (p?.interval || 0) >= 7).length
  const cefrIdx = cefr ? CEFR_LEVELS.indexOf(cefr) : -1
  const nextCefr = cefrIdx >= 0 && cefrIdx < CEFR_LEVELS.length - 1 ? CEFR_LEVELS[cefrIdx + 1] : null
  const cefrFrom = cefr ? (CEFR_MASTERY_REQ[cefr] || 0) : 0
  const cefrTo = nextCefr ? CEFR_MASTERY_REQ[nextCefr] : cefrFrom
  const cefrPct = cefrTo > cefrFrom ? Math.min(100, Math.round(((myMasteredCount - cefrFrom) / (cefrTo - cefrFrom)) * 100)) : 100
  const cefrBar = (() => {
    const filled = Math.max(0, Math.min(5, Math.round(cefrPct / 20))); const empty = Math.max(0, 5 - filled)
    return '▓'.repeat(filled) + '░'.repeat(empty)
  })()

  // ── MONTHLY TEST CHECK ────────────────────────────────────
  const testDue = !myData?.cefr || daysSince(myData?.lastTestDate) >= MONTHLY_TEST_DAYS

  const sessionPreview = (() => {
    let due = 0, newC = 0
    allCards.forEach(card => {
      const p = cardProgress[card.id]
      if (!p) newC++
      else if (p.wrongSessions > 0 || p.nextReview <= today) due++
    })
    return { due, new: newC }
  })()

  useEffect(() => {
    if (screen !== 'menu') return
    const checkPending = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid, 'session', 'current'))
        setPendingSession(snap.exists() ? snap.data() : null)
      } catch (e) { console.warn('Could not check pending session:', e) }
    }
    checkPending()
  }, [screen])

  const startSession = () => {
    const toLangs = myData?.toLangs?.length > 0
      ? myData.toLangs
      : [{ lang: (myData?.toLang || (lang === 'de' ? 'en' : 'de')).toLowerCase(), percent: 100 }]
    const targetSize = myData?.sessionSize || SESSION_SIZE
    const alloc = toLangs.map(e => ({ lang: e.lang, n: Math.round(targetSize * e.percent / 100) }))
    const allocSum = alloc.reduce((s, a) => s + a.n, 0)
    if (allocSum !== targetSize) alloc[0].n += targetSize - allocSum
    const shuffleAll = arr => [...arr].sort(() => Math.random() - 0.5)
    const sess = shuffleAll(alloc.flatMap(({ lang: lc, n }) =>
      buildSession(activeCards.filter(c => c.targetLang === lc), cardProgress, n)
    ))
    setCurrentSessionMode('all')
    setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
  }

  // ── VOCAB WORD GENERATOR: generates 10 single words, saves, starts session ─
  // Called when vocab cards < 5 (empty state) AND at 85% mastery
  const generateVocabWords = async (existingVocabCards = []) => {
    setEmptyCategoryMsg(isMarkLang ? 'Noch keine Wörter hier — die KI erstellt gleich deine ersten Karten.' : 'No words yet — AI is creating your first cards…')

    // Fetch fresh Firestore state
    const freshSnap = await getDoc(doc(db, 'users', user.uid))
    const freshData = freshSnap.exists() ? freshSnap.data() : {}

    // Exclusion list: ALL existing card fronts (for the AI), but full list for dedup
    const allFronts = [
      ...allCards.map(c => c.front),
      ...(freshData.aiCards || []).map(c => c.front),
    ]
    const exclusionList = [...new Set(allFronts.map(f => (f || '').toLowerCase().trim()))]
      .filter(Boolean).slice(0, 120).join(', ')

    const langA = isMarkLang ? 'en' : 'de'
    const langB = isMarkLang ? 'de' : 'en'

    const prompt = isMarkLang
      ? `Generate 10 useful single English words for a German speaker learning English.
NOT phrases, NOT sentences — only single words or simple infinitives like 'to run'.
Avoid these already known words: ${exclusionList}
Return ONLY JSON: [{"front": "English word", "back": "Deutsche Übersetzung", "category": "vocabulary"}]`
      : `Generate 10 useful single German words for an English speaker learning German.
NOT phrases, NOT sentences — only single words or simple infinitives like 'to run'.
Avoid these already known words: ${exclusionList}
Return ONLY JSON: [{"front": "German word", "back": "English translation", "category": "vocabulary"}]`

    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 500, messages: [{ role: 'user', content: prompt }] })
      })
      const raw = ((await res.json()).content?.[0]?.text || '[]').trim()
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())

      const existingFrontsSet = new Set(allFronts.map(f => (f || '').toLowerCase().trim()))
      const ts = Date.now()

      const newCards = parsed
        .filter(c => {
          if (!c.front?.trim() || !c?.back?.trim()) return false
          const words = c.front.trim().split(' ').filter(Boolean)
          // Allow single words OR "to X" infinitives — reject everything else
          const isInfinitive = words.length === 2 && words[0].toLowerCase() === 'to'
          if (words.length > 2 || (words.length > 1 && !isInfinitive)) {
            console.log('[vocabWords] Rejected phrase:', c.front)
            return false
          }
          // Exact case-insensitive dedup only — no fuzzy matching
          const key = c.front.trim().toLowerCase()
          if (existingFrontsSet.has(key)) {
            console.log('[vocabWords] Exact duplicate skipped:', c.front)
            return false
          }
          existingFrontsSet.add(key)
          return true
        })
        .slice(0, 10)
        .map((c, i) => ({
          id: `vocab_ai_${ts}_${i}`,
          front: c.front.trim(),
          back: c?.back?.trim(),
          category: 'vocabulary',
          langA, langB,
          source: 'ai-vocab',
          createdAt: ts,
        }))

      if (newCards.length === 0) {
        setEmptyCategoryMsg(isMarkLang ? 'Keine neuen Wörter generiert — versuche es später.' : 'No new words generated — try again later.')
        setTimeout(() => setEmptyCategoryMsg(null), 3500)
        return
      }

      // Write to Firestore with fresh fetch to avoid race conditions
      const snap2 = await getDoc(doc(db, 'users', user.uid))
      const data2 = snap2.exists() ? snap2.data() : {}
      const updatedAiCards = [...(data2.aiCards || []), ...newCards]
      const updatedProgress = { ...(data2.cardProgress || {}) }
      newCards.forEach(c => {
        updatedProgress[c.id] = { interval: 0, consecutiveFast: 0, wrongSessions: 0, nextReview: todayStr() }
        console.log('[vocabWords] Saved:', c?.front, '→', c?.back)
      })
      await updateDoc(doc(db, 'users', user.uid), { aiCards: updatedAiCards, cardProgress: updatedProgress })
      setMyData(d => ({ ...d, aiCards: updatedAiCards, cardProgress: updatedProgress }))

      // Brief success message, then start session
      setEmptyCategoryMsg(isMarkLang ? 'Deine ersten Wörter sind bereit ✓' : 'Your first words are ready ✓')
      setTimeout(() => setEmptyCategoryMsg(null), 2000)

      // Session = existing vocab cards + new ones
      const allVocabForSession = [...existingVocabCards, ...newCards.flatMap(buildCardPair)]
      const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)
      const sess = shuffle(allVocabForSession).slice(0, SESSION_SIZE)
      setCurrentSessionMode('vocabulary')
      setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
    } catch (e) {
      console.error('[vocabWords] Generation failed:', e)
      setEmptyCategoryMsg(isMarkLang ? 'KI-Generierung fehlgeschlagen — versuche es erneut.' : 'AI generation failed — try again.')
      setTimeout(() => setEmptyCategoryMsg(null), 3500)
    }
  }

  const generateCategoryCards = async (category) => {
    const isStreet = category === 'street'
    const langA = isMarkLang ? 'de' : 'en'
    const langB = isMarkLang ? 'en' : 'de'
    const fromLangName = isMarkLang ? 'German' : 'English'
    const toLangName = isMarkLang ? 'English' : 'German'
    const typeDesc = isStreet
      ? 'slang, street language, informal expressions, youth language'
      : 'home, family, romantic, everyday domestic expressions'
    const label = isStreet
      ? (isMarkLang ? 'Auf der Straße — KI erstellt erste Phrasen…' : 'On the Street — AI creating first phrases…')
      : (isMarkLang ? 'Und zu Hause — KI erstellt erste Phrasen…' : 'At Home — AI creating first phrases…')
    setEmptyCategoryMsg(label)
    const prompt = `Generate exactly 5 natural ${typeDesc} flashcards for a ${toLangName} learner whose native language is ${fromLangName}.
Front language: ${fromLangName}. Back language: ${toLangName}. Category: ${category}.
For street/slang: use real informal expressions. For home: use family/romantic/daily household phrases.
Return ONLY valid JSON: [{"front":"...","back":"...","category":"${category}","context":"usage note in 1 sentence"}]`
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }) })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
      const ts = Date.now()
      const newCards = parsed.map((c, i) => ({
        ...c, id: `${category}_ai_${ts}_${i}`, langA, langB, source: `ai-${category}`, createdAt: ts,
        targetLang: langB
      }))
      const updatedAiCards = [...(myData?.aiCards || []), ...newCards]
      const updatedProgress = { ...(myData?.cardProgress || {}) }
      newCards.forEach(c => { updatedProgress[c.id] = { interval: 0, consecutiveRight: 0, wrongSessions: 0, nextReview: todayStr() } })
      await updateDoc(doc(db, 'users', user.uid), { aiCards: updatedAiCards, cardProgress: updatedProgress })
      setMyData(d => ({ ...d, aiCards: updatedAiCards, cardProgress: updatedProgress }))
      setEmptyCategoryMsg(isMarkLang ? 'Erste Phrasen bereit ✓' : 'First phrases ready ✓')
      setTimeout(() => setEmptyCategoryMsg(null), 2000)
      const sessionCards = newCards.flatMap(buildCardPair)
      const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)
      const sess = shuffle(sessionCards).slice(0, SESSION_SIZE)
      setCurrentSessionMode(category)
      setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
    } catch(e) {
      setEmptyCategoryMsg(isMarkLang ? 'KI-Generierung fehlgeschlagen.' : 'AI generation failed.')
      setTimeout(() => setEmptyCategoryMsg(null), 3000)
    }
  }

  const startCategorySession = async (category) => {
    try {
    console.log('[Vocara] startCategorySession:', category)
    let sessionCards = null
    if (loadCardsForCategory) {
      setCatLoading(category)
      const poolCat = category === 'all' ? null : category
      try {
        const activePairs = getActiveLangPairs(myData)
        const fetched = (await Promise.all(
          activePairs.map(lp => loadCardsForCategory(poolCat, lp))
        )).flat()
        if (!fetched || fetched.length === 0) {
          alert('Für dieses Level wurden noch keine Karten generiert. Bitte im Admin-Bereich generieren.')
          return
        }
        sessionCards = [...fetched]
      } catch (e) { console.error('[POOL] load failed:', e) }
    }
    // ── MEINE WORTE HARD FILTER ─────────────────────────────────
    // Only single-word or max 2-word fronts are allowed in vocabulary.
    // basics are always excluded. Any sentence slipping through is rejected here.
    const vocabGuard = (c) => {
      if (c.category === 'basics') return false
      if (c.category === 'vocab') return true
      return (
        c.category === 'vocabulary' && !c.front?.trim().includes(' ')
      ) || (
        c.category === 'vocabulary' && c.front?.trim().split(' ').length <= 2
      )
    }
    const CAT_TO_POOL_FILTER = { vocabulary: 'vocab', urlaub: 'sentence' }
    const filterCat = CAT_TO_POOL_FILTER[category] || category
    const cards = sessionCards
      ? (category === 'vocabulary' ? sessionCards.filter(c => vocabGuard(c)) : sessionCards)
      : category === 'all'
        ? activeCards
        : category === 'vocabulary'
          ? activeCards.filter(c => vocabGuard(c))
          : activeCards.filter(c => c.category === category || c.category === filterCat)
    if (cards.length === 0) {
      alert('Für dieses Level wurden noch keine Karten generiert. Bitte im Admin-Bereich generieren.')
      return
    }
    const sp = myData?.sessionProgress
    if (sp?.mode === category && sp.cardIds?.length > 0) {
      setResumeDialog({ category, cards })
      return
    }
    const userSessionSize = myData?.sessionSize || 10
    const toLangs = myData?.toLangs?.length > 0
      ? myData.toLangs
      : [{ lang: myData?.toLang || 'en', percent: 100 }]
    const alloc = toLangs.map(e => ({ lang: e.lang, n: Math.round(userSessionSize * e.percent / 100) }))
    const allocSum = alloc.reduce((s, a) => s + a.n, 0)
    if (allocSum !== userSessionSize) alloc[0].n += userSessionSize - allocSum
    let sess = alloc.flatMap(({ lang: lc, n }) =>
      buildSession(cards.filter(c => c.targetLang === lc || c.langB === lc), cardProgress, n)
    )
    sess = [...sess].sort(() => Math.random() - 0.5)
    // Fallback: if nothing is due (all reviewed, none overdue), practice all category cards
    if (sess.length === 0) {
      const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)
      sess = shuffle(cards).slice(0, userSessionSize)
    }
    if (sess.length === 0) return
    setCurrentSessionMode(category)
    // Show Wort des Tages banner for 2s before starting any session
    const startSession = () => {
      setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
      if (['vocabulary', 'street', 'home', 'grundlagen', 'saetze', 'satztraining'].includes(category)) markAreaDone(category === 'grundlagen' ? 'basics' : category)
    }
    if (wordOfDay) {
      setWordOfDayBanner(wordOfDay)
      setTimeout(() => { setWordOfDayBanner(null); startSession() }, 2000)
    } else {
      startSession()
    }
    } catch (err) {
      console.error('[SESSION ERROR]', err)
      alert('Fehler beim Laden der Karten. Bitte versuche es erneut.')
    } finally {
      setCatLoading(null)
    }
  }
  const startBasicsSession = () => startCategorySession('grundlagen')

  const startSatzSession = () => setScreen('satz')


  const startTopicSession = async (topicKey) => {
    const toLangCode = (myData?.toLang || (lang === 'de' ? 'en' : 'de')).toLowerCase()
    const fromLangCode = lang
    const langPair = `${fromLangCode}_${toLangCode}`
    const level = myData?.topicLevels?.[topicKey] || 1
    setTopicSessionLoading(topicKey)
    try {
      const docRef = doc(db, 'sharedCards', `${langPair}_${topicKey}_${level}`)
      const snap = await getDoc(docRef)
      if (!snap.exists() || !snap.data()?.cards?.length) {
        alert('Für dieses Level wurden noch keine Karten generiert. Bitte im Admin-Bereich generieren.')
        setTopicSessionLoading(null)
        return
      }
      const rawCards = snap.data().cards
      const ts = Date.now()
      const sessionCards = rawCards.map((c, i) => ({
        ...c,
        id: c.id || `topic_${topicKey}_${level}_${ts}_${i}`,
        topicKey,
        langA: fromLangCode,
        langB: toLangCode,
        targetLang: toLangCode,
      }))
      const sess = buildSession(sessionCards, cardProgress)
      if (sess.length === 0) {
        setEmptyCategoryMsg(isMarkLang ? 'Keine Karten verfügbar.' : 'No cards available.')
        setTimeout(() => setEmptyCategoryMsg(null), 3000)
        setTopicSessionLoading(null)
        return
      }
      setCurrentSessionMode(`topic_${topicKey}`)
      setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
    } catch (e) {
      console.warn('startTopicSession failed:', e)
      setEmptyCategoryMsg(isMarkLang ? 'Fehler beim Laden der Themen-Karten.' : 'Failed to load topic cards.')
      setTimeout(() => setEmptyCategoryMsg(null), 3500)
    }
    setTopicSessionLoading(null)
  }

  const continueSession = async () => {
    const { category, cards } = resumeDialog
    const answeredSet = new Set(myData?.sessionProgress?.cardIds || [])
    const remaining = cards.filter(c => !answeredSet.has(c.id))
    const pool = remaining.length > 0 ? remaining : cards
    const sess = buildSession(pool, cardProgress)
    try { await updateDoc(doc(db, 'users', user.uid), { sessionProgress: null }); setMyData(d => ({ ...d, sessionProgress: null })) } catch (e) {}
    setCurrentSessionMode(category)
    setResumeDialog(null)
    if (sess.length === 0) return
    setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
  }
  const startFresh = async () => {
    const { category, cards } = resumeDialog
    try { await updateDoc(doc(db, 'users', user.uid), { sessionProgress: null }); setMyData(d => ({ ...d, sessionProgress: null })) } catch (e) {}
    const sess = buildSession(cards, cardProgress)
    setCurrentSessionMode(category)
    setResumeDialog(null)
    if (sess.length === 0) return
    setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
  }
  const resumeSession = () => {
    if (!pendingSession) return
    setSession(pendingSession.queue); setResumeStartIndex(pendingSession.index || 0)
    setResumeStartProgress(pendingSession.newProgress || null); setPendingSession(null); setScreen('cards')
  }
  const discardSession = async () => { await clearSessionState(user.uid); setPendingSession(null) }
  const handleSessionStop = async (finalProgress, answeredCount) => {
    setScreen('menu'); setSession(null)
    if (answeredCount > 0) {
      try {
        await onSaveProgress(finalProgress)
        const msg = `${answeredCount} Karte${answeredCount !== 1 ? 'n' : ''} gespeichert ✓`
        setStopToast(msg)
        setTimeout(() => setStopToast(null), 3000)
      } catch(e) { console.warn('handleSessionStop save failed:', e) }
    }
  }
  const markAreaDone = (area) => {
    const currentWeek = getISOWeekStr()
    setWeeklyGoals(prev => {
      const base = prev?.week === currentWeek ? prev : { week: currentWeek, completed: [] }
      if (base.completed.includes(area)) return base
      const updated = { week: currentWeek, completed: [...base.completed, area] }
      updateDoc(doc(db, 'users', user.uid), { weeklyGoals: updated }).catch(() => {})
      if (updated.completed.length === 5) {
        const currentMonth = new Date().toISOString().slice(0, 7)
        const storedMonthly = myData?.monthlyGoal || {}
        const prevCompleted = storedMonthly.lastUnlock === currentMonth ? 0 : (storedMonthly.completedWeeks || 0)
        const newWeekCount = prevCompleted + 1
        setWeekGoalCelebration(true)
        try { if (navigator.vibrate) navigator.vibrate(300) } catch(e) {}
        setTimeout(() => setWeekGoalCelebration(false), 4500)
        if (newWeekCount >= 5) {
          const newGimmicks = (myData?.unlockedGimmicks || 0) + 1
          const newMonthly = { completedWeeks: 0, lastUnlock: currentMonth }
          const gimmickEntry = { theme, date: todayStr() }
          const gimmickHistory = [...(myData?.gimmickHistory || []), gimmickEntry]
          updateDoc(doc(db, 'users', user.uid), { monthlyGoal: newMonthly, unlockedGimmicks: newGimmicks, weeklyGoals: updated, gimmickHistory }).catch(() => {})
          setMyData(d => ({ ...d, monthlyGoal: newMonthly, unlockedGimmicks: newGimmicks, weeklyGoals: updated, gimmickHistory }))
          setMonthlyUnlockNotification(true)
          setTimeout(() => setMonthlyUnlockNotification(false), 5000)
          setGimmickPopup(true)
          setTimeout(() => setGimmickPopup(false), 6000)
        } else {
          const newMonthly = { completedWeeks: newWeekCount, lastUnlock: storedMonthly.lastUnlock || null }
          updateDoc(doc(db, 'users', user.uid), { monthlyGoal: newMonthly, weeklyGoals: updated }).catch(() => {})
          setMyData(d => ({ ...d, monthlyGoal: newMonthly, weeklyGoals: updated }))
        }
      } else {
        setMyData(d => ({ ...d, weeklyGoals: updated }))
      }
      return updated
    })
  }
  const submitMiniTask = async () => {
    if (!miniTaskInput.trim() || !miniTask) return
    setMiniTaskLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: 80,
          messages: [{ role: 'user', content: `The user was asked to use "${miniTask.word}" in a sentence. They wrote: "${miniTaskInput.trim()}". In 1 short sentence in ${isMarkLang ? 'German' : 'English'}, give brief encouraging grammar feedback. Be kind and very concise.` }]
        })
      })
      const data = await res.json()
      const feedback = data.content?.[0]?.text?.trim() || ''
      const updated = { ...miniTask, done: true, answer: miniTaskInput.trim(), feedback }
      setMiniTask(updated); setMiniTaskInput('')
      await updateDoc(doc(db, 'users', user.uid), { miniTask: updated }).catch(() => {})
      setMyData(d => ({ ...d, miniTask: updated }))
    } catch (e) { console.warn('miniTask submit failed:', e) }
    finally { setMiniTaskLoading(false) }
  }

  const handleStreakFreeze = async () => {
    const month = new Date().toISOString().slice(0, 7)
    const update = { streakFreeze: { available: false, lastReset: month, usedAt: todayStr() } }
    try {
      await updateDoc(doc(db, 'users', user.uid), update)
      setMyData(d => ({ ...d, ...update }))
      setFreezeAvailable(false)
    } catch (e) { console.warn('Streak freeze failed:', e) }
  }

  const handleSaveState = async (queue, index, newProgress) => { await saveSessionState(user.uid, queue, index, newProgress) }
  const saveSessionProgress = async (cardIds, mode) => {
    const sp = { cardIds, mode, timestamp: Date.now() }
    try { await updateDoc(doc(db, 'users', user.uid), { sessionProgress: sp }); setMyData(d => ({ ...d, sessionProgress: sp })) } catch (e) { console.warn('Session progress save failed:', e) }
  }
  const generateAICards = async () => {
    const homeCity = myData?.homeCity || (isMarkLang ? 'Hamburg' : 'Nairobi')
    const partnerCity = myData?.partnerCity || (isMarkLang ? 'Nairobi' : 'Hamburg')
    const existingAI = myData?.aiCards || []
    const knownFrontsSet = new Set(allCards.map(c => c.front.toLowerCase().trim()))

    // Enforce 80/20 ratio: at most 1 SW card per 5 generated
    const totalAIAfter = existingAI.length + 5
    const maxSW = Math.floor(totalAIAfter * 0.2)
    const currentAISW = existingAI.filter(c => c.langA === 'sw').length
    const swCount = isMarkLang ? Math.min(1, Math.max(0, maxSW - currentAISW)) : 0

    const requests = isMarkLang
      ? [
          { langA: 'en', langB: 'de', count: 5 - swCount },
          ...(swCount > 0 ? [{ langA: 'sw', langB: 'de', count: swCount }] : []),
        ]
      : [{ langA: 'de', langB: 'en', count: 5 }]

    const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili' }
    let allNewCards = []
    const ts = Date.now()

    // Exclusion list: single/2-word fronts only (sending phrases confuses the AI)
    const knownFrontsArr = [...knownFrontsSet].filter(f => f.split(' ').length <= 2)

    // In vocabulary mode (85% mastery from vocab session): generate single words, not phrases
    const isVocabMode = currentSessionMode === 'vocabulary'

    for (const req of requests) {
      const knownList = knownFrontsArr.slice(0, 80).join(', ')
      const isSwahili = req.langA === 'sw'
      const isEnglish = req.langA === 'en'
      const needsPronunciation = isSwahili || isEnglish

      let prompt
      if (isVocabMode) {
        // Vocab mode: single words only, same as generateVocabWords
        prompt = isMarkLang
          ? `Generate 10 useful single English words for a German speaker learning English.
NOT phrases, NOT sentences — only single words or simple infinitives like 'to run'.
Avoid these already known words: ${knownList}
Return ONLY JSON: [{"front": "English word", "back": "Deutsche Übersetzung", "category": "vocabulary"}]`
          : `Generate 10 useful single German words for an English speaker learning German.
NOT phrases, NOT sentences — only single words or simple infinitives like 'to run'.
Avoid these already known words: ${knownList}
Return ONLY JSON: [{"front": "German word", "back": "English translation", "category": "vocabulary"}]`
      } else {
        prompt = `Generate exactly ${req.count} vocabulary flashcard${req.count > 1 ? 's' : ''} for a language learner.
Front language: ${LANG_NAMES[req.langA]}
Back language: ${LANG_NAMES[req.langB]}
Learner's home city: ${homeCity}
Partner's city: ${partnerCity}

Rules:
- Choose common, useful everyday phrases or expressions (intermediate level, not basic words like "hello")
- The "context" field: 1-2 sentences in ${LANG_NAMES[req.langB]} telling a short personal story that mentions ${homeCity} and/or ${partnerCity}
- Avoid these already known phrases: ${knownList}
- Return ONLY a valid JSON array, no markdown, no explanation${isSwahili ? `
- Add a "pronunciation" field with German-phonetic pronunciation guide for the Swahili front text
- German phonetics only: "a" like German "Vater", "e" like "Bett", "i" like "mit", rolled "r"
- No English sounds — never use "ay", "oh", "ee"; use "e", "o", "i" instead
- Example: "habari" → "ha-BA-ri", "asante" → "a-SAN-te"` : ''}${isEnglish ? `
- Add a "pronunciation" field with German-friendly phonetic spelling for the English front text
- Use German phonetics: "ä" for short "e", "i" for "ee", "o" for "oh", syllable breaks with "-", stress with CAPS
- Example: "weather" → "WE-dser", "thought" → "Ssot", "through" → "Ssru"` : ''}

Format: [{"front":"...","back":"...","context":"...","category":"..."${needsPronunciation ? ',"pronunciation":"..."' : ''}}]`
      }

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
        })
        const data = await res.json()
        const raw = data.content?.[0]?.text || ''
        const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
        parsed.slice(0, req.count).forEach((card, i) => {
          allNewCards.push({
            id: `ai_${req.langA}_${ts}_${i}`,
            front: card?.front,
            back: card?.back,
            context: card?.context || '',
            category: VALID_CATEGORY_SET.has(card?.category) ? card?.category : 'vocabulary',
            langA: req.langA,
            langB: req.langB,
            source: 'ai-generated',
            createdAt: ts,
            ...(card.pronunciation ? { pronunciation: card.pronunciation } : {}),
          })
        })
      } catch (e) {
        console.warn('AI card generation failed for', req.langA, e)
      }
    }

    // In vocab mode: reject any phrase that slipped through (must be single word or "to X")
    if (isVocabMode) {
      allNewCards = allNewCards.filter(card => {
        const words = (card.front || '').trim().split(' ').filter(Boolean)
        const isInfinitive = words.length === 2 && words[0].toLowerCase() === 'to'
        if (words.length > 2 || (words.length > 1 && !isInfinitive)) {
          console.log('[generateAICards] Vocab mode: rejected phrase:', card.front)
          return false
        }
        return true
      })
    }
    // Deduplicate by exact front text (case-insensitive)
    allNewCards = allNewCards.filter(card => {
      const key = card.front.toLowerCase().trim()
      if (knownFrontsSet.has(key)) {
        console.log('[generateAICards] Card skipped (duplicate front):', card.front)
        return false
      }
      knownFrontsSet.add(key)
      return true
    })
    if (allNewCards.length === 0) {
      console.log('[generateAICards] All cards were duplicates — nothing to save')
      return
    }

    console.log(`[generateAICards] Attempting to save ${allNewCards.length} cards:`, allNewCards.map(c => c.front))

    const newProgressEntries = {}
    allNewCards.forEach(card => {
      newProgressEntries[card.id] = { interval: 0, consecutiveFast: 0, wrongSessions: 0, nextReview: todayStr() }
    })

    const doSave = async () => {
      // Fetch FRESH data from Firestore to avoid race condition with onSaveProgress
      const freshSnap = await getDoc(doc(db, 'users', user.uid))
      const freshData = freshSnap.exists() ? freshSnap.data() : {}
      const freshAiCards = freshData.aiCards || []
      const freshProgress = freshData.cardProgress || {}

      // Deduplicate again against current Firestore state (handles race with other tabs/saves)
      const firestoreFronts = new Set(freshAiCards.map(c => (c.front || '').toLowerCase().trim()))
      const cardsToSave = allNewCards.filter(c => {
        const key = c.front.toLowerCase().trim()
        if (firestoreFronts.has(key)) {
          console.log('[generateAICards] Skipping (already in Firestore):', c.front)
          return false
        }
        return true
      })
      if (cardsToSave.length === 0) {
        console.log('[generateAICards] All cards already exist in Firestore — skipping write')
        return { success: true, count: 0 }
      }

      const updatedAiCards = [...freshAiCards, ...cardsToSave]
      // Merge fresh Firestore progress with new entries — never lose existing progress
      const updatedProgress = { ...freshProgress, ...newProgressEntries }

      cardsToSave.forEach(c => console.log('[generateAICards] Saving:', c.front, '| id:', c.id, '| category:', c.category))
      await updateDoc(doc(db, 'users', user.uid), { aiCards: updatedAiCards, cardProgress: updatedProgress })
      cardsToSave.forEach(c => console.log('[generateAICards] Saved successfully:', c.front))
      return { success: true, count: cardsToSave.length, updatedAiCards, updatedProgress }
    }

    try {
      let result = await doSave()
      if (!result.success) throw new Error('Save returned unsuccessful')

      // Retry once if something went wrong
      if (result.count === 0) {
        console.log('[generateAICards] No cards saved on first attempt — retrying once')
        result = await doSave()
      }

      // Force re-fetch to ensure local state matches Firestore exactly
      const snap = await getDoc(doc(db, 'users', user.uid))
      const fresh = snap.exists() ? snap.data() : {}
      console.log(`[generateAICards] Firestore now has ${fresh.aiCards?.length ?? 0} AI cards, ${Object.keys(fresh.cardProgress || {}).length} progress entries`)
      setMyData(d => ({
        ...d,
        aiCards: fresh.aiCards || d.aiCards,
        cardProgress: fresh.cardProgress || d.cardProgress,
      }))
      if (result.count > 0) {
        const msg = isMarkLang
          ? `✨ ${result.count} neue KI-Karten hinzugefügt!`
          : `✨ ${result.count} new AI cards added!`
        setAiNotification(msg)
        setTimeout(() => setAiNotification(null), 4000)
      }
    } catch (e) {
      console.error('[generateAICards] Save failed:', e)
      // One final retry
      try {
        console.log('[generateAICards] Final retry after error...')
        await doSave()
        console.log('[generateAICards] Final retry succeeded')
      } catch (e2) {
        console.error('[generateAICards] Final retry also failed:', e2)
      }
    }
  }

  const handleRequestMoreCards = async () => {
    const seenIds = new Set((session || []).map(c => c.id))
    let candidates = []
    if (currentSessionMode === 'all') {
      candidates = allCards.filter(c => !seenIds.has(c.id) && !/_r$/.test(c.id))
    } else if (currentSessionMode.startsWith('topic_')) {
      const topicKey = currentSessionMode.slice('topic_'.length)
      candidates = allCards.filter(c => !seenIds.has(c.id) && !/_r$/.test(c.id) && c.topicKey === topicKey)
    } else {
      candidates = allCards.filter(c => !seenIds.has(c.id) && !/_r$/.test(c.id) && c.category === currentSessionMode)
    }
    const unseen = candidates.filter(c => !cardProgress[c.id] || (cardProgress[c.id]?.interval || 0) === 0)
    const pool = unseen.length > 0 ? unseen : candidates
    if (pool.length === 0) return []
    const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)
    const picked = shuffle(pool).slice(0, 10)
    return picked.flatMap(buildCardPair)
  }

  const handleSuggestMoreSession = async () => {
    if (!suggestModal) return
    const { nextLevel, mode, poolCat, langPair } = suggestModal
    setSuggestModal(null)
    setCatLoading(mode)
    try {
      const snap = await getDocs(collection(db, 'sharedCards'))
      const [fromLang, toLang] = langPair.split('_')
      const found = []
      snap.forEach(d => {
        const data = d.data()
        if (String(data.level) !== String(nextLevel)) return
        if (data.category !== poolCat && data.category !== mode) return
        if (!data.fromLang || !data.toLang) return
        if (data.fromLang.toLowerCase() !== fromLang || data.toLang.toLowerCase() !== toLang) return
        ;(data.cards || []).forEach(c => found.push({ ...c, targetLang: toLang }))
      })
      const seenIds = new Set((session || []).map(c => c.id))
      const unseen = found.filter(c => !seenIds.has(c.id) && !(cardProgress[c.id]?.interval >= 1))
      const pool = unseen.length >= 3 ? unseen : found.filter(c => !seenIds.has(c.id))
      if (pool.length === 0) { setScreen('result'); return }
      const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)
      const picked = shuffle(pool).slice(0, 3).flatMap(buildCardPair)
      setCurrentSessionMode(mode)
      setSession(picked)
      setResumeStartIndex(0)
      setResumeStartProgress(null)
      setScreen('cards')
    } catch (e) {
      console.error('[SUGGEST MORE]', e)
      setScreen('result')
    } finally {
      setCatLoading(null)
    }
  }

  const handleFinish = async (finalProgress, correct, wrong, easy, fast, cardStats) => {
    let unlocked = false
    if (checkMastery(allCards, finalProgress, correct, correct + wrong)) {
      const newBatch = getNextNewCards(allCards, finalProgress, NEW_CARDS_BATCH)
      if (newBatch.length > 0) {
        newBatch.forEach(card => {
          // New cards available immediately
          finalProgress[card.id] = { interval: 0, consecutiveFast: 0, wrongSessions: 0, nextReview: todayStr() }
        })
        unlocked = true
      }
    }
    setMasteryUnlocked(unlocked)
    await onSaveProgress(finalProgress)
    // ── Pool level-up check ────────────────────────────────
    const CAT_TO_POOL = { vocabulary: 'vocab', sentence: 'urlaub' }
    const CAT_ID_PREFIX = { vocabulary: 'vocab_', sentence: 'sentence_', street: 'street_', home: 'home_', grundlagen: 'grundlagen_', saetze: 'saetze_' }
    const poolKey = CAT_TO_POOL[currentSessionMode] || currentSessionMode
    const poolInfo = POOL_STRUCTURE[poolKey]
    const idPrefix = CAT_ID_PREFIX[currentSessionMode]
    if (poolInfo && idPrefix && currentSessionMode !== 'all') {
      const activePairs = getActiveLangPairs(myData)
      const levelUpdates = {}
      for (const lp of activePairs) {
        const [lpFrom, lpTo] = lp.split('_')
        const masteredCount = Object.entries(finalProgress)
          .filter(([id]) => id.startsWith(idPrefix) && id.includes(`_${lpFrom}_${lpTo}_`))
          .filter(([, p]) => (p?.interval ?? 0) >= 2).length
        const currentCatLevel = getCatLevel(myData?.categoryLevels, poolKey, lp)
        if (currentCatLevel < poolInfo.totalLevels && masteredCount >= poolInfo.cardsPerLevel * 0.8) {
          levelUpdates[getCatLevelKey(poolKey, lp)] = currentCatLevel + 1
          console.log(`[LevelUp] ${poolKey}_${lp} → Lv${currentCatLevel + 1} (${masteredCount}/${poolInfo.cardsPerLevel} mastered)`)
        }
      }
      if (Object.keys(levelUpdates).length > 0) {
        const newCategoryLevels = { ...(myData?.categoryLevels || {}), ...levelUpdates }
        try {
          await updateDoc(doc(db, 'users', user.uid), { categoryLevels: newCategoryLevels })
          setMyData(d => ({ ...d, categoryLevels: newCategoryLevels }))
        } catch (e) { console.error('[LevelUp] Failed:', e) }
      }
    }
    // ── Topic level-up check ──────────────────────────────
    if (currentSessionMode.startsWith('topic_')) {
      const topicKey = currentSessionMode.slice('topic_'.length)
      const topicInfo = TOPIC_STRUCTURE[topicKey]
      if (topicInfo) {
        const topicLevel = myData?.topicLevels?.[topicKey] || 1
        const prefix = `${topicKey}_${topicLevel}_`
        const masteredCount = Object.entries(finalProgress)
          .filter(([id, p]) => id.startsWith(prefix) && (p?.interval ?? 0) >= 7).length
        if (topicLevel < topicInfo.totalLevels && masteredCount >= topicInfo.cardsPerLevel * 0.8) {
          const newLevel = topicLevel + 1
          const newTopicLevels = { ...(myData?.topicLevels || {}), [topicKey]: newLevel }
          try {
            await updateDoc(doc(db, 'users', user.uid), { topicLevels: newTopicLevels })
            setMyData(d => ({ ...d, topicLevels: newTopicLevels }))
          } catch (e) { console.error('[TopicLevelUp] Failed:', e) }
        }
      }
    }
    // ── Learning time tracking ─────────────────────────────
    const sessionMinutes = Math.max(1, Math.round((correct + wrong) * 30 / 60))
    const nowMonth = new Date().toISOString().slice(0, 7)
    const nowWeek = getISOWeekStr()
    const prevMonthly = myData?.learningMonth === nowMonth ? (myData?.monthlyMinutes || 0) : 0
    const prevWeekly = myData?.learningWeek === nowWeek ? (myData?.weeklyMinutes || 0) : 0
    const newMonthlyMinutes = prevMonthly + sessionMinutes
    const newWeeklyMinutes = prevWeekly + sessionMinutes
    const newTotalMinutes = (myData?.totalMinutes || 0) + sessionMinutes
    const timeUpdate = { monthlyMinutes: newMonthlyMinutes, weeklyMinutes: newWeeklyMinutes, totalMinutes: newTotalMinutes, learningMonth: nowMonth, learningWeek: nowWeek }
    const updatedHistory = await saveSessionHistory(user.uid, correct, correct + wrong, sessionHistory, timeUpdate)
    setMyData(d => ({ ...d, sessionHistory: updatedHistory, ...timeUpdate }))
    await clearSessionState(user.uid)
    const statsEntries = Object.entries(cardStats || {})
    const weakestEntry = statsEntries.filter(([, v]) => v.wrongs > 0).sort((a, b) => b[1].wrongs - a[1].wrongs)[0]
    const strongestEntry = statsEntries.filter(([, v]) => v.wrongs === 0 && v.fastestMs < Infinity).sort((a, b) => a[1].fastestMs - b[1].fastestMs)[0]
    const weakestCard = weakestEntry ? session?.find(c => c.id === weakestEntry[0]) : null
    const strongestCard = strongestEntry ? session?.find(c => c.id === strongestEntry[0]) : null
    const totalAnswered = correct + wrong
    const easyRatio = totalAnswered > 0 ? (easy || 0) / totalAnswered : 0
    const suggestMore = easyRatio >= 0.7
    setResult({ correct, wrong, easy: easy || 0, fast: fast || 0, weakestCard, strongestCard, originalSession: session, suggestMore })
    // Refresh tutor with fresh progress & history so due counts are accurate post-session
    fetchTutorMsg(finalProgress, updatedHistory)
    setSessionCompleteCount(n => n + 1)
    if (currentSessionMode === 'sentence') {
      setScreen('rhythmus')
    } else if (suggestMore && totalAnswered >= 5 && !['all', 'satztraining'].includes(currentSessionMode)) {
      const activePairs = getActiveLangPairs(myData)
      const langPair = activePairs[0] || 'de_en'
      const CAT_POOL_MAP_SG = { vocabulary: 'vocab', sentence: 'urlaub', urlaub: 'urlaub' }
      const poolCat = CAT_POOL_MAP_SG[currentSessionMode] || currentSessionMode
      const currentLevel = getCatLevel(categoryLevels, poolCat, langPair)
      const maxLevel = POOL_STRUCTURE[poolCat]?.totalLevels || 10
      const nextLevel = Math.min(currentLevel + 1, maxLevel)
      setSuggestModal({ nextLevel, mode: currentSessionMode, poolCat, langPair })
      setScreen('suggest')
    } else {
      setScreen('result')
    }
  }

  if (screen === 'suggest' && suggestModal) return <>{homeFloat}<div style={{ minHeight: '100vh', background: th.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', gap: '20px' }}>
    <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>🎉</div>
    <p style={{ color: th.text, fontSize: '1.1rem', fontWeight: '700', textAlign: 'center', margin: 0 }}>Du kennst diese Karten sehr gut!</p>
    <p style={{ color: th.sub, fontSize: '0.9rem', textAlign: 'center', margin: '0 0 8px', lineHeight: 1.5 }}>Möchtest du 3 neue Karten aus Level {suggestModal.nextLevel} hinzufügen?</p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '280px' }}>
      <button onClick={handleSuggestMoreSession} disabled={!!catLoading} style={{ ...s.button, background: 'linear-gradient(135deg,#4CAF50,#2E7D32)', color: '#fff', padding: '14px', fontSize: '0.95rem', fontWeight: '700', opacity: catLoading ? 0.6 : 1 }}>
        {catLoading ? '⟳ Laden...' : 'Ja, weiter lernen!'}
      </button>
      <button onClick={() => { setSuggestModal(null); setScreen('result') }} style={{ ...s.button, background: 'transparent', border: `1px solid ${th.border}`, color: th.sub, padding: '12px', fontSize: '0.9rem' }}>Nein danke</button>
    </div>
  </div></>
  if (screen === 'cards' && session) return <>{homeFloat}<CardScreen session={session} onBack={() => setScreen('menu')} onFinish={handleFinish} lang={lang} cardProgress={cardProgress} s={s} onSaveState={handleSaveState} onSaveSessionProgress={saveSessionProgress} onStop={handleSessionStop} onSaveExample={handleSaveExample} mode={currentSessionMode} startIndex={resumeStartIndex} startProgress={resumeStartProgress} userToLang={(myData?.toLang || '').toLowerCase() || (lang === 'de' ? 'en' : 'de')} t={t} onRequestMoreCards={handleRequestMoreCards} /></>
  if (screen === 'rhythmus') return <>{homeFloat}<RhythmusScreen lang={lang} theme={theme} onBack={() => { setScreen('result') }} allCards={allCards} cardProgress={cardProgress} userToLang={(myData?.toLang || '').toLowerCase() || (lang === 'de' ? 'en' : 'de')} /></>
  if (screen === 'result') return <>{homeFloat}<ResultScreen correct={result.correct} wrong={result.wrong} fast={result.fast} easy={result.easy} weakestCard={result.weakestCard} strongestCard={result.strongestCard} masteryUnlocked={masteryUnlocked} t={t} lang={lang} onBack={() => { setScreen('menu'); setSession(null) }} onReplay={result.originalSession ? () => { setSession(result.originalSession); setResumeStartIndex(0); setResumeStartProgress(null); setScreen('cards') } : null} s={s} th={th} /></>
  if (screen === 'settings') return <>{homeFloat}<SettingsScreen t={t} s={s} theme={theme} onThemeChange={onThemeChange} onBack={() => setScreen('menu')} user={user} myData={myData} setMyData={setMyData} allCards={allCards} lang={lang} onPartner={() => setScreen('partner')} onLightModeChange={onLightModeChange} onCardSizeChange={onCardSizeChange} onSprachkompass={() => setScreen('sprachkompass')} onSprachpuls={() => setScreen('sprachpuls')} /></>
  if (screen === 'sprachkompass') return <SprachkompassScreen user={user} myData={myData} setMyData={setMyData} theme={theme} th={th} s={s} lightMode={lightMode} lang={lang} onBack={() => setScreen('settings')} onComplete={() => setScreen('menu')} />
  if (screen === 'sprachpuls') return <SprachpulsScreen user={user} myData={myData} setMyData={setMyData} theme={theme} th={th} s={s} lightMode={lightMode} lang={lang} onBack={() => setScreen('settings')} onComplete={() => setScreen('menu')} />
  if (screen === 'meinekarten') return <>{homeFloat}<MeineKartenScreen user={user} myData={myData} setMyData={setMyData} allCards={allCards} cardProgress={cardProgress} lang={lang} theme={theme} onBack={() => setScreen('menu')} /></>
  if (screen === 'geschenkkarte') return <>{homeFloat}<GeschenkkarteScreen user={user} myData={myData} lang={lang} theme={theme} onBack={() => setScreen('menu')} allCards={allCards} cardProgress={cardProgress} /></>
  if (screen === 'karteerstellen') return <>{homeFloat}<KarteErstellenScreen user={user} myData={myData} setMyData={setMyData} allCards={allCards} lang={lang} theme={theme} onBack={() => setScreen('menu')} /></>
  if (screen === 'partner') return <>{homeFloat}<PartnerScreen user={user} myData={myData} lang={lang} theme={theme} onBack={() => setScreen('menu')} onPartnerUpdate={(uid) => { onPartnerUpdate(uid); setScreen('menu') }} /></>
  if (screen === 'test') return <SprachkompassScreen user={user} myData={myData} setMyData={setMyData} theme={theme} th={th} s={s} lightMode={lightMode} lang={lang} onBack={() => setScreen('menu')} onComplete={() => setScreen('menu')} />
  if (screen === 'impressum') return <>{homeFloat}<ImpressumScreen lang={lang} theme={theme} onBack={() => setScreen('menu')} /></>
  if (screen === 'stats') return <>{homeFloat}<StatsScreen user={user} myData={myData} partnerData={partnerData} allCards={allCards} lang={lang} theme={theme} th={th} s={s} onBack={() => setScreen('menu')} cardProgress={cardProgress} t={t} /></>
  if (screen === 'ki') return <>{homeFloat}<KiGespraechScreen lang={lang} theme={theme} th={th} s={s} onBack={() => setScreen('menu')} userName={user.displayName?.split(' ')[0] || 'du'} userToLang={(myData?.toLang || '').toLowerCase() || (lang === 'de' ? 'en' : 'de')} /></>
  if (screen === 'satz') return <>{homeFloat}<SatzTrainingScreen lang={lang} theme={theme} onBack={() => setScreen('menu')} allCards={allCards} cardProgress={cardProgress} userName={user.displayName?.split(' ')[0] || 'du'} userToLang={(myData?.toLang || '').toLowerCase() || (lang === 'de' ? 'en' : 'de')} t={t} user={user} myData={myData} onSatzComplete={async (correct, total) => {
    const entry = { date: todayStr(), correct, total, area: 'satztraining', ts: Date.now() }
    const updated = [entry, ...(myData?.sessionHistory || [])].slice(0, 60)
    try {
      await updateDoc(doc(db, 'users', user.uid), { sessionHistory: updated })
      setMyData(prev => ({ ...prev, sessionHistory: updated }))
      markAreaDone('satztraining')
    } catch(e) { console.warn('satz session save failed:', e) }
  }} /></>
  if (screen === 'diary') return <>{homeFloat}<DiaryScreen user={user} myData={myData} setMyData={setMyData} partnerData={partnerData} lang={lang} theme={theme} onBack={() => setScreen('menu')} /></>
  if (screen === 'admin' && user.uid === MARK_UID) return <>{homeFloat}<AdminScreen user={user} myData={myData} lang={lang} theme={theme} onBack={() => setScreen('menu')} onCacheInvalidate={clearPoolCache} /></>
  if (screen === 'langprogress') return <>{homeFloat}<LanguageProgressScreen user={user} myData={myData} allCards={allCards} lang={lang} theme={theme} onBack={() => setScreen('menu')} /></>

  return (
    <div style={s.container} className="vocara-screen vocara-home-outer"><div style={{ ...s.homeBox, paddingTop: '12px' }} className="vocara-home-box">

      {/* ── LOGO ── */}
      <div className="vocara-logo-section" style={{ textAlign: 'center', paddingTop: '16px', paddingBottom: '10px' }}>
        <VocaraLogoSVG withSlogans={false} animate={false} isDE={isMarkLang} />
        <p className="vocara-logo-greeting" style={{ ...s.greeting, marginTop: '8px', marginBottom: uniqueTargetLangs.length > 0 ? '6px' : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
          {t.hello}, {firstName}
          {partnerActivityStatus && (
            <span style={{ fontSize: '0.72rem', color: partnerActivityStatus.color, fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              {partnerActivityStatus.dot} {partnerActivityStatus.label}
            </span>
          )}
        </p>
        {(() => {
          const fromFlag = LANG_FLAGS[lang] || ''
          const toLangCode = myData?.toLang || (lang === 'de' ? 'en' : 'de')
          const toFlag = LANG_FLAGS[toLangCode] || ''
          if (!fromFlag && !toFlag) return null
          return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.95rem' }}>{fromFlag}</span>
              <span style={{ color: th.sub, fontSize: '0.7rem', opacity: 0.6 }}>→</span>
              <span style={{ fontSize: '0.95rem' }}>{toFlag}</span>
            </div>
          )
        })()}
      </div>

      {/* ── MONTHLY TEST BANNER ── */}
      {testDue && (
        <button style={{ ...s.menuBtnWarning, marginBottom: '12px' }} onClick={() => setScreen('sprachpuls')}>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 'bold', color: '#f44336' }}>{t.monthlyTestBanner}</span>
            <span style={{ fontSize: '0.75rem', color: th.sub }}>{t.monthlyTestSub}</span>
          </span>
          <span style={{ color: '#f44336' }}>→</span>
        </button>
      )}

      {/* ── KI-TUTOR PANEL ── */}
      {coachMsg !== null && (
        <div style={{ background: `${th.card}bb`, border: `1px solid ${th.gold}33`, borderRadius: '14px', padding: '11px 15px', marginBottom: '12px', animation: 'vocaraFadeIn 0.4s ease both' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: tutorCollapsed ? 0 : '5px' }}>
            <span style={{ color: th.gold, fontSize: '0.62rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>🎓 {isMarkLang ? 'KI-Tutor' : 'AI Tutor'}{tutorCollapsed ? ' ▸' : ''}</span>
            {!tutorCollapsed && calcStreak(sessionHistory) > 0 && (
              <span style={{ color: th.sub, fontSize: '0.62rem', marginLeft: 'auto', opacity: 0.55 }}>🔥 {calcStreak(sessionHistory)} {isMarkLang ? 'Tage' : 'days'}</span>
            )}
            <button onClick={async () => {
              const next = !tutorCollapsed
              setTutorCollapsed(next)
              updateDoc(doc(db, 'users', user.uid), { tutorCollapsed: next }).catch(() => {})
            }} style={{ background: 'transparent', border: 'none', color: th.sub, cursor: 'pointer', fontSize: '0.75rem', padding: '0 0 0 8px', marginLeft: tutorCollapsed ? 'auto' : '8px', opacity: 0.6, WebkitTapHighlightColor: 'transparent' }}>
              {tutorCollapsed ? '＋' : '−'}
            </button>
          </div>
          {!tutorCollapsed && (
            <>
              {coachMsg
                ? <p style={{ color: th.text, fontSize: '0.84rem', fontStyle: 'italic', margin: 0, lineHeight: 1.55, opacity: 0.88 }}>{coachMsg}</p>
                : <p style={{ color: th.sub, fontSize: '0.8rem', margin: 0, opacity: 0.5 }}>…</p>
              }
              {coachMsg && tutorRecommendedArea && (
                <button onClick={() => {
                  if (tutorRecommendedArea === 'sentence') { startSatzSession() }
                  else if (tutorRecommendedArea === 'ki') { setScreen('ki') }
                  else if (tutorRecommendedArea === 'diary') { setScreen('diary') }
                  else { startCategorySession(tutorRecommendedArea) }
                }} style={{ marginTop: '8px', background: `${th.gold}18`, border: `1px solid ${th.gold}44`, color: th.gold, borderRadius: '20px', padding: '4px 12px', fontSize: '0.72rem', fontWeight: '700', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                  ▶ {isMarkLang ? 'Starten' : 'Start'}
                </button>
              )}
              {(() => {
                const todayDiaryDone = !!(myData?.diaryEntries?.find(e => e.date === todayStr()))
                if (!todayDiaryDone) return (
                  <button onClick={() => setScreen('diary')} style={{ marginTop: '6px', display: 'block', background: 'transparent', border: 'none', color: th.sub, fontSize: '0.7rem', cursor: 'pointer', padding: 0, opacity: 0.65, WebkitTapHighlightColor: 'transparent' }}>
                    📔 {isMarkLang ? 'Tagebuch heute noch offen' : 'Diary not written today'}
                  </button>
                )
                return null
              })()}
            </>
          )}
        </div>
      )}

      {/* ── STREAK WARNING ── */}
      {streakStatus === 'warning' && (
        <div style={{ background: 'rgba(255,165,0,0.10)', border: '1px solid rgba(255,165,0,0.45)', borderRadius: '14px', padding: '12px 14px', marginBottom: '12px', animation: 'vocaraFadeIn 0.4s ease both' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.1rem' }}>⚠️</span>
            <span style={{ color: '#FFA500', fontWeight: '700', fontSize: '0.9rem', flex: 1 }}>{isMarkLang ? 'Die Verbindung braucht dich heute.' : 'Your streak needs you today.'}</span>
            {freezeAvailable && (
              <button
                onClick={() => { if (window.confirm(isMarkLang ? 'Streak Freeze jetzt verwenden? (1x/Monat)' : 'Use Streak Freeze now? (1x/month)')) handleStreakFreeze() }}
                style={{ background: 'rgba(100,200,255,0.12)', border: '1px solid rgba(100,200,255,0.35)', color: '#7ec8e3', borderRadius: '20px', padding: '5px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700', whiteSpace: 'nowrap', flexShrink: 0 }}
              >🧊</button>
            )}
          </div>
          <button
            onClick={() => {
              const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)
              const quick = shuffle(activeCards.filter(c => cardProgress[c.id]?.nextReview <= today || !cardProgress[c.id])).slice(0, 5)
              if (quick.length === 0) return
              setCurrentSessionMode('all'); setSession(quick); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
            }}
            style={{ background: 'linear-gradient(135deg, rgba(255,165,0,0.25), rgba(255,165,0,0.12))', border: '1px solid rgba(255,165,0,0.5)', color: '#FFA500', borderRadius: '20px', padding: '8px 16px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: '700', width: '100%', fontFamily: 'inherit' }}
          >
            ⚡ {isMarkLang ? 'Jetzt lernen →' : 'Learn now →'} (5 {isMarkLang ? 'Karten' : 'cards'})
          </button>
        </div>
      )}
      {streakStatus === 'lost' && (
        <div style={{ background: 'rgba(136,136,136,0.1)', border: `1px solid ${th.border}`, borderRadius: '12px', padding: '10px 14px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: th.sub, fontWeight: '600', fontSize: '0.88rem' }}>{isMarkLang ? 'Streak verloren — neu starten! 💪' : 'Streak lost — start fresh! 💪'}</span>
        </div>
      )}

      {/* ── TAGES-KARTE ── */}
      {(() => {
        if (!dailyCard || dailyCardDismissed) return null
        const relEmoji = { couple: '💑', friends: '👫', family: '👨‍👩‍👧', colleagues: '👔' }[dailyCard.relType] || '✨'
        return (
          <div style={{ background: `${th.gold}0D`, border: `1px solid ${th.gold}2E`, borderRadius: '16px', padding: '13px 15px', marginBottom: '12px', animation: 'vocaraFadeIn 0.4s ease both', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
              <span style={{ color: th.gold, fontSize: '0.68rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                {relEmoji} {isMarkLang ? 'Karte des Tages' : 'Card of the day'}
              </span>
              <button onClick={() => setDailyCardDismissed(true)} style={{ background: 'transparent', border: 'none', color: th.sub, cursor: 'pointer', fontSize: '0.9rem', padding: '0 2px', lineHeight: 1 }}>✕</button>
            </div>
            <p style={{ color: th.text, fontWeight: '700', margin: '0 0 3px', fontSize: '0.92rem' }}>{dailyCard.front}</p>
            <p style={{ color: th.accent, fontWeight: '600', margin: '0 0 3px', fontSize: '1rem' }}>{dailyCard?.back}</p>
            {dailyCard.context && <p style={{ color: th.sub, fontSize: '0.75rem', fontStyle: 'italic', margin: 0, lineHeight: 1.4 }}>„{dailyCard.context}"</p>}
          </div>
        )
      })()}

      {/* ── SESSION RESUME DIALOG ── */}
      {resumeDialog && (
        <div style={{ ...s.resumeBanner, marginBottom: '12px' }}>
          <p style={{ color: th.text, margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: '600' }}>
            {t.resumeTitle}
          </p>
          <p style={{ color: th.sub, margin: '0 0 10px 0', fontSize: '0.8rem' }}>
            {(myData?.sessionProgress?.cardIds?.length || 0)} Karten bereits beantwortet
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ ...s.button, marginBottom: 0, flex: 1, padding: '10px' }} onClick={continueSession}>{t.resumeContinue}</button>
            <button style={{ ...s.logoutBtn, marginTop: 0, flex: 1, padding: '10px', textAlign: 'center' }} onClick={startFresh}>{t.resumeDiscard}</button>
          </div>
        </div>
      )}

      {/* ── PENDING SESSION BANNER ── */}
      {pendingSession && (
        <div style={{ ...s.resumeBanner, marginBottom: '12px' }}>
          <p style={{ color: th.text, margin: '0 0 10px 0', fontSize: '0.9rem' }}>
            {t.resumeTitle} — {pendingSession.index ?? '?'} {t.resumeOf} {pendingSession.queue?.length ?? '?'} {t.resumeCards}
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ ...s.button, marginBottom: 0, flex: 1, padding: '10px' }} onClick={resumeSession}>{t.resumeContinue}</button>
            <button style={{ ...s.logoutBtn, marginTop: 0, flex: 1, padding: '10px', textAlign: 'center' }} onClick={discardSession}>{t.resumeDiscard}</button>
          </div>
        </div>
      )}

      {/* ── 5-BUTTON GRID ── */}
      <div className="vocara-cat-grid" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="vocara-cat-btn" style={{ ...s.catBtn, '--gleam-delay': '0s', flexDirection: 'column', alignItems: 'center', opacity: catLoading ? 0.5 : 1 }} onClick={() => startCategorySession('vocabulary')} disabled={catLoading === 'vocabulary'}>
            <span>{catLoading === 'vocabulary' ? '⟳' : t.menuWorte.split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}</span>
            {catLoading !== 'vocabulary' && catLevelBar('vocabulary')}
          </button>
          <button className="vocara-cat-btn" style={{ ...s.catBtn, '--gleam-delay': '1.8s', flexDirection: 'column', alignItems: 'center', opacity: catLoading ? 0.5 : 1 }} onClick={() => startCategorySession('saetze')} disabled={catLoading === 'saetze'}>
            <span>{catLoading === 'saetze' ? '⟳' : t.menuSaetze.split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}</span>
            {catLoading !== 'saetze' && (() => {
              const _saetzePairs = getActiveLangPairs(myData)
              const lvl = _saetzePairs.length > 0
                ? Math.min(..._saetzePairs.map(lp => getCatLevel(myData?.categoryLevels, 'saetze', lp)))
                : 1
              return (
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', width: '100%', marginTop: '6px' }}>
                  <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.38)', fontWeight: '600', letterSpacing: '0.5px' }}>Lv {lvl}/14</span>
                </span>
              )
            })()}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="vocara-cat-btn" style={{ ...s.catBtn, '--gleam-delay': '3.5s', flexDirection: 'column', alignItems: 'center', opacity: catLoading ? 0.5 : 1 }} onClick={() => startCategorySession('street')} disabled={catLoading === 'street'}>
            <span>{catLoading === 'street' ? '⟳' : t.menuStraße.split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}</span>
            {catLoading !== 'street' && catLevelBar('street')}
          </button>
          <button className="vocara-cat-btn" style={{ ...s.catBtn, '--gleam-delay': '5.2s', flexDirection: 'column', alignItems: 'center', opacity: catLoading ? 0.5 : 1 }} onClick={() => startCategorySession('home')} disabled={catLoading === 'home'}>
            <span>{t.menuHause.split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}</span>
            {catLevelBar('home')}
          </button>
        </div>
        <button className="vocara-alle-btn" style={{ ...s.button, padding: '13px 28px', fontSize: '0.9rem', letterSpacing: '0.2px', marginBottom: 0, '--gleam-delay': '2.5s', opacity: catLoading ? 0.5 : 1 }} onClick={() => startCategorySession('all')} disabled={!!catLoading}>
          {catLoading === 'all' ? '⟳ Laden...' : t.menuAlle}
        </button>
        <button className="vocara-cat-btn" style={{ ...s.catBtn, '--gleam-delay': '6.8s', width: '100%', opacity: catLoading === 'grundlagen' ? 0.6 : 1, flexDirection: 'column', alignItems: 'center' }} onClick={startBasicsSession} disabled={catLoading === 'grundlagen'}>
          <span>{catLoading === 'grundlagen' ? '⟳' : (t.menuGrundlagen || 'Die\nGrundlagen').split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}</span>
          {catLoading !== 'grundlagen' && catLevelBar('grundlagen')}
        </button>
        <TutorialTooltip tutorialKey="grundlagen" title="Grundlagen" description="Lerne grundlegende Wörter — Zahlen, Farben, Pronomen. Level für Level aufbauend." myData={myData} setMyData={setMyData} user={user} th={th} s={s} />
        <button className="vocara-cat-btn" style={{ ...s.catBtn, '--gleam-delay': '8.2s', width: '100%', opacity: catLoading === 'urlaub' ? 0.6 : 1, flexDirection: 'column', alignItems: 'center' }} onClick={() => startCategorySession('urlaub')} disabled={catLoading === 'urlaub'}>
          <span>{catLoading === 'urlaub' ? '⟳' : '✈️ Urlaub'}</span>
          {catLoading !== 'urlaub' && catLevelBar('urlaub')}
        </button>
      </div>

      {/* ── KARTE BUTTON ── */}
      <button style={{ ...s.navBtn, marginBottom: karteMenu ? '2px' : '12px', fontSize: '0.9rem', fontWeight: '600', textAlign: 'center' }}
        onClick={() => setKarteMenu(m => !m)}>
        🃏 {isMarkLang ? 'Karte' : 'Card'} {karteMenu ? '▲' : '▼'}
      </button>
      {karteMenu && (
        <div style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: '14px', padding: '4px', marginBottom: '12px', animation: 'vocaraFadeIn 0.2s ease both' }}>
          <button style={{ ...s.navBtn, marginBottom: '2px', textAlign: 'left', paddingLeft: '16px' }} onClick={() => { setKarteMenu(false); setScreen('meinekarten') }}>
            📋 {isMarkLang ? 'Meine Karten' : 'My Cards'}
          </button>
          <button style={{ ...s.navBtn, marginBottom: '2px', textAlign: 'left', paddingLeft: '16px' }} onClick={() => { setKarteMenu(false); setScreen('karteerstellen') }}>
            ✏️ {isMarkLang ? 'Karte erstellen' : 'Create card'}
          </button>
          <button style={{ ...s.navBtn, marginBottom: 0, textAlign: 'left', paddingLeft: '16px', opacity: myData?.partnerUID ? 1 : 0.4 }}
            onClick={() => { if (!myData?.partnerUID) return; setKarteMenu(false); setScreen('geschenkkarte') }}>
            🎁 {isMarkLang ? 'Geschenkkarte senden' : 'Send gift card'}
          </button>
        </div>
      )}

      {/* ── MEINE THEMEN DROPDOWN ── */}
      <button style={{ ...s.navBtn, marginBottom: themenOpen ? '2px' : '12px', fontSize: '0.9rem', fontWeight: '600', textAlign: 'center' }}
        onClick={() => setThemenOpen(m => !m)}>
        🎯 {isMarkLang ? 'Meine Themen' : 'My Topics'} {themenOpen ? '▲' : '▼'}
      </button>
      {themenOpen && (
        <div style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: '14px', padding: '4px', marginBottom: '12px', animation: 'vocaraFadeIn 0.2s ease both' }}>
          {TOPICS_LIST.map(topic => {
            const topicLevel = myData?.topicLevels?.[topic.key] || 1
            const totalLevels = TOPIC_STRUCTURE[topic.key]?.totalLevels || 8
            const cardsPerLevel = TOPIC_STRUCTURE[topic.key]?.cardsPerLevel || 15
            const prefix = `${topic.key}_${topicLevel}_`
            const seenCount = Object.entries(cardProgress).filter(([id, p]) => id.startsWith(prefix) && p !== undefined && p !== null).length
            const pct = Math.min(100, Math.round((seenCount / cardsPerLevel) * 100))
            return (
              <button key={topic.key}
                onClick={() => { setThemenOpen(false); startTopicSession(topic.key) }}
                disabled={!!topicSessionLoading}
                style={{ ...s.navBtn, marginBottom: '2px', textAlign: 'left', paddingLeft: '16px', opacity: topicSessionLoading && topicSessionLoading !== topic.key ? 0.5 : 1, position: 'relative', overflow: 'hidden' }}>
                {topicSessionLoading === topic.key ? '…' : (
                  <>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span>{topic.emoji} {lang === 'de' ? topic.de : topic.en}</span>
                      <span style={{ fontSize: '0.68rem', fontWeight: '700', color: th.accent, opacity: 0.85, marginLeft: '8px', flexShrink: 0 }}>Lv{topicLevel}/{totalLevels}</span>
                    </span>
                    {pct > 0 && (
                      <span style={{ position: 'absolute', bottom: 0, left: 0, height: '2px', width: `${pct}%`, background: th.accent, borderRadius: '0 1px 1px 0', opacity: 0.5 }} />
                    )}
                  </>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* ── TÄGLICHES LERNZIEL ── */}
      <div style={{ marginBottom: '14px', padding: '0 2px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
          <span style={{ color: th.sub, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{isMarkLang ? 'Tagesziel' : 'Daily goal'}</span>
          <span style={{ color: todayCorrect >= dailyGoal ? th.accent : th.sub, fontSize: '0.7rem', fontWeight: todayCorrect >= dailyGoal ? '700' : '400' }}>
            {todayCorrect >= dailyGoal ? '✓ ' : ''}{todayCorrect} / {dailyGoal}
          </span>
        </div>
        <div style={{ height: '3px', background: th.border, borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, (todayCorrect / dailyGoal) * 100)}%`, background: todayCorrect >= dailyGoal ? th.accent : th.gold, borderRadius: '2px', transition: 'width 0.5s ease' }} />
        </div>
      </div>

      {/* ── TÄGLICHE MINIAUFGABE ── */}
      {miniTask && (
        <div style={{ background: th.card, border: `1px solid ${th.border}`, borderRadius: '14px', padding: '11px 13px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.68rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: miniTask.done ? '#4CAF50' : th.gold }}>
              {miniTask.done ? '✅' : '⚡'} {isMarkLang ? 'Aufgabe des Tages' : 'Task of the day'}
            </span>
          </div>
          {!miniTask.done ? (
            <>
              <p style={{ color: th.text, fontSize: '0.85rem', margin: '0 0 7px', lineHeight: 1.4 }}>
                {isMarkLang ? `Benutze „${miniTask.word}" in einem Satz:` : `Use "${miniTask.word}" in a sentence:`}
              </p>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: `1px solid ${th.border}`, borderRadius: '10px', padding: '8px 12px', color: th.text, fontSize: '0.83rem', outline: 'none', fontFamily: "'Inter', system-ui, sans-serif" }}
                  placeholder={isMarkLang ? 'Schreib deinen Satz…' : 'Write your sentence…'}
                  value={miniTaskInput}
                  onChange={e => setMiniTaskInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitMiniTask()}
                />
                <button
                  onClick={submitMiniTask}
                  disabled={!miniTaskInput.trim() || miniTaskLoading}
                  style={{ background: `${th.accent}22`, border: `1px solid ${th.accent}55`, color: th.text, borderRadius: '10px', padding: '8px 14px', cursor: miniTaskInput.trim() && !miniTaskLoading ? 'pointer' : 'default', fontSize: '0.82rem', fontWeight: '600', opacity: miniTaskLoading ? 0.6 : 1 }}
                >{miniTaskLoading ? '…' : '→'}</button>
              </div>
              {miniTask.feedback && <p style={{ color: '#81c784', fontSize: '0.75rem', margin: '6px 0 0', lineHeight: 1.4 }}>💡 {miniTask.feedback}</p>}
            </>
          ) : (
            <div>
              <p style={{ color: '#4CAF50', fontSize: '0.85rem', margin: 0, fontStyle: 'italic' }}>„{miniTask.answer}"</p>
              {miniTask.feedback && <p style={{ color: th.sub, fontSize: '0.75rem', margin: '4px 0 0', lineHeight: 1.4 }}>💡 {miniTask.feedback}</p>}
            </div>
          )}
        </div>
      )}

      {/* ── WOCHENZIEL DOTS ── */}
      <div className="vocara-dots-row" style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '20px', alignItems: 'flex-start' }}>
        {WEEK_AREAS.map(area => {
          const done = weeklyGoals.completed.includes(area.key)
          const active = dotTooltip === area.key
          return (
            <div key={area.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
              onClick={() => setDotTooltip(active ? null : area.key)}>
              <div style={{
                width: '22px', height: '22px', borderRadius: '50%',
                background: done ? '#00BFA5' : 'transparent',
                border: done ? 'none' : '2px solid rgba(180,180,200,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.3s ease',
                boxShadow: done ? '0 0 10px rgba(0,191,165,0.4)' : 'none',
                animation: done ? 'dotPop 0.4s ease both' : 'none',
                flexShrink: 0,
              }}>
                {done && <span style={{ color: '#fff', fontSize: '11px', fontWeight: '900', lineHeight: 1 }}>✓</span>}
              </div>
              <span style={{ fontSize: '8px', color: done ? '#00BFA5' : th.sub, fontWeight: done ? '700' : '400', textAlign: 'center', lineHeight: 1.2, maxWidth: '46px', transition: 'color 0.3s ease' }}>
                {lang === 'de' ? area.labelDe : area.labelEn}
              </span>
              {active && (
                <span style={{ fontSize: '7.5px', color: done ? '#4CAF50' : th.sub, textAlign: 'center', maxWidth: '60px', lineHeight: 1.3, padding: '3px 6px', background: th.card, border: `1px solid ${th.border}`, borderRadius: '6px', marginTop: '2px', animation: 'vocaraFadeIn 0.2s ease both' }}>
                  {done ? (isMarkLang ? '✓ Diese Woche geübt' : '✓ Practiced this week') : (lang === 'de' ? area.tipDe : area.tipEn)}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* ── GOLDEN CARDS COUNT (#20) ── */}
      {(() => {
        const goldenCount = Object.values(cardProgress).filter(p => p?.isGolden).length
        if (goldenCount === 0) return null
        return (
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={{ color: 'rgba(255,215,0,0.8)', fontSize: '0.78rem', fontWeight: '700', letterSpacing: '0.3px', animation: 'goldShimmer 2.4s ease-in-out infinite', display: 'inline-block', padding: '3px 10px', borderRadius: '20px', border: '1px solid rgba(255,215,0,0.28)', background: 'rgba(255,215,0,0.06)' }}>
              ⭐ {goldenCount} {isMarkLang ? 'goldene Karte' + (goldenCount !== 1 ? 'n' : '') + ' gemeistert' : `golden card${goldenCount !== 1 ? 's' : ''} mastered`}
            </span>
          </div>
        )
      })()}

      {/* ── SECONDARY NAVIGATION ── */}
      <div className="vocara-nav-section" style={{ marginTop: '4px', marginBottom: '10px' }}>
        <button className="vocara-nav-btn" style={s.navBtn} onClick={startSatzSession}>
          ✍️ {t.menuSatz}
        </button>
        <TutorialTooltip tutorialKey="satztraining" title="Satztraining" description="Grammatik-Übungen: Lückentext, Wortstellung und Zeitformen." myData={myData} setMyData={setMyData} user={user} th={th} s={s} />
        <button className="vocara-nav-btn" style={s.navBtn} onClick={() => setScreen('ki')}>{t.menuKi}</button>
        <button className="vocara-nav-btn" style={s.navBtn} onClick={() => setScreen('stats')}>
          {t.progressBtn}
          <span style={{ marginLeft: '6px', fontSize: '0.76rem', color: th.gold }}>
            {getLevelName(myMasteredCount, lang)}
          </span>
          {cefr && (
            <span style={{ marginLeft: '4px', fontFamily: 'monospace', fontSize: '0.75rem', color: CEFR_COLORS[cefr] || th.accent }}>
              · {cefr} {cefrBar} {cefrPct}%
            </span>
          )}
        </button>
        <button className="vocara-nav-btn" style={s.navBtn} onClick={() => setScreen('diary')}>
          📖 {isMarkLang ? 'Unser Tagebuch' : 'Our Diary'}
        </button>
        <button className="vocara-nav-btn" style={s.navBtn} onClick={() => setScreen('partner')}>
          {myData?.partnerUID ? `${t.menuPartnerLabel}: ${partnerName}` : t.menuPartnerConnect}
        </button>
        <button className="vocara-nav-btn" style={s.navBtn} onClick={() => setScreen('langprogress')}>🌍 {isMarkLang ? 'Meine Sprachen' : 'My Languages'}</button>
        <button className="vocara-nav-btn" style={s.navBtn} onClick={() => setScreen('settings')}>{t.menuSettings}</button>
        <button className="vocara-nav-btn" style={{ ...s.navBtn, marginBottom: 0 }} onClick={() => signOut(auth)}>{t.menuSignOut}</button>
      </div>

      <button style={s.legalBtn} onClick={() => setScreen('impressum')}>{t.impressumLink}</button>
      {user.uid === MARK_UID && (
        <button onClick={() => setScreen('admin')} style={{ background: 'transparent', border: 'none', color: th.sub, cursor: 'pointer', fontSize: '0.65rem', opacity: 0.3, padding: '2px 8px', display: 'block', width: '100%', textAlign: 'center', marginTop: '2px', fontFamily: "'Inter', system-ui, sans-serif" }}>
          ⚙ Admin
        </button>
      )}
      <button
        onClick={() => setScreen('impressum')}
        style={{ background: 'transparent', border: 'none', color: th.sub, cursor: 'pointer', fontSize: '0.68rem', opacity: 0.38, padding: '4px 8px', display: 'block', width: '100%', textAlign: 'center', marginTop: '2px', marginBottom: '6px', fontFamily: "'Inter', system-ui, sans-serif" }}
      >
        🇩🇪 Made in Germany · {APP_VERSION}
      </button>

      {stopToast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#2e7d32', color: '#fff', padding: '10px 20px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', zIndex: 1001, animation: 'vocaraFadeIn 0.3s ease both', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {stopToast}
        </div>
      )}
      {aiNotification && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: th.accent, color: '#111', padding: '10px 20px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', zIndex: 1000, animation: 'vocaraFadeIn 0.3s ease both', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {aiNotification}
        </div>
      )}
      {emptyCategoryMsg && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: th.card, color: th.text, border: `1px solid ${th.border}`, padding: '12px 20px', borderRadius: '16px', fontSize: '0.85rem', fontWeight: '500', zIndex: 1000, animation: 'vocaraFadeIn 0.3s ease both', maxWidth: '90vw', textAlign: 'center', pointerEvents: 'none' }}>
          {emptyCategoryMsg}
        </div>
      )}
      {weekGoalCelebration && (
        <div style={{ position: 'fixed', bottom: '80px', left: '50%', background: th.accent, color: '#111', padding: '14px 28px', borderRadius: '28px', fontSize: '1rem', fontWeight: 'bold', zIndex: 1000, animation: 'vocaraCelebrate 4.5s ease both', whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: `0 6px 28px ${th.glowColor}AA` }}>
          {t.weekGoalDone}
        </div>
      )}
      {monthlyUnlockNotification && (
        <div style={{ position: 'fixed', bottom: '130px', left: '50%', background: '#FFD700', color: '#111', padding: '14px 28px', borderRadius: '28px', fontSize: '1rem', fontWeight: 'bold', zIndex: 1001, animation: 'vocaraCelebrate 5s ease both', whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 6px 28px rgba(255,215,0,0.6)' }}>
          🎉 {lang === 'de' ? 'Monatsbonus freigeschaltet!' : 'Monthly bonus unlocked!'}
        </div>
      )}

      {/* ── GIMMICK FREISCHALTUNG POPUP ── */}
      {gimmickPopup && (() => {
        const gimmickContent = {
          hamburg: { emoji: '⚓', title: isMarkLang ? 'Hafen-Gimmick freigeschaltet!' : 'Harbor gimmick unlocked!', desc: isMarkLang ? 'Die Elbe rauscht. Du hast 5 Wochen durchgehalten.' : 'The harbor is yours. 5 weeks completed.', bg: 'linear-gradient(135deg, #0a1a2e, #1a3a5e)', border: '#4ECDC4' },
          nairobi: { emoji: '🌅', title: isMarkLang ? 'Savanna-Gimmick freigeschaltet!' : 'Savanna gimmick unlocked!', desc: isMarkLang ? 'Die Sonne über Nairobi. Deine Stimme trägt weiter.' : 'The savanna glows. Your voice carries further.', bg: 'linear-gradient(135deg, #2d1a00, #5a3800)', border: '#FFB347' },
          welt: { emoji: '🌌', title: isMarkLang ? 'Aurora-Gimmick freigeschaltet!' : 'Aurora gimmick unlocked!', desc: isMarkLang ? 'Ein Nordlicht für deine Sprache. 5 Wochen.' : 'Northern lights for your language. 5 weeks.', bg: 'linear-gradient(135deg, #0a001a, #1a003a)', border: '#B088F9' },
          lyon: { emoji: '🍷', title: isMarkLang ? 'Lyon-Gimmick freigeschaltet!' : 'Lyon gimmick unlocked!', desc: isMarkLang ? 'Burgunder und Gold. La langue s\'ouvre.' : 'Burgundy and gold. La langue s\'ouvre.', bg: 'linear-gradient(135deg, #1a0008, #3a0015)', border: '#D4A017' },
          sevilla: { emoji: '💃', title: isMarkLang ? 'Flamenco-Gimmick freigeschaltet!' : 'Flamenco gimmick unlocked!', desc: isMarkLang ? 'Der Rhythmus Sevillas. 5 Wochen tanzen.' : 'The rhythm of Sevilla. 5 weeks dancing.', bg: 'linear-gradient(135deg, #1a0500, #3a1000)', border: '#F39C12' },
          chiangmai: { emoji: '🪷', title: isMarkLang ? 'Chiang-Mai-Gimmick freigeschaltet!' : 'Chiang Mai gimmick unlocked!', desc: isMarkLang ? 'Lotus blüht. Die Stimme findet ihren Weg.' : 'Lotus blooms. The voice finds its way.', bg: 'linear-gradient(135deg, #0d0017, #200030)', border: '#CE93D8' },
        }
        const g = gimmickContent[theme] || gimmickContent.welt
        const themeAnim = {
          hamburg: (
            [1,2,3].map(i => (
              <div key={i} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: `linear-gradient(${20+i*8}deg, transparent 30%, rgba(255,215,0,${0.12+i*0.04}) 50%, transparent 70%)`, animation: `vocaraRayHamburg ${1.2+i*0.4}s ease ${i*0.3}s both`, pointerEvents: 'none' }} />
            ))
          ),
          nairobi: (
            [10,20,35,50,65,75,88,45].map((left, i) => (
              <div key={i} style={{ position: 'absolute', top: '-5%', left: `${left}%`, width: `${6+i%4*4}px`, height: `${6+i%4*4}px`, borderRadius: '50%', background: `rgba(255,${120+i*10},30,0.75)`, animation: `vocaraNairobiParticle ${1.2+i*0.18}s ease ${i*0.12}s both`, pointerEvents: 'none' }} />
            ))
          ),
          welt: (
            ['#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#C77DFF','#FF9F43'].map((c, i) => (
              <div key={i} style={{ position: 'absolute', top: '50%', left: '50%', width: '60vw', height: '60vw', marginTop: '-30vw', marginLeft: '-30vw', borderRadius: '50%', background: `radial-gradient(circle, ${c}44 0%, transparent 70%)`, animation: `vocaraAuroraWelt ${1.4+i*0.2}s ease ${i*0.15}s both`, pointerEvents: 'none' }} />
            ))
          ),
        }
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', animation: 'vocaraFadeIn 0.5s ease both', overflow: 'hidden' }}
            onClick={() => setGimmickPopup(false)}>
            {/* Theme-specific animation overlay */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              {themeAnim[theme] || null}
            </div>
            <div style={{ position: 'relative', zIndex: 1, background: g.bg, border: `2px solid ${g.border}`, borderRadius: '24px', padding: '32px 28px', maxWidth: '340px', width: '100%', textAlign: 'center', boxShadow: `0 0 60px ${g.border}55, 0 0 120px ${g.border}22`, animation: 'vocaraFadeIn 0.4s ease 0.15s both' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '12px', animation: 'vocaraCelebrate 1s ease both' }}>{g.emoji}</div>
              <p style={{ color: g.border, fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 8px' }}>🎉 {isMarkLang ? 'Gimmick freigeschaltet' : 'Gimmick unlocked'}</p>
              <p style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '700', margin: '0 0 10px', lineHeight: 1.3 }}>{g.title}</p>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem', fontStyle: 'italic', margin: '0 0 16px', lineHeight: 1.5 }}>{g.desc}</p>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem', margin: 0 }}>{isMarkLang ? 'Tippen zum Schließen' : 'Tap to close'}</p>
            </div>
          </div>
        )
      })()}

      {/* ── PARTNER ACTIVITY BANNER (elegant) ── */}
      {reactionPrompt && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 8900, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 20px', animation: 'vocaraFadeIn 0.4s ease both' }}>
          <div style={{ background: `${th.card}F0`, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: `1px solid ${th.border}`, width: '100%', maxWidth: '420px', padding: '14px 18px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ color: th.text, fontSize: '0.9rem', margin: 0 }}>
                <span style={{ fontWeight: '700' }}>{reactionPrompt.name}</span>
                {isMarkLang ? ` hat heute ${reactionPrompt.count} Karten gelernt.` : ` learned ${reactionPrompt.count} cards today.`}
              </p>
              <button onClick={() => { setReactionPrompt(null); setShowReplyInput(false); setReplyInput('') }}
                style={{ background: 'transparent', border: 'none', color: th.sub, cursor: 'pointer', fontSize: '1rem', padding: '0 0 0 10px', flexShrink: 0, WebkitTapHighlightColor: 'transparent' }}>✕</button>
            </div>
            {!showReplyInput ? (
              <button onClick={() => setShowReplyInput(true)}
                style={{ marginTop: '8px', background: 'transparent', border: 'none', color: th.gold, fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', padding: 0, WebkitTapHighlightColor: 'transparent' }}>
                ✨ {isMarkLang ? 'Antworten' : 'Reply'}
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', marginTop: '10px', borderBottom: `1px solid ${th.gold}66`, paddingBottom: '4px' }}>
                <input
                  autoFocus maxLength={20}
                  value={replyInput}
                  onChange={e => setReplyInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') sendPartnerMessage() }}
                  placeholder={isMarkLang ? `Schreib ${reactionPrompt.name} etwas…` : `Write something to ${reactionPrompt.name}…`}
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: th.text, fontSize: '0.88rem', padding: '2px 0', fontFamily: "'Inter', sans-serif" }}
                />
                <button onClick={sendPartnerMessage}
                  style={{ background: 'transparent', border: 'none', color: th.gold, cursor: 'pointer', fontSize: '1.1rem', padding: '0 4px', WebkitTapHighlightColor: 'transparent' }}>→</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── FLOATING INCOMING WHISPER ── */}
      {floatingMessage && (
        <div style={{ position: 'fixed', top: '14px', left: '50%', transform: 'translateX(-50%)', zIndex: 9200, pointerEvents: 'none', animation: 'vocaraFadeIn 0.5s ease both, vocaraFadeOut 1s ease 7s both', maxWidth: '90vw' }}>
          <div style={{ background: `${th.card}EE`, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${th.gold}44`, borderRadius: '22px', padding: '10px 20px', boxShadow: `0 4px 20px ${th.glowColor}33` }}>
            <p style={{ color: th.text, fontSize: '0.9rem', margin: 0, fontStyle: 'italic' }}>„{floatingMessage}"</p>
          </div>
        </div>
      )}

      {/* ── FLOATING RECEIVED REACTION ── */}
      {floatingReaction && (
        <div style={{ position: 'fixed', top: '22%', left: '50%', transform: 'translateX(-50%)', fontSize: '4rem', zIndex: 9100, pointerEvents: 'none', animation: 'vocaraCelebrate 3.5s ease both' }}>
          {floatingReaction}
        </div>
      )}

      {/* ── WORT DES TAGES BANNER ── */}
      {wordOfDayBanner && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 8800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'vocaraFadeIn 0.4s ease both' }}>
          <div style={{ background: th.card, border: `1px solid ${th.gold}44`, borderRadius: '22px', padding: '28px 24px', maxWidth: '340px', width: '100%', textAlign: 'center', boxShadow: `0 0 40px ${th.glowColor}33` }}>
            <p style={{ color: th.gold, fontSize: '0.72rem', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase', margin: '0 0 12px' }}>{isMarkLang ? "Heute's Wort" : "Word of the day"}</p>
            <p style={{ color: th.text, fontSize: '1.4rem', fontWeight: '700', margin: '0 0 6px' }}>{wordOfDayBanner.front}</p>
            <p style={{ color: th.accent, fontSize: '1rem', margin: '0 0 14px' }}>{wordOfDayBanner?.back}</p>
            <p style={{ color: th.sub, fontSize: '0.78rem', margin: 0, lineHeight: 1.5, fontStyle: 'italic' }}>
              {isMarkLang ? '— heute begegnet es dir überall.' : '— it will appear in every area today.'}
            </p>
          </div>
        </div>
      )}

      {/* ── GESCHENKKARTE POPUP ── */}
      {pendingGift && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(6px)' }}>
          <div style={{ background: th.card, border: `2px solid ${th.gold}66`, borderRadius: '24px', padding: '28px 24px', maxWidth: '360px', width: '100%', textAlign: 'center', boxShadow: `0 0 40px ${th.glowColor}44`, animation: 'vocaraFadeIn 0.4s ease both' }}>
            <p style={{ fontSize: '2.5rem', margin: '0 0 8px' }}>🎁</p>
            <p style={{ color: th.gold, fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '6px' }}>{isMarkLang ? `Geschenk von ${pendingGift.fromName}!` : `Gift from ${pendingGift.fromName}!`}</p>
            {pendingGift.message && <p style={{ color: th.sub, fontSize: '0.85rem', marginBottom: '10px', fontStyle: 'italic' }}>„{pendingGift.message}"</p>}
            <div style={{ background: th.bg, borderRadius: '14px', padding: '16px', margin: '10px 0', border: `1px solid ${th.border}` }}>
              <p style={{ color: th.text, fontWeight: 'bold', fontSize: '1.1rem', margin: '0 0 8px' }}>{pendingGift.front}</p>
              <div style={{ height: '1px', background: th.border, margin: '8px 0' }} />
              <p style={{ color: th.accent, fontWeight: 'bold', fontSize: '1.3rem', margin: 0 }}>{pendingGift?.back}</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={async () => {
                  const giftCard = { id: `gift_${Date.now()}`, front: pendingGift.front, back: pendingGift?.back, category: pendingGift.category || 'vocabulary', langA: pendingGift.langA || 'de', langB: pendingGift.langB || 'en', source: 'gift', sharedBy: pendingGift.fromName }
                  const updated = [...(myData?.aiCards || []), giftCard]
                  await updateDoc(doc(db, 'users', user.uid), { aiCards: updated, pendingGift: null, pendingGiftSeenDate: todayStr() }).catch(() => {})
                  setMyData(d => ({ ...d, aiCards: updated, pendingGift: null, pendingGiftSeenDate: todayStr() }))
                  setPendingGift(null)
                }}
                style={{ flex: 1, background: `${th.accent}25`, color: th.text, border: `1px solid ${th.accent}55`, borderRadius: '14px', padding: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem' }}>
                ➕ {isMarkLang ? 'Zum Deck' : 'Add to deck'}
              </button>
              <button
                onClick={async () => {
                  await updateDoc(doc(db, 'users', user.uid), { pendingGift: null, pendingGiftSeenDate: todayStr() }).catch(() => {})
                  setMyData(d => ({ ...d, pendingGift: null, pendingGiftSeenDate: todayStr() }))
                  setPendingGift(null)
                }}
                style={{ flex: '0 0 auto', background: 'rgba(255,255,255,0.06)', color: th.sub, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '12px 16px', cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ÜBERRASCHUNGSKARTE POPUP ── */}
      {surpriseCard && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(6px)' }}>
          <div style={{ background: th.card, border: `2px solid ${th.gold}66`, borderRadius: '24px', padding: '28px 24px', maxWidth: '360px', width: '100%', textAlign: 'center', boxShadow: `0 0 40px ${th.glowColor}44`, animation: 'vocaraFadeIn 0.4s ease both' }}>
            <p style={{ fontSize: '2.5rem', margin: '0 0 8px' }}>🎁</p>
            <p style={{ color: th.gold, fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '6px' }}>Überraschung von {surpriseCard.sharedBy}!</p>
            <div style={{ background: th.bg, borderRadius: '14px', padding: '18px', margin: '14px 0', border: `1px solid ${th.border}` }}>
              <p style={{ color: th.text, fontWeight: 'bold', fontSize: '1.1rem', margin: '0 0 8px' }}>{surpriseCard.front}</p>
              <div style={{ height: '1px', background: th.border, margin: '8px 0' }} />
              <p style={{ color: th.accent, fontWeight: 'bold', fontSize: '1.3rem', margin: 0 }}>{surpriseCard?.back}</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => dismissSurprise(true)} style={{ flex: 1, background: `${th.accent}25`, color: th.text, border: `1px solid ${th.accent}55`, borderRadius: '14px', padding: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem', backdropFilter: 'blur(8px)' }}>
                ➕ Zum Deck hinzufügen
              </button>
              <button onClick={() => dismissSurprise(false)} style={{ flex: '0 0 auto', background: 'rgba(255,255,255,0.06)', color: th.sub, border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '12px 16px', cursor: 'pointer', fontSize: '0.9rem', backdropFilter: 'blur(8px)' }}>
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div></div>
  )
}



export default MenuScreen
