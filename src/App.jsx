import { useState, useEffect, useRef } from 'react'
import { auth, db } from './firebase'
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import './App.css'

const MARK_UID = 'aiNZh4Myn8Y0KfYkGGrkNNW0HC72'
const ELOSY_UID = 'NIX3DYenRdbRjmr2EHsIad9GcqG3'
const SESSION_SIZE = 15
const MASTERY_THRESHOLD = 0.85
const NEW_CARDS_BATCH = 3
const VERY_FAST_S = 3
const FAST_S = 7
const MEDIUM_S = 15
const MONTHLY_TEST_DAYS = 30

const THEMES = {
  nairobi: {
    name: '🌙 Nairobi',
    bg: '#0f0a05', card: '#1a1208', text: '#fff', sub: '#B8860B', border: '#2a1f10',
    accent: '#FFD700', gold: '#FFF0A0', glowColor: '#FFD700', btnTextColor: '#111',
    bgGrad: 'radial-gradient(ellipse at 50% 30%, #201508 0%, #0f0a05 55%, #080502 100%)',
    metalGrad: 'linear-gradient(145deg, #FFF0A0 0%, #FFD700 30%, #B8860B 52%, #D4AF37 72%, #FFF0A0 100%)',
    metalText: 'linear-gradient(90deg, #5C4008 0%, #FFF8D0 16%, #8B6914 33%, #FFF0A0 50%, #5C4008 66%, #FFF8D0 83%, #8B6914 100%)',
    btnFaceGrad: 'linear-gradient(90deg, #3A2004 0%, #FFD700 16%, #8B6914 33%, #FFE566 50%, #3A2004 66%, #FFD700 83%, #8B6914 100%)',
    shadow3d: '0 1px 0 rgba(255,255,200,0.35) inset, 0 -1px 0 rgba(0,0,0,0.5) inset, 0 4px 0 #B8860B, 0 6px 0 #8B6914, 0 8px 0 #5A4008, 0 10px 20px rgba(0,0,0,0.75)',
    shadowPressed: '0 1px 0 rgba(255,255,200,0.15) inset, 0 -1px 0 rgba(0,0,0,0.4) inset, 0 1px 0 #8B6914, 0 3px 8px rgba(0,0,0,0.6)',
  },
  hamburg: {
    name: '🌊 Hamburg',
    bg: '#0D1F33', card: '#162840', text: '#E8F4FF', sub: '#4A80A8', border: '#1B3A5C',
    accent: '#8B3A2A', gold: '#C4704A', glowColor: '#2E6B9E', btnTextColor: '#E8F4FF',
    bgGrad: 'radial-gradient(ellipse at 50% 30%, #1B3A5C 0%, #0D1F33 55%, #050D1A 100%)',
    metalGrad: 'linear-gradient(145deg, #3A8CC0 0%, #1B3A5C 30%, #8B3A2A 52%, #1B3A5C 72%, #3A8CC0 100%)',
    metalText: 'linear-gradient(90deg, #05111F 0%, #6BB8E0 16%, #2E6B9E 33%, #A8D8F0 50%, #05111F 66%, #6BB8E0 83%, #2E6B9E 100%)',
    btnFaceGrad: 'linear-gradient(90deg, #05111F 0%, #3A8CC0 16%, #1B3A5C 33%, #3A8CC0 50%, #05111F 66%, #3A8CC0 83%, #1B3A5C 100%)',
    shadow3d: '0 1px 0 rgba(120,200,255,0.25) inset, 0 -1px 0 rgba(0,0,0,0.5) inset, 0 4px 0 #8B3A2A, 0 6px 0 #6B2A1A, 0 8px 0 #3B1A0A, 0 10px 20px rgba(0,0,0,0.75)',
    shadowPressed: '0 1px 0 rgba(120,200,255,0.1) inset, 0 -1px 0 rgba(0,0,0,0.4) inset, 0 1px 0 #6B2A1A, 0 3px 8px rgba(0,0,0,0.6)',
  },
  welt: {
    name: '🌍 Welt',
    bg: '#060410', card: '#0e0a1e', text: '#fff', sub: '#7A70A0', border: '#1A1430',
    accent: '#FF6B6B', gold: '#FFD93D', glowColor: '#C77DFF', btnTextColor: '#fff',
    rainbow: true,
    bgGrad: [
      'radial-gradient(ellipse at 15% 40%, #FF6B6B28 0%, transparent 45%)',
      'radial-gradient(ellipse at 85% 20%, #4D96FF28 0%, transparent 45%)',
      'radial-gradient(ellipse at 50% 85%, #6BCB7728 0%, transparent 45%)',
      'radial-gradient(ellipse at 75% 65%, #C77DFF28 0%, transparent 40%)',
      'radial-gradient(ellipse at 30% 70%, #FFD93D22 0%, transparent 40%)',
      '#060410',
    ].join(', '),
    metalGrad: 'linear-gradient(145deg, #FF6B6B, #FFD93D, #6BCB77, #4D96FF, #C77DFF, #FF6B6B)',
    metalText: 'linear-gradient(90deg, #C77DFF 0%, #FF6B6B 16%, #FFD93D 33%, #6BCB77 50%, #4D96FF 66%, #C77DFF 83%, #FF6B6B 100%)',
    btnFaceGrad: 'linear-gradient(90deg, #C77DFF 0%, #FF6B6B 16%, #FFD93D 33%, #6BCB77 50%, #4D96FF 66%, #C77DFF 83%, #FF6B6B 100%)',
    shadow3d: '0 1px 0 rgba(255,255,255,0.3) inset, 0 -1px 0 rgba(0,0,0,0.5) inset, 0 4px 0 #9B3BFF, 0 6px 0 #7B1BDF, 0 8px 0 #3D008F, 0 10px 20px rgba(0,0,0,0.75)',
    shadowPressed: '0 1px 0 rgba(255,255,255,0.15) inset, 0 -1px 0 rgba(0,0,0,0.4) inset, 0 1px 0 #7B1BDF, 0 3px 8px rgba(0,0,0,0.6)',
  },
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

const SPEECH_LANGS = { en: 'en-GB', de: 'de-DE', sw: 'sw-KE', th: 'th-TH', fr: 'fr-FR', es: 'es-ES', ar: 'ar-SA', tr: 'tr-TR', pt: 'pt-PT' }

async function speak(text, langCode) {
  if (!window.speechSynthesis || !text) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  const langTag = SPEECH_LANGS[langCode] || 'en-GB'
  u.lang = langTag; u.rate = 0.72
  const voices = await new Promise(resolve => {
    const v = window.speechSynthesis.getVoices()
    if (v.length) { resolve(v); return }
    window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices())
  })
  const preferred = voices.find(v => v.lang === langTag && v.name.toLowerCase().includes('google'))
    || voices.find(v => v.lang === langTag && !v.localService)
    || voices.find(v => v.lang.startsWith(langTag.split('-')[0]) && v.name.toLowerCase().includes('google'))
    || voices.find(v => v.lang.startsWith(langTag.split('-')[0]))
  if (preferred) u.voice = preferred
  window.speechSynthesis.speak(u)
}

const PLACEMENT_EN = [
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
  { id: 'p_en_21', level: 'B1', question: '"Despite the rain, we ___ the game."', options: ['finished', 'have been finishing', 'are finishing', 'had finish'], correct: 0 },
  { id: 'p_en_22', level: 'B1', question: '"Under the weather" means...', options: ['Draußen im Regen', 'Kränklich / Nicht auf der Höhe', 'Bei schlechtem Wetter', 'Wettervorhersage'], correct: 1 },
  { id: 'p_en_23', level: 'B1', question: 'Which word fits? "The meeting was ___."', options: ['bored', 'boring', 'bore', 'boringly'], correct: 1 },
  { id: 'p_en_24', level: 'B1', question: '"I\'m swamped" means...', options: ['Ich bin nass', 'Ich bin total überlastet', 'Ich bin erschöpft', 'Ich bin verloren'], correct: 1 },
  { id: 'p_en_25', level: 'B1', question: 'Complete: "If I ___ you, I would apologize."', options: ['am', 'was', 'were', 'be'], correct: 2 },
  { id: 'p_en_26', level: 'B1', question: '"Bear with me" means...', options: ['Komm mit mir', 'Hab Geduld mit mir', 'Kämpf mit mir', 'Bleib bei mir'], correct: 1 },
  { id: 'p_en_27', level: 'B1', question: 'Correct passive: "The report ___ by Tuesday."', options: ['will complete', 'will be completing', 'will be completed', 'will have complete'], correct: 2 },
  { id: 'p_en_28', level: 'B1', question: '"Break a leg!" means...', options: ['Brich dir ein Bein!', 'Hals- und Beinbruch!', 'Beeil dich!', 'Pass auf!'], correct: 1 },
  { id: 'p_en_29', level: 'B1', question: 'Which is most formal?', options: ["I can't make it", 'I am unable to attend', "I won't be there", "I'm not coming"], correct: 1 },
  { id: 'p_en_30', level: 'B1', question: '"Let\'s make up" means...', options: ['Lass uns schminken', 'Lass uns etwas erfinden', 'Lass uns versöhnen', 'Lass uns aufhören'], correct: 2 },
  { id: 'p_en_31', level: 'B2', question: '"The project ___ by the time the client arrives."', options: ['will finish', 'will have been finished', 'will be finishing', 'finishes'], correct: 1 },
  { id: 'p_en_32', level: 'B2', question: 'What does "ambiguous" mean?', options: ['Eindeutig', 'Mehrdeutig / Zweideutig', 'Unmöglich', 'Unbekannt'], correct: 1 },
  { id: 'p_en_33', level: 'B2', question: '"Had she known, she ___ differently."', options: ['would act', 'would have acted', 'will act', 'acted'], correct: 1 },
  { id: 'p_en_34', level: 'B2', question: '"It\'s not my cup of tea" means...', options: ['Ich mag keinen Tee', 'Das ist nicht meins / nicht mein Ding', 'Das ist zu teuer', 'Das gehört mir nicht'], correct: 1 },
  { id: 'p_en_35', level: 'B2', question: 'Which word means "to postpone"?', options: ['To hasten', 'To defer', 'To cancel', 'To confirm'], correct: 1 },
  { id: 'p_en_36', level: 'B2', question: '"That\'s a bummer" is...', options: ['Formell', 'Umgangssprachlich', 'Beleidigend', 'Fachsprachlich'], correct: 1 },
  { id: 'p_en_37', level: 'B2', question: '"The more you practice, ___ you become."', options: ['the better', 'the more better', 'more better', 'better'], correct: 0 },
  { id: 'p_en_38', level: 'B2', question: '"No cap" means...', options: ['Keine Mütze', 'Im Ernst / Kein Witz', 'Kein Problem', 'Keine Möglichkeit'], correct: 1 },
  { id: 'p_en_39', level: 'B2', question: 'Correct use of "despite"?', options: ['Despite of the cost, we proceeded', 'Despite the cost, we proceeded', 'Despite that the cost, we proceeded', 'Despite to the cost, we proceeded'], correct: 1 },
  { id: 'p_en_40', level: 'B2', question: '"Piece of cake" refers to...', options: ['Ein Kuchen', 'Eine leichte Aufgabe', 'Ein Stück Arbeit', 'Etwas Süßes'], correct: 1 },
  { id: 'p_en_41', level: 'C1', question: '"The legislation was enacted ___ public opposition."', options: ['despite of', 'in spite', 'notwithstanding', 'regardless'], correct: 2 },
  { id: 'p_en_42', level: 'C1', question: 'What does "to corroborate" mean?', options: ['Widersprechen', 'Bestätigen / Bekräftigen', 'Untersuchen', 'Verweigern'], correct: 1 },
  { id: 'p_en_43', level: 'C1', question: 'Identify the subjunctive: "I suggest that he ___ present."', options: ['is', 'was', 'be', 'were'], correct: 2 },
  { id: 'p_en_44', level: 'C1', question: '"Ostensibly" means...', options: ['Offensichtlich falsch', 'Dem Anschein nach', 'Tatsächlich', 'Heimlich'], correct: 1 },
  { id: 'p_en_45', level: 'C1', question: '"She was ___ in her refusal to compromise."', options: ['adamant', 'ambivalent', 'amenable', 'apathetic'], correct: 0 },
  { id: 'p_en_46', level: 'C1', question: 'Which is a cleft sentence?', options: ['I saw John yesterday', 'It was John that I saw yesterday', 'John I saw yesterday', 'Yesterday John was seen'], correct: 1 },
  { id: 'p_en_47', level: 'C1', question: '"To prevaricate" means...', options: ['Voraus planen', 'Ausweichen / Herumreden', 'Übertreiben', 'Vorhersagen'], correct: 1 },
  { id: 'p_en_48', level: 'C1', question: '"Not only ___ the proposal, but she also funded it."', options: ['she supported', 'did she support', 'she did support', 'supported she'], correct: 1 },
  { id: 'p_en_49', level: 'C1', question: '"Equivocal" means...', options: ['Eindeutig', 'Gleichwertig', 'Zweideutig', 'Gleichmütig'], correct: 2 },
  { id: 'p_en_50', level: 'C1', question: 'Which uses an absolute phrase?', options: ['Running quickly, he caught the bus', 'The task completed, they left the office', 'She was tired but kept working', 'Although tired, she kept working'], correct: 1 },
  { id: 'p_en_51', level: 'C2', question: '"The ___ of the argument lay in its internal contradictions."', options: ['fallacy', 'premise', 'corollary', 'axiom'], correct: 0 },
  { id: 'p_en_52', level: 'C2', question: 'What is a "hapax legomenon"?', options: ['Ein häufiges Wort', 'Ein Wort das nur einmal belegt ist', 'Ein veraltetes Wort', 'Ein Lehnwort'], correct: 1 },
  { id: 'p_en_53', level: 'C2', question: '"Perspicacious" means...', options: ['Hartnäckig', 'Scharfsinnig / Klug', 'Weitschweifig', 'Unbeständig'], correct: 1 },
  { id: 'p_en_54', level: 'C2', question: '"___ he may be talented, his work ethic leaves much to be desired."', options: ['Although', 'Albeit', 'Granted', 'Despite'], correct: 1 },
  { id: 'p_en_55', level: 'C2', question: '"Tendentious" describes writing that is...', options: ['Ausgewogen', 'Subjektiv / Tendenziös', 'Akademisch', 'Kreativ'], correct: 1 },
  { id: 'p_en_56', level: 'C2', question: 'What does "to gainsay" mean?', options: ['Beipflichten', 'Widersprechen / Leugnen', 'Bestätigen', 'Aussagen'], correct: 1 },
  { id: 'p_en_57', level: 'C2', question: '"The proposal was met with ___ from all quarters."', options: ['approbation', 'opprobrium', 'equanimity', 'probity'], correct: 1 },
  { id: 'p_en_58', level: 'C2', question: 'Identify the zeugma:', options: ['"She lost her keys and her temper"', '"He spoke quickly and loudly"', '"She was tall and elegant"', '"He walked fast and far"'], correct: 0 },
  { id: 'p_en_59', level: 'C2', question: '"Solipsistic" means...', options: ['Sozial', 'Egozentrisch / Nur auf sich selbst fokussiert', 'Altruistisch', 'Philosophisch'], correct: 1 },
  { id: 'p_en_60', level: 'C2', question: '"Weltanschauung" in English refers to...', options: ['World record', 'World view / Philosophy of life', 'World travel', 'World war'], correct: 1 },
]

