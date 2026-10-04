import { placeKeepingIndex } from '../model/visibility';
import type { RuntimeData } from '../render/runtimeData';
import { createCamera } from './camera';
import { createEffects } from './effects';
import { bindInput } from './input';
import { createPackets } from './packets';

const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));

function boot() {
  const data = JSON.parse(document.getElementById('wf-data')!.textContent!) as RuntimeData;
  const reduce = !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = <T extends Element>(s: string) => document.querySelector(s) as T;
  const svg = $<SVGSVGElement>('#map');
  const dotsEl = $<HTMLElement>('#dots');
  const prev = $<HTMLButtonElement>('#prev');
  const next = $<HTMLButtonElement>('#next');
  const cap = $<HTMLElement>('#cap');
  const nodes = Array.from(document.querySelectorAll<SVGGElement>('.node'));
  const edges = Array.from(document.querySelectorAll<SVGPathElement>('.edge'));
  const labels = Array.from(document.querySelectorAll<SVGTextElement>('.lab'));
  const lensed = Array.from(document.querySelectorAll<SVGElement>('#map [data-lenses]'));

  const camera = createCamera(svg, data.motion.camera, reduce);
  const packets = createPackets($<SVGGElement>('#packets'), data, reduce);
  const effects = createEffects(reduce, data.motion.rowCycle);

  let lens = data.defaultLens;
  let scenes = data.scenes[lens]!;
  let cur = -1;

  function applyLens() {
    for (const el of lensed) el.classList.toggle('lens-out', !el.dataset.lenses!.split(' ').includes(lens));
    document.querySelectorAll('.lens-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-lens') === lens)));
    for (const l of data.lenses) svg.classList.toggle('lens-' + l, l === lens);
    for (const [id, byLens] of Object.entries(data.offsets)) {
      const n = document.getElementById('n-' + id);
      const o = byLens[lens];
      if (n) n.style.transform = o ? `translate(${o[0]}px, ${o[1]}px)` : '';
    }
  }

  function buildDots() {
    dotsEl.textContent = '';
    scenes.forEach((sc, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dot';
      b.setAttribute('aria-label', fill(data.stepLabel, { n: i + 1, label: sc.label }));
      b.title = sc.label;
      b.addEventListener('click', () => go(i));
      dotsEl.appendChild(b);
    });
  }

  function go(i: number, force = false) {
    i = Math.max(0, Math.min(scenes.length - 1, i));
    if (i === cur && !force) return;
    const first = cur < 0;
    cur = i;
    const sc = scenes[i]!;
    for (const n of nodes) n.classList.toggle('on', sc.nodes.includes(n.id.slice(2)));
    for (const e of edges) e.classList.toggle('on', sc.edges.includes(e.id.slice(2)));
    for (const l of labels) l.classList.toggle('on', sc.edges.includes(l.dataset.edge!));
    for (const l of data.layers) svg.classList.toggle('lyon-' + l, sc.layers.includes(l));
    packets.build(sc);
    if (reduce) packets.draw(0);
    if (first) camera.jump(sc.camera);
    else camera.fly(sc.camera);
    effects.apply(sc.effects);
    const setText = () => {
      $('#ct').textContent = sc.title;
      $('#cx').textContent = sc.caption;
      cap.classList.remove('out');
    };
    if (first) setText();
    else {
      cap.classList.add('out');
      setTimeout(setText, data.motion.caption * 1000);
    }
    dotsEl.querySelectorAll('.dot').forEach((d, k) => d.setAttribute('aria-current', String(k === i)));
    prev.disabled = i === 0;
    next.disabled = i === scenes.length - 1;
  }

  function setLens(name: string) {
    if (name === lens || !data.scenes[name]) return;
    const key = cur >= 0 ? scenes[cur]!.key : scenes[0]!.key;
    lens = name;
    scenes = data.scenes[name]!;
    applyLens();
    buildDots();
    go(placeKeepingIndex(scenes, key, data.stageOrder), true);
  }

  document.querySelectorAll<HTMLButtonElement>('.lens-btn').forEach((b) =>
    b.addEventListener('click', () => setLens(b.getAttribute('data-lens')!)),
  );
  prev.addEventListener('click', () => go(cur - 1));
  next.addEventListener('click', () => go(cur + 1));
  bindInput(
    {
      go,
      step: (d) => go(cur + d),
      first: () => go(0),
      last: () => go(scenes.length - 1),
      lens: (i) => {
        const id = data.lenses[i];
        if (id) setLens(id);
      },
    },
    data.motion.swipe,
  );

  applyLens();
  buildDots();
  go(0);
  if (!reduce) {
    const loop = (now: number) => {
      packets.draw(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

boot();
