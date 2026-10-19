// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

/** Covers every export of `lib/checks.mjs`. */
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  alertRunProblems,
  globToRegExp,
  homepageProblems,
  localCssProblems,
  markerProblems,
  pageCoverageProblems,
  parseSums,
  shaSumsProblems,
} from "../../source/docs-kit/lib/checks.mjs";

const sha = (text) => createHash("sha256").update(text).digest("hex");
const has = (list, needle) => list.some((p) => p.includes(needle));

describe("globToRegExp", () => {
  it("lets ** cross directories and * and ? stay within one", () => {
    assert.ok(globToRegExp(".claude/**").test(".claude/a/b/c.md"));
    assert.ok(globToRegExp("**/x.md").test("x.md"));
    assert.ok(globToRegExp("**/x.md").test("a/b/x.md"));
    assert.ok(globToRegExp("docs/*.md").test("docs/a.md"));
    assert.ok(!globToRegExp("docs/*.md").test("docs/a/b.md"));
    assert.ok(globToRegExp("a?.md").test("ab.md"));
    assert.ok(!globToRegExp("a?.md").test("a/.md"));
  });

  it("anchors the match and escapes regex metacharacters", () => {
    assert.ok(!globToRegExp("CLAUDE.md").test("xCLAUDE.md"));
    assert.ok(!globToRegExp("CLAUDE.md").test("CLAUDExmd"));
    assert.ok(globToRegExp("a+(b).md").test("a+(b).md"));
  });
});

describe("pageCoverageProblems", () => {
  const base = {
    tracked: ["README.md", "CLAUDE.md", "src/a.ts"],
    pages: [{ src: "README.md" }],
    exclude: [{ glob: "CLAUDE.md", reason: "agents" }],
  };

  it("passes when every tracked .md is a page or excluded", () => {
    assert.deepEqual(pageCoverageProblems(base), []);
  });

  it("flags tracked Markdown that is neither page nor excluded", () => {
    const out = pageCoverageProblems({ ...base, tracked: [...base.tracked, "NOTES.md"] });
    assert.equal(out.length, 1);
    assert.match(out[0], /^NOTES\.md: tracked Markdown is neither a page nor excluded/);
  });

  it("flags a stale exclude", () => {
    const out = pageCoverageProblems({ ...base, exclude: [...base.exclude, { glob: "gone/**", reason: "x" }] });
    assert.deepEqual(out, [`exclude: "gone/**" matches no tracked Markdown file (remove the stale entry)`]);
  });

  it("flags a page that is not tracked", () => {
    const out = pageCoverageProblems({ ...base, pages: [...base.pages, { src: "missing.md" }] });
    assert.deepEqual(out, [`pages: "missing.md" is not a tracked file`]);
  });

  it("flags a page that an exclude also matches", () => {
    const out = pageCoverageProblems({ ...base, pages: [...base.pages, { src: "CLAUDE.md" }] });
    assert.deepEqual(out, [`pages: "CLAUDE.md" is also matched by exclude "CLAUDE.md"`]);
  });
});

describe("parseSums", () => {
  const h = "a".repeat(64);

  it("parses text and binary mode lines, lowercasing the digest, skipping blanks", () => {
    const sums = parseSums(`${h.toUpperCase()}  a.txt\n\n${h} *dir/b.bin\n`);
    assert.deepEqual([...sums], [["a.txt", h], ["dir/b.bin", h]]);
  });

  it("throws on a line it cannot parse", () => {
    assert.throws(() => parseSums("nonsense here\n"), /cannot parse line "nonsense here"/);
    assert.throws(() => parseSums(`${"a".repeat(63)}  short\n`), /cannot parse/);
  });
});

