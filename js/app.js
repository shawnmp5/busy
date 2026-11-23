/* Chronos Calendar — vanilla JS, no build step. Everything is saved to localStorage. */
(() => {
'use strict';

/* ============================================================
   Utilities
   ============================================================ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pad = n => String(n).padStart(2, '0');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const toKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const addMonths = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth() + n, 1); x.setDate(Math.min(d.getDate(), daysInMonth(x.getFullYear(), x.getMonth()))); return x; };
const startOfWeek = (d, ws) => addDays(d, -((d.getDay() - ws + 7) % 7));
const todayKey = () => toKey(new Date());
const minutesOf = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const timeOf = mins => { mins = clamp(Math.round(mins), 0, 1439); return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`; };
const dtOf = (key, time) => { const d = fromKey(key); const m = minutesOf(time || '00:00'); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d; };
const parseLocal = s => { const [k, t] = s.split('T'); return dtOf(k, t); };
const localStamp = d => `${toKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const icon = (id, cls = '') => `<svg class="ic ${cls}"><use href="#i-${id}"/></svg>`;
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function readable(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return '#0b0d14';
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const L = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  return L > 0.36 ? '#0b0d14' : '#ffffff';
}
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - ys) / 864e5 + 1) / 7);
}

/* ============================================================
   Constants
   ============================================================ */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON3 = MONTHS.map(m => m.slice(0, 3));
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DOW3 = DOW.map(d => d.slice(0, 3));
const NOTE_COLORS = [
  { id: 'lemon', name: 'Lemon', c: '#ffe57a' },
  { id: 'peach', name: 'Peach', c: '#ffc08f' },
  { id: 'rose', name: 'Rose', c: '#ffacc9' },
  { id: 'lilac', name: 'Lilac', c: '#d4bfff' },
  { id: 'sky', name: 'Sky', c: '#a8d7ff' },
  { id: 'mint', name: 'Mint', c: '#aeecca' },
  { id: 'lime', name: 'Lime', c: '#dcef8a' },
  { id: 'cloud', name: 'Cloud', c: '#e8ebf2' },
];
/* Gray paper shades briefly used by the monochrome redesign, mapped back to post-it colours */
const MONO_NOTE_COLORS = { paper: 'lemon', mist: 'sky', linen: 'peach', stone: 'cloud', silver: 'cloud', graphite: 'cloud', ink: 'cloud' };
const noteColor = id => (NOTE_COLORS.find(c => c.id === id) || NOTE_COLORS[0]).c;
/* Event colours share the post-it pastels */
const EVENT_COLORS = ['#a8d7ff', '#ffacc9', '#ffc08f', '#d4bfff', '#aeecca', '#ffe57a', '#dcef8a'];
const GRAY_TO_PASTEL = { '#111111': '#a8d7ff', '#3a3a3c': '#ffacc9', '#636366': '#ffc08f', '#8e8e93': '#d4bfff', '#aeaeb2': '#aeecca', '#c7c7cc': '#ffe57a' };
const OLD_EVENT_COLORS = { '#7c9cff': '#111111', '#5cc8e0': '#3a3a3c', '#3fbf8f': '#aeaeb2', '#a8c94a': '#8e8e93', '#f2b45a': '#636366', '#ff8a65': '#8e8e93', '#f06292': '#3a3a3c', '#b388ff': '#636366', '#8d99ae': '#c7c7cc' };
const ACCENTS = ['#48484a'];
const SKINS = [
  { id: 'light', name: 'Light', bg: '#f5f5f5', sf: '#ffffff', ac: '#111111' },
  { id: 'paper', name: 'Paper', bg: '#ffffff', sf: '#f2f2f2', ac: '#111111' },
  { id: 'auto', name: 'Auto' },
  { id: 'graphite', name: 'Graphite', bg: '#1c1c1e', sf: '#2c2c2e', ac: '#f2f2f2' },
  { id: 'dark', name: 'Dark', bg: '#000000', sf: '#1c1c1c', ac: '#f2f2f2' },
  /* Animated scene (js/rain.js): the app sits on frosted glass with rain running down the window behind it */
  { id: 'rain', name: 'Rain', scene: true },
];
const RAIN_LEVELS = [['drizzle', 'Drizzle'], ['rain', 'Rain'], ['storm', 'Storm']];
/* Apple's San Francisco family where it exists (Apple devices); Inter, its closest open match, everywhere else */
const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", Inter, "Segoe UI", Roboto';
const INTER = 'family=Inter:wght@400..700';
const FONTS = [
  { id: 'sf', name: 'San Francisco', display: SF, body: SF, gf: INTER },
  { id: 'rounded', name: 'SF Rounded', display: `ui-rounded, "SF Pro Rounded", ${SF}`, body: `ui-rounded, "SF Pro Rounded", ${SF}`, gf: INTER },
  { id: 'serif', name: 'New York', display: 'ui-serif, "New York", "Iowan Old Style", Georgia, "Times New Roman"', body: 'ui-serif, "New York", "Iowan Old Style", Georgia, "Times New Roman"', gf: null },
  { id: 'mono', name: 'SF Mono', display: 'ui-monospace, "SF Mono", Menlo, Consolas', body: 'ui-monospace, "SF Mono", Menlo, Consolas', gf: null },
];
const NOTE_FONTS = [
  { id: 'caveat', name: 'Caveat', family: '"Caveat"', size: 21, gf: 'family=Caveat:wght@500..700' },
  { id: 'kalam', name: 'Kalam', family: '"Kalam"', size: 16, gf: 'family=Kalam:wght@400;700' },
  { id: 'patrick', name: 'Patrick Hand', family: '"Patrick Hand"', size: 18, gf: 'family=Patrick+Hand' },
  { id: 'gochi', name: 'Gochi Hand', family: '"Gochi Hand"', size: 18, gf: 'family=Gochi+Hand' },
  { id: 'clean', name: 'Clean', family: 'var(--font-body)', size: 14, gf: null },
];
const attrFont = f => f.replace(/"/g, "'");
const REMINDERS = [[null, 'No reminder'], [0, 'At start time'], [5, '5 minutes before'], [10, '10 minutes before'], [15, '15 minutes before'], [30, '30 minutes before'], [60, '1 hour before'], [120, '2 hours before'], [1440, '1 day before']];
const REPEATS = [['none', 'Does not repeat'], ['daily', 'Every day'], ['weekdays', 'Every weekday (Mon–Fri)'], ['weekly', 'Every week'], ['biweekly', 'Every 2 weeks'], ['monthly', 'Every month'], ['yearly', 'Every year']];
const DEFAULT_SETTINGS = {
  skin: 'light', accent: null, font: 'sf', noteFont: 'caveat',
  weekStart: 0, hour12: true, showWeekNumbers: false, showWeekends: true,
  ambient: false, grain: false, glass: false, density: 'comfortable', radius: 14, rainLevel: 'rain',
  dayStartHour: 7, sound: true, soundType: 'chime', showHolidays: true,
  defaultDuration: 60, defaultReminder: 10, eventStyle: 'tinted', notesInGrid: true,
  sidebarOpen: true, boardOpen: true, view: 'month', design: 6,
};
const KEY = 'chronos.v1';

/* ============================================================
   State
   ============================================================ */
function defaultState() {
  return {
    v: 1,
    settings: { ...DEFAULT_SETTINGS },
    calendars: [
      { id: 'personal', name: 'Personal', color: '#a8d7ff', visible: true },
      { id: 'work', name: 'Work', color: '#ffc08f', visible: true },
      { id: 'fitness', name: 'Fitness', color: '#aeecca', visible: true },
      { id: 'birthdays', name: 'Birthdays', color: '#ffacc9', visible: true },
    ],
    events: [], notes: [], moods: {}, fired: {}, snoozes: [],
  };
}
function seed(s) {
  const t = new Date();
  const k = n => toKey(addDays(t, n));
  const ex = 'Example event. Edit it or delete it whenever you like.';
  const ids = Array.from({ length: 5 }, uid);
  s.events.push(
    { id: ids[0], title: 'Morning run', date: k(0), start: '07:00', end: '07:45', allDay: false, calendarId: 'fitness', color: null, location: 'Riverside loop', description: ex, reminder: null, repeat: 'weekly', until: null, exceptions: [] },
    { id: ids[1], title: 'Deep work block', date: k(0), start: '13:00', end: '15:00', allDay: false, calendarId: 'work', color: null, location: '', description: ex, reminder: null, repeat: 'none', until: null, exceptions: [] },
    { id: ids[2], title: 'Team sync', date: k(1), start: '10:00', end: '10:30', allDay: false, calendarId: 'work', color: null, location: 'Video call', description: ex, reminder: 10, repeat: 'weekly', until: null, exceptions: [] },
    { id: uid(), title: 'Dinner with friends', date: k(3), start: '19:00', end: '21:00', allDay: false, calendarId: 'personal', color: null, location: 'That ramen place', description: ex, reminder: 60, repeat: 'none', until: null, exceptions: [] },
    { id: uid(), title: 'Dentist', date: k(5), start: '15:30', end: '16:15', allDay: false, calendarId: 'personal', color: '#d4bfff', location: '', description: ex, reminder: 60, repeat: 'none', until: null, exceptions: [] },
  );
  s.notes.push(
    { id: uid(), evId: ids[1], date: k(0), mode: 'text', text: 'Notes live on events.\nClick any event (even a holiday) to add one.', items: [], color: 'lemon', x: 0, y: 0, rot: -2.5, z: 1, remindAt: null, done: false },
    { id: uid(), evId: ids[0], date: k(0), mode: 'list', text: '', items: [{ text: 'Open Busy', done: true }, { text: 'Click an event', done: false }, { text: 'Add a note to it', done: false }], color: 'mint', x: 0, y: 0, rot: 2, z: 2, remindAt: null, done: false },
    { id: uid(), evId: ids[2], date: k(1), mode: 'text', text: 'Example reminder: bring the slides', items: [], color: 'rose', x: 0, y: 0, rot: 1.5, z: 1, remindAt: `${k(1)}T09:00`, done: false },
  );
}
function migrate(s) {
  const d = defaultState();
  const out = { ...d, ...s };
  out.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
  for (const key of ['calendars', 'events', 'notes', 'snoozes']) if (!Array.isArray(out[key])) out[key] = d[key];
  if (!out.calendars.length) out.calendars = d.calendars;
  for (const key of ['moods', 'fired']) if (!out[key] || typeof out[key] !== 'object') out[key] = {};
  out.notes.forEach(n => { n.items = n.items || []; n.mode = n.mode || 'text'; if (n.x > 1) n.x = 0.5; });
  out.events.forEach(e => { e.exceptions = e.exceptions || []; e.repeat = e.repeat || 'none'; });
  if (((s.settings && s.settings.design) || 1) < 2) {
    /* One-time move to the monochrome design: reset appearance, turn default colours into grays */
    Object.assign(out.settings, { skin: 'light', accent: null, font: 'sf', noteFont: 'caveat', radius: 14, ambient: false, grain: false, glass: false, design: 3 });
    const mono = c => (c && OLD_EVENT_COLORS[String(c).toLowerCase()]) || c;
    out.calendars.forEach(c => { c.color = mono(c.color); });
    out.events.forEach(e => { if (e.color) e.color = mono(e.color); });
  }
  if (((s.settings && s.settings.design) || 1) === 2) {
    /* Post-it notes are back: restore the handwriting font the monochrome redesign switched off */
    if (out.settings.noteFont === 'clean') out.settings.noteFont = 'caveat';
    out.settings.design = 3;
  }
  if (((s.settings && s.settings.design) || 1) === 4) {
    /* A short-lived version hid the left panel; open it again */
    out.settings.sidebarOpen = true;
    out.settings.design = 5;
  }
  if (out.settings.design < 6) {
    /* Event colours moved from grays to post-it pastels */
    const pastel = c => (c && GRAY_TO_PASTEL[String(c).toLowerCase()]) || c;
    out.calendars.forEach(c => { c.color = pastel(c.color); });
    out.events.forEach(e => { if (e.color) e.color = pastel(e.color); });
    out.settings.design = 6;
  }
  out.notes.forEach(n => { if (MONO_NOTE_COLORS[n.color]) n.color = MONO_NOTE_COLORS[n.color]; });
  if (!SKINS.some(k => k.id === out.settings.skin)) out.settings.skin = 'light';
  if (!FONTS.some(f => f.id === out.settings.font)) out.settings.font = 'sf';
  const cutoff = Date.now() - 14 * 864e5;
  for (const k in out.fired) if (out.fired[k] < cutoff) delete out.fired[k];
  return out;
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { /* storage unavailable or corrupt */ }
  const s = defaultState();
  seed(s);
  return s;
}
let state = load();
try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
const S = () => state.settings;
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }, 120);
}

/* Undo */
const undoStack = [];
function snapshot() {
  undoStack.push(JSON.stringify({ events: state.events, notes: state.notes, moods: state.moods, calendars: state.calendars }));
  if (undoStack.length > 40) undoStack.shift();
}
function undo() {
  const snap = undoStack.pop();
  if (!snap) { toast('Nothing to undo'); return; }
  Object.assign(state, JSON.parse(snap));
  save(); render();
  toast('Undone');
}

/* UI state */
const ui = {
  view: 'month',
  selected: todayKey(),
  mini: new Date(),
  bdOverlay: false,
  animate: 'in',
  resetScroll: true,
  suppressClick: 0,
};

/* ============================================================
   Domain helpers
   ============================================================ */
const calById = id => state.calendars.find(c => c.id === id);
const calVisible = id => { const c = calById(id); return c ? c.visible : true; };
/* Grays are stored as picked; on a dark theme they are shown with their lightness flipped so black stays visible */
let darkUI = false;
function paint(c) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(c || '').trim());
  if (!darkUI || !m) return c;
  const n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (Math.max(r, g, b) - Math.min(r, g, b) > 14) return c;
  const v = 255 - Math.round((r + g + b) / 3);
  return '#' + [v, v, v].map(x => x.toString(16).padStart(2, '0')).join('');
}
const evColor = ev => paint(ev.color || calById(ev.calendarId)?.color || '#a8d7ff');
const findEvent = id => state.events.find(e => e.id === id);
const findNote = id => state.notes.find(n => n.id === id);

function occursOn(ev, key) {
  if (key < ev.date) return false;
  if (ev.exceptions && ev.exceptions.includes(key)) return false;
  const r = ev.repeat || 'none';
  if (r === 'none') return key === ev.date;
  if (ev.until && key > ev.until) return false;
  const a = fromKey(ev.date), b = fromKey(key);
  switch (r) {
    case 'daily': return true;
    case 'weekdays': { const d = b.getDay(); return d > 0 && d < 6; }
    case 'weekly': return a.getDay() === b.getDay();
    case 'biweekly': return a.getDay() === b.getDay() && Math.round((b - a) / 864e5 / 7) % 2 === 0;
    case 'monthly': return a.getDate() === b.getDate();
    case 'yearly': return a.getDate() === b.getDate() && a.getMonth() === b.getMonth();
  }
  return false;
}
function eventsOn(key) {
  return state.events
    .filter(ev => calVisible(ev.calendarId) && occursOn(ev, key))
    .sort((a, b) => (b.allDay - a.allDay) || (a.allDay ? 0 : minutesOf(a.start) - minutesOf(b.start)) || a.title.localeCompare(b.title));
}
/* Notes are attached to events (evId = event id, or 'hol:<name>' for a holiday) on one date.
   Older notes with no evId are "loose" day notes and keep their own board. */
const notesOn = key => state.notes.filter(n => n.date === key && !n.evId).sort((a, b) => (a.y - b.y));
const allNotesOn = key => state.notes.filter(n => n.date === key);
const evNotes = (id, key) => state.notes.filter(n => n.evId === id && n.date === key);
const noteEmpty = n => n.mode === 'list' ? !n.items.length : !(n.text || '').trim();
const holId = h => 'hol:' + h;
const noteDot = (id, key) => { const ns = evNotes(id, key).filter(n => !noteEmpty(n)); return ns.length ? `<span class="chip-note" style="--nc:${noteColor(ns[0].color)}" title="${ns.length} note${ns.length > 1 ? 's' : ''}"></span>` : ''; };
function nextOccurrence(ev, fromK = todayKey(), span = 400) {
  if (ev.repeat === 'none') return ev.date;
  let d = fromKey(fromK > ev.date ? fromK : ev.date);
  for (let i = 0; i < span; i++, d = addDays(d, 1)) { const k = toKey(d); if (occursOn(ev, k)) return k; }
  return ev.date;
}

