import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Dataset #1 and the golden-master reference live in a separate private repository.
// Tests that need them skip when it is absent, so the public repo's CI still passes.
export const PRIVATE_DIR = resolve(process.env.WAYFORGE_PRIVATE_DIR ?? resolve(import.meta.dirname, '../../wayforge-private'));
export const LEAD_JOURNEY = resolve(PRIVATE_DIR, 'journeys/lead-journey.json');
export const REFERENCE = resolve(PRIVATE_DIR, 'reference/lead-journey.html');
export const HAS_LEAD_JOURNEY = existsSync(LEAD_JOURNEY);
export const HAS_REFERENCE = existsSync(REFERENCE);
