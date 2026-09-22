import { resolve } from 'node:path';
import { withRenderSession } from '../../src/browser/session.js';
import { exportModalFixture } from './export-modal-fixture.js';
import { ManualFileInjectionStrategy } from './manual-file-injection-strategy.js';

const directory = resolve('src/fixtures/inputs');
try {
  await withRenderSession((session) =>
    exportModalFixture(session, new ManualFileInjectionStrategy(directory), directory));
  process.stdout.write(`Captured baseline-contract.json and modal-footer.html in ${directory}. User review is required before downstream use.\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
