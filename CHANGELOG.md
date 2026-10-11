# Changelog

All notable changes to m3l-design. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/monte3l/m3l-design/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/monte3l/m3l-design/releases/tag/v1.0.0
