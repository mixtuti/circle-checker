// register.html 用の画面制御
import { upsertCircle, listEventNames, upsertCircleMaster, getCircleMaster, listCircleMasterNames } from './storage.js';
import { setupTags } from './tags.js';
import { setupSns } from './sns.js';
import { applyAutoTheme } from './theme.js';

applyAutoTheme();

/* ===== イベント datalist に既存イベント名を反映 ===== */
const $eventList = document.getElementById('eventList');
if ($eventList) {
  (listEventNames?.() || []).forEach(n => {
    const o = document.createElement('option');
    o.value = n;
    $eventList.appendChild(o);
  });
}

/* ===== 各UI 初期化 ===== */
const tagsUI = setupTags('tags', 'tagInput');   // タグ（複数）
const snsUI  = setupSns('snsList', 'addSns');   // SNS/リンク（複数）
// window.snsUI = snsUI; // ← コンソールで一時テストする時だけ有効化

const $circleName = document.getElementById('circleName');
const $datalist   = document.getElementById('circleMasterList');

/* ===== フラグ：お気に入りがユーザー操作されたかを記録 ===== */
const $favorite = document.getElementById('favorite');
$favorite?.addEventListener('change', () => { $favorite.dataset.userTouched = '1'; });

/* ===== アイコン：URL/ファイル/クリア 対応 ===== */
const $avatarPreview = document.getElementById('avatarPreview');
const $avatarFile    = document.getElementById('avatarFile');
const $avatarUrl     = document.getElementById('avatarUrl');
const $avatarClear   = document.getElementById('avatarClear');

function renderAvatarPreview(src) {
  if (!$avatarPreview) return;
  $avatarPreview.innerHTML = '';
  if (!src) {
    $avatarPreview.innerHTML = '<div class="ph"><i class="fa-regular fa-image"></i></div>';
  } else {
    const img = document.createElement('img');
    img.src = src;
    $avatarPreview.appendChild(img);
  }
}

function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(new Error('画像の読み込みに失敗'));
    r.onload  = () => res(r.result);
    r.readAsDataURL(file);
  });
}

// URL入力 → 即プレビュー（URLが優先）
$avatarUrl?.addEventListener('input', () => {
  const u = $avatarUrl.value.trim();
  if (u) {
    renderAvatarPreview(u);
    if ($avatarClear) $avatarClear.checked = false;
  } else {
    const f = $avatarFile?.files && $avatarFile.files[0];
    if (f) fileToDataURL(f).then(renderAvatarPreview);
    else renderAvatarPreview('');
  }
});

// ファイル選択 → URL欄が空のときだけプレビュー反映（URL優先）
$avatarFile?.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const dataURL = await fileToDataURL(file);
  if (!$avatarUrl?.value.trim()) renderAvatarPreview(dataURL);
  if ($avatarClear) $avatarClear.checked = false;
});

// クリア → すべて消す
$avatarClear?.addEventListener('change', () => {
  if ($avatarClear.checked) {
    renderAvatarPreview('');
    if ($avatarFile) $avatarFile.value = '';
    if ($avatarUrl)  $avatarUrl.value  = '';
  }
});

// 保存直前に現在の値を決める
async function gatherAvatarValue() {
  if ($avatarClear?.checked) return ''; // クリア最優先
  const url = $avatarUrl?.value.trim();
  if (url) return url;                  // URLがあればURL
  const f = $avatarFile?.files && $avatarFile.files[0];
  if (f) return await fileToDataURL(f); // ファイルがあれば dataURL
  return '';                            // 未設定
}

