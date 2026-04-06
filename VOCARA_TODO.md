# Vocara – Vollständige ToDo & Ideen-Liste (Stand 06.04.2026)

## Liste A – Nicht implementiert
1. Neue Karte: "Für mich" / "Für Partner" Auswahl
2. Mikrofon Aussprache-Analyse testen
3. Wechsel-Klick TTS testen
4. Thai Farbsystem testen
5. Lernzeit Statistik testen
6. Monatsziel Gimmick-Inhalte (Sounds)
7. Karte falsch → KI erklärt warum
8. Streak Freeze 1x/Monat ✅
9. PWA Push Notifications
10. Karten-Kommentar/Notiz

## Liste B – Social/Gamification
11. Paar-Challenge gemeinsam
12. Emoji-Reaktion auf Partner-Fortschritt ✅
13. Gemeinsame Karten-Sammlung
14. Überraschungskarte vom Partner täglich
15. Dark/Light Mode
16. Kartengröße anpassbar
17. Animierte Karten-Übergänge
18. Tägliche Miniaufgabe
19. Level-Namen (Hafen-Anfänger → Elbe-Experte)
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
30. Wort des Tages in alle 5 Bereiche einweben
31. Sprachrhythmus-Training via KI
32. Kontextwechsel: gleiche Karte formell/informell/romantisch
33. Fehler-Muster Analyse durch KI
34. Spanisch + Französisch implementieren
35. KI-generierte Aussprache für alle Sprachen
36. KI-Aussprache für bestehende Karten nachrüsten
37. Eigene Bridgelab-Icons statt Standard

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

## Liste E – Paar/Design/Business
38. Gemeinsames Tagebuch (täglich 1 Satz in Zielsprache)
39. Liebes-Karte des Tages
40. Video-Moment aufnehmen und teilen
41. Synchrones Lernen live
42. Hintergrund: organische Wassertropfen-Wellen zufällig
43. Buttons: Glassmorphism/Frosted Glass
44. Gimmick-Freischalt-Fenster themenspezifisch
45. Jahreszeiten-Themes (Hamburg Winter, Nairobi Regenzeit)
46. Tageszeit-Anpassung (morgens heller, abends wärmer)
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
