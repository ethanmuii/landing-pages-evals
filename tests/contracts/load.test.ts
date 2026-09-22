import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { loadBaseline, loadContract, loadLockBaseline } from '../../src/contracts/load.js';
import { createBaseline } from '../fixtures/baseline.js';

let directory: string;
let contractFilePath: string;
const locks = [{
  lockId: 'footer-legal', baselinePath: 'baselines/footer.html',
  policy: { content: true, appearance: true, position: true },
  baseline: createBaseline(),
}];

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'lock-contract-'));
  contractFilePath = join(directory, 'contract.json');
  await writeFile(contractFilePath, JSON.stringify(locks));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(directory, { recursive: true, force: true });
});

describe('contract file loading', () => {
  it('loads and validates the contract while retaining its absolute location', async () => {
    const loaded = await loadContract(relative(process.cwd(), contractFilePath));
    expect(loaded).toEqual({ contractFilePath, locks });
  });

  it('throws on a missing contract instead of returning findings', async () => {
    await expect(loadContract(join(directory, 'missing.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('throws on malformed JSON', async () => {
    await writeFile(contractFilePath, '{ malformed');
    await expect(loadContract(contractFilePath)).rejects.toBeInstanceOf(SyntaxError);
  });

  it.each([
    { locks },
    [{ ...locks[0], unexpected: true }],
    [{ ...locks[0], policy: { content: false, appearance: true, position: true } }],
  ])('throws on contract schema mismatch: %j', async (invalid) => {
    await writeFile(contractFilePath, JSON.stringify(invalid));
    await expect(loadContract(contractFilePath)).rejects.toBeInstanceOf(ZodError);
  });
});

describe('baseline file loading', () => {
  it('pairs each requested lock with its own HTML and frozen observations', async () => {
    const first = { ...locks[0]!, baselinePath: 'footer.html' };
    const second = {
      ...first, lockId: 'header', baselinePath: 'header.html',
      baseline: { ...createBaseline(), width: 960, height: 80, previousSiblingTag: null, nextSiblingTag: 'main' },
    };
    await writeFile(contractFilePath, JSON.stringify([first, second]));
    await writeFile(join(directory, 'footer.html'), '<footer data-locked="footer-legal">Footer</footer>');
    await writeFile(join(directory, 'header.html'), '<header data-locked="header">Header</header>');
    const loaded = await loadContract(contractFilePath);
    await expect(loadLockBaseline(loaded, 'header')).resolves.toEqual({
      lockId: 'header', html: '<header data-locked="header">Header</header>', baseline: second.baseline,
    });
    await expect(loadLockBaseline(loaded, 'footer-legal')).resolves.toEqual({
      lockId: 'footer-legal', html: '<footer data-locked="footer-legal">Footer</footer>', baseline: first.baseline,
    });
  });

  it('throws when the requested lock has no contract entry', async () => {
    const loaded = await loadContract(contractFilePath);
    await expect(loadLockBaseline(loaded, 'unknown-lock')).rejects.toThrow('absent from contract');
  });

  it('throws when a referenced lock fragment is missing', async () => {
    const loaded = await loadContract(contractFilePath);
    await expect(loadLockBaseline(loaded, 'footer-legal')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('throws when frozen observations are incomplete or contain unknown fields', async () => {
    for (const baseline of [
      { ...createBaseline(), width: undefined },
      { ...createBaseline(), computedStyles: { padding: '8px' } },
      { ...createBaseline(), viewport: 1280 },
    ]) {
      await writeFile(contractFilePath, JSON.stringify([{ ...locks[0], baseline }]));
      await expect(loadContract(contractFilePath)).rejects.toBeInstanceOf(ZodError);
    }
  });

  it('reads the contract-relative fixture unchanged even after the working directory changes', async () => {
    const html = '<footer data-locked="footer-legal">© Example\n</footer>';
    await mkdir(join(directory, 'baselines'));
    await writeFile(join(directory, 'baselines', 'footer.html'), html);
    const loaded = await loadContract(relative(process.cwd(), contractFilePath));
    vi.spyOn(process, 'cwd').mockReturnValue(join(directory, 'another-terminal'));
    await expect(loadBaseline(loaded, 'baselines/footer.html')).resolves.toBe(html);
  });

  it('throws on a missing baseline instead of returning a lock-presence finding', async () => {
    const loaded = await loadContract(contractFilePath);
    await expect(loadBaseline(loaded, 'baselines/missing.html')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
