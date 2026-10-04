// Pure rules shared by the validator, the renderer and the browser runtime.

/** An element with no lens list is shared by every lens; an empty list means parked. */
export function visibleIn(lenses: readonly string[] | undefined, lens: string): boolean {
  return lenses === undefined || lenses.includes(lens);
}

/**
 * Index of the scene to show after switching lenses: the scene with the same key,
 * else the one whose key is nearest in stageOrder, the later one on a tie.
 */
export function placeKeepingIndex(
  scenes: readonly { key: string }[],
  key: string,
  stageOrder: readonly string[],
): number {
  let idx = -1;
  scenes.forEach((s, k) => {
    if (s.key === key) idx = k;
  });
  if (idx >= 0) return idx;
  const target = stageOrder.indexOf(key);
  let best = Infinity;
  scenes.forEach((s, k) => {
    const d = Math.abs(stageOrder.indexOf(s.key) - target);
    if (d <= best) {
      best = d;
      idx = k;
    }
  });
  return Math.max(0, idx);
}
