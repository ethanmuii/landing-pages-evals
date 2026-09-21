import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { loadBaseline, loadContract } from '../../src/contracts/load.js';

let directory: string;
let contractFilePath: string;
const locks = [{
  lockId: 'footer-legal', baselinePath: 'baselines/footer.html',
  policy: { content: true, appearance: true, position: true },
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