/* Holidays (United States) */
const holidayCache = new Map();
function nthWeekday(y, m, dow, n) { const first = new Date(y, m, 1); return new Date(y, m, 1 + ((dow - first.getDay() + 7) % 7) + (n - 1) * 7); }
function lastWeekday(y, m, dow) { const last = new Date(y, m + 1, 0); return new Date(y, m, last.getDate() - ((last.getDay() - dow + 7) % 7)); }
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
}
function holidaysFor(y) {
  if (holidayCache.has(y)) return holidayCache.get(y);
  const map = {};
  const add = (d, name) => { const k = toKey(d); (map[k] = map[k] || []).push(name); };
  add(new Date(y, 0, 1), "New Year's Day");
  add(nthWeekday(y, 0, 1, 3), 'Martin Luther King Jr. Day');
  add(new Date(y, 1, 14), "Valentine's Day");
  add(nthWeekday(y, 1, 1, 3), "Presidents' Day");
  add(new Date(y, 2, 17), "St. Patrick's Day");
  add(easter(y), 'Easter Sunday');
  add(nthWeekday(y, 4, 0, 2), "Mother's Day");
  add(lastWeekday(y, 4, 1), 'Memorial Day');
  add(new Date(y, 5, 19), 'Juneteenth');
  add(nthWeekday(y, 5, 0, 3), "Father's Day");
  add(new Date(y, 6, 4), 'Independence Day');
  add(nthWeekday(y, 8, 1, 1), 'Labor Day');
  add(nthWeekday(y, 9, 1, 2), "Indigenous Peoples' Day");
  add(new Date(y, 9, 31), 'Halloween');
  add(new Date(y, 10, 11), 'Veterans Day');
  const tg = nthWeekday(y, 10, 4, 4);
  add(tg, 'Thanksgiving Day');
  add(addDays(tg, 1), 'Black Friday');
  add(new Date(y, 11, 24), 'Christmas Eve');
  add(new Date(y, 11, 25), 'Christmas Day');
  add(new Date(y, 11, 31), "New Year's Eve");
  holidayCache.set(y, map);
  return map;
}
/* Each holiday gets a colour that fits it */
const HOLIDAY_COLORS = {
  "New Year's Day": '#c9a227', 'Martin Luther King Jr. Day': '#6b4f9e', "Valentine's Day": '#e0457b',
  "Presidents' Day": '#2f5fb3', "St. Patrick's Day": '#2e9d4f', 'Easter Sunday': '#b07ad6',
  "Mother's Day": '#e86fa0', 'Memorial Day': '#b3262e', 'Juneteenth': '#d9822b',
  "Father's Day": '#3f7cc4', 'Independence Day': '#c8102e', 'Labor Day': '#2f5fb3',
  "Indigenous Peoples' Day": '#a0522d', 'Halloween': '#f07b16', 'Veterans Day': '#5a6b3a',
  'Thanksgiving Day': '#c0661c', 'Black Friday': '#6b6b6b', 'Christmas Eve': '#1f7a3e',
  'Christmas Day': '#c8102e', "New Year's Eve": '#c9a227',
};
const holColor = h => HOLIDAY_COLORS[h] || '#8e8e93';
const holChip = (h, key) => `<button class="chip-ev allday holiday" style="--hc:${holColor(h)}" title="${esc(h)}" data-hol="${esc(h)}" data-occ="${key}"><span class="n">${esc(h)}</span>${noteDot(holId(h), key)}</button>`;
const holidaysOn = key => S().showHolidays ? (holidaysFor(+key.slice(0, 4))[key] || []) : [];

/* Formatting */
function fmtTime(t) {
  const [h, m] = t.split(':').map(Number);
  if (!S().hour12) return `${pad(h)}:${pad(m)}`;
  return `${h % 12 || 12}${m ? ':' + pad(m) : ''} ${h < 12 ? 'AM' : 'PM'}`;
}
function fmtTimeShort(t) {
  const [h, m] = t.split(':').map(Number);
  if (!S().hour12) return `${pad(h)}:${pad(m)}`;
  return `${h % 12 || 12}${m ? ':' + pad(m) : ''}${h < 12 ? 'am' : 'pm'}`;
}
const fmtRange = ev => ev.allDay ? 'All day' : `${fmtTime(ev.start)} – ${fmtTime(ev.end)}`;
function fmtHour(h) { return S().hour12 ? `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}` : `${pad(h)}:00`; }
function relDay(key) {
  const diff = Math.round((fromKey(key) - fromKey(todayKey())) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return diff > 0 ? `In ${diff} days` : `${-diff} days ago`;
}
function fmtDayShort(key) {
  const d = fromKey(key);
  const rel = relDay(key);
  if (['Today', 'Tomorrow', 'Yesterday'].includes(rel)) return rel;
  return `${DOW3[d.getDay()]}, ${MON3[d.getMonth()]} ${d.getDate()}`;
}
const fmtDayLong = key => { const d = fromKey(key); return `${DOW[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`; };
const fmtStamp = s => { const [k, t] = s.split('T'); return `${fmtDayShort(k)} · ${fmtTime(t)}`; };
function tzLabel() {
  const off = -new Date().getTimezoneOffset();
  const h = Math.trunc(off / 60), m = Math.abs(off % 60);
  return `GMT${off >= 0 ? '+' : '-'}${Math.abs(h)}${m ? ':' + pad(m) : ''}`;
}
const repeatLabel = r => (REPEATS.find(x => x[0] === r) || REPEATS[0])[1];
const reminderLabel = r => (REMINDERS.find(x => x[0] === r) || [0, `${r} minutes before`])[1];
const hourH = () => S().density === 'compact' ? 40 : 52;
function visibleDows() {
  const arr = [0, 1, 2, 3, 4, 5, 6].map(i => (S().weekStart + i) % 7);
  return S().showWeekends ? arr : arr.filter(d => d !== 0 && d !== 6);
}

/* ============================================================
   Settings → DOM
   ============================================================ */
const loadedFonts = new Set();
function ensureFont(gf) {
  if (!gf || loadedFonts.has(gf)) return;
  loadedFonts.add(gf);
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = `https://fonts.googleapis.com/css2?${gf}&display=swap`;
  l.onload = () => { requestAnimationFrame(() => { fitMonthChips(); placeSegPill(); }); };
  document.head.appendChild(l);
}
function applySettings() {
  const s = S(), root = document.documentElement;
  if (s.skin === 'auto') root.removeAttribute('data-skin'); else root.setAttribute('data-skin', s.skin);
  const scene = SKINS.find(k => k.id === s.skin)?.scene ? s.skin : null;
  if (scene) root.setAttribute('data-scene', scene); else root.removeAttribute('data-scene');
  window.ChronosScenes?.set(scene, { level: s.rainLevel });
  root.classList.toggle('compact', s.density === 'compact');
  root.classList.toggle('ev-solid', s.eventStyle === 'solid');
  root.classList.toggle('ev-outline', s.eventStyle === 'outline');
  root.style.setProperty('--r', s.radius + 'px');
  if (s.accent) root.style.setProperty('--accent', s.accent); else root.style.removeProperty('--accent');
  const acc = s.accent || getComputedStyle(root).getPropertyValue('--accent').trim();
  root.style.setProperty('--on-accent', readable(acc));
  const f = FONTS.find(x => x.id === s.font) || FONTS[0];
  ensureFont(f.gf);
  root.style.setProperty('--font-display', `${f.display}, system-ui, sans-serif`);
  root.style.setProperty('--font-body', `${f.body}, system-ui, -apple-system, "Segoe UI", sans-serif`);
  const nf = NOTE_FONTS.find(x => x.id === s.noteFont) || NOTE_FONTS[0];
  ensureFont(nf.gf);
  root.style.setProperty('--font-note', `${nf.family}, "Segoe Print", cursive`);
  root.style.setProperty('--note-size', nf.size + 'px');
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim() || '#f5f5f5';
  darkUI = readable(bg) === '#ffffff';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = bg;
  const app = $('#app');
  app.classList.remove('bd-closed'); /* the day board is always open on wide screens */
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { render(); });

/* ============================================================
   Rendering — shell
   ============================================================ */
const stage = $('#stage'), board = $('#board'), layer = $('#layer');

function render() {
  applySettings();
  renderTitle();
  renderSeg();
  renderStage();
  renderToday();
  renderBoard();
  updateBadge();
  ui.animate = null;
}
function renderTitle() {
  const d = fromKey(ui.selected);
  let html = '';
  if (ui.view === 'month') html = `${MONTHS[d.getMonth()]} <span class="muted">${d.getFullYear()}</span>`;
  else if (ui.view === 'year') html = `${d.getFullYear()}`;
  else if (ui.view === 'day') html = `${DOW[d.getDay()]} <span class="muted">${MON3[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}</span>`;
  else {
    const days = weekDays();
    const a = days[0], b = days[days.length - 1];
    html = a.getMonth() === b.getMonth()
      ? `${MONTHS[a.getMonth()]} <span class="muted">${a.getDate()} – ${b.getDate()}, ${b.getFullYear()}</span>`
      : `${MON3[a.getMonth()]} – ${MON3[b.getMonth()]} <span class="muted">${b.getFullYear()}</span>`;
  }
  $('#view-title').innerHTML = html;
}
function renderSeg() {
  if (!$('#view-seg')) return;
  $$('#view-seg button').forEach(b => { const on = b.dataset.view === ui.view; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
  placeSegPill();
}
function placeSegPill() {
  const seg = $('#view-seg');
  if (!seg) return;
  let pill = $('.seg-pill', seg);
  if (!pill) { pill = document.createElement('span'); pill.className = 'seg-pill'; seg.prepend(pill); }
  const on = $('button.active', seg);
  if (on) { pill.style.left = on.offsetLeft + 'px'; pill.style.width = on.offsetWidth + 'px'; }
}
function renderStage() {
  let prevScroll = null;
  const sc = $('.tg-scroll', stage);
  if (sc) prevScroll = sc.scrollTop;
  if (ui.view === 'month') renderMonth();
  else if (ui.view === 'week') renderTimeGrid(weekDays());
  else if (ui.view === 'day') renderTimeGrid([fromKey(ui.selected)]);
  else renderYear();
  const root = stage.firstElementChild;
  if (ui.animate && root && !reduceMotion()) root.classList.add('view-anim', ...(ui.animate === 'left' ? ['from-left'] : []));
  const nsc = $('.tg-scroll', stage);
  if (nsc) {
    if (ui.resetScroll || prevScroll == null) nsc.scrollTop = Math.max(0, S().dayStartHour * hourH() - 8);
    else nsc.scrollTop = prevScroll;
    const tg = $('.tgrid', stage);
    tg.style.setProperty('--sbw', (nsc.offsetWidth - nsc.clientWidth) + 'px');
  }
  ui.resetScroll = false;
}
function weekDays() {
  const start = startOfWeek(fromKey(ui.selected), S().weekStart);
  const dows = visibleDows();
  const out = [];
  for (let i = 0; i < 7; i++) { const d = addDays(start, i); if (dows.includes(d.getDay())) out.push(d); }
  return out;
}

/* ---------- Month ---------- */
function chipHTML(ev, key) {
  const c = evColor(ev);
  return `<button class="chip-ev${ev.allDay ? ' allday' : ''}${ev.important ? ' imp' : ''}" style="--c:${c};--on-c:${readable(c)}" data-ev="${ev.id}" data-occ="${key}" draggable="true" title="${esc(ev.title || '(No title)')} · ${fmtRange(ev)}"><span class="d"></span>${ev.allDay ? '' : `<span class="t">${fmtTimeShort(ev.start)}</span>`}<span class="n">${ev.important ? icon('star', 'imp-ic') : ''}${esc(ev.title || '(No title)')}</span>${noteDot(ev.id, key)}</button>`;
}
function renderMonth() {
  const sel = fromKey(ui.selected);
  const y = sel.getFullYear(), m = sel.getMonth();
  const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
  const dows = visibleDows();
  const wk = S().showWeekNumbers;
  const tk = todayKey();
  const rows = [];
  for (let ws = startOfWeek(first, S().weekStart); ws <= last; ws = addDays(ws, 7)) {
    const days = [];
    for (let i = 0; i < 7; i++) { const d = addDays(ws, i); if (dows.includes(d.getDay())) days.push(d); }
    rows.push({ ws, days });
  }
  const cols = `${wk ? '34px ' : ''}repeat(${dows.length}, minmax(0, 1fr))`;
  let html = `<div class="month" style="--mcols:${cols};--rows:${rows.length}">
    <div class="month-head">${wk ? '<div class="wk-h">Wk</div>' : ''}${dows.map(d => `<div>${DOW3[d]}</div>`).join('')}</div>
    <div class="month-body">`;
  for (const row of rows) {
    html += `<div class="month-row">${wk ? `<div class="wk-num">${isoWeek(addDays(row.ws, 3))}</div>` : ''}`;
    for (const d of row.days) {
      const key = toKey(d);
      const evs = eventsOn(key), hols = holidaysOn(key), notes = notesOn(key);
      const cls = ['cell'];
      if (d.getMonth() !== m) cls.push('other');
      if (key === tk) cls.push('today');
      if (key === ui.selected) cls.push('selected');
      if (d.getDay() === 0 || d.getDay() === 6) cls.push('weekend');
      html += `<div class="${cls.join(' ')}" data-date="${key}">
        <div class="cell-top">
          <button class="daynum" data-goto-day="${key}" aria-label="${fmtDayLong(key)}">${d.getDate() === 1 ? `<span class="mon">${MON3[d.getMonth()]}</span>` : ''}${d.getDate()}</button>
          <div class="cell-actions">
            <button data-quick-event="${key}" title="Add event" aria-label="Add event">${icon('plus')}</button>
          </div>
        </div>
        <div class="cell-events" data-date="${key}">
          ${hols.map(h => holChip(h, key)).join('')}
          ${evs.map(ev => chipHTML(ev, key)).join('')}
        </div>
        ${S().notesInGrid && notes.length ? `<div class="cell-notes" data-open-board="${key}">
          ${notes.slice(0, 4).map(n => `<span class="mini-note${n.done ? ' done' : ''}${n.remindAt && !n.done ? ' rem' : ''}" style="--nc:${noteColor(n.color)};--rot:${n.rot * 2}deg" title="${esc(noteSummary(n))}"></span>`).join('')}
          ${notes.length === 1 ? `<span class="note-snippet">${esc(noteSummary(notes[0]))}</span>` : `<span class="note-count">${notes.length} notes</span>`}
        </div>` : ''}
      </div>`;
    }
    html += `</div>`;
  }
  html += `</div></div>`;
  stage.innerHTML = html;
  requestAnimationFrame(fitMonthChips);
}
function noteSummary(n) {
  if (n.mode === 'list') { const done = n.items.filter(i => i.done).length; return n.items.length ? `${n.items[0].text}${n.items.length > 1 ? ` (+${n.items.length - 1})` : ''} · ${done}/${n.items.length}` : 'Empty checklist'; }
  return (n.text || 'Empty note').split('\n')[0];
}
function fitMonthChips() {
  $$('.cell-events', stage).forEach(box => {
    box.querySelector('.more-btn')?.remove();
    const chips = $$('.chip-ev', box);
    chips.forEach(c => { c.hidden = false; });
    if (box.scrollHeight <= box.clientHeight + 1) return;
    const more = document.createElement('button');
    more.className = 'more-btn';
    more.dataset.more = box.dataset.date;
    box.appendChild(more);
    let hidden = 0;
    for (let i = chips.length - 1; i >= 0 && box.scrollHeight > box.clientHeight + 1; i--) {
      chips[i].hidden = true; hidden++;
      more.textContent = `+${hidden} more`;
    }
    if (!hidden) more.remove();
  });
}

/* ---------- Week / Day ---------- */
function layoutDay(items) {
  items.sort((a, b) => a.s - b.s || b.e - a.e);
  const out = [];
  let cluster = [], lanes = [], clusterEnd = -1;
  const flush = () => { const n = lanes.length; cluster.forEach(o => { o.n = n; }); cluster = []; lanes = []; clusterEnd = -1; };
  for (const it of items) {
    const e = Math.max(it.e, it.s + 20);
    if (cluster.length && it.s >= clusterEnd) flush();
    let lane = lanes.findIndex(end => end <= it.s);
    if (lane < 0) { lane = lanes.length; lanes.push(e); } else lanes[lane] = e;
    const o = { ...it, lane };
    cluster.push(o); out.push(o);
    clusterEnd = Math.max(clusterEnd, e);
  }
  flush();
  return out;
}
function tgEventHTML(o, key) {
  const ev = o.ev, HH = hourH();
  const c = evColor(ev);
  const top = o.s / 60 * HH, h = Math.max((o.e - o.s) / 60 * HH, 18);
  const short = o.e - o.s < 45;
  const past = dtOf(key, ev.end) < new Date();
  const w = 100 / o.n, l = o.lane * w;
  return `<div class="tg-ev${short ? ' short' : ''}${past ? ' past' : ''}" data-ev="${ev.id}" data-occ="${key}" style="--c:${c};--on-c:${readable(c)};top:${top}px;height:${h}px;left:calc(${l}% + 2px);width:calc(${w}% - 4px)" title="${esc(ev.title || '(No title)')}">
    <div class="ev-t">${esc(ev.title || '(No title)')}</div>
    <div class="ev-s">${short ? fmtTimeShort(ev.start) : fmtRange(ev)}${ev.location && !short ? ' · ' + esc(ev.location) : ''}</div>
    <div class="resize" aria-hidden="true"></div>
  </div>`;
}
function renderTimeGrid(days) {
  const keys = days.map(toKey);
  const tk = todayKey();
  const HH = hourH();
  const head = keys.map((k, i) => {
    const d = days[i];
    const notes = notesOn(k);
    return `<div class="tg-dh${k === tk ? ' today' : ''}${k === ui.selected ? ' selected' : ''}" data-date="${k}">
      <span class="dow">${DOW3[d.getDay()]}</span>
      <button class="dnum" data-goto-day="${k}" aria-label="${fmtDayLong(k)}">${d.getDate()}</button>
      <div class="dh-extra">${notes.length ? `<button class="dh-notes" data-open-board="${k}" title="${notes.length} note${notes.length > 1 ? 's' : ''}">${notes.slice(0, 3).map(n => `<span class="mini-note" style="--nc:${noteColor(n.color)};--rot:${n.rot * 2}deg"></span>`).join('')}${notes.length}</button>` : ''}</div>
    </div>`;
  }).join('');
  const allday = keys.map(k => {
    const hols = holidaysOn(k), evs = eventsOn(k).filter(e => e.allDay);
    return `<div class="tg-adcol" data-date="${k}">${hols.map(h => holChip(h, k)).join('')}${evs.map(ev => chipHTML(ev, k)).join('')}</div>`;
  }).join('');
  let hours = '';
  for (let h = 1; h < 24; h++) hours += `<span style="top:${h * HH}px">${fmtHour(h)}</span>`;
  const cols = keys.map((k, i) => {
    const d = days[i];
    const items = eventsOn(k).filter(e => !e.allDay).map(ev => ({ ev, s: minutesOf(ev.start), e: Math.max(minutesOf(ev.end), minutesOf(ev.start) + 15) }));
    const laid = layoutDay(items);
    const now = new Date();
    const nowLine = k === tk ? `<div class="now-line" style="top:${(now.getHours() * 60 + now.getMinutes()) / 60 * HH}px"></div>` : '';
    return `<div class="tg-col${k === tk ? ' today' : ''}${d.getDay() === 0 || d.getDay() === 6 ? ' weekend' : ''}" data-date="${k}">${laid.map(o => tgEventHTML(o, k)).join('')}${nowLine}</div>`;
  }).join('');
  const wkLabel = S().showWeekNumbers ? `W${isoWeek(days[0])}` : tzLabel();
  stage.innerHTML = `<div class="tgrid" style="--days:${days.length}">
    <div class="tg-head"><div class="tg-gutter">${wkLabel}</div>${head}</div>
    <div class="tg-allday"><div class="tg-gutter">all-day</div>${allday}</div>
    <div class="tg-scroll"><div class="tg-body"><div class="tg-hours">${hours}</div><div class="tg-cols">${cols}</div></div></div>
  </div>`;
  bindTimeGrid(keys);
}
function updateNowLine() {
  const HH = hourH();
  const now = new Date();
  $$('.now-line', stage).forEach(l => { l.style.top = (now.getHours() * 60 + now.getMinutes()) / 60 * HH + 'px'; });
}

/* Time grid pointer interactions: drag-to-create, move, resize */
function bindTimeGrid(keys) {
  const cols = $('.tg-cols', stage);
  const scroller = $('.tg-scroll', stage);
  const n = keys.length;
  let drag = null;
  const snap = m => Math.round(m / 15) * 15;
  const minuteAt = y => (y - cols.getBoundingClientRect().top) / hourH() * 60;
  const colAt = x => { const r = cols.getBoundingClientRect(); return clamp(Math.floor((x - r.left) / (r.width / n)), 0, n - 1); };
  const label = (s, e) => `${fmtTimeShort(timeOf(s))} – ${fmtTimeShort(timeOf(e))}`;

  cols.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    closeFloating();
    const evEl = e.target.closest('.tg-ev');
    const colEl = e.target.closest('.tg-col');
    if (!colEl) return;
    if (evEl) {
      const ev = findEvent(evEl.dataset.ev);
      if (!ev) return;
      const isResize = e.target.classList.contains('resize');
      if (e.pointerType === 'touch' && !isResize) return;
      e.preventDefault();
      const s = minutesOf(ev.start), en = Math.max(minutesOf(ev.end), s + 15);
      drag = { mode: isResize ? 'resize' : 'move', el: evEl, ev, occ: evEl.dataset.occ, x0: e.clientX, y0: e.clientY, s, e: en, dur: en - s, grab: minuteAt(e.clientY) - s, col: keys.indexOf(evEl.dataset.occ), moved: false };
    } else {
      if (e.pointerType === 'touch') return;
      e.preventDefault();
      const m0 = Math.floor(minuteAt(e.clientY) / 15) * 15;
      drag = { mode: 'create', col: colAt(e.clientX), anchor: m0, s: m0, e: m0 + 30, x0: e.clientX, y0: e.clientY, moved: false, el: null };
    }
    cols.setPointerCapture(e.pointerId);
  });
  cols.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) return;
    drag.moved = true;
    const sr = scroller.getBoundingClientRect();
    if (e.clientY < sr.top + 28) scroller.scrollTop -= 12;
    else if (e.clientY > sr.bottom - 28) scroller.scrollTop += 12;
    const HH = hourH();
    const pm = minuteAt(e.clientY);
    if (drag.mode === 'move') {
      const col = colAt(e.clientX);
      drag.s = clamp(snap(pm - drag.grab), 0, 1440 - drag.dur);
      drag.e = drag.s + drag.dur;
      drag.col = col;
      const target = cols.children[col];
      if (drag.el.parentElement !== target) target.appendChild(drag.el);
      Object.assign(drag.el.style, { top: drag.s / 60 * HH + 'px', left: '2px', width: 'calc(100% - 4px)' });
      drag.el.classList.add('dragging');
      $('.ev-s', drag.el).textContent = label(drag.s, drag.e);
    } else if (drag.mode === 'resize') {
      drag.e = clamp(snap(pm), drag.s + 15, 1440);
      drag.el.style.height = Math.max((drag.e - drag.s) / 60 * HH, 18) + 'px';
      drag.el.classList.add('dragging');
      $('.ev-s', drag.el).textContent = label(drag.s, drag.e);
    } else {
      const cur = snap(pm);
      drag.s = clamp(Math.min(drag.anchor, cur), 0, 1425);
      drag.e = clamp(Math.max(drag.anchor + 15, cur), drag.s + 15, 1440);
      if (!drag.el) {
        drag.el = document.createElement('div');
        drag.el.className = 'tg-ev ghost';
        drag.el.innerHTML = '<div class="ev-t">New event</div><div class="ev-s"></div>';
        cols.children[drag.col].appendChild(drag.el);
        Object.assign(drag.el.style, { left: '2px', width: 'calc(100% - 4px)' });
      }
      drag.el.style.top = drag.s / 60 * HH + 'px';
      drag.el.style.height = (drag.e - drag.s) / 60 * HH + 'px';
      $('.ev-s', drag.el).textContent = label(drag.s, drag.e);
    }
  });
  const finish = e => {
    if (!drag) return;
    const d = drag; drag = null;
    ui.suppressClick = Date.now() + 350;
    if (d.mode === 'create') {
      const date = keys[d.col];
      if (!d.moved) {
        const s = Math.floor(minuteAt(d.y0) / 30) * 30;
        const ghost = document.createElement('div');
        ghost.className = 'tg-ev ghost';
        ghost.innerHTML = '<div class="ev-t">New event</div>';
        Object.assign(ghost.style, { left: '2px', width: 'calc(100% - 4px)', top: s / 60 * hourH() + 'px', height: S().defaultDuration / 60 * hourH() + 'px' });
        cols.children[d.col].appendChild(ghost);
        openEditor({ date, start: timeOf(s), end: timeOf(Math.min(s + S().defaultDuration, 1439)) });
      } else {
        openEditor({ date, start: timeOf(d.s), end: timeOf(Math.min(d.e, 1439)) });
      }
      return;
    }
    if (!d.moved) { showEventPopover(d.ev, d.occ, d.el); return; }
    const patch = { date: keys[d.col], start: timeOf(d.s), end: timeOf(Math.min(d.e, 1439)) };
    changeOccurrence(d.ev, d.occ, patch, d.mode === 'move' ? `Moved to ${fmtDayShort(patch.date)}, ${fmtTime(patch.start)}` : `Now ends at ${fmtTime(patch.end)}`);
  };
  cols.addEventListener('pointerup', finish);
  cols.addEventListener('pointercancel', () => { if (drag) { drag = null; renderStage(); } });
  cols.addEventListener('click', e => {
    if (Date.now() < ui.suppressClick) return;
    const evEl = e.target.closest('.tg-ev:not(.ghost)');
    if (evEl) { const ev = findEvent(evEl.dataset.ev); if (ev) showEventPopover(ev, evEl.dataset.occ, evEl); return; }
    const colEl = e.target.closest('.tg-col');
    if (colEl) {
      const s = Math.floor(minuteAt(e.clientY) / 30) * 30;
      openEditor({ date: colEl.dataset.date, start: timeOf(s), end: timeOf(Math.min(s + S().defaultDuration, 1439)) });
    }
  });
}

