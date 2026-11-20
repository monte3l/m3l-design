// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

/** Covers `lib/freshness.mjs`: the dates, the findings, the git lookup and the config rules. */
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { configProblems } from "../../source/docs-kit/lib/config.mjs";
import {
  DEFAULT_MAX_AGE_DAYS,
  FreshnessError,
  collectPageDates,
  daysBetween,
  freshnessConfigProblems,
  freshnessFindings,
  gitLastDates,
  isDate,
  reviewedOf,
} from "../../source/docs-kit/lib/freshness.mjs";

describe("isDate and daysBetween", () => {
  it("accepts a real calendar date and nothing else", () => {
    for (const good of ["2026-01-01", "2024-02-29", "2026-12-31"]) assert.equal(isDate(good), true, good);
    for (const bad of ["2026-02-30", "2025-02-29", "2026-13-01", "2026-00-10", "2026-1-1", "26-01-01", " 2026-01-01", "2026-01-01T00:00:00Z", "", null, 20260101, undefined]) {
      assert.equal(isDate(bad), false, String(bad));
    }
  });

  it("counts whole days, across a leap day and backwards", () => {
    assert.equal(daysBetween("2026-01-01", "2026-01-01"), 0);
    assert.equal(daysBetween("2026-01-01", "2026-07-01"), 181);
    assert.equal(daysBetween("2024-02-28", "2024-03-01"), 2);
    assert.equal(daysBetween("2026-03-10", "2026-03-01"), -9);
  });
});

describe("reviewedOf", () => {
  it("is absent without frontmatter or without the key", () => {
    assert.deepEqual(reviewedOf("# Title\n"), { state: "absent" });
    assert.deepEqual(reviewedOf("---\nname: x\n---\n# Title\n"), { state: "absent" });
    assert.deepEqual(reviewedOf(""), { state: "absent" });
  });

  it("reads a date, quoted or with a comment, and ignores the other keys", () => {
    const ok = { state: "valid", date: "2026-05-04" };
    assert.deepEqual(reviewedOf("---\nreviewed: 2026-05-04\n---\n# T\n"), ok);
    assert.deepEqual(reviewedOf("---\nsources:\n  - raw/a.md\nreviewed: 2026-05-04\n---\n# T\n"), ok);
    assert.deepEqual(reviewedOf('---\nreviewed: "2026-05-04"\n---\n'), ok);
    assert.deepEqual(reviewedOf("---\nreviewed: '2026-05-04'\n---\n"), ok);
    assert.deepEqual(reviewedOf("---\nreviewed: 2026-05-04 # read it again\n---\n"), ok);
    assert.deepEqual(reviewedOf("---\r\nreviewed: 2026-05-04\r\n---\r\n# T\r\n"), ok);
    assert.deepEqual(reviewedOf("---\nreviewed :   2026-05-04\n---\n"), ok);
  });

  it("says invalid, with what was written, for anything that is not a date", () => {
    for (const [written, raw] of [["soon", "soon"], ["2026-02-30", "2026-02-30"], ["", ""], ['"May 4"', "May 4"], ["04/05/2026", "04/05/2026"]]) {
      assert.deepEqual(reviewedOf(`---\nreviewed: ${written}\n---\n`), { state: "invalid", raw }, written);
    }
  });

  it("reads only the leading frontmatter, and only the exact key", () => {
    assert.deepEqual(reviewedOf("# T\n\n---\nreviewed: 2026-05-04\n---\n"), { state: "absent" });
    assert.deepEqual(reviewedOf("intro\n---\nreviewed: 2026-05-04\n---\n"), { state: "absent" });
    assert.deepEqual(reviewedOf("---\nreviewed_by: someone\n---\n"), { state: "absent" });
    assert.deepEqual(reviewedOf("---\nreviewed: 2026-05-04\n# never closed\n"), { state: "absent" });
  });

  it("stays fast on a long run of spaces and on a long unterminated block", () => {
    const started = performance.now();
    reviewedOf(`---\nreviewed: 2026-05-04${" ".repeat(200_000)}x\n---\n`);
    reviewedOf(`---\n${"a: b\n".repeat(100_000)}`);
    assert.ok(performance.now() - started < 5000, "a linear scan takes milliseconds; this guards against a quadratic one");
  });
});

