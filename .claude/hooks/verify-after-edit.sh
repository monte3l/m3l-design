#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
# SPDX-License-Identifier: MIT
# PostToolUse (Edit|Write): rebuild and test after a source edit, syntax-check scripts.
# A failure exits 2, the only PostToolUse code whose stderr reaches Claude.
f=$(jq -r '.tool_input.file_path // empty')
# CLAUDE_PROJECT_DIR stays the original checkout inside a linked worktree, so
# prefer the repository that holds the edited file.
root=$(git -C "$(dirname "$f")" rev-parse --show-toplevel 2>/dev/null) || root=${CLAUDE_PROJECT_DIR:-.}
cd "$root" || exit 0
fail=0
case "$f" in
  */source/* | */bin/build-design-tokens.mjs)
    out=$({ node bin/build-design-tokens.mjs && node --test; } 2>&1) || fail=1
    (( fail )) && printf '%s\n' "$out" | tail -40 >&2 ;;
  */bin/*.sh)
    out=$({ bash -n "$f" && { ! command -v shellcheck >/dev/null || shellcheck "$f"; }; } 2>&1) || fail=1
    (( fail )) && printf '%s\n' "$out" >&2 ;;
esac
(( fail )) && exit 2
exit 0
