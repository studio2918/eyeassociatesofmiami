// Holiday themes (owner, doctor): the dates the website's holiday characters show (Thanksgiving, Christmas).
// Each year repeats until changed. A live Weather banner always wins over these on the website.
import { themesPath, themeErrors, themeShowingNow, mdLabel, THEME_MONTHS, daysInMonth } from '../model.js';
import { todayCentral } from '../time.js';

const clean = (hs) => (hs || []).map((x) => ({ id: x.id, name: x.name, on: x.on === true, start: x.start, end: x.end }));

export async function render(root, ctx) {
  const { ui, api } = ctx;
  const { h } = ui;
  let base = null, working = null, version = 0, stale = false, saveNodes = [];
  let checkState = { pending: true, errors: [], warnings: [] };

  root.replaceChildren(h('p', { class: 'soft' }, 'Loading…'));

  async function load() {
    const state = await api.get('/admin/state');
    const t = state.themes || {};
    version = t.version != null ? t.version : 0;
    base = clean(t.holidays);
    working = clean(base);
  }

  const changed = () => JSON.stringify(working) !== JSON.stringify(base);
  const box = h('div', { 'aria-live': 'polite' });
  const checking = h('p', { class: 'checking' });
  const save = h('button', { type: 'button', class: 'btn', disabled: true }, 'Save themes');
  const undo = h('button', { type: 'button', class: 'btn ghost' }, 'Undo changes');
  const check = ui.liveCheck(
    () => api.put(themesPath, { item: { holidays: working }, version }, { dryRun: true }),
    (s) => { checkState = s; paintStatus(); });

  function paintStatus() {
    const local = themeErrors(working);
    const s = checkState;
    checking.textContent = s.pending && !local.length ? 'Checking…' : '';
    save.disabled = stale || !changed() || local.length > 0 || s.pending || s.errors.length > 0;
    undo.hidden = !changed();
    box.replaceChildren(...saveNodes, ...(s.failed ? ui.saveErrorNodes(s.failed) : ui.issues(local.length ? local : s.errors, s.warnings)));
  }

  // month + day pickers for one 'MM-DD' value
  function datePick(label, value, onChange) {
    const [mm, dd] = String(value || '01-01').split('-');
    const month = h('select', { 'aria-label': `${label} month` }, THEME_MONTHS.map((m) => h('option', { value: m.value, selected: m.value === mm }, m.label)));
    const day = h('select', { 'aria-label': `${label} day` });
    function fillDays() {
      const n = daysInMonth(month.value), keep = Math.min(Number(day.value || dd), n);
      day.replaceChildren(...Array.from({ length: n }, (_, i) => h('option', { value: String(i + 1).padStart(2, '0'), selected: i + 1 === keep }, String(i + 1))));
    }
    day.value = dd; fillDays();
    const emit = () => onChange(`${month.value}-${day.value}`);
    month.addEventListener('change', () => { fillDays(); emit(); });
    day.addEventListener('change', emit);
    return h('div', { class: 'field' }, h('label', {}, label), h('div', { class: 'pair' }, month, day));
  }

  function paint() {
    const today = todayCentral();
    root.replaceChildren(
      h('div', { class: 'screen-head' }, h('h1', {}, 'Holiday themes')),
      h('p', { class: 'soft screen-intro' }, 'The little characters on the website dress up for these holidays between the dates below. The dates repeat every year until you change them. While a Weather banner is up, the snow or ice characters show instead.'),
      h('p', { class: 'hint' }, 'This is only the look. Holiday hours (closed days, closing early) and the message across the top of the website are set each year under Closings and Banners.'),
      h('ul', { class: 'list' }, working.map((x, i) => {
        const sw = h('input', { type: 'checkbox', role: 'switch', checked: x.on, 'aria-label': `Show the ${x.name} characters` });
        sw.addEventListener('change', () => { working[i].on = sw.checked; edited(); });
        return h('li', { class: JSON.stringify(x) !== JSON.stringify(base[i]) ? 'theme-row changed' : 'theme-row' },
          h('div', { class: 'row-title' }, x.name,
            themeShowingNow(x, today) ? h('span', { class: 'pill weather' }, 'Showing now') : ''),
          h('p', { class: 'soft' }, x.on ? `${mdLabel(x.start)} – ${mdLabel(x.end)}` : 'Off'),
          h('label', { class: 'switch' }, sw, h('span', { 'aria-hidden': 'true' }, 'On')),
          datePick('Starts', x.start, (v) => { working[i].start = v; edited(); }),
          datePick('Ends', x.end, (v) => { working[i].end = v; edited(); }));
      })),
      checking, box,
      h('div', { class: 'savebar' }, undo, save));
    paintStatus();
  }

  function edited() { if (!stale) saveNodes = []; paint(); check.schedule(); }

  undo.addEventListener('click', () => { working = clean(base); saveNodes = []; stale = false; edited(); });
  save.addEventListener('click', async () => {
    save.disabled = true; check.stop(); checking.textContent = 'Saving…';
    try {
      await api.put(themesPath, { item: { holidays: working }, version });
      ui.toast('Holiday themes saved. The website updates within a minute.');
      saveNodes = []; stale = false;
      await load(); paint(); check.now();
    } catch (err) {
      checking.textContent = '';
      stale = !!err && err.name === 'StaleError';
      saveNodes = ui.saveErrorNodes(err, { onReload: async () => { stale = false; saveNodes = []; await load(); paint(); check.now(); } });
      checkState = { pending: false, errors: [], warnings: [] };
      paintStatus();
    }
  });

  await load();
  paint();
  check.now();
}