/* ---------- Year ---------- */
function renderYear() {
  const y = fromKey(ui.selected).getFullYear();
  const tk = todayKey();
  const now = new Date();
  const dows = [0, 1, 2, 3, 4, 5, 6].map(i => (S().weekStart + i) % 7);
  const hols = S().showHolidays ? holidaysFor(y) : {};
  let html = `<div class="year">`;
  for (let m = 0; m < 12; m++) {
    const first = new Date(y, m, 1);
    const lead = (first.getDay() - S().weekStart + 7) % 7;
    let total = 0, cells = '';
    for (let i = 0; i < lead; i++) cells += '<span></span>';
    for (let d = 1; d <= daysInMonth(y, m); d++) {
      const key = toKey(new Date(y, m, d));
      const c = eventsOn(key).length + allNotesOn(key).length;
      total += c;
      const cls = ['ym-day'];
      if (c) cls.push(c >= 4 ? 'h3' : c >= 2 ? 'h2' : 'h1');
      if (hols[key]) cls.push('hol');
      const holStyle = hols[key] ? ` style="--hc:${holColor(hols[key][0])}"` : '';
      if (key === tk) cls.push('today');
      if (key === ui.selected) cls.push('sel');
      cells += `<button class="${cls.join(' ')}"${holStyle} data-date="${key}" data-goto-day="${key}" title="${fmtDayLong(key)}${c ? ` · ${c} item${c > 1 ? 's' : ''}` : ''}${hols[key] ? ' · ' + esc(hols[key].join(', ')) : ''}">${d}</button>`;
    }
    html += `<section class="ym${y === now.getFullYear() && m === now.getMonth() ? ' current' : ''}">
      <h3><button data-goto-month="${toKey(first)}">${MONTHS[m]}</button><span>${total ? `${total} item${total > 1 ? 's' : ''}` : ''}</span></h3>
      <div class="ym-grid">${dows.map(d => `<span class="ym-dow">${DOW3[d][0]}</span>`).join('')}${cells}</div>
    </section>`;
  }
  html += `<div class="year-legend">Less <i style="background:var(--surface-3)"></i><i class="ym-day h1"></i><i class="ym-day h2"></i><i class="ym-day h3"></i> More</div></div>`;
  stage.innerHTML = html;
}

/* ============================================================
   Today strip
   ============================================================ */
function renderToday() {
  renderNowCard();
  renderMini();
  renderImportant();
  renderUpNext();
  renderCalendars();
}
function renderNowCard() {
  const now = new Date();
  const h = now.getHours(), mi = now.getMinutes();
  const greet = h < 5 ? 'Up late' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Good night';
  const tk = todayKey();
  const evs = eventsOn(tk).length, notes = allNotesOn(tk).length;
  const sec = `<span class="nt-sec">:${pad(now.getSeconds())}</span>`;
  const clock = S().hour12 ? `${h % 12 || 12}:${pad(mi)}${sec}<span class="nt-ampm">${h < 12 ? 'AM' : 'PM'}</span>` : `${pad(h)}:${pad(mi)}${sec}`;
  $('#now-card').innerHTML = `
    <div class="now-greet">${greet}</div>
    <button class="now-time" data-goto-day="${tk}" aria-label="Open today, ${fmtDayLong(tk)}">${clock}</button>
    <div class="now-stats">
      <button data-goto-day="${tk}">${evs} event${evs === 1 ? '' : 's'}</button><span>·</span>
      <button data-open-board="${tk}">${notes} note${notes === 1 ? '' : 's'}</button><span>today</span>
    </div>`;
}
function renderMini() {
  if (!$('#mini')) return;
  const mc = ui.mini;
  const y = mc.getFullYear(), m = mc.getMonth();
  const start = startOfWeek(new Date(y, m, 1), S().weekStart);
  const tk = todayKey();
  const wk = S().showWeekNumbers;
  const selWeek = ui.view === 'week' ? weekDays().map(toKey) : [];
  let html = `<div class="mini-head"><strong>${MONTHS[m]} ${y}</strong><div>
    <button class="icon-btn sm" data-mini="-1" aria-label="Previous month">${icon('left')}</button>
    <button class="icon-btn sm" data-mini="1" aria-label="Next month">${icon('right')}</button></div></div>
    <div class="mini-grid${wk ? ' wk' : ''}">${wk ? '<span></span>' : ''}${[0, 1, 2, 3, 4, 5, 6].map(i => `<span class="mini-dow">${DOW3[(S().weekStart + i) % 7][0]}</span>`).join('')}`;
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    if (wk && i % 7 === 0) html += `<span class="mini-wk">${isoWeek(addDays(d, 3))}</span>`;
    const k = toKey(d);
    const cls = ['mini-day'];
    if (d.getMonth() !== m) cls.push('other');
    if (k === tk) cls.push('today');
    else if (k === ui.selected) cls.push('sel');
    if (selWeek.includes(k) && k !== tk) cls.push('inrange');
    if (eventsOn(k).length) cls.push('has');
    if (notesOn(k).length) cls.push('has-note');
    html += `<button class="${cls.join(' ')}" data-date="${k}" data-pick="${k}" aria-label="${fmtDayLong(k)}">${d.getDate()}</button>`;
  }
  $('#mini').innerHTML = html + '</div>';
}
function upcomingItems(limit = 6) {
  const now = new Date(), items = [];
  for (let i = 0; i < 21 && items.length < 40; i++) {
    const k = toKey(addDays(now, i));
    for (const ev of eventsOn(k)) {
      const at = ev.allDay ? dtOf(k, '00:00') : dtOf(k, ev.start);
      if (ev.allDay ? i === 0 || at > now : dtOf(k, ev.end) > now) items.push({ kind: 'event', ev, key: k, at });
    }
  }
  for (const n of state.notes) {
    if (n.remindAt && !n.done) { const at = parseLocal(n.remindAt); if (at > now) items.push({ kind: 'note', n, key: n.remindAt.slice(0, 10), at }); }
  }
  return items.sort((a, b) => a.at - b.at).slice(0, limit);
}
function renderUpNext() {
  const items = upcomingItems(40).filter(it => it.kind !== 'event' || !it.ev.important).slice(0, 5); /* starred ones live in Important */
  $('#upnext').innerHTML = items.length ? items.map(it => {
    if (it.kind === 'event') {
      const now = new Date();
      const live = !it.ev.allDay && it.at <= now;
      return `<li><button data-open-ev="${it.ev.id}" data-occ="${it.key}"><span class="u-dot" style="background:${evColor(it.ev)}"></span><span class="u-title">${esc(it.ev.title || '(No title)')}</span><span class="u-when">${live ? 'Happening now' : `${fmtDayShort(it.key)} · ${it.ev.allDay ? 'All day' : fmtTime(it.ev.start)}`}</span></button></li>`;
    }
    return `<li><button data-open-board="${it.key}"><span class="u-dot is-note" style="background:${noteColor(it.n.color)}"></span><span class="u-title">${esc(noteSummary(it.n))}</span><span class="u-when">${icon('alarm', 'tiny')} ${fmtStamp(it.n.remindAt)}</span></button></li>`;
  }).join('') : `<li class="empty-small">Nothing coming up. Enjoy the quiet.</li>`;
  $$('#upnext .tiny').forEach(s => { s.style.width = '11px'; s.style.height = '11px'; s.style.verticalAlign = '-1px'; });
}
/* Important: deadlines, tests and anything else flagged with a star, for the next 60 days */
function renderImportant() {
  const now = new Date(), items = [];
  for (let i = 0; i < 60 && items.length < 8; i++) {
    const k = toKey(addDays(now, i));
    for (const ev of eventsOn(k)) {
      if (!ev.important || items.some(it => it.ev === ev)) continue;
      if (!ev.allDay && dtOf(k, ev.end) <= now) continue;
      items.push({ ev, key: k, days: i });
    }
  }
  $('#ts-imp').hidden = !items.length;
  $('#important').innerHTML = items.map(({ ev, key, days }) => {
    const when = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
    return `<li><button class="imp-item${days <= 1 ? ' soon' : ''}" data-open-ev="${ev.id}" data-occ="${key}"><span class="u-dot u-star">${icon('star')}</span><span class="u-title">${esc(ev.title || '(No title)')}</span><span class="u-when"><b>${when}</b> · ${fmtDayShort(key) === when ? '' : fmtDayShort(key) + ' · '}${ev.allDay ? 'All day' : fmtTime(ev.start)}</span></button></li>`;
  }).join('');
}
function toggleImportant(ev) {
  snapshot();
  ev.important = !ev.important;
  save(); render();
  toast(ev.important ? 'Marked as important' : 'No longer important', { label: 'Undo', fn: undo });
}
function renderCalendars() {
  if (!$('#cal-list')) return;
  $('#cal-list').innerHTML = state.calendars.map(c => `
    <li class="cal-row${c.visible ? ' on' : ''}" style="--c:${paint(c.color)};--on-c:${readable(paint(c.color))}">
      <button class="cal-toggle" data-cal-toggle="${c.id}" aria-pressed="${c.visible}"><span class="cbox">${icon('check')}</span><span>${esc(c.name)}</span></button>
      <button class="icon-btn sm" data-cal-edit="${c.id}" aria-label="Edit ${esc(c.name)}">${icon('pencil')}</button>
    </li>`).join('') + `
    <li class="cal-row${S().showHolidays ? ' on' : ''}" style="--c:#8e8e93">
      <button class="cal-toggle" data-cal-toggle="__holidays" aria-pressed="${S().showHolidays}"><span class="cbox">${icon('check')}</span><span>US holidays</span></button>
    </li>`;
}

/* ============================================================
   Day board (agenda + sticky notes)
   ============================================================ */
