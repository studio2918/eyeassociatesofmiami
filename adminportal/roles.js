// Roles in the admin UI (spec addendum 2026-11-19). The server is the gate (403); this only hides
// what a role can't use. Parsing matches the server's roles.py exactly. No DOM; tested in node.

export const ROLES = ['owner', 'doctor', 'editor']; // highest precedence first

export const ROLE_CHOICES = [
  { id: 'owner', label: 'Owner', description: 'Everything, including People (who can sign in).' },
  { id: 'doctor', label: 'Doctor', description: 'Everything except People and the Doctors list: also insurance, jobs, applications and their own profile.' },
  { id: 'editor', label: 'Staff editor', description: 'Banners, closings and hours only.' },
];

export function roleLabel(role) {
  const r = ROLE_CHOICES.find((x) => x.id === role);
  return r ? r.label : 'No access';
}

// cognito:groups arrives as a list, or (API Gateway's JWT authorizer) a string like "[a b]".
export function parseGroups(raw) {
  if (Array.isArray(raw)) return raw.filter((g) => typeof g === 'string');
  if (typeof raw !== 'string') return [];
  let s = raw.trim();
  if (s.startsWith('[') && s.includes('"')) {
    try {
      const got = JSON.parse(s);
      return Array.isArray(got) ? got.filter((g) => typeof g === 'string') : [];
    } catch { /* fall through to the plain split */ }
  }
  s = s.replace(/^\[+|\]+$/g, '');
  return s.replace(/,/g, ' ').split(/\s+/).map((g) => g.trim().replace(/^"+|"+$/g, '')).filter(Boolean);
}

// Highest-precedence known role, or null.
export function roleOf(rawGroups) {
  const g = new Set(parseGroups(rawGroups));
  return ROLES.find((r) => g.has(r)) || null;
}

const TABS = ['banners', 'closings', 'hours', 'insurance', 'jobs', 'applications', 'themes'];
const MENU = ['profile', 'doctors', 'changes', 'reminders', 'people'];
const EDITOR = new Set(['banners', 'closings', 'hours', 'changes', 'reminders', 'holiday']);

export function canSee(role, screen) {
  if (role === 'owner') return TABS.includes(screen) || MENU.includes(screen) || screen === 'holiday';
  if (role === 'doctor') return screen !== 'people' && screen !== 'doctors' && canSee('owner', screen); // doctors list: owner only
  if (role === 'editor') return EDITOR.has(screen);
  return false;
}

export const tabsFor = (role) => TABS.filter((s) => canSee(role, s));
export const menuFor = (role) => MENU.filter((s) => canSee(role, s));

// ---- People (owner only) ----

export const personPath = (email) => `/admin/people/${encodeURIComponent(email)}`;

export function sortPeople(items) {
  const rank = (p) => (ROLES.includes(p.role) ? ROLES.indexOf(p.role) : ROLES.length);
  return [...(items || [])].sort((a, b) => rank(a) - rank(b) || String(a.email).localeCompare(String(b.email)));
}

// What a failed people call shows: the server's own friendly text where it sends one.
export function peopleErrorText(err) {
  const name = err && err.name;
  const body = (err && err.body) || {};
  if (name === 'ValidationError') return (err.errors && err.errors.join(' ')) || 'Please check the form.';
  if (name === 'StaleError' || (err && err.status === 409)) return 'That email already has a login.';
  if (err && err.status === 404) return 'That person was not found — they may have been removed.';
  if (err && (err.status === 429 || err.status === 502) && typeof body.error === 'string' && body.error) return body.error;
  return (err && err.message) || 'Something went wrong.';
}

// Holidays list (Reminders screen): owner/doctor edit; staff editors see it read-only (server: edit:holidays).
export const canEditHolidays = (role) => role === 'owner' || role === 'doctor';

// Weather banners mark the office closed and bring out the snow/ice characters: owner/doctor only (server: can_weather).
export const canEditWeather = (role) => role === 'owner' || role === 'doctor';
