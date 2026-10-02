import { h } from '../kit.js';

export function aboutPage() {
  const el = h('div', 'st-page__body');
  const card = h('div', 'st-about');
  card.innerHTML = `
    <span class="st-about__num mono" aria-hidden="true">26</span>
    <div class="st-about__body">
      <span class="st-about__mark">Ringo<i aria-hidden="true"></i><span class="mono">S</span></span>
      <span class="st-about__code">Fuji</span>
      <span class="st-about__ver mono">RingoOS 26 · 2.0 preview</span>
      <span class="st-about__note">完整的關於頁會在下一階段做好：版本資訊、你和 RingoOS 的紀錄、製作者與第三方授權。</span>
    </div>`;
  el.append(card);
  return {
    id: 'about',
    title: '關於',
    lede: 'RingoOS 26 · Fuji',
    icon: 'about',
    el,
  };
}
