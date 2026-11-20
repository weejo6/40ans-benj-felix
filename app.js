import * as CONFIG from './config.js';

// Import « tolérant » : un vieux config.js resté en cache ne casse pas le site.
const { MONTHS, CITIES, SEED } = CONFIG;
const KITS = CONFIG.KITS || {};
import { createStore } from './store.js';

// ───────────── Outils ─────────────
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const plural = (n, s, p = s + 's') => `${n} ${n > 1 ? p : s}`;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const safeGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* rien */ } };

const MONTH_NAMES = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTH_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const WD_LONG = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const WD_SHORT = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
const WD_LETTER = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
// Couleurs des maillots pour les potes ajoutés en cours de route (sans tenue dans KITS).
const PALETTE = ['#169b62', '#d6457b', '#d99a00', '#1d4e89', '#7b4bd6', '#5a6b2f', '#9c4f2e', '#0f9fb0', '#e63946', '#ff7a2f'];
const STATUS = {
  ok: { label: 'Dispo', icon: '✓' },
  maybe: { label: 'Peut-être', icon: '?' },
  no: { label: 'Pas dispo', icon: '✕' },
  none: { label: 'Pas d’info', icon: '' },
};
const CYCLE = [null, 'ok', 'maybe', 'no'];

// Tous les jours proposés, dans l'ordre.
const DAYS = [];
MONTHS.forEach(({ y, m }, mi) => {
  const n = new Date(y, m, 0).getDate();
  for (let d = 1; d <= n; d++) {
    const date = new Date(y, m - 1, d);
    const prev = DAYS[DAYS.length - 1];
    DAYS.push({
      key: `${y}-${pad(m)}-${pad(d)}`, y, m, d, mi, idx: DAYS.length,
      wd: (date.getDay() + 6) % 7,
      date,
      contig: !!prev && Math.round((date - prev.date) / 86400000) === 1,
    });
  }
});
const dnum = (d) => (d.d === 1 ? '1er' : String(d.d));
const fmtDay = (d, long = false) => `${(long ? WD_LONG : WD_SHORT)[d.wd]} ${dnum(d)} ${(long ? MONTH_NAMES : MONTH_SHORT)[d.m - 1]}`;
function fmtRange(a, b) {
  if (a.key === b.key) return fmtDay(a, true);
  if (a.m === b.m) return `${dnum(a)} → ${b.d} ${MONTH_NAMES[b.m - 1]}`;
  return `${dnum(a)} ${MONTH_SHORT[a.m - 1]} → ${b.d} ${MONTH_SHORT[b.m - 1]}`;
}
function fmtRangeShort(a, b) {
  if (a.key === b.key) return `${a.d} ${MONTH_SHORT[a.m - 1]}`;
  if (a.m === b.m) return `${a.d}→${b.d} ${MONTH_SHORT[b.m - 1]}`;
  return `${a.d}/${pad(a.m)}→${b.d}/${pad(b.m)}`;
}
const initials = (name) => name.trim().slice(0, 2).toUpperCase();
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'pote';

// ───────────── État ─────────────
let store = null;
let state = { people: [], days: {}, presence: {} };
let A = analyze();
let me = safeGet('trip40-me');
let brush = ['ok', 'maybe', 'no', 'clear'].includes(safeGet('trip40-brush')) ? safeGet('trip40-brush') : 'ok';
let seenPeople = false;
let prevSigs = {};
let prevAllIn = null;
let prevBoard = null;
let stripSel = null;
let pending = 0;
let connected = true;
const lastToastAt = {};
const justPainted = new Set();

const st = (pid, key) => {
  const v = state.days[pid] && state.days[pid][key];
  return v === 'ok' || v === 'maybe' || v === 'no' ? v : null;
};
const meP = () => state.people.find((p) => p.id === me) || null;
const isOnline = (pid) => !!(state.presence[pid] && Object.keys(state.presence[pid]).length);

// ───────────── Démarrage ─────────────
init();

async function init() {
  buildCities();
  buildWheel();
  setupCard();
  setupEditor();
  setupTeam();
  setupStrip();
  renderAll();

  setSync('loading', 'Connexion…');
  try {
    store = await createStore();
  } catch (err) {
    console.error(err);
    setSync('error', 'Connexion impossible');
    toast('😬 Impossible de joindre la base de données. Recharge la page.');
    return;
  }
  if (store.mode === 'local') {
    setSync('demo', 'Mode démo');
    $('#demoBanner').hidden = false;
  } else {
    store.onConnection((c) => {
      connected = c;
      setSync(c ? 'live' : 'offline', c ? 'En direct' : 'Hors ligne…');
      if (!pending) setSave(null);
    });
  }
  store.subscribe(onData, (err) => {
    console.error(err);
    setSync('error', 'Accès refusé');
    toast('😬 La base refuse la lecture : vérifie les règles Firebase.');
  });
  store.seedIfEmpty(buildSeed()).catch((err) => console.error('seed', err));
  if (me) store.setPresence(me);
}

function buildSeed() {
  const u = {};
  SEED.people.forEach((p, i) => {
    u[`people/${p.id}`] = p.note ? { name: p.name, order: i, note: p.note } : { name: p.name, order: i };
  });
  SEED.ranges.forEach(([pid, from, to, s]) => {
    DAYS.forEach((d) => { if (d.key >= from && d.key <= to) u[`days/${pid}/${d.key}`] = s; });
  });
  return u;
}

