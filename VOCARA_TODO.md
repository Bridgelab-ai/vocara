# Vocara – Vollständige ToDo & Ideen-Liste (Stand 03.05.2026)

## ✅ Implementiert (03.05.2026 Session 57) — V01.058.085
- KI-GESPRÄCH SPRACHEN KONSEQUENT: isDE komplett entfernt — ui(de,en)-Helfer ersetzt alle isDE-Verzweigungen; SW-Nutzer bekommen englische UI-Labels (korrekt); Szenario-Namen: lang==='de' ? sc.de : sc.en für alle Sprachen; getSystemPrompt nutzt sc.en (neutral) und MAX_EXCHANGES-Variable statt hardcoded 15; fetchFeedback: dynamische feedbackLabels via ui() + SW-Sonderfall; Fehlermeldung: SW-spezifisch / ui() für DE/EN; Textarea-Placeholder: atExchangeLimit-Zustand + ui(); Intro-Prompt nutzt nativeLang/targetLang statt isDE-Fallback ✅
- KI-GESPRÄCH TAGES-LIMIT: Free: 1 Session/Tag, 8 Austausche; Premium: 3 Sessions/Tag, 15 Austausche; MARK_UID + ELOSY_UID immer Premium; kiUsageToday State — lädt users/{uid}/kiUsage/{today} on mount via getDoc(); startScenario: prüft sessionCount>=MAX_SESSIONS → Limit-Alert in fromLang (DE/EN/SW); schreibt neuen sessionCount+lastReset nach Firestore+State; atExchangeLimit = exchangeCount>=MAX_EXCHANGES; sendMessage blockiert bei atExchangeLimit; useEffect triggert fetchFeedback automatisch wenn atExchangeLimit; Header zeigt exchangeCount/MAX_EXCHANGES (gold wenn am Limit); Feedback-Button ab 50% der Exchanges sichtbar; Limit-Banner in Chat wenn atExchangeLimit; Szenario-Picker zeigt Nutzung heute (X/MAX_SESSIONS) + Free/Premium-Info ✅
- firestore.rules: kiUsage/{dateStr} — read/write nur eigene UID; deployed ✅
- VERSION V01.058.085 ✅

## ✅ Implementiert (03.05.2026 Session 56) — V01.057.085
- PARTNER FORTSCHRITT NICHT SICHTBAR: 3-Layer-Fix: (1) SCHREIBEN: handleSessionStop schreibt jetzt publicStats via batch.set+merge in jedem Fall (nicht nur handleFinish); console.log('[Vocara] publicStats written') in beiden Pfaden bestätigt Write. (2) RULES: firestore.rules neu deployed + bestätigt — publicStats/{doc} erlaubt read/write für request.auth != null. (3) LESEN: refreshPartnerData() im App-Scope definiert — liest via getDocFromServer(bypass IndexedDB), als onRefreshPartner-Prop an MenuScreen; wird nach handleFinish UND handleSessionStop aufgerufen; loadPartner loggt jetzt deutlich wenn Dokument fehlt oder Lesen fehlschlägt ✅
- VERSION V01.057.085 ✅

## ✅ Implementiert (03.05.2026 Session 55) — V01.057.084
- RESET LÄDT ALTE KARTEN (Root Fix): 3 Layer gleichzeitig behoben: (1) STATE: setMyData wird jetzt VOR await batch.commit() aufgerufen (optimistisches Update) — UI ist sofort konsistent ohne auf Firestore-Write zu warten; alle Objekte mit Spread ({...cp}, {...mpc}, [...updatedAiCards]) für neue React-Referenzen. (2) CARD LOADING: startBasicsSession liest currentBasicsLevel einmalig am Funktionsanfang (nach optimistischem Update); nextLevel-Berechnung nutzt diesen Wert statt zweitem myData-Read. (3) CACHE: invalidateCache importiert; basics-Reset löscht alle grundlagen-localStorage-Einträge (de_en/en_de/de_sw × Level 1/2/3) damit nächste Session frisch von Firestore lädt ✅
- VERSION V01.057.084 ✅

## ✅ Implementiert (03.05.2026 Session 54) — V01.057.083
- RESET SETZT LEVEL-LOCK ZURÜCK: handleAreaReset in SettingsScreen: pool-basierte Kategorien (basics/home/street) entfernen jetzt ihre aiCards vollständig aus Firestore → nächste Session lädt frischen Level-1-Pool statt alter (zurückgesetzter) Karten. basics-Reset setzt außerdem basicsPoolLevel=1 damit startBasicsSession mit Lvl 1 Pool beginnt. Andere Kategorien (vocabulary/urlaub/satztraining/sentence) behalten Karten wie bisher — nur Progress wird zurückgesetzt. Verwaiste cardProgress-Einträge für entfernte Karten werden bereinigt ✅
- VERSION V01.057.083 ✅

## ✅ Implementiert (03.05.2026 Session 53) — V01.057.082
- HOME POOL GENERATOR: api/generate-home-pool.js — POST-only Endpoint; generiert 60 Heimkarten pro Sprachpaar (de_en/en_de/de_sw) über 6 Themen à 10: Kochen/Putzen/Wohnen/Familie/Alltag/Haustiere; schreibt nach sharedCards/{langPair}_home via Firestore REST PATCH; verwendet claude-haiku-4-5 mit 500ms Pause zwischen Topics ✅
- HOME POOL ROTATION: generateCategoryCards('home') — masteredFronts-Set (interval>=5) aus activeCards gebaut; Pool-Karten gefiltert sodass bereits gemeisterte Fronts übersprungen werden; shuffle vor .slice(0,10) damit jede neue Batch variiert; wenn alle Pool-Karten gemeistert: nimmt alle (kein leerer Zustand) ✅
- ADMIN HOME BUTTON: Home zu triggerAllPools-Jobs und einzelnen Pool-Buttons im AdminScreen hinzugefügt ✅
- POOL TRIGGERUNG: Pool für alle 3 Sprachpaare direkt nach Deploy sequenziell ausgelöst (de_en → en_de → de_sw) ✅
- VERSION V01.057.082 ✅

