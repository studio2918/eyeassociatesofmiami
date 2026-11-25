// Change log (who · what · when, Undo) and Recently removed (Restore, kept 30 days).
// Routes: #changes, #changes/removed. Every screen reloads from the server when opened, so an
// undo or restore shows up on its own screen right away.
import { changeWhen, isUndoable, undoPath, restorePath, purgeDate, removedLabel, restoreConflictText, fillChanges } from '../model.js';

export async function render(root, ctx) {
  const { ui, api, route } = ctx;
  const { h } = ui;
  const removedView = route.parts[0] === 'removed';
  const name = (email) => api.displayName ? api.displayName(email) : String(email || 'Someone').split('@')[0];
  const notice = h('div', { 'aria-live': 'polite' });
  const listBox = h('div');

  root.replaceChildren(
    h('div', { class: 'screen-head' }, h('h1', {}, removedView ? 'Recently removed' : 'Change log')),
    h('nav', { class: 'views', 'aria-label': 'Change log views' },
      h('a', { href: '#changes', 'aria-current': removedView ? null : 'page' }, 'Changes'),
      h('a', { href: '#changes/removed', 'aria-current': removedView ? 'page' : null }, 'Recently removed')),
    h('p', { class: 'soft screen-intro' }, removedView
      ? 'Removed items stay here for 30 days, then they’re deleted for good.'
      : 'Newest first. Undo puts back the version from before that change.'),
    notice, listBox);
  listBox.replaceChildren(h('p', { class: 'soft' }, 'Loading…'));

  const toastErr = (err) => { const nodes = ui.saveErrorNodes(err); if (nodes.length) ui.toast(nodes[0].textContent, { ms: 6000 }); };
  function guard(err) {
    if (err && err.name === 'ForbiddenError') {
      listBox.replaceChildren(h('p', { class: 'error', role: 'alert' }, "You don't have access to this."));
      return true;
    }
    return false;
  }

  // ---- change log ----
  let changes = [];
  let next = null;

  async function loadChanges({ more = false } = {}) {
    // A staff editor's pages can be short (other areas filtered out): fill up to 20 rows.
    const r = await fillChanges((before) => api.get('/admin/changes' + (before ? `?before=${encodeURIComponent(before)}` : '')),
      { before: more ? next : null });
    const got = r.items;
    changes = more ? changes.concat(got.filter((c) => !changes.some((x) => x.id === c.id))) : got;
    next = r.next;
    paintChanges();
  }

  function paintChanges() {
    const moreBtn = next ? h('button', { type: 'button', class: 'btn ghost wide loadmore' }, 'Load more') : null;
    if (moreBtn) {
      moreBtn.addEventListener('click', async () => {
        moreBtn.disabled = true;
        moreBtn.textContent = 'Loading…';
        try { await loadChanges({ more: true }); } catch (err) { moreBtn.disabled = false; moreBtn.textContent = 'Load more'; if (!guard(err)) toastErr(err); }
      });
    }
    listBox.replaceChildren(changes.length
      ? h('ul', { class: 'list' }, changes.map(changeRow))
      : h('p', { class: 'empty' }, 'No changes yet.'), moreBtn);
  }

  function changeRow(c) {
    const when = changeWhen(c.at);
    const abs = h('span', { class: 'when-abs', hidden: true }, when.absolute);
    const main = h('button', { type: 'button', class: 'row-main', 'aria-expanded': 'false' },
      h('span', { class: 'row-title' }, c.summary || 'Change'),
      h('span', { class: 'row-meta' }, `${name(c.who)} · ${when.relative}`),
      abs);
    main.addEventListener('click', () => {
      const open = abs.hidden;
      abs.hidden = !open;
      main.setAttribute('aria-expanded', String(open));
    });
    const undo = isUndoable(c) ? h('button', { type: 'button', class: 'btn ghost small' }, 'Undo') : null;
    if (undo) undo.addEventListener('click', () => doUndo(c, undo));
    return h('li', {}, main, undo ? h('span', { class: 'row-side' }, undo) : null);
  }

  async function doUndo(c, btn) {
    if (!(await ui.confirmDialog(`Undo this change? “${c.summary}”`, { ok: 'Undo' }))) return;
    btn.disabled = true;
    notice.replaceChildren();
    try {
      await api.post(undoPath(c.id));
      ui.toast('Undone. The website updates within a minute.');
      await loadChanges();
    } catch (err) {
      btn.disabled = false;
      if (guard(err)) return;
      if (err && err.name === 'StaleError') {
        notice.replaceChildren(ui.staleNotice('This was changed again since — reload to see the latest.', async () => { notice.replaceChildren(); await loadChanges(); }));
        return;
      }
      if (err && err.name === 'ValidationError') { ui.toast('This change can’t be undone.'); return; }
      toastErr(err);
    }
  }

  // ---- recently removed ----
  let removed = [];

  async function loadRemoved() {
    const r = await api.get('/admin/removed');
    removed = (r && r.items) || [];
    listBox.replaceChildren(removed.length
      ? h('ul', { class: 'list' }, removed.map(removedRow))
      : h('p', { class: 'empty' }, 'Nothing removed in the last 30 days.'));
  }

  function removedRow(r) {
    const what = removedLabel(r);
    const when = changeWhen(r.removedAt);
    const until = purgeDate(r);
    const btn = h('button', { type: 'button', class: 'btn ghost small' }, 'Restore');
    btn.addEventListener('click', () => doRestore(r, what, btn));
    return h('li', {},
      h('div', { class: 'row-main' },
        h('span', { class: 'row-title clamp' }, what),
        h('span', { class: 'row-meta' }, `Removed by ${name(r.removedBy)} · ${when.relative}`),
        until ? h('span', { class: 'row-meta' }, `Deleted for good after ${until}`) : null),
      h('span', { class: 'row-side' }, btn));
  }

  async function doRestore(r, what, btn) {
    if (!(await ui.confirmDialog(`Restore “${what}”?`, { ok: 'Restore' }))) return;
    btn.disabled = true;
    notice.replaceChildren();
    try {
      await api.post(restorePath(r.id));
      ui.toast(r.area === 'application' ? 'Restored. It’s back in Applications.' : 'Restored. The website updates within a minute.');
      if (r.area === 'application') ui.refreshAppsBadge(api);
      await loadRemoved();
    } catch (err) {
      btn.disabled = false;
      if (guard(err)) return;
      if (err && err.name === 'StaleError') {
        notice.replaceChildren(h('p', { class: 'notice', role: 'alert' }, restoreConflictText(r.area)));
        return;
      }
      toastErr(err);
    }
  }

  try {
    if (removedView) await loadRemoved(); else await loadChanges();
  } catch (err) {
    if (!guard(err)) throw err;
  }
}
