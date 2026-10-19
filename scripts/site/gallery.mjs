// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

/**
 * Docs-kit generator: the component gallery. Each section is the markup of
 * `artifact/components/<Name>/preview.html`, so the live demo is the same
 * markup the artifact preview renders. The site's CSP allows no script and no
 * event handler, so a preview that uses either fails the build rather than
 * silently rendering inert. Inline `style=""` (also blocked) is stripped: the
 * previews use it only to lay demos out side by side. A demo's dummy `#anchor` links point at the gallery itself.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/**
 * @param {string} name component directory name, for the message
 * @param {string} html a full preview document
 * @returns {{ body: string, problems: string[] }}
 */
export function previewBody(name, html) {
  const problems = [];
  const match = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  if (!match) return { body: "", problems: [`${name}/preview.html: no <body>`] };
  const body = match[1].replace(/\sstyle\s*=\s*"[^"]*"/gi, "").replace(/\shref="#[^"]*"/g, ' href="#component-gallery"').trim();
  if (/<script\b/i.test(body)) problems.push(`${name}/preview.html: <script> is blocked by the site CSP`);
  if (/\son[a-z]+\s*=/i.test(body)) problems.push(`${name}/preview.html: an on*= handler is blocked by the site CSP`);
  return { body, problems };
}

const kebab = (name) => name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

export default async function generate({ root }) {
  const dir = path.join(root, "artifact/components");
  const names = (await readdir(path.join(root, "source/components"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  let html = `<h1 id="component-gallery">Component gallery</h1>\n<p class="body">Each demo is the markup of the component's preview, styled by the same <code class="code m3l-code-inline">bundle.css</code> the site itself uses.</p>\n`;
  const problems = [];
  for (const name of names) {
    let source;
    try {
      source = await readFile(path.join(dir, name, "preview.html"), "utf8");
    } catch {
      continue;
    }
    const { body, problems: found } = previewBody(name, source);
    problems.push(...found);
    html += `<h2 id="${kebab(name)}">${name}</h2>\n<p class="body"><a class="m3l-link" href="${kebab(name)}.html">${name} reference</a></p>\n<div>\n${body}\n</div>\n`;
  }
  if (problems.length > 0) throw new Error(`component gallery: ${problems.join("; ")}`);
  return [{ out: "components/gallery.html", group: "Components", label: "Gallery", html }];
}
