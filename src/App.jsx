import { useState, useEffect, useRef } from 'react'
import { auth, db } from './firebase'
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import './App.css'

const MARK_UID = 'aiNZh4Myn8Y0KfYkGGrkNNW0HC72'
const ELOSY_UID = 'NIX3DYenRdbRjmr2EHsIad9GcqG3'
const SESSION_SIZE = 15
const MASTERY_THRESHOLD = 0.85
const NEW_CARDS_BATCH = 5
const VERY_FAST_S = 3
const FAST_S = 7
const MEDIUM_S = 15

const THEMES = {
  nairobi: { name: '🌙 Nairobi', bg: '#0f0a05', card: '#1a1208', accent: '#E8873A', gold: '#D4AF37', text: '#fff', sub: '#8a7060', border: '#2a1f10' },
  hamburg: { name: '☀️ Hamburg', bg: '#f0f5f2', card: '#ffffff', accent: '#3a7d5c', gold: '#8a9ba8', text: '#1e2d2a', sub: '#7a9080', border: '#c8ddd4' },
  welt: { name: '🌍 Welt', bg: '#0d2137', card: '#0f2d4a', accent: '#00c9a7', gold: '#ffd166', text: '#fff', sub: '#6a8fa8', border: '#1a3a5c' },
}

const AVAILABLE_LANGS = [
  { code: 'en', label: 'Englisch', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'sw', label: 'Swahili', flag: '🇰🇪' },
  { code: 'es', label: 'Spanisch', flag: '🇪🇸' },
  { code: 'fr', label: 'Französisch', flag: '🇫🇷' },
  { code: 'ar', label: 'Arabisch', flag: '🇸🇦' },
  { code: 'tr', label: 'Türkisch', flag: '🇹🇷' },
  { code: 'pt', label: 'Portugiesisch', flag: '🇵🇹' },
]

const LANG_FLAGS = { en: '🇬🇧', de: '🇩🇪', sw: '🇰🇪', es: '🇪🇸', fr: '🇫🇷', ar: '🇸🇦', tr: '🇹🇷', pt: '🇵🇹' }

// ============ EINSTUFUNGSTEST — ENGLISCH (für Mark) ============
const PLACEMENT_EN = [
  // A1
  { id: 'p_en_1', level: 'A1', question: 'What does "Hello" mean?', options: ['Hallo', 'Tschüss', 'Danke', 'Bitte'], correct: 0 },
  { id: 'p_en_2', level: 'A1', question: 'What does "I am tired" mean?', options: ['Ich bin hungrig', 'Ich bin müde', 'Ich bin glücklich', 'Ich bin krank'], correct: 1 },
  { id: 'p_en_3', level: 'A1', question: 'How do you say "Good morning"?', options: ['Good night', 'Good evening', 'Good morning', 'Goodbye'], correct: 2 },
  { id: 'p_en_4', level: 'A1', question: '"What is your name?" means...', options: ['Wie alt bist du?', 'Wo wohnst du?', 'Wie heißt du?', 'Was machst du?'], correct: 2 },
  { id: 'p_en_5', level: 'A1', question: 'Which is correct: "I ___ a student."', options: ['am', 'is', 'are', 'be'], correct: 0 },
  { id: 'p_en_6', level: 'A1', question: '"Thank you" auf Deutsch:', options: ['Entschuldigung', 'Bitte', 'Danke', 'Hallo'], correct: 2 },
  { id: 'p_en_7', level: 'A1', question: 'What does "Where are you from?" mean?', options: ['Wie geht es dir?', 'Woher kommst du?', 'Was machst du?', 'Wo bist du?'], correct: 1 },
  { id: 'p_en_8', level: 'A1', question: 'Which word means "house"?', options: ['Car', 'House', 'Tree', 'Book'], correct: 1 },
  { id: 'p_en_9', level: 'A1', question: '"She ___ to school every day."', options: ['go', 'goes', 'going', 'gone'], correct: 1 },
  { id: 'p_en_10', level: 'A1', question: '"Goodbye" auf Deutsch:', options: ['Hallo', 'Auf Wiedersehen', 'Bitte', 'Danke'], correct: 1 },
  // A2
  { id: 'p_en_11', level: 'A2', question: '"I have been waiting for an hour." Was bedeutet das?', options: ['Ich warte seit einer Stunde', 'Ich habe eine Stunde gewartet und bin fertig', 'Ich will eine Stunde warten', 'Ich warte nicht'], correct: 0 },
  { id: 'p_en_12', level: 'A2', question: 'Which sentence is in the past tense?', options: ['I go to work', 'I am going to work', 'I went to work', 'I will go to work'], correct: 2 },
  { id: 'p_en_13', level: 'A2', question: '"Never mind" bedeutet...', options: ['Niemals denken', 'Vergiss es / Schon gut', 'Auf keinen Fall', 'Keine Ahnung'], correct: 1 },
  { id: 'p_en_14', level: 'A2', question: 'Complete: "She ___ (not) like coffee."', options: ["don't", "doesn't", "isn't", "aren't"], correct: 1 },
  { id: 'p_en_15', level: 'A2', question: '"What\'s the catch?" bedeutet...', options: ['Was ist das?', 'Fang es!', 'Wo ist der Haken?', 'Was kostet das?'], correct: 2 },
  { id: 'p_en_16', level: 'A2', question: 'Which is correct?', options: ['I have saw this film', 'I have seen this film', 'I have see this film', 'I seen this film'], correct: 1 },
  { id: 'p_en_17', level: 'A2', question: '"I\'m on it" means...', options: ['Ich bin drauf', 'Ich kümmere mich darum', 'Ich bin dabei', 'Ich bin weg'], correct: 1 },
  { id: 'p_en_18', level: 'A2', question: 'Choose the correct question:', options: ['Where you live?', 'Where do you live?', 'Where lives you?', 'Where you are living?'], correct: 1 },
  { id: 'p_en_19', level: 'A2', question: '"Hang in there" means...', options: ['Häng es dort auf', 'Halte durch', 'Komm her', 'Warte kurz'], correct: 1 },
  { id: 'p_en_20', level: 'A2', question: '"I\'ll keep you posted" bedeutet...', options: ['Ich schreibe dir Postkarten', 'Ich halte dich auf dem Laufenden', 'Ich folge dir', 'Ich bleibe'], correct: 1 },
  // B1
  { id: 'p_en_21', level: 'B1', question: '"Despite the rain, we ___ the game." Choose the best option:', options: ['finished', 'have been finishing', 'are finishing', 'had finish'], correct: 0 },
  { id: 'p_en_22', level: 'B1', question: '"Under the weather" means...', options: ['Draußen im Regen', 'Kränklich / Nicht auf der Höhe', 'Bei schlechtem Wetter', 'Wettervorhersage'], correct: 1 },
  { id: 'p_en_23', level: 'B1', question: 'Which word fits? "The meeting was ___."', options: ['bored', 'boring', 'bore', 'boringly'], correct: 1 },
  { id: 'p_en_24', level: 'B1', question: '"I\'m swamped" means...', options: ['Ich bin nass', 'Ich bin total überlastet', 'Ich bin erschöpft', 'Ich bin verloren'], correct: 1 },
  { id: 'p_en_25', level: 'B1', question: 'Complete: "If I ___ you, I would apologize."', options: ['am', 'was', 'were', 'be'], correct: 2 },
  { id: 'p_en_26', level: 'B1', question: '"Bear with me" means...', options: ['Komm mit mir', 'Hab Geduld mit mir', 'Kämpf mit mir', 'Bleib bei mir'], correct: 1 },
  { id: 'p_en_27', level: 'B1', question: 'Choose the correct passive form: "The report ___ by Tuesday."', options: ['will complete', 'will be completing', 'will be completed', 'will have complete'], correct: 2 },
  { id: 'p_en_28', level: 'B1', question: '"Break a leg!" means...', options: ['Brich dir ein Bein!', 'Hals- und Beinbruch!', 'Beeil dich!', 'Pass auf!'], correct: 1 },
  { id: 'p_en_29', level: 'B1', question: 'Which is most formal?', options: ["I can't make it", 'I am unable to attend', "I won't be there", "I'm not coming"], correct: 1 },
  { id: 'p_en_30', level: 'B1', question: '"Let\'s make up" means...', options: ['Lass uns schminken', 'Lass uns etwas erfinden', 'Lass uns versöhnen', 'Lass uns aufhören'], correct: 2 },
  // B2
  { id: 'p_en_31', level: 'B2', question: '"The project ___ by the time the client arrives."', options: ['will finish', 'will have been finished', 'will be finishing', 'finishes'], correct: 1 },
  { id: 'p_en_32', level: 'B2', question: 'What does "ambiguous" mean?', options: ['Eindeutig', 'Mehrdeutig / Zweideutig', 'Unmöglich', 'Unbekannt'], correct: 1 },
  { id: 'p_en_33', level: 'B2', question: 'Choose the correct form: "Had she known, she ___ differently."', options: ['would act', 'would have acted', 'will act', 'acted'], correct: 1 },
  { id: 'p_en_34', level: 'B2', question: '"It\'s not my cup of tea" means...', options: ['Ich mag keinen Tee', 'Das ist nicht meins / nicht mein Ding', 'Das ist zu teuer', 'Das gehört mir nicht'], correct: 1 },
  { id: 'p_en_35', level: 'B2', question: 'Which word means "to postpone"?', options: ['To hasten', 'To defer', 'To cancel', 'To confirm'], correct: 1 },
  { id: 'p_en_36', level: 'B2', question: '"That\'s a bummer" is...', options: ['Formell', 'Umgangssprachlich', 'Beleidigend', 'Fachsprachlich'], correct: 1 },
  { id: 'p_en_37', level: 'B2', question: 'Complete: "The more you practice, ___ you become."', options: ['the better', 'the more better', 'more better', 'better'], correct: 0 },
  { id: 'p_en_38', level: 'B2', question: '"No cap" means...', options: ['Keine Mütze', 'Im Ernst / Kein Witz', 'Kein Problem', 'Keine Möglichkeit'], correct: 1 },
  { id: 'p_en_39', level: 'B2', question: 'Which is the correct use of "despite"?', options: ['Despite of the cost, we proceeded', 'Despite the cost, we proceeded', 'Despite that the cost, we proceeded', 'Despite to the cost, we proceeded'], correct: 1 },
  { id: 'p_en_40', level: 'B2', question: '"Piece of cake" refers to...', options: ['Ein Kuchen', 'Eine leichte Aufgabe', 'Ein Stück Arbeit', 'Etwas Süßes'], correct: 1 },
  // C1
  { id: 'p_en_41', level: 'C1', question: '"The legislation was enacted ___ public opposition."', options: ['despite of', 'in spite', 'notwithstanding', 'regardless'], correct: 2 },
  { id: 'p_en_42', level: 'C1', question: 'What does "to corroborate" mean?', options: ['Widersprechen', 'Bestätigen / Bekräftigen', 'Untersuchen', 'Verweigern'], correct: 1 },
  { id: 'p_en_43', level: 'C1', question: 'Identify the subjunctive: "I suggest that he ___ present."', options: ['is', 'was', 'be', 'were'], correct: 2 },
  { id: 'p_en_44', level: 'C1', question: '"Ostensibly" means...', options: ['Offensichtlich falsch', 'Dem Anschein nach', 'Tatsächlich', 'Heimlich'], correct: 1 },
  { id: 'p_en_45', level: 'C1', question: '"She was ___ in her refusal to compromise." Best fit:', options: ['adamant', 'ambivalent', 'amenable', 'apathetic'], correct: 0 },
  { id: 'p_en_46', level: 'C1', question: 'Which is a cleft sentence?', options: ['I saw John yesterday', 'It was John that I saw yesterday', 'John I saw yesterday', 'Yesterday John was seen'], correct: 1 },
  { id: 'p_en_47', level: 'C1', question: '"To prevaricate" means...', options: ['Voraus planen', 'Ausweichen / Herumreden', 'Übertreiben', 'Vorhersagen'], correct: 1 },
  { id: 'p_en_48', level: 'C1', question: 'Complete: "Not only ___ the proposal, but she also funded it."', options: ['she supported', 'did she support', 'she did support', 'supported she'], correct: 1 },
  { id: 'p_en_49', level: 'C1', question: '"Equivocal" means...', options: ['Eindeutig', 'Gleichwertig', 'Zweideutig', 'Gleichmütig'], correct: 2 },
  { id: 'p_en_50', level: 'C1', question: 'Which sentence uses an absolute phrase?', options: ['Running quickly, he caught the bus', 'The task completed, they left the office', 'She was tired but kept working', 'Although tired, she kept working'], correct: 1 },
  // C2
  { id: 'p_en_51', level: 'C2', question: '"The ___ of the argument lay in its internal contradictions."', options: ['fallacy', 'premise', 'corollary', 'axiom'], correct: 0 },
  { id: 'p_en_52', level: 'C2', question: 'What is a "hapax legomenon"?', options: ['Ein häufiges Wort', 'Ein Wort das nur einmal belegt ist', 'Ein veraltetes Wort', 'Ein Lehnwort'], correct: 1 },
  { id: 'p_en_53', level: 'C2', question: '"Perspicacious" means...', options: ['Hartnäckig', 'Scharfsinnig / Klug', 'Weitschweifig', 'Unbeständig'], correct: 1 },
  { id: 'p_en_54', level: 'C2', question: 'Complete: "___ he may be talented, his work ethic leaves much to be desired."', options: ['Although', 'Albeit', 'Granted', 'Despite'], correct: 1 },
  { id: 'p_en_55', level: 'C2', question: '"Tendentious" describes writing that is...', options: ['Ausgewogen', 'Subjektiv / Tendenziös', 'Akademisch', 'Kreativ'], correct: 1 },
  { id: 'p_en_56', level: 'C2', question: 'What does "to gainsay" mean?', options: ['Beipflichten', 'Widersprechen / Leugnen', 'Bestätigen', 'Aussagen'], correct: 1 },
  { id: 'p_en_57', level: 'C2', question: '"The proposal was met with ___ from all quarters." Best fit:', options: ['approbation', 'opprobrium', 'equanimity', 'probity'], correct: 1 },
  { id: 'p_en_58', level: 'C2', question: 'Identify the zeugma: ', options: ['"She lost her keys and her temper"', '"He spoke quickly and loudly"', '"She was tall and elegant"', '"He walked fast and far"'], correct: 0 },
  { id: 'p_en_59', level: 'C2', question: '"Solipsistic" means...', options: ['Sozial', 'Egozentrisch / Nur auf sich selbst fokussiert', 'Altruistisch', 'Philosophisch'], correct: 1 },
  { id: 'p_en_60', level: 'C2', question: '"Weltanschauung" in English refers to...', options: ['World record', 'World view / Philosophy of life', 'World travel', 'World war'], correct: 1 },
]

