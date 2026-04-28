# Vocara – Vollständige ToDo & Ideen-Liste (Stand 28.04.2026)

## ✅ Implementiert (28.04.2026 Session 16) — V01.022.020
- ZEITFORMEN VOLLAUTOMATISCH: Home-Screen Widget (Progress-Bar) komplett entfernt — keine manuelle Auswahl — tenseUnlockSeen Flag in Firestore verhindert wiederholte Celebration ✅
- ZEITFORMEN CELEBRATION MODAL: Einmalige Overlay-Feier wenn Schwelle überschritten (20→Vergangenheit, 50→Zukunft) — dismissbar per Button oder Backdrop-Tap ✅
- KI GENERATION TENSE-CONSTRAINT: generateVocabWords + generateCategoryCards Prompts respektieren freigeschaltete Zeitformen — nur erlaubte Tenses werden generiert ✅
- KARTEN TENSE TAG: Subtiler Eck-Badge unten-links (nur bei Vergangenheit/Zukunft sichtbar) — Präsens-Karten zeigen keinen Tag (sind die Norm) ✅
- VERSION V01.022.020 ✅

## ✅ Implementiert (28.04.2026 Session 15) — V01.022.019
- URLAUB PAYWALL: Free = 3/10 Karten sichtbar + paywall Note in ResultScreen — Premium = alle 10 — Prompt mit tense:'present', register:'formal' ✅
- KONTEXTWECHSEL SCREEN: KontextwechselScreen — nach Session mit gemeisterten Karten (interval>=3) zeigt ResultScreen 🔄 Button — KI (Haiku) generiert 3 Varianten (Formell/Informell/Romantisch) — User wählt eine → wird als neue Karte gespeichert ✅
- RHYTHMUS OPTIONAL: Auto-Redirect nach Satz-Session entfernt — stattdessen optionaler "🎵 Rhythmus üben" Button in ResultScreen ✅
- MUBERT MUSIK: ambientEnableMubert() — Web Audio sofort, dann async Mubert-Track via /api/mubert Proxy — URL 6h in Firestore sharedConfig gecacht — Fallback auf Web Audio bei Fehler — api/mubert.js (GetServiceAccess + TTM), MUBERT_KEY Env-Var nötig ✅
- VERSION V01.022.019 ✅

## ✅ Implementiert (28.04.2026 Session 14) — V01.018.019
- KI-TANK ENERGIE-BALKEN: Teal-Bar auf Home-Screen — Free: X/3 diese Woche, Premium: Unbegrenzt — depletes with use, tappable → paywall wenn leer ✅
- ZEITFORMEN STUFEN-SYSTEM: Präsens sofort / Vergangenheit bei 20 / Zukunft bei 50 gemeisterten Karten — Emoji-Tiles + Progress-Bar auf Home-Screen ✅
- STATISTIKEN ERWEITERT: Zeitformen-Level Card in StatsScreen (3 Tiles locked/unlocked), Reaktionszeit Section (avg, schnellste, schwierigste Karte) ✅
- KARTE ERSTELLEN SOZIALES REGISTER: socialRegister aus myData an KarteErstellenScreen + kiFill-Prompt → tone-appropriate Übersetzungen ✅
- WÖCHENTLICHER AUTO-POOL: api/weekly-pool.js — Claude Sonnet 4.6 generiert 20 Karten/Sprachpaar, schreibt in Firestore weeklyPool Collection ✅
- VERCEL CRON: vercel.json mit cron schedule (0 3 * * 0 = jeden Sonntag 3:00 Uhr) ✅
- VERSION V01.018.019 ✅

## ✅ Implementiert (28.04.2026 Session 13)
- MUSIK PHASE 1: Web Audio API Ambient Engine — 3 Theme-Sounds (Hamburg: Harbor-Töne, Nairobi: Warm Sine+LFO, Welt: Kosmisch) — 🔇/🎵 Toggle im Home-Header — Lautstärkeregler in Einstellungen — Firestore + localStorage Persistenz — Fade-out/in bei Theme-Wechsel ✅
- STREAK FREEZE PREMIUM: Free = 0 Freezes, Premium = 1x/Monat — Mark+Elosy immer Premium — Einstellungen zeigt Badge ✅
- KARTEN-NOTIZ VERBESSERT: Note lädt aus newProgress (aktuelle Session), dann cardProgress — Sofortiges Firestore Write (`cardProgress.{id}._note`) bei Speichern — KI-Tutor referenziert Notizen im Coaching-Prompt ✅
- OFFLINE INDIKATOR: 📵 Offline Pill oben rechts wenn kein Internet ✅
- PWA: manifest.json, sw.js Service Worker (network-first/cache-first), index.html mit theme-color + apple-meta + manifest-Link, main.jsx SW-Registrierung ✅
- VERSION V01.008.019 ✅

