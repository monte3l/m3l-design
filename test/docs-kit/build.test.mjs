// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

/**
 * End to end: `build.mjs --check` run as a child process inside a throwaway
 * git repository holding a tiny vendored design directory. Each case starts
 * from the same clean fixture, breaks one thing and asserts the exit code
 * and message.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";

const BUILD = path.join(import.meta.dirname, "..", "..", "source", "docs-kit", "build.mjs");
const SITE_URL = "https://docs.example.com";
const sha = (text) => createHash("sha256").update(text).digest("hex");

const CONFIG = `export default {
  title: "Fixture",
  repo: "https://github.com/acme/fixture",
  siteUrl: "${SITE_URL}",
  designDir: "design",
  navGroups: ["Start"],
  pages: [{ src: "README.md", out: "index.html", group: "Start", label: "Home" }],
  exclude: [{ glob: "design/README.md", reason: "design adoption marker" }],
  manifest: "package.json",
};
`;

const roots = [];
after(() => Promise.all(roots.map((root) => rm(root, { recursive: true, force: true }))));

async function put(root, rel, text) {
  await mkdir(path.dirname(path.join(root, rel)), { recursive: true });
  await writeFile(path.join(root, rel), text);
}

const git = (root, ...args) =>
  spawnSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false", ...args], {
    cwd: root,
    encoding: "utf8",
  });

const BRAND_FILES = [
  "favicon/favicon.ico",
  "favicon/favicon.svg",
  "favicon/apple-touch-icon.png",
  "logo/symbol-light.svg",
  "logo/symbol-dark.svg",
];

/** A clean repository: `--check` exits 0 on it. `brand` turns on the brand option and adds its files. */
async function fixture({ brand = false, brandFiles = brand } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "m3l-docs-e2e-"));
  roots.push(root);
  const design = {
    "tokens.css": ":root { --color-text: #111; }\n",
    "source/components/bundle.css": ".m3l-badge { color: var(--color-text); }\n",
    "source/fonts/x.woff2": "not really a font",
    ...(brandFiles ? Object.fromEntries(BRAND_FILES.map((rel) => [`source/brand/${rel}`, `brand ${rel}`])) : {}),
  };
  for (const [rel, text] of Object.entries(design)) await put(root, `design/${rel}`, text);
  await put(root, "design/SHA256SUMS", Object.entries(design).map(([rel, text]) => `${sha(text)}  ${rel}\n`).join(""));
  await put(root, "design/README.md", "# Adoption\n\n- **Version copied:** `v1.0.0`\n");
  await put(root, "README.md", "# Fixture\n\nPlain **bold** text and a [file](design/tokens.css).\n");
  await put(root, "package.json", JSON.stringify({ name: "fixture", homepage: SITE_URL }));
  await put(root, "docs.config.mjs", brand ? CONFIG.replace("  manifest:", "  brand: true,\n  manifest:") : CONFIG);
  assert.equal(git(root, "init", "-q").status, 0);
  assert.equal(git(root, "add", "-A").status, 0);
  return root;
}

function check(root, ...extra) {
  return spawnSync(process.execPath, [BUILD, "--check", ...extra], { cwd: root, encoding: "utf8" });
}

/** Asserts a failing check: exit 1 and `needle` in the report. */
function assertFails(result, needle, code = 1) {
  assert.equal(result.status, code, `stdout: ${result.stdout}\nstderr: ${result.stderr}`);
  assert.ok(result.stderr.includes(needle), `expected "${needle}" in:\n${result.stderr}`);
}