## ✅ Implementiert (03.05.2026 Session 52) — V01.056.082
- UND ZU HAUSE STARTET NICHT: generateCategoryCards('home') hatte 3 Bugs: (1) langB war hardcoded 'en' statt activeToLang; (2) fetchSharedCards las weekly-rotating Pfad — kein Match für home-Pool; (3) KI-catch schluckte Fehler ohne Fallback. Fixes: langB = activeToLang || fallback; neuer erster Schritt prüft statischen Pfad sharedCards/{langA}_{langB}_home; HOME_FALLBACK (de_en/en_de/de_sw) garantiert immer Session-Start; console.log an jedem Schritt (dev only) ✅
- VERSION V01.056.082 ✅

## ✅ Implementiert (03.05.2026 Session 51) — V01.056.081
- RESET FÜR WERDEN SÄTZE: RESET_AREAS in SettingsScreen — sentence-Eintrag war falsch als 'KI-Gespräch' beschriftet; korrigiert auf 'Werden Sätze' / 'Become Sentences'. Reset löscht alle cardProgress-Einträge mit category='sentence' und setzt masteredPerCategory.sentence=0. Confirmation dialog + writeBatch wie alle anderen Bereiche ✅
- ALLES GENERIEREN (ADMIN): triggerAllPools() — startet alle 8 Pool-Generatoren sequenziell mit je 2s Pause: Base Lvl 1/2/3, Vocab, Street, Satz leicht/mittel/schwer. Jeder Aufruf loggt ▶/✓/✕ Ergebnis in poolLog. 🔄 Alles generieren Button im AdminScreen neben Pool-Sektion Titel; zeigt ⏳ Läuft… während aktiv. Einzeln-Buttons um Base Lvl 3 ergänzt ✅
- VERSION V01.056.081 ✅

## ✅ Implementiert (03.05.2026 Session 50) — V01.055.081
- LEVEL + FORTSCHRITTSBALKEN FIX: levelBadge: lokale thresholds-Array (Duplikat von CAT_LEVEL_THRESHOLDS) entfernt → einzige Quelle; ?? statt || für Threshold-Lookup (0 ist gültig, kein Fallback); Fortschrittsbalken-Formel: span = nextThreshold - prevThreshold; progress = lv>=10 ? 1 : clamp(0,1,(n-prevThreshold)/span) — explizit und korrekt. DEV-only Debug-Log: [Level] category: n/total = Level X, Y%. masteredPerCategory-Berechnung in handleFinish + handleSessionStop: ?? statt || für interval-Lookup; setMyData-Spreads auf { ...finalProgress } und { ...masteredPerCategory } — neue Objekt-Referenz garantiert React-Re-Render ✅
- VERSION V01.055.081 ✅

## ✅ Implementiert (03.05.2026 Session 49) — V01.055.079
- BEREICH RESET IN EINSTELLUNGEN: SettingsScreen neue Sektion "Bereiche zurücksetzen" — zeigt alle 7 Lernbereiche (Grundlagen/Meine Worte/Auf der Straße/Und zu Hause/Im Urlaub/Satztraining/KI-Gespräch) je mit aktuellem Level + 🔄 Reset-Button. Tap → Bestätigungs-Modal "... zurücksetzen? Du fängst wieder bei Level 1 an." → Confirm: setzt alle Cards der Kategorie in cardProgress auf interval=0/consecutiveRight=0/wrongSessions=0/nextReview=today; masteredPerCategory[category]=0; writeBatch nach Firestore; setMyData lokal aktualisiert. Satztraining-Reset nur masteredPerCategory, keine cardProgress-Einträge. Kein anderes Feld wird berührt. resetConfirm useState im SettingsScreen-Scope ✅
- VERSION V01.055.079 ✅

## ✅ Implementiert (03.05.2026 Session 48) — V01.054.079
- PUBLICSTATS PERMISSIONS: firestore.rules bereits korrekt (publicStats: allow read/write für request.auth != null). Neu deployed + bestätigt ✅
- ZUHAUSE IMMER GLEICHE KARTEN: startCategorySession fallback für home/street: statt blindem shuffle(cards) wird geprüft ob alle Karten interval>=3 haben → dann generateCategoryCards() für frischen Batch; notMastered (interval<5) bevorzugt, mastered nur wenn keine anderen mehr vorhanden ✅
- SATZTRAINING FORTSCHRITT GELÖSCHT: Rootcause: handleFinish + handleSessionStop berechnen masteredPerCategory neu als leeres Objekt mit ['vocabulary','sentence','street','home','basics','urlaub'] — schreibt Firestore als ganzes Map-Objekt → masteredPerCategory.satztraining (separat via updateDoc geschrieben) wird bei jedem Card-Session-Ende überschrieben/gelöscht. Fix: masteredPerCategory mit satztraining-Startwert aus myData initialisieren → satztraining-Zähler wird bei jeder Session-End-Write mitgespeichert ✅
- VERSION V01.054.079 ✅