function onData(raw) {
  const people = Object.entries(raw.people || {})
    .filter(([, p]) => p && typeof p === 'object')
    .map(([id, p]) => ({ id, name: String(p.name || id), order: typeof p.order === 'number' ? p.order : 999, note: typeof p.note === 'string' ? p.note : '' }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'fr'));
  let extra = 0;
  people.forEach((p) => {
    p.kit = KITS[p.id] || plainKit(PALETTE[extra++ % PALETTE.length]);
    p.color = p.kit.body;
  });
  state = { people, days: raw.days || {}, presence: raw.presence || {} };
  A = analyze();
  detectChanges();
  renderAll();
}

// ───────────── Analyse : qui est partant quand ? ─────────────
function analyze() {
  const P = state.people;
  const per = DAYS.map((day) => {
    const g = { ok: [], maybe: [], no: [], none: [] };
    P.forEach((p) => g[st(p.id, day.key) || 'none'].push(p));
    const blockers = [...g.no, ...g.none];
    return {
      day, ...g, blockers,
      inCount: g.ok.length + g.maybe.length,
      allIn: P.length > 0 && blockers.length === 0,
      allSure: P.length > 0 && g.ok.length === P.length,
    };
  });

  const windows = [];
  per.forEach((x, i) => {
    if (!x.allIn) return;
    const last = windows[windows.length - 1];
    if (last && last.end === i - 1 && DAYS[i].contig) last.end = i;
    else windows.push({ start: i, end: i });
  });
  windows.forEach((w) => {
    const slice = per.slice(w.start, w.end + 1);
    w.len = slice.length;
    w.allSure = slice.every((x) => x.allSure);
    w.people = P.map((p) => ({ p, s: slice.every((x) => st(p.id, x.day.key) === 'ok') ? 'ok' : 'maybe' }));
    w.sure = w.people.filter((x) => x.s === 'ok').length;
  });
  windows.sort((a, b) => b.len - a.len || b.sure - a.sure || a.start - b.start);

  const almost = [];
  per.forEach((x, i) => {
    if (x.blockers.length !== 1 || P.length < 2) return;
    const b = x.blockers[0];
    const last = almost[almost.length - 1];
    if (last && last.end === i - 1 && last.person.id === b.id && DAYS[i].contig) last.end = i;
    else almost.push({ start: i, end: i, person: b });
  });
  almost.forEach((a) => {
    a.len = a.end - a.start + 1;
    const ss = per.slice(a.start, a.end + 1).map((x) => st(a.person.id, x.day.key));
    a.why = ss.every((s) => s === 'no') ? 'no' : ss.every((s) => !s) ? 'none' : 'mixed';
  });
  almost.sort((a, b) => b.len - a.len || a.start - b.start);

  const filled = Object.fromEntries(P.map((p) => [p.id, DAYS.filter((d) => st(p.id, d.key)).length]));
  return {
    per, windows, almost, filled,
    complete: P.filter((p) => filled[p.id] === DAYS.length).length,
    allInCount: per.filter((x) => x.allIn).length,
    allSureCount: per.filter((x) => x.allSure).length,
  };
}

function detectChanges() {
  const sigs = {};
  state.people.forEach((p) => { sigs[p.id] = JSON.stringify(state.days[p.id] || {}) + '|' + p.note; });
  if (seenPeople) {
    const hadPeople = Object.keys(prevSigs).length > 0;
    const now = Date.now();
    state.people.forEach((p) => {
      if (p.id === me) return;
      if (prevSigs[p.id] === undefined) {
        if (hadPeople) toast(`👋 ${p.name} a rejoint l’équipe !`);
      } else if (prevSigs[p.id] !== sigs[p.id] && (!lastToastAt[p.id] || now - lastToastAt[p.id] > 15000)) {
        lastToastAt[p.id] = now;
        toast(`⚡ ${p.name} vient de mettre à jour ses dispos`);
      }
    });
    if (prevAllIn !== null && A.allInCount !== prevAllIn) celebrate(prevAllIn);
  }
  prevSigs = sigs;
  prevAllIn = A.allInCount;
  if (state.people.length) seenPeople = true;
}

// Une seule fête pour une rafale de changements (ex. quand on glisse sur plusieurs jours).
let celebrateTimer = null;
let celebrateBase = null;
function celebrate(before) {
  if (celebrateBase === null) celebrateBase = before;
  clearTimeout(celebrateTimer);
  celebrateTimer = setTimeout(() => {
    const n = A.allInCount - celebrateBase;
    celebrateBase = null;
    if (n <= 0) return;
    confetti();
    toast(n > 1 ? `🎉 ${n} nouveaux jours où tout le monde est partant !` : '🎉 Un nouveau jour où tout le monde est partant !');
  }, 700);
}

// ───────────── Écritures ─────────────
function save(updates) {
  if (!store) return;
  pending++;
  setSave('saving');
  store.write(updates).then(() => {
    pending--;
    if (!pending) setSave('ok');
  }).catch((err) => {
    pending--;
    console.error(err);
    setSave('err');
    toast('😬 La sauvegarde a échoué. Réessaie dans un instant.');
  });
}

function paint(keys, value) {
  if (!meP()) return;
  const u = {};
  keys.forEach((k) => { u[`days/${me}/${k}`] = value; justPainted.add(k); });
  save(u);
}