const dates = (src, gitDate, reviewed = { state: "absent" }) => ({ src, gitDate, reviewed });
const valid = (date) => ({ state: "valid", date });
const TODAY = "2026-11-20";

describe("freshnessFindings", () => {
  it("uses 180 days by default and reports only past the limit", () => {
    assert.equal(DEFAULT_MAX_AGE_DAYS, 180);
    const edge = daysBetween("2026-05-24", TODAY); // 180 days
    assert.equal(edge, 180);
    assert.deepEqual(freshnessFindings({ pages: [dates("a.md", "2026-05-24")], today: TODAY }), []);
    const out = freshnessFindings({ pages: [dates("a.md", "2026-05-23")], today: TODAY });
    assert.equal(out.length, 1);
    assert.equal(out[0].kind, "STALE");
    assert.match(out[0].detail, /last touched 2026-05-23 \(last commit\), 181 days ago/);
  });

  it("takes the newer of the commit date and a usable reviewed date", () => {
    assert.deepEqual(freshnessFindings({ pages: [dates("a.md", "2025-01-01", valid("2026-11-01"))], today: TODAY }), []);
    const stale = freshnessFindings({ pages: [dates("a.md", "2026-11-01", valid("2025-01-01"))], today: TODAY });
    assert.deepEqual(stale, [], "an old reviewed date never hides a recent commit");
    const both = freshnessFindings({ pages: [dates("a.md", "2025-01-01", valid("2025-06-01"))], today: TODAY });
    assert.match(both[0].detail, /last touched 2025-06-01 \(reviewed\)/);
  });

  it("honours a limit that is given", () => {
    const page = dates("a.md", "2026-10-01");
    assert.deepEqual(freshnessFindings({ pages: [page], today: TODAY, maxAgeDays: 60 }), []);
    assert.equal(freshnessFindings({ pages: [page], today: TODAY, maxAgeDays: 30 }).length, 1);
  });

  it("does not age a page that git has never seen and nobody reviewed, but does once it is reviewed", () => {
    assert.deepEqual(freshnessFindings({ pages: [dates("new.md", null)], today: TODAY }), []);
    const reviewed = freshnessFindings({ pages: [dates("new.md", null, valid("2024-01-01"))], today: TODAY });
    assert.equal(reviewed[0].kind, "STALE");
  });

  it("reports a reviewed date that is not a date, and ages the page by git alone", () => {
    const out = freshnessFindings({ pages: [dates("a.md", "2025-01-01", { state: "invalid", raw: "soon" })], today: TODAY });
    assert.deepEqual(out.map((f) => f.kind), ["INVALID", "STALE"]);
    assert.match(out[0].detail, /reviewed "soon" is not a date/);
    const fresh = freshnessFindings({ pages: [dates("a.md", "2026-11-01", { state: "invalid", raw: "soon" })], today: TODAY });
    assert.deepEqual(fresh.map((f) => f.kind), ["INVALID"]);
  });

  it("reports a future reviewed date, and never lets it hide an old page", () => {
    const out = freshnessFindings({ pages: [dates("a.md", "2025-01-01", valid("2027-01-01"))], today: TODAY });
    assert.deepEqual(out.map((f) => f.kind), ["FUTURE", "STALE"]);
    assert.match(out[0].detail, /reviewed 2027-01-01 is after today \(2026-11-20\)/);
    assert.deepEqual(freshnessFindings({ pages: [dates("a.md", "2026-11-19", valid(TODAY))], today: TODAY }), [], "today itself is not the future");
  });

  it("is not thrown by a commit date that lies ahead of today", () => {
    assert.deepEqual(freshnessFindings({ pages: [dates("a.md", "2027-06-01")], today: TODAY }), []);
  });

  it("sorts by page, then by kind", () => {
    const out = freshnessFindings({
      pages: [dates("b.md", "2020-01-01"), dates("a.md", "2020-01-01", { state: "invalid", raw: "x" }), dates("c.md", "2020-01-01")],
      today: TODAY,
    });
    assert.deepEqual(out.map((f) => `${f.src}:${f.kind}`), ["a.md:INVALID", "a.md:STALE", "b.md:STALE", "c.md:STALE"]);
  });
});