const PLACEMENT_DE = [
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
  { id: 'p_de_11', level: 'A2', question: 'Complete: "Gestern ___ ich ins Kino gegangen."', options: ['habe', 'bin', 'hatte', 'wurde'], correct: 1 },
  { id: 'p_de_12', level: 'A2', question: '"Ich freue mich" means...', options: ['I am sad', 'I am bored', 'I am looking forward to it', 'I am surprised'], correct: 2 },
  { id: 'p_de_13', level: 'A2', question: 'Which case? "Ich gebe ___ Mann das Buch."', options: ['der', 'die', 'dem', 'den'], correct: 2 },
  { id: 'p_de_14', level: 'A2', question: '"Du fehlst mir" means...', options: ['You forgot me', 'I miss you', 'You are missing something', 'You are wrong'], correct: 1 },
  { id: 'p_de_15', level: 'A2', question: 'Complete: "Das ist ___ teuer." (too)', options: ['sehr', 'viel', 'zu', 'mehr'], correct: 2 },
  { id: 'p_de_16', level: 'A2', question: '"Kannst du das wiederholen?" means...', options: ['Can you translate that?', 'Can you repeat that?', 'Can you explain that?', 'Can you write that?'], correct: 1 },
  { id: 'p_de_17', level: 'A2', question: 'Correct plural: "das Kind →"', options: ['die Kinds', 'die Kinder', 'die Kinde', 'die Kindern'], correct: 1 },
  { id: 'p_de_18', level: 'A2', question: '"Ich bin stolz auf dich" means...', options: ['I am angry at you', 'I am thinking of you', 'I am proud of you', 'I am waiting for you'], correct: 2 },
  { id: 'p_de_19', level: 'A2', question: 'Complete: "___ du Deutsch?"', options: ['Kannst', 'Sprichst', 'Machst', 'Lernst'], correct: 1 },
  { id: 'p_de_20', level: 'A2', question: '"Alles wird gut" means...', options: ['All is lost', 'Everything is fine now', 'Everything will be okay', 'All is well'], correct: 2 },
  { id: 'p_de_21', level: 'B1', question: 'Complete: "Wenn ich Zeit ___, käme ich."', options: ['habe', 'hatte', 'hätte', 'haben'], correct: 2 },
  { id: 'p_de_22', level: 'B1', question: '"Das ist lecker" means...', options: ['That is expensive', 'That is delicious', 'That is interesting', 'That is strange'], correct: 1 },
  { id: 'p_de_23', level: 'B1', question: 'Correct reflexive: "Ich ___ die Hände."', options: ['wasche mir', 'wasche mich', 'wasche', 'wäsche mir'], correct: 0 },
  { id: 'p_de_24', level: 'B1', question: '"Ich lerne Deutsch, ___ ich in Deutschland arbeiten möchte."', options: ['aber', 'weil', 'obwohl', 'wenn'], correct: 1 },
  { id: 'p_de_25', level: 'B1', question: 'Passive: "Man baut das Haus." →', options: ['Das Haus wird gebaut', 'Das Haus ist gebaut', 'Das Haus baut sich', 'Das Haus wurde bauen'], correct: 0 },
  { id: 'p_de_26', level: 'B1', question: '"Entschuldigung" is used to...', options: ['Greet someone', 'Say goodbye', 'Apologize or get attention', 'Express joy'], correct: 2 },
  { id: 'p_de_27', level: 'B1', question: 'Complete: "Er sagte, er ___ krank."', options: ['ist', 'sei', 'war', 'wäre'], correct: 1 },
  { id: 'p_de_28', level: 'B1', question: '"Bis bald" means...', options: ['See you tomorrow', 'See you soon', 'See you later today', 'Goodbye forever'], correct: 1 },
  { id: 'p_de_29', level: 'B1', question: '"Trotz ___ Regens gingen wir spazieren."', options: ['der', 'dem', 'des', 'die'], correct: 2 },
  { id: 'p_de_30', level: 'B1', question: '"Was machst du?" formally becomes...', options: ['Was machen Sie?', 'Was macht ihr?', 'Was machst du?', 'Was machen wir?'], correct: 0 },
  { id: 'p_de_31', level: 'B2', question: '"Angesichts der Lage ___ wir handeln."', options: ['müssen', 'müssten', 'muss', 'müsste'], correct: 0 },
  { id: 'p_de_32', level: 'B2', question: 'What does "die Nachhaltigkeit" mean?', options: ['Die Vergangenheit', 'Die Zukunft', 'Die Nachhaltigkeit', 'Sustainability'], correct: 3 },
  { id: 'p_de_33', level: 'B2', question: '"Wenn er früher gekommen ___, hätten wir mehr Zeit gehabt."', options: ['war', 'wäre', 'ist', 'würde'], correct: 1 },
  { id: 'p_de_34', level: 'B2', question: '"Zweischneidiges Schwert" means...', options: ['Ein scharfes Schwert', 'Double-edged sword', 'Eine Waffe', 'Ein altes Sprichwort'], correct: 1 },
  { id: 'p_de_35', level: 'B2', question: 'Correct Genitiv?', options: ['Das Auto meiner Mutter', 'Das Auto von meine Mutter', "Das Auto meiner Mutter's", 'Das Auto meiner Mutters'], correct: 0 },
  { id: 'p_de_36', level: 'B2', question: '"Schließlich" is best translated as...', options: ['Finally / Eventually', 'Unfortunately', 'Nevertheless', 'Meanwhile'], correct: 0 },
  { id: 'p_de_37', level: 'B2', question: 'Correct Relativsatz?', options: ['Das Buch, das ich lese, ist interessant.', 'Das Buch, was ich lese, ist interessant.', 'Das Buch, den ich lese, ist interessant.', 'Das Buch, die ich lese, ist interessant.'], correct: 0 },
  { id: 'p_de_38', level: 'B2', question: '"Ungeachtet" means...', options: ['Trotzdem', 'Deswegen', 'Infolgedessen', 'Regardless of'], correct: 3 },
  { id: 'p_de_39', level: 'B2', question: '"Je mehr man lernt, ___ man weiß."', options: ['desto mehr', 'umso viel', 'desto viel', 'je mehr'], correct: 0 },
  { id: 'p_de_40', level: 'B2', question: '"Auf dem Laufenden bleiben" means...', options: ['Weiter rennen', 'Stay informed', 'Stay on track', 'Keep running'], correct: 1 },
  { id: 'p_de_41', level: 'C1', question: '"Zeitigt" in "Die Maßnahme zeitigt Erfolge" means...', options: ['Verzögert', 'Zeigt / Bringt hervor', 'Beendet', 'Gefährdet'], correct: 1 },
  { id: 'p_de_42', level: 'C1', question: '"Das Problem ___ noch nicht ___." (Zustandspassiv)', options: ['ist / gelöst', 'wird / gelöst', 'hat / gelöst', 'wäre / gelöst'], correct: 0 },
  { id: 'p_de_43', level: 'C1', question: '"Inwiefern" asks...', options: ['Why', 'In what way / To what extent', 'How often', 'Since when'], correct: 1 },
  { id: 'p_de_44', level: 'C1', question: '"Gleichwohl" is a synonym for...', options: ['Deswegen', 'Nichtsdestotrotz / Nevertheless', 'Folglich', 'Einerseits'], correct: 1 },
  { id: 'p_de_45', level: 'C1', question: 'Correct "als ob" usage?', options: ['Er tut so, als ob er schläft.', 'Er tut so, als ob er schläfe.', 'Er tut so, als ob er schlafen.', 'Er tut so, als er schläft.'], correct: 1 },
  { id: 'p_de_46', level: 'C1', question: '"Subtil" means...', options: ['Offensichtlich', 'Fein / Kaum wahrnehmbar', 'Grob', 'Laut'], correct: 1 },
  { id: 'p_de_47', level: 'C1', question: 'The "Fugenelement" in "Arbeitsplatz" is...', options: ['-s-', '-en-', '-e-', null], correct: 0 },
  { id: 'p_de_48', level: 'C1', question: '"Dessen ungeachtet" means...', options: ['Infolgedessen', 'Regardless of that', 'Thanks to that', 'As a result'], correct: 1 },
  { id: 'p_de_49', level: 'C1', question: 'Correct "brauchen" usage?', options: ['Du brauchst nicht zu kommen.', 'Du brauchst nicht kommen.', 'Du nicht brauchst zu kommen.', 'Du brauchst kommen nicht.'], correct: 0 },
  { id: 'p_de_50', level: 'C1', question: '"Ambivalent" means...', options: ['Eindeutig positiv', 'Zwiespältig / Gemischt', 'Klar ablehnend', 'Vollkommen neutral'], correct: 1 },
  { id: 'p_de_51', level: 'C2', question: '"Zirkelschluss" means...', options: ['Kreisförmige Bewegung', 'Circular reasoning', 'Abschluss einer Debatte', 'Runder Tisch'], correct: 1 },
  { id: 'p_de_52', level: 'C2', question: '"Konzedieren" means...', options: ['Konzentrieren', 'Einräumen / Zugeben', 'Konzipieren', 'Kritisieren'], correct: 1 },
  { id: 'p_de_53', level: 'C2', question: 'Which is an "Anakoluth"?', options: ['Ein Satz ohne Verb', 'Ein grammatisch nicht zu Ende geführter Satz', 'Ein Palindrom', 'Ein Satz mit doppelter Verneinung'], correct: 1 },
  { id: 'p_de_54', level: 'C2', question: '"Lapidar" means...', options: ['Lang und ausführlich', 'Kurz und treffend / knapp', 'Unverständlich', 'Feierlich'], correct: 1 },
  { id: 'p_de_55', level: 'C2', question: '"Das Haar in der Suppe suchen" means...', options: ['Kochen', 'An allem etwas auszusetzen haben', 'Sauber sein', 'Kleinigkeiten genießen'], correct: 1 },
  { id: 'p_de_56', level: 'C2', question: '"Apodiktisch" describes...', options: ['Fragend', 'Unbedingt wahr / Unbestreitbar', 'Vermutend', 'Widersprüchlich'], correct: 1 },
  { id: 'p_de_57', level: 'C2', question: 'What is a "Hendiadyoin"?', options: ['Ein Wortspiel', 'Ausdruck eines Begriffs durch zwei Wörter', 'Ein Fremdwort', 'Eine Übertreibung'], correct: 1 },
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

// ── TAGES-PHRASE ─────────────────────────────────────────────
const DAILY_PHRASES_EN = [
  { phrase: "Every day is a step forward.", translation: "Jeder Tag ist ein Schritt nach vorne." },
  { phrase: "You don't have to be perfect to be amazing.", translation: "Du musst nicht perfekt sein, um großartig zu sein." },
  { phrase: "Small progress is still progress.", translation: "Kleiner Fortschritt ist immer noch Fortschritt." },
  { phrase: "The best time to learn was yesterday. The second best is now.", translation: "Der beste Zeitpunkt zu lernen war gestern. Der zweitbeste ist jetzt." },
  { phrase: "Mistakes are proof that you are trying.", translation: "Fehler beweisen, dass du es versuchst." },
  { phrase: "A new word is a new world.", translation: "Ein neues Wort ist eine neue Welt." },
  { phrase: "Language is the road map of a culture.", translation: "Sprache ist die Landkarte einer Kultur." },
  { phrase: "You are closer than you think.", translation: "Du bist näher dran als du denkst." },
  { phrase: "Keep going. You are doing great.", translation: "Mach weiter. Du machst das großartig." },
  { phrase: "One language sets you in a corridor for life.", translation: "Eine Sprache setzt dich in einen Korridor fürs Leben." },
  { phrase: "To learn a language is to have one more window.", translation: "Eine Sprache zu lernen bedeutet, ein Fenster mehr zu haben." },
  { phrase: "Fluency comes one word at a time.", translation: "Fließend sprechen kommt Wort für Wort." },
  { phrase: "The bridge begins with a single word.", translation: "Die Brücke beginnt mit einem einzigen Wort." },
  { phrase: "Consistency beats perfection every time.", translation: "Beständigkeit schlägt Perfektion jedes Mal." },
  { phrase: "Your effort today is tomorrow's confidence.", translation: "Dein Einsatz heute ist das Selbstvertrauen von morgen." },
  { phrase: "Every expert was once a beginner.", translation: "Jeder Experte war einmal ein Anfänger." },
  { phrase: "Learning never exhausts the mind.", translation: "Lernen erschöpft den Geist nie." },
  { phrase: "The more you learn, the more places you belong.", translation: "Je mehr du lernst, desto mehr Orte gehören dir." },
  { phrase: "Words are the currency of connection.", translation: "Worte sind die Währung der Verbindung." },
  { phrase: "You are building something beautiful.", translation: "Du baust etwas Wunderschönes auf." },
  { phrase: "A different language is a different vision of life.", translation: "Eine andere Sprache ist eine andere Sicht auf das Leben." },
  { phrase: "The voice is the bridge.", translation: "Die Stimme ist die Brücke." },
]
const DAILY_PHRASES_DE = [
  { phrase: "Jeder Tag ist eine neue Chance.", translation: "Every day is a new chance." },
  { phrase: "Kleine Schritte führen zu großen Zielen.", translation: "Small steps lead to big goals." },
  { phrase: "Fortschritt, nicht Perfektion.", translation: "Progress, not perfection." },
  { phrase: "Du lernst nicht nur eine Sprache — du baust eine Brücke.", translation: "You are not just learning a language — you are building a bridge." },
  { phrase: "Fehler sind der Anfang des Lernens.", translation: "Mistakes are the beginning of learning." },
  { phrase: "Heute besser als gestern.", translation: "Better today than yesterday." },
  { phrase: "Eine Sprache öffnet eine Tür zur Welt.", translation: "One language opens a door to the world." },
  { phrase: "Übung macht den Meister.", translation: "Practice makes perfect." },
  { phrase: "Du bist stärker als du denkst.", translation: "You are stronger than you think." },
  { phrase: "Wer aufhört zu lernen, hört auf zu wachsen.", translation: "Those who stop learning stop growing." },
  { phrase: "Jedes Wort bringt dich näher.", translation: "Every word brings you closer." },
  { phrase: "Die Stimme ist die Brücke.", translation: "The voice is the bridge." },
  { phrase: "Sprache ist das Herz der Verbindung.", translation: "Language is the heart of connection." },
  { phrase: "Bleib dran — es lohnt sich.", translation: "Keep going — it's worth it." },
  { phrase: "Mut beginnt mit einem einzigen Wort.", translation: "Courage begins with a single word." },
]
function getDailyPhrase(lang) {
  const pool = lang === 'de' ? DAILY_PHRASES_EN : DAILY_PHRASES_DE
  const today = new Date()
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000)
  return pool[dayOfYear % pool.length]
}