/* ===== サークル名 → マスター反映 ===== */
function applyMasterToForm(name){
  const m = getCircleMaster?.(name);
  if (!m) return;

  // 基本項目
  const $owner = document.getElementById('owner');
  if ($owner) $owner.value = m.owner || '';
  if (typeof m.favorite === 'boolean') {
    const $fav = document.getElementById('favorite');
    if ($fav) $fav.checked = !!m.favorite;
  }
  if (m.avatar) {
    if ($avatarUrl) $avatarUrl.value = m.avatar;
    renderAvatarPreview(m.avatar);
  }

  // SNSリンク（string / {url,label} / labelにURL も吸収して URL配列に）
  const urls = (Array.isArray(m.links) ? m.links : [])
    .map(v => {
      if (typeof v === 'string') return v.trim();
      const url = (v?.url || '').trim();
      const lab = (v?.label || '').trim();
      return url || (/^https?:\/\//i.test(lab) ? lab : '');
    })
    .filter(Boolean);

  if (!urls.length) { snsUI.reset(); return; }

  // set() があれば一発で
  if (typeof snsUI.set === 'function') {
    snsUI.set(urls);
    return;
  }

  // フォールバック：必要数のURL入力を作って埋める（クラス名に依存しない）
  const listEl = document.getElementById('snsList');
  const addBtn = document.getElementById('addSns');
  const inputs = () => Array.from(listEl.querySelectorAll('input[type="url"],input[type=url]'));

  listEl.innerHTML = '';
  while (inputs().length < Math.max(1, urls.length)) addBtn?.click();
  inputs().forEach((el, i) => {
    el.value = urls[i] || '';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

// datalist は input で発火することが多いので、input/change 両方を拾う
['input','change'].forEach(ev => {
  $circleName?.addEventListener(ev, () => {
    const name = $circleName.value.trim();
    if (name) applyMasterToForm(name);
  });
});

/* ===== フォーム送信 ===== */
const $form = document.getElementById('circleForm');
$form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const eventName = document.getElementById('event')?.value.trim() || '';
  const circleName= document.getElementById('circleName')?.value.trim() || '';
  const owner     = document.getElementById('owner')?.value.trim() || '';
  const island    = document.getElementById('island')?.value.trim() || '';
  const seat      = document.getElementById('seat')?.value.trim() || '';
  const hasR18    = !!document.getElementById('hasR18')?.checked;
  const favorite  = !!document.getElementById('favorite')?.checked;

  if (!eventName || !circleName) {
    alert('イベント名とサークル名は必須です');
    return;
  }

  const master = getCircleMaster?.(circleName) || {};

  // 入力値（優先）を取得
  const avatarCurrent = await gatherAvatarValue();
  const linksCurrent  = snsUI.get();

  // マスターの値で不足分を補完（空欄のみ）
  const avatarFinal = avatarCurrent || master.avatar || '';
  const ownerFinal  = owner || master.owner || '';
  const linksFinal  = (linksCurrent && linksCurrent.length) ? linksCurrent : (master.links || []);

  // お気に入りは、ユーザーがチェックを触っていなければマスター値を既定値として採用
  const favoriteTouched = document.getElementById('favorite')?.dataset.userTouched === '1';
  const favoriteFinal   = favoriteTouched ? favorite : (typeof master.favorite === 'boolean' ? master.favorite : favorite);

  const circle = {
    name: circleName,
    owner: ownerFinal,
    links: linksFinal,
    island,
    seat,
    tags: tagsUI.get(),
    r18: hasR18,
    favorite: favoriteFinal,
    avatar: avatarFinal
  };

  // イベント側に保存
  upsertCircle(eventName, circle);

  // マスターも同時に更新
  upsertCircleMaster(circleName, {
    avatar: circle.avatar,
    owner : circle.owner,
    links : circle.links,
    favorite: circle.favorite
  });

  // リセット
  $form.reset();
  tagsUI.reset();
  snsUI.reset();
  renderAvatarPreview('');
  if ($avatarFile)  $avatarFile.value = '';
  if ($avatarUrl)   $avatarUrl.value  = '';
  if ($avatarClear) $avatarClear.checked = false;

  alert('登録しました！');
});

/* ===== マスター名の datalist を初期化 ===== */
document.addEventListener('DOMContentLoaded', () => {
  try {
    const names = listCircleMasterNames?.() || [];
    if ($datalist) {
      $datalist.innerHTML = '';
      names.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n;
        $datalist.appendChild(opt);
      });
    }
  } catch (e) {
    console.warn('マスター一覧の取得に失敗:', e);
  }
});
