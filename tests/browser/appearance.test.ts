import { describe, expect, it } from 'vitest';
import { appearanceFinding, GEOMETRY_TOLERANCE_PX } from '../../src/browser/appearance.js';
import type { LockMeasurement } from '../../src/browser/extract.js';
import { baselineSchema, type Baseline } from '../../src/contracts/baseline.js';
import { findingSchema } from '../../src/findings/finding.js';
import { createBaseline } from '../fixtures/baseline.js';

const pagePath = 'fixtures/page.html';
const domPath = 'main > footer';

const baseline: Baseline = baselineSchema.parse(createBaseline());

function measurement(
  styles: Record<string, string> = {},
  width: number | null = baseline.width,
  height: number | null = baseline.height,
): LockMeasurement {
  return {
    visibleText: 'Locked copy that nobody compares here',
    computedStyles: { ...baseline.computedStyles, ...styles },
    width,
    height,
  };
}

function measurementWithout(property: string): LockMeasurement {
  const measured = measurement();
  delete measured.computedStyles[property];
  return measured;
}

function finding(measured: LockMeasurement) {
  return appearanceFinding('footer', pagePath, domPath, baseline, measured);
}

const passReason = 'Appearance check passed: styles and dimensions match the baseline.';
const noBoxReason = 'Appearance check failed: lock has no rendered box.';

describe('an unchanged lock', () => {
  it('builds the exact passing appearance finding', () => {
    expect(finding(measurement())).toEqual({
      lockId: 'footer',
      rule: 'appearance',
      pagePath,
      domPath,
      verdict: 'pass',
      confidence: null,
      checker: 'playwright_appearance_proxy',
      reason: passReason,
    });
  });

  it('ignores a completely rewritten visible text', () => {
    const measured = { ...measurement(), visibleText: 'Something else entirely' };
    expect(finding(measured).verdict).toBe('pass');
  });
});

describe('a single differing style', () => {
  it.each([
    ['color', 'rgb(0, 0, 0)', 'Appearance check failed: color changed from rgb(255, 255, 255) to rgb(0, 0, 0).'],
    ['font-size', '18px', 'Appearance check failed: font-size changed from 16px to 18px.'],
    [
      'border-bottom-left-radius',
      '0px',
      'Appearance check failed: border-bottom-left-radius changed from 16px to 0px.',
    ],
  ])('names only %s', (property, value, reason) => {
    const result = finding(measurement({ [property]: value }));
    expect(result.verdict).toBe('fail');
    expect(result.reason).toBe(reason);
  });
});

describe('several differing styles', () => {
  it('lists three clauses in contract property order', () => {
    const result = finding(measurement({
      'margin-top': '4px',
      'font-size': '18px',
      color: 'rgb(0, 0, 0)',
    }));
    expect(result.reason).toBe(
      'Appearance check failed: color changed from rgb(255, 255, 255) to rgb(0, 0, 0); '
      + 'font-size changed from 16px to 18px; margin-top changed from 0px to 4px.',
    );
  });

  it('reports a property missing from the measurement as an empty string', () => {
    const result = finding(measurementWithout('font-family'));
    expect(result.verdict).toBe('fail');
    expect(result.reason).toBe('Appearance check failed: font-family changed from Arial, sans-serif to .');
  });
});

