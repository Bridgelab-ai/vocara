export const TEST_STRUCTURE = {
  sprachkompass: {
    questionsPerTest: 20,
    levels: ['A1', 'A2', 'B1', 'B2', 'C1'],
    questionsPerLevel: 4,
    totalPoolPerLevel: 60,
    description: 'Eingangstest zur Sprachstandsermittlung'
  },
  sprachpuls: {
    questionsPerTest: 15,
    levels: ['A1', 'A2', 'B1', 'B2', 'C1'],
    questionsPerLevel: 3,
    totalPoolPerLevel: 48,
    description: 'Monatlicher Folgetest'
  }
}

export const SPRACHKOMPASS_LEVEL_CONTENT = {
  A1: `Generate 4 multiple-choice questions for CEFR A1 (Einsteiger). Learners at this level can understand and use familiar everyday expressions and very basic phrases to satisfy concrete needs. They can introduce themselves and others, and ask and answer questions about personal details. Test: numbers 1-10, basic colors (rot/blau/grün/gelb), personal pronouns (ich/du/er/sie/wir), simple greetings (Hallo/Auf Wiedersehen/Danke/Bitte), yes/no words. Each question: exactly 1 correct answer and 3 clearly wrong answers. Make distractors plausible but unambiguously incorrect. Return ONLY valid JSON array: [{"question":"...","options":["a)...","b)...","c)...","d)..."],"correct":"a","explanation":"...","level":"A1"}]`,
  A2: `Generate 4 multiple-choice questions for CEFR A2 (Grundkenntnisse). Learners can understand sentences and frequently used expressions related to areas of most immediate relevance (personal/family information, shopping, local geography, employment). They can communicate in simple, routine tasks requiring direct exchange of familiar information. Test: days of the week, months (Januar–Dezember), numbers 11-100, essential verbs (sein/haben/gehen/kommen/machen) in present tense, family members (Mutter/Vater/Bruder/Schwester). Each question: exactly 1 correct + 3 plausible wrong answers. Return ONLY valid JSON array: [{"question":"...","options":["a)...","b)...","c)...","d)..."],"correct":"a","explanation":"...","level":"A2"}]`,
  B1: `Generate 4 multiple-choice questions for CEFR B1 (Mittelstufe). Learners can understand the main points of clear standard input on familiar matters regularly encountered in work, school, and leisure. They can deal with most situations likely to arise while travelling, and can produce simple connected text on familiar topics. Test: Perfekt tense formation (haben vs. sein as auxiliary), modal verbs in context (müssen/können/wollen/sollen/dürfen), common prepositions with cases (in/an/auf/mit/für), subordinating conjunctions (weil/dass/wenn/obwohl/damit), common phrasal collocations. Each question: exactly 1 correct + 3 plausible wrong answers. Return ONLY valid JSON array: [{"question":"...","options":["a)...","b)...","c)...","d)..."],"correct":"a","explanation":"...","level":"B1"}]`,
  B2: `Generate 4 multiple-choice questions for CEFR B2 (Obere Mittelstufe). Learners can understand the main ideas of complex text on both concrete and abstract topics, including technical discussions in their field of specialisation. They can interact with a degree of fluency and spontaneity with native speakers. Test: Passiv constructions (Vorgangs- vs. Zustandspassiv), Konjunktiv II for hypothetical and polite expressions (würde/hätte/wäre), reported speech with Konjunktiv I, nuanced vocabulary distinctions (e.g. unterscheiden vs. unterscheiden sich), register differences (formal vs. colloquial). Each question: exactly 1 correct + 3 plausible wrong answers. Return ONLY valid JSON array: [{"question":"...","options":["a)...","b)...","c)...","d)..."],"correct":"a","explanation":"...","level":"B2"}]`,
  C1: `Generate 4 multiple-choice questions for CEFR C1 (Fortgeschritten). Learners can understand a wide range of demanding, longer texts and recognise implicit meaning. They can express themselves fluently, spontaneously and precisely. Test: extended participial phrases (erweiterte Partizipialattribute), Konjunktiv I in indirect speech and formal writing, subtle idiomatic expressions and collocations that are easily confused, advanced connectors and discourse markers (nichtsdestotrotz/wohingegen/insofern als), near-synonym distinctions with strong contextual dependency (e.g. anfangen/beginnen/sich anschicken zu). Each question: exactly 1 correct + 3 highly plausible wrong answers. Return ONLY valid JSON array: [{"question":"...","options":["a)...","b)...","c)...","d)..."],"correct":"a","explanation":"...","level":"C1"}]`
}

