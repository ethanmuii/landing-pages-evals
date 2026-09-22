import { describe, expect, it } from 'vitest';
import { relativePagePath } from '../../src/eval/page-path.js';

describe('rebasing a finding path onto the corpus root', () => {
  it('strips the directory the CLI walked to reach the page', () => {
    expect(relativePagePath('src/fixtures/corpus/pages/content-01.html', 'src/fixtures/corpus/pages'))
      .toBe('content-01.html');
  });

  it('tolerates a trailing separator on the root', () => {
    expect(relativePagePath('src/fixtures/corpus/pages/content-01.html', 'src/fixtures/corpus/pages/'))
      .toBe('content-01.html');
  });

  it('keeps nested pages addressable below the root', () => {
    expect(relativePagePath('corpus/pages/nested/content-01.html', 'corpus/pages'))
      .toBe('nested/content-01.html');
  });

  it('leaves the path alone when no root is given', () => {
    expect(relativePagePath('src/fixtures/corpus/pages/content-01.html'))
      .toBe('src/fixtures/corpus/pages/content-01.html');
  });

  it('leaves a path outside the root alone rather than emitting ../ segments', () => {
    expect(relativePagePath('other/place/content-01.html', 'src/fixtures/corpus/pages'))
      .toBe('other/place/content-01.html');
  });

  it('leaves the path alone when the root is the page itself', () => {
    expect(relativePagePath('pages/content-01.html', 'pages/content-01.html'))
      .toBe('pages/content-01.html');
  });
});