function toggleValue(key) {
  if (brush === 'clear') return null;
  return st(me, key) === brush ? null : brush;
}

function setMe(pid) {
  if (pid === me) return;
  me = pid;
  safeSet('trip40-me', pid);
  if (store) store.setPresence(pid);
  prevSigs = {};
  renderAll();
  const p = meP();
  if (p) toast(`👋 Salut ${p.name} ! Prends un pinceau et colorie tes jours.`);
}

// ───────────── Rendu ─────────────
function renderAll() {
  renderHeroLive();
  renderBoard();
  renderStrip();
  renderWindows();
  renderAlmost();
  renderOnline();
  renderPlayers();
  renderEditor();
  renderTeam();
  renderNotes();
}

function setSync(kind, label) {
  const el = $('#sync');
  el.dataset.state = kind;
  el.lastElementChild.textContent = label;
}

function setSave(kind) {
  const el = $('#saveState');
  el.className = 'save-state';
  if (kind === 'saving') {
    el.textContent = connected ? 'Enregistrement…' : 'Hors ligne : ce sera envoyé dès le retour du réseau.';
  } else if (kind === 'ok') {
    el.classList.add('ok');
    el.textContent = store && store.mode === 'local' ? '✓ Enregistré sur cet appareil (mode démo)' : '✓ Enregistré · tout le monde le voit déjà';
  } else if (kind === 'err') {
    el.classList.add('err');
    el.textContent = 'Oups, pas enregistré. Vérifie ta connexion.';
  } else {
    el.textContent = '';
  }
}

function renderHeroLive() {
  const el = $('#heroLive');
  if (!state.people.length) { el.innerHTML = ''; return; }
  const live = store && store.mode === 'firebase' ? '🟢 En direct' : '🧪 Démo';
  el.innerHTML = `<span class="pill">${live}</span><span><b>${A.allInCount}</b> ${A.allInCount > 1 ? 'jours' : 'jour'} où tout le monde est partant · <b>${A.complete}/${state.people.length}</b> ont tout rempli</span>`;
}

function renderBoard() {
  const P = state.people;
  const best = A.windows[0];
  const tiles = [
    { id: 'allin', num: A.allInCount, label: `${A.allInCount > 1 ? 'jours' : 'jour'} où tout le monde est partant`, hot: A.allInCount > 0 },
    { id: 'sure', num: A.allSureCount, label: `${A.allSureCount > 1 ? 'jours' : 'jour'} où tout le monde est sûr` },
    { id: 'best', num: best ? fmtRangeShort(DAYS[best.start], DAYS[best.end]) : '—', small: true, label: best ? `meilleure fenêtre · ${plural(best.len, 'jour')}` : 'meilleure fenêtre' },
    { id: 'resp', num: `${A.complete}/${P.length}`, label: `${A.complete > 1 ? 'potes ont' : 'pote a'} tout rempli` },
  ];
  $('#board').innerHTML = tiles.map((t) => `
    <div class="tile${t.hot ? ' hot' : ''}">
      <div class="tile-num${t.small ? ' small' : ''}${prevBoard && prevBoard[t.id] !== String(t.num) ? ' bump' : ''}">${esc(t.num)}</div>
      <div class="tile-label">${t.label}</div>
    </div>`).join('');
  prevBoard = Object.fromEntries(tiles.map((t) => [t.id, String(t.num)]));
}

function renderStrip() {
  const total = state.people.length || 1;
  $('#strip').innerHTML = MONTHS.map((mo, mi) => {
    const items = A.per.filter((x) => x.day.mi === mi);
    const bars = items.map((x) => {
      const lv = x.allSure ? 'lv-sure' : x.allIn ? 'lv-in' : x.blockers.length === 1 && state.people.length > 1 ? 'lv-almost' : '';
      const h = Math.max(6, Math.round((x.inCount / total) * 100));
      return `<div class="bar ${lv}${stripSel === x.day.idx ? ' on' : ''}" data-i="${x.day.idx}" style="--h:${h}%" title="${fmtDay(x.day)} : ${x.inCount}/${state.people.length} partants"></div>`;
    }).join('');
    return `<div class="sm" style="flex:${items.length}"><div class="sm-bars">${bars}</div><div class="sm-label"><b>${MONTH_NAMES[mo.m - 1]}</b><span>${items.length} j</span></div></div>`;
  }).join('');
  if (stripSel != null) showStripDetail(stripSel);
}

function names(list) {
  return list.map((p) => esc(p.name)).join(', ');
}

function showStripDetail(i) {
  const x = A.per[i];
  if (!x) return;
  const P = state.people.length;
  const head = x.allSure ? '🔥 tout le monde est sûr !' : x.allIn ? '✅ tout le monde est partant' : `${x.inCount}/${P} partants`;
  const parts = [];
  if (x.ok.length) parts.push(`<span class="grp">✓ ${names(x.ok)}</span>`);
  if (x.maybe.length) parts.push(`<span class="grp">? ${names(x.maybe)}</span>`);
  if (x.no.length) parts.push(`<span class="grp">✕ ${names(x.no)}</span>`);
  if (x.none.length) parts.push(`<span class="grp">… pas répondu : ${names(x.none)}</span>`);
  $('#stripDetail').innerHTML = `<b>${fmtDay(x.day, true)}</b> · ${head}<br>${parts.join('')}`;
}

