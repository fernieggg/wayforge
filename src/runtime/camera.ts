import { zoomFrame } from '../geometry/zoom';

export const easeInOutCubic = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/** The camera is the SVG viewBox; moves tween it with a cubic ease in-out. */
export function createCamera(svg: SVGSVGElement, durationS: number, reduce: boolean) {
  let vb = (svg.getAttribute('viewBox') ?? '0 0 100 100').split(/\s+/).map(Number);
  let anim = 0;
  const set = (b: number[]) => svg.setAttribute('viewBox', b.join(' '));

  return {
    jump(to: number[]) {
      cancelAnimationFrame(anim);
      vb = to.slice();
      set(vb);
    },
    fly(to: number[]) {
      cancelAnimationFrame(anim);
      if (reduce) {
        vb = to.slice();
        set(vb);
        return;
      }
      const from = vb.slice();
      const t0 = performance.now();
      const duration = durationS * 1000;
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / duration);
        const e = easeInOutCubic(k);
        vb = from.map((v, i) => v + (to[i]! - v) * e);
        set(vb);
        if (k < 1) anim = requestAnimationFrame(step);
        else vb = to.slice();
      };
      step(t0);
    },
    /** A zoom flight: size changes geometrically; onProgress gets the eased progress (0..1). */
    zoomTo(to: number[], durationS: number, onProgress: (e: number) => void, done: () => void) {
      cancelAnimationFrame(anim);
      if (reduce) {
        vb = to.slice();
        set(vb);
        onProgress(1);
        done();
        return;
      }
      const from = vb.slice();
      const t0 = performance.now();
      const duration = durationS * 1000;
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / duration);
        const e = easeInOutCubic(k);
        vb = k < 1 ? zoomFrame(from, to, e) : to.slice();
        set(vb);
        onProgress(e);
        if (k < 1) anim = requestAnimationFrame(step);
        else done();
      };
      step(t0);
    },
  };
}
