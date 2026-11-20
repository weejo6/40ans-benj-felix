// Couche de stockage : Firebase Realtime Database (partagé, temps réel)
// ou localStorage (mode démo, sur cet appareil seulement).
import { firebaseConfig, ROOT } from './config.js?v=20261120b';

const FIREBASE_VERSION = '12.6.0';

export async function createStore() {
  if (firebaseConfig && firebaseConfig.databaseURL) return createFirebaseStore();
  return createLocalStore();
}

async function createFirebaseStore() {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
  const [{ initializeApp }, rtdb] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-database.js`),
  ]);
  const { getDatabase, ref, onValue, update, set, remove, runTransaction, onDisconnect, serverTimestamp } = rtdb;
  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);
  const rootRef = ref(db, ROOT);
  const sessionId = Math.random().toString(36).slice(2, 10);
  let presenceRef = null;
  let connected = false;

  onValue(ref(db, '.info/connected'), (s) => {
    connected = !!s.val();
    if (connected && presenceRef) armPresence(presenceRef);
  });

  function armPresence(r) {
    onDisconnect(r).remove().then(() => set(r, serverTimestamp())).catch(() => {});
  }

  return {
    mode: 'firebase',
    subscribe(cb, onError) {
      return onValue(rootRef, (s) => cb(s.val() || {}), (err) => onError && onError(err));
    },
    onConnection(cb) {
      return onValue(ref(db, '.info/connected'), (s) => cb(!!s.val()));
    },
    write(updates) {
      return update(rootRef, updates);
    },
    async seedIfEmpty(seedUpdates) {
      const res = await runTransaction(ref(db, `${ROOT}/meta/seeded`), (cur) => (cur ? undefined : true));
      if (res.committed) await update(rootRef, seedUpdates);
    },
    setPresence(pid) {
      if (presenceRef) {
        const old = presenceRef;
        onDisconnect(old).cancel().catch(() => {});
        remove(old).catch(() => {});
      }
      presenceRef = pid ? ref(db, `${ROOT}/presence/${pid}/${sessionId}`) : null;
      if (presenceRef && connected) armPresence(presenceRef);
    },
  };
}

function createLocalStore() {
  const KEY = 'trip40-demo';
  const subs = new Set();
  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  };
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* stockage indisponible */ }
  };
  let data = load();
  const emit = () => subs.forEach((cb) => cb(structuredClone(data)));
  const apply = (updates) => {
    for (const [path, value] of Object.entries(updates)) setPath(data, path.split('/'), value);
  };
  // Les autres onglets du même navigateur se synchronisent aussi.
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) { data = load(); emit(); }
  });

  return {
    mode: 'local',
    subscribe(cb) {
      subs.add(cb);
      cb(structuredClone(data));
      return () => subs.delete(cb);
    },
    onConnection(cb) { cb(true); return () => {}; },
    async write(updates) { apply(updates); save(); emit(); },
    async seedIfEmpty(seedUpdates) {
      if (data.meta && data.meta.seeded) return;
      apply({ ...seedUpdates, 'meta/seeded': true });
      save();
      emit();
    },
    setPresence() {},
  };
}

function setPath(obj, parts, value) {
  const [head, ...rest] = parts;
  if (!rest.length) {
    if (value === null || value === undefined) delete obj[head];
    else obj[head] = value && typeof value === 'object' ? structuredClone(value) : value;
    return;
  }
  if (!obj[head] || typeof obj[head] !== 'object') {
    if (value === null) return;
    obj[head] = {};
  }
  setPath(obj[head], rest, value);
  if (!Object.keys(obj[head]).length) delete obj[head];
}
