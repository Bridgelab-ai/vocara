import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, CACHE_SIZE_UNLIMITED, clearIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD8R7oHIw9HvviqprAnfPgDmHtkUDy3vzI",
  authDomain: "vocara-ca2b7.firebaseapp.com",
  projectId: "vocara-ca2b7",
  storageBucket: "vocara-ca2b7.firebasestorage.app",
  messagingSenderId: "609285831853",
  appId: "1:609285831853:web:dbd5a9d06ce5663ecfda24"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Offline-first: serve reads from IndexedDB cache when data hasn't changed
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ cacheSizeBytes: CACHE_SIZE_UNLIMITED })
});

// One-time IndexedDB cache clear when Firestore rules change.
// Stale cached rules can cause permission-denied errors on writes even
// after server-side rules are updated — clearing forces a fresh start.
const RULES_VERSION = 'v2025-05-04';
if (localStorage.getItem('firestoreRulesVersion') !== RULES_VERSION) {
  clearIndexedDbPersistence(db)
    .then(() => localStorage.setItem('firestoreRulesVersion', RULES_VERSION))
    .catch(() => localStorage.setItem('firestoreRulesVersion', RULES_VERSION));
}

export default app;