const ALL_MARK_CARDS_BASE = [
  { id: 'en_1', front: "What's the catch?", back: "Wo ist der Haken?", context: "Sie bot mir alles an — ich fragte trotzdem: What's the catch? Manchmal ist Vorsicht die klügere Brücke.", langA: 'en', langB: 'de' },
  { id: 'en_2', front: "Long story short...", back: "Um es kurz zu machen...", context: "Drei Stunden, zwei Länder, ein Missverständnis — long story short: wir lachten am Ende.", langA: 'en', langB: 'de' },
  { id: 'en_3', front: "I'm down.", back: "Ich bin dabei.", context: "Spontaner Ausflug um Mitternacht? I'm down — manche Entscheidungen trifft man mit dem Herzen.", langA: 'en', langB: 'de' },
  { id: 'en_4', front: "I'm heading out.", back: "Ich mache mich auf den Weg.", context: "I'm heading out — der Zug wartet nicht, aber Gedanken reisen schneller als jeder Fahrplan.", langA: 'en', langB: 'de' },
  { id: 'en_5', front: "Give me a heads up.", back: "Gib mir kurz Bescheid.", context: "Wenn du kommst, give me a heads up — ich möchte da sein, wenn du ankommst.", langA: 'en', langB: 'de' },
  { id: 'en_6', front: "I'm on it.", back: "Ich kümmere mich darum.", context: "Keine Sorge — I'm on it. Manchmal ist das die stärkste Antwort, die man geben kann.", langA: 'en', langB: 'de' },
  { id: 'en_7', front: "I'm devastated.", back: "Ich bin am Boden zerstört.", context: "Als der Zug abfuhr ohne sie — I'm devastated. Aber Züge kommen wieder.", langA: 'en', langB: 'de' },
  { id: 'en_8', front: "Never mind.", back: "Vergiss es. / Schon gut.", context: "Never mind — manchmal ist Loslassen klüger als jede Erklärung.", langA: 'en', langB: 'de' },
  { id: 'en_9', front: "I'm on my way.", back: "Ich bin unterwegs.", context: "I'm on my way — drei Wörter, die alles bedeuten können.", langA: 'en', langB: 'de' },
  { id: 'en_10', front: "What's going on?", back: "Was ist hier los?", context: "Sie hörte die Stille durch die Leitung. What's going on? — manchmal fragt man und meint: Ich vermisse dich.", langA: 'en', langB: 'de' },
  { id: 'en_11', front: "To be honest...", back: "Um ehrlich zu sein...", context: "To be honest — der mutigste Satzanfang, den es gibt. Sprache beginnt, wo Masken fallen.", langA: 'en', langB: 'de' },
  { id: 'en_12', front: "Take care!", back: "Pass auf dich auf!", context: "Take care — nicht nur Abschied. Ein kleines Versprechen, das man mit auf den Weg gibt.", langA: 'en', langB: 'de' },
  { id: 'en_13', front: "Keep me posted.", back: "Halt mich auf dem Laufenden.", context: "Keep me posted — weil Entfernung kein Grund ist, nicht dabei zu sein.", langA: 'en', langB: 'de' },
  { id: 'en_14', front: "I'll let you know.", back: "Ich gebe dir Bescheid.", context: "I'll let you know sobald ich lande — die Brücke beginnt mit einem einzigen Satz.", langA: 'en', langB: 'de' },
  { id: 'en_15', front: "It's up to you.", back: "Es liegt an dir.", context: "It's up to you — die schwersten Worte, die man jemandem schenken kann: echte Freiheit.", langA: 'en', langB: 'de' },
  { id: 'en_16', front: "I'll keep you posted.", back: "Ich halte dich auf dem Laufenden.", context: "I'll keep you posted — Verbindung braucht keine Nähe, nur den Willen, Worte zu schicken.", langA: 'en', langB: 'de' },
  { id: 'en_17', front: "Make up your mind!", back: "Entscheide dich!", context: "Make up your mind — das Leben wartet eine Weile. Aber nicht ewig.", langA: 'en', langB: 'de' },
  { id: 'en_18', front: "I'm literally starving!", back: "Ich habe Riesenhunger!", context: "Nach zwölf Stunden im Führerstand: I'm literally starving — und das ist kein bisschen übertrieben.", langA: 'en', langB: 'de' },
  { id: 'en_19', front: "For real?", back: "Echt jetzt? / Im Ernst?", context: "For real? — manchmal ist echtes Staunen die ehrlichste Reaktion auf eine gute Nachricht.", langA: 'en', langB: 'de' },
  { id: 'en_20', front: "Piece of cake!", back: "Ein Kinderspiel!", context: "Das Formular ausfüllen? Piece of cake — sagte er, bevor er dreimal von vorne anfing.", langA: 'en', langB: 'de' },
  { id: 'en_21', front: "No biggie.", back: "Kein Ding.", context: "No biggie — die Kunst, Gelassenheit zu zeigen, obwohl man innerlich tief aufatmet.", langA: 'en', langB: 'de' },
  { id: 'en_22', front: "My bad.", back: "Mein Fehler.", context: "My bad — kurz, klar, aufrichtig. Mehr braucht es manchmal nicht.", langA: 'en', langB: 'de' },
  { id: 'en_23', front: "No way!", back: "Auf keinen Fall!", context: "No way! — ob Überraschung oder Ablehnung: der Tonfall entscheidet alles.", langA: 'en', langB: 'de' },
  { id: 'en_24', front: "Make it clear.", back: "Mach es unmissverständlich klar.", context: "Make it clear — Missverständnisse wachsen im Schweigen. Worte sind das Licht dagegen.", langA: 'en', langB: 'de' },
  { id: 'en_25', front: "Let's make up.", back: "Lass uns uns versöhnen.", context: "Nach jedem Sturm: let's make up — die Brücke trägt mehr als Worte.", langA: 'en', langB: 'de' },
  { id: 'en_26', front: "Bear with me.", back: "Hab Geduld mit mir.", context: "Bear with me — ich finde die richtigen Worte. Ich verspreche es.", langA: 'en', langB: 'de' },
  { id: 'en_27', front: "Cut it out!", back: "Hör auf damit!", context: "Cut it out! — manchmal braucht es nur drei Worte, um alles zum Stillstand zu bringen.", langA: 'en', langB: 'de' },
  { id: 'en_28', front: "Hang in there.", back: "Halte durch.", context: "Hang in there — der schwierigste Rat, den man geben kann. Und der wichtigste.", langA: 'en', langB: 'de' },
  { id: 'en_29', front: "Actually", back: "Eigentlich / Tatsächlich", context: "I actually missed you more than I expected — manche Wahrheiten kommen langsam ans Licht.", langA: 'en', langB: 'de' },
  { id: 'en_30', front: "Basically", back: "Im Grunde / Grundsätzlich", context: "Basically — wenn man aufhört zu reden und zum Kern kommt. Das ist die eigentliche Brücke.", langA: 'en', langB: 'de' },
  { id: 'en_31', front: "Eventually", back: "Schließlich / Irgendwann", context: "Eventually wird die Entfernung kleiner — Schritt für Schritt, Wort für Wort.", langA: 'en', langB: 'de' },
  { id: 'en_32', front: "Probably", back: "Wahrscheinlich", context: "Probably the best decision I ever made — Gewissheit braucht manchmal einen Anlauf.", langA: 'en', langB: 'de' },
  { id: 'en_33', front: "Definitely", back: "Definitiv / Auf jeden Fall", context: "Definitely — wenn man ohne Zögern antwortet, weiß man, dass man es wirklich meint.", langA: 'en', langB: 'de' },
  { id: 'en_34', front: "Anyway", back: "Wie auch immer / Jedenfalls", context: "Anyway — das Wort, mit dem man weitermacht, auch wenn nichts nach Plan lief.", langA: 'en', langB: 'de' },
  { id: 'en_35', front: "Exactly", back: "Genau / Exakt", context: "Exactly — wenn zwei Menschen dasselbe denken, ohne es abgesprochen zu haben.", langA: 'en', langB: 'de' },
  { id: 'en_36', front: "My treat.", back: "Ich lade dich ein.", context: "My treat — weil Großzügigkeit keine Entfernung kennt und kein Anlass braucht.", langA: 'en', langB: 'de' },
  { id: 'en_37', front: "No cap.", back: "Kein Witz / Ungelogen.", context: "No cap — ich denke wirklich an dich. Jeden Tag. Das ist keine Floskel.", langA: 'en', langB: 'de' },
  { id: 'en_38', front: "Under the weather.", back: "Kränklich / Nicht auf der Höhe.", context: "Er klang under the weather — aber seine Stimme war trotzdem Heimat.", langA: 'en', langB: 'de' },
  { id: 'en_39', front: "Break a leg!", back: "Hals- und Beinbruch!", context: "Break a leg — gesagt mit echtem Stolz, nicht als Floskel, sondern als Glaube.", langA: 'en', langB: 'de' },
  { id: 'en_40', front: "That's a bummer.", back: "Das ist schade / blöd.", context: "That's a bummer — klein genug für Alltag, groß genug, dass man es teilen möchte.", langA: 'en', langB: 'de' },
  { id: 'en_41', front: "I'm swamped.", back: "Ich bin total überlastet.", context: "I'm swamped this week — aber kein Grund, die Verbindung abreißen zu lassen.", langA: 'en', langB: 'de' },
  { id: 'en_42', front: "Hit me up.", back: "Meld dich bei mir.", context: "Hit me up wenn du Zeit hast — die Tür steht immer offen, auch über Kontinente hinweg.", langA: 'en', langB: 'de' },
  { id: 'en_43', front: "It's not my cup of tea.", back: "Das ist nicht mein Ding.", context: "It's not my cup of tea — und das ist in Ordnung. Ehrlichkeit ist auch eine Brücke.", langA: 'en', langB: 'de' },
  { id: 'sw_1', front: "Jambo", back: "Hallo", pronunciation: "DSHAM-bo", context: "Jambo! — das erste Wort, das Nairobi dir entgegenwirft. Eine ganze Wärme in zwei Silben.", langA: 'sw', langB: 'de' },
  { id: 'sw_2', front: "Asante", back: "Danke", pronunciation: "ah-SAHN-teh", context: "Asante — weil Dankbarkeit in jeder Sprache dasselbe Gewicht trägt.", langA: 'sw', langB: 'de' },
  { id: 'sw_3', front: "Hapana", back: "Nein", pronunciation: "ha-PAH-na", context: "Hapana — klar, ruhig, respektvoll. Grenzen klingen auf Swahili genauso würdevoll.", langA: 'sw', langB: 'de' },
  { id: 'sw_4', front: "Ndiyo", back: "Ja", pronunciation: "NDI-yo", context: "Ndiyo — ein Wort, das Türen öffnet. Manchmal ist Zustimmung der Anfang von allem.", langA: 'sw', langB: 'de' },
  { id: 'sw_5', front: "Tafadhali", back: "Bitte", pronunciation: "ta-fad-HA-li", context: "Tafadhali — Höflichkeit braucht keine Übersetzung, sie fühlt sich überall gleich an.", langA: 'sw', langB: 'de' },
  { id: 'sw_6', front: "Habari yako?", back: "Wie geht es dir?", pronunciation: "ha-BAH-ri YAH-ko", context: "Habari yako? — mehr als eine Frage. Eine Einladung, sich zu zeigen.", langA: 'sw', langB: 'de' },
  { id: 'sw_7', front: "Anakuja", back: "Er/Sie kommt", pronunciation: "a-na-KU-ja", context: "Anakuja — drei Silben, die Vorfreude bedeuten. Jemand ist auf dem Weg.", langA: 'sw', langB: 'de' },
  { id: 'sw_8', front: "Ninakuja", back: "Ich komme", pronunciation: "ni-na-KU-ja", context: "Ninakuja — das Versprechen, das zählt. Ich bin unterwegs zu dir.", langA: 'sw', langB: 'de' },
  { id: 'sw_9', front: "Nakuja", back: "Ich komme (Kurzform)", pronunciation: "na-KU-ja", context: "Nakuja — kürzer, aber genauso aufrichtig. Die Stimme ist die Brücke.", langA: 'sw', langB: 'de' },
  { id: 'sw_10', front: "Nipee", back: "Gib mir", pronunciation: "ni-PEH-eh", context: "Nipee — eine direkte Bitte, ohne Umwege. Manchmal ist Klarheit das Größte.", langA: 'sw', langB: 'de' },
  { id: 'sw_11', front: "Sitaki", back: "Ich will nicht", pronunciation: "si-TAH-ki", context: "Sitaki — auch Nein sagen ist Kommunikation. Grenzen bauen Vertrauen.", langA: 'sw', langB: 'de' },
  { id: 'sw_12', front: "Chakula", back: "Essen", pronunciation: "cha-KU-la", context: "Chakula — Essen verbindet Menschen überall auf der Welt, auch über Ozeane hinweg.", langA: 'sw', langB: 'de' },
  { id: 'sw_13', front: "Sahani", back: "Teller", pronunciation: "sa-HA-ni", context: "Sahani — ein Teller geteilt ist eine Geste, die keine Übersetzung braucht.", langA: 'sw', langB: 'de' },
  { id: 'sw_14', front: "Ninakupenda", back: "Ich liebe dich", pronunciation: "ni-na-ku-PEN-da", context: "Ninakupenda — das wichtigste Wort, das man lernen kann. In jeder Sprache.", langA: 'sw', langB: 'de' },
  { id: 'sw_15', front: "Nakukosa", back: "Ich vermisse dich", pronunciation: "na-ku-KO-sa", context: "Nakukosa — Sehnsucht auf Swahili. Fünf Silben, die alles sagen.", langA: 'sw', langB: 'de' },
  { id: 'sw_16', front: "Lala salama", back: "Schlaf gut", pronunciation: "LA-la sa-LA-ma", context: "Lala salama — Gute Nacht über tausend Kilometer hinweg. Die Stimme überbrückt die Nacht.", langA: 'sw', langB: 'de' },
  { id: 'sw_17', front: "Pole pole", back: "Langsam / Sachte", pronunciation: "POH-leh POH-leh", context: "Pole pole — Nairobi erinnert dich manchmal: Nicht alles muss schnell gehen. Manche Dinge brauchen Zeit.", langA: 'sw', langB: 'de' },
  { id: 'sw_18', front: "Karibu", back: "Willkommen / Bitte (Einladung)", pronunciation: "ka-REE-bu", context: "Karibu — das wärmste Wort Kenias. Eine Einladung, die sagt: Du gehörst hierher.", langA: 'sw', langB: 'de' },
  { id: 'sw_19', front: "Samahani", back: "Entschuldigung / Tut mir leid", pronunciation: "sa-ma-HA-ni", context: "Samahani — Verzeihung braucht keine lange Erklärung. Manchmal reicht ein einziges Wort.", langA: 'sw', langB: 'de' },
  { id: 'sw_20', front: "Ninapenda", back: "Ich mag / Ich liebe", pronunciation: "ni-na-PEN-da", context: "Ninapenda — ohne Objekt gesagt, klingt es nach einem offenen Geheimnis. Die Brücke, die sich selbst erklärt.", langA: 'sw', langB: 'de' },
  { id: 'sw_21', front: "Wewe ni rafiki yangu", back: "Du bist mein Freund / meine Freundin", pronunciation: "WEH-weh ni ra-FEE-ki YAN-gu", context: "Wewe ni rafiki yangu — Freundschaft über Kontinente beginnt damit, sie auszusprechen.", langA: 'sw', langB: 'de' },
  { id: 'sw_22', front: "Tutaonana", back: "Bis bald / Wir sehen uns", pronunciation: "tu-ta-oh-NA-na", context: "Tutaonana — kein Abschied, sondern ein Versprechen. Wir sehen uns wieder.", langA: 'sw', langB: 'de' },
  { id: 'en_44', front: "I'm all in.", back: "Ich bin voll dabei.", context: "I'm all in — wenn die Entscheidung fällt, gibt es kein Halbherzig mehr. Ganz oder gar nicht.", langA: 'en', langB: 'de' },
  { id: 'en_45', front: "That's out of the question.", back: "Das kommt nicht in Frage.", context: "That's out of the question — manche Grenzen zieht man ruhig, aber unmissverständlich.", langA: 'en', langB: 'de' },
  { id: 'en_46', front: "Let's call it a day.", back: "Machen wir Schluss für heute.", context: "Let's call it a day — der Zug steht still, die Schicht ist vorbei. Manchmal ist aufhören Stärke.", langA: 'en', langB: 'de' },
  { id: 'en_47', front: "I'm on the fence.", back: "Ich bin unentschlossen.", context: "I'm on the fence — zwischen zwei Welten stehen und noch nicht wissen, auf welche Seite man springt.", langA: 'en', langB: 'de' },
  { id: 'en_48', front: "It's now or never.", back: "Jetzt oder nie.", context: "It's now or never — manche Momente kommen nicht zurück. Die Stimme ist die Brücke, aber man muss sprechen.", langA: 'en', langB: 'de' },
  { id: 'en_49', front: "Don't take it personally.", back: "Nimm es nicht persönlich.", context: "Don't take it personally — leichter gesagt als getan. Aber manchmal ist Distanz das Klügste.", langA: 'en', langB: 'de' },
  { id: 'en_50', front: "You're overthinking it.", back: "Du denkst zu viel nach.", context: "You're overthinking it — der Kopf baut Hindernisse, die das Herz längst überwunden hat.", langA: 'en', langB: 'de' },
  { id: 'en_51', front: "I couldn't agree more.", back: "Da stimme ich vollkommen zu.", context: "I couldn't agree more — der Satz, der sagt: Du hast genau das getroffen, was ich dachte.", langA: 'en', langB: 'de' },
  { id: 'en_52', front: "Fair enough.", back: "Fair genug. / Schon gut.", context: "Fair enough — keine perfekte Antwort, aber eine ehrliche. Manchmal reicht das völlig.", langA: 'en', langB: 'de' },
  { id: 'en_53', front: "You've got a point.", back: "Da hast du recht. / Das stimmt.", context: "You've got a point — zuhören bedeutet auch, umdenken zu können. Das ist die echte Brücke.", langA: 'en', langB: 'de' },
  { id: 'en_54', front: "Out of nowhere.", back: "Aus dem Nichts. / Plötzlich.", context: "Out of nowhere — manchmal kommen die besten Momente ohne Ankündigung.", langA: 'en', langB: 'de' },
  { id: 'en_55', front: "I'm at a loss.", back: "Ich weiß nicht weiter.", context: "I'm at a loss — nicht Schwäche, sondern Ehrlichkeit. Der erste Schritt zur Lösung.", langA: 'en', langB: 'de' },
  { id: 'en_56', front: "Let it go.", back: "Lass es los.", context: "Let it go — manche Dinge trägt man zu lange mit sich. Das Loslassen ist kein Verlust.", langA: 'en', langB: 'de' },
  { id: 'en_57', front: "I'm dead serious.", back: "Ich meine das todernst.", context: "I'm dead serious — wenn Worte Gewicht haben, spürt man es sofort.", langA: 'en', langB: 'de' },
  { id: 'en_58', front: "What's on your mind?", back: "Was beschäftigt dich?", context: "What's on your mind? — die Frage, die sagt: Ich bin hier. Ich höre zu. Erzähl mir.", langA: 'en', langB: 'de' },
  { id: 'en_59', front: "Think outside the box.", back: "Über den Tellerrand denken.", context: "Think outside the box — Hamburg und Nairobi zu verbinden war auch außerhalb aller Boxen.", langA: 'en', langB: 'de' },
  { id: 'en_60', front: "I wasn't expecting that.", back: "Das hatte ich nicht erwartet.", context: "I wasn't expecting that — Überraschungen sind manchmal die ehrlichsten Momente des Lebens.", langA: 'en', langB: 'de' },
  { id: 'en_61', front: "You had me worried.", back: "Du hast mich besorgt.", context: "You had me worried — Sorge ist eine Form von Liebe, die sich nicht verbergen lässt.", langA: 'en', langB: 'de' },
  { id: 'en_62', front: "I'll make it work.", back: "Ich kriege das hin.", context: "I'll make it work — nicht Optimismus, sondern Entschlossenheit. Der Unterschied liegt im Ton.", langA: 'en', langB: 'de' },
  { id: 'en_63', front: "Something came up.", back: "Etwas ist dazwischengekommen.", context: "Something came up — das Leben plant mit. Manchmal hat es eigene Ideen.", langA: 'en', langB: 'de' },
  { id: 'en_64', front: "I'm not buying it.", back: "Das glaube ich dir nicht.", context: "I'm not buying it — manchmal liest man zwischen den Zeilen mehr als in den Worten selbst.", langA: 'en', langB: 'de' },
  { id: 'en_65', front: "We're on the same page.", back: "Wir sind einer Meinung. / Wir verstehen uns.", context: "We're on the same page — zwei Kontinente, eine Sprache der Verbindung.", langA: 'en', langB: 'de' },
  { id: 'en_66', front: "I owe you one.", back: "Das bin ich dir schuldig.", context: "I owe you one — kleine Schulden des Herzens. Die schönsten, die man tragen kann.", langA: 'en', langB: 'de' },
  { id: 'en_67', front: "That's the last straw.", back: "Das ist der Tropfen, der das Fass zum Überlaufen bringt.", context: "That's the last straw — manche Dinge stauen sich, bis einer sagt: Jetzt reicht es.", langA: 'en', langB: 'de' },
  { id: 'en_68', front: "I can't wrap my head around it.", back: "Ich kann es nicht begreifen.", context: "I can't wrap my head around it — manche Dinge versteht man erst mit dem Herzen.", langA: 'en', langB: 'de' },
  { id: 'en_69', front: "You read my mind.", back: "Du hast mir die Gedanken gelesen.", context: "You read my mind — Verbindung braucht manchmal keine Worte. Sie ist einfach da.", langA: 'en', langB: 'de' },
  { id: 'en_70', front: "It was a wake-up call.", back: "Es war ein Weckruf.", context: "It was a wake-up call — manche Erfahrungen verändern alles. Danach ist man ein anderer.", langA: 'en', langB: 'de' },
  { id: 'en_71', front: "I'm in over my head.", back: "Ich bin überfordert.", context: "I'm in over my head — das zu sagen braucht Mut. Und ist meistens der Beginn einer Lösung.", langA: 'en', langB: 'de' },
  { id: 'en_72', front: "Just go with the flow.", back: "Geh einfach mit dem Strom.", context: "Just go with the flow — Hamburg am Hafen. Nairobi im Regen. Manchmal ist Loslassen die beste Navigation.", langA: 'en', langB: 'de' },
  { id: 'en_73', front: "I blew it.", back: "Ich habe es vermasselt.", context: "I blew it — ehrlich gesagt, ohne Ausrede. Das ist der schnellste Weg nach vorne.", langA: 'en', langB: 'de' },
  { id: 'en_74', front: "We need to talk.", back: "Wir müssen reden.", context: "We need to talk — vier Worte, die alles anhalten. Weil Stille manchmal lauter ist.", langA: 'en', langB: 'de' },
  { id: 'en_75', front: "It goes without saying.", back: "Es versteht sich von selbst.", context: "It goes without saying — und doch sagt man es. Weil manche Dinge laut sein dürfen.", langA: 'en', langB: 'de' },
  { id: 'en_76', front: "I'm running late.", back: "Ich komme zu spät.", context: "I'm running late — der Lokführer sagt es selten. Aber das Leben macht keine Ausnahmen.", langA: 'en', langB: 'de' },
  { id: 'en_77', front: "You're a lifesaver.", back: "Du rettest mir den Tag. / Du bist ein Lebensretter.", context: "You're a lifesaver — manchmal braucht es nur ein Wort im richtigen Moment.", langA: 'en', langB: 'de' },
  { id: 'en_78', front: "I've got a lot on my plate.", back: "Ich habe sehr viel um die Ohren.", context: "I've got a lot on my plate — der Zug fährt, die App wächst, das Herz schlägt. Immer alles gleichzeitig.", langA: 'en', langB: 'de' },
  { id: 'en_79', front: "Let's meet halfway.", back: "Lass uns einen Kompromiss finden.", context: "Let's meet halfway — Hamburg und Nairobi treffen sich irgendwo in der Mitte. Das ist die Brücke.", langA: 'en', langB: 'de' },
  { id: 'en_80', front: "I lost track of time.", back: "Ich habe die Zeit vergessen.", context: "I lost track of time — die schönsten Gespräche haben kein Ende. Nur ein Weitermachen.", langA: 'en', langB: 'de' },
  { id: 'en_81', front: "Don't get me wrong.", back: "Versteh mich nicht falsch.", context: "Don't get me wrong — manchmal braucht eine Wahrheit einen Rahmen, damit sie landet.", langA: 'en', langB: 'de' },
  { id: 'en_82', front: "It's on me.", back: "Ich lade ein. / Das geht auf meine Rechnung.", context: "It's on me — Großzügigkeit braucht keine Entfernung. Sie überquert Ozeane.", langA: 'en', langB: 'de' },
  { id: 'en_83', front: "You deserve it.", back: "Das hast du verdient.", context: "You deserve it — gesagt mit echtem Stolz, nicht als Floskel. Weil man es wirklich meint.", langA: 'en', langB: 'de' },
  { id: 'en_84', front: "I've made up my mind.", back: "Ich habe mich entschieden.", context: "I've made up my mind — kein Zögern mehr. Die Brücke ist gebaut. Man geht jetzt drüber.", langA: 'en', langB: 'de' },
  { id: 'en_85', front: "That means a lot to me.", back: "Das bedeutet mir sehr viel.", context: "That means a lot to me — manche Worte trägt man tage-, wochenlang mit sich. Dieser Satz ist einer davon.", langA: 'en', langB: 'de' },
  { id: 'en_86', front: "I'll be there for you.", back: "Ich bin für dich da.", context: "I'll be there for you — über jeden Ozean, durch jede Zeitzone. Das ist das Versprechen hinter der Stimme.", langA: 'en', langB: 'de' },
]

const VALID_CATEGORIES = ['vocabulary', 'sentence', 'street', 'home']

function autoCategory(front) {
  const words = front.trim().split(/\s+/).filter(Boolean)
  return words.length <= 2 ? 'vocabulary' : 'sentence'
}

function ruleCategory(card) {
  const front = card.front || ''
  const words = front.trim().split(/\s+/).filter(Boolean)
  // Rule 1: Swahili card, pronunciation field, or common Swahili words → street
  const swahiliRe = /\b(habari|yako|nzuri|asante|karibu|pole|sawa|jambo|mambo|rafiki|wewe|mimi|nina|hii|hilo|chakula|maji|nyumba|watoto|upendo)\b/i
  if (card.langA === 'sw' || card.pronunciation || swahiliRe.test(front)) return 'street'
  // Rule 2: apostrophes or contractions → street
  if (/['']/.test(front) || /\b(im|youre|its|lets|dont|cant|wont|ive|theyre|were|thats|whats|theres|ill|youll)\b/i.test(front)) return 'street'
  // Rule 3: exactly 1 word OR starts with "to " → vocabulary
  if (words.length === 1) return 'vocabulary'
  if (/^to\s/i.test(front)) return 'vocabulary'
  // Rule 4: question ending with "?" containing domestic/personal words → home
  if (front.trim().endsWith('?')) {
    const homeRe = /\b(love|miss|okay|home|eat|sleep|baby|darling|babe|honey)\b/i
    return homeRe.test(front) ? 'home' : 'sentence'
  }
  // Rule 5: 3+ words → sentence
  if (words.length >= 3) return 'sentence'
  // 2-word fallback → sentence
  return 'sentence'
}

// ── CARD GENERATION: split reversed cards on " / " ────────────
// EN→DE (forward): show all meanings together as-is
// DE→EN (reversed): split each " / " meaning into its own card
function buildCardPair(card) {
  const targetLang = card.langA
  const category = card.category || autoCategory(card.front)
  const forwardCard = { ...card, targetLang, category }

  const meanings = card.back.split(' / ').map(m => m.trim()).filter(Boolean)
  let reversedCards
  if (meanings.length > 1) {
    reversedCards = meanings.map((meaning, i) => ({
      ...card,
      id: `${card.id}_r_${i}`,
      front: meaning,
      back: card.front,
      langA: card.langB,
      langB: card.langA,
      targetLang,
      category,
    }))
  } else {
    reversedCards = [{
      ...card,
      id: `${card.id}_r`,
      front: card.back,
      back: card.front,
      langA: card.langB,
      langB: card.langA,
      targetLang,
      category,
    }]
  }
  return [forwardCard, ...reversedCards]
}

const ALL_MARK_CARDS = ALL_MARK_CARDS_BASE.flatMap(buildCardPair)

