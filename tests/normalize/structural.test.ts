import type { Element } from 'domhandler';
import { describe, expect, it } from 'vitest';
import type { StructuralJudgeInput } from '../../src/judge/request.js';
import { locateLock, parsePage } from '../../src/locks/locate.js';
import { canonicalize } from '../../src/normalize/canonical.js';
import {
  baselineSubtreeRoot,
  compareStructure,
  type StructuralComparison,
} from '../../src/normalize/structural.js';

function compare(baselineHtml: string, generatedHtml: string): StructuralComparison {
  return compareStructure(baselineSubtreeRoot(baselineHtml), baselineSubtreeRoot(generatedHtml));
}

function expectAmbiguous(
  comparison: StructuralComparison,
): Extract<StructuralComparison, { status: 'ambiguous' }> {
  if (comparison.status !== 'ambiguous') {
    throw new Error(`Expected an ambiguous comparison, got ${comparison.status}`);
  }
  return comparison;
}

function lockElement(pageHtml: string, lockId: string): Element {
  const location = locateLock(parsePage(pageHtml), lockId);
  if (location.outcome !== 'found') {
    throw new Error(`Expected to find ${lockId}, got ${location.outcome}`);
  }
  return location.element;
}

describe('baselineSubtreeRoot', () => {
  it('returns the single root element', () => {
    const root = baselineSubtreeRoot('<footer data-locked="f">x</footer>');
    expect(root.name).toBe('footer');
    expect(root.attribs['data-locked']).toBe('f');
  });

  it('ignores whitespace and newlines around the element', () => {
    const root = baselineSubtreeRoot('\n  <footer data-locked="f">x</footer>\n  ');
    expect(root.name).toBe('footer');
  });

  it('ignores a leading comment', () => {
    const root = baselineSubtreeRoot('<!-- generated -->\n<footer data-locked="f">x</footer>');
    expect(root.name).toBe('footer');
  });

  it('returns only the root of a deep fragment', () => {
    const root = baselineSubtreeRoot(
      '<footer data-locked="f"><div><p>a</p><ul><li>b</li><li>c</li></ul></div></footer>',
    );
    expect(root.name).toBe('footer');
    expect(canonicalize(root)).toBe(
      '<footer><div><p>a</p><ul><li>b</li><li>c</li></ul></div></footer>',
    );
  });

  it('throws when two top-level elements are present', () => {
    expect(() => baselineSubtreeRoot('<footer>a</footer><footer>b</footer>'))
      .toThrow(/found 2/);
  });

  it('throws on an empty fragment', () => {
    expect(() => baselineSubtreeRoot('')).toThrow(/found 0/);
  });

  it('throws on a fragment that is only a comment', () => {
    expect(() => baselineSubtreeRoot('<!-- nothing here -->')).toThrow(/found 0/);
  });
});

describe('compareStructure routes churn to identical', () => {
  it('reports identical markup as identical', () => {
    expect(compare('<p>x</p>', '<p>x</p>')).toEqual({ status: 'identical' });
  });

  it('ignores attribute order', () => {
    expect(compare('<p id="a" title="b">x</p>', '<p title="b" id="a">x</p>'))
      .toEqual({ status: 'identical' });
  });

  it('ignores class names, data-* values, inline styles, comments and indentation', () => {
    const baseline = '<footer data-locked="f"><div><p>&copy; 2026 Acme, Inc.</p></div></footer>';
    const generated = [
      '<footer data-locked="f" class="css-1q2w3e" style="padding:0">',
      '  <!-- footer start -->',
      '  <div class="css-row" data-v-9z8y7x="">',
      '    <p class="css-abc">&copy; 2026 Acme,&nbsp;Inc.</p>',
      '  </div>',
      '</footer>',
    ].join('\n');
    expect(compare(baseline, generated)).toEqual({ status: 'identical' });
  });
});

describe('compareStructure routes real differences to ambiguous', () => {
  it('flags changed text', () => {
    expect(compare('<p>Privacy</p>', '<p>Terms</p>').status).toBe('ambiguous');
  });

  it('flags a changed tag', () => {
    expect(compare('<div><p>x</p></div>', '<div><span>x</span></div>').status).toBe('ambiguous');
  });

  it('flags an added wrapper', () => {
    expect(compare('<div><p>x</p></div>', '<div><section><p>x</p></section></div>').status)
      .toBe('ambiguous');
  });

  it('flags reordered children', () => {
    expect(compare('<ul><li>a</li><li>b</li></ul>', '<ul><li>b</li><li>a</li></ul>').status)
      .toBe('ambiguous');
  });

  it('carries the raw markup, not the canonical form', () => {
    const baseline = '<footer class="css-base" data-locked="f"><p>Privacy</p></footer>';
    const generated = '<footer class="css-gen" data-locked="f"><p>Terms</p></footer>';
    const result = expectAmbiguous(compare(baseline, generated));

    expect(result.baselineHtml).toContain('css-base');
    expect(result.baselineHtml).toContain('data-locked="f"');
    expect(result.generatedHtml).toContain('css-gen');

    expect(result.baselineHtml).not.toBe(canonicalize(baselineSubtreeRoot(baseline)));
    expect(result.generatedHtml).not.toBe(canonicalize(baselineSubtreeRoot(generated)));
  });

  it('produces a result usable as StructuralJudgeInput', () => {
    function acceptInput(input: StructuralJudgeInput): number {
      return input.baselineHtml.length + input.generatedHtml.length;
    }
    const result = expectAmbiguous(compare('<p>a</p>', '<p>b</p>'));
    expect(acceptInput(result)).toBeGreaterThan(0);
  });
});

describe('a baseline fragment compared against a located lock', () => {
  const baselineFragment = '<footer data-locked="site-footer"><div>'
    + '<p>&copy; 2026 Acme, Inc.</p>'
    + '<ul><li><a href="/privacy">Privacy</a></li><li><a href="/terms">Terms</a></li></ul>'
    + '</div></footer>';

  function page(footer: string): string {
    return `<html><body><main><h1>Hi</h1></main>\n${footer}\n</body></html>`;
  }

  it('is identical when the generated page differs only by churn', () => {
    const generated = page([
      '<footer data-locked="site-footer" class="css-1q2w3e" _ngcontent-abc="">',
      '  <!-- footer -->',
      '  <div class="css-row" style="gap:8px">',
      '    <p class="css-abc">&copy; 2026 Acme,&nbsp;Inc.</p>',
      '    <ul class="css-def">',
      '      <li><a class="css-l1" href="/privacy">Privacy</a></li>',
      '      <li><a class="css-l2" href="/terms">Terms</a></li>',
      '    </ul>',
      '  </div>',
      '</footer>',
    ].join('\n'));

    const comparison = compareStructure(
      baselineSubtreeRoot(baselineFragment),
      lockElement(generated, 'site-footer'),
    );
    expect(comparison).toEqual({ status: 'identical' });
  });

  it('is ambiguous when the generated page drops a link', () => {
    const generated = page(
      '<footer data-locked="site-footer" class="css-1q2w3e"><div>'
      + '<p class="css-abc">&copy; 2026 Acme, Inc.</p>'
      + '<ul><li><a href="/privacy">Privacy</a></li></ul>'
      + '</div></footer>',
    );

    const result = expectAmbiguous(compareStructure(
      baselineSubtreeRoot(baselineFragment),
      lockElement(generated, 'site-footer'),
    ));
    expect(result.baselineHtml).toContain('/terms');
    expect(result.generatedHtml).not.toContain('/terms');
    expect(result.generatedHtml).toContain('css-1q2w3e');
  });
});
