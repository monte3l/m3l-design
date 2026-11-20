// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

/**
 * `build.mjs` and the two things it does with page freshness: `--check` fails on
 * a `reviewed` date that is not a date, and `freshness.lastmod` writes the date of
 * each page's last commit into `sitemap.xml`. Each case runs the build as a child
 * process in a throwaway repository with fixed commit dates.
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
const IDENT = ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false"];
const sha = (text) => createHash("sha256").update(text).digest("hex");

const dirs = [];
after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

const put = async (root, rel, text) => {
  await mkdir(path.dirname(path.join(root, rel)), { recursive: true });
  await writeFile(path.join(root, rel), text);
};
const git = (cwd, ...args) => spawnSync("git", [...IDENT, ...args], { cwd, encoding: "utf8" });
function commit(cwd, date) {
  git(cwd, "add", "-A");
  const stamp = `${date}T12:00:00+0000`;
  const result = spawnSync("git", [...IDENT, "commit", "-q", "-m", `change on ${date}`], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_DATE: stamp, GIT_COMMITTER_DATE: stamp },
  });
  assert.equal(result.status, 0, result.stderr);
}

const config = (extra) => `export default {
  title: "Fixture",
  repo: "https://github.com/acme/fixture",
  siteUrl: "${SITE_URL}",
  designDir: "design",
  navGroups: ["Start"],
  pages: [
    { src: "README.md", out: "index.html", group: "Start", label: "Home" },
    { src: "docs/more.md", out: "more.html", group: "Start", label: "More" },
  ],
  exclude: [{ glob: "design/README.md", reason: "design adoption marker" }],
  manifest: "package.json",
${extra}};
`;

/**
 * A clean repository with two pages. README.md was last committed on 2026-01-10 and
 * docs/more.md on 2026-05-05.
 * @param {{ extra?: string, readme?: string }} [options] extra config lines, and the README text
 */
async function repo({ extra = "", readme = "# Fixture\n\nHome.\n" } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "m3l-fresh-build-"));
  dirs.push(root);
  const design = {
    "tokens.css": ":root { --color-text: #111; }\n",
    "source/components/bundle.css": ".m3l-badge { color: var(--color-text); }\n",
    "source/fonts/x.woff2": "not really a font",
  };
  for (const [rel, text] of Object.entries(design)) await put(root, `design/${rel}`, text);
  await put(root, "design/SHA256SUMS", Object.entries(design).map(([rel, text]) => `${sha(text)}  ${rel}\n`).join(""));
  await put(root, "design/README.md", "# Adoption\n\n- **Version copied:** `v1.0.0`\n");
  await put(root, "README.md", readme);
  await put(root, "docs/more.md", "# More\n\nA second page.\n");
  await put(root, "package.json", JSON.stringify({ name: "fixture", homepage: SITE_URL }));
  await put(root, "docs.config.mjs", config(extra));
  git(root, "init", "-q");
  commit(root, "2026-01-10");
  await put(root, "docs/more.md", "# More\n\nA second page, changed.\n");
  commit(root, "2026-05-05");
  return root;
}

const run = (cwd, ...args) => spawnSync(process.execPath, [BUILD, ...args], { cwd, encoding: "utf8" });
const sitemapOf = async (root) => readFile(path.join(root, "_site/sitemap.xml"), "utf8");
const LASTMOD = "  sitemap: true,\n  freshness: { lastmod: true },\n";

async function shallowClone(root) {
  const parent = await mkdtemp(path.join(tmpdir(), "m3l-fresh-build-clone-"));
  dirs.push(parent);
  const made = spawnSync("git", ["clone", "-q", "--depth", "1", `file://${root}`, path.join(parent, "r")], { encoding: "utf8" });
  assert.equal(made.status, 0, made.stderr);
  return path.join(parent, "r");
}

describe("--check and the reviewed date", () => {
  it("passes for a page with no reviewed date, a valid one and one that lies ahead", async () => {
    for (const readme of ["# Fixture\n\nHome.\n", "---\nreviewed: 2026-03-03\n---\n# Fixture\n", "---\nreviewed: 2099-01-01\n---\n# Fixture\n"]) {
      const result = run(await repo({ extra: "  freshness: {},\n", readme }), "--check");
      assert.equal(result.status, 0, `${readme}\n${result.stderr}`);
    }
  });

  it("fails, naming the page and what was written, for a reviewed date that is not a date", async () => {
    const result = run(await repo({ extra: "  freshness: {},\n", readme: "---\nreviewed: soon\n---\n# Fixture\n" }), "--check");
    assert.equal(result.status, 1, result.stdout);
    assert.ok(result.stderr.includes('README.md: the frontmatter key "reviewed" is "soon", not a date written YYYY-MM-DD'), result.stderr);
  });

  it("does not check the date at all for a site that did not set freshness, so nothing it did before changes", async () => {
    for (const reviewed of ["soon", "2026-02-30", "", "never"]) {
      const result = run(await repo({ readme: `---\nreviewed: ${reviewed}\n---\n# Fixture\n` }), "--check");
      assert.equal(result.status, 0, `reviewed: ${reviewed}\n${result.stderr}`);
    }
  });

  it("fails for an impossible calendar date too", async () => {
    const result = run(await repo({ extra: "  freshness: {},\n", readme: "---\nreviewed: 2026-02-30\n---\n# Fixture\n" }), "--check");
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes('"2026-02-30"'), result.stderr);
  });

  it("never fails because a page is old", async () => {
    const root = await repo({ extra: "  freshness: { maxAgeDays: 1 },\n" });
    assert.equal(run(root, "--check").status, 0);
  });
});

