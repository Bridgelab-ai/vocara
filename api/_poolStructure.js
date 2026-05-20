// Shared pool architecture config — imported by all API generators and src/App.jsx
// AUTHORITATIVE reference for card counts, level caps, and active language pairs.

export const ACTIVE_LANGUAGES = ['de', 'en', 'sw', 'es']
export const LANGUAGE_PAIRS = ACTIVE_LANGUAGES.flatMap(a =>
  ACTIVE_LANGUAGES.filter(b => b !== a).map(b => `${a}_${b}`)
)
// de_en, de_sw, en_de, en_sw, sw_de, sw_en
// Adding a new language to ACTIVE_LANGUAGES automatically includes all its pairs everywhere.

export const POOL_STRUCTURE = {
  grundlagen:   { cardsPerLevel: 20, totalLevels: 10 },
  vocab:        { cardsPerLevel: 30, totalLevels: 22 },
  street:       { cardsPerLevel: 25, totalLevels: 12 },
  saetze:       { cardsPerLevel: 20, totalLevels: 10 },
  home:         { cardsPerLevel: 22, totalLevels: 14 },
  urlaub:       { cardsPerLevel: 20, totalLevels: 10 },
  satztraining: { cardsPerLevel: 22, totalLevels: 14 },
  topics:       { cardsPerLevel: 15, totalLevels: 10 },
}

// % of cards marked important per level (decreases as level rises)
const IMPORTANT_PCT = { 1: 0.40, 2: 0.35, 3: 0.25, 4: 0.20, 5: 0.15, 6: 0.15 }

export const getImportantPct = (level) => IMPORTANT_PCT[level] ?? 0.05
export const getRarity = (level) => Number(level) >= 7 ? 'gold' : 'silver'
export const markImportant = (level) => Math.random() < getImportantPct(Number(level))
