import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import { resolve } from 'node:path';
import { PACKAGE_ROOT, readJson } from '../model/load';
import type { Issue } from '../model/types';

let validators: { journey: ValidateFunction; theme: ValidateFunction } | null = null;

function compile() {
  if (validators) return validators;
  const ajv = new Ajv2020({ allErrors: true, discriminator: true, strict: true, strictTuples: false, strictRequired: false });
  validators = {
    journey: ajv.compile(readJson(resolve(PACKAGE_ROOT, 'schema/journey.schema.json')) as object),
    theme: ajv.compile(readJson(resolve(PACKAGE_ROOT, 'schema/theme.schema.json')) as object),
  };
  return validators;
}

/** "/nodes/3/at/0" -> "nodes[3].at[0]", annotated with the id of the nearest element that has one. */
export function formatPath(pointer: string, data: unknown, prefix = ''): string {
  const parts = pointer.split('/').slice(1).map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let out = prefix;
  let cur: unknown = data;
  for (const part of parts) {
    if (Array.isArray(cur) && /^\d+$/.test(part)) {
      cur = cur[Number(part)];
      const id = cur && typeof cur === 'object' && 'id' in cur ? (cur as { id: unknown }).id : undefined;
      out += `[${part}]` + (typeof id === 'string' ? `(${id})` : '');
    } else {
      cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[part] : undefined;
      out += (out ? '.' : '') + part;
    }
  }
  return out || '(root)';
}

function message(e: ErrorObject): string {
  switch (e.keyword) {
    case 'additionalProperties':
      return `unknown field "${(e.params as { additionalProperty: string }).additionalProperty}"`;
    case 'required':
      return `missing required field "${(e.params as { missingProperty: string }).missingProperty}"`;
    case 'enum':
      return `must be one of ${(e.params as { allowedValues: unknown[] }).allowedValues.map((v) => JSON.stringify(v)).join(', ')}`;
    case 'const':
      return `must be ${JSON.stringify((e.params as { allowedValue: unknown }).allowedValue)}`;
    case 'pattern':
      return 'is not a valid id (letters, digits, "_" and "-", starting with a letter)';
    case 'oneOf':
      return 'does not match any allowed form';
    case 'discriminator':
      return 'has an unknown "type"';
    default:
      return e.message ?? e.keyword;
  }
}

function toIssues(errors: ErrorObject[] | null | undefined, data: unknown, prefix: string, rule: string): Issue[] {
  if (!errors) return [];
  // Branch errors under a failed oneOf are noise; the oneOf error itself is reported.
  const failedOneOf = errors.filter((e) => e.keyword === 'oneOf').map((e) => e.instancePath);
  const issues: Issue[] = [];
  const seen = new Set<string>();
  for (const e of errors) {
    if (e.keyword !== 'oneOf' && e.schemaPath.includes('/oneOf/') && failedOneOf.some((p) => e.instancePath.startsWith(p))) continue;
    const issue: Issue = { level: 'error', rule, path: formatPath(e.instancePath, data, prefix), message: message(e) };
    const k = issue.path + issue.message;
    if (!seen.has(k)) {
      seen.add(k);
      issues.push(issue);
    }
  }
  return issues;
}

export function checkJourneySchema(data: unknown): Issue[] {
  const v = compile().journey;
  v(data);
  return toIssues(v.errors, data, '', 'schema');
}

export function checkThemeSchema(data: unknown, label = 'theme'): Issue[] {
  const v = compile().theme;
  v(data);
  return toIssues(v.errors, data, label, 'theme-schema');
}
