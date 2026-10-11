#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

/**
 * Generates the two derived files of the m3l-design payload from its DTCG
 * source (`source/dtcg/`), using the resolver in `source/lib/design-tokens.mjs`:
 *
 *   - `tokens.css`  light/dark custom properties, the non-colour scale,
 *                   `@font-face` rules and one `.<style>` class per type style.
 *   - `SHA256SUMS`  the sha256 of every file under `source/` and of
 *                   `tokens.css`, in `sha256sum -c` format, so a consumer can
 *                   check offline that its copy is unedited.
 *
 * `--check` regenerates both in memory and fails (without writing) if either
 * differs from what is on disk, or if `SHA256SUMS` is stale. Plain
 * `node bin/build-design-tokens.mjs` writes them. Paths are relative to the
 * repository root, which is also the layout of a consumer's `design/`.
 */
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  DesignTokenError,
  loadDesignSystem,
  resolveTheme,
  requireLeafValue,
  deriveTypeTreatment,
  flattenFamily,
  flattenColors,
  formatDimension,
  formatEasing,
  formatShadow,
  STYLE_NAMES,
  MONO_STYLES,
} from "../source/lib/design-tokens.mjs";

const repoRoot = () => path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// REUSE-IgnoreStart -- these strings are the tokens.css banner, not this file's own tags
const GENERATED_BANNER_LINES = [
  "SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l",
  "SPDX-License-Identifier: MIT",
  "",
  "GENERATED FILE -- do not hand-edit. Part of m3l-design, the design system of",
  "monte3l (https://github.com/monte3l/m3l-design), made by Enrico Lionello and",
  "Giulia Montevecchi. Update it with bin/sync-design.sh from a clone of that",
  "repository, never by editing this copy.",
];
// REUSE-IgnoreEnd

/** Formats an em-unit number the way m3l-design's own tokens do: `0`, never `0em`. */
function formatEm(value) {
  return value === 0 ? "0" : `${value}em`;
}

/** Renders one `:root`-scoped block of `--name: value;` declarations. */
function renderVars(tokens, indent = "  ") {
  return tokens
    .map(({ name, value }) => `${indent}--${name}: ${value};`)
    .join("\n");
}

/** Renders a `@font-face`-suitable font-family list from a resolved `font-family.*` value. */
function renderFontFamilyList(value) {
  if (!Array.isArray(value)) {
    throw new DesignTokenError(
      `not a DTCG fontFamily value: ${JSON.stringify(value)}`,
    );
  }
  return value
    .map((name) => (name.includes(" ") ? `"${name}"` : name))
    .join(", ");
}