function renderBoard() {
  const key = ui.selected;
  const d = fromKey(key);
  const evs = eventsOn(key), hols = holidaysOn(key), notes = notesOn(key);
  const now = new Date();
  const agenda = [
    ...hols.map(h => `<li><button class="ag-item holiday" style="--c:${holColor(h)}" data-hol="${esc(h)}" data-occ="${key}"><div class="ag-time">All day</div><div><div class="ag-title"><span class="d"></span><span>${esc(h)}</span></div><div class="ag-sub">US holiday</div></div></button>${evNotesHTML(holId(h), key)}</li>`),
    ...evs.map(ev => {
      const past = !ev.allDay && dtOf(key, ev.end) < now;
      const c = evColor(ev);
      return `<li><button class="ag-item${past ? ' past' : ''}" style="--c:${c}" data-open-ev="${ev.id}" data-occ="${key}">
        <div class="ag-time">${ev.allDay ? 'All day' : `${fmtTime(ev.start)}<small>${fmtTime(ev.end)}</small>`}</div>
        <div style="min-width:0"><div class="ag-title"><span class="d"></span><span>${esc(ev.title || '(No title)')}</span>${ev.repeat !== 'none' ? icon('repeat', 'tiny-ic') : ''}</div>
        ${ev.location || ev.calendarId ? `<div class="ag-sub">${esc([ev.location, calById(ev.calendarId)?.name].filter(Boolean).join(' · '))}</div>` : ''}</div>
      </button>${evNotesHTML(ev.id, key)}</li>`;
    }),
  ].join('');
  board.innerHTML = `
    <div class="board-head">
      <div class="bh-num">${d.getDate()}</div>
      <div class="bh-text"><span class="bh-dow">${DOW[d.getDay()]}</span><span class="bh-my">${MONTHS[d.getMonth()]} ${d.getFullYear()} · ${relDay(key)}</span></div>
      <div class="bh-actions">
        <button class="icon-btn sm" data-board-shift="-1" aria-label="Previous day" title="Previous day">${icon('left')}</button>
        <button class="icon-btn sm" data-board-shift="1" aria-label="Next day" title="Next day">${icon('right')}</button>
        <button class="icon-btn sm board-close" data-board-close aria-label="Close day board">${icon('x')}</button>
      </div>
    </div>
    <div class="board-sec">
      <div class="sec-title"><h3>Schedule</h3>${evs.length ? `<span class="count">${evs.length}</span>` : ''}<span class="sp"></span><button class="icon-btn sm" data-quick-event="${key}" aria-label="Add event" title="Add event">${icon('plus')}</button></div>
      ${agenda ? `<ul class="agenda">${agenda}</ul>` : `<div class="board-empty">Nothing scheduled. <button data-quick-event="${key}">Add an event</button></div>`}
    </div>
    ${notes.length ? `<div class="cork-wrap">
      <div class="sec-title"><h3>Loose notes</h3><span class="count">${notes.length}</span><span class="sp"></span></div>
      <div class="cork" data-cork="${key}">${notes.map(noteHTML).join('')}</div>
    </div>` : ''}`;
  $$('.tiny-ic', board).forEach(s => { s.style.cssText = 'width:12px;height:12px;color:var(--fg-3)'; });
  requestAnimationFrame(sizeCork);
  $$('.note-text', board).forEach(autosize);
}
function evNotesHTML(id, key) {
  const ns = evNotes(id, key);
  return `<div class="ev-notes">${ns.map(noteHTML).join('')}<button class="ev-add-note" data-add-note="${esc(id)}" data-occ="${key}" title="Attach a note">${icon('sticky')}${ns.length ? '' : 'Note'}</button></div>`;
}
function sizeCork() {
  const cork = $('.cork', board);
  if (!cork) return;
  let max = 0;
  $$('.note', cork).forEach(el => { max = Math.max(max, el.offsetTop + el.offsetHeight); });
  cork.style.minHeight = Math.max(380, max + 60) + 'px';
}
function autosize(t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }
function noteHTML(n) {
  const due = n.remindAt && !n.done && parseLocal(n.remindAt) <= new Date();
  const list = n.mode === 'list';
  const doneCount = n.items.filter(i => i.done).length;
  const body = list
    ? `<ul class="note-list">${n.items.map((it, i) => `<li class="nl-item${it.done ? ' checked' : ''}" data-i="${i}"><button class="nl-check" data-na="check" aria-label="Toggle item">${icon('check')}</button><span contenteditable="true" spellcheck="false" data-item-edit>${esc(it.text)}</span><button class="nl-del" data-na="del-item" aria-label="Remove item">${icon('x')}</button></li>`).join('')}<li><input class="nl-add" placeholder="+ add item" aria-label="Add checklist item"></li></ul>${n.items.length ? `<div class="nl-progress"><i style="width:${doneCount / n.items.length * 100}%"></i></div>` : ''}`
    : `<textarea class="note-text" rows="3" placeholder="Write something…" aria-label="Note text">${esc(n.text)}</textarea>`;
  const flow = !!n.evId;
  return `<div class="note${flow ? ' flow' : ''}${n.done ? ' done' : ''}" data-note="${n.id}" style="--nc:${noteColor(n.color)};--rot:${n.rot}deg;${flow ? '' : `left:calc((100% - 150px) * ${clamp(n.x, 0, 1)});top:${n.y}px;z-index:${n.z || 1}`}">
    <div class="note-tape"></div>
    <div class="note-bar"${flow ? '' : ' data-note-drag title="Drag to move. Drop on a calendar day to move it there."'}>
      ${icon('grip', 'grip')}
      <button data-na="palette" aria-label="Color and style" title="Color and style">${icon('drop')}</button>
      <button data-na="remind" class="${n.remindAt ? 'on' : ''}" aria-label="Reminder" title="Reminder">${icon('alarm')}</button>
      <button data-na="done" class="${n.done ? 'on' : ''}" aria-label="Mark done" title="Mark done">${icon('check')}</button>
      <button data-na="delete" aria-label="Delete note" title="Delete note">${icon('trash')}</button>
    </div>
    ${body}
    ${n.remindAt ? `<button class="note-rem${due ? ' due' : ''}" data-na="remind">${icon('alarm')}${fmtStamp(n.remindAt)}</button>` : ''}
  </div>`;
}
function rerenderNote(n, focusAdd = false) {
  const el = $(`.note[data-note="${n.id}"]`, board);
  if (!el) { renderBoard(); return; }
  const tmp = document.createElement('div');
  tmp.innerHTML = noteHTML(n);
  const fresh = tmp.firstElementChild;
  fresh.style.animation = 'none';
  el.replaceWith(fresh);
  $$('.note-text', fresh).forEach(autosize);
  if (focusAdd) $('.nl-add', fresh)?.focus();
  sizeCork();
}
function findSpot(key, w) {
  const notes = notesOn(key);
  const cork = $('.cork', board);
  const W = cork ? cork.clientWidth : 320;
  const colsN = Math.max(1, Math.floor((W - 8) / 160));
  for (let i = 0; i < 60; i++) {
    const c = i % colsN, r = Math.floor(i / colsN);
    const x = colsN === 1 ? 0.5 : c / (colsN - 1);
    const y = 18 + r * 168;
    const px = (W - 150) * x;
    const clash = notes.some(n => Math.abs((W - 150) * n.x - px) < 110 && Math.abs(n.y - y) < 120);
    if (!clash) return { x, y };
  }
  return { x: Math.random(), y: 18 + notes.length * 30 };
}
function maxZ(key) { return Math.max(0, ...notesOn(key).map(n => n.z || 0)); }
function addNote(key, opts = {}) {
  snapshot();
  const spot = opts.evId ? { x: 0, y: 0 } : opts.x != null ? { x: opts.x, y: opts.y } : findSpot(key);
  const last = state.notes[state.notes.length - 1];
  const palette = NOTE_COLORS.slice(0, 7).map(c => c.id).filter(c => c !== last?.color);
  const n = { id: uid(), evId: opts.evId || null, date: key, mode: opts.mode || 'text', text: opts.text || '', items: opts.items || [], color: opts.color || palette[Math.floor(Math.random() * palette.length)], x: spot.x, y: spot.y, rot: +(Math.random() * 6 - 3).toFixed(1), z: maxZ(key) + 1, remindAt: null, done: false };
  state.notes.push(n);
  save();
  ui.selected = key;
  ui.mini = fromKey(key);
  openBoardIfHidden();
  render();
  const el = $(`.note[data-note="${n.id}"]`, board);
  if (el) {
    el.scrollIntoView({ block: 'nearest', behavior: reduceMotion() ? 'auto' : 'smooth' });
    setTimeout(() => (el.querySelector('.note-text') || el.querySelector('.nl-add'))?.focus({ preventScroll: true }), 60);
  }
  return n;
}
function openBoardIfHidden() {
  if (window.innerWidth <= 1320) { ui.bdOverlay = true; syncOverlays(); }
  else if (!S().boardOpen) { S().boardOpen = true; save(); }
}
function deleteNote(n) {
  snapshot();
  const el = $(`.note[data-note="${n.id}"]`, board);
  const done = () => {
    state.notes = state.notes.filter(x => x !== n);
    save(); render();
    toast('Note removed', { label: 'Undo', fn: undo });
  };
  if (el && !reduceMotion()) { el.classList.add('leaving'); setTimeout(done, 280); } else done();
}
function moveNoteToDate(n, key) {
  if (n.date === key) return;
  snapshot();
  const from = n.date;
  n.date = key;
  const spot = findSpot(key);
  n.x = spot.x; n.y = spot.y; n.z = maxZ(key) + 1;
  save(); render();
  toast(`Note moved to ${fmtDayShort(key)}`, { label: 'Undo', fn: undo });
  void from;
}

/* ============================================================
   Events: edit, move, delete
   ============================================================ */
function changeOccurrence(ev, occ, patch, msg) {
  snapshot();
  if (ev.repeat !== 'none') {
    ev.exceptions = [...(ev.exceptions || []), occ];
    const nid = uid();
    state.events.push({ ...clone(ev), id: nid, repeat: 'none', until: null, exceptions: [], date: occ, ...patch });
    evNotes(ev.id, occ).forEach(n => { n.evId = nid; n.date = patch.date || occ; });
    msg = (msg ? msg + ' · ' : '') + 'only this occurrence';
  } else {
    if (patch.date && patch.date !== ev.date) evNotes(ev.id, ev.date).forEach(n => { n.date = patch.date; });
    Object.assign(ev, patch);
  }
  clearFiredFor(ev.id);
  save(); render();
  if (msg) toast(msg, { label: 'Undo', fn: undo });
}
function clearFiredFor(id) { for (const k in state.fired) if (k.startsWith(`e:${id}:`)) delete state.fired[k]; }
async function deleteEvent(ev, occ) {
  closeFloating();
  if (ev.repeat !== 'none') {
    const choice = await choiceDialog({
      title: 'Delete repeating event',
      body: `“${esc(ev.title || '(No title)')}” repeats ${repeatLabel(ev.repeat).toLowerCase()}.`,
      choices: [{ label: 'Only this one', value: 'one' }, { label: 'This and following', value: 'after' }, { label: 'All events', value: 'all', cls: 'danger' }],
    });
    if (!choice) return;
    snapshot();
    if (choice === 'one') ev.exceptions = [...(ev.exceptions || []), occ];
    else if (choice === 'after' && occ > ev.date) ev.until = toKey(addDays(fromKey(occ), -1));
    else state.events = state.events.filter(e => e !== ev);
  } else {
    snapshot();
    state.events = state.events.filter(e => e !== ev);
  }
  dropOrphanNotes();
  save(); render();
  toast('Event deleted', { label: 'Undo', fn: undo });
}
function dropOrphanNotes() {
  state.notes = state.notes.filter(n => { if (!n.evId || n.evId.startsWith('hol:')) return true; const e = findEvent(n.evId); return e && occursOn(e, n.date); });
}
function duplicateEvent(ev, occ) {
  snapshot();
  const copy = { ...clone(ev), id: uid(), date: occ, repeat: 'none', until: null, exceptions: [], title: ev.title + ' (copy)' };
  state.events.push(copy);
  save(); render();
  toast('Event duplicated', { label: 'Undo', fn: undo });
}

/* ============================================================
   Floating layers: popovers, menus, modals, drawers
   ============================================================ */
function closeFloating() { $$('.pop, .menu', layer).forEach(e => e.remove()); }
function placeAt(el, anchor) {
  const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y, width: 0 };
  const w = el.offsetWidth, h = el.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
  let left, top;
  if (anchor.getBoundingClientRect) {
    left = r.right + 10;
    top = r.top;
    if (left + w > vw - 12) left = r.left - w - 10;
    if (left < 12) { left = clamp(r.left + r.width / 2 - w / 2, 12, vw - w - 12); top = r.bottom + 8; if (top + h > vh - 12) top = r.top - h - 8; }
  } else { left = r.left; top = r.top; }
  el.style.left = clamp(left, 12, Math.max(12, vw - w - 12)) + 'px';
  el.style.top = clamp(top, 12, Math.max(12, vh - h - 12)) + 'px';
}
function openPop(html, anchor, cls = 'pop') {
  closeFloating();
  const el = document.createElement('div');
  el.className = cls;
  el.innerHTML = html;
  layer.appendChild(el);
  placeAt(el, anchor);
  return el;
}
document.addEventListener('pointerdown', e => {
  if (!e.target.closest('.pop, .menu')) closeFloating();
  if (!e.target.closest('#search')) $('#search-results').hidden = true;
}, true);

function showEventPopover(ev, occ, anchor) {
  const c = evColor(ev);
  const cal = calById(ev.calendarId);
  const el = openPop(`
    <div class="pop-head">
      <button class="icon-btn sm${ev.important ? ' on' : ''}" data-p="imp" aria-label="${ev.important ? 'Unmark important' : 'Mark as important'}" title="${ev.important ? 'Unmark important' : 'Mark as important'}">${icon('star')}</button>
      <button class="icon-btn sm" data-p="edit" aria-label="Edit" title="Edit (E)">${icon('pencil')}</button>
      <button class="icon-btn sm" data-p="dup" aria-label="Duplicate" title="Duplicate">${icon('copy')}</button>
      <button class="icon-btn sm" data-p="del" aria-label="Delete" title="Delete (Del)">${icon('trash')}</button>
      <button class="icon-btn sm" data-p="close" aria-label="Close">${icon('x')}</button>
    </div>
    <div class="pop-body">
      <div class="pop-title" style="--c:${c}"><span class="sw"></span><div><h3>${esc(ev.title || '(No title)')}</h3><p>${fmtDayLong(occ)} · ${fmtRange(ev)}</p></div></div>
      ${ev.repeat !== 'none' ? `<div class="pop-row">${icon('repeat')}<span>${repeatLabel(ev.repeat)}${ev.until ? ` until ${fmtDayShort(ev.until)}` : ''}</span></div>` : ''}
      ${ev.location ? `<div class="pop-row">${icon('pin')}<span>${esc(ev.location)}</span></div>` : ''}
      <div class="pop-row">${icon('bell')}<span>${ev.reminder == null ? 'No reminder' : reminderLabel(ev.reminder)}</span></div>
      ${cal ? `<div class="pop-row">${icon('cal')}<span>${esc(cal.name)}</span></div>` : ''}
      ${ev.description ? `<div class="pop-row">${icon('text')}<span class="desc">${esc(ev.description)}</span></div>` : ''}
      ${popNotesHTML(ev.id, occ)}
    </div>
    <div class="pop-foot"><span class="hint">Colour:</span><div class="swatches">${EVENT_COLORS.map(col => `<button class="swatch${ev.color === col ? ' on' : ''}" style="--sw:${paint(col)};width:20px;height:20px" data-recolor="${col}" aria-label="Colour ${col}"></button>`).join('')}</div></div>`, anchor);
  el.dataset.ev = ev.id;
  el.dataset.occ = occ;
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-p],[data-recolor]');
    if (!b) return;
    if (b.dataset.recolor) { snapshot(); ev.color = b.dataset.recolor; save(); render(); closeFloating(); return; }
    const a = b.dataset.p;
    if (a === 'close') closeFloating();
    if (a === 'note') { closeFloating(); addNote(occ, { evId: ev.id }); }
    if (a === 'imp') { closeFloating(); toggleImportant(ev); }
    if (a === 'edit') { closeFloating(); openEditor({ id: ev.id }); }
    if (a === 'dup') { closeFloating(); duplicateEvent(ev, occ); }
    if (a === 'del') deleteEvent(ev, occ);
  });
}

function popNotesHTML(id, key) {
  const ns = evNotes(id, key).filter(n => !noteEmpty(n));
  return `<div class="pop-row">${icon('sticky')}<div class="pop-notes">
    ${ns.map(n => `<button class="pop-note" style="--nc:${noteColor(n.color)};--rot:${n.rot}deg" data-open-board="${key}" title="Open note">${esc(noteSummary(n)).slice(0, 60)}</button>`).join('')}
    <button class="btn sm" data-p="note">${icon('plus')}${ns.length ? 'Another note' : 'Attach a note'}</button></div></div>`;
}
function showHolidayPopover(h, key, anchor) {
  const el = openPop(`
    <div class="pop-head"><button class="icon-btn sm" data-p="close" aria-label="Close">${icon('x')}</button></div>
    <div class="pop-body">
      <div class="pop-title" style="--c:${holColor(h)}"><span class="sw"></span><div><h3>${esc(h)}</h3><p>${fmtDayLong(key)} · US holiday</p></div></div>
      ${popNotesHTML(holId(h), key)}
    </div>`, anchor);
  el.addEventListener('click', e => {
    const a = e.target.closest('[data-p]')?.dataset.p;
    if (a === 'close') closeFloating();
    if (a === 'note') { closeFloating(); addNote(key, { evId: holId(h) }); }
  });
}
function openMenu(items, point) {
  const html = items.map(it => {
    if (it === '-') return '<hr>';
    if (it.label && it.header) return `<div class="menu-label">${it.label}</div>`;
    if (it.html) return it.html;
    if (!it.label) return '';
    return `<button data-mi="${it.id}" class="${it.danger ? 'danger' : ''}">${it.icon ? icon(it.icon) : ''}${it.label}${it.kbd ? `<kbd>${it.kbd}</kbd>` : ''}</button>`;
  }).join('');
  const el = openPop(html, point, 'menu');
  el.setAttribute('role', 'menu');
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-mi]');
    if (!b) return;
    const it = items.find(x => x.id === b.dataset.mi);
    closeFloating();
    it?.fn?.(b);
  });
  $('button', el)?.focus({ preventScroll: true });
  return el;
}

