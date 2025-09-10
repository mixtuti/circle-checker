import {
  loadEvents, updateCircleByIndex, deleteCircleByIndex, importEvents
} from './storage.js';
import { iconClassFor } from './icons.js';
import { applyAutoTheme } from './theme.js';

applyAutoTheme();

const $eventSelect = document.getElementById('eventSelect');
const $btnCard = document.getElementById('btnCard');
const $btnList = document.getElementById('btnList');
const $mount = document.getElementById('mount');
const $q = document.getElementById('q');
const $sortBy = document.getElementById('sortBy');
const $mergeDup = document.getElementById('mergeDup');

// ★ 追加：購入済み非表示トグル
const $hideDone = document.getElementById('hideDone');
const $clearDone = document.getElementById('clearDone');

const VIEW_KEY  = 'cc.viewMode';
const SORT_KEY  = 'cc.sortBy';
const Q_KEY     = 'cc.query';
const EV_KEY    = 'cc.event';
const MERGE_KEY = 'cc.mergeAll';
const HIDE_FLG  = 'cc.hideDoneFlag';
const DONE_KEY  = 'cc.done.v1'; // { [eventName]: number[] }

const $btnExport = document.getElementById('btnExport');
const $fileImport = document.getElementById('fileImport');

$btnExport?.addEventListener('click', onExportJSON);
$fileImport?.addEventListener('change', onImportJSON);

let viewMode = localStorage.getItem(VIEW_KEY) || 'card';
let sortMode = localStorage.getItem(SORT_KEY) || 'space';
let query    = localStorage.getItem(Q_KEY) || '';
let mergeDup = localStorage.getItem(MERGE_KEY);
mergeDup = mergeDup === null ? true : mergeDup === 'true';
let hideDone = (localStorage.getItem(HIDE_FLG) ?? 'true') === 'true';

let all = loadEvents();

/* ===== done 永続化 ===== */
function loadDoneMap(){
  try { return JSON.parse(localStorage.getItem(DONE_KEY)) || {}; }
  catch { return {}; }
}
function saveDoneMap(map){
  localStorage.setItem(DONE_KEY, JSON.stringify(map));
}
function isDone(eventName, index){
  const map = loadDoneMap();
  const arr = map[eventName] || [];
  return arr.includes(index);
}
function markDone(eventName, index){
  const map = loadDoneMap();
  const arr = new Set(map[eventName] || []);
  arr.add(index);
  map[eventName] = [...arr];
  saveDoneMap(map);
}
function undoDone(eventName, index){
  const map = loadDoneMap();
  const arr = new Set(map[eventName] || []);
  arr.delete(index);
  map[eventName] = [...arr];
  saveDoneMap(map);
}
function clearDoneAll(){
  saveDoneMap({});
}

/* ===== URLユーティリティ ===== */
function eventNameFromValue(val) {
  if (val === '__ALL__') return 'ALL';
  const idx = Number(val);
  return (all[idx] && all[idx].event) ? all[idx].event : '';
}
function updateURLForEvent(name) {
  const url = new URL(location.href);
  if (name && name.trim()) url.searchParams.set('event', name.trim());
  else url.searchParams.delete('event');
  history.replaceState(null, '', url.toString());
}

/* ===== 表示切替ボタンの同期 ===== */
function syncViewButtons(){
  const isCard = viewMode === 'card';
  $btnCard.classList.toggle('active', isCard);
  $btnList.classList.toggle('active', !isCard);
  $btnCard.setAttribute('aria-selected', String(isCard));
  $btnList.setAttribute('aria-selected', String(!isCard));
}

