
# Harness refresh tracker

<!-- harness-refresh: last-verified=2026-10-22 claude-code-version=2.1.308 -->

Living record of `harness-guidance` (refresh mode) sweeps — the per-facet,
per-source state a run diffs against, so each sweep reports what
**changed** since the last one instead of rediscovering the whole `.claude/`
surface from scratch. Updated **in place** on every run, never as a new
dated file.

First sweep: 2026-10-20, run from `/customize`. Second sweep: 2026-10-22, also
from `/customize`. The Claude Code CHANGELOG was read for 2.1.295 to 2.1.308
(`changelog read back to 2.1.295`); anything older is covered through the docs
pages below, not the changelog.

## Outstanding drift

Applied in the 2026-10-20 sweep: a `permissions.deny` block for secret reads and
the `$schema` key in `.claude/settings.json`; the five legacy
`@anthropic-plugin-directory` plugin keys moved to `@claude-plugins-official`,
and `claude-code-setup` enabled under that id; `verify-after-edit.sh` now runs in
this project or the linked worktree that holds the edited file, and skips any other repository; the `Explore` prompt no longer claims
a project agent skips `CLAUDE.md`.

Applied in the 2026-10-22 sweep, both confirmed by the owner: `"onFailure": "block"` on `block-generated.sh`, `guard-no-commonjs.mjs`, `release-guard.sh` and `guard-double-background.mjs` (`guard-secret-writes.mjs` already had it), so a crash, timeout or bad exit code in any of the five guards blocks the call. Each guard was run with a benign payload and exits 0, and `block-generated.sh` still exits 2 on a `tokens.css` write. `disable-model-invocation: true` on `creating-prs`, `finishing-work`, `writing-commits`, `reviewing-dependabot-prs` and `customize`, so they run only when typed as `/name` (`release` already had it).

Open, none of them blocking:

| Item | Where | Status |
| --- | --- | --- |
| SessionStart matcher omits `clear` and `fork`, so the handoff is not re-injected there | `.claude/settings.json` | Deferred by the owner on 2026-10-20 and not re-asked on 2026-10-22. A fresh `/clear` start is usually deliberate |
| `token-change-reviewer` and `brand-markdown-reviewer` pin no `model`, `effort` or `maxTurns` | `.claude/agents/` | Left as is by the owner. Cost follows the session, or `CLAUDE_CODE_SUBAGENT_MODEL` if it is ever set (it outranks the session model) |
| The four reviewers that hold `Bash` (`Explore`, `code-reviewer`, `silent-failure-hunter`, `token-change-reviewer`) rely on prompt text to stay read-only | `.claude/agents/` | Deferred by the owner on 2026-10-22. A `Bash(...)` specifier in `disallowedTools` removes the whole tool, so it cannot narrow Bash. The options are `permissions.deny` rules such as `Bash(git push *)` (they apply to subagents and the hub) or a frontmatter `PreToolUse` hook that exits 2 (install the script before registering it) |
| `skillOverrides` keys with an `anthropic-skills:` prefix are not documented as valid | `.claude/settings.local.json` | Unverified and personal. The file was absent when checked on 2026-10-22. Test with `/skills` if it returns |
| Project-scope `enabledPlugins` enables a plugin but installs nothing | `.claude/settings.json` | Each collaborator runs `claude plugin install <id> --scope project` once. Official-marketplace plugins auto-update by default, so plugin code changes on disk without review |
| `claude-code-setup` is no longer in `enabledPlugins` | `.claude/settings.json` | Removed outside the 2026-10-22 run, after the 2026-10-20 sweep enabled it. It matches the owner's "none" answer for that plugin, so it was left out |
| `Read` deny rules do not cover `NotebookEdit` and do not stop `grep -r` or subprocess reads | `.claude/settings.json` | Coverage note only. This repository has no notebooks |

Optional items worked through on 2026-10-22:

