// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

/** Covers `lib/config.mjs`: every `configProblems` rule and `loadConfig`. */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ConfigError, configProblems, loadConfig } from "../../source/docs-kit/lib/config.mjs";

const valid = () => ({
  title: "T",
  repo: "https://github.com/o/r",
  siteUrl: "https://t.example.com",
  designDir: "design",
  navGroups: ["Start"],
  pages: [{ src: "README.md", out: "index.html", group: "Start", label: "Home" }],
});
const problemsOf = (patch) => configProblems({ ...valid(), ...patch });
const one = (patch, re) => {
  const out = problemsOf(patch);
  assert.equal(out.length, 1, out.join("\n"));
  assert.match(out[0], re);
};

describe("configProblems", () => {
  it("accepts a minimal valid config and every optional key", () => {
    assert.deepEqual(configProblems(valid()), []);
    assert.deepEqual(
      problemsOf({
        exclude: [{ glob: "x/**", reason: "why" }],
        generators: ["g.mjs"],
        parity: ["p.mjs"],
        nav: [{ href: "index.html", label: "Docs" }],
        manifest: "package.json",
        brand: true,
      }),
      [],
    );
    assert.deepEqual(problemsOf({ brand: false }), []);
  });

  it("rejects a brand that is not a boolean", () => {
    one({ brand: "yes" }, /"brand" must be true or false/);
  });

  it("rejects a config that is not an object", () => {
    for (const bad of [null, undefined, "x", 3]) {
      assert.deepEqual(configProblems(bad), ["the default export must be an object"]);
    }
  });

  it("requires title, repo, siteUrl and designDir as non-empty strings", () => {
    for (const key of ["title", "repo", "siteUrl", "designDir"]) {
      for (const bad of ["", 5, undefined]) {
        const out = problemsOf({ [key]: bad });
        assert.ok(out.includes(`"${key}" must be a non-empty string`), `${key}=${bad}: ${out}`);
      }
    }
  });

  it("requires repo to be a GitHub owner/name URL", () => {
    one({ repo: "https://gitlab.com/o/r" }, /"repo" must look like/);
    one({ repo: "https://github.com/o/r/extra" }, /"repo" must look like/);
    one({ repo: "https://github.com/o/" }, /"repo" must look like/);
  });

  it("requires siteUrl to be an https origin without path", () => {
    one({ siteUrl: "http://t.example.com" }, /"siteUrl" must be an https origin/);
    one({ siteUrl: "https://t.example.com/" }, /"siteUrl" must be an https origin/);
    one({ siteUrl: "https://t.example.com/docs" }, /"siteUrl" must be an https origin/);
  });

  it("requires a non-empty navGroups array", () => {
    const out = problemsOf({ navGroups: [] });
    assert.ok(out.some((p) => /"navGroups" must be a non-empty array/.test(p)));
    assert.ok(configProblems({ ...valid(), navGroups: "Start" }).some((p) => /"navGroups"/.test(p)));
  });

  it("requires a non-empty pages array", () => {
    one({ pages: [] }, /"pages" must be a non-empty array/);
    one({ pages: undefined }, /"pages" must be a non-empty array/);
  });

  it("requires src, out, group and label on each page", () => {
    for (const key of ["src", "out", "group", "label"]) {
      const page = { ...valid().pages[0], [key]: "" };
      const out = problemsOf({ pages: [page, { src: "b.md", out: "index.html", group: "Start", label: "B" }] });
      assert.ok(out.some((p) => p.includes(`pages[0].${key} must be a non-empty string`)), `${key}: ${out}`);
    }
  });

  it("requires each page group to be in navGroups", () => {
    one({ pages: [{ ...valid().pages[0], group: "Nope" }] }, /pages\[0\]\.group "Nope" is not in navGroups/);
  });

  it("rejects duplicate out paths", () => {
    const page = valid().pages[0];
    one({ pages: [page, { ...page, src: "B.md" }] }, /pages\[1\]\.out "index\.html" is used twice/);
  });

  it("requires one page with out index.html", () => {
    one({ pages: [{ ...valid().pages[0], out: "home.html" }] }, /one page must have out "index\.html"/);
  });

  it("requires exclude entries to carry a glob and a non-blank reason", () => {
    one({ exclude: [{ glob: "x" }] }, /exclude\[0\] needs a "glob" and a non-empty "reason"/);
    one({ exclude: [{ glob: "x", reason: "  " }] }, /exclude\[0\] needs/);
    one({ exclude: [{ reason: "r" }] }, /exclude\[0\] needs/);
    one({ exclude: "x" }, /"exclude" must be an array of \{ glob, reason \}/);
  });

  it("requires generators, parity and nav to be arrays", () => {
    for (const key of ["generators", "parity", "nav"]) {
      one({ [key]: "x" }, new RegExp(`"${key}" must be an array`));
    }
  });

  it("requires manifest to be a path string", () => {
    one({ manifest: 3 }, /"manifest" must be a path string/);
  });

  it("lists every problem at once", () => {
    assert.ok(configProblems({}).length >= 5);
  });
});

describe("loadConfig", () => {
  const dirs = [];
  const tmp = async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "m3l-config-"));
    dirs.push(dir);
    return dir;
  };
  after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

  it("returns the config plus root and absolute configPath", async () => {
    const dir = await tmp();
    const file = path.join(dir, "docs.config.mjs");
    await writeFile(file, `export default ${JSON.stringify(valid())};\n`);
    const config = await loadConfig(file);
    assert.equal(config.root, dir);
    assert.equal(config.configPath, file);
    assert.equal(config.title, "T");
  });

  it("throws ConfigError listing the problems of an invalid config", async () => {
    const dir = await tmp();
    const file = path.join(dir, "docs.config.mjs");
    await writeFile(file, `export default { title: "" };\n`);
    await assert.rejects(loadConfig(file), (error) => {
      assert.ok(error instanceof ConfigError);
      assert.equal(error.name, "ConfigError");
      assert.match(error.message, /"title" must be a non-empty string/);
      assert.match(error.message, /"pages" must be a non-empty array/);
      return true;
    });
  });

  it("throws ConfigError for a missing file or one that does not parse", async () => {
    const dir = await tmp();
    await assert.rejects(loadConfig(path.join(dir, "nope.mjs")), /ConfigError|cannot load/);
    const file = path.join(dir, "broken.mjs");
    await writeFile(file, "export default {;\n");
    await assert.rejects(loadConfig(file), (error) => error instanceof ConfigError && /cannot load/.test(error.message));
  });
});
