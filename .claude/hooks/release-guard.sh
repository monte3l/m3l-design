#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
# SPDX-License-Identifier: MIT
# PreToolUse (Bash): releases are immutable, so ask before anything that publishes.
cmd=$(jq -r '.tool_input.command // empty')
publish=0
[[ $cmd =~ gh\ release\ edit.*--draft=false ]] && publish=1
[[ $cmd =~ gh\ release\ create && ! $cmd =~ --draft ]] && publish=1
if (( publish )); then
  jq -n '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"ask",permissionDecisionReason:"This publishes a release and its tag can never be reused."}}'
fi
exit 0
