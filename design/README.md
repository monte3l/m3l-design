# design/ -- m3l-design, adopted

This repository **is** m3l-design, the design system of the `monte3l` GitHub
organization, so it adopts itself at the source tier: the repository root is the
release payload, its docs site (design.monte3l.com) builds straight from it, and
it follows the markdown rules.

- **Source:** [github.com/monte3l/m3l-design](https://github.com/monte3l/m3l-design)
- **Version adopted:** `v1.3.1` <!-- x-release-please-version -->
- **Tier:** source (builds from the repository root payload)
- **Credits:** Enrico Lionello (`enri3l`) and Giulia Montevecchi (`giulmonte`), for `monte3l`

## Markdown rules

| Rule | Why |
| --- | --- |
| **Bold**, not italics or underlines, for emphasis | Italics and underlines make text run together |
| A GitHub alert matched to the severity of the point, never more than two in a row | Each severity has its own glyph, so it survives without colour |
| `[!CAUTION]` only for data loss or anything irreversible | The Callout component's own rule |
| Plain, direct sentences | Part of the system's voice |
| Tabular data goes in a table | Easier to scan than a list pretending to be one |

## Governance

Copy-based, never a live dependency. The org standard is in the
[`.github` blueprint](https://github.com/monte3l/.github/blob/main/blueprint/README.md#design-system).
When a release changes the version, update the line above in the same commit.