## ✅ Implementiert (03.05.2026 Session 47) — V01.054.076
- GRUNDLAGEN TDZ FIX: startBasicsSession referenzierte isMarkLang auf Zeile 5956 (im existingBasics-Zweig), aber const isMarkLang = lang === 'de' wurde nochmal auf Zeile 5984 im selben Function-Scope deklariert → TDZ: lokale const-Deklaration hoistet und sperrt Zugriff auf isMarkLang für die gesamte Funktion bis zur Deklarationszeile. Vite minifiziert isMarkLang → i → Fehler "Cannot access 'i' before initialization". Fix: redundante lokale Redeclaration auf Zeile 5984 entfernt — isMarkLang aus dem MenuScreen-Closure (Zeile 5312) wird korrekt verwendet ✅
- VERSION V01.054.076 ✅

## ✅ Implementiert (03.05.2026 Session 46) — V01.054.075
- GRUNDLAGEN BUTTON FIX: startBasicsSession verwendete hartcodiertes langB ('en'/'de') statt activeToLang → falscher Pool-Pfad für Swahili-Nutzer. Fix: langB = activeToLang || (isMarkLang ? 'en' : 'de'); BASICS_LANG_NAMES Map für dynamische toLangName/fromLangName. await updateDoc() in Pool-Erfolgspfad und "All mastered next level"-Pfad in try-catch (Fire-and-forget) — bisher konnte ein Firestore-Fehler basicsLoading permanent auf true klemmen. Hardcoded BASICS_FALLBACK (DE/EN, DE/SW, EN/DE — je 10 Starter-Karten) als dritte Stufe: Session startet immer, auch wenn Pool fehlt und KI-API offline ✅
- VERSION V01.054.075 ✅

## ✅ Implementiert (03.05.2026 Session 45) — V01.054.074
- URLAUB FORTSCHRITTSBALKEN ROOTFIX: Batch Category Fix (App-Load) rief ruleCategory() auf allen aiCards ohne bestehenden cardCategories-Eintrag auf → urlaub-Karten wurden als 'sentence' in cardCategories überschrieben → cardCategories-Override übertrumpft buildCardPair in allCards → levelBadge('urlaub') zählte immer 0 mastered. Fix: urlaub-Karten werden wie basics-Karten geschützt (continue vor ruleCategory); existierende falsche cardCategories-Overrides werden mit delete newCats[card.id] bereinigt ✅
- PARTNER TRENNEN SICHER: handlePartnerUpdate(null) führte getDoc + setMyData(snap.data()) aus — vollständiges Reload konnte bei schlechter Verbindung frischen cardProgress mit gecachtem Firestore-Stand überschreiben. Fix: Disconnect-Pfad (partnerUID=null) macht NUR setMyData(d => ({...d, partnerUID:null, partnerName:null, partnerConnectedAt:null})) — kein Reload, kein Risiko für Fortschrittsverlust; Connect-Pfad (partnerUID!=null) reloaded wie bisher ✅
- VERSION V01.054.074 ✅

## ✅ Implementiert (03.05.2026 Session 44) — V01.054.072
- URLAUB FORTSCHRITTSBALKEN: VALID_CATEGORIES um 'urlaub' ergänzt — buildCardPair kategorisierte urlaub-Karten bisher als 'vocabulary' (weil 'urlaub' fehlte im Set); jetzt wird category:'urlaub' korrekt durchgereicht → levelBadge('urlaub') zählt mastered-Karten richtig; handleFinish-Berechnung masteredPerCategory.urlaub wirkt korrekt ✅
- MEINE THEMEN NUR EIGENE: topicCards-Filter geändert von (unlockedTopics.includes || topicsUnlocked) zu nur unlockedTopics.includes — Session zeigt jetzt nur freigeschaltete Themen; wenn keine Themen freigeschaltet: Toast "Einstellungen → Meine Themen → Themen generieren"; Button erscheint sobald topicsUnlocked (statt erst wenn Karten vorhanden) ✅
- VERSION V01.054.072 ✅

## ✅ Implementiert (03.05.2026 Session 43) — V01.054.070
- URLAUB ZUVERLÄSSIG: fetchSharedCards-Filter fix (|| !c.category entfernt — nur exakte urlaub-Kategorie); vocab pool travel-Fallback hinzugefügt (sharedCards/{pair}_vocab gefiltert auf vocabCategory:'travel'); Hardcoded Starter-Karten (5 Cards DE/EN/SW) als absoluter Fallback — Urlaub startet jetzt immer ✅
- SATZTRAINING DEFAULT LEICHT: useState('leicht') statt null; useEffect auto-startet generateExercises('leicht') bei Mount; useEffect schreibt onSatzComplete(correct, total) wenn done; handleSatzComplete in MenuScreen — inkrementiert masteredPerCategory.satztraining; SatzTrainingScreen erhält onSatzComplete prop; "Neue Übungen" Button setzt alle States korrekt zurück ✅
- ELOSY FORTSCHRITT: loadPartner nutzt getDocFromServer() statt getDoc() — bypass IndexedDB offline cache, zwingt Netzwerk-Read für aktuelle Partnerdaten bei jedem App-Load; getDocFromServer zu Firebase imports hinzugefügt ✅
- VERSION V01.054.070 ✅

## ✅ Implementiert (03.05.2026 Session 42) — V01.054.067
- NAIROBI THEME FARBEN TAUSCHEN: bg → #060400 (near-pure black), card → #0F0C00 (old bg value), border → #1C1600; bgGrad deutlich dunkler (#0D0A00/#080600/#060400 statt #1C1800); clear dark hierarchy bg→card→accent ✅
- LOGO LICHTSCHWEIF: vocaraLogoSweep CSS-Keyframe — gold/amber gradient sweep über "Vocara" Text alle 8 Sekunden (8s ease-in-out infinite); -webkit-background-clip text + background-size 300%; kein Shimmer/Puls, nur ein eleganter Lichtschweif ✅
- ADMIN POOL BUTTONS: AdminScreen hat jetzt "🗃 Pool generieren" Section — 7 Buttons (Base Lvl 1/2, Vocab, Street, Satz leicht/mittel/schwer); triggerPool() Funktion mit live Log-Output (grün/rot); poolRunning State sperrt Buttons während Lauf ✅
- generate-sentence-training-pool.js: ANTHROPIC_API_KEY → ANTHROPIC_KEY (inkonsistenter Env-Var-Name gefixt) ✅
- POOL KARTEN ERSTELLT: Base Lvl1+2 (de→en/de→sw/en→de je 50 Karten); Vocab (de→en 200, en→de 200, de→sw 200 Karten je 8 Kategorien); Street (de→en 100, en→de 100, de→sw 100 Phrasen); Satz (9 Paare × 3 Schwierigkeiten = 27 Pools je 27-30 Übungen) → alle in Firestore sharedCards/sharedExercises ✅
- VERSION V01.054.067 ✅

