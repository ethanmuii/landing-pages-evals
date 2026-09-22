import type { Finding } from '../findings/finding.js';
import type { EvalLabel } from './label.js';
import { relativePagePath } from './page-path.js';

export function domPathSegments(path: string): string[] {
  return path.split('/').filter((segment) => segment.length > 0);
}

export function isSegmentPrefix(labelPath: string, findingPath: string): boolean {
  const labelSegments = domPathSegments(labelPath);
  const findingSegments = domPathSegments(findingPath);
  if (labelSegments.length > findingSegments.length) {
    return false;
  }
  return labelSegments.every((segment, index) => segment === findingSegments[index]);
}

export function findingMatchesLabel(finding: Finding, label: EvalLabel, pagesRoot?: string): boolean {
  return finding.lockId === label.lockId
    && finding.rule === label.rule
    && relativePagePath(finding.pagePath, pagesRoot) === label.pagePath
    && isSegmentPrefix(label.domPath, finding.domPath)
    && finding.reason.trim().length > 0;
}
