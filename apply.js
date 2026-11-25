/*
  Online job application (the "We're hiring" section of the homepage).

  Shown only while at least one job is on (EAOMHours.ready -> jobs) and site-content.json has "apiUrl".
  Sending, in three steps:
    1. POST <apiUrl>/apply/upload-url {fileName, size}  -> {url, fields, fileKey}  (one-time S3 link, 5 min)
    2. POST the résumé straight to S3: every entry of `fields` first, then `file` LAST (no Content-Type field)
    3. POST <apiUrl>/apply with the answers + fileKey   -> {firstName}, 400 {fields}, or 429 {error} (already applied today;
       a 429 without `error` is API Gateway throttling: "try again in a minute")
  What people typed is never cleared on an error. Server and applicant text is only set with textContent.
*/

export const MAX_BYTES = 5_242_880;
const OK_EXT = /\.(pdf|doc|docx)$/i;
const REQUIRED = ['position', 'name', 'phone', 'email'];
const OPTIONAL = ['start', 'experience', 'experienceDetail', 'availability', 'message'];
const ORDER = ['position', 'name', 'phone', 'email', 'start', 'experience', 'experienceDetail', 'availability', 'message', 'resume'];

export const MESSAGES = {
  position: 'Please choose a position.',
  name: 'Please enter your full name.',
  phone: 'Please enter a phone number with area code.',
  email: 'Please enter a valid email address.',
  experience: 'Please choose Yes or No.',
  tooLong: 'Please shorten this answer.',
  resume: 'Please upload a PDF or Word file (up to 5 MB).',
  resumeMissing: 'Please attach your résumé (PDF or Word file, up to 5 MB).',
  resumeBig: 'That file is over 5 MB. Please upload a PDF or Word file (up to 5 MB).',
  duplicate: 'It looks like you already applied for this position today. We have your application.',
  throttled: 'We couldn\'t send your application just now. Please wait a minute and try again.',
  network: 'We couldn\'t reach our server. Please check your connection and try again. What you typed is still here.',
  upload: 'Your résumé didn\'t upload. Please try again, or choose a different file.',
  generic: 'Sorry, something went wrong sending your application. Please try again, or call (918) 540-1929.',
};

/** Error text for a résumé file, or null when it is fine. */
export function checkFile(file) {
  if (!file || !file.name) return MESSAGES.resumeMissing;
  if (!OK_EXT.test(file.name)) return MESSAGES.resume;
  if (!(file.size > 0)) return MESSAGES.resume;
  if (file.size > MAX_BYTES) return MESSAGES.resumeBig;
  return null;
}

function val(form, name) {
  const e = form.elements[name];
  return e && typeof e.value === 'string' ? e.value.trim() : '';
}

/** The JSON body for POST /apply. Blank optional answers are left out. */
export function buildPayload(form, fileKey) {
  const p = {};
  for (const f of REQUIRED) p[f] = val(form, f);
  for (const f of OPTIONAL) { const v = val(form, f); if (v) p[f] = v; }
  p.fileKey = fileKey;
  p._gotcha = (form.elements._gotcha && form.elements._gotcha.value) || '';
  return p;
}

function resumeFile(form) {
  const e = form.elements.resume;
  return (e && e.files && e.files[0]) || null;
}

// Client-side checks (the API checks everything again). {field: message}
function validate(form) {
  const errs = {};
  if (!val(form, 'position')) errs.position = MESSAGES.position;
  if (!val(form, 'name')) errs.name = MESSAGES.name;
  if ((val(form, 'phone').match(/\d/g) || []).length < 10) errs.phone = MESSAGES.phone;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val(form, 'email'))) errs.email = MESSAGES.email;
  const bad = checkFile(resumeFile(form));
  if (bad) errs.resume = bad;
  return errs;
}

function serverErrors(fields) {
  const errs = {};
  for (const f of ORDER) if (fields.includes(f)) errs[f] = MESSAGES[f] || MESSAGES.tooLong;
  return errs;
}

