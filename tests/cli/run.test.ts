import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseCliArgs, runCli } from '../../src/cli/run.js';
import { measureLock } from '../../src/browser/extract.js';
import { withRenderSession, withRenderedPage } from '../../src/browser/session.js';
import { findingSchema } from '../../src/findings/finding.js';

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'lock-cli-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('named CLI arguments', () => {
  it('accepts the three required flags in any order', () => {
    expect(parseCliArgs(['--pages', 'pages', '--findings', 'out.json', '--contract', 'contract.json']))
      .toEqual({ contract: 'contract.json', pages: 'pages', findings: 'out.json' });
  });

  it.each([
    { args: [] }, { args: ['--contract', 'contract.json'] },
    { args: ['--contract', 'contract.json', '--pages', 'pages', '--findings'] },
    { args: ['--contract', 'contract.json', '--pages', 'pages', '--findings', 'out.json', '--unknown', 'x'] },
    { args: ['--contract', 'contract.json', '--pages', 'pages', '--findings', 'out.json', '--pages', 'again'] },
    { args: ['--contract', ' ', '--pages', 'pages', '--findings', 'out.json'] },
  ])('rejects invalid arguments: $args', ({ args }) => {
    expect(() => parseCliArgs(args)).toThrow();
  });
});

describe('operational failures', () => {
  it('returns code 3 and reports a missing contract without writing findings', async () => {
    const out: string[] = [];
    const err: string[] = [];
    const output = join(directory, 'findings.json');
    const code = await runCli([
      '--contract', join(directory, 'missing.json'), '--pages', 'page.html', '--findings', output,
    ], { out: (text) => out.push(text), err: (text) => err.push(text) });
    expect(code).toBe(3);
    expect(out).toEqual([]);
    expect(err.join('')).toContain('missing.json');
    await expect(readFile(output)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('returns code 3 for malformed contract JSON', async () => {
    const contract = join(directory, 'contract.json');
    await writeFile(contract, '{not-json');
    const errors: string[] = [];
    const code = await runCli([
      '--contract', contract, '--pages', 'page.html', '--findings', join(directory, 'out.json'),
    ], { out: () => {}, err: (text) => errors.push(text) });
    expect(code).toBe(3);
    expect(errors.join('')).toMatch(/JSON|property/i);
  });
});

describe('CLI integration', () => {
  it('writes schema-valid JSON separately from stdout and returns the worst verdict code', async () => {
    const clean = '<footer data-locked="footer">Legal</footer>';
    const changed = '<footer data-locked="footer">Revised</footer>';
    const measurement = await withRenderSession(async (session) =>
      withRenderedPage(session, clean, (page) => measureLock(page, 'footer')));
    const contract = join(directory, 'contract.json');
    const pages = join(directory, 'pages');
    const findingsPath = join(directory, 'findings.json');
    await mkdir(pages);
    await writeFile(contract, JSON.stringify([{
      lockId: 'footer', baselinePath: 'footer.html',
      policy: { content: true, appearance: true, position: true },
      baseline: {
        ...measurement, parentTag: 'body', previousSiblingTag: null, nextSiblingTag: null,
      },
    }]));
    await writeFile(join(directory, 'footer.html'), clean);
    await writeFile(join(pages, 'b.html'), changed);
    await writeFile(join(pages, 'a.html'), clean);
    const output: string[] = [];
    const errors: string[] = [];
    const streams = { out: (text: string) => output.push(text), err: (text: string) => errors.push(text) };

    const status = await runCli([
      '--contract', contract, '--pages', pages, '--findings', findingsPath,
    ], streams);
    expect(status).toBe(1);
    expect(errors).toEqual([]);
    const findings = JSON.parse(await readFile(findingsPath, 'utf8')) as unknown[];
    expect(findings).toHaveLength(6);
    expect(findings.every((finding) => findingSchema.safeParse(finding).success)).toBe(true);
    expect(findings.map((finding) => findingSchema.parse(finding).pagePath)).toEqual([
      join(pages, 'a.html'), join(pages, 'a.html'), join(pages, 'a.html'),
      join(pages, 'b.html'), join(pages, 'b.html'), join(pages, 'b.html'),
    ]);
    expect(findings.map((finding) => findingSchema.parse(finding).verdict)).toEqual([
      'pass', 'pass', 'pass', 'fail', 'pass', 'pass',
    ]);
    expect(output.join('')).toContain('6 findings: 5 pass, 1 fail, 0 review');
    expect(output.join('')).not.toContain('"lockId"');

    const cleanStatus = await runCli([
      '--contract', contract, '--pages', join(pages, 'a.html'), '--findings', findingsPath,
    ], streams);
    expect(cleanStatus).toBe(0);
  });
});
