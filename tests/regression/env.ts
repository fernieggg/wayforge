import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// The visual regression suite compares a journey's build against a reference page.
// Both come from outside the repo; tests that need them skip when either is unset or missing.
const fromEnv = (name: string) => (process.env[name] ? resolve(process.env[name]) : undefined);

export const REGRESSION_JOURNEY = fromEnv('WAYFORGE_REGRESSION_JOURNEY');
export const REGRESSION_REFERENCE = fromEnv('WAYFORGE_REGRESSION_REFERENCE');
export const HAS_REGRESSION_JOURNEY = !!REGRESSION_JOURNEY && existsSync(REGRESSION_JOURNEY);
export const HAS_REGRESSION = HAS_REGRESSION_JOURNEY && !!REGRESSION_REFERENCE && existsSync(REGRESSION_REFERENCE);
