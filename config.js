// ============================================================
// LUDEK MARKETPLACE — FIREBASE CONFIG
// Replace with your actual Firebase project credentials.
// Get these from: Firebase Console → Project Settings → SDK setup
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyAil0wIwt4Y45W2VSl-5KrnthNuQ8pdC4A",
    authDomain: "ludek-marketplace.firebaseapp.com",
    projectId: "ludek-marketplace",
    storageBucket: "ludek-marketplace.firebasestorage.app",
    messagingSenderId: "952279938532",
    appId: "1:952279938532:web:87b455c100d20b648843f1",
    measurementId: "G-V1FXRZ0QFY"
};

// Export for use in auth.js and other modules
// This file is imported as a regular script (not ES module) for broad browser compatibility.
window.LUDEK_FIREBASE_CONFIG = firebaseConfig;
