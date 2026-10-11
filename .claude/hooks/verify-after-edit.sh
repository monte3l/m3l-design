#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
# SPDX-License-Identifier: MIT
# PostToolUse (Edit|Write): rebuild and test after a source edit, syntax-check scripts.
f=$(jq -r '.tool_input.file_path // empty')
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
case "$f" in
  */source/* | */bin/build-design-tokens.mjs)
    node bin/build-design-tokens.mjs >&2 && node --test 2>&1 | tail -20 >&2 ;;
  */bin/*.sh)
    bash -n "$f" >&2 && { command -v shellcheck >/dev/null && shellcheck "$f" >&2; } ;;
esac
exit 0
