# Adoption report

Generated 2026-10-20T07:18:33.235Z by m3l-groundwork 1.0.5 (inventory schema 6).

**Mode:** adopt -- --adopt forced

## Codebase shape

- No package manager and no `package.json`: a dependency-free repository on Node 24 (`.node-version`). Scripts and the resolver are ESM `.mjs`, tests are `node --test` files under `test/`, sources live under `source/`, and `tokens.css` and `SHA256SUMS` are generated.
- No TypeScript anywhere. The groundwork baseline's pnpm, tsconfig, ESLint, vitest and lefthook files were not adopted.
- Kind: library (confirmed). The payload is copied into consumers by `bin/sync-design.sh`, and the resolver's exports and the docs kit's flags are public API.
- Runtime: both. The CSS payload runs in browsers, and the resolver, docs kit and scripts run on Node.

## Toolchain enforcement in effect

- `.github/workflows/verify.yml` is the single required gate. Its `Checks` job runs: generated files current, `SHA256SUMS`, docs-kit `--check`, `node --test`, `bash -n` plus shellcheck, and JSON parsing with `jq`. A `DCO sign-off` job checks commits, and an aggregate `verify` job reports both.
- The `main` ruleset requires `verify`, `Dependency Review`, `CodeQL`, `Gitleaks` and `DCO sign-off`, requires signed commits, and allows merge or squash only.
- Not required: `REUSE`, `Workflow lint` (path-filtered), `Scorecard`, `docs.yml` (post-merge deploy) and `docs-live.yml` (daily drift check).
- Git hooks: none. Nothing runs before a commit or push, and the DCO is enforced only in CI.
- Tests gate: yes, inside `verify`. There is no linter or formatter config beyond `.editorconfig`.

## Toolchain grade

No TypeScript toolchain files (tsconfig, ESLint or vitest config, verify steps) found -- nothing to grade.

## Existing Claude Code harness

State after `/customize` Round 1 and Round 2.

- Agents: `token-change-reviewer`, `brand-markdown-reviewer` (existing), plus `code-reviewer`, `silent-failure-hunter` and `Explore`.
- Skills: `add-token`, `release` (existing), `writing-commits`, `creating-prs`, `finishing-work`, `triaging-ci`, `harness-guidance`, `reviewing-dependabot-prs`, `triaging-scan-alerts`, `watching-pr-checks` and groundwork's own `customize`.
- Hooks: 8 registrations in `.claude/settings.json` (PreToolUse 5, PostToolUse 1, PreCompact 1, SessionStart 1) plus the `statusLine` and `subagentStatusLine` commands. Every registration has a `timeout`. The 3 shell hooks were already there; the CLI's survey reported "Hooks: none" because it counts only hook files it recognises.
- Rules and commands: none. `settings.local.json` holds only `skillOverrides`.
- `settings.json` also gained a `permissions.deny` block for secret reads and a `$schema` key.

## Harness grade

- **Wiring (structural):** 8 of 8 checks pass.
- **Quality (rubric):** 62% over 13 checks -- advisory, never a blocker.
- **Drift from the baseline harness:** 0 identical, 2 divergent, 30 absent. Informational only -- `/customize` rewrites the baseline on purpose, so divergence is not a defect.

### Wiring findings

None.

### Quality findings (advisory)

- [model-pin-currency] .claude/agents/brand-markdown-reviewer.md -- pins no `model`, so it inherits whatever the session runs
- [model-pin-currency] .claude/agents/token-change-reviewer.md -- pins no `model`, so it inherits whatever the session runs
- [hook-timeout] PreToolUse hook -- `"$CLAUDE_PROJECT_DIR"/.claude/hooks/block-generated.sh` has no `timeout`
- [hook-timeout] PreToolUse hook -- `"$CLAUDE_PROJECT_DIR"/.claude/hooks/release-guard.sh` has no `timeout`
- [hook-timeout] PostToolUse hook -- `"$CLAUDE_PROJECT_DIR"/.claude/hooks/verify-after-edit.sh` has no `timeout`

### Baseline harness files this project has changed

- .claude/settings.json
- CLAUDE.md

## Human-facing docs & guidelines

