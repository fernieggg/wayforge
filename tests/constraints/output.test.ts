import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildHtml } from '../../src/render/html';
import { runtimeBundle } from '../../src/render/runtimeBundle';
import { validateFile } from '../../src/validate';

const ROOT = resolve(__dirname, '../..');
const JOURNEYS = ['journeys/examples/support-ticket.json', 'journeys/lead-journey.json'].filter((f) => existsSync(resolve(ROOT, f)));

// Hosts that may appear in a built page. Only Google Fonts is fetched; the SVG namespace is an identifier, not a request.
const ALLOWED_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'www.w3.org'];
const FORBIDDEN_APIS = [
  'window.storage', 'window.fs', 'window.claude', 'localStorage', 'sessionStorage', 'indexedDB',
  'fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon', 'importScripts', 'import(',
];

describe.each(JOURNEYS)('built output of %s', (journey) => {
  let html = '';
  beforeAll(async () => {
    const { resolved, issues } = validateFile(resolve(ROOT, journey));
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
    html = buildHtml(resolved!, await runtimeBundle());
  });

  it('is one file under 16 MB', () => {
    expect(Buffer.byteLength(html)).toBeLessThan(16 * 1024 * 1024);
  });

  it('makes no requests except Google Fonts', () => {
    const hosts = [...html.matchAll(/(?:https?:)?\/\/([a-z0-9.-]+\.[a-z]{2,})/gi)].map((m) => m[1]!.toLowerCase());
    expect([...new Set(hosts)].filter((h) => !ALLOWED_HOSTS.includes(h))).toEqual([]);
    expect(html).not.toMatch(/<script[^>]*\ssrc=/i);
    expect(html).not.toMatch(/<(iframe|embed|object|img|video|audio|source)\b/i);
    expect(html).not.toMatch(/@import/i);
    for (const link of html.match(/<link[^>]*>/gi) ?? []) {
      expect(link).toMatch(/rel="(preconnect|stylesheet|icon)"/);
      if (/rel="stylesheet"/.test(link)) expect(link).toContain('https://fonts.googleapis.com/css2?');
      if (/rel="icon"/.test(link)) expect(link).toContain('href="data:');
    }
  });

  it('uses no forbidden or injected browser APIs', () => {
    for (const api of FORBIDDEN_APIS) expect(html, api).not.toContain(api);
  });

  it('has no form elements', () => {
    expect(html).not.toMatch(/<form\b/i);
  });

  it('meets the page setup rules', () => {
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">');
    expect(html).toContain('env(safe-area-inset-top');
    expect(html).toContain('env(safe-area-inset-bottom');
    expect(html).toMatch(/html\{height:100%/);
    expect(html).toMatch(/body\{height:100%/);
    expect(html).not.toContain('100vh');
  });

  it('has light and dark themes with manual overrides', () => {
    expect(html).toContain('@media (prefers-color-scheme: dark){:root:not([data-theme="light"])');
    expect(html).toContain(':root[data-theme="dark"]');
  });

  it('has font fallbacks for every font', () => {
    for (const m of html.matchAll(/font(?:-family)?:[^;}]*"(\w[\w ]*)"([^;}]*)/g)) expect(m[2], m[0]).toMatch(/,\s*sans-serif|system-ui/);
  });
});
