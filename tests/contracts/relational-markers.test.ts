import { describe, expect, it } from 'vitest';
import { relationalMarkersSchema } from '../../src/contracts/relational-markers.js';

describe('shallow relational marker contract', () => {
  it.each([
    { parentTag: 'main', previousSiblingTag: 'section', nextSiblingTag: 'aside' },
    { parentTag: 'main', previousSiblingTag: null, nextSiblingTag: 'section' },
    { parentTag: 'body', previousSiblingTag: 'main', nextSiblingTag: null },
    { parentTag: 'body', previousSiblingTag: null, nextSiblingTag: null },
    { parentTag: 'main', previousSiblingTag: 'section', nextSiblingTag: 'section' },
  ])('accepts explicit tags and absent-neighbour markers: %j', (markers) => {
    expect(relationalMarkersSchema.parse(markers)).toEqual(markers);
  });

  it.each(['parentTag', 'previousSiblingTag', 'nextSiblingTag'])(
    'requires an explicit %s field',
    (field) => {
      const markers: Record<string, unknown> = {
        parentTag: 'main', previousSiblingTag: null, nextSiblingTag: null,
      };
      delete markers[field];
      expect(relationalMarkersSchema.safeParse(markers).success).toBe(false);
    },
  );

  it.each([
    { parentTag: null }, { previousSiblingTag: 0 }, { nextSiblingTag: false },
    { previousSiblingTag: ['section'] }, { previousSiblingId: 'testimonials' },
  ])('rejects unsupported marker values or extra fields: %j', (change) => {
    expect(relationalMarkersSchema.safeParse({
      parentTag: 'main', previousSiblingTag: null, nextSiblingTag: null, ...change,
    }).success).toBe(false);
  });
});