- `README.md` covers adoption, versioning policy and the draft-first release steps. `CONTRIBUTING.md` requires Conventional Commits, a DCO `Signed-off-by` on every commit and a GPG or SSH signature, with branches named `feat/<slug>` or `fix/<slug>`.
- A PR merges when every review thread is resolved, the required checks pass and a code owner other than the author approves. Releases are immutable and a tag is never reused.
- `CHANGELOG.md` is at 1.1.0, `design/README.md` carries `Version adopted`, and `source/docs-kit/README.md` is the docs kit's contract. There is no ADR directory; `docs/research/` holds the harness refresh tracker.

## Baseline caps after a merge

| Artifact | Baseline cap | Now | Note |
| --- | --- | --- | --- |
| Agents | 5 | 5 | At the cap |
| Skills | 8 | 11 | Over the cap: 3 come from the `github` pack and 1 is groundwork's own `customize` |
| Hooks | 10 | 10 | Registered scripts, within the cap |
| Workflows | 3 | 8 | All pre-existing and unchanged, none added by groundwork |
| Scripts | 12 | 0 | No `bin/` scripts added |

## Available packs

### claude-github

- Modes: fresh, adopt
- Budget: 0 agent(s), 0 skill(s), 0 hook(s), 2 workflow(s), 0 script(s)
- .claude/settings.local.json is present and may shadow a merged hook entry
- Adopt notes: claude.yml only reacts to @claude mentions from a repository owner, member or collaborator (author_association), so an outside commenter on a public repository cannot start a job that holds contents: write and your auth secret. It also commits through the GitHub API (use_commit_signing) so a signed-commits ruleset accepts its work. claude-pr-review.yml runs on every non-bot, non-fork pull request, so it spends API credits on each push -- delete it and keep claude.yml if you only want on-demand help. Both workflows need one thing this pack cannot verify or install: an ANTHROPIC_API_KEY repository secret (the active default), or a CLAUDE_CODE_OAUTH_TOKEN from a Claude subscription, or a Workload Identity Federation setup in the Anthropic Console -- see the comments in .github/workflows/claude.yml for all three. An adopted project that already has its own .github/workflows/claude.yml or claude-pr-review.yml surfaces as an ordinary file conflict -- keep the existing one if it's already configured for that project's own auth choice, since this pack's version would just overwrite a working setup with its own generic defaults. The two workflows ship without an SPDX header on purpose (a header would carry a project-name token that stays literal in an adopt-mode install); a project that also installs `licensing` gets the headers from that pack's `check-license-headers.mjs --fix` backfill. These workflows used to ship inside the `github` pack; a project that installed that pack before the split keeps its files untouched.

### github

- Modes: fresh, adopt
- Budget: 0 agent(s), 3 skill(s), 0 hook(s), 0 workflow(s), 0 script(s)
- .claude/settings.local.json is present and may shadow a merged hook entry
- Adopt notes: The three skills need only `gh` CLI auth (already required by every other gh-CLI-based skill this baseline ships) and install anywhere a .claude/ directory exists. triaging-scan-alerts reads code-scanning alerts, and nothing in the baseline or this pack produces them: turn on GitHub's CodeQL default setup for the repository (Settings > Code security), or install the `supply-chain` pack, whose scorecard.yml uploads SARIF, otherwise the skill's first call returns "code scanning is not enabled" and reports nothing. watching-pr-checks' handoff to /triaging-ci degrades gracefully if the project doesn't have that skill installed -- it still reports the real failure, just without the handoff. The Claude Code GitHub Action workflows (claude.yml, claude-pr-review.yml) used to ship in this pack and are now the separate `claude-github` pack; a project that installed this pack before the split keeps those files untouched.

### harness-extras