const ALL_ELOSY_CARDS_BASE = [
  { id: 'de_1', front: "Guten Morgen", back: "Good morning", context: "Guten Morgen — the first bridge of the day. Said with warmth, it means: I thought of you when I woke up.", langA: 'de', langB: 'en' },
  { id: 'de_2', front: "Guten Abend", back: "Good evening", context: "Guten Abend — the day winds down, but connection doesn't. A greeting that says: I'm still here.", langA: 'de', langB: 'en' },
  { id: 'de_3', front: "Wie geht es dir?", back: "How are you?", context: "Wie geht es dir? — more than small talk. In German, it's an invitation to be honest.", langA: 'de', langB: 'en' },
  { id: 'de_4', front: "Danke schön", back: "Thank you very much", context: "Danke schön — the extra syllable matters. It says: I really mean it.", langA: 'de', langB: 'en' },
  { id: 'de_5', front: "Bitte", back: "Please / You're welcome", context: "Bitte does double duty — asking and receiving, both with grace. One word, two bridges.", langA: 'de', langB: 'en' },
  { id: 'de_6', front: "Ich liebe dich", back: "I love you", context: "Ich liebe dich — the most important sentence in any language. Said slowly, it lands.", langA: 'de', langB: 'en' },
  { id: 'de_7', front: "Ich vermisse dich", back: "I miss you", context: "Ich vermisse dich — longing has a sound in German. It's soft and honest at once.", langA: 'de', langB: 'en' },
  { id: 'de_8', front: "Bis bald", back: "See you soon", context: "Bis bald — not goodbye. A promise that this isn't the end.", langA: 'de', langB: 'en' },
  { id: 'de_9', front: "Ich bin müde", back: "I am tired", context: "Ich bin müde — simple words, but saying them out loud to someone who listens is everything.", langA: 'de', langB: 'en' },
  { id: 'de_10', front: "Ich bin glücklich", back: "I am happy", context: "Ich bin glücklich — happiness spoken is happiness shared. Let the bridge carry it.", langA: 'de', langB: 'en' },
  { id: 'de_11', front: "Was machst du?", back: "What are you doing?", context: "Was machst du? — a small question that says: I'm thinking about your day, even from far away.", langA: 'de', langB: 'en' },
  { id: 'de_12', front: "Ich denke an dich", back: "I am thinking of you", context: "Ich denke an dich — four words that cross any distance without a ticket.", langA: 'de', langB: 'en' },
  { id: 'de_13', front: "Schlaf gut", back: "Sleep well", context: "Schlaf gut — said at the end of the night, it means: you are safe in my thoughts.", langA: 'de', langB: 'en' },
  { id: 'de_14', front: "Ich komme bald", back: "I am coming soon", context: "Ich komme bald — the sentence that turns waiting into anticipation.", langA: 'de', langB: 'en' },
  { id: 'de_15', front: "Du fehlst mir", back: "I miss you (deeply)", context: "Du fehlst mir — literally 'you are missing from me'. German puts the gap right in the grammar.", langA: 'de', langB: 'en' },
  { id: 'de_16', front: "Entschuldigung", back: "Sorry / Excuse me", context: "Entschuldigung — long word, but it carries real weight. Germans mean it when they say it.", langA: 'de', langB: 'en' },
  { id: 'de_17', front: "Ich verstehe nicht", back: "I don't understand", context: "Ich verstehe nicht — the bravest sentence a learner can say. Confusion is the first step.", langA: 'de', langB: 'en' },
  { id: 'de_18', front: "Kannst du das wiederholen?", back: "Can you repeat that?", context: "Kannst du das wiederholen? — asking again is not weakness. It's how bridges get built properly.", langA: 'de', langB: 'en' },
  { id: 'de_19', front: "Wie heißt du?", back: "What is your name?", context: "Wie heißt du? — the first question. Names are the first bridge between two people.", langA: 'de', langB: 'en' },
  { id: 'de_20', front: "Ich heiße...", back: "My name is...", context: "Ich heiße — the moment you introduce yourself in a new language, something shifts.", langA: 'de', langB: 'en' },
  { id: 'de_21', front: "Woher kommst du?", back: "Where are you from?", context: "Woher kommst du? — geography as curiosity. Every answer opens a new world.", langA: 'de', langB: 'en' },
  { id: 'de_22', front: "Ich komme aus Kenia", back: "I come from Kenya", context: "Ich komme aus Kenia — said in German, it plants a piece of home into a new language.", langA: 'de', langB: 'en' },
  { id: 'de_23', front: "Wie spät ist es?", back: "What time is it?", context: "Wie spät ist es? — time zones separate us. But the question connects us across them.", langA: 'de', langB: 'en' },
  { id: 'de_24', front: "Ich bin hungrig", back: "I am hungry", context: "Ich bin hungrig — basic needs, honestly said, bring people closer than long speeches.", langA: 'de', langB: 'en' },
  { id: 'de_25', front: "Das ist lecker", back: "That is delicious", context: "Das ist lecker — food is culture. Saying this in German makes any meal a shared moment.", langA: 'de', langB: 'en' },
  { id: 'de_26', front: "Ich bin stolz auf dich", back: "I am proud of you", context: "Ich bin stolz auf dich — pride said out loud is a gift. Don't keep it to yourself.", langA: 'de', langB: 'en' },
  { id: 'de_27', front: "Alles wird gut", back: "Everything will be okay", context: "Alles wird gut — not a guarantee, but a choice to believe. Said together, it's stronger.", langA: 'de', langB: 'en' },
  { id: 'de_28', front: "Ich freue mich", back: "I am looking forward to it", context: "Ich freue mich — joy in anticipation. The German language celebrates waiting too.", langA: 'de', langB: 'en' },
  { id: 'de_29', front: "Gute Nacht", back: "Good night", context: "Gute Nacht — the last word of the day. In any language, it means: until tomorrow.", langA: 'de', langB: 'en' },
  { id: 'de_30', front: "Ich lerne Deutsch", back: "I am learning German", context: "Ich lerne Deutsch — five words that change everything. The bridge is being built, one word at a time.", langA: 'de', langB: 'en' },
  { id: 'de_31', front: "Ich habe keine Zeit", back: "I don't have time", context: "Ich habe keine Zeit — honest and direct. German respects clarity, even when the answer is no.", langA: 'de', langB: 'en' },
  { id: 'de_32', front: "Das macht Spaß", back: "That's fun / I enjoy this", context: "Das macht Spaß — learning a language should feel like this. Joy is the best teacher.", langA: 'de', langB: 'en' },
  { id: 'de_33', front: "Ich bin einverstanden", back: "I agree", context: "Ich bin einverstanden — four syllables of yes. A full commitment, not just a nod.", langA: 'de', langB: 'en' },
  { id: 'de_34', front: "Das ist nicht einfach", back: "That is not easy", context: "Das ist nicht einfach — learning German, crossing distances, building bridges. None of it is. But worth it.", langA: 'de', langB: 'en' },
  { id: 'de_35', front: "Ich brauche Hilfe", back: "I need help", context: "Ich brauche Hilfe — asking for help is its own kind of strength. Say it without hesitation.", langA: 'de', langB: 'en' },
  { id: 'de_36', front: "Warte mal kurz", back: "Wait a moment", context: "Warte mal kurz — the tiny pause before something important. Hamburg knows this well.", langA: 'de', langB: 'en' },
  { id: 'de_37', front: "Das stimmt", back: "That's right / That's correct", context: "Das stimmt — simple, clean, certain. One of the most satisfying things to say in any language.", langA: 'de', langB: 'en' },
  { id: 'de_38', front: "Ich bin nicht sicher", back: "I'm not sure", context: "Ich bin nicht sicher — honesty about uncertainty is the beginning of real conversation.", langA: 'de', langB: 'en' },
  { id: 'de_39', front: "Wie bitte?", back: "Pardon? / Could you repeat that?", context: "Wie bitte? — always ask again. Understanding matters more than appearing to understand.", langA: 'de', langB: 'en' },
  { id: 'de_40', front: "Das ist wunderschön", back: "That is beautiful", context: "Das ist wunderschön — wonder + beautiful, combined. German sometimes says exactly what it means.", langA: 'de', langB: 'en' },
  { id: 'de_41', front: "Ich werde bald kommen", back: "I will come soon", context: "Ich werde bald kommen — a promise traveling thousands of kilometers, arriving intact.", langA: 'de', langB: 'en' },
  { id: 'de_42', front: "Was bedeutet das?", back: "What does that mean?", context: "Was bedeutet das? — the most important question a learner can ask. Never stop asking it.", langA: 'de', langB: 'en' },
  { id: 'de_43', front: "Ich spreche ein bisschen Deutsch", back: "I speak a little German", context: "Ich spreche ein bisschen Deutsch — a little is more than nothing. And it grows every day.", langA: 'de', langB: 'en' },
  { id: 'de_44', front: "Du siehst gut aus", back: "You look good", context: "Du siehst gut aus — simple compliments land the hardest. Especially across time zones.", langA: 'de', langB: 'en' },
  { id: 'de_45', front: "Ich warte auf dich", back: "I am waiting for you", context: "Ich warte auf dich — waiting is not passive. It's a form of love that holds space.", langA: 'de', langB: 'en' },
  { id: 'de_46', front: "Das klingt gut", back: "That sounds good", context: "Das klingt gut — agreement with warmth. The German version of 'I'm in'.", langA: 'de', langB: 'en' },
  { id: 'de_47', front: "Keine Sorge", back: "No worries / Don't worry", context: "Keine Sorge — two words that carry a whole hug. Light, warm, reassuring.", langA: 'de', langB: 'en' },
  { id: 'de_48', front: "Ich bin so froh", back: "I am so glad / happy", context: "Ich bin so froh — happiness with emphasis. The 'so' makes it real.", langA: 'de', langB: 'en' },
  { id: 'de_49', front: "Das war wunderbar", back: "That was wonderful", context: "Das war wunderbar — looking back at something shared. The memory already glowing.", langA: 'de', langB: 'en' },
  { id: 'de_50', front: "Ich habe dich vermisst", back: "I missed you", context: "Ich habe dich vermisst — past tense, but the feeling is present. Still here.", langA: 'de', langB: 'en' },
  { id: 'de_51', front: "Wann kommst du?", back: "When are you coming?", context: "Wann kommst du? — the question behind every quiet evening, every unanswered message.", langA: 'de', langB: 'en' },
  { id: 'de_52', front: "Wie war dein Tag?", back: "How was your day?", context: "Wie war dein Tag? — the small question that says: your day matters to me.", langA: 'de', langB: 'en' },
  { id: 'de_53', front: "Das macht nichts", back: "That doesn't matter / Never mind", context: "Das macht nichts — forgiveness in three words. Small ones carry the most weight.", langA: 'de', langB: 'en' },
  { id: 'de_54', front: "Ich freue mich auf dich", back: "I'm looking forward to seeing you", context: "Ich freue mich auf dich — anticipation as a love language. German has a word for everything.", langA: 'de', langB: 'en' },
  { id: 'de_55', front: "Du bist wichtig für mich", back: "You are important to me", context: "Du bist wichtig für mich — not dramatic, just true. The kind of sentence that changes things.", langA: 'de', langB: 'en' },
  { id: 'de_56', front: "Ich denke oft an dich", back: "I often think of you", context: "Ich denke oft an dich — often. Not sometimes. The word 'oft' carries the whole weight.", langA: 'de', langB: 'en' },
  { id: 'de_57', front: "Bis morgen", back: "See you tomorrow / Until tomorrow", context: "Bis morgen — the smallest promise. And sometimes the most important one.", langA: 'de', langB: 'en' },
  { id: 'de_58', front: "Ich bin auf dem Weg", back: "I am on my way", context: "Ich bin auf dem Weg — movement toward someone. Three words that change the waiting.", langA: 'de', langB: 'en' },
  { id: 'de_59', front: "Das höre ich gern", back: "I love to hear that / That's good to hear", context: "Das höre ich gern — the German way of saying: keep going, I needed that.", langA: 'de', langB: 'en' },
  { id: 'de_60', front: "Du machst mich glücklich", back: "You make me happy", context: "Du machst mich glücklich — simple, direct, complete. Some sentences don't need translation.", langA: 'de', langB: 'en' },
]

const ALL_ELOSY_CARDS = ALL_ELOSY_CARDS_BASE.flatMap(buildCardPair)

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

function daysSince(dateStr) {
  if (!dateStr) return 9999
  return Math.floor((Date.now() - new Date(dateStr)) / 86400000)
}

function calcStreak(history) {
  if (!history || history.length === 0) return 0
  const dates = [...new Set(history.map(h => h.date))].sort().reverse()
  const today = todayStr()
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0] })()
  if (dates[0] !== today && dates[0] !== yesterday) return 0
  let streak = 0; let check = dates[0] === today ? today : yesterday
  for (const date of dates) {
    if (date === check) { streak++; const d = new Date(check); d.setDate(d.getDate() - 1); check = d.toISOString().split('T')[0] }
    else break
  }
  return streak
}
function getLast7Days(history) {
  const result = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const sessions = history?.filter(h => h.date === dateStr) || []
    result.push({ date: dateStr, done: sessions.length > 0, total: sessions.reduce((a, b) => a + (b.total || 0), 0), correct: sessions.reduce((a, b) => a + (b.correct || 0), 0) })
  }
  return result
}
async function saveSessionHistory(uid, correct, total, currentHistory) {
  const entry = { date: todayStr(), correct, total, ts: Date.now() }
  const updated = [entry, ...(currentHistory || [])].slice(0, 60)
  await updateDoc(doc(db, 'users', uid), { sessionHistory: updated })
  return updated
}
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
  const reviews = [...shuffle(forced), ...shuffle(due)]
  // New cards only when fewer than 3 reviews available — reviews always come first
  const newBatch = reviews.length < 3 ? shuffle(newCards).slice(0, 5) : []
  return [...reviews, ...newBatch].slice(0, SESSION_SIZE)
}
function checkMastery(allCards, cardProgress, sessionCorrect, sessionTotal) {
  const active = allCards.filter(c => {
    const p = cardProgress[c.id]
    return p && (p.interval > 0 || p.wrongSessions > 0)
  })
  if (active.length < 20) return false
  if (sessionTotal > 0 && sessionCorrect / sessionTotal < 0.6) return false
  const mastered = active.filter(c => (cardProgress[c.id]?.interval || 0) >= 7)
  return mastered.length / active.length >= MASTERY_THRESHOLD
}
function getNextNewCards(allCards, cardProgress, count) {
  const unstarted = allCards.filter(c => !cardProgress[c.id])
  const unstartedEN = unstarted.filter(c => c.targetLang === 'en')
  const unstartedSW = unstarted.filter(c => c.targetLang === 'sw')
  if (unstartedEN.length >= count) return unstartedEN.slice(0, count)
  const maxSW = Math.max(0, Math.floor(count * 0.2))
  const swCards = unstartedSW.slice(0, Math.min(maxSW, count - unstartedEN.length))
  return [...unstartedEN, ...swCards].slice(0, count)
}
function getLangStats(allCards, cardProgress, langCode) {
  const cards = allCards.filter(c => c.targetLang === langCode)
  // Only count as "active" if answered at least once (interval > 0 OR wrongSessions > 0)
  // Cards that are unlocked but never answered (interval:0, wrongSessions:0) do NOT count
  const active = cards.filter(c => {
    const p = cardProgress[c.id]
    return p && (p.interval > 0 || p.wrongSessions > 0)
  })
  const mastered = active.filter(c => (cardProgress[c.id]?.interval || 0) >= 7)
  return { total: cards.length, active: active.length, mastered: mastered.length }
}
async function saveSessionState(uid, queue, index, newProgress) {
  try { await setDoc(doc(db, 'users', uid, 'session', 'current'), { queue, index, newProgress, savedAt: Date.now() }) }
  catch (e) { console.warn('Could not save session state:', e) }
}
async function clearSessionState(uid) {
  try { await deleteDoc(doc(db, 'users', uid, 'session', 'current')) }
  catch (e) { console.warn('Could not clear session state:', e) }
}

const GLOBAL_CSS = `
@keyframes vocaraFadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes metalFlow {
  0%   { background-position: 0% center; }
  100% { background-position: 100% center; }
}
@keyframes rainbowBtnShift {
  0%   { background-position: 0% 0%; }
  100% { background-position: 0% 200%; }
}
@keyframes rainbowCardBorder {
  0%   { box-shadow: 0 0 0 2px #FF6B6B, 0 0 20px #FF6B6B55, inset 0 0 30px #FF6B6B18; }
  20%  { box-shadow: 0 0 0 2px #FFD93D, 0 0 20px #FFD93D55, inset 0 0 30px #FFD93D18; }
  40%  { box-shadow: 0 0 0 2px #6BCB77, 0 0 20px #6BCB7755, inset 0 0 30px #6BCB7718; }
  60%  { box-shadow: 0 0 0 2px #4D96FF, 0 0 20px #4D96FF55, inset 0 0 30px #4D96FF18; }
  80%  { box-shadow: 0 0 0 2px #C77DFF, 0 0 20px #C77DFF55, inset 0 0 30px #C77DFF18; }
  100% { box-shadow: 0 0 0 2px #FF6B6B, 0 0 20px #FF6B6B55, inset 0 0 30px #FF6B6B18; }
}

.vocara-screen {
  animation: vocaraFadeIn 0.3s ease both;
  position: relative;
}
.vocara-screen::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.88' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 160px 160px;
  opacity: 0.022;
  pointer-events: none;
  z-index: 9999;
}

button {
  transition: transform 0.07s ease, box-shadow 0.07s ease, filter 0.07s ease;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  font-family: 'Inter', system-ui, sans-serif;
  position: relative;
  overflow: hidden;
}
button:active {
  transform: translateY(6px) !important;
  box-shadow: 0 1px 4px rgba(0,0,0,0.7) !important;
  filter: brightness(0.8) !important;
}
`

