// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

// The two command-line entry points that no other test loads. Each runs as a
// child process, the way CI and a maintainer run it, so the exit codes in their
// headers are the contract under test. Neither needs the network.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

const run = (script, args = []) =>
  spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });

test("build-design-tokens --check passes on the committed files and writes nothing", () => {
  const result = run("bin/build-design-tokens.mjs", ["--check"]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /tokens\.css is current/);
  assert.match(result.stdout, /SHA256SUMS is current/);
});

test("check-live exits 2 with the usage text for an unknown option", () => {
  const result = run("source/docs-kit/check-live.mjs", ["--no-such-option"]);
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stderr, /usage: node source\/docs-kit\/check-live\.mjs/);
});

test("check-live exits 2 when it is given nothing to check", () => {
  const result = run("source/docs-kit/check-live.mjs");
  assert.equal(result.status, 2, result.stdout + result.stderr);
  assert.match(result.stderr, /usage:/);
});