export const SPRACHPULS_LEVEL_CONTENT = {
  A1: `Generate 3 fresh multiple-choice questions for CEFR A1 — different from any previously seen Sprachkompass questions. Learners at A1 can handle the most basic everyday language: familiar words, simple introductions, concrete needs. Focus on distinct, new angles: e.g. matching a German word to its category, recognising a correct greeting in context, identifying a number or colour in a short sentence. Each question: exactly 1 correct + 3 plausible wrong answers. Return ONLY valid JSON array: [{"question":"...","options":["a)...","b)...","c)...","d)..."],"correct":"a","explanation":"...","level":"A1"}]`,
  A2: `Generate 3 fresh multiple-choice questions for CEFR A2 — unique angles not covered by Sprachkompass. Focus on applying elementary knowledge in context: a short sentence completion, choosing the correct verb form in present tense, identifying correct family vocabulary in a micro-dialogue. Each question: exactly 1 correct + 3 plausible wrong answers. Return ONLY valid JSON array: [{"question":"...","options":["a)...","b)...","c)...","d)..."],"correct":"a","explanation":"...","level":"A2"}]`,
  B1: `Generate 3 fresh multiple-choice questions for CEFR B1 — different from Sprachkompass content. Use sentence-completion and contextual choice tasks: filling in the correct Perfekt auxiliary, choosing the right preposition in a travel or work scenario, selecting the appropriate subordinate conjunction in a cause-effect sentence. Each question: exactly 1 correct + 3 plausible wrong answers. Return ONLY valid JSON array: [{"question":"...","options":["a)...","b)...","c)...","d)..."],"correct":"a","explanation":"...","level":"B1"}]`,
  B2: `Generate 3 fresh multiple-choice questions for CEFR B2 — different from Sprachkompass content. Focus on application in realistic contexts: choose the correct Passiv form in a news-style sentence, identify correct Konjunktiv II usage in a polite request, distinguish between two near-synonyms in a business or academic context. Each question: exactly 1 correct + 3 plausible wrong answers. Return ONLY valid JSON array: [{"question":"...","options":["a)...","b)...","c)...","d)..."],"correct":"a","explanation":"...","level":"B2"}]`,
  C1: `Generate 3 fresh multiple-choice questions for CEFR C1 — different from Sprachkompass content. Use complex authentic-style sentences: identify the correct extended participial construction, choose the right Konjunktiv I form in indirect speech, select the stylistically appropriate connector or near-synonym in a demanding academic or literary context. Each question: exactly 1 correct + 3 highly plausible wrong answers. Return ONLY valid JSON array: [{"question":"...","options":["a)...","b)...","c)...","d)..."],"correct":"a","explanation":"...","level":"C1"}]`
}

export const CEFR_DESCRIPTIONS = {
  A1: {
    title: 'Einsteiger',
    short: 'Du kennst erste Wörter und einfachste Phrasen.',
    detail: 'Du kannst vertraute Wörter und ganz einfache Sätze verstehen und verwenden. Du kannst dich vorstellen und anderen einfache Fragen stellen.'
  },
  A2: {
    title: 'Grundkenntnisse',
    short: 'Du kannst einfache Alltagssituationen meistern.',
    detail: 'Du verstehst Sätze zu vertrauten Themen wie Familie, Einkaufen und Arbeit. Du kannst dich in einfachen Routinesituationen verständigen.'
  },
  B1: {
    title: 'Mittelstufe',
    short: 'Du kannst dich in vertrauten Situationen verständigen.',
    detail: 'Du verstehst die Hauptaussagen klarer Texte zu bekannten Themen. Du kannst dich spontan und fließend verständigen und einfache Texte schreiben.'
  },
  B2: {
    title: 'Obere Mittelstufe',
    short: 'Du kannst komplexere Themen diskutieren.',
    detail: 'Du verstehst komplexe Texte und kannst dich spontan und fließend mit Muttersprachlern unterhalten. Du kannst klare, detaillierte Texte verfassen.'
  },
  C1: {
    title: 'Fortgeschritten',
    short: 'Du sprichst fließend und spontan.',
    detail: 'Du kannst anspruchsvolle, längere Texte verstehen und implizite Bedeutungen erfassen. Du drückst dich fließend, spontan und präzise aus.'
  }
}