- **Applied.** `allowed-tools` on `watching-pr-checks` (`gh pr view`, `gh pr checks`, `gh run view`) and `triaging-ci` (`gh run list`, `gh run view`, `git rev-parse`), read-only commands only, so `gh pr merge` still prompts. `triaging-ci` step 1 now resolves the branch in its own command, because a `$(...)` inside `gh run list` would not match the pre-approved pattern. `effort: medium` on `Explore`.
- **Skipped `allowed-tools` on `triaging-scan-alerts`.** Its read and its dismissal are both `gh api`, and a prefix rule cannot tell them apart.
- **Closed `context: fork`.** A fork has no conversation history, which breaks the merge confirmation, the `/triaging-ci` handoff and the option choice at the end of both triage skills.
- **Closed `paths` on `add-token`.** The skill is needed when someone asks for a token change, before any `source/dtcg/` file is open, so `paths` would hide it at that point.
- **Closed `when_to_use`.** It is appended to `description` and counts toward the same 1,536-character cap, so it only moves text around.
- **Closed the `Explore` description trim.** The docs warn only above 15,000 tokens of combined agent descriptions, and the breadth vocabulary is guidance for the caller.
- **`effort: medium`, not `low`, for `Explore`.** The effort page's general table names `low` for subagents, but its Haiku 5.5 section overrides that: "In long agent prompts, the model is more likely to skip a search, stop early, or skip a check at `low`". `medium` is Haiku 5.5's default, and pinning it stops the session level from leaking in.

Resolved on 2026-10-22: the fail-open guards (all four now set `onFailure`), side-effecting skills that were model-invocable, and the `guard-secret-writes` note that `onFailure` needs Claude Code 2.1.295 or later (the sessions here run 2.1.304 or later, and older versions ignore the key and fail open).

## Facet state

| Facet | Last verified | Notes |
| --- | --- | --- |
| `models-tiering` | 2026-10-22 | `claude-opus-5-5`, `claude-sonnet-5-5` and `claude-haiku-5-5` are Active, with retirement "not sooner than" 2027-09-22, 2027-09-28 and 2027-10-07. No model news since 2026-10-20. Refinement: a subagent's `model` resolves from the per-invocation parameter, then frontmatter, then `CLAUDE_CODE_SUBAGENT_MODEL`, then the main model. No file change |
| `cc-features-settings` | 2026-10-22 | No drift. Plugin, permission, `statusLine` and precedence claims all hold. 2.1.305 to 2.1.308 add settings keys this repository does not use |
| `agent-subagent-design` | 2026-10-22 | No drift in the fields in use. The valid-field list is longer than the 2026-10-20 claim (see below). The Bash read-only gap stays open |
| `skills-context-engineering` | 2026-10-22 | No drift. All 11 skill bodies are under 500 lines (maximum 304) and every description is under 1,024 characters. The 1,536 truncation and 1% listing budget are now configurable |
| `hooks-lifecycle` | 2026-10-22 | No drift. The `PreCompact` and timeout gaps are closed. The five guards now fail closed |

## Claims by facet

### models-tiering

- `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5` are current, pinned snapshots, none deprecated. The retirement column reads "not sooner than", a floor and not a fixed date. Sources: https://platform.claude.com/docs/en/about-claude/models/overview and https://platform.claude.com/docs/en/about-claude/model-deprecations (retrieved 2026-10-22).
- The subagent `effort` field accepts `low`, `medium`, `high`, `xhigh` and `max`, and the available levels depend on the model. `CLAUDE_CODE_EFFORT_LEVEL` overrides the field, and a per-invocation `effort` parameter overrides it too (Claude Code 2.1.292 or later). Sources: https://code.claude.com/docs/en/sub-agents and https://platform.claude.com/docs/en/build-with-claude/effort (retrieved 2026-10-22).
- A full model id pins one version, and an alias (`sonnet`, `opus`, `haiku`, `fable`, `default`, plus `[1m]` variants) floats. An omitted subagent `model` resolves in this order: per-invocation parameter, frontmatter, `CLAUDE_CODE_SUBAGENT_MODEL`, main model. Sources: https://code.claude.com/docs/en/model-config and https://code.claude.com/docs/en/sub-agents (retrieved 2026-10-22).
- Anthropic gives no per-role effort or model rule for read-only reviewers. The effort page names `low` for subagents and the model-choice page names Haiku 5.5 for subagent tasks. Coverage gap.