## ✅ Implementiert (02.05.2026 Session 41) — V01.053.064
- OFFLINE-FIRST / INDEXEDDB: firebase.js → initializeFirestore + persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED }); ersetzt getFirestore(); Firestore-Reads aus IndexedDB-Cache wenn Daten unverändert — zero Read-Cost bei wiederholtem Laden ✅
- CARD CACHING (localStorage): src/hooks/useCardCache.js neu — getCards(key)/setCards(key,data)/invalidateCache(key), 7-Tage-TTL; fetchGrundlagenPool + SatzTraining sharedExercises-Read durch Cache-Layer ergänzt; Firestore-Read wird bei unverändertem Pool komplett übersprungen ✅
- BATCH WRITES (session end): handleFinish + handleSessionStop nutzen writeBatch(db); cardProgress + sessionHistory + masteredPerCategory + timeUpdate + firedStreakGimmicks → ein batch.update(users/{uid}) + batch.set(publicStats) = 2 Dokumente, 1 Round Trip; writePublicStats-Read-Chain entfernt; pendingProgressRef + beforeunload-Handler sichert Fortschritt bei Browser-Close ✅
- VERSION V01.053.064 ✅

## ✅ Implementiert (02.05.2026 Session 40) — V01.052.061
- FORTSCHRITTSBALKEN PERSISTENZ: masteredPerCategory (Map pro Kategorie) wird bei handleFinish + handleSessionStop in Firestore gespeichert; levelBadge liest myData.masteredPerCategory als primäre Quelle — Fortschrittsbalken überleben Page-Reload auch ohne allCards neu zu berechnen ✅
- KI-GESPRÄCH ABLAUF NEU: 3-stufiger Ablauf — (1) Situation-Intro-Banner in fromLang; (2) KI sendet erste Nachricht als Charakter (Haiku API-Call in startScenario); (3) normales Back-and-forth; KI initiiert immer, User reagiert; Eingabefeld gesperrt während generatingOpener; Situationsbeschreibung + Opener aus JSON-Response; introText/generatingOpener States ✅
- SATZTRAINING POOL: api/generate-sentence-training-pool.js erstellt — Haiku generiert 30 Übungen × 3 Schwierigkeiten (leicht/mittel/schwer) × 3 Sprachpaare → Firestore sharedExercises/{langPair}_satz_{level}; SatzTrainingScreen liest sharedExercises zuerst (Fallback: KI-Generierung); Rating-Buttons: nur 3 (❌ Falsch / 😕 Fast / ✅ Richtig); auto-⚡ Easy wenn Antwort < 4 Sekunden; Richtig-Button wechselt automatisch zu Easy-Rating; exerciseStartRef + autoEasy State ✅
- FIRESTORE RULES: sharedExercises/{docId} read für auth User, write für unauthenticated (API); deployed ✅
- VERSION V01.052.061 ✅

## ✅ Implementiert (02.05.2026 Session 39) — V01.051.058
- SOCIAL_REGISTER CRASH: SOCIAL_REGISTER → SOCIAL_REGISTERS in KiGespraechScreen Ton-Selector — ReferenceError behoben ✅
- FORTSCHRITT NICHT GESPEICHERT: handleStop übergibt correct/wrong an handleSessionStop; handleSessionStop ruft saveSessionHistory auf; homeFloat wird auf cards-Screen ausgeblendet (Stop-Button speichert korrekt) ✅
- FIRESTORE PERMISSIONS: Regeln bereits korrekt — firestore:rules neu deployed (latest version confirmed) ✅
- GRUNDLAGEN POOL ROTATION: startBasicsSession: wenn buildSession leer → zeige nicht-gemeisterte (interval<5); wenn alle gemeistert → lade nächsten Pool-Level aus sharedCards; speichert basicsPoolLevel in myData ✅
- SATZTRAINING SCHWIERIGKEIT: Difficulty-Selector (Leicht/Mittel/Schwer) vor SatzTrainingScreen; generateExercises(chosenDifficulty) passt Prompt an; Hints/Erklärungen jetzt immer in fromLang (DE/EN) ✅
- MORGEN FÄLLIG BUTTON: tomorrowDueCards in MenuScreen berechnet; Button erscheint wenn >0 Karten morgen fällig — startet Session mit 5er-Batch ✅
- STATISTIKEN BUTTON: progressBtn DE "📊 Statistiken" / EN "📊 Statistics" — klare Bezeichnung ✅
- SPRACH-LERNANTEIL: updateSrcPercent/addSrcLang/removeSrcLang auto-save entfernt; langWeightsDirty State; expliziter "💾 Sprachanteil speichern" Button + Bestätigungsanzeige ✅
- VERSION V01.051.058 ✅

## ✅ Implementiert (02.05.2026 Session 38) — V01.050.055
- FIRESTORE RULES FIX: incomingCards allow read+create für alle auth User (Sender braucht read für Duplikat-Check); publicStats allow write für alle auth User (Partner-Notifs + Partnerdaten schreiben cross-user); monthlyGimmick/{uid}/history/{month} Rule hinzugefügt; Rules deployed ✅
- VERSION V01.050.055 ✅

