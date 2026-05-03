// Admin reset script — clears categoryLevels, cardProgress, publicStats/data
// for Mark and Elosy. Uses Firebase Admin SDK (bypasses Firestore security rules).
//
// REQUIRES: service-account.json in project root
//   → Firebase Console → Project Settings → Service Accounts → Generate new private key
//
// RUN: node scripts/reset-user-data.mjs

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const __dir = dirname(fileURLToPath(import.meta.url))
const saPath = join(__dir, '..', 'service-account.json')

if (!existsSync(saPath)) {
  console.error('❌  service-account.json not found in project root.')
  console.error('    Firebase Console → Project Settings → Service Accounts → Generate new private key')
  console.error('    Save as: ' + saPath)
  process.exit(1)
}

const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'))

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const USERS = [
  { uid: 'aiNZh4Myn8Y0KfYkGGrkNNW0HC72', name: 'Mark' },
  { uid: 'NIX3DYenRdbRjmr2EHsIad9GcqG3', name: 'Elosy' },
]

const INITIAL_CATEGORY_LEVELS = {
  grundlagen: 1,
  vocab: 1,
  street: 1,
  home: 1,
  urlaub: 1,
  satz: 1,
}

async function deleteCollection(ref) {
  const snap = await ref.get()
  if (snap.empty) return 0
  const batch = db.batch()
  snap.docs.forEach(doc => batch.delete(doc.ref))
  await batch.commit()
  return snap.size
}

async function resetUser({ uid, name }) {
  console.log(`\n── ${name} (${uid}) ──────────────────────────`)

  // 1. Reset categoryLevels
  const settingsRef = db.doc(`users/${uid}/settings/categoryLevels`)
  await settingsRef.set(INITIAL_CATEGORY_LEVELS)
  console.log('  ✅  settings/categoryLevels → all set to 1')

  // 2. Wipe cardProgress (may have many docs → paginate in batches of 500)
  let totalDeleted = 0
  const cpRef = db.collection(`users/${uid}/cardProgress`)
  let batch
  do {
    const snap = await cpRef.limit(500).get()
    if (snap.empty) break
    batch = db.batch()
    snap.docs.forEach(doc => batch.delete(doc.ref))
    await batch.commit()
    totalDeleted += snap.size
    console.log(`  🗑️   cardProgress — deleted ${snap.size} docs (total: ${totalDeleted})`)
  } while (true)
  if (totalDeleted === 0) {
    console.log('  ℹ️   cardProgress — already empty')
  } else {
    console.log(`  ✅  cardProgress — wiped (${totalDeleted} docs deleted)`)
  }

  // 3. Delete publicStats/data
  const psRef = db.doc(`users/${uid}/publicStats/data`)
  const psSnap = await psRef.get()
  if (psSnap.exists) {
    await psRef.delete()
    console.log('  ✅  publicStats/data — deleted')
  } else {
    console.log('  ℹ️   publicStats/data — did not exist (skipped)')
  }
}

async function main() {
  console.log('🔄  Vocara User Data Reset')
  console.log('   Project: vocara-ca2b7')
  console.log('   Users:   Mark + Elosy')
  console.log('   Scope:   categoryLevels, cardProgress, publicStats/data')
  console.log('   Skips:   streaks, profile, partner data, user-created cards')

  for (const user of USERS) {
    await resetUser(user)
  }

  console.log('\n✅  Reset complete for both users.')
  process.exit(0)
}

main().catch(err => {
  console.error('\n❌  Error:', err.message)
  process.exit(1)
})
