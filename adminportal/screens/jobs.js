// Jobs: list with a Show on site switch per job (saves right away); editor in a side (bottom) sheet.
// "We're hiring" and the application form show on the website only while at least one job is on.
// Routes: #jobs, #jobs/new, #jobs/<id> (the sheet's hash, so a sign-in round trip reopens it).
// #jobs/<id>?remind=hiring:<key> (Monday reminder): Still hiring / Take it down above the list.
import { emptyJobForm, jobToForm, formToJob, jobSwitchItem, sortJobs, shownJobs, newId, remindFor, boxBlocks } from '../model.js';
import * as drafts from '../drafts.js';

const inline = (h, parts) => parts.map((p) => (p.bold ? h('b', {}, p.text) : p.text));

// One hiring card, as index.html draws it (.job: h3, .hours, .job-details with lines, "- " bullets, **bold**).
export function jobCard(h, j) {
  const position = String(j.position || '').trim();
  const hours = String(j.hours || '').trim();
  const details = String(j.details || '').trim();
  return h('div', { class: 'job' },
    h('h3', {}, position),
    hours ? h('span', { class: 'hours' }, hours) : null,
    details ? h('div', { class: 'job-details' }, boxBlocks(details).map((x) => (x.type === 'ul'
      ? h('ul', {}, x.items.map((it) => h('li', {}, inline(h, it))))
      : h('p', {}, inline(h, x.parts))))) : null);
}

// The website's hiring section for these (already shown) jobs.
export function hiringPreview(h, jobs) {
  return h('div', { class: 'site-careers' },
    h('h2', {}, 'We’re hiring'),
    h('p', { class: 'sub' }, 'Join a friendly team that’s been caring for this community for decades.'),
    h('div', { class: 'jobs' }, jobs.map((j) => jobCard(h, j))),
    h('span', { class: 'site-btn' }, 'Apply online'));
}

