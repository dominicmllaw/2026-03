// Tax Adviser Arena — Database Layer
// Firebase Realtime Database with localStorage fallback
// Unified API regardless of backend

import { FIREBASE_CONFIG } from './config.js';

let firebaseDb = null;
let useFirebase = false;
const LS_PREFIX = 'taa_';
const listeners = new Map(); // path → Set<callback>
let pollInterval = null;

/**
 * Initialise the database. Tries Firebase first, falls back to localStorage.
 */
export async function initDB() {
  if (FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.databaseURL) {
    try {
      // Dynamic import of Firebase SDK (loaded via CDN in HTML)
      const app = window.firebase?.app?.() || window.firebase?.initializeApp?.(FIREBASE_CONFIG);
      if (window.firebase?.database) {
        firebaseDb = window.firebase.database(app);
        useFirebase = true;
        console.log('[DB] Using Firebase Realtime Database');
        return;
      }
    } catch (e) {
      console.warn('[DB] Firebase init failed, falling back to localStorage:', e);
    }
  }
  console.log('[DB] Using localStorage fallback');
  // Start polling for localStorage changes (for multi-tab sync)
  startLocalStoragePoll();
}

/**
 * Write a value at the given path.
 * @param {string} path - e.g. 'game/currentRound'
 * @param {*} value
 */
export async function set(path, value) {
  if (useFirebase) {
    const ref = firebaseDb.ref(path);
    await ref.set(value);
  } else {
    const key = LS_PREFIX + path.replace(/\//g, '.');
    localStorage.setItem(key, JSON.stringify(value));

    // If this is a child path (e.g. 'game/tutorialSlide'), merge the value
    // into the parent object stored at the root key (e.g. 'taa_game') so that
    // get('game') and onValue('game', ...) see the change.
    const parts = path.split('/');
    if (parts.length > 1) {
      const rootKey = LS_PREFIX + parts[0];
      const raw = localStorage.getItem(rootKey);
      let rootObj;
      try { rootObj = raw ? JSON.parse(raw) : {}; } catch { rootObj = {}; }
      if (typeof rootObj !== 'object' || rootObj === null) rootObj = {};

      // Build nested structure for deep paths (e.g. 'a/b/c' → {b: {c: value}})
      let target = rootObj;
      for (let i = 1; i < parts.length - 1; i++) {
        if (typeof target[parts[i]] !== 'object' || target[parts[i]] === null) {
          target[parts[i]] = {};
        }
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = value;

      localStorage.setItem(rootKey, JSON.stringify(rootObj));
    }

    notifyListeners(path, value);
  }
}

/**
 * Read a value once from the given path.
 * @param {string} path
 * @returns {*}
 */
export async function get(path) {
  if (useFirebase) {
    const ref = firebaseDb.ref(path);
    const snap = await ref.once('value');
    return snap.val();
  } else {
    const key = LS_PREFIX + path.replace(/\//g, '.');
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
}

/**
 * Subscribe to changes at a path.
 * @param {string} path
 * @param {function} callback - receives the new value
 * @returns {function} unsubscribe function
 */
export function onValue(path, callback) {
  if (useFirebase) {
    const ref = firebaseDb.ref(path);
    const handler = (snap) => callback(snap.val());
    ref.on('value', handler);
    return () => ref.off('value', handler);
  } else {
    if (!listeners.has(path)) listeners.set(path, new Set());
    listeners.get(path).add(callback);
    // Fire immediately with current value
    const key = LS_PREFIX + path.replace(/\//g, '.');
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try { callback(JSON.parse(raw)); } catch {}
    }
    return () => listeners.get(path)?.delete(callback);
  }
}

/**
 * Get all children under a path (one level).
 * @param {string} path
 * @returns {Object} key-value map of children
 */
export async function getChildren(path) {
  if (useFirebase) {
    const ref = firebaseDb.ref(path);
    const snap = await ref.once('value');
    return snap.val() || {};
  } else {
    const prefix = LS_PREFIX + path.replace(/\//g, '.') + '.';
    const result = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(prefix)) {
        const childKey = key.slice(prefix.length).split('.')[0];
        if (!result[childKey]) {
          // Read the full child object
          const childPath = path + '/' + childKey;
          result[childKey] = await get(childPath);
        }
      }
    }
    return result;
  }
}

/**
 * Reset all game data (for teacher to start fresh).
 */
export async function resetGame() {
  if (useFirebase) {
    await firebaseDb.ref('/').set(null);
  } else {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(LS_PREFIX)) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }
}

// ── Internal helpers ──

function notifyListeners(path, value) {
  // Notify exact path listeners
  if (listeners.has(path)) {
    listeners.get(path).forEach(cb => cb(value));
  }
  // Notify parent path listeners (they might want to know about child changes)
  const parts = path.split('/');
  for (let i = parts.length - 1; i >= 1; i--) {
    const parentPath = parts.slice(0, i).join('/');
    if (listeners.has(parentPath)) {
      // Re-read the full parent value
      get(parentPath).then(val => {
        listeners.get(parentPath)?.forEach(cb => cb(val));
      });
    }
  }
}

function startLocalStoragePoll() {
  // Poll every 500ms for localStorage changes (cross-tab)
  let lastSnapshot = getLocalStorageSnapshot();
  pollInterval = setInterval(() => {
    const current = getLocalStorageSnapshot();
    for (const [key, value] of Object.entries(current)) {
      if (lastSnapshot[key] !== value) {
        const path = key.slice(LS_PREFIX.length).replace(/\./g, '/');
        try {
          notifyListeners(path, JSON.parse(value));
        } catch {}
      }
    }
    // Check for deletions
    for (const key of Object.keys(lastSnapshot)) {
      if (!(key in current)) {
        const path = key.slice(LS_PREFIX.length).replace(/\./g, '/');
        notifyListeners(path, null);
      }
    }
    lastSnapshot = current;
  }, 500);
}

function getLocalStorageSnapshot() {
  const snap = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(LS_PREFIX)) {
      snap[key] = localStorage.getItem(key);
    }
  }
  return snap;
}
