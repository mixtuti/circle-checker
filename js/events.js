import { listEvents, ensureEvent, upsertEventMeta, getEventByName, renameEvent, deleteEvent } from './storage.js';
import { iconClassFor } from './icons.js';
import { applyAutoTheme } from './theme.js';

applyAutoTheme();

const $eventSelect = document.getElementById('eventSelect');
const $newEventName = document.getElementById('newEventName');
const $btnCreate = document.getElementById('btnCreate');
const $renameTo = document.getElementById('renameTo');
const $btnRename = document.getElementById('btnRename');
const $btnDelete = document.getElementById('btnDelete');

const $metaForm = document.getElementById('metaForm');
const $date = document.getElementById('date');
const $venue = document.getElementById('venue');
const $officialUrl = document.getElementById('officialUrl');
const $mapUrl = document.getElementById('mapUrl');

const $snsList = document.getElementById('snsList');
const $addSns = document.getElementById('addSns');

const $previewCard = document.getElementById('previewCard');
const $pvTitle = document.getElementById('pvTitle');
const $pvDate = document.getElementById('pvDate');
const $pvVenue = document.getElementById('pvVenue');
const $pvOfficial = document.getElementById('pvOfficial');
const $pvMap = document.getElementById('pvMap');
const $pvSNS = document.getElementById('pvSNS');

// --- Google Map / 一覧 用 参照 ---
const $gmap       = document.getElementById('gmap');
const $gmapWrap   = document.getElementById('gmapWrap');
const $gmapEmpty  = document.getElementById('gmapEmpty');

const $eventsListBody = document.getElementById('eventsListBody');

init();

function init() {
  // イベント選択リスト
  refreshEventSelect();
  if ($eventSelect.options.length > 0) {
    $eventSelect.value = $eventSelect.options[0].value;
    loadToForm();
  }

  $eventSelect.addEventListener('change', loadToForm);
  $btnCreate.addEventListener('click', onCreate);
  $btnRename.addEventListener('click', onRename);
  $btnDelete.addEventListener('click', onDelete);

  // SNS UI
  $addSns.addEventListener('click', () => addSnsRow());

  $venue?.addEventListener('input',  updateMapFromForm);
  $mapUrl?.addEventListener('input', updateMapFromForm);
}

function refreshEventSelect(selected) {
  const names = listEvents();
  $eventSelect.innerHTML = '';
  names.forEach((n, i) => {
    const opt = document.createElement('option');
    opt.value = n; opt.textContent = n;
    $eventSelect.appendChild(opt);
  });
  if (selected && names.includes(selected)) {
    $eventSelect.value = selected;
  }
}

function onCreate() {
  const name = $newEventName.value.trim();
  if (!name) { alert('イベント名を入力してください'); return; }
  ensureEvent(name);
  refreshEventSelect(name);
  loadToForm();
  $newEventName.value = '';
  updateListLink(name);
}

function onRename() {
  const oldName = $eventSelect.value;
  const nn = $renameTo.value.trim();
  if (!nn) { alert('新しいイベント名を入力してください'); return; }
  if (!renameEvent(oldName, nn)) {
    alert('名称の変更に失敗しました（同名イベントがある可能性があります）');
    return;
  }
  refreshEventSelect(nn);
  loadToForm();
  $renameTo.value = '';
  updateListLink(nn);
}

function onDelete() {
  const name = $eventSelect.value;
  if (!name) return;
  if (!confirm(`イベント「${name}」を削除しますか？（サークル情報も含めて削除されます）`)) return;
  deleteEvent(name);
  refreshEventSelect();
  //   if ($eventSelect.options.length > 0) {
  //     $eventSelect.value = $eventSelect.options[0].value;
  //     loadToForm();
  //   } else {
  //     clearForm();
  //     renderPreview(null);
  //   }
  if ($eventSelect.options.length > 0) {
    updateListLink($eventSelect.value);
  } else {
    updateListLink('');
  }
}

function clearForm() {
  $date.value = '';
  $venue.value = '';
  $officialUrl.value = '';
  $mapUrl.value = '';
  $snsList.innerHTML = '';
}

function loadToForm() {
  const name = $eventSelect.value;
  const ev = getEventByName(name) || ensureEvent(name);
  const meta = ev.meta || { date: '', venue: '', officialUrl: '', mapUrl: '', sns: [] };

  $date.value = meta.date || '';
  $venue.value = meta.venue || '';
  $officialUrl.value = meta.officialUrl || '';
  $mapUrl.value = meta.mapUrl || '';

  $snsList.innerHTML = '';
  if (Array.isArray(meta.sns) && meta.sns.length) {
    meta.sns.forEach(u => addSnsRow(u));
  } else {
    addSnsRow();
  }

  renderPreview({ name: ev.event, meta });
  updateListLink(ev.event);
  updateMapFromForm();
}

$metaForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $eventSelect.value;
  const meta = {
    date: $date.value,
    venue: $venue.value,
    officialUrl: $officialUrl.value,
    mapUrl: $mapUrl.value,
    sns: collectSNS()
  };
  upsertEventMeta(name, meta);
  renderPreview({ name, meta });
  updateMapFromForm();
  alert('保存しました');
});

/* ---- SNS UI ---- */
function addSnsRow(defaultUrl = '') {
  const row = document.createElement('div');
  row.className = 'sns-item';
  row.innerHTML = `
    <i class="fa-solid fa-link"></i>
    <input type="url" placeholder="https://..." value="${defaultUrl}">
    <button type="button" class="btn del" title="削除"><i class="fa-solid fa-trash"></i></button>
  `;
  const $url = row.querySelector('input');
  const $icon = row.querySelector('i');
  const $del = row.querySelector('.del');
  const updateIcon = () => { $icon.className = iconClassFor($url.value) + ' fa-fw'; };
  $url.addEventListener('input', updateIcon); updateIcon();
  $del.addEventListener('click', () => row.remove());
  $snsList.appendChild(row);
}
function collectSNS() {
  return [...$snsList.querySelectorAll('input[type="url"]')]
    .map(i => i.value.trim()).filter(Boolean);
}

/* ---- プレビュー ---- */
function renderPreview(ev) {
  if (!ev) { $previewCard.hidden = true; return; }
  $previewCard.hidden = false;
  const { name, meta } = ev;
  $pvTitle.textContent = name || 'イベント概要';
  $pvDate.textContent = meta.date || '-';
  $pvVenue.textContent = meta.venue || '-';

  $pvOfficial.innerHTML = meta.officialUrl
    ? `<a href="${meta.officialUrl}" target="_blank" rel="noopener noreferrer">${meta.officialUrl}</a>` : '-';
  $pvMap.innerHTML = meta.mapUrl
    ? `<a href="${meta.mapUrl}" target="_blank" rel="noopener noreferrer">${meta.mapUrl}</a>` : '-';

  if (Array.isArray(meta.sns) && meta.sns.length) {
    $pvSNS.innerHTML = meta.sns.map(u => {
      const cls = iconClassFor(u) + ' fa-fw';
      return `<a href="${u}" target="_blank" rel="noopener noreferrer" title="${u}"><i class="${cls}"></i></a>`;
    }).join('');
  } else {
    $pvSNS.textContent = '-';
  }
}

function updateListLink(name) {
  const a = document.getElementById('pvListLink');
  if (!a) return;
  if (name && name.trim()) {
    a.href = `index.html?event=${encodeURIComponent(name.trim())}`;
  } else {
    a.href = `index.html`;
  }
}

function escapeHtml(s) {
  return (s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function updateMapFromForm() {
  if (!$gmap || !$gmapWrap) return;
  const venue = $venue?.value.trim()   || '';
  const murl  = $mapUrl?.value.trim()  || '';

  // mapUrl があればそれを優先。無ければ venue 検索埋め込み
  let src = '';
  if (murl)      src = murl;
  else if (venue)src = `https://www.google.com/maps?q=${encodeURIComponent(venue)}&output=embed`;

  if (src) {
    if ($gmap.src !== src) $gmap.src = src;
    $gmapWrap.style.display = 'block';
    if ($gmapEmpty) $gmapEmpty.style.display = 'none';
  } else {
    $gmap.src = '';
    $gmapWrap.style.display = 'none';
    if ($gmapEmpty) $gmapEmpty.style.display = 'block';
  }
}

function renderEventsList() {
  if (!$eventsListBody) return;
  const names = (listEvents?.() || []);
  $eventsListBody.innerHTML = '';

  names.forEach(name => {
    const ev   = (getEventByName?.(name)) || {};
    const meta = ev.meta || {};
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(name)}</td>
      <td>${escapeHtml(meta.date || '')}</td>
      <td>${escapeHtml(meta.venue || '')}</td>
      <td><a href="list.html?event=${encodeURIComponent(name)}">開く</a></td>
    `;
    $eventsListBody.appendChild(tr);
  });
}