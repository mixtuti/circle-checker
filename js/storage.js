// localStorage 管理（イベント/サークル）
export const STORAGE_KEY = 'cc.events.v1';

export function loadEvents() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
export function saveEvents(events) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}
export function listEventNames() {
  return loadEvents().map(ev => ev.event);
}
export function getEventIndexByName(events, name) {
  return events.findIndex(ev => ev.event === name);
}
export function upsertCircle(eventName, circle) {
  const events = loadEvents();
  let idx = getEventIndexByName(events, eventName);
  if (idx === -1) {
    events.push({ event: eventName, circles: [] });
    idx = events.length - 1;
  }
  events[idx].circles.push(circle);
  saveEvents(events);
}

// index 指定で1件削除
export function deleteCircleByIndex(eventName, index) {
  const events = loadEvents();
  const ei = events.findIndex(ev => ev.event === eventName);
  if (ei === -1) return false;
  if (!events[ei].circles[index]) return false;
  events[ei].circles.splice(index, 1);
  saveEvents(events);
  return true;
}

// index 指定で1件更新（patchは上書き値）
export function updateCircleByIndex(eventName, index, patch) {
  const events = loadEvents();
  const ei = events.findIndex(ev => ev.event === eventName);
  if (ei === -1) return false;
  const c = events[ei].circles[index];
  if (!c) return false;
  events[ei].circles[index] = { ...c, ...patch };
  saveEvents(events);
  return true;
}

// イベント取得（名前で）
export function getEventByName(name) {
  return loadEvents().find(ev => ev.event === name);
}

// イベント一覧（名称のみ）
export function listEvents() {
  return loadEvents().map(ev => ev.event);
}

// イベント作成（無ければ空メタで作成）
export function ensureEvent(name) {
  const events = loadEvents();
  let idx = events.findIndex(e => e.event === name);
  if (idx === -1) {
    events.push({ event: name, meta: { date: '', venue: '', mapUrl: '', officialUrl: '', sns: [] }, circles: [] });
    saveEvents(events);
    idx = events.length - 1;
  } else if (!events[idx].meta) {
    events[idx].meta = { date: '', venue: '', mapUrl: '', officialUrl: '', sns: [] };
    saveEvents(events);
  }
  return events[idx];
}

// メタを上書き（patch）
export function upsertEventMeta(name, patch) {
  const events = loadEvents();
  const i = events.findIndex(e => e.event === name);
  if (i === -1) {
    events.push({ event: name, meta: { ...defaultMeta(), ...patch }, circles: [] });
  } else {
    const base = events[i].meta || defaultMeta();
    events[i].meta = { ...base, ...normalizeMeta(patch) };
  }
  saveEvents(events);
}

function defaultMeta() {
  return { date: '', venue: '', mapUrl: '', officialUrl: '', sns: [] };
}
function normalizeMeta(m) {
  return {
    date: (m?.date ?? '').trim?.() || '',
    venue: (m?.venue ?? '').trim?.() || '',
    mapUrl: (m?.mapUrl ?? '').trim?.() || '',
    officialUrl: (m?.officialUrl ?? '').trim?.() || '',
    sns: Array.isArray(m?.sns) ? m.sns.map(x => String(x).trim()).filter(Boolean) : []
  };
}

// イベント名の変更
export function renameEvent(oldName, newName) {
  const events = loadEvents();
  const i = events.findIndex(e => e.event === oldName);
  if (i === -1) return false;
  // 衝突チェック
  if (events.some(e => e.event === newName)) return false;
  events[i].event = newName;
  saveEvents(events);
  return true;
}

// イベント削除（メタとサークルごと）
export function deleteEvent(name) {
  const events = loadEvents().filter(e => e.event !== name);
  saveEvents(events);
}

/* ============================================================
   ここから追加：インポート（JSON）機能
   - importEvents(incomingEvents, mode)
   - normalizeEvents(arr)
   ============================================================ */

/**
 * JSON 取り込み
 * mode: 'replace' | 'merge'
 *  - replace: 全入れ替え
 *  - merge  : イベント名＝同一の中で「サークル名キー」一致は上書き、それ以外は追加
 */
