#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
# SPDX-License-Identifier: MIT
# PreToolUse (Edit|Write): refuse hand edits to the generated files.
f=$(jq -r '.tool_input.file_path // empty')
case "$f" in
  */tokens.css | */SHA256SUMS)
    echo "$(basename "$f") is generated: run node bin/build-design-tokens.mjs instead of editing it." >&2
    exit 2 ;;
esac