function chip(p, s) {
  const k = s || 'none';
  return `<span class="chip c-${k}"><i>${STATUS[k].icon || '·'}</i>${esc(p.name)}</span>`;
}

function renderWindows() {
  const el = $('#windows');
  if (!state.people.length) { el.innerHTML = '<li class="empty">Chargement des dispos…</li>'; return; }
  if (!A.windows.length) { el.innerHTML = '<li class="empty">Pas encore de jour où tout le monde est partant… À vos pinceaux ! 🎨</li>'; return; }
  const top = A.windows.slice(0, 5);
  el.innerHTML = top.map((w, i) => {
    const a = DAYS[w.start];
    const b = DAYS[w.end];
    const tag = w.allSure ? '<span class="tag">🔥 100 % sûr</span>' : `<span class="tag tag-maybe">${w.sure}/${state.people.length} sûrs</span>`;
    const span = w.len > 1 ? ` · ${WD_SHORT[a.wd]} → ${WD_SHORT[b.wd]}` : '';
    return `<li class="win"><span class="rank">${i + 1}</span>
      <div class="win-date"><b>${fmtRange(a, b)}</b><span>${plural(w.len, 'jour')}${span}</span>${tag}</div>
      <div class="win-people">${w.people.map((x) => chip(x.p, x.s)).join('')}</div></li>`;
  }).join('') + (A.windows.length > top.length ? `<li class="empty">+ ${plural(A.windows.length - top.length, 'autre fenêtre', 'autres fenêtres')} plus courte${A.windows.length - top.length > 1 ? 's' : ''}</li>` : '');
}

function renderAlmost() {
  const el = $('#almost');
  if (!state.people.length) { el.innerHTML = ''; return; }
  if (!A.almost.length) { el.innerHTML = '<li class="empty">Rien pour l’instant.</li>'; return; }
  el.innerHTML = A.almost.slice(0, 5).map((a) => {
    const why = a.why === 'no' ? ' (pas dispo)' : a.why === 'none' ? ' (pas encore répondu)' : '';
    return `<li><b>${fmtRange(DAYS[a.start], DAYS[a.end])}</b> · ${plural(a.len, 'jour')}<br>il ne manque que <b>${esc(a.person.name)}</b>${why}</li>`;
  }).join('');
}

function renderOnline() {
  const el = $('#online');
  if (!store || store.mode !== 'firebase') { el.innerHTML = ''; return; }
  const on = state.people.filter((p) => isOnline(p.id));
  if (!on.length) el.innerHTML = '<span class="dot"></span>Personne n’est en train de remplir ses dispos pour l’instant.';
  else if (on.length === 1 && on[0].id === me) el.innerHTML = '<span class="dot"></span>Il n’y a que toi en ligne pour l’instant.';
  else el.innerHTML = `<span class="dot"></span>En ligne maintenant : ${on.map((p) => `<span class="who">${esc(p.name)}</span>`).join('')}`;
}

// ───────────── Maillots ─────────────
const INK = '#141c3f';
const plainKit = (c) => ({ body: c, stripes: ['#ffffff', null, '#ffffff'], collar: '#ffffff', num: '#ffffff', numLine: INK });
const swatch = (p) => `linear-gradient(135deg, ${p.kit.body} 55%, ${p.kit.collar} 55%)`;

// Bandes de manche parallèles au poignet, entre le bord extérieur (2,25)→(10,11)
// et l'aisselle (12,31)→(16,25) ; la manche droite est le miroir de la gauche.
function sleeveBands(stripes) {
  const out = (t) => [2 + 8 * t, 25 - 14 * t];
  const inn = (t) => [12 + 4 * t, 31 - 6 * t];
  const w = 0.44 / stripes.length;
  return stripes.map((c, i) => {
    if (!c) return '';
    const a = 0.12 + i * w, b = a + w;
    const pts = [out(a), out(b), inn(b), inn(a)];
    const left = pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
    const right = pts.map(([x, y]) => `${(64 - x).toFixed(2)},${y.toFixed(2)}`).join(' ');
    return `<polygon points="${left}" fill="${c}"/><polygon points="${right}" fill="${c}"/>`;
  }).join('');
}

function jersey(p) {
  const k = p.kit;
  const shape = 'M22 6 10 11 2 25l10 6 4-6v33h32V25l4 6 10-6-8-14-12-5c-2 6-18 6-20 0Z';
  const txt = (extra) => `<text x="32" y="44" text-anchor="middle" font-family="Graduate, serif" font-size="17" stroke-linejoin="round" paint-order="stroke" ${extra}>${esc(initials(p.name))}</text>`;
  return `<svg viewBox="0 0 64 64" aria-hidden="true">`
    + `<path d="${shape}" fill="${k.body}"/>`
    + sleeveBands(k.stripes)
    + `<path d="M22 6C24 12 40 12 42 6L45 7.25C42.5 15.5 21.5 15.5 19 7.25Z" fill="${k.collar}"/>`
    + txt(`fill="${k.num}" stroke="${INK}" stroke-width="4.6"`)
    + txt(`fill="${k.num}" stroke="${k.numLine}" stroke-width="2"`)
    + `<path d="${shape}" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`
    + '</svg>';
}