/* ===== 初期化：イベント選択 ===== */
(function initSelect(){
  $eventSelect.innerHTML = '';
  const optAll = document.createElement('option');
  optAll.value = '__ALL__'; optAll.textContent = 'ALL（全イベント）';
  $eventSelect.appendChild(optAll);

  all.forEach((ev, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = ev.event;
    $eventSelect.appendChild(opt);
  });

  const url = new URL(location.href);
  const evParamRaw = url.searchParams.get('event');
  let initialValue = null;

  if (evParamRaw) {
    const evParam = evParamRaw;
    if (evParam.toUpperCase() === 'ALL') {
      initialValue = '__ALL__';
    } else {
      const idx = all.findIndex(e => (e.event || '') === evParam);
      if (idx >= 0) initialValue = String(idx);
    }
  }
  if (!initialValue) {
    const savedEv = localStorage.getItem(EV_KEY);
    initialValue = (savedEv && [...$eventSelect.options].some(o=>o.value===savedEv))
      ? savedEv : '__ALL__';
  }

  $eventSelect.value = initialValue;
  localStorage.setItem(EV_KEY, initialValue);
  updateURLForEvent(eventNameFromValue(initialValue));

  syncViewButtons();
  $sortBy.value = sortMode;
  $q.value = query;
  if ($mergeDup) $mergeDup.checked = mergeDup;
  if ($hideDone) $hideDone.checked = true;

  render();
})();

/* ===== UIイベント ===== */
$btnCard.addEventListener('click', () => {
  viewMode='card'; localStorage.setItem(VIEW_KEY,viewMode); syncViewButtons(); render();
});
$btnList.addEventListener('click', () => {
  viewMode='list'; localStorage.setItem(VIEW_KEY,viewMode); syncViewButtons(); render();
});
$eventSelect.addEventListener('change', () => {
  const val = $eventSelect.value;
  localStorage.setItem(EV_KEY, val);
  updateURLForEvent(eventNameFromValue(val));
  render();
});
$q.addEventListener('input', () => { query=$q.value; localStorage.setItem(Q_KEY,query); render(); });
$sortBy.addEventListener('change', () => { sortMode=$sortBy.value; localStorage.setItem(SORT_KEY,sortMode); render(); });
$mergeDup?.addEventListener('change', () => { mergeDup=$mergeDup.checked; localStorage.setItem(MERGE_KEY,String(mergeDup)); render(); });

// ★ 購入済み非表示トグル
$hideDone?.addEventListener('change', () => {
  hideDone = $hideDone.checked;
  localStorage.setItem(HIDE_FLG, String(hideDone));
  render();
});

// ★ 完了フラグ 全解除（任意）
$clearDone?.addEventListener('click', () => {
  if (confirm('全イベントの完了フラグを解除しますか？')) {
    clearDoneAll();
    render();
  }
});

/* ===== 行内操作（編集/削除/済・戻す/サークル詳細） ===== */
$mount.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (btn) {
    const act = btn.dataset.action;
    const evName = btn.dataset.event;
    const index = Number(btn.dataset.index);
    if (!evName || Number.isNaN(index)) return;

    if (act === 'delete') {
      if (confirm('削除しますか？')) { deleteCircleByIndex(evName, index); reloadDataAndRender(); }
    } else if (act === 'edit') {
      openEditModalByEventAndIndex(evName, index);
    } else if (act === 'done') {
      markDone(evName, index); render();
    } else if (act === 'undo') {
      undoDone(evName, index); render();
    }
    return;
  }

  // サークル名クリック → 詳細モーダル
  const circleBtn = e.target.closest('.circle-link');
  if (circleBtn) {
    const name = circleBtn.dataset.circle || '';
    if (name) openCircleModalByName(name);
  }
});

function reloadDataAndRender(){ all = loadEvents(); render(); }

/* ===== データ組み立て ===== */
function getSelection(){
  const val = $eventSelect.value;
  if (val === '__ALL__') return { mode:'ALL' };
  const idx = Number(val);
  return { mode:'SINGLE', event: all[idx] };
}

