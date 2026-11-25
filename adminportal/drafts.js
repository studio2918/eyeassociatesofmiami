// Unsaved form text, kept in localStorage as draft:<key> so it survives a sign-in redirect.
// No patient data is ever typed here, but drafts are still cleared on sign-out.
const PREFIX = 'draft:';
const live = new Set(); // handles with a pending (debounced) save

export function load(key) {
  try { return JSON.parse(localStorage.getItem(PREFIX + key)); } catch { return null; }
}

export function save(key, data) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(data)); } catch { /* storage full/blocked */ }
}

export function clear(key) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* ignore */ }
}

export function clearAll() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

// Called by ui.formDraft handles.
export function register(handle) { live.add(handle); }
export function unregister(handle) { live.delete(handle); }

// Write every pending draft now (before a redirect).
export function flushAll() { live.forEach((h) => h.flush()); }

// Detach every form (screen change / tests).
export function stopAll() { [...live].forEach((h) => h.stop()); }