/* Modal helpers */
function openModal(html, cls = '') {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  layer.appendChild(wrap);
  wrap.addEventListener('pointerdown', e => { if (e.target === wrap) wrap._close?.(); });
  wrap._close = () => wrap.remove();
  return wrap;
}
function topModal() { const w = $$('.modal-wrap', layer); return w[w.length - 1]; }
function confirmDialog({ title, body, ok = 'Confirm', danger = false }) {
  return new Promise(res => {
    const w = openModal(`<div class="modal-head"><h2>${title}</h2></div><div class="modal-body"><p style="margin:0;color:var(--fg-2)">${body}</p></div>
      <div class="modal-foot"><span class="sp"></span><button class="btn ghost" data-r="0">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${ok}</button></div>`, 'sm');
    w._close = v => { w.remove(); res(!!v); };
    w.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) w._close(b.dataset.r === '1'); });
    $('[data-r="1"]', w).focus();
  });
}
function choiceDialog({ title, body, choices }) {
  return new Promise(res => {
    const w = openModal(`<div class="modal-head"><h2>${title}</h2></div><div class="modal-body"><p style="margin:0;color:var(--fg-2)">${body}</p></div>
      <div class="modal-foot" style="flex-wrap:wrap"><button class="btn ghost" data-c="">Cancel</button><span class="sp"></span>${choices.map(c => `<button class="btn ${c.cls || ''}" data-c="${c.value}">${c.label}</button>`).join('')}</div>`, 'sm');
    w._close = v => { w.remove(); res(v || null); };
    w.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) w._close(b.dataset.c); });
  });
}

/* ---------- Event editor ---------- */
let lastCal = null;
function openEditor(init = {}) {
  closeFloating();
  const existing = init.id ? findEvent(init.id) : null;
  const firstCal = state.calendars.find(c => c.visible) || state.calendars[0];
  const d = existing ? clone(existing) : {
    title: init.title || '', date: init.date || ui.selected, start: init.start || '09:00',
    end: init.end || timeOf(minutesOf(init.start || '09:00') + S().defaultDuration), allDay: !!init.allDay,
    calendarId: (lastCal && calById(lastCal)) ? lastCal : firstCal.id, color: null, location: '', description: '',
    reminder: S().defaultReminder, repeat: 'none', until: null, exceptions: [],
  };
  const edOcc = existing ? (occursOn(existing, ui.selected) ? ui.selected : existing.date) : null;
  const newId = uid();
  const w = openModal(`
    <form class="ev-form" novalidate>
      <div class="modal-head"><h2>${existing ? 'Edit event' : 'New event'}</h2><button type="button" class="icon-btn sm" data-x aria-label="Close">${icon('x')}</button></div>
      <div class="modal-body">
        <input class="title-input" id="ev-title" name="title" placeholder="Add a title" value="${esc(d.title)}" autocomplete="off" aria-label="Title">
        <div class="row">
          <div class="field"><label for="ev-date">Date</label><input class="input" type="date" id="ev-date" name="date" value="${d.date}" required></div>
          <div class="field tfield"><label for="ev-start">Starts</label><input class="input" type="time" id="ev-start" name="start" value="${d.start}" step="300"></div>
          <div class="field tfield"><label for="ev-end">Ends</label><input class="input" type="time" id="ev-end" name="end" value="${d.end}" step="300"></div>
        </div>
        <div class="row" style="gap:24px">
          <label class="toggle"><input type="checkbox" id="ev-allday" name="allDay" ${d.allDay ? 'checked' : ''}><span class="tr"></span>All day</label>
          <label class="toggle"><input type="checkbox" id="ev-important" name="important" ${d.important ? 'checked' : ''}><span class="tr"></span>Important <span class="hint">(deadline, test…)</span></label>
        </div>
        <div class="field"><span class="field-label">Calendar</span><div class="pill-group" id="ev-cals">${state.calendars.map(c => `<button type="button" class="pill${c.id === d.calendarId ? ' on' : ''}" data-cal="${c.id}" style="--c:${paint(c.color)}"><span class="d"></span>${esc(c.name)}</button>`).join('')}</div></div>
        <div class="field"><span class="field-label">Colour</span><div class="swatches" id="ev-colors">
          <button type="button" class="pill${!d.color ? ' on' : ''}" data-color="" style="height:26px">Calendar colour</button>
          ${EVENT_COLORS.map(c => `<button type="button" class="swatch${d.color === c ? ' on' : ''}" style="--sw:${paint(c)}" data-color="${c}" aria-label="Colour ${c}"></button>`).join('')}
          <label class="swatch custom" title="Custom colour"><input type="color" id="ev-custom-color" value="${d.color || '#a8d7ff'}" aria-label="Custom colour"></label>
        </div></div>
        <div class="row">
          <div class="field"><label for="ev-repeat">Repeat</label><select class="input" id="ev-repeat" name="repeat">${REPEATS.map(([v, l]) => `<option value="${v}"${d.repeat === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="field"><label for="ev-reminder">Reminder</label><select class="input" id="ev-reminder" name="reminder">${REMINDERS.map(([v, l]) => `<option value="${v ?? ''}"${d.reminder === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
        </div>
        <div class="field" id="ev-until-f"><label for="ev-until">Repeat until (optional)</label><input class="input" type="date" id="ev-until" name="until" value="${d.until || ''}"></div>
        <div class="icon-field">${icon('pin')}<input class="input" id="ev-location" name="location" placeholder="Add a location" value="${esc(d.location)}" aria-label="Location"></div>
        <div class="field"><span class="field-label">Notes</span>
          <div class="pop-notes" id="ev-notes">${existing ? evNotes(existing.id, edOcc).filter(n => !noteEmpty(n)).map(n => `<span class="pop-note" style="--nc:${noteColor(n.color)};--rot:${n.rot}deg">${esc(noteSummary(n)).slice(0, 60)}</span>`).join('') : ''}<button type="button" class="btn sm" data-attach>${icon('plus')}Attach a note</button></div>
          <textarea class="ed-note" id="ev-note" placeholder="Write your note…" aria-label="Note" hidden></textarea>
        </div>
        ${existing && existing.repeat !== 'none' ? `<p class="hint" style="margin:0">Changes apply to every repeat of this event.</p>` : ''}
        <p class="hint" id="ev-err" style="margin:0;color:var(--danger)" hidden></p>
      </div>
      <div class="modal-foot">
        ${existing ? `<button type="button" class="btn danger" data-del>${icon('trash')}Delete</button>` : ''}
        <span class="sp"></span>
        <span class="hint" style="margin-right:4px">Ctrl+Enter to save</span>
        <button type="button" class="btn ghost" data-x>Cancel</button>
        <button type="submit" class="btn primary">Save</button>
      </div>
    </form>`);
  const f = $('form', w);
  const syncAllDay = () => { $$('.tfield', f).forEach(x => { x.hidden = f.allDay.checked; }); };
  const syncRepeat = () => { $('#ev-until-f', f).hidden = f.repeat.value === 'none'; };
  syncAllDay(); syncRepeat();
  f.allDay.addEventListener('change', syncAllDay);
  f.repeat.addEventListener('change', syncRepeat);
  let dur = minutesOf(d.end) - minutesOf(d.start);
  f.start.addEventListener('change', () => { if (f.start.value) f.end.value = timeOf(minutesOf(f.start.value) + (dur > 0 ? dur : S().defaultDuration)); });
  f.end.addEventListener('change', () => { if (f.start.value && f.end.value) dur = minutesOf(f.end.value) - minutesOf(f.start.value); });
  f.addEventListener('click', e => {
    const cal = e.target.closest('[data-cal]');
    if (cal) { d.calendarId = cal.dataset.cal; $$('[data-cal]', f).forEach(b => b.classList.toggle('on', b === cal)); }
    const col = e.target.closest('[data-color]');
    if (col) { d.color = col.dataset.color || null; $$('#ev-colors [data-color]', f).forEach(b => b.classList.toggle('on', b === col)); }
    if (e.target.closest('[data-x]')) w._close();
    if (e.target.closest('[data-del]')) { w._close(); deleteEvent(existing, edOcc); }
    const att = e.target.closest('[data-attach]');
    if (att) { att.hidden = true; const t = $('#ev-note', f); t.hidden = false; t.focus(); }
  });
  $('#ev-custom-color', f).addEventListener('input', e => { d.color = e.target.value; $$('#ev-colors [data-color]', f).forEach(b => b.classList.remove('on')); });
  f.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); f.requestSubmit(); } });
  f.addEventListener('submit', e => {
    e.preventDefault();
    const err = $('#ev-err', f);
    const allDay = f.allDay.checked;
    if (!f.date.value) { err.textContent = 'Pick a date for this event.'; err.hidden = false; return; }
    if (!allDay && (!f.start.value || !f.end.value)) { err.textContent = 'Set a start and end time, or switch on All day.'; err.hidden = false; return; }
    if (!allDay && minutesOf(f.end.value) <= minutesOf(f.start.value)) { err.textContent = 'The end time needs to be after the start time.'; err.hidden = false; return; }
    snapshot();
    const out = {
      title: f.title.value.trim(), date: f.date.value, start: allDay ? '00:00' : f.start.value, end: allDay ? '23:59' : f.end.value, allDay,
      important: f.important.checked, calendarId: d.calendarId, color: d.color, location: f.location.value.trim(), description: d.description,
      reminder: f.reminder.value === '' ? null : Number(f.reminder.value), repeat: f.repeat.value, until: f.repeat.value !== 'none' && f.until.value ? f.until.value : null,
    };
    lastCal = d.calendarId;
    if (existing) { Object.assign(existing, out); clearFiredFor(existing.id); }
    else state.events.push({ id: newId, exceptions: [], ...out });
    const noteText = $('#ev-note', f).value.trim();
    if (noteText) {
      const palette = NOTE_COLORS.slice(0, 7);
      state.notes.push({ id: uid(), evId: existing ? existing.id : newId, date: existing && existing.repeat !== 'none' ? edOcc : out.date, mode: 'text', text: noteText, items: [], color: palette[Math.floor(Math.random() * palette.length)].id, x: 0, y: 0, rot: +(Math.random() * 6 - 3).toFixed(1), z: 1, remindAt: null, done: false });
    }
    save();
    w._close();
    ui.selected = out.date;
    ui.mini = fromKey(out.date);
    render();
    toast(existing ? 'Event updated' : `Event added to ${fmtDayShort(out.date)}`, { label: 'Undo', fn: undo });
  });
  const close0 = w._close;
  w._close = () => { close0(); if ($('.tg-ev.ghost', stage)) renderStage(); };
  setTimeout(() => $('#ev-title', w).focus(), 30);
}

/* ---------- Note reminder popover ---------- */
function openNoteReminder(n, anchor) {
  const now = new Date();
  const inMin = m => localStamp(new Date(now.getTime() + m * 60e3));
  const at = (key, t) => `${key}T${t}`;
  const tom = toKey(addDays(now, 1));
  const presets = [
    ['In 15 min', inMin(15)], ['In 1 hour', inMin(60)],
    ...(now.getHours() < 18 ? [['This evening', at(todayKey(), '18:00')]] : []),
    ['Tomorrow 9 AM', at(tom, '09:00')],
    ...(n.date > todayKey() ? [[`${fmtDayShort(n.date)} 9 AM`, at(n.date, '09:00')]] : []),
  ];
  const cur = n.remindAt || at(n.date >= todayKey() ? n.date : todayKey(), '09:00');
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const el = openPop(`
    <div class="pop-body" style="padding-top:16px">
      <div class="pop-title"><div><h3>Remind me</h3><p>${esc(noteSummary(n)).slice(0, 60)}</p></div></div>
      <div class="pill-group">${presets.map(([l, v]) => `<button class="pill" data-preset="${v}">${l}</button>`).join('')}</div>
      <div class="field"><label for="nr-dt">Pick a time</label><input class="input" type="datetime-local" id="nr-dt" value="${cur}"></div>
      ${perm === 'default' ? `<button class="btn sm ghost" data-perm style="align-self:flex-start">${icon('bell')}Also show desktop alerts</button>` : ''}
    </div>
    <div class="pop-foot">${n.remindAt ? `<button class="btn sm danger" data-clear>Remove reminder</button>` : ''}<span style="flex:1"></span><button class="btn sm primary" data-save>Set reminder</button></div>`, anchor);
  const apply = v => {
    if (!v) return;
    snapshot();
    n.remindAt = v.slice(0, 16);
    n.done = false;
    save(); closeFloating(); render();
    toast(`Reminder set for ${fmtStamp(n.remindAt)}`);
  };
  el.addEventListener('click', e => {
    const p = e.target.closest('[data-preset]');
    if (p) apply(p.dataset.preset);
    if (e.target.closest('[data-save]')) apply($('#nr-dt', el).value);
    if (e.target.closest('[data-clear]')) { snapshot(); n.remindAt = null; save(); closeFloating(); render(); toast('Reminder removed'); }
    if (e.target.closest('[data-perm]')) requestNotify();
  });
}

/* ---------- Calendar editor ---------- */
function openCalEditor(cal, anchor) {
  const isNew = !cal;
  const c = cal || { id: uid(), name: '', color: EVENT_COLORS[state.calendars.length % EVENT_COLORS.length], visible: true };
  const count = state.events.filter(e => e.calendarId === c.id).length;
  const el = openPop(`
    <div class="pop-body" style="padding-top:16px">
      <div class="field"><label for="cal-name">${isNew ? 'New calendar' : 'Calendar name'}</label><input class="input" id="cal-name" value="${esc(c.name)}" placeholder="e.g. School, Family, Side project"></div>
      <div class="swatches">${EVENT_COLORS.map(col => `<button class="swatch${c.color === col ? ' on' : ''}" style="--sw:${paint(col)}" data-col="${col}" aria-label="Colour ${col}"></button>`).join('')}<label class="swatch custom"><input type="color" id="cal-color" value="${c.color}" aria-label="Custom colour"></label></div>
    </div>
    <div class="pop-foot">${!isNew && state.calendars.length > 1 ? `<button class="btn sm danger" data-del>Delete</button>` : ''}<span style="flex:1"></span><button class="btn sm primary" data-save>${isNew ? 'Create' : 'Save'}</button></div>`, anchor);
  const name = $('#cal-name', el);
  setTimeout(() => name.focus(), 20);
  el.addEventListener('click', async e => {
    const s = e.target.closest('[data-col]');
    if (s) { c.color = s.dataset.col; $$('[data-col]', el).forEach(b => b.classList.toggle('on', b === s)); }
    if (e.target.closest('[data-save]')) commit();
    if (e.target.closest('[data-del]')) {
      closeFloating();
      const ok = await confirmDialog({ title: `Delete “${esc(c.name)}”?`, body: count ? `This also deletes its ${count} event${count > 1 ? 's' : ''}. You can undo right after.` : 'This calendar has no events.', ok: 'Delete calendar', danger: true });
      if (!ok) return;
      snapshot();
      state.calendars = state.calendars.filter(x => x.id !== c.id);
      state.events = state.events.filter(ev => ev.calendarId !== c.id);
      dropOrphanNotes();
      save(); render();
      toast('Calendar deleted', { label: 'Undo', fn: undo });
    }
  });
  $('#cal-color', el).addEventListener('input', e => { c.color = e.target.value; $$('[data-col]', el).forEach(b => b.classList.remove('on')); });
  name.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); });
  function commit() {
    snapshot();
    c.name = name.value.trim() || 'Untitled';
    if (isNew) state.calendars.push(c); else Object.assign(cal, c);
    save(); closeFloating(); render();
  }
}