// 同名まとめ
function buildAllMerged(){
  const keyOf = (name) => (name || '').toString().replace(/\u3000/g,' ').trim().toLowerCase();
  const map = new Map();

  all.forEach(ev => {
    ev.circles.forEach((c, idx) => {
      const k = keyOf(c.name);
      if (!k) return;
      const entry = map.get(k) || {
        key:k, name:c.name || '(無名)', owner:c.owner||'',
        avatar:c.avatar||'', favorite:Boolean(c.favorite), r18:Boolean(c.r18),
        tags:new Set(), links:new Set(), appearances: [] // { event, index, island, seat }
      };
      if (!entry.avatar && c.avatar) entry.avatar = c.avatar;
      entry.favorite = entry.favorite || !!c.favorite;
      entry.r18 = entry.r18 || !!c.r18;
      (c.tags||[]).forEach(t=>entry.tags.add(String(t)));
      (c.links||[]).forEach(u=>entry.links.add(String(u)));
      entry.appearances.push({ event: ev.event, index: idx, island: c.island||'', seat: c.seat||'' });
      map.set(k, entry);
    });
  });

  // ★ hideDone を適用：可視な出現だけ残す
  const res = [];
  for (const e of map.values()){
    const visibleApps = e.appearances.filter(a => !(hideDone && isDone(a.event, a.index)));
    if (visibleApps.length === 0) continue; // 全部済なら非表示
    res.push({
      type:'merged',
      name: e.name, owner: e.owner, avatar: e.avatar,
      favorite: e.favorite, r18: e.r18,
      tags: [...e.tags], links: [...e.links],
      events: visibleApps
    });
  }
  return res;
}

// ALLフラット
function buildAllFlat(){
  const rows = [];
  all.forEach(ev => {
    ev.circles.forEach((c, idx) => {
      if (hideDone && isDone(ev.event, idx)) return; // ★非表示
      rows.push({ type:'flat', event: ev.event, index: idx, ...c });
    });
  });
  return rows;
}

function filterAndSort(rows){
  const filtered = rows.filter(c => matchQuery(c, query));
  return sortCircles(filtered, sortMode);
}

function matchQuery(c, q){
  if (!q) return true;
  const parts = [
    c.name||'', c.owner||'',
    c.island||'', c.seat||'',
    ...(Array.isArray(c.tags)?c.tags:[]),
    ...(Array.isArray(c.links)?c.links:[]),
    ...(Array.isArray(c.events)?c.events.map(e=>e.event):[]),
    (c.event||'')
  ];
  return parts.join(' ').toLowerCase().includes(q.toLowerCase());
}

function sortCircles(arr, mode){
  const a = arr.slice();
  if (mode === 'name') {
    a.sort((x,y) => (x.name||'').localeCompare(y.name||'', 'ja'));
  } else if (mode === 'favorite') {
    a.sort((x,y) => Number(Boolean(y.favorite)) - Number(Boolean(x.favorite)) || bySpaceThenName(x,y));
  } else {
    a.sort(bySpaceThenName);
  }
  return a;
}
function bySpaceThenName(a,b){
  const ia = (a.island || (a.events?.[0]?.island)||'').toString();
  const ib = (b.island || (b.events?.[0]?.island)||'').toString();
  const ic = ia.localeCompare(ib, 'ja'); if (ic !== 0) return ic;
  const sa = (a.seat || (a.events?.[0]?.seat)||'').toString();
  const sb = (b.seat || (b.events?.[0]?.seat)||'').toString();
  const sc = sa.localeCompare(sb, 'ja', { numeric:true, sensitivity:'base' }); if (sc !== 0) return sc;
  return (a.name||'').localeCompare((b.name||''), 'ja');
}

/* ===== レンダリング ===== */
function render(){
  const sel = getSelection();

  if (sel.mode === 'SINGLE') {
    // 単一イベント：hideDone はここで適用
    const ev = sel.event;
    if (!ev || !ev.circles.length) {
      $mount.innerHTML = `<div class="card">「${sel.event?.event||'-'}」にサークルがありません。</div>`;
      return;
    }
    const rows = ev.circles
      .map((c, idx) => ({ ...c, event: ev.event, index: idx, type:'single' }))
      .filter(row => !(hideDone && isDone(row.event, row.index)));

    const data = filterAndSort(rows);
    if (viewMode === 'card') renderCards(data, sel); else renderList(data, sel);
    return;
  }

  // ALL
  if (all.length === 0) {
    $mount.innerHTML = `<div class="card">まだデータがありません。<br><a href="register.html">登録ページ</a>から追加してください。</div>`;
    return;
  }

  const rows = mergeDup ? buildAllMerged() : buildAllFlat();
  const data = filterAndSort(rows);
  if (viewMode === 'card') renderCards(data, sel); else renderList(data, sel);
}