describe("gitLastDates with an injected git", () => {
  const fake = (log, shallow = "false\n") => (args) => (args[0] === "rev-parse" ? shallow : log);

  it("asks git for nothing when there is nothing to look up", () => {
    const git = () => assert.fail("git was called");
    assert.equal(gitLastDates("/r", [], git).size, 0);
  });

  it("keeps the first, newest, date of each file and ignores files it was not asked about", () => {
    // `-z` output: a commit is \x01DATE, then a newline and its names, each ended by NUL. A merge has no names.
    const log = "\u00012026-06-02\0\nREADME.md\0other.md\0\u00012026-04-04\0\u00012026-03-01\0\nREADME.md\0docs/a.md\0\u00012026-01-05\0\ndocs/b.md\0";
    const result = gitLastDates("/r", ["README.md", "docs/a.md", "docs/b.md", "never.md"], fake(log));
    assert.deepEqual([...result], [["README.md", "2026-06-02"], ["docs/a.md", "2026-03-01"], ["docs/b.md", "2026-01-05"]]);
  });

  it("calls a shallow clone an error, never a quiet answer", () => {
    assert.throws(() => gitLastDates("/r", ["a.md"], fake("", "true\n")), (error) => error instanceof FreshnessError && error.code === "shallow" && /fetch-depth: 0/.test(error.message));
  });

  it("passes the paths after `--`, so a path can never be read as an option", () => {
    let seen;
    gitLastDates("/r", ["--evil.md"], (args) => {
      if (args[0] === "rev-parse") return "false";
      seen = args;
      return "";
    });
    assert.deepEqual(seen.slice(seen.indexOf("--")), ["--", "--evil.md"]);
    for (const flag of ["--literal-pathspecs", "-z", "--relative"]) assert.ok(seen.includes(flag), `${flag} is passed to git`);
  });

  it("drops only the one newline git puts after a record, so a name that starts with a newline stays itself", () => {
    const log = "\u00012026-06-02\0\n\nnewline-first.md\0";
    assert.deepEqual([...gitLastDates("/r", ["\nnewline-first.md"], fake(log))], [["\nnewline-first.md", "2026-06-02"]]);
  });

  it("refuses output that is not a date, which is what a git older than 2.21 prints for %cs", () => {
    assert.throws(() => gitLastDates("/r", ["a.md"], fake("\u0001%cs\0\na.md\0")), (error) => error instanceof FreshnessError && error.code === "git" && /git 2\.21/.test(error.message));
  });
});

const dirs = [];
after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

const IDENT = ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false"];
const git = (cwd, ...args) => spawnSync("git", [...IDENT, ...args], { cwd, encoding: "utf8" });
const commit = (cwd, message, date) => {
  const stamp = `${date}T12:00:00+0000`;
  const result = spawnSync("git", [...IDENT, "commit", "-q", "-m", message], { cwd, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_DATE: stamp, GIT_COMMITTER_DATE: stamp } });
  assert.equal(result.status, 0, result.stderr);
};

