import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadPage } from '../../src/pages/load.js';

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'lock-page-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('generated page loading', () => {
  it('returns raw markup unchanged, including whitespace and Unicode', async () => {
    const pagePath = join(directory, 'page.html');
    const markup = '<!doctype html>\n<p>  café — 页脚  </p>\n';
    await writeFile(pagePath, markup);
    await expect(loadPage(pagePath)).resolves.toBe(markup);
  });

  it('throws on missing input instead of returning findings', async () => {
    await expect(loadPage(join(directory, 'missing.html'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