function avatarHTML(c){
  if (c.avatar) return `<div class="avatar"><img src="${c.avatar}" alt=""></div>`;
  return `<div class="avatar"><div class="ph"><i class="fa-regular fa-image"></i></div></div>`;
}
function linksHTML(links){
  if (!Array.isArray(links) || links.length===0) return `<span class="meta">リンクなし</span>`;
  return links.slice(0,6).map(u => {
    const cls = iconClassFor(u) + ' fa-fw';
    return `<a href="${u}" target="_blank" rel="noopener noreferrer" title="${u}"><i class="${cls}"></i></a>`;
  }).join('');
}
function tagsHTML(tags){
  if (!Array.isArray(tags) || tags.length===0) return '';
  return `<div class="tags">${tags.map(t=>`<span class="tag">${escapeHtml(String(t))}</span>`).join('')}</div>`;
}
function flagsHTML(c){
  const flags = [];
  if (c.favorite) flags.push(`<span class="star" title="推し">★</span>`);
  if (c.r18) flags.push(`<span class="badge r18" title="R18">R18</span>`);
  return flags.join(' ');
}
function evChipsHTML(c){
  if (!Array.isArray(c.events) || !c.events.length) return '';
  const chips = c.events.slice(0,6).map(e => {
    const sp = [e.island, e.seat].filter(Boolean).join(' ');
    return `<span class="evt"><span class="name">${escapeHtml(e.event)}</span>${sp?` <span class="space">${escapeHtml(sp)}</span>`:''}</span>`;
  }).join('');
  return `<div class="evchips">${chips}${c.events.length>6?` <span class="badge">他${c.events.length-6}</span>`:''}</div>`;
}

function renderCards(items, sel){
  const grid = document.createElement('div');
  grid.className = 'grid';

  items.forEach(c => {
    const canEdit = !(sel.mode==='ALL' && mergeDup && c.type==='merged');
    const actions = canEdit
      ? actionButtonsHTML(c.event, c.index)
      : `<span class="help">編集できません</span>`;

    const doneToggle = (c.event!=null && c.index!=null && canEdit)
      ? doneButtonHTML(c.event, c.index)
      : '';

    const space = (c.island||'') + (c.seat?` ${c.seat}`:'');
    const evBadges = c.events ? evChipsHTML(c) : '';

    const item = document.createElement('div');
    item.className = 'card card-item';
    item.innerHTML = `
      ${avatarHTML(c)}
      <div class="body">
        <div class="name">
          <button class="circle-link" type="button" data-circle="${escapeAttr(c.name || '')}">
            ${escapeHtml(c.name || '')}
          </button>
          ${flagsHTML(c)}
        </div>
        <div class="meta">${escapeHtml(c.owner || '')}</div>
        <div class="meta">${space || (c.event?escapeHtml(c.event):'配置未設定')}</div>
        <div class="links">${linksHTML(c.links)}</div>
        ${tagsHTML(c.tags)}
        ${evBadges}
      </div>
      <div class="actions">
        ${doneToggle}
        ${actions}
      </div>
    `;
    grid.appendChild(item);
  });

  $mount.innerHTML = '';
  $mount.appendChild(grid);
}