/* ---------- Drawers ---------- */
let drawerKind = null;
function openDrawer(kind) {
  closeDrawer(true);
  drawerKind = kind;
  const el = document.createElement('aside');
  el.className = 'drawer';
  el.dataset.kind = kind;
  layer.appendChild(el);
  $('#scrim').hidden = false;
  if (kind === 'settings') renderSettings(el);
  if (kind === 'reminders') renderReminders(el);
  if (kind === 'shortcuts') renderShortcuts(el);
}
function closeDrawer(instant) {
  const el = $('.drawer', layer);
  drawerKind = null;
  if (!el) return;
  if (instant || reduceMotion()) el.remove();
  else { el.classList.add('leaving'); setTimeout(() => el.remove(), 210); }
  if (!ui.bdOverlay) $('#scrim').hidden = true;
}
function drawerShell(title, body) {
  return `<div class="drawer-head"><h2>${title}</h2><button class="icon-btn" data-drawer-close aria-label="Close">${icon('x')}</button></div><div class="drawer-body">${body}</div>`;
}
const tgl = (id, label, on) => `<label class="set-row toggle"><span>${label}</span><input type="checkbox" id="${id}" data-set="${id}" ${on ? 'checked' : ''}><span class="tr"></span></label>`;
function renderSettings(el) {
  const s = S();
  const scroll = $('.drawer-body', el)?.scrollTop || 0;
  const row = (label, control) => `<div class="set-row"><span>${label}</span>${control}</div>`;
  NOTE_FONTS.forEach(f => ensureFont(f.gf));
  el.innerHTML = drawerShell('Settings', `
    <section class="set-sec"><div class="set-head"><h3>Calendars</h3><button class="icon-btn sm" data-add-cal aria-label="Add calendar" title="Add calendar">${icon('plus')}</button></div>
      <div class="set-group"><ul class="cal-list" id="cal-list"></ul></div>
    </section>
    <section class="set-sec"><h3>Appearance</h3>
      <div class="set-group">
        <div class="set-pad"><div class="skins">${SKINS.filter(k => !k.scene).map(k => `<button class="skin${s.skin === k.id ? ' on' : ''}" data-skin="${k.id}" aria-pressed="${s.skin === k.id}">
          <div class="skin-prev${k.id === 'auto' ? ' auto' : ''}" style="${k.bg ? `--p-bg:${k.bg};--p-sf:${k.sf};--p-ac:${k.ac}` : '--p-sf:rgb(127 127 127 / .3);--p-ac:#888'}"><i></i><i><b></b></i></div>
          <span class="skin-name">${k.name}</span></button>`).join('')}</div></div>
        <div class="set-pad"><button class="scene-card${s.skin === 'rain' ? ' on' : ''}" data-skin="rain" aria-pressed="${s.skin === 'rain'}">
          <span class="scene-prev rain-prev" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
          <span class="scene-text"><b>Rain on glass</b><span>A night city behind a rainy window. Drops bead, slide and merge on the glass.</span></span></button></div>
        ${s.skin === 'rain' ? row('Rain', `<div class="seg">${RAIN_LEVELS.map(([id, name]) => `<button data-rain="${id}" class="${s.rainLevel === id ? 'active' : ''}">${name}</button>`).join('')}</div>`) : ''}
        ${row('Accent', `<div class="swatches">
          <button class="pill${!s.accent ? ' on' : ''}" data-accent="">Default</button>
          ${ACCENTS.map(a => `<button class="swatch${s.accent === a ? ' on' : ''}" style="--sw:${a}" data-accent="${a}" aria-label="Accent ${a}"></button>`).join('')}
          <label class="swatch custom${s.accent && !ACCENTS.includes(s.accent) ? ' on' : ''}" title="Custom accent"><input type="color" id="set-accent" value="${s.accent || '#111111'}" aria-label="Custom accent"></label></div>`)}
      </div>
    </section>
    <section class="set-sec"><h3>Typeface</h3>
      <div class="font-cards">${FONTS.map(f => `<button class="font-card${s.font === f.id ? ' on' : ''}" data-font="${f.id}"><span class="fc-a" style="font-family:${attrFont(f.display)}, sans-serif;font-weight:700">Aa 23</span><span class="fc-n">${f.name}</span></button>`).join('')}</div>
    </section>
    <section class="set-sec"><h3>Note font</h3>
      <div class="font-cards">${NOTE_FONTS.map(f => `<button class="font-card${s.noteFont === f.id ? ' on' : ''}" data-notefont="${f.id}"><span class="fc-a" style="font-family:${attrFont(f.family)}, cursive;font-size:${f.size + 3}px">Buy milk</span><span class="fc-n">${f.name}</span></button>`).join('')}</div>
    </section>
    <section class="set-sec"><h3>Layout</h3>
      <div class="set-group">
        ${row('Corner roundness', `<input type="range" class="range" min="2" max="22" step="1" value="${s.radius}" id="set-radius" aria-label="Corner roundness">`)}
        ${row('Density', `<div class="seg"><button data-density="comfortable" class="${s.density === 'comfortable' ? 'active' : ''}">Comfortable</button><button data-density="compact" class="${s.density === 'compact' ? 'active' : ''}">Compact</button></div>`)}
        ${row('Event style', `<div class="seg">${[['tinted', 'Gray'], ['solid', 'Solid'], ['outline', 'Outline']].map(([v, l]) => `<button data-evstyle="${v}" class="${s.eventStyle === v ? 'active' : ''}">${l}</button>`).join('')}</div>`)}
      </div>
    </section>
    <section class="set-sec"><h3>Calendar</h3>
      <div class="set-group">
        ${row('Week starts on', `<select class="input" id="set-weekstart">${[[0, 'Sunday'], [1, 'Monday'], [6, 'Saturday']].map(([v, l]) => `<option value="${v}"${s.weekStart === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`)}
        ${row('Clock', `<div class="seg"><button data-hour12="1" class="${s.hour12 ? 'active' : ''}">12-hour</button><button data-hour12="0" class="${!s.hour12 ? 'active' : ''}">24-hour</button></div>`)}
        ${tgl('showWeekends', 'Show weekends', s.showWeekends)}
        ${tgl('showWeekNumbers', 'Show week numbers', s.showWeekNumbers)}
        ${tgl('showHolidays', 'Show US holidays', s.showHolidays)}
        ${tgl('notesInGrid', 'Show notes in month view', s.notesInGrid)}
        ${row('Day view starts at', `<select class="input" id="set-dayStartHour">${Array.from({ length: 13 }, (_, h) => `<option value="${h}"${s.dayStartHour === h ? ' selected' : ''}>${fmtHour(h)}</option>`).join('')}</select>`)}
        ${row('Default event length', `<select class="input" id="set-defaultDuration">${[15, 30, 45, 60, 90, 120].map(v => `<option value="${v}"${s.defaultDuration === v ? ' selected' : ''}>${v < 60 ? v + ' min' : v / 60 + ' hr'}</option>`).join('')}</select>`)}
        ${row('Default reminder', `<select class="input" id="set-defaultReminder">${REMINDERS.map(([v, l]) => `<option value="${v ?? ''}"${s.defaultReminder === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`)}
      </div>
    </section>
    <section class="set-sec"><h3>Reminders</h3>
      ${permCard()}
      <div class="set-group">
        ${tgl('sound', 'Play a sound', s.sound)}
        ${row('Sound', `<div style="display:flex;gap:6px"><select class="input" id="set-soundType">${['chime', 'marimba', 'ping'].map(v => `<option value="${v}"${s.soundType === v ? ' selected' : ''}>${v[0].toUpperCase() + v.slice(1)}</option>`).join('')}</select><button class="btn sm" data-test-sound>${icon('volume')}Test</button></div>`)}
        ${row('Preview a reminder', `<button class="btn sm" data-test-reminder>${icon('bell')}Send test</button>`)}
      </div>
    </section>
    <section class="set-sec"><h3>Your data</h3>
      <p class="hint" style="margin:0 4px">Everything is saved in this browser. Back it up to move it to another device.</p>
      <div class="set-actions">
        <button class="btn sm" data-shortcuts>${icon('keyboard')}Keyboard shortcuts</button>
        <button class="btn sm" data-export>${icon('download')}Export</button>
        <button class="btn sm" data-copy-backup>${icon('copy')}Copy</button>
        <button class="btn sm" data-import>${icon('upload')}Import</button>
        <button class="btn sm danger" data-reset>${icon('trash')}Erase everything</button>
      </div>
    </section>`);
  renderCalendars();
  $('.drawer-body', el).scrollTop = scroll;
}
function permCard() {
  const p = 'Notification' in window ? Notification.permission : 'unsupported';
  const txt = {
    granted: ['Desktop alerts are on', 'Reminders pop up even when this tab is in the background.'],
    denied: ['Desktop alerts are blocked', 'Allow notifications for this site in your browser settings. In-app alerts still work.'],
    default: ['Desktop alerts are off', 'Turn them on to get reminders outside this tab.'],
    unsupported: ['Desktop alerts aren’t available here', 'Reminders appear inside Chronos with a sound.'],
  }[p];
  return `<div class="perm">${icon('bell')}<div class="st"><b>${txt[0]}</b><span>${txt[1]}</span></div>${p === 'default' ? '<button class="btn sm primary" data-perm>Turn on</button>' : ''}</div>`;
}
function renderReminders(el) {
  const now = new Date();
  const items = [];
  for (let i = 0; i < 14; i++) {
    const k = toKey(addDays(now, i));
    for (const ev of eventsOn(k)) {
      if (ev.reminder == null) continue;
      const trig = new Date((ev.allDay ? dtOf(k, '09:00') : dtOf(k, ev.start)).getTime() - ev.reminder * 60e3);
      if (trig > now) items.push({ at: trig, html: `<li class="rem-item" style="--c:${evColor(ev)}"><div class="rem-ico">${icon('cal')}</div><button class="rem-main" style="text-align:left" data-open-ev="${ev.id}" data-occ="${k}"><b>${esc(ev.title || '(No title)')}</b><span>${fmtDayShort(k)} · ${fmtRange(ev)}</span></button><span class="rem-when">${fmtTime(timeOf(trig.getHours() * 60 + trig.getMinutes()))}</span></li>` });
    }
  }
  for (const n of state.notes) {
    if (!n.remindAt || n.done) continue;
    const at = parseLocal(n.remindAt);
    if (at > now) items.push({ at, html: `<li class="rem-item" style="--c:${noteColor(n.color)}"><div class="rem-ico is-note">${icon('sticky')}</div><button class="rem-main" style="text-align:left" data-open-board="${n.date}"><b>${esc(noteSummary(n))}</b><span>Note · ${fmtDayShort(n.date)}</span></button><span class="rem-when">${fmtTime(n.remindAt.slice(11))}</span></li>` });
  }
  items.sort((a, b) => a.at - b.at);
  let body = permCard();
  if (!items.length) body += `<div class="board-empty">No reminders in the next two weeks.<br>Set one on any event, or tap the alarm on a note.</div>`;
  let lastDay = '';
  let list = '';
  for (const it of items) {
    const k = toKey(it.at);
    if (k !== lastDay) { if (list) list += '</ul>'; list += `<div class="day-label">${fmtDayShort(k)}</div><ul class="rem-list">`; lastDay = k; }
    list += it.html;
  }
  if (list) list += '</ul>';
  el.innerHTML = drawerShell('Reminders', body + `<div>${list}</div>`);
}
function renderShortcuts(el) {
  const rows = [
    ['Go to today', ['T']], ['Previous / next month', ['←', '→']],
    ['New event', ['C']], ['Search', ['/']], ['Toggle day board', ['B']],
    ['Settings', [',']], ['Reminders', ['R']], ['Undo', ['Ctrl', 'Z']], ['Close anything', ['Esc']],
  ];
  el.innerHTML = drawerShell('Shortcuts', `<div class="keys">${rows.map(([l, k]) => `<span>${l}</span><span class="k">${k.map(x => `<kbd>${x}</kbd>`).join('')}</span>`).join('')}</div>
    <section class="set-sec"><h3>Mouse & touch</h3><div class="keys tips">
      <span>Drag event chips between days in Month view.</span>
      <span>Click any event or holiday, then Attach a note to stick a post-it on it.</span>
      <span>Right-click a day, event or note for more options.</span>
      <span>Swipe left or right on a phone to change months.</span>
    </div></section>`);
}

/* ============================================================
   Toasts, sound, confetti, notifications
   ============================================================ */
function toast(msg, action, ms = 4200) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  const kill = () => { if (!t.isConnected) return; t.classList.add('leaving'); setTimeout(() => t.remove(), 240); };
  if (action) $('button', t).addEventListener('click', () => { action.fn(); kill(); });
  $('#toasts').appendChild(t);
  const all = $$('#toasts .toast');
  if (all.length > 3) all[0].remove();
  setTimeout(kill, ms);
}
let actx = null;
function audio() {
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { actx = null; }
  return actx;
}
function playSound(type = S().soundType, force = false) {
  if (!S().sound && !force) return;
  const ctx = audio();
  if (!ctx) return;
  const seqs = { chime: [[880, 0], [1318.5, 0.16]], marimba: [[523.25, 0], [659.25, 0.11], [783.99, 0.22], [1046.5, 0.33]], ping: [[1567.98, 0], [2093, 0.09]] };
  const now = ctx.currentTime;
  for (const [f, t] of seqs[type] || seqs.chime) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type === 'marimba' ? 'triangle' : 'sine';
    o.frequency.value = f;
    const len = type === 'ping' ? 0.5 : 1.1;
    g.gain.setValueAtTime(0.0001, now + t);
    g.gain.exponentialRampToValueAtTime(0.22, now + t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t + len);
    o.connect(g).connect(ctx.destination);
    o.start(now + t); o.stop(now + t + len + 0.05);
  }
}
document.addEventListener('pointerdown', () => { if (!actx && S().sound) audio(); }, { once: true });

function confetti(originEl) {
  if (reduceMotion()) return;
  const c = document.createElement('canvas');
  c.className = 'confetti';
  const dpr = window.devicePixelRatio || 1;
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  c.style.width = innerWidth + 'px'; c.style.height = innerHeight + 'px';
  document.body.appendChild(c);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const r = originEl ? originEl.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
  const ox = r.left + r.width / 2, oy = r.top + r.height / 3;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const cols = [...NOTE_COLORS.slice(0, 7).map(x => x.c), accent];
  const parts = Array.from({ length: 90 }, () => ({
    x: ox, y: oy, vx: (Math.random() - 0.5) * 11, vy: -Math.random() * 11 - 3, w: 5 + Math.random() * 6, h: 3 + Math.random() * 5,
    rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, col: cols[Math.floor(Math.random() * cols.length)],
  }));
  const t0 = performance.now();
  (function frame(t) {
    const life = (t - t0) / 1600;
    g.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.32; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = Math.max(0, 1 - life);
      g.fillStyle = p.col; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
    }
    if (life < 1) requestAnimationFrame(frame); else c.remove();
  })(t0);
}

async function requestNotify() {
  if (!('Notification' in window)) { toast('This browser can’t show desktop alerts. In-app reminders still work.'); return; }
  try {
    const p = await Notification.requestPermission();
    toast(p === 'granted' ? 'Desktop alerts are on' : 'Desktop alerts stay off. In-app reminders still work.');
  } catch (e) { toast('Desktop alerts aren’t available here. In-app reminders still work.'); }
  if (drawerKind) openDrawer(drawerKind);
}
function desktopNotify(title, body, tag) {
  try {
    if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
      const n = new Notification(title, { body, tag, renotify: true });
      n.onclick = () => { window.focus(); n.close(); };
    }
  } catch (e) { /* ignore */ }
}

/* ============================================================
   Reminder engine
   ============================================================ */
