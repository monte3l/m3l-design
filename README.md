# m3l-design

[![verify](https://github.com/monte3l/m3l-design/actions/workflows/verify.yml/badge.svg?branch=main)](https://github.com/monte3l/m3l-design/actions/workflows/verify.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/monte3l/m3l-design/badge)](https://securityscorecards.dev/viewer/?uri=github.com/monte3l/m3l-design)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/15706/badge)](https://www.bestpractices.dev/projects/15706)
[![OpenSSF Baseline](https://www.bestpractices.dev/projects/15706/baseline)](https://www.bestpractices.dev/projects/15706)
[![REUSE status](https://api.reuse.software/badge/github.com/monte3l/m3l-design)](https://api.reuse.software/info/github.com/monte3l/m3l-design)

m3l-design is the design system of the [`monte3l`](https://github.com/monte3l)
organization: warm, legible foundations for everything monte3l builds. It
covers the colour, type, shape and motion tokens, seven plain HTML and CSS
components, and the contrast tables that show every pairing passes WCAG 2.2 AA.

- **Version:** `v1.3.2` (the system's "v1, signed off 2026-09-26") <!-- x-release-please-version -->
- **Docs:** [design.monte3l.com](https://design.monte3l.com), built from this repository by its own docs kit
- **License:** MIT, with the two bundled fonts under SIL OFL-1.1. See [License](#license).
- **Credits:** Enrico Lionello ([`enri3l`](https://github.com/enri3l)) and Giulia Montevecchi ([`giulmonte`](https://github.com/giulmonte)), for monte3l. See [AUTHORS.md](AUTHORS.md).

## Who is this for

- Someone building a **monte3l repository with a visual surface** (CSS, HTML, a
  docs site, coloured terminal output) who wants the tokens and components
  copied in at a pinned version.
- Someone with a **markdown-only monte3l repository** who only needs the
  markdown rules and a version marker.
- A **maintainer** changing a token or component and cutting a release.

## New to design tokens?

- [`source/brand-book.md`](source/brand-book.md): the design brief and what v1
  shipped. Read it first for why things look the way they do.
- [`source/foundations/contrast.md`](source/foundations/contrast.md): every
  text and UI pairing, per theme, with its contrast ratio.
- [Design Tokens Community Group format](https://www.designtokens.org/): the
  JSON format the canonical tokens are written in.
- [WCAG 2.2 contrast](https://www.w3.org/TR/WCAG22/#contrast-minimum): the AA
  bar every pairing is held to.

## Quickstart

Adoption is **copy-based**. Never add a live dependency on this repository.
Pick the tier that matches your repository:

| Your repository has | Tier | What to do |
| --- | --- | --- |
| Markdown only | Content | Follow the markdown rules in the [org blueprint](https://github.com/monte3l/.github/blob/main/blueprint/README.md#design-system) and add a `design/README.md` with ``- **Version adopted:** `vX.Y.Z` `` |
| Any CSS, HTML, docs site or coloured terminal output | Vendored | Add the marker, then run the sync script below. A docs site also gets the [docs kit](source/docs-kit/README.md) that builds and gates it |

For the vendored tier, first create `design/README.md` in your repository with
the line ``- **Version copied:** `vX.Y.Z` ``. The script never creates this
file, and exits with code `2` if it is missing. Then, from a clone of this
repository:

```sh
bin/sync-design.sh vX.Y.Z /path/to/your-repo
```

The script downloads the release, verifies it with `gh release verify` and
`SHA256SUMS`, and replaces `design/source/`, `design/tokens.css` and
`design/SHA256SUMS`. It only edits the version lines of `design/README.md`.

| Option | Effect |
| --- | --- |
| `--dry-run` | Show what would change, and write nothing |
| `--from <git-ref>` | Take the payload from this clone instead of a release, to rehearse a sync before the tag exists |

Commit what it wrote. Your own divergence goes in `design/local/`, which the
script never touches.

> [!IMPORTANT]
> Never hand-edit `design/source/`. A sync replaces it wholesale. If something
> here needs to change, change it in this repository and cut a release.

## What a sync gives you

```
your-repo/design/
├── README.md        # your marker: the version line is the only part the script edits
├── source/          # the components, foundations, fonts, resolver and brand book
├── tokens.css       # light and dark custom properties, @font-face rules, type classes
├── SHA256SUMS       # the hash of every file in source/ and of tokens.css
└── local/           # your own divergence, never touched by a sync
```

To check that a copy is unedited, run `cd design && sha256sum -c SHA256SUMS`
(`shasum -a 256 -c SHA256SUMS` on macOS).

## Use it

Link the tokens first, then the component bundle:

```html
<link rel="stylesheet" href="design/tokens.css">
<link rel="stylesheet" href="design/source/components/bundle.css">
```

- **Themes.** The light theme is the default and the dark theme follows
  `prefers-color-scheme`. Set `data-theme="light"` or `data-theme="dark"` on an
  element to override it.
- **Type styles** are classes: `display`, `heading-1` to `heading-4`,
  `body-lg`, `body`, `body-strong`, `label`, `caption`, `code` and
  `code-strong`.
- **Components** are plain HTML and CSS with no runtime. The markup for each
  one is in `source/components/<Name>/README.md`.
- **Motion** drops to zero under `prefers-reduced-motion`, through the tokens.
- **Local rules** go in `design/local/`. See
  [`m3l-groundwork/design/local/`](https://github.com/monte3l/m3l-groundwork/tree/main/design/local)
  for the reference implementation.

## What is in here

The repository root has the same shape as a consumer's `design/` directory, so
adopting a release is a plain copy.

| Path | What it holds |
| --- | --- |
| `source/dtcg/` | The canonical tokens, in DTCG 2025.10 JSON |
| `source/tokens.json` | A flattened copy of the tokens. Only a parity oracle, never read by a build |
| `source/components/` | `bundle.css` and a README per component: Callout, CodeBlock, Badge, Button, Input, Card, Nav |
| `source/foundations/contrast.md` | Every text and UI pairing, per theme |
| `source/brand-book.md` | The design brief and what v1 shipped |
| `source/fonts/`, `source/licenses/` | Atkinson Hyperlegible Next and Mono, with their OFL texts and `FONTLOG.md` |
| `source/lib/design-tokens.mjs` | The one DTCG resolver. Zero dependencies |
| `source/docs-kit/` | The docs kit: the builder, the renderer and the checks that keep a project's docs site in step with its repository. See [its README](source/docs-kit/README.md) |
| `source/LICENSE`, `source/AUTHORS.md` | The notice that has to travel with every copy |
| `tokens.css` | Generated from `source/dtcg/` |
| `SHA256SUMS` | The hash of every file in `source/` and of `tokens.css` |
| `bin/` | `sync-design.sh`, `package-release.sh` and `build-design-tokens.mjs` |
| `docs.config.mjs`, `scripts/` | This repository's own docs site: its config, the token and gallery page generators, and the doc-versus-payload parity check |
| `avatars/` | The two founders' GitHub avatars as SVG and PNG, made by `bin/build-brand.mjs`. Not part of a release's payload |
| `artifact/` | The preview pages for the claude.ai design-system artifact. Not part of a release's payload |

## Requirements

| Who | Needs |
| --- | --- |
| Consumers running a sync | bash, `git`, [`gh`](https://cli.github.com/) 2.81 or later (for release verification), and `sha256sum` or `shasum` |
| Consumers building a docs site | Node 24 and `git`, for the docs kit |
| Maintainers | Node 24 (`.node-version` is the authority), [`reuse`](https://reuse.software/), `shellcheck` and `jq`. There is no `package.json` and nothing to install |

## Versioning policy

Releases are semver tags, and the tag is what a consumer records.

| Bump | When | Commit type |
| --- | --- | --- |
| Major | A token, class or file is removed or renamed | `feat!:` or `fix!:`, with a `BREAKING CHANGE:` footer naming it |
| Minor | A token, component or variant is added, or a value changes and still passes AA | `feat:` |
| Patch | Docs or the generator change, with no token change | `fix:` |

The release workflow reads the commit type, so it is the bump. A change to the
payload (`source/`, `tokens.css`) must be `feat` or `fix`: a `docs:` or `chore:`
commit is never released, so a brand-book fix is `fix(docs):`. Changes outside
the payload (`ci`, `chore`, `test`, the repository's own docs) are not released:
release-please skips a commit that only touches a directory outside the payload,
and CI fails a pull request with a `feat` or `fix` commit that changes no payload
file, because it would release a version whose payload is unchanged.

The public API is:

1. **Token names** and their meaning in `source/dtcg/` and `tokens.css`.
2. **CSS class names** in `tokens.css` and `source/components/bundle.css`.
3. **File paths** under `source/`.
4. **The exports of `source/lib/design-tokens.mjs`.** `m3l-groundwork` imports
   the resolver.
5. **The docs kit**: the keys of `docs.config.mjs`, the commands and flags of
   `build.mjs` and `check-live.mjs`, and the exit codes. Removing or renaming one
   is a major release.

**Not covered:** `artifact/`, the internals of `bin/`, the internals of
`source/docs-kit/lib/`, and the prose of the docs.

Every release is **immutable**: its tag and assets cannot change after
publishing, and each one carries a GitHub attestation. A published tag name can
never be reused, so a bad release is fixed with the next version.

## Working on this repo

| Command | What it does |
| --- | --- |
| `node bin/build-design-tokens.mjs` | Regenerate `tokens.css` and `SHA256SUMS` |
| `node bin/build-design-tokens.mjs --check` | Fail if either is stale. CI runs this |
| `node --test` | Resolver parity with `tokens.json`, the credit-file checks and the docs kit tests |
| `node source/docs-kit/build.mjs --check` | Build the docs site and fail on a broken link, an unlisted page, a hand-edited payload file or doc-versus-payload drift. CI runs this |
| `node source/docs-kit/build.mjs --out _site` | Write the docs site |
| `bash -n bin/*.sh && shellcheck bin/*.sh` | Lint the shell scripts |
| `reuse lint` | The REUSE licensing check |

Change `source/dtcg/` and regenerate. Never edit `tokens.css` or `SHA256SUMS` by
hand. A token change is a Conventional Commit whose type is its semver bump (see
Versions), with the token's name in the subject: the release workflow writes
[`CHANGELOG.md`](CHANGELOG.md) from it. In Claude Code, run `/add-token` to be
walked through the whole change.

Commits are Conventional Commits, signed, with a `Signed-off-by` trailer
(`git commit -s`), as in every monte3l repository. To report a vulnerability,
follow [`SECURITY.md`](SECURITY.md).

### Releasing

Releases are automatic and need no command. For maintainers:

1. Write Conventional Commits. The type is the bump: see the Versions table.
2. On every merge to `main`, the `Release` workflow opens or updates one release
   pull request. It sets the version in `README.md` and `design/README.md` and
   writes the new section of `CHANGELOG.md`, grouped as Added, Changed and Fixed.
3. Before you merge it, rehearse with
   `bin/sync-design.sh --dry-run --from <commit> vX.Y.Z <consumer>` in a scratch
   copy of each consumer. In Claude Code, `/release` reviews the pull request and
   does this.
4. Merge it with a merge commit. The workflow builds the assets with
   `bin/package-release.sh`, attaches them to a draft, attests them and
   publishes. `gh release verify vX.Y.Z` checks the result.
5. The workflow then tells `monte3l/.github`, whose `design-resync.yml` opens a
   re-sync pull request in each repository that vendors the system. Read the
   release notes and the checks on each before merging it.

> [!WARNING]
> Publishing makes the tag permanent. The release stays a draft until its three
> assets are attached and attested, so a failure costs a draft and not a
> version number.

### Project docs

- [`CHANGELOG.md`](CHANGELOG.md): what changed in each release.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): how to report a bug and contribute.
- [`SECURITY.md`](SECURITY.md): reporting a vulnerability.
- [`CLAUDE.md`](CLAUDE.md): the full maintainer reference for agents: commands,
  how the pieces fit, conventions.
- [`AUTHORS.md`](AUTHORS.md): who made it.
- [`design/README.md`](design/README.md): this repository's own adoption marker.
- [`source/docs-kit/README.md`](source/docs-kit/README.md): the docs kit contract.

## License

The code, tokens, components and docs are [MIT](LICENSE). The MIT license asks
that the copyright notice stays in all copies, so keep `source/LICENSE` and
`source/AUTHORS.md` with anything you vendor.

The fonts in `source/fonts/` are **not** MIT. They are licensed under the
[SIL Open Font License 1.1](LICENSES/OFL-1.1.txt) by their own authors, and stay
under it. Keep the OFL texts in `source/licenses/` next to the fonts, including
on a deployed site. See `source/fonts/FONTLOG.md` for where the files come from.

## Credits

Created by Enrico Lionello ([`enri3l`](https://github.com/enri3l)) and Giulia
Montevecchi ([`giulmonte`](https://github.com/giulmonte)) for
[`monte3l`](https://github.com/monte3l). Source:
[github.com/monte3l/m3l-design](https://github.com/monte3l/m3l-design).

A private claude.ai artifact renders these components for review
([preview](https://claude.ai/artifact/AyFoi7PNmQJXLyKUyBxHyk)). It is a
maintainer preview, it can lag behind, and this repository wins any
disagreement.