/** Renders the non-color, theme-invariant custom properties shared by every theme. */
function renderSharedVars(light, text) {
  const families = [
    flattenFamily(light, "space", "space", formatDimension),
    flattenFamily(light, "radius", "radius", formatDimension),
    flattenFamily(light, "duration", "duration", formatDimension),
    flattenFamily(light, "easing", "easing", formatEasing),
    flattenFamily(light, "breakpoint", "breakpoint", formatDimension),
    flattenFamily(light, "z-index", "z-index", (v) => String(v)),
    flattenFamily(light, "border-width", "border-width", formatDimension),
    flattenFamily(light, "focus-ring", "focus-ring", formatDimension),
    flattenFamily(light, "measure", "measure", formatDimension),
    flattenFamily(light, "shape", "shape", formatDimension),
    flattenFamily(light, "inset", "inset", formatDimension),
  ].flat();

  const paragraphSpacingNode = light["paragraph-spacing"];
  const paragraphSpacingEm =
    paragraphSpacingNode?.$extensions?.["org.monte3l.m3l-design"]?.em;
  if (paragraphSpacingEm === undefined) {
    throw new DesignTokenError(
      "source/dtcg: semantic.tokens.json's paragraph-spacing has no org.monte3l.m3l-design.em extension",
    );
  }

  const lines = [
    ...families.map(({ name, value }) => `  --${name}: ${value};`),
    `  --paragraph-spacing: ${formatEm(paragraphSpacingEm)};`,
    `  --font-sans: ${renderFontFamilyList(requireLeafValue(light, "font-family.sans"))};`,
    `  --font-mono: ${renderFontFamilyList(requireLeafValue(light, "font-family.mono"))};`,
    `  --text-align: ${text.textAlign};`,
    `  --text-emphasis-style: ${text.fontStyle};`,
    `  --text-emphasis-weight: ${text.emphasisWeight};`,
    `  --text-line-height: ${text.lineHeight};`,
    `  --text-word-spacing: ${formatEm(text.wordSpacing)};`,
    `  --font-variant-numeric: ${text.fontVariantNumeric};`,
    `  --font-variant-ligatures: ${text.fontVariantLigatures};`,
    ...[...text.letterSpacing.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(
        ([weight, em]) => `  --text-letter-spacing-${weight}: ${formatEm(em)};`,
      ),
  ];
  return lines.join("\n");
}

/** Renders one `.<style-name>` type-style class. */
function renderStyleClass(name, text) {
  const style = text.styles.get(name);
  const family = MONO_STYLES.has(name) ? "mono" : "sans";
  return [
    `.${name} {`,
    `  font-family: var(--font-${family});`,
    `  font-size: ${formatDimension(style.value.fontSize)};`,
    `  font-weight: ${style.value.fontWeight};`,
    `  line-height: var(--text-line-height);`,
    `  letter-spacing: ${formatEm(style.letterSpacingEm)};`,
    `  font-style: var(--text-emphasis-style);`,
    `  font-variant-numeric: var(--font-variant-numeric);`,
    `  font-variant-ligatures: var(--font-variant-ligatures);`,
    `  text-align: var(--text-align);`,
    `  word-spacing: ${formatEm(style.ext.wordSpacingEm)};`,
    `}`,
  ].join("\n");
}

const FONT_FACES = [
  {
    family: "Atkinson Hyperlegible Next",
    file: "fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2",
  },
  {
    family: "Atkinson Hyperlegible Mono",
    file: "fonts/atkinson-hyperlegible-mono-latin-wght-normal.woff2",
  },
];
const FONT_WEIGHT_RANGE = "200 800";

/**
 * Renders one `@font-face` rule. `file` is a path relative to `source/`
 * (`fonts/atkinson-…-normal.woff2`). The URL is relative to this file, so it
 * resolves the same in this repository and in a consumer's `design/`.
 */
function renderFontFace({ family, file }) {
  return [
    `@font-face {`,
    `  font-family: "${family}";`,
    `  src: url("source/${file}") format("woff2");`,
    `  font-weight: ${FONT_WEIGHT_RANGE};`,
    `  font-style: normal;`,
    `  font-display: swap;`,
    `}`,
  ].join("\n");
}

/** Builds the full `tokens.css` text from the three already-resolved themed trees. */
function buildTokensCss({ light, dark, reduced }) {
  const text = deriveTypeTreatment(light);

  const lightColors = flattenColors(light);
  const darkColors = flattenColors(dark);
  const lightShadows = flattenFamily(light, "shadow", "shadow", formatShadow);
  const darkShadows = flattenFamily(dark, "shadow", "shadow", formatShadow);
  const reducedDurations = flattenFamily(
    reduced,
    "duration",
    "duration",
    formatDimension,
  );

  const styleClasses = STYLE_NAMES.map((name) =>
    renderStyleClass(name, text),
  ).join("\n\n");
  const fontFaces = FONT_FACES.map(renderFontFace).join("\n\n");

  const cssBanner = [
    ...GENERATED_BANNER_LINES,
    "",
    "Source of truth: source/dtcg (DTCG 2025.10), next to this file.",
  ]
    .map((line) => (line === "" ? "" : `   ${line}`))
    .join("\n");

  return `/*
${cssBanner}
*/

${fontFaces}

:root, [data-theme="light"] {
${renderVars(lightColors)}
${renderVars(lightShadows)}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${renderVars(darkColors, "    ")}
${renderVars(darkShadows, "    ")}
  }
}

[data-theme="dark"] {
${renderVars(darkColors)}
${renderVars(darkShadows)}
}

:root {
${renderSharedVars(light, text)}
}

@media (prefers-reduced-motion: reduce) {
  :root {
${renderVars(reducedDurations, "    ")}
  }
}

${styleClasses}
`;
}

/** Every file under `dir`, as repository-relative POSIX paths, sorted by byte order. */
async function listFiles(root, dir) {
  const found = [];
  for (const entry of await readdir(path.join(root, dir), {
    withFileTypes: true,
  })) {
    if (entry.name.startsWith(".")) continue;
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) found.push(...(await listFiles(root, rel)));
    else found.push(rel);
  }
  return found.sort();
}

/**
 * Builds `SHA256SUMS` in `sha256sum -c` format ("<hex>  <path>"). It covers
 * `source/**` and the generated `tokens.css` (passed in, because under
 * `--check` it is compared in memory, not yet on disk).
 */
async function buildSums(root, tokensCss) {
  const lines = [];
  for (const rel of await listFiles(root, "source")) {
    const hash = createHash("sha256")
      .update(await readFile(path.join(root, rel)))
      .digest("hex");
    lines.push(`${hash}  ${rel}`);
  }
  const cssHash = createHash("sha256").update(tokensCss, "utf8").digest("hex");
  lines.push(`${cssHash}  tokens.css`);
  return `${lines.sort((a, b) => (a.slice(66) < b.slice(66) ? -1 : 1)).join("\n")}\n`;
}

/**
 * Regenerates (or, under `--check`, diffs without writing) one generated
 * file. Returns whether the file was found current (`--check` only; always
 * `true` when writing).
 */
async function syncGeneratedFile(root, filePath, content, check) {
  const relPath = path.relative(root, filePath);
  if (check) {
    let existing;
    try {
      existing = await readFile(filePath, "utf8");
    } catch (cause) {
      if (cause.code !== "ENOENT") throw cause;
      existing = null;
    }
    if (existing !== content) {
      console.error(
        `fail  ${relPath} is out of date -- run \`node bin/build-design-tokens.mjs\` and commit the result`,
      );
      return false;
    }
    console.log(`  ok  ${relPath} is current`);
    return true;
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
  console.log(`wrote ${relPath}`);
  return true;
}

async function main() {
  const root = repoRoot();
  const check = process.argv.includes("--check");
  const system = await loadDesignSystem(path.join(root, "source/dtcg"));

  const trees = {
    light: resolveTheme(system, "light", "default"),
    dark: resolveTheme(system, "dark", "default"),
    reduced: resolveTheme(system, "light", "reduced"),
  };

  const tokensCss = buildTokensCss(trees);
  const results = [
    await syncGeneratedFile(
      root,
      path.join(root, "tokens.css"),
      tokensCss,
      check,
    ),
    await syncGeneratedFile(
      root,
      path.join(root, "SHA256SUMS"),
      await buildSums(root, tokensCss),
      check,
    ),
  ];

  if (check && results.some((current) => !current)) {
    process.exitCode = 1;
  }
}

await main();