function makeStyles(th) {
  return {
    container: { minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: th.bgGrad },
    homeBox: { textAlign: 'center', padding: '20px', width: '100%', maxWidth: '420px' },
    greeting: { color: th.sub, fontSize: '0.95rem', marginBottom: '2px' },
    title: {
      fontSize: 'clamp(1.8rem, 7vw, 2.6rem)', marginBottom: '20px', fontWeight: '900',
      fontFamily: "'Playfair Display', Georgia, serif",
      background: th.metalText,
      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
      backgroundSize: '300% auto',
      animation: 'metalFlow 8s linear infinite',
      filter: `drop-shadow(0 0 10px ${th.glowColor}70)`,
    },
    slogan: { color: th.sub, fontSize: '1rem', marginBottom: '32px', lineHeight: '1.8' },
    card: {
      background: th.card, borderRadius: '14px', padding: '16px', marginBottom: '10px', textAlign: 'left',
      border: `1px solid ${th.border}`,
      boxShadow: `inset 0 0 18px ${th.glowColor}14, 0 0 0 1px ${th.accent}20, 0 2px 12px rgba(0,0,0,0.4)`,
    },
    bigCard: {
      background: `radial-gradient(ellipse at 50% 35%, transparent 20%, rgba(0,0,0,0.38) 100%), ${th.card}`,
      borderRadius: '18px', padding: '28px 20px', marginBottom: '16px',
      textAlign: 'center', minHeight: '180px', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      border: th.rainbow ? '2px solid transparent' : `1px solid ${th.accent}55`,
      boxShadow: th.rainbow ? undefined : `inset 0 0 30px ${th.glowColor}30, 0 0 28px ${th.accent}22, 0 0 0 1px ${th.accent}35, 0 6px 24px rgba(0,0,0,0.55)`,
      animation: th.rainbow ? 'rainbowCardBorder 4s linear infinite' : undefined,
      position: 'relative', overflow: 'hidden',
    },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', width: '100%' },
    cardLabel: { color: th.sub, fontSize: '0.75rem', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' },
    langRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
    lang: { color: th.text, fontSize: '0.95rem' },
    langPct: { color: th.gold, fontSize: '0.85rem' },
    noPartner: { color: th.sub, fontSize: '0.85rem', fontStyle: 'italic', margin: 0 },
    cardFront: { color: th.text, fontSize: 'clamp(1rem, 4vw, 1.3rem)', marginBottom: '16px', fontWeight: 'bold' },
    cardBack: { color: th.accent, fontSize: 'clamp(1.4rem, 5vw, 1.8rem)', fontWeight: 'bold', marginBottom: '8px' },
    cardPronunciation: { color: th.gold, fontSize: '0.78rem', marginBottom: '10px', letterSpacing: '0.5px' },
    cardContext: { color: th.sub, fontSize: '0.8rem', fontStyle: 'italic', lineHeight: '1.55', marginBottom: '18px', maxWidth: '310px', textAlign: 'center' },
    dirLabel: { fontSize: '0.8rem', color: th.sub, marginBottom: '12px', letterSpacing: '1px' },
    progressBar: { height: '4px', background: th.border, borderRadius: '2px', marginTop: '4px', overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: '2px', transition: 'width 0.5s ease', background: th.accent },
    button: {
      background: th.btnFaceGrad, color: th.btnTextColor, border: 'none',
      padding: '13px 28px', borderRadius: '50px', fontSize: '1rem', cursor: 'pointer',
      fontWeight: '700', width: '100%', marginBottom: '8px',
      boxShadow: th.shadow3d,
      backgroundSize: '300% auto',
      animation: 'metalFlow 6s linear infinite',
    },
    menuBtn: {
      background: th.card, color: th.text, border: `1px solid ${th.border}`,
      padding: '14px 16px', borderRadius: '14px', fontSize: '0.95rem', cursor: 'pointer',
      fontWeight: '500', width: '100%', marginBottom: '8px', textAlign: 'left',
      display: 'flex', alignItems: 'center', gap: '10px',
      boxShadow: `0 3px 0 ${th.border}, 0 5px 10px rgba(0,0,0,0.3)`,
    },
    menuBtnDisabled: {
      background: th.card, color: th.sub, border: `1px solid ${th.border}`,
      padding: '14px 16px', borderRadius: '14px', fontSize: '0.95rem', cursor: 'not-allowed',
      fontWeight: '400', width: '100%', marginBottom: '8px', textAlign: 'left',
      display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.45,
    },
    menuBtnActive: {
      background: th.accent + '18', color: th.text, border: `1px solid ${th.accent}`,
      padding: '14px 16px', borderRadius: '14px', fontSize: '0.95rem', cursor: 'pointer',
      fontWeight: '500', width: '100%', marginBottom: '8px', textAlign: 'left',
      display: 'flex', alignItems: 'center', gap: '10px',
      boxShadow: `0 3px 0 ${th.sub}, 0 5px 10px rgba(0,0,0,0.3)`,
    },
    menuBtnWarning: {
      background: '#f4433611', color: th.text, border: '1px solid #f44336',
      padding: '14px 16px', borderRadius: '14px', fontSize: '0.95rem', cursor: 'pointer',
      fontWeight: '500', width: '100%', marginBottom: '8px', textAlign: 'left',
      display: 'flex', alignItems: 'center', gap: '10px',
      boxShadow: '0 3px 0 #8b0000, 0 5px 10px rgba(0,0,0,0.3)',
    },
    optionBtn: (selected, correct, revealed) => {
      let bg = th.card; let border = `1px solid ${th.border}`; let shadow = `0 2px 0 ${th.border}`
      if (revealed && correct) { bg = '#4CAF5022'; border = '2px solid #4CAF50'; shadow = '0 2px 0 #2e7d32' }
      else if (revealed && selected && !correct) { bg = '#f4433622'; border = '2px solid #f44336'; shadow = '0 2px 0 #8b0000' }
      else if (selected) { bg = th.accent + '22'; border = `2px solid ${th.accent}`; shadow = `0 2px 0 ${th.sub}` }
      return { background: bg, color: th.text, border, padding: '12px 16px', borderRadius: '12px', fontSize: '0.9rem', cursor: revealed ? 'default' : 'pointer', width: '100%', marginBottom: '8px', textAlign: 'left', boxShadow: shadow }
    },
    revealBtn: {
      background: th.btnFaceGrad, color: th.btnTextColor, border: 'none',
      padding: '12px 28px', borderRadius: '50px', fontSize: '1rem', cursor: 'pointer', fontWeight: '700',
      boxShadow: th.shadow3d,
      backgroundSize: '300% auto',
      animation: 'metalFlow 6s linear infinite',
    },
    answerRow: { display: 'flex', gap: '10px', width: '100%' },
    wrongBtn: {
      flex: 1, background: th.card, color: '#e06c75', border: '2px solid #e06c75',
      padding: '12px', borderRadius: '50px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold',
      boxShadow: '0 4px 0 #8b1c24, 0 6px 12px rgba(0,0,0,0.35)',
    },
    easyBtn: {
      flex: '0 0 auto', background: th.gold + '18', color: th.gold, border: `2px solid ${th.gold}`,
      padding: '8px 14px', borderRadius: '50px', fontSize: '0.8rem', cursor: 'pointer',
      fontWeight: 'bold', alignSelf: 'center',
      boxShadow: `0 3px 0 ${th.sub}, 0 5px 10px rgba(0,0,0,0.3)`,
    },
    rightBtn: {
      flex: 1, background: th.btnFaceGrad, color: th.btnTextColor, border: 'none',
      padding: '12px', borderRadius: '50px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold',
      boxShadow: th.shadow3d,
      backgroundSize: '300% auto',
      animation: 'metalFlow 6s linear infinite',
    },
    stopBtn: {
      background: 'transparent', color: '#f44336', border: '1px solid #f44336',
      padding: '5px 12px', borderRadius: '50px', fontSize: '0.8rem', cursor: 'pointer',
      boxShadow: '0 2px 0 #8b0000',
    },
    logoutBtn: {
      background: 'transparent', color: th.sub, border: `1px solid ${th.border}`,
      padding: '10px 24px', borderRadius: '50px', fontSize: '0.85rem', cursor: 'pointer',
      width: '100%', marginTop: '4px',
      boxShadow: `0 2px 0 ${th.border}`,
    },
    legalBtn: {
      background: 'transparent', color: th.sub, border: 'none',
      padding: '8px', fontSize: '0.75rem', cursor: 'pointer', width: '100%', marginTop: '8px', opacity: 0.5,
    },
    error: { color: '#ff6b6b', fontSize: '0.85rem', marginTop: '16px' },
    themeRow: { display: 'flex', gap: '8px', marginBottom: '12px' },
    themeBtn: (active, color) => ({
      flex: 1, padding: '10px 4px', borderRadius: '50px',
      border: active ? `2px solid ${color}` : `1px solid ${th.border}`,
      background: active ? color + '22' : th.card, color: th.text,
      cursor: 'pointer', fontSize: '0.75rem', fontWeight: active ? 'bold' : 'normal',
      boxShadow: active ? `0 3px 0 ${th.sub}` : `0 2px 0 ${th.border}`,
    }),
    backBtn: {
      background: 'transparent', color: th.sub, border: 'none',
      padding: '6px 0', fontSize: '0.9rem', cursor: 'pointer', marginBottom: '12px',
      textAlign: 'left', display: 'block',
    },
    headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' },
    input: { width: '100%', padding: '12px', borderRadius: '12px', border: `1px solid ${th.border}`, background: th.card, color: th.text, fontSize: '1rem', marginBottom: '10px', boxSizing: 'border-box' },
    langSelectBtn: (selected) => ({
      padding: '10px 14px', borderRadius: '12px',
      border: selected ? `2px solid ${th.accent}` : `1px solid ${th.border}`,
      background: selected ? th.accent + '22' : th.card, color: th.text,
      cursor: 'pointer', fontSize: '0.9rem', marginBottom: '8px', width: '100%',
      textAlign: 'left', display: 'flex', justifyContent: 'space-between',
      boxShadow: selected ? `0 2px 0 ${th.sub}` : `0 2px 0 ${th.border}`,
    }),
    infoBox: { background: th.accent + '18', border: `1px solid ${th.accent}`, borderRadius: '12px', padding: '12px', marginBottom: '10px', color: th.text, fontSize: '0.9rem' },
    resumeBanner: { background: th.card, border: `1px solid ${th.accent}`, borderRadius: '14px', padding: '14px 16px', marginBottom: '12px', textAlign: 'left' },
    catBtn: {
      background: th.btnFaceGrad, color: th.btnTextColor, border: 'none',
      padding: '14px 10px', borderRadius: '20px', fontSize: '0.84rem', cursor: 'pointer',
      fontWeight: '700', flex: 1, lineHeight: '1.3', textAlign: 'center',
      boxShadow: th.shadow3d,
      backgroundSize: '300% auto',
      animation: 'metalFlow 6s linear infinite',
      fontFamily: "'Playfair Display', Georgia, serif",
      letterSpacing: '0.1px',
    },
    navBtn: {
      background: 'transparent', color: th.sub, border: `1px solid ${th.border}`,
      padding: '11px 16px', borderRadius: '12px', fontSize: '0.88rem', cursor: 'pointer',
      fontWeight: '500', width: '100%', marginBottom: '6px', textAlign: 'center',
      boxShadow: `0 2px 0 ${th.border}`,
      fontFamily: "'Inter', system-ui, sans-serif",
    },
  }
}

const T = {
  de: {
    hello: 'Hallo', mySession: '🃏 Meine Session', whereAmI: '🎯 Wo stehe ich?',
    aiChat: '🤖 KI-Gespräch', dailyPhrase: '☀️ Tages-Phrase',
    progressBtn: '📈 Fortschritt', logout: 'Abmelden',
    myProgress: 'Dein Fortschritt', notActive: 'Noch kein Partner',
    card: 'Karte', of: 'von', showSolution: 'Lösung anzeigen',
    correct: 'Richtig', wrong: 'Falsch', easy: '⚡ Easy', stop: '✕ Beenden',
    stopConfirm: 'Session wirklich beenden?', done: 'Fertig!', back: 'Zurück',
    masteryMsg: '85% gemeistert — 3 neue Karten freigeschaltet!',
    comingSoon: 'Kommt bald', chooseTheme: 'Wähle dein Theme', settingsTitle: 'Einstellungen',
    partnerTitle: '🤝 Partner verbinden', partnerInvite: 'Teile diesen Link mit deinem Partner:',
    partnerCopy: 'Link kopieren', partnerCopied: '✓ Kopiert!', partnerCode: 'Oder gib den Code deines Partners ein:',
    partnerConnect: 'Verbinden', partnerConnected: 'Partner verbunden ✓',
    partnerDisconnect: 'Verbindung trennen', partnerAccept: 'Annehmen', partnerDecline: 'Ablehnen',
    langSetupTitle: 'Welche Sprachen lernst du?', langSetupSub: 'Wähle 1 bis 3 Sprachen', langSetupDone: 'Weiter',
    testQuestion: 'Frage', testOf: 'von', testDone: 'Geschätztes Niveau:',
    testBack: 'Zurück zum Menü', testScore: 'Richtig beantwortet', testStop3: '3 falsch hintereinander — Test endet hier.',
    resumeTitle: 'Weitermachen wo du aufgehört hast?', resumeOf: 'von', resumeCards: 'Karten beantwortet',
    resumeContinue: 'Weiter', resumeDiscard: 'Neu starten',
    pronunciation: 'Aussprache',
    streak: 'Tage in Folge', streakNone: 'Noch kein Streak', historyLabel: 'Letzte 7 Tage',
    impressumLink: 'Impressum & Datenschutz',
    impressumTitle: 'Impressum',
    datenschutzTitle: 'Datenschutzerklärung',
    monthlyTestBanner: '🎯 Monatlicher Level-Check fällig!',
    monthlyTestSub: 'Teste dein aktuelles Niveau',
  },
  en: {
    hello: 'Hello', mySession: '🃏 My session', whereAmI: '🎯 Where do I stand?',
    aiChat: '🤖 AI conversation', dailyPhrase: '☀️ Phrase of the day',
    progressBtn: '📈 Progress', logout: 'Sign out',
    myProgress: 'Your progress', notActive: 'No partner yet',
    card: 'Card', of: 'of', showSolution: 'Show answer',
    correct: 'Correct', wrong: 'Wrong', easy: '⚡ Easy', stop: '✕ Stop',
    stopConfirm: 'Stop this session?', done: 'Done!', back: 'Back',
    masteryMsg: '85% mastered — 3 new cards unlocked!',
    comingSoon: 'Coming soon', chooseTheme: 'Choose your theme', settingsTitle: 'Settings',
    partnerTitle: '🤝 Connect partner', partnerInvite: 'Share this link with your partner:',
    partnerCopy: 'Copy link', partnerCopied: '✓ Copied!', partnerCode: "Or enter your partner's code:",
    partnerConnect: 'Connect', partnerConnected: 'Partner connected ✓',
    partnerDisconnect: 'Disconnect', partnerAccept: 'Accept', partnerDecline: 'Decline',
    langSetupTitle: 'Which languages are you learning?', langSetupSub: 'Choose 1 to 3 languages', langSetupDone: 'Continue',
    testQuestion: 'Question', testOf: 'of', testDone: 'Estimated level:',
    testBack: 'Back to menu', testScore: 'Correct answers', testStop3: '3 wrong in a row — test ends here.',
    resumeTitle: 'Continue where you left off?', resumeOf: 'of', resumeCards: 'cards answered',
    resumeContinue: 'Continue', resumeDiscard: 'Start fresh',
    pronunciation: 'Pronunciation',
    streak: 'days in a row', streakNone: 'No streak yet', historyLabel: 'Last 7 days',
    impressumLink: 'Imprint & Privacy',
    impressumTitle: 'Imprint',
    datenschutzTitle: 'Privacy Policy',
    monthlyTestBanner: '🎯 Monthly level check due!',
    monthlyTestSub: 'Test your current level',
  }
}

// ── ONBOARDING SCREEN ─────────────────────────────────────────
const ONBOARDING_SLIDES_DE = [
  {
    emoji: '🌉',
    title: 'Willkommen bei Vocara',
    text: 'Die Stimme ist die Brücke.\nVocara hilft dir, eine neue Sprache Schritt für Schritt aufzubauen — gemeinsam mit deinem Partner.',
  },
  {
    emoji: '🃏',
    title: 'Intelligente Karteikarten',
    text: 'Vocara zeigt dir Karten genau dann, wenn du sie brauchst. Schnelle Antworten = längere Pause. Schwierige Karten kommen öfter zurück.',
  },
  {
    emoji: '🤝',
    title: 'Lernt zusammen',
    text: 'Verbinde dich mit deinem Partner. Ihr seht gegenseitig euren Fortschritt — egal wie weit ihr voneinander entfernt seid.',
  },
  {
    emoji: '🚀',
    title: 'Bereit?',
    text: 'Mach zuerst einen kurzen Level-Check, damit wir wissen wo du startest. Es dauert nur 2 Minuten.',
  },
]
const ONBOARDING_SLIDES_EN = [
  {
    emoji: '🌉',
    title: 'Welcome to Vocara',
    text: 'The voice is the bridge.\nVocara helps you build a new language step by step — together with your partner.',
  },
  {
    emoji: '🃏',
    title: 'Smart flashcards',
    text: 'Vocara shows you cards exactly when you need them. Fast answers = longer break. Difficult cards come back more often.',
  },
  {
    emoji: '🤝',
    title: 'Learn together',
    text: "Connect with your partner. You can see each other's progress — no matter how far apart you are.",
  },
  {
    emoji: '🚀',
    title: 'Ready?',
    text: 'First, take a quick level check so we know where you start. It only takes 2 minutes.',
  },
]

function OnboardingScreen({ lang, theme, onDone }) {
  const th = THEMES[theme]
  const slides = lang === 'de' ? ONBOARDING_SLIDES_DE : ONBOARDING_SLIDES_EN
  const [index, setIndex] = useState(0)
  const isLast = index === slides.length - 1
  const slide = slides[index]

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: th.bg }} className="vocara-screen">
      <div style={{ textAlign: 'center', padding: '32px 24px', width: '100%', maxWidth: '420px' }}>
        {/* Dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
          {slides.map((_, i) => (
            <div key={i} style={{ width: i === index ? '24px' : '8px', height: '8px', borderRadius: '4px', background: i === index ? th.accent : th.border, transition: 'all 0.3s ease' }} />
          ))}
        </div>

        {/* Slide content */}
        <div key={index} style={{ animation: 'vocaraFadeIn 0.3s ease both' }}>
          <p style={{ fontSize: '4rem', margin: '0 0 16px 0' }}>{slide.emoji}</p>
          <h2 style={{ color: th.gold, fontSize: '1.5rem', fontWeight: 'bold', margin: '0 0 16px 0' }}>{slide.title}</h2>
          <p style={{ color: th.sub, fontSize: '1rem', lineHeight: '1.7', margin: '0 0 40px 0', whiteSpace: 'pre-line' }}>{slide.text}</p>
        </div>

        {/* Buttons */}
        <button
          style={{ background: th.accent, color: '#fff', border: 'none', padding: '14px 28px', borderRadius: '10px', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold', width: '100%', marginBottom: '12px' }}
          onClick={() => isLast ? onDone() : setIndex(i => i + 1)}
        >
          {isLast ? (lang === 'de' ? 'Level-Check starten →' : 'Start level check →') : (lang === 'de' ? 'Weiter →' : 'Next →')}
        </button>
        {!isLast && (
          <button
            style={{ background: 'transparent', color: th.sub, border: 'none', padding: '8px', fontSize: '0.85rem', cursor: 'pointer', width: '100%' }}
            onClick={onDone}
          >
            {lang === 'de' ? 'Überspringen' : 'Skip'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── IMPRESSUM SCREEN ──────────────────────────────────────────
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
      <button style={s.button} onClick={onBack}>{t.back}</button>
    </div></div>
  )
}

function StreakWidget({ history, th, t }) {
  const streak = calcStreak(history)
  const days = getLast7Days(history)
  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
  const today = todayStr()
  return (
    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${th.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ color: th.sub, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{t.historyLabel}</span>
        <span style={{ color: streak > 0 ? th.gold : th.sub, fontSize: '0.85rem', fontWeight: streak > 0 ? 'bold' : 'normal' }}>
          {streak > 0 ? `🔥 ${streak} ${t.streak}` : t.streakNone}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '4px', justifyContent: 'space-between' }}>
        {days.map((day, i) => {
          const isToday = day.date === today
          const pct = day.total > 0 ? Math.round((day.correct / day.total) * 100) : 0
          const d = new Date(day.date)
          const dayLabel = weekDays[d.getDay() === 0 ? 6 : d.getDay() - 1]
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
              <div style={{ width: '100%', height: '32px', borderRadius: '6px', background: day.done ? (pct >= 70 ? th.accent : th.accent + '66') : th.border, border: isToday ? `2px solid ${th.gold}` : '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: day.done ? '#fff' : th.sub, fontWeight: 'bold' }}>
                {day.done ? (day.total > 0 ? `${pct}%` : '✓') : ''}
              </div>
              <span style={{ color: isToday ? th.gold : th.sub, fontSize: '0.65rem' }}>{dayLabel}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── KI-GESPRÄCH ───────────────────────────────────────────────
function KiGespraechScreen({ lang, theme, onBack, userName }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [translations, setTranslations] = useState({})
  const [translating, setTranslating] = useState(null)
  const bottomRef = useRef(null)
  const isMarkLang = lang === 'de'
  const targetLang = isMarkLang ? 'English' : 'German'
  const nativeLang = isMarkLang ? 'German' : 'English'
  const ttsLangCode = isMarkLang ? 'en' : 'de'
  const systemPrompt = `You are Vocara, a friendly language tutor helping ${userName} learn ${targetLang}. You must respond ONLY in ${targetLang}. Never use ${nativeLang} in your response. If the user writes in ${nativeLang}, still respond entirely in ${targetLang} and gently encourage them to try in ${targetLang} too. If the user makes a grammar mistake in ${targetLang}, have a natural conversation first, then add a short gentle correction at the end like "💡 Small tip: ..." Keep responses short (2-4 sentences). Be warm and natural — like a friend who happens to be a language expert. The Vocara philosophy: The voice is the bridge.`

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return
    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages); setInput(''); setLoading(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 300,
          system: systemPrompt,
          messages: newMessages,
        })
      })
      const data = await response.json()
      const reply = data.content?.[0]?.text || '...'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Verbindungsfehler. Bitte versuche es erneut.' }])
    }
    setLoading(false)
  }

  const translateMessage = async (msgIndex, text) => {
    setTranslating(msgIndex)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 200,
          messages: [{ role: 'user', content: `Translate this ${targetLang} text to ${nativeLang}. Return ONLY the translation, no explanation:\n\n"${text}"` }],
        })
      })
      const data = await res.json()
      const translation = (data.content?.[0]?.text || '').trim()
      setTranslations(prev => ({ ...prev, [msgIndex]: translation }))
    } catch (e) {
      setTranslations(prev => ({ ...prev, [msgIndex]: '⚠️ Übersetzung fehlgeschlagen' }))
    }
    setTranslating(null)
  }

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: th.bg }} className="vocara-screen">
      <div style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <div style={{ padding: '16px 20px 10px', background: th.bg, borderBottom: `1px solid ${th.border}`, display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <button style={{ ...s.backBtn, marginBottom: 0 }} onClick={onBack}>←</button>
          <div>
            <p style={{ color: th.text, fontWeight: 'bold', margin: 0, fontSize: '1rem' }}>🤖 KI-Gespräch</p>
            <p style={{ color: th.sub, fontSize: '0.75rem', margin: 0 }}>{isMarkLang ? `Übe Englisch mit KI` : 'Practice German with AI'}</p>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: '40px' }}>
              <p style={{ color: th.sub, fontSize: '0.9rem', lineHeight: '1.6' }}>
                {isMarkLang ? `Schreib auf Englisch oder Deutsch — die KI antwortet immer auf Englisch.` : 'Write in German or English — the AI always responds in German.'}
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: msg.role === 'user' ? th.accent : th.card, border: msg.role === 'assistant' ? `1px solid ${th.border}` : 'none', color: th.text, fontSize: '0.9rem', lineHeight: '1.5' }}>
                {msg.content}
              </div>
              {msg.role === 'assistant' && (
                <div style={{ maxWidth: '85%', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={() => speak(msg.content, ttsLangCode)}
                    style={{ background: 'none', border: 'none', color: th.sub, fontSize: '1rem', cursor: 'pointer', padding: '2px 4px', opacity: 0.6, flexShrink: 0 }}
                  >🔊</button>
                  {translations[i] ? (
                    <p style={{ color: th.sub, fontSize: '0.78rem', margin: 0, lineHeight: '1.4', fontStyle: 'italic', padding: '0 4px' }}>{translations[i]}</p>
                  ) : (
                    <button
                      onClick={() => translateMessage(i, msg.content)}
                      disabled={translating === i}
                      style={{ background: 'none', border: 'none', color: th.sub, fontSize: '0.75rem', cursor: 'pointer', padding: '2px 4px', opacity: translating === i ? 0.5 : 0.7, textDecoration: 'underline' }}
                    >
                      {translating === i ? '...' : isMarkLang ? 'Übersetzen' : 'Translate'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ padding: '10px 14px', borderRadius: '16px 16px 16px 4px', background: th.card, border: `1px solid ${th.border}`, color: th.sub, fontSize: '1.2rem', letterSpacing: '4px' }}>···</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div style={{ padding: '12px 16px', background: th.bg, borderTop: `1px solid ${th.border}`, display: 'flex', gap: '8px', alignItems: 'flex-end', flexShrink: 0 }}>
          <textarea
            style={{ flex: 1, padding: '10px 14px', borderRadius: '12px', border: `1px solid ${th.border}`, background: th.card, color: th.text, fontSize: '0.95rem', resize: 'none', minHeight: '44px', maxHeight: '120px', fontFamily: 'inherit', outline: 'none', lineHeight: '1.4' }}
            placeholder={isMarkLang ? 'Schreib auf Englisch...' : 'Write in German...'}
            value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} rows={1}
          />
          <button style={{ background: th.accent, border: 'none', borderRadius: '12px', width: '44px', height: '44px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '1.1rem', opacity: loading ? 0.5 : 1, flexShrink: 0, color: '#fff' }} onClick={sendMessage} disabled={loading}>➤</button>
        </div>
      </div>
    </div>
  )
}

function SatzTrainingScreen({ lang, theme, onBack, allCards, cardProgress, userName }) {
  const th = THEMES[theme]; const s = makeStyles(th)
  const isMarkLang = lang === 'de'
  const [exercises, setExercises] = useState([])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [scrambleOrder, setScrambleOrder] = useState([])
  const [scrambleBank, setScrambleBank] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const masteredVocab = allCards
    .filter(c => (cardProgress[c.id]?.interval || 0) >= 7 && !c.id.includes('_r'))
    .map(c => c.front)
    .slice(0, 30)

  useEffect(() => {
    if (masteredVocab.length < 5) { setError('not_enough'); setLoading(false); return }
    generateExercises()
  }, [])

  const ttsLangCode = isMarkLang ? 'en' : 'de'

  const generateExercises = async () => {
    setLoading(true); setError(null)
    const targetLang = isMarkLang ? 'English' : 'German'
    const nativeLang = isMarkLang ? 'German' : 'English'
    const prompt = `Generate exactly 8 sentence exercises for a ${targetLang} learner (B1 level) whose native language is ${nativeLang}. Use these mastered vocabulary words where possible: ${masteredVocab.join(', ')}.

Mix these 3 types:
- "scramble": a ${targetLang} sentence split into shuffled word chips, user puts them in order
- "fill_blank": a ${targetLang} sentence with one blank, 4 multiple choice options
- "translate": a ${nativeLang} sentence to translate to ${targetLang}, 4 multiple choice options

Return ONLY a valid JSON array. No markdown. No explanation. Example format:
[
  {"type":"scramble","sentence":"I am on my way","shuffled":["my","am","way","on","I"],"vocab":"I'm on my way"},
  {"type":"fill_blank","blank_sentence":"She ___ very tired today.","options":["is","are","am","be"],"correct_index":0,"vocab":"tired"},
  {"type":"translate","prompt_sentence":"Ich bin dabei.","options":["I am in.","I'm down.","I am here.","I will come."],"correct_index":1,"vocab":"I'm down"}
]`

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] })
      })
      const data = await res.json()
      const text = data.content?.[0]?.text || ''
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)
      setExercises(parsed)
      if (parsed[0]?.type === 'scramble') initScramble(parsed[0])
    } catch (e) { setError('api') }
    setLoading(false)
  }

  const initScramble = (ex) => {
    const shuffled = [...ex.shuffled].sort(() => Math.random() - 0.5)
    setScrambleBank(shuffled.map((w, i) => ({ word: w, id: i })))
    setScrambleOrder([])
  }

  const ex = exercises[index]

  const handleNext = (wasCorrect) => {
    if (wasCorrect) setScore(s => s + 1)
    const next = index + 1
    if (next >= exercises.length) { setDone(true); return }
    setIndex(next); setSelected(null); setRevealed(false)
    if (exercises[next]?.type === 'scramble') initScramble(exercises[next])
  }

  const checkScramble = () => {
    const answer = scrambleOrder.map(w => w.word).join(' ')
    const correct = answer.trim().toLowerCase() === ex.sentence.trim().toLowerCase()
    setRevealed(true); setSelected(correct ? 'correct' : 'wrong')
    speak(ex.sentence, ttsLangCode)
  }

  const addWord = (item) => {
    setScrambleOrder(o => [...o, item])
    setScrambleBank(b => b.filter(w => w.id !== item.id))
  }
  const removeWord = (item) => {
    setScrambleBank(b => [...b, item])
    setScrambleOrder(o => o.filter(w => w.id !== item.id))
  }

  if (loading) return (
    <div style={s.container} className="vocara-screen">
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: th.accent, fontSize: '1.4rem', marginBottom: '12px' }}>✦</p>
        <p style={{ color: th.sub, fontSize: '0.9rem' }}>{isMarkLang ? 'KI erstellt deine Satzübungen...' : 'AI is preparing your sentence exercises...'}</p>
      </div>
    </div>
  )

  if (error) return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>← {isMarkLang ? 'Zurück' : 'Back'}</button>
      <p style={{ color: th.accent, fontSize: '2rem', marginBottom: '12px' }}>⚠️</p>
      <p style={{ color: th.text, marginBottom: '16px' }}>
        {error === 'not_enough'
          ? (isMarkLang ? 'Du musst zuerst mindestens 5 Karten meistern.' : 'Master at least 5 cards first.')
          : (isMarkLang ? 'Verbindungsfehler. Bitte erneut versuchen.' : 'Connection error. Please try again.')}
      </p>
      {error === 'api' && <button style={s.button} onClick={generateExercises}>{isMarkLang ? 'Erneut versuchen' : 'Try again'}</button>}
      <button style={s.logoutBtn} onClick={onBack}>{isMarkLang ? 'Zurück' : 'Back'}</button>
    </div></div>
  )

  if (done) return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <h1 style={s.title}>{isMarkLang ? 'Fertig! 🎉' : 'Done! 🎉'}</h1>
      <div style={{ ...s.card, textAlign: 'center', padding: '24px' }}>
        <p style={{ color: th.gold, fontSize: '3rem', fontWeight: 'bold', margin: 0 }}>{score}/{exercises.length}</p>
        <p style={{ color: th.sub, fontSize: '0.9rem', marginTop: '8px' }}>
          {score === exercises.length ? '🏆 Perfekt!' : score >= exercises.length * 0.7 ? '💪 Sehr gut!' : '📚 Weiter üben!'}
        </p>
      </div>
      <button style={s.button} onClick={() => { setIndex(0); setScore(0); setDone(false); setLoading(true); generateExercises() }}>
        {isMarkLang ? '🔄 Neue Übungen' : '🔄 New exercises'}
      </button>
      <button style={s.logoutBtn} onClick={onBack}>{isMarkLang ? 'Zurück' : 'Back'}</button>
    </div></div>
  )

  if (!ex) return null

  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <div style={s.cardHeader}>
        <p style={s.greeting}>{index + 1} / {exercises.length}</p>
        <button style={s.stopBtn} onClick={onBack}>✕</button>
      </div>
      <div style={s.progressBar}><div style={{ ...s.progressFill, width: `${((index) / exercises.length) * 100}%` }} /></div>

      <p style={{ color: th.sub, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', margin: '12px 0 8px 0' }}>
        {ex.type === 'scramble' ? (isMarkLang ? '🔀 Richtige Reihenfolge' : '🔀 Correct order') :
         ex.type === 'fill_blank' ? (isMarkLang ? '✏️ Lückentext' : '✏️ Fill the blank') :
         (isMarkLang ? '🌐 Übersetzen' : '🌐 Translate')}
      </p>

      {ex.type === 'scramble' && (
        <>
          <div style={{ ...s.bigCard, minHeight: '80px', flexWrap: 'wrap', gap: '8px', padding: '16px', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
            {scrambleOrder.length === 0
              ? <p style={{ color: th.sub, fontSize: '0.85rem', margin: 'auto' }}>{isMarkLang ? 'Tippe auf Wörter unten' : 'Tap words below'}</p>
              : scrambleOrder.map((w) => (
                <button key={w.id} onClick={() => !revealed && removeWord(w)}
                  style={{ background: th.accent + '33', color: th.text, border: `1px solid ${th.accent}`, borderRadius: '8px', padding: '6px 12px', fontSize: '0.95rem', cursor: revealed ? 'default' : 'pointer' }}>
                  {w.word}
                </button>
              ))
            }
          </div>
          {revealed && (
            <p style={{ color: selected === 'correct' ? '#4CAF50' : '#f44336', fontWeight: 'bold', margin: '4px 0 12px 0' }}>
              {selected === 'correct' ? '✓' : `✗  ${ex.sentence}`}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
            {scrambleBank.map(w => (
              <button key={w.id} onClick={() => !revealed && addWord(w)}
                style={{ background: th.card, color: th.text, border: `1px solid ${th.border}`, borderRadius: '8px', padding: '6px 12px', fontSize: '0.95rem', cursor: revealed ? 'default' : 'pointer' }}>
                {w.word}
              </button>
            ))}
          </div>
          {!revealed
            ? <button style={{ ...s.button, opacity: scrambleOrder.length === 0 ? 0.4 : 1 }} onClick={checkScramble} disabled={scrambleOrder.length === 0}>
                {isMarkLang ? 'Prüfen' : 'Check'}
              </button>
            : <button style={s.button} onClick={() => handleNext(selected === 'correct')}>
                {index + 1 < exercises.length ? (isMarkLang ? 'Weiter →' : 'Next →') : (isMarkLang ? 'Fertig' : 'Finish')}
              </button>
          }
        </>
      )}

      {(ex.type === 'fill_blank' || ex.type === 'translate') && (
        <>
          <div style={{ ...s.bigCard, minHeight: '80px' }}>
            <p style={{ ...s.cardFront, marginBottom: 0 }}>{ex.type === 'fill_blank' ? ex.blank_sentence : ex.prompt_sentence}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {ex.options.map((opt, i) => {
              let bg = th.card; let border = `1px solid ${th.border}`
              if (revealed && i === ex.correct_index) { bg = '#4CAF5022'; border = '2px solid #4CAF50' }
              else if (revealed && selected === i) { bg = '#f4433622'; border = '2px solid #f44336' }
              else if (selected === i) { bg = th.accent + '22'; border = `2px solid ${th.accent}` }
              return (
                <button key={i} onClick={() => { if (!revealed) { setSelected(i); setRevealed(true); speak(ex.options[ex.correct_index], ttsLangCode) } }}
                  style={{ background: bg, color: th.text, border, borderRadius: '10px', padding: '13px 16px', fontSize: '0.95rem', cursor: revealed ? 'default' : 'pointer', textAlign: 'left' }}>
                  {opt}
                </button>
              )
            })}
          </div>
          {revealed && <button style={s.button} onClick={() => handleNext(selected === ex.correct_index)}>
            {index + 1 < exercises.length ? (isMarkLang ? 'Weiter →' : 'Next →') : (isMarkLang ? 'Fertig' : 'Finish')}
          </button>}
        </>
      )}
    </div></div>
  )
}

function PlacementTest({ lang, theme, user, onBack, onSaveCefr }) {
  const th = THEMES[theme]; const s = makeStyles(th); const t = T[lang]
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
      const lvl = CEFR_LEVELS[i]; const data = sc[lvl]
      if (data && data.correct / data.total >= 0.6) return lvl
    }
    return 'A1'
  }
  const handleSelect = (optIdx) => {
    if (revealed) return
    setSelected(optIdx); setRevealed(true)
    const isCorrect = optIdx === q.correct
    const lvl = q.level; const prev = scores[lvl] || { correct: 0, total: 0 }
    const newScores = { ...scores, [lvl]: { correct: prev.correct + (isCorrect ? 1 : 0), total: prev.total + 1 } }
    setScores(newScores)
    const newStreak = isCorrect ? 0 : wrongStreak + 1
    setTimeout(() => {
      if (newStreak >= 3 || index + 1 >= questions.length) {
        const level = calcLevel(newScores); setFinalLevel(level); setDone(true); setStopped(newStreak >= 3); onSaveCefr(level)
      } else { setWrongStreak(newStreak); setIndex(i => i + 1); setSelected(null); setRevealed(false) }
    }, 1200)
  }
  if (done) {
    const totalCorrect = Object.values(scores).reduce((a, b) => a + b.correct, 0)
    const totalQ = Object.values(scores).reduce((a, b) => a + b.total, 0)
    return (
      <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
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
            <span style={s.lang}>{t.testScore}</span><span style={s.langPct}>{totalCorrect}/{totalQ}</span>
          </div>
        </div>
        <button style={s.button} onClick={onBack}>{t.testBack}</button>
      </div></div>
    )
  }
  const pct = (index / questions.length) * 100
  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <div style={s.cardHeader}>
        <div>
          <p style={s.greeting}>{t.testQuestion} {index + 1} {t.testOf} {questions.length}</p>
          <span style={{ color: CEFR_COLORS[q.level], fontSize: '0.75rem', fontWeight: 'bold' }}>{q.level}</span>
        </div>
        <button style={s.stopBtn} onClick={onBack}>{t.stop}</button>
      </div>
      <div style={s.progressBar}><div style={{ ...s.progressFill, width: `${pct}%`, background: CEFR_COLORS[q.level] }} /></div>
      <div style={{ ...s.bigCard, marginTop: '12px', minHeight: '100px' }}>
        <p style={{ ...s.cardFront, marginBottom: 0 }}>{q.question}</p>
      </div>
      {q.options.map((opt, i) => (
        <button key={i} style={s.optionBtn(selected === i, i === q.correct, revealed)} onClick={() => handleSelect(i)}>
          {String.fromCharCode(65 + i)}. {opt ?? '—'}
        </button>
      ))}
    </div></div>
  )
}

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
    <div style={s.container} className="vocara-screen">
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
  const th = THEMES[theme]; const s = makeStyles(th); const t = T[lang]
  const [selected, setSelected] = useState([])
  const toggle = (code) => {
    if (selected.includes(code)) setSelected(selected.filter(c => c !== code))
    else if (selected.length < 3) setSelected([...selected, code])
  }
  const handleDone = async () => {
    if (selected.length === 0) return
    await updateDoc(doc(db, 'users', user.uid), { languages: selected }); onDone(selected)
  }
  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
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
    </div></div>
  )
}

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

