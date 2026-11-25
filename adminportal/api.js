// JSON client for the admin API. Sends the Cognito ID token as a Bearer header.
// 401 -> one refresh + one retry; still 401 -> save drafts and go to sign-in.
import { apiUrl, adminNames } from './config.js';
import { knownName } from './names.js';
import { currentToken, signIn, recentlySignedIn, clearTokens } from './auth.js';
import * as drafts from './drafts.js';

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export class StaleError extends ApiError {
  // body: the 409 response (e.g. {error:"exists"} from People or a holiday answer).
  constructor(by, at, body) {
    super(staleMessage({ by, at }), 409, body);
    this.name = 'StaleError';
    this.by = by;
    this.at = at;
  }
}

export class ValidationError extends ApiError {
  constructor(errors, warnings, body) {
    super(errors.join(' ') || 'Please check the form.', 400, body);
    this.name = 'ValidationError';
    this.errors = errors;
    this.warnings = warnings;
  }
}

export class NetworkError extends ApiError {
  constructor() {
    super("Couldn't reach the server. Check your connection and try again — your typing is saved.", 0);
    this.name = 'NetworkError';
  }
}

// Thrown after the page has been sent to sign-in; callers just stop.
export class AuthError extends ApiError {
  constructor() {
    super('Please sign in again — your typing is saved.', 401);
    this.name = 'AuthError';
  }
}

// A sign-in just finished but the API still says 401: don't bounce back to Cognito (loop).
export class SignInRejectedError extends AuthError {
  constructor() {
    super();
    this.message = "You signed in, but the server didn't accept it. Please try again in a minute or contact Dr. Gray.";
    this.name = 'SignInRejectedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(body) {
    super("You don't have access to this.", 403, body);
    this.name = 'ForbiddenError';
  }
}

export function displayName(email, names = adminNames) {
  if (!email) return 'Someone else';
  const known = knownName(email, names);
  if (known) return known;
  const local = String(email).split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function relativeTime(iso, now = Date.now()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, (now - t) / 1000);
  if (s < 45) return 'just now';
  if (s < 90) return 'a minute ago';
  const m = Math.round(s / 60);
  if (m < 45) return `${m} minutes ago`;
  if (m < 90) return 'an hour ago';
  const h = Math.round(m / 60);
  if (h < 22) return `${h} hours ago`;
  const d = Math.max(1, Math.round(h / 24));
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export function staleMessage({ by, at }, now = Date.now(), names = adminNames) {
  const when = at ? relativeTime(at, now) : '';
  return `${displayName(by, names)} changed this${when ? ' ' + when : ''} — reload?`;
}

async function goSignIn() {
  drafts.flushAll();
  if (recentlySignedIn()) {
    clearTokens();
    const err = new SignInRejectedError();
    try { globalThis.dispatchEvent?.(new CustomEvent('eaom:signin-rejected', { detail: err.message })); } catch { /* no DOM */ }
    throw err;
  }
  await signIn(location.hash);
  throw new AuthError();
}

async function tokenOrNull(opts) {
  try { return await currentToken(opts); } catch (e) {
    throw Object.assign(new NetworkError(), { cause: e });
  }
}

async function send(method, path, body, token) {
  const headers = { Authorization: 'Bearer ' + token };
  const opts = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  try {
    return await fetch(apiUrl + path, opts);
  } catch {
    throw new NetworkError();
  }
}

async function parse(res) {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

export async function request(method, path, body, { dryRun = false } = {}) {
  if (dryRun) path += (path.includes('?') ? '&' : '?') + 'dryRun=1';
  let token = await tokenOrNull();
  if (!token) return goSignIn();
  let res = await send(method, path, body, token);
  if (res.status === 401) {
    token = await tokenOrNull({ force: true });
    if (!token) return goSignIn();
    res = await send(method, path, body, token);
    if (res.status === 401) return goSignIn();
  }
  const data = await parse(res);
  if (res.ok) return data;
  if (res.status === 403) throw new ForbiddenError(data);
  if (res.status === 409) throw new StaleError(data && data.by, data && data.at, data);
  if (res.status === 400) {
    const d = data || {};
    const errors = Array.isArray(d.errors) ? d.errors : d.error ? [d.error] : [];
    throw new ValidationError(errors, Array.isArray(d.warnings) ? d.warnings : [], d);
  }
  const msg = res.status === 404 ? 'That item was not found — it may have been removed.'
    : 'Something went wrong on the server. Please try again.';
  throw new ApiError(msg, res.status, data);
}

export const get = (path) => request('GET', path);
export const put = (path, body, opts) => request('PUT', path, body, opts);
export const del = (path) => request('DELETE', path);
export const post = (path, body) => request('POST', path, body);
export const patch = (path, body) => request('PATCH', path, body);
