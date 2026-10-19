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

/** A clean repository: `--check` exits 0 on it. */
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "m3l-docs-e2e-"));
  roots.push(root);
  const design = {
    "tokens.css": ":root { --color-text: #111; }\n",
    "source/components/bundle.css": ".m3l-badge { color: var(--color-text); }\n",
    "source/fonts/x.woff2": "not really a font",
  };
  for (const [rel, text] of Object.entries(design)) await put(root, `design/${rel}`, text);
  await put(root, "design/SHA256SUMS", Object.entries(design).map(([rel, text]) => `${sha(text)}  ${rel}\n`).join(""));
  await put(root, "design/README.md", "# Adoption\n\n- **Version copied:** `v1.0.0`\n");
  await put(root, "README.md", "# Fixture\n\nPlain **bold** text and a [file](design/tokens.css).\n");
  await put(root, "package.json", JSON.stringify({ name: "fixture", homepage: SITE_URL }));
  await put(root, "docs.config.mjs", CONFIG);
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
