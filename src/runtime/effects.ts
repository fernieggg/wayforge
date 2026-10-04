import { pid } from '../model/ids';
import type { Effect } from '../model/types';

interface Ctx {
  reduce: boolean;
  rowCycle: number;
  prefix: string;
}

type Handler<E> = (effect: E, ctx: Ctx) => (() => void) | void;

const rowsOf = (prefix: string, node: string) =>
  Array.from(document.getElementById(pid(prefix, `n-${node}`))?.querySelectorAll<SVGGElement>('.row') ?? []);

const HANDLERS: { [K in Effect['type']]: Handler<Extract<Effect, { type: K }>> } = {
  cycleRows(fx, { reduce, rowCycle, prefix }) {
    const rows = rowsOf(prefix, fx.node);
    if (reduce) {
      rows.forEach((r) => r.classList.add('hot'));
      return;
    }
    let i = 0;
    const tick = () => {
      rows.forEach((r, k) => r.classList.toggle('hot', k === i));
      i = (i + 1) % rows.length;
    };
    tick();
    const timer = setInterval(tick, (fx.interval ?? rowCycle) * 1000);
    return () => clearInterval(timer);
  },
  highlightRow(fx, { prefix }) {
    rowsOf(prefix, fx.node).forEach((r) => r.classList.toggle('lit', r.dataset.row === fx.row));
  },
};

/** Applies a flow's scene effects after clearing the previous scene's. */
export function createEffects(group: Element, prefix: string, reduce: boolean, rowCycle: number) {
  let cleanups: (() => void)[] = [];
  const clear = () => {
    cleanups.forEach((c) => c());
    cleanups = [];
    group.querySelectorAll('.row.hot, .row.lit').forEach((r) => r.classList.remove('hot', 'lit'));
  };
  return {
    clear,
    apply(effects: Effect[]) {
      clear();
      for (const fx of effects) {
        const cleanup = (HANDLERS[fx.type] as Handler<Effect>)(fx, { reduce, rowCycle, prefix });
        if (cleanup) cleanups.push(cleanup);
      }
    },
  };
}
