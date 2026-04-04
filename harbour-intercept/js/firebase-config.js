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
  apiKey:            'AIzaSyCKaRlFlPnPhGMbOVFLi66wDThiGXbi10A',
  authDomain:        'harbour-intercept-ea99a.firebaseapp.com',
  databaseURL:       'https://harbour-intercept-ea99a-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId:         'harbour-intercept-ea99a',
  storageBucket:     'harbour-intercept-ea99a.firebasestorage.app',
  messagingSenderId: '1014642674578',
  appId:             '1:1014642674578:web:ad5b11607fb68432644f4b',
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export { ref, set, get, onValue, update, remove };
