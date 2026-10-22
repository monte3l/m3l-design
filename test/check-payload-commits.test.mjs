// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import {
  escapeCommandData,
  isBreaking,
  isPayload,
  isReleasable,
  parseCommits,
  parseNameStatus,
  payloadProblems,
} from "../bin/check-payload-commits.mjs";

const commit = (subject, body = "") => ({ subject, body });
const modified = (path) => ({ status: "M", paths: [path] });

test("the payload is source/, tokens.css and SHA256SUMS, and nothing else", () => {
  for (const path of ["source/dtcg/color.json", "source/docs-kit/build.mjs", "tokens.css", "SHA256SUMS"]) {
    assert.equal(isPayload(path), true, path);
  }
  for (const path of ["README.md", "artifact/components/button/preview.html", "bin/build-design-tokens.mjs", "sourcecode/x", "design/README.md"]) {
    assert.equal(isPayload(path), false, path);
  }
});

test("only feat, fix and breaking commits are releasable", () => {
  for (const c of [commit("feat: add a token"), commit("fix(docs): brand book"), commit("feat(tokens)!: drop one"), commit("chore: x", "BREAKING CHANGE: gone"), commit("refactor!: y")]) {
    assert.equal(isReleasable(c), true, c.subject);
  }
  for (const c of [commit("docs: readme"), commit("chore: regenerate"), commit("ci: x"), commit("test: y"), commit("not conventional"), commit("refactor: z")]) {
    assert.equal(isReleasable(c), false, c.subject);
  }
});

test("a breaking commit is `!` or a BREAKING CHANGE footer, in either spelling", () => {
  assert.equal(isBreaking(commit("feat!: a")), true);
  assert.equal(isBreaking(commit("fix(x)!: a")), true);
  assert.equal(isBreaking(commit("fix: a", "text\n\nBREAKING CHANGE: b")), true);
  assert.equal(isBreaking(commit("fix: a", "BREAKING-CHANGE: b")), true);
  assert.equal(isBreaking(commit("fix: a", "mentions BREAKING CHANGE: mid-line")), false);
  assert.equal(isBreaking(commit("feat: a")), false);
});

test("a pull request that does not touch the payload is never a problem", () => {
  assert.deepEqual(payloadProblems([modified("README.md"), modified("bin/x.mjs")], [commit("docs: x")]), []);
  assert.deepEqual(payloadProblems([], []), []);
});

test("a payload change committed as chore or docs is refused, and the message names the file", () => {
  const problems = payloadProblems([modified("source/dtcg/color.json")], [commit("chore: tweak a colour"), commit("docs: note")]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /source\/dtcg\/color\.json/);
  assert.match(problems[0], /feat or fix/);
});

test("one releasable commit among others is enough for a payload change", () => {
  assert.deepEqual(payloadProblems([modified("tokens.css"), modified("SHA256SUMS")], [commit("chore: regenerate"), commit("fix(tokens): contrast")]), []);
});

test("a regenerated SHA256SUMS on its own still counts as a payload change", () => {
  assert.equal(payloadProblems([modified("SHA256SUMS")], [commit("chore: regenerate")]).length, 1);
});

test("a deleted or renamed payload file needs a breaking commit, even with a feat", () => {
  const deleted = [{ status: "D", paths: ["source/components/old.css"] }];
  assert.equal(payloadProblems(deleted, [commit("feat: add a thing")]).length, 1);
  assert.deepEqual(payloadProblems(deleted, [commit("feat!: remove old.css", "BREAKING CHANGE: old.css")]), []);
  const renamed = [{ status: "R100", paths: ["source/a.css", "source/b.css"] }];
  assert.match(payloadProblems(renamed, [commit("fix: rename")]).join(" "), /source\/a\.css/);
});

test("a file renamed out of the payload is a deletion from it", () => {
  const moved = [{ status: "R90", paths: ["source/a.md", "docs/a.md"] }];
  assert.equal(payloadProblems(moved, [commit("fix: move")]).length, 1);
});

test("both problems are reported together, and a long file list is cut", () => {
  const files = ["a", "b", "c", "d", "e"].map((n) => ({ status: "D", paths: [`source/${n}`] }));
  const problems = payloadProblems(files, [commit("chore: x")]);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /\.\.\./);
});

