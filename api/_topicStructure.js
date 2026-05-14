// Topic structure — shared by generate-topic-pool.js and frontend
export const TOPIC_STRUCTURE = {
  kochen:      { cardsPerLevel: 15, totalLevels: 8 },
  liebe:       { cardsPerLevel: 15, totalLevels: 8 },
  sport:       { cardsPerLevel: 15, totalLevels: 8 },
  film:        { cardsPerLevel: 15, totalLevels: 8 },
  musik:       { cardsPerLevel: 15, totalLevels: 8 },
  reisen:      { cardsPerLevel: 15, totalLevels: 8 },
  business:    { cardsPerLevel: 15, totalLevels: 8 },
  natur:       { cardsPerLevel: 15, totalLevels: 8 },
  tech:        { cardsPerLevel: 15, totalLevels: 8 },
  gesundheit:  { cardsPerLevel: 15, totalLevels: 8 },
  psychologie: { cardsPerLevel: 15, totalLevels: 8 },
  ausgehen:    { cardsPerLevel: 15, totalLevels: 8 },
}

export const TOPIC_NAMES = {
  kochen:      { en: 'Cooking & Food',       de: 'Kochen & Essen'      },
  liebe:       { en: 'Love & Relationships', de: 'Liebe & Beziehung'   },
  sport:       { en: 'Sports & Fitness',     de: 'Sport & Fitness'     },
  film:        { en: 'Film & Cinema',        de: 'Film & Kino'         },
  musik:       { en: 'Music & Instruments',  de: 'Musik & Instrumente' },
  reisen:      { en: 'Travel & Transport',   de: 'Reisen & Transport'  },
  business:    { en: 'Business & Work',      de: 'Business & Arbeit'   },
  natur:       { en: 'Nature & Environment', de: 'Natur & Umwelt'      },
  tech:        { en: 'Technology & Gadgets', de: 'Technik & Gadgets'   },
  gesundheit:  { en: 'Health & Body',        de: 'Gesundheit & Körper' },
  psychologie: { en: 'Psychology & Mind',    de: 'Psychologie & Geist' },
  ausgehen:    { en: 'Going Out & Social',   de: 'Ausgehen & Freizeit' },
}

export const TOPIC_EMOJIS = {
  kochen: '🍳', liebe: '❤️', sport: '💪', film: '🎬',
  musik: '🎵', reisen: '✈️', business: '💼', natur: '🌿',
  tech: '💻', gesundheit: '🏥', psychologie: '🧠', ausgehen: '🍺',
}

export const TOPIC_LEVEL_CONTENT = {
  1: (topicEn, fromName, toName) =>
    `Generate exactly 15 flashcards on the topic "${topicEn}" for a ${fromName} speaker learning ${toName}.
Level 1 (A1): the 15 most essential, basic single words for this topic. Exactly 15 unique words.
All ${fromName} fronts, all ${toName} backs. 100% accurate and natural. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"word in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","wordType":"noun|verb|adjective","register":"neutral"}]`,

  2: (topicEn, fromName, toName) =>
    `Generate exactly 15 flashcards on the topic "${topicEn}" for a ${fromName} speaker learning ${toName}.
Level 2 (A2): everyday words and short useful phrases specific to this topic. Exactly 15 unique words or short phrases.
All ${fromName} fronts, all ${toName} backs. 100% accurate and natural. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"word/phrase in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","wordType":"noun|verb|phrase","register":"neutral"}]`,

  3: (topicEn, fromName, toName) =>
    `Generate exactly 15 flashcards on the topic "${topicEn}" for a ${fromName} speaker learning ${toName}.
Level 3 (A2-B1): practical phrases and common collocations used in everyday context. Exactly 15 unique phrases.
All ${fromName} fronts, all ${toName} backs. 100% accurate and natural. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"phrase in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","wordType":"phrase","register":"neutral|informal"}]`,

  4: (topicEn, fromName, toName) =>
    `Generate exactly 15 flashcards on the topic "${topicEn}" for a ${fromName} speaker learning ${toName}.
Level 4 (B1): idiomatic expressions and useful conversational phrases for this topic. Exactly 15 unique expressions.
All ${fromName} fronts, all ${toName} backs. 100% accurate and natural. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"expression in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","wordType":"phrase","register":"neutral|informal"}]`,

  5: (topicEn, fromName, toName) =>
    `Generate exactly 15 flashcards on the topic "${topicEn}" for a ${fromName} speaker learning ${toName}.
Level 5 (B1-B2): nuanced vocabulary, phrasal verbs and collocations typical for this topic. Exactly 15 unique expressions.
All ${fromName} fronts, all ${toName} backs. 100% accurate and natural. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"expression in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","wordType":"phrasal verb|collocation","register":"neutral|informal"}]`,

  6: (topicEn, fromName, toName) =>
    `Generate exactly 15 flashcards on the topic "${topicEn}" for a ${fromName} speaker learning ${toName}.
Level 6 (B2): sophisticated vocabulary, domain-specific terms and complex expressions. Exactly 15 unique expressions.
All ${fromName} fronts, all ${toName} backs. 100% accurate and natural. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"expression in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","wordType":"phrase|term","register":"neutral|formal"}]`,

  7: (topicEn, fromName, toName) =>
    `Generate exactly 15 flashcards on the topic "${topicEn}" for a ${fromName} speaker learning ${toName}.
Level 7 (B2-C1): idioms, cultural references and subtle nuances native speakers use for this topic. Exactly 15 unique expressions.
All ${fromName} fronts, all ${toName} backs. 100% accurate and natural. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"expression in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","wordType":"idiom|phrase","register":"informal|neutral"}]`,

  8: (topicEn, fromName, toName) =>
    `Generate exactly 15 flashcards on the topic "${topicEn}" for a ${fromName} speaker learning ${toName}.
Level 8 (C1): highly nuanced, native-level authentic expressions as a fluent speaker would say them. Exactly 15 unique expressions.
All ${fromName} fronts, all ${toName} backs. 100% accurate and natural. Include phonetic pronunciation for ${toName}.
Return ONLY a valid JSON array (no markdown):
[{"front":"expression in ${fromName}","back":"translation in ${toName}","pronunciation":"phonetic","wordType":"idiom|phrase|collocation","register":"neutral|informal|formal"}]`,
}