// ============ EINSTUFUNGSTEST — DEUTSCH (für Elosy) ============
const PLACEMENT_DE = [
  // A1
  { id: 'p_de_1', level: 'A1', question: '"Hallo" auf Englisch:', options: ['Goodbye', 'Hello', 'Please', 'Thank you'], correct: 1 },
  { id: 'p_de_2', level: 'A1', question: '"Ich bin müde" means...', options: ['I am hungry', 'I am happy', 'I am tired', 'I am sick'], correct: 2 },
  { id: 'p_de_3', level: 'A1', question: 'Which article is correct? "___ Buch"', options: ['der', 'die', 'das', 'den'], correct: 2 },
  { id: 'p_de_4', level: 'A1', question: '"Wie heißt du?" means...', options: ['How old are you?', 'Where are you from?', 'What is your name?', 'How are you?'], correct: 2 },
  { id: 'p_de_5', level: 'A1', question: 'Complete: "Ich ___ aus Kenia."', options: ['bin', 'komme', 'wohne', 'heiße'], correct: 1 },
  { id: 'p_de_6', level: 'A1', question: '"Danke schön" means...', options: ['Excuse me', 'Please', 'Thank you very much', 'Sorry'], correct: 2 },
  { id: 'p_de_7', level: 'A1', question: 'Which is correct? "Ich ___ Elosy."', options: ['bin', 'heiße', 'habe', 'bin heiße'], correct: 1 },
  { id: 'p_de_8', level: 'A1', question: '"Guten Morgen" means...', options: ['Good night', 'Good afternoon', 'Good morning', 'Good evening'], correct: 2 },
  { id: 'p_de_9', level: 'A1', question: 'What is "Wasser" in English?', options: ['Food', 'Water', 'Wine', 'Milk'], correct: 1 },
  { id: 'p_de_10', level: 'A1', question: '"Ich verstehe nicht" means...', options: ['I do not speak', 'I do not want', 'I do not understand', 'I do not know'], correct: 2 },
  // A2
  { id: 'p_de_11', level: 'A2', question: 'Complete: "Gestern ___ ich ins Kino gegangen."', options: ['habe', 'bin', 'hatte', 'wurde'], correct: 1 },
  { id: 'p_de_12', level: 'A2', question: '"Ich freue mich" means...', options: ['I am sad', 'I am bored', 'I am looking forward to it', 'I am surprised'], correct: 2 },
  { id: 'p_de_13', level: 'A2', question: 'Which case? "Ich gebe ___ Mann das Buch."', options: ['der', 'die', 'dem', 'den'], correct: 2 },
  { id: 'p_de_14', level: 'A2', question: '"Du fehlst mir" means...', options: ['You forgot me', 'I miss you', 'You are missing something', 'You are wrong'], correct: 1 },
  { id: 'p_de_15', level: 'A2', question: 'Complete: "Das ist ___ teuer." (too)', options: ['sehr', 'viel', 'zu', 'mehr'], correct: 2 },
  { id: 'p_de_16', level: 'A2', question: '"Kannst du das wiederholen?" means...', options: ['Can you translate that?', 'Can you repeat that?', 'Can you explain that?', 'Can you write that?'], correct: 1 },
  { id: 'p_de_17', level: 'A2', question: 'Which is the correct plural? "das Kind →"', options: ['die Kinds', 'die Kinder', 'die Kinde', 'die Kindern'], correct: 1 },
  { id: 'p_de_18', level: 'A2', question: '"Ich bin stolz auf dich" means...', options: ['I am angry at you', 'I am thinking of you', 'I am proud of you', 'I am waiting for you'], correct: 2 },
  { id: 'p_de_19', level: 'A2', question: 'Complete: "___ du Deutsch?"', options: ['Kannst', 'Sprichst', 'Machst', 'Lernst'], correct: 1 },
  { id: 'p_de_20', level: 'A2', question: '"Alles wird gut" means...', options: ['All is lost', 'Everything is fine now', 'Everything will be okay', 'All is well'], correct: 2 },
  // B1
  { id: 'p_de_21', level: 'B1', question: 'Complete: "Wenn ich Zeit ___, käme ich."', options: ['habe', 'hatte', 'hätte', 'haben'], correct: 2 },
  { id: 'p_de_22', level: 'B1', question: '"Das ist lecker" means...', options: ['That is expensive', 'That is delicious', 'That is interesting', 'That is strange'], correct: 1 },
  { id: 'p_de_23', level: 'B1', question: 'Which is the correct reflexive form? "Ich ___ die Hände."', options: ['wasche mir', 'wasche mich', 'wasche', 'wäsche mir'], correct: 0 },
  { id: 'p_de_24', level: 'B1', question: '"Ich lerne Deutsch, ___ ich in Deutschland arbeiten möchte."', options: ['aber', 'weil', 'obwohl', 'wenn'], correct: 1 },
  { id: 'p_de_25', level: 'B1', question: 'Passive: "Man baut das Haus." →', options: ['Das Haus wird gebaut', 'Das Haus ist gebaut', 'Das Haus baut sich', 'Das Haus wurde bauen'], correct: 0 },
  { id: 'p_de_26', level: 'B1', question: '"Entschuldigung" is used to...', options: ['Greet someone', 'Say goodbye', 'Apologize or get attention', 'Express joy'], correct: 2 },
  { id: 'p_de_27', level: 'B1', question: 'Complete: "Er sagte, er ___ krank."', options: ['ist', 'sei', 'war', 'wäre'], correct: 1 },
  { id: 'p_de_28', level: 'B1', question: '"Bis bald" means...', options: ['See you tomorrow', 'See you soon', 'See you later today', 'Goodbye forever'], correct: 1 },
  { id: 'p_de_29', level: 'B1', question: 'Which is correct? "Trotz ___ Regens gingen wir spazieren."', options: ['der', 'dem', 'des', 'die'], correct: 2 },
  { id: 'p_de_30', level: 'B1', question: '"Was machst du?" in a formal context becomes...', options: ['Was machen Sie?', 'Was macht ihr?', 'Was machst du?', 'Was machen wir?'], correct: 0 },
  // B2
  { id: 'p_de_31', level: 'B2', question: '"Angesichts der Lage ___ wir handeln." Best form:', options: ['müssen', 'müssten', 'muss', 'müsste'], correct: 0 },
  { id: 'p_de_32', level: 'B2', question: 'What does "die Nachhaltigkeit" mean?', options: ['Die Vergangenheit', 'Die Zukunft', 'Die Nachhaltigkeit', 'Sustainability'], correct: 3 },
  { id: 'p_de_33', level: 'B2', question: 'Complete the Konjunktiv II: "Wenn er früher gekommen ___, hätten wir mehr Zeit gehabt."', options: ['war', 'wäre', 'ist', 'würde'], correct: 1 },
  { id: 'p_de_34', level: 'B2', question: '"Zweischneidiges Schwert" means...', options: ['Ein scharfes Schwert', 'Double-edged sword (Vor- und Nachteil)', 'Eine Waffe', 'Ein altes Sprichwort'], correct: 1 },
  { id: 'p_de_35', level: 'B2', question: 'Which uses the Genitiv correctly?', options: ["Das Auto meiner Mutter", "Das Auto von meine Mutter", "Das Auto meiner Mutter's", "Das Auto meiner Mutters"], correct: 0 },
  { id: 'p_de_36', level: 'B2', question: '"Schließlich" is best translated as...', options: ['Finally / Eventually', 'Unfortunately', 'Nevertheless', 'Meanwhile'], correct: 0 },
  { id: 'p_de_37', level: 'B2', question: 'Identify the correct Relativsatz:', options: ['Das Buch, das ich lese, ist interessant.', 'Das Buch, was ich lese, ist interessant.', 'Das Buch, den ich lese, ist interessant.', 'Das Buch, die ich lese, ist interessant.'], correct: 0 },
  { id: 'p_de_38', level: 'B2', question: '"Ungeachtet" means...', options: ['Trotzdem', 'Deswegen', 'Infolgedessen', 'Regardless of'], correct: 3 },
  { id: 'p_de_39', level: 'B2', question: 'Complete: "Je mehr man lernt, ___ man weiß."', options: ['desto mehr', 'umso viel', 'desto viel', 'je mehr'], correct: 0 },
  { id: 'p_de_40', level: 'B2', question: '"Auf dem Laufenden bleiben" means...', options: ['Weiter rennen', 'Stay informed', 'Stay on track', 'Keep running'], correct: 1 },
  // C1
  { id: 'p_de_41', level: 'C1', question: '"Die Maßnahme zeitigt erste Erfolge." "Zeitigt" means...', options: ['Verzögert', 'Zeigt / Bringt hervor', 'Beendet', 'Gefährdet'], correct: 1 },
  { id: 'p_de_42', level: 'C1', question: 'Complete (Zustandspassiv): "Das Problem ___ noch nicht ___."', options: ['ist / gelöst', 'wird / gelöst', 'hat / gelöst', 'wäre / gelöst'], correct: 0 },
  { id: 'p_de_43', level: 'C1', question: '"Inwiefern" differs from "warum" in that it asks...', options: ['Why', 'In what way / To what extent', 'How often', 'Since when'], correct: 1 },
  { id: 'p_de_44', level: 'C1', question: '"Gleichwohl" is a synonym for...', options: ['Deswegen', 'Nichtsdestotrotz / Nevertheless', 'Folglich', 'Einerseits'], correct: 1 },
  { id: 'p_de_45', level: 'C1', question: 'Which uses "als ob" correctly?', options: ['Er tut so, als ob er schläft.', 'Er tut so, als ob er schläfe.', 'Er tut so, als ob er schlafen.', 'Er tut so, als er schläft.'], correct: 1 },
  { id: 'p_de_46', level: 'C1', question: '"Subtil" means...', options: ['Offensichtlich', 'Fein / Kaum wahrnehmbar', 'Grob', 'Laut'], correct: 1 },
  // ✅ FIX: None → null (war Python-Syntax, hat JS-Fehler verursacht)
  { id: 'p_de_47', level: 'C1', question: 'The "Fugenelement" in "Arbeitsplatz" is...', options: ['-s-', '-en-', '-e-', null], correct: 0 },
  { id: 'p_de_48', level: 'C1', question: '"Dessen ungeachtet" means...', options: ['Infolgedessen', 'Regardless of that', 'Thanks to that', 'As a result'], correct: 1 },
  { id: 'p_de_49', level: 'C1', question: 'Which sentence uses "brauchen" correctly?', options: ['Du brauchst nicht zu kommen.', 'Du brauchst nicht kommen.', 'Du nicht brauchst zu kommen.', 'Du brauchst kommen nicht.'], correct: 0 },
  { id: 'p_de_50', level: 'C1', question: '"Ambivalent" means...', options: ['Eindeutig positiv', 'Zwiespältig / Gemischt', 'Klar ablehnend', 'Vollkommen neutral'], correct: 1 },
  // C2
  { id: 'p_de_51', level: 'C2', question: '"Die Argumente verfangen sich in einem Zirkelschluss." "Zirkelschluss" means...', options: ['Kreisförmige Bewegung', 'Circular reasoning', 'Abschluss einer Debatte', 'Runder Tisch'], correct: 1 },
  { id: 'p_de_52', level: 'C2', question: '"Konzedieren" means...', options: ['Konzentrieren', 'Einräumen / Zugeben', 'Konzipieren', 'Kritisieren'], correct: 1 },
  { id: 'p_de_53', level: 'C2', question: 'Which is an "Anakoluth"?', options: ['Ein Satz ohne Verb', 'Ein grammatisch nicht zu Ende geführter Satz', 'Ein Palindrom', 'Ein Satz mit doppelter Verneinung'], correct: 1 },
  { id: 'p_de_54', level: 'C2', question: '"Lapidar" means...', options: ['Lang und ausführlich', 'Kurz und treffend / knapp', 'Unverständlich', 'Feierlich'], correct: 1 },
  { id: 'p_de_55', level: 'C2', question: '"Das Haar in der Suppe suchen" means...', options: ['Kochen', 'An allem etwas auszusetzen haben', 'Sauber sein', 'Kleinigkeiten genießen'], correct: 1 },
  { id: 'p_de_56', level: 'C2', question: '"Apodiktisch" describes a statement that is...', options: ['Fragend', 'Unbedingt wahr / Unbestreitbar', 'Vermutend', 'Widersprüchlich'], correct: 1 },
  { id: 'p_de_57', level: 'C2', question: 'What is a "Hendiadyoin"?', options: ['Ein Wortspiel', 'Ausdruck eines Begriffs durch zwei Wörter (z.B. "mit Müh und Not")', 'Ein Fremdwort', 'Eine Übertreibung'], correct: 1 },
  { id: 'p_de_58', level: 'C2', question: '"Perspektivisch" in academic writing means...', options: ['In Bezug auf Farbe', 'Aus einer bestimmten Sichtweise betrachtet', 'Langfristig geplant', 'Geometrisch'], correct: 1 },
  { id: 'p_de_59', level: 'C2', question: '"Distinktion" means...', options: ['Unterscheidung / Feine Differenz', 'Auszeichnung allein', 'Ablehnung', 'Zustimmung'], correct: 0 },
  { id: 'p_de_60', level: 'C2', question: '"Tautologisch" describes...', options: ['Etwas Widersprüchliches', 'Etwas das dasselbe zweimal sagt', 'Etwas Unbekanntes', 'Etwas Übertriebenes'], correct: 1 },
]

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const CEFR_COLORS = { A1: '#81c784', A2: '#4CAF50', B1: '#29b6f6', B2: '#1976d2', C1: '#ab47bc', C2: '#e53935' }
const CEFR_DESC = {
  de: { A1: 'Anfänger', A2: 'Grundlagen', B1: 'Mittelstufe', B2: 'Fortgeschritten', C1: 'Kompetent', C2: 'Meister' },
  en: { A1: 'Beginner', A2: 'Elementary', B1: 'Intermediate', B2: 'Upper-Intermediate', C1: 'Advanced', C2: 'Mastery' },
}

