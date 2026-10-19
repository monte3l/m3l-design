# Contributing

`m3l-design` is the design system every monte3l repository copies from. A
change here reaches all of them, so start with an **issue** for anything
beyond a small fix. Pull requests are limited to collaborators: if you cannot
open one, the issue is the contribution, and a collaborator will pick it up.

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

## Pull requests

1. Branch off `main` as `feat/<slug>` or `fix/<slug>`.
2. Edit `source/dtcg/`, then regenerate: `node bin/build-design-tokens.mjs`.
   Never edit `tokens.css` or `SHA256SUMS` by hand.
3. Run the full check before pushing:
   `node bin/build-design-tokens.mjs --check`, `node --test`,
   `sha256sum -c --quiet SHA256SUMS` (`shasum -a 256 -c` on macOS),
   `shellcheck bin/*.sh` and `reuse lint`.
4. Add tests for new behavior and a regression test for a fix. A token change
   also needs its `source/tokens.json` entry and a `CHANGELOG.md` line under
   `[Unreleased]` that names the token and its semver bump.
5. Resolve every review thread. A pull request merges when its required checks
   pass and a code owner other than its author approves it.

Markdown here follows the system itself: bold, never italics, and tables for
tabular data.

## Conduct

Everyone taking part is bound by the
[Code of Conduct](https://github.com/monte3l/.github/blob/main/CODE_OF_CONDUCT.md).
