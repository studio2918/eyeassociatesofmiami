// Doctors (owner): the "Meet the doctors" list. Order (up/down), Show on site switch (retired doctors stay,
// switched off), and per doctor: name, title, their portal login, their profile answers, the bio draft and
// Send for approval. The live bio only changes when that doctor approves it (server-enforced).
// Routes: #doctors, #doctors/new, #doctors/<id>.
import { statusText, initials, drName, shownDoctors, moveDoctor, newDoctorId, ownerFields, QUESTION_SECTIONS, answeredCount, BIO_MAX } from '../doctors-model.js';

// One "Meet the doctors" card as the website draws it (index.html .tile.doc).
export function doctorCard(h, d, bio) {
  const name = `${String(d.name || '').trim()}${d.credentials ? ', ' + d.credentials : ''}`;
  return h('div', { class: 'tile doc' },
    h('div', { class: 'initials' }, initials(d.name)),
    h('h3', {}, name),
    h('p', {}, d.title || 'Optometrist'),
    bio ? h('p', { class: 'doc-bio' }, bio) : null);
}

export async function render(root, ctx) {
  const { ui, api, route } = ctx;
  const { h } = ui;
  let item = null; // { doctors: [...], version }
  let busy = false;

  root.replaceChildren(h('p', { class: 'soft' }, 'Loading…'));

  async function load() {
    const state = await api.get('/admin/state');
    item = state.doctors || { doctors: [], version: 0 };
    paint();
  }
  const list = () => item.doctors || [];
  const find = (id) => list().find((d) => d.id === id) || null;

  async function saveList(docs, msg) {
    if (busy) return false;
    busy = true;
    try {
      const res = await api.put('/admin/doctors/current', { item: { doctors: docs.map(ownerFields) }, version: item.version ?? 0 });
      item = res.item;
      const w = (res && res.warnings) || [];
      if (msg) ui.toast(w.length ? `${msg} Note: ${w.join(' ')}` : msg, { ms: w.length ? 6000 : 3500 });
      return true;
    } catch (err) {
      if (err && err.name === 'StaleError') {
        ui.toast('Someone else just changed the doctors list. Showing the latest; try again.', { ms: 6000 });
        await load();
        return false;
      }
      const nodes = ui.saveErrorNodes(err);
      if (nodes.length) ui.toast(nodes[0].textContent, { ms: 6000 });
      return false;
    } finally {
      busy = false;
      paint();
    }
  }

  function paint() {
    const docs = list();
    root.replaceChildren(
      h('div', { class: 'screen-head' },
        h('h1', {}, 'Doctors'),
        h('button', { type: 'button', class: 'btn', onclick: () => openEditor(null) }, 'Add doctor')),
      h('p', { class: 'soft screen-intro' }, 'The order here is the order on the website. To retire a doctor, turn off Show on site: they stay here, off the website. A bio goes live only after that doctor approves it.'),
      docs.length ? h('ul', { class: 'list' }, docs.map(row)) : h('p', { class: 'empty' }, 'No doctors yet.'),
      ui.previewFrame('doctors', shownDoctors(docs).length
        ? h('div', { class: 'site-docs' }, shownDoctors(docs).map((d) => doctorCard(h, d, d.bio)))
        : h('p', { class: 'preview-empty' }, 'No doctor is on, so Meet the doctors is hidden.')));
  }

  function row(d, i) {
    const docs = list();
    const sw = h('input', { type: 'checkbox', role: 'switch', checked: d.show === true, 'aria-label': `Show ${d.name} on the website` });
    sw.addEventListener('change', () => {
      const next = docs.map((x) => (x.id === d.id ? { ...x, show: sw.checked } : x));
      saveList(next, sw.checked ? `${d.name} is on the website within a minute.` : `${d.name} is off the website within a minute.`);
    });
    const move = (dir, label) => h('button', { type: 'button', class: 'btn ghost small', 'aria-label': `Move ${d.name} ${label}`,
      disabled: (dir < 0 ? i === 0 : i === docs.length - 1) || null,
      onclick: () => saveList(moveDoctor(docs, i, dir), 'Order saved. The website updates within a minute.') }, dir < 0 ? '↑' : '↓');
    return h('li', {},
      h('button', { type: 'button', class: 'row-main', onclick: () => openEditor(d) },
        h('span', { class: 'row-title' }, `${d.name}${d.credentials ? ', ' + d.credentials : ''}`),
        h('span', { class: 'row-meta' }, `${statusText(d)}${d.email ? '' : ' · no login linked'}`)),
      h('span', { class: 'row-side' }, move(-1, 'up'), move(1, 'down'),
        h('label', { class: 'switch' }, sw, h('span', { 'aria-hidden': 'true' }, 'Show on site'))));
  }

  function answersBlock(d) {
    const a = d.answers || {};
    if (!answeredCount(a)) return h('p', { class: 'hint' }, d.email ? 'No answers yet. They fill in My profile after signing in.' : 'Link their portal login so they can fill in their profile.');
    return h('details', { class: 'answers' },
      h('summary', {}, `Their answers (${answeredCount(a)})`),
      QUESTION_SECTIONS.map((s) => {
        const qs = s.questions.filter((q) => String(a[q.key] || '').trim());
        return qs.length ? h('div', {}, h('h4', {}, s.title),
          h('dl', {}, qs.map((q) => [h('dt', {}, q.label), h('dd', {}, a[q.key])]))) : null;
      }));
  }

  function openEditor(d) {
    const isNew = !d;
    const id = isNew ? null : d.id;
    const field = (label, input, hint) => h('div', { class: 'field' }, h('label', {}, label, input), hint ? h('p', { class: 'hint' }, hint) : null);
    const name = h('input', { type: 'text', name: 'name', value: isNew ? '' : d.name, maxlength: '80', autocomplete: 'off' });
    const cred = h('input', { type: 'text', name: 'credentials', value: isNew ? 'O.D.' : (d.credentials || ''), maxlength: '20', autocomplete: 'off' });
    const title = h('input', { type: 'text', name: 'title', value: isNew ? 'Optometrist' : (d.title || ''), maxlength: '60', autocomplete: 'off' });
    const email = h('input', { type: 'email', name: 'email', value: isNew ? '' : (d.email || ''), maxlength: '254', autocomplete: 'off' });
    const bio = h('textarea', { name: 'draftBio', rows: '7', maxlength: String(BIO_MAX) }, isNew ? '' : (d.draftBio || d.bio || ''));
    const count = h('p', { class: 'hint' });
    const preview = h('div');
    const box = h('div', { 'aria-live': 'polite' });
    const save = h('button', { type: 'submit', class: 'btn' }, 'Save');
    const send = isNew ? null : h('button', { type: 'button', class: 'btn ghost' }, `Send to ${drName(d.name)} for approval`);
    const status = isNew ? null : h('div', { class: 'doc-status' },
      h('p', {}, h('b', {}, 'Bio: '), statusText(d)),
      d.status === 'changes' && d.note ? h('p', { class: 'stale' }, `Their note: ${d.note}`) : null,
      d.status === 'sent' ? h('p', { class: 'hint' }, 'They’ll see it under My profile and get a notification if they turned on Doctor bios.') : null,
      d.bio ? h('p', { class: 'hint' }, 'Live on the website now: ', h('i', {}, d.bio)) : null);
    let dirty = false;

    const read = () => ({
      id: id || newDoctorId(name.value, list()), name: name.value.trim(), credentials: cred.value.trim(), title: title.value.trim(),
      email: email.value.trim().toLowerCase(), draftBio: bio.value.trim(), show: isNew ? false : d.show === true,
    });
    function paintForm() {
      const v = read();
      count.textContent = `${bio.value.length} / ${BIO_MAX} characters. About 80–120 words reads best.`;
      preview.replaceChildren(v.name ? h('div', { class: 'site-docs' }, doctorCard(h, v, v.draftBio)) : h('p', { class: 'preview-empty' }, 'Type a name to see the card.'));
    }

    const form = h('form', { class: 'sheet-form', novalidate: true },
      h('div', { class: 'sheet-body' },
        ui.previewFrame('doctors', preview, { sticky: true }),
        status,
        field('Name', name, 'As it shows on the website, e.g. Wade Walls'),
        field('Credentials', cred),
        field('Title', title),
        field('Portal login (email)', email, 'The email they sign in to this admin with. Add them on the People screen first (role: Doctor).'),
        isNew ? null : answersBlock(d),
        field('Bio (draft)', bio, 'Only you see the draft. It goes on the website after they approve it.'),
        count,
        isNew ? h('p', { class: 'hint' }, 'A new doctor starts off the website. Turn on Show on site when you’re ready.') : null,
        box),
      h('footer', { class: 'sheet-foot' }, send, save));

    async function doSave() {
      const v = read();
      if (!v.name) { box.replaceChildren(...ui.issues(['Name is required'])); return false; }
      const docs = isNew ? [...list(), { ...v, status: 'waiting' }] : list().map((x) => (x.id === id ? { ...x, ...v } : x));
      const ok = await saveList(docs, null);
      if (ok) dirty = false;
      return ok;
    }
    form.addEventListener('input', () => { dirty = true; paintForm(); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      save.disabled = true;
      if (await doSave()) { done(); ui.toast(isNew ? 'Doctor added. Turn on Show on site when you’re ready.' : 'Saved.'); }
      save.disabled = false;
    });
    if (send) send.addEventListener('click', async () => {
      if (!bio.value.trim()) { box.replaceChildren(...ui.issues(['Write the bio before sending it'])); return; }
      if (!email.value.trim()) { box.replaceChildren(...ui.issues(['Add their portal login (email) first'])); return; }
      if (!(await ui.confirmDialog(`Send this bio to ${drName(d.name)} to approve? It goes on the website when they approve it.`, { ok: 'Send' }))) return;
      send.disabled = true;
      try {
        if (dirty && !(await doSave())) return;
        await api.post(`/admin/doctors/${encodeURIComponent(id)}/send`, { version: item.version });
        done();
        ui.toast(`Sent. ${drName(d.name)} will see it under My profile.`, { ms: 5000 });
        await load();
      } catch (err) {
        box.replaceChildren(...ui.saveErrorNodes(err, { onReload: async () => { done(); await load(); } }));
      } finally { send.disabled = false; }
    });

    const sheet = ui.sheet({
      title: isNew ? 'Add doctor' : d.name,
      content: form,
      onClose: async () => { const ok = !dirty || (await ui.confirmDialog('Discard your changes?', { ok: 'Discard', danger: true })); if (ok) setHash('#doctors'); return ok; },
    });
    function done() { sheet.close(); setHash('#doctors'); }
    setHash(isNew ? '#doctors/new' : `#doctors/${encodeURIComponent(id)}`);
    paintForm();
  }

  await load();
  const part = route.parts[0];
  if (part === 'new') openEditor(null);
  else if (part) {
    const d = find(part);
    if (d) openEditor(d);
    else setHash('#doctors');
  }
}

function setHash(hash) {
  if (location.hash !== hash) history.replaceState(null, '', hash);
}
