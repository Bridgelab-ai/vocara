// Translate public/locales/de.json into a new locale file via Claude Haiku.
// Usage:  node scripts/add-language.js SW
// Cost:   ~$0.02 per run (Haiku pricing, ~170 strings)
// Env:    ANTHROPIC_KEY  (or ANTHROPIC_API_KEY)

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const LANG_NAMES = {
  sw: 'Swahili',
  fr: 'French',
  es: 'Spanish',
  pt: 'Portuguese',
  it: 'Italian',
  nl: 'Dutch',
  pl: 'Polish',
  tr: 'Turkish',
  ar: 'Arabic',
  ja: 'Japanese',
  zh: 'Chinese (Simplified)',
  ko: 'Korean',
  ru: 'Russian',
  hi: 'Hindi',
  th: 'Thai',
  uk: 'Ukrainian',
  vi: 'Vietnamese',
  id: 'Indonesian',
}

const langCode = process.argv[2]?.toLowerCase()
if (!langCode) {
  console.error('Usage: node scripts/add-language.js <LANG_CODE>')
  console.error('Example: node scripts/add-language.js SW')
  process.exit(1)
}

const apiKey = process.env.ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY
if (!apiKey) {
  console.error('Error: set ANTHROPIC_KEY or ANTHROPIC_API_KEY environment variable')
  process.exit(1)
}

const langName = LANG_NAMES[langCode] || langCode.toUpperCase()
const sourcePath = join(ROOT, 'public/locales/de.json')
const targetPath = join(ROOT, `public/locales/${langCode}.json`)

const source = JSON.parse(readFileSync(sourcePath, 'utf8'))
const keys = Object.keys(source)

console.log(`Translating ${keys.length} strings  de → ${langName} (${langCode})…`)

// One request — Haiku handles 170 short strings comfortably within 4096 output tokens
const payload = JSON.stringify(source, null, 2)

const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: `You are a professional UI translator for a mobile language-learning app.
Translation rules:
- Keep all emojis exactly as-is (🃏 ✓ ✕ ⚡ 📈 etc.)
- Keep \\n newlines exactly as-is
- Keep tokens like → ← unchanged
- Keep % signs, numbers, and punctuation naturally
- Translations must be short and natural — this is a mobile UI, not a document
- Return ONLY a valid JSON object with identical keys and translated values, no explanation`,
    messages: [{
      role: 'user',
      content: `Translate every JSON value from German to ${langName}. Return ONLY the JSON object.\n\n${payload}`,
    }],
  }),
})

if (!res.ok) {
  const err = await res.text()
  console.error(`API error ${res.status}:`, err)
  process.exit(1)
}

const data = await res.json()
const raw = (data.content?.[0]?.text || '').trim()

// Extract JSON object from response (strip any accidental markdown fences)
const match = raw.match(/\{[\s\S]*\}/)
if (!match) {
  console.error('Could not parse JSON from response:\n', raw)
  process.exit(1)
}

let translated
try {
  translated = JSON.parse(match[0])
} catch (e) {
  console.error('JSON.parse failed:', e.message, '\nRaw:\n', raw)
  process.exit(1)
}

// Build output: guarantee every key exists, fall back to German for any misses
const output = {}
const missed = []
for (const [k, v] of Object.entries(source)) {
  if (translated[k] !== undefined && translated[k] !== '') {
    output[k] = translated[k]
  } else {
    output[k] = v
    missed.push(k)
  }
}

if (missed.length > 0) {
  console.warn(`  Warning: ${missed.length} key(s) missing in response, kept German: ${missed.join(', ')}`)
}

writeFileSync(targetPath, JSON.stringify(output, null, 2) + '\n', 'utf8')

const inp = data.usage?.input_tokens ?? 0
const out = data.usage?.output_tokens ?? 0
// Haiku 4.5 pricing: $0.80/MTok input, $4.00/MTok output
const cost = (inp / 1_000_000 * 0.80) + (out / 1_000_000 * 4.00)

console.log(`✓ ${Object.keys(output).length} keys written → public/locales/${langCode}.json`)
console.log(`  Tokens: ${inp} in / ${out} out  |  cost: ~$${cost.toFixed(4)}`)
