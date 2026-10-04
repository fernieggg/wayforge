import type { RuntimeData, RuntimeScene } from '../render/runtimeData';

const NS = 'http://www.w3.org/2000/svg';

interface Packet {
  segs: { path: SVGPathElement; len: number }[];
  len: number;
  phase: number;
  dim: boolean;
  parts: SVGCircleElement[];
}

/** Opacity of one packet part. Part 0 is the glow; parts 1..tail are the head and its fading tail. */
export function partOpacity(i: number, s: number, len: number, p: RuntimeData['packet'], dim: boolean, dimFactor: number): number {
  if (s < 0 || s > len) return 0;
  const fade = Math.min(1, s / p.fade, (len - s) / p.fade);
  const o = (i === 0 ? p.glowOpacity : 1 - (i - 1) / p.tail) * fade * (dim ? dimFactor : 1);
  return Math.max(0, o);
}

/** Distance of the head along the route at a given time, in map units. */
export function headDistance(nowMs: number, len: number, phase: number, p: RuntimeData['packet'], reduce: boolean): number {
  const travel = len / p.speed;
  const cycle = travel + p.hold;
  const u = reduce ? travel * p.reducedMotionAt : (nowMs / 1000 + phase) % cycle;
  return u * p.speed;
}

export function createPackets(layer: SVGGElement, data: RuntimeData, reduce: boolean) {
  const p = data.packet;
  let packets: Packet[] = [];

  const circle = (attrs: Record<string, string | number>, parent: Element) => {
    const c = document.createElementNS(NS, 'circle');
    for (const [k, v] of Object.entries(attrs)) c.setAttribute(k, String(v));
    parent.appendChild(c);
    return c;
  };

  function pointAt(pk: Packet, s: number): DOMPoint {
    for (let i = 0; i < pk.segs.length; i++) {
      const sg = pk.segs[i]!;
      if (s <= sg.len || i === pk.segs.length - 1) return sg.path.getPointAtLength(Math.max(0, Math.min(s, sg.len)));
      s -= sg.len;
    }
    return new DOMPoint();
  }

  return {
    build(scene: RuntimeScene) {
      layer.textContent = '';
      packets = scene.routes.map((r) => {
        const segs = r.edges.map((id) => {
          const path = document.getElementById('e-' + id) as unknown as SVGPathElement;
          return { path, len: path.getTotalLength() };
        });
        const g = document.createElementNS(NS, 'g');
        layer.appendChild(g);
        const parts = [circle({ r: p.glowRadius, class: 'pk-glow', filter: 'url(#glow)' }, g)];
        for (let i = 0; i < p.tail; i++) parts.push(circle({ r: Math.max(p.minRadius, p.headRadius - i * p.radiusStep), class: 'pk' }, g));
        return { segs, len: segs.reduce((a, s) => a + s.len, 0), phase: r.phase, dim: r.dim, parts };
      });
    },
    draw(now: number) {
      for (const pk of packets) {
        const head = headDistance(now, pk.len, pk.phase, p, reduce);
        pk.parts.forEach((el, i) => {
          const s = i === 0 ? head : head - (i - 1) * p.gap;
          const o = partOpacity(i, s, pk.len, p, pk.dim, data.dim);
          if (s < 0 || s > pk.len) {
            el.style.opacity = '0';
            return;
          }
          const pos = pointAt(pk, s);
          el.setAttribute('cx', String(pos.x));
          el.setAttribute('cy', String(pos.y));
          el.style.opacity = String(o);
        });
      }
    },
  };
}
