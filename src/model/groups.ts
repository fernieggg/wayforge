export type GroupMap = Record<string, readonly string[] | undefined>;

export class GroupError extends Error {
  constructor(
    message: string,
    readonly group: string,
  ) {
    super(message);
  }
}

/** Expands "@name" references (recursively) and removes duplicates, keeping first occurrence order. */
export function expandRefs(refs: readonly string[], groups: GroupMap): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (list: readonly string[], stack: string[]) => {
    for (const ref of list) {
      if (ref.startsWith('@')) {
        const name = ref.slice(1);
        if (stack.includes(name)) throw new GroupError(`group cycle: ${[...stack, name].map((g) => '@' + g).join(' -> ')}`, name);
        const members = groups[name];
        if (!members) throw new GroupError(`unknown group "@${name}"`, name);
        walk(members, [...stack, name]);
      } else if (!seen.has(ref)) {
        seen.add(ref);
        out.push(ref);
      }
    }
  };
  walk(refs, []);
  return out;
}
