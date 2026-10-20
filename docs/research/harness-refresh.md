# Harness refresh tracker

<!-- harness-refresh: last-verified=2026-10-20 claude-code-version=2.1.304 -->

Living record of `harness-guidance` (refresh mode) sweeps — the per-facet,
per-source state a run diffs against, so each sweep reports what
**changed** since the last one instead of rediscovering the whole `.claude/`
surface from scratch. Updated **in place** on every run, never as a new
dated file.

First sweep: 2026-10-20, run from `/customize`. The Claude Code CHANGELOG was
read for 2.1.295 to 2.1.304 only (`changelog read back to 2.1.295`); anything
older is covered through the docs pages below, not the changelog.

## Outstanding drift

Applied in the 2026-10-20 sweep: a `permissions.deny` block for secret reads and
the `$schema` key in `.claude/settings.json`; the five legacy
`@anthropic-plugin-directory` plugin keys moved to `@claude-plugins-official`,
and `claude-code-setup` enabled under that id; `verify-after-edit.sh` now runs in
the repository that holds the edited file; the `Explore` prompt no longer claims
a project agent skips `CLAUDE.md`.

Open, none of them blocking:

| Item | Where | Status |
| --- | --- | --- |
| `guard-no-commonjs` and `guard-double-background` fail open on a crash or timeout | `.claude/settings.json` | Deferred by the owner. Fail-closed needs `"onFailure": "block"` (Claude Code 2.1.295 or later) |
| SessionStart matcher omits `clear` and `fork`, so the handoff is not re-injected there | `.claude/settings.json` | Deferred by the owner. A fresh `/clear` start is usually deliberate |
| `token-change-reviewer` and `brand-markdown-reviewer` pin no `model`, `effort` or `maxTurns` | `.claude/agents/` | Left as is by the owner. Cost follows the session |
| Reviewers with `Bash` rely on prompt text to stay read-only | `.claude/agents/` | Optional hardening: a PreToolUse hook per agent or `permissions.deny` Bash rules |
| `creating-prs`, `finishing-work` and `reviewing-dependabot-prs` are model-invocable and side-effecting | `.claude/skills/` | Judgment call. Docs recommend `disable-model-invocation: true` for side effects, but do not mandate it |
| `Explore` description is long (747 characters) | `.claude/agents/Explore.md` | Optional trim. No sign the combined description budget is exceeded |
| `skillOverrides` keys with an `anthropic-skills:` prefix are not documented as valid | `.claude/settings.local.json` | Unverified and personal. Test with `/skills` |
| `guard-secret-writes` relies on `onFailure`, which needs Claude Code 2.1.295 or later | `.claude/settings.json` | Older CLIs ignore the key silently, and the guard then fails open |

## Facet state

| Facet | Last verified | Notes |
| --- | --- | --- |
| `models-tiering` | 2026-10-20 | `claude-opus-5-5`, `claude-sonnet-5-5` and `claude-haiku-5-5` are active, with earliest retirement 2027-09-22, 2027-09-28 and 2027-10-07. `effort` takes low, medium, high, xhigh or max. No drift |
| `cc-features-settings` | 2026-10-20 | Drift found and applied (permissions, `$schema`, plugin ids). `statusLine` and `subagentStatusLine` shapes are current |
| `agent-subagent-design` | 2026-10-20 | Every frontmatter field in use is valid. A project `Explore` overrides the built-in. No drift beyond the open items above |
| `skills-context-engineering` | 2026-10-20 | All skill bodies are under 500 lines and every description is under 1,024 characters. No drift |
| `hooks-lifecycle` | 2026-10-20 | Exit-code contract, matchers, `timeout` seconds and `onFailure` all match the repo. One worktree edge applied |

## Claims by facet

### models-tiering

- `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5` are current, pinned snapshots, none deprecated. Sources: https://platform.claude.com/docs/en/about-claude/models/overview and https://platform.claude.com/docs/en/about-claude/model-deprecations (retrieved 2026-10-20).
- The subagent `effort` field accepts `low`, `medium`, `high`, `xhigh` and `max`. `CLAUDE_CODE_EFFORT_LEVEL` overrides the field. Sources: https://code.claude.com/docs/en/sub-agents and https://platform.claude.com/docs/en/build-with-claude/effort (retrieved 2026-10-20).
- A full model id pins one version, and an alias floats. Omitting `model` follows the session. Source: https://code.claude.com/docs/en/model-config (retrieved 2026-10-20).
- Anthropic gives no per-role effort or model rule for read-only reviewers. Coverage gap.