const ALL_MARK_CARDS = [
  { id: 'en_1', front: "What's the catch?", back: "Wo ist der Haken?", langA: 'en', langB: 'de' },
  { id: 'en_2', front: "Long story short...", back: "Um es kurz zu machen...", langA: 'en', langB: 'de' },
  { id: 'en_3', front: "I'm down.", back: "Ich bin dabei.", langA: 'en', langB: 'de' },
  { id: 'en_4', front: "I'm heading out.", back: "Ich mache mich auf den Weg.", langA: 'en', langB: 'de' },
  { id: 'en_5', front: "Give me a heads up.", back: "Gib mir kurz Bescheid.", langA: 'en', langB: 'de' },
  { id: 'en_6', front: "I'm on it.", back: "Ich kümmere mich darum.", langA: 'en', langB: 'de' },
  { id: 'en_7', front: "I'm devastated.", back: "Ich bin am Boden zerstört.", langA: 'en', langB: 'de' },
  { id: 'en_8', front: "Never mind.", back: "Vergiss es. / Schon gut.", langA: 'en', langB: 'de' },
  { id: 'en_9', front: "I'm on my way.", back: "Ich bin unterwegs.", langA: 'en', langB: 'de' },
  { id: 'en_10', front: "What's going on?", back: "Was ist hier los?", langA: 'en', langB: 'de' },
  { id: 'en_11', front: "To be honest...", back: "Um ehrlich zu sein...", langA: 'en', langB: 'de' },
  { id: 'en_12', front: "Take care!", back: "Pass auf dich auf!", langA: 'en', langB: 'de' },
  { id: 'en_13', front: "Keep me posted.", back: "Halt mich auf dem Laufenden.", langA: 'en', langB: 'de' },
  { id: 'en_14', front: "I'll let you know.", back: "Ich gebe dir Bescheid.", langA: 'en', langB: 'de' },
  { id: 'en_15', front: "It's up to you.", back: "Es liegt an dir.", langA: 'en', langB: 'de' },
  { id: 'en_16', front: "I'll keep you posted.", back: "Ich halte dich auf dem Laufenden.", langA: 'en', langB: 'de' },
  { id: 'en_17', front: "Make up your mind!", back: "Entscheide dich!", langA: 'en', langB: 'de' },
  { id: 'en_18', front: "I'm literally starving!", back: "Ich habe Riesenhunger!", langA: 'en', langB: 'de' },
  { id: 'en_19', front: "For real?", back: "Echt jetzt? / Im Ernst?", langA: 'en', langB: 'de' },
  { id: 'en_20', front: "Piece of cake!", back: "Ein Kinderspiel!", langA: 'en', langB: 'de' },
  { id: 'en_21', front: "No biggie.", back: "Kein Ding.", langA: 'en', langB: 'de' },
  { id: 'en_22', front: "My bad.", back: "Mein Fehler.", langA: 'en', langB: 'de' },
  { id: 'en_23', front: "No way!", back: "Auf keinen Fall!", langA: 'en', langB: 'de' },
  { id: 'en_24', front: "Make it clear.", back: "Mach es unmissverständlich klar.", langA: 'en', langB: 'de' },
  { id: 'en_25', front: "Let's make up.", back: "Lass uns uns versöhnen.", langA: 'en', langB: 'de' },
  { id: 'en_26', front: "Bear with me.", back: "Hab Geduld mit mir.", langA: 'en', langB: 'de' },
  { id: 'en_27', front: "Cut it out!", back: "Hör auf damit!", langA: 'en', langB: 'de' },
  { id: 'en_28', front: "Hang in there.", back: "Halte durch.", langA: 'en', langB: 'de' },
  { id: 'en_29', front: "Actually", back: "Eigentlich / Tatsächlich", langA: 'en', langB: 'de' },
  { id: 'en_30', front: "Basically", back: "Im Grunde / Grundsätzlich", langA: 'en', langB: 'de' },
  { id: 'en_31', front: "Eventually", back: "Schließlich / Irgendwann", langA: 'en', langB: 'de' },
  { id: 'en_32', front: "Probably", back: "Wahrscheinlich", langA: 'en', langB: 'de' },
  { id: 'en_33', front: "Definitely", back: "Definitiv / Auf jeden Fall", langA: 'en', langB: 'de' },
  { id: 'en_34', front: "Anyway", back: "Wie auch immer / Jedenfalls", langA: 'en', langB: 'de' },
  { id: 'en_35', front: "Exactly", back: "Genau / Exakt", langA: 'en', langB: 'de' },
  { id: 'en_36', front: "My treat.", back: "Ich lade dich ein.", langA: 'en', langB: 'de' },
  { id: 'en_37', front: "No cap.", back: "Kein Witz / Ungelogen.", langA: 'en', langB: 'de' },
  { id: 'en_38', front: "Under the weather.", back: "Kränklich / Nicht auf der Höhe.", langA: 'en', langB: 'de' },
  { id: 'en_39', front: "Break a leg!", back: "Hals- und Beinbruch!", langA: 'en', langB: 'de' },
  { id: 'en_40', front: "That's a bummer.", back: "Das ist schade / blöd.", langA: 'en', langB: 'de' },
  { id: 'en_41', front: "I'm swamped.", back: "Ich bin total überlastet.", langA: 'en', langB: 'de' },
  { id: 'en_42', front: "Hit me up.", back: "Meld dich bei mir.", langA: 'en', langB: 'de' },
  { id: 'en_43', front: "It's not my cup of tea.", back: "Das ist nicht mein Ding.", langA: 'en', langB: 'de' },
  { id: 'sw_1', front: "Jambo", back: "Hallo (Aussprache: DSHAM-bo)", langA: 'sw', langB: 'de' },
  { id: 'sw_2', front: "Asante", back: "Danke (Aussprache: ah-SAHN-teh)", langA: 'sw', langB: 'de' },
  { id: 'sw_3', front: "Hapana", back: "Nein (Aussprache: ha-PAH-na)", langA: 'sw', langB: 'de' },
  { id: 'sw_4', front: "Ndiyo", back: "Ja (Aussprache: NDI-yo)", langA: 'sw', langB: 'de' },
  { id: 'sw_5', front: "Tafadhali", back: "Bitte (Aussprache: ta-fad-HA-li)", langA: 'sw', langB: 'de' },
  { id: 'sw_6', front: "Habari yako?", back: "Wie geht es dir? (Aussprache: ha-BAH-ri YAH-ko)", langA: 'sw', langB: 'de' },
  { id: 'sw_7', front: "Anakuja", back: "Er/Sie kommt (Aussprache: a-na-KU-ja)", langA: 'sw', langB: 'de' },
  { id: 'sw_8', front: "Ninakuja", back: "Ich komme (Aussprache: ni-na-KU-ja)", langA: 'sw', langB: 'de' },
  { id: 'sw_9', front: "Nakuja", back: "Ich komme – Kurzform (Aussprache: na-KU-ja)", langA: 'sw', langB: 'de' },
  { id: 'sw_10', front: "Nipee", back: "Gib mir (Aussprache: ni-PEH-eh)", langA: 'sw', langB: 'de' },
  { id: 'sw_11', front: "Sitaki", back: "Ich will nicht (Aussprache: si-TAH-ki)", langA: 'sw', langB: 'de' },
  { id: 'sw_12', front: "Chakula", back: "Essen (Aussprache: cha-KU-la)", langA: 'sw', langB: 'de' },
  { id: 'sw_13', front: "Sahani", back: "Teller (Aussprache: sa-HA-ni)", langA: 'sw', langB: 'de' },
  { id: 'sw_14', front: "Ninakupenda", back: "Ich liebe dich (Aussprache: ni-na-ku-PEN-da)", langA: 'sw', langB: 'de' },
  { id: 'sw_15', front: "Nakukosa", back: "Ich vermisse dich (Aussprache: na-ku-KO-sa)", langA: 'sw', langB: 'de' },
  { id: 'sw_16', front: "Lala salama", back: "Schlaf gut (Aussprache: LA-la sa-LA-ma)", langA: 'sw', langB: 'de' },
]

