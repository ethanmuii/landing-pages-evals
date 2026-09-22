# landing-pages-evals

Enforcement layer for locked sections. Given a generated page and a section marked
`data-locked`, it answers one question: did the lock hold?

## Why this exists

Flint owns authoring (marking a section locked) and generation (producing pages
around it). Neither guarantees the locked section survived generation. This is the
check that a generative product cannot ship without, and it is the hard part.

A second layer, the eval harness, scores the validator itself against a labelled
corpus of deliberately broken pages, so a change to the validator can be measured
rather than assumed.

## What it checks

Each lock is located by exact `data-locked` attribute equality. Exactly one match
proceeds; zero or several produce a single deterministic `fail`. A located lock is
then checked by three independent rules against a frozen baseline:

| Rule | Compares | Checker |
| --- | --- | --- |
| content | Normalized visible text and DOM subtree | `deterministic_content_normalizer` |
| appearance | 26 longhand CSS properties plus bounding box | `playwright_appearance_proxy` |
| position | `parentTag`, `previousSiblingTag`, `nextSiblingTag` | `relational_position_anchor` |

The gate is entirely deterministic. It makes no Anthropic API calls and never
escalates structural drift. If all three rules pass, the lock passes.

## Requirements

Node 24.21.0 (the range is `>=24.21.0 <25`), and Chromium for Playwright.

    npm ci
    npx playwright install chromium

## End-to-end workflow

**1. Restore the captured source page.** `src/fixtures/inputs/clean-page.html` is
untracked: 10.5 MB supplied externally, not generated here. Follow
`fixtures/scripts/homepage-capture-prompt.txt`, strip the `data:video` payloads
while keeping poster images, and place the result at that path.

**2. Build.**

    npm run build

**3. Build the eval corpus.** The 25 pages are gitignored (264 MB) and regenerate
byte-identically, so a fresh checkout has none.

    npx tsc -p tsconfig.fixtures.json
    node dist/offline/fixtures/scripts/build-corpus.js

This writes 25 pages to `src/fixtures/corpus/pages/` and 15 labels to
`src/fixtures/corpus/labels.json`. A dirty git status afterwards means the labels
genuinely changed.

**4. Run the validator.** `--pages` takes a single HTML file or a directory.

    node dist/cli/main.js \
      --contract src/fixtures/inputs/baseline-contract.json \
      --pages src/fixtures/corpus/pages \
      --findings findings.json

All three flags are required. The entry point is `dist/cli/main.js`; `run.js` only
exports functions and does nothing when executed.

Findings are written to `--findings` as a flat JSON array. A summary table goes to
stdout, and any `needs_review` finding is printed first as a
`SURFACE FOR HUMAN REVIEW:` line. Against the full corpus the run prints:

    75 findings: 59 pass, 16 fail, 0 review

| Exit code | Meaning |
| --- | --- |
| 0 | Every lock held |
| 1 | At least one `fail` |
| 2 | At least one `needs_review`, no `fail` |
| 3 | Operational failure: missing contract, malformed JSON, schema mismatch |

**5. Score the validator against the labels.**

    npx vitest run --project browser tests/corpus/scoring.test.ts

There is no scoring CLI. Scoring is library code under `src/eval` plus this test,
which drives the CLI over the corpus and scores what it wrote.

## Eval harness

A label carries `pagePath`, `lockId`, `rule`, and `domPath` — exactly the fields
the matcher compares, and nothing a human would have to keep in sync. One label per
expected violation; a control page carries no labels, which is what makes it a
control.

A finding matches a label when `lockId`, `rule`, and page agree, the label's
`domPath` is a whole-segment prefix of the finding's, and the reason is non-blank.
Segment-wise comparison is what stops `footer[1]` matching `footer[10]`.

Labels live in `src/eval`, which nothing under `src/validation` or `src/cli`
imports, so the validator never sees the answers it is scored against.

`needs_review` findings are excluded from precision and recall and reported
separately as a review rate, so a validator that escalates everything cannot show
perfect precision. Mislocated findings — right lock and rule, wrong `domPath` — are
reported as their own count alongside the scores, because "invented a violation"
and "found the real one but lost its location" are different failures.

Current corpus scores: 15 true positives, 0 false negatives, 0 mislocated, 1 false
positive. Precision 0.9375, recall 1.0, review rate 0. The false positive is
`content-03`, whose text edit reflows the lock, so it fails appearance as well as
the content rule it is labelled for. An unlabelled fail is a false positive by
definition.

`scoreFindings` takes the `--pages` directory as its third argument and rebases
each finding's path before comparing, because the CLI reports
`src/fixtures/corpus/pages/content-01.html` where a label says `content-01.html`.
The argument is optional; omitting it scores every page as a miss.

## Tests

    npm test                              # everything, 835 tests
    npx vitest run --project unit         # 749 fast tests, no browser
    npx vitest run --project browser      # 86 browser tests, one file at a time

The browser project is serialized deliberately. Rendering a 10.5 MB page costs
orders of magnitude more memory than the rest of the suite, and running several at
once made `page.setContent` exceed its own timeout. This serializes files within a
run, not across runs: do not start two browser suites concurrently.

## Fixed inputs, not product features

`src/fixtures/inputs/baseline-contract.json` and `modal-footer.html` were extracted
once from a captured Modal homepage, hand-reviewed, and committed. The scripts under
`fixtures/scripts/` are run once and their output committed; nothing downstream calls
them. This repository performs no live crawling and makes no paid API calls.
Measurements establish parity with the supplied local capture, not fidelity to the
live site.

## Known limitations

- **Same box, different internal layout.** A fixed-size card whose logos are
  re-arranged from a row into a stack has identical text, identical styles on the
  locked node, and an identical bounding box. It passes. Closing this needs
  recursion into children, which multiplies false positives, or pixel comparison.
  Scoped out deliberately rather than half-solved.
- **Layout properties are excluded** from the appearance rule (`display`,
  `flex-direction`, `align-items`). A row-to-column switch looks completely
  different while every color and font is identical. Excluded because it overlaps
  the limitation above and would imply that gap was closed. This is the first thing
  the appearance rule should extend to.
- **`domPath` is absolute from `body`.** Suitable for a static prototype with
  hand-written labels. Production needs paths relative to the locked root, to
  survive generation shifts above the lock boundary.
- **The `class` attribute is stripped wholesale** during normalization. Whether
  that is right depends on how Flint ingests sites: safe against compiler variance
  for raw HTML snapshots, redundant if elements are mapped to component-library
  tokens upstream. Built without visibility into that pipeline, so stripping is the
  safest decoupled choice. The fallback, if semantic classes must survive, is to
  sort them and compare as a set.
- **`data-locked` is assumed durable.** A missing attribute is read as a missing
  section. A generator that drops unrecognised `data-*` attributes, or a build-stage
  sanitiser, would produce the same symptom with the section intact. This is an
  assumption, not a guarantee; a content-based fallback search is the fix.
- **Sibling anchors are tag-only.** Swapping two distinct neighbours that share a
  tag escapes detection.
- **Eval isolation is enforced by a grep**, not a traversal of the import graph. It
  catches a direct import of `src/eval` from `src/validation` or `src/cli`, but a
  leak through a shared directory such as `src/output` would go undetected.
- **Label pairing is greedy**, in label order. Two nested labels sharing a page,
  lock, and rule could cost a true positive. The one-mutation-per-page rule makes
  this unreachable today.

## Out of scope

Ingestion, generation, repair, front end, publish workflow, human-review queue,
multi-brand support, screenshot comparison, descendant layout checks, fuzzy or
overlapping-region matching, and per-finding latency or cost tracking.
