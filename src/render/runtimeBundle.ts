import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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
 * checkout it is rebuilt with Vite whenever the sources are newer. The rebuild happens
 * in memory and lands with an atomic rename, so parallel builds never see a partial file.
 */
export async function runtimeBundle(): Promise<string> {
  const stale = !existsSync(BUNDLE) || (existsSync(SOURCES) && newestSource(SOURCES) > statSync(BUNDLE).mtimeMs);
  if (!stale) return readFileSync(BUNDLE, 'utf8');
  const { build } = await import('vite');
  const result = await build({
    root: PACKAGE_ROOT,
    configFile: resolve(PACKAGE_ROOT, 'vite.config.ts'),
    logLevel: 'warn',
    build: { write: false, emptyOutDir: false },
  });
  const outputs = (Array.isArray(result) ? result : [result]) as { output: { type: string; code?: string }[] }[];
  const code = outputs.flatMap((o) => o.output).find((o) => o.type === 'chunk')?.code;
  if (!code) throw new Error('vite produced no runtime bundle');
  mkdirSync(dirname(BUNDLE), { recursive: true });
  const tmp = `${BUNDLE}.${process.pid}.tmp`;
  writeFileSync(tmp, code);
  try {
    renameSync(tmp, BUNDLE);
  } catch {
    // Another process replaced the bundle at the same moment (Windows refuses the second rename).
    // Every build of the same sources is identical, so keep theirs and use ours from memory.
    rmSync(tmp, { force: true });
  }
  return code;
}