function withFocus(container, fn) {
  const a = document.activeElement;
  let sel = null;
  if (a && container.contains(a)) {
    if (a.dataset.pid) sel = `[data-pid="${a.dataset.pid}"]`;
    else if (a.dataset.key) sel = `[data-key="${a.dataset.key}"]`;
    else if (a.dataset.mi) sel = `[data-mi="${a.dataset.mi}"]`;
    else if (a.id) sel = `#${a.id}`;
  }
  fn();
  if (sel) { const el = container.querySelector(sel); if (el) el.focus({ preventScroll: true }); }
}

function renderPlayers() {
  const el = $('#players');
  withFocus(el, () => {
    el.innerHTML = state.people.map((p) => {
      const pct = Math.round(((A.filled[p.id] || 0) / DAYS.length) * 100);
      return `<button type="button" class="player" role="radio" aria-checked="${p.id === me}" data-pid="${esc(p.id)}">
        ${isOnline(p.id) ? '<span class="online-dot" title="En ligne"></span>' : ''}${jersey(p)}
        <span class="pname">${esc(p.name)}</span>
        ${p.kit.team ? `<span class="pteam" style="--tb:${p.kit.body};--tc:${p.kit.num}">${esc(p.kit.team)}</span>` : ''}
        <span class="pbar"><i style="--p:${pct}%"></i></span>
        <span class="pmeta">${pct === 100 ? 'Complet ✓' : `${pct} % rempli`}</span>
      </button>`;
    }).join('') + `<button type="button" class="player player-add" id="addBtn"><span class="plus">+</span><span class="pname">Ajouter</span><span class="pmeta">un pote</span></button>`;
  });
}

function renderEditor() {
  const p = meP();
  $('#editor').classList.toggle('locked', !p);
  document.querySelectorAll('.brush').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.brush === brush)));
  renderMyCal();
  const note = $('#note');
  if (document.activeElement !== note) note.value = p ? p.note : '';
  $('#removeMe').textContent = p ? `Retirer ${p.name} de la liste` : '';
  $('#removeMe').hidden = !p;
}

function fillLabel() {
  return brush === 'clear' ? 'Effacer le mois' : `Tout le mois en ${STATUS[brush].icon}`;
}

function renderMyCal() {
  const el = $('#myCal');
  const others = state.people.filter((p) => p.id !== me);
  const hasMe = !!meP();
  withFocus(el, () => {
    el.innerHTML = MONTHS.map((mo, mi) => {
      const days = DAYS.filter((d) => d.mi === mi);
      let cells = '<span class="blank"></span>'.repeat(days[0].wd);
      cells += days.map((d) => {
        const s = hasMe ? st(me, d.key) : null;
        const star = others.length > 0 && others.every((p) => { const v = st(p.id, d.key); return v === 'ok' || v === 'maybe'; });
        const cls = ['day', s ? `s-${s}` : '', d.wd >= 5 ? 'wk' : '', justPainted.has(d.key) && !reduceMotion ? 'pop' : ''].filter(Boolean).join(' ');
        return `<button type="button" class="${cls}" data-key="${d.key}" aria-label="${fmtDay(d, true)} : ${STATUS[s || 'none'].label}${star ? ', tous les autres sont partants' : ''}"><span class="dn">${d.d}</span><span class="ico">${s ? STATUS[s].icon : ''}</span>${star ? '<span class="star" aria-hidden="true">★</span>' : ''}</button>`;
      }).join('');
      return `<div class="month">
        <div class="month-head"><h3>${MONTH_NAMES[mo.m - 1]} ${mo.y}</h3><button type="button" class="month-fill" data-mi="${mi}">${fillLabel()}</button></div>
        <div class="wd-row">${WD_LETTER.map((l) => `<span>${l}</span>`).join('')}</div>
        <div class="days">${cells}</div>
      </div>`;
    }).join('');
  });
  justPainted.clear();
}

function renderTeam() {
  const el = $('#team');
  const P = state.people;
  if (!P.length) { el.innerHTML = '<p class="empty">Chargement des dispos…</p>'; return; }
  const scrolls = [...el.querySelectorAll('.tg-scroll')].map((s) => s.scrollLeft);
  el.innerHTML = MONTHS.map((mo, mi) => {
    const items = A.per.filter((x) => x.day.mi === mi);
    const inDays = items.filter((x) => x.allIn).length;
    let h = `<div class="tg-month"><div class="tg-title"><b>${MONTH_NAMES[mo.m - 1]} ${mo.y}</b><span>${inDays ? `★ ${plural(inDays, 'jour')} où tout le monde est partant` : 'aucun jour où tout le monde est partant (pour l’instant)'}</span></div>`;
    h += `<div class="tg-scroll"><div class="tg" style="--n:${items.length}"><div class="nm"></div>`;
    items.forEach((x) => {
      const d = x.day;
      h += `<div class="hd${d.wd >= 5 ? ' wk' : ''}${x.allIn ? ' in' : ''}" data-key="${d.key}"><small>${WD_LETTER[d.wd]}</small>${d.d}</div>`;
    });
    P.forEach((p) => {
      const mine = p.id === me;
      h += `<div class="nm${mine ? ' me' : ''}"><i class="av" style="background:${swatch(p)}"></i>${esc(p.name)}</div>`;
      items.forEach((x) => {
        const s = st(p.id, x.day.key);
        h += `<div class="c${s ? ` s-${s}` : ''}${x.day.wd >= 5 ? ' wk' : ''}${mine ? ' mine' : ''}" data-pid="${esc(p.id)}" data-key="${x.day.key}">${s ? STATUS[s].icon : ''}</div>`;
      });
    });
    h += '<div class="nm sum-l">Partants</div>';
    items.forEach((x) => {
      h += `<div class="sum${x.allIn ? ' in' : ''}${x.no.length ? ' hasno' : ''}" data-key="${x.day.key}">${x.ok.length}${x.maybe.length ? `<small>+${x.maybe.length}</small>` : ''}</div>`;
    });
    return `${h}</div></div></div>`;
  }).join('');
  el.querySelectorAll('.tg-scroll').forEach((s, i) => { if (scrolls[i]) s.scrollLeft = scrolls[i]; });
}