function CardScreen({ session, onBack, onFinish, lang, cardProgress, s, onSaveState, onSaveSessionProgress, mode = 'all', startIndex = 0, startProgress = null }) {
  const [index, setIndex] = useState(startIndex)
  const [queue, setQueue] = useState(session)
  const [revealed, setRevealed] = useState(false)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [newProgress, setNewProgress] = useState(startProgress || { ...cardProgress })
  const [cardTilt, setCardTilt] = useState({ x: 0, y: 0 })
  const startTime = useRef(Date.now())
  const answeredIds = useRef(new Set())

  useEffect(() => {
    if (!window.DeviceOrientationEvent) return
    const handle = (e) => {
      const gamma = Math.max(-12, Math.min(12, e.gamma || 0))
      const beta = Math.max(-12, Math.min(12, (e.beta || 0) - 45))
      setCardTilt({ x: beta, y: gamma })
    }
    window.addEventListener('deviceorientation', handle)
    return () => window.removeEventListener('deviceorientation', handle)
  }, [])
  const t = T[lang]
  const item = queue[index]
  const question = item.front
  const answer = item.back
  const fromLang = item.langA
  const toLang = item.langB
  const showPronunciation = item.pronunciation
  // Always speak the back (toLang) text in its language
  const speakBack = () => speak(item.back, item.langB)

  const handleReveal = () => {
    startTime.current = Date.now()
    setRevealed(true)
    speakBack()
  }
  const handleStop = () => {
    onSaveState?.(queue, index, newProgress)
    if (answeredIds.current.size > 0) {
      onSaveSessionProgress?.(Array.from(answeredIds.current), mode)
    }
    onBack()
  }
  const handleEasy = () => {
    const cardId = item.id
    answeredIds.current.add(cardId)
    const prev = newProgress[cardId] || { interval: 0, consecutiveFast: 0, wrongSessions: 0 }
    const easyInterval = Math.max(7, (prev.interval || 0) + 3)
    const updatedProgress = { ...prev, interval: easyInterval, consecutiveFast: 0, wrongSessions: Math.max(0, (prev.wrongSessions || 0) - 1), nextReview: getNextReview(easyInterval) }
    const finalProgress = { ...newProgress, [cardId]: updatedProgress }
    setNewProgress(finalProgress)
    const newCorrect = correct + 1; setCorrect(newCorrect)
    if (index + 1 >= queue.length) { onFinish(finalProgress, newCorrect, wrong); return }
    setIndex(i => i + 1); setRevealed(false)
    onSaveState?.(queue, index + 1, finalProgress)
  }
  const handleAnswer = (isCorrect) => {
    const elapsed = (Date.now() - startTime.current) / 1000
    const speed = getSpeed(elapsed)
    const cardId = item.id
    answeredIds.current.add(cardId)
    const prev = newProgress[cardId] || { interval: 0, consecutiveFast: 0, wrongSessions: 0 }
    if (!isCorrect) {
      const updatedProgress = { ...prev, interval: 0, consecutiveFast: 0, wrongSessions: 3, nextReview: todayStr() }
      const finalNewProgress = { ...newProgress, [cardId]: updatedProgress }
      const newQueue = [...queue]; newQueue.splice(index, 1); newQueue.push({ ...item })
      setQueue(newQueue); setNewProgress(finalNewProgress); setWrong(w => w + 1); setRevealed(false)
      onSaveState?.(newQueue, index, finalNewProgress)
    } else {
      const newCF = speed === 'very_fast' ? (prev.consecutiveFast || 0) + 1 : 0
      const interval = getNewInterval(speed, { consecutiveFast: newCF })
      const updatedProgress = { ...prev, interval, consecutiveFast: newCF, wrongSessions: Math.max(0, (prev.wrongSessions || 0) - 1), nextReview: getNextReview(interval) }
      const finalProgress = { ...newProgress, [cardId]: updatedProgress }
      setNewProgress(finalProgress)
      const newCorrect = correct + 1; setCorrect(newCorrect)
      if (index + 1 >= queue.length) { onFinish(finalProgress, newCorrect, wrong); return }
      setIndex(i => i + 1); setRevealed(false)
      onSaveState?.(queue, index + 1, finalProgress)
    }
  }
  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <div style={s.cardHeader}>
        <p style={s.greeting}>{t.card} {index + 1} {t.of} {queue.length}</p>
        <button style={s.stopBtn} onClick={handleStop}>{t.stop}</button>
      </div>
      {/* ── REVIEW STATS ── */}
      {(() => {
        const today = todayStr()
        const tom = new Date(); tom.setDate(tom.getDate() + 1)
        const tomorrow = tom.toISOString().slice(0, 10)
        const rToday = Object.values(cardProgress).filter(p => p.nextReview === today).length
        const rTom = Object.values(cardProgress).filter(p => p.nextReview === tomorrow).length
        return (
          <p style={{ ...s.greeting, fontSize: '0.72rem', marginBottom: '6px', textAlign: 'center', opacity: 0.7 }}>
            Wiederholungen heute: {rToday} · Morgen: {rTom}
          </p>
        )
      })()}
      {/* ── FLIP CARD ── */}
      <div style={{ width: '100%', marginBottom: '16px', perspective: '900px' }}>
        <div style={{
          ...s.bigCard,
          border: revealed ? `1px solid ${s.progressFill.background}` : `1px solid ${s.progressBar.background}`,
          transition: 'border-color 0.3s ease, transform 0.12s ease-out',
          minHeight: '220px',
          transform: `rotateX(${-cardTilt.x * 1.5}deg) rotateY(${cardTilt.y * 1.5}deg)`,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}>
          {/* specular highlight — moves opposite to tilt, simulates light reflection */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 'inherit', pointerEvents: 'none',
            background: `radial-gradient(circle at ${50 - cardTilt.y * 3.5}% ${50 - cardTilt.x * 3.5}%, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.04) 35%, transparent 65%)`,
            transition: 'background 0.1s ease-out',
          }} />
          {/* register badge */}
          <div style={{
            position: 'absolute', top: '8px', left: '10px',
            background: item.category === 'street' ? 'rgba(180,120,30,0.22)' : 'rgba(140,140,155,0.18)',
            color: item.category === 'street' ? '#C8922A' : '#8A8A9A',
            border: `1px solid ${item.category === 'street' ? 'rgba(180,120,30,0.35)' : 'rgba(140,140,155,0.28)'}`,
            borderRadius: '6px', padding: '2px 7px',
            fontSize: '9px', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase',
            pointerEvents: 'none',
          }}>
            {item.category === 'street' ? 'Slang' : 'Hochsprache'}
          </div>
          <p style={s.dirLabel}>{LANG_FLAGS[fromLang]} → {LANG_FLAGS[toLang]}</p>
          <p style={s.cardFront}>{question}</p>
          {!revealed && (
            <button style={s.revealBtn} onClick={handleReveal}>{t.showSolution}</button>
          )}
          {revealed && (
            <div style={{ animation: 'vocaraFadeIn 0.3s ease both', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
                <p style={{ ...s.cardBack, margin: 0 }}>{answer}</p>
                <button onClick={speakBack} style={{ background: 'transparent', border: 'none', fontSize: '1.3rem', cursor: 'pointer', padding: '4px', opacity: 0.8 }}>🔊</button>
              </div>
              {showPronunciation && <p style={s.cardPronunciation}>🔊 {t.pronunciation}: {item.pronunciation}</p>}
              {item.context && <p style={s.cardContext}>„{item.context}"</p>}
            </div>
          )}
        </div>
      </div>
      {revealed && (
        <div style={{ ...s.answerRow, alignItems: 'flex-end' }}>
          <button style={s.wrongBtn} onClick={() => handleAnswer(false)}>✗ {t.wrong}</button>
          <button style={s.easyBtn} onClick={handleEasy}>{t.easy}</button>
          <button style={s.rightBtn} onClick={() => handleAnswer(true)}>✓ {t.correct}</button>
        </div>
      )}
    </div></div>
  )
}

function ResultScreen({ correct, wrong, masteryUnlocked, t, onBack, s }) {
  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <h1 style={s.title}>{t.done} 🎉</h1>
      {masteryUnlocked && <div style={{ ...s.card, borderLeft: '3px solid #4CAF50' }}><p style={{ color: '#4CAF50', margin: 0, fontSize: '0.85rem' }}>{t.masteryMsg}</p></div>}
      <div style={s.card}>
        <div style={s.langRow}><span style={s.lang}>{t.correct}</span><span style={{ ...s.langPct, color: '#4CAF50' }}>{correct}</span></div>
        <div style={s.langRow}><span style={s.lang}>{t.wrong}</span><span style={{ ...s.langPct, color: '#f44336' }}>{wrong}</span></div>
      </div>
      <button style={s.button} onClick={onBack}>{t.back}</button>
    </div></div>
  )
}

function SettingsScreen({ t, s, theme, onThemeChange, onBack, user, myData, setMyData, allCards, lang }) {
  const th = THEMES[theme]
  const pausedLanguages = myData?.pausedLanguages || []
  const uniqueTargetLangs = [...new Set(allCards.map(c => c.targetLang).filter(Boolean))]
  const [newFront, setNewFront] = useState('')
  const [newBack, setNewBack] = useState('')
  const [newCardCat, setNewCardCat] = useState('vocabulary')
  const [cardSaveStatus, setCardSaveStatus] = useState(null)

  const togglePause = async (langCode) => {
    const newPaused = pausedLanguages.includes(langCode)
      ? pausedLanguages.filter(l => l !== langCode)
      : [...pausedLanguages, langCode]
    try {
      await updateDoc(doc(db, 'users', user.uid), { pausedLanguages: newPaused })
      setMyData(d => ({ ...d, pausedLanguages: newPaused }))
    } catch (e) { console.warn('Failed to save paused languages:', e) }
  }

  const saveCustomCard = async () => {
    if (!newFront.trim() || !newBack.trim()) return
    const baseCard = allCards.find(c => !/_r(_\d+)?$/.test(c.id))
    const langA = baseCard?.langA || (lang === 'de' ? 'en' : 'de')
    const langB = baseCard?.langB || lang
    const ts = Date.now()
    const card = {
      id: `custom_${ts}`,
      front: newFront.trim(),
      back: newBack.trim(),
      category: newCardCat,
      langA, langB,
      source: 'custom',
      createdAt: ts,
    }
    const updatedAiCards = [...(myData?.aiCards || []), card]
    try {
      await updateDoc(doc(db, 'users', user.uid), { aiCards: updatedAiCards })
      setMyData(d => ({ ...d, aiCards: updatedAiCards }))
      setNewFront(''); setNewBack(''); setNewCardCat('vocabulary')
      setCardSaveStatus('Gespeichert ✓')
      setTimeout(() => setCardSaveStatus(null), 2500)
    } catch (e) {
      setCardSaveStatus('Fehler beim Speichern')
      setTimeout(() => setCardSaveStatus(null), 3000)
    }
  }

  return (
    <div style={s.container} className="vocara-screen"><div style={s.homeBox}>
      <button style={s.backBtn} onClick={onBack}>← {t.back}</button>
      <h2 style={{ color: s.lang.color, marginBottom: '20px', fontSize: '1.3rem' }}>⚙️ {t.settingsTitle}</h2>
      <div style={s.card}>
        <p style={s.cardLabel}>{t.chooseTheme}</p>
        <div style={s.themeRow}>
          {Object.entries(THEMES).map(([key, thm]) => (
            <button key={key} style={s.themeBtn(theme === key, thm.accent)} onClick={() => onThemeChange(key)}>{thm.name}</button>
          ))}
        </div>
      </div>
      {uniqueTargetLangs.length > 0 && (
        <div style={s.card}>
          <p style={{ ...s.cardLabel, marginBottom: '14px' }}>Sprachen</p>
          {uniqueTargetLangs.map(langCode => {
            const info = AVAILABLE_LANGS.find(l => l.code === langCode)
            const paused = pausedLanguages.includes(langCode)
            return (
              <div key={langCode} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ color: th.text, fontSize: '1rem' }}>{info?.flag} {info?.label || langCode}</span>
                <button
                  onClick={() => togglePause(langCode)}
                  style={{
                    background: paused ? 'transparent' : th.accent,
                    color: paused ? th.sub : (th.btnTextColor || '#111'),
                    border: `1px solid ${paused ? th.border : th.accent}`,
                    borderRadius: '20px', padding: '5px 14px',
                    fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600',
                    transition: 'all 0.2s',
                  }}
                >
                  {paused ? 'Pausiert' : 'Aktiv'}
                </button>
              </div>
            )
          })}
        </div>
      )}
      {/* ── NEUE KARTE ── */}
      <div style={s.card}>
        <p style={{ ...s.cardLabel, marginBottom: '14px' }}>{lang === 'de' ? 'Neue Karte' : 'New Card'}</p>
        <input
          style={{ ...s.input, marginBottom: '8px' }}
          placeholder={lang === 'de' ? 'Vorderseite (z.B. englisches Wort)' : 'Front (e.g. German word)'}
          value={newFront}
          onChange={e => setNewFront(e.target.value)}
        />
        <input
          style={{ ...s.input, marginBottom: '12px' }}
          placeholder={lang === 'de' ? 'Rückseite (Übersetzung)' : 'Back (translation)'}
          value={newBack}
          onChange={e => setNewBack(e.target.value)}
        />
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button
            onClick={() => setNewCardCat('vocabulary')}
            style={{
              flex: 1, padding: '8px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem',
              background: newCardCat === 'vocabulary' ? 'rgba(140,140,155,0.25)' : 'transparent',
              color: newCardCat === 'vocabulary' ? '#A0A0B8' : th.sub,
              border: `1px solid ${newCardCat === 'vocabulary' ? 'rgba(140,140,155,0.45)' : th.border}`,
            }}
          >
            Hochsprache
          </button>
          <button
            onClick={() => setNewCardCat('street')}
            style={{
              flex: 1, padding: '8px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '0.8rem',
              background: newCardCat === 'street' ? 'rgba(180,120,30,0.2)' : 'transparent',
              color: newCardCat === 'street' ? '#C8922A' : th.sub,
              border: `1px solid ${newCardCat === 'street' ? 'rgba(180,120,30,0.4)' : th.border}`,
            }}
          >
            Slang / Umgangs&shy;sprachlich
          </button>
        </div>
        <button
          style={{ ...s.button, marginBottom: 0, opacity: (!newFront.trim() || !newBack.trim()) ? 0.45 : 1 }}
          onClick={saveCustomCard}
          disabled={!newFront.trim() || !newBack.trim()}
        >
          {lang === 'de' ? 'Karte speichern' : 'Save card'}
        </button>
        {cardSaveStatus && <p style={{ color: th.accent, fontSize: '0.82rem', marginTop: '8px', textAlign: 'center' }}>{cardSaveStatus}</p>}
      </div>

      <div style={{ ...s.card, opacity: 0.4 }}>
        <p style={s.cardLabel}>{t.comingSoon}</p>
        <p style={s.noPartner}>Benachrichtigungen • Stumm-Modus</p>
      </div>
    </div></div>
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

function StatsScreen({ user, myData, partnerData, allCards, lang, theme, onBack, cardProgress }) {
  const th = THEMES[theme]; const s = makeStyles(th); const t = T[lang]
  const isMarkLang = lang === 'de'
  const today = todayStr()
  const tom = new Date(); tom.setDate(tom.getDate() + 1)
  const tomorrow = tom.toISOString().slice(0, 10)

  const sessionHistory = myData?.sessionHistory || []
  const todayCorrect = sessionHistory.filter(h => h.date === today).reduce((a, b) => a + (b.correct || 0), 0)
  const todaySessions = sessionHistory.filter(h => h.date === today).length
  const myStreak = calcStreak(sessionHistory)
  const totalCards = allCards.filter(c => !/_r(_\d+)?$/.test(c.id)).length
  const dueTomorrow = Object.values(cardProgress).filter(p => p.nextReview === tomorrow).length
  const myMastered = Object.values(cardProgress).filter(p => (p?.interval || 0) >= 7).length

  const partnerHistory = partnerData?.sessionHistory || []
  const partnerStreak = calcStreak(partnerHistory)
  const partnerTodayCorrect = partnerHistory.filter(h => h.date === today).reduce((a, b) => a + (b.correct || 0), 0)
  const partnerTodaySessions = partnerHistory.filter(h => h.date === today).length
  const partnerProgress = partnerData?.cardProgress || {}
  const partnerMastered = Object.values(partnerProgress).filter(p => (p?.interval || 0) >= 7).length
  const partnerActive = Object.keys(partnerProgress).length

  const myName = myData?.name?.split(' ')[0] || user.displayName?.split(' ')[0] || 'Ich'
  const partnerName = myData?.partnerName || partnerData?.name?.split(' ')[0] || 'Partner'
  const hasPartner = !!myData?.partnerUID || !!partnerData

  const statBox = (label, value, sub) => (
    <div style={{ flex: 1, background: th.card, borderRadius: '14px', padding: '16px 12px', border: `1px solid ${th.border}`, textAlign: 'center' }}>
      <p style={{ color: th.gold, fontSize: '1.8rem', fontWeight: '900', margin: 0, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ color: th.accent, fontSize: '0.72rem', margin: '2px 0 4px', fontWeight: '600' }}>{sub}</p>}
      <p style={{ color: th.sub, fontSize: '0.72rem', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</p>
    </div>
  )

  const compRow = (label, myVal, partnerVal) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${th.border}` }}>
      <span style={{ color: th.text, fontWeight: '600', fontSize: '0.85rem', minWidth: '60px', textAlign: 'center' }}>{myVal}</span>
      <span style={{ color: th.sub, fontSize: '0.75rem', flex: 1, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      <span style={{ color: th.text, fontWeight: '600', fontSize: '0.85rem', minWidth: '60px', textAlign: 'center' }}>{partnerVal}</span>
    </div>
  )

  return (
    <div style={s.container} className="vocara-screen"><div style={{ ...s.homeBox, paddingTop: '12px' }}>
      <button style={s.backBtn} onClick={onBack}>← {t.back}</button>
      <h2 style={{ ...s.title, fontSize: 'clamp(1.4rem, 5vw, 1.8rem)', marginBottom: '20px' }}>
        {isMarkLang ? 'Statistiken' : 'Statistics'}
      </h2>

      {/* ── TOP STATS GRID ── */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
        {statBox(isMarkLang ? 'Heute gelernt' : 'Learned today', todayCorrect, isMarkLang ? `${todaySessions} Session${todaySessions !== 1 ? 's' : ''}` : `${todaySessions} session${todaySessions !== 1 ? 's' : ''}`)}
        {statBox(isMarkLang ? 'Streak' : 'Streak', myStreak > 0 ? `🔥 ${myStreak}` : '—', isMarkLang ? 'Tage' : 'days')}
      </div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {statBox(isMarkLang ? 'Karten gesamt' : 'Total cards', totalCards, `${myMastered} ✓`)}
        {statBox(isMarkLang ? 'Morgen fällig' : 'Due tomorrow', dueTomorrow, '')}
      </div>

      {/* ── 7-DAY CHART ── */}
      <div style={{ ...s.card, marginBottom: '16px' }}>
        <StreakWidget history={sessionHistory} th={th} t={t} />
      </div>

      {/* ── PARTNER COMPARISON ── */}
      {hasPartner && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: th.accent, fontWeight: '700', fontSize: '0.9rem' }}>{myName}</span>
            <span style={{ color: th.sub, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', alignSelf: 'center' }}>vs</span>
            <span style={{ color: th.gold, fontWeight: '700', fontSize: '0.9rem' }}>{partnerName}</span>
          </div>
          {compRow(isMarkLang ? 'Heute gelernt' : 'Today', todayCorrect, partnerTodayCorrect)}
          {compRow(isMarkLang ? 'Sessions heute' : 'Sessions today', todaySessions, partnerTodaySessions)}
          {compRow(isMarkLang ? 'Streak 🔥' : 'Streak 🔥', myStreak, partnerStreak)}
          {compRow(isMarkLang ? 'Gemeistert ✓' : 'Mastered ✓', myMastered, partnerMastered)}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0 0' }}>
            <span style={{ color: th.text, fontWeight: '600', fontSize: '0.85rem', minWidth: '60px', textAlign: 'center' }}>{Object.keys(cardProgress).length}</span>
            <span style={{ color: th.sub, fontSize: '0.75rem', flex: 1, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{isMarkLang ? 'Aktive Karten' : 'Active cards'}</span>
            <span style={{ color: th.text, fontWeight: '600', fontSize: '0.85rem', minWidth: '60px', textAlign: 'center' }}>{partnerActive}</span>
          </div>
        </div>
      )}
    </div></div>
  )
}

function MenuScreen({ user, myData, setMyData, partnerData, allCards, lang, onSaveProgress, theme, onThemeChange, onPartnerUpdate, onSaveCefr }) {
  const [screen, setScreen] = useState('menu')
  const [session, setSession] = useState(null)
  const [result, setResult] = useState(null)
  const [masteryUnlocked, setMasteryUnlocked] = useState(false)
  const [aiNotification, setAiNotification] = useState(null)
  const [pendingSession, setPendingSession] = useState(null)
  const [resumeStartIndex, setResumeStartIndex] = useState(0)
  const [resumeStartProgress, setResumeStartProgress] = useState(null)
  const [emptyCategoryMsg, setEmptyCategoryMsg] = useState(null)
  const [categorizingStatus, setCategorizingStatus] = useState(null)
  const [resumeDialog, setResumeDialog] = useState(null)
  const [currentSessionMode, setCurrentSessionMode] = useState('all')
  const [satzLoading, setSatzLoading] = useState(false)
  const t = T[lang]; const th = THEMES[theme]; const s = makeStyles(th)
  const firstName = user.displayName?.split(' ')[0] || user.displayName
  const cardProgress = myData?.cardProgress || {}
  const isMarkLang = lang === 'de'
  const cefr = myData?.cefr
  const sessionHistory = myData?.sessionHistory || []
  const partnerName = myData?.partnerName || partnerData?.name?.split(' ')[0] || 'Partner'
  const today = todayStr()
  const pausedLanguages = myData?.pausedLanguages || []
  const uniqueTargetLangs = [...new Set(allCards.map(c => c.targetLang).filter(Boolean))]
  const activeCards = pausedLanguages.length > 0
    ? allCards.filter(c => !pausedLanguages.includes(c.targetLang))
    : allCards

  // ── MONTHLY TEST CHECK ────────────────────────────────────
  const testDue = !myData?.cefr || daysSince(myData?.lastTestDate) >= MONTHLY_TEST_DAYS

  const sessionPreview = (() => {
    let due = 0, newC = 0
    allCards.forEach(card => {
      const p = cardProgress[card.id]
      if (!p) newC++
      else if (p.wrongSessions > 0 || p.nextReview <= today) due++
    })
    return { due, new: newC }
  })()

  useEffect(() => {
    if (screen !== 'menu') return
    const checkPending = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid, 'session', 'current'))
        setPendingSession(snap.exists() ? snap.data() : null)
      } catch (e) { console.warn('Could not check pending session:', e) }
    }
    checkPending()
  }, [screen])

  const startSession = () => {
    const sess = buildSession(activeCards, cardProgress)
    setCurrentSessionMode('all')
    setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
  }
  const startCategorySession = (category) => {
    const cards = category === 'all'
      ? activeCards
      : activeCards.filter(c => c.category === category)
    if (cards.length === 0) {
      setEmptyCategoryMsg('Noch keine Karten in dieser Kategorie — füge welche hinzu!')
      setTimeout(() => setEmptyCategoryMsg(null), 3500)
      return
    }
    const sp = myData?.sessionProgress
    if (sp?.mode === category && sp.cardIds?.length > 0) {
      setResumeDialog({ category, cards })
      return
    }
    const sess = buildSession(cards, cardProgress)
    if (sess.length === 0) return
    setCurrentSessionMode(category)
    setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
  }
  const startSatzSession = async () => {
    const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili' }
    const vocabCards = activeCards.filter(c =>
      c.category === 'vocabulary' &&
      !/_r(_\d+)?$/.test(c.id) &&
      cardProgress[c.id] !== undefined
    )
    if (vocabCards.length < 5) {
      setEmptyCategoryMsg(isMarkLang
        ? 'Noch zu wenig bekannte Wörter — lerne mehr Vokabeln!'
        : 'Not enough known words yet — learn more vocabulary first!')
      setTimeout(() => setEmptyCategoryMsg(null), 3500)
      return
    }
    setSatzLoading(true)
    try {
      const wordList = vocabCards.map(c => c.front).slice(0, 60).join(', ')
      const toLangCode = isMarkLang ? 'de' : 'en'
      const fromLangCode = isMarkLang ? 'en' : 'de'
      const toLangName = LANG_NAMES[toLangCode]
      const fromLangName = LANG_NAMES[fromLangCode]
      const prompt = `You are a language learning assistant. Given this list of vocabulary words the learner knows in ${fromLangName}: ${wordList}

Generate exactly 5 natural sentences in ${fromLangName} that use these known words creatively. Each sentence should combine 2-4 of the known words in a meaningful, everyday context.

Return ONLY a valid JSON array with no markdown or explanation:
[{"front":"<sentence in ${fromLangName}>","back":"<translation in ${toLangName}>","context":"<1 sentence explaining when you'd use this>"}]`

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      const raw = data.content?.[0]?.text || ''
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
      const ts = Date.now()
      const sessionCards = parsed.slice(0, 5).map((card, i) => ({
        id: `satz_temp_${ts}_${i}`,
        front: card.front,
        back: card.back,
        context: card.context || '',
        category: 'sentence',
        langA: fromLangCode,
        langB: toLangCode,
        targetLang: toLangCode,
        source: 'satz-session',
      }))
      setCurrentSessionMode('sentence')
      setSession(sessionCards); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
    } catch (e) {
      console.warn('Satz session generation failed:', e)
      setEmptyCategoryMsg(isMarkLang ? 'Fehler beim Generieren der Sätze.' : 'Failed to generate sentences.')
      setTimeout(() => setEmptyCategoryMsg(null), 3500)
    } finally {
      setSatzLoading(false)
    }
  }
  const continueSession = async () => {
    const { category, cards } = resumeDialog
    const answeredSet = new Set(myData?.sessionProgress?.cardIds || [])
    const remaining = cards.filter(c => !answeredSet.has(c.id))
    const pool = remaining.length > 0 ? remaining : cards
    const sess = buildSession(pool, cardProgress)
    try { await updateDoc(doc(db, 'users', user.uid), { sessionProgress: null }); setMyData(d => ({ ...d, sessionProgress: null })) } catch (e) {}
    setCurrentSessionMode(category)
    setResumeDialog(null)
    if (sess.length === 0) return
    setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
  }
  const startFresh = async () => {
    const { category, cards } = resumeDialog
    try { await updateDoc(doc(db, 'users', user.uid), { sessionProgress: null }); setMyData(d => ({ ...d, sessionProgress: null })) } catch (e) {}
    const sess = buildSession(cards, cardProgress)
    setCurrentSessionMode(category)
    setResumeDialog(null)
    if (sess.length === 0) return
    setSession(sess); setResumeStartIndex(0); setResumeStartProgress(null); setPendingSession(null); setScreen('cards')
  }
  const resumeSession = () => {
    if (!pendingSession) return
    setSession(pendingSession.queue); setResumeStartIndex(pendingSession.index || 0)
    setResumeStartProgress(pendingSession.newProgress || null); setPendingSession(null); setScreen('cards')
  }
  const discardSession = async () => { await clearSessionState(user.uid); setPendingSession(null) }
  const handleSaveState = async (queue, index, newProgress) => { await saveSessionState(user.uid, queue, index, newProgress) }
  const saveSessionProgress = async (cardIds, mode) => {
    const sp = { cardIds, mode, timestamp: Date.now() }
    try { await updateDoc(doc(db, 'users', user.uid), { sessionProgress: sp }); setMyData(d => ({ ...d, sessionProgress: sp })) } catch (e) { console.warn('Session progress save failed:', e) }
  }
  const generateAICards = async () => {
    const homeCity = myData?.homeCity || (isMarkLang ? 'Hamburg' : 'Nairobi')
    const partnerCity = myData?.partnerCity || (isMarkLang ? 'Nairobi' : 'Hamburg')
    const existingAI = myData?.aiCards || []
    const knownFronts = allCards.map(c => c.front)

    // Enforce 80/20 ratio: at most 1 SW card per 5 generated
    const totalAIAfter = existingAI.length + 5
    const maxSW = Math.floor(totalAIAfter * 0.2)
    const currentAISW = existingAI.filter(c => c.langA === 'sw').length
    const swCount = isMarkLang ? Math.min(1, Math.max(0, maxSW - currentAISW)) : 0

    const requests = isMarkLang
      ? [
          { langA: 'en', langB: 'de', count: 5 - swCount },
          ...(swCount > 0 ? [{ langA: 'sw', langB: 'de', count: swCount }] : []),
        ]
      : [{ langA: 'de', langB: 'en', count: 5 }]

    const LANG_NAMES = { en: 'English', de: 'German', sw: 'Swahili' }
    const allNewCards = []
    const ts = Date.now()

    for (const req of requests) {
      const knownList = knownFronts.slice(0, 80).join(' | ')
      const isSwahili = req.langA === 'sw'
      const prompt = `Generate exactly ${req.count} vocabulary flashcard${req.count > 1 ? 's' : ''} for a language learner.
Front language: ${LANG_NAMES[req.langA]}
Back language: ${LANG_NAMES[req.langB]}
Learner's home city: ${homeCity}
Partner's city: ${partnerCity}

Rules:
- Choose common, useful everyday phrases or expressions (intermediate level, not basic words like "hello")
- The "context" field: 1-2 sentences in ${LANG_NAMES[req.langB]} telling a short personal story that mentions ${homeCity} and/or ${partnerCity}
- Avoid these already known phrases: ${knownList}
- Return ONLY a valid JSON array, no markdown, no explanation${isSwahili ? `
- Add a "pronunciation" field with German-phonetic pronunciation guide for the Swahili front text
- German phonetics only: "a" like German "Vater", "e" like "Bett", "i" like "mit", rolled "r"
- No English sounds — never use "ay", "oh", "ee"; use "e", "o", "i" instead
- Example: "habari" → "ha-BA-ri", "asante" → "a-SAN-te"` : ''}

Format: [{"front":"...","back":"...","context":"...","category":"..."${isSwahili ? ',"pronunciation":"..."' : ''}}]`

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
        })
        const data = await res.json()
        const raw = data.content?.[0]?.text || ''
        const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
        parsed.slice(0, req.count).forEach((card, i) => {
          allNewCards.push({
            id: `ai_${req.langA}_${ts}_${i}`,
            front: card.front,
            back: card.back,
            context: card.context || '',
            category: card.category || 'general',
            langA: req.langA,
            langB: req.langB,
            source: 'ai-generated',
            createdAt: ts,
          })
        })
      } catch (e) {
        console.warn('AI card generation failed for', req.langA, e)
      }
    }

    if (allNewCards.length === 0) return
    const updatedAiCards = [...existingAI, ...allNewCards]
    try {
      await updateDoc(doc(db, 'users', user.uid), { aiCards: updatedAiCards })
      setMyData(d => ({ ...d, aiCards: updatedAiCards }))
      const msg = isMarkLang
        ? `✨ ${allNewCards.length} neue KI-Karten hinzugefügt!`
        : `✨ ${allNewCards.length} new AI cards added!`
      setAiNotification(msg)
      setTimeout(() => setAiNotification(null), 4000)
    } catch (e) {
      console.warn('Failed to save AI cards:', e)
    }
  }

  const runCategorization = async () => {
    const baseIdRegex = /_r(_\d+)?$/
    const existingCats = myData?.cardCategories || {}
    const toProcess = allCards.filter(c =>
      !baseIdRegex.test(c.id) &&
      !VALID_CATEGORIES.includes(existingCats[c.id]) &&
      !VALID_CATEGORIES.includes(c.category)
    )
    if (toProcess.length === 0) {
      setCategorizingStatus('Alle Karten bereits kategorisiert ✓')
      setTimeout(() => setCategorizingStatus(null), 2500)
      return
    }
    const newCats = { ...existingCats }
    for (let i = 0; i < toProcess.length; i++) {
      const card = toProcess[i]
      setCategorizingStatus(`Kategorisiere ${i + 1}/${toProcess.length}...`)
      const prompt = `Categorize this flashcard: '${card.front}'
Return ONLY one word: vocabulary, street, home, or sentence.
- vocabulary = single words or simple infinitives
- street = slang, idioms, colloquial phrases, contractions like I'm / you're
- home = family, romantic, household phrases
- sentence = neutral everyday sentences`
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5',
            max_tokens: 10,
            messages: [{ role: 'user', content: prompt }],
          }),
        })
        const data = await res.json()
        const raw = (data.content?.[0]?.text || '').trim().toLowerCase().replace(/[^a-z]/g, '')
        const cat = VALID_CATEGORIES.find(c => raw === c || raw.startsWith(c))
        if (cat) newCats[card.id] = cat
      } catch (e) {
        console.warn('Categorization failed for', card.id, e)
      }
      // Save every 10 cards and on the last one
      if ((i + 1) % 10 === 0 || i === toProcess.length - 1) {
        try {
          await updateDoc(doc(db, 'users', user.uid), { cardCategories: newCats })
          setMyData(d => ({ ...d, cardCategories: { ...newCats } }))
        } catch (e) {
          console.warn('Failed to save categories:', e)
        }
      }
    }
    setCategorizingStatus(`Fertig! ${toProcess.length} Karten kategorisiert ✓`)
    setTimeout(() => setCategorizingStatus(null), 3000)
  }

  const handleFinish = async (finalProgress, correct, wrong) => {
    let unlocked = false
    if (checkMastery(allCards, finalProgress, correct, correct + wrong)) {
      const newBatch = getNextNewCards(allCards, finalProgress, NEW_CARDS_BATCH)
      if (newBatch.length > 0) {
        newBatch.forEach(card => {
          // FIX: set nextReview to tomorrow so new cards don't immediately affect % stats
          finalProgress[card.id] = { interval: 0, consecutiveFast: 0, wrongSessions: 0, nextReview: getNextReview(1) }
        })
        unlocked = true
      }
      generateAICards()
    }
    setMasteryUnlocked(unlocked)
    await onSaveProgress(finalProgress)
    const updatedHistory = await saveSessionHistory(user.uid, correct, correct + wrong, sessionHistory)
    setMyData(d => ({ ...d, sessionHistory: updatedHistory }))
    await clearSessionState(user.uid)
    setResult({ correct, wrong }); setScreen('result')
  }

  if (screen === 'cards' && session) return <CardScreen session={session} onBack={() => setScreen('menu')} onFinish={handleFinish} lang={lang} cardProgress={cardProgress} s={s} onSaveState={handleSaveState} onSaveSessionProgress={saveSessionProgress} mode={currentSessionMode} startIndex={resumeStartIndex} startProgress={resumeStartProgress} />
  if (screen === 'result') return <ResultScreen correct={result.correct} wrong={result.wrong} masteryUnlocked={masteryUnlocked} t={t} onBack={() => { setScreen('menu'); setSession(null) }} s={s} />
  if (screen === 'settings') return <SettingsScreen t={t} s={s} theme={theme} onThemeChange={onThemeChange} onBack={() => setScreen('menu')} user={user} myData={myData} setMyData={setMyData} allCards={allCards} lang={lang} />
  if (screen === 'partner') return <PartnerScreen user={user} myData={myData} lang={lang} theme={theme} onBack={() => setScreen('menu')} onPartnerUpdate={(uid) => { onPartnerUpdate(uid); setScreen('menu') }} />
  if (screen === 'test') return <PlacementTest lang={lang} theme={theme} user={user} onBack={() => setScreen('menu')} onSaveCefr={onSaveCefr} />
  if (screen === 'impressum') return <ImpressumScreen lang={lang} theme={theme} onBack={() => setScreen('menu')} />
  if (screen === 'stats') return <StatsScreen user={user} myData={myData} partnerData={partnerData} allCards={allCards} lang={lang} theme={theme} onBack={() => setScreen('menu')} cardProgress={cardProgress} />
  if (screen === 'ki') return <KiGespraechScreen lang={lang} theme={theme} onBack={() => setScreen('menu')} userName={user.displayName?.split(' ')[0] || 'du'} />
  if (screen === 'satz') return <SatzTrainingScreen lang={lang} theme={theme} onBack={() => setScreen('menu')} allCards={allCards} cardProgress={cardProgress} userName={user.displayName?.split(' ')[0] || 'du'} />

  return (
    <div style={s.container} className="vocara-screen"><div style={{ ...s.homeBox, paddingTop: '12px' }}>

      {/* ── LOGO ── */}
      <div style={{ textAlign: 'center', paddingTop: '20px', paddingBottom: '16px' }}>
        <h1 style={{ ...s.title, fontSize: 'clamp(4rem, 17vw, 6.5rem)', lineHeight: 1, marginBottom: '10px' }}>Vocara</h1>
        <p style={{ ...s.greeting, marginBottom: uniqueTargetLangs.length > 0 ? '6px' : 0 }}>{t.hello}, {firstName}</p>
        {uniqueTargetLangs.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
            {uniqueTargetLangs.map(l => {
              const info = AVAILABLE_LANGS.find(a => a.code === l)
              const paused = pausedLanguages.includes(l)
              return (
                <span key={l} title={info?.label || l} style={{ fontSize: '1.1rem', opacity: paused ? 0.25 : 1, filter: paused ? 'grayscale(1)' : 'none', transition: 'opacity 0.3s' }}>
                  {info?.flag || l}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* ── MONTHLY TEST BANNER ── */}
      {testDue && (
        <button style={{ ...s.menuBtnWarning, marginBottom: '12px' }} onClick={() => setScreen('test')}>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 'bold', color: '#f44336' }}>{t.monthlyTestBanner}</span>
            <span style={{ fontSize: '0.75rem', color: th.sub }}>{t.monthlyTestSub}</span>
          </span>
          <span style={{ color: '#f44336' }}>→</span>
        </button>
      )}

      {/* ── SESSION RESUME DIALOG ── */}
      {resumeDialog && (
        <div style={{ ...s.resumeBanner, marginBottom: '12px' }}>
          <p style={{ color: th.text, margin: '0 0 10px 0', fontSize: '0.9rem', fontWeight: '600' }}>
            {t.resumeTitle}
          </p>
          <p style={{ color: th.sub, margin: '0 0 10px 0', fontSize: '0.8rem' }}>
            {(myData?.sessionProgress?.cardIds?.length || 0)} Karten bereits beantwortet
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ ...s.button, marginBottom: 0, flex: 1, padding: '10px' }} onClick={continueSession}>{t.resumeContinue}</button>
            <button style={{ ...s.logoutBtn, marginTop: 0, flex: 1, padding: '10px', textAlign: 'center' }} onClick={startFresh}>{t.resumeDiscard}</button>
          </div>
        </div>
      )}

      {/* ── PENDING SESSION BANNER ── */}
      {pendingSession && (
        <div style={{ ...s.resumeBanner, marginBottom: '12px' }}>
          <p style={{ color: th.text, margin: '0 0 10px 0', fontSize: '0.9rem' }}>
            {t.resumeTitle} — {pendingSession.index ?? '?'} {t.resumeOf} {pendingSession.queue?.length ?? '?'} {t.resumeCards}
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ ...s.button, marginBottom: 0, flex: 1, padding: '10px' }} onClick={resumeSession}>{t.resumeContinue}</button>
            <button style={{ ...s.logoutBtn, marginTop: 0, flex: 1, padding: '10px', textAlign: 'center' }} onClick={discardSession}>{t.resumeDiscard}</button>
          </div>
        </div>
      )}

      {/* ── 5-BUTTON GRID ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={{ ...s.catBtn, '--gleam-delay': '0s' }} onClick={() => startCategorySession('vocabulary')}>
            Meine<br />Worte
          </button>
          <button style={{ ...s.catBtn, '--gleam-delay': '1.8s', opacity: satzLoading ? 0.6 : 1 }} onClick={startSatzSession} disabled={satzLoading}>
            {satzLoading ? '...' : <><span>werden</span><br /><span>Sätze</span></>}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={{ ...s.catBtn, '--gleam-delay': '3.5s' }} onClick={() => startCategorySession('street')}>
            Auf der<br />Straße
          </button>
          <button style={{ ...s.catBtn, '--gleam-delay': '5.2s' }} onClick={() => startCategorySession('home')}>
            und zu<br />Hause
          </button>
        </div>
        <button style={{ ...s.button, padding: '13px 28px', fontSize: '0.9rem', letterSpacing: '0.2px', marginBottom: 0, '--gleam-delay': '2.5s' }} onClick={() => startCategorySession('all')}>
          Wir lernen alles, überall
        </button>
      </div>

      {/* ── SECONDARY NAVIGATION ── */}
      <div style={{ marginTop: '4px', marginBottom: '10px' }}>
        <button style={s.navBtn} onClick={() => setScreen('ki')}>KI-Gespräch</button>
        <button style={s.navBtn} onClick={() => setScreen('stats')}>
          Fortschritt{cefr ? ` · ${cefr}` : ''}
        </button>
        <button style={s.navBtn} onClick={() => setScreen('partner')}>
          {myData?.partnerUID ? `Partner: ${partnerName}` : 'Partner verbinden'}
        </button>
        <button style={s.navBtn} onClick={generateAICards}>Karten hinzufügen</button>
        <button style={{ ...s.navBtn, opacity: categorizingStatus ? 0.5 : 1 }} onClick={runCategorization} disabled={!!categorizingStatus}>Kategorisieren</button>
        <button style={s.navBtn} onClick={() => setScreen('settings')}>Einstellungen</button>
        <button style={{ ...s.navBtn, marginBottom: 0 }} onClick={() => signOut(auth)}>Abmelden</button>
      </div>

      <button style={s.legalBtn} onClick={() => setScreen('impressum')}>{t.impressumLink}</button>

      {aiNotification && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: th.accent, color: '#111', padding: '10px 20px', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold', zIndex: 1000, animation: 'vocaraFadeIn 0.3s ease both', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {aiNotification}
        </div>
      )}
      {emptyCategoryMsg && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: th.card, color: th.text, border: `1px solid ${th.border}`, padding: '12px 20px', borderRadius: '16px', fontSize: '0.85rem', fontWeight: '500', zIndex: 1000, animation: 'vocaraFadeIn 0.3s ease both', maxWidth: '90vw', textAlign: 'center', pointerEvents: 'none' }}>
          {emptyCategoryMsg}
        </div>
      )}
      {categorizingStatus && (
        <div style={{ position: 'fixed', bottom: aiNotification ? '72px' : '24px', left: '50%', transform: 'translateX(-50%)', background: th.card, color: th.text, border: `1px solid ${th.border}`, padding: '10px 20px', borderRadius: '16px', fontSize: '0.85rem', fontWeight: '500', zIndex: 1000, animation: 'vocaraFadeIn 0.3s ease both', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {categorizingStatus}
        </div>
      )}
    </div></div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [myData, setMyData] = useState(null)
  const [partnerData, setPartnerData] = useState(null)
  const [theme, setTheme] = useState('nairobi')
  const [needsLangSetup, setNeedsLangSetup] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    const id = 'vocara-global-css'
    if (!document.getElementById(id)) {
      const el = document.createElement('style'); el.id = id; el.textContent = GLOBAL_CSS
      document.head.appendChild(el)
    }
  }, [])

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
          if (data.theme) setTheme(data.theme)
          // ── Rule-based categorization on load ──────────────────
          const baseCards = u.uid === ELOSY_UID ? ALL_ELOSY_CARDS_BASE : ALL_MARK_CARDS_BASE
          const aiCards = data.aiCards || []
          const existingCats = data.cardCategories || {}
          const newCats = { ...existingCats }
          let catChanged = false
          const swahiliOverrideRe = /\b(habari|yako|nzuri|asante|karibu|pole|sawa|jambo|mambo|rafiki|wewe|mimi|nina|hii|hilo|chakula|maji|nyumba|watoto|upendo)\b/i
          for (const card of [...baseCards, ...aiCards]) {
            const front = card.front || ''
            const wordCount = front.trim().split(/\s+/).filter(Boolean).length
            const current = newCats[card.id]
            const isSwahiliCard = card.pronunciation || swahiliOverrideRe.test(front) || card.langA === 'sw'
            const needsRun =
              (isSwahiliCard && current !== 'street') ||
              !current ||
              current === '' ||
              (current === 'vocabulary' && wordCount > 1)
            if (!needsRun) continue
            const newCat = ruleCategory(card)
            if (current !== newCat) {
              console.log(`[category] ${card.id} "${front}" : ${current || 'undefined'} → ${newCat}`)
              newCats[card.id] = newCat
              catChanged = true
            }
          }
          if (catChanged) {
            data.cardCategories = newCats
            updateDoc(userRef, { cardCategories: newCats }).catch(e => console.warn('Category save failed:', e))
            console.log('[category] Saved', Object.keys(newCats).length, 'categories to Firestore')
          } else {
            console.log('[category] All cards already correctly categorized')
          }
          setMyData(data)
          const isKnown = u.uid === MARK_UID || u.uid === ELOSY_UID
          if (!isKnown) {
            if (!data.onboardingDone) setNeedsOnboarding(true)
            if (!data.languages || data.languages.length === 0) setNeedsLangSetup(true)
          }
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
    const snap = await getDoc(ref); if (snap.exists()) setMyData(snap.data())
  }
  const handleThemeChange = async (newTheme) => {
    setTheme(newTheme)
    if (user) await updateDoc(doc(db, 'users', user.uid), { theme: newTheme })
  }
  const handlePartnerUpdate = async (partnerUID) => {
    const ref = doc(db, 'users', user.uid)
    const snap = await getDoc(ref); if (snap.exists()) setMyData(snap.data())
    if (partnerUID) { const pSnap = await getDoc(doc(db, 'users', partnerUID)); if (pSnap.exists()) setPartnerData(pSnap.data()) }
    else setPartnerData(null)
  }
  const handleSaveCefr = async (level) => {
    const update = { cefr: level, lastTestDate: todayStr() }
    await updateDoc(doc(db, 'users', user.uid), update)
    setMyData(d => ({ ...d, ...update }))
  }
  const handleOnboardingDone = async () => {
    await updateDoc(doc(db, 'users', user.uid), { onboardingDone: true })
    setNeedsOnboarding(false)
  }


  const th = THEMES[theme]
  const isElosy = user?.uid === ELOSY_UID
  const lang = isElosy ? 'en' : 'de'

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: th.bg, color: th.text }}>Laden...</div>
  if (!user) return <LoginScreen theme={theme} />

  // Onboarding: show for new users before lang setup
  if (needsOnboarding) return <OnboardingScreen lang={lang} theme={theme} onDone={handleOnboardingDone} />

  if (needsLangSetup) return <LangSetupScreen user={user} lang={lang} theme={theme} onDone={(langs) => { setNeedsLangSetup(false); setMyData(d => ({ ...d, languages: langs })) }} />

  const cardCategories = myData?.cardCategories || {}
  const allCards = [
    ...(isElosy ? ALL_ELOSY_CARDS : ALL_MARK_CARDS),
    ...(myData?.aiCards || []).flatMap(buildCardPair),
  ].map(card => {
    const baseId = card.id.replace(/_r(_\d+)?$/, '')
    const aiCat = cardCategories[baseId]
    return aiCat ? { ...card, category: aiCat } : card
  })

  return (
    <MenuScreen user={user} myData={myData} setMyData={setMyData} partnerData={partnerData}
      allCards={allCards}
      lang={lang} onSaveProgress={saveProgress}
      theme={theme} onThemeChange={handleThemeChange}
      onPartnerUpdate={handlePartnerUpdate} onSaveCefr={handleSaveCefr} />
  )
}

export default App
