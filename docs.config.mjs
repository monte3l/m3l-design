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
    { src: "README.md", out: "index.html", group: "Start", label: "Overview", summary: "What the design system is, what a release contains and how a repository adopts it" },
    { src: "design/README.md", out: "design.html", group: "Start", label: "Adoption", summary: "The marker this repository keeps to record that it follows its own design system" },
    { src: "source/brand-book.md", out: "brand-book.html", group: "Foundations", label: "Brand book", summary: "Voice, colour, type and logo rules for everything monte3l publishes" },
    { src: "source/foundations/contrast.md", out: "contrast.html", group: "Foundations", label: "Contrast", summary: "Contrast ratios for every text and surface colour pair, in both themes" },
    { src: "source/brand/README.md", out: "brand-assets.html", group: "Foundations", label: "Brand assets", summary: "The logo, favicon and social assets, and how they are generated" },
    { src: "source/components/Badge/README.md", out: "components/badge.html", group: "Components", label: "Badge", summary: "The Badge component: variants, states and markup" },
    { src: "source/components/Button/README.md", out: "components/button.html", group: "Components", label: "Button", summary: "The Button component: variants, states and markup" },
    { src: "source/components/Callout/README.md", out: "components/callout.html", group: "Components", label: "Callout", summary: "The Callout component, used for GitHub alerts: severities and markup" },
    { src: "source/components/Card/README.md", out: "components/card.html", group: "Components", label: "Card", summary: "The Card component: structure and markup" },
    { src: "source/components/CodeBlock/README.md", out: "components/code-block.html", group: "Components", label: "CodeBlock", summary: "The CodeBlock component: structure and markup" },
    { src: "source/components/Input/README.md", out: "components/input.html", group: "Components", label: "Input", summary: "The Input component: states and markup" },
    { src: "source/components/Nav/README.md", out: "components/nav.html", group: "Components", label: "Nav", summary: "The Nav component: horizontal and vertical navigation markup" },
    { src: "source/docs-kit/README.md", out: "docs-kit.html", group: "Docs kit", label: "Docs kit", summary: "The docs kit that builds and gates a repository docs site: config, checks and the versioning promise" },
    { src: "CHANGELOG.md", out: "CHANGELOG.html", group: "Project", label: "Releases", summary: "Every release of the design system and what changed in it" },
    { src: "CONTRIBUTING.md", out: "CONTRIBUTING.html", group: "Project", label: "Contributing", summary: "How to propose and make a change to the design system" },
    { src: "SECURITY.md", out: "SECURITY.html", group: "Project", label: "Security policy", summary: "How to report a vulnerability, and the findings already accepted" },
    { src: "GOVERNANCE.md", out: "GOVERNANCE.html", group: "Project", label: "Governance", summary: "Who decides what in the project, and how" },
    { src: "ROADMAP.md", out: "ROADMAP.html", group: "Project", label: "Roadmap", summary: "What is planned next and what is deliberately out of scope" },
    { src: "docs/decisions/README.md", out: "decisions.html", group: "Project", label: "Decisions", summary: "The decisions that shaped the design system, and why" },
    { src: "docs/architecture.md", out: "architecture.html", group: "Project", label: "Architecture", summary: "How the tokens, resolver, components and docs kit fit together" },
    { src: "docs/assurance-case.md", out: "assurance-case.html", group: "Project", label: "Assurance case", summary: "The argument and evidence that the design system meets its security and quality claims" },
  ],
  exclude: [
    { glob: "docs/decisions/0000-template.md", reason: "decision-record skeleton with placeholders, copied rather than read" },
    { glob: ".claude/**", reason: "Claude Code agents and skills for working in this repository" },
    { glob: "CLAUDE.md", reason: "instructions for coding agents, not reader-facing" },
    { glob: "docs/research/**", reason: "harness-guidance trackers for the Claude Code setup, not reader-facing" },
    { glob: ".groundwork/**", reason: "m3l-groundwork adoption and customization reports, not reader-facing" },
    { glob: "AUTHORS.md", reason: "credits file; source/AUTHORS.md is its payload copy" },
    { glob: "source/AUTHORS.md", reason: "credits file that travels with the payload" },
    { glob: "avatars/README.md", reason: "the founders' personal GitHub avatars, which are not part of the design system's docs" },
    { glob: "source/brand/LICENSE.md", reason: "licence notice that travels with the brand files; linked from the brand assets page on GitHub" },
    { glob: "source/fonts/FONTLOG.md", reason: "font provenance, linked from the brand book on GitHub" },
  ],
  // For agents: a markdown copy of every page, llms.txt (llmstxt.org), llms-full.txt and a sitemap.
  llms: {
    description: "The monte3l design system: tokens, components, brand rules and the docs kit, copied into every monte3l repository from a published release.",
    optionalGroups: ["Project"],
    full: true,
  },
  sitemap: true,
  generators: ["scripts/site/tokens.mjs", "scripts/site/gallery.mjs"],
  parity: ["scripts/doc-parity.mjs"],
};
