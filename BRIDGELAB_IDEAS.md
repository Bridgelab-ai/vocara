# Bridgelab Hub — Plattform-Ideen

## Konzept
Eine Haupt-App als Plattform mit verschiedenen Modulen unter dem Bridgelab-Dach.
Gemeinsamer Login, gemeinsames Design, gemeinsame Bridgelab-Identität.

## Module
- 🗣️ Vocara → Sprachen lernen für Paare/Freunde
- 📚 Lernkarten → eigene Karten für alles (Führerschein, Medizin, Schule)
- 🧠 Gehirn → KI-gestützte Denk-Diagnostik und Gehirntraining, Slogan: "Schalten Sie Google ab und Ihr Gehirn ein"
- 🎬 KI Movie → Film-Matchmaking: beide geben Vorlieben ein, KI empfiehlt perfekten gemeinsamen Film für Paare/Gruppen
- 🌍 Horizont → Kultur & Auswandern (coming soon)

## KI Movie — Details
- Beide User geben Filmvorlieben ein (Genre, Stimmung, Länge, Sprache)
- KI analysiert beide Profile und findet optimalen gemeinsamen Film
- Nicht nur Netflix — alle Plattformen (Prime, Disney+, Apple TV etc.)
- Gruppenversion: mehrere Freunde, KI findet Konsens
- Lernversion (Vocara-Integration): Film in Zielsprache mit Lernkarten aus Dialogen

## Vocara — Thai fehlt noch
- Thai (TH) als vollständige Sprache implementieren
- Farbton-System: Grün=mittlere Konsonanten, Rot=Vokale, Lila/Blau=Töne
- Phonetik nach Kollegen-Notizbuch-System

## Technisch
- Bridgelab Hub = React PWA, gemeinsamer Firebase Auth
- Jedes Modul eigenständige React-App oder Lazy-loaded Route
- Gemeinsames Design-System (Glassmorphism, Wassereffekt, metallische Themes)
- Gemeinsame Bridgelab-Icons
