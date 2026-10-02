const ID = /^[A-Za-z0-9_-]{11}$/;
const LIST = /^[A-Za-z0-9_-]{10,}$/;
const HOSTS = /(^|\.)((youtube\.com)|(youtube-nocookie\.com)|(youtu\.be))$/i;

export function parseYouTube(input) {
  const text = String(input || '').trim();
  if (!text) return null;
  if (ID.test(text)) return { kind: 'video', ref: text };
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch (err) {
    return null;
  }
  if (!HOSTS.test(url.hostname)) return null;
  const v = url.searchParams.get('v');
  const list = url.searchParams.get('list');
  if (/youtu\.be$/i.test(url.hostname)) {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return ID.test(id || '') ? { kind: 'video', ref: id } : null;
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (v && ID.test(v)) return { kind: 'video', ref: v };
  if (['shorts', 'live', 'embed', 'v'].includes(parts[0]) && ID.test(parts[1] || '')) return { kind: 'video', ref: parts[1] };
  if (list && LIST.test(list) && !/^RD/.test(list)) return { kind: 'playlist', ref: list };
  return null;
}

export function canonicalUrl(item) {
  return item.kind === 'playlist'
    ? `https://www.youtube.com/playlist?list=${item.ref}`
    : `https://www.youtube.com/watch?v=${item.ref}`;
}

export async function lookup(item, signal) {
  const response = await fetch(`https://www.youtube.com/oembed?${new URLSearchParams({ url: canonicalUrl(item), format: 'json' })}`, { signal });
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const json = await response.json();
  return {
    title: String(json.title || ''),
    author: String(json.author_name || ''),
    thumb: String(json.thumbnail_url || (item.kind === 'video' ? `https://i.ytimg.com/vi/${item.ref}/mqdefault.jpg` : '')),
  };
}

let apiPromise = null;

export function loadApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error('youtube-api'));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

export function nextIndex(length, current, { shuffle = false, repeat = 'off', random = Math.random } = {}) {
  if (!length) return -1;
  if (repeat === 'one') return current;
  if (shuffle && length > 1) {
    let pick = Math.floor(random() * (length - 1));
    if (pick >= current) pick += 1;
    return pick;
  }
  if (current + 1 < length) return current + 1;
  return repeat === 'all' ? 0 : -1;
}

export function previousIndex(length, current, { repeat = 'off' } = {}) {
  if (!length) return -1;
  if (current > 0) return current - 1;
  return repeat === 'all' ? length - 1 : 0;
}
