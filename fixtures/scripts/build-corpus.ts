import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { domPathOf } from '../../src/locks/dom-path.js';
import { locateLock, parsePage } from '../../src/locks/locate.js';

export const CORPUS_LOCK_ID = 'modal-footer';
export const CLEAN_PAGE_PATH = 'src/fixtures/inputs/clean-page.html';
export const CORPUS_PAGES_DIRECTORY = 'src/fixtures/corpus/pages';
export const CORPUS_LABELS_PATH = 'src/fixtures/corpus/labels.json';

export type ViolatedRule = 'content' | 'appearance' | 'position';

export interface CorpusLabel {
  pagePath: string;
  lockId: string;
  rule: ViolatedRule;
  domPath: string;
}

// A target given as a function is derived from the page being edited, for spans
// too large to spell out; the uniqueness guard applies to it either way.
type EditTarget = string | ((html: string) => string);

interface Edit {
  find: EditTarget;
  replace: string;
}

export interface Mutation {
  pageName: string;
  rule: ViolatedRule | null;
  summary: string;
  edits: readonly Edit[];
}

const FOOTER_OPEN = '<footer class="relative " data-locked="modal-footer">';
const FOOTER_CLOSE = '</footer>';
const FOOTER_LAST_CHILD_END = '</div><!----></footer>';
const FOOTER_FIRST_CHILD_START = `${FOOTER_OPEN}<div aria-hidden="true"`;
const PRECEDING_SECTION_OPEN = '<section class="marketing-container my-16">';

// Swapping two texts needs a third value no page can contain, so neither half of
// the exchange can collide with the other before it has moved.
const SWAP_SENTINEL = '\u0000corpus-swap\u0000';

const BODY_RULE = '\n    body {\n      background-color: var(--color-black) !important;\n'
  + '      font-weight: 500;\n      letter-spacing: -0.36px;\n'
  + '      color: var(--color-light-green) !important;\n    }\n';

const REFORMATTED_BODY_RULE = '\n/* corpus control 07 */\nbody {\n'
  + '  background-color: var(--color-black) !important;\n  font-weight: 500;\n'
  + '  letter-spacing: -0.36px;\n  color: var(--color-light-green) !important;\n}\n';

function footerWithStyle(declaration: string, styleDescendants = false): Edit {
  return {
    find: FOOTER_OPEN,
    replace: `<footer class="relative " data-locked="modal-footer" style="${declaration}">`
      + (styleDescendants ? `<style>[data-locked="modal-footer"] * { ${declaration} !important; }</style>` : ''),
  };
}

function wrapFooter(openTag: string, closeTag: string): readonly Edit[] {
  return [
    { find: FOOTER_OPEN, replace: `${openTag}${FOOTER_OPEN}` },
    { find: FOOTER_CLOSE, replace: `${FOOTER_CLOSE}${closeTag}` },
  ];
}

function swapTexts(left: string, right: string): readonly Edit[] {
  return [
    { find: left, replace: SWAP_SENTINEL },
    { find: right, replace: left },
    { find: SWAP_SENTINEL, replace: right },
  ];
}

// The section is 70 KB of markup, so it is located rather than quoted: from its
// own opening tag to the last </section> that closes before the lock begins.
function precedingSectionMarkup(html: string): string {
  const footerAt = uniqueIndexOf(html, FOOTER_OPEN);
  const start = uniqueIndexOf(html, PRECEDING_SECTION_OPEN);
  const end = html.lastIndexOf('</section>', footerAt) + '</section>'.length;
  const markup = html.slice(start, end);
  if (start >= footerAt || end <= start || markup.split('<section').length !== 2) {
    throw new Error('The section preceding the lock is not a single self-contained element.');
  }
  return markup;
}

