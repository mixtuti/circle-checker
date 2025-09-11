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
  function set(links = []) {
    reset();
    let added = false;
    try {
      (links || []).forEach(entry => {
        const url = typeof entry === 'string'
          ? entry
          : (entry && typeof entry === 'object' ? (entry.url || '') : '');
        if (url) { addRow(url); added = true; }
      });
    } catch (e) {
      console.warn('sns.set で例外:', e);
    }
    if (!added) addRow();
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