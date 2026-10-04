import type { ResolvedJourney, ResolvedScene } from '../model/types';
import { attrs, esc } from './escape';

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
}

export function lensKeys(r: ResolvedJourney): string {
  return r.lenses.slice(0, 9).map((_, i) => i + 1).join(' ');
}

export function buildHeader(r: ResolvedJourney, lens: string): string {
  const multi = r.lenses.length > 1;
  const buttons = r.lenses
    .map((l) => `<button${attrs({ class: 'lens-btn', type: 'button', 'data-lens': l.id, 'aria-pressed': String(l.id === lens) })}>${esc(l.label)}</button>`)
    .join('');
  return `<header>
  <div class="brand">${esc(r.meta.brand ?? '')}</div>
  <div class="lens" role="group"${attrs({ 'aria-label': r.ui.lensGroup, hidden: !multi && 'hidden' })}>${buttons}</div>
  <div class="hdr-right">
    <span class="hint"${attrs({ hidden: !multi && 'hidden' })}>${esc(fill(r.ui.hint, { keys: lensKeys(r) }))}</span>
    <button class="btn" id="fs" type="button">${esc(r.ui.fullscreen)}</button>
  </div>
</header>`;
}

export function buildFooter(r: ResolvedJourney, scenes: ResolvedScene[], index: number): string {
  const scene = scenes[index]!;
  const dots = scenes
    .map((s, i) =>
      `<button${attrs({
        type: 'button',
        class: 'dot',
        'aria-label': fill(r.ui.step, { n: i + 1, label: s.label }),
        title: s.label,
        'aria-current': String(i === index),
      })}></button>`,
    )
    .join('');
  return `<footer>
  <div id="cap" aria-live="polite">
    <h1 id="ct">${esc(scene.title)}</h1>
    <p id="cx">${esc(scene.caption)}</p>
  </div>
  <div class="nav">
    <div class="btns">
      <button class="btn" id="prev" type="button"${index === 0 ? ' disabled' : ''}>${esc(r.ui.back)}</button>
      <button class="btn primary" id="next" type="button"${index === scenes.length - 1 ? ' disabled' : ''}>${esc(r.ui.next)}</button>
    </div>
    <div class="dots" id="dots" role="group"${attrs({ 'aria-label': r.ui.steps })}>${dots}</div>
  </div>
</footer>`;
}