function renderNotes() {
  const withNotes = state.people.filter((p) => p.note && p.note.trim());
  $('#notes').innerHTML = withNotes.map((p, i) => `
    <div class="note" style="--r:${[-1.5, 1, -.5, 1.5][i % 4]}deg">
      <h4><i style="background:${swatch(p)}"></i>${esc(p.name)}</h4>
      <p>${esc(p.note)}</p>
    </div>`).join('');
}

// ───────────── Interactions : mes dispos ─────────────
function setupEditor() {
  // Choix du joueur
  $('#players').addEventListener('click', (e) => {
    const add = e.target.closest('#addBtn');
    if (add) { $('#addForm').hidden = false; $('#addName').focus(); return; }
    const b = e.target.closest('.player[data-pid]');
    if (b) setMe(b.dataset.pid);
  });

  // Ajout d'un pote
  $('#addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#addName').value.trim().slice(0, 24);
    if (!name || !store) return;
    const existing = state.people.find((p) => p.name.toLowerCase() === name.toLowerCase());
    $('#addForm').hidden = true;
    $('#addName').value = '';
    if (existing) { setMe(existing.id); return; }
    const base = slug(name);
    let id = base;
    for (let i = 2; state.people.some((p) => p.id === id); i++) id = `${base}-${i}`;
    const order = Math.max(-1, ...state.people.map((p) => p.order)) + 1;
    save({ [`people/${id}`]: { name, order } });
    setMe(id);
  });
  $('#addCancel').addEventListener('click', () => { $('#addForm').hidden = true; });

  // Pinceaux
  $('#brushes').addEventListener('click', (e) => {
    const b = e.target.closest('.brush');
    if (!b) return;
    brush = b.dataset.brush;
    safeSet('trip40-brush', brush);
    renderEditor();
  });

  // Coloriage : glisser à la souris, toucher au doigt (pour ne pas colorier en scrollant)
  const cal = $('#myCal');
  let painting = null;
  let lastPointer = 'mouse';
  cal.addEventListener('pointerdown', (e) => {
    lastPointer = e.pointerType;
    if (e.pointerType === 'touch' || e.button > 0) return;
    const cell = e.target.closest('.day');
    if (!cell || !meP()) return;
    e.preventDefault();
    const value = toggleValue(cell.dataset.key);
    const start = DAYS.findIndex((d) => d.key === cell.dataset.key);
    painting = { value, start, done: new Set([cell.dataset.key]) };
    paint([cell.dataset.key], value);
  });
  // En glissant, on colorie toute la plage entre le jour de départ et le jour survolé.
  document.addEventListener('pointermove', (e) => {
    if (!painting) return;
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const cell = hit && hit.closest && hit.closest('#myCal .day');
    if (!cell) return;
    const i = DAYS.findIndex((d) => d.key === cell.dataset.key);
    const keys = DAYS.slice(Math.min(i, painting.start), Math.max(i, painting.start) + 1)
      .map((d) => d.key)
      .filter((k) => !painting.done.has(k));
    if (!keys.length) return;
    keys.forEach((k) => painting.done.add(k));
    paint(keys, painting.value);
  });
  ['pointerup', 'pointercancel'].forEach((t) => document.addEventListener(t, () => { painting = null; }));
  cal.addEventListener('click', (e) => {
    const fill = e.target.closest('.month-fill');
    if (fill) { fillMonth(+fill.dataset.mi); return; }
    const cell = e.target.closest('.day');
    if (cell && meP() && (e.detail === 0 || lastPointer === 'touch')) paint([cell.dataset.key], toggleValue(cell.dataset.key));
  });

  // Petit mot
  const note = $('#note');
  let timer = null;
  const flush = () => {
    clearTimeout(timer);
    const p = meP();
    if (!p) return;
    const v = note.value.trim().slice(0, 280);
    if (v === (p.note || '')) return;
    save({ [`people/${p.id}/note`]: v || null });
  };
  note.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(flush, 800); });
  note.addEventListener('blur', flush);

  // Retirer un pote
  $('#removeMe').addEventListener('click', () => {
    const p = meP();
    if (!p) return;
    if (!confirm(`Retirer ${p.name} et toutes ses dispos ? C’est définitif.`)) return;
    const u = { [`people/${p.id}`]: null };
    Object.keys(state.days[p.id] || {}).forEach((k) => { u[`days/${p.id}/${k}`] = null; });
    save(u);
    me = null;
    safeSet('trip40-me', null);
    store.setPresence(null);
    toast(`${p.name} a été retiré de la liste.`);
  });
}