const ALL_ELOSY_CARDS = [
  { id: 'de_1', front: "Guten Morgen", back: "Good morning", langA: 'de', langB: 'en' },
  { id: 'de_2', front: "Guten Abend", back: "Good evening", langA: 'de', langB: 'en' },
  { id: 'de_3', front: "Wie geht es dir?", back: "How are you?", langA: 'de', langB: 'en' },
  { id: 'de_4', front: "Danke schön", back: "Thank you very much", langA: 'de', langB: 'en' },
  { id: 'de_5', front: "Bitte", back: "Please / You're welcome", langA: 'de', langB: 'en' },
  { id: 'de_6', front: "Ich liebe dich", back: "I love you", langA: 'de', langB: 'en' },
  { id: 'de_7', front: "Ich vermisse dich", back: "I miss you", langA: 'de', langB: 'en' },
  { id: 'de_8', front: "Bis bald", back: "See you soon", langA: 'de', langB: 'en' },
  { id: 'de_9', front: "Ich bin müde", back: "I am tired", langA: 'de', langB: 'en' },
  { id: 'de_10', front: "Ich bin glücklich", back: "I am happy", langA: 'de', langB: 'en' },
  { id: 'de_11', front: "Was machst du?", back: "What are you doing?", langA: 'de', langB: 'en' },
  { id: 'de_12', front: "Ich denke an dich", back: "I am thinking of you", langA: 'de', langB: 'en' },
  { id: 'de_13', front: "Schlaf gut", back: "Sleep well", langA: 'de', langB: 'en' },
  { id: 'de_14', front: "Ich komme bald", back: "I am coming soon", langA: 'de', langB: 'en' },
  { id: 'de_15', front: "Du fehlst mir", back: "I miss you (deeply)", langA: 'de', langB: 'en' },
  { id: 'de_16', front: "Entschuldigung", back: "Sorry / Excuse me", langA: 'de', langB: 'en' },
  { id: 'de_17', front: "Ich verstehe nicht", back: "I don't understand", langA: 'de', langB: 'en' },
  { id: 'de_18', front: "Kannst du das wiederholen?", back: "Can you repeat that?", langA: 'de', langB: 'en' },
  { id: 'de_19', front: "Wie heißt du?", back: "What is your name?", langA: 'de', langB: 'en' },
  { id: 'de_20', front: "Ich heiße...", back: "My name is...", langA: 'de', langB: 'en' },
  { id: 'de_21', front: "Woher kommst du?", back: "Where are you from?", langA: 'de', langB: 'en' },
  { id: 'de_22', front: "Ich komme aus Kenia", back: "I come from Kenya", langA: 'de', langB: 'en' },
  { id: 'de_23', front: "Wie spät ist es?", back: "What time is it?", langA: 'de', langB: 'en' },
  { id: 'de_24', front: "Ich bin hungrig", back: "I am hungry", langA: 'de', langB: 'en' },
  { id: 'de_25', front: "Das ist lecker", back: "That is delicious", langA: 'de', langB: 'en' },
  { id: 'de_26', front: "Ich bin stolz auf dich", back: "I am proud of you", langA: 'de', langB: 'en' },
  { id: 'de_27', front: "Alles wird gut", back: "Everything will be okay", langA: 'de', langB: 'en' },
  { id: 'de_28', front: "Ich freue mich", back: "I am looking forward to it", langA: 'de', langB: 'en' },
  { id: 'de_29', front: "Gute Nacht", back: "Good night", langA: 'de', langB: 'en' },
  { id: 'de_30', front: "Ich lerne Deutsch", back: "I am learning German", langA: 'de', langB: 'en' },
]