describe("shaSumsProblems", () => {
  const dirs = [];
  async function fixture(files, sums) {
    const dir = await mkdtemp(path.join(tmpdir(), "m3l-sums-"));
    dirs.push(dir);
    for (const [rel, text] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
      await writeFile(path.join(dir, rel), text);
    }
    if (sums !== null) await writeFile(path.join(dir, "SHA256SUMS"), sums);
    return dir;
  }
  after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

  it("passes for a matching payload", async () => {
    const dir = await fixture(
      { "tokens.css": "a", "source/x.md": "b", "source/sub/y.md": "c" },
      `${sha("a")}  tokens.css\n${sha("b")}  source/x.md\n${sha("c")}  source/sub/y.md\n`,
    );
    assert.deepEqual(await shaSumsProblems(dir), []);
  });

  it("reports a mismatching file", async () => {
    const dir = await fixture({ "tokens.css": "edited", "source/.keep": "" }, `${sha("a")}  tokens.css\n${sha("")}  source/.keep\n`);
    assert.deepEqual(await shaSumsProblems(dir), [
      "design: tokens.css does not match SHA256SUMS (hand-edited? re-sync with sync-design.sh)",
    ]);
  });

  it("reports a listed file that does not exist", async () => {
    const dir = await fixture({ "source/.keep": "" }, `${sha("a")}  tokens.css\n${sha("")}  source/.keep\n`);
    assert.deepEqual(await shaSumsProblems(dir), ["design: SHA256SUMS lists tokens.css, which does not exist"]);
  });

  it("reports a design dir with no source/ directory as a problem", async () => {
    const dir = await fixture({ "tokens.css": "a" }, `${sha("a")}  tokens.css\n`);
    const out = await shaSumsProblems(dir);
    assert.ok(out.some((p) => p.includes("source")));
  });

  it("reports a file under source/ that is not listed", async () => {
    const dir = await fixture({ "tokens.css": "a", "source/extra.md": "x" }, `${sha("a")}  tokens.css\n`);
    assert.deepEqual(await shaSumsProblems(dir), ["design: source/extra.md is not listed in SHA256SUMS"]);
  });

  it("reports a missing or unparseable SHA256SUMS in one message", async () => {
    const missing = await shaSumsProblems(await fixture({ "source/a": "x" }, null));
    assert.equal(missing.length, 1);
    assert.match(missing[0], /^design: cannot read SHA256SUMS/);
    const bad = await shaSumsProblems(await fixture({}, "garbage\n"));
    assert.match(bad[0], /cannot read SHA256SUMS: SHA256SUMS: cannot parse/);
  });
});

describe("markerProblems", () => {
  const vendored = "- **Version copied:** `v1.2.3`\n";
  const source = "- **Version adopted:** `v1.2.3`\n- **Tier:** source\n";

  it("accepts the vendored tier everywhere", () => {
    assert.deepEqual(markerProblems({ marker: "design/README.md", text: vendored, isSourceRepo: false }), []);
    assert.deepEqual(markerProblems({ marker: "design/README.md", text: vendored, isSourceRepo: true }), []);
  });

  it("reports a missing marker file", () => {
    assert.match(markerProblems({ marker: "design/README.md", text: null, isSourceRepo: false })[0], /^design\/README\.md: missing/);
  });

  it("accepts the source tier only when isSourceRepo", () => {
    assert.deepEqual(markerProblems({ marker: "m", text: source, isSourceRepo: true }), []);
    assert.equal(markerProblems({ marker: "m", text: source, isSourceRepo: false }).length, 1);
  });

  it("requires Tier: source alongside Version adopted in the source repo", () => {
    const text = "- **Version adopted:** `v1.2.3`\n";
    assert.equal(markerProblems({ marker: "m", text, isSourceRepo: true }).length, 1);
  });

  it("rejects a version that is not vX.Y.Z", () => {
    assert.equal(markerProblems({ marker: "m", text: "- **Version copied:** `latest`\n", isSourceRepo: false }).length, 1);
  });
});