function renderList(items, sel){
  const wrap = document.createElement('div');
  wrap.className = 'list';

  const hasEventCol = sel.mode==='ALL' && !mergeDup;

  // ヘッダ：最後の列見出しを「操作」に
  wrap.insertAdjacentHTML('beforeend', `
    <div class="row listrow head">
      <div></div>
      <div>サークル名</div>
      <div>${hasEventCol?'イベント':'代表者'}</div>
      <div>${hasEventCol?'代表者':'配置'}</div>
      <div>${hasEventCol?'配置':'リンク'}</div>
      <div>${hasEventCol?'リンク':''}</div>
      <div class="actions-col">操作</div>
    </div>
  `);

  items.forEach(c => {
    const canEdit = !(sel.mode==='ALL' && mergeDup && c.type==='merged');
    const actionsHTML = canEdit ? actionButtonsHTML(c.event, c.index) : '';
    const doneToggle  = (c.event!=null && c.index!=null && canEdit) ? doneButtonHTML(c.event, c.index) : '';

    const space = [c.island,c.seat].filter(Boolean).join(' ') || '—';

    const leftCells = sel.mode==='ALL' && !mergeDup
      ? `
        <div class="name">
          <strong>
            <button class="circle-link" type="button" data-circle="${escapeAttr(c.name || '')}">
              ${escapeHtml(c.name || '')}
            </button>
          </strong>
          ${flagsHTML(c)}
          ${c.tags && c.tags.length ? `<span class="badge">${escapeHtml(c.tags[0])}${c.tags.length>1?` 他${c.tags.length-1}`:''}</span>` : ''}
        </div>
        <div class="event">${escapeHtml(c.event||'')}</div>
        <div class="owner">${escapeHtml(c.owner || '')}</div>
        <div class="space">${space}</div>
        <div class="links">${linksHTML(c.links)}</div>
      `
      : `
        <div class="name">
          <strong>
            <button class="circle-link" type="button" data-circle="${escapeAttr(c.name || '')}">
              ${escapeHtml(c.name || '')}
            </button>
          </strong>
          ${flagsHTML(c)}
          ${c.tags && c.tags.length ? `<span class="badge">${escapeHtml(c.tags[0])}${c.tags.length>1?` 他${c.tags.length-1}`:''}</span>` : ''}
        </div>
        <div class="owner">${escapeHtml(c.owner || '')}</div>
        <div class="space">${space}</div>
        <div class="links">${linksHTML(c.links)}</div>
      `;

    const row = document.createElement('div');
    row.className = 'row listrow';
    row.innerHTML = `
      ${avatarHTML(c)}
      ${leftCells}
      <div class="actions actions-col">
        ${doneToggle}
        ${actionsHTML}
      </div>
    `;
    wrap.appendChild(row);
  });

  $mount.innerHTML = '';
  $mount.appendChild(wrap);
}


function actionButtonsHTML(eventName, index){
  if (!eventName || index===undefined) return '';
  return `
    <button class="btn small icon" data-action="edit" data-event="${escapeAttr(eventName)}" data-index="${index}" title="編集"><i class="fa-solid fa-pen"></i></button>
    <button class="btn small icon" data-action="delete" data-event="${escapeAttr(eventName)}" data-index="${index}" title="削除"><i class="fa-solid fa-trash"></i></button>
  `;
}
function doneButtonHTML(eventName, index){
  const done = isDone(eventName, index);
  return done
    ? `<button class="btn small icon" data-action="undo" data-event="${escapeAttr(eventName)}" data-index="${index}" title="購入済みを戻す"><i class="fa-solid fa-rotate-left"></i></button>`
    : `<button class="btn small icon" data-action="done" data-event="${escapeAttr(eventName)}" data-index="${index}" title="購入済みにする"><i class="fa-solid fa-check"></i></button>`;
}