function getSpeed(s) {
  if (s < VERY_FAST_S) return 'very_fast'
  if (s < FAST_S) return 'fast'
  if (s < MEDIUM_S) return 'medium'
  return 'slow'
}
function getNewInterval(speed, progress) {
  const cf = progress?.consecutiveFast || 0
  if (speed === 'very_fast') { if (cf >= 3) return 30; if (cf >= 2) return 15; return 7 }
  if (speed === 'fast') return 5
  if (speed === 'medium') return 2
  return 1
}
function getNextReview(days) {
  const d = new Date(); d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}
function todayStr() { return new Date().toISOString().split('T')[0] }
function buildSession(allCards, cardProgress) {
  const today = todayStr()
  const forced = [], due = [], newCards = []
  allCards.forEach(card => {
    const p = cardProgress[card.id]
    if (!p) newCards.push(card)
    else if (p.wrongSessions > 0) forced.push(card)
    else if (p.nextReview <= today) due.push(card)
  })
  const shuffle = arr => [...arr].sort(() => Math.random() - 0.5)
  const addDir = cards => cards.map(c => ({ ...c, reversed: Math.random() > 0.5 }))
  return addDir([...shuffle(forced), ...shuffle(due), ...shuffle(newCards)].slice(0, SESSION_SIZE))
}
function checkMastery(allCards, cardProgress, sessionCorrect, sessionTotal) {
  const active = allCards.filter(c => cardProgress[c.id])
  if (active.length < 10) return false
  if (sessionTotal > 0 && sessionCorrect / sessionTotal < 0.6) return false
  const mastered = active.filter(c => (cardProgress[c.id]?.interval || 0) >= 7)
  return mastered.length / active.length >= MASTERY_THRESHOLD
}
function getNextNewCards(allCards, cardProgress, count) {
  return allCards.filter(c => !cardProgress[c.id]).slice(0, count)
}
function getLangStats(allCards, cardProgress, langCode) {
  const cards = allCards.filter(c => c.langA === langCode)
  const active = cards.filter(c => cardProgress[c.id])
  const mastered = active.filter(c => (cardProgress[c.id]?.interval || 0) >= 7)
  return { total: cards.length, active: active.length, mastered: mastered.length }
}

// ============ SESSION STATE PERSISTENCE ============
async function saveSessionState(uid, queue, index, newProgress) {
  try {
    await setDoc(doc(db, 'users', uid, 'session', 'current'), {
      queue,
      index,
      newProgress,
      savedAt: Date.now(),
    })
  } catch (e) {
    console.warn('Could not save session state:', e)
  }
}

async function clearSessionState(uid) {
  try {
    await deleteDoc(doc(db, 'users', uid, 'session', 'current'))
  } catch (e) {
    console.warn('Could not clear session state:', e)
  }
}

