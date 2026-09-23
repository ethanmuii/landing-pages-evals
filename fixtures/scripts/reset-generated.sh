#!/usr/bin/env bash
set -euo pipefail

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd -- "${script_directory}/../.." && pwd)"

if [[ ! -f "${repository_root}/fixtures/scripts/prepare-modal.ts" \
  || ! -f "${repository_root}/fixtures/scripts/build-corpus.ts" ]]; then
  echo "Refusing to reset: could not identify the landing-pages-evals repository." >&2
  exit 1
fi

rm -f -- \
  "${repository_root}/src/fixtures/inputs/baseline-contract.json" \
  "${repository_root}/src/fixtures/inputs/modal-footer.html" \
  "${repository_root}/src/fixtures/corpus/labels.json" \
  "${repository_root}/findings.json"

rm -rf -- \
  "${repository_root}/src/fixtures/corpus/pages" \
  "${repository_root}/dist"

echo "Reset complete. Files remaining in src/fixtures/inputs:"
find "${repository_root}/src/fixtures/inputs" -maxdepth 1 -type f -print | sort

remaining_inputs="$(
  find "${repository_root}/src/fixtures/inputs" -maxdepth 1 -type f -printf '%f\n' | sort
)"
if [[ "${remaining_inputs}" != "clean-page.html" ]]; then
  echo "Reset verification failed: expected clean-page.html to be the only input file." >&2
  exit 1
fi

echo "Verified: clean-page.html is the only fixture input."