export async function render(root, ctx) {
  const { ui, api, route } = ctx;
  const { h } = ui;
  let state = null;
  let current = null; // the open editor: { close() }
  let remind = null; // reminder answer panel (kept across repaints)
  const pending = new Map(); // job id -> wanted show, while its switch is saving (survives a repaint)

  root.replaceChildren(h('p', { class: 'soft' }, 'Loading…'));

  async function load() {
    state = await api.get('/admin/state');
    paint();
  }
  const jobs = () => state.jobs || [];
  const find = (id) => jobs().find((j) => j.id === id) || null;
  const path = (id) => `/admin/jobs/${encodeURIComponent(id)}`;

  function paint() {
    // Keep keyboard / VoiceOver focus on the switch the user just used (the list is rebuilt).
    const had = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.job : null;
    const list = sortJobs(jobs());
    const shown = shownJobs(jobs());
    root.replaceChildren(
      h('div', { class: 'screen-head' },
        h('h1', {}, 'Jobs'),
        h('button', { type: 'button', class: 'btn', onclick: () => openEditor(null) }, 'New job')),
      ...(remind ? [remind] : []),
      h('p', { class: 'soft screen-intro' }, '“We’re hiring” and the application form show on the website only while at least one job is on.'),
      list.length
        ? h('ul', { class: 'list' }, list.map(row))
        : h('p', { class: 'empty' }, 'No jobs yet. Tap New job when you’re hiring.'),
      ui.previewFrame('jobs', shown.length
        ? hiringPreview(h, shown)
        : h('p', { class: 'preview-empty' }, 'No job is on, so the hiring section and the application form are hidden.')));
    if (had) [...root.querySelectorAll('input[data-job]')].find((x) => x.dataset.job === had)?.focus();
  }

  function row(j) {
    const busy = pending.has(j.id);
    // While saving it stays focusable (aria-disabled, not disabled) so focus isn't dropped; taps are ignored.
    const sw = h('input', { type: 'checkbox', role: 'switch', checked: busy ? pending.get(j.id) : j.show === true, 'aria-disabled': busy ? 'true' : null, 'data-job': j.id, 'aria-label': `Show ${j.position} on the website` });
    sw.addEventListener('change', () => {
      if (pending.has(j.id)) { sw.checked = pending.get(j.id); return; }
      toggle(j.id, sw.checked);
    });
    return h('li', {},
      h('button', { type: 'button', class: 'row-main', onclick: () => openEditor(j) },
        h('span', { class: 'row-title' }, j.position),
        h('span', { class: 'row-meta' }, String(j.hours || '').trim() || 'No hours listed')),
      h('span', { class: 'row-side' }, h('label', { class: 'switch' }, sw, h('span', { 'aria-hidden': 'true' }, 'Show on site'))));
  }

  // The switch saves right away. On failure it flips back (repaint from saved state) and says why.
  async function toggle(id, want) {
    const j = find(id);
    if (!j || pending.has(id)) return;
    pending.set(id, want);
    paint();
    try {
      const res = await api.put(path(id), { item: jobSwitchItem(j, want), version: j.version ?? null });
      pending.delete(id);
      const cur = find(id) || j; // state may have been reloaded meanwhile
      Object.assign(cur, (res && res.item) || { show: want });
      const w = (res && res.warnings) || [];
      ui.toast((want ? `${cur.position} is on the website within a minute.` : `${cur.position} is off the website within a minute.`) + (w.length ? ` Note: ${w.join(' ')}` : ''), { ms: w.length ? 6000 : 3500 });
      paint();
    } catch (err) {
      pending.delete(id);
      if (err && err.name === 'StaleError') {
        ui.toast(`${err.message.replace(/ — reload\?$/, '')}. Showing the latest — try again.`, { ms: 6000 });
        try { await load(); } catch { paint(); }
        return;
      }
      paint();
      const nodes = ui.saveErrorNodes(err);
      if (nodes.length) ui.toast(nodes[0].textContent);
    }
  }

  async function remove(j) {
    if (!(await ui.confirmDialog(`Remove “${j.position}”? It comes off the website and stays in Recently removed for 30 days.`, { ok: 'Remove', danger: true }))) return false;
    try {
      await api.del(path(j.id));
      ui.toast('Job removed. You can restore it from the change log for 30 days.');
      return true;
    } catch (err) {
      const nodes = ui.saveErrorNodes(err);
      if (nodes.length) ui.toast(nodes[0].textContent);
      return false;
    }
  }

  // j: job to edit, or null for new. opts: {values, kept}
  function openEditor(j, opts = {}) {
    if (current) current.close();
    let sheet = null;
    const isNew = !j;
    const id = isNew ? newId() : j.id;
    const key = `#jobs/${isNew ? 'new' : j.id}`;
    const values = opts.values || (j ? jobToForm(j) : emptyJobForm());
    if (opts.values || opts.kept != null) drafts.clear(key); // start from these values, not an old draft

    const position = h('input', { type: 'text', name: 'position', id: 'jobPosition', value: values.position, maxlength: '120', autocomplete: 'off' });
    const hours = h('input', { type: 'text', name: 'hours', id: 'jobHours', value: values.hours, maxlength: '120', autocomplete: 'off' });
    const details = h('textarea', { name: 'details', id: 'jobDetails', rows: '5', maxlength: '2000' }, values.details);
    let stale = false; // after a 409, Save stays off until Reload
    const preview = h('div');
    const box = h('div', { 'aria-live': 'polite' });
    const checking = h('p', { class: 'checking' });
    const save = h('button', { type: 'submit', class: 'btn', disabled: true }, 'Save job');
    const cancel = h('button', { type: 'button', class: 'btn ghost' }, 'Cancel');
    const more = !isNew ? h('div', { class: 'more' },
      h('button', { type: 'button', class: 'btn danger-ghost small', onclick: async () => { if (await remove(j)) { close(); await load(); } } }, 'Remove')) : null;
    const field = (label, forId, input, hint) => h('div', { class: 'field' }, h('label', { for: forId }, label), input, hint ? h('p', { class: 'hint' }, hint) : null);

    const form = h('form', { class: 'sheet-form', novalidate: true },
      h('div', { class: 'sheet-body' },
        ui.previewFrame('jobs', preview, { sticky: true }),
        opts.kept != null ? ui.keptText(opts.kept.text, () => { for (const k of ['position', 'hours', 'details']) form.elements[k].value = opts.kept.values[k]; changed(); }) : null,
        h('input', { type: 'text', name: 'v', value: values.v, hidden: true }),
        field('Position', 'jobPosition', position),
        field('Hours', 'jobHours', hours, 'For example: Full time, Mon–Fri'),
        field('Details', 'jobDetails', details, 'Each line is its own paragraph. Start a line with “- ” (dash, space) for a bullet. Put **two stars** around words to make them bold.'),
        isNew ? h('p', { class: 'hint' }, 'A new job starts off the website. Turn on Show on site in the list when you’re ready.') : null,
        checking, box, more),
      h('footer', { class: 'sheet-foot' }, cancel, save));

    const draft = ui.formDraft(form, key);
    let dirty = draft.restored;
    let touched = !isNew || draft.restored || !!opts.values; // a blank new form shows no errors yet
    const read = () => ui.readForm(form);
    const version = () => { const v = read().v; return v === '' ? null : Number(v); };
    // show is the list switch's job; keep whatever the job has now.
    const build = () => formToJob(read(), { id, show: !isNew && (find(id) || j).show === true });

    function paintForm() {
      const v = read();
      preview.replaceChildren(v.position.trim()
        ? h('div', { class: 'site-careers' }, jobCard(h, v))
        : h('p', { class: 'preview-empty' }, 'Type a position to see the card.'));
    }
    const check = ui.liveCheck(() => {
      const { item, errors } = build();
      if (errors.length) return { errors, warnings: [] };
      return api.put(path(id), { item, version: version() }, { dryRun: true });
    }, (s) => {
      checking.textContent = s.pending ? 'Checking…' : '';
      save.disabled = stale || s.pending || s.errors.length > 0;
      if (stale) return; // keep the "changed this — reload?" notice on screen
      if (s.failed) box.replaceChildren(...ui.saveErrorNodes(s.failed));
      else box.replaceChildren(...ui.issues(touched ? s.errors : [], s.warnings));
    });
    function changed() { dirty = true; touched = true; paintForm(); check.schedule(); }

    form.addEventListener('input', changed);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const { item, errors } = build();
      if (errors.length) { touched = true; box.replaceChildren(...ui.issues(errors)); return; }
      save.disabled = true;
      check.stop();
      checking.textContent = 'Saving…';
      try {
        const res = await api.put(path(id), { item, version: version() });
        close();
        const w = (res && res.warnings) || [];
        const said = isNew ? 'Saved. It’s not on the website yet — turn on Show on site when you’re ready.'
          : item.show ? 'Saved. The website updates within a minute.' : 'Saved.';
        ui.toast(w.length ? `${said} Note: ${w.join(' ')}` : said, { ms: w.length || isNew ? 6000 : 3500 });
        await load();
      } catch (err) {
        checking.textContent = '';
        box.replaceChildren(...ui.saveErrorNodes(err, { onReload: () => reloadKeeping(read()) }));
        box.scrollIntoView?.({ block: 'nearest' });
        stale = !!err && err.name === 'StaleError';
        save.disabled = stale;
      }
    });

    async function reloadKeeping(typed) {
      close();
      await load();
      const kept = { text: [typed.position, typed.hours, typed.details].filter((x) => x.trim()).join('\n'), values: typed };
      const fresh = isNew ? null : find(j.id);
      if (fresh) openEditor(fresh, { kept });
      else openEditor(null, { values: { ...typed, v: '' }, kept });
    }
    function close() { check.stop(); draft.clear(); draft.stop(); sheet.close(); setHash('#jobs'); if (current === me) current = null; }
    const me = { close };
    current = me;
    cancel.addEventListener('click', () => sheet.request());

    sheet = ui.sheet({
      title: isNew ? 'New job' : 'Edit job',
      content: form,
      onClose: async () => {
        if (dirty && !(await ui.confirmDialog('Discard your changes to this job?', { ok: 'Discard', danger: true }))) return false;
        close();
        return true;
      },
      onDispose: () => check.stop(), // also on a route change
    });
    setHash(key);
    if (draft.restored) box.before(h('p', { class: 'hint' }, 'We kept what you were typing.'));
    paintForm();
    if (!isNew || draft.restored || opts.values) check.now();
    else setTimeout(() => position.focus(), 0);
  }

  await load();
  const part = route.parts[0];
  if (part === 'new') openEditor(null);
  else if (part) {
    const j = find(part);
    const key = j ? remindFor(route.query, 'hiring', j.id) : null;
    if (key) {
      remind = ui.reminderPanel({ api, kind: 'hiring', key, question: `Still hiring for ${j.position}?`,
        hint: j.show ? 'It’s on the website now.' : 'It’s already off the website.',
        done: (out) => (out.answer === 'takedown' ? load() : null) });
      paint();
    } else if (j) openEditor(j);
    else { setHash('#jobs'); ui.toast('That job was not found — it may have been removed.'); }
  }
}

function setHash(hash) {
  if (location.hash !== hash) history.replaceState(null, '', hash);
}
