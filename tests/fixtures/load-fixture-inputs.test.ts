import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import type { ContentAndTokenStrategy } from '../../fixtures/scripts/content-token-strategy.js';
import { loadFixtureInputs } from '../../fixtures/scripts/load-fixture-inputs.js';
import { ManualFileInjectionStrategy } from '../../fixtures/scripts/manual-file-injection-strategy.js';
import { createBaseline } from './baseline.js';

const contract = [{
  lockId: 'footer', baselinePath: 'footer.html',
  policy: { content: true, appearance: true, position: true },
  baseline: createBaseline(),
}];
const html = '<!DOCTYPE html>\n<footer data-locked="footer">Legal</footer>\n';
let directory: string | undefined;

afterEach(async () => {
  if (directory !== undefined) {
    await rm(directory, { recursive: true, force: true });
    directory = undefined;
  }
});

function strategy(source: string): ContentAndTokenStrategy {
  return {
    readBaselineContractText: async () => source,
    readCleanPageHtml: vi.fn(async () => html),
  };
}

describe('strategy-independent fixture import', () => {
  it('loads the manual filenames and preserves measured values and HTML exactly', async () => {
    directory = await mkdtemp(join(tmpdir(), 'fixture-import-'));
    await writeFile(join(directory, 'baseline-contract.json'), JSON.stringify(contract));
    await writeFile(join(directory, 'clean-page.html'), html);
    expect(await loadFixtureInputs(new ManualFileInjectionStrategy(directory)))
      .toEqual({ contract, cleanPageHtml: html });
  });

  it('accepts an alternative asynchronous strategy without any filesystem or SDK coupling', async () => {
    expect(await loadFixtureInputs(strategy(JSON.stringify(contract))))
      .toEqual({ contract, cleanPageHtml: html });
  });

  it.each([
    { source: { locks: contract } },
    { source: [{ lockId: 'footer', selector: 'footer', visibleText: 'Legal', computedStyles: createBaseline().computedStyles }] },
    { source: [{ ...contract[0], selector: 'footer' }] },
    { source: [{ ...contract[0], baseline: { ...createBaseline(), computedStyles: { ...createBaseline().computedStyles, display: 'block' } } }] },
  ])('rejects incompatible contract data before loading the clean page: $source', async ({ source }) => {
    const input = strategy(JSON.stringify(source));
    await expect(loadFixtureInputs(input)).rejects.toBeInstanceOf(ZodError);
    expect(input.readCleanPageHtml).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON without repairing or inventing values', async () => {
    await expect(loadFixtureInputs(strategy('{invalid'))).rejects.toBeInstanceOf(SyntaxError);
  });

  it('propagates strategy failures', async () => {
    const failure = new Error('Input unavailable');
    const input: ContentAndTokenStrategy = {
      readBaselineContractText: async () => { throw failure; },
      readCleanPageHtml: vi.fn(async () => html),
    };
    await expect(loadFixtureInputs(input)).rejects.toBe(failure);
    expect(input.readCleanPageHtml).not.toHaveBeenCalled();
  });
});
