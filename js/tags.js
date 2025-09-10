// タグ複数入力 UI。Enter/カンマ/blurで追加
export function setupTags(containerId, inputId) {
  const $box = document.getElementById(containerId);
  const $input = document.getElementById(inputId);
  let tags = [];

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, m => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  function render() {
    [...$box.querySelectorAll('.tag')].forEach(n => n.remove());
    tags.forEach((t,i) => {
      const chip = document.createElement('span');
      chip.className = 'tag';
      chip.innerHTML = `<span>${escapeHtml(t)}</span><button type="button" class="x" data-i="${i}" aria-label="削除">&times;</button>`;
      $box.insertBefore(chip, $input);
    });
  }

  $box.addEventListener('click', (e) => {
    const btn = e.target.closest('.x');
    if (!btn) return;
    tags.splice(Number(btn.dataset.i),1);
    render();
  });

  function addFromInput() {
    const v = $input.value.trim();
    if (!v) return;
    tags.push(v);
    render();
    $input.value='';
  }

  $input.addEventListener('keydown', (e) => {
    if (e.key==='Enter' || e.key===',') {
      e.preventDefault();
      addFromInput();
    }
  });
  $input.addEventListener('blur', addFromInput);

  return {
    get: () => tags.slice(),
    reset: () => { tags = []; render(); $input.value=''; }
  };
}
