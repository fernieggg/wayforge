/** The oldest Node that the build tooling (Vite) and tests (Vitest) support. Keep in sync with package.json engines. */
export const MIN_NODE = '22.12.0';

/** True when `version` (like process.versions.node) is older than MIN_NODE. */
export function nodeTooOld(version: string, min: string = MIN_NODE): boolean {
  const parts = (v: string) => v.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const [a, b] = [parts(version), parts(min)];
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  }
  return false;
}
