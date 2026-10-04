import type { Vec } from '../model/types';

export interface PathEnds {
  start: Vec;
  end: Vec;
}

const ARGS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
const TOKEN = /([MmLlHhVvCcSsQqTtAaZz])|([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)|([\s,]+)|(.)/g;

/** Start and end points of SVG path data, or null when the data is malformed. */
export function pathEnds(d: string): PathEnds | null {
  const tokens: (string | number)[] = [];
  for (const m of d.matchAll(TOKEN)) {
    if (m[4] !== undefined) return null;
    if (m[1] !== undefined) tokens.push(m[1]);
    else if (m[2] !== undefined) tokens.push(Number(m[2]));
  }
  if (typeof tokens[0] !== 'string' || tokens[0].toLowerCase() !== 'm') return null;

  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let start: Vec | null = null;
  let cmd = '';
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (typeof tok === 'string') {
      cmd = tok;
      i++;
      if (cmd.toLowerCase() === 'z') {
        x = sx;
        y = sy;
        continue;
      }
    } else if (cmd === '' || cmd.toLowerCase() === 'z') {
      return null;
    }
    const n = ARGS[cmd.toLowerCase()] ?? 0;
    const args = tokens.slice(i, i + n);
    if (args.length !== n || args.some((a) => typeof a !== 'number')) return null;
    i += n;
    const v = args as number[];
    const rel = cmd === cmd.toLowerCase();
    const lower = cmd.toLowerCase();
    if (lower === 'h') x = rel ? x + v[0]! : v[0]!;
    else if (lower === 'v') y = rel ? y + v[0]! : v[0]!;
    else {
      const px = v[n - 2]!;
      const py = v[n - 1]!;
      x = rel ? x + px : px;
      y = rel ? y + py : py;
    }
    if (lower === 'm') {
      sx = x;
      sy = y;
      if (!start) start = [x, y];
      // Extra pairs after a moveto are implicit linetos.
      cmd = rel ? 'l' : 'L';
    }
  }
  return start ? { start, end: [x, y] } : null;
}
