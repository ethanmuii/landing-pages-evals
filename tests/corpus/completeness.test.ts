import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  CLEAN_PAGE_PATH,
  CORPUS_LABELS_PATH,
  CORPUS_LOCK_ID,
  CORPUS_PAGES_DIRECTORY,
  MUTATIONS,
  buildPage,
  labelFor,
  type CorpusLabel,
} from '../../fixtures/scripts/build-corpus.js';

const EXPECTED_PAGE_NAMES = [
  ...[1, 2, 3, 4, 5].map((n) => `content-0${String(n)}.html`),
  ...[1, 2, 3, 4, 5].map((n) => `appearance-0${String(n)}.html`),
  ...[1, 2, 3, 4, 5].map((n) => `position-0${String(n)}.html`),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `control-0${String(n)}.html`),
  'control-10.html',
];

const REBUILD_TIMEOUT_MS = 300_000;

let cleanHtml = '';
let labels: CorpusLabel[] = [];
let pageFiles: string[] = [];

beforeAll(async () => {
  cleanHtml = await readFile(CLEAN_PAGE_PATH, 'utf8');
  labels = JSON.parse(await readFile(CORPUS_LABELS_PATH, 'utf8')) as CorpusLabel[];
  pageFiles = (await readdir(CORPUS_PAGES_DIRECTORY)).sort();
}, REBUILD_TIMEOUT_MS);

describe('corpus shape', () => {
  it('holds 15 violation pages and 10 controls under the approved names', () => {
    expect([...pageFiles].sort()).toEqual([...EXPECTED_PAGE_NAMES].sort());
    expect(MUTATIONS.map((mutation) => mutation.pageName)).toEqual(EXPECTED_PAGE_NAMES);
    expect(MUTATIONS.filter((mutation) => mutation.rule !== null)).toHaveLength(15);
    expect(MUTATIONS.filter((mutation) => mutation.rule === null)).toHaveLength(10);
  });

  it('declares exactly one mutation per page', () => {
    for (const pageName of EXPECTED_PAGE_NAMES) {
      expect(MUTATIONS.filter((mutation) => mutation.pageName === pageName)).toHaveLength(1);
    }
    expect(MUTATIONS.every((mutation) => mutation.edits.length > 0)).toBe(true);
  });
});

describe('labels', () => {
  it('carries one entry per violation page and none for a control', () => {
    expect(labels).toHaveLength(15);
    const labelled = labels.map((label) => label.pagePath);
    expect(labelled).toEqual(MUTATIONS.filter((m) => m.rule !== null).map((m) => m.pageName));
    expect(labelled.filter((pagePath) => pagePath.startsWith('control-'))).toEqual([]);
    expect(labels.every((label) => label.lockId === CORPUS_LOCK_ID)).toBe(true);
  });

  it('names a page file that exists, by filename alone', () => {
    for (const label of labels) {
      expect(label.pagePath).not.toContain('/');
      expect(pageFiles).toContain(label.pagePath);
    }
  });
});

// Comparing 10.5 MB strings directly would make any failure print a diff nobody
// can read, so identity travels as a digest.
function digest(html: string): string {
  return createHash('sha256').update(html).digest('hex');
}

// Rebuilding proves both that the generator is reproducible and that each page
// on disk is the clean page carrying its single declared mutation and nothing
// else: any second edit would break the digest.
it('rebuilds every page byte for byte and relabels it identically', async () => {
  const cleanDigest = digest(cleanHtml);
  for (const mutation of MUTATIONS) {
    const rebuilt = buildPage(cleanHtml, mutation);
    expect(digest(rebuilt)).not.toBe(cleanDigest);
    expect(digest(rebuilt)).toBe(digest(await readFile(join(CORPUS_PAGES_DIRECTORY, mutation.pageName), 'utf8')));
    expect(labelFor(mutation, rebuilt))
      .toEqual(labels.find((label) => label.pagePath === mutation.pageName) ?? null);
  }
}, REBUILD_TIMEOUT_MS);
