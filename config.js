// ============================================================
// LUDEK MARKETPLACE — FIREBASE CONFIG
// Replace with your actual Firebase project credentials.
// Get these from: Firebase Console → Project Settings → SDK setup
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyAvhaV4JR59o2lW7tniMu1GyrEte6ZjvQ8",
  authDomain: "dmb-5b8e2.firebaseapp.com",
  projectId: "dmb-5b8e2",
  storageBucket: "dmb-5b8e2.firebasestorage.app",
  messagingSenderId: "225510920822",
  appId: "1:225510920822:web:89cc6d0f27ec97d90ac557",
  measurementId: "G-E2BVFWMKXK"
};



// Export for use in auth.js and other modules
// This file is imported as a regular script (not ES module) for broad browser compatibility.
window.LUDEK_FIREBASE_CONFIG = firebaseConfig;