describe("freshness.lastmod in sitemap.xml", () => {
  it("writes the date of each page's last commit", async () => {
    const root = await repo({ extra: LASTMOD });
    const result = run(root, "--out", "_site");
    assert.equal(result.status, 0, result.stderr);
    const sitemap = await sitemapOf(root);
    assert.ok(sitemap.includes(`<url><loc>${SITE_URL}/</loc><lastmod>2026-01-10</lastmod></url>`), sitemap);
    assert.ok(sitemap.includes(`<url><loc>${SITE_URL}/more</loc><lastmod>2026-05-05</lastmod></url>`), sitemap);
  });

  it("writes no lastmod unless it is asked for, so every existing site stays byte for byte the same", async () => {
    const root = await repo({ extra: "  sitemap: true,\n" });
    assert.equal(run(root, "--out", "_site").status, 0);
    assert.ok(!(await sitemapOf(root)).includes("lastmod"));
    const off = await repo({ extra: "  sitemap: true,\n  freshness: { lastmod: false },\n" });
    assert.equal(run(off, "--out", "_site").status, 0);
    assert.ok(!(await sitemapOf(off)).includes("lastmod"));
  });

  it("is not moved by a reviewed date: reading a page again is not changing it", async () => {
    const root = await repo({ extra: LASTMOD, readme: "---\nreviewed: 2026-09-09\n---\n# Fixture\n\nHome.\n" });
    assert.equal(run(root, "--out", "_site").status, 0);
    assert.ok((await sitemapOf(root)).includes("<loc>https://docs.example.com/</loc><lastmod>2026-01-10</lastmod>"));
  });

  it("leaves the date out for a page that has no commit yet", async () => {
    const root = await repo({ extra: LASTMOD });
    const more = '    { src: "docs/more.md", out: "more.html", group: "Start", label: "More" },';
    await put(root, "docs.config.mjs", config(LASTMOD).replace(more, `${more}\n    { src: "docs/new.md", out: "new.html", group: "Start", label: "New" },`));
    await put(root, "docs/new.md", "# New\n\nStaged, never committed.\n");
    git(root, "add", "-A");
    const result = run(root, "--out", "_site");
    assert.equal(result.status, 0, result.stderr);
    const sitemap = await sitemapOf(root);
    assert.ok(sitemap.includes(`<url><loc>${SITE_URL}/new</loc></url>`), "no date for a page git has no commit for");
    assert.ok(sitemap.includes(`<loc>${SITE_URL}/</loc><lastmod>2026-01-10</lastmod>`), "the others keep theirs");
  });

  it("fails the build in a shallow clone, instead of leaving the dates out", async () => {
    const clone = await shallowClone(await repo({ extra: LASTMOD }));
    for (const args of [["--out", "_site"], ["--check"]]) {
      const result = run(clone, ...args);
      assert.equal(result.status, 2, `${args}: ${result.stdout}`);
      assert.ok(result.stderr.includes('"freshness.lastmod": this is a shallow clone'), result.stderr);
      assert.ok(result.stderr.includes("fetch-depth: 0"), result.stderr);
    }
  });

  it("does not need the history when lastmod is not asked for", async () => {
    const clone = await shallowClone(await repo({ extra: "  sitemap: true,\n" }));
    assert.equal(run(clone, "--out", "_site").status, 0);
  });

  it("works with llms on too", async () => {
    const root = await repo({ extra: `  llms: { description: "A fixture." },\n${LASTMOD}` });
    const result = run(root, "--out", "_site");
    assert.equal(result.status, 0, result.stderr);
    assert.ok((await sitemapOf(root)).includes("<lastmod>2026-05-05</lastmod>"));
  });

  it("is a config error without a sitemap", async () => {
    const result = run(await repo({ extra: "  freshness: { lastmod: true },\n" }), "--check");
    assert.equal(result.status, 2);
    assert.ok(result.stderr.includes('"freshness.lastmod" needs "sitemap": true'), result.stderr);
  });
});
