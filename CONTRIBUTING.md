# Contributing

`m3l-design` is the design system every monte3l repository copies from. A
change here reaches all of them, so start with an **issue** for anything
beyond a small fix. Pull requests are limited to collaborators: if you cannot
open one, the issue is the contribution, and a collaborator will pick it up.

## Prerequisites

| Tool | Why |
| --- | --- |
| Node 24 (`.node-version` is the authority) | The generator, the resolver, the tests and the docs kit |
| `git` | Everything |
| [`reuse`](https://reuse.software/) | The licensing check |
| `shellcheck` and `jq` | The shell and JSON checks |

There is no `package.json` at the root, and nothing to install to use or sync the system. To lint, run `npm ci --ignore-scripts --prefix tools/lint` once.

## Setup

```sh
git clone https://github.com/monte3l/m3l-design.git
cd m3l-design
node bin/build-design-tokens.mjs --check   # the generated files are current
node --test                                # needs nothing else
```

## Reporting a bug

Open an issue at
[`monte3l/m3l-design`](https://github.com/monte3l/m3l-design/issues/new/choose)
and say:

- the release you copied (`design/README.md` records it) or the commit,
- what you did, what you expected and what happened,
- for a visual defect, the browser, theme (light or dark) and the token or
  component involved.

Report a suspected security vulnerability privately. See
[`SECURITY.md`](SECURITY.md), and never open a public issue for it.

## Commits

| Rule | Why |
| --- | --- |
| [Conventional Commits](https://www.conventionalcommits.org) | The changelog and version bump come from the message |
| `Signed-off-by:` trailer (`git commit -s`) | Developer Certificate of Origin: you may submit this |
| GPG- or SSH-signed | The `main` ruleset rejects unsigned commits |

### Developer Certificate of Origin

By signing off a commit (`git commit -s`) you certify the
[Developer Certificate of Origin](https://developercertificate.org/): that you
wrote the change, or otherwise have the right to submit it under this project's
license. CI enforces it: the `DCO sign-off` job, a required check and a lane
`verify` waits on, fails a pull request when any commit it adds lacks a
`Signed-off-by: Name <email>` trailer whose email is that commit's author or
committer email. Merge commits are skipped, and so are a Dependabot pull
request's own commits. To fix a failure, run `git commit --amend -s --no-edit`
for the last commit, or `git rebase --signoff <base>` for several, and
force-push your own branch.

## Pull requests

1. Branch off `main` as `feat/<slug>`, `fix/<slug>`, `ci/<slug>` or `docs/<slug>`.
2. Edit `source/dtcg/`, then regenerate: `node bin/build-design-tokens.mjs`.
   Never edit `tokens.css` or `SHA256SUMS` by hand.
3. Run the full check before pushing:
   `node bin/build-design-tokens.mjs --check`,
   `node --test --experimental-test-coverage --test-coverage-lines=80 --test-coverage-branches=80`,
   `sha256sum -c --quiet SHA256SUMS` (`shasum -a 256 -c` on macOS),
   `node source/docs-kit/build.mjs --check`, `tools/lint/node_modules/.bin/biome lint .`,
   `shellcheck bin/*.sh` and `reuse lint`.
4. Add tests for new behavior and a regression test for a fix. A token change
   also needs its `source/tokens.json` entry and a Conventional Commit whose
   type is its semver bump (`feat`, `fix`, or `!` for a removal or rename) with
   the token's name in the subject: the release workflow writes `CHANGELOG.md`
   from it.
5. Resolve every review thread. A pull request merges when its required checks
   pass and a code owner other than its author approves it.

Markdown here follows the system itself: bold, never italics, and tables for
tabular data.

## Tests

`node --test` runs every test under `test/`: the resolver's parity with
`source/tokens.json`, the credit-file checks, the brand build, the payload
commit-type check, the docs kit, the two command-line entry points and the sync
and packaging scripts. They need no network and no installed
packages.

`verify` fails when the tests cover less than 80% of lines or less than 80% of
branches. The gate counts all the project's JavaScript, which is the scripts, the
resolver and the docs kit, and test files are not counted. Node measures
JavaScript only: the two shell scripts, `bin/sync-design.sh` and
`bin/package-release.sh`, have no line coverage, and `test/scripts.test.mjs`
checks their behavior instead. A new script that no test loads is not counted
by the gate, so loading it from a test is part of adding it.

### Test environments and how tests run

| Where | How | Triggered by |
| --- | --- | --- |
| CI: the `Checks` lane of `verify.yml`, on `ubuntu-latest` with the Node version in `.node-version` | `node --test --experimental-test-coverage --test-coverage-lines=80 --test-coverage-branches=80`, then the generated-file, checksum, docs-site, shell and JSON checks | Every pull request and every push to `main` |
| CI: the `DCO sign-off` and `Payload commit types` lanes | A commit-message check and `bin/check-payload-commits.mjs` | Every pull request |
| Your machine, any OS with Node 24 | `node --test`, and the commands in [Pull requests](#pull-requests) | By hand |

The tests need no network. Regenerating the brand rasters needs headless Chrome,
but checking them does not, so no test depends on it.

### Scope of a pull request

- **New behavior in `bin/`, `scripts/`, `source/lib/` or `source/docs-kit/` MUST
  come with tests.** A change that adds behavior has tests covering it, and
  coverage may not fall below the gate.
- **A bug fix MUST add a regression test** that fails against the old code and
  passes against the fix.
- A change to `bin/`, `source/` or `.github/` changes what consumers or CI
  trust, so say in the description what it affects.
- Docs that describe the change are updated in the same pull request.

## Coding standards

| What | The standard | Enforced by |
| --- | --- | --- |
| JavaScript | Biome's recommended rules plus `useTemplate` as an error (`biome.json`), ES modules only (no `require`, no `module.exports`), no dependency in the resolver or the docs kit, an inline SPDX header on every file | The `Checks` lane (Biome), and `reuse lint` for the header |
| Shell | `shellcheck` clean, `bash -n` clean, and `set -euo pipefail` at the top | The `Checks` lane for the first two, review for the third |
| Tokens and docs | Canonical tokens in `source/dtcg/`, generated files never hand-edited, every text and UI pairing at WCAG 2.2 AA | The `Checks` lane, the docs kit's `--check` and the resolver tests |
| Workflows | `actionlint` and `zizmor` clean, every action pinned to a commit SHA, per-job `permissions:` | `workflow-lint.yml` |
| Formatting | `.editorconfig` | Review |
| Licenses | An SPDX declaration for every file (`REUSE.toml` or a header) | `reuse.yml` |
| Commit messages | Conventional Commits, signed off and signed | The `Commit lint` and `DCO sign-off` jobs, and the `main` ruleset |
| Markdown | The m3l-design rules: bold, never italics or underlines, an alert matched to severity and never more than two in a row, tables for tabular data | Review, and the docs kit's `--check` |

A change that breaks a row with an enforcing check fails a required check. Biome runs as a linter only: its formatter is off, so layout follows `.editorconfig` and is checked in review.

## Code review

Every pull request needs one approval from a code owner other than its author, and every review thread resolved. The `main` ruleset enforces both with no bypass. What a reviewer checks:

- **Correctness.** The change does what it says, with tests.
- **Fail-closed behavior.** A check that fails is reported, never swallowed.
- **Security.** Input validated at any new boundary, no new dependency without a reason, no secret written to disk, no workflow value interpolated into a script.
- **Permissions.** A workflow change keeps each job's permissions as small as it was.
- **The public API.** A removed or renamed token, class, path or export is a major release, and the commit says so.
- **Drift.** `README.md`, this file, `SECURITY.md` and `CLAUDE.md` still match the code.
- **Process.** A signed commit, a DCO sign-off and a Conventional Commit type that matches the change.

## Adding a dependency

The resolver and the docs kit have none, and that is a rule of the project: both are copied into every consumer. A tool for CI lives in its own directory under `tools/` with a committed lockfile, installs with `npm ci --ignore-scripts`, and is explained in `SECURITY.md` if it holds a secret. Open an issue first.

**How a dependency is selected, obtained and tracked.** It is selected in the issue, by whether the project can do without it, whether it is maintained and whether its license is on the allow-list in `dependency-review.yml`. It is obtained from the npm registry through the lockfile, which pins an exact version and an integrity hash. It is tracked by Dependabot, which proposes updates weekly after a cooldown, and by Dependency Review, which fails a pull request that adds a vulnerable or disallowed one. Today the only ones are the deploy tool in `tools/deploy` and the linter in `tools/lint`.

## Account security

The `monte3l` GitHub organization requires two-factor authentication for every member. Use an authenticator app (TOTP) or a hardware security key, not SMS: an SMS second factor is not encrypted and does not meet this project's bar.

## Small tasks for newcomers

Pull requests are limited to collaborators, so a small contribution is an issue: a docs fix, a clearer error message, a missing test case, a contrast pairing that reads badly. Open one describing what you would change. A maintainer either implements it with a credit to you, or invites you as a collaborator after the checks in [`GOVERNANCE.md`](GOVERNANCE.md#granting-access).

## Conduct

Everyone taking part is bound by the
[Code of Conduct](https://github.com/monte3l/.github/blob/main/CODE_OF_CONDUCT.md).
