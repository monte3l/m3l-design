# Changelog

All notable changes to m3l-design. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/). Sections after 1.1.0 are written by
the release workflow from the Conventional Commits since the last release,
grouped as Added, Changed and Fixed; the sections before them are as written.

## [1.3.2](https://github.com/monte3l/m3l-design/compare/v1.3.1...v1.3.2) (2026-10-23)


### Fixed

* **brand:** drop the "reads as an M" line from the brand book ([f754f58](https://github.com/monte3l/m3l-design/commit/f754f587d89e08266ecc2f588339275c3520fd6d))
* **brand:** drop the "reads as an M" line from the brand book ([65d138f](https://github.com/monte3l/m3l-design/commit/65d138f69eb7edfc6d046b6b614254c8f71ee74c))
* **docs-kit:** show the site name once in the home page title ([2f38077](https://github.com/monte3l/m3l-design/commit/2f380772dc08f8df276f524b6d53be7bc60e8341))
* **docs-kit:** show the site name once in the home page title ([ac1ae06](https://github.com/monte3l/m3l-design/commit/ac1ae06c2b969c96ce5d4714caaa4cefc490e5c9))

## [1.3.1](https://github.com/monte3l/m3l-design/compare/v1.3.0...v1.3.1) (2026-10-23)


### Fixed

* **brand:** drop the final dot from the org card line, read card lines from the blueprint ([9746106](https://github.com/monte3l/m3l-design/commit/974610643442efcbee182d48c27ce19e3e7fa668))

## [1.3.0](https://github.com/monte3l/m3l-design/compare/v1.2.0...v1.3.0) (2026-10-23)


### Added

* **brand:** replace the E and 3 mark with two equal peaks ([8858999](https://github.com/monte3l/m3l-design/commit/885899951b1ff12f246d66c839bda85084b9f7bf))
* **docs-kit:** add a brand option for the favicon and header logo ([4b96328](https://github.com/monte3l/m3l-design/commit/4b96328e5c1c9ad8863b1fa56aebc1c773de5513))


### Fixed

* **brand:** describe the raster check in the brand README ([2fcddb1](https://github.com/monte3l/m3l-design/commit/2fcddb1a8a56cba03771d353f04776905160f95b))
* **docs-kit:** serve favicon.ico at the site root when brand is true ([50d5bf2](https://github.com/monte3l/m3l-design/commit/50d5bf2457f01aa93602a7fc194494c877d3ef79))

## [1.2.0](https://github.com/monte3l/m3l-design/compare/v1.1.0...v1.2.0) (2026-10-22)


### Added

* **brand:** add the MONTE3L logo and asset pack ([4b6da7a](https://github.com/monte3l/m3l-design/commit/4b6da7a063f336fbef731f9a29afa48dd208c244))

## [1.1.0] - 2026-10-20

### Added

- **Minor:** `source/docs-kit/`, the docs kit, in the payload. It builds a
  project's docs site from its Markdown and gates it: links and anchors, page
  coverage, `SHA256SUMS`, the vendored-tier marker, local CSS literals, alert
  runs, the manifest homepage and project parity modules. It also checks the
  deployed site byte for byte against the build. Contract:
  `source/docs-kit/README.md`.
  A page's leading YAML frontmatter (a skill or agent file) is not rendered.
- This repository's own docs site, design.monte3l.com: `docs.config.mjs`, the
  token reference and component gallery generators in `scripts/site/`, the
  doc-versus-payload parity check `scripts/doc-parity.mjs`, and the `docs` and
  `docs-live` workflows with their Cloudflare deploy tooling.

### Changed

- **Patch:** `source/brand-book.md` no longer uses italics, which its own rules
  forbid, and names `color-surface-default` and `color-text-primary` as its
  semantic-token examples, because `color-surface-primary` and
  `color-text-on-surface` do not exist.
- **Patch:** the Button and Input READMEs name `color-border-default` in full.
- `design/README.md` records the source tier.

## [1.0.0] - 2026-10-11

First release from this repository. It is the system's "v1, signed off
2026-09-26", which until now lived only in a claude.ai artifact
(version `1791621112-523a`).

### Added

- `source/`: the foundations (DTCG tokens plus `tokens.json`), seven components
  (Callout, CodeBlock, Badge, Button, Input, Card, Nav), the contrast tables and
  the fonts, as m3l-groundwork and m3l-prompt-optimizer already vendored them.
- `tokens.css`, generated from `source/dtcg/` by `bin/build-design-tokens.mjs`.
  The two consumers used to generate their own, in slightly different ways.
- `source/lib/design-tokens.mjs`, the single DTCG resolver.
- `SHA256SUMS`, to check offline that a copy is unedited.
- `bin/sync-design.sh`, to copy a release into a consumer.
- `source/LICENSE`, `source/AUTHORS.md` and `source/fonts/FONTLOG.md`, so the
  copyright notice and the font provenance travel with every copy.

### Changed

- Text and JSON in `source/` are formatted with Prettier 3.9.6, as both
  consumers already had them. The tokens are identical to the artifact's, which
  `jq -S .` confirms.
- `project/README.md` of the artifact is `source/brand-book.md`.

### Not carried over

- The artifact's own runtime files. The preview pages are kept in `artifact/`.

[1.1.0]: https://github.com/monte3l/m3l-design/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/monte3l/m3l-design/releases/tag/v1.0.0