function fillMonth(mi) {
  const p = meP();
  if (!p) return;
  const keys = DAYS.filter((d) => d.mi === mi).map((d) => d.key);
  const prev = Object.fromEntries(keys.map((k) => [k, st(p.id, k)]));
  const value = brush === 'clear' ? null : brush;
  paint(keys, value);
  const label = value ? `tout en « ${STATUS[value].label} »` : 'effacé';
  toast(`${MONTH_NAMES[MONTHS[mi].m - 1][0].toUpperCase()}${MONTH_NAMES[MONTHS[mi].m - 1].slice(1)} : ${label}`, {
    label: 'Annuler',
    fn: () => {
      const u = {};
      keys.forEach((k) => { u[`days/${p.id}/${k}`] = prev[k]; });
      save(u);
    },
  });
}

// ───────────── Interactions : planning et bandeau ─────────────
function setupTeam() {
  const team = $('#team');
  const info = $('#teamInfo');
  const showCell = (c) => {
    const p = state.people.find((x) => x.id === c.dataset.pid);
    const d = DAYS.find((x) => x.key === c.dataset.key);
    if (!p || !d) return;
    const s = st(p.id, d.key) || 'none';
    const mine = p.id === me ? ' <span class="muted">(clique pour changer)</span>' : '';
    info.innerHTML = `<b>${esc(p.name)}</b> · ${fmtDay(d, true)} · ${STATUS[s].label}${mine}${p.note ? `<br><span class="muted">« ${esc(p.note)} »</span>` : ''}`;
  };
  const showDay = (key) => {
    const x = A.per.find((y) => y.day.key === key);
    if (!x) return;
    const parts = [];
    if (x.ok.length) parts.push(`✓ ${names(x.ok)}`);
    if (x.maybe.length) parts.push(`? ${names(x.maybe)}`);
    if (x.no.length) parts.push(`✕ ${names(x.no)}`);
    if (x.none.length) parts.push(`… ${names(x.none)}`);
    info.innerHTML = `<b>${fmtDay(x.day, true)}</b> · ${x.allIn ? '★ tout le monde est partant' : `${x.inCount}/${state.people.length} partants`}<br>${parts.join(' · ')}`;
  };
  team.addEventListener('pointerover', (e) => {
    const c = e.target.closest('.c');
    if (c) { showCell(c); return; }
    const h = e.target.closest('.hd, .sum');
    if (h) showDay(h.dataset.key);
  });
  team.addEventListener('click', (e) => {
    const c = e.target.closest('.c');
    if (c) {
      if (c.dataset.pid === me && meP()) {
        const cur = st(me, c.dataset.key);
        const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
        save({ [`days/${me}/${c.dataset.key}`]: next });
        setTimeout(() => {
          const again = $(`#team .c[data-pid="${CSS.escape(me)}"][data-key="${c.dataset.key}"]`);
          if (again) showCell(again);
        }, 30);
      } else showCell(c);
      return;
    }
    const h = e.target.closest('.hd, .sum');
    if (h) showDay(h.dataset.key);
  });
}

function setupStrip() {
  const strip = $('#strip');
  const pick = (x) => {
    let found = null;
    for (const b of strip.querySelectorAll('.bar')) {
      const r = b.getBoundingClientRect();
      if (x >= r.left - 1 && x <= r.right + 1) { found = b; break; }
    }
    if (!found) return;
    const i = +found.dataset.i;
    if (i === stripSel) return;
    stripSel = i;
    strip.querySelectorAll('.bar.on').forEach((b) => b.classList.remove('on'));
    found.classList.add('on');
    showStripDetail(i);
  };
  strip.addEventListener('pointermove', (e) => pick(e.clientX));
  strip.addEventListener('pointerdown', (e) => pick(e.clientX));
}

// ───────────── La roue ─────────────
function buildCities() {
  $('#cities').innerHTML = CITIES.map((c) => `
    <article class="city" data-city="${c.id}" style="--c:${c.color};--ci:${c.ink}">
      <span class="city-emoji" aria-hidden="true">${c.emoji}</span>
      <h3>${c.name}</h3>
      <p>${c.fact}</p>
    </article>`).join('');
}

