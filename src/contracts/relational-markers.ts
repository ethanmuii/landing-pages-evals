import { z } from 'zod';

/** Tag-only markers cannot distinguish neighbours with the same element tag. */
export const relationalMarkersSchema = z.strictObject({
  parentTag: z.string(),
  previousSiblingTag: z.string().nullable(),
  nextSiblingTag: z.string().nullable(),
});

export type RelationalMarkers = z.infer<typeof relationalMarkersSchema>;
