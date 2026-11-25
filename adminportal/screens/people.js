// People (Owner only, Menu -> People): who can sign in to the admin, and their role.
// Add person (AWS emails a temporary password), change role (signs them out), remove (signs them out
// everywhere and deletes the login). Your own row has no remove/demote controls (the server refuses too).
import { ROLE_CHOICES, roleLabel, personPath, sortPeople, peopleErrorText } from '../roles.js';

export async function render(root, ctx) {
  const { ui, api } = ctx;
  const { h } = ui;
  const me = String(ctx.me || '').trim().toLowerCase();
  let people = [];
  let current = null;

  root.replaceChildren(h('p', { class: 'soft' }, 'Loading…'));

  async function load() {
    const r = await api.get('/admin/people');
    people = sortPeople((r && r.items) || []);
    paint();
  }
  const isMe = (p) => String(p.email || '').toLowerCase() === me;

  function paint() {
    root.replaceChildren(
      h('div', { class: 'screen-head' },
        h('h1', {}, 'People'),
        h('button', { type: 'button', class: 'btn', onclick: () => openAdd() }, 'Add person')),
      h('p', { class: 'soft screen-intro' }, 'Who can sign in to this admin, and what they can change.'),
      people.length ? h('ul', { class: 'list' }, people.map(row)) : h('p', { class: 'empty' }, 'No one yet.'));
  }

  function row(p) {
    const meta = [roleLabel(p.role), isMe(p) ? 'You' : null].filter(Boolean).join(' · ');
    const pill = p.status === 'invited' ? h('span', { class: 'pill hidden' }, 'Invited') : null;
    const body = [h('span', { class: 'row-title' }, p.email), h('span', { class: 'row-meta' }, meta, pill)];
    if (isMe(p)) return h('li', {}, h('div', { class: 'row-main' }, body));
    return h('li', {}, h('button', { type: 'button', class: 'row-main', onclick: () => openPerson(p) }, body));
  }

  // Role radios with one-line descriptions.
  function roleField(value) {
    return h('fieldset', { class: 'field' },
      h('legend', {}, 'Role'),
      h('div', { class: 'choices' }, ROLE_CHOICES.map((r) => h('label', { class: 'choice' },
        h('input', { type: 'radio', name: 'role', value: r.id, checked: r.id === value }),
        h('span', {}, h('strong', {}, r.label), h('span', { class: 'choice-desc' }, r.description))))));
  }

  function errorBox(box, err) {
    if (err && (err.name === 'AuthError' || err.name === 'SignInRejectedError')) return;
    box.replaceChildren(h('p', { class: 'error', role: 'alert' }, peopleErrorText(err)));
  }

  // ---- add person ----
  function openAdd() {
    if (current) current.close();
    const email = h('input', { type: 'email', name: 'email', id: 'personEmail', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', inputmode: 'email', maxlength: '254', required: true });
    const box = h('div', { 'aria-live': 'polite' });
    const save = h('button', { type: 'submit', class: 'btn' }, 'Send invite');
    const cancel = h('button', { type: 'button', class: 'btn ghost' }, 'Cancel');
    const form = h('form', { class: 'sheet-form', novalidate: true },
      h('div', { class: 'sheet-body' },
        h('div', { class: 'field' }, h('label', { for: 'personEmail' }, 'Email'), email,
          h('p', { class: 'hint' }, 'They get an email with a temporary password. On first sign-in they choose a password and set up an authenticator app.')),
        roleField('editor'),
        box),
      h('footer', { class: 'sheet-foot' }, cancel, save));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = ui.readForm(form);
      const addr = String(v.email || '').trim();
      if (!addr || !v.role) { box.replaceChildren(...ui.issues(['Enter an email and choose a role'])); return; }
      save.disabled = true;
      save.textContent = 'Sending…';
      try {
        await api.post('/admin/people', { email: addr, role: v.role });
        close();
        ui.toast(`Invite sent to ${addr.toLowerCase()}.`);
        await load();
      } catch (err) {
        save.disabled = false;
        save.textContent = 'Send invite';
        errorBox(box, err);
      }
    });
    cancel.addEventListener('click', () => close());
    const sheet = ui.sheet({ title: 'Add person', content: form });
    function close() { sheet.close(); if (current === handle) current = null; }
    const handle = { close };
    current = handle;
    email.focus();
  }

  // ---- one person: change role / remove ----
  function openPerson(p) {
    if (current) current.close();
    const box = h('div', { 'aria-live': 'polite' });
    const save = h('button', { type: 'submit', class: 'btn', disabled: true }, 'Save');
    const del = h('button', { type: 'button', class: 'btn danger-ghost' }, 'Remove');
    const cancel = h('button', { type: 'button', class: 'btn ghost' }, 'Cancel');
    const form = h('form', { class: 'sheet-form', novalidate: true },
      h('div', { class: 'sheet-body' },
        h('p', { class: 'row-title person-email' }, p.email),
        p.status === 'invited' ? h('p', { class: 'hint person-hint' }, 'Invited — hasn’t signed in yet.') : null,
        roleField(p.role),
        box),
      h('footer', { class: 'sheet-foot' }, del, cancel, save));
    const chosen = () => ui.readForm(form).role;
    form.addEventListener('change', () => { save.disabled = !chosen() || chosen() === p.role; });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const role = chosen();
      if (!role || role === p.role) return;
      if (!(await ui.confirmDialog(`Make ${p.email} ${roleLabel(role)}? They'll be signed out and need to sign in again.`, { ok: 'Change role' }))) return;
      save.disabled = true;
      try {
        await api.put(personPath(p.email), { role });
        close();
        ui.toast(`${p.email} is now ${roleLabel(role)}.`);
        await load();
      } catch (err) {
        save.disabled = false;
        errorBox(box, err);
      }
    });
    del.addEventListener('click', async () => {
      if (!(await ui.confirmDialog(`Remove ${p.email}? They'll be signed out everywhere and their login is deleted.`, { ok: 'Remove', danger: true }))) return;
      del.disabled = true;
      try {
        await api.del(personPath(p.email));
        close();
        ui.toast(`Removed ${p.email}.`);
        await load();
      } catch (err) {
        del.disabled = false;
        errorBox(box, err);
      }
    });
    cancel.addEventListener('click', () => close());
    const sheet = ui.sheet({ title: 'Person', content: form, kind: 'popup' });
    function close() { sheet.close(); if (current === handle) current = null; }
    const handle = { close };
    current = handle;
  }

  try {
    await load();
  } catch (err) {
    if (err && err.name === 'ForbiddenError') { root.replaceChildren(ui.noAccess()); return; }
    throw err;
  }
}