function buildWheel() {
  const svg = $('#wheel');
  const n = CITIES.length;
  const step = 360 / n;
  const R = 100;
  const pt = (r, a) => [r * Math.sin((a * Math.PI) / 180), -r * Math.cos((a * Math.PI) / 180)];
  let s = '<defs><radialGradient id="shade" r="0.75"><stop offset="0.35" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></radialGradient></defs>';
  s += '<circle r="111" fill="#141c3f"/>';
  CITIES.forEach((c, i) => {
    const a0 = i * step;
    const a1 = (i + 1) * step;
    const [x0, y0] = pt(R, a0);
    const [x1, y1] = pt(R, a1);
    const large = step > 180 ? 1 : 0;
    s += `<path d="M0 0L${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z" fill="${c.color}" stroke="#141c3f" stroke-width="2.5"/>`;
    const mid = a0 + step / 2;
    s += `<g transform="rotate(${mid})">
      <text y="-56" text-anchor="middle" font-size="${c.name.length > 8 ? 12.5 : 14}" fill="${c.ink}" letter-spacing=".3">${c.name}</text>
      <text y="-76" text-anchor="middle" dominant-baseline="central" font-size="19">${c.emoji}</text>
    </g>`;
  });
  s += `<circle r="${R}" fill="url(#shade)" stroke="#141c3f" stroke-width="3"/>`;
  s += '<circle r="34" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="3 5" opacity=".7"/>';
  for (let i = 0; i < 20; i++) {
    const [x, y] = pt(105.5, i * 18 + 9);
    s += `<circle class="bulb${i % 2 ? ' alt' : ''}" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3" fill="#fff6c2"/>`;
  }
  svg.innerHTML = s;

  // Rotation continue : elle ralentit après un coup de pouce, mais ne s'arrête jamais.
  const pointer = $('.wheel-pointer');
  const now = $('#wheelNow');
  const cards = [...document.querySelectorAll('.city')];
  const BASE = reduceMotion ? 3 : 9; // degrés par seconde
  let angle = Math.random() * 360;
  let speed = BASE;
  let lastT = null;
  let lastSeg = -1;

  const onSegment = (seg, tick) => {
    const c = CITIES[seg];
    now.textContent = `${c.emoji} ${c.name}`;
    now.style.background = c.color;
    now.style.color = c.ink;
    cards.forEach((el) => el.classList.toggle('active', el.dataset.city === c.id));
    if (tick && !reduceMotion) {
      pointer.classList.remove('tick');
      void pointer.offsetWidth;
      pointer.classList.add('tick');
    }
  };
  const frame = (t) => {
    if (lastT == null) lastT = t;
    const dt = Math.min(0.1, (t - lastT) / 1000);
    lastT = t;
    speed = BASE + (speed - BASE) * Math.exp(-dt / 1.6);
    angle = (angle + speed * dt) % 360;
    svg.style.transform = `rotate(${angle.toFixed(2)}deg)`;
    const phi = (360 - angle) % 360;
    const seg = Math.floor(phi / step) % n;
    if (seg !== lastSeg) { onSegment(seg, lastSeg !== -1); lastSeg = seg; }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  $('#wheelHub').addEventListener('click', () => {
    speed = Math.min(speed + (reduceMotion ? 60 : 480), reduceMotion ? 90 : 1100);
  });
}

// ───────────── Carte collector & confettis ─────────────
function setupCard() {
  const card = $('#card');
  card.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || reduceMotion) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    card.classList.add('tilting');
    card.style.setProperty('--ry', `${((px - 0.5) * 18).toFixed(1)}deg`);
    card.style.setProperty('--rx', `${((0.5 - py) * 18).toFixed(1)}deg`);
    card.style.setProperty('--mx', `${(px * 100).toFixed(0)}%`);
    card.style.setProperty('--my', `${(py * 100).toFixed(0)}%`);
  });
  card.addEventListener('pointerleave', () => {
    card.classList.remove('tilting');
    ['--rx', '--ry', '--mx', '--my'].forEach((v) => card.style.removeProperty(v));
  });
  const burstAt = (el) => {
    const r = el.getBoundingClientRect();
    confetti(160, r.left + r.width / 2, r.top + r.height / 2);
  };
  card.addEventListener('click', () => burstAt(card));
  const j = $('#jersey40');
  j.addEventListener('click', () => burstAt(j));
  j.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); burstAt(j); } });
  setTimeout(() => burstAt(j), 700);
}

const confettiState = { parts: [], running: false };
function confetti(n = 140, ox = innerWidth / 2, oy = innerHeight * 0.3) {
  if (reduceMotion) return;
  const cv = $('#confetti');
  const cx = cv.getContext('2d');
  const dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== Math.round(innerWidth * dpr) || cv.height !== Math.round(innerHeight * dpr)) {
    cv.width = Math.round(innerWidth * dpr);
    cv.height = Math.round(innerHeight * dpr);
  }
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = ['#e63946', '#ff7a2f', '#ffbe2e', '#1fa45b', '#1d4e89', '#ffffff'];
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 3 + Math.random() * 8;
    confettiState.parts.push({
      x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
      w: 6 + Math.random() * 6, h: 4 + Math.random() * 5,
      c: colors[i % colors.length], life: 0, max: 90 + Math.random() * 70,
    });
  }
  if (confettiState.running) return;
  confettiState.running = true;
  const step = () => {
    cx.clearRect(0, 0, innerWidth, innerHeight);
    confettiState.parts = confettiState.parts.filter((p) => p.life < p.max && p.y < innerHeight + 30);
    for (const p of confettiState.parts) {
      p.life++;
      p.vy += 0.22;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      cx.save();
      cx.translate(p.x, p.y);
      cx.rotate(p.r);
      cx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      cx.fillStyle = p.c;
      cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
      cx.restore();
    }
    if (confettiState.parts.length) requestAnimationFrame(step);
    else { confettiState.running = false; cx.clearRect(0, 0, innerWidth, innerHeight); }
  };
  requestAnimationFrame(step);
}

// ───────────── Toasts ─────────────
function toast(msg, action) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  const span = document.createElement('span');
  span.textContent = msg;
  el.append(span);
  const dismiss = () => {
    if (el.classList.contains('out')) return;
    el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  };
  if (action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = action.label;
    b.addEventListener('click', () => { action.fn(); dismiss(); });
    el.append(b);
  }
  box.append(el);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(dismiss, action ? 6500 : 4000);
}
