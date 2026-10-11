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
| `node --test` | Resolver parity tests and credit-file checks |
| `node --test --test-name-pattern="shadow"` | Run one test |
| `sha256sum -c --quiet SHA256SUMS` | Check the payload hashes (`shasum -a 256 -c` on macOS) |
| `bash -n bin/*.sh && shellcheck bin/*.sh` | Lint the shell scripts |
| `reuse lint` | REUSE licensing check (CI pins `reuse==6.2.0` through pipx) |

CI (`.github/workflows/verify.yml`) also runs `jq empty` on every JSON file under `source/` and `artifact/`, and actionlint.

## How the pieces fit

- **`source/dtcg/` is canonical.** `m3l.resolver.json` lists the sets and modifiers. `source/lib/design-tokens.mjs` is the only resolver, with zero dependencies, and hard-codes the merge order and each file name. `assertResolverShape` fails at load time if the manifest stops matching them, so a renamed or reordered token file means editing the constants at the top of the resolver as well.
- **`tokens.css` and `SHA256SUMS` are generated.** Never edit them by hand. `SHA256SUMS` hashes every file under `source/`, docs and fonts included, so a change to any `source/` file (a component README, `brand-book.md`) needs a rebuild and a commit of the new `SHA256SUMS`.
- **`source/tokens.json` is only a test oracle.** Nothing reads it to build. `test/design-tokens.test.mjs` checks that the resolver's output matches it family by family, for both themes. Adding or changing a token means updating `tokens.json` too, or the parity test fails.
- **The resolver has an outside consumer.** `m3l-groundwork` imports `source/lib/design-tokens.mjs` and holds the negative-path resolver tests. Treat its exports as a public API.
- **The type styles are a fixed set.** `STYLE_NAMES` in the resolver lists them, and `deriveTypeTreatment` throws if the DTCG source lacks one or its `org.monte3l.m3l-design` extension.
- **Credit files are duplicated on purpose.** `source/LICENSE` and `source/AUTHORS.md` must equal the root `LICENSE` and `AUTHORS.md`, and a test enforces it. Edit both copies together.
- **Line endings are never normalised** (`.gitattributes`: `* -text`), because `SHA256SUMS` covers raw bytes.
- **`artifact/`** holds the preview pages for the claude.ai design-system artifact. It is not part of the release payload and is not hashed.

## Conventions

- Every script, test and the resolver carries an inline SPDX header. Files without comment syntax are covered by `REUSE.toml`, where the last matching table wins. The fonts and `source/licenses/` are OFL-1.1, not MIT.
- **Every token change gets a `CHANGELOG.md` line under `[Unreleased]` that names the token and its semver bump**, even a one-value tweak, because consumers read it to decide whether to re-sync. Removing or renaming a token, class or file is major. Adding one, or changing a value that still passes AA, is minor. Report the before and after contrast ratios and any new value that equals a sibling token (for example a text step that lands on `color-text-secondary`).
- For token work, run `/add-token`: it walks the DTCG source, `tokens.json`, contrast tables, regeneration and the changelog in order. It rarely triggers on its own, so invoke it deliberately.
- Releases are immutable, and a published tag can never be reused. Follow the README's draft-first release steps and never publish a release without being asked.
- This repository adopts itself at the content tier (`design/README.md`). Bump its `Version adopted` line in the same commit as a release.
