import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resolveBaselinePath } from './baseline-path.js';
import { contractSchema, type BrandContract } from './contract.js';

export interface LoadedContract {
  contractFilePath: string;
  locks: BrandContract;
}

export async function loadContract(contractFilePath: string): Promise<LoadedContract> {
  const absolutePath = resolve(contractFilePath);
  const source = await readFile(absolutePath, 'utf8');
  const parsed: unknown = JSON.parse(source);
  return { contractFilePath: absolutePath, locks: contractSchema.parse(parsed) };
}

export async function loadBaseline(contract: LoadedContract, baselinePath: string): Promise<string> {
  return readFile(resolveBaselinePath(contract.contractFilePath, baselinePath), 'utf8');
}
