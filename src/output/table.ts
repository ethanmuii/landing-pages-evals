import type { Finding } from '../findings/finding.js';

const COLUMNS = [
  { header: 'PAGE', cell: (finding: Finding) => finding.pagePath },
  { header: 'LOCK', cell: (finding: Finding) => finding.lockId },
  { header: 'RULE', cell: (finding: Finding) => finding.rule },
  { header: 'VERDICT', cell: (finding: Finding) => finding.verdict },
] as const;

const REASON_HEADER = 'REASON';
const GAP = '  ';
const ELLIPSIS = '…';
const DEFAULT_WIDTH = 100;

function fit(text: string, room: number): string {
  if (room <= 0) {
    return '';
  }
  if (text.length <= room) {
    return text;
  }
  return `${text.slice(0, room - 1)}${ELLIPSIS}`;
}

// The table is returned rather than printed so the CLI checkpoint owns stdout.
export function summaryTable(findings: readonly Finding[], width: number = DEFAULT_WIDTH): string {
  const tally = (verdict: Finding['verdict']) =>
    findings.filter((finding) => finding.verdict === verdict).length;

  const countLine = `${findings.length} findings: ${tally('pass')} pass, `
    + `${tally('fail')} fail, ${tally('needs_review')} review`;

  if (findings.length === 0) {
    return countLine;
  }

  const sized = COLUMNS.map((column) => ({
    ...column,
    width: Math.max(column.header.length, ...findings.map((finding) => column.cell(finding).length)),
  }));

  const room = width - sized.reduce((total, column) => total + column.width + GAP.length, 0);
  const line = (cells: readonly string[], reason: string) =>
    [...cells, fit(reason, room)].join(GAP).trimEnd();

  const headerLine = line(sized.map((column) => column.header.padEnd(column.width)), REASON_HEADER);
  const bodyLines = findings.map((finding) =>
    line(sized.map((column) => column.cell(finding).padEnd(column.width)), finding.reason));

  return [headerLine, ...bodyLines, '', countLine].join('\n');
}
