const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(s: string | number): string {
  return String(s).replace(/[&<>"']/g, (c) => ENTITIES[c]!);
}

export function attrs(a: Record<string, string | number | undefined | false>): string {
  return Object.entries(a)
    .filter((e): e is [string, string | number] => e[1] !== undefined && e[1] !== false)
    .map(([k, value]) => ` ${k}="${esc(value)}"`)
    .join('');
}

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
const BS = String.fromCharCode(92);

/** JSON that is safe inside a <script> element: no "</script>", no comment openers, no raw line separators. */
export function scriptJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, BS + 'u003c').split(LS).join(BS + 'u2028').split(PS).join(BS + 'u2029');
}