## ✅ Implementiert (02.05.2026 Session 37) — V01.050.054
- MONATSZIEL GIMMICK-SOUNDS: Beim Monatsziel-Trigger: new Audio('/sounds/gimmick-{theme}.mp3').play() — fail-silent; public/sounds/ Ordner + README.txt mit Quellenhinweisen; setDoc(monthlyGimmick/{uid}/history/{yearMonth}) als einmaliger Firestore-Guard ✅
- SWAHILI KATEGORISIERUNG: ruleCategory Rule 1 fixed — langA='sw' + pronunciation-Feld erzwingen keine 'street' mehr; nur swahiliRe-Muster in Nicht-Swahili-Karten → street; sw-Karten werden jetzt korrekt über Inhaltsregeln kategorisiert (1 Wort → vocabulary, Frage → sentence usw.) ✅
- EINSTELLUNGEN ALS EIGENES MENÜ: Bereits vollständig implementiert — SettingsScreen ist full-screen via screen:'settings', Nav-Button vorhanden ✅
- VERSION V01.050.054 ✅

## ✅ Implementiert (02.05.2026 Session 36) — V01.049.054
- GESCHENKKARTE BENACHRICHTIGUNG: Nach write zu incomingCards schreibt send() auch users/{partnerUID}/publicStats/pendingNotifs_gift_{ts} (gleicher Mechanismus wie Session-Notifs); Text DE/EN abhängig ob Partner Elosy ist ✅
- GESCHENKKARTE DUPLIKAT-SCHUTZ: getDocs(incomingCards) vor dem Senden; 1) gleiche front+back schon vorhanden → Toast + abort; 2) gleiche Karte + heutiges Datum → Toast + abort; zwei unabhängige Checks mit je eigenem Toast ✅
- VERSION V01.049.054 ✅

## ✅ Implementiert (02.05.2026 Session 35) — V01.049.053
- EINSTUFUNGSTEST KI-FRAGEN: PlacementTest bekommt toLangCode prop (activeToLang); AI-Generierung nutzt jetzt claude-haiku-4-5-20251001 statt Sonnet; Prompt deckt A1-B2 ab; LANG_NAMES_FULL für alle Sprachpaare (de/en/sw/th/es/fr); statischer Fallback nur noch bei AI-Ausfall ✅
- SENTENCE POOL API: generate-sentence-pool.js erweitert um type:'flashcards' Branch → 100 Satz-Flashcards/Paar (5 Kategorien à 20: Alltag/Reisen/Arbeit/Familie/Smalltalk), schreibt nach sharedCards/{pair}_sentence; bestehende Exercise-Generierung bleibt unberührt; optionaler {pair} body param für einzelne Triggerung ✅
- VERSION V01.049.053 ✅

## ✅ Implementiert (02.05.2026 Session 34) — V01.048.053
- BUTTON DESIGN 3D+HAPTIK: catBtn minHeight 60px, linear-gradient(145deg) bg, 3D box-shadow (6px offset), borderRadius 16px; :active translateY(4px) shadow-collapse in CSS; navigator.vibrate(20) via global click listener ✅
- LEVEL ANZEIGE EINE ZEILE: levelBadge flexDirection:row, gap:6px, bar 60px×3px, "Lvl X" + bar auf einer Zeile ✅
- MEHR POOL KARTEN: generate-base-pool.js Level 1 (50 cards: Zahlen/Begrüßung/Farben/Familie/Schule) + Level 2 (50 cards: Zahlen 11-100/Wochentage/Monate/Pronomen/Verben); max_tokens 6000 ✅
- VERSION V01.048.053 ✅

## ✅ Implementiert (02.05.2026 Session 33) — V01.047.025
- WERDEN SÄTZE RESTORED: startSatzSession() wiederhergestellt — generiert KI-Flashcards → CardScreen (flashcard mode) ✅
- SATZTRAINING BUTTON NEU: Neuer Button im Grid → screen:'satz' (SatzTrainingScreen, interaktive Übungen); levelBadge('satztraining') ✅
- satzLoading STATE: useState(false) wiederhergestellt; werden Sätze + Nav-Button nutzen satzLoading für opacity/disabled ✅
- VERSION V01.047.025 ✅

## ✅ Implementiert (02.05.2026 Session 32) — V01.046.025
- ONBOARDING SCHRITTE 5+6: Bereits implementiert (socialRegister + musicEnabled) ✅
- SOZIALES REGISTER KI-GESPRÄCH: Bereits implementiert (Ton: Selector) ✅
- GLASSMORPHISM BUTTONS: Alle 6 Lernbereich-Buttons + Meine Themen + Wir lernen alles — backdrop-filter:blur(12px), rgba(255,255,255,0.07) Hintergrund, glass border, hover translateY(-2px); App.css hover/active Styles; water-shimmer ::after pseudo-element ✅
- BUTTON LAYOUT FINAL: Area name oben groß, levelBadge unten klein — flexColumn/spaceBetween/minHeight:80px bereits implementiert ✅
- LEVEL 5 POOL: generate-base-pool.js Level 5 (Idiome, B1-Phrasen, kulturspezifische Ausdrücke); handler akzeptiert {level:N} oder {type:'vocab_emotions'} body param für einzelne Triggerung ohne Timeout ✅
- VERSION V01.046.025 ✅

