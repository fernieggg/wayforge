import { absoluteTransform, matrix, toAbsoluteCamera } from '../geometry/zoom';
import { placeKeepingIndex } from '../model/visibility';
import type { RuntimeData, RuntimeScene } from '../render/runtimeData';
import { createCamera } from './camera';
import { createFlow, type FlowController } from './flow';
import { bindInput } from './input';

const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function boot() {
  const data = JSON.parse(document.getElementById('wf-data')!.textContent!) as RuntimeData;
  const reduce = !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = <T extends Element>(s: string) => document.querySelector(s) as T;
  const svg = $<SVGSVGElement>('#map');
  const dotsEl = $<HTMLElement>('#dots');
  const prev = $<HTMLButtonElement>('#prev');
  const next = $<HTMLButtonElement>('#next');
  const cap = $<HTMLElement>('#cap');
  const lensBar = $<HTMLElement>('.lens');
  const hint = $<HTMLElement>('.hint');
  const brand = $<HTMLElement>('.brand');
  const crumbs = $<HTMLElement>('.crumbs');

  const camera = createCamera(svg, data.motion.camera, reduce);
  const flows = data.flows.map((f, i) => createFlow(f, i, reduce));
  // The path from the root to the flow on screen.
  const stack: number[] = [0];
  const current = (): FlowController => flows[stack[stack.length - 1]!]!;
  let busy = false;
  let started = false;

  const transformOf = (i: number) => absoluteTransform(data.flows, i, (j) => flows[j]!.lens);
  const cameraOf = (fl: FlowController, sc: RuntimeScene) => toAbsoluteCamera(transformOf(fl.index), sc.camera);

  function setCaption(sc: RuntimeScene, immediate: boolean) {
    const setText = () => {
      $('#ct').textContent = sc.title;
      $('#cx').textContent = sc.caption;
      cap.classList.remove('out');
    };
    if (immediate) setText();
    else {
      cap.classList.add('out');
      setTimeout(setText, data.motion.caption * 1000);
    }
  }

  function buildDots() {
    dotsEl.textContent = '';
    current().scenes.forEach((sc, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dot';
      b.setAttribute('aria-label', fill(data.ui.step, { n: i + 1, label: sc.label }));
      b.title = sc.label;
      b.addEventListener('click', () => go(i));
      dotsEl.appendChild(b);
    });
  }

  function updateNav() {
    const fl = current();
    const i = fl.cur;
    const top = stack.length === 1;
    dotsEl.querySelectorAll('.dot').forEach((d, k) => d.setAttribute('aria-current', String(k === i)));
    prev.disabled = i === 0 && top;
    next.disabled = i === fl.scenes.length - 1 && top && !fl.scene?.enter;
  }

  function updateLensButtons() {
    lensBar.querySelectorAll('.lens-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-lens') === current().lens)));
  }

  /** Re-renders the chrome that depends on which flow is on screen. */
  function renderLevel() {
    const fl = current();
    lensBar.textContent = '';
    for (const l of fl.data.lenses) {
      const b = document.createElement('button');
      b.className = 'lens-btn';
      b.type = 'button';
      b.dataset.lens = l.id;
      b.textContent = l.label;
      lensBar.appendChild(b);
    }
    updateLensButtons();
    const multi = fl.data.lenses.length > 1;
    lensBar.hidden = !multi;
    hint.hidden = !multi;
    hint.textContent = fill(data.ui.hint, { keys: fl.data.lenses.slice(0, 9).map((_, i) => i + 1).join(' ') });

    const nested = stack.length > 1;
    crumbs.hidden = !nested;
    brand.hidden = nested;
    crumbs.textContent = '';
    stack.forEach((f, level) => {
      const label = data.flows[f]!.label;
      if (level > 0) {
        const sep = document.createElement('span');
        sep.className = 'sep';
        sep.setAttribute('aria-hidden', 'true');
        sep.textContent = '›';
        crumbs.appendChild(sep);
      }
      if (level === stack.length - 1) {
        const here = document.createElement('span');
        here.setAttribute('aria-current', 'location');
        here.textContent = label;
        crumbs.appendChild(here);
      } else {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.setAttribute('aria-label', fill(data.ui.exit, { title: label }));
        b.addEventListener('click', () => exitTo(level, false));
        crumbs.appendChild(b);
      }
    });
    buildDots();
  }

  function go(i: number, force = false) {
    const fl = current();
    i = Math.max(0, Math.min(fl.scenes.length - 1, i));
    if ((i === fl.cur && !force) || busy) return;
    const first = !started;
    started = true;
    const sc = fl.show(i);
    const cam = cameraOf(fl, sc);
    if (first) camera.jump(cam);
    else camera.fly(cam);
    setCaption(sc, first);
    updateNav();
  }

  function setLens(name: string) {
    const fl = current();
    if (name === fl.lens || !fl.data.scenes[name] || busy) return;
    const key = fl.cur >= 0 ? fl.scenes[fl.cur]!.key : fl.scenes[0]!.key;
    fl.setLens(name);
    updateLensButtons();
    buildDots();
    go(placeKeepingIndex(fl.scenes, key, fl.data.stageOrder), true);
  }

  /** One continuous zoom between two flows: the camera flies while one map dissolves into the other. */
  function transition(from: FlowController, to: FlowController, cam: number[], after: () => void) {
    busy = true;
    to.group.style.pointerEvents = 'none';
    from.group.style.pointerEvents = 'none';
    camera.zoomTo(
      cam,
      data.motion.zoom,
      (e) => {
        // Staggered so the two maps are rarely both strong at once: one dissolves, then the other resolves.
        from.group.style.opacity = String(1 - smoothstep(0.2, 0.55, e));
        to.group.style.opacity = String(smoothstep(0.45, 0.8, e));
      },
      () => {
        to.group.style.pointerEvents = '';
        busy = false;
        after();
      },
    );
  }

  function enter(child: number | undefined) {
    if (child === undefined || busy) return;
    const parent = current();
    const fl = flows[child]!;
    // A sub-flow opens in the parent's lens when it has one with the same id.
    fl.setLens(fl.data.lenses.some((l) => l.id === parent.lens) ? parent.lens : fl.data.defaultLens);
    stack.push(child);
    fl.group.setAttribute('transform', matrix(transformOf(child)));
    const sc = fl.show(0);
    renderLevel();
    setCaption(sc, false);
    updateNav();
    transition(parent, fl, cameraOf(fl, sc), () => parent.stop());
  }

  /** Leaves to an ancestor level; with `advance`, continues to that level's next scene. */
  function exitTo(level: number, advance: boolean) {
    if (level < 0 || level >= stack.length - 1 || busy) return;
    const from = current();
    for (const f of stack.slice(level + 1)) if (f !== from.index) flows[f]!.stop();
    stack.length = level + 1;
    const target = current();
    const i = advance ? Math.min(target.cur + 1, target.scenes.length - 1) : target.cur;
    const sc = target.show(i);
    renderLevel();
    setCaption(sc, false);
    updateNav();
    transition(from, target, cameraOf(target, sc), () => from.stop());
  }

  function stepForward() {
    const fl = current();
    const sc = fl.scene;
    if (sc?.enter) enter(fl.data.zooms[sc.enter]);
    else if (fl.cur === fl.scenes.length - 1 && stack.length > 1) exitTo(stack.length - 2, true);
    else go(fl.cur + 1);
  }

  function stepBack() {
    const fl = current();
    if (fl.cur === 0 && stack.length > 1) exitTo(stack.length - 2, false);
    else go(fl.cur - 1);
  }

  lensBar.addEventListener('click', (e) => {
    const b = (e.target as Element).closest('.lens-btn');
    if (b) setLens(b.getAttribute('data-lens')!);
  });
  svg.addEventListener('click', (e) => {
    const el = (e.target as Element).closest('.zoomable');
    if (el) activate(el);
  });
  function activate(el: Element) {
    const owner = el.closest('[data-flow]');
    if (Number(owner?.getAttribute('data-flow')) !== current().index) return;
    enter(Number(el.getAttribute('data-zoom')));
  }
  prev.addEventListener('click', stepBack);
  next.addEventListener('click', stepForward);
  bindInput(
    {
      go,
      step: (d) => (d > 0 ? stepForward() : stepBack()),
      first: () => go(0),
      last: () => go(current().scenes.length - 1),
      lens: (i) => {
        const l = current().data.lenses[i];
        if (l) setLens(l.id);
      },
      exit: () => exitTo(stack.length - 2, false),
      activate,
    },
    data.motion.swipe,
  );

  flows[0]!.applyLens();
  buildDots();
  go(0);
  if (!reduce) {
    const loop = (now: number) => {
      for (const f of flows) f.draw(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

boot();