## ✅ Implementiert (28.04.2026 Session 12)
- UI DUPLIKATE ENTFERNT: Zielsprache-Pill vom Home-Screen entfernt (nur noch in Einstellungen), karteMenu-Dropdown entfernt → standalone Nav-Buttons (Karte kreieren / Meine Karten / Geschenkkarte) ✅
- HORIZONT ENTFERNT: HorizontScreen, glassBtn + Routing komplett entfernt — standalone Horizont-App in Planung ✅
- FREE TIER BESTÄTIGT: softPaywall + checkFreeLimit + freeBadge aus Session 11 vollständig aktiv ✅
- VERSION V01.007.017 ✅

## ✅ Implementiert (28.04.2026 Session 11)
- FREE TIER SOFT PAYWALL: Eleganter Bottom-Sheet statt Toast — "Du hast X von Y Karten genutzt", Premium-CTA mit Features, 'Vielleicht später' Button — KI-Gespräch limit ebenfalls soft paywall ✅
- HORIZONT TEXT: 'Kultur & Auswandern' → 'Kultur & Sprache' / 'Culture & Language' auf allen Screens ✅
- VERSION V01.007.016 ✅

## ✅ Implementiert (28.04.2026 Session 10)
- URLAUB KATEGORIE: ✈️ Urlaub als 6. Lernbereich im Grid (Row 3 links) — KI generiert 10 Reisephrasen bei 0 Karten mit Coverage Hotel/Flughafen/Restaurant/Notfälle/Transport/Shopping/Banking ✅
- LERNZEIT PARTNER-VERGLEICH: Nach jeder Session werden weeklyMinutes/monthlyMinutes/totalMinutes in userProfiles/{uid} geschrieben — StatsScreen zeigt Balkendiagramm Woche/Monat/Gesamt für beide ✅
- FREE/PREMIUM LINIE: userPlan state, Mark+Elosy immer premium, Free = nur Meine Worte + Sätze, andere Bereiche zeigen 🔒 Premium — KI-Gespräch 3x/Woche Counter ✅
- THEMES AUF 3: Lyon, Sevilla, ChiangMai entfernt — nur Hamburg, Nairobi, Welt ✅
- VERSION V01.007.000 ✅

