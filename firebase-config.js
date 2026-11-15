/* ============================================================
   firebase-config.js

   Paste the configuration from the Firebase console here.
   Firebase console -> Project settings -> General -> Your apps
   -> Web app -> SDK setup and configuration -> Config.

   Leave it exactly as it is (apiKey empty) and the application
   keeps working on this device alone, without any cloud.

   These values are not secrets. A web Firebase config is meant
   to be public; what protects the records is the sign-in and
   the Firestore security rules in SETUP-FIREBASE.md.
   ============================================================ */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyBrveUbiq6xT68ofUth4IzUicG6HVSXZGA",
  authDomain: "advocate-billing-7d06c.firebaseapp.com",
  projectId: "advocate-billing-7d06c",
  storageBucket: "advocate-billing-7d06c.firebasestorage.app",
  messagingSenderId: "647347065103",
  appId: "1:647347065103:web:2ffe80c42c6ed4127cae7a"
};

/* Shared office (optional).
   Leave empty and the records belong to the account that signs in.
   Put a fixed name here, the same on every device, when an assistant
   must work on the same records. See step 11 of SETUP-FIREBASE.md. */
window.OFFICE_ID = "";