const activeReminders = new Map();
function checkReminders() {
  const now = Date.now();
  const from = now - 12 * 3600e3;
  const due = [];
  for (const ev of state.events) {
    if (ev.reminder == null || !calVisible(ev.calendarId)) continue;
    for (let off = -1; off <= 2; off++) {
      const k = toKey(addDays(new Date(), off));
      if (!occursOn(ev, k)) continue;
      const start = (ev.allDay ? dtOf(k, '09:00') : dtOf(k, ev.start)).getTime();
      const trig = start - ev.reminder * 60e3;
      const key = `e:${ev.id}:${k}:${ev.reminder}`;
      if (trig <= now && trig > from && !state.fired[key]) due.push({ kind: 'event', key, ev, occ: k, trig, start });
    }
  }
  for (const n of state.notes) {
    if (!n.remindAt || n.done) continue;
    const trig = parseLocal(n.remindAt).getTime();
    const key = `n:${n.id}:${n.remindAt}`;
    if (trig <= now && trig > from && !state.fired[key]) due.push({ kind: 'note', key, n, trig });
  }
  state.snoozes = state.snoozes.filter(s => {
    if (s.at > now) return true;
    const ev = findEvent(s.ev);
    if (ev) { const start = (ev.allDay ? dtOf(s.occ, '09:00') : dtOf(s.occ, ev.start)).getTime(); due.push({ kind: 'event', key: s.key + ':s' + s.at, ev, occ: s.occ, trig: s.at, start, snoozed: true }); }
    return false;
  });
  if (!due.length) return;
  due.sort((a, b) => a.trig - b.trig);
  for (const d of due) { state.fired[d.key] = now; fireReminder(d, now - d.trig > 3 * 60e3); }
  save();
  playSound();
  render();
}
function fireReminder(d, missed) {
  const t = document.createElement('div');
  let title, sub, ntitle;
  if (d.kind === 'event') {
    const ev = d.ev;
    const mins = Math.round((d.start - Date.now()) / 60e3);
    const when = ev.allDay ? 'All day' : mins > 1 ? `Starts in ${mins >= 60 ? Math.round(mins / 60) + ' hr' : mins + ' min'}` : mins >= -1 ? 'Starting now' : `Started at ${fmtTime(ev.start)}`;
    t.className = 'rtoast';
    title = ev.title || '(No title)';
    sub = `${fmtDayShort(d.occ)} · ${ev.allDay ? 'All day' : fmtRange(ev)}${ev.location ? ' · ' + ev.location : ''}`;
    ntitle = `${title} · ${when}`;
    t.innerHTML = `<div class="rt-kicker">${icon('bell')}${missed ? 'Missed reminder' : when}</div><div class="rt-title">${esc(title)}</div><div class="rt-sub">${esc(sub)}</div>
      <div class="rt-actions"><button class="main" data-rt="open">Open</button><button data-rt="snooze">Snooze 10 min</button><button data-rt="dismiss">Dismiss</button></div>`;
  } else {
    const n = d.n;
    t.className = 'rtoast is-note';
    t.style.setProperty('--nc', noteColor(n.color));
    title = noteSummary(n);
    ntitle = 'Note reminder';
    sub = fmtDayShort(n.date);
    const full = n.mode === 'list' ? n.items.filter(i => !i.done).map(i => '• ' + i.text).join('\n') || title : (n.text || 'Empty note');
    t.innerHTML = `<div class="rt-kicker">${icon('bell')}${missed ? 'Missed reminder' : 'Reminder'} · ${esc(sub)}</div><div class="rt-title">${esc(full.slice(0, 220))}</div>
      <div class="rt-actions"><button class="main" data-rt="done">Mark done</button><button data-rt="snooze">Snooze 10 min</button><button data-rt="open">Open</button><button data-rt="dismiss">Dismiss</button></div>`;
  }
  const kill = () => { t.classList.add('leaving'); setTimeout(() => { t.remove(); activeReminders.delete(d.key); updateTitleBadge(); }, 240); };
  t.addEventListener('click', e => {
    const a = e.target.closest('[data-rt]')?.dataset.rt;
    if (!a) return;
    if (a === 'open') {
      if (d.kind === 'event') { goTo(d.occ); setTimeout(() => { const el = $(`[data-ev="${d.ev.id}"]`, stage) || $(`[data-open-ev="${d.ev.id}"]`, board); if (el) showEventPopover(d.ev, d.occ, el); }, 50); }
      else { goTo(d.n.date); openBoardIfHidden(); render(); }
    }
    if (a === 'snooze') {
      if (d.kind === 'event') state.snoozes.push({ ev: d.ev.id, occ: d.occ, key: d.key, at: Date.now() + 10 * 60e3 });
      else d.n.remindAt = localStamp(new Date(Date.now() + 10 * 60e3));
      save(); render(); toast('Snoozed for 10 minutes');
    }
    if (a === 'done' && d.kind === 'note') { d.n.done = true; save(); render(); confetti(t); }
    kill();
  });
  $('#toasts').appendChild(t);
  activeReminders.set(d.key, t);
  updateTitleBadge();
  desktopNotify(ntitle, d.kind === 'event' ? sub : (d.n.text || noteSummary(d.n)), d.key);
}
const BASE_TITLE = document.title;
function updateTitleBadge() { document.title = activeReminders.size ? `(${activeReminders.size}) Reminder · ${BASE_TITLE}` : BASE_TITLE; }
function updateBadge() {
  const now = new Date();
  const end = dtOf(todayKey(), '23:59');
  let count = 0;
  const tk = todayKey(), tom = toKey(addDays(now, 1));
  for (const k of [tk, tom]) for (const ev of eventsOn(k)) {
    if (ev.reminder == null) continue;
    const trig = new Date((ev.allDay ? dtOf(k, '09:00') : dtOf(k, ev.start)).getTime() - ev.reminder * 60e3);
    if (trig > now && trig <= end) count++;
  }
  for (const n of state.notes) if (n.remindAt && !n.done) { const at = parseLocal(n.remindAt); if (at > now && at <= end) count++; }
  const b = $('#bell-badge');
  b.hidden = !count;
  b.textContent = count;
  $('#btn-bell').title = count ? `${count} reminder${count > 1 ? 's' : ''} left today` : 'Reminders';
}

/* ============================================================
   Navigation
   ============================================================ */
function goTo(key, view) {
  const prev = ui.selected;
  ui.selected = key;
  ui.mini = fromKey(key);
  view = null; /* month view only */
  if (view && view !== ui.view) { ui.view = view; S().view = view; save(); ui.animate = 'in'; ui.resetScroll = true; }
  else if (key !== prev) {
    const changedPage = ui.view === 'month' ? key.slice(0, 7) !== prev.slice(0, 7) : ui.view === 'year' ? key.slice(0, 4) !== prev.slice(0, 4) : ui.view === 'day' || !weekDays().map(toKey).includes(prev);
    if (changedPage) { ui.animate = key < prev ? 'left' : 'in'; ui.resetScroll = true; }
  }
  render();
}
function shift(dir) {
  const d = fromKey(ui.selected);
  let n;
  if (ui.view === 'month') n = addMonths(d, dir);
  else if (ui.view === 'week') n = addDays(d, 7 * dir);
  else if (ui.view === 'day') { n = addDays(d, dir); if (!S().showWeekends) while (n.getDay() === 0 || n.getDay() === 6) n = addDays(n, dir); }
  else n = addMonths(d, 12 * dir);
  ui.animate = dir < 0 ? 'left' : 'in';
  ui.resetScroll = true;
  ui.selected = toKey(n);
  ui.mini = n;
  render();
}
function setView(v) { goTo(ui.selected, v); }
function selectDay(key, fromTap) {
  const wasSelected = ui.selected === key;
  ui.selected = key;
  ui.mini = fromKey(key);
  if (window.innerWidth <= 760 || (fromTap && wasSelected && window.innerWidth <= 1320)) { ui.bdOverlay = true; syncOverlays(); }
  render();
}
function syncOverlays() {
  const app = $('#app');
  app.classList.toggle('bd-open', ui.bdOverlay);
  $('#scrim').hidden = !(ui.bdOverlay || drawerKind);
}
function toggleBoard() {
  if (window.innerWidth <= 1320) { ui.bdOverlay = !ui.bdOverlay; syncOverlays(); }
  /* wide screens: the board can't be closed */
}

/* ============================================================
   Event wiring
   ============================================================ */
function goToday() { const tk = todayKey(); ui.animate = tk < ui.selected ? 'left' : 'in'; ui.resetScroll = true; ui.selected = tk; ui.mini = new Date(); render(); }
$('#btn-prev').addEventListener('click', () => shift(-1));
$('#btn-next').addEventListener('click', () => shift(1));
$('#btn-board').addEventListener('click', toggleBoard);
$('#btn-settings').addEventListener('click', () => openDrawer('settings'));
$('#btn-bell').addEventListener('click', () => openDrawer('reminders'));
$('#btn-fab').addEventListener('click', () => openEditor({ date: ui.selected }));
layer.addEventListener('click', e => { const b = e.target.closest('[data-add-cal]'); if (b) openCalEditor(null, b); });
$('#scrim').addEventListener('click', () => { ui.bdOverlay = false; closeDrawer(); syncOverlays(); });

/* Shared delegated clicks (today strip, stage, board, drawers) */
document.addEventListener('click', e => {
  const t = e.target;
  let el;
  if ((el = t.closest('[data-drawer-close]'))) { closeDrawer(); syncOverlays(); return; }
  if ((el = t.closest('[data-goto-day]'))) { e.stopPropagation(); selectDay(el.dataset.gotoDay, true); closeDrawer(); return; }
  if ((el = t.closest('[data-goto-month]'))) { goTo(el.dataset.gotoMonth, 'month'); return; }
  if ((el = t.closest('[data-pick]'))) { ui.selected = el.dataset.pick; ui.animate = 'in'; ui.resetScroll = true; render(); return; }
  if ((el = t.closest('[data-mini]'))) { ui.mini = addMonths(new Date(ui.mini.getFullYear(), ui.mini.getMonth(), 1), +el.dataset.mini); renderMini(); return; }
  if ((el = t.closest('[data-open-board]'))) { e.stopPropagation(); ui.selected = el.dataset.openBoard; ui.mini = fromKey(ui.selected); openBoardIfHidden(); closeDrawer(); render(); return; }
  if ((el = t.closest('[data-add-note]'))) { e.stopPropagation(); addNote(el.dataset.occ, { evId: el.dataset.addNote }); return; }
  if ((el = t.closest('[data-hol]'))) { e.stopPropagation(); showHolidayPopover(el.dataset.hol, el.dataset.occ, el); return; }
  if ((el = t.closest('[data-quick-event]'))) { e.stopPropagation(); openEditor({ date: el.dataset.quickEvent }); return; }
  if ((el = t.closest('[data-more]'))) { e.stopPropagation(); selectDay(el.dataset.more, true); return; }
  if ((el = t.closest('[data-open-ev]'))) { const ev = findEvent(el.dataset.openEv); if (ev) { if (drawerKind) { closeDrawer(); goTo(el.dataset.occ); } showEventPopover(ev, el.dataset.occ, el); } return; }
  if ((el = t.closest('[data-cal-toggle]'))) {
    const id = el.dataset.calToggle;
    if (id === '__holidays') S().showHolidays = !S().showHolidays;
    else { const c = calById(id); c.visible = !c.visible; }
    save(); render(); return;
  }
  if ((el = t.closest('[data-cal-edit]'))) { openCalEditor(calById(el.dataset.calEdit), el); return; }
  if ((el = t.closest('[data-board-shift]'))) { goTo(toKey(addDays(fromKey(ui.selected), +el.dataset.boardShift))); return; }
  if ((el = t.closest('[data-board-close]'))) { ui.bdOverlay = false; syncOverlays(); return; }
  if (t.closest('.stage .chip-ev:not(.holiday)')) { el = t.closest('.chip-ev'); const ev = findEvent(el.dataset.ev); if (ev) showEventPopover(ev, el.dataset.occ, el); return; }
  if ((el = t.closest('.stage .cell'))) { selectDay(el.dataset.date, true); return; }
  if ((el = t.closest('.stage .tg-dh'))) { selectDay(el.dataset.date, true); return; }
});
stage.addEventListener('dblclick', e => {
  const cell = e.target.closest('.cell');
  if (cell && !e.target.closest('.chip-ev, button')) openEditor({ date: cell.dataset.date });
  const ad = e.target.closest('.tg-adcol');
  if (ad && !e.target.closest('.chip-ev')) openEditor({ date: ad.dataset.date, allDay: true });
});

/* Month view: drag event chips between days (HTML5 drag & drop) */
stage.addEventListener('dragstart', e => {
  const chip = e.target.closest('.chip-ev[data-ev]');
  if (!chip) return;
  e.dataTransfer.setData('text/plain', `${chip.dataset.ev}|${chip.dataset.occ}`);
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => chip.classList.add('dragging'), 0);
});
stage.addEventListener('dragend', () => { $$('.dragging, .drop-target', stage).forEach(x => x.classList.remove('dragging', 'drop-target')); });
stage.addEventListener('dragover', e => {
  const cell = e.target.closest('.cell, .tg-adcol');
  if (!cell) return;
  e.preventDefault();
  if (!cell.classList.contains('drop-target')) { $$('.drop-target', stage).forEach(x => x.classList.remove('drop-target')); cell.classList.add('drop-target'); }
});
stage.addEventListener('drop', e => {
  const cell = e.target.closest('.cell, .tg-adcol');
  if (!cell) return;
  e.preventDefault();
  const [id, occ] = (e.dataTransfer.getData('text/plain') || '').split('|');
  const ev = findEvent(id);
  const key = cell.dataset.date;
  $$('.drop-target', stage).forEach(x => x.classList.remove('drop-target'));
  if (ev && key && key !== occ) changeOccurrence(ev, occ, { date: key }, `Moved to ${fmtDayShort(key)}`);
});

/* Context menus */
document.addEventListener('contextmenu', e => {
  const t = e.target;
  if (t.closest('input, textarea, [contenteditable="true"]')) return;
  const evEl = t.closest('[data-ev][data-occ], [data-open-ev]');
  const noteEl = t.closest('.note');
  const dayEl = t.closest('.stage [data-date], #mini [data-date], .cork');
  const pt = { x: e.clientX, y: e.clientY };
  if (evEl) {
    const ev = findEvent(evEl.dataset.ev || evEl.dataset.openEv);
    if (!ev) return;
    e.preventDefault();
    const occ = evEl.dataset.occ;
    openMenu([
      { id: 'open', label: 'Details', icon: 'text', fn: () => showEventPopover(ev, occ, evEl) },
      { id: 'edit', label: 'Edit', icon: 'pencil', fn: () => openEditor({ id: ev.id }) },
      { id: 'imp', label: ev.important ? 'Unmark important' : 'Mark as important', icon: 'star', fn: () => toggleImportant(ev) },
      { id: 'note', label: 'Attach a note', icon: 'sticky', fn: () => addNote(occ, { evId: ev.id }) },
      { id: 'dup', label: 'Duplicate', icon: 'copy', fn: () => duplicateEvent(ev, occ) },
      { id: 'tom', label: 'Move to next day', icon: 'right', fn: () => changeOccurrence(ev, occ, { date: toKey(addDays(fromKey(occ), 1)) }, 'Moved to the next day') },
      { html: `<div class="menu-label">Colour</div><div class="mood-line">${EVENT_COLORS.map(c => `<button data-mi="c${c}" aria-label="Colour ${c}"><span class="swatch" style="--sw:${paint(c)};width:16px;height:16px"></span></button>`).join('')}</div>` },
      ...EVENT_COLORS.map(c => ({ id: 'c' + c, fn: () => { snapshot(); ev.color = c; save(); render(); } })),
      '-',
      { id: 'del', label: 'Delete', icon: 'trash', danger: true, fn: () => deleteEvent(ev, occ) },
    ], pt);
    return;
  }
  if (noteEl) {
    const n = findNote(noteEl.dataset.note);
    if (!n) return;
    e.preventDefault();
    openMenu([
      { html: `<div class="menu-label">Colour</div><div class="mood-line">${NOTE_COLORS.map(c => `<button data-mi="n${c.id}" aria-label="${c.name}"><span class="swatch" style="--sw:${c.c};width:16px;height:16px"></span></button>`).join('')}</div>` },
      ...NOTE_COLORS.map(c => ({ id: 'n' + c.id, fn: () => { n.color = c.id; save(); rerenderNote(n); renderStage(); } })),
      { id: 'mode', label: n.mode === 'list' ? 'Turn into text note' : 'Turn into checklist', icon: n.mode === 'list' ? 'text' : 'check', fn: () => toggleNoteMode(n) },
      { id: 'rem', label: n.remindAt ? 'Change reminder' : 'Add reminder', icon: 'alarm', fn: () => openNoteReminder(n, noteEl) },
      { id: 'done', label: n.done ? 'Mark not done' : 'Mark done', icon: 'check', fn: () => toggleNoteDone(n) },
      { id: 'dup', label: 'Duplicate', icon: 'copy', fn: () => addNote(n.date, { evId: n.evId, text: n.text, items: clone(n.items), mode: n.mode, color: n.color }) },
      ...(n.evId ? [] : [{ id: 'tom', label: 'Move to next day', icon: 'right', fn: () => moveNoteToDate(n, toKey(addDays(fromKey(n.date), 1))) }]),
      '-',
      { id: 'del', label: 'Delete note', icon: 'trash', danger: true, fn: () => deleteNote(n) },
    ], pt);
    return;
  }
  if (dayEl) {
    const key = dayEl.dataset.date || dayEl.dataset.cork;
    if (!key) return;
    e.preventDefault();
    openMenu([
      { label: fmtDayLong(key), header: true },
      { id: 'ev', label: 'New event', icon: 'plus', kbd: 'C', fn: () => openEditor({ date: key }) },
    ], pt);
  }
});

/* ============================================================
   Sticky note interactions
   ============================================================ */
