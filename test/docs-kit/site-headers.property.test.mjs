// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

/**
 * Seeded fuzzing of `site-headers.mjs`: `hashInlineScript` against an
 * independent `node:crypto` computation, `externalImageHosts` over synthetic
 * host sets, `buildHeadersFile`'s fixed two-block shape, and the
 * `assertHeadersLimits` rule-block boundary.
 */
import { createHash } from "node:crypto";
import { describe, expect, it, mulberry32 } from "./_expect.mjs";
import {
  HeadersLimitError,
  assertHeadersLimits,
  buildHeadersFile,
  externalImageHosts,
  hashInlineScript,
} from "../../source/docs-kit/lib/site-headers.mjs";

const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const ALNUM = LOWER + "0123456789";

/** A label shaped like `^[a-z][a-z0-9]{0,5}$`. */
function label(rand) {
  let out = pick(rand, LOWER);
  for (let i = Math.floor(rand() * 6); i > 0; i -= 1) out += pick(rand, ALNUM);
  return out;
}

function host(rand) {
  const labels = Array.from({ length: 1 + Math.floor(rand() * 3) }, () => label(rand));
  return `${labels.join(".")}.example.com`;
}

const hosts = (rand, max) => Array.from({ length: Math.floor(rand() * (max + 1)) }, () => host(rand));
const imgs = (list) => list.map((h) => `<img src="https://${h}/x.png">`);
const isSorted = (list) => JSON.stringify(list) === JSON.stringify([...list].sort());

describe("hashInlineScript: differential check against node:crypto", () => {
  it("equals sha256- + base64(SHA-256(utf8 bytes)) computed independently", () => {
    const rand = mulberry32(0x6d33_5701);
    for (let run = 0; run < 200; run += 1) {
      let source = "";
      for (let i = 1 + Math.floor(rand() * 60); i > 0; i -= 1) source += String.fromCodePoint(1 + Math.floor(rand() * 0x2fff));
      const expected = "sha256-" + createHash("sha256").update(source, "utf8").digest("base64");
      expect(hashInlineScript(source)).toBe(expected);
    }
  });
});

describe("externalImageHosts: sortedness, de-duplication, subset relationship", () => {
  it("returns the sorted, de-duplicated set of hosts fed in", () => {
    const rand = mulberry32(0x6d33_5702);
    for (let run = 0; run < 200; run += 1) {
      const list = hosts(rand, 10);
      const result = externalImageHosts(imgs(list));
      expect(result).toEqual([...new Set(list)].sort());
    }
  });

  it("returns an empty array when no host is fed in", () => {
    expect(externalImageHosts([])).toEqual([]);
    expect(externalImageHosts(['<p class="body">no images</p>'])).toEqual([]);
  });

  it("adds img.shields.io whenever the securityscorecards badge host appears, staying sorted and unique", () => {
    const rand = mulberry32(0x6d33_5703);
    for (let run = 0; run < 200; run += 1) {
      const list = [...hosts(rand, 10), "api.securityscorecards.dev"];
      const result = externalImageHosts(imgs(list));
      expect(result).toContain("img.shields.io");
      for (const h of new Set(list)) expect(result).toContain(h);
      expect(isSorted(result)).toBe(true);
      expect(new Set(result).size).toBe(result.length);
    }
  });

  it("is case-insensitive in host and scheme", () => {
    const rand = mulberry32(0x6d33_5704);
    for (let run = 0; run < 200; run += 1) {
      const h = host(rand);
      const hostPart = rand() < 0.5 ? h.toUpperCase() : h;
      const scheme = rand() < 0.5 ? "HTTPS" : "https";
      expect(externalImageHosts([`<img src="${scheme}://${hostPart}/x.png">`])).toEqual([h]);
    }
  });
});

describe("buildHeadersFile: fixed two-rule-block shape", () => {
  it("has one blank line between two non-empty blocks, starts with /*, lists the fonts rule, ends with one newline, no CR", () => {
    const rand = mulberry32(0x6d33_5705);
    for (let run = 0; run < 100; run += 1) {
      const output = buildHeadersFile({ scriptHash: "sha256-fixedTestHash==", imageHosts: hosts(rand, 5) });
      const blocks = output.split("\n\n");
      expect(blocks).toHaveLength(2);
      for (const block of blocks) expect(block.length).toBeGreaterThan(0);
      expect(output.startsWith("/*")).toBe(true);
      expect(output.split("\n")).toContain("/assets/source/fonts/*");
      expect(output.endsWith("\n")).toBe(true);
      expect(output.endsWith("\n\n")).toBe(false);
      expect(output).not.toContain("\r");
    }
  });
});

describe("assertHeadersLimits: rule-block count boundary", () => {
  const textWith = (n) => Array.from({ length: n }, (_unused, i) => `/p${i}/*\n  X-Test: v\n`).join("\n");

  it("passes for 0..100 rule blocks", () => {
    for (let n = 0; n <= 100; n += 1) expect(assertHeadersLimits(textWith(n))).toBeUndefined();
  });

  it("throws HeadersLimitError for 101..200 rule blocks", () => {
    for (let n = 101; n <= 200; n += 1) expect(() => assertHeadersLimits(textWith(n))).toThrow(HeadersLimitError);
  });
});
