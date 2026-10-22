# Customization report

Written 2026-10-22 by `/customize` (adopt mode, inventory schema 6, m3l-groundwork 1.1.0). It replaces the 2026-10-20 report, which the CLI re-run deleted from the working tree. **Nothing has been committed.**

## Interview answers

| Question | Answer | Status |
| --- | --- | --- |
| Project kind | library | Confirmed. The survey had no `package.json` evidence, so there was nothing to pre-select; it matched the 2026-10-20 answer |
| Runtime target | both | Confirmed |
| Tests mandatory in the gate | yes | Confirmed |
| CI depth | thorough | Confirmed |
| Agents kept | `Explore`, `code-reviewer`, `silent-failure-hunter` | Confirmed |

## Round 1: what changed

Nothing was installed or rewritten. The run was a re-adoption of a project customized on 2026-10-20, and every staged file either matched the repository's own tailored version or targets a TypeScript toolchain it does not have.

- **Skill upgrade (before Step 0):** four files in `.claude/skills/customize/` (`SKILL.md`, `step-3-round-1.md`, `pack-map.ts`, `plugin-map.ts`) were replaced with the copy the CLI staged at `.groundwork/customize/`, because the running copy was 1.0.5 and the CLI is 1.1.0. The other three files were already identical.
- **Baseline additions:** none of the 52 staged files were installed (see Dropped).
- **Conflicts:** all 18 kept as the repository's own versions: 13 harness files (`Explore`, `code-reviewer`, `silent-failure-hunter`, three hooks, `settings.json`, five skills, `CLAUDE.md`) and five others (`.github/dependabot.yml`, `dependency-review.yml`, `README.md`, `.gitignore`, `docs/research/harness-refresh.md`).
- **Packs:** none installed. The owner declined all four offered (`supply-chain`, `quality`, `claude-github`, `worktrees`). `github`, `statusline` and `harness-extras` stay as installed on 2026-10-20.
- **Plugins:** six enabled, no new entry. `context7`, `claude-md-management`, `github`, `security-guidance`, `claude-security` and `skill-creator` were confirmed. `typescript-lsp`, `claude-code-setup`, `agent-sdk-dev` and `mcp-server-dev` were not selected. No integration plugin was offered, because the repository has no `package.json` dependencies.

## Round 2: guidance sweep

Only `harness-guidance` ran. `typescript-guidance` was skipped: the repository has no TypeScript and the skill is not installed. The Claude Code CHANGELOG was read for 2.1.305 to 2.1.308, and five facet agents checked every prior claim. Tracker `docs/research/harness-refresh.md` is stamped `last-verified=2026-10-22`, `claude-code-version=2.1.308`.

**Applied**, each confirmed by the owner and tested:

- `"onFailure": "block"` on `block-generated.sh`, `guard-no-commonjs.mjs`, `release-guard.sh` and `guard-double-background.mjs` in `.claude/settings.json`. `guard-secret-writes.mjs` already had it, so all five guards now fail closed. Each guard exits 0 on a benign payload, and `block-generated.sh` still exits 2 on a `tokens.css` write.
- `disable-model-invocation: true` on `creating-prs`, `finishing-work`, `writing-commits`, `reviewing-dependabot-prs` and `customize`. They now run only when typed as `/name`. `release` already had it.

**Where the findings disagreed with Rounds 0 and 1:**

- The 2026-10-20 sweep left the fail-open guards and the model-invocable side-effecting skills as deferred items. Both are now resolved.
- The tracker's claim that a subagent without `model` follows the session was incomplete: `CLAUDE_CODE_SUBAGENT_MODEL` outranks the session model.
- The tracker's agent-frontmatter field list was incomplete (`permissionMode`, `memory`, `background`, `isolation` and `initialPrompt` are valid).
- The tracker said Bash on a reviewer is "documented practice". The docs show it in examples and do not recommend it.
- The 1,536-character skill listing cap and the 1% budget are defaults, not fixed limits.
- No finding overrode an interview answer.

**Deferred**, all in the tracker's open items:

- Bash on the four reviewers that hold it is read-only by prompt text only. The options are `permissions.deny` rules or a frontmatter `PreToolUse` hook. The owner chose the skill flag instead.
- The SessionStart `clear|fork` matcher, pinning `model` on the two local reviewers, `allowed-tools`, `context: fork` and `paths` on skills, trimming the `Explore` description, and `effort: low` for `Explore`.

## What Step 0 found that the CLI's report missed

