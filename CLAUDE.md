# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`m3l-design`, the monte3l design system. The repository root has the same layout as a consumer's `design/` directory: a release is `source/`, `tokens.css` and `SHA256SUMS`, copied as-is by `bin/sync-design.sh`. `README.md` covers adoption, versioning and the release steps. `source/brand-book.md` explains why things look the way they do.

## Commands

Node 24 (`.node-version`), no `package.json`, nothing to install.

| Command | What it does |
| --- | --- |
| `node bin/build-design-tokens.mjs` | Regenerate `tokens.css` and `SHA256SUMS` |
| `node bin/build-design-tokens.mjs --check` | Fail if either is stale. CI runs this |
| `node bin/build-brand.mjs` | Regenerate the brand pack in `source/brand/` and the two personal avatars in `avatars/` (outside the payload): SVGs from `bin/lib/brand-geometry.mjs`, PNGs and the ICO through headless Chrome (`CHROME` overrides the path), and `bin/brand-rasters.sha256`. Never run it just to look: the PNG bytes change, which changes `SHA256SUMS` and the payload |
| `node bin/build-brand.mjs --check` | Fail if an SVG or the manifest is stale, a raster is missing, or the rasters' inputs no longer match `bin/brand-rasters.sha256`. CI runs it through `node --test` |
| `node bin/build-brand.mjs --social <dir>` | Render one 1280x640 card per repository into `<dir>`, outside the repo, for upload in each repository's settings |
| `node --test` | Resolver parity tests, credit-file checks and the docs kit tests |
| `node source/docs-kit/build.mjs --check` | Build this repository's docs site and gate it: links, page coverage, `SHA256SUMS`, local CSS, parity with the payload. CI runs this |
| `node source/docs-kit/build.mjs --out _site` | Write the docs site |
| `node source/docs-kit/check-live.mjs --site _site` | Fetch every page and asset from design.monte3l.com and fail unless each matches `_site` byte for byte, headers included. `--metadata` compares the manifest with the GitHub repository's settings |
| `bin/sync-design.sh --dry-run --from <ref> <tag> <consumer-dir>` | Rehearse a consumer sync from a local ref before the tag exists (`/release` does this) |
| `node --test --test-name-pattern="shadow"` | Run one test |
| `EVENT_NAME=pull_request BASE_SHA=<sha> HEAD_SHA=<sha> node bin/check-payload-commits.mjs` | What the `payload-commits` lane runs: fails if the range changes `source/`, `tokens.css` or `SHA256SUMS` without a `feat` or `fix` commit, deletes or renames a payload file without a breaking one, or has a `feat` or `fix` commit that changes no payload file |
| `sha256sum -c --quiet SHA256SUMS` | Check the payload hashes (`shasum -a 256 -c` on macOS) |
| `bash -n bin/*.sh && shellcheck bin/*.sh` | Lint the shell scripts |
| `reuse lint` | REUSE licensing check (CI runs it from `reuse.yml` with `fsfe/reuse-action`) |

CI (`.github/workflows/verify.yml`) also runs `jq empty` on every JSON file under `source/` and `artifact/`, and a `dco` lane for sign-offs. `commit-lint.yml` also checks the pull request title, because a squash merge turns it into the commit message release-please reads. `docs.yml` deploys the site to Cloudflare on every push to `main`, then runs `check-live.mjs` against it. actionlint and zizmor run from `workflow-lint.yml` when a workflow changes.

## How the pieces fit

- **`source/dtcg/` is canonical.** `m3l.resolver.json` lists the sets and modifiers. `source/lib/design-tokens.mjs` is the only resolver, with zero dependencies, and hard-codes the merge order and each file name. `assertResolverShape` fails at load time if the manifest stops matching them, so a renamed or reordered token file means editing the constants at the top of the resolver as well.
- **`tokens.css` and `SHA256SUMS` are generated.** Never edit them by hand. `SHA256SUMS` hashes every file under `source/`, docs and fonts included, so a change to any `source/` file (a component README, `brand-book.md`) needs a rebuild and a commit of the new `SHA256SUMS`.
- **`source/tokens.json` is only a test oracle.** Nothing reads it to build. `test/design-tokens.test.mjs` checks that the resolver's output matches it family by family, for both themes. Adding or changing a token means updating `tokens.json` too, or the parity test fails.
- **The resolver has an outside consumer.** `m3l-groundwork` imports `source/lib/design-tokens.mjs` and holds the negative-path resolver tests. Treat its exports as a public API.
- **The type styles are a fixed set.** `STYLE_NAMES` in the resolver lists them, and `deriveTypeTreatment` throws if the DTCG source lacks one or its `org.monte3l.m3l-design` extension.
- **Credit files are duplicated on purpose.** `source/LICENSE` and `source/AUTHORS.md` must equal the root `LICENSE` and `AUTHORS.md`, and a test enforces it. Edit both copies together.
- **Line endings are never normalised** (`.gitattributes`: `* -text`), because `SHA256SUMS` covers raw bytes.
- **The docs kit is part of the payload and is public API.** `source/docs-kit/` is vendored into every consumer by `sync-design.sh`, so removing or renaming a `docs.config.mjs` key, a command or a flag is major, and adding one is minor. Its contract is `source/docs-kit/README.md`. Keep it dependency-free, and keep project-specific values in the consumer's config, never in the kit.
- **This repository's own site** (design.monte3l.com) builds from the root through `docs.config.mjs` (`designDir: "."`). Two generators in `scripts/site/` render the token reference from `tokens.css` and the component gallery from `artifact/components/*/preview.html`. A preview that uses `<script>` or an `on*` handler fails the build, because the site's CSP allows neither. `scripts/doc-parity.mjs` fails when a `bundle.css` block lacks a README or preview (or the reverse), when a doc names a token `tokens.css` does not declare, or when the newest CHANGELOG release is not `Version adopted`. A new `.md` file must be added to `pages` or `exclude` in `docs.config.mjs`.
- **`artifact/`** holds the preview pages for the claude.ai design-system artifact. It is not part of the release payload and is not hashed.

