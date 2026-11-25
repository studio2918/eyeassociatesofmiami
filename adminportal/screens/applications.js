// Applications: Current (open + for jobs on the site) or Past applicants (everyone, searchable by name).
// Filters by position and status run over the loaded list. Detail in a side (bottom) sheet.
// Routes: #applications[?view=all], #applications/<id>[?view=all]. Only the id ever goes in the hash.
// PRIVACY: applicant data is shown with textContent only (ui.h), never logged, never put in the page
// URL or localStorage (private notes autosave to the server, not to a local draft). The name search is
// done here, not with ?q=, so names stay out of request URLs.
import {
  APP_STATUSES, sortApplications, filterApplications, applicationPositions, applicationDate,
  telHref, mailtoHref, experienceText, safeResumeUrl, showsTold, noteAuthor, canChangeNote,
  APP_STEPS, APP_OUTCOMES, phoneText, noteWhen,
} from '../model.js';
import { adminNames } from '../config.js';

const NOTE_MAX = 2000;

export async function render(root, ctx) {
  const { ui, api, route } = ctx;
  const myEmail = ctx.me || '';
  const { h } = ui;
  const view = route.query.view === 'all' ? 'all' : 'current';
  const filters = { position: '', status: '', q: '' };
  let items = [];
  let current = null; // the open detail: { id, close(), flush() }
  const path = (id) => `/admin/applications/${encodeURIComponent(id)}`;
  const listHash = view === 'all' ? '#applications?view=all' : '#applications';
  const detailHash = (id) => `#applications/${encodeURIComponent(id)}${view === 'all' ? '?view=all' : ''}`;

  root.replaceChildren(h('p', { class: 'soft' }, 'Loading…'));

  async function load() {
    const r = await api.get(`/admin/applications?view=${view}`);
    items = sortApplications((r && r.items) || []);
    ui.setAppsBadge(r && r.newCount);
    paint();
  }

  const listBox = h('div', { 'aria-live': 'polite' });
  const chipsBox = h('div', { class: 'filters' });
  const filterSummary = h('summary');
  const fold = h('details', { class: 'fold filter-fold' }, filterSummary, chipsBox);

  function paint() {
    const search = view === 'all' ? h('div', { class: 'field' },
      h('label', { for: 'appSearch' }, 'Search by name'),
      h('input', { type: 'search', id: 'appSearch', value: filters.q, autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', enterkeyhint: 'search' })) : null;
    if (search) {
      let timer = null;
      const input = search.querySelector('input');
      input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => { filters.q = input.value; paintList(); }, 200);
      });
    }
    root.replaceChildren(
      h('div', { class: 'screen-head' }, h('h1', {}, 'Applications')),
      h('nav', { class: 'views', 'aria-label': 'Which applications' },
        h('a', { href: '#applications', 'aria-current': view === 'current' ? 'page' : null }, 'Current'),
        h('a', { href: '#applications?view=all', 'aria-current': view === 'all' ? 'page' : null }, 'Past applicants')),
      h('p', { class: 'soft screen-intro' }, view === 'all'
        ? 'Everyone who has ever applied, for any position. Search to start a new opening from the pool.'
        : 'In status order: New first, then Reviewed, Contacted, Interviewed, Keep for later (they stay here even after the job comes down) and Job offered. Not a fit stays at the bottom. Job accepted and Job declined move to Past applicants.'),
      ...[search, fold, listBox].filter(Boolean));
    paintList();
  }

  function chip(label, on, onclick) {
    return h('button', { type: 'button', 'aria-pressed': on ? 'true' : 'false', onclick }, label);
  }

  function paintList() {
    const positions = applicationPositions(items);
    if (filters.position && !positions.includes(filters.position)) filters.position = '';
    const pick = (k, v) => () => { filters[k] = v; paintList(); chipsBox.querySelector(`[data-k="${k}"] [aria-pressed="true"]`)?.focus(); };
    chipsBox.replaceChildren(
      positions.length > 1 ? h('div', { role: 'group', 'aria-label': 'Position', 'data-k': 'position' },
        h('span', { class: 'field-label', 'aria-hidden': 'true' }, 'Position'),
        h('div', { class: 'chips' },
          chip('All', !filters.position, pick('position', '')),
          positions.map((p) => chip(p, filters.position === p, pick('position', p))))) : null,
      items.length ? h('div', { role: 'group', 'aria-label': 'Status', 'data-k': 'status' },
        h('span', { class: 'field-label', 'aria-hidden': 'true' }, 'Status'),
        h('div', { class: 'chips' },
          chip('All', !filters.status, pick('status', '')),
          APP_STATUSES.map((s) => chip(s, filters.status === s, pick('status', s))))) : null);
    fold.hidden = !items.length;
    filterSummary.textContent = 'Filter: ' + [filters.position || 'all positions', filters.status || 'any status'].join(' · ');
    const shown = filterApplications(items, filters);
    listBox.replaceChildren(!items.length
      ? h('p', { class: 'empty' }, view === 'all' ? 'No applications yet.' : 'No current applications. Past applicants shows everyone who has applied.')
      : shown.length ? h('ul', { class: 'list' }, shown.map(row))
        : h('p', { class: 'empty' }, 'No applications match.'));
  }

  function row(a) {
    const isNew = a.status === 'New';
    return h('li', { class: a.status === 'Not a fit' ? 'done' : null },
      h('button', { type: 'button', class: 'row-main', onclick: () => openDetail(a.id) },
        h('span', { class: 'row-title' }, a.name || 'No name', isNew ? h('span', { class: 'pill new' }, 'New') : null),
        h('span', { class: 'row-meta' }, a.position ? a.position + ' · ' : '',
          h('span', { class: 'status-text' }, applicationDate(a.createdAt)),
          isNew ? null : h('span', { class: 'status-text' }, ' · ' + a.status))));
  }

  // ---- detail ----

  async function openDetail(id, { quiet = false } = {}) {
    if (current) current.close();
    let a;
    try { a = await api.get(path(id)); } catch (err) {
      if (err && err.name === 'ApiError' && err.status === 404) {
        setHash(listHash);
        if (!quiet) ui.toast('That application was not found — it may have been removed.');
        return;
      }
      const nodes = ui.saveErrorNodes(err);
      if (nodes.length) ui.toast(nodes[0].textContent);
      return;
    }
    showDetail(a);
  }

  function showDetail(app) {
    let a = app;
    let sheet = null;
    let chain = Promise.resolve(); // saves run one at a time (each needs the version the last one returned)
    const savedNotes = '';   // the "Add a note" box: anything typed there is not saved until "Add note"
    let timer = null;
    let stale = false;
    const box = h('div', { 'aria-live': 'polite' });
    const savedState = h('p', { class: 'saved-state', 'aria-live': 'polite' });
    const notes = h('textarea', { id: 'appNotes', rows: '3', maxlength: String(NOTE_MAX), autocomplete: 'off', placeholder: 'Add a note…', 'aria-describedby': 'appNotesHint' });
    // Status: a progress line (how far they got: New → Reviewed → Contacted → Interviewed), then two rows of
    // buttons, Steps and Outcome (one choice across both).
    const radio = (s) => h('label', {}, h('input', { type: 'radio', name: 'appStatus', value: s, checked: s === a.status }), s);
    const nowPill = h('span', { class: 'pill status-now' });
    const progress = h('ol', { class: 'progress', 'aria-label': 'How far they got' });
    const statusSeg = h('fieldset', { class: 'field status-field' },
      h('legend', {}, 'Status ', nowPill),
      progress,
      h('div', { class: 'status-row' }, h('span', { class: 'status-lab' }, 'Steps'), h('div', { class: 'seg' }, APP_STEPS.map(radio))),
      h('div', { class: 'status-row' }, h('span', { class: 'status-lab' }, 'Outcome'), h('div', { class: 'seg' }, APP_OUTCOMES.map(radio))));
    function paintProgress() {
      nowPill.textContent = a.status;
      const reached = typeof a.reached === 'number' ? a.reached : 0;
      progress.replaceChildren(...APP_STEPS.map((s, i) => {
        const b = h('button', { type: 'button', class: i < reached ? 'done' : i === reached ? 'done now' : '', 'aria-label': `Set status: ${s}` }, s);
        b.addEventListener('click', () => { const r = statusSeg.querySelector(`input[value="${CSS.escape(s)}"]`); if (r && !r.checked) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); } });
        return h('li', { class: i < reached ? 'line' : null }, b);
      }));
    }
    const statusMsg = h('p', { class: 'saved-state', 'aria-live': 'polite' });
    // pay offered ($ per hour) and "We let them know"
    // two pay offers (dollars per hour): the first offer and a second one (a counter or a raise)
    function payBox(field, label) {
      const input = h('input', { type: 'number', id: `app_${field}`, min: '0.01', max: '500', step: '0.01', inputmode: 'decimal', placeholder: '17.50', 'aria-label': `${label}, dollars per hour` });
      const msg = h('p', { class: 'saved-state', 'aria-live': 'polite' });
      const row = h('div', { class: 'pay-row' }, h('span', { class: 'pay-lab' }, label), h('label', { class: 'money' }, h('span', {}, '$'), input, h('span', {}, '/hr')), msg);
      input.addEventListener('change', () => {
        const raw = input.value.trim(), v = raw === '' ? null : Number(raw);
        if (v !== null && !(v > 0 && v <= 500)) { msg.textContent = 'Enter dollars per hour, like 17.50.'; return; }
        msg.textContent = 'Saving…';
        save({ [field]: v }).then((ok) => { if (ok) msg.textContent = 'Saved.'; });
      });
      const paint = () => { if (document.activeElement !== input) input.value = a[field] != null ? a[field].toFixed(2) : ''; };
      return { row, paint };
    }
    const pay1 = payBox('pay', 'First offer'), pay2 = payBox('pay2', 'Second offer');
    const payField = h('div', { class: 'field pay-field' }, h('p', { class: 'group-lab' }, 'Pay offered'), pay1.row, pay2.row);
    const told = h('input', { type: 'checkbox', checked: a.told === true });
    const toldField = h('label', { class: 'check told-field' }, told, 'We let them know');
    const noteList = h('ul', { class: 'note-list' });
    const addBtn = h('button', { type: 'button', class: 'btn small' }, 'Add');
    const resumeMsg = h('div', { 'aria-live': 'polite' });
    const resumeBtn = h('button', { type: 'button', class: 'btn ghost wide' }, 'View résumé');
    const tel = telHref(a.phone), mail = mailtoHref(a.email);
    let notesField = null;
    const answer = (q, v) => [h('dt', {}, q), v && String(v).trim() ? h('dd', {}, String(v)) : h('dd', { class: 'none' }, 'Not answered')];

    const body = h('div', { class: 'sheet-body applicant' },
      h('h3', {}, a.name || 'No name'),
      h('p', { class: 'soft', style: 'margin:0' }, [a.position, a.createdAt ? 'applied ' + applicationDate(a.createdAt) : ''].filter(Boolean).join(' · ')),
      h('div', { class: 'contact' },
        h('div', { class: 'contact-two' },
          tel ? h('a', { class: 'btn ghost', href: tel }, 'Call ', phoneText(a.phone)) : h('p', {}, a.phone || ''),
          mail ? h('a', { class: 'btn ghost', href: mail, title: a.email }, 'Email') : h('p', {}, a.email || '')),
        resumeBtn, resumeMsg),
      statusSeg, statusMsg, toldField, payField,
      notesField = h('div', { class: 'field' },
        h('p', { class: 'group-lab' }, 'Notes'),
        h('p', { class: 'hint', id: 'appNotesHint' }, 'Private: only signed-in doctors see these. Everyone’s notes show; you can change only your own.'),
        h('div', { class: 'note-add' }, notes, addBtn), savedState,
        noteList),
      h('details', { class: 'answers' }, h('summary', {}, 'Their answers'),
        h('dl', {},
          answer('Position', a.position),
          answer('When could you start?', a.start),
          answer('Eye-care or medical office experience?', a.experience ? experienceText(a.experience) : ''),
          a.experience === 'yes' || (a.experienceDetail && a.experienceDetail.trim()) ? answer('Tell us about it', a.experienceDetail) : null,
          answer('What hours / days can you work?', a.availability),
          answer('Anything you’d like us to know?', a.message))),
      box,
      h('div', { class: 'more' },
        h('button', { type: 'button', class: 'btn danger-ghost small', onclick: remove }, 'Delete')));
    const closeBtn = h('button', { type: 'button', class: 'btn ghost', onclick: () => sheet.request() }, 'Close');
    const content = h('div', { class: 'sheet-form' }, body, h('footer', { class: 'sheet-foot' }, closeBtn));

    function showError(err) {
      if (err && err.name === 'StaleError') {
        stale = true;
        const typed = notes.value;
        box.replaceChildren(ui.staleNotice(err.message, async () => {
          close();
          await reloadList();
          try { const fresh = await api.get(path(a.id)); showDetail(fresh); } catch { /* list shows it */ }
          if (typed !== savedNotes && current) current.kept(typed);
        }));
        savedState.textContent = 'Not saved.';
        return;
      }
      savedState.textContent = 'Not saved.';
      box.replaceChildren(...ui.saveErrorNodes(err));
    }

    // Resolves true when saved, false when not (the error is already on screen).
    function save(patch, { after } = {}) {
      const run = chain.then(async () => {
        if (stale) return false;
        try {
          const res = await api.patch(path(a.id), { ...patch, version: a.version });
          a = { ...a, ...res };
          paintExtras();
          box.replaceChildren();
          if (after) await after();
          return true;
        } catch (err) {
          showError(err);
          return false;
        }
      });
      chain = run;
      return run;
    }

    // ---- notes by person (newest first), the pay box and the "We let them know" box ----
    function paintNotes() {
      const list = a.noteList || [];
      noteList.replaceChildren(...(!list.length ? [h('li', { class: 'soft' }, 'No notes yet.')] : list.map((n) => {
        const text = h('p', { class: 'note-text' }, n.text);
        const li = h('li', { class: 'note' },
          h('p', { class: 'note-by' }, noteAuthor(n, adminNames), n.at && n.id !== 'earlier' ? ' · ' + noteWhen(n.at) : ''), text);
        if (canChangeNote(n, myEmail)) {
          const edit = h('button', { type: 'button', class: 'btn ghost small' }, 'Edit');
          const del = h('button', { type: 'button', class: 'btn danger-ghost small' }, 'Delete');
          edit.addEventListener('click', () => {
            const ta = h('textarea', { rows: '3', maxlength: String(NOTE_MAX) }, n.text);
            const ok = h('button', { type: 'button', class: 'btn small' }, 'Save');
            const no = h('button', { type: 'button', class: 'btn ghost small' }, 'Cancel');
            no.addEventListener('click', paintNotes);
            ok.addEventListener('click', () => {
              if (!ta.value.trim()) return;
              ok.disabled = true;
              save({ editNote: { id: n.id, text: ta.value } }).then((done) => { if (!done) ok.disabled = false; });
            });
            li.replaceChildren(li.firstChild, ta, h('div', { class: 'note-actions' }, ok, no));
            ta.focus();
          });
          del.addEventListener('click', async () => {
            if (!(await ui.confirmDialog('Delete this note?', { ok: 'Delete', danger: true }))) return;
            save({ deleteNote: { id: n.id } });
          });
          li.appendChild(h('div', { class: 'note-actions' }, edit, del));
        }
        return li;
      })));
    }
    function paintExtras() {
      paintNotes();
      paintProgress();
      toldField.hidden = !showsTold(a.status);
      told.checked = a.told === true;
      pay1.paint(); pay2.paint();
    }
    function addNote() {
      const v = notes.value.trim();
      if (stale || !v) return chain;
      addBtn.disabled = true;
      savedState.textContent = 'Saving…';
      return save({ addNote: { text: v } }, {
        after: () => { notes.value = ''; savedState.textContent = 'Added.'; },
      }).then((ok) => { addBtn.disabled = false; if (!ok) savedState.textContent = 'Not saved.'; return ok; });
    }
    function saveNotes() { return chain; }   // notes save only with "Add note" (nothing typed is sent on its own)
    addBtn.addEventListener('click', addNote);
    notes.addEventListener('input', () => { savedState.textContent = ''; });
    told.addEventListener('change', () => { save({ told: told.checked }); });
    paintExtras();

    // pendingStatus = the last status asked for (taps can come faster than saves). When the last
    // requested save settles, the buttons show what the server has (a.status), so they never drift.
    let pendingStatus = a.status;
    let statusSeq = 0;
    const showStatus = () => {
      const r = statusSeg.querySelector(`input[value="${CSS.escape(a.status)}"]`);
      if (r) r.checked = true;
    };
    statusSeg.addEventListener('change', (e) => {
      const want = e.target.value;
      if (stale) { showStatus(); return; }
      if (want === pendingStatus) return;
      pendingStatus = want;
      const mine = ++statusSeq;
      statusMsg.textContent = 'Saving…';
      save({ status: want }).then(async (ok) => {
        if (mine !== statusSeq) return; // a newer tap is queued; it reports and syncs
        pendingStatus = a.status;
        showStatus();
        if (!ok) { statusMsg.textContent = ''; return; }
        // A toast would sit under the open sheet, so say it here.
        statusMsg.textContent = a.status === 'Not a fit' ? 'Saved: Not a fit. It moves to the bottom of the list.' : `Saved: ${a.status}.`;
        await reloadList();
      });
    });

    resumeBtn.addEventListener('click', async () => {
      resumeMsg.replaceChildren();
      // Open the window inside the tap (popup blockers allow it), then point it at the private link.
      let w = null;
      try { w = window.open('', '_blank'); } catch { w = null; }
      try { if (w) { w.opener = null; w.document.title = 'Résumé'; w.document.body.textContent = 'Opening the résumé…'; } } catch { /* cross-origin or blocked */ }
      resumeBtn.disabled = true;
      try {
        const r = await api.get(path(a.id) + '/resume');
        const url = safeResumeUrl(r && r.url);
        if (!url) throw new Error('Could not open the résumé. Please try again.');
        if (w && !w.closed) w.location.href = url;
        else { // iOS home-screen app: window.open is blocked, so open it here — after the notes are saved
          await saveNotes();
          location.href = url;
        }
      } catch (err) {
        try { if (w) w.close(); } catch { /* ignore */ }
        if (err && err.status === 404 && err.body && err.body.error === 'resume gone') {
          resumeMsg.replaceChildren(h('p', { class: 'error', role: 'alert' }, 'The résumé file is no longer available. Ask the applicant to send it again.'));
        } else {
          const nodes = ui.saveErrorNodes(err);
          resumeMsg.replaceChildren(...(nodes.length ? nodes : []));
        }
      } finally { resumeBtn.disabled = false; }
    });

    async function remove() {
      await saveNotes();
      if (!(await ui.confirmDialog('Delete this application? It moves to Recently removed (in the Change log) for 30 days, then it’s deleted for good with the résumé.', { ok: 'Delete', danger: true }))) return;
      try {
        await api.del(path(a.id));
        close();
        ui.toast('Moved to Recently removed for 30 days.');
        await reloadList();
      } catch (err) { showError(err); }
    }

    function close() {
      clearTimeout(timer);
      if (sheet) sheet.close();
      setHash(listHash);
      if (current === me) current = null;
    }
    const me = {
      id: a.id, close,
      kept(text) { notesField.after(ui.keptText(text, () => { notes.value = text; notes.dispatchEvent(new Event('input')); })); },
    };
    current = me;
    sheet = ui.sheet({
      title: 'Application',
      content,
      onClose: async () => {
        await saveNotes();
        if (notes.value.trim() && !(await ui.confirmDialog('You typed a note but didn’t tap Add note. Close anyway and lose it?', { ok: 'Close', danger: true }))) return false;
        close();
        return true;
      },
      onDispose: () => { clearTimeout(timer); if (!stale && notes.value.trim()) addNote(); }, // route change: keep the notes
    });
    setHash(detailHash(a.id));
  }

  async function reloadList() {
    try { await load(); } catch (err) {
      const nodes = ui.saveErrorNodes(err);
      if (nodes.length) ui.toast(nodes[0].textContent);
    }
  }

  try { await load(); } catch (err) {
    if (err && err.name === 'ForbiddenError') {
      ui.setAppsBadge(0);
      root.replaceChildren(h('h1', {}, 'Applications'), h('p', { class: 'error', role: 'alert' }, "You don't have access to this."));
      return;
    }
    throw err;
  }
  const part = route.parts[0];
  if (part) openDetail(part);
}

function setHash(hash) {
  if (location.hash !== hash) history.replaceState(null, '', hash);
}
