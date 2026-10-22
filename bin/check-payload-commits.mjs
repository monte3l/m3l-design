#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

/**
 * Fails a pull request that changes the release payload without a commit the
 * release workflow would release.
 *
 * The version and CHANGELOG.md are written from the Conventional Commit types
 * on `main`: `feat` is a minor release, `fix` a patch, `!` or a
 * `BREAKING CHANGE:` footer a major one, and `docs`, `chore` and `ci` release
 * nothing. Commit lint only checks that a message parses, so a changed colour
 * committed as `chore` would merge and never ship, and a consumer deciding
 * whether to re-sync from the version number would be misled. The payload is
 * `source/`, `tokens.css` and `SHA256SUMS`.
 *
 * Two rules, both about the pull request as a whole:
 *   1. A payload change needs at least one releasable commit.
 *   2. A payload file that is deleted or renamed needs a breaking commit.
 *
 * What it cannot see: that a `feat` should have been a `fix`, or that a value
 * removed from inside a file is a removal. `/release` reviews the version.
 *
 * Usage: BASE_SHA=<sha> HEAD_SHA=<sha> EVENT_NAME=pull_request check-payload-commits.mjs
 */
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CONVENTIONAL = /^([a-z]+)(\([^)]*\))?(!)?:/;

/** @param {string} path @returns {boolean} whether `path` is part of the release payload */
export function isPayload(path) {
  return path === "tokens.css" || path === "SHA256SUMS" || path.startsWith("source/");
}

/** @param {{ subject: string, body: string }} commit @returns {boolean} `!` or a `BREAKING CHANGE:` footer */
export function isBreaking({ subject, body }) {
  return CONVENTIONAL.exec(subject)?.[3] === "!" || /^BREAKING[ -]CHANGE:/m.test(body);
}

/** @param {{ subject: string, body: string }} commit @returns {boolean} whether release-please would release it */
export function isReleasable(commit) {
  const type = CONVENTIONAL.exec(commit.subject)?.[1];
  return type === "feat" || type === "fix" || isBreaking(commit);
}

/**
 * @param {{ status: string, paths: string[] }[]} files from `git diff --name-status`, `paths` being the old path then the new one for a rename
 * @param {{ subject: string, body: string }[]} commits the non-merge commits of the pull request
 * @returns {string[]} the problems, empty when the pull request is fine
 */
export function payloadProblems(files, commits) {
  const touched = files.filter((f) => f.paths.some(isPayload));
  if (!touched.length) return [];
  const problems = [];
  if (!commits.some(isReleasable)) {
    const named = touched.slice(0, 3).map((f) => f.paths.at(-1)).join(", ");
    problems.push(
      `this pull request changes the payload (${named}${touched.length > 3 ? ", ..." : ""}) but no commit is feat or fix, so the release workflow would never release it. Use feat for an addition or fix for a docs or generator change inside the payload.`,
    );
  }
  const gone = touched.filter((f) => /^[DR]/.test(f.status));
  if (gone.length && !commits.some(isBreaking)) {
    problems.push(
      `${gone.map((f) => f.paths[0]).join(", ")} is deleted or renamed, which is a major change, but no commit is breaking. Mark it feat! or fix! and add a BREAKING CHANGE: footer naming it.`,
    );
  }
  return problems;
}

/** Parses `git diff --name-status` output. */
export function parseNameStatus(out) {
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status, ...paths] = line.split("\t");
      return { status, paths };
    });
}

/** Parses `git log --format=%x1e%s%x1f%b` output. */
export function parseCommits(out) {
  return out
    .split("\x1e")
    .filter((record) => record.trim())
    .map((record) => {
      const [subject, body = ""] = record.split("\x1f");
      return { subject: subject.trim(), body };
    });
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function main() {
  if (process.env.EVENT_NAME !== "pull_request") {
    console.log(`not a pull request (event: ${process.env.EVENT_NAME ?? "none"}) -- nothing to check`);
    return 0;
  }
  const { BASE_SHA: base, HEAD_SHA: head } = process.env;
  if (!/^[0-9a-f]{40}$/.test(base ?? "") || !/^[0-9a-f]{40}$/.test(head ?? "")) {
    console.error("pull request event without a base or head commit -- failing closed");
    return 1;
  }
  const files = parseNameStatus(git("diff", "--name-status", "-M", `${base}...${head}`));
  const commits = parseCommits(git("log", "--no-merges", "--format=%x1e%s%x1f%b", `${base}..${head}`));
  const problems = payloadProblems(files, commits);
  for (const problem of problems) console.error(`::error title=Payload commit type::${problem}`);
  console.log(
    `${files.filter((f) => f.paths.some(isPayload)).length} payload file(s) changed in ${commits.length} commit(s): ${problems.length ? "failing" : "ok"}`,
  );
  return problems.length ? 1 : 0;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
