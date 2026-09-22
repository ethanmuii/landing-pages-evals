import type { Page } from 'playwright';
import { afterAll, describe, expect, it } from 'vitest';
import { measureLock, type LockMeasurement } from '../../src/browser/extract.js';
import { renderHtml } from '../../src/browser/session.js';
import { computedStyleProperties } from '../../src/contracts/computed-styles.js';
import { openSharedSession } from './shared-session.js';

const BROWSER_TEST_TIMEOUT_MS = 30_000;

const shared = await openSharedSession();
const openPages: Page[] = [];

afterAll(async () => {
  await Promise.all(openPages.map((page) => page.close()));
  await shared.close();
});

async function measure(html: string, lockId: string): Promise<LockMeasurement> {
  const page = await renderHtml(shared.session, html);
  openPages.push(page);
  return measureLock(page, lockId);
}

describe('a simple lock', () => {
  const html = '<main><h1 data-locked="headline">Ship it today</h1></main>';

  it('returns its visible text', async () => {
    const measurement = await measure(html, 'headline');
    expect(measurement.visibleText).toBe('Ship it today');
  }, BROWSER_TEST_TIMEOUT_MS);

  it('returns exactly the contract computed styles', async () => {
    const measurement = await measure(html, 'headline');
    expect(Object.keys(measurement.computedStyles).sort()).toEqual([...computedStyleProperties].sort());
  }, BROWSER_TEST_TIMEOUT_MS);

  it('returns non-empty values for every computed style', async () => {
    const measurement = await measure(html, 'headline');
    expect(Object.values(measurement.computedStyles).filter((value) => value === '')).toEqual([]);
  }, BROWSER_TEST_TIMEOUT_MS);

  it('returns a plausible rendered box', async () => {
    const measurement = await measure(html, 'headline');
    expect(typeof measurement.width).toBe('number');
    expect(typeof measurement.height).toBe('number');
    expect(measurement.width).toBeGreaterThan(0);
    expect(measurement.height).toBeGreaterThan(0);
  }, BROWSER_TEST_TIMEOUT_MS);
});

describe('explicit style values', () => {
  it('round-trips the serialized colour and padding it was given', async () => {
    const measurement = await measure(
      '<p data-locked="cta" style="color: rgb(1, 2, 3); padding-top: 8px">Buy</p>',
      'cta',
    );
    expect(measurement.computedStyles['color']).toBe('rgb(1, 2, 3)');
    expect(measurement.computedStyles['padding-top']).toBe('8px');
  }, BROWSER_TEST_TIMEOUT_MS);
});

describe('visible text', () => {
  it('collapses spaces, newlines, tabs and non-breaking spaces to single spaces', async () => {
    const html = '<p data-locked="copy">  Save\n\n   up\tto\t\t50%&nbsp;&nbsp;today  </p>';
    const measurement = await measure(html, 'copy');
    expect(measurement.visibleText).toBe('Save up to 50% today');
  }, BROWSER_TEST_TIMEOUT_MS);

  it('excludes a display:none descendant', async () => {
    const html = '<p data-locked="copy">Visible <span style="display: none">SECRET</span> tail</p>';
    const measurement = await measure(html, 'copy');
    expect(measurement.visibleText).toBe('Visible tail');
    expect(measurement.visibleText).not.toContain('SECRET');
  }, BROWSER_TEST_TIMEOUT_MS);

  it('excludes a visibility:hidden descendant', async () => {
    const html = '<p data-locked="copy">Visible <span style="visibility: hidden">SECRET</span> tail</p>';
    const measurement = await measure(html, 'copy');
    expect(measurement.visibleText).toBe('Visible tail');
    expect(measurement.visibleText).not.toContain('SECRET');
  }, BROWSER_TEST_TIMEOUT_MS);
});

describe('a lock with no rendered box', () => {
  it('returns null width and height under a display:none ancestor', async () => {
    const html = '<div style="display: none"><p data-locked="hidden">Gone</p></div>';
    const measurement = await measure(html, 'hidden');
    expect(measurement.width).toBeNull();
    expect(measurement.height).toBeNull();
  }, BROWSER_TEST_TIMEOUT_MS);

  it('still returns the contract computed styles', async () => {
    const html = '<div style="display: none"><p data-locked="hidden">Gone</p></div>';
    const measurement = await measure(html, 'hidden');
    expect(Object.keys(measurement.computedStyles).sort()).toEqual([...computedStyleProperties].sort());
  }, BROWSER_TEST_TIMEOUT_MS);
});

describe('awkward lock ids', () => {
  it.each([
    ['say "hi"', '<p data-locked=\'say "hi"\'>Quoted</p><p data-locked="other">Other</p>', 'Quoted'],
    ['items[0]', '<p data-locked=\'items[0]\'>Bracketed</p><p data-locked="other">Other</p>', 'Bracketed'],
  ])('resolves the lock id %j', async (lockId, html, text) => {
    const measurement = await measure(html, lockId);
    expect(measurement.visibleText).toBe(text);
  }, BROWSER_TEST_TIMEOUT_MS);
});

describe('unresolved locks', () => {
  it('throws when nothing matches', async () => {
    const page = await renderHtml(shared.session, '<p data-locked="present">Here</p>');
    openPages.push(page);
    await expect(measureLock(page, 'absent')).rejects.toThrow('found 0');
  }, BROWSER_TEST_TIMEOUT_MS);

  it('throws when two elements match', async () => {
    const html = '<p data-locked="twice">One</p><p data-locked="twice">Two</p>';
    const page = await renderHtml(shared.session, html);
    openPages.push(page);
    await expect(measureLock(page, 'twice')).rejects.toThrow('found 2');
  }, BROWSER_TEST_TIMEOUT_MS);
});

describe('nested locks', () => {
  const html = '<section data-locked="outer">Outer copy <span data-locked="inner">inner copy</span></section>';

  it('measures the inner lock on its own', async () => {
    const measurement = await measure(html, 'inner');
    expect(measurement.visibleText).toBe('inner copy');
    expect(measurement.width).toBeGreaterThan(0);
  }, BROWSER_TEST_TIMEOUT_MS);

  it('measures the outer lock including the inner text', async () => {
    const measurement = await measure(html, 'outer');
    expect(measurement.visibleText).toBe('Outer copy inner copy');
  }, BROWSER_TEST_TIMEOUT_MS);

  it('measures the two locks independently', async () => {
    const page = await renderHtml(shared.session, html);
    openPages.push(page);
    const outer = await measureLock(page, 'outer');
    const inner = await measureLock(page, 'inner');
    expect(outer.width).not.toBe(inner.width);
    expect(outer.visibleText).toContain(inner.visibleText);
  }, BROWSER_TEST_TIMEOUT_MS);
});