async function readJson(r) { try { return await r.json(); } catch { return null; } }

// File -> fileKey already uploaded from this page, so a retry after a typo doesn't upload again.
const uploaded = new WeakMap();

class Stop { constructor(kind, detail, tone = 'err') { this.kind = kind; this.detail = detail; this.tone = tone; } }

async function upload(api, file, fetch) {
  if (uploaded.has(file)) return uploaded.get(file);
  const r = await fetch(api + '/apply/upload-url', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, size: file.size }),
  });
  if (r.status === 400) throw new Stop('fields', { resume: MESSAGES.resume });
  if (r.status === 429) throw new Stop('message', MESSAGES.throttled);
  if (!r.ok) throw new Stop('message', MESSAGES.generic);
  const link = await readJson(r);
  if (!link || !link.url || !link.fields || !link.fileKey) throw new Stop('message', MESSAGES.generic);
  const fd = new FormData();
  for (const [k, v] of Object.entries(link.fields)) fd.append(k, v);
  fd.append('file', file);                       // must be the last field
  const s3 = await fetch(link.url, { method: 'POST', body: fd });
  if (!s3.ok) throw new Stop('message', MESSAGES.upload);
  uploaded.set(file, link.fileKey);
  return link.fileKey;
}

/**
 * Check, upload and send one application.
 * ui: { busy(text|null), fieldErrors({field: message}), message(text, tone: 'err'|'ok'), done(firstName) }
 */
export async function submitForm(form, { apiUrl, fetch = globalThis.fetch, ui }) {
  const errs = validate(form);
  if (Object.keys(errs).length) { ui.fieldErrors(errs); return; }
  const api = String(apiUrl || '').replace(/\/+$/, '');
  const file = resumeFile(form);
  try {
    ui.busy('Uploading…');
    const fileKey = await upload(api, file, fetch);
    ui.busy('Sending…');
    const r = await fetch(api + '/apply', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(form, fileKey)),
    });
    const body = await readJson(r);
    if (r.ok) { ui.busy(null); ui.done(String((body && body.firstName) || '')); return; }
    if (r.status === 429) {
      // Our duplicate answer carries `error`; API Gateway throttling sends {message: 'Too Many Requests'}
      if (body && body.error) throw new Stop('message', MESSAGES.duplicate, 'ok');
      throw new Stop('message', MESSAGES.throttled);
    }
    if (r.status === 400 && body && Array.isArray(body.fields) && body.fields.length) {
      if (body.fields.includes('resume')) uploaded.delete(file);
      throw new Stop('fields', serverErrors(body.fields));
    }
    throw new Stop('message', MESSAGES.generic);
  } catch (e) {
    ui.busy(null);
    if (e instanceof Stop && e.kind === 'fields') ui.fieldErrors(e.detail);
    else if (e instanceof Stop) ui.message(e.detail, e.tone);
    else ui.message(MESSAGES.network, 'err');
  }
}

// ---- page wiring (browser only) ----

const THANKS_1 = ' Our team will review your info, and we\'ll reach out if we\'d like to set up an interview.';
const THANKS_2 = 'Even if we don\'t call right away, we keep every application on file. We may not have the right position open for you today, but we often look back at past applicants when a new spot opens up.';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

// apply.html?job=<id>: which job the form starts on (the one the person clicked "Apply now" on).
// -> that job's position, or the only open position, or '' (they choose).
export function pickPosition(jobs, search) {
  const open = (jobs || []).filter((j) => j && typeof j.position === 'string' && j.position.trim());
  const id = new URLSearchParams(String(search || '')).get('job');
  const hit = id && open.find((j) => j.id === id);
  if (hit) return hit.position;
  const names = [...new Set(open.map((j) => j.position))];
  return names.length === 1 ? names[0] : '';
}

