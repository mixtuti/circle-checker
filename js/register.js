// register.html 用の画面制御
import { upsertCircle, listEventNames } from './storage.js';
import { setupTags } from './tags.js';
import { setupSns } from './sns.js';
import { applyAutoTheme } from './theme.js';

applyAutoTheme();

/* ===== イベント datalist に既存イベント名を反映 ===== */
const $eventList = document.getElementById('eventList');
if ($eventList) {
  listEventNames().forEach(n => {
    const o = document.createElement('option');
    o.value = n;
    $eventList.appendChild(o);
  });
}

/* ===== 各UI 初期化 ===== */
const tagsUI = setupTags('tags', 'tagInput');  // タグ（複数）
const snsUI  = setupSns('snsList', 'addSns');  // SNS/リンク（複数）

/* ===== アイコン：URL/ファイル/クリア 対応 ===== */
const $avatarPreview = document.getElementById('avatarPreview');
const $avatarFile    = document.getElementById('avatarFile');
const $avatarUrl     = document.getElementById('avatarUrl');
const $avatarClear   = document.getElementById('avatarClear');

function renderAvatarPreview(src){
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

function fileToDataURL(file){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(new Error('画像の読み込みに失敗'));
    r.onload = () => res(r.result);
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
    if (f) {
      fileToDataURL(f).then(renderAvatarPreview);
    } else {
      renderAvatarPreview('');
    }
  }
});

// ファイル選択 → URL欄が空のときだけプレビュー反映（URL優先）
$avatarFile?.addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const dataURL = await fileToDataURL(file);
  if (!$avatarUrl?.value.trim()) {
    renderAvatarPreview(dataURL);
  }
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
async function gatherAvatarValue(){
  if ($avatarClear?.checked) return ''; // クリア最優先
  const url = $avatarUrl?.value.trim();
  if (url) return url;                  // URLがあればURL
  const f = $avatarFile?.files && $avatarFile.files[0];
  if (f) return await fileToDataURL(f); // ファイルがあれば dataURL
  return '';                            // 未設定
}

/* ===== フォーム送信 ===== */
const $form = document.getElementById('circleForm');
$form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const eventName  = document.getElementById('event')?.value.trim() || '';
  const circleName = document.getElementById('circleName')?.value.trim() || '';
  const owner      = document.getElementById('owner')?.value.trim() || '';
  const island     = document.getElementById('island')?.value.trim() || '';
  const seat       = document.getElementById('seat')?.value.trim() || '';
  const hasR18     = !!document.getElementById('hasR18')?.checked;
  const favorite   = !!document.getElementById('favorite')?.checked;

  if (!eventName || !circleName) {
    alert('イベント名とサークル名は必須です');
    return;
  }

  const avatarValue = await gatherAvatarValue();

  const circle = {
    name: circleName,
    owner,
    links: snsUI.get(),
    island,
    seat,
    tags: tagsUI.get(),
    r18: hasR18,
    favorite,
    avatar: avatarValue
  };

  upsertCircle(eventName, circle);

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
