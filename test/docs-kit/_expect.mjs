// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

/**
 * A small `expect(...)` facade over `node:assert/strict`, so the ported
 * groundwork assertions read as they did under vitest. Only the matchers the
 * docs-kit tests use exist. Also `it.each`, which `node:test` lacks.
 */
import assert from "node:assert/strict";
import { format } from "node:util";
import { describe, it as nodeIt } from "node:test";

function matchers(actual, negate) {
  const check = (pass, message, assertion) => {
    if (negate ? pass : !pass) assertion ? assertion() : assert.fail(`${negate ? "not " : ""}${message}`);
  };
  const m = {
    toBe: (expected) =>
      negate ? assert.notStrictEqual(actual, expected) : assert.strictEqual(actual, expected),
    toEqual: (expected) =>
      negate ? assert.notDeepStrictEqual(actual, expected) : assert.deepStrictEqual(actual, expected),
    toContain: (item) => {
      const pass = typeof actual === "string" ? actual.includes(item) : [...actual].includes(item);
      check(pass, `expected ${format(actual)} to contain ${format(item)}`);
    },
    toHaveLength: (n) => check(actual.length === n, `expected length ${n}, got ${actual.length}: ${format(actual)}`),
    toBeInstanceOf: (cls) => check(actual instanceof cls, `expected instance of ${cls.name}, got ${format(actual)}`),
    toMatch: (re) => check(re.test(actual), `expected ${format(actual)} to match ${re}`),
    toHaveProperty: (name) =>
      check(actual !== null && typeof actual === "object" && name in actual, `expected property ${name}`),
    toBeGreaterThan: (n) => check(actual > n, `expected ${actual} > ${n}`),
    toBeGreaterThanOrEqual: (n) => check(actual >= n, `expected ${actual} >= ${n}`),
    toBeNull: () => check(actual === null, `expected null, got ${format(actual)}`),
    toBeUndefined: () => check(actual === undefined, `expected undefined, got ${format(actual)}`),
    toThrow: (expected) => {
      let thrown;
      try {
        actual();
      } catch (error) {
        thrown = error ?? new Error("thrown");
      }
      const pass =
        thrown !== undefined &&
        (expected === undefined ||
          (typeof expected === "function" ? thrown instanceof expected : expected.test(thrown.message)));
      check(pass, `expected a throw${expected ? ` matching ${expected}` : ""}, got ${format(thrown)}`);
    },
  };
  m.toThrowError = m.toThrow;
  return m;
}

export function expect(actual) {
  return { ...matchers(actual, false), not: matchers(actual, true) };
}

/** `it` with vitest's `it.each(table)(title, fn)`; `%s` fills from each row. */
export const it = Object.assign(nodeIt, {
  each: (table) => (title, fn) => {
    for (const row of table) {
      const args = Array.isArray(row) ? row : [row];
      nodeIt(format(title, ...args.map((a) => (typeof a === "string" ? a : format(a)))), () => fn(...args));
    }
  },
});

export { describe };

/** Deterministic PRNG (mulberry32) for the seeded property loops. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
