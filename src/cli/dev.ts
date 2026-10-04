import { watch, type FSWatcher } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { readJson, themePath } from '../model/load';
import type { Journey } from '../model/types';
import { buildHtml } from '../render/html';
import { esc } from '../render/escape';
import { runtimeBundle } from '../render/runtimeBundle';
import { formatIssue, validateFile } from '../validate';

// Dev-only: reloads the page when the server announces a rebuild. Never part of a built file.
const RELOAD = `<script>new EventSource('/__wayforge').onmessage=function(){location.reload()}</script>`;

function errorPage(file: string, lines: string[]): string {
  return `<!doctype html><meta charset="utf-8"><title>wayforge: ${esc(file)}</title>
<style>body{font:15px/1.5 ui-monospace,Consolas,monospace;margin:32px;background:#1b1414;color:#f3dede}h1{font-size:18px;color:#ff8f8f}li{margin:6px 0}</style>
<h1>${esc(file)} does not build</h1><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>${RELOAD}`;
}

export async function runDev(args: string[]): Promise<number> {
  const { positionals, values } = parseArgs({ args, allowPositionals: true, options: { port: { type: 'string', short: 'p' } } });
  const file = positionals[0];
  if (!file) {
    process.stderr.write('usage: wayforge dev <journey.json> [--port 5173]\n');
    return 2;
  }
  const journeyFile = resolve(file);
  const port = Number(values.port ?? 5173);
  let page = '';
  const clients = new Set<ServerResponse>();

  async function rebuild() {
    const result = validateFile(journeyFile);
    const errors = result.issues.filter((i) => i.level === 'error');
    for (const i of result.issues) process.stderr.write(formatIssue(i) + '\n');
    if (!result.resolved) {
      page = errorPage(file!, errors.map(formatIssue));
      process.stderr.write(`${file}: ${errors.length} error(s), serving the error list\n`);
    } else {
      page = buildHtml(result.resolved, await runtimeBundle()).replace('</body>', `${RELOAD}\n</body>`);
      process.stderr.write(`${file}: rebuilt\n`);
    }
    for (const c of clients) c.write('data: reload\n\n');
  }

  // Watch the journey and its theme file; re-resolve the theme path on each rebuild in case it changed.
  let watchers: FSWatcher[] = [];
  let timer: NodeJS.Timeout | undefined;
  const rewatch = () => {
    watchers.forEach((w) => w.close());
    let theme: string | undefined;
    try {
      theme = (readJson(journeyFile) as Partial<Journey>).theme;
    } catch {
      theme = undefined;
    }
    watchers = [journeyFile, themePath(theme, journeyFile)].map((f) => {
      try {
        return watch(f, () => {
          clearTimeout(timer);
          timer = setTimeout(() => void rebuild().then(rewatch), 80);
        });
      } catch {
        return null;
      }
    }).filter((w): w is FSWatcher => w !== null);
  };

  await rebuild();
  rewatch();

  createServer((req, res) => {
    if (req.url === '/__wayforge') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(': connected\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(page);
  }).listen(port, () => process.stderr.write(`serving ${file} at http://localhost:${port} (Ctrl+C to stop)\n`));

  return new Promise<number>(() => {});
}
