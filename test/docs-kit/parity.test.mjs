// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

/** Covers `lib/parity.mjs`, the helpers for a project's parity module. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertSame, assertSameSet, codeSpans, section, tableColumn } from "../../source/docs-kit/lib/parity.mjs";

describe("section", () => {
  const md = "# Top\n\nintro\n\n## A\n\na body\n\n### A1\n\ndeep\n\n## B\n\nb body\n";

  it("returns the text up to the next heading of the same or higher level", () => {
    assert.equal(section(md, "A"), "\na body\n\n### A1\n\ndeep\n");
    assert.equal(section(md, "B"), "\nb body\n");
  });

  it("includes everything under a top-level heading", () => {
    assert.match(section(md, "Top"), /intro[\s\S]*b body/);
  });

  it("returns null when the heading does not exist", () => {
    assert.equal(section(md, "Missing"), null);
  });

  it("ignores headings inside fenced code, both when seeking and when ending", () => {
    const fenced = "## Real\n\n```sh\n## A\n# not a heading\n```\n\nmore\n\n## Next\n";
    assert.equal(section(fenced, "A"), null);
    assert.match(section(fenced, "Real"), /not a heading[\s\S]*more/);
  });

  it("matches the heading text exactly, ignoring closing hashes", () => {
    assert.notEqual(section("## A ##\nx\n", "A"), null);
    assert.equal(section("## Ab\nx\n", "A"), null);
  });
});

describe("tableColumn", () => {
  const md = "text\n\n| Name | Value |\n| --- | --- |\n| a | 1 |\n| b | 2 |\n\n| X |\n| - |\n| z |\n";

  it("returns a column by index, header excluded", () => {
    assert.deepEqual(tableColumn(md, 0), ["a", "b"]);
    assert.deepEqual(tableColumn(md, 1), ["1", "2"]);
  });

  it("returns a column by header text", () => {
    assert.deepEqual(tableColumn(md, "Value"), ["1", "2"]);
  });

  it("reads only the first table", () => {
    assert.deepEqual(tableColumn(md, "X"), []);
  });

  it("returns [] for no table, an unknown header or a header-only table", () => {
    assert.deepEqual(tableColumn("no table", 0), []);
    assert.deepEqual(tableColumn(md, "Nope"), []);
    assert.deepEqual(tableColumn("| H |\n", 0), []);
  });

  it("fills a short row with an empty cell", () => {
    assert.deepEqual(tableColumn("| A | B |\n| - | - |\n| 1 |\n", 1), [""]);
  });
});

describe("codeSpans", () => {
  it("returns the contents of every inline code span", () => {
    assert.deepEqual(codeSpans("use `a` and `--b-c` here"), ["a", "--b-c"]);
  });

  it("returns [] for none, and does not span lines", () => {
    assert.deepEqual(codeSpans("nothing"), []);
    assert.deepEqual(codeSpans("`open\nclosed`"), []);
  });
});

describe("assertSameSet", () => {
  it("returns [] for equal sets regardless of order, duplicates or iterable type", () => {
    assert.deepEqual(assertSameSet("L", ["a", "b", "a"], new Set(["b", "a"])), []);
  });

  it("reports each side's missing members", () => {
    assert.deepEqual(assertSameSet("tokens", ["a", "x"], ["a", "y", "z"]), [
      "tokens: in code, not in the docs: y, z",
      "tokens: in the docs, not in code: x",
    ]);
  });

  it("reports only the side that differs", () => {
    assert.deepEqual(assertSameSet("L", ["a"], ["a", "b"]), ["L: in code, not in the docs: b"]);
    assert.deepEqual(assertSameSet("L", ["a", "b"], ["a"]), ["L: in the docs, not in code: b"]);
  });
});

describe("assertSame", () => {
  it("compares by string value", () => {
    assert.deepEqual(assertSame("v", "1", 1), []);
  });

  it("reports both values JSON-quoted", () => {
    assert.deepEqual(assertSame("v", "1.0.0", "1.1.0"), [`v: docs say "1.0.0", code says "1.1.0"`]);
    assert.deepEqual(assertSame("v", null, "1.0.0"), [`v: docs say null, code says "1.0.0"`]);
  });
});
