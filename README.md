# m3l-design

[![verify](https://github.com/monte3l/m3l-design/actions/workflows/verify.yml/badge.svg?branch=main)](https://github.com/monte3l/m3l-design/actions/workflows/verify.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/monte3l/m3l-design/badge)](https://securityscorecards.dev/viewer/?uri=github.com/monte3l/m3l-design)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/15706/badge)](https://www.bestpractices.dev/projects/15706)
[![REUSE status](https://api.reuse.software/badge/github.com/monte3l/m3l-design)](https://api.reuse.software/info/github.com/monte3l/m3l-design)

The design system of the [`monte3l`](https://github.com/monte3l) organization:
warm, legible foundations for everything monte3l builds. It covers the colour,
type, shape and motion tokens, seven plain HTML and CSS components, and the
contrast tables that show every pairing passes WCAG 2.2 AA.

- **Version:** `v1.0.0` (the system's "v1, signed off 2026-09-26")
- **License:** MIT, with the two bundled fonts under SIL OFL-1.1. See [License](#license).
- **Credits:** Enrico Lionello ([`enri3l`](https://github.com/enri3l)) and Giulia Montevecchi ([`giulmonte`](https://github.com/giulmonte)), for monte3l. See [AUTHORS.md](AUTHORS.md).

## What is in here

The repository root has the same shape as a consumer's `design/` directory, so
adopting a release is a plain copy.

| Path | What it holds |
| --- | --- |
| `source/dtcg/` | The canonical tokens, in DTCG 2025.10 JSON |
| `source/tokens.json` | A flattened copy of the tokens. Only a parity oracle, never read by a build |
| `source/components/` | `bundle.css` and a README per component: Callout, CodeBlock, Badge, Button, Input, Card, Nav |
| `source/foundations/contrast.md` | Every text and UI pairing, per theme |
| `source/brand-book.md` | The design brief and what v1 shipped. Read it first for why things look the way they do |
| `source/fonts/`, `source/licenses/` | Atkinson Hyperlegible Next and Mono, with their OFL texts and `FONTLOG.md` |
| `source/lib/design-tokens.mjs` | The one DTCG resolver. Zero dependencies |
| `source/LICENSE`, `source/AUTHORS.md` | The notice that has to travel with every copy |
| `tokens.css` | Generated from `source/dtcg/`: light and dark custom properties, `@font-face` rules and one class per type style |
| `SHA256SUMS` | The hash of every file in `source/` and of `tokens.css` |
| `artifact/` | The preview pages for the claude.ai design-system artifact. Not part of a release's payload |

## Adopt it in a monte3l repository

Adoption is **copy-based**. Never add a live dependency on this repository.

| Your repository has | Tier | What to do |
| --- | --- | --- |
| Markdown only | Content | Follow the markdown rules in the [org blueprint](https://github.com/monte3l/.github/blob/main/blueprint/README.md#design-system) and add a `design/README.md` with ``- **Version adopted:** `vX.Y.Z` `` |
| Any CSS, HTML, docs site or coloured terminal output | Vendored | Run the sync script below, then record the version in `design/README.md` |

From a clone of this repository:

```sh
bin/sync-design.sh v1.0.0 /path/to/your-repo
```

The script downloads the release, verifies it with `gh release verify` and
`SHA256SUMS`, and replaces `design/source/`, `design/tokens.css` and
`design/SHA256SUMS`. It only edits the version lines of `design/README.md` and
never creates it. Use `--dry-run` to see what would change. Your own
divergence goes in `design/local/`, which the script never touches.

> [!IMPORTANT]
> Never hand-edit `design/source/`. A sync replaces it wholesale. If something
> here needs to change, change it in this repository and cut a release.

To check that a copy is unedited, run `cd design && sha256sum -c SHA256SUMS`
(`shasum -a 256 -c SHA256SUMS` on macOS).

## Versions

Releases are semver tags, and the tag is what a consumer records.

| Bump | When |
| --- | --- |
| Major | A token, class or file is removed or renamed |
| Minor | A token, component or variant is added, or a value changes and still passes AA |
| Patch | Docs or the generator change, with no token change |

Every release is **immutable**: its tag and assets cannot change after
publishing, and each one carries a GitHub attestation. A published tag name can
never be reused, so a bad release is fixed with the next version.

## Releasing

For maintainers. Steps 1 to 3 change nothing public, so run them first.

1. Update `CHANGELOG.md` and the version in `design/README.md` and this file.
2. Run `node bin/build-design-tokens.mjs --check`, `node --test` and `reuse lint`.
3. Rehearse with `bin/sync-design.sh --from <commit> v1.2.3 <consumer>` in a scratch copy of each consumer.
4. Build the assets with `bin/package-release.sh vX.Y.Z <commit> dist`. The tarball is named after the tag, which is the name `sync-design.sh` asks for.
5. Create the release as a **draft** and attach the three assets: `gh release create vX.Y.Z --draft --target <commit> --title vX.Y.Z --notes-file <notes> dist/*`. Download them again and compare them with the rehearsal.
6. Publish it: `gh release edit vX.Y.Z --draft=false`.
7. Check the attestation: `gh release verify vX.Y.Z`.

> [!WARNING]
> Publishing makes the tag permanent. Step 5 exists so that a mistake costs a
> draft and not a version number.

## Development

The only requirement is Node 24. There is no `package.json` and nothing to install.

```sh
node bin/build-design-tokens.mjs          # regenerate tokens.css and SHA256SUMS
node bin/build-design-tokens.mjs --check  # fail if either is stale (what CI runs)
node --test                               # resolver parity with tokens.json
```

Change `source/dtcg/` and regenerate. Never edit `tokens.css` or `SHA256SUMS` by
hand. Commits are Conventional Commits, signed, with a `Signed-off-by` trailer
(`git commit -s`), as in every monte3l repository. To report a vulnerability,
follow [`SECURITY.md`](SECURITY.md).

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
