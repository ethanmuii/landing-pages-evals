import { readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { withRenderSession } from '../browser/session.js';
import { loadContract } from '../contracts/load.js';
import type { Finding } from '../findings/finding.js';
import { reviewLines } from '../output/review.js';
import { serializeFindings } from '../output/serialize.js';
import { summaryTable } from '../output/table.js';
import { loadPage } from '../pages/load.js';
import { validatePage } from '../validation/validate-page.js';

export interface CliStreams {
  out: (text: string) => void;
  err: (text: string) => void;
}

export interface CliOptions {
  contract: string;
  pages: string;
  findings: string;
}

const FLAGS = ['--contract', '--pages', '--findings'] as const;

export function parseCliArgs(args: readonly string[]): CliOptions {
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (flag === undefined || !FLAGS.some((allowed) => allowed === flag)
      || value === undefined || value.startsWith('--')) {
      throw new Error('Usage: --contract <file> --pages <file-or-directory> --findings <file>');
    }
    if (options.has(flag)) {
      throw new Error(`Repeated argument: ${flag}`);
    }
    options.set(flag, value);
  }
  for (const flag of FLAGS) {
    if (!options.has(flag) || options.get(flag)?.trim() === '') {
      throw new Error(`Missing required argument: ${flag}`);
    }
  }
  return {
    contract: options.get('--contract')!,
    pages: options.get('--pages')!,
    findings: options.get('--findings')!,
  };
}

async function listPages(path: string): Promise<string[]> {
  const info = await stat(path);
  if (info.isFile()) {
    return [path];
  }
  if (!info.isDirectory()) {
    throw new Error(`Pages input is neither a file nor a directory: ${path}`);
  }
  const entries = await readdir(path, { withFileTypes: true });
  const pages = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => join(path, entry.name))
    .sort();
  if (pages.length === 0) {
    throw new Error(`Pages directory contains no HTML files: ${path}`);
  }
  return pages;
}

export async function runCli(args: readonly string[], streams: CliStreams): Promise<number> {
  try {
    const options = parseCliArgs(args);
    const contract = await loadContract(options.contract);
    const pagePaths = await listPages(options.pages);
    const findings = await withRenderSession(async (session) => {
      const collected: Finding[] = [];
      for (const pagePath of pagePaths) {
        const html = await loadPage(pagePath);
        collected.push(...await validatePage(session, contract, pagePath, html));
      }
      return collected;
    });

    await writeFile(options.findings, serializeFindings(findings, contract.locks.map((lock) => lock.lockId)));
    for (const line of reviewLines(findings)) {
      streams.out(`${line}\n`);
    }
    streams.out(`${summaryTable(findings)}\n`);

    if (findings.some((finding) => finding.verdict === 'fail')) {
      return 1;
    }
    return findings.some((finding) => finding.verdict === 'needs_review') ? 2 : 0;
  } catch (error) {
    streams.err(`${error instanceof Error ? error.message : String(error)}\n`);
    return 3;
  }
}
