import { z } from 'zod';
import { computedStylesSchema } from './computed-styles.js';
import { relationalMarkersSchema } from './relational-markers.js';

export const baselineSchema = z.strictObject({
  visibleText: z.string(),
  width: z.number(),
  height: z.number(),
  computedStyles: computedStylesSchema,
  ...relationalMarkersSchema.shape,
});

export type Baseline = z.infer<typeof baselineSchema>;