/* ===== ユーティリティ ===== */
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}
function escapeAttr(s){ return escapeHtml(s).replace(/"/g,'&quot;'); }
function isHttpUrl(s){ return /^https?:\/\//i.test(String(s||'').trim()); }

/* ===== 編集モーダル ===== */
const $editModal = document.getElementById('editModal');
const $editForm = document.getElementById('editForm');
const $editIndex = document.getElementById('editIndex');
const $editName = document.getElementById('editName');
const $editOwner = document.getElementById('editOwner');
const $editIsland = document.getElementById('editIsland');
const $editSeat = document.getElementById('editSeat');
const $editTags = document.getElementById('editTags');
const $editLinks = document.getElementById('editLinks');
const $editR18 = document.getElementById('editR18');
const $editFav = document.getElementById('editFav');
const $editAvatar = document.getElementById('editAvatar');
const $editAvatarClear = document.getElementById('editAvatarClear');
const $editAvatarPreview = document.getElementById('editAvatarPreview');
const $editAvatarUrl = document.getElementById('editAvatarUrl');

function renderAvatarPreview(dataURL){
  $editAvatarPreview.innerHTML = '';
  if (!dataURL) {
    $editAvatarPreview.innerHTML = '<div class="ph"><i class="fa-regular fa-image"></i></div>';
  } else {
    const img = document.createElement('img');
    img.src = dataURL;
    img.dataset.new = '1';
    $editAvatarPreview.appendChild(img);
  }
}
function fileToDataURL(file){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(new Error('画像の読み込みに失敗'));
    r.onload = () => res(r.result);
    r.readAsDataURL(file);
  });
}
$editAvatar && $editAvatar.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const dataURL = await fileToDataURL(file);
  if (!$editAvatarUrl || !$editAvatarUrl.value.trim()) renderAvatarPreview(dataURL);
  if ($editAvatarClear) $editAvatarClear.checked = false;
});
function splitTags(s){ return String(s||'').split(',').map(t=>t.trim()).filter(Boolean); }
function splitLinks(s){ return String(s||'').split(/\n+/).map(t=>t.trim()).filter(Boolean); }

function openEditModal(ev, index){
  const c = ev?.circles?.[index];
  if (!c) { alert('編集対象が見つかりませんでした'); return; }

  $editIndex.value = String(index);
  $editName.value = c.name || '';
  $editOwner.value = c.owner || '';
  $editIsland.value = c.island || '';
  $editSeat.value = c.seat || '';
  $editTags.value = Array.isArray(c.tags) ? c.tags.join(', ') : '';
  $editLinks.value = Array.isArray(c.links) ? c.links.join('\n') : '';
  $editR18.checked = !!c.r18;
  $editFav.checked = !!c.favorite;
  if ($editAvatarClear) $editAvatarClear.checked = false;

  renderAvatarPreview(c.avatar || '');
  if ($editAvatarUrl) $editAvatarUrl.value = isHttpUrl(c.avatar) ? c.avatar : '';

  if (typeof $editModal.showModal === 'function') $editModal.showModal();
  else $editModal.setAttribute('open', '');

  const onSubmit = (e) => {
    e.preventDefault();
    const idx = Number($editIndex.value);
    const current = loadEvents().find(x => x.event === ev.event)?.circles?.[idx] || {};

    const patch = {
      name: $editName.value.trim(),
      owner: $editOwner.value.trim(),
      island: $editIsland.value.trim(),
      seat: $editSeat.value.trim(),
      tags: splitTags($editTags.value),
      links: splitLinks($editLinks.value),
      r18: $editR18.checked,
      favorite: $editFav.checked
    };

    if ($editAvatarClear && $editAvatarClear.checked) {
      patch.avatar = '';
    } else if ($editAvatarUrl && $editAvatarUrl.value.trim()) {
      patch.avatar = $editAvatarUrl.value.trim();
    } else {
      const previewImg = $editAvatarPreview.querySelector('img');
      patch.avatar = (previewImg && previewImg.dataset.new === '1')
        ? previewImg.src
        : (current.avatar || '');
    }

    if (!patch.name) { alert('サークル名は必須です'); return; }
    if (!updateCircleByIndex(ev.event, idx, patch)) { alert('保存に失敗しました'); return; }

    $editForm.removeEventListener('submit', onSubmit);
    if ($editModal.open) $editModal.close();
    reloadDataAndRender();
  };

  $editForm.removeEventListener('submit', onSubmit);
  $editForm.addEventListener('submit', onSubmit);
}
window.openEditModal = openEditModal;
function openEditModalByEventAndIndex(eventName, index){
  const ev = loadEvents().find(e => e.event === eventName);
  if (!ev || !ev.circles || !ev.circles[index]) { alert('編集対象が見つかりませんでした'); return; }
  openEditModal(ev, index);
}

