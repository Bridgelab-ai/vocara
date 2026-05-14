import React from 'react'

function ResultScreen({ correct, wrong, fast, easy, weakestCard, strongestCard, masteryUnlocked, t, lang, onBack, onReplay, s, th }) {
  const isMarkLang = lang === 'de'
  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <h1 style={s.title}>{t.done} 🎉</h1>
      {masteryUnlocked && <div style={{ ...s.card, borderLeft: '3px solid #4CAF50' }}><p style={{ color: '#4CAF50', margin: 0, fontSize: '0.85rem' }}>{t.masteryMsg}</p></div>}
      <div style={s.card}>
        <div style={s.langRow}><span style={s.lang}>❌ {t.wrong}</span><span style={{ ...s.langPct, color: '#e06c75' }}>{wrong}</span></div>
        {fast > 0 && <div style={s.langRow}><span style={s.lang}>😕 {t.fast}</span><span style={{ ...s.langPct, color: '#FFA500' }}>{fast}</span></div>}
        <div style={s.langRow}><span style={s.lang}>✅ {t.correct}</span><span style={{ ...s.langPct, color: '#4CAF50' }}>{correct}</span></div>
        {easy > 0 && <div style={s.langRow}><span style={s.lang}>⚡ Easy</span><span style={{ ...s.langPct, color: th?.gold || '#FFD700' }}>{easy}</span></div>}
      </div>
      {(weakestCard || strongestCard) && (
        <div style={s.card}>
          {weakestCard && (
            <div style={{ marginBottom: strongestCard ? '14px' : 0 }}>
              <p style={{ ...s.cardLabel, marginBottom: '5px', color: '#e06c75' }}>⚠️ {isMarkLang ? 'Schwächste Karte' : 'Weakest card'}</p>
              <p style={{ color: th?.text || '#fff', fontSize: '0.9rem', margin: 0, fontWeight: '500' }}>{weakestCard.front}</p>
              <p style={{ color: th?.sub || '#888', fontSize: '0.8rem', margin: '2px 0 0' }}>{weakestCard?.back}</p>
            </div>
          )}
          {strongestCard && (
            <div>
              <p style={{ ...s.cardLabel, marginBottom: '5px', color: '#4CAF50' }}>⚡ {isMarkLang ? 'Stärkste Karte' : 'Strongest card'}</p>
              <p style={{ color: th?.text || '#fff', fontSize: '0.9rem', margin: 0, fontWeight: '500' }}>{strongestCard.front}</p>
              <p style={{ color: th?.sub || '#888', fontSize: '0.8rem', margin: '2px 0 0' }}>{strongestCard?.back}</p>
            </div>
          )}
        </div>
      )}
      {onReplay && (
        <button style={{ ...s.button, marginBottom: '8px' }} onClick={onReplay}>
          🔁 {isMarkLang ? 'Nochmal' : 'Again'}
        </button>
      )}
      <button style={{ background: 'transparent', color: th?.sub || '#888', border: `1px solid ${th?.border || '#333'}`, padding: '12px 28px', borderRadius: '50px', fontSize: '0.95rem', cursor: 'pointer', fontWeight: '600', width: '100%' }} onClick={onBack}>
        {isMarkLang ? 'Fertig' : 'Done'}
      </button>
    </div></div>
  )
}

export default ResultScreen
