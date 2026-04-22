// ============================================================
//  LK Mart — Firebase Configuration
//  Project: lk-mart-41125
//  Configured automatically for Leon Knight Mart
// ============================================================

const firebaseConfig = {
  apiKey:            "AIzaSyDIaansuKsrJo7WZEqAT7peKi5swHniRF8",
  authDomain:        "lk-mart-41125.firebaseapp.com",
  projectId:         "lk-mart-41125",
  storageBucket:     "lk-mart-41125.firebasestorage.app",
  messagingSenderId: "873492477079",
  appId:             "1:873492477079:web:fb47f0816187cac99925d2"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firebase services used throughout the app
const auth = firebase.auth();
const db   = firebase.firestore();
// Note: Images are uploaded via Cloudinary (free) — no Firebase Storage needed