- Modes: fresh, adopt
- Budget: 0 agent(s), 0 skill(s), 3 hook(s), 0 workflow(s), 0 script(s)
- .claude/settings.json has no "PreCompact" entry yet
- .claude/settings.json has no "SessionStart" entry yet
- .claude/settings.json already has a "PreToolUse" entry (2 registration(s))
- .claude/settings.local.json is present and may shadow a merged hook entry
- Adopt notes: The compaction hooks install anywhere a .claude/ directory exists, but guard-readonly-bash.mjs imports ../../bin/lib/agent-roster.mjs (the baseline's list of writer spokes) -- copy that file alongside it in an adopted project, or skip that one hook. The PreCompact hook writes tmp/compact-handoff-<session_id>.json under the git worktree the session runs in (from the hook payload's cwd, since CLAUDE_PROJECT_DIR does not follow a session into a linked worktree) -- fresh mode's baseline .gitignore already lists tmp/ unconditionally, but an adopted project's own .gitignore was never touched by adopt mode, so add tmp/ there too before this pack's hooks run, or the handoff artifact can end up committed. The size-ratchet gate and the type-design-analyzer agent that used to ship here are now the separate `quality` pack. The status line that used to ship here is now the separate `statusline` pack, so installing this one never touches a project's own `statusLine` setting.

### licensing

- Modes: fresh
- Budget: 0 agent(s), 0 skill(s), 0 hook(s), 0 workflow(s), 0 script(s)
- .claude/settings.local.json is present and may shadow a merged hook entry
- no bin/lib/verify-steps.packs.json found -- no bin/verify.mjs-shaped gate runner detected
- Adopt notes: REQUIRED right after install, before the first pnpm verify: `git add -A`, then `node bin/check-license-headers.mjs --fix`, then `git add -A` again and commit the result (the gate only checks git-tracked files, so a fresh project with nothing staged passes it vacuously and fails on every file at its first push) -- templates/core has never had a license-header gate before this pack, so every one of its own files (hooks, bin/ scripts, CI workflows, the placeholder src/tests, and the workflows of any other installed pack such as `claude-github` or `supply-chain`) is missing the SPDX header this pack's gate now requires. The shipped REUSE.toml and gate header use NOASSERTION as the license identifier because the pack cannot know the project's license: edit REUSE.toml and the headerLines() function in bin/check-license-headers.mjs once it is decided (a LICENSE file, if one exists, is the source of truth). In a hand-copied install the CLI does not substitute tokens, so replace every literal `__PROJECT_NAME__` in the copied files (REUSE.toml, the SPDX headers) with the project's real name first. Fresh mode only: the backfill fails an established project's pnpm verify until it has touched every file, so it is staged like every other pack (at .groundwork/packs/licensing/) but never auto-installed in adopt mode -- if an adopted project wants it, copy .groundwork/packs/licensing/files/ by hand, dropping the `.staged` suffix from every name (or copy templates/packs/licensing/files/ from this repo directly) and run the backfill above. The license-headers verify step is a lint-group gate and installs anywhere a bin/verify.mjs-shaped gate runner exists; wire it into the project's real one if it differs. REUSE.toml also carries globs for `.gitleaks.toml` and `.worktreeinclude`, the files the `supply-chain` and `worktrees` packs add, so the gate's uncovered-file check passes whether or not those packs are installed. This gate used to ship in the `publishing` pack; a project that installed that pack before the split keeps its files untouched.

| File | Differing keys |
| --- | --- |
| REUSE.toml | (whole file) |

### publishing

