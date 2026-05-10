import React, { useState } from 'react'
import { THEMES, makeStyles } from '../theme'
import { T } from '../translations'
import { CEFR_LEVELS, CEFR_COLORS, CEFR_DESC } from '../appShared'

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
        try {
          const level = calcLevel(newScores)
          try { onSaveCefr(level) } catch(e) { console.warn('[Vocara] onSaveCefr error:', e) }
          window.location.reload()
        } catch(completionErr) {
          console.error('[Vocara] test completion crashed:', completionErr)
          window.location.reload()
        }
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
        <button style={s.button} onClick={onBack}>← Zurück zur Startseite</button>
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

export default PlacementTest
