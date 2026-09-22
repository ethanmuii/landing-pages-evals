import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadContract } from '../../src/contracts/load.js';
import { parsePage } from '../../src/locks/locate.js';
import { prepareLock } from '../../src/validation/prepare-lock.js';
import { createBaseline } from '../fixtures/baseline.js';

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'prepare-lock-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function fixture() {
  const contractPath = join(directory, 'contract.json');
  const baselinePath = join(directory, 'footer.html');
  await writeFile(contractPath, JSON.stringify([{
    lockId: 'footer', baselinePath: 'footer.html', baseline: createBaseline(),
    policy: { content: true, appearance: true, position: true },
  }]));
  await writeFile(baselinePath, '<footer data-locked="footer">Legal</footer>');
  return loadContract(contractPath);
}

describe('lock preparation', () => {
  it('returns only one presence finding for a missing lock without reading its baseline', async () => {
    const contract = await fixture();
    await rm(join(directory, 'footer.html'));
    const result = await prepareLock(parsePage('<main>Page</main>'), contract, 'page.html', 'footer');
    expect(result).toMatchObject({
      status: 'unresolved',
      finding: { lockId: 'footer', rule: 'structural_ambiguity', verdict: 'fail', domPath: 'NOT_FOUND' },
    });
  });

  it('returns one presence finding for duplicates before rendering', async () => {
    const contract = await fixture();
    const page = parsePage('<footer data-locked="footer"></footer><footer data-locked="footer"></footer>');
    const result = await prepareLock(page, contract, 'page.html', 'footer');
    expect(result).toMatchObject({
      status: 'unresolved',
      finding: { checker: 'presence_precondition', verdict: 'fail', domPath: 'NOT_FOUND' },
    });
  });

  it('pairs a found node with its baseline, path and anchors', async () => {
    const contract = await fixture();
    const page = parsePage('<main><section>Intro</section><footer data-locked="footer">Legal</footer></main>');
    const result = await prepareLock(page, contract, 'page.html', 'footer');
    expect(result).toMatchObject({
      status: 'ready', lockId: 'footer', pagePath: 'page.html',
      domPath: 'body/main[1]/footer[2]',
      baseline: createBaseline(),
      generatedMarkers: { parentTag: 'main', previousSiblingTag: 'section', nextSiblingTag: null },
    });
  });

  it('propagates a missing referenced baseline for a present lock', async () => {
    const contract = await fixture();
    await rm(join(directory, 'footer.html'));
    await expect(prepareLock(
      parsePage('<footer data-locked="footer">Legal</footer>'), contract, 'page.html', 'footer',
    )).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