describe('geometry tolerance', () => {
  it('tolerates exactly one pixel', () => {
    expect(GEOMETRY_TOLERANCE_PX).toBe(1);
  });

  it.each([
    ['width', baseline.width + 1],
    ['width', baseline.width - 1],
    ['height', baseline.height + 1],
    ['height', baseline.height - 1],
  ])('passes when %s drifts by exactly one pixel (%#)', (axis, value) => {
    const measured = axis === 'width' ? measurement({}, value) : measurement({}, baseline.width, value);
    expect(finding(measured).verdict).toBe('pass');
    expect(finding(measured).reason).toBe(passReason);
  });

  it.each([
    [baseline.width + 1.5, 'Appearance check failed: width changed from 1280 to 1281.5.'],
    [baseline.width + 2, 'Appearance check failed: width changed from 1280 to 1282.'],
    [baseline.width - 1.5, 'Appearance check failed: width changed from 1280 to 1278.5.'],
    [baseline.width - 2, 'Appearance check failed: width changed from 1280 to 1278.'],
  ])('fails on a width drift past the tolerance (%#)', (width, reason) => {
    const result = finding(measurement({}, width));
    expect(result.verdict).toBe('fail');
    expect(result.reason).toBe(reason);
  });

  it.each([
    [baseline.height + 1.5, 'Appearance check failed: height changed from 160.5 to 162.'],
    [baseline.height + 2, 'Appearance check failed: height changed from 160.5 to 162.5.'],
    [baseline.height - 1.5, 'Appearance check failed: height changed from 160.5 to 159.'],
    [baseline.height - 2, 'Appearance check failed: height changed from 160.5 to 158.5.'],
  ])('fails on a height drift past the tolerance (%#)', (height, reason) => {
    const result = finding(measurement({}, baseline.width, height));
    expect(result.verdict).toBe('fail');
    expect(result.reason).toBe(reason);
  });
});

describe('clause ordering across kinds', () => {
  it('puts width before height', () => {
    const result = finding(measurement({}, baseline.width + 10, baseline.height + 10));
    expect(result.reason).toBe(
      'Appearance check failed: width changed from 1280 to 1290; height changed from 160.5 to 170.5.',
    );
  });

  it('puts a style clause before a height clause', () => {
    const result = finding(measurement({ color: 'rgb(0, 0, 0)' }, baseline.width, baseline.height + 10));
    expect(result.reason).toBe(
      'Appearance check failed: color changed from rgb(255, 255, 255) to rgb(0, 0, 0); '
      + 'height changed from 160.5 to 170.5.',
    );
  });
});

describe('no rendered box', () => {
  it.each([
    ['a null width', measurement({}, null)],
    ['a null height', measurement({}, baseline.width, null)],
    ['both null', measurement({}, null, null)],
  ])('short-circuits on %s', (_label, measured) => {
    const result = finding(measured);
    expect(result.verdict).toBe('fail');
    expect(result.reason).toBe(noBoxReason);
  });

  it('suppresses style clauses even when styles also differ', () => {
    const result = finding(measurement({ color: 'rgb(0, 0, 0)', 'font-size': '18px' }, null, null));
    expect(result.reason).toBe(noBoxReason);
    expect(result.reason).not.toContain('color');
  });
});

describe('identity pass-through', () => {
  it.each([
    ['footer', 'fixtures/page.html', 'main > footer'],
    ['hero cta', 'fixtures/landing page.html', 'main > div:nth-child(2) > a'],
    ['say "hi"', 'fixtures/"quoted".html', 'main > [data-locked="say \\"hi\\""]'],
  ])('copies lockId, pagePath and domPath verbatim (%#)', (lockId, page, dom) => {
    const result = appearanceFinding(lockId, page, dom, baseline, measurement({ color: 'rgb(0, 0, 0)' }));
    expect(result.lockId).toBe(lockId);
    expect(result.pagePath).toBe(page);
    expect(result.domPath).toBe(dom);
  });
});

describe('schema enforcement', () => {
  it.each(['', '   '])('rejects a blank domPath (%j)', (blank) => {
    expect(() => appearanceFinding('footer', pagePath, blank, baseline, measurement())).toThrow();
  });

  it.each(['', '   '])('rejects a blank pagePath (%j)', (blank) => {
    expect(() => appearanceFinding('footer', blank, domPath, baseline, measurement())).toThrow();
  });

  it.each([
    ['a match', measurement()],
    ['a style difference', measurement({ color: 'rgb(0, 0, 0)' })],
    ['a geometry difference', measurement({}, baseline.width + 5)],
    ['no rendered box', measurement({}, null, null)],
  ])('returns a schema-valid finding for %s', (_label, measured) => {
    expect(findingSchema.safeParse(finding(measured)).success).toBe(true);
  });
});
