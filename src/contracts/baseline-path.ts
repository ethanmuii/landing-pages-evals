import { dirname, resolve } from 'node:path';

/** Resolve against the contract's location, captured when the contract is loaded. */
export function resolveBaselinePath(contractFilePath: string, baselinePath: string): string {
  return resolve(dirname(contractFilePath), baselinePath);
}