## ✅ Implementiert (02.05.2026 Session 31) — V01.044.025
- ÜBERSETZUNG MELDEN: Bereits implementiert in V01.040.023 ✅ — 🚩 Button, Modal, Firestore, Admin-Panel
- KI ERKLÄRT FALSCHE ANTWORT: Korrekte Antwort jetzt grün oben im Erklärpanel sichtbar; Prompt aktualisiert auf "Why is X the correct Y for Z?" ✅
- PARTNER TRENNEN FIX: vocara_disconnected_{uid} → vocara_manually_disconnected (kein UID-Suffix) — funktioniert geräteübergreifend; flag wird nur bei explizitem Trennen gesetzt, gelöscht bei neuer Verbindung ✅
- 30 NEUE KARTEN: generate-base-pool.js erweitert um Level 4 (Konjunktionen/Komposita/B1-Phrasen) + vocab_emotions (30 Nuancegefühle/Sprachpaar); alle Paare parallelisiert ✅
- VERSION V01.044.025 ✅

## ✅ Implementiert (02.05.2026 Session 30) — V01.043.024
- VOCAB POOL API: api/generate-vocab-pool.js — 200 Karten/Sprachpaar (de→en, en→de, de→sw), 8 Kategorien (Emotionen 30, Alltag 30, Familie 20, Körper 20, Natur 20, Zeit 20, Reisen 30, Essen 30); schreibt nach sharedCards/{pair}_vocab ✅
- STREET POOL API: api/generate-street-pool.js — 100 Phrasen/Sprachpaar, 4 Kategorien (Umgangssprache 30, Redewendungen 30, Jugendsprache 20, Smalltalk 20); schreibt nach sharedCards/{pair}_street ✅
- KARTE ERSTELLEN SPRACHEN FLEXIBLER: initTgtLang() nutzt myData.activeToLang als Priorität — Zielsprache passt sich automatisch an die aktive Lernsprache des Users an ✅
- ADMIN PANEL ERWEITERT: Meldungen-Counter in Quick Stats; Behoben-Button (setzt status:'fixed'), Ignorieren-Button (löscht report doc); fixe Karten ausgeblendet; offene Meldungen hervorgehoben ✅
- VERSION V01.043.024 ✅

## ✅ Implementiert (02.05.2026 Session 28) — V01.032.023
- ICONS ENTFERNT: Alle Emojis aus Lernbereich-Buttons auf Home-Screen entfernt; ✈️ aus Im Urlaub, 🎯 aus Meine Themen Home-Button, topic.emoji aus Themen-Chips; KI_SCENARIOS Picker ohne Emoji-Icon-Block, Chat-Header ohne Emoji; nur Text + Lvl-Badge ✅
- +X ANZEIGE ENTFERNT: Zweite Zeile mit "+X bis nächstes Level" aus levelBadge entfernt — nur noch "Lvl X/10" ✅
- UND ZU HAUSE 10 STUFEN: levelBadge('home') nutzt homeLevel = floor(masteredCount/8) — 80% von 10 Karten = 8 gemeisterte zum Level-Aufstieg; generateCategoryCards('home') bereits level-aware (030) ✅
- IM URLAUB 10 STUFEN SCHNELLER: levelBadge('urlaub') = floor(masteredCount/6) — 60% von 10 = 6 gemeisterte; levelBadge('urlaub') jetzt auf Urlaub-Button hinzugefügt ✅
- BASIS-POOL API: api/generate-base-pool.js erstellt — POST-Only Endpoint, generiert 30 Level-1-Grundlagen-Karten für 6 Sprachpaare via Claude Sonnet, schreibt nach sharedCards/{langPair}_grundlagen_1; fetchGrundlagenPool() Helper in App.jsx; startBasicsSession prüft Base-Pool vor KI-Generierung ✅
- KI-GESPRÄCH SZENARIEN CLEAN TEXT: Emoji-Block aus Szenario-Picker entfernt; nur Text-Buttons ✅
- WÖCHENTLICHER AUTO-POOL: api/weekly-pool.js bereits vorhanden (bestätigt) ✅
- VERSION V01.032.023 ✅

## ✅ Implementiert (02.05.2026 Session 27) — V01.030.023
- PARTNER KRITISCH: Dual-path stats write on session end → `userProfiles/{uid}` + `users/{uid}/profile/data`; enhanced debug logging reads all 4 profile paths for both users on login ✅
- ÜBERSETZUNGSQUALITÄT: All card generation already uses claude-sonnet-4-6 + CARD_GEN_SYSTEM (confirmed) ✅
- MEINE THEMEN HAUPTSEITE: Already on home grid (confirmed) ✅
- IM URLAUB FIXES: levelBadge removed (confirmed) ✅
- UND ZU HAUSE STUFEN: generateCategoryCards('home') now level-aware — 10-level HOME_LEVEL_DESCS array; prompt includes current level + level-appropriate content description ✅
- MIKROFON EN→DE FIX: Already done in 029 (confirmed) ✅
- KONTEXT-KARTEN FIX: 1 sentence + translation brackets already done in 029 (confirmed) ✅
- KI ERKLÄRT FALSCHE ANTWORT: Already done in 029 (confirmed) ✅
- WÖCHENTLICHER AUTO-POOL: Already in api/weekly-pool.js (confirmed) ✅
- SOFT PAYWALL: Already implemented (confirmed) ✅
- KI-GESPRÄCH 2.0 SZENARIEN: Already done in 029 (confirmed) ✅
- VERSION V01.030.023 ✅

