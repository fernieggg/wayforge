import { pid } from '../model/ids';
import type { RuntimeFlow, RuntimeScene } from '../render/runtimeData';
import { createEffects } from './effects';
import { createPackets } from './packets';

export type FlowController = ReturnType<typeof createFlow>;

/** The map state of one flow: its lens, current scene, packets and effects, scoped to its own group. */
export function createFlow(data: RuntimeFlow, index: number, reduce: boolean) {
  const group = document.querySelector<SVGGElement>(`[data-flow="${index}"]`)!;
  const all = <T extends Element>(sel: string) => Array.from(group.querySelectorAll<T>(sel));
  const nodes = all<SVGGElement>('.node');
  const edges = all<SVGPathElement>('.edge');
  const labels = all<SVGTextElement>('.lab');
  const lensed = all<SVGElement>('[data-lenses]');
  const nodeId = (el: Element) => el.id.slice(pid(data.prefix, 'n-').length);
  const edgeId = (el: Element) => el.id.slice(pid(data.prefix, 'e-').length);
  const packets = createPackets(group.querySelector<SVGGElement>(`#${pid(data.prefix, 'packets')}`)!, data, reduce);
  const effects = createEffects(group, data.prefix, reduce, data.rowCycle);

  let lens = data.defaultLens;
  let scenes: RuntimeScene[] = data.scenes[lens]!;
  let cur = -1;

  function applyLens() {
    for (const el of lensed) el.classList.toggle('lens-out', !el.dataset.lenses!.split(' ').includes(lens));
    for (const l of data.lenses) group.classList.toggle('lens-' + l.id, l.id === lens);
    for (const [id, byLens] of Object.entries(data.offsets)) {
      const n = document.getElementById(pid(data.prefix, 'n-' + id));
      const o = byLens[lens];
      if (n) n.style.transform = o ? `translate(${o[0]}px, ${o[1]}px)` : '';
    }
  }

  return {
    index,
    data,
    group,
    get lens() {
      return lens;
    },
    get scenes() {
      return scenes;
    },
    get cur() {
      return cur;
    },
    get scene(): RuntimeScene | undefined {
      return scenes[cur];
    },
    applyLens,
    /** Switches lens without choosing a scene; returns false if the lens is unknown. */
    setLens(name: string): boolean {
      const next = data.scenes[name];
      if (!next) return false;
      lens = name;
      scenes = next;
      applyLens();
      return true;
    },
    /** Puts scene i on the map: active elements, layers, packets, effects. */
    show(i: number): RuntimeScene {
      cur = i;
      const sc = scenes[i]!;
      for (const n of nodes) n.classList.toggle('on', sc.nodes.includes(nodeId(n)));
      for (const e of edges) e.classList.toggle('on', sc.edges.includes(edgeId(e)));
      for (const l of labels) l.classList.toggle('on', sc.edges.includes(l.dataset.edge!));
      for (const l of data.layers) group.classList.toggle('lyon-' + l, sc.layers.includes(l));
      packets.build(sc);
      if (reduce) packets.draw(0);
      effects.apply(sc.effects);
      return sc;
    },
    /** Stops packets and effects while this flow is hidden. */
    stop() {
      packets.clear();
      effects.clear();
    },
    draw(now: number) {
      packets.draw(now);
    },
  };
}
