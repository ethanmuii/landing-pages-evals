import { describe, expect, it } from 'vitest';
import { computedStylesSchema } from '../../src/contracts/computed-styles.js';
import { createBaseline } from '../fixtures/baseline.js';

describe('explicit computed style contract', () => {
  it('preserves the independently specified side and corner values', () => {
    const styles = createBaseline().computedStyles;
    expect(computedStylesSchema.parse(styles)).toEqual(styles);
  });

  it.each(Object.keys(createBaseline().computedStyles))('requires the individual %s value', (property) => {
    const incomplete: Record<string, unknown> = { ...createBaseline().computedStyles };
    delete incomplete[property];
    expect(computedStylesSchema.safeParse(incomplete).success).toBe(false);
  });

  it.each(['padding', 'margin', 'border-color', 'border-width', 'border-radius', 'display', 'flex-direction', 'unknown'])(
    'rejects shorthand, excluded, or unknown property %s', (property) => {
      expect(computedStylesSchema.safeParse({ ...createBaseline().computedStyles, [property]: '0px' }).success).toBe(false);
    },
  );

  it('requires strings without coercing CSS values', () => {
    expect(computedStylesSchema.safeParse({ ...createBaseline().computedStyles, 'font-weight': 400 }).success).toBe(false);
  });
});