describe("build.mjs --check end to end", () => {
  it("exits 0 for the clean fixture", async () => {
    const result = check(await fixture());
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /docs site builds cleanly/);
  });

  it("writes the site with --out", async () => {
    const root = await fixture();
    const result = spawnSync(process.execPath, [BUILD, "--out", "_site"], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const html = await readFile(path.join(root, "_site/index.html"), "utf8");
    assert.match(html, /<h1 id="fixture"/);
    assert.match(await readFile(path.join(root, "_site/_headers"), "utf8"), /Content-Security-Policy/);
    await readFile(path.join(root, "_site/assets/source/fonts/x.woff2"));
  });

  it("shows the site name once when the page title is the site name, and after the page title otherwise", async () => {
    const root = await fixture();
    await put(root, "README.md", "# Fixture\n\nHome.\n\n[more](docs/more.md)\n");
    await put(root, "docs/more.md", "# More\n\nA second page.\n");
    await put(
      root,
      "docs.config.mjs",
      CONFIG.replace(
        `pages: [{ src: "README.md", out: "index.html", group: "Start", label: "Home" }]`,
        `pages: [{ src: "README.md", out: "index.html", group: "Start", label: "Home" }, { src: "docs/more.md", out: "more.html", group: "Start", label: "More" }]`,
      ),
    );
    git(root, "add", "-A");
    assert.equal(spawnSync(process.execPath, [BUILD, "--out", "_site"], { cwd: root, encoding: "utf8" }).status, 0);
    assert.match(await readFile(path.join(root, "_site/index.html"), "utf8"), /<title>Fixture<\/title>/);
    assert.match(await readFile(path.join(root, "_site/more.html"), "utf8"), /<title>More · Fixture<\/title>/);
  });

  it("adds no favicon or logo unless brand is true", async () => {
    const root = await fixture();
    assert.equal(spawnSync(process.execPath, [BUILD, "--out", "_site"], { cwd: root, encoding: "utf8" }).status, 0);
    const html = await readFile(path.join(root, "_site/index.html"), "utf8");
    assert.doesNotMatch(html, /rel="icon"|m3l-site-brand/);
    await assert.rejects(readFile(path.join(root, "_site/favicon.ico")), { code: "ENOENT" });
  });

  it("adds the favicon links, the header logo and the files when brand is true", async () => {
    const root = await fixture({ brand: true });
    const result = spawnSync(process.execPath, [BUILD, "--out", "_site"], { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const html = await readFile(path.join(root, "_site/index.html"), "utf8");
    const ico = html.indexOf('rel="icon" href="assets/brand/favicon/favicon.ico" sizes="any"');
    const svg = html.indexOf('rel="icon" href="assets/brand/favicon/favicon.svg" type="image/svg+xml"');
    assert.ok(ico !== -1 && svg > ico, "the ICO link comes first, then the SVG");
    assert.match(html, /rel="apple-touch-icon" href="assets\/brand\/favicon\/apple-touch-icon\.png"/);
    assert.match(html, /<a class="m3l-site-brand" href="index\.html"><img [^>]*symbol-light\.svg" alt="MONTE3L"[^>]*><img [^>]*symbol-dark\.svg" alt="MONTE3L"/);
    for (const rel of BRAND_FILES) await readFile(path.join(root, "_site/assets/brand", rel));
    assert.equal(
      await readFile(path.join(root, "_site/favicon.ico"), "utf8"),
      "brand favicon/favicon.ico",
      "favicon.ico is also served at the site root",
    );
    const notFound = await readFile(path.join(root, "_site/404.html"), "utf8");
    assert.match(notFound, /href="\/assets\/brand\/favicon\/favicon\.svg"/);
    assert.match(notFound, /<a class="m3l-site-brand" href="\/index\.html">/);
    assert.match(await readFile(path.join(root, "_site/_headers"), "utf8"), /img-src 'self';/);
  });

  it("passes --check when brand is true and every brand file is present", async () => {
    const result = check(await fixture({ brand: true }));
    assert.equal(result.status, 0, result.stderr);
  });

  it("fails when brand is true but the design directory has no brand files", async () => {
    const root = await fixture({ brand: true, brandFiles: false });
    assertFails(check(root), `"brand" is true but design/source/brand/favicon/favicon.ico is missing`);
    const out = spawnSync(process.execPath, [BUILD, "--out", "_site"], { cwd: root, encoding: "utf8" });
    assertFails(out, `"brand" is true`, 2);
  });

  it("fails on tracked Markdown that is neither a page nor excluded in the config", async () => {
    const root = await fixture();
    await put(root, "NOTES.md", "# Notes\n");
    git(root, "add", "NOTES.md");
    assertFails(check(root), "NOTES.md: tracked Markdown is neither a page nor excluded");
  });

  it("fails on an italic span", async () => {
    const root = await fixture();
    await put(root, "README.md", "# Fixture\n\nSome *emphasis* here.\n");
    assertFails(check(root), "italic emphasis found");
  });

  it("fails on an edited design byte", async () => {
    const root = await fixture();
    await put(root, "design/tokens.css", ":root { --color-text: #112; }\n");
    assertFails(check(root), "design: tokens.css does not match SHA256SUMS");
  });

  it("fails on a hex literal in design/local", async () => {
    const root = await fixture();
    await put(root, "design/local/x.css", ".a {\n  color: #fff;\n}\n");
    assertFails(check(root), "design/local/x.css:2: a hex colour");
  });

  it("fails on three alerts in a row", async () => {
    const root = await fixture();
    const alert = (kind) => `> [!${kind}]\n> text\n\n`;
    await put(root, "README.md", `# Fixture\n\n${alert("NOTE")}${alert("TIP")}${alert("WARNING")}`);
    assertFails(check(root), "README.md: more than two GitHub alerts in a row");
  });

  it("fails on a manifest homepage that is not the site URL", async () => {
    const root = await fixture();
    await put(root, "package.json", JSON.stringify({ homepage: "https://elsewhere.dev" }));
    assertFails(check(root), `package.json: homepage is "https://elsewhere.dev", the site is ${SITE_URL}`);
  });

  it("fails on a broken link", async () => {
    const root = await fixture();
    await put(root, "README.md", "# Fixture\n\nSee [gone](missing.md).\n");
    assertFails(check(root), `README.md: link target does not exist in the repo: "missing.md"`);
  });

  it("fails on a broken same-page anchor", async () => {
    const root = await fixture();
    await put(root, "README.md", "# Fixture\n\nSee [up](#nowhere).\n");
    assertFails(check(root), `broken same-page anchor "#nowhere"`);
  });

  it("fails on a disallowed link scheme", async () => {
    const root = await fixture();
    await put(root, "README.md", "# Fixture\n\nSee [x](ftp://example.com/x).\n");
    assertFails(check(root), "disallowed link scheme");
  });

  it("merges the messages of a failing parity module, prefixed with its path", async () => {
    const root = await fixture();
    await put(root, "parity.mjs", `export default async ({ root }) => ["drift one", "drift two"];\n`);
    await put(root, "docs.config.mjs", CONFIG.replace("manifest:", `parity: ["parity.mjs"],\n  manifest:`));
    const result = check(root);
    assertFails(result, "parity.mjs: drift one");
    assert.ok(result.stderr.includes("parity.mjs: drift two"));
  });

  it("reports a parity module that does not default-export a function", async () => {
    const root = await fixture();
    await put(root, "parity.mjs", `export const notDefault = 1;\n`);
    await put(root, "docs.config.mjs", CONFIG.replace("manifest:", `parity: ["parity.mjs"],\n  manifest:`));
    assertFails(check(root), "a parity module must default-export");
  });

  it("takes a generated page's title from text only, whatever tags the heading nests", async () => {
    const root = await fixture();
    await put(root, "gen.mjs", `export default async () => [{ out: "gen.html", group: "Start", label: "Gen", html: '<h1 id="t"><<b>script>x</b>y</h1>' }];\n`);
    await put(root, "docs.config.mjs", CONFIG.replace("manifest:", `generators: ["gen.mjs"],\n  manifest:`));
    const out = spawnSync(process.execPath, [BUILD, "--out", "_site"], { cwd: root, encoding: "utf8" });
    assert.equal(out.status, 0, out.stderr);
    const page = await readFile(path.join(root, "_site/gen.html"), "utf8");
    const title = /<title>([^<]*)<\/title>/.exec(page);
    assert.ok(title, "the title element holds no markup");
    assert.ok(title[1].startsWith("scriptxy"), title[1]);
  });

  it("lists an italic span once", async () => {
    const root = await fixture();
    await put(root, "README.md", "# Home\n\nsome *italic* here and *italic* again\n");
    const result = check(root);
    assertFails(result, "*italic*");
    assert.equal(result.stderr.split("*italic*").length - 1, 1);
  });

  it("reports every problem in one run", async () => {
    const root = await fixture();
    await put(root, "README.md", "# Fixture\n\n*x* [gone](missing.md)\n");
    await put(root, "package.json", JSON.stringify({ homepage: "" }));
    const result = check(root);
    assertFails(result, "italic emphasis found");
    assert.ok(result.stderr.includes("link target does not exist"));
    assert.ok(result.stderr.includes("homepage is"));
  });

  it("exits 2 for an invalid config", async () => {
    const root = await fixture();
    await put(root, "docs.config.mjs", CONFIG.replace(`title: "Fixture"`, `title: ""`));
    assertFails(check(root), `"title" must be a non-empty string`, 2);
  });

  it("exits 2 for a missing config and for a bad command line", async () => {
    const root = await fixture();
    assertFails(check(root, "--config", "nope.mjs"), "cannot load", 2);
    const noMode = spawnSync(process.execPath, [BUILD], { cwd: root, encoding: "utf8" });
    assertFails(noMode, "pass --out <dir>, or --check", 2);
    const both = spawnSync(process.execPath, [BUILD, "--check", "--out", "x"], { cwd: root, encoding: "utf8" });
    assertFails(both, "exclusive", 2);
  });
});

const ONE_PAGE = `pages: [{ src: "README.md", out: "index.html", group: "Start", label: "Home" }],`;
const TWO_PAGES = `pages: [{ src: "README.md", out: "index.html", group: "Start", label: "Home", summary: "The home page" }, { src: "docs/more.md", out: "more.html", group: "Start", label: "More" }],`;

/** A fixture with two pages that link to each other, plus `extra` config lines. */
async function agentFixture(extra = "") {
  const root = await fixture();
  await put(root, "README.md", "# Fixture\n\nSee [more](docs/more.md), the [file](design/tokens.css) and [the web](https://example.com/).\n");
  await put(root, "docs/more.md", "# More\n\nBack to the [home page](../README.md#fixture).\n");
  await put(root, "docs.config.mjs", CONFIG.replace(ONE_PAGE, TWO_PAGES).replace("  manifest:", `${extra}  manifest:`));
  assert.equal(git(root, "add", "-A").status, 0);
  return root;
}

const build = (root) => spawnSync(process.execPath, [BUILD, "--out", "_site"], { cwd: root, encoding: "utf8" });
const read = (root, rel) => readFile(path.join(root, rel), "utf8");

describe("build.mjs agent-readable files", () => {
  it("writes nothing for agents unless llms or sitemap is set", async () => {
    const root = await fixture();
    assert.equal(build(root).status, 0);
    for (const file of ["llms.txt", "llms-full.txt", "sitemap.xml", "index.md"]) {
      await assert.rejects(read(root, `_site/${file}`), { code: "ENOENT" }, file);
    }
    assert.doesNotMatch(await read(root, "_site/index.html"), /describedby|text\/markdown/);
  });

  it("writes a markdown copy of every page, llms.txt and a sitemap, with links that work from the copy", async () => {
    const root = await agentFixture(`  llms: { description: "A fixture." },\n  sitemap: true,\n`);
    const result = build(root);
    assert.equal(result.status, 0, result.stderr);

    const index = await read(root, "_site/index.md");
    assert.match(index, /\[more\]\(more\.md\)/, "a link to another page goes to that page's copy");
    assert.match(index, /\[file\]\(https:\/\/github\.com\/acme\/fixture\/blob\/main\/design\/tokens\.css\)/, "a repository file goes to GitHub");
    assert.match(index, /\[the web\]\(https:\/\/example\.com\/\)/, "an external link is untouched");
    assert.match(await read(root, "_site/more.md"), /\[home page\]\(index\.md#fixture\)/, "an anchor survives");

    const llms = await read(root, "_site/llms.txt");
    assert.match(llms, /^# Fixture\n\n> A fixture\.\n\n## Start\n\n/);
    assert.match(llms, /- \[Home\]\(https:\/\/docs\.example\.com\/index\.md\): The home page\n/);
    assert.match(llms, /- \[More\]\(https:\/\/docs\.example\.com\/more\.md\)\n/);

    const sitemap = await read(root, "_site/sitemap.xml");
    assert.match(sitemap, /<loc>https:\/\/docs\.example\.com\/<\/loc>/);
    assert.match(sitemap, /<loc>https:\/\/docs\.example\.com\/more<\/loc>/);
    await assert.rejects(read(root, "_site/llms-full.txt"), { code: "ENOENT" }, "llms-full.txt is its own opt-in");
  });

  it("points each page at its copy and at llms.txt, and the 404 page at llms.txt", async () => {
    const root = await agentFixture(`  llms: { description: "A fixture." },\n`);
    assert.equal(build(root).status, 0);
    const home = await read(root, "_site/index.html");
    assert.match(home, /<link rel="describedby" href="llms\.txt">/);
    assert.match(home, /<link rel="alternate" type="text\/markdown" href="index\.md">/);
    assert.match(await read(root, "_site/404.html"), /<link rel="describedby" href="\/llms\.txt">/);
    assert.doesNotMatch(await read(root, "_site/404.html"), /text\/markdown/);
  });

  it("writes llms-full.txt, every copy after its URL, only when llms.full is true", async () => {
    const root = await agentFixture(`  llms: { description: "A fixture.", full: true },\n`);
    assert.equal(build(root).status, 0);
    const full = await read(root, "_site/llms-full.txt");
    assert.match(full, /^# Fixture\n\n> A fixture\.\n\n---\n\nSource: https:\/\/docs\.example\.com\/index\.md\n\n# Fixture/);
    assert.match(full, /Source: https:\/\/docs\.example\.com\/more\.md\n\n# More/);
  });

  it("copies a generated page only when it returns markdown, and links the others to their page", async () => {
    const root = await agentFixture(`  llms: { description: "A fixture." },\n  generators: ["gen.mjs"],\n`);
    await put(
      root,
      "gen.mjs",
      `export default async () => [
  { out: "gen.html", group: "Start", label: "Generated", summary: "Has a copy", html: '<h1 id="generated">Generated</h1>', markdown: "# Generated\\n\\nText.\\n" },
  { out: "plain.html", group: "Start", label: "Plain", html: '<h1 id="plain">Plain</h1>' },
];
`,
    );
    git(root, "add", "-A");
    assert.equal(build(root).status, 0);
    assert.equal(await read(root, "_site/gen.md"), "# Generated\n\nText.\n");
    await assert.rejects(read(root, "_site/plain.md"), { code: "ENOENT" });
    const llms = await read(root, "_site/llms.txt");
    assert.match(llms, /- \[Generated\]\(https:\/\/docs\.example\.com\/gen\.md\): Has a copy\n/);
    assert.match(llms, /- \[Plain\]\(https:\/\/docs\.example\.com\/plain\)\n/);
    const plain = await read(root, "_site/plain.html");
    assert.match(plain, /describedby/);
    assert.doesNotMatch(plain, /text\/markdown/);
  });

  it("passes --check, which also builds the files", async () => {
    const root = await agentFixture(`  llms: { description: "A fixture.", full: true },\n  sitemap: true,\n`);
    const result = check(root);
    assert.equal(result.status, 0, result.stderr);
  });

  it("fails --check on a link a copy cannot follow, such as one split across lines", async () => {
    const root = await agentFixture(`  llms: { description: "A fixture." },\n`);
    await put(root, "README.md", "# Fixture\n\nSee [a link\nthat wraps](docs/more.md) here.\n");
    git(root, "add", "-A");
    assertFails(check(root), `index.md: link "docs/more.md" is not external, an anchor or a page of the site`);
  });

  it("exits 2 for an invalid llms config, a page that cannot have a copy, and a bad generated page", async () => {
    assertFails(check(await agentFixture(`  llms: {},\n`)), `"llms.description" must be a non-empty single line`, 2);

    const root = await agentFixture(`  llms: { description: "d" },\n`);
    await put(root, "docs.config.mjs", (await read(root, "docs.config.mjs")).replace(`out: "more.html"`, `out: "more.txt"`));
    assertFails(check(root), `must end in .html when "llms" is set`, 2);

    const gen = await agentFixture(`  llms: { description: "d" },\n  generators: ["gen.mjs"],\n`);
    await put(gen, "gen.mjs", `export default async () => [{ out: "g.html", group: "Start", label: "G", html: '<h1 id="g">G</h1>', markdown: 7 }];\n`);
    git(gen, "add", "-A");
    assertFails(check(gen), `"markdown" must be a string`, 2);
  });

  it("rewrites a link in a nested page's copy, and points its head at the root's llms.txt", async () => {
    const root = await agentFixture(`  llms: { description: "A fixture." },\n`);
    await put(root, "docs.config.mjs", (await read(root, "docs.config.mjs")).replace(`out: "more.html"`, `out: "docs/more.html"`));
    git(root, "add", "-A");
    assert.equal(build(root).status, 0);
    assert.match(await read(root, "_site/docs/more.md"), /\[home page\]\(\.\.\/index\.md#fixture\)/);
    const html = await read(root, "_site/docs/more.html");
    assert.match(html, /<link rel="describedby" href="\.\.\/llms\.txt">/);
    assert.match(html, /<link rel="alternate" type="text\/markdown" href="more\.md">/);
    assert.match(await read(root, "_site/index.md"), /\[more\]\(docs\/more\.md\)/);
  });

  it("rewrites a link that follows a bullet asterisk, and --check passes", async () => {
    const root = await agentFixture(`  llms: { description: "A fixture." },\n`);
    await put(root, "README.md", "# Fixture\n\n* [**More**](docs/more.md) tail\n");
    git(root, "add", "-A");
    assert.equal(check(root).status, 0, check(root).stderr);
    assert.equal(build(root).status, 0);
    assert.match(await read(root, "_site/index.md"), /\* \[\*\*More\*\*\]\(more\.md\) tail/);
  });

  it("writes only sitemap.xml for sitemap alone: no copies and no head links", async () => {
    const root = await agentFixture(`  sitemap: true,\n`);
    assert.equal(build(root).status, 0);
    assert.match(await read(root, "_site/sitemap.xml"), /<loc>https:\/\/docs\.example\.com\/more<\/loc>/);
    for (const file of ["llms.txt", "index.md", "more.md"]) await assert.rejects(read(root, `_site/${file}`), { code: "ENOENT" }, file);
    assert.doesNotMatch(await read(root, "_site/index.html"), /describedby|text\/markdown/);
  });

  it("writes copies with LF line endings whatever the source has", async () => {
    const root = await agentFixture(`  llms: { description: "A fixture." },\n`);
    await put(root, "docs/more.md", "# More\r\n\r\nA line.\r\n");
    git(root, "add", "-A");
    assert.equal(build(root).status, 0);
    assert.equal(await read(root, "_site/more.md"), "# More\n\nA line.\n");
  });

  it("exits 2 for a generated page that cannot be named, or that collides", async () => {
    const generated = async (pages) => {
      const root = await agentFixture(`  llms: { description: "d" },\n  generators: ["gen.mjs"],\n`);
      await put(root, "gen.mjs", `export default async () => ${JSON.stringify(pages)};\n`);
      git(root, "add", "-A");
      return root;
    };
    const page = (out, extra = {}) => ({ out, group: "Start", label: "G", html: '<h1 id="g">G</h1>', ...extra });
    assertFails(check(await generated([page("foo.txt", { markdown: "# X\n" })])), `"out" must end in .html when "llms" is set`, 2);
    assertFails(check(await generated([page("more.html")])), `"more.html" is the output of two pages`, 2);
    assertFails(check(await generated([page("llms.txt")])), `"llms.txt" clashes with "llms.txt", a file the kit writes`, 2);
  });
});