function makeStyles(th) {
  return {
    container: { minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: th.bg },
    homeBox: { textAlign: 'center', padding: '20px', width: '100%', maxWidth: '420px' },
    greeting: { color: th.sub, fontSize: '0.95rem', marginBottom: '2px' },
    title: { color: th.gold, fontSize: 'clamp(1.8rem, 7vw, 2.6rem)', marginBottom: '20px', fontWeight: 'bold' },
    slogan: { color: th.sub, fontSize: '1rem', marginBottom: '32px', lineHeight: '1.8' },
    card: { background: th.card, borderRadius: '12px', padding: '16px', marginBottom: '10px', textAlign: 'left', border: `1px solid ${th.border}` },
    bigCard: { background: th.card, borderRadius: '16px', padding: '28px 20px', marginBottom: '16px', textAlign: 'center', minHeight: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `1px solid ${th.border}` },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', width: '100%' },
    cardLabel: { color: th.sub, fontSize: '0.75rem', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' },
    langRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
    lang: { color: th.text, fontSize: '0.95rem' },
    langPct: { color: th.gold, fontSize: '0.85rem' },
    noPartner: { color: th.sub, fontSize: '0.85rem', fontStyle: 'italic', margin: 0 },
    cardFront: { color: th.text, fontSize: 'clamp(1rem, 4vw, 1.3rem)', marginBottom: '16px', fontWeight: 'bold' },
    cardBack: { color: th.accent, fontSize: 'clamp(0.9rem, 3vw, 1.1rem)', marginBottom: '20px' },
    dirLabel: { fontSize: '0.8rem', color: th.sub, marginBottom: '12px', letterSpacing: '1px' },
    progressBar: { height: '4px', background: th.border, borderRadius: '2px', marginTop: '4px', overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: '2px', transition: 'width 0.5s ease', background: th.accent },
    button: { background: th.accent, color: '#fff', border: 'none', padding: '13px 28px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold', width: '100%', marginBottom: '8px' },
    menuBtn: { background: th.card, color: th.text, border: `1px solid ${th.border}`, padding: '14px 16px', borderRadius: '10px', fontSize: '0.95rem', cursor: 'pointer', fontWeight: '500', width: '100%', marginBottom: '8px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' },
    menuBtnDisabled: { background: th.card, color: th.sub, border: `1px solid ${th.border}`, padding: '14px 16px', borderRadius: '10px', fontSize: '0.95rem', cursor: 'not-allowed', fontWeight: '400', width: '100%', marginBottom: '8px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.45 },
    menuBtnActive: { background: th.accent + '22', color: th.text, border: `1px solid ${th.accent}`, padding: '14px 16px', borderRadius: '10px', fontSize: '0.95rem', cursor: 'pointer', fontWeight: '500', width: '100%', marginBottom: '8px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' },
    optionBtn: (selected, correct, revealed) => {
      let bg = th.card; let border = `1px solid ${th.border}`
      if (revealed && correct) { bg = '#4CAF5022'; border = '2px solid #4CAF50' }
      else if (revealed && selected && !correct) { bg = '#f4433622'; border = '2px solid #f44336' }
      else if (selected) { bg = th.accent + '22'; border = `2px solid ${th.accent}` }
      return { background: bg, color: th.text, border, padding: '12px 16px', borderRadius: '8px', fontSize: '0.9rem', cursor: revealed ? 'default' : 'pointer', width: '100%', marginBottom: '8px', textAlign: 'left' }
    },
    revealBtn: { background: th.border, color: th.text, border: 'none', padding: '12px 24px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' },
    answerRow: { display: 'flex', gap: '10px', width: '100%' },
    wrongBtn: { flex: 1, background: '#f44336', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' },
    rightBtn: { flex: 1, background: '#4CAF50', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' },
    stopBtn: { background: 'transparent', color: '#f44336', border: '1px solid #f44336', padding: '5px 10px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' },
    logoutBtn: { background: 'transparent', color: th.sub, border: `1px solid ${th.border}`, padding: '10px 24px', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer', width: '100%', marginTop: '4px' },
    error: { color: '#ff6b6b', fontSize: '0.85rem', marginTop: '16px' },
    themeRow: { display: 'flex', gap: '8px', marginBottom: '12px' },
    themeBtn: (active, color) => ({ flex: 1, padding: '10px 4px', borderRadius: '8px', border: active ? `2px solid ${color}` : `1px solid ${th.border}`, background: active ? color + '22' : th.card, color: th.text, cursor: 'pointer', fontSize: '0.75rem', fontWeight: active ? 'bold' : 'normal' }),
    backBtn: { background: 'transparent', color: th.sub, border: 'none', padding: '6px 0', fontSize: '0.9rem', cursor: 'pointer', marginBottom: '12px', textAlign: 'left', display: 'block' },
    headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' },
    input: { width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${th.border}`, background: th.card, color: th.text, fontSize: '1rem', marginBottom: '10px', boxSizing: 'border-box' },
    langSelectBtn: (selected) => ({ padding: '10px 14px', borderRadius: '8px', border: selected ? `2px solid ${th.accent}` : `1px solid ${th.border}`, background: selected ? th.accent + '22' : th.card, color: th.text, cursor: 'pointer', fontSize: '0.9rem', marginBottom: '8px', width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }),
    infoBox: { background: th.accent + '22', border: `1px solid ${th.accent}`, borderRadius: '8px', padding: '12px', marginBottom: '10px', color: th.text, fontSize: '0.9rem' },
    resumeBanner: { background: th.card, border: `1px solid ${th.accent}`, borderRadius: '12px', padding: '14px 16px', marginBottom: '12px', textAlign: 'left' },
  }
}

const T = {
  de: {
    hello: 'Hallo', login: 'Mit Google anmelden',
    mySession: '🃏 Meine Session', whereAmI: '🎯 Wo stehe ich?',
    aiChat: '🤖 KI-Gespräch', dailyPhrase: '☀️ Tages-Phrase',
    progressBtn: '📈 Fortschritt', logout: 'Abmelden',
    myProgress: 'Dein Fortschritt', partnerLearning: 'Partner lernt',
    notActive: 'Noch kein Partner',
    card: 'Karte', of: 'von', showSolution: 'Lösung anzeigen',
    correct: 'Richtig', wrong: 'Falsch', stop: '✕ Beenden',
    stopConfirm: 'Session wirklich beenden?', done: 'Fertig!', back: 'Zurück',
    masteryMsg: '85% gemeistert — 5 neue Karten freigeschaltet!',
    comingSoon: 'Kommt bald', chooseTheme: 'Wähle dein Theme', settingsTitle: 'Einstellungen',
    partnerTitle: '🤝 Partner verbinden',
    partnerInvite: 'Teile diesen Link mit deinem Partner:',
    partnerCopy: 'Link kopieren', partnerCopied: '✓ Kopiert!',
    partnerCode: 'Oder gib den Code deines Partners ein:',
    partnerConnect: 'Verbinden', partnerConnected: 'Partner verbunden ✓',
    partnerDisconnect: 'Verbindung trennen', partnerAccept: 'Annehmen', partnerDecline: 'Ablehnen',
    langSetupTitle: 'Welche Sprachen lernst du?', langSetupSub: 'Wähle 1 bis 3 Sprachen', langSetupDone: 'Weiter',
    testTitle: '🎯 Wo stehe ich?', testQuestion: 'Frage', testOf: 'von',
    testDone: 'Dein Niveau:', testResult: 'Ergebnis', testAgain: 'Test wiederholen', testBack: 'Zurück zum Menü',
    testLevel: 'CEFR-Niveau', testScore: 'Richtig beantwortet',
    testStop3: '3 falsch hintereinander — Test endet hier.',
    resumeTitle: '⚡ Unterbrochene Session',
    resumeOf: 'von',
    resumeCards: 'Karten beantwortet',
    resumeContinue: 'Weiter machen',
    resumeDiscard: 'Verwerfen',
  },
  en: {
    hello: 'Hello', login: 'Sign in with Google',
    mySession: '🃏 My session', whereAmI: '🎯 Where do I stand?',
    aiChat: '🤖 AI conversation', dailyPhrase: '☀️ Phrase of the day',
    progressBtn: '📈 Progress', logout: 'Sign out',
    myProgress: 'Your progress', partnerLearning: 'Partner is learning',
    notActive: 'No partner yet',
    card: 'Card', of: 'of', showSolution: 'Show answer',
    correct: 'Correct', wrong: 'Wrong', stop: '✕ Stop',
    stopConfirm: 'Stop this session?', done: 'Done!', back: 'Back',
    masteryMsg: '85% mastered — 5 new cards unlocked!',
    comingSoon: 'Coming soon', chooseTheme: 'Choose your theme', settingsTitle: 'Settings',
    partnerTitle: '🤝 Connect partner',
    partnerInvite: 'Share this link with your partner:',
    partnerCopy: 'Copy link', partnerCopied: '✓ Copied!',
    partnerCode: "Or enter your partner's code:",
    partnerConnect: 'Connect', partnerConnected: 'Partner connected ✓',
    partnerDisconnect: 'Disconnect', partnerAccept: 'Accept', partnerDecline: 'Decline',
    langSetupTitle: 'Which languages are you learning?', langSetupSub: 'Choose 1 to 3 languages', langSetupDone: 'Continue',
    testTitle: '🎯 Where do I stand?', testQuestion: 'Question', testOf: 'of',
    testDone: 'Your level:', testResult: 'Result', testAgain: 'Retake test', testBack: 'Back to menu',
    testLevel: 'CEFR Level', testScore: 'Correct answers',
    testStop3: '3 wrong in a row — test ends here.',
    resumeTitle: '⚡ Interrupted session',
    resumeOf: 'of',
    resumeCards: 'cards answered',
    resumeContinue: 'Continue',
    resumeDiscard: 'Discard',
  }
}

// ============ EINSTUFUNGSTEST ============
function PlacementTest({ lang, theme, user, onBack, onSaveCefr }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const t = T[lang]
  const questions = lang === 'de' ? PLACEMENT_EN : PLACEMENT_DE
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [revealed, setRevealed] = useState(false)
  const [wrongStreak, setWrongStreak] = useState(0)
  const [scores, setScores] = useState({})
  const [done, setDone] = useState(false)
  const [finalLevel, setFinalLevel] = useState(null)
  const [stopped, setStopped] = useState(false)

  const q = questions[index]

  const calcLevel = (sc) => {
    for (let i = CEFR_LEVELS.length - 1; i >= 0; i--) {
      const lvl = CEFR_LEVELS[i]
      const data = sc[lvl]
      if (data && data.correct / data.total >= 0.6) return lvl
    }
    return 'A1'
  }

  const handleSelect = (optIdx) => {
    if (revealed) return
    setSelected(optIdx)
    setRevealed(true)
    const isCorrect = optIdx === q.correct
    const lvl = q.level
    const prev = scores[lvl] || { correct: 0, total: 0 }
    const newScores = { ...scores, [lvl]: { correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 } }
    setScores(newScores)

    const newStreak = isCorrect ? 0 : wrongStreak + 1

    setTimeout(() => {
      if (newStreak >= 3 || index + 1 >= questions.length) {
        const level = calcLevel(newScores)
        setFinalLevel(level)
        setDone(true)
        setStopped(newStreak >= 3)
        onSaveCefr(level)
      } else {
        setWrongStreak(newStreak)
        setIndex(i => i + 1)
        setSelected(null)
        setRevealed(false)
      }
    }, 1200)
  }

  if (done) {
    const totalCorrect = Object.values(scores).reduce((a, b) => a + b.correct, 0)
    const totalQ = Object.values(scores).reduce((a, b) => a + b.total, 0)
    return (
      <div style={s.container}>
        <div style={s.homeBox}>
          <button style={s.backBtn} onClick={onBack}>← {t.back}</button>
          <h2 style={{ color: th.gold, fontSize: '1.3rem', marginBottom: '8px' }}>{t.testDone}</h2>
          <div style={{ background: CEFR_COLORS[finalLevel] + '22', border: `2px solid ${CEFR_COLORS[finalLevel]}`, borderRadius: '16px', padding: '24px', marginBottom: '16px' }}>
            <p style={{ color: CEFR_COLORS[finalLevel], fontSize: '3rem', fontWeight: 'bold', margin: 0 }}>{finalLevel}</p>
            <p style={{ color: th.text, margin: '8px 0 0 0', fontSize: '1.1rem' }}>{CEFR_DESC[lang][finalLevel]}</p>
          </div>
          {stopped && <p style={{ color: th.sub, fontSize: '0.85rem', marginBottom: '12px' }}>{t.testStop3}</p>}
          <div style={s.card}>
            {CEFR_LEVELS.map(lvl => scores[lvl] ? (
              <div key={lvl} style={{ ...s.langRow, marginBottom: '8px' }}>
                <span style={{ color: CEFR_COLORS[lvl], fontWeight: 'bold', fontSize: '0.9rem' }}>{lvl}</span>
                <span style={s.langPct}>{scores[lvl].correct}/{scores[lvl].total}</span>
              </div>
            ) : null)}
            <div style={{ ...s.langRow, marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${th.border}` }}>
              <span style={s.lang}>{t.testScore}</span>
              <span style={s.langPct}>{totalCorrect}/{totalQ}</span>
            </div>
          </div>
          <button style={s.button} onClick={onBack}>{t.testBack}</button>
        </div>
      </div>
    )
  }

  const pct = (index / questions.length) * 100

  return (
    <div style={s.container}>
      <div style={s.homeBox}>
        <div style={s.cardHeader}>
          <div>
            <p style={s.greeting}>{t.testQuestion} {index + 1} {t.testOf} {questions.length}</p>
            <span style={{ color: CEFR_COLORS[q.level], fontSize: '0.75rem', fontWeight: 'bold' }}>{q.level}</span>
          </div>
          <button style={s.stopBtn} onClick={onBack}>{t.stop}</button>
        </div>
        <div style={s.progressBar}>
          <div style={{ ...s.progressFill, width: `${pct}%`, background: CEFR_COLORS[q.level] }} />
        </div>
        <div style={{ ...s.bigCard, marginTop: '12px', minHeight: '100px' }}>
          <p style={{ ...s.cardFront, marginBottom: 0 }}>{q.question}</p>
        </div>
        {q.options.map((opt, i) => (
          <button
            key={i}
            style={s.optionBtn(selected === i, i === q.correct, revealed)}
            onClick={() => handleSelect(i)}
          >
            {String.fromCharCode(65 + i)}. {opt ?? '—'}
          </button>
        ))}
      </div>
    </div>
  )
}

// ============ LOGIN ============
function LoginScreen({ theme }) {
  const [error, setError] = useState(null)
  const th = THEMES[theme]; const s = makeStyles(th)
  const handleLogin = async () => {
    setError(null)
    const provider = new GoogleAuthProvider()
    provider.setCustomParameters({ prompt: 'select_account' })
    try { await signInWithPopup(auth, provider) }
    catch (err) { setError(err.message) }
  }
  return (
    <div style={s.container}>
      <div style={{ textAlign: 'center', padding: '24px', maxWidth: '380px', width: '100%' }}>
        <h1 style={s.title}>Vocara</h1>
        <p style={s.slogan}>Die Stimme ist die Brücke.<br /><span style={{ fontSize: '0.85rem' }}>The voice is the bridge.</span></p>
        <button style={s.button} onClick={handleLogin}>Mit Google anmelden / Sign in with Google</button>
        {error && <p style={s.error}>{error}</p>}
      </div>
    </div>
  )
}

function LangSetupScreen({ user, lang, theme, onDone }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const t = T[lang]
  const [selected, setSelected] = useState([])
  const toggle = (code) => {
    if (selected.includes(code)) setSelected(selected.filter(c => c !== code))
    else if (selected.length < 3) setSelected([...selected, code])
  }
  const handleDone = async () => {
    if (selected.length === 0) return
    await updateDoc(doc(db, 'users', user.uid), { languages: selected })
    onDone(selected)
  }
  return (
    <div style={s.container}>
      <div style={s.homeBox}>
        <h1 style={{ ...s.title, marginBottom: '8px' }}>Vocara</h1>
        <p style={{ color: th.text, fontWeight: 'bold', marginBottom: '4px' }}>{t.langSetupTitle}</p>
        <p style={{ color: th.sub, fontSize: '0.85rem', marginBottom: '16px' }}>{t.langSetupSub}</p>
        <div style={s.card}>
          {AVAILABLE_LANGS.map(l => (
            <button key={l.code} style={s.langSelectBtn(selected.includes(l.code))} onClick={() => toggle(l.code)}>
              <span>{l.flag} {l.label}</span>
              {selected.includes(l.code) && <span style={{ color: th.accent }}>✓ #{selected.indexOf(l.code) + 1}</span>}
            </button>
          ))}
        </div>
        <button style={{ ...s.button, opacity: selected.length === 0 ? 0.5 : 1 }} onClick={handleDone} disabled={selected.length === 0}>{t.langSetupDone} →</button>
      </div>
    </div>
  )
}

function PartnerScreen({ user, myData, lang, theme, onBack, onPartnerUpdate }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const t = T[lang]
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
    if (code.length < 6) return
    setStatus('Suche...')
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
    onPartnerUpdate(partnerUID)
    setPendingData(null)
    window.history.replaceState({}, '', window.location.pathname)
  }

  const disconnect = async () => {
    if (!window.confirm('Partner wirklich trennen?')) return
    const partnerUID = myData.partnerUID
    await updateDoc(doc(db, 'users', user.uid), { partnerUID: null, partnerName: null })
    if (partnerUID) { try { await updateDoc(doc(db, 'users', partnerUID), { partnerUID: null, partnerName: null }) } catch {} }
    onPartnerUpdate(null)
  }

  return (
    <div style={s.container}>
      <div style={s.homeBox}>
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
      </div>
    </div>
  )
}

// ============ CARD SCREEN ============
// Props: session, onBack, onFinish, lang, cardProgress, s, onSaveState, startIndex, startProgress
function CardScreen({ session, onBack, onFinish, lang, cardProgress, s, onSaveState, startIndex = 0, startProgress = null }) {
  const [index, setIndex] = useState(startIndex)
  const [queue, setQueue] = useState(session)
  const [revealed, setRevealed] = useState(false)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [newProgress, setNewProgress] = useState(startProgress || { ...cardProgress })
  const startTime = useRef(Date.now())
  const t = T[lang]
  const item = queue[index]
  const isReversed = item.reversed
  const question = isReversed ? item.back : item.front
  const answer = isReversed ? item.front : item.back
  const fromLang = isReversed ? item.langB : item.langA
  const toLang = isReversed ? item.langA : item.langB

  const handleReveal = () => { startTime.current = Date.now(); setRevealed(true) }
  const handleStop = () => { if (window.confirm(t.stopConfirm)) onBack() }

  const handleAnswer = (isCorrect) => {
    const elapsed = (Date.now() - startTime.current) / 1000
    const speed = getSpeed(elapsed)
    const cardId = item.id
    const prev = newProgress[cardId] || { interval: 0, consecutiveFast: 0, wrongSessions: 0 }

    if (!isCorrect) {
      const updatedProgress = { ...prev, interval: 0, consecutiveFast: 0, wrongSessions: 3, nextReview: todayStr() }
      const finalNewProgress = { ...newProgress, [cardId]: updatedProgress }
      const newQueue = [...queue]; newQueue.splice(index, 1); newQueue.push({ ...item, reversed: Math.random() > 0.5 })
      setQueue(newQueue)
      setNewProgress(finalNewProgress)
      setWrong(w => w + 1)
      setRevealed(false)
      // Save state after wrong answer (index stays the same, queue changed)
      onSaveState?.(newQueue, index, finalNewProgress)
    } else {
      const newCF = speed === 'very_fast' ? (prev.consecutiveFast || 0) + 1 : 0
      const interval = getNewInterval(speed, { consecutiveFast: newCF })
      const updatedProgress = { ...prev, interval, consecutiveFast: newCF, wrongSessions: Math.max(0, (prev.wrongSessions || 0) - 1), nextReview: getNextReview(interval) }
      const finalProgress = { ...newProgress, [cardId]: updatedProgress }
      setNewProgress(finalProgress)
      const newCorrect = correct + 1
      setCorrect(newCorrect)
      if (index + 1 >= queue.length) {
        // Session complete — onFinish will clear state
        onFinish(finalProgress, newCorrect, wrong)
        return
      }
      setIndex(i => i + 1)
      setRevealed(false)
      // Save state after correct answer
      onSaveState?.(queue, index + 1, finalProgress)
    }
  }

  return (
    <div style={s.container}>
      <div style={s.homeBox}>
        <div style={s.cardHeader}>
          <p style={s.greeting}>{t.card} {index + 1} {t.of} {queue.length}</p>
          <button style={s.stopBtn} onClick={handleStop}>{t.stop}</button>
        </div>
        <div style={s.bigCard}>
          <p style={s.dirLabel}>{LANG_FLAGS[fromLang]} → {LANG_FLAGS[toLang]}</p>
          <p style={s.cardFront}>{question}</p>
          {revealed && <p style={s.cardBack}>{answer}</p>}
          {!revealed && <button style={s.revealBtn} onClick={handleReveal}>{t.showSolution}</button>}
          {revealed && (
            <div style={s.answerRow}>
              <button style={s.wrongBtn} onClick={() => handleAnswer(false)}>✗ {t.wrong}</button>
              <button style={s.rightBtn} onClick={() => handleAnswer(true)}>✓ {t.correct}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ResultScreen({ correct, wrong, masteryUnlocked, t, onBack, s }) {
  return (
    <div style={s.container}>
      <div style={s.homeBox}>
        <h1 style={s.title}>{t.done} 🎉</h1>
        {masteryUnlocked && (
          <div style={{ ...s.card, borderLeft: '3px solid #4CAF50' }}>
            <p style={{ color: '#4CAF50', margin: 0, fontSize: '0.85rem' }}>{t.masteryMsg}</p>
          </div>
        )}
        <div style={s.card}>
          <div style={s.langRow}><span style={s.lang}>{t.correct}</span><span style={{ ...s.langPct, color: '#4CAF50' }}>{correct}</span></div>
          <div style={s.langRow}><span style={s.lang}>{t.wrong}</span><span style={{ ...s.langPct, color: '#f44336' }}>{wrong}</span></div>
        </div>
        <button style={s.button} onClick={onBack}>{t.back}</button>
      </div>
    </div>
  )
}

function SettingsScreen({ t, s, theme, onThemeChange, onBack }) {
  return (
    <div style={s.container}>
      <div style={s.homeBox}>
        <button style={s.backBtn} onClick={onBack}>← {t.back}</button>
        <h2 style={{ color: s.lang.color, marginBottom: '20px', fontSize: '1.3rem' }}>⚙️ {t.settingsTitle}</h2>
        <div style={s.card}>
          <p style={s.cardLabel}>{t.chooseTheme}</p>
          <div style={s.themeRow}>
            {Object.entries(THEMES).map(([key, th]) => (
              <button key={key} style={s.themeBtn(theme === key, th.accent)} onClick={() => onThemeChange(key)}>{th.name}</button>
            ))}
          </div>
        </div>
        <div style={{ ...s.card, opacity: 0.4 }}>
          <p style={s.cardLabel}>{t.comingSoon}</p>
          <p style={s.noPartner}>Sprachen bearbeiten • Benachrichtigungen • Stumm-Modus</p>
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, mastered, active, total, s }) {
  const pct = active > 0 ? Math.round((mastered / active) * 100) : 0
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={s.langRow}>
        <span style={{ ...s.lang, fontSize: '0.9rem' }}>{label}</span>
        <span style={{ ...s.langPct, fontSize: '0.8rem' }}>{mastered}/{active} ✓ · {active}/{total}</span>
      </div>
      <div style={s.progressBar}><div style={{ ...s.progressFill, width: `${pct}%` }} /></div>
    </div>
  )
}

function MenuScreen({ user, myData, partnerData, allCards, lang, onSaveProgress, theme, onThemeChange, onPartnerUpdate, onSaveCefr }) {
  const [screen, setScreen] = useState('menu')
  const [session, setSession] = useState(null)
  const [result, setResult] = useState(null)
  const [masteryUnlocked, setMasteryUnlocked] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)
  // Session resume state
  const [pendingSession, setPendingSession] = useState(null)
  const [resumeStartIndex, setResumeStartIndex] = useState(0)
  const [resumeStartProgress, setResumeStartProgress] = useState(null)

  const t = T[lang]
  const th = THEMES[theme]; const s = makeStyles(th)
  const firstName = user.displayName?.split(' ')[0] || user.displayName
  const cardProgress = myData?.cardProgress || {}
  const isMarkLang = lang === 'de'
  const cefr = myData?.cefr

  const enStats = isMarkLang ? getLangStats(allCards, cardProgress, 'en') : null
  const swStats = isMarkLang ? getLangStats(allCards, cardProgress, 'sw') : null
  const deStats = !isMarkLang ? getLangStats(allCards, cardProgress, 'de') : null
  const partnerProgress = partnerData?.cardProgress || {}
  const partnerMastered = Object.values(partnerProgress).filter(p => (p?.interval || 0) >= 7).length
  const partnerActive = Object.keys(partnerProgress).length
  const partnerName = myData?.partnerName || partnerData?.name?.split(' ')[0] || 'Partner'

  // Check for pending session whenever we land on the menu screen
  useEffect(() => {
    if (screen !== 'menu') return
    const checkPending = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid, 'session', 'current'))
        if (snap.exists()) {
          setPendingSession(snap.data())
        } else {
          setPendingSession(null)
        }
      } catch (e) {
        console.warn('Could not check pending session:', e)
      }
    }
    checkPending()
  }, [screen])

  const startSession = () => {
    const sess = buildSession(allCards, cardProgress)
    setSession(sess)
    setResumeStartIndex(0)
    setResumeStartProgress(null)
    setPendingSession(null)
    setScreen('cards')
  }

  const resumeSession = () => {
    if (!pendingSession) return
    setSession(pendingSession.queue)
    setResumeStartIndex(pendingSession.index || 0)
    setResumeStartProgress(pendingSession.newProgress || null)
    setPendingSession(null)
    setScreen('cards')
  }

  const discardSession = async () => {
    await clearSessionState(user.uid)
    setPendingSession(null)
  }

  // Called by CardScreen after every answered card
  const handleSaveState = async (queue, index, newProgress) => {
    await saveSessionState(user.uid, queue, index, newProgress)
  }

  const handleFinish = async (finalProgress, correct, wrong) => {
    let unlocked = false
    if (checkMastery(allCards, finalProgress, correct, correct + wrong)) {
      const newBatch = getNextNewCards(allCards, finalProgress, NEW_CARDS_BATCH)
      if (newBatch.length > 0) {
        newBatch.forEach(card => { finalProgress[card.id] = { interval: 0, consecutiveFast: 0, wrongSessions: 0, nextReview: todayStr() } })
        unlocked = true
      }
    }
    setMasteryUnlocked(unlocked)
    await onSaveProgress(finalProgress)
    // Clear the saved session state — session is done
    await clearSessionState(user.uid)
    setResult({ correct, wrong }); setScreen('result')
  }

  if (screen === 'cards' && session) return (
    <CardScreen
      session={session}
      onBack={() => setScreen('menu')}
      onFinish={handleFinish}
      lang={lang}
      cardProgress={cardProgress}
      s={s}
      onSaveState={handleSaveState}
      startIndex={resumeStartIndex}
      startProgress={resumeStartProgress}
    />
  )
  if (screen === 'result') return <ResultScreen correct={result.correct} wrong={result.wrong} masteryUnlocked={masteryUnlocked} t={t} onBack={() => { setScreen('menu'); setSession(null) }} s={s} />
  if (screen === 'settings') return <SettingsScreen t={t} s={s} theme={theme} onThemeChange={onThemeChange} onBack={() => setScreen('menu')} />
  if (screen === 'partner') return <PartnerScreen user={user} myData={myData} lang={lang} theme={theme} onBack={() => setScreen('menu')} onPartnerUpdate={(uid) => { onPartnerUpdate(uid); setScreen('menu') }} />
  if (screen === 'test') return <PlacementTest lang={lang} theme={theme} user={user} onBack={() => setScreen('menu')} onSaveCefr={onSaveCefr} />

  return (
    <div style={s.container}>
      <div style={s.homeBox}>
        <div style={s.headerRow}>
          <p style={s.greeting}>{t.hello}, {firstName} 👋</p>
          <button style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }} onClick={() => setScreen('settings')}>⚙️</button>
        </div>
        <h1 style={s.title}>Vocara</h1>

        {/* ===== RESUME BANNER ===== */}
        {pendingSession && (
          <div style={s.resumeBanner}>
            <p style={{ color: th.text, margin: '0 0 10px 0', fontSize: '0.9rem' }}>
              {t.resumeTitle} — {pendingSession.index ?? '?'} {t.resumeOf} {pendingSession.queue?.length ?? '?'} {t.resumeCards}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={{ ...s.button, marginBottom: 0, flex: 1, padding: '10px' }} onClick={resumeSession}>
                {t.resumeContinue}
              </button>
              <button style={{ ...s.logoutBtn, marginTop: 0, flex: 1, padding: '10px', textAlign: 'center' }} onClick={discardSession}>
                {t.resumeDiscard}
              </button>
            </div>
          </div>
        )}

        <button style={s.menuBtn} onClick={() => setScreen('test')}>
          {t.whereAmI}
          {cefr && <span style={{ marginLeft: 'auto', color: CEFR_COLORS[cefr], fontWeight: 'bold', fontSize: '0.85rem' }}>{cefr}</span>}
        </button>
        <button style={s.menuBtn} onClick={startSession}>{t.mySession}</button>

        <button style={progressOpen ? s.menuBtnActive : s.menuBtn} onClick={() => setProgressOpen(o => !o)}>
          {t.progressBtn} <span style={{ marginLeft: 'auto' }}>{progressOpen ? '▲' : '▼'}</span>
        </button>
        {progressOpen && (
          <div style={{ ...s.card, marginTop: '-4px', borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
            <p style={s.cardLabel}>{t.myProgress}</p>
            {isMarkLang ? (
              <>
                <StatRow label="Englisch" mastered={enStats.mastered} active={enStats.active} total={enStats.total} s={s} />
                <StatRow label="Swahili" mastered={swStats.mastered} active={swStats.active} total={swStats.total} s={s} />
              </>
            ) : (
              <StatRow label="Deutsch" mastered={deStats.mastered} active={deStats.active} total={deStats.total} s={s} />
            )}
            {myData?.partnerUID || [MARK_UID, ELOSY_UID].includes(user.uid) ? (
              <div style={{ ...s.langRow, marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${th.border}` }}>
                <span style={{ ...s.lang, fontSize: '0.85rem' }}>{partnerName}</span>
                <span style={{ ...s.langPct, fontSize: '0.8rem' }}>{partnerMastered}/{partnerActive} ✓</span>
              </div>
            ) : (
              <p style={{ ...s.noPartner, marginTop: '8px' }}>
                {t.notActive} — <span style={{ color: th.accent, cursor: 'pointer' }} onClick={() => setScreen('partner')}>verbinden →</span>
              </p>
            )}
          </div>
        )}

        <button style={s.menuBtn} onClick={() => setScreen('partner')}>
          🤝 {myData?.partnerUID ? partnerName : (lang === 'de' ? 'Partner verbinden' : 'Connect partner')}
        </button>
        <button style={s.menuBtnDisabled} disabled>{t.aiChat} <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>bald</span></button>
        <button style={s.menuBtnDisabled} disabled>{t.dailyPhrase} <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>bald</span></button>
        <button style={s.logoutBtn} onClick={() => signOut(auth)}>{t.logout}</button>
      </div>
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [myData, setMyData] = useState(null)
  const [partnerData, setPartnerData] = useState(null)
  const [theme, setTheme] = useState('nairobi')
  const [needsLangSetup, setNeedsLangSetup] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        const userRef = doc(db, 'users', u.uid)
        await setDoc(userRef, { name: u.displayName, email: u.email, lastActive: todayStr() }, { merge: true })
        const code = u.uid.slice(0, 8).toUpperCase()
        await setDoc(doc(db, 'inviteCodes', code), { uid: u.uid }, { merge: true })
        const snap = await getDoc(userRef)
        if (snap.exists()) {
          const data = snap.data()
          setMyData(data)
          if (data.theme) setTheme(data.theme)
          const isKnown = u.uid === MARK_UID || u.uid === ELOSY_UID
          if (!isKnown && (!data.languages || data.languages.length === 0)) setNeedsLangSetup(true)
          if (data.partnerUID) {
            const pSnap = await getDoc(doc(db, 'users', data.partnerUID))
            if (pSnap.exists()) setPartnerData(pSnap.data())
          } else {
            const partnerUID = u.uid === MARK_UID ? ELOSY_UID : u.uid === ELOSY_UID ? MARK_UID : null
            if (partnerUID) {
              const pSnap = await getDoc(doc(db, 'users', partnerUID))
              if (pSnap.exists()) setPartnerData(pSnap.data())
            }
          }
        }
      }
      setUser(u); setLoading(false)
    })
    return unsubscribe
  }, [])

  const saveProgress = async (finalProgress) => {
    const ref = doc(db, 'users', user.uid)
    await updateDoc(ref, { cardProgress: finalProgress })
    const snap = await getDoc(ref)
    if (snap.exists()) setMyData(snap.data())
  }

  const handleThemeChange = async (newTheme) => {
    setTheme(newTheme)
    if (user) await updateDoc(doc(db, 'users', user.uid), { theme: newTheme })
  }

  const handlePartnerUpdate = async (partnerUID) => {
    const ref = doc(db, 'users', user.uid)
    const snap = await getDoc(ref)
    if (snap.exists()) setMyData(snap.data())
    if (partnerUID) {
      const pSnap = await getDoc(doc(db, 'users', partnerUID))
      if (pSnap.exists()) setPartnerData(pSnap.data())
    } else setPartnerData(null)
  }

  const handleSaveCefr = async (level) => {
    await updateDoc(doc(db, 'users', user.uid), { cefr: level })
    setMyData(d => ({ ...d, cefr: level }))
  }

  const th = THEMES[theme]
  const isElosy = user?.uid === ELOSY_UID
  const lang = isElosy ? 'en' : 'de'

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: th.bg, color: th.text }}>Laden...</div>
  if (!user) return <LoginScreen theme={theme} />
  if (needsLangSetup) return <LangSetupScreen user={user} lang={lang} theme={theme} onDone={(langs) => { setNeedsLangSetup(false); setMyData(d => ({ ...d, languages: langs })) }} />

  return (
    <MenuScreen
      user={user} myData={myData} partnerData={partnerData}
      allCards={isElosy ? ALL_ELOSY_CARDS : ALL_MARK_CARDS}
      lang={lang} onSaveProgress={saveProgress}
      theme={theme} onThemeChange={handleThemeChange}
      onPartnerUpdate={handlePartnerUpdate}
      onSaveCefr={handleSaveCefr}
    />
  )
}

export default App