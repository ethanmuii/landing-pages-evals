import { describe, expect, it } from 'vitest';
import { domPathSchema, lockIdSchema, pagePathSchema } from '../../src/findings/identity.js';

describe.each([
  ['lockId', lockIdSchema],
  ['pagePath', pagePathSchema],
  ['domPath', domPathSchema],
] as const)('%s contract', (_name, schema) => {
  it.each(['footer-legal', 'NOT_FOUND', 'docs/page.html', 'html > body > footer', '  Exact Value  ', '页脚', 'line\nbreak'])(
    'preserves nonblank input exactly: %j',
    (value) => {
      expect(schema.parse(value)).toBe(value);
    },
  );

  it.each(['', ' ', '\t\r\n', '\u00a0', null, undefined, 123, true, {}, []])(
    'rejects blank or non-string input: %j',
    (value) => {
      expect(schema.safeParse(value).success).toBe(false);
    },
  );
});
