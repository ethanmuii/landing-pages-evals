import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

export const LOCK_ATTRIBUTE = 'data-locked';

export type PageDocument = cheerio.CheerioAPI;

// Absent and duplicate produce the same finding shape downstream but need
// different reason text, so they remain distinct outcomes here.
export type LockLocation =
  | { outcome: 'found'; lockId: string; matchCount: 1; element: Element }
  | { outcome: 'absent'; lockId: string; matchCount: 0 }
  | { outcome: 'duplicate'; lockId: string; matchCount: number };

export function parsePage(html: string): PageDocument {
  return cheerio.load(html);
}

export function locateLock($: PageDocument, lockId: string): LockLocation {
  // Comparing parsed attribute values, rather than interpolating lockId into a
  // selector, lets ids containing quotes, brackets, backslashes or spaces match
  // without any escaping.
  const [first, ...rest] = $(`[${LOCK_ATTRIBUTE}]`)
    .filter((_, element) => $(element).attr(LOCK_ATTRIBUTE) === lockId)
    .toArray();

  if (first === undefined) {
    return { outcome: 'absent', lockId, matchCount: 0 };
  }
  if (rest.length === 0) {
    return { outcome: 'found', lockId, matchCount: 1, element: first };
  }
  return { outcome: 'duplicate', lockId, matchCount: rest.length + 1 };
}
