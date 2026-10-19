// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

/**
 * Seeded fuzzing of the Markdown renderer. Strings come from Markdown's own
 * special-character alphabet, which reaches parser branches (an unterminated
 * fence, unbalanced brackets, deep list markers) that random Unicode rarely
 * does. The property: the renderer never crashes with anything but a
 * MarkdownError (a stack overflow and an "Invalid string length" were real
 * bugs this kind of fuzzing once caught).
 */
import { describe, expect, it, mulberry32 } from "./_expect.mjs";
import { MarkdownError, renderMarkdown, slugifyHeading } from "../../source/docs-kit/lib/markdown.mjs";

const CHARS = ["`", "*", "_", "[", "]", "(", ")", "#", ">", "-", "!", "^", "|", ":", "~", " ", "\n", "a", "b", "1", "."];

/** A random string of up to `max` characters drawn from `alphabet`. */
function randomString(rand, alphabet, max) {
  const length = Math.floor(rand() * (max + 1));
  let out = "";
  for (let i = 0; i < length; i += 1) out += alphabet[Math.floor(rand() * alphabet.length)];
  return out;
}

/** Arbitrary BMP text, surrogates excluded. */
function randomUnicode(rand, max) {
  const length = Math.floor(rand() * (max + 1));
  let out = "";
  for (let i = 0; i < length; i += 1) {
    let code = Math.floor(rand() * 0xd800);
    if (rand() < 0.3) code = 32 + Math.floor(rand() * 95);
    out += String.fromCharCode(code);
  }
  return out;
}

describe("renderMarkdown: never crashes on arbitrary markdown-shaped input", () => {
  it("throws nothing but MarkdownError, and returns the documented shape otherwise", () => {
    const rand = mulberry32(0x6d33_6c01);
    for (let run = 0; run < 1500; run += 1) {
      const source = randomString(rand, CHARS, 60);
      let result;
      try {
        result = renderMarkdown(source);
      } catch (error) {
        expect(error).toBeInstanceOf(MarkdownError);
        continue;
      }
      expect(typeof result.html).toBe("string");
      expect(Array.isArray(result.headings)).toBe(true);
      expect(Array.isArray(result.italics)).toBe(true);
    }
  });
});

describe("slugifyHeading: total, whitespace-free for any input", () => {
  it("never throws and never emits whitespace, for Unicode and markdown-shaped input", () => {
    const rand = mulberry32(0x6d33_6c02);
    for (let run = 0; run < 1000; run += 1) {
      const text = run % 2 === 0 ? randomUnicode(rand, 80) : randomString(rand, CHARS, 60);
      const slug = slugifyHeading(text);
      expect(/\s/.test(slug)).toBe(false);
    }
  });
});