- The CLI's survey reported "Hooks: none" again, although three shell hooks and eight `.mjs` hooks are registered. The harness grade is the correct view: 57 of 57 wiring checks pass.
- The CLI re-run deleted `.groundwork/customization-report.md` and overwrote the adoption report, so the 2026-10-20 findings had to be rebuilt from `git show HEAD:.groundwork/customization-report.md`.
- `.claude/settings.json` changed while this run was in progress: `claude-code-setup` was removed from `enabledPlugins` (seven entries became six). This run did not make that edit. It matches the owner's "none" answer for that plugin, so it was left alone and recorded in the tracker.
- Nothing was missing from the survey's index of CI workflows once the 12 files were read.

## Needs a human read

- `.claude/settings.json`: four guards are now fail-closed. A crash in any of them blocks Edit/Write or Bash until fixed, so a bug in a guard script is more disruptive than before. `claude --version` should be 2.1.295 or later, and older versions ignore the key and fail open.
- The five skills with `disable-model-invocation: true` can no longer be started by Claude on its own. A request like "commit this" will not trigger `writing-commits` unless the owner types `/writing-commits`.
- `round1.mechanicallyRetargeted` is empty: nothing was installed from the staged baseline, so there is no retargeted gate to exercise.

## Assumed, not answered

None. All five interview questions, the Step 0.4 round, the plugin offer and the Round 2 hook question were answered.

## Packs

| Pack | Result |
| --- | --- |
| `github`, `statusline`, `harness-extras` | Already installed on 2026-10-20, untouched. The staged copies differ because the repository's versions were hardened or retargeted |
| `supply-chain` | Declined. `recommendPacks` marks it recommended, but `gitleaks.yml` and `scorecard.yml` already exist here |
| `quality` | Declined. `recommendPacks` marks it recommended, but it has no gate runner to attach to and its agent is TypeScript-oriented |
| `claude-github` | Declined. It needs an `ANTHROPIC_API_KEY` secret and spends API credits on every PR |
| `worktrees` | Not selected. `guard-worktree-only.mjs` targets `src/` and `tests/`, which this repository does not have |
| `frontend`, `service` | Not offered as relevant: neither applies to a library |
| `licensing`, `publishing` | Fresh-only, not installable in adopt mode. This repository has REUSE and release-please instead |
| `guard-readonly-bash` (from `harness-extras`) | Skipped. It imports `bin/lib/agent-roster.mjs`, which this repository does not have |

## Plugin follow-ups

No plugin was newly enabled, so there is no new install command. The six enabled entries still need a one-time `claude plugin install <id> --scope project` on any machine that has not installed them (`claude plugin install context7@claude-plugins-official --scope project`, and the same for `skill-creator`, `github`, `claude-md-management`, `security-guidance` and `claude-security`). Official-marketplace plugins auto-update by default, so their code can change on disk without a review. `typescript-lsp` was not enabled, so `typescript-language-server` is not needed.

## Per-user follow-ups

- **Notifications:** Claude Code sends a desktop notification by itself only in Ghostty, Kitty and iTerm2. Ghostty is the terminal on this machine, so nothing is needed here. In another terminal, set `"preferredNotifChannel": "terminal_bell"` in `~/.claude/settings.json`.
- **Fewer permission prompts:** after a few sessions, run `/fewer-permission-prompts` to propose an allowlist for `.claude/settings.json`.
- **Dependabot grouping:** not applied, because adopt mode never applies it. `.github/dependabot.yml` already has an `npm` entry for `/.github/deploy-tools` with its own cadence and a one-day cooldown, so the block is not offered. There is no pnpm lockfile here, so the unconfirmed pnpm support does not apply.

## Coverage gaps

- No domain-map gap. The repository has no TypeScript, ESLint, vitest or `tsconfig` files, so there is nothing for `typescript-guidance` to classify as uncovered.
- The tracker's coverage gaps list what the sweep did not read: the tail of the sub-agents page, the full hooks guide and settings reference, and one engineering post published on `claude.dev`, which is outside the allowlist.

## Harness grade

`check-harness.mjs` was copied from the staged baseline to `.groundwork/grade/`, run from the project root, and removed: 57 of 57 wiring checks pass, the rubric scores 96% over 46 checks, and `claude plugin validate` reports no findings. The two warnings are the known `model-pin-currency` items for `brand-markdown-reviewer` and `token-change-reviewer`, which the owner chose to leave unpinned.

## `.gitignore`

The repository's `.gitignore` already holds the recommended `.groundwork/*` rule with the two report exceptions, added on 2026-10-20, so there is nothing to add. A teammate's clone holds the two reports and no inventory, and Step 0.1 answers that with the re-run advice.
