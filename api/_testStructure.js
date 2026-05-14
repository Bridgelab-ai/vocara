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
  A1: "Generate 4 multiple-choice questions testing absolute beginner knowledge: numbers 1-10, basic colors, greetings (hello/goodbye/thank you), personal pronouns (I/you/he/she). Each question must have 1 correct answer and 3 wrong answers. Format: { question, options: [a,b,c,d], correct: 'a'|'b'|'c'|'d', explanation }",
  A2: "Generate 4 multiple-choice questions testing elementary knowledge: days of week, months, basic verbs (to be/have/go/come), family members, numbers 11-100. Each question: 1 correct + 3 wrong answers.",
  B1: "Generate 4 multiple-choice questions testing intermediate knowledge: past tense, modal verbs, common idioms, prepositions in context, subordinating conjunctions. Each question: 1 correct + 3 wrong answers.",
  B2: "Generate 4 multiple-choice questions testing upper-intermediate knowledge: passive voice, reported speech, conditional sentences, nuanced vocabulary, register differences. Each question: 1 correct + 3 wrong answers.",
  C1: "Generate 4 multiple-choice questions testing advanced knowledge: complex grammar structures, idiomatic expressions, formal vs informal register, nuanced meaning distinctions. Each question: 1 correct + 3 wrong answers."
}

export const SPRACHPULS_LEVEL_CONTENT = {
  A1: "Generate 3 multiple-choice questions testing absolute beginner knowledge different from any previous test. Focus on: basic numbers, colors, greetings, pronouns. Each question: 1 correct + 3 plausible wrong answers. Include question ID, explanation, and CEFR level.",
  A2: "Generate 3 multiple-choice questions testing elementary knowledge. Focus on: days/months, basic verbs, family, numbers 11-100. Each must be unique and not repeat Sprachkompass questions.",
  B1: "Generate 3 multiple-choice questions testing intermediate knowledge. Focus on: past tense, modal verbs, common idioms, prepositions in context.",
  B2: "Generate 3 multiple-choice questions testing upper-intermediate knowledge. Focus on: passive voice, conditional, reported speech, nuanced vocabulary.",
  C1: "Generate 3 multiple-choice questions testing advanced knowledge. Focus on: complex grammar, idiomatic expressions, register differences, nuanced meaning."
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
