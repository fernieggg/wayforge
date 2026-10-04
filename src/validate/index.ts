import { deepMerge } from '../model/merge';
import { LoadError, readJson, themePath } from '../model/load';
import { resolveJourney } from '../model/resolve';
import type { Issue, Journey, ResolvedJourney, Theme } from '../model/types';
import { checkIntegrity, checkTheme } from './integrity';
import { lint } from './lint';
import { checkJourneySchema, checkThemeSchema } from './schema';

export interface Result {
  issues: Issue[];
  /** Present only when there are no errors. */
  resolved?: ResolvedJourney;
}

export const hasErrors = (issues: readonly Issue[]) => issues.some((i) => i.level === 'error');

/** Validates an already-parsed journey. Theme loading is delegated so tests can inject one. */
export function validateJourney(data: unknown, loadTheme: (name: string | undefined) => unknown): Result {
  const schemaIssues = checkJourneySchema(data);
  if (schemaIssues.length) return { issues: schemaIssues };
  const journey = data as Journey;

  let baseTheme: unknown;
  try {
    baseTheme = loadTheme(journey.theme);
  } catch (e) {
    if (e instanceof LoadError) return { issues: [{ level: 'error', rule: 'theme', path: 'theme', message: e.message }] };
    throw e;
  }
  const theme = deepMerge(baseTheme, journey.themeOverrides) as Theme;
  const themeIssues = checkThemeSchema(theme, journey.themeOverrides ? 'theme (with themeOverrides)' : 'theme');
  if (themeIssues.length) return { issues: themeIssues };

  const issues = [...checkTheme(theme), ...checkIntegrity(journey, theme)];
  if (hasErrors(issues)) return { issues };

  const resolved = resolveJourney(journey, theme);
  return { issues: [...issues, ...lint(resolved)], resolved };
}

export function validateFile(file: string): Result {
  let data: unknown;
  try {
    data = readJson(file);
  } catch (e) {
    if (e instanceof LoadError) return { issues: [{ level: 'error', rule: 'load', path: '(file)', message: e.message }] };
    throw e;
  }
  return validateJourney(data, (name) => readJson(themePath(name, file)));
}

export function formatIssue(i: Issue): string {
  return `${i.level === 'error' ? 'error  ' : 'warning'} ${i.path}: ${i.message} [${i.rule}]`;
}
