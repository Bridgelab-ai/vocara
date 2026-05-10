import React from 'react'
import { THEMES, makeStyles } from '../theme'
import { T } from '../translations'

function ImpressumScreen({ lang, theme, onBack }) {
  const th = THEMES[theme]; const s = makeStyles(th); const t = T[lang]
  const p = () => ({ color: th.sub, fontSize: '0.85rem', lineHeight: '1.7', margin: '0 0 10px 0' })
  return (
    <div style={s.container} className="vocara-screen"><div style={{ ...s.homeBox, textAlign: 'left' }}>
      <button style={s.backBtn} onClick={onBack}>← {t.back}</button>
      <h2 style={{ color: th.gold, fontSize: '1.2rem', marginBottom: '4px' }}>{t.impressumTitle}</h2>
      <div style={s.card}>
        <p style={p()}>Angaben gemäß § 5 TMG</p>
        <p style={{ ...p(), color: th.text, fontWeight: '500' }}>Mark Reimer<br />Winsener Str. 145<br />21077 Hamburg</p>
        <p style={p()}>E-Mail: mark.reimer@mail.de</p>
        <p style={{ ...p(), fontSize: '0.75rem' }}>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV: Mark Reimer, Anschrift wie oben.</p>
      </div>
      <h2 style={{ color: th.gold, fontSize: '1.2rem', margin: '20px 0 4px 0' }}>{t.datenschutzTitle}</h2>
      <div style={s.card}>
        <p style={{ color: th.sub, fontSize: '0.8rem', fontWeight: 'bold', margin: '0 0 4px 0' }}>Verantwortlicher</p>
        <p style={p()}>Mark Reimer, Winsener Str. 145, 21077 Hamburg<br />E-Mail: mark.reimer@mail.de</p>
        <p style={{ color: th.sub, fontSize: '0.8rem', fontWeight: 'bold', margin: '0 0 4px 0' }}>Gespeicherte Daten</p>
        <p style={p()}>• Google-Konto Name und E-Mail-Adresse (Login)<br />• Lernfortschritt und Karteikarten-Statistiken<br />• Theme-Einstellung und Sprachpräferenzen</p>
        <p style={{ color: th.sub, fontSize: '0.8rem', fontWeight: 'bold', margin: '0 0 4px 0' }}>Speicherort</p>
        <p style={p()}>Alle Daten werden in Google Firebase (EU-Server, Frankfurt) gespeichert. Es erfolgt keine Weitergabe an Dritte.</p>
        <p style={{ color: th.sub, fontSize: '0.8rem', fontWeight: 'bold', margin: '0 0 4px 0' }}>Ihre Rechte</p>
        <p style={p()}>Sie haben das Recht auf Auskunft, Löschung und Berichtigung Ihrer Daten. Anfragen per E-Mail an: mark.reimer@mail.de</p>
        <p style={{ color: th.sub, fontSize: '0.8rem', fontWeight: 'bold', margin: '0 0 4px 0' }}>Cookies</p>
        <p style={{ ...p(), marginBottom: 0 }}>Vocara verwendet keine Tracking-Cookies.</p>
      </div>
      <h2 style={{ color: th.gold, fontSize: '1.2rem', margin: '20px 0 4px 0' }}>KI-Disclaimer</h2>
      <div style={s.card}>
        <p style={p()}>Vocara verwendet Künstliche Intelligenz (KI) für die Generierung von Lernkarten, Aussprachehinweisen, Grammatikfeedback und Gesprächsübungen. Die KI-generierten Inhalte können Fehler enthalten und ersetzen keinen professionellen Sprachunterricht.</p>
        <p style={p()}>KI-Antworten werden durch die Claude API von Anthropic bereitgestellt. Inhalte werden nicht dauerhaft auf KI-Servern gespeichert. Nutzereingaben im KI-Gespräch werden ausschließlich zur Generierung der jeweiligen Antwort verwendet.</p>
        <p style={{ ...p(), marginBottom: 0 }}>Sprachliche Korrektheit: Obwohl die KI-Inhalte sorgfältig generiert werden, übernimmt Bridgelab keine Haftung für etwaige Fehler in den KI-generierten Texten.</p>
      </div>
      <h2 style={{ color: th.gold, fontSize: '1.2rem', margin: '20px 0 4px 0' }}>Haftungsausschluss</h2>
      <div style={s.card}>
        <p style={p()}>Die Nutzung von Vocara erfolgt auf eigene Verantwortung. Bridgelab übernimmt keine Haftung für Schäden, die durch die Nutzung der App entstehen könnten.</p>
        <p style={{ ...p(), marginBottom: 0 }}>Externe Links: Für Inhalte externer Webseiten, auf die Vocara verlinkt, übernimmt Bridgelab keine Haftung. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft.</p>
      </div>
      <h2 style={{ color: th.gold, fontSize: '1.2rem', margin: '20px 0 4px 0' }}>Nutzerinhalte (UGC)</h2>
      <div style={s.card}>
        <p style={p()}>Nutzer können eigene Lernkarten, Tagebucheinträge und Kommentare erstellen. Diese Inhalte werden in der persönlichen Firebase-Datenbank des Nutzers gespeichert und sind nur für verbundene Partner sichtbar.</p>
        <p style={{ ...p(), marginBottom: 0 }}>Bridgelab ist nicht verantwortlich für die von Nutzern erstellten Inhalte. Nutzer sind verpflichtet, keine rechtswidrigen, beleidigenden oder urheberrechtlich geschützten Inhalte einzustellen.</p>
      </div>
      <h2 style={{ color: th.gold, fontSize: '1.2rem', margin: '20px 0 4px 0' }}>Jugendschutz (COPPA)</h2>
      <div style={s.card}>
        <p style={{ ...p(), marginBottom: 0 }}>Vocara richtet sich nicht an Kinder unter 13 Jahren. Wir erheben wissentlich keine personenbezogenen Daten von Kindern unter 13 Jahren. Wenn Sie glauben, dass ein Kind unter 13 Jahren Daten übermittelt hat, kontaktieren Sie uns bitte unter mark.reimer@mail.de.</p>
      </div>
      <button style={s.button} onClick={onBack}>{t.back}</button>
    </div></div>
  )
}

export default ImpressumScreen