describe("localCssProblems", () => {
  it("accepts var() tokens and class rules", () => {
    const css = ".x { color: var(--color-text); padding: var(--space-4); margin: 0; z-index: 2; }\n";
    assert.deepEqual(localCssProblems("a.css", css), []);
  });

  it("flags hex colours, naming the file and line", () => {
    const out = localCssProblems("design/local/a.css", ".x {\n  color: #fff;\n}\n");
    assert.equal(out.length, 1);
    assert.match(out[0], /^design\/local\/a\.css:2: a hex colour in "color: #fff;"/);
  });

  it("flags colour functions and length literals", () => {
    assert.ok(has(localCssProblems("a", ".x { color: rgb(0 0 0); }"), "a colour function"));
    assert.ok(has(localCssProblems("a", ".x { color: oklch(0.5 0 0); }"), "a colour function"));
    for (const len of ["12px", "1.5rem", ".5em", "-2px", "80ch", "10vh"]) {
      assert.ok(has(localCssProblems("a", `.x { width: ${len}; }`), "a length literal"), len);
    }
  });

  it("does not mistake identifiers or var() names for lengths", () => {
    assert.deepEqual(localCssProblems("a", ".x { width: var(--measure-14px-ish); }\n.col-2px { }"), []);
  });

  it("ignores comments, including multi-line ones", () => {
    assert.deepEqual(localCssProblems("a", "/* #fff and 12px\n   rgb(0 0 0) */\n.x { margin: 0; }"), []);
  });

  it("ignores the prelude of @media, @container and @supports", () => {
    const css = "@media (min-width: 40rem) {\n  .x { color: var(--c); }\n}\n@container (width > 300px) { .y { margin: 0; } }\n";
    assert.deepEqual(localCssProblems("a", css), []);
  });

  it("still checks the body of an @media rule", () => {
    assert.equal(localCssProblems("a", "@media (min-width: 40rem) { .x { margin: 4px; } }").length, 1);
  });
});

describe("alertRunProblems", () => {
  const alert = (kind, body = "text") => `> [!${kind}]\n> ${body}\n`;

  it("allows two alerts in a row, with or without blank lines between", () => {
    assert.deepEqual(alertRunProblems("a.md", alert("NOTE") + alert("TIP")), []);
    assert.deepEqual(alertRunProblems("a.md", alert("NOTE") + "\n" + alert("TIP")), []);
  });

  it("fails on three, once", () => {
    const md = alert("NOTE") + "\n" + alert("TIP") + "\n" + alert("WARNING") + "\n" + alert("CAUTION");
    assert.deepEqual(alertRunProblems("a.md", md), ["a.md: more than two GitHub alerts in a row"]);
  });

  it("resets the run on prose between alerts", () => {
    const md = alert("NOTE") + alert("TIP") + "\nSome prose.\n\n" + alert("WARNING") + alert("IMPORTANT");
    assert.deepEqual(alertRunProblems("a.md", md), []);
  });

  it("ignores alerts inside fenced code", () => {
    const md = "```md\n" + alert("NOTE") + alert("TIP") + alert("WARNING") + "```\n";
    assert.deepEqual(alertRunProblems("a.md", md), []);
    const tilde = "~~~\n" + alert("NOTE").repeat(3) + "~~~\n";
    assert.deepEqual(alertRunProblems("a.md", tilde), []);
  });

  it("does not count a plain blockquote as an alert", () => {
    assert.deepEqual(alertRunProblems("a.md", "> quote\n\n> quote\n\n> quote\n"), []);
  });
});

describe("homepageProblems", () => {
  const url = "https://design.example.com";

  it("passes on an exact match, ignoring trailing slashes", () => {
    assert.deepEqual(homepageProblems({ homepage: url }, "package.json", url), []);
    assert.deepEqual(homepageProblems({ homepage: `${url}//` }, "package.json", url), []);
  });

  it("reports a mismatch or a missing homepage", () => {
    assert.deepEqual(homepageProblems({ homepage: "https://other.dev" }, "package.json", url), [
      `package.json: homepage is "https://other.dev", the site is ${url}`,
    ]);
    assert.deepEqual(homepageProblems({}, "plugin.json", url), [`plugin.json: homepage is "", the site is ${url}`]);
  });

  it("reports an unreadable manifest", () => {
    assert.deepEqual(homepageProblems(null, "package.json", url), ["package.json: cannot be read"]);
  });
});
