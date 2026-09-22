import { defineConfig } from 'vitest/config';

// Every test that drives a real browser. Rendering a captured page costs orders
// of magnitude more memory than the rest of the suite, and running several at
// once on a small box made page.setContent time out inside its own budget, so
// these are fenced into a project that runs one file at a time.
const BROWSER_TESTS = [
  'tests/browser/session.test.ts',
  'tests/browser/extract.test.ts',
  'tests/validation/validate-page.test.ts',
  'tests/fixtures/capture-baselines.test.ts',
  'tests/fixtures/export-modal-fixture.test.ts',
  'tests/cli/run.test.ts',
  'tests/corpus/corpus.test.ts',
  'tests/corpus/scoring.test.ts',
];

const DEFAULT_EXCLUDE = ['**/node_modules/**', '**/dist/**'];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/**/*.test.ts'],
          exclude: [...DEFAULT_EXCLUDE, ...BROWSER_TESTS],
        },
      },
      {
        test: {
          name: 'browser',
          include: BROWSER_TESTS,
          exclude: DEFAULT_EXCLUDE,
          fileParallelism: false,
        },
      },
    ],
  },
});
