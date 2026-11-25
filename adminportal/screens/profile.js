// My profile (doctors, and the owner when he's also a doctor): answer the bio questions, then look over the
// bio Dr. Gray sends back and Approve it (it goes live) or Ask for changes (with a note).
// Route: #profile. A login not linked to a doctor yet sees a short note.
import { QUESTION_SECTIONS, QUESTIONS, answeredCount, drName } from '../doctors-model.js';
import { doctorCard } from './doctors.js';

export async function render(root, ctx) {
  const { ui, api } = ctx;
  const { h } = ui;
  let doc = null;

  root.replaceChildren(h('p', { class: 'soft' }, 'Loading…'));

  async function load() {
    try {
      doc = (await api.get('/admin/me/doctor')).doctor;
    } catch (err) {
      if (err && err.status === 404) {
        root.replaceChildren(h('section', { class: 'card' },
          h('h1', {}, 'My profile'),
          h('p', {}, 'Your login isn’t linked to a doctor on the website yet. Ask Dr. Gray to link it on the Doctors screen.')));
        return;
      }
      throw err;
    }
    paint();
  }

  function approvalBlock() {
    if (doc.status === 'sent' && doc.sentBio) {
      const note = h('textarea', { rows: '3', maxlength: '1000', 'aria-label': 'What would you like changed?' });
      const box = h('div', { 'aria-live': 'polite' });
      const approve = h('button', { type: 'button', class: 'btn' }, 'Approve: put it on the website');
      const changes = h('button', { type: 'button', class: 'btn ghost' }, 'Ask for changes');
      const ask = h('div', { class: 'field', hidden: true }, h('label', {}, 'What would you like changed?', note),
        h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { type: 'button', class: 'btn', onclick: () => decide('changes', note.value) }, 'Send my note')));
      changes.addEventListener('click', () => { ask.hidden = false; note.focus(); });
      approve.addEventListener('click', async () => {
        if (await ui.confirmDialog('Approve your bio? It goes on the website within a minute.', { ok: 'Approve' })) decide('approve');
      });
      async function decide(decision, text = '') {
        if (decision === 'changes' && !text.trim()) { box.replaceChildren(...ui.issues(['Say what you’d like changed'])); return; }
        approve.disabled = changes.disabled = true;
        try {
          doc = (await api.post('/admin/me/doctor/decision', { decision, note: text, sentAt: doc.sentAt })).doctor;
          ui.toast(decision === 'approve' ? 'Approved. Your bio is on the website within a minute.' : 'Sent. Dr. Gray will revise it.', { ms: 5000 });
          paint();
        } catch (err) {
          box.replaceChildren(...ui.saveErrorNodes(err, { onReload: load }));
          approve.disabled = changes.disabled = false;
        }
      }
      return h('section', { class: 'card approve' },
        h('h2', {}, 'Your bio is ready for you to look over'),
        h('p', { class: 'soft' }, 'This is exactly how it will look on the website.'),
        ui.previewFrame('doctors', h('div', { class: 'site-docs' }, doctorCard(h, doc, doc.sentBio))),
        h('div', { class: 'row', style: 'margin-top:12px; gap:8px; flex-wrap:wrap' }, approve, changes),
        ask, box);
    }
    const lines = {
      waiting: 'Fill in the questions below. Dr. Gray writes your bio from them and sends it back for you to approve.',
      answered: 'Thanks! Dr. Gray is writing your bio. You’ll get it back here to approve.',
      changes: 'Dr. Gray has your note and is revising your bio.',
      approved: 'Your bio is approved and on the website.',
    };
    return h('section', { class: 'card' },
      h('p', {}, h('b', {}, 'Status: '), lines[doc.status] || lines.waiting),
      doc.status === 'changes' && doc.note ? h('p', { class: 'hint' }, `Your note: ${doc.note}`) : null,
      doc.bio ? ui.previewFrame('doctors', h('div', { class: 'site-docs' }, doctorCard(h, doc, doc.bio))) : null);
  }

  function paint() {
    const a = doc.answers || {};
    const box = h('div', { 'aria-live': 'polite' });
    const save = h('button', { type: 'submit', class: 'btn' }, answeredCount(a) ? 'Save my answers' : 'Send my answers');
    const form = h('form', { class: 'profile-form', novalidate: true },
      QUESTION_SECTIONS.map((s) => h('fieldset', { class: 'card' },
        h('legend', {}, s.title),
        s.hint ? h('p', { class: 'hint' }, s.hint) : null,
        s.questions.map((q) => h('div', { class: 'field' },
          h('label', {}, q.label, q.long
            ? h('textarea', { name: q.key, rows: '3', maxlength: '2000' }, a[q.key] || '')
            : h('input', { type: 'text', name: q.key, value: a[q.key] || '', maxlength: '2000', autocomplete: 'off' })),
          q.hint ? h('p', { class: 'hint' }, q.hint) : null)))),
      h('p', { class: 'hint' }, 'Skip anything you’d rather not share. Nothing goes on the website until you approve your bio.'),
      box,
      h('div', { class: 'row' }, save));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const answers = Object.fromEntries(QUESTIONS.map((q) => [q.key, String(form.elements[q.key].value || '')]));
      save.disabled = true;
      try {
        const res = await api.put('/admin/me/doctor/answers', { answers });
        doc = res.doctor;
        const w = (res && res.warnings) || [];
        ui.toast(w.length ? `Saved. Note: ${w.join(' ')}` : 'Saved. Dr. Gray has your answers.', { ms: w.length ? 6000 : 4000 });
        paint();
      } catch (err) {
        box.replaceChildren(...ui.saveErrorNodes(err, { onReload: load }));
        save.disabled = false;
      }
    });
    root.replaceChildren(
      h('div', { class: 'screen-head' }, h('h1', {}, 'My profile')),
      h('p', { class: 'soft screen-intro' }, `${drName(doc.name)}: your “Meet the doctors” card on the website.`),
      approvalBlock(),
      form);
  }

  await load();
}
