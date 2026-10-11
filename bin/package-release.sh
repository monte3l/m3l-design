#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
# SPDX-License-Identifier: MIT
#
# Usage: bin/package-release.sh <git-ref> <out-dir>
#
# Writes <out-dir>/m3l-design-<ref>.tar.gz, <out-dir>/SHA256SUMS and
# <out-dir>/tokens.css: the three release assets. The tarball holds exactly the
# payload a consumer's design/ directory receives (source/, tokens.css,
# SHA256SUMS), taken from <git-ref> and not from the working tree, so what is
# released is what is committed. `git archive` stamps every entry with the
# commit time and `gzip -n` leaves out its own, so the same commit always
# produces the same bytes.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  printf 'usage: %s <git-ref> <out-dir>\n' "${0##*/}" >&2
  exit 2
fi
ref="$1"
out="$2"

cd "$(dirname "${BASH_SOURCE[0]}")/.."
git rev-parse --verify --quiet "${ref}^{commit}" >/dev/null || {
  printf 'error: %s is not a commit in this repository\n' "$ref" >&2
  exit 2
}
mkdir -p "$out"

git archive --format=tar "$ref" source tokens.css SHA256SUMS | gzip -n >"$out/m3l-design-${ref}.tar.gz"
git show "$ref:SHA256SUMS" >"$out/SHA256SUMS"
git show "$ref:tokens.css" >"$out/tokens.css"
printf 'wrote %s/{m3l-design-%s.tar.gz,SHA256SUMS,tokens.css}\n' "$out" "$ref"
