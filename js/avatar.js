// 画像プレビュー（丸型）。未選択時はデフォルト
export function setupAvatar(inputId, previewId) {
  const $input = document.getElementById(inputId);
  const $preview = document.getElementById(previewId);
  let dataURL = '';

  function render() {
    $preview.innerHTML = '';
    if (!dataURL) {
      const ph = document.createElement('div');
      ph.className = 'placeholder';
      ph.innerHTML = '<i class="fa-regular fa-image"></i>';
      $preview.appendChild(ph);
    } else {
      const img = document.createElement('img');
      img.src = dataURL;
      $preview.appendChild(img);
    }
  }
  render();

  function fileToDataURL(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onerror = () => rej(new Error('画像の読み込みに失敗'));
      r.onload = () => res(r.result);
      r.readAsDataURL(file);
    });
  }

  $input.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) { dataURL = ''; render(); return; }
    dataURL = await fileToDataURL(file);
    render();
  });

  return {
    get: () => dataURL,
    reset: () => { dataURL=''; render(); $input.value=''; }
  };
}