### cc-features-settings

- The built-in marketplace is `claude-plugins-official`, and `anthropic-plugin-directory` is not a documented id. A project-scope `enabledPlugins` entry enables a plugin but does not install it, and every collaborator installs with `claude plugin install <name>@<marketplace> --scope project`. Official-marketplace plugins auto-update by default. Sources: https://code.claude.com/docs/en/plugins/security, https://code.claude.com/docs/en/plugins/loading and https://code.claude.com/docs/en/plugins/install (retrieved 2026-10-22).
- Secrets belong behind `Read` deny rules such as `Read(./.env)`. `Write(...)`, `NotebookEdit` and `Glob` path rules are accepted but never consulted, and a `Read` deny also blocks `Edit` and `Write` on the same path. Source: https://code.claude.com/docs/en/permissions (retrieved 2026-10-22).
- `statusLine` is `{type, command, padding?, refreshInterval?}` and `subagentStatusLine` is `{type, command}`. Both stay blank until the workspace trust dialog is accepted. Source: https://code.claude.com/docs/en/statusline (retrieved 2026-10-22).
- Settings precedence, highest first: managed, `--settings`, `settings.local.json`, `settings.json`, user. A `deny` from any scope beats an `allow` from any scope. Sources: https://code.claude.com/docs/en/settings and https://code.claude.com/docs/en/permissions (retrieved 2026-10-22).
- Claude Code 2.1.305 to 2.1.308 add `sandbox.allowNestedUserNamespaces`, change `allowedMcpServers` filtering and the `axScreenReader` scope, and add the `claude_code.safety_event` OpenTelemetry event. This repository sets none of those keys. Source: https://code.claude.com/docs/en/changelog (retrieved 2026-10-22).
- The hooks page lists 33 events. This repository registers `PreToolUse`, `PostToolUse`, `PreCompact` and `SessionStart`. Source: https://code.claude.com/docs/en/hooks (retrieved 2026-10-22).
- CI coverage, read but not applied: `anthropics/claude-code-action@v1` supports an `@claude` mention workflow, an automated review, and scheduled runs, authenticated by `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN` or workload identity federation. Code Review is also a managed product, generally available since 2026-10-15 for Team and Enterprise. The `claude-github` pack covers the workflows and the owner declined it. Sources: https://code.claude.com/docs/en/github-actions and https://code.claude.com/docs/en/code-review (retrieved 2026-10-22).

### agent-subagent-design

- Valid agent frontmatter fields include `name`, `description`, `tools`, `disallowedTools`, `model`, `effort`, `maxTurns`, `color`, `skills`, `mcpServers`, `hooks`, `permissionMode`, `memory`, `background`, `isolation`, `initialPrompt`, `omitClaudeMd` and `autoCompactWindow`. Unknown fields are ignored, and `claude --debug` reports them (2.1.296 or later). Source: https://code.claude.com/docs/en/sub-agents (retrieved 2026-10-22).
- A project agent named `Explore` overrides the built-in and keeps its own `model`. Source: https://code.claude.com/docs/en/sub-agents (retrieved 2026-10-22).
- `tools` is an allowlist, and `disallowedTools` is applied before it. Bash in a read-only agent appears in the docs' examples but is not called a recommended practice. Command-level control needs `permissions.deny` or a frontmatter `PreToolUse` hook, and a specifier in `disallowedTools` removes the whole Bash tool. Source: https://code.claude.com/docs/en/sub-agents (retrieved 2026-10-22).
- The platform's Code Review pairs finder agents with a verification pass (Find, Verify, Rank, Post) and takes `REVIEW.md` and `CLAUDE.md` from the base branch. Source: https://code.claude.com/docs/en/code-review (retrieved 2026-10-22).

### skills-context-engineering

