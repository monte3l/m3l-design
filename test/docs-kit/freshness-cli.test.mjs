// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

/** Covers `freshness.mjs`: the report and every exit code, against throwaway repositories with fixed commit dates. */
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { run } from "../../source/docs-kit/freshness.mjs";

const CLI = path.join(import.meta.dirname, "..", "..", "source", "docs-kit", "freshness.mjs");
const IDENT = ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false"];

const dirs = [];
after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

const git = (cwd, ...args) => spawnSync("git", [...IDENT, ...args], { cwd, encoding: "utf8" });
function commit(cwd, date) {
  git(cwd, "add", "-A");
  const stamp = `${date}T12:00:00+0000`;
  const result = spawnSync("git", [...IDENT, "commit", "-q", "-m", `change on ${date}`], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_DATE: stamp, GIT_COMMITTER_DATE: stamp },
  });
  assert.equal(result.status, 0, result.stderr);
}

const config = (extra = "") => `export default {
  title: "Fixture",
  repo: "https://github.com/acme/fixture",
  siteUrl: "https://docs.example.com",
  designDir: "design",
  navGroups: ["Start"],
  pages: [
    { src: "README.md", out: "index.html", group: "Start", label: "Home" },
    { src: "docs/a.md", out: "a.html", group: "Start", label: "A" },
  ],
${extra}};
`;

/**
 * A repository whose README was last committed on 2026-01-10 and docs/a.md on 2026-11-01.
 * @param {{ extra?: string, readme?: string }} [options] `extra` is added to the config, `readme` is the README text
 */
async function repo({ extra = "", readme = "# Fixture\n" } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "m3l-fresh-cli-"));
  dirs.push(root);
  git(root, "init", "-q");
  await mkdir(path.join(root, "docs"));
  await writeFile(path.join(root, "docs.config.mjs"), config(extra));
  await writeFile(path.join(root, "README.md"), readme);
  await writeFile(path.join(root, "docs/a.md"), "# A\n");
  commit(root, "2026-01-10");
  await writeFile(path.join(root, "docs/a.md"), "# A\n\nMore.\n");
  commit(root, "2026-11-01");
  return root;
}

