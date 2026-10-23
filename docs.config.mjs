// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

// m3l-design is the source of the design system, so its own site builds from
// the repository root payload (designDir ".") rather than a vendored copy.
export default {
  title: "m3l-design",
  repo: "https://github.com/monte3l/m3l-design",
  siteUrl: "https://design.monte3l.com",
  designDir: ".",
  marker: "design/README.md",
  brand: true,
  navGroups: ["Start", "Foundations", "Components", "Docs kit", "Project"],
  nav: [
    { href: "index.html", label: "Docs" },
    { href: "brand-book.html", label: "Brand book" },
    { href: "components/gallery.html", label: "Components" },
    { href: "https://github.com/monte3l/m3l-design", label: "GitHub" },
  ],
  pages: [
    { src: "README.md", out: "index.html", group: "Start", label: "Overview" },
    { src: "design/README.md", out: "design.html", group: "Start", label: "Adoption" },
    { src: "source/brand-book.md", out: "brand-book.html", group: "Foundations", label: "Brand book" },
    { src: "source/foundations/contrast.md", out: "contrast.html", group: "Foundations", label: "Contrast" },
    { src: "source/brand/README.md", out: "brand-assets.html", group: "Foundations", label: "Brand assets" },
    { src: "source/components/Badge/README.md", out: "components/badge.html", group: "Components", label: "Badge" },
    { src: "source/components/Button/README.md", out: "components/button.html", group: "Components", label: "Button" },
    { src: "source/components/Callout/README.md", out: "components/callout.html", group: "Components", label: "Callout" },
    { src: "source/components/Card/README.md", out: "components/card.html", group: "Components", label: "Card" },
    { src: "source/components/CodeBlock/README.md", out: "components/code-block.html", group: "Components", label: "CodeBlock" },
    { src: "source/components/Input/README.md", out: "components/input.html", group: "Components", label: "Input" },
    { src: "source/components/Nav/README.md", out: "components/nav.html", group: "Components", label: "Nav" },
    { src: "source/docs-kit/README.md", out: "docs-kit.html", group: "Docs kit", label: "Docs kit" },
    { src: "CHANGELOG.md", out: "CHANGELOG.html", group: "Project", label: "Releases" },
    { src: "CONTRIBUTING.md", out: "CONTRIBUTING.html", group: "Project", label: "Contributing" },
    { src: "SECURITY.md", out: "SECURITY.html", group: "Project", label: "Security policy" },
  ],
  exclude: [
    { glob: ".claude/**", reason: "Claude Code agents and skills for working in this repository" },
    { glob: "CLAUDE.md", reason: "instructions for coding agents, not reader-facing" },
    { glob: "docs/research/**", reason: "harness-guidance trackers for the Claude Code setup, not reader-facing" },
    { glob: ".groundwork/**", reason: "m3l-groundwork adoption and customization reports, not reader-facing" },
    { glob: "AUTHORS.md", reason: "credits file; source/AUTHORS.md is its payload copy" },
    { glob: "source/AUTHORS.md", reason: "credits file that travels with the payload" },
    { glob: "source/brand/LICENSE.md", reason: "license notice that travels with the brand files; linked from the brand assets page on GitHub" },
    { glob: "source/fonts/FONTLOG.md", reason: "font provenance, linked from the brand book on GitHub" },
  ],
  generators: ["scripts/site/tokens.mjs", "scripts/site/gallery.mjs"],
  parity: ["scripts/doc-parity.mjs"],
};
