// ============================================================
// LUDEK MARKETPLACE — FIREBASE CONFIG
// Replace with your actual Firebase project credentials.
// Get these from: Firebase Console → Project Settings → SDK setup
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCOXEuJcanG6p-llMbEqyW7UaqZFq4lLbU",
  authDomain: "ludek-market-hub.firebaseapp.com",
  projectId: "ludek-market-hub",
  storageBucket: "ludek-market-hub.firebasestorage.app",
  messagingSenderId: "353363685283",
  appId: "1:353363685283:web:73363d0d254cf70eb2f416",
  measurementId: "G-986CDNQP2T"
};


// Export for use in auth.js and other modules
// This file is imported as a regular script (not ES module) for broad browser compatibility.
window.LUDEK_FIREBASE_CONFIG = firebaseConfig;
