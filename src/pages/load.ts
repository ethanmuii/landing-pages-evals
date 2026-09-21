import { readFile } from 'node:fs/promises';

export async function loadPage(pagePath: string): Promise<string> {
  return readFile(pagePath, 'utf8');
}
