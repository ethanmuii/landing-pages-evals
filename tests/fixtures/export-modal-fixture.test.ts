import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, expect, it } from 'vitest';
import { exportModalFixture } from '../../fixtures/scripts/export-modal-fixture.js';
import { loadContract, loadLockBaseline } from '../../src/contracts/load.js';
import { validatePage } from '../../src/validation/validate-page.js';
import { openSharedSession } from '../browser/shared-session.js';

const shared = await openSharedSession();
afterAll(() => shared.close());
let directory: string | undefined;
afterEach(async () => {
  if (directory !== undefined) await rm(directory, { recursive: true, force: true });
});

it('exports browser telemetry and a colocated fragment that the gate accepts', async () => {
  directory = await mkdtemp(join(tmpdir(), 'modal-export-'));
  const html = '<main>Mock</main><footer data-locked="source-footer" style="width:320px;height:48px">Legal</footer>';
  const contract = await exportModalFixture(shared.session, { readCleanPageHtml: async () => html }, directory);
  expect(contract[0]).toMatchObject({ lockId: 'source-footer', baselinePath: 'modal-footer.html', baseline: { width: 320, height: 48, visibleText: 'Legal' } });
  const loaded = await loadContract(join(directory, 'baseline-contract.json'));
  expect(loaded.locks).toEqual(contract);
  const fragment = await loadLockBaseline(loaded, 'source-footer');
  expect(fragment.html).toBe('<footer data-locked="source-footer" style="width:320px;height:48px">Legal</footer>');
  const findings = await validatePage(shared.session, loaded, 'clean-page.html', html);
  expect(findings).toHaveLength(3);
  expect(findings.every(({ verdict }) => verdict === 'pass')).toBe(true);
  expect(JSON.parse(await readFile(join(directory, 'baseline-contract.json'), 'utf8'))).toEqual(contract);
});

it.each(['<footer>Unannotated</footer>', '<main data-locked="wrong">Wrong</main>', '<footer data-locked="a">A</footer><footer data-locked="b">B</footer>'])('rejects invalid fixture scope before writing: %s', async (html) => {
  directory = await mkdtemp(join(tmpdir(), 'modal-export-'));
  await expect(exportModalFixture(shared.session, { readCleanPageHtml: async () => html }, directory)).rejects.toThrow('exactly one annotated lock');
  expect(await readdir(directory)).toEqual([]);
});

it('propagates missing input errors without creating artifacts', async () => {
  directory = await mkdtemp(join(tmpdir(), 'modal-export-'));
  await expect(exportModalFixture(shared.session, { readCleanPageHtml: () => readFile(join(directory!, 'clean-page.html'), 'utf8') }, directory)).rejects.toThrow('ENOENT');
  expect(await readdir(directory)).toEqual([]);
});
