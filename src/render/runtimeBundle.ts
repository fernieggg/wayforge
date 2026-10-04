import { existsSync, readFileSync, statSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PACKAGE_ROOT } from '../model/load';

const BUNDLE = resolve(PACKAGE_ROOT, 'dist-runtime/runtime.js');
const SOURCES = resolve(PACKAGE_ROOT, 'src');

function newestSource(dir: string): number {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestSource(p) : statSync(p).mtimeMs);
  }
  return newest;
}

/**
 * The bundled browser runtime. A published package ships the bundle; in a source
 * checkout it is rebuilt with Vite whenever the sources are newer.
 */
export async function runtimeBundle(): Promise<string> {
  const stale = !existsSync(BUNDLE) || (existsSync(SOURCES) && newestSource(SOURCES) > statSync(BUNDLE).mtimeMs);
  if (stale) {
    const { build } = await import('vite');
    await build({ root: PACKAGE_ROOT, configFile: resolve(PACKAGE_ROOT, 'vite.config.ts'), logLevel: 'warn' });
  }
  return readFileSync(BUNDLE, 'utf8');
}