- Modes: fresh
- Budget: 0 agent(s), 0 skill(s), 0 hook(s), 1 workflow(s), 2 script(s)
- .claude/settings.local.json is present and may shadow a merged hook entry
- no bin/lib/verify-steps.packs.json found -- no bin/verify.mjs-shaped gate runner detected
- Adopt notes: REQUIRED right after install, before the first pnpm verify -- one step, or pnpm verify fails immediately, not from a real regression but from a setup gap this pack cannot close itself: `pnpm add -D @changesets/cli` -- the wiring contract only extends package.json's scripts, never its dependencies (see templates/packs/README.md), so the wired `changeset`/`version:packages` scripts reference a binary knip's own unlisted-binaries check correctly flags as missing until this is installed. In a hand-copied install the CLI does not substitute tokens, so replace every literal `__PROJECT_NAME__` in the copied files (the SPDX headers in bin/, the workflows) with the project's real name first. Fresh mode only: a release pipeline encodes decisions (whether the package is actually public, which registry, whether a GitHub App backs the version PR) this pack cannot survey or guess at safely, so it is staged like every other pack (at .groundwork/packs/publishing/) but never auto-installed in adopt mode -- if an adopted project wants it, copy .groundwork/packs/publishing/files/ by hand, dropping the `.staged` suffix from every name (or copy templates/packs/publishing/files/ from this repo directly) and work through the one-time setup below. check-publish-version.mjs is deliberately NOT one of this pack's wired verify steps: with changesets, package.json's version on the release branch is always the one just published between releases, so a version-already-published check running on every ordinary push (via pnpm verify / pre-push) would fail every single time until the next version PR lands -- it is instead invoked directly as a step inside release.yml's pack job, the one place "is this version about to collide with an already-published one" is actually the right question to ask. The remaining verify-group gate (dts-deps) installs anywhere a bin/verify.mjs-shaped gate runner exists; wire it into the project's real one if it differs. Both check-publish-version.mjs and check-dts-deps.mjs no-op (checked: 0, not a failure) on a package.json with `private: true` (the baseline's own default) or (check-dts-deps.mjs only) with no dist/**/*.d.ts yet -- flip `private` to `false` (and set a real `name`) once the package is actually meant to publish. The pack assumes a public package: `.changeset/config.json` ships `access: public`, npm refuses `restricted` for an unscoped name, and the publisher always requests provenance, which npm ties to a public source repository -- a private scoped package needs `access: restricted` and the `provenance: true` option removed from the libnpmpublish call in bin/npm-stage-publish.mjs. `@changesets/changelog-github` (and its `repo` option) is a drop-in swap for `.changeset/config.json`'s plain default changelog generator, once this project's GitHub repository is known, for changelog entries that link back to the originating PR/commit -- see `.changeset/README.md`. One-time setup before release.yml's first real run (distinct from the pnpm-verify prerequisite above), distilled from this repo's own .claude/rules/releases.md: (1) npm cannot configure a trusted publisher for a package that doesn't exist yet -- publish once by hand with a temporary token first; (2) the trusted publisher is bound to the exact workflow filename `release.yml` -- renaming or moving it breaks publishing until reconfigured on npmjs.com; (3) set the trusted publisher's allowed actions to staged-only (staged publishing only, npm's own default and recommendation since 2026-09-03) -- a maintainer runs `npm stage approve <id>` (2FA, never automatable) before a version actually installs; (4) create an `npm-publish` GitHub environment (via `gh api`, not committed as JSON) with a required reviewer, restricted to the release branch, so the `publish` job itself pauses before the git tag/Release/stage-publish exist; (5) if branch protection requires status checks on every PR with no bypass actor, the version-PR job needs a GitHub App installation token (`APP_CLIENT_ID`/`APP_PRIVATE_KEY` repo secrets), not the default GITHUB_TOKEN, or those checks never trigger and the PR can never merge -- if this project has no such rule, `github-token: ${{ secrets.GITHUB_TOKEN }}` is enough and the app-token step can be dropped. release.yml pins `tools/release/` (the exact libnpmpublish and npm-registry-fetch versions the publish job installs; it stages through them, not the npm CLI, because the CLI's bundled dependencies cannot be patched by an override) but the baseline's dependabot.yml only covers the github-actions ecosystem, so that pin goes stale unless you add an `npm` entry with `directory: "/tools/release"` to the project's own .github/dependabot.yml. The staged id to approve is printed by the workflow's "Show the staged ids to approve" step (and annotated on the run), and the `npm stage approve <id>` command is also written to the job summary. The secret-scanning and Scorecard workflows that used to ship here are now the separate `supply-chain` pack. The SPDX/REUSE license-header gate that used to ship here is now the separate fresh-only `licensing` pack: this pack's own scripts and release.yml still carry SPDX headers with a NOASSERTION license identifier, which is harmless without that gate but is what it would check.

### quality

- Modes: fresh, adopt
- Budget: 1 agent(s), 0 skill(s), 0 hook(s), 0 workflow(s), 0 script(s)
- .claude/settings.local.json is present and may shadow a merged hook entry
- no bin/lib/verify-steps.packs.json found -- no bin/verify.mjs-shaped gate runner detected
- Adopt notes: check-file-budget.mjs's ROOTS default assumes a flat src/+tests/ layout and its ceilings are this baseline's defaults -- in an adopted project, re-point ROOTS at the project's real source layout (or drop the gate) before wiring it. check-file-budget.mjs imports ./lib/report.mjs, a baseline file that an adopted project will not have -- copy bin/lib/report.mjs alongside the gate, or treat the gate as not installable. The verify step assumes a bin/verify.mjs-shaped gate runner; if the project has none, install the agent and report the gate as not installable rather than inventing one. The type-design-analyzer agent has no such dependency and installs anywhere a .claude/agents/ directory exists; it is a read-only review spoke (model claude-opus-5-5 at xhigh effort, more expensive than the baseline's reviewers, which run claude-opus-5-5 at medium effort), and nothing in the baseline's hub-and-spoke instructions dispatches it by name -- ask for it after changing exported types, or add it to the project's own CLAUDE.md review step.