/** A repository with a.md changed on 2026-01-10 then 2026-05-05, b.md only on 2026-01-10 and c.md untracked. */
async function realRepo() {
  const root = await mkdtemp(path.join(tmpdir(), "m3l-fresh-"));
  dirs.push(root);
  assert.equal(git(root, "init", "-q").status, 0);
  await mkdir(path.join(root, "docs"));
  await writeFile(path.join(root, "a.md"), "one\n");
  await writeFile(path.join(root, "docs/b.md"), "one\n");
  git(root, "add", "-A");
  commit(root, "first", "2026-01-10");
  await writeFile(path.join(root, "a.md"), "two\n");
  git(root, "add", "-A");
  commit(root, "second", "2026-05-05");
  await writeFile(path.join(root, "c.md"), "untracked\n");
  return root;
}

describe("gitLastDates against a real repository", () => {
  it("returns the date of the last commit that changed each file, and nothing for an untracked one", async () => {
    const root = await realRepo();
    const result = gitLastDates(root, ["a.md", "docs/b.md", "c.md"]);
    assert.deepEqual([...result], [["a.md", "2026-05-05"], ["docs/b.md", "2026-01-10"]]);
  });

  it("reads a path with spaces and non-ASCII characters", async () => {
    const root = await realRepo();
    const name = "docs/Résumé notes.md";
    await writeFile(path.join(root, name), "x\n");
    git(root, "add", "-A");
    commit(root, "odd name", "2026-07-07");
    assert.equal(gitLastDates(root, [name]).get(name), "2026-07-07");
  });

  it("refuses a real shallow clone", async () => {
    const root = await realRepo();
    const clone = await mkdtemp(path.join(tmpdir(), "m3l-fresh-clone-"));
    dirs.push(clone);
    const made = spawnSync("git", ["clone", "-q", "--depth", "1", `file://${root}`, path.join(clone, "shallow")], { encoding: "utf8" });
    assert.equal(made.status, 0, made.stderr);
    assert.throws(() => gitLastDates(path.join(clone, "shallow"), ["a.md"]), (error) => error instanceof FreshnessError && error.code === "shallow");
  });

  it("finds the dates when the docs root is a subdirectory of the repository", async () => {
    const root = await realRepo();
    await mkdir(path.join(root, "site/docs"), { recursive: true });
    await writeFile(path.join(root, "site/a.md"), "x\n");
    await writeFile(path.join(root, "site/docs/b.md"), "x\n");
    git(root, "add", "-A");
    commit(root, "site", "2026-08-08");
    const result = gitLastDates(path.join(root, "site"), ["a.md", "docs/b.md"]);
    assert.deepEqual(Object.fromEntries(result), { "a.md": "2026-08-08", "docs/b.md": "2026-08-08" }, "relative to the root, not to the repository");
  });

  it("finds a name that git would quote: a quote, a backslash, a newline, a tab and non-ASCII", async () => {
    const root = await realRepo();
    const names = ['we"ird.md', "back\\slash.md", "new\nline.md", "tab\tname.md", "sp ace.md", "naïve ☃.md", "\nleading-newline.md"];
    for (const name of names) await writeFile(path.join(root, name), "x\n");
    git(root, "add", "-A");
    commit(root, "odd names", "2026-09-09");
    const result = gitLastDates(root, names);
    assert.deepEqual([...result.keys()].sort(), [...names].sort());
    for (const date of result.values()) assert.equal(date, "2026-09-09");
  });

  it("means a name literally when it looks like a glob or like pathspec magic", async () => {
    const root = await realRepo();
    await writeFile(path.join(root, "[id].md"), "x\n");
    await writeFile(path.join(root, "i.md"), "x\n");
    await writeFile(path.join(root, ":top.md"), "x\n");
    git(root, "add", "-A");
    commit(root, "globs", "2026-10-10");
    const result = gitLastDates(root, ["[id].md", ":top.md"]);
    assert.deepEqual(Object.fromEntries(result), { "[id].md": "2026-10-10", ":top.md": "2026-10-10" });
  });

  it("reports a directory that is not a repository as a git failure", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "m3l-fresh-none-"));
    dirs.push(dir);
    assert.throws(() => gitLastDates(dir, ["a.md"]), (error) => error instanceof FreshnessError && error.code === "git" && /rev-parse failed/.test(error.message));
  });
});