function toggleNoteMode(n) {
  snapshot();
  if (n.mode === 'list') { n.text = n.items.map(i => i.text).join('\n'); n.mode = 'text'; }
  else { n.items = (n.text || '').split('\n').map(s => s.trim()).filter(Boolean).map(text => ({ text, done: false })); n.mode = 'list'; }
  save(); rerenderNote(n, n.mode === 'list'); renderStage();
}
function toggleNoteDone(n) {
  n.done = !n.done;
  save(); rerenderNote(n); renderStage(); renderToday(); updateBadge();
  if (n.done) confetti($(`.note[data-note="${n.id}"]`, board));
}
const saveSoon = debounce(() => { renderStage(); renderMini(); renderUpNext(); }, 600);
board.addEventListener('input', e => {
  const noteEl = e.target.closest('.note');
  if (!noteEl) return;
  const n = findNote(noteEl.dataset.note);
  if (!n) return;
  if (e.target.classList.contains('note-text')) { n.text = e.target.value; autosize(e.target); sizeCork(); }
  if (e.target.matches('[data-item-edit]')) { const i = +e.target.closest('.nl-item').dataset.i; if (n.items[i]) n.items[i].text = e.target.textContent; }
  save(); saveSoon();
});
board.addEventListener('keydown', e => {
  const noteEl = e.target.closest('.note');
  if (!noteEl) return;
  const n = findNote(noteEl.dataset.note);
  if (!n) return;
  if (e.target.classList.contains('nl-add') && e.key === 'Enter') {
    e.preventDefault();
    const v = e.target.value.trim();
    if (!v) return;
    n.items.push({ text: v, done: false });
    save(); rerenderNote(n, true); saveSoon();
  }
  if (e.target.matches('[data-item-edit]')) {
    const i = +e.target.closest('.nl-item').dataset.i;
    if (e.key === 'Enter') { e.preventDefault(); $('.nl-add', noteEl)?.focus(); }
    if (e.key === 'Backspace' && !e.target.textContent) { e.preventDefault(); n.items.splice(i, 1); save(); rerenderNote(n, true); saveSoon(); }
  }
  if (e.key === 'Escape' && !topModal() && !$('.pop, .menu', layer)) { e.target.blur(); e.stopPropagation(); }
});
board.addEventListener('click', e => {
  const noteEl = e.target.closest('.note');
  if (!noteEl) return;
  const n = findNote(noteEl.dataset.note);
  if (!n) return;
  const z = maxZ(n.date);
  if ((n.z || 0) < z) { n.z = z + 1; noteEl.style.zIndex = n.z; save(); }
  const act = e.target.closest('[data-na]')?.dataset.na;
  const pal = e.target.closest('[data-np]');
  if (pal) {
    const v = pal.dataset.np;
    if (v === 'mode') { toggleNoteMode(n); return; }
    n.color = v; save(); rerenderNote(n); renderStage();
    return;
  }
  if (!act) return;
  if (act === 'palette') {
    const open = $('.note-palette', noteEl);
    if (open) { open.remove(); return; }
    const p = document.createElement('div');
    p.className = 'note-palette';
    p.innerHTML = NOTE_COLORS.map(c => `<button data-np="${c.id}" class="${n.color === c.id ? 'on' : ''}" style="--sw:${c.c}" aria-label="${c.name}" title="${c.name}"></button>`).join('') +
      `<span class="np-sep"></span><button class="np-mode${n.mode === 'list' ? ' on' : ''}" data-np="mode">${icon('check')}Checklist</button>`;
    noteEl.appendChild(p);
  }
  if (act === 'remind') openNoteReminder(n, noteEl);
  if (act === 'done') toggleNoteDone(n);
  if (act === 'delete') deleteNote(n);
  if (act === 'check') {
    const i = +e.target.closest('.nl-item').dataset.i;
    n.items[i].done = !n.items[i].done;
    save(); rerenderNote(n); saveSoon();
    if (n.items.length > 1 && n.items.every(x => x.done)) { confetti($(`.note[data-note="${n.id}"]`, board)); toast('Checklist complete!'); }
  }
  if (act === 'del-item') { const i = +e.target.closest('.nl-item').dataset.i; n.items.splice(i, 1); save(); rerenderNote(n); saveSoon(); }
});
board.addEventListener('dblclick', e => {
  const cork = e.target.closest('.cork');
  if (!cork || e.target.closest('.note')) return;
  const r = cork.getBoundingClientRect(), w = cork.clientWidth;
  const px = clamp(e.clientX - r.left - cork.clientLeft - 75, 0, w - 150);
  addNote(cork.dataset.cork, { x: w > 150 ? px / (w - 150) : 0, y: Math.max(8, e.clientY - r.top - cork.clientTop - 20) });
});
board.addEventListener('focusout', e => {
  const el = e.target.closest('.note');
  if (!el) return;
  /* a note attached to an event and left blank is removed once you click away */
  setTimeout(() => {
    const n = findNote(el.dataset.note);
    if (n && n.evId && noteEmpty(n) && !el.contains(document.activeElement)) { state.notes = state.notes.filter(x => x !== n); save(); renderBoard(); }
    saveSoon();
  }, 150);
});

/* Dragging notes around the board, and onto calendar days */
let ndrag = null;
board.addEventListener('pointerdown', e => {
  const bar = e.target.closest('[data-note-drag]');
  if (!bar || e.target.closest('button') || e.button !== 0) return;
  const el = bar.closest('.note');
  const n = findNote(el.dataset.note);
  if (!n) return;
  e.preventDefault();
  closeFloating();
  $('.note-palette', el)?.remove();
  const cork = el.parentElement;
  const cr = cork.getBoundingClientRect();
  ndrag = { el, n, cork, offX: e.clientX - cr.left - el.offsetLeft, offY: e.clientY - cr.top - el.offsetTop, x0: e.clientX, y0: e.clientY, moved: false, ghost: null, target: null };
  bar.setPointerCapture(e.pointerId);
  n.z = maxZ(n.date) + 1;
  el.style.zIndex = n.z;
});
board.addEventListener('pointermove', e => {
  if (!ndrag) return;
  const d = ndrag;
  if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) return;
  if (!d.moved) { d.moved = true; d.el.classList.add('dragging'); document.body.classList.add('dragging-note'); }
  const cr = d.cork.getBoundingClientRect();
  const br = board.getBoundingClientRect();
  const inside = e.clientX >= br.left && e.clientX <= br.right && e.clientY >= br.top && e.clientY <= br.bottom;
  if (inside) {
    if (d.ghost) { d.ghost.remove(); d.ghost = null; d.el.style.opacity = ''; }
    if (d.target) { d.target.classList.remove('drop-target'); d.target = null; }
    d.el.style.left = clamp(e.clientX - cr.left - d.offX, 0, d.cork.clientWidth - 150) + 'px';
    d.el.style.top = Math.max(0, e.clientY - cr.top - d.offY) + 'px';
    if (e.clientY > br.bottom - 40) board.scrollTop += 10;
    if (e.clientY < br.top + 40) board.scrollTop -= 10;
  } else {
    if (!d.ghost) {
      d.ghost = d.el.cloneNode(true);
      d.ghost.className = 'note note-drag-ghost';
      d.ghost.style.cssText = `--nc:${noteColor(d.n.color)};left:0;top:0;animation:none`;
      document.body.appendChild(d.ghost);
      d.el.style.opacity = '.25';
    }
    d.ghost.style.left = e.clientX - 20 + 'px';
    d.ghost.style.top = e.clientY - 10 + 'px';
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('.stage [data-date], #mini [data-date]');
    if (hit !== d.target) { d.target?.classList.remove('drop-target'); d.target = hit || null; d.target?.classList.add('drop-target'); }
  }
});
const endNoteDrag = e => {
  if (!ndrag) return;
  const d = ndrag; ndrag = null;
  document.body.classList.remove('dragging-note');
  d.el.classList.remove('dragging');
  d.ghost?.remove();
  d.el.style.opacity = '';
  if (d.target) {
    d.target.classList.remove('drop-target');
    moveNoteToDate(d.n, d.target.dataset.date);
    return;
  }
  if (!d.moved) { save(); return; }
  const cw = d.cork.clientWidth;
  d.n.x = cw > 150 ? clamp(d.el.offsetLeft / (cw - 150), 0, 1) : 0;
  d.n.y = d.el.offsetTop;
  d.n.rot = +(Math.random() * 6 - 3).toFixed(1);
  d.el.style.setProperty('--rot', d.n.rot + 'deg');
  d.el.style.left = `calc((100% - 150px) * ${d.n.x})`;
  save(); sizeCork();
};
board.addEventListener('pointerup', endNoteDrag);
board.addEventListener('pointercancel', endNoteDrag);

/* ============================================================
   Search
   ============================================================ */
const sInput = $('#search-input'), sResults = $('#search-results');
let sIndex = -1;
function hl(text, q) {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return esc(text);
  return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
}
function runSearch() {
  const q = sInput.value.trim().toLowerCase();
  sIndex = -1;
  if (!q) { sResults.hidden = true; return; }
  const evs = state.events.filter(ev => [ev.title, ev.location, ev.description].some(x => (x || '').toLowerCase().includes(q))).slice(0, 8);
  const notes = state.notes.filter(n => (n.text + ' ' + n.items.map(i => i.text).join(' ')).toLowerCase().includes(q)).slice(0, 8);
  let html = '';
  if (evs.length) html += `<div class="sr-group">Events</div>` + evs.map(ev => { const k = nextOccurrence(ev); return `<button class="sr-item" data-sr-ev="${ev.id}" data-occ="${k}"><span class="chip-ev" style="--c:${evColor(ev)};width:auto;padding:0;background:none"><span class="d"></span></span><span class="sr-title">${hl(ev.title || '(No title)', q)}</span><span class="sr-date">${fmtDayShort(k)}</span></button>`; }).join('');
  if (notes.length) html += `<div class="sr-group">Notes</div>` + notes.map(n => { const txt = n.mode === 'list' ? n.items.map(i => i.text).join(' · ') : n.text; const i = txt.toLowerCase().indexOf(q); const snip = txt.slice(Math.max(0, i - 20), i + 50).replace(/\n/g, ' '); return `<button class="sr-item" data-sr-note="${n.date}"><span class="mini-note" style="--nc:${noteColor(n.color)};--rot:-6deg"></span><span class="sr-title">${hl(snip, q)}</span><span class="sr-date">${fmtDayShort(n.date)}</span></button>`; }).join('');
  sResults.innerHTML = html || `<div class="sr-empty">No events or notes match “${esc(sInput.value.trim())}”.</div>`;
  sResults.hidden = false;
}
sInput.addEventListener('input', debounce(runSearch, 60));
sInput.addEventListener('focus', () => { if (sInput.value.trim()) runSearch(); });
sInput.addEventListener('keydown', e => {
  const items = $$('.sr-item', sResults);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    sIndex = clamp(sIndex + (e.key === 'ArrowDown' ? 1 : -1), 0, items.length - 1);
    items.forEach((it, i) => it.classList.toggle('active', i === sIndex));
  }
  if (e.key === 'Enter') { (items[sIndex] || items[0])?.click(); }
  if (e.key === 'Escape') { sInput.value = ''; sResults.hidden = true; sInput.blur(); }
});
sResults.addEventListener('click', e => {
  const evB = e.target.closest('[data-sr-ev]');
  const nB = e.target.closest('[data-sr-note]');
  sResults.hidden = true;
  sInput.blur();
  if (evB) {
    const ev = findEvent(evB.dataset.srEv), k = evB.dataset.occ;
    goTo(k, ui.view === 'year' ? 'month' : ui.view);
    setTimeout(() => { const el = $(`[data-ev="${ev.id}"][data-occ="${k}"]`, stage) || $(`[data-open-ev="${ev.id}"]`, board); if (el) showEventPopover(ev, k, el); }, 60);
  }
  if (nB) { goTo(nB.dataset.srNote); openBoardIfHidden(); render(); }
});
$('#search').addEventListener('click', () => sInput.focus());

/* ============================================================
   Settings drawer interactions
   ============================================================ */
layer.addEventListener('click', e => {
  const dr = e.target.closest('.drawer');
  if (!dr) return;
  const s = S();
  let el;
  const rerender = () => { save(); render(); if (dr.dataset.kind === 'settings') renderSettings(dr); };
  if ((el = e.target.closest('button[data-skin]'))) { s.skin = el.dataset.skin; s.accent = null; rerender(); }
  else if ((el = e.target.closest('[data-accent]'))) { s.accent = el.dataset.accent || null; rerender(); }
  else if ((el = e.target.closest('[data-font]'))) { s.font = el.dataset.font; rerender(); }
  else if ((el = e.target.closest('[data-notefont]'))) { s.noteFont = el.dataset.notefont; rerender(); }
  else if ((el = e.target.closest('[data-rain]'))) { s.rainLevel = el.dataset.rain; rerender(); }
  else if ((el = e.target.closest('[data-density]'))) { s.density = el.dataset.density; ui.resetScroll = true; rerender(); }
  else if ((el = e.target.closest('[data-evstyle]'))) { s.eventStyle = el.dataset.evstyle; rerender(); }
  else if ((el = e.target.closest('[data-hour12]'))) { s.hour12 = el.dataset.hour12 === '1'; rerender(); }
  else if (e.target.closest('[data-perm]')) requestNotify();
  else if (e.target.closest('[data-test-sound]')) playSound(S().soundType, true);
  else if (e.target.closest('[data-test-reminder]')) {
    const n = { id: 'test', date: todayKey(), mode: 'text', text: 'This is a test reminder. Real ones look just like this.', items: [], color: 'lemon', done: false };
    fireReminder({ kind: 'note', key: 'test:' + Date.now(), n, trig: Date.now() }, false);
    playSound(S().soundType, true);
  }
  else if (e.target.closest('[data-shortcuts]')) openDrawer('shortcuts');
  else if (e.target.closest('[data-export]')) exportData();
  else if (e.target.closest('[data-copy-backup]')) {
    const txt = JSON.stringify(state, null, 2);
    navigator.clipboard?.writeText(txt).then(() => toast('Backup copied to clipboard'), () => toast('Couldn’t copy. Try Export backup instead.'));
  }
  else if (e.target.closest('[data-import]')) $('#import-file').click();
  else if (e.target.closest('[data-reset]')) {
    confirmDialog({ title: 'Erase everything?', body: 'This removes every event, note, calendar and setting saved in this browser. Export a backup first if you might want them back.', ok: 'Erase everything', danger: true }).then(ok => {
      if (!ok) return;
      state = defaultState();
      undoStack.length = 0;
      save(); closeDrawer(); render();
      toast('Chronos is empty and ready for you');
    });
  }
});
layer.addEventListener('change', e => {
  const dr = e.target.closest('.drawer');
  if (!dr) return;
  const s = S();
  const t = e.target;
  if (t.dataset.set) { s[t.dataset.set] = t.checked; save(); render(); }
  if (t.id === 'set-weekstart') { s.weekStart = +t.value; save(); render(); }
  if (t.id === 'set-dayStartHour') { s.dayStartHour = +t.value; ui.resetScroll = true; save(); render(); }
  if (t.id === 'set-defaultDuration') { s.defaultDuration = +t.value; save(); }
  if (t.id === 'set-defaultReminder') { s.defaultReminder = t.value === '' ? null : +t.value; save(); }
  if (t.id === 'set-soundType') { s.soundType = t.value; save(); playSound(t.value, true); }
  if (t.id === 'set-accent') { renderSettings(dr); }
});
layer.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'set-radius') { S().radius = +t.value; save(); applySettings(); }
  if (t.id === 'set-accent') { S().accent = t.value; save(); applySettings(); }
});
function exportData() {
  try {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chronos-backup-${todayKey()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Backup downloaded');
  } catch (e) { toast('Download blocked here. Use Copy backup instead.'); }
}
$('#import-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.events) || !Array.isArray(data.notes)) throw new Error('bad');
    const ok = await confirmDialog({ title: 'Replace with this backup?', body: `The backup has ${data.events.length} events and ${data.notes.length} notes. It will replace what is in Chronos now.`, ok: 'Import backup' });
    if (!ok) return;
    snapshot();
    state = migrate(data);
    save(); closeDrawer(); render();
    toast('Backup imported', { label: 'Undo', fn: undo });
  } catch (err) { toast('That file isn’t a Chronos backup. Choose a .json file made with Export backup.'); }
});

/* ============================================================
   Keyboard
   ============================================================ */
document.addEventListener('keydown', e => {
  const typing = e.target.closest('input, textarea, select, [contenteditable="true"]');
  if (e.key === 'Escape') {
    if ($('.pop, .menu', layer)) { closeFloating(); return; }
    const m = topModal(); if (m) { m._close(); return; }
    if (drawerKind) { closeDrawer(); syncOverlays(); return; }
    if (ui.bdOverlay) { ui.bdOverlay = false; syncOverlays(); return; }
    if (typing) e.target.blur();
    return;
  }
  if (typing || topModal()) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const pop = $('.pop[data-ev]', layer);
  if (pop && (e.key === 'Delete' || e.key === 'Backspace')) { const ev = findEvent(pop.dataset.ev); if (ev) deleteEvent(ev, pop.dataset.occ); return; }
  if (pop && e.key.toLowerCase() === 'e') { const id = pop.dataset.ev; closeFloating(); openEditor({ id }); return; }
  const k = e.key;
  const map = {
    t: goToday, ArrowLeft: () => shift(-1), ArrowRight: () => shift(1), j: () => shift(1), k: () => shift(-1),
    c: () => openEditor({ date: ui.selected }), '/': () => sInput.focus(),
    b: toggleBoard, ',': () => openDrawer('settings'), r: () => openDrawer('reminders'), '?': () => openDrawer('shortcuts'),
  };
  const fn = map[k] || map[k.toLowerCase()];
  if (fn) { e.preventDefault(); fn(); }
});

/* Swipe to navigate on touch screens */
let touch0 = null;
stage.addEventListener('touchstart', e => { if (e.touches.length === 1) touch0 = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }; }, { passive: true });
stage.addEventListener('touchend', e => {
  if (!touch0) return;
  const dx = e.changedTouches[0].clientX - touch0.x, dy = e.changedTouches[0].clientY - touch0.y;
  if (Math.abs(dx) > 70 && Math.abs(dy) < 50 && Date.now() - touch0.t < 600) shift(dx < 0 ? 1 : -1);
  touch0 = null;
});

/* Resize */
window.addEventListener('resize', debounce(() => {
  if (window.innerWidth > 1320 && ui.bdOverlay) ui.bdOverlay = false;
  syncOverlays();
  fitMonthChips(); placeSegPill(); sizeCork();
  const nsc = $('.tg-scroll', stage);
  if (nsc) $('.tgrid', stage).style.setProperty('--sbw', (nsc.offsetWidth - nsc.clientWidth) + 'px');
}, 120));

/* Other tabs */
window.addEventListener('storage', e => {
  if (e.key !== KEY || !e.newValue) return;
  try { state = migrate(JSON.parse(e.newValue)); render(); } catch (err) { /* ignore */ }
});

/* ============================================================
   Clock
   ============================================================ */
let lastMinute = -1, lastDay = todayKey();
function tick() {
  const now = new Date();
  if (now.getMinutes() !== lastMinute) {
    lastMinute = now.getMinutes();
    renderNowCard();
    updateNowLine();
    updateBadge();
    if (todayKey() !== lastDay) { lastDay = todayKey(); render(); }
  }
  checkReminders();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });

/* Boot */
render();
document.fonts?.ready?.then(() => { placeSegPill(); fitMonthChips(); });
setTimeout(tick, 800);
setInterval(tick, 15000);
/* Seconds on the today-strip clock; a full redraw still happens each minute */
setInterval(() => {
  const el = $('.nt-sec');
  const now = new Date();
  if (!el) return;
  if (now.getMinutes() !== lastMinute) tick();
  else el.textContent = ':' + pad(now.getSeconds());
}, 1000);
})();
