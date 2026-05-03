import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, clearIndexedDbPersistence } from "firebase/firestore";

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
// DIAGNOSTIC: persistentLocalCache disabled — testing if IndexedDB was causing publicStats write failures
export const db = getFirestore(app);

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