/** Runs the CLI function and collects what it printed. */
async function cli(root, args, io = {}) {
  const out = [];
  const err = [];
  const code = await run(["--config", path.join(root, "docs.config.mjs"), ...args], { out: (t) => out.push(t), err: (t) => err.push(t), ...io });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

describe("freshness.mjs report", () => {
  it("exits 0 and says so when every page is within the limit", async () => {
    const result = await cli(await repo(), ["--today", "2026-03-01"]);
    assert.equal(result.code, 0, result.err);
    assert.equal(result.out, "All 2 pages were committed or reviewed within 180 days (today is 2026-03-01).");
  });

  it("exits 1 with a Markdown table of the pages that are past the limit, oldest problem first by page", async () => {
    const result = await cli(await repo(), ["--today", "2026-11-20"]);
    assert.equal(result.code, 1, result.err);
    assert.match(result.out, /^1 of 2 pages need a look \(limit 180 days, today is 2026-11-20\)\./);
    assert.match(result.out, /\| Page \| Finding \| Detail \|\n\| --- \| --- \| --- \|\n\| `README\.md` \| STALE \| last touched 2026-01-10 \(last commit\), 314 days ago \|/);
    assert.ok(!result.out.includes("docs/a.md"), "a page within the limit is not listed");
    assert.match(result.out, /set `reviewed: YYYY-MM-DD` in its frontmatter/);
    assert.equal(result.err, "");
  });

  it("takes the limit from --max-age, then from the config, then 180", async () => {
    const root = await repo({ extra: "  freshness: { maxAgeDays: 400 },\n" });
    assert.equal((await cli(root, ["--today", "2026-11-20"])).code, 0, "the config's limit");
    const flagged = await cli(root, ["--today", "2026-11-20", "--max-age", "10"]);
    assert.equal(flagged.code, 1, "the flag wins over the config");
    assert.match(flagged.out, /2 of 2 pages need a look \(limit 10 days/);
  });

  it("leaves out the pages that freshness.exclude names", async () => {
    const root = await repo({ extra: '  freshness: { exclude: [{ glob: "README.md", reason: "rarely changes on purpose" }] },\n' });
    const result = await cli(root, ["--today", "2026-11-20"]);
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /^All 1 pages/);
  });

  it("counts a reviewed date that is later than the commit", async () => {
    const root = await repo({ readme: "---\nreviewed: 2026-11-10\n---\n# Fixture\n" });
    const result = await cli(root, ["--today", "2026-11-20"]);
    assert.equal(result.code, 0, result.out);
  });

  it("reports a reviewed date that is not a date and one that has not happened", async () => {
    const bad = await cli(await repo({ readme: "---\nreviewed: soon\n---\n# Fixture\n" }), ["--today", "2026-02-01"]);
    assert.equal(bad.code, 1);
    assert.match(bad.out, /\| `README\.md` \| INVALID \| reviewed "soon" is not a date written YYYY-MM-DD \|/);
    const future = await cli(await repo({ readme: "---\nreviewed: 2027-01-01\n---\n# Fixture\n" }), ["--today", "2026-11-20"]);
    assert.equal(future.code, 1);
    assert.match(future.out, /\| FUTURE \| reviewed 2027-01-01 is after today \(2026-11-20\) \|/);
    assert.match(future.out, /\| STALE \|/, "the page is still aged by its commit");
  });

  it("uses the clock for today when --today is not given", async () => {
    const result = await cli(await repo(), [], { now: () => "2026-03-01" });
    assert.equal(result.code, 0);
    assert.match(result.out, /today is 2026-03-01/);
  });
});

describe("freshness.mjs exit codes", () => {
  it("exits 2 for a bad command line, and prints nothing on standard output", async () => {
    const root = await repo();
    for (const [args, message] of [
      [["--nope"], 'cannot use "--nope"'],
      [["--today"], "--today needs a value"],
      [["--max-age", "--today"], "--max-age needs a value"],
      [["--today", "yesterday"], "--today must be a date written YYYY-MM-DD"],
      [["--today", "2026-02-30"], "--today must be a date written YYYY-MM-DD"],
      [["--max-age", "0"], "--max-age must be a positive whole number of days"],
      [["--max-age", "2.5"], "--max-age must be a positive whole number of days"],
    ]) {
      const result = await cli(root, args);
      assert.equal(result.code, 2, args.join(" "));
      assert.ok(result.err.includes(message), `${args.join(" ")}: ${result.err}`);
      assert.match(result.err, /usage: node freshness\.mjs/);
      assert.equal(result.out, "");
    }
  });

  it("exits 2 for a config that is missing or invalid", async () => {
    const missing = await run(["--config", "/no/such/docs.config.mjs"], { out: () => {}, err: () => {} });
    assert.equal(missing, 2);
    const root = await repo({ extra: "  freshness: { maxAgeDays: 0 },\n" });
    const result = await cli(root, []);
    assert.equal(result.code, 2);
    assert.match(result.err, /freshness\.maxAgeDays" must be a positive whole number/);
  });

  it("exits 3, never 0, when git cannot say (a shallow clone)", async () => {
    const result = await cli(await repo(), ["--today", "2026-11-20"], { git: () => "true" });
    assert.equal(result.code, 3);
    assert.match(result.err, /shallow clone.*fetch-depth: 0/);
    assert.equal(result.out, "");
  });

  it("exits 3, with the message and no stack trace, when git fails in a way nobody planned for", async () => {
    const result = await cli(await repo(), ["--today", "2026-11-20"], {
      git: () => {
        throw new Error("boom: out of memory");
      },
    });
    assert.equal(result.code, 3);
    assert.match(result.err, /docs-kit freshness: boom: out of memory/);
    assert.doesNotMatch(result.err, /\n\s+at /);
  });

  it("exits 3 for a page that cannot be read as a file", async () => {
    const root = await repo();
    await rm(path.join(root, "docs/a.md"));
    await mkdir(path.join(root, "docs/a.md"));
    const result = await cli(root, ["--today", "2026-11-20"]);
    assert.equal(result.code, 3);
    assert.match(result.err, /EISDIR|illegal operation on a directory/);
  });

  it("exits 2 for a config that cannot be loaded, whatever the reason", async () => {
    const root = await repo();
    await writeFile(path.join(root, "docs.config.mjs"), "export default {{{ not javascript");
    const result = await cli(root, []);
    assert.equal(result.code, 2);
    assert.match(result.err, /cannot load/);
  });

  it("exits 3 for a page the config lists but the repository lacks", async () => {
    const root = await repo({ extra: '  exclude: [],\n' });
    await writeFile(path.join(root, "docs.config.mjs"), config().replace('src: "docs/a.md"', 'src: "docs/gone.md"'));
    const result = await cli(root, ["--today", "2026-11-20"]);
    assert.equal(result.code, 3);
    assert.match(result.err, /ENOENT|no such file/);
  });
});

describe("freshness.mjs as a program", () => {
  it("runs from the command line with the same exit codes", async () => {
    const root = await repo();
    const stale = spawnSync(process.execPath, [CLI, "--today", "2026-11-20"], { cwd: root, encoding: "utf8" });
    assert.equal(stale.status, 1, stale.stderr);
    assert.match(stale.stdout, /\| `README\.md` \| STALE \|/);
    const fresh = spawnSync(process.execPath, [CLI, "--today", "2026-02-01"], { cwd: root, encoding: "utf8" });
    assert.equal(fresh.status, 0, fresh.stderr);
    const bad = spawnSync(process.execPath, [CLI, "--wat"], { cwd: root, encoding: "utf8" });
    assert.equal(bad.status, 2);
    assert.match(bad.stderr, /cannot use "--wat"/);
  });

  it("exits 3 in a real shallow clone", async () => {
    const root = await repo();
    const clone = await mkdtemp(path.join(tmpdir(), "m3l-fresh-cli-clone-"));
    dirs.push(clone);
    const made = spawnSync("git", ["clone", "-q", "--depth", "1", `file://${root}`, path.join(clone, "r")], { encoding: "utf8" });
    assert.equal(made.status, 0, made.stderr);
    const result = spawnSync(process.execPath, [CLI, "--today", "2026-11-20"], { cwd: path.join(clone, "r"), encoding: "utf8" });
    assert.equal(result.status, 3, result.stdout);
    assert.match(result.stderr, /fetch-depth: 0/);
  });
});
