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
