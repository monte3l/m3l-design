// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

/**
 * Docs-kit generator: the token reference page. It reads the generated
 * `tokens.css`, so the page can only ever show what the payload ships. Colour
 * swatches are inline SVG (`fill="var(--token)"`), because the site's CSP
 * allows no inline `style`.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/**
 * Top-level (depth 0, non-`@`) rules of a stylesheet.
 *
 * @param {string} css
 * @returns {Array<{ selector: string, body: string }>}
 */
export function topLevelRules(css) {
  const rules = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let depth = 0;
  let start = 0;
  let selector = "";
  let bodyStart = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "{") {
      if (depth === 0) {
        selector = text.slice(start, i).trim();
        bodyStart = i + 1;
      }
      depth += 1;
    } else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        if (!selector.startsWith("@")) rules.push({ selector, body: text.slice(bodyStart, i) });
        start = i + 1;
      }
    }
  }
  return rules;
}

/**
 * Custom properties declared by the top-level rules whose selector is one of
 * `selectors`, later rules winning.
 *
 * @param {string} css
 * @param {string[]} selectors exact selector lists, whitespace-normalised
 * @returns {Map<string, string>}
 */
export function declarations(css, selectors) {
  const out = new Map();
  const wanted = new Set(selectors.map((sel) => sel.replace(/\s+/g, " ")));
  for (const { selector, body } of topLevelRules(css)) {
    if (!wanted.has(selector.replace(/\s+/g, " "))) continue;
    for (const [, name, value] of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out.set(name, value.trim());
  }
  return out;
}

const GROUPS = [
  ["Colour", /^color-/],
  ["Space", /^(space|inset|gap)-/],
  ["Radius", /^radius-/],
  ["Type", /^(font|text|line|measure|letter)-/],
  ["Motion", /^(duration|easing|motion)-/],
  ["Elevation and layers", /^(shadow|z-index|border|focus)-/],
  ["Breakpoints", /^breakpoint-/],
];

export default async function generate({ root }) {
  const css = await readFile(path.join(root, "tokens.css"), "utf8");
  const shared = ":root";
  const light = declarations(css, [shared, ':root, [data-theme="light"]']);
  const dark = new Map([...light, ...declarations(css, ['[data-theme="dark"]'])]);
  const names = [...light.keys()];
  const seen = new Set();
  let html = `<h1 id="token-reference">Token reference</h1>\n<p class="body">Every custom property in <code class="code m3l-code-inline">tokens.css</code>, generated from the release payload. A value that differs in dark mode shows both.</p>\n`;
  for (const [title, test] of GROUPS) {
    const rows = names.filter((name) => test.test(name));
    if (rows.length === 0) continue;
    rows.forEach((name) => seen.add(name));
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    html += `<h2 id="${id}">${esc(title)}</h2>\n<table>\n<thead><tr><th>Token</th><th>Light</th><th>Dark</th></tr></thead>\n<tbody>\n`;
    for (const name of rows) {
      const lv = light.get(name);
      const dv = dark.get(name) ?? lv;
      const swatch = (value) =>
        title === "Colour"
          ? `<svg class="m3l-icon" width="16" height="16" viewBox="0 0 16 16" role="img" aria-label="${esc(value)}"><rect width="16" height="16" rx="3" fill="${esc(value)}" stroke="currentColor" stroke-opacity=".35"/></svg> `
          : "";
      html += `<tr><td><code class="code m3l-code-inline">--${esc(name)}</code></td><td>${swatch(lv)}<code class="code m3l-code-inline">${esc(lv)}</code></td><td>${dv === lv ? "same" : `${swatch(dv)}<code class="code m3l-code-inline">${esc(dv)}</code>`}</td></tr>\n`;
    }
    html += `</tbody>\n</table>\n`;
  }
  const rest = names.filter((name) => !seen.has(name));
  if (rest.length > 0) {
    html += `<h2 id="other">Other</h2>\n<ul>\n${rest.map((n) => `<li><code class="code m3l-code-inline">--${esc(n)}</code>: <code class="code m3l-code-inline">${esc(light.get(n))}</code></li>`).join("\n")}\n</ul>\n`;
  }
  return [{ out: "tokens.html", group: "Foundations", label: "Token reference", html }];
}