test("parseNameStatus and parseCommits read git's output", () => {
  assert.deepEqual(parseNameStatus("M\tsource/a\nR100\tsource/b\tsource/c\n"), [
    { status: "M", paths: ["source/a"] },
    { status: "R100", paths: ["source/b", "source/c"] },
  ]);
  assert.deepEqual(parseCommits("\x1efeat: a\x1fbody one\n\x1efix: b\x1f\n"), [
    { subject: "feat: a", body: "body one\n" },
    { subject: "fix: b", body: "\n" },
  ]);
  assert.deepEqual(parseCommits(""), []);
});

const run = (env) =>
  spawnSync(process.execPath, [new URL("../bin/check-payload-commits.mjs", import.meta.url).pathname], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, ...env },
  });

test("outside a pull request the script does nothing, and with no commits it fails closed", () => {
  assert.equal(run({ EVENT_NAME: "push" }).status, 0);
  assert.equal(run({}).status, 0);
  const bad = run({ EVENT_NAME: "pull_request", BASE_SHA: "x", HEAD_SHA: "y" });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /failing closed/);
});

const withFiles = (subject, ...paths) => ({ ...commit(subject), sha: "abcdef1234567", files: paths.map((p) => modified(p)) });

test("a feat or fix commit that changes no payload file is refused, and a non-release type is not", () => {
  const problems = payloadProblems([modified("README.md")], [withFiles("fix: typo in README", "README.md")]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /abcdef1 "fix: typo in README"/);
  assert.match(problems[0], /docs, chore, ci or test/);
  assert.deepEqual(payloadProblems([modified("README.md")], [withFiles("docs: typo in README", "README.md")]), []);
});

test("a feat or fix commit that also changes a payload file is fine, even with other files", () => {
  assert.deepEqual(payloadProblems([modified("tokens.css"), modified("README.md")], [withFiles("fix: contrast", "README.md", "tokens.css")]), []);
});

test("the per-commit rule only applies to a commit that carries its files", () => {
  assert.deepEqual(payloadProblems([modified("README.md")], [commit("fix: typo in README")]), []);
});

test("a non-payload fix next to a payload chore is refused for the fix, and the chore is then covered", () => {
  // The fix counts as releasable for the pull-request rule, so only rule 3 fires.
  const files = [modified("source/dtcg/color.json")];
  const problems = payloadProblems(files, [withFiles("fix: harness", ".claude/x.sh"), withFiles("chore: colour", "source/dtcg/color.json")]);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /fix: harness/);
  // Retype the harness commit and the payload change has no releasable commit left.
  const retyped = payloadProblems(files, [withFiles("chore: harness", ".claude/x.sh"), withFiles("chore: colour", "source/dtcg/color.json")]);
  assert.equal(retyped.length, 1);
  assert.match(retyped[0], /no commit is feat or fix/);
});

test("a commit subject cannot start a workflow command", () => {
  assert.equal(escapeCommandData("a%0A::error::x\r\n100%"), "a%250A::error::x%0D%0A100%25");
  assert.ok(!/[\r\n]/.test(escapeCommandData("one\ntwo")));
});

// The release config can only exclude directories, so a new top-level
// directory must be listed there (or be the payload), or its fix and feat
// commits would release a version with an unchanged payload.
test("every tracked top-level directory is the payload or excluded from releases", async () => {
  const { readFileSync } = await import("node:fs");
  const config = JSON.parse(readFileSync(new URL("../release-please-config.json", import.meta.url), "utf8"));
  const excluded = new Set(config.packages["."]["exclude-paths"]);
  const root = new URL("..", import.meta.url).pathname;
  const tracked = spawnSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).stdout.split("\n").filter(Boolean);
  const dirs = new Set(tracked.filter((f) => f.includes("/")).map((f) => f.split("/")[0]));
  const unlisted = [...dirs].filter((d) => d !== "source" && !excluded.has(d));
  assert.deepEqual(unlisted, [], `add to exclude-paths in release-please-config.json: ${unlisted.join(", ")}`);
  const stale = [...excluded].filter((d) => !dirs.has(d));
  assert.deepEqual(stale, [], `exclude-paths names a directory that holds no tracked file: ${stale.join(", ")}`);
});