### statusline

- Modes: fresh, adopt
- Budget: 0 agent(s), 0 skill(s), 3 hook(s), 0 workflow(s), 0 script(s)
- .claude/settings.json has no top-level "statusLine" yet
- .claude/settings.json has no top-level "subagentStatusLine" yet
- .claude/settings.local.json is present and may shadow a merged hook entry
- Adopt notes: The statusline scripts read only the stdin payload, .git/HEAD (via node:fs, never a git subprocess) and process.availableMemory()/os.totalmem(), so they install anywhere a .claude/ directory exists -- no dependency on the baseline's file layout. The one real adopt risk is the two top-level settings keys: a project that already defines statusLine or subagentStatusLine collides, and its existing value must be shown and decided on, never overwritten -- if either is already set, skip that key and the script that renders it rather than failing the whole install; if both are set there is nothing left to install, so skip the pack. A statusLine in .claude/settings.local.json (or one passed with --settings) also shadows the project one; the user's own ~/.claude/settings.json ranks lower and does not -- check those before concluding the pack is wired. rate_limits.spend_limit and prompt_cache need Claude Code v2.1.251+, and the per-subagent model/contextWindowSize/effort fields need v2.1.205+/v2.1.214+, and the agentType label a row falls back to when a subagent has no name needs v2.1.293+; each renders only when present, so an older Claude Code degrades to fewer segments rather than breaking. The scripts behave the same on macOS and Linux; the memory segment uses process.availableMemory() (Node 22+), and on macOS with an older Node it is hidden rather than shown from os.freemem(), which undercounts there. Below roughly 40 columns the layout drops segments by priority rather than wrapping. These scripts used to ship inside the `harness-extras` pack; a project that installed that pack before the split keeps its files untouched.

### supply-chain

- Modes: fresh, adopt
- Budget: 0 agent(s), 0 skill(s), 0 hook(s), 2 workflow(s), 0 script(s)
- .claude/settings.local.json is present and may shadow a merged hook entry
- Adopt notes: An adopted project that already has its own .github/workflows/gitleaks.yml or scorecard.yml surfaces as an ordinary file conflict -- keep the existing one if it already works, since this pack's version would just replace a configured setup with its generic defaults. gitleaks.yml needs a free GITLEAKS_LICENSE repo secret for an organization-owned repository (gitleaks-action's own requirement); scorecard.yml assumes a public repository (`publish_results: true` needs one) -- set it `false` for a private repo. gitleaks.yml is read-only and scorecard.yml holds security-events: write and id-token: write in its analysis job; neither is a required check by default, so add either to branch protection once it has a clean run. The SPDX/REUSE license-header gate is not part of this pack: it lives in the fresh-only `licensing` pack, because it fails an established project's `pnpm verify` until a one-time backfill touches every file. The two workflows ship without an SPDX header on purpose (a header would carry a project-name token that stays literal in an adopt-mode install); a project that also installs `licensing` gets the headers from that pack's `check-license-headers.mjs --fix` backfill.

| File | Differing keys |
| --- | --- |
| .github/workflows/gitleaks.yml | (whole file) |
| .github/workflows/scorecard.yml | (whole file) |

### worktrees

