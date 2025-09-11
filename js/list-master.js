// js/list-master.js
// 「サークル一覧」から、開いたモーダルの内容をそのままサークルマスターへ保存する拡張
import { upsertCircleMaster, getCircleMaster } from './storage.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $all = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ----------------  編集モーダルにボタン追加＆保存処理  ---------------- */

function ensureButtonInEditModal() {
  const $actions = $('#editForm .modal-actions');
  if (!$actions) return;
  if ($('#editSaveMaster')) return; // 二重追加防止

  const $btn = document.createElement('button');
  $btn.type = 'button';
  $btn.id = 'editSaveMaster';
  $btn.className = 'btn';
  $btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> マスターに保存';
  $actions.insertBefore($btn, $('#editSave')); // 既存「保存」ボタンの左に
  $btn.addEventListener('click', onClickEditSaveMaster);
}

async function onClickEditSaveMaster() {
  const name  = $('#editName')?.value?.trim() || '';
  if (!name) { alert('サークル名は必須です'); return; }

  const owner = $('#editOwner')?.value?.trim() || '';
  const favorite = !!$('#editFav')?.checked;
  const links = parseLinksTextarea($('#editLinks')?.value || '');
  const avatar = await gatherEditAvatarValue();

  // 既存値とマージ（必要に応じてポリシー調整可）
  const prev = getCircleMaster?.(name) || {};

  upsertCircleMaster(name, {
    owner,
    avatar: avatar || prev.avatar || '',
    favorite: (typeof favorite === 'boolean') ? favorite : !!prev.favorite,
    links
  });

  alert('マスターに保存しました');
}

function parseLinksTextarea(text) {
  // 「1行=1URL」で配列化
  return (text || '')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);
}

async function gatherEditAvatarValue() {
  const clear = !!$('#editAvatarClear')?.checked;
  if (clear) return '';
  const url = $('#editAvatarUrl')?.value?.trim();
  if (url) return url;
  const file = $('#editAvatar')?.files && $('#editAvatar').files[0];
  if (file) return await fileToDataURL(file);
  // 画像未指定なら詳細モーダル側の画像を補助的に利用
  const img = $('#cmAvatar img');
  if (img?.src) return img.src;
  return '';
}

function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(new Error('画像の読み込みに失敗'));
    r.onload  = () => res(r.result);
    r.readAsDataURL(file);
  });
}

/* ----------------  サークル詳細モーダルにボタン追加＆保存処理  ---------------- */

function ensureButtonInCircleModal() {
  const $hdr = $('.cm-header');
  if (!$hdr) return;
  if ($('#cmSaveMaster')) return; // 二重追加防止

  const $btn = document.createElement('button');
  $btn.type = 'button';
  $btn.id = 'cmSaveMaster';
  $btn.className = 'btn small';
  $btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> マスターに保存';

  const closeBtn = $('#cmClose');
  if (closeBtn?.parentElement === $hdr) {
    $hdr.insertBefore($btn, closeBtn);
  } else {
    $hdr.appendChild($btn);
  }
  $btn.addEventListener('click', onClickCircleModalSaveMaster);
}

function onClickCircleModalSaveMaster() {
  const name = $('#cmName')?.textContent?.trim() || '';
  if (!name) { alert('サークル名が取得できません'); return; }

  // 代表者：参加履歴テーブルの3列目（最初の行）
  const ownerCell = $('#cmRows tr td:nth-child(3)');
  const owner = ownerCell?.textContent?.trim() || '';

  // リンク：ヘッダー部のリンク群から href を抽出
  const links = $all('#cmLinks a').map(a => a.href).filter(Boolean);

  // 推し：バッジに「推し」表記があれば true、なければ既存値を維持
  let favorite;
  const badgesText = ($('#cmBadges')?.textContent || '').toLowerCase();
  if (badgesText.includes('推し')) favorite = true;

  // アイコン：あれば img の src
  const avatar = $('#cmAvatar img')?.src || '';

  const prev = getCircleMaster?.(name) || {};
  upsertCircleMaster(name, {
    owner,
    avatar: avatar || prev.avatar || '',
    favorite: (typeof favorite === 'boolean') ? favorite : (!!prev.favorite),
    links
  });

  alert('マスターに保存しました');
}

/* ----------------  初期化＆監視（モーダルが後から描画されても対応）  ---------------- */

function init() {
  ensureButtonInEditModal();
  ensureButtonInCircleModal();
}

// モーダルが開閉される度にDOMが変わる可能性があるため監視して常にボタンを維持
const mo = new MutationObserver(() => {
  ensureButtonInEditModal();
  ensureButtonInCircleModal();
});
mo.observe(document.documentElement, { childList: true, subtree: true });

document.addEventListener('DOMContentLoaded', init);