export const MUTATIONS: readonly Mutation[] = [
  {
    pageName: 'content-01.html',
    rule: 'content',
    summary: 'Replaces one visible word: "© Modal 2026" becomes "© Modal 2027".',
    edits: [{ find: '© Modal 2026', replace: '© Modal 2027' }],
  },
  {
    pageName: 'content-02.html',
    rule: 'content',
    summary: 'Deletes one visible word: "Slack Community" becomes "Community".',
    edits: [{ find: '>Slack Community<', replace: '>Community<' }],
  },
  {
    pageName: 'content-03.html',
    rule: 'content',
    summary: 'Appends visible text: "Changelog" becomes "Changelog Updates".',
    edits: [{ find: '>Changelog<', replace: '>Changelog Updates<' }],
  },
  {
    pageName: 'content-04.html',
    rule: 'content',
    summary: 'Duplicates a visible text block: "Careers" becomes "Careers Careers".',
    edits: [{ find: '>Careers<', replace: '>Careers Careers<' }],
  },
  {
    pageName: 'content-05.html',
    rule: 'content',
    summary: 'Swaps two visible text blocks: "About" and "Blog" exchange places.',
    edits: swapTexts('>About<', '>Blog<'),
  },
  {
    pageName: 'appearance-01.html',
    rule: 'appearance',
    summary: 'Changes the footer text colour to bright red.',
    edits: [footerWithStyle('color: rgb(255, 48, 48)', true)],
  },
  {
    pageName: 'appearance-02.html',
    rule: 'appearance',
    summary: 'Changes the footer background to purple.',
    edits: [footerWithStyle('background-color: rgb(100, 30, 170)')],
  },
  {
    pageName: 'appearance-03.html',
    rule: 'appearance',
    summary: 'Sets the footer and its descendant text to 32px.',
    edits: [footerWithStyle('font-size: 32px', true)],
  },
  {
    pageName: 'appearance-04.html',
    rule: 'appearance',
    summary: 'Adds 64px of top padding to the footer.',
    edits: [footerWithStyle('padding-top: 64px')],
  },
  {
    pageName: 'appearance-05.html',
    rule: 'appearance',
    summary: 'Increases the footer minimum height from 489.5px to 689.5px.',
    edits: [footerWithStyle('min-height: 689.5px')],
  },
  {
    pageName: 'position-01.html',
    rule: 'position',
    summary: 'Wraps the lock in a non-transparent <section>, moving the parent anchor off body.',
    edits: wrapFooter('<section>', '</section>'),
  },
  {
    pageName: 'position-02.html',
    rule: 'position',
    summary: 'Inserts <nav> immediately before the lock, replacing the section anchor.',
    edits: [{ find: FOOTER_OPEN, replace: `<nav></nav>${FOOTER_OPEN}` }],
  },
  {
    pageName: 'position-03.html',
    rule: 'position',
    summary: 'Inserts <aside> immediately after the lock, giving it a following anchor.',
    edits: [{ find: FOOTER_CLOSE, replace: `${FOOTER_CLOSE}<aside></aside>` }],
  },
  {
    pageName: 'position-04.html',
    rule: 'position',
    summary: 'Wraps the lock in <div role="group">, which the anchor rules do not see through.',
    edits: wrapFooter('<div role="group">', '</div>'),
  },
  {
    pageName: 'position-05.html',
    rule: 'position',
    summary: 'Removes the preceding <section>, so the previous anchor becomes main.',
    edits: [{ find: precedingSectionMarkup, replace: '' }],
  },
  {
    pageName: 'control-01.html',
    rule: null,
    summary: 'Reorders attributes on the lock root and on a descendant, values unchanged.',
    edits: [
      { find: FOOTER_OPEN, replace: '<footer data-locked="modal-footer" class="relative ">' },
      {
        find: '<div class="relative " style="transform: translateY(0px);">',
        replace: '<div style="transform: translateY(0px);" class="relative ">',
      },
    ],
  },
  {
    pageName: 'control-02.html',
    rule: null,
    summary: 'Inserts HTML comments inside the lock without touching text or elements.',
    edits: [
      { find: FOOTER_OPEN, replace: `${FOOTER_OPEN}<!-- corpus control 02 -->` },
      { find: FOOTER_LAST_CHILD_END, replace: '</div><!----><!-- corpus control 02 --></footer>' },
    ],
  },
  {
    pageName: 'control-03.html',
    rule: null,
    summary: 'Reorders class names within one class attribute inside the lock.',
    edits: [{
      find: 'class="flex flex-col items-center gap-14 lg:flex-row lg:items-end lg:justify-between lg:gap-16"',
      replace: 'class="flex-col items-center gap-14 lg:flex-row lg:items-end lg:justify-between lg:gap-16 flex"',
    }],
  },
  {
    pageName: 'control-04.html',
    rule: null,
    summary: 'Reorders two independent inline declarations inside the lock.',
    edits: [{
      find: 'opacity: 0.5; filter: blur(130px);',
      replace: 'filter: blur(130px); opacity: 0.5;',
    }],
  },
  {
    pageName: 'control-05.html',
    rule: null,
    summary: 'Rewrites the lock root attributes with single quotes, parsed values unchanged.',
    edits: [{ find: FOOTER_OPEN, replace: "<footer class='relative ' data-locked='modal-footer'>" }],
  },
  {
    pageName: 'control-06.html',
    rule: null,
    summary: 'Writes two literal text characters as named and numeric character references.',
    edits: [
      { find: '© Modal 2026', replace: '&copy; Modal 2026' },
      { find: '>Popular Examples<', replace: '>&#80;opular Examples<' },
    ],
  },
  {
    pageName: 'control-07.html',
    rule: null,
    summary: 'Reformats the whitespace of one CSS rule and adds a comment, order and values kept.',
    edits: [{ find: BODY_RULE, replace: REFORMATTED_BODY_RULE }],
  },
  {
    pageName: 'control-08.html',
    rule: null,
    summary: 'Wraps the lock in a transparent <div> carrying no identity attributes.',
    edits: wrapFooter('<div>', '</div>'),
  },
  {
    pageName: 'control-09.html',
    rule: null,
    summary: 'Reindents the block-level boundaries of the lock, where the spacing collapses.',
    edits: [
      { find: FOOTER_FIRST_CHILD_START, replace: `${FOOTER_OPEN}\n      <div aria-hidden="true"` },
      { find: FOOTER_LAST_CHILD_END, replace: '</div><!---->\n    </footer>' },
    ],
  },
  {
    pageName: 'control-10.html',
    rule: null,
    summary: 'Inserts an empty <template> beside the lock, which the anchors skip over.',
    edits: [{ find: FOOTER_OPEN, replace: `<template></template>${FOOTER_OPEN}` }],
  },
];

