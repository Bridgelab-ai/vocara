import React, { useState, useEffect } from 'react'
import { db } from '../firebase'
import { doc, updateDoc, getDoc } from 'firebase/firestore'
import { THEMES, makeStyles } from '../theme'
import { T } from '../translations'

function PartnerScreen({ user, myData, lang, theme, onBack, onPartnerUpdate }) {
  const th = THEMES[theme]; const s = makeStyles(th); const t = T[lang]
  const [codeInput, setCodeInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState('')
  const [pendingData, setPendingData] = useState(null)
  const inviteLink = `${window.location.origin}?invite=${user.uid}`
  const myInviteCode = user.uid.slice(0, 8).toUpperCase()
  const hasPartner = !!myData?.partnerUID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const inviteUID = params.get('invite')
    if (inviteUID && inviteUID !== user.uid && !hasPartner) {
      getDoc(doc(db, 'users', inviteUID)).then(snap => { if (snap.exists()) setPendingData({ uid: inviteUID, ...snap.data() }) })
    }
  }, [])
  const copyLink = () => { navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  const connectByCode = async () => {
    const code = codeInput.trim().toUpperCase()
    if (code.length < 6) return; setStatus('Suche...')
    try {
      const snap = await getDoc(doc(db, 'inviteCodes', code))
      if (!snap.exists()) { setStatus('Code nicht gefunden.'); return }
      await acceptConnection(snap.data().uid)
    } catch { setStatus('Fehler.') }
  }
  const acceptConnection = async (partnerUID) => {
    const partnerSnap = await getDoc(doc(db, 'users', partnerUID))
    const partnerName = partnerSnap.exists() ? partnerSnap.data().name : 'Partner'
    await updateDoc(doc(db, 'users', user.uid), { partnerUID, partnerName })
    await updateDoc(doc(db, 'users', partnerUID), { partnerUID: user.uid, partnerName: user.displayName })
    onPartnerUpdate(partnerUID); setPendingData(null); window.history.replaceState({}, '', window.location.pathname)
  }
  const disconnect = async () => {
    if (!window.confirm('Partner wirklich trennen?')) return
    const partnerUID = myData.partnerUID
    await updateDoc(doc(db, 'users', user.uid), { partnerUID: null, partnerName: null })
    if (partnerUID) { try { await updateDoc(doc(db, 'users', partnerUID), { partnerUID: null, partnerName: null }) } catch {} }
    onPartnerUpdate(null)
  }
  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>← {t.back}</button>
      <h2 style={{ color: th.gold, fontSize: '1.3rem', marginBottom: '20px' }}>{t.partnerTitle}</h2>
      {pendingData && (
        <div style={s.infoBox}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>{pendingData.name} möchte sich verbinden</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ ...s.rightBtn, flex: 1, padding: '10px' }} onClick={() => acceptConnection(pendingData.uid)}>{t.partnerAccept}</button>
            <button style={{ ...s.wrongBtn, flex: 1, padding: '10px' }} onClick={() => { setPendingData(null); window.history.replaceState({}, '', window.location.pathname) }}>{t.partnerDecline}</button>
          </div>
        </div>
      )}
      {hasPartner ? (
        <div style={s.card}>
          <p style={s.cardLabel}>{t.partnerConnected}</p>
          <p style={{ color: th.text, margin: '0 0 12px 0', fontWeight: 'bold' }}>{myData.partnerName || 'Partner'}</p>
          <button style={{ ...s.logoutBtn, color: '#f44336', borderColor: '#f44336' }} onClick={disconnect}>{t.partnerDisconnect}</button>
          {/* Mehrere Partner — Premium/Pro */}
          <div style={{ marginTop: '12px', padding: '10px 12px', background: `${th.gold}08`, border: `1px solid ${th.gold}22`, borderRadius: '10px' }}>
            <p style={{ color: th.sub, fontSize: '0.78rem', margin: '0 0 6px' }}>{lang === 'de' ? '👥 Mehrere Partner:' : '👥 Multiple partners:'}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.45 }}>
                <span style={{ color: th.sub, fontSize: '0.75rem' }}>＋ {lang === 'de' ? 'Weiteren verbinden' : 'Connect another'}</span>
                <span style={{ background: `${th.gold}18`, color: th.gold, border: `1px solid ${th.gold}44`, borderRadius: '8px', padding: '1px 7px', fontSize: '0.65rem', fontWeight: '700' }}>Premium</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.3 }}>
                <span style={{ color: th.sub, fontSize: '0.75rem' }}>＋＋ {lang === 'de' ? 'Bis zu 5 Partner' : 'Up to 5 partners'}</span>
                <span style={{ background: 'rgba(200,200,255,0.1)', color: '#aaa', border: '1px solid rgba(200,200,255,0.2)', borderRadius: '8px', padding: '1px 7px', fontSize: '0.65rem', fontWeight: '700' }}>Pro</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div style={s.card}>
            <p style={s.cardLabel}>{t.partnerInvite}</p>
            <p style={{ color: th.sub, fontSize: '0.75rem', wordBreak: 'break-all', marginBottom: '8px' }}>{inviteLink}</p>
            <button style={s.button} onClick={copyLink}>{copied ? t.partnerCopied : t.partnerCopy}</button>
            <p style={{ color: th.sub, fontSize: '0.8rem', marginTop: '8px' }}>Dein Code: <strong style={{ color: th.gold }}>{myInviteCode}</strong></p>
          </div>
          <div style={s.card}>
            <p style={s.cardLabel}>{t.partnerCode}</p>
            <input style={s.input} placeholder="Code..." value={codeInput} onChange={e => setCodeInput(e.target.value.toUpperCase())} maxLength={8} />
            <button style={s.button} onClick={connectByCode}>{t.partnerConnect}</button>
            {status && <p style={{ color: th.accent, fontSize: '0.85rem', margin: '4px 0 0 0' }}>{status}</p>}
          </div>
        </>
      )}
    </div></div>
  )
}

export default PartnerScreen