## ✅ Implementiert (29.04.2026 Session 26) — V01.029.023
- PARTNER KRITISCH: Cost-optimized Firestore writes — localStorage cache `vocara_partnerUid`; nur schreiben wenn cachedPartnerUid !== pUid; Debug-Logging partner profiles ✅
- ÜBERSETZUNGSQUALITÄT: CARD_GEN_SYSTEM mit native-level Regeln (keine Wort-für-Wort-Übersetzung, idiomatisches Deutsch, Muttersprachler-Check); 🚩 Report-Button auf Karte → `reports/{cardId}_{timestamp}` in Firestore ✅
- MEINE THEMEN BUTTON: "🎯 Meine Themen" auf Home-Screen; freigeschaltet bei Premium ODER Level 2+ in einer Hauptkategorie ✅
- IM URLAUB: `levelBadge('urlaub')` entfernt — kein Level-System für Urlaub, nur freeBadge ✅
- MIKROFON EN→DE FIX: Spracherkennung prüft `item.langA` — wenn Frage in toLang → Antwort in fromLang, sonst toLang ✅
- KONTEXT-KARTEN FIX: Max 1 Satz pro Variante; Übersetzung in eckigen Klammern ✅
- KI-GESPRÄCH 2.0: Vollständig neu — `KI_SCENARIOS` Konstante (10 Szenarien), Szenario-Picker UI, Roleplay-System-Prompt, Auto-Feedback nach `---END---`-Marker, Feedback-Screen (Stärken/Schwächen/Level), 1 freies Szenario/Woche Limit ✅
- AUSSPRACHE HISTORY: `_pronunciationHistory[]` pro Karte (letzte 10 Scores); fetchTutorMsg analysiert Schwächen-Karten ✅
- VERSION V01.029.023 ✅

## ✅ Implementiert (29.04.2026 Session 25) — V01.028.023
- WÖCHENTLICHER AUTO-POOL: weekly-pool.js Prompt erweitert auf {front,back,pronunciation,category,tense,register,wordType}; Firestore-Write speichert alle neuen Felder; Topic-Rotation durch Mixed-Prompt ersetzt ✅ (Basis bereits V01.023.022)
- FREE/PREMIUM SOFT PAYWALL: Bereits vollständig implementiert (V01.022.019 + V01.023.023): eleganter Modal-Overlay, "Vielleicht später", FREE_LIMITS, KI 3x/week, Mark+Elosy always premium ✅ (confirmed existing)
- KARTE FALSCH → KI ERKLÄRT WARUM: Prompt verbessert — erklärt warum die korrekte Antwort richtig ist (Grammatikregel/Bedeutung); Panel rot gestaltet (Falsch-Kontext); Header "💡 KI erklärt:" hinzugefügt ✅ (Basis bereits, jetzt verbessert)
- STREAK FREEZE PREMIUM: Bereits vollständig implementiert (V01.022.019): Settings-Section 🧊, handleStreakFreeze, 1x/Monat, Firestore streakFreeze-Objekt ✅ (confirmed existing)
- VERSION V01.028.023 ✅

## ✅ Implementiert (29.04.2026 Session 24) — V01.027.023
- KONTEXT-KARTEN VERBESSERT: Button ABOVE Karte mit teal Shimmer-Glow während Session (vocaraKontextGlow); KontextwechselScreen: Varianten-Badges oben-links (Formell/Informell/Romantisch) und oben-rechts (Hochsprache/Slang); Back-Navigation kehrt korrekt zu cards oder result zurück ✅
- AUSSPRACHE COACHING: _pronunciationHistory pro Karte in cardProgress (letzte 10 Scores); fetchTutorMsg analysiert gemeisterte Karten mit Ø<65% und nennt sie im KI-Prompt ✅
- PUSH NOTIFICATIONS (Basis): Session-Finish schreibt Partner-Aktivitäts-Notif zu userProfiles/{partnerUID}/pendingNotifs; App-Login liest + zeigt Browser-Notification dann löscht Einträge ✅
- I18N (bereits V01.022.022), WORTART TAGS (bereits V01.024.023), THEMEN FREISPIELEN (bereits V01.025.023) — confirmed existing ✅
- VERSION V01.027.023 ✅

## ✅ Implementiert (29.04.2026 Session 23) — V01.026.023
- SOUND FIX: Alle AudioContext/OscillatorNode/Oscillator-Code entfernt — Summen/Brummen gestoppt; ambientEnable* = noops; Music-Section in Einstellungen zeigt "Kommt bald" ✅
- LEVEL-SYSTEM 1-10: CAT_LEVEL_THRESHOLDS (1/5/10/15/20/30/40/50/65/80); CAT_LEVEL_NAMES DE+EN (Anfänger→Fließend); CAT_LEVEL_COLORS; levelBadge zeigt "Lvl N/10" + "+X bis nächstes Level" ✅
- VERSION V01.026.023 ✅

## ✅ Implementiert (29.04.2026 Session 22) — V01.025.023
- PARTNER VERBINDUNG PERMANENT: Login schreibt partnerUID in 5 Orte (users/profile/data, shared/{uid}, settings/partner, localStorage x2); loadPartner versucht users/{partnerUID}/profile/data als 3. Quelle ✅
- PARTNER KARTEN SENDEN: GeschenkkarteScreen schreibt zusätzlich zu users/{partnerUID}/incomingCards/{id} Subcollection; App-Load prüft Subcollection wenn kein pendingGift; Accept/Decline löscht Subcollection-Eintrag ✅
- ELOSY FORTSCHRITT: Session-Finish publiziert totalCards/masteredCards/streak in userProfiles; StatsScreen nutzt published fields wenn cardProgress nicht verfügbar ✅
- NEUE VERBINDUNG RESET: Schreibt users/{uid}/partnerStats bei neuer Partner-Verbindung ✅
- THEMEN FREISPIELEN: 7 Themen (Kochen/Fußball/Musik/Reisen/Technik/Business/Natur) in Einstellungen; gesperrt bis Premium oder 5+ gemeisterte Karten; KI generiert 15 Karten on unlock; unlockedTopics in Firestore ✅
- VERSION V01.025.023 ✅

