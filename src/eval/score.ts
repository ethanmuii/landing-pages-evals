import type { Finding } from '../findings/finding.js';
import type { EvalLabel } from './label.js';
import { findingMatchesLabel, isSegmentPrefix } from './match.js';

export interface EvalScore {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  mislocated: number;
  needsReview: number;
  matchedPairs: { finding: Finding; label: EvalLabel }[];
  unmatchedLabels: EvalLabel[];
  unmatchedFailFindings: Finding[];
  reviewFindings: Finding[];
}

export interface EvalRates {
  precision: number | null;
  recall: number | null;
  reviewRate: number | null;
}

function rate(numerator: number, denominator: number): number | null {
  // An empty denominator means the question was never asked, which is not the
  // same answer as a rate of zero, so it reports null instead of 0 or NaN.
  return denominator === 0 ? null : numerator / denominator;
}

export function scoreFindings(findings: readonly Finding[], labels: readonly EvalLabel[]): EvalScore {
  const reviewFindings = findings.filter((finding) => finding.verdict === 'needs_review');

  // A pass is not a claim that the page is broken, so it is dropped here rather
  // than counted: it can neither satisfy a label nor be a false positive.
  const candidates = findings
    .filter((finding) => finding.verdict === 'fail')
    .map((finding) => ({ finding, consumed: false }));

  const matchedPairs: { finding: Finding; label: EvalLabel }[] = [];
  const unmatchedLabels: EvalLabel[] = [];
  for (const label of labels) {
    const candidate = candidates.find((entry) => !entry.consumed && findingMatchesLabel(entry.finding, label));
    if (candidate === undefined) {
      unmatchedLabels.push(label);
      continue;
    }
    candidate.consumed = true;
    matchedPairs.push({ finding: candidate.finding, label });
  }

  const unmatchedFailFindings = candidates.filter((entry) => !entry.consumed).map((entry) => entry.finding);

  // Mislocation is a diagnostic overlay, not a fourth bucket: the finding below
  // is already a false positive and its label already a false negative, and it
  // is counted here a second time to say why that pair failed to meet.
  const mislocated = unmatchedFailFindings.filter((finding) => unmatchedLabels.some((label) =>
    label.pagePath === finding.pagePath
    && label.lockId === finding.lockId
    && label.rule === finding.rule
    && !isSegmentPrefix(label.domPath, finding.domPath))).length;

  return {
    truePositives: matchedPairs.length,
    falsePositives: unmatchedFailFindings.length,
    falseNegatives: unmatchedLabels.length,
    mislocated,
    needsReview: reviewFindings.length,
    matchedPairs,
    unmatchedLabels,
    unmatchedFailFindings,
    reviewFindings,
  };
}

export function evalRates(score: EvalScore): EvalRates {
  const decided = score.truePositives + score.falsePositives;
  return {
    precision: rate(score.truePositives, decided),
    recall: rate(score.truePositives, score.truePositives + score.falseNegatives),
    reviewRate: rate(score.needsReview, score.needsReview + decided),
  };
}
