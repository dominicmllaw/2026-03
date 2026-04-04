// HARBOUR INTERCEPT — Firebase Configuration
// ─────────────────────────────────────────────────────────────────────────────
// SETUP: Replace all REPLACE_WITH_* values with your Firebase project config.
// See the Firebase Setup Guide below (in your chat) for step-by-step instructions.
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getDatabase, ref, set, get, onValue, update, remove,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const firebaseConfig = {
  apiKey:            'REPLACE_WITH_YOUR_API_KEY',
  authDomain:        'REPLACE_WITH_YOUR_PROJECT_ID.firebaseapp.com',
  databaseURL:       'https://REPLACE_WITH_YOUR_PROJECT_ID-default-rtdb.firebaseio.com',
  projectId:         'REPLACE_WITH_YOUR_PROJECT_ID',
  storageBucket:     'REPLACE_WITH_YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'REPLACE_WITH_YOUR_SENDER_ID',
  appId:             'REPLACE_WITH_YOUR_APP_ID',
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref, set, get, onValue, update, remove };
