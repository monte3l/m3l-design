// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

// The two shell scripts that move a release: bin/sync-design.sh copies one into
// a consumer, and bin/package-release.sh builds it. Both run here against this
// clone's own HEAD (`--from HEAD`), so nothing needs the network or a published
// release. The claims in docs/assurance-case.md that these tests back: a bad tag
// or a missing marker stops the sync before it writes anything, a dry run writes
// nothing, a sync writes only under design/, and one commit packages to the
// same bytes every time.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const bash = (script, args) => spawnSync("bash", [script, ...args], { cwd: root, encoding: "utf8" });

/** A scratch directory that is removed whatever the test does. */
function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), "m3l-design-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/** A consumer directory with a vendored-tier marker, as sync-design.sh requires. */
function consumer(t, version = "v0.0.1") {
  const dir = scratch(t);
  mkdirSync(join(dir, "design"));
  writeFileSync(join(dir, "design", "README.md"), `# design/\n- **Version copied:** \`${version}\`\n`);
  return dir;
}

const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

test("sync-design rejects a tag that is not vX.Y.Z before it touches anything", (t) => {
  const dir = consumer(t);
  for (const tag of ["main", "v1.2", "v1.2.3-rc1", "v1/../x", "1.2.3"]) {
    const result = bash("bin/sync-design.sh", ["--dry-run", "--from", "HEAD", tag, dir]);
    assert.equal(result.status, 2, `${tag}: ${result.stderr}`);
    assert.match(result.stderr, /tag must look like v1\.2\.3/, tag);
  }
  assert.equal(existsSync(join(dir, "design", "source")), false);
});

test("sync-design never creates the marker, and says how to add it", (t) => {
  const dir = scratch(t);
  const result = bash("bin/sync-design.sh", ["--from", "HEAD", "v1.0.0", dir]);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /never creates it/);
  assert.deepEqual(readdirSync(dir), []);
});

test("sync-design refuses a marker with no Version copied or adopted line", (t) => {
  const dir = scratch(t);
  mkdirSync(join(dir, "design"));
  writeFileSync(join(dir, "design", "README.md"), "# design/\nno version here\n");
  const result = bash("bin/sync-design.sh", ["--from", "HEAD", "v1.0.0", dir]);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /has no "- \*\*Version copied:\*\*"/);
});

test("sync-design --dry-run writes nothing", (t) => {
  const dir = consumer(t);
  const marker = join(dir, "design", "README.md");
  const before = readFileSync(marker, "utf8");
  const result = bash("bin/sync-design.sh", ["--dry-run", "--from", "HEAD", "v1.0.0", dir]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /nothing written/);
  assert.equal(readFileSync(marker, "utf8"), before);
  assert.deepEqual(readdirSync(join(dir, "design")), ["README.md"]);
});

test("sync-design --from rejects a ref that is not a commit", (t) => {
  const dir = consumer(t);
  const result = bash("bin/sync-design.sh", ["--from", "no-such-ref-anywhere", "v1.0.0", dir]);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /is not a commit/);
});

test("a sync copies the payload, updates the marker and writes only under design/", (t) => {
  const dir = consumer(t);
  const result = bash("bin/sync-design.sh", ["--from", "HEAD", "v1.0.0", dir]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readdirSync(dir), ["design"]);
  assert.deepEqual(readdirSync(join(dir, "design")).sort(), ["README.md", "SHA256SUMS", "source", "tokens.css"]);
  assert.equal(sha(join(dir, "design", "tokens.css")), sha(join(root, "tokens.css")));
  assert.equal(sha(join(dir, "design", "SHA256SUMS")), sha(join(root, "SHA256SUMS")));
  const marker = readFileSync(join(dir, "design", "README.md"), "utf8");
  assert.match(marker, /- \*\*Version copied:\*\* `v1\.0\.0`/);
  assert.match(marker, /- \*\*Last re-synced:\*\* \d{4}-\d{2}-\d{2}/);
});

test("a sync replaces a stale design/source and leaves design/local alone", (t) => {
  const dir = consumer(t);
  mkdirSync(join(dir, "design", "source"));
  writeFileSync(join(dir, "design", "source", "stale.txt"), "left over\n");
  mkdirSync(join(dir, "design", "local"));
  writeFileSync(join(dir, "design", "local", "mine.css"), "a { color: red }\n");
  const result = bash("bin/sync-design.sh", ["--from", "HEAD", "v1.0.0", dir]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(dir, "design", "source", "stale.txt")), false);
  assert.equal(readFileSync(join(dir, "design", "local", "mine.css"), "utf8"), "a { color: red }\n");
});

test("a content-tier marker copies no files", (t) => {
  const dir = scratch(t);
  mkdirSync(join(dir, "design"));
  writeFileSync(join(dir, "design", "README.md"), "# design/\n- **Version adopted:** `v0.0.1`\n");
  const result = bash("bin/sync-design.sh", ["--from", "HEAD", "v1.0.0", dir]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readdirSync(join(dir, "design")), ["README.md"]);
  assert.match(readFileSync(join(dir, "design", "README.md"), "utf8"), /- \*\*Version adopted:\*\* `v1\.0\.0`/);
});

test("package-release builds the same bytes from the same commit, twice", (t) => {
  const one = scratch(t);
  const two = scratch(t);
  for (const out of [one, two]) {
    const result = bash("bin/package-release.sh", ["v9.9.9", "HEAD", out]);
    assert.equal(result.status, 0, result.stderr);
  }
  const names = ["m3l-design-v9.9.9.tar.gz", "SHA256SUMS", "tokens.css"];
  assert.deepEqual(readdirSync(one).sort(), [...names].sort());
  for (const name of names) {
    assert.equal(sha(join(one, name)), sha(join(two, name)), name);
  }
  assert.equal(sha(join(one, "SHA256SUMS")), sha(join(root, "SHA256SUMS")));
});

test("package-release rejects a malformed tag and an unknown ref", (t) => {
  const out = scratch(t);
  const badTag = bash("bin/package-release.sh", ["v1.2", "HEAD", out]);
  assert.equal(badTag.status, 2, badTag.stderr);
  assert.match(badTag.stderr, /tag must look like v1\.2\.3/);
  const badRef = bash("bin/package-release.sh", ["v1.2.3", "no-such-ref-anywhere", out]);
  assert.equal(badRef.status, 2, badRef.stderr);
  assert.match(badRef.stderr, /is not a commit/);
  assert.deepEqual(readdirSync(out), []);
});
