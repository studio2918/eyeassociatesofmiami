// Doctors list + bio approval: pure helpers (no DOM; tested in node). Server: eaom-site-admin src/doctors.py.

// The profile questions a doctor answers (keys match doctors.ANSWER_KEYS on the server).
export const QUESTION_SECTIONS = [
  { title: 'Training and credentials', questions: [
    { key: 'name', label: 'Your name as you’d like it shown', hint: 'For example: John F. Gray III, OD' },
    { key: 'undergrad', label: 'Undergraduate school' },
    { key: 'school', label: 'Optometry school and graduation year' },
    { key: 'residency', label: 'Residency or extra training' },
    { key: 'board', label: 'Board certified by the American Board of Optometry?', hint: 'Yes, no or not sure' },
    { key: 'joined', label: 'Year you joined Eye Associates of Miami' },
    { key: 'groups', label: 'Professional groups', hint: 'OAOP, AOA, etc.' },
    { key: 'awards', label: 'Awards or leadership roles' },
  ] },
  { title: 'Your practice', questions: [
    { key: 'focus', label: 'Areas you especially enjoy or focus on', hint: 'Contacts, dry eye, kids, glaucoma, diabetic eye care, emergencies, etc.', long: true },
    { key: 'patients', label: 'Patients you love seeing', hint: 'First exams, longtime families, athletes, seniors, etc.', long: true },
    { key: 'proud', label: 'Equipment or care you’re proud the office offers', long: true },
    { key: 'languages', label: 'Languages you speak besides English' },
  ] },
  { title: 'Outside the office', hint: 'All optional. This is what makes a bio feel like a real person.', questions: [
    { key: 'hometown', label: 'Hometown, and how long you’ve lived in the Miami area' },
    { key: 'family', label: 'Family to mention', hint: 'Spouse, kids, grandkids; first names only if you want.' },
    { key: 'hobbies', label: 'Hobbies or interests' },
    { key: 'community', label: 'Church, clubs, teams or causes you’re involved in' },
    { key: 'favorite', label: 'Favorite thing about Miami / Ottawa County' },
    { key: 'funfact', label: 'A fun fact patients might not guess' },
  ] },
  { title: 'In your own words', hint: 'A sentence or two each. These often become the quote in your bio.', questions: [
    { key: 'why', label: 'Why did you become an optometrist?', long: true },
    { key: 'enjoy', label: 'What do you enjoy most about your work?', long: true },
    { key: 'feel', label: 'What do you want patients to feel when they leave?', long: true },
    { key: 'advice', label: 'One piece of eye advice you give all the time', long: true },
    { key: 'other', label: 'Anything else you’d like included?', long: true },
  ] },
];
export const QUESTIONS = QUESTION_SECTIONS.flatMap((s) => s.questions);
export const BIO_MAX = 1200;

export const STATUS = {
  waiting: 'Waiting for their answers',
  answered: 'Answers in: write the bio',
  sent: 'Waiting for their approval',
  changes: 'They asked for changes',
  approved: 'Approved',
};

// What the Doctors list says about one doctor's bio.
export function statusText(d) {
  const s = (d && d.status) || 'waiting';
  if (s === 'approved' && (d.draftBio || '').trim() && (d.draftBio || '').trim() !== (d.bio || '').trim()) return 'Approved (you have unsent edits)';
  return STATUS[s] || STATUS.waiting;
}

export function initials(name) {
  const words = String(name || '').replace(/,.*$/, '').split(/\s+/).filter((w) => w && !/^(jr|sr|ii|iii|iv|dr)\.?$/i.test(w));
  if (!words.length) return '';
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}

// "Dr. Walls" from "Wade Walls" / "John Gray III".
export function drName(name) {
  const words = String(name || '').replace(/,.*$/, '').split(/\s+/).filter((w) => w && !/^(jr|sr|ii|iii|iv|dr)\.?$/i.test(w));
  return words.length ? `Dr. ${words[words.length - 1]}` : 'the doctor';
}

export const shownDoctors = (list) => (list || []).filter((d) => d && d.show === true);

// A new list with item i moved one place up (dir -1) or down (+1); unchanged at the ends.
export function moveDoctor(list, i, dir) {
  const out = [...(list || [])];
  const j = i + dir;
  if (i < 0 || i >= out.length || j < 0 || j >= out.length) return out;
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

// id for a new doctor from their name: lower-case last name, made unique ("smith", "smith-2").
export function newDoctorId(name, existing = []) {
  const words = String(name || '').toLowerCase().replace(/,.*$/, '').split(/\s+/).filter((w) => w && !/^(jr|sr|ii|iii|iv|dr)\.?$/.test(w));
  const base = (words[words.length - 1] || 'doctor').replace(/[^a-z0-9-]/g, '').slice(0, 30) || 'doctor';
  const taken = new Set((existing || []).map((d) => d && d.id));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

// The owner's fields only: what PUT /admin/doctors/current takes (the server keeps the rest as stored).
export function ownerFields(d) {
  const out = { id: d.id, name: d.name, credentials: d.credentials || '', title: d.title || '', show: d.show === true };
  if (d.email) out.email = d.email;
  if (d.draftBio) out.draftBio = d.draftBio;
  return out;
}

export const answeredCount = (answers) => Object.values(answers || {}).filter((v) => String(v || '').trim()).length;
