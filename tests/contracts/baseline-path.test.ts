import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveBaselinePath } from '../../src/contracts/baseline-path.js';

const root = resolve('test-workspace');
const contractFilePath = resolve(root, 'company', 'contract.json');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('contract-relative baseline paths', () => {
  it('resolves a baseline relative to the directory containing the contract', () => {
    expect(resolveBaselinePath(contractFilePath, 'baselines/footer.html'))
      .toBe(resolve(root, 'company', 'baselines', 'footer.html'));
  });

  it('resolves parent-directory segments from the contract directory', () => {
    expect(resolveBaselinePath(contractFilePath, '../shared/footer.html'))
      .toBe(resolve(root, 'shared', 'footer.html'));
  });

  it('preserves an absolute baseline destination', () => {
    const absoluteBaseline = resolve(root, 'shared', 'footer.html');
    expect(resolveBaselinePath(contractFilePath, absoluteBaseline)).toBe(absoluteBaseline);
  });

  it('does not change the target when the working directory changes', () => {
    const expected = resolve(root, 'company', 'baselines', 'footer.html');
    const cwd = vi.spyOn(process, 'cwd');
    for (const directory of [resolve(root, 'terminal-a'), resolve(root, 'terminal-b')]) {
      cwd.mockReturnValue(directory);
      expect(resolveBaselinePath(contractFilePath, 'baselines/footer.html')).toBe(expected);
    }
  });

  it('preserves meaningful spaces in path segments', () => {
    expect(resolveBaselinePath(contractFilePath, '  footer file.html  '))
      .toBe(resolve(root, 'company', '  footer file.html  '));
  });
});