## ✅ Implementiert (29.04.2026 Session 21) — V01.024.023
- I18N KI PROMPTS: kiRespondIn(lang) in coachMsg Prompt — KI-Tutor antwortet immer in der Muttersprache des Users ✅
- EINSTUFUNGSTEST: testCount ("Test #3") aus Firestore testHistory + Antwort-Pattern-Erkennung (orange Banner bei 5x gleiche Option) ✅
- KARTEN-WORTART TAGS: wordType + article in vocab-Generierungsprompt; subtiler Badge top-right auf Karte; Batch-Erkennung on app-load (max 10/Tag, lastWordTypeBatch Guard) ✅
- NIE WIEDER LERNEN VOLLSTÄNDIG: 3-Option Context-Menu (⭐ Favorit / 🚫 Nie wieder / Abbrechen); favoriteCards in Firestore; Einstellungen: Ausgeschlossene Karten-Liste mit Wiederherstellen-Button ✅
- STATISTIKEN LIEBLINGSBEREICH: getWeeklyFavArea() nutzt area-Feld aus sessionHistory; "Diese Woche" in StatsScreen solo + Partner-Vergleich ✅
- VERSION V01.024.023 ✅

## ✅ Implementiert (28.04.2026 Session 20) — V01.023.023
- SATZTRAINING 5 MODI: Mode E (Übersetzung) hinzugefügt — KI evaluiert semantisch via /api/chat für tense+translation ✅
- SEMANTISCHE BEWERTUNG: Haiku evaluiert ob Übersetzung/Zeitform sinngemäß korrekt ist, gibt kurzes Feedback in fromLang ✅
- PROGRESSION: difficultyScore (0-10) steigt mit richtig/leicht, sinkt bei Falsch — Sterne-Anzeige ab Score 4 ✅
- TYPO-TOLERANZ: Levenshtein-Distanz ≤ 1 für Konjugation (1 Tippfehler erlaubt) ✅
- RANDOM MODE ORDER: exercises werden nach Generierung zufällig gemischt ✅
- STUFEN-SYSTEM: Lvl 1/2/3 Badges auf allen 6 Kategoriebuttons (ab 1/5/15 gemeisterten Karten) ✅
- NIE WIEDER LERNEN: 700ms Long-Press auf Karte → Bestätigungsmodal → excludedCards in Firestore ✅
- EXCLUDED CARDS: aus allen Sessions gefiltert via excludedCardIds Set + activeCards Filter ✅
- VERSION V01.023.023 ✅

## ✅ Implementiert (28.04.2026 Session 19) — V01.023.022
- SHARED CARDS POOL: api/weekly-pool.js schreibt nach Firestore sharedCards/{langPair}_{weekStr} ✅
- fetchSharedCards() Helper: liest Pool-Doc vor KI-Generierung ✅
- generateVocabWords: prüft sharedCards zuerst, fällt auf /api/chat zurück ✅
- generateCategoryCards: prüft sharedCards (category-gefiltert) ✅
- generateUrlaubCards: prüft sharedCards (urlaub-gefiltert) ✅
- Vercel Cron 0 3 * * 0 (Sonntag 3 Uhr UTC) — bereits in vercel.json ✅
- VERSION V01.023.022 ✅

## ✅ Implementiert (28.04.2026 Session 18) — V01.022.022
- ASYNC LOCALE LOADING: public/locales/de.json + en.json (~170 Keys) erstellt ✅
- loadLocale() Funktion (async fetch /locales/{lang}.json) auf Modul-Ebene ✅
- MenuScreen: useState + useEffect für async t-Objekt — sofort T[lang] Fallback, dann JSON override ✅
- t={t} Prop an alle 6 Sub-Screens übergeben: Ki/Satz/Rhythmus/Kontext/Stats/KarteErstellen ✅
- Sub-Screens: t prop akzeptiert mit T[lang] Fallback — kein Flash bei Initialisierung ✅
- VERSION V01.022.022 ✅

## ✅ Implementiert (28.04.2026 Session 17) — V01.022.021
- FULL UI LOCALIZATION: T object erweitert auf 80+ Keys (ResultScreen, Settings, SatzTraining, Rhythmus, Kontextwechsel, Stats, KI, tense celebration, general) ✅
- BUGS BEHOBEN: isMarkLang/isDE in KiGespraechScreen, SatzTrainingScreen, RhythmusScreen, KontextwechselScreen waren undefined — jetzt const t = T[lang] in allen Komponenten ✅
- ALLE SCREENS LOKALISIERT: ResultScreen, SettingsScreen, StatsScreen, RhythmusScreen, KontextwechselScreen, KarteErstellenScreen, KiGespraechScreen — t.key statt ternary ✅
- ELOSY sieht vollständig Englisch, MARK sieht vollständig Deutsch ✅
- VERSION V01.022.021 ✅

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
6. Monatsziel Gimmick-Inhalte (Sounds) ✅
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
49. Einstellungen als eigenes Menü ✅
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
- ✅ Auslöser: Streak-Meilensteine (7/14/30/60 Tage), Wochenziel, Monatsziel (5 Wochen), 100 Karten, Partner-Challenge
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
- Swahili Kategorisierung teilweise offen ✅
- Kategorisierungs-Button entfernen ✅
- fromLang-basierte UI-Sprache (Elosy EN→DE, alle Screens) ✅
- VOICE_MAP + selectVoiceForLang für EN/DE/SW ✅
- activeToLang Dropdown für Mark (EN+SW bidirektional) ✅
- userToLang Array-Bug gefixt (myData.toLang Array → activeToLang) ✅
- Kartengenerierung auf claude-sonnet-4-6 + CARD_GEN_SYSTEM Qualitätsprompt ✅ (V01.002.005)