### cc-features-settings

- The built-in marketplace is `claude-plugins-official`, and `anthropic-plugin-directory` is not a documented marketplace id. A project-scope `enabledPlugins` entry enables a plugin but does not install it. Sources: https://code.claude.com/docs/en/plugins/security, https://code.claude.com/docs/en/plugins/loading and https://code.claude.com/docs/en/plugins/install (retrieved 2026-10-20).
- Secrets belong behind `Read` deny rules such as `Read(./.env)`. `Write(...)` deny rules are never consulted. Source: https://code.claude.com/docs/en/permissions (retrieved 2026-10-20).
- `statusLine` is `{type, command, padding?, refreshInterval?}` and `subagentStatusLine` is `{type, command}`. Source: https://code.claude.com/docs/en/statusline (retrieved 2026-10-20).
- Settings precedence, highest first: managed, `--settings`, `settings.local.json`, `settings.json`, user. Source: https://code.claude.com/docs/en/settings (retrieved 2026-10-20).

### agent-subagent-design

- Valid agent frontmatter fields include `name`, `description`, `tools`, `disallowedTools`, `model`, `effort`, `maxTurns`, `color`, `skills`, `mcpServers`, `hooks`, `omitClaudeMd` and `autoCompactWindow`. Unknown fields are ignored. Source: https://code.claude.com/docs/en/sub-agents (retrieved 2026-10-20).
- A project agent named `Explore` overrides the built-in and keeps its own `model`. Source: https://code.claude.com/docs/en/sub-agents (retrieved 2026-10-20).
- `tools` is an allowlist. Bash on a reviewer is documented practice, and command-level control needs a hook or `permissions.deny`. Source: https://code.claude.com/docs/en/sub-agents (retrieved 2026-10-20).

### skills-context-engineering

- `description` is capped at 1,024 characters by the skills spec, and Claude Code truncates the listing at 1,536. The listing budget is 1% of the context window. Sources: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices and https://code.claude.com/docs/en/skills (retrieved 2026-10-20).
- Keep `SKILL.md` under 500 lines and move detail into files linked one level deep. Source: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices (retrieved 2026-10-20).
- `disable-model-invocation: true` is the documented setting for side-effecting skills. Source: https://code.claude.com/docs/en/skills (retrieved 2026-10-20).

### hooks-lifecycle

- `timeout` is in seconds, default 600 for command hooks. `onFailure` is `continue` or `block`, needs 2.1.295 or later, and blocks on a start failure, a timeout, an exit code other than 0 or 2, or invalid JSON. Source: https://code.claude.com/docs/en/hooks (retrieved 2026-10-20).
- Exit 2 blocks on PreToolUse, shows stderr to Claude on PostToolUse, and shows it to the user only on SessionStart. Any other non-zero code is a non-blocking error. Source: https://code.claude.com/docs/en/hooks (retrieved 2026-10-20).
- A matcher of letters, digits, `_`, `-`, `,` and `|` is an exact-name list, so `Edit|Write` and `Write|Edit` are equal. A `Bash` matcher tests the tool name, not the command text. Source: https://code.claude.com/docs/en/hooks (retrieved 2026-10-20).
- `CLAUDE_PROJECT_DIR` stays at the original checkout inside a linked worktree, while the payload `cwd` follows the worktree. Source: https://code.claude.com/docs/en/hooks (retrieved 2026-10-20).
- SessionStart matchers are `startup`, `resume`, `clear`, `compact` and `fork`. Source: https://code.claude.com/docs/en/hooks (retrieved 2026-10-20).

## Coverage gaps

- The CHANGELOG was read for 2.1.295 to 2.1.304 only.
- The PreCompact input fields and a maximum hook `timeout` are not documented in the pages read.
- The hooks guide overflowed the fetch and was not digested. The settings reference and the model-config page were read only in part.
- `https://www.anthropic.com/news` was not fetched. The `claude.com/blog` posts "How the Claude Code team does code review" and "Code Review is now generally available" were listed but not read.
- No sweep facet covers the Claude Code GitHub Action or CI wiring. The repository does not install it.
