import { relative, sep } from 'node:path';

export function relativePagePath(pagePath: string, pagesRoot?: string): string {
  if (pagesRoot === undefined) {
    return pagePath;
  }
  const rebased = relative(pagesRoot, pagePath);
  // A finding from outside the root keeps its own path: rebasing it would only
  // produce ../ segments, and a label can never carry those.
  if (rebased.length === 0 || rebased.startsWith('..')) {
    return pagePath;
  }
  return rebased.split(sep).join('/');
}
