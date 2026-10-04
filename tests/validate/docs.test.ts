import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readJson } from '../../src/model/load';
import { validateJourney } from '../../src/validate';

// Every ```json block in the docs must parse, and every complete journey among them must
// validate with no errors or warnings, so the documentation cannot drift from the engine.
// Fragments that are not meant to stand alone are fenced as ```jsonc and skipped.
const ROOT = resolve(__dirname, '../..');
const files = ['README.md', ...readdirSync(resolve(ROOT, 'docs')).filter((f) => f.endsWith('.md')).map((f) => `docs/${f}`)];
const theme = readJson(resolve(ROOT, 'themes/default.json'));
const BLOCK = /```json\n([\s\S]*?)```/g;

const blocks = files.flatMap((file) =>
  [...readFileSync(resolve(ROOT, file), 'utf8').matchAll(BLOCK)].map((m, i) => ({ name: `${file} block ${i + 1}`, text: m[1]! })),
);

describe('JSON in the docs', () => {
  it('has examples to check', () => {
    expect(blocks.length).toBeGreaterThan(0);
  });

  it.each(blocks)('$name parses, and validates cleanly if it is a journey', ({ text }) => {
    const data = JSON.parse(text) as Record<string, unknown>;
    if (data.version === undefined) return;
    const issues = validateJourney(data, () => theme).issues.map((i) => `${i.level} ${i.path}: ${i.message}`);
    expect(issues).toEqual([]);
  });
});
