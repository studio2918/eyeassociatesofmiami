// Cognito hosted sign-in: authorization code + PKCE (S256), public client.
// ID token (60 min) + expiry live in sessionStorage; the 30-day refresh token in localStorage.
// PKCE data lives in localStorage (eaom_admin_pkce:<state>, 10-minute life) because iOS can evict
// the web view, and its sessionStorage, while the user is in their authenticator app.
// The API wants the ID token (it carries the email claim).
import { authDomain, clientId, redirectUri } from './config.js';
import * as drafts from './drafts.js';
import { roleOf } from './roles.js';

const RT = 'eaom_admin_rt';
const ID = 'eaom_admin_id';
const EXP = 'eaom_admin_exp';
const PKCE_PREFIX = 'eaom_admin_pkce:';
const PKCE_MAX_MS = 10 * 60 * 1000;
const SIGNED_IN_AT = 'eaom_admin_signed_in_at';
const LOOP_MS = 60 * 1000;
const EARLY_MS = 2 * 60 * 1000; // refresh when less than 2 minutes remain

let inflight = null;
let redirecting = null; // one sign-in redirect per page load

// After Back from Cognito, Safari/iOS may restore this page from bfcache with the old
// redirect promise still settled; app.js calls this on pageshow(persisted) so Sign in works again.
export function resetRedirect() { redirecting = null; }

// Tests only: forget module state (as if the page reloaded).
export function _resetForTests({ keepSignInMark = false } = {}) {
  inflight = null;
  redirecting = null;
  if (!keepSignInMark) del(sessionStorage, SIGNED_IN_AT);
}

function b64url(bytes) {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(n = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(n)));
}

async function challengeFor(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

function get(store, k) { try { return store.getItem(k); } catch { return null; } }
function set(store, k, v) { try { store.setItem(k, v); } catch { /* blocked */ } }
function del(store, k) { try { store.removeItem(k); } catch { /* blocked */ } }

function pkceKeys() {
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PKCE_PREFIX)) keys.push(k);
    }
  } catch { /* blocked */ }
  return keys;
}

function cleanPkce({ all = false } = {}) {
  for (const k of pkceKeys()) {
    let e = null;
    try { e = JSON.parse(get(localStorage, k)); } catch { /* junk */ }
    if (all || !e || !(Date.now() - e.createdAt < PKCE_MAX_MS)) del(localStorage, k);
  }
}

// True for 60 s after a sign-in finished in this tab (used to stop redirect loops).
export function recentlySignedIn() {
  const t = Number(get(sessionStorage, SIGNED_IN_AT) || 0);
  return t > 0 && Date.now() - t < LOOP_MS;
}

export function clearTokens() {
  del(sessionStorage, ID);
  del(sessionStorage, EXP);
  del(localStorage, RT);
}

function claims(jwt) {
  try {
    return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return {}; }
}

function jwtExpMs(jwt) {
  const exp = claims(jwt).exp;
  return typeof exp === 'number' ? exp * 1000 : null;
}

// Display only (the API checks the token itself).
export function signedInEmail() {
  const id = get(sessionStorage, ID);
  return (id && claims(id).email) || '';
}

// owner | doctor | editor | null, from the current ID token's cognito:groups. Hides UI only;
// the API checks the role itself on every request.
export function role() {
  const id = get(sessionStorage, ID);
  return id ? roleOf(claims(id)['cognito:groups']) : null;
}

function store(tok) {
  const exp = tok.expires_in ? Date.now() + tok.expires_in * 1000 : jwtExpMs(tok.id_token) || Date.now();
  set(sessionStorage, ID, tok.id_token);
  set(sessionStorage, EXP, String(exp));
  if (tok.refresh_token) set(localStorage, RT, tok.refresh_token);
}

async function tokenRequest(params) {
  let res;
  try {
    res = await fetch(authDomain + '/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
  } catch {
    throw new Error("Couldn't reach the sign-in service. Check your connection and try again.");
  }
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && !!body.id_token, status: res.status, body };
}