describe("collectPageDates", () => {
  const config = {
    root: "/r",
    pages: [{ src: "README.md" }, { src: "CHANGELOG.md" }, { src: "docs/a.md" }],
    freshness: { exclude: [{ glob: "CHANGELOG.md", reason: "generated" }] },
  };
  const gitFor = (args) => (args[0] === "rev-parse" ? "false" : "\u00012026-02-02\0\nREADME.md\0CHANGELOG.md\0");

  it("leaves out the pages the config excludes, pairing each with its dates", () => {
    const sources = { "README.md": "---\nreviewed: 2026-03-03\n---\n# R\n", "docs/a.md": "# A\n" };
    const result = collectPageDates(config, { read: (src) => sources[src], git: gitFor });
    assert.deepEqual(result, [
      { src: "README.md", gitDate: "2026-02-02", reviewed: { state: "valid", date: "2026-03-03" } },
      { src: "docs/a.md", gitDate: null, reviewed: { state: "absent" } },
    ]);
  });

  it("covers every page when nothing is excluded", () => {
    const result = collectPageDates({ ...config, freshness: undefined }, { read: () => "# x\n", git: gitFor });
    assert.deepEqual(result.map((page) => page.src), ["README.md", "CHANGELOG.md", "docs/a.md"]);
  });
});

describe("freshnessConfigProblems", () => {
  const problems = (freshness, extra = {}) => freshnessConfigProblems({ freshness, ...extra });

  it("accepts no key, an empty object and every option", () => {
    assert.deepEqual(freshnessConfigProblems({}), []);
    assert.deepEqual(problems({}), []);
    assert.deepEqual(problems({ maxAgeDays: 90, exclude: [{ glob: "CHANGELOG.md", reason: "generated" }], lastmod: true }, { sitemap: true }), []);
    assert.deepEqual(problems({ lastmod: false }), []);
  });

  it("rejects what is not an object, and an unknown key", () => {
    for (const bad of [null, "yes", 3, true, []]) assert.deepEqual(problems(bad), [`"freshness" must be an object`], String(bad));
    assert.match(problems({ maxAge: 5 })[0], /"freshness\.maxAge" is not a key of "freshness" \(use maxAgeDays, exclude, lastmod\)/);
  });

  it("wants a positive whole number of days", () => {
    for (const bad of [0, -1, 1.5, "90", null, Number.NaN]) assert.match(problems({ maxAgeDays: bad })[0], /maxAgeDays" must be a positive whole number/, String(bad));
  });

  it("wants exclude entries with a glob and a reason", () => {
    for (const bad of ["CHANGELOG.md", [{ glob: "x" }], [{ glob: "x", reason: " " }], [{ reason: "r" }], [null]]) {
      assert.match(problems({ exclude: bad })[0], /"freshness\.exclude" must be an array of \{ glob, reason \}/, JSON.stringify(bad));
    }
  });

  it("wants lastmod to be a boolean, and a sitemap to put it in", () => {
    assert.match(problems({ lastmod: "yes" })[0], /lastmod" must be true or false/);
    assert.match(problems({ lastmod: true })[0], /needs "sitemap": true/);
    assert.match(problems({ lastmod: true }, { sitemap: false })[0], /needs "sitemap": true/);
  });

  it("is part of configProblems", () => {
    const base = {
      title: "T",
      repo: "https://github.com/o/r",
      siteUrl: "https://t.example.com",
      designDir: "design",
      navGroups: ["Start"],
      pages: [{ src: "README.md", out: "index.html", group: "Start", label: "Home" }],
    };
    assert.deepEqual(configProblems({ ...base, freshness: { maxAgeDays: 30 } }), []);
    assert.deepEqual(configProblems({ ...base, freshness: { maxAgeDays: 0 } }).length, 1);
  });
});