- `description` is capped at 1,024 characters by the skills spec, and Claude Code truncates the combined `description` and `when_to_use` at 1,536. The listing budget is 1% of the context window by default, and `skillListingBudgetFraction`, `SLASH_COMMAND_TOOL_CHAR_BUDGET` and `skillListingMaxDescChars` change it. Sources: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices and https://code.claude.com/docs/en/skills (retrieved 2026-10-22).
- Keep `SKILL.md` under 500 lines and move detail into files linked one level deep. Source: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices (retrieved 2026-10-22).
- `disable-model-invocation: true` stops Claude from loading a skill automatically, keeps it out of subagent preloads and scheduled tasks, and leaves it available as `/name`. The docs do not call it a side-effect rule. Documented fields this repository does not use yet: `when_to_use`, `context: fork`, `paths`, `model`, `effort`, `hooks`, `shell`, `arguments`. Source: https://code.claude.com/docs/en/skills (retrieved 2026-10-22).
- `allowed-tools` pre-approves the listed tools for the turn that invokes the skill and clears on the next message. It does not restrict which tools are callable, and `permissions` still govern the rest. Workspace trust does not gate it. `context: fork` starts a subagent that does not see the conversation, and `paths` limits automatic loading to matching files. Source: https://code.claude.com/docs/en/skills (retrieved 2026-10-22).

### hooks-lifecycle

- `timeout` is in seconds, default 600 for command, `http` and `mcp_tool` hooks, and the docs state no maximum. `onFailure` is `continue` or `block`, needs 2.1.295 or later, and blocks on a start failure, a timeout, an exit code other than 0 or 2, or invalid output. It has no effect on `Stop`, `SubagentStop`, `TaskCompleted`, `TeammateIdle` or async hooks. Source: https://code.claude.com/docs/en/hooks (retrieved 2026-10-22).
- Exit 2 blocks on PreToolUse, shows stderr to Claude on PostToolUse, and shows it to the user only on SessionStart. Any other non-zero code is a non-blocking error unless the hook sets `onFailure: "block"`. Source: https://code.claude.com/docs/en/hooks (retrieved 2026-10-22).
- A matcher of letters, digits, `_`, `-`, spaces, `,` and `|` is an exact-name list, so `Edit|Write` and `Write|Edit` are equal. A `Bash` matcher tests the tool name, and command text is matched only by the `if` field. Source: https://code.claude.com/docs/en/hooks (retrieved 2026-10-22).
- `CLAUDE_PROJECT_DIR` stays at the original checkout inside a linked worktree, while the payload `cwd` follows the worktree. Source: https://code.claude.com/docs/en/hooks (retrieved 2026-10-22).
- SessionStart matchers are `startup`, `resume`, `clear`, `compact` and `fork`. This one was checked against two page digests, not a verbatim quote. Source: https://code.claude.com/docs/en/hooks (retrieved 2026-10-22).
- `PreCompact` matchers are `manual` and `auto`, its input holds `trigger` and `custom_instructions`, and exit 2 or `"decision": "block"` blocks compaction. `PostCompact` has `trigger` and `compact_summary` and no decision control. Source: https://code.claude.com/docs/en/hooks (retrieved 2026-10-22).
- Interactive sessions hold back hooks from every settings file until the workspace trust dialog is accepted, while `claude -p` and SDK sessions treat the folder as trusted. Source: https://code.claude.com/docs/en/hooks (retrieved 2026-10-22).

## Coverage gaps

- The CHANGELOG was read for 2.1.295 to 2.1.308 only.
- The hooks guide and the settings reference were read in parts (roughly the first 100,000 and 200,000 characters). The last ~10,000 characters of the sub-agents page were not read.
- `https://www.anthropic.com/news` was fetched on 2026-10-22 and holds no model release or deprecation after 2026-10-20. `https://www.anthropic.com/engineering` and `https://claude.com/blog` returned an index with no subagent or code-review post.
- "How the Claude Code team does code review" is published on `claude.dev`, which is not on the allowlist, so it was not read and nothing is cited from it. One sweep agent fetched that page before checking the allowlist, and its content was discarded.
- The SessionStart matcher list rests on two page digests. A verbatim quote would settle it.
- The Claude Code GitHub Action and CI wiring were read this time, but only as coverage notes. The repository does not install the action.