export function importEvents(incomingEvents, mode = 'merge') {
  const cleanedIncoming = normalizeEvents(incomingEvents);

  if (mode === 'replace') {
    saveEvents(cleanedIncoming);
    return { replaced: cleanedIncoming.length, added: 0, updated: 0 };
  }

  // === merge ===
  const current = normalizeEvents(loadEvents());
  const evMap = new Map(current.map(ev => [ev.event, ev]));

  let added = 0, updated = 0;

  const key = (s) => String(s || '').replace(/\u3000/g, ' ').trim().toLowerCase();

  cleanedIncoming.forEach(inc => {
    const cur = evMap.get(inc.event);
    if (!cur) {
      evMap.set(inc.event, inc);
      added += inc.circles.length;
      return;
    }
    // サークル名キーでマージ
    const curCircleMap = new Map(cur.circles.map(c => [key(c.name), c]));
    inc.circles.forEach(c => {
      const k = key(c.name);
      if (!k) return; // 無名はスキップ
      if (curCircleMap.has(k)) {
        Object.assign(curCircleMap.get(k), c);
        updated++;
      } else {
        curCircleMap.set(k, c);
        added++;
      }
    });
    cur.circles = [...curCircleMap.values()];
    // メタ（開催日など）は新側に値があれば上書き
    cur.meta = { ...(cur.meta || defaultMeta()), ...(inc.meta || {}) };
  });

  const merged = [...evMap.values()];
  saveEvents(merged);
  return { added, updated, replaced: 0 };
}

/** 入力配列を安全な形へ正規化 */
function normalizeEvents(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(e => ({
    event: String(e?.event || '').trim(),
    meta: e?.meta
      ? {
        date: String(e.meta.date || '').trim(),
        venue: String(e.meta.venue || '').trim(),
        mapUrl: String(e.meta.mapUrl || '').trim(),
        officialUrl: String(e.meta.officialUrl || '').trim(),
        sns: Array.isArray(e.meta.sns) ? e.meta.sns.map(x => String(x).trim()).filter(Boolean) : []
      }
      : (e?.date ? { date: String(e.date).trim(), venue: '', mapUrl: '', officialUrl: '', sns: [] } : { date: '', venue: '', mapUrl: '', officialUrl: '', sns: [] }),
    circles: Array.isArray(e?.circles) ? e.circles.map(c => ({
      name: String(c?.name || '').trim(),
      owner: String(c?.owner || '').trim(),
      island: String(c?.island || '').trim(),
      seat: String(c?.seat || '').trim(),
      tags: Array.isArray(c?.tags) ? c.tags.map(t => String(t)) : [],
      links: Array.isArray(c?.links) ? c.links.map(u => String(u)) : [],
      r18: !!c?.r18,
      favorite: !!c?.favorite,
      avatar: String(c?.avatar || '')
    })) : []
  })).filter(e => e.event); // event名が空のものは除外
}

const CIRCLE_MASTER_KEY = 'cc.circleMaster.v1';

function loadCircleMasterMap() {
  try { return JSON.parse(localStorage.getItem(CIRCLE_MASTER_KEY) || '{}'); }
  catch { return {}; }
}
function saveCircleMasterMap(map) {
  localStorage.setItem(CIRCLE_MASTER_KEY, JSON.stringify(map));
}

/**
 * サークル名でマスターデータを登録/更新
 * @param {string} name
 * @param {{avatar:string, owner:string, links:Array<{label:string,url:string}>, favorite:boolean}} master
 */
export function upsertCircleMaster(name, master) {
  if (!name) return;
  const map = loadCircleMasterMap();
  map[name] = { ...map[name], ...master };
  saveCircleMasterMap(map);
}

/** サークル名でマスターデータ取得 */
export function getCircleMaster(name) {
  if (!name) return null;
  const map = loadCircleMasterMap();
  return map[name] || null;
}

/** （必要なら）マスター登録済みサークル名一覧 */
export function listCircleMasterNames() {
  return Object.keys(loadCircleMasterMap()).sort();
}