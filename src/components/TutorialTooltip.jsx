import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'

function TutorialTooltip({ tutorialKey, title, description, myData, setMyData, user, th, s }) {
  if (!myData || (myData.seenTutorials || []).includes(tutorialKey)) return null

  const dismiss = async () => {
    const updated = [...(myData.seenTutorials || []), tutorialKey]
    setMyData(d => ({ ...d, seenTutorials: updated }))
    if (user?.uid) {
      await updateDoc(doc(db, 'users', user.uid), { seenTutorials: updated })
    }
  }

  return (
    <div style={{
      background: th?.card || '#1e2a38',
      border: `1px solid ${th?.border || 'rgba(255,255,255,0.1)'}`,
      borderRadius: '12px',
      padding: '10px 14px',
      marginTop: '6px',
      marginBottom: '2px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      animation: 'vocaraFadeIn 0.25s ease both',
    }}>
      <span style={{ fontSize: '1rem', marginTop: '1px', flexShrink: 0 }}>💡</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <p style={{ color: th?.text || '#fff', fontSize: '0.82rem', fontWeight: '700', margin: '0 0 3px' }}>{title}</p>}
        <p style={{ color: th?.sub || '#aaa', fontSize: '0.78rem', margin: 0, lineHeight: 1.45 }}>{description}</p>
      </div>
      <button
        onClick={dismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: th?.sub || '#aaa',
          fontSize: '0.75rem',
          cursor: 'pointer',
          padding: '2px 6px',
          borderRadius: '6px',
          flexShrink: 0,
          fontWeight: '600',
          WebkitTapHighlightColor: 'transparent',
        }}
      >✓</button>
    </div>
  )
}

export default TutorialTooltip
