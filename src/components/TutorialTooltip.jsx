import React, { useEffect } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'

function TutorialTooltip({ tutorialKey, title, description, myData, setMyData, user, th, s }) {
  const alreadySeen = !myData || (myData?.seenTutorials || []).includes(tutorialKey)

  // All side-effects must live here — never in the render body.
  // No auto-write: Firestore + setMyData are called only on dismiss click.
  useEffect(() => {
    if (alreadySeen) return
  }, [alreadySeen])

  if (alreadySeen) return null

  const dismiss = async () => {
    const updated = [...(myData.seenTutorials || []), tutorialKey]
    setMyData(d => ({ ...d, seenTutorials: updated }))
    if (user?.uid) {
      await updateDoc(doc(db, 'users', user.uid), { seenTutorials: updated })
    }
  }

  const accent = th?.accent || '#00D4AA'
  return (
    <div style={{
      background: `${accent}12`,
      border: `1px solid ${accent}55`,
      borderRadius: '12px',
      padding: '10px 14px',
      marginTop: '6px',
      marginBottom: '2px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      animation: 'vocaraFadeIn 0.25s ease both',
    }}>
      <span style={{ fontSize: '1rem', marginTop: '2px', flexShrink: 0 }}>💡</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <p style={{ color: th?.text || '#fff', fontSize: '0.82rem', fontWeight: '700', margin: '0 0 3px' }}>{title}</p>}
        <p style={{ color: th?.sub || '#aaa', fontSize: '0.78rem', margin: 0, lineHeight: 1.45 }}>{description}</p>
      </div>
      <button
        onClick={dismiss}
        style={{
          background: accent,
          border: 'none',
          color: '#111',
          fontSize: '0.7rem',
          cursor: 'pointer',
          padding: '4px 10px',
          borderRadius: '8px',
          flexShrink: 0,
          fontWeight: '700',
          whiteSpace: 'nowrap',
          WebkitTapHighlightColor: 'transparent',
        }}
      >✕ Schließen</button>
    </div>
  )
}

export default TutorialTooltip
