import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { withRenderSession } from '../../src/browser/session.js';
import { loadContract } from '../../src/contracts/load.js';
import { validatePage } from '../../src/validation/validate-page.js';
import { CLEAN_PAGE_PATH, CORPUS_LOCK_ID, CORPUS_PAGES_DIRECTORY, MUTATIONS } from './build-corpus.js';

// Freeze the inputs for this demo session: the preview and validator use the
// same bytes even if a corpus rebuild happens while the viewer is open.
const original = await readFile(CLEAN_PAGE_PATH, 'utf8');
const contract = await loadContract('src/fixtures/inputs/baseline-contract.json');
const pages = new Map<string, string>();
for (const mutation of MUTATIONS) {
  pages.set(mutation.pageName, await readFile(join(CORPUS_PAGES_DIRECTORY, mutation.pageName), 'utf8'));
}
const cases = MUTATIONS.map(({ pageName, summary, rule }) => ({ pageName, summary, rule }));
let validating = false;
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const name = url.searchParams.get('page') ?? '';
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  const send = (status: number, body: string, type = 'application/json') => {
    response.writeHead(status, { 'Content-Type': `${type}; charset=utf-8` });
    response.end(body);
  };
  try {
    if (request.method === 'GET' && url.pathname === '/') {
      send(200, await readFile('fixtures/demo/index.html', 'utf8'), 'text/html');
    } else if (request.method === 'GET' && url.pathname === '/cases') {
      send(200, JSON.stringify({ lockId: CORPUS_LOCK_ID, cases }));
    } else if (request.method === 'GET' && url.pathname === '/preview' && (name === 'original' || pages.has(name))) {
      response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-same-origin");
      send(200, name === 'original' ? original : pages.get(name)!, 'text/html');
    } else if (request.method === 'POST' && url.pathname === '/validate' && pages.has(name)) {
      if (validating) { send(409, JSON.stringify({ error: 'A validation is already running. Please try again.' })); return; }
      validating = true;
      try {
        const findings = await withRenderSession((session) =>
          validatePage(session, contract, join(CORPUS_PAGES_DIRECTORY, name), pages.get(name)!));
        send(200, JSON.stringify({ findings }));
      } finally { validating = false; }
    } else { send(404, JSON.stringify({ error: 'Not found' })); }
  } catch (error) {
    send(500, JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  }
});
server.listen(4173, '127.0.0.1', () => {
  process.stdout.write('Corpus demo: http://127.0.0.1:4173 (Ctrl+C to stop). Restart after rebuilding inputs.\n');
});