function uniqueIndexOf(html: string, find: string): number {
  const first = html.indexOf(find);
  if (first === -1 || html.indexOf(find, first + find.length) !== -1) {
    throw new Error(`Corpus edit target is not unique in the page: ${JSON.stringify(find.slice(0, 60))}`);
  }
  return first;
}

function applyEdit(html: string, edit: Edit): string {
  const find = typeof edit.find === 'string' ? edit.find : edit.find(html);
  const at = uniqueIndexOf(html, find);
  return html.slice(0, at) + edit.replace + html.slice(at + find.length);
}

export function buildPage(cleanHtml: string, mutation: Mutation): string {
  const mutated = mutation.edits.reduce(applyEdit, cleanHtml);
  if (mutated === cleanHtml) {
    throw new Error(`Mutation ${mutation.pageName} left the page unchanged.`);
  }
  return mutated;
}

export function lockDomPath(html: string): string {
  const location = locateLock(parsePage(html), CORPUS_LOCK_ID);
  if (location.outcome !== 'found') {
    throw new Error(`Mutated page does not hold exactly one ${CORPUS_LOCK_ID} lock: ${location.outcome}`);
  }
  return domPathOf(location.element);
}

export function labelFor(mutation: Mutation, pageHtml: string): CorpusLabel | null {
  if (mutation.rule === null) {
    return null;
  }
  return {
    pagePath: mutation.pageName,
    lockId: CORPUS_LOCK_ID,
    rule: mutation.rule,
    domPath: lockDomPath(pageHtml),
  };
}

export interface BuiltCorpus {
  pageCount: number;
  labels: CorpusLabel[];
}

export async function buildCorpus(
  cleanPagePath = CLEAN_PAGE_PATH,
  pagesDirectory = CORPUS_PAGES_DIRECTORY,
  labelsPath = CORPUS_LABELS_PATH,
): Promise<BuiltCorpus> {
  const cleanHtml = await readFile(cleanPagePath, 'utf8');
  await mkdir(pagesDirectory, { recursive: true });
  await mkdir(dirname(labelsPath), { recursive: true });

  const labels: CorpusLabel[] = [];
  for (const mutation of MUTATIONS) {
    const pageHtml = buildPage(cleanHtml, mutation);
    await writeFile(join(pagesDirectory, mutation.pageName), pageHtml, 'utf8');
    const label = labelFor(mutation, pageHtml);
    if (label !== null) {
      labels.push(label);
    }
  }

  await writeFile(labelsPath, `${JSON.stringify(labels, null, 2)}\n`, 'utf8');
  return { pageCount: MUTATIONS.length, labels };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { pageCount, labels } = await buildCorpus();
    process.stdout.write(`Wrote ${String(pageCount)} corpus pages to ${CORPUS_PAGES_DIRECTORY} and ${String(labels.length)} labels to ${CORPUS_LABELS_PATH}.\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
