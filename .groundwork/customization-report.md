# Customization report

Written 2026-10-20 by `/customize` (adopt mode, inventory schema 6, m3l-groundwork 1.0.5). **Nothing has been committed.**

## Interview answers

| Question | Answer | Status |
| --- | --- | --- |
| Project kind | library | Confirmed, asked cold (no `package.json` evidence) |
| Runtime target | both | Confirmed |
| Tests mandatory in the gate | yes | Confirmed |
| CI depth | thorough | Confirmed |
| Agents kept | `Explore`, `silent-failure-hunter`, `code-reviewer` | Confirmed |

## Round 1: what changed

- **Installed 13 baseline files** (SHA-256 re-checked against the inventory before each copy): 3 agents, the `finishing-work`, `harness-guidance`, `writing-commits`, `creating-prs` and `triaging-ci` skills, 3 hooks and `docs/research/harness-refresh.md`.
- **Installed 3 packs.** `github` added 3 skills and no wiring. `statusline` added 3 scripts and the `statusLine` and `subagentStatusLine` keys. `harness-extras` added the PreCompact and SessionStart handoff hooks.
- **Fixed the 3 existing hooks.** `verify-after-edit.sh` exits 2 on a failure (the only PostToolUse code whose stderr reaches Claude), `release-guard.sh` also flags `gh release create --draft=false`, and every registration has a `timeout`.
- **Conflicts:** kept `.github/dependabot.yml`, `.github/workflows/dependency-review.yml` and `README.md`. Kept `CLAUDE.md`'s content and appended a "Claude Code harness" section. Merged `.claude/settings.json` and `.gitignore`.
- **Other edits:** `docs.config.mjs` gained an `exclude` for `docs/research/**`, and `.gitignore` gained `.claude/worktrees/`, `.env`, `.env.local`, `.env.*.local` and `tmp/`.
- **Rewritten for this repository:** `writing-commits` (DCO sign-off, signed commits, this repository's public surface), `creating-prs` (the real gate commands, sign-off check, code-owner merge path), `triaging-ci` (a step-to-command table for `verify.yml`) and `code-reviewer` (`.mjs`, zero-dependency and generated-file rules in place of the TypeScript ones).

Verification: the repository gate, `jq`, `shellcheck` on the hooks and every new or changed hook run with sample payloads, including failure paths. `reuse lint` and the docs check each pass once the situations in "Things to know" are accounted for.

## Round 2: guidance sweep

Only `harness-guidance` ran. `typescript-guidance` was skipped: the repository has no TypeScript, and the skill is not installed.

**Applied**, each against an official source (tracker `docs/research/harness-refresh.md`, `last-verified=2026-10-20`, Claude Code 2.1.304, `changelog read back to 2.1.295`):

- A `permissions.deny` block for `Read(./.env)`, `Read(./.env.*)` and `Read(./secrets/**)`, plus `$schema`. The baseline had both and your `settings.json` had neither.
- The five `@anthropic-plugin-directory` plugin keys moved to `@claude-plugins-official`, and `claude-code-setup` enabled under that id. You confirmed this.
- `verify-after-edit.sh` runs in this project or the linked worktree that holds the edited file, because `CLAUDE_PROJECT_DIR` stays at the original checkout inside a linked worktree. After a security review of the pushed PR it skips any other repository, so a file edited in an unrelated checkout cannot make it run that checkout's build script. You confirmed the worktree behaviour.
- `Explore` no longer claims a project agent skips `CLAUDE.md`. The docs describe that only for the built-in.

**Where the findings disagreed with Rounds 0 and 1:** the baseline's `Explore` prose, the baseline `settings.json` shape (no `permissions`, no `$schema`) and the assumption that `anthropic-plugin-directory` is a marketplace. No finding overrode an interview answer.

**Deferred**, all recorded in the tracker's outstanding drift: fail-closed `onFailure` on the two node guards, the SessionStart `clear|fork` matcher, pinning the two local reviewers, `disable-model-invocation` on the side-effecting skills, hardening Bash on read-only reviewers, and trimming the `Explore` description.

**Tracker state:** `harness-refresh.md` is stamped `last-verified=2026-10-20`, `claude-code-version=2.1.304`, with 8 open items and no blockers.

## What Step 0 found that the CLI's report missed

- It reported "Hooks: none", but 3 shell hooks were registered. Its caps table counted 0 hooks for the same reason.
- `verify-after-edit.sh` always exited 0, so a failed rebuild or test never reached Claude.
- `release-guard.sh` missed `gh release create --draft=false`.
- Its skills list omitted the `customize` skill.
- `.claude/settings.json` was rewritten by something other than this run at 09:34 on 2026-10-20: the keys were reordered, the one-line hook entries expanded, and `claude-code-setup` dropped. The edits above were made on top of that version.

## Packs

| Pack | Result |
| --- | --- |
| `github` | Installed, 3 skills |
| `statusline` | Installed, 3 scripts and 2 settings keys, no collision |
| `harness-extras` | Installed, 2 hooks. `guard-readonly-bash.mjs` skipped |
| `supply-chain`, `quality`, `worktrees`, `claude-github` | Not selected |
| `licensing`, `publishing` | Fresh-only, not installable in adopt mode |

**Dropped:** `.claude/hooks/guard-readonly-bash.mjs`, because it imports `bin/lib/agent-roster.mjs`, which does not exist here, and the project keeps no writer-spoke roster for it to guard.

## Needs a human read

- **Mechanically retargeted** (only phrases swapped): `.claude/agents/silent-failure-hunter.md`, `.claude/skills/harness-guidance/SKILL.md` and the comment in `.claude/hooks/write-compact-handoff.mjs`. The `harness-guidance` skill's `references/` keep their upstream text.
- **Rewritten prose worth reviewing**, since it is new text and not a groundwork original: `.claude/skills/writing-commits/SKILL.md`, `.claude/skills/creating-prs/SKILL.md`, `.claude/skills/triaging-ci/SKILL.md`, `.claude/agents/code-reviewer.md` and the new section in `CLAUDE.md`.
- **Not exercised:** the failure path of `verify-after-edit.sh` for a real `source/` edit (simulated with a failing `node`), the `gh` commands inside `creating-prs`, `triaging-ci`, `finishing-work` and the 3 `github` skills, and the DCO check as CI runs it.

**Assumed, not answered:** none. Every interview question was answered.

## Coverage gaps from the domain map

`classifyPath` puts `.claude/hooks/*.sh` outside both sweeps' file lists (only `*.mjs` and `*.js` match), so `block-generated.sh`, `release-guard.sh` and `verify-after-edit.sh` are `uncovered`. The harness sweep reviewed them anyway because it was told to. The workflows, `dependabot.yml`, `.node-version`, `REUSE.toml`, `.gitleaks.toml` and `bin/build-design-tokens.mjs` classify as the TypeScript domain, which was not swept. Other config-like files classify `uncovered`: `docs.config.mjs`, `.editorconfig`, `.bestpractices.json`, `.github/CODEOWNERS`, `.github/deploy-tools/**`, `bin/*.sh`, `scripts/**` and `test/**`.

## Plugins

Enabled in `.claude/settings.json`, all under `claude-plugins-official`: context7, claude-md-management, github, security-guidance, claude-security, skill-creator and claude-code-setup. Declined: agent-sdk-dev and mcp-server-dev. typescript-lsp was enabled when this run finished and was removed from `enabledPlugins` afterwards through `/plugin`; it has little to do here since the repository has no TypeScript.

**Follow-ups:**

- `claude plugin install claude-code-setup@claude-plugins-official --scope project`. Every other entry is already installed, and this one is the likely cause of the "1 error during load" from `/reload-plugins`.
- Anyone cloning the repository runs the same `claude plugin install <id> --scope project` once per plugin, because committing `enabledPlugins` enables a plugin but installs nothing.
- Python 3.9 or later on `PATH` for claude-security, and 3.8 or later for security-guidance.
- Claude Code 2.1.295 or later, so `guard-secret-writes` fails closed.

## Things to know

- **`node source/docs-kit/build.mjs --check` fails until `docs/research/harness-refresh.md` is tracked.** The new `exclude` for `docs/research/**` matches no tracked file yet, and the check rejects a stale exclude. It passes once the files are `git add`ed.
- **`reuse lint` fails locally while `.groundwork/` is on disk, even though it is now gitignored.** The staged pack files carry `NOASSERTION` headers, and the local `reuse` run scans them despite the ignore rule. A copy of the repository without `.groundwork/` is REUSE-compliant, and CI is unaffected because an ignored directory is never committed or checked out. Delete `.groundwork/` once you no longer need the staged copies, or run `reuse lint` from a clean clone.
- **Register a hook only after its file exists.** Registering `guard-secret-writes.mjs` with `onFailure: "block"` first blocked every Write and Edit until the file was installed. The new `CLAUDE.md` section records this.
