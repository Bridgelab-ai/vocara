import React, { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { MARK_UID, ELOSY_UID, TOPICS_LIST, CARD_GEN_SYSTEM } from '../appShared'

function TopicUnlockSection({ myData, setMyData, user, t, s, th, lang }) {
  const isDE = lang === 'de'
  const unlockedTopics = myData?.unlockedTopics || []
  const myMasteredTotal = Object.values(myData?.cardProgress || {}).filter(p => (p?.interval || 0) >= 7).length
  const canUnlock = (user?.uid === MARK_UID || user?.uid === ELOSY_UID) || myMasteredTotal >= 5

  const [generatingTopic, setGeneratingTopic] = useState(null)

  const generateTopicCards = async (topic) => {
    setGeneratingTopic(topic.key)
    const langA = isDE ? 'en' : 'de'
    const langB = isDE ? 'de' : 'en'
    const fromLang = isDE ? 'German' : 'English'
    const toLang = isDE ? 'English' : 'German'
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6', max_tokens: 700, system: CARD_GEN_SYSTEM,
          messages: [{ role: 'user', content: `Generate 15 useful vocabulary cards about "${topic.de}" (${topic.en}) for a ${fromLang} speaker learning ${toLang}. Mix words and short phrases. Return ONLY JSON: [{"front":"${toLang} word","back":"${fromLang} translation","category":"vocabulary","tense":"present","wordType":"Noun|Verb|Adjective|Phrase","article":""}]` }]
        })
      })
      const raw = ((await res.json()).content?.[0]?.text || '[]').trim()
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
      const ts = Date.now()
      const newCards = parsed.slice(0, 15).map((c, i) => ({
        id: `topic_${topic.key}_${ts}_${i}`,
        front: c.front?.trim(), back: c?.back?.trim(),
        category: 'vocabulary', tense: 'present',
        wordType: c.wordType || null, article: c.article || null,
        langA, langB, source: `topic-${topic.key}`, topic: topic.key, createdAt: ts
      })).filter(c => c.front && c.back)
      const updatedCards = [...(myData?.aiCards || []), ...newCards]
      const updatedTopics = [...new Set([...unlockedTopics, topic.key])]
      await updateDoc(doc(db, 'users', user.uid), { aiCards: updatedCards, unlockedTopics: updatedTopics })
      setMyData(d => ({ ...d, aiCards: updatedCards, unlockedTopics: updatedTopics }))
    } catch (e) { console.warn('topic generate failed:', e) }
    setGeneratingTopic(null)
  }

  return (
    <div style={s.card}>
      <p style={{ ...s.cardLabel, marginBottom: '12px' }}>🎯 {t.myTopics}</p>
      <p style={{ color: th.sub, fontSize: '0.75rem', marginBottom: '12px', lineHeight: 1.4 }}>
        {t.topicsDesc}
        {!canUnlock && <span style={{ color: th.gold, display: 'block', marginTop: '4px' }}>{t.premiumOrMastered}</span>}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {TOPICS_LIST.map(topic => {
          const isUnlocked = unlockedTopics.includes(topic.key)
          const isGenerating = generatingTopic === topic.key
          return (
            <button key={topic.key} disabled={!canUnlock || isGenerating}
              onClick={() => !isUnlocked ? generateTopicCards(topic) : null}
              style={{ padding: '8px 12px', borderRadius: '12px', fontSize: '0.82rem', cursor: canUnlock && !isUnlocked ? 'pointer' : 'default', fontWeight: isUnlocked ? '700' : '400', background: isUnlocked ? `${th.gold}18` : canUnlock ? `${th.card}` : 'transparent', color: isUnlocked ? th.gold : canUnlock ? th.text : th.sub, border: `1px solid ${isUnlocked ? th.gold + '55' : canUnlock ? th.border : 'rgba(255,255,255,0.08)'}`, opacity: !canUnlock && !isUnlocked ? 0.45 : 1, transition: 'all 0.2s' }}>
              {isGenerating ? '…' : isUnlocked ? '✓ ' : canUnlock ? '' : ''}{isDE ? topic.de : topic.en}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default TopicUnlockSection