/* ===== サークル詳細モーダル ===== */
const $circleModal = document.getElementById('circleModal');
const $cmClose = document.getElementById('cmClose');
const $cmAvatar = document.getElementById('cmAvatar');
const $cmName = document.getElementById('cmName');
const $cmBadges = document.getElementById('cmBadges');
const $cmLinks = document.getElementById('cmLinks');
const $cmRows = document.getElementById('cmRows');

function nameKey(s){ return String(s||'').replace(/\u3000/g,' ').trim().toLowerCase(); }

function openCircleModalByName(name){
  const k = nameKey(name);
  const acc = { name, owner:'', avatar:'', favorite:false, r18:false, links:new Set(), rows:[] };

  all.forEach(ev => {
    ev.circles.forEach((c, idx) => {
      if (nameKey(c.name) !== k) return;
      // 詳細モーダルは「済」に関係なく全部の履歴を見せる（使い勝手重視）
      if (!acc.avatar && c.avatar) acc.avatar = c.avatar;
      if (!acc.owner && c.owner) acc.owner = c.owner;
      acc.favorite = acc.favorite || !!c.favorite;
      acc.r18 = acc.r18 || !!c.r18;
      (c.links||[]).forEach(u => acc.links.add(String(u)));
      acc.rows.push({ event: ev.event, circle: c.name||'', owner:c.owner||'', island:c.island||'', seat:c.seat||'' });
    });
  });

  acc.rows.sort((a,b)=> (a.event||'').localeCompare(b.event||'', 'ja'));
  $cmName.textContent = acc.name || '(無名)';
  $cmBadges.innerHTML = `${acc.favorite?'<span class="star" title="推し">★</span>':''}${acc.r18?'<span class="badge r18" title="R18">R-18</span>':''}`;
  $cmAvatar.innerHTML = acc.avatar ? `<img src="${acc.avatar}" alt="">` : `<div class="ph"><i class="fa-regular fa-image"></i></div>`;
  $cmLinks.innerHTML = acc.links.size
    ? [...acc.links].slice(0,8).map(u=>`<a href="${u}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(u)}"><i class="${iconClassFor(u)} fa-fw"></i></a>`).join('')
    : `<span class="meta">リンクなし</span>`;
  $cmRows.innerHTML = acc.rows.map(r=>{
    const place = [r.island, r.seat].filter(Boolean).join(' ') || '—';
    return `<tr><td>${escapeHtml(r.event)}</td><td>${escapeHtml(r.circle)}</td><td>${escapeHtml(r.owner)}</td><td>${escapeHtml(place)}</td></tr>`;
  }).join('') || `<tr><td colspan="4">参加履歴がありません</td></tr>`;

  if (typeof $circleModal.showModal === 'function') $circleModal.showModal();
  else $circleModal.setAttribute('open','');
}
$cmClose?.addEventListener('click', ()=> $circleModal.close());

/* ===== 出力／読み込み ===== */
function onExportJSON(){
  const payload = { format:'circle-checker', version:1, exportedAt:new Date().toISOString(), events: loadEvents() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  const ymd = new Date().toISOString().slice(0,10).replace(/-/g,'');
  a.href = URL.createObjectURL(blob);
  a.download = `circlechecker_${ymd}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

async function onImportJSON(e){
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    const incoming = Array.isArray(json) ? json : (json.events || []);
    if (!Array.isArray(incoming)) { alert('不正なファイル形式です'); e.target.value=''; return; }
    const replace = confirm('読み込み：全入れ替えで復元しますか？\n（キャンセルでマージ）');
    const result = importEvents(incoming, replace ? 'replace' : 'merge');
    alert(replace ? `復元しました（イベント ${result.replaced} 件）` : `マージしました（追加 ${result.added} / 上書き ${result.updated}）`);
    all = loadEvents();
    render();
  } catch (err){
    console.error(err); alert('読み込みに失敗しました');
  } finally { e.target.value = ''; }
}
