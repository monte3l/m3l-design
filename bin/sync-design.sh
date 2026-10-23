#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
# SPDX-License-Identifier: MIT
#
# Usage: bin/sync-design.sh [--dry-run] [--from <git-ref>] <tag> [consumer-dir]
#
# Copies the m3l-design payload of release <tag> into a consumer repository's
# design/ directory (default: the current directory), then records the version.
# It is a plain copy that a maintainer runs by hand: a consumer commits what it
# writes, so nothing depends on m3l-design at build or run time.
#
#   design/source/        replaced wholesale. Local divergence belongs in
#                         design/local/, which this script never touches.
#   design/tokens.css     replaced
#   design/SHA256SUMS     replaced; `cd design && sha256sum -c SHA256SUMS`
#                         checks that the copy is unedited
#   design/README.md      never created and never rewritten. Only its
#                         "- **Version copied:**" line (or "Version adopted"
#                         for a content-tier repository, which copies nothing)
#                         and a "- **Last re-synced:**" line are updated.
#
# The release is fetched with `gh release download`, then checked with
# `gh release verify` / `verify-asset` (gh 2.81 or later) and SHA256SUMS.
# --from <git-ref> takes the payload from this clone with `git archive`
# instead, to rehearse a sync before the tag exists; <tag> is then only the
# label written into the marker.
#
# Exit codes: 0 done, 1 verification failed, 2 usage or missing marker.
set -euo pipefail

repo="monte3l/m3l-design"
dry_run=0
from_ref=""

usage() {
  printf 'usage: %s [--dry-run] [--from <git-ref>] <tag> [consumer-dir]\n' "${0##*/}" >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) dry_run=1; shift ;;
    --from) [[ $# -ge 2 ]] || usage; from_ref="$2"; shift 2 ;;
    -h | --help) usage ;;
    --) shift; break ;;
    -*) usage ;;
    *) break ;;
  esac
done
[[ $# -ge 1 && $# -le 2 ]] || usage
tag="$1"
consumer="${2:-.}"
[[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
  printf 'error: tag must look like v1.2.3, got %s\n' "$tag" >&2
  exit 2
}

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
consumer="$(cd "$consumer" && pwd)"
marker="$consumer/design/README.md"

if [[ ! -f "$marker" ]]; then
  cat >&2 <<TEMPLATE
error: $marker does not exist, and this script never creates it.
Add it by hand first, with at least:

  # design/ -- m3l-design, vendored
  - **Version copied:** \`$tag\`

(content tier, which copies nothing: use "- **Version adopted:**" instead).
See https://github.com/$repo/blob/main/README.md.
TEMPLATE
  exit 2
fi

vendored=1
key="copied"
if grep -qE '^- \*\*Version adopted:\*\*' "$marker"; then
  vendored=0
  key="adopted"
elif ! grep -qE '^- \*\*Version copied:\*\*' "$marker"; then
  printf 'error: %s has no "- **Version copied:**" or "- **Version adopted:**" line\n' "$marker" >&2
  exit 2
fi

sha_check() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum -c --quiet "$@"; else shasum -a 256 -c --quiet "$@"; fi
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

if ((vendored)); then
  mkdir "$tmp/payload"
  if [[ -n "$from_ref" ]]; then
    git -C "$here" rev-parse --verify --quiet "${from_ref}^{commit}" >/dev/null || {
      printf 'error: %s is not a commit in %s\n' "$from_ref" "$here" >&2
      exit 2
    }
    git -C "$here" archive --format=tar "$from_ref" source tokens.css SHA256SUMS | tar -x -C "$tmp/payload"
    printf 'payload: %s from %s (rehearsal, not a release)\n' "$from_ref" "$here"
  else
    asset="m3l-design-${tag}.tar.gz"
    gh release download "$tag" -R "$repo" -p "$asset" -D "$tmp"
    gh release verify "$tag" -R "$repo" >/dev/null
    gh release verify-asset "$tag" "$tmp/$asset" -R "$repo" >/dev/null
    tar -xzf "$tmp/$asset" -C "$tmp/payload"
    printf 'payload: release %s of %s, verified\n' "$tag" "$repo"
  fi
  (cd "$tmp/payload" && sha_check SHA256SUMS) || {
    printf 'error: the payload does not match its own SHA256SUMS\n' >&2
    exit 1
  }

  # The vendored files are the authors' work, so a consumer's REUSE annotation
  # must credit them. Warn, never fail: whether to fix it is the consumer's call.
  if [[ -f "$consumer/REUSE.toml" ]] && ! grep -q 'giulmonte' "$consumer/REUSE.toml"; then
    printf 'warning: %s/REUSE.toml does not credit the m3l-design authors (enri3l, giulmonte) for design/source/**\n' "$consumer" >&2
  fi

  # The brand files are not MIT. A consumer that annotates all of design/source/**
  # as MIT would relabel them, so ask for a narrower annotation and the license text.
  if [[ -d "$tmp/payload/source/brand" && -f "$consumer/REUSE.toml" ]]; then
    if ! grep -q 'LicenseRef-MONTE3L-Brand' "$consumer/REUSE.toml" || [[ ! -f "$consumer/LICENSES/LicenseRef-MONTE3L-Brand.txt" ]]; then
      printf 'warning: %s does not annotate design/source/brand/ as LicenseRef-MONTE3L-Brand or lacks LICENSES/LicenseRef-MONTE3L-Brand.txt; see design/source/brand/LICENSE.md\n' "$consumer" >&2
    fi
  fi
fi

today="$(date +%F)"

rewrite_marker() {
  awk -v key="$key" -v tag="$tag" -v today="$today" -v vendored="$vendored" '
    skip && /^  / { next }
    { skip = 0 }
    /^- \*\*Version (copied|adopted):\*\*/ {
      print "- **Version " key ":** `" tag "`"
      if (vendored == 1) print "- **Last re-synced:** " today
      next
    }
    /^- \*\*Last re-synced:\*\*/ { skip = 1; next }
    { print }
  ' "$marker"
}

if ((dry_run)); then
  printf '\n--dry-run: nothing written. In %s:\n' "$consumer"
  if ((vendored)); then
    printf '  would replace design/source/, design/tokens.css and design/SHA256SUMS\n'
    printf '  files that would change:\n'
    for item in source tokens.css SHA256SUMS; do
      diff -rq "$tmp/payload/$item" "$consumer/design/$item" 2>&1 \
        | sed -e "s#$tmp/payload#m3l-design#g" -e "s#$consumer/design#design#g" -e 's/^/    /' || true
    done
  else
    printf '  content tier: no files are copied\n'
  fi
  printf '  design/README.md would change:\n'
  diff <(cat "$marker") <(rewrite_marker) | sed 's/^/    /' || true
  exit 0
fi

if ((vendored)); then
  rm -rf "$consumer/design/source"
  mkdir -p "$consumer/design"
  cp -R "$tmp/payload/source" "$consumer/design/source"
  cp "$tmp/payload/tokens.css" "$consumer/design/tokens.css"
  cp "$tmp/payload/SHA256SUMS" "$consumer/design/SHA256SUMS"
fi
rewrite_marker >"$tmp/README.md"
cat "$tmp/README.md" >"$marker"

printf '\nsynced %s into %s\n' "$tag" "$consumer"
git -C "$consumer" status --short design/ || true
