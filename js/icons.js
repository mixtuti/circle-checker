// URL → Font Awesome アイコン判定
export function iconClassFor(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./,'');
    const map = {
      'twitter.com':'fa-brands fa-x-twitter', 'x.com':'fa-brands fa-x-twitter',
      'pixiv.net':'fa-solid fa-palette', 'booth.pm':'fa-solid fa-store',
      'fanbox.cc':'fa-regular fa-heart', 'fantia.jp':'fa-solid fa-heart',
      'instagram.com':'fa-brands fa-instagram',
      'youtube.com':'fa-brands fa-youtube','youtu.be':'fa-brands fa-youtube',
      'twitch.tv':'fa-brands fa-twitch','github.com':'fa-brands fa-github',
      'bsky.app':'fa-solid fa-cloud','note.com':'fa-regular fa-note-sticky',
      'skeb.jp':'fa-solid fa-envelope-open-text'
    };
    return map[host] || 'fa-solid fa-link';
  } catch {
    return 'fa-solid fa-link';
  }
}
