// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

/** Covers the pure helpers of the m3l-design site generators and parity script. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { previewBody } from "../../scripts/site/gallery.mjs";
import { declarations, topLevelRules } from "../../scripts/site/tokens.mjs";
import { bundleBlocks, declaredTokens, latestRelease } from "../../scripts/doc-parity.mjs";

const doc = (body) => `<!doctype html><html><head><style>x{}</style></head><body class="p">${body}</body></html>`;

describe("gallery previewBody", () => {
  it("returns the trimmed body contents without problems", () => {
    assert.deepEqual(previewBody("Badge", doc('\n<span class="m3l-badge">x</span>\n')), {
      body: '<span class="m3l-badge">x</span>',
      problems: [],
    });
  });

  it("reports a document with no body", () => {
    assert.deepEqual(previewBody("Badge", "<p>x</p>"), { body: "", problems: ["Badge/preview.html: no <body>"] });
  });

  it("rejects a script", () => {
    const { problems } = previewBody("Nav", doc("<script>alert(1)</script>"));
    assert.deepEqual(problems, ["Nav/preview.html: <script> is blocked by the site CSP"]);
  });

  it("rejects on*= handlers, in any case and with spaces around =", () => {
    for (const attr of ['onclick="x()"', 'onLoad = "x()"', 'onmouseover="y"']) {
      const { problems } = previewBody("Nav", doc(`<button ${attr}>b</button>`));
      assert.deepEqual(problems, ["Nav/preview.html: an on*= handler is blocked by the site CSP"], attr);
    }
  });

  it("does not mistake words that merely contain 'on' for handlers", () => {
    assert.deepEqual(previewBody("A", doc('<p data-icon="x">on = off</p>')).problems, []);
  });

  it("reports script and handler together", () => {
    assert.equal(previewBody("A", doc('<script></script><i onclick="x"></i>')).problems.length, 2);
  });

  it("strips style attributes", () => {
    const { body } = previewBody("Card", doc('<div style="display:flex; gap:8px" class="a">x</div><p style = "color:red">y</p>'));
    assert.equal(body, '<div class="a">x</div><p>y</p>');
  });

  it("points # anchors at the gallery itself and leaves other hrefs", () => {
    const { body } = previewBody("Nav", doc('<a href="#one">a</a><a href="#">b</a><a href="https://x.dev/#z">c</a>'));
    assert.equal(
      body,
      '<a href="#component-gallery">a</a><a href="#component-gallery">b</a><a href="https://x.dev/#z">c</a>',
    );
  });
});

describe("tokens topLevelRules", () => {
  it("returns depth-0 non-@ rules, comments stripped", () => {
    const css = "/* c { } */\n:root { --a: 1; }\n.x .y { color: red; }\n";
    assert.deepEqual(topLevelRules(css), [
      { selector: ":root", body: " --a: 1; " },
      { selector: ".x .y", body: " color: red; " },
    ]);
  });

  it("skips at-rules and everything nested in them", () => {
    const css = "@media (min-width: 1px) { :root { --a: 2; } }\n:root { --b: 3; }\n@font-face { font-family: x; }\n";
    assert.deepEqual(topLevelRules(css), [{ selector: ":root", body: " --b: 3; " }]);
  });

  it("keeps nested blocks inside the outer rule's body", () => {
    const [rule] = topLevelRules(".a { .b { c: d; } }");
    assert.equal(rule.selector, ".a");
    assert.match(rule.body, /\.b \{ c: d; \}/);
  });

  it("returns [] for an empty stylesheet", () => {
    assert.deepEqual(topLevelRules(""), []);
  });
});

describe("tokens declarations", () => {
  const css = ':root { --a: 1; --b: two words ; }\n:root, [data-theme="light"] { --a: 9; }\n[data-theme="dark"] { --a: 0; --c: x; }\n.u { --z: 1; }\n';

  it("collects custom properties of the wanted selectors, later rules winning", () => {
    assert.deepEqual([...declarations(css, [":root", ':root, [data-theme="light"]'])], [
      ["a", "9"],
      ["b", "two words"],
    ]);
  });

  it("normalises whitespace in selector lists", () => {
    const spaced = ':root,\n  [data-theme="light"] { --a: 1; }';
    assert.equal(declarations(spaced, [':root, [data-theme="light"]']).get("a"), "1");
  });

  it("ignores unwanted selectors and returns an empty map when none match", () => {
    assert.deepEqual([...declarations(css, ['[data-theme="dark"]'])], [["a", "0"], ["c", "x"]]);
    assert.equal(declarations(css, [".nope"]).size, 0);
  });
});

describe("doc-parity bundleBlocks", () => {
  it("collects block names from .m3l-* selectors, stopping at attributes and pseudo-classes", () => {
    const css = ".m3l-callout { } .m3l-code-block[data-x] { } .m3l-button:hover, .m3l-nav > .m3l-badge { }";
    assert.deepEqual([...bundleBlocks(css)].sort(), ["badge", "button", "callout", "code-block", "nav"]);
  });

  it("does not report a BEM element on its own (the block rule carries the name)", () => {
    assert.equal(bundleBlocks(".m3l-callout__title { }").size, 0);
  });

  it("returns an empty set for no .m3l- class", () => {
    assert.equal(bundleBlocks(".other { }").size, 0);
  });
});

describe("doc-parity declaredTokens", () => {
  it("returns every custom property name declared", () => {
    assert.deepEqual([...declaredTokens(":root { --color-a: #fff; --space-1 :4px; }")].sort(), ["color-a", "space-1"]);
  });

  it("does not count var() uses", () => {
    assert.equal(declaredTokens(".x { color: var(--color-a); }").size, 0);
  });
});

describe("doc-parity latestRelease", () => {
  it("returns the first released version heading, skipping Unreleased", () => {
    const log = "# Changelog\n\n## [Unreleased]\n\n## [1.4.0] - 2026-01-01\n\n## [1.3.0] - 2025-12-01\n";
    assert.equal(latestRelease(log), "1.4.0");
  });

  it("returns null when nothing is released", () => {
    assert.equal(latestRelease("# Changelog\n\n## [Unreleased]\n"), null);
  });
});
