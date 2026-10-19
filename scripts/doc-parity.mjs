// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

/**
 * m3l-design's documentation-versus-payload parity, run by the docs kit's
 * `--check` (listed in `docs.config.mjs` `parity`). It fails when:
 *
 * - a `.m3l-*` block in `bundle.css` has no component README, no
 *   `artifact/components/<Name>/preview.html`, or the reverse;
 * - a token named in a code span in the brand book, the contrast tables or a
 *   component README is not declared in `tokens.css`;
 * - the newest released version in CHANGELOG.md is not the version
 *   `design/README.md` records.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { assertSame, assertSameSet, codeSpans } from "../source/docs-kit/lib/parity.mjs";

/** Classes in `bundle.css` that are helpers or parts of a component, not components. */
export const HELPER_CLASSES = new Set([
  "icon", "prose", "link", "code-inline", "code-strong", "code-comment",
  "visually-hidden", "stack", "row", "field",
]);

const TOKEN_PREFIX = /^(?:--)?((?:color|space|inset|gap|radius|font|text|line|measure|letter|duration|easing|motion|shadow|z-index|border|focus|breakpoint)-[a-z0-9-]+)$/;

const kebab = (name) => name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

/**
 * @param {string} css bundle.css
 * @returns {Set<string>} block names (`callout`, `code-block`, ...) used as `.m3l-<block>`
 */
export function bundleBlocks(css) {
  const blocks = new Set();
  for (const [, name] of css.matchAll(/\.m3l-([a-z]+(?:-[a-z]+)*)(?![a-z_-])/g)) blocks.add(name);
  return blocks;
}

/** @param {string} css tokens.css @returns {Set<string>} */
export function declaredTokens(css) {
  return new Set([...css.matchAll(/--([\w-]+)\s*:/g)].map((m) => m[1]));
}

/** @param {string} changelog @returns {string | null} newest released version, without the `v` */
export function latestRelease(changelog) {
  const match = /^## \[(\d+\.\d+\.\d+)\]/m.exec(changelog);
  return match ? match[1] : null;
}

export default async function parity({ root }) {
  const problems = [];
  const read = (rel) => readFile(path.join(root, rel), "utf8");

  const componentDirs = (await readdir(path.join(root, "source/components"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const previewDirs = [];
  for (const entry of await readdir(path.join(root, "artifact/components"), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      await readFile(path.join(root, "artifact/components", entry.name, "preview.html"));
      previewDirs.push(entry.name);
    } catch {
      problems.push(`artifact/components/${entry.name}: has no preview.html`);
    }
  }
  const documented = componentDirs;
  const blocks = [...bundleBlocks(await read("source/components/bundle.css"))].filter((b) => !HELPER_CLASSES.has(b));
  problems.push(
    ...assertSameSet("components in bundle.css vs source/components/*/README.md", documented.map(kebab), blocks),
    ...assertSameSet("source/components vs artifact/components previews (Cover is preview-only)", documented, previewDirs.filter((n) => n !== "Cover")),
  );
  for (const name of documented) {
    try {
      await readFile(path.join(root, "source/components", name, "README.md"));
    } catch {
      problems.push(`source/components/${name}: has no README.md`);
    }
  }

  const tokens = declaredTokens(await read("tokens.css"));
  const docs = ["source/brand-book.md", "source/foundations/contrast.md", ...documented.map((n) => `source/components/${n}/README.md`)];
  for (const rel of docs) {
    for (const span of codeSpans(await read(rel))) {
      const match = TOKEN_PREFIX.exec(span);
      if (match && !tokens.has(match[1])) problems.push(`${rel}: \`${span}\` is not a token in tokens.css`);
    }
  }

  const released = latestRelease(await read("CHANGELOG.md"));
  const marker = /^- \*\*Version adopted:\*\* `v([^`]+)`/m.exec(await read("design/README.md"))?.[1] ?? null;
  problems.push(...assertSame("latest CHANGELOG release vs design/README.md Version adopted", marker, released));
  return problems;
}
