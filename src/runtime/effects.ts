import type { Effect } from '../model/types';

type Handler<E> = (effect: E, ctx: { reduce: boolean; rowCycle: number }) => (() => void) | void;

const rowsOf = (node: string) => Array.from(document.querySelectorAll<SVGGElement>(`#n-${node} .row`));

const HANDLERS: { [K in Effect['type']]: Handler<Extract<Effect, { type: K }>> } = {
  cycleRows(fx, { reduce, rowCycle }) {
    const rows = rowsOf(fx.node);
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
  highlightRow(fx) {
    rowsOf(fx.node).forEach((r) => r.classList.toggle('lit', r.dataset.row === fx.row));
  },
};

/** Applies a scene's effects after clearing the previous scene's. */
export function createEffects(reduce: boolean, rowCycle: number) {
  let cleanups: (() => void)[] = [];
  return {
    apply(effects: Effect[]) {
      cleanups.forEach((c) => c());
      cleanups = [];
      document.querySelectorAll('.row.hot, .row.lit').forEach((r) => r.classList.remove('hot', 'lit'));
      for (const fx of effects) {
        const cleanup = (HANDLERS[fx.type] as Handler<Effect>)(fx, { reduce, rowCycle });
        if (cleanup) cleanups.push(cleanup);
      }
    },
  };
}
