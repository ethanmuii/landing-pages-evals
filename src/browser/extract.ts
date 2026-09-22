import type { Page } from 'playwright';
import { computedStyleProperties } from '../contracts/computed-styles.js';
import { LOCK_ATTRIBUTE } from '../locks/locate.js';

export interface LockMeasurement {
  visibleText: string;
  computedStyles: Record<string, string>;
  width: number | null;
  height: number | null;
}

export async function measureLock(page: Page, lockId: string): Promise<LockMeasurement> {
  const measurement = await page.evaluate(
    ({ attribute, id, properties }) => {
      const matches = Array.from(document.querySelectorAll<HTMLElement>(`[${attribute}]`))
        .filter((candidate) => candidate.getAttribute(attribute) === id);
      const [element] = matches;
      if (element === undefined || matches.length > 1) {
        throw new Error(
          `Expected exactly one element carrying ${attribute}="${id}", found ${matches.length}.`,
        );
      }

      const styles = window.getComputedStyle(element);
      const computedStyles: Record<string, string> = {};
      for (const property of properties) {
        computedStyles[property] = styles.getPropertyValue(property);
      }

      // An element inside a display:none subtree still reports a rect of zeroes,
      // so a zero-size test cannot tell it apart from an empty element that does
      // render; an empty getClientRects() means no box was generated at all.
      const rect = element.getBoundingClientRect();
      const rendered = element.getClientRects().length > 0;

      return {
        innerText: element.innerText,
        computedStyles,
        width: rendered ? rect.width : null,
        height: rendered ? rect.height : null,
      };
    },
    { attribute: LOCK_ATTRIBUTE, id: lockId, properties: [...computedStyleProperties] },
  );

  const { innerText, ...rest } = measurement;
  return { visibleText: normalizeVisibleText(innerText), ...rest };
}

function normalizeVisibleText(text: string): string {
  // innerText already collapses whitespace its own way; collapsing again here
  // makes the compared value ours rather than the rendering engine's, and folds
  // non-breaking spaces and other Unicode separators in with ordinary runs.
  return text.replace(/\s+/gu, ' ').trim();
}