- Modes: fresh, adopt
- Budget: 0 agent(s), 1 skill(s), 3 hook(s), 0 workflow(s), 0 script(s)
- .claude/settings.json has no "SessionStart" entry yet
- .claude/settings.json already has a "PreToolUse" entry (2 registration(s))
- .claude/settings.json already has a "PostToolUse" entry (1 registration(s))
- .claude/settings.local.json is present and may shadow a merged hook entry
- Adopt notes: ensure-worktree-deps.mjs runs `pnpm install --frozen-lockfile --prefer-offline` automatically the first time a session starts inside a freshly created worktree with no node_modules yet -- this runs every dependency's lifecycle scripts the same way any `pnpm install` does, limited only by whatever `allowBuilds`/`onlyBuiltDependencies` policy the project's own pnpm config already sets (see typescript-guidance's pnpm supply-chain coverage if none is set). If node_modules in the worktree is a symlink (the usual result of `worktree.symlinkDirectories: ["node_modules"]` in .claude/settings.json, which this hook never reads), the hook detects the symlink and skips -- installing there would mutate the main checkout's own node_modules through the symlink. guard-worktree-only.mjs is registered with `"onFailure": "block"` (Claude Code 2.1.295 or later; an older version ignores the key), so a hook that cannot start, times out, exits with a code other than 0 or 2 or prints invalid JSON blocks the write instead of letting it through. A project that installed this pack before it carried that key has the same registration without it: /customize adds the missing key when it installs the pack again, and otherwise add `"onFailure": "block"` to that registration in .claude/settings.json by hand. It blocks every src/tests write outside a linked worktree under .claude/worktrees/, on any branch, for any caller (hub or writer spoke) -- this is stricter than guard-branch-isolation.mjs (which only blocks on main) and guard-hub-src-writes.mjs (which blocks the hub and any non-writer subagent); confirm the team actually wants every change routed through a worktree before installing this pack, since it changes the day-to-day workflow, not just adds a nicety. `.claude/worktrees/` should already be gitignored (the baseline's own .gitignore covers this); if adopting into a project with a hand-rolled .gitignore that doesn't, add it before installing. repair-core-bare.mjs resets `core.bare = true` to `false` in a non-bare repo's shared .git/config at session start and after EnterWorktree/ExitWorktree/Agent calls: Claude Code's worktree tools have been reported to leave it set (anthropics/claude-code#58345, #69802: user bug reports, both since closed as not planned, so whether it still reproduces is unconfirmed), which breaks `git status` in the main checkout. It only acts on a provably non-bare repository (its common git dir is named .git and contains an index), never on a genuine bare repo -- including a bare clone stored in a directory called .git -- and reports a failed repair on stdout rather than silently.

## What groundwork changed

- Installed 13 baseline files, from the staged copies and hash-checked first: the `Explore`, `silent-failure-hunter` and `code-reviewer` agents; the `finishing-work`, `harness-guidance`, `writing-commits`, `creating-prs` and `triaging-ci` skills; the `guard-secret-writes`, `guard-no-commonjs` and `guard-double-background` hooks; and `docs/research/harness-refresh.md`.
- Installed 3 packs: `github` (3 skills), `statusline` (3 scripts, 2 settings keys) and `harness-extras` (compaction handoff, 2 hooks).
- Kept as they were: `.github/dependabot.yml`, `.github/workflows/dependency-review.yml`, `README.md`, every workflow. `CLAUDE.md` kept its content and gained a "Claude Code harness" section.
- Merged: `.claude/settings.json` and `.gitignore` (added `.claude/worktrees/`, `.env`, `.env.local`, `.env.*.local` and `tmp/`). `docs.config.mjs` gained an `exclude` for `docs/research/**`.
- Fixed existing hooks: `verify-after-edit.sh` now exits 2 on a failure and runs in this project or its linked worktree that holds the edited file (never another repository), `release-guard.sh` also flags `gh release create --draft=false`, and all three registrations got a `timeout`.
- Not installed: the TypeScript toolchain scaffolding, `ci.yml`, `security-audit.yml`, the guards that import `bin/lib/*`, the `src/` and `tests/` rules, `test-author`, `code-implementer`, `typescript-guidance`, `starting-work`, `guard-readonly-bash` (it imports `bin/lib/agent-roster.mjs`), and the `supply-chain`, `quality`, `worktrees` and `claude-github` packs. `licensing` and `publishing` are fresh-only.

## Could not be determined

Nothing. The 8 workflow files were read in full during the deep read.

## Next step

Read `.groundwork/customization-report.md`: it holds the interview answers, what Round 1 and Round 2 changed, the files that need a human read, and the follow-up commands. Nothing has been committed.
