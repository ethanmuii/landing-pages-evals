import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CORPUS_LABELS_PATH, CORPUS_PAGES_DIRECTORY } from '../../fixtures/scripts/build-corpus.js';
import { runCli } from '../../src/cli/run.js';
import { loadLabels, type EvalLabel } from '../../src/eval/label.js';
import { evalRates, scoreFindings, type EvalScore } from '../../src/eval/score.js';
import { findingSchema, type Finding } from '../../src/findings/finding.js';

// Twenty-five captured pages through a real browser, so this is budgeted like
// the corpus gate rather than like a unit test.
const RUN_TIMEOUT_MS = 600_000;

// content-03 lengthens the lock's visible text enough to reflow it, so the page
// fails the appearance rule as well as the content rule it is labelled for. The
// extra fail is correct behaviour and is scored as a false positive, because a
// label is the only thing that makes a fail expected.
const UNLABELLED_FAILS = 1;

let directory: string;
let findings: Finding[];
let labels: EvalLabel[];
let score: EvalScore;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'corpus-scoring-'));
  const findingsPath = join(directory, 'findings.json');

  // Deliberately the CLI and not validatePage: listPages is what joins the
  // pages directory onto each entry, and that join is the thing being tested.
  const status = await runCli([
    '--contract', 'src/fixtures/inputs/baseline-contract.json',
    '--pages', CORPUS_PAGES_DIRECTORY,
    '--findings', findingsPath,
  ], { out: () => {}, err: () => {} });
  expect(status).toBe(1);

  const parsed: unknown = JSON.parse(await readFile(findingsPath, 'utf8'));
  findings = (parsed as unknown[]).map((finding) => findingSchema.parse(finding));
  labels = await loadLabels(CORPUS_LABELS_PATH);
  score = scoreFindings(findings, labels, CORPUS_PAGES_DIRECTORY);
}, RUN_TIMEOUT_MS);

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

it('reports one finding per rule per page', () => {
  expect(findings).toHaveLength(25 * 3);
  expect(labels).toHaveLength(15);
});

it('emits findings whose page path is the directory the CLI walked', () => {
  expect(findings.every((finding) => finding.pagePath.startsWith(`${CORPUS_PAGES_DIRECTORY}/`))).toBe(true);
  expect(labels.every((label) => !label.pagePath.includes('/'))).toBe(true);
});

it('matches every label against the findings the CLI actually wrote', () => {
  expect(score.truePositives).toBe(15);
  expect(score.falseNegatives).toBe(0);
  expect(score.mislocated).toBe(0);
});

it('counts only the reflow side effect as unlabelled', () => {
  expect(score.falsePositives).toBe(UNLABELLED_FAILS);
  expect(score.unmatchedFailFindings.map((finding) => [finding.pagePath, finding.rule]))
    .toEqual([[`${CORPUS_PAGES_DIRECTORY}/content-03.html`, 'appearance']]);
});

it('escalates nothing, so every verdict is decided', () => {
  expect(score.needsReview).toBe(0);
  expect(evalRates(score)).toEqual({ precision: 15 / 16, recall: 1, reviewRate: 0 });
});

it('finds no violation on any control page', () => {
  const controlFails = findings.filter((finding) =>
    finding.verdict !== 'pass' && finding.pagePath.includes('/control-'));
  expect(controlFails).toEqual([]);
});

it('rejects omitted pages roots for the actual CLI findings', () => {
  // @ts-expect-error Missing roots must fail for typed and untyped callers.
  expect(() => scoreFindings(findings, labels)).toThrow('pagesRoot');
});
