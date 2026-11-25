// Friendly names for admins (config.adminNames). The public config doesn't list anyone's email: each name is keyed
// by 'h:' + a short scrambled code of the lowercase email (FNV-1a), so the site never publishes who signs in.
export function emailKey(email) {
  let h = 0x811c9dc5;
  const s = String(email || '').trim().toLowerCase();
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return 'h:' + h.toString(16).padStart(8, '0');
}
// names[email] (tests / old configs) or names[emailKey(email)]; undefined when unknown
export function knownName(email, names) {
  if (!email || !names) return undefined;
  return names[email] || names[emailKey(email)];
}
