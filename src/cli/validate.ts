import { parseArgs } from 'node:util';
import type { Issue } from '../model/types';
import { formatIssue, validateFile, type Result } from '../validate';

export function report(file: string, result: Result, strict: boolean): boolean {
  const issues: Issue[] = strict ? result.issues.map((i) => ({ ...i, level: 'error' })) : result.issues;
  for (const i of issues) process.stderr.write(formatIssue(i) + '\n');
  const errors = issues.filter((i) => i.level === 'error').length;
  const warnings = issues.length - errors;
  const ok = errors === 0;
  process.stderr.write(`${file}: ${ok ? 'valid' : 'invalid'} (${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'})\n`);
  return ok;
}

export function runValidate(args: string[]): number {
  const { positionals, values } = parseArgs({ args, allowPositionals: true, options: { strict: { type: 'boolean' } } });
  const file = positionals[0];
  if (!file) {
    process.stderr.write('usage: wayforge validate <journey.json> [--strict]\n');
    return 2;
  }
  return report(file, validateFile(file), values.strict ?? false) ? 0 : 1;
}
