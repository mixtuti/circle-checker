// circle-master.js
// 管理ページ：サークルマスターを一覧/編集/削除/インポート/エクスポート
const MASTER_KEY = 'cc.circleMaster.v1';

/** =========================
 *  API 準備（storage.js が無くても動くフォールバック付き）
 *  ========================= */
let masterApi;

/** localStorage 直叩きの実装（フォールバック用） */
const localApi = (() => {
  const loadMap = () => {
    try { return JSON.parse(localStorage.getItem(MASTER_KEY) || '{}'); }
    catch { return {}; }
  };
  const saveMap = (map) => localStorage.setItem(MASTER_KEY, JSON.stringify(map || {}));

  const list = () => Object.keys(loadMap()).sort();
  const get = (name) => (name ? loadMap()[name] || null : null);
  const upsert = (name, master) => {
    if (!name) return;
    const map = loadMap();
    map[name] = { ...(map[name] || {}), ...(master || {}) };
    saveMap(map);
  };
  const remove = (name) => {
    if (!name) return;
    const map = loadMap();
    delete map[name];
    saveMap(map);
  };
  const rename = (oldName, newName) => {
    if (!oldName || !newName || oldName === newName) return;
    const map = loadMap();
    if (!map[oldName]) return;
    map[newName] = { ...(map[newName] || {}), ...map[oldName] };
    delete map[oldName];
    saveMap(map);
  };
  const dump = () => loadMap();
  const restoreMerge = (obj) => {
    const map = loadMap();
    Object.entries(obj || {}).forEach(([k, v]) => { map[k] = v; });
    saveMap(map);
  };
  return { list, get, upsert, remove, rename, dump, restoreMerge };
})();

(async () => {
  try {
    const mod = await import('./storage.js');
    masterApi = {
      list: mod.listCircleMasterNames ?? localApi.list,
      get: mod.getCircleMaster ?? localApi.get,
      upsert: mod.upsertCircleMaster ?? localApi.upsert,
      remove: mod.deleteCircleMaster ?? localApi.remove,
      rename: mod.renameCircleMaster ?? localApi.rename,
      dump: mod.dumpCircleMasterMap ?? localApi.dump,
      restoreMerge: mod.restoreCircleMasterMap ?? localApi.restoreMerge,
    };
  } catch (e) {
    console.warn('storage.js を読み込めなかったため、ローカルAPIで動作します。', e);
    masterApi = localApi;
  }
  initUI();
})();

/** =========================
 *  UI
 *  ========================= */
const $tbody = document.getElementById('tbody');
const $empty = document.getElementById('empty');
const $tpl = document.getElementById('row-tpl');
const $search = document.getElementById('search');
const $new = document.getElementById('newMasterBtn');
const $export = document.getElementById('exportBtn');
const $import = document.getElementById('importFile');

let allRows = []; // {tr, originalName, inputs...}

/** レンダリング */
function render(filter = '') {
  const names = masterApi.list();
  $tbody.innerHTML = '';
  allRows = [];

  const lower = (filter || '').trim().toLowerCase();
  let count = 0;

  names.forEach(name => {
    const m = masterApi.get(name) || {};
    const owner = m.owner || '';
    const matches = !lower || name.toLowerCase().includes(lower) || owner.toLowerCase().includes(lower);
    if (!matches) return;

    const row = $tpl.content.firstElementChild.cloneNode(true);
    const img = row.querySelector('.avatar');
    const avatarUrl = row.querySelector('.avatarUrl');
    const nameInput = row.querySelector('.name');
    const ownerInput = row.querySelector('.owner');
    const favInput = row.querySelector('.favorite');
    const linksBox = row.querySelector('.links');
    const addLinkBtn = row.querySelector('.addLinkBtn');
    const saveBtn = row.querySelector('.saveBtn');
    const delBtn = row.querySelector('.deleteBtn');

    img.src = m.avatar || '';
    avatarUrl.value = m.avatar || '';
    nameInput.value = name;
    ownerInput.value = owner;
    favInput.checked = !!m.favorite;

    // リンク群
    const links = Array.isArray(m.links) ? m.links : [];
    if (!links.length) addLinkRow(linksBox, { label: '', url: '' });
    links.forEach(it => addLinkRow(linksBox, it));

    avatarUrl.addEventListener('input', () => { img.src = avatarUrl.value.trim(); });

    addLinkBtn.addEventListener('click', () => addLinkRow(linksBox, { label: '', url: '' }));

    saveBtn.addEventListener('click', () => {
      const newName = nameInput.value.trim();
      if (!newName) { alert('サークル名は必須です'); return; }

      const newOwner = ownerInput.value.trim();
      const newAvatar = avatarUrl.value.trim();
      const newFav = !!favInput.checked;
      const newLinks = readLinks(linksBox);

      // 名前が変わっていたらリネーム、変わってなければアップサート
      if (newName !== name) {
        if (masterApi.list().includes(newName)) {
          const ok = confirm(`「${newName}」は既に存在します。上書き統合しますか？`);
          if (!ok) return;
        }
        masterApi.rename(name, newName);
      }
      masterApi.upsert(newName, { owner: newOwner, avatar: newAvatar, favorite: newFav, links: newLinks });
      // 再描画
      render($search.value);
    });

    delBtn.addEventListener('click', () => {
      const ok = confirm(`「${name}」のマスターを削除します。よろしいですか？`);
      if (!ok) return;
      masterApi.remove(name);
      render($search.value);
    });

    $tbody.appendChild(row);
    allRows.push({ tr: row, originalName: name });
    count++;
  });

  $empty.style.display = count ? 'none' : 'block';
}

function addLinkRow(container, item) {
  const row = document.createElement('div');
  row.className = 'link-row';
  row.innerHTML = `
    <input type="text" class="link-label" placeholder="https://..." value="${escapeHtml(item.label || '')}">
    <button type="button" class="ghost del">削除</button>
  `;
  row.querySelector('.del').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function readLinks(container) {
  return [...container.querySelectorAll('.link-row')].map(row => ({
    label: row.querySelector('.link-label')?.value?.trim() || '',
    url: row.querySelector('.link-url')?.value?.trim() || ''
  })).filter(x => x.label || x.url);
}

function escapeHtml(s) {
  return (s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** 新規作成 */
function createNew() {
  // 空の1件を仮追加して編集
  const tmpName = suggestNewName();
  masterApi.upsert(tmpName, { owner: '', links: [], favorite: false, avatar: '' });
  render($search.value);
  // 追加直後の行を強調
  const row = allRows.find(r => r.originalName === tmpName)?.tr;
  if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function suggestNewName() {
  const base = '新規サークル';
  const names = new Set(masterApi.list());
  if (!names.has(base)) return base;
  let i = 2;
  while (names.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

/** インポート/エクスポート */
function exportJson() {
  const blob = new Blob([JSON.stringify(masterApi.dump(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `circle-master-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (typeof data !== 'object' || Array.isArray(data)) throw new Error('形式が不正です');
      const count = Object.keys(data).length;
      const ok = confirm(`マスター ${count} 件をマージします。既存と同名は上書きされます。よろしいですか？`);
      if (!ok) return;
      masterApi.restoreMerge(data);
      render($search.value);
      alert('インポートが完了しました');
    } catch (e) {
      alert('インポート失敗: ' + e.message);
    }
  };
  reader.readAsText(file, 'utf-8');
}

/** イベント紐付け */
function initUI() {
  render();
  $search.addEventListener('input', () => render($search.value));
  $new.addEventListener('click', createNew);
  $export.addEventListener('click', exportJson);
  $import.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (f) importJson(f);
    e.target.value = '';
  });
}
