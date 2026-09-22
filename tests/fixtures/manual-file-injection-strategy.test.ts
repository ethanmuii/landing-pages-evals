import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ContentAndTokenStrategy } from '../../fixtures/scripts/content-token-strategy.js';
import { ManualFileInjectionStrategy } from '../../fixtures/scripts/manual-file-injection-strategy.js';

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'manual-fixture-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('manual fixture input', () => {
  it('supplies exact local contract JSON and offline HTML through the strategy interface', async () => {
    const contract = '{"locks": []}\n';
    const page = '<!DOCTYPE html>\n<html><body>© Modal</body></html>\n';
    await writeFile(join(directory, 'baseline-contract.json'), contract);
    await writeFile(join(directory, 'clean-page.html'), page);

    const strategy: ContentAndTokenStrategy = new ManualFileInjectionStrategy(directory);
    await expect(strategy.readBaselineContractText()).resolves.toBe(contract);
    await expect(strategy.readCleanPageHtml()).resolves.toBe(page);
  });

  it('throws for absent manual files instead of manufacturing fixture content', async () => {
    const strategy = new ManualFileInjectionStrategy(directory);
    await expect(strategy.readBaselineContractText()).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(strategy.readCleanPageHtml()).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
