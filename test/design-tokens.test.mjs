// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

/**
 * Differential check of the resolver (`source/lib/design-tokens.mjs`) against
 * `source/tokens.json`, m3l-design's flattened copy of the same tokens. The
 * DTCG files in `source/dtcg/` are canonical; `tokens.json` is only an oracle.
 * Every value the resolver produces for a family `tokens.json` lists must
 * equal the value `tokens.json` records, for both themes. The synthetic
 * negative-path tests for the resolver live in m3l-groundwork, which imports
 * this same file.
 *
 * Also checks the payload's credit files: MIT requires the notice to travel
 * with every copy, so `source/LICENSE` and `source/AUTHORS.md` must stay
 * identical to the root ones.
 *
 * Run with `node --test`.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as lib from "../source/lib/design-tokens.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(path.join(root, rel), "utf8");
const tokensJson = JSON.parse(read("source/tokens.json"));

function familyTokens(family) {
  const tokens = tokensJson[family]?.tokens;
  assert.ok(tokens, `tokens.json family "${family}" has no tokens`);
  return tokens;
}

/** A theme-split value ({light,dark}) picks its theme; a plain string is returned as is. */
function themedValue(raw, theme) {
  return raw !== null && typeof raw === "object" ? raw[theme] : raw;
}

const system = await lib.loadDesignSystem(path.join(root, "source/dtcg"));
const trees = {
  light: lib.resolveTheme(system, "light", "default"),
  dark: lib.resolveTheme(system, "dark", "default"),
  reduced: lib.resolveTheme(system, "light", "reduced"),
};

function assertFamilyParity(family, flatten) {
  const expectedTokens = familyTokens(family);
  for (const theme of ["light", "dark"]) {
    const actual = flatten(trees[theme]);
    const byName = new Map(actual.map((t) => [t.name, t.value]));
    assert.equal(
      actual.length,
      expectedTokens.length,
      `family "${family}" (${theme}): expected ${expectedTokens.length} tokens, got ${actual.length}`,
    );
    for (const token of expectedTokens) {
      assert.equal(
        byName.get(token.name),
        themedValue(token.value, theme),
        `family "${family}" token "${token.name}" (${theme})`,
      );
    }
  }
}

describe("resolver parity with source/tokens.json", () => {
  const dim = lib.formatDimension;
  const flat = (key, prefix, format) => (tree) =>
    lib.flattenFamily(tree, key, prefix, format);

  it("spacing", () =>
    assertFamilyParity("spacing", flat("space", "space", dim)));
  it("radius", () =>
    assertFamilyParity("radius", flat("radius", "radius", dim)));
  it("duration", () =>
    assertFamilyParity("duration", flat("duration", "duration", dim)));
  it("easing", () =>
    assertFamilyParity("easing", flat("easing", "easing", lib.formatEasing)));
  it("breakpoint", () =>
    assertFamilyParity("breakpoint", flat("breakpoint", "breakpoint", dim)));
  it("zIndex", () =>
    assertFamilyParity("zIndex", flat("z-index", "z-index", String)));
  it("shadow", () =>
    assertFamilyParity("shadow", flat("shadow", "shadow", lib.formatShadow)));
  it("borderWidth (border-width plus focus-ring)", () =>
    assertFamilyParity("borderWidth", (tree) => [
      ...lib.flattenFamily(tree, "border-width", "border-width", dim),
      ...lib.flattenFamily(tree, "focus-ring", "focus-ring", dim),
    ]));

  it("every duration is 0ms under reduced motion", () => {
    const actual = lib.flattenFamily(trees.reduced, "duration", "duration", dim);
    assert.equal(actual.length, familyTokens("duration").length);
    for (const token of actual) {
      assert.equal(token.value, "0ms", `reduced duration "${token.name}"`);
    }
  });

  describe("color family", () => {
    const colorTokens = familyTokens("color");
    const byName = new Map(colorTokens.map((t) => [t.name, t.value]));

    /** Follows tokens.json's flat `{color-neutral-0}` aliases and theme selectors down to a literal. */
    function resolveFlat(value, theme, seen = new Set()) {
      let current = value;
      for (;;) {
        if (current !== null && typeof current === "object") {
          current = current[theme];
          continue;
        }
        assert.equal(typeof current, "string", "flat alias target is a string");
        const match = /^\{([^{}]+)\}$/.exec(current);
        if (!match) return current;
        const name = match[1];
        assert.ok(!seen.has(name), `flat alias cycle at "${name}"`);
        seen.add(name);
        assert.ok(byName.has(name), `flat alias "${name}" has no token`);
        current = byName.get(name);
      }
    }

    for (const theme of ["light", "dark"]) {
      it(`every colour token (${theme})`, () => {
        const actual = lib.flattenColors(trees[theme]);
        const got = new Map(actual.map((t) => [t.name, t.value]));
        assert.equal(actual.length, colorTokens.length, "colour token count");
        for (const token of colorTokens) {
          assert.equal(
            got.get(token.name),
            resolveFlat(token.value, theme),
            `colour token "${token.name}" (${theme})`,
          );
        }
      });
    }
  });
});

describe("credit files travel with the payload", () => {
  it("source/LICENSE equals the root LICENSE", () => {
    assert.equal(read("source/LICENSE"), read("LICENSE"));
  });

  it("source/AUTHORS.md equals the root AUTHORS.md", () => {
    assert.equal(read("source/AUTHORS.md"), read("AUTHORS.md"));
  });

  it("the notice names both authors and the organization", () => {
    const license = read("LICENSE");
    for (const name of ["Enrico Lionello", "Giulia Montevecchi", "monte3l"]) {
      assert.ok(license.includes(name), `LICENSE names ${name}`);
    }
  });

  it("each font ships with its OFL text", () => {
    for (const font of ["next", "mono"]) {
      assert.ok(
        existsSync(
          path.join(root, `source/fonts/atkinson-hyperlegible-${font}-latin-wght-normal.woff2`),
        ),
        `${font} font present`,
      );
      assert.ok(
        existsSync(path.join(root, `source/licenses/OFL-atkinson-hyperlegible-${font}.txt`)),
        `${font} OFL text present`,
      );
    }
  });
});
