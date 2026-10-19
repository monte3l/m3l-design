// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractHeadings, renderMarkdown, stripFrontmatter } from "../../source/docs-kit/lib/markdown.mjs";

describe("stripFrontmatter", () => {
  it("drops a leading YAML block", () => {
    assert.equal(stripFrontmatter("---\nname: x\ndescription: y\n---\n# Title\n"), "# Title\n");
  });

  it("leaves text without frontmatter alone", () => {
    assert.equal(stripFrontmatter("# Title\n\n---\n\ntext\n"), "# Title\n\n---\n\ntext\n");
  });

  it("does not treat a thematic break after the first line as frontmatter", () => {
    assert.equal(stripFrontmatter("intro\n---\nmore\n---\n"), "intro\n---\nmore\n---\n");
  });

  it("leaves an unclosed block alone", () => {
    assert.equal(stripFrontmatter("---\nname: x\n# Title\n"), "---\nname: x\n# Title\n");
  });
});

describe("frontmatter in a page", () => {
  const source = "---\nname: measure\n---\n# Measure\n\ntext\n";

  it("is not rendered", () => {
    const { html } = renderMarkdown(source);
    assert.ok(!html.includes("name: measure"));
    assert.ok(html.includes("<h1"));
  });

  it("does not change the headings", () => {
    assert.deepEqual(extractHeadings(source), extractHeadings("# Measure\n\ntext\n"));
  });
});
