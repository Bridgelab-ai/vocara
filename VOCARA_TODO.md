# Vocara – Vollständige ToDo & Ideen-Liste (Stand 19.04.2026)

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