## Conventions

- Every script, test and the resolver carries an inline SPDX header. Files without comment syntax are covered by `REUSE.toml`, where the last matching table wins. The fonts and `source/licenses/` are OFL-1.1, not MIT.
- **A token change is a Conventional Commit whose type is its semver bump, with the token's name in the subject**, even a one-value tweak: the release workflow writes the version and `CHANGELOG.md` from it, and consumers read the changelog to decide whether to re-sync. Removing or renaming a token, class or file is `feat!` (or `fix!`) with a `BREAKING CHANGE:` footer naming it. Adding one, or changing a value that still passes AA, is `feat`. A docs or generator change inside the payload (`source/`, `tokens.css`) is `fix`, because `docs:` and `chore:` are never released. Report the before and after contrast ratios and any new value that equals a sibling token (for example a text step that lands on `color-text-secondary`) in the pull request body. The `payload-commits` lane in CI fails a pull request that changes the payload without a `feat` or `fix` commit, because `chore:` and `docs:` are never released, and the other way round, a `feat` or `fix` that changes no payload file, because it would release an unchanged payload. It cannot tell a `feat` that should be a `fix`, so choose the type from the Versions table. `release-please-config.json` lists the directories outside the payload under `exclude-paths` (a test fails if a new top-level directory is missing from it); release-please cannot exclude a root file such as `README.md`, which is why the lane has the second rule.
- For token work, run `/add-token`: it walks the DTCG source, `tokens.json`, contrast tables, regeneration and the changelog in order. It rarely triggers on its own, so invoke it deliberately.
- Releases are immutable, and a published tag can never be reused. They are automatic: the `Release` workflow opens a release pull request, and merging it publishes. Never merge it or publish a release without being asked. `/release` reviews that pull request and rehearses the consumer syncs.
- This repository adopts itself at the source tier (`design/README.md`: `Version adopted` plus `Tier: source`). The docs kit accepts that tier only here, where `designDir` is `.`. Release-please bumps that line and the README's `Version:` line through an `x-release-please-version` comment. Never edit either by hand, and keep the comment on its line.

## Claude Code harness

Everything under `.claude/` is wired in `.claude/settings.json`, and every hook registration there carries a `timeout`. `.claude/skills/customize/` and `.groundwork/` are m3l-groundwork's own tooling (the adoption survey, the staged baseline and `.groundwork/customization-report.md`), not part of the payload.

| Hook | Event | What it does |
| --- | --- | --- |
| `.claude/hooks/block-generated.sh` | PreToolUse, Edit or Write | Refuses hand edits to `tokens.css` and `SHA256SUMS` and points at `bin/build-design-tokens.mjs` |
| `.claude/hooks/guard-secret-writes.mjs` | PreToolUse, Edit or Write | Blocks writing `.env*` files or real secret values. Fails closed (`onFailure: block`) |
| `.claude/hooks/guard-no-commonjs.mjs` | PreToolUse, Edit or Write | Blocks `require`, `module.exports` and `__dirname` in JavaScript |
| `.claude/hooks/release-guard.sh` | PreToolUse, Bash | Asks before `gh release edit --draft=false` or a `gh release create` that is not a draft |
| `.claude/hooks/guard-double-background.mjs` | PreToolUse, Bash | Blocks `run_in_background` combined with `nohup`, `&` or `disown` |
| `.claude/hooks/verify-after-edit.sh` | PostToolUse, Edit or Write | Rebuilds tokens and runs `node --test` after a `source/` edit, and `bash -n` plus shellcheck after a `bin/*.sh` edit. Exits 2 on failure, the only code whose output reaches Claude |
| `.claude/hooks/write-compact-handoff.mjs` and `.claude/hooks/reinject-compact-handoff.mjs` | PreCompact, SessionStart | Carry a work summary across a compaction through `tmp/` (gitignored) |
| `.claude/hooks/statusline.mjs`, `.claude/hooks/subagent-statusline.mjs` and `.claude/hooks/statusline-layout.mjs` | `statusLine`, `subagentStatusLine` | Render the status lines. `statusline-layout.mjs` is imported by the other two |

- **Agents** (`.claude/agents/`): `token-change-reviewer` (after any `source/dtcg/` edit), `brand-markdown-reviewer` (after editing markdown), `code-reviewer` (scripts, resolver, docs kit), `silent-failure-hunter` (swallowed errors) and `Explore` (read-only search). None holds Edit or Write, so none edits files.
- **Skills** (`.claude/skills/`): `add-token` and `release` are repository-specific. `writing-commits`, `creating-prs`, `finishing-work` and `triaging-ci` are retargeted from the groundwork baseline to this repository's checks. `reviewing-dependabot-prs`, `triaging-scan-alerts` and `watching-pr-checks` come from the groundwork `github` pack, and `harness-guidance` refreshes this setup against Anthropic's guidance. Its tracker is `docs/research/harness-refresh.md`.
- **Commits**: Conventional Commits, `git commit -s` for the DCO sign-off, and a GPG or SSH signature. Use `writing-commits` rather than hand-writing the trailers.
- **Adding a hook**: install the script before registering it. A registration with `onFailure: block` whose file does not exist blocks every matching tool call, including the one that would create the file. A new `.mjs` hook carries an SPDX header and the `realpathSync(process.argv[1])` self-invocation guard its siblings use.
