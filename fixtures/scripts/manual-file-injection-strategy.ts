import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ContentAndTokenStrategy } from './content-token-strategy.js';

export const BASELINE_CONTRACT_FILENAME = 'baseline-contract.json';
export const CLEAN_PAGE_FILENAME = 'clean-page.html';

export class ManualFileInjectionStrategy implements ContentAndTokenStrategy {
  constructor(private readonly directory: string) {}

  readBaselineContractText(): Promise<string> {
    return readFile(join(this.directory, BASELINE_CONTRACT_FILENAME), 'utf8');
  }

  readCleanPageHtml(): Promise<string> {
    return readFile(join(this.directory, CLEAN_PAGE_FILENAME), 'utf8');
  }
}