export function setupApplyForm(info) {
  const box = document.getElementById('apply-box');
  const form = document.getElementById('apply-form');
  if (!box || !form) return;
  const cfg = (info && info.cfg) || {};
  const positions = [...new Set(((info && info.jobs) || [])
    .filter((j) => j && typeof j.position === 'string' && j.position.trim())
    .map((j) => j.position))];
  if (!positions.length || !cfg.apiUrl) { box.hidden = true; return; }

  const sel = form.elements.position;
  sel.textContent = '';
  if (positions.length > 1) sel.appendChild(new Option('Choose a position', ''));
  positions.forEach((p) => sel.appendChild(new Option(p, p)));
  sel.value = pickPosition(info && info.jobs, typeof location !== 'undefined' ? location.search : '');
  // Application page: "Applying for: <job>" and a link back to that job (careers.html#job-<id>)
  const forEl = document.getElementById('apply-for');
  if (forEl) {
    const show = () => { forEl.textContent = sel.value || 'Choose a position below'; };
    show();
    sel.addEventListener('change', show);
    const job = ((info && info.jobs) || []).find((j) => j && j.position === sel.value);
    const back = document.getElementById('apply-back');
    if (back && job && job.id) back.href = 'careers.html#job-' + encodeURIComponent(job.id);
  }

  const btn = document.getElementById('apply-submit');
  const msg = document.getElementById('apply-msg');
  const label = btn.textContent;

  const SUMMARY = 'Please check the highlighted answers.';
  function say(text, tone) { msg.textContent = text; msg.className = 'form-msg ' + (tone || 'err'); }
  function clear() {
    say('');
    form.querySelectorAll('.field-err').forEach((p) => { p.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));
  }
  const ui = {
    busy(text) {
      btn.disabled = !!text;
      btn.textContent = text || label;
      form.setAttribute('aria-busy', text ? 'true' : 'false');
    },
    fieldErrors(errs) {
      let first = null;
      for (const f of ORDER) {
        if (!errs[f]) continue;
        const p = document.getElementById('apply-' + f + '-err');
        const input = form.querySelector('[data-field="' + f + '"]');
        if (p) p.textContent = errs[f];
        if (input) { input.setAttribute('aria-invalid', 'true'); if (!first) first = input; }
      }
      say(SUMMARY, 'err');
      if (first) first.focus();
    },
    message(text, tone) { say(text, tone); },
    done(firstName) {
      const done = el('div', 'apply-done');
      done.setAttribute('role', 'status');
      done.tabIndex = -1;
      const p1 = el('p');
      p1.appendChild(el('strong', '', firstName ? 'Thank you so much for applying, ' + firstName + '!' : 'Thank you so much for applying!'));
      p1.appendChild(document.createTextNode(THANKS_1));
      done.appendChild(p1);
      done.appendChild(el('p', '', THANKS_2));
      box.replaceWith(done);
      done.focus();
    },
  };

  // Fixing an answer clears its error; once none are left, the "check the highlighted answers" summary goes too.
  function fixed(input) {
    const name = input && input.name;
    if (!name) return;
    const field = (input.dataset && input.dataset.field) || name;   // the "No" radio has no data-field
    const p = document.getElementById('apply-' + field + '-err');
    let bad = null;
    if (name === 'resume') bad = input.files[0] ? checkFile(input.files[0]) : null;
    if (p) p.textContent = bad || '';
    const marked = form.querySelector('[data-field="' + field + '"]');
    if (marked) { if (bad) marked.setAttribute('aria-invalid', 'true'); else marked.removeAttribute('aria-invalid'); }
    const left = [...form.querySelectorAll('.field-err')].some((e) => e.textContent);
    if (!left && msg.textContent === SUMMARY) say('');
  }
  form.addEventListener('input', (e) => fixed(e.target));
  form.addEventListener('change', (e) => fixed(e.target));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (btn.disabled) return;
    clear();
    submitForm(form, { apiUrl: cfg.apiUrl, ui });
  });
  box.hidden = false;
}

if (typeof window !== 'undefined' && window.EAOMHours) window.EAOMHours.ready.then(setupApplyForm);
