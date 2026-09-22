import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function sourceFilesIn(directory: string): { path: string; source: string }[] {
  const root = fileURLToPath(new URL(`../../src/${directory}/`, import.meta.url));
  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.ts'))
    .map((entry) => ({ path: `src/${directory}/${entry}`, source: readFileSync(join(root, entry), 'utf8') }));
}

describe('the validator cannot see the labels', () => {
  it.each(['validation', 'cli'])('finds no reference to the eval directory in src/%s', (directory) => {
    const files = sourceFilesIn(directory);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      expect(file.source, file.path).not.toContain('src/eval');
      expect(file.source, file.path).not.toContain('/eval/');
    }
  });

  it('finds no reference to the validator in src/eval', () => {
    const files = sourceFilesIn('eval');
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      expect(file.source, file.path).not.toContain('../validation/');
      expect(file.source, file.path).not.toContain('../cli/');
    }
  });
});
