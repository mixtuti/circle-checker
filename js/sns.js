// SNSリンク複数入力
import { iconClassFor } from './icons.js';

export function setupSns(listId, addBtnId) {
  const $list = document.getElementById(listId);
  const $add = document.getElementById(addBtnId);

  function addRow(defaultUrl = '') {
    const row = document.createElement('div');
    row.className = 'sns-item';
    row.innerHTML = `
      <i class="fa-solid fa-link"></i>
      <input type="url" placeholder="https://..." value="${defaultUrl}">
      <button type="button" class="btn ghost del" title="削除">
        <i class="fa-solid fa-trash"></i>
      </button>
    `;
    const $url = row.querySelector('input');
    const $icon = row.querySelector('i');
    const $del = row.querySelector('.del');

    const updateIcon = () => { $icon.className = iconClassFor($url.value) + ' fa-fw'; };
    $url.addEventListener('input', updateIcon);
    updateIcon();

    $del.addEventListener('click', () => row.remove());
    $list.appendChild(row);
  }

  $add.addEventListener('click', () => addRow());
  // 最初に1行追加
  addRow();

  // === ここから追加 ===
  function add(url = '') { addRow(url); }

  /**
   * links: ["https://...", ...] または [{url:"https://...", label:"X"}, ...] を許容
   */
  // setupSns 内
  function set(links = []) {
    // 文字列URL / {url,label} どちらもOKに正規化
    const urls = (links || [])
      .map(e => typeof e === 'string' ? e : (e && e.url) || '')
      .map(s => (s || '').trim())
      .filter(Boolean);

    $list.innerHTML = '';      // ← reset() は使わない（空行が残るため）

    if (urls.length === 0) {   // データ無しなら空1行だけ
      addRow();
      return;
    }
    urls.forEach(u => addRow(u));  // 1行目から順に値入りで生成
  }

  // === 追加ここまで ===

  return {
    get: () => [...$list.querySelectorAll('input[type="url"]')]
      .map(i => i.value.trim()).filter(Boolean),
    reset: () => { $list.innerHTML = ''; addRow(); },

    // 追加した公開メソッド
    add,
    set
  };
}