// 自動（OS+時間帯）でライト/ダークモード切替
export function applyAutoTheme() {
  const prefersDark = window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const h = new Date().getHours();
  const darkByTime = (h >= 18 || h < 6);
  document.documentElement.setAttribute(
    'data-theme',
    (prefersDark || darkByTime) ? 'dark' : 'light'
  );
}