## ✅ Implementiert (28.04.2026 Session 9)
- KARTE ERSTELLEN NEU (#1): 4-Schritt-Flow — Sprachen (multi-select Ausgangssprache mit % Slider, Zielsprache), Karte eingeben (Seiten-Toggle, textarea, KI ergänzt mit Pronunciation), Kategorie & Ziel (Für mich/Partner/Beide), Speichern ✅
- % GEWICHTUNG SESSION: fromLangs session weighting nach langA — DE 70%/EN 30% → Session spiegelt Aufteilung, gespeichert in users/{uid}/settings/langWeights ✅
- VERSION V01.005.013 ✅

## ✅ Implementiert (27.04.2026 Session 8)
- ANIMIERTE KARTEN-ÜBERGÄNGE (#17): vocaraSlideIn keyframe, cardSlideIn state — next card slides in from left after any answer ✅
- KARTEN-WEGFLIEGE-ANIMATION (#47): particleBurst + sparkleRing CSS keyframes, triggerBurst() — gold particles on Richtig, rainbow burst on Easy ✅
- LIEBES/FREUNDSCHAFTS-KARTE DES TAGES (#39): relationshipType passed to daily card AI prompt — phrase tone adapts to couple/friends/family/colleagues ✅
- STATISTIK LIEBLINGSBEREICH (#29): Standalone "Lieblingsbereich 🔥" section in StatsScreen for solo users ✅
- SWAHILI KATEGORISIERUNG: Already implemented in app-load batch fix (lines 7042-7054) ✅
- NEUE KARTE FÜR PARTNER (#1): forPartner toggle fully implemented in KarteErstellenScreen ✅
- VERSION V01.005.012 ✅

## ✅ Implementiert (27.04.2026 Session 7)
- THEME PERSISTENZ: localStorage Cache verhindert Theme-Flicker beim Reload ✅
- NAIROBI THEME: Pure Gold/Black — #FFD700 gold, #0A0800 near-black, #B8860B dark gold, kein Orange/Braun ✅
- ZIELSPRACHE MEHRFACH AUSWAHL: toLangs [{lang, percent}] in Firestore, Prozent-Slider in Einstellungen, Session-Mixing nach Prozent ✅
- KARTE DES TAGES: DE oben / EN unten für Mark, Kontext max 2 Sätze, EN-Kontext in DE-UI versteckt ✅
- KI-TUTOR: Gold-Pill Button für Tagebuch, coachMsg auf 2 Sätze gekürzt ✅
- FLAGGEN: Emoji-Flags ersetzt durch "DE → EN" Pill in Theme-Akzentfarbe ✅
- LEVEL-CHECK BANNER: Subtiler Ghost-Button ohne aggressives Rot ✅
- SATZ MESSAGE: Zeigt echte Anzahl bekannter Wörter ✅
- VERSION V01.002.007 ✅

## ✅ Implementiert (19.04.2026 Session 6) — V01.000.002
- VERSION SYSTEM: APP_VERSION = V01.000.002, angezeigt in Einstellungen-Footer und Home-Footer ✅
- KI-TUTOR START BUTTON: ▶ Starten neben Tutor-Nachricht, startet empfohlenen Bereich (most due cards), Tagebuch-Reminder wenn heute nicht geschrieben ✅
- GIMMIK ÜBERSICHT: "Meine Gimmiks" Section in Einstellungen, per-Theme Historie (gimmickHistory in Firestore) ✅
- PARTNER-KARTE KI AUSFÜLLEN: 🤖 KI ausfüllen Button in KarteErstellenScreen bei Partner-Modus, Auto-Erkennung Kategorie, golden-teal Shimmer-Border ✅
- KI-FENSTER AUSBLENDEN: − Collapse Button auf KI-Tutor Panel, tutorCollapsed in Firestore gespeichert ✅
- KARTE KREIEREN BUTTON: ＋ Karte kreieren Nav-Button über Einstellungen ✅
- AUSSPRACHE-COACHING: KI-Tutor Prompt enthält phonetic_ready_cards Zähler für Aussprache-Tipps ✅
- TAGEBUCH NUR ZIELSPRACHE: Spracherkennung DE/EN via Wort-Frequenz-Analyse, ⚠️ Warnung wenn falsche Sprache, Pflicht-Hinweis auf Zielsprache ✅
- ADMIN PANEL: AdminScreen für Mark UID only, alle User (last active, streak, cards, mastered, partner), CSV Export ✅
- MEHRERE PARTNER: Free 1 Partner, Premium/Pro grayed-out Buttons in PartnerScreen sichtbar ✅

## Liste A – Nicht implementiert
1. Neue Karte: "Für mich" / "Für Partner" Auswahl
2. Mikrofon Aussprache-Analyse testen
3. Wechsel-Klick TTS testen
4. Thai Farbsystem testen
5. Lernzeit Statistik testen
6. Monatsziel Gimmick-Inhalte (Sounds)
7. Karte falsch → KI erklärt warum ✅
8. Streak Freeze 1x/Monat ✅
9. PWA Push Notifications ✅
10. Karten-Kommentar/Notiz ✅

## Liste B – Social/Gamification
11. Paar-Challenge gemeinsam ✅
12. Emoji-Reaktion auf Partner-Fortschritt ✅
13. Gemeinsame Karten-Sammlung ✅
14. Überraschungskarte vom Partner täglich ✅
15. Dark/Light Mode ✅
16. Kartengröße anpassbar ✅
17. Animierte Karten-Übergänge
18. Tägliche Miniaufgabe
19. Level-Namen (Hafen-Anfänger → Elbe-Experte) ✅
20. Goldene seltene Karten ✅

## Liste C – Unbestätigt/Design
21. Nairobi Theme auf Handy prüfen
22. Hamburg Theme auf Handy prüfen
23. Logo Metallic Glanz verfeinern
24. Logo Glow auf Handy zu stark
25. Hochsprache/Slang Badge prüfen
26. Onboarding Städte prüfen
27. Karten teilen Partner prüfen
28. Englisch-Aussprache für DE Lerner prüfen
29. Statistik Lieblingsbereich anzeigen

## Liste D – Neue Ideen Lern-Mechanik
30. Wort des Tages in alle 5 Bereiche einweben ✅
31. Sprachrhythmus-Training via KI ✅
32. Kontextwechsel: gleiche Karte formell/informell/romantisch ✅
33. Fehler-Muster Analyse durch KI ✅
34. Spanisch + Französisch implementieren
35. KI-generierte Aussprache für alle Sprachen ✅
36. KI-Aussprache für bestehende Karten nachrüsten ✅
37. Eigene Bridgelab-Icons statt Standard

## ✅ Implementiert (19.04.2026 Session 5)
- Aussprache-Analyse: Levenshtein fuzzy matching (40% Toleranz), 0-100% Score, farbige Anzeige, Transkript, Nochmal-Button; auch in RhythmusScreen (#1)
- Gimmick Freischaltung: Theme-spezifischer animierter Popup bei 5-Wochen-Streak (Hamburg/Nairobi/Welt/Lyon/Sevilla/ChiangMai) (#5)
- Wort des Tages: Banner vor ALLEN Session-Typen (nicht nur Kategorie-Sessions) (#6)
- Kontext-Wechsel: ✅ bereits implementiert (#2)
- Fehler-Muster Analyse: ✅ bereits implementiert (#3)
- Sprachrhythmus Training: ✅ bereits implementiert als RhythmusScreen (#4)

## ✅ Implementiert (19.04.2026 Session 4)
- Tagesaufgabe Fix: Wort IMMER in toLang (picked.front, gefiltert nach langA=targetLang) — nicht mehr native Sprache
- KI-Tutor Banner: ersetzt Coaching-Banner, aktualisiert nach jeder Session (sessionCompleteCount), Kategorie-Stats im Prompt, Streak subtil im Panel
- Karte des Tages: Datums-Seed + Kategorie-Rotation (vocab/street/home/sentence/basics), recentDailyFronts-Ausschluss (30 Karten), speichert in dailyCards/{date} Subcollection

## ✅ Implementiert (18.04.2026 Session 3)
- Wochenziel Dots: teal #00BFA5 mit weißem ✓ wenn erledigt, grau wenn offen (#1 fix)
- Karten-Editor: Aussprache-Feld editierbar, "Mit Partner teilen" Button (pendingGift) (#2)
- KI-Aussprache: auto-generiert _phonetic für aiCards on app load, gespeichert Firestore, angezeigt in Kursivschrift (#35/#36)
- Tageszeit Anpassung: Overlay-Werte reduziert 0.06/0.03/0.04 (#5 fix)
- Tagebuch Nav: 📖 Unser Tagebuch / Our Diary (#6)
- Rechtliches: KI-Disclaimer, Haftungsausschluss, UGC-Disclaimer, COPPA in ImpressumScreen (#7)

## ✅ Implementiert (18.04.2026 Session 2)
- Satztraining rebuild: 4 Typen (gap/order/tense/conjugation), freie Texteingabe, 4-Button Selbstbewertung, Grammatik-Erklärung (#neu)
- Auf der Straße: Auto-generiert 5 KI-Slang-Phrasen wenn 0 Karten vorhanden (#neu)
- Und zu Hause: Auto-generiert 5 KI-Home-Phrasen wenn 0 Karten vorhanden (#neu)
- Streak-Warnung: Bridgelab-Design + ⚡ "Jetzt lernen" 5-Karten-Schnell-Session (#neu)
- WaterCanvas: Opacity 0.15-0.25 (vorher 0.12-0.18), Größe 60-300px (#42 ✅)
- Card Hover: translateY(-3px) CSS-Transition auf .vocara-big-card (#neu)
- Partner lastActive: ISO-Timestamp bei jedem App-Start (Echtzeit-Status) (#neu)

## ✅ Implementiert (18.04.2026)
- 4-Button Lern-System: ❌ Falsch | 😕 Fast | ✅ Richtig | ⚡ Easy (#neu)
- Falsch: Position 5 Reinsertion (nicht ans Ende), consecutiveRight-Tracking
- Fast: Interval=1 (morgen), Session-Exit, Haptic [30,60,30]
- Easy: +5/10/21 Tage, 5x=GEMEISTERT → dann +30/60/90/180 alle 180d
- Richtig: 3x consecutiveRight=+2d, 5x=+3d (Beschleunigung)
- Session-Zusammenfassung: ❌X 😕X ✅X ⚡X + Nochmal/Fertig (#neu)
- PC/Tablet Layout: 768px maxWidth 700px, 1024px 2-Spalten-Grid (#neu)
- KI-Gespräch Übersetzen: bestätigt funktional (#neu)

## ✅ Implementiert (06.04.2026)
- Hauptmenü-Navigation: Sprechen / Entdecken / Horizont (Glassmorphism)
- Entdecken-Screen: Karten-Sets mit erstellen, manuell hinzufügen, KI-generieren, importieren, teilen
- Lyon Theme (Français): #8B1A1A Burgunder, #D4A017 Gold
- Sevilla Theme (Español): #C0392B Flamenco-Rot, #F39C12 Orange
- Onboarding Beziehungstyp: Paar/Freunde/Familie/Kollegen (#new) → users/{uid}.relationshipType ✅
- Tages-Karte je Beziehungstyp (KI, städtebasiert, Partner-sync) (#39) ✅
- Tägliche Miniaufgabe: Mastered-Wort in Satz benutzen, KI-Feedback (#18) ✅
- Karte falsch → KI erklärt, kollabierbar (#7) ✅
- Level-Namen: Hafen-Neuling → Vocara-Meister nach Karten-Count (#19) ✅
- Gemeinsames Tagebuch: täglich 1 Satz, KI-Feedback, Timeline (#38) ✅
- Tageszeit-Anpassung: 4 Zeitslots mit Overlay (#46) ✅
- Vocara Logo goldener Glow (drop-shadow layered per theme) ✅
- Emoji-Reaktion auf Partner-Fortschritt: popup + floatingReaction (#12) ✅
- Goldene seltene Karten: interval ≥ 14, gold border + ⭐ badge + Home-Counter (#20) ✅
- Haptisches Feedback: correct=50ms, wrong=[100,100,100], easy=[30,40,30,40,30] (#48) ✅
- Streak Freeze: 🧊 Button inline im Streak-Warning-Block (#8) ✅
- Navigation: 🃏 Karte-Button + Submenu (Meine Karten / Erstellen / Geschenkkarte) ✅
- Einstellungen bereinigt: nur Theme, Tagesziel, Sprachen, Dark/Light, Streak, Partner, Premium, Abmelden ✅
- Geschenkkarte: Gemeisterte Karte + Nachricht an Partner senden → users/{uid}.pendingGift ✅ (#neu)
- Meine Karten Übersicht: Liste, Sterne, Gold-Badge, Suche, Filter, Edit, Löschen ✅
- Einstellungen Sprachen: Premium-Modal mit Sprachliste + Upgrade-Placeholder (#5) ✅
- Wochenziel Dots: 22px Kreis, ✓ bei erledigt, Tooltip per Tap ✅ (#16 teilweise)
- Partner Aktivitäts-Anzeige: 🟢 lernt gerade / 🟡 heute aktiv / ⚪ gestern aktiv ✅
- Neue AI-Karten nextReview = heute (sofort verfügbar) ✅
- "Karten hinzufügen" Button entfernt; AI nur bei 85% Mastery ✅
- Grundlagen als 6. Bereich: AI-generierte Farben/Zahlen/Formen, eigene Kategorie ✅
- Wortkarten Beispielsatz: AI-generiert, CardScreen + Firestore (_example) ✅
- Logo immer gold: Vocara + Bridgelab alle Screens mit Gold-Gradient ✅
- KI Coaching Banner: AI-Nachricht auf Home-Screen basierend auf Streak/Stats ✅
- Bridgelab-Wortsprache: "Heute gebaut.", "Brücke gebaut. ✓", "Verbindung braucht dich." ✅
- Statistik Lerntage gesamt: beide User in StatsScreen ✅
- Thai (TH) Sprache + Chiang Mai Theme implementiert ✅
- Fehler-Muster Analyse: nach 10 Fehlern → KI erkennt Muster, zeigt Tipp (#33) ✅
- Bridgelab-Wortsprache v2: "Heute. Gut gemacht.", "Deine Stimme wächst.", "Heute: vollständig. ✓", "Hier wartet noch nichts…" ✅
- Coaching Banner v2: Wochenziel-Fortschritt in Prompt, Gold-Italic Styling, bessere Varianz ✅

## Liste E – Paar/Design/Business
38. Gemeinsames Tagebuch (täglich 1 Satz in Zielsprache)
39. Liebes-Karte des Tages
40. Video-Moment aufnehmen und teilen
41. Synchrones Lernen live ✅
42. Hintergrund: organische Wassertropfen-Wellen zufällig ✅
43. Buttons: Glassmorphism/Frosted Glass
44. Gimmick-Freischalt-Fenster themenspezifisch
45. Jahreszeiten-Themes (Hamburg Winter, Nairobi Regenzeit) ✅
46. Tageszeit-Anpassung (morgens heller, abends wärmer) ✅
47. Karten-Wegfliege-Animation bei richtig
48. Haptisches Feedback (unterschiedlich für Richtig/Falsch) ✅
49. Einstellungen als eigenes Menü
50. Vocara Familien-Version
51. Geschenk-Abo
52. Unternehmensversion

## Einstellungen (geplantes Menü)
- Partner verbinden
- Neue Karte hinzufügen
- Hauptsprache auswählen (nur nach Upgrade oder Bonus-Freischaltung)
- Zu lernende Sprache auswählen (nur nach Upgrade oder Bonus)
- Sprache pausieren/aktivieren
- Tägliches Lernziel (5/10/15/20 Karten)
- Dark/Light Mode

## Design-Grundsätze
- Hintergrund: organische Wassertropfen-Wellen an zufälligen Positionen, langsam, edel
- Buttons: Glassmorphism/Frosted Glass, Hintergrundwellen schimmern durch
- Kein Shimmer/Puls auf Buttons — Ruhe, Tiefe, Qualität
- Eigene Bridgelab-Icons (keine Standard-Icons)
- Logo: langsamer, einmaliger Lichtschweif alle 8 Sekunden
- Gimmicks: themenspezifische Freischalt-Fenster bei Streak/Wochenziel/Monatsziel

## Gimmick-System
- Auslöser: Streak-Meilensteine, Wochenziel, Monatsziel (5 Wochen), 100 Karten, Partner-Challenge
- Hamburg: Hafen-Sound + Elbe-Wellen-Effekt
- Nairobi: Savanna-Sounds + Sonnenuntergang-Partikel
- Welt: Aurora-Effekt + Weltklang-Mix
- Freischalt-Fenster: animiert, feierlich, zum Theme passend

## Sprachen (geplant)
- Englisch (EN) ✅
- Swahili (SW) ✅
- Deutsch (DE) ✅
- Spanisch (ES) – geplant
- Französisch (FR) – geplant
- Thai (TH) – geplant (mit Farbton-System)

## Technische Schulden
- String.repeat Crash gefixt ✅
- KI-Gespräch 400-Fehler gefixt ✅
- TTS immer toLang ✅
- Session-Resume ✅
- Swahili Kategorisierung teilweise offen
- Kategorisierungs-Button entfernen ✅
- fromLang-basierte UI-Sprache (Elosy EN→DE, alle Screens) ✅
- VOICE_MAP + selectVoiceForLang für EN/DE/SW ✅
- activeToLang Dropdown für Mark (EN+SW bidirektional) ✅
- userToLang Array-Bug gefixt (myData.toLang Array → activeToLang) ✅
- Kartengenerierung auf claude-sonnet-4-6 + CARD_GEN_SYSTEM Qualitätsprompt ✅ (V01.002.005)
