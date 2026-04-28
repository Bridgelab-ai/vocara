# Vocara — Vollständige Strategie & Vision 2026+
by Bridgelab | Stand: April 2026

## 1. Marktanalyse & Wettbewerb

### Konkurrenten & Schwächen
- Duolingo: Gamification-Spam, keine echte KI-Konversation, keine Paar-Features, oberflächlich
- Babbel: Statische Kurse, teuer, keine Personalisierung, kein Partner-Sync
- AI-Lerna/Ailearn: Keine Paar-Features, kein bidirektionales Lernen
- Coupling (couplingcafe.com): Klein, keine KI, kein bidirektionales Lernen, ~110 Downloads/Monat

### Vocara Alleinstellungsmerkmale
- Bidirektionales Lernen: beide Partner lernen gleichzeitig
- Echter Partner-Sync in Echtzeit
- KI-Gespräch mit Übersetzungs-Button
- Personalisierte Karten mit eigenem Städte-Kontext (Hamburg/Nairobi)
- Keine Werbung — niemals
- 3 einzigartige Themes mit eigenem emotionalem Kontext

## 2. Free vs Premium — Klare Linie

### Free
- 3 Themes (Hamburg, Nairobi, Welt)
- Meine Worte + werden Sätze
- 1 Partner
- Basis-Karten aus Pool (kuratiert)
- Max 15 Karten/Session
- KI-Gespräch 3x/Woche

### Premium (2,99€/Monat)
- Alle 5 Lernbereiche
- Unbegrenzte KI-Sessions
- Bis 3 Partner
- Slang/Auf der Straße
- Vollständige Statistiken
- Karten-Kommentare
- Streak Freeze 1x/Monat

### Pro (5,99€/Monat)
- Bis 5 Partner
- ElevenLabs Premium-Stimmen
- Video-Moment teilen
- Familien-Version
- Priorität-Support

### Auswanderer-Edition
- 14,99€ einmalig oder 2,99€/Monat
- Wohnungssuche, Bewerbung, Behörden, Formulare, ÖPNV, Banking

## 3. Karten-Pool System (KI-Kosten minimieren)

### Dreistufiges System
1. Basis-Pool: Kuratierte Karten höchstes Niveau (einmalig erstellt, für alle Nutzer)
2. Wöchentlicher Auto-Pool: Vercel Cron Job sonntags nachts, unsichtbar für User
   - Schreibt neue Karten in sharedCards/{langPair}/{week}
   - Niemand bemerkt es
3. Personalisierte KI: Nur wenn Pool leer ODER User zu fortgeschritten (ab B2/Nairobi-Kenner)

### Spart ~85% KI-Kosten

### Karten-Standard für ALLE Sprachen
- Jedes Sprachpaar bekommt eigenen kuratierten Basis-Pool
- Immer höchstes linguistisches Niveau — nie wörtliche Übersetzungen
- Native Speaker Qualität
- Phonetik, Kontext, Register-Info
- Zeitformen-Progression (Präsens zuerst)
- Soziales Register (Kumpel/Liebe/Kollege/Familie)
- Improvisation wenn vorgefertigte Karten nicht ausreichen

### Sprachen-Reihenfolge
1. DE→EN (verfeinern)
2. DE→SW (verfeinern)
3. EN→DE (Elosy)
4. DE→ES + DE→FR (nächste Phase)
5. Alle anderen Kombinationen

## 4. Lernmethodik (wissenschaftlich fundiert)

### 4-Button System
- Falsch: Position 5, Session endet nicht bis Fast
- Fast: Position 5, nächste Session wieder
- Richtig: 3x consecutiveRight = skip one, 5x = skip two
- Easy: +5/10/21 Tage. 5x = GEMEISTERT
- Gemeistert: +30/60/90/180 dann alle 180 Tage

### Soziales Register (aus PDF-Konzept)
- Kumpel: Slang und Ellipsen
- Große Liebe: emotionale Adjektive, sanfte Tonlage
- Kollege: Konjunktive, Höflichkeitsfloskeln
- Familie: Mix aus Intimität und informellem Standard

### Zeitformen Stufen-System (aus PDF-Konzept)
- Präsens zuerst meistern
- Dann Vergangenheit freischalten
- Dann Zukunft freischalten
- Jede Karte zeigt Zeitform als Info-Tag

### Kategorien
- Meine Worte
- werden Sätze
- Auf der Straße (Slang)
- und zu Hause (Romantik/Familie)
- Grundlagen (Farben, Zahlen, Formen)
- Urlaub (NEU: Hotel, Flughafen, Restaurant, Notfälle)

## 5. KI-Features (überragend)