export function isSignedIn() {
  return !!(get(localStorage, RT) || validIdToken());
}

function validIdToken() {
  const id = get(sessionStorage, ID);
  const exp = Number(get(sessionStorage, EXP) || 0);
  return id && exp - Date.now() > EARLY_MS ? id : null;
}

async function refresh() {
  const rt = get(localStorage, RT);
  if (!rt) { clearTokens(); return null; }
  const r = await tokenRequest({ grant_type: 'refresh_token', client_id: clientId, refresh_token: rt });
  if (!r.ok) {
    // 400 invalid_grant = expired/revoked refresh token. Any other failure: also start over.
    clearTokens();
    return null;
  }
  store(r.body);
  return r.body.id_token;
}

// Resolves to the ID token, or null when signed out. Throws on network failure (tokens kept).
// force: skip the cached token (used after a 401).
export async function currentToken({ force = false } = {}) {
  if (!force) {
    const id = validIdToken();
    if (id) return id;
  }
  if (!inflight) inflight = refresh().finally(() => { inflight = null; });
  return inflight;
}

export function signIn(returnHash = location.hash) {
  if (!redirecting) {
    redirecting = startSignIn(returnHash).catch((e) => { redirecting = null; throw e; });
  }
  return redirecting;
}

async function startSignIn(returnHash) {
  cleanPkce();
  const verifier = randomString(48); // 64 chars
  const state = randomString(24);
  set(localStorage, PKCE_PREFIX + state, JSON.stringify({ verifier, state, hash: returnHash || '', createdAt: Date.now() }));
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid email',
    code_challenge: await challengeFor(verifier),
    code_challenge_method: 'S256',
    state,
  });
  location.assign(authDomain + '/oauth2/authorize?' + q.toString());
}

// Call once on page load. Handles ?code=&state= (or ?error=) from Cognito.
// Resolves {signedIn:false} when there is nothing to do, {signedIn:true, hash} on success,
// {signedIn:false, error} on failure.
export async function handleRedirect() {
  const p = new URLSearchParams(location.search);
  const code = p.get('code');
  const cognitoError = p.get('error');
  if (!code && !cognitoError) return { signedIn: false };

  const state = p.get('state') || '';
  let saved = null;
  if (state) {
    try { saved = JSON.parse(get(localStorage, PKCE_PREFIX + state)); } catch { /* junk */ }
    del(localStorage, PKCE_PREFIX + state); // single use
  }
  cleanPkce();
  const fresh = saved && Date.now() - saved.createdAt < PKCE_MAX_MS;
  const hash = (fresh && saved.hash) || '';
  history.replaceState(null, '', location.pathname + hash); // strip ?code=&state= right away

  if (cognitoError) return { signedIn: false, error: 'Sign-in was cancelled or failed. Please try again.' };
  if (!fresh || saved.state !== state) {
    return { signedIn: false, error: 'That sign-in link was not started here. Please sign in again.' };
  }
  const r = await tokenRequest({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: saved.verifier,
  });
  if (!r.ok) return { signedIn: false, error: 'Sign-in did not finish. Please try again.' };
  store(r.body);
  set(sessionStorage, SIGNED_IN_AT, String(Date.now()));
  return { signedIn: true, hash };
}

export async function signOut() {
  const rt = get(localStorage, RT);
  if (rt) {
    try {
      await fetch(authDomain + '/oauth2/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: rt, client_id: clientId }).toString(),
      });
    } catch { /* offline: still sign out here */ }
  }
  clearTokens();
  cleanPkce({ all: true });
  del(sessionStorage, SIGNED_IN_AT);
  drafts.stopAll();
  drafts.clearAll();
  const q = new URLSearchParams({ client_id: clientId, logout_uri: redirectUri });
  location.assign(authDomain + '/logout?' + q.toString());
}
