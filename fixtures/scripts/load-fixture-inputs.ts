import { contractSchema, type BrandContract } from '../../src/contracts/contract.js';
import type { ContentAndTokenStrategy } from './content-token-strategy.js';

export interface FixtureInputs {
  contract: BrandContract;
  cleanPageHtml: string;
}

/** Validate the same contract regardless of whether its source is a file or an API. */
export async function loadFixtureInputs(strategy: ContentAndTokenStrategy): Promise<FixtureInputs> {
  const source = await strategy.readBaselineContractText();
  const parsed: unknown = JSON.parse(source);
  const contract = contractSchema.parse(parsed);
  const cleanPageHtml = await strategy.readCleanPageHtml();
  return { contract, cleanPageHtml };
}