### Bereits implementiert
- KI-Gespräch (Claude Haiku)
- KI-Kartengenerierung (Claude Sonnet)
- KI-Tutor Banner mit Start-Button
- Fehler-Muster Analyse
- Aussprache-Score 0-100%

### Geplant
- Soziales Register: Kumpel/Liebe/Kollege/Familie Modus
- Zeitformen Stufen-System
- KI-Tank Energie-Balken (macht Serverkosten transparent)
- Wissens-Landkarte / Insel-System (visuell)
- Shared Memory: KI liest Tagebuch und baut daraus Karten
- KI-Persönlichkeiten: Bro / Diplomatin / Professor
- Sokratischer Tutor: Hinweise statt sofort auflösen
- Kontextwechsel: gleiche Karte formell/informell/romantisch
- Sprachrhythmus-Training

## 6. Paar & Social Features

### Implementiert
- Partner-Sync
- Gemeinsames Tagebuch
- Karten senden mit Geschenk-Badge
- Partner-Aktivitäts-Indikator

### Geplant
- Synchrones Lernen live
- Video-Moment teilen
- Partner-Challenge wöchentlich
- Liebes-Karte des Tages (relationshipType: Paar/Freunde/Familie/Kollegen)
- Emoji-Reaktionen auf Partner-Fortschritt

## 7. Design & Visuelle Identität

### Themes (NUR 3)
- Hamburg: Silber/Stahl, nordisch, Hafenmorgen
- Nairobi: Gold/Schwarz NUR (kein Rot, kein Orange)
- Welt: Indigo/Aurora

### Logo
- Vocara Logo: Kabelbrücke + goldener Bogen + Wasserspiegelung (von Gemini erstellt)
- Mix-blend-mode: screen für transparenten Hintergrund
- In App: nur Logo ohne Slogans (kompakt)
- Im Bridgelab Menü: Logo mit beiden Slogans

### Geplant
- 3D Glassmorphism Buttons mit Gyroscope-Effekt
- Karten-Wegfliege-Animation
- Gimmik-Animationen themenspezifisch
- Jahreszeiten-Themes
- Tageszeit-Anpassung (morgens heller, abends wärmer)
- Haptisches Feedback
- Eigene Bridgelab-Icons

## 8. Audio
- Phase 1: 3 Mubert-Tracks kostenlos (1 pro Theme), GEMA-frei
- Phase 2: Mubert Business API oder professionelle Komponisten

## 9. Rechtliches & Compliance
- Impressum: §5 TMG
- DSGVO-konforme Datenschutzerklärung
- KI-Disclaimer: "KI-Inhalte können Fehler enthalten"
- Haftungsausschluss: kein Lernerfolg garantiert
- UGC-Disclaimer
- COPPA: keine Kinder unter 13
- Stripe: AGB, Widerrufsrecht 14 Tage
- DPMA Trademark "Vocara" vor Public Launch (~300€)

## 10. Technischer Stack
- React/Vite PWA
- Firebase Auth + Firestore
- Vercel Serverless (api/chat.js)
- Claude Haiku 4.5 (KI-Gespräch)
- Claude Sonnet (Kartengenerierung)
- Web Speech API (TTS)
- ElevenLabs (geplant, Premium)
- Stripe (geplant)
- Mubert (Audio, Phase 1 kostenlos)
- Repo: github.com/Bridgelab-ai/vocara
- Deploy: vocara-peach.vercel.app

## 11. Roadmap 2026

### Q2 (jetzt)
- Basis-Karten Pool kuratieren
- Free/Premium Linie implementieren
- Wöchentlicher Cron-Job Auto-Pool
- Lernzeit Partner-Vergleich
- Urlaub Kategorie

### Q3
- Stripe Integration
- ElevenLabs Premium
- Spanisch + Französisch
- Soziales Register
- DPMA Trademark

### Q4
- App Store (PWA → Native)
- Bridgelab Hub Integration
- Marketing-Start

### 2027
- Wissens-Landkarte
- Shared Memory KI
- Gehirn-App Launch

## 12. Offene Features (priorisiert)

### Kritisch
- Lernzeit Partner-Vergleich (Woche/Monat/Gesamt)
- Urlaub als Kategorie
- Free/Premium Linie im Code umsetzen

### Wichtig
- Wöchentlicher Auto-Pool (Cron Job)
- Soziales Register
- Zeitformen Stufen-System
- Musik (Mubert Phase 1)

### Nice-to-have
- Video-Moment
- KI-Persönlichkeiten
- Wissens-Landkarte
- Synchrones Lernen

---
Bridgelab — Wir bauen keine Apps. Wir bauen Brücken.
