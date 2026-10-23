// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

/**
 * Checks the committed brand pack: every SVG is accessible and carries its
 * licence tag, no ids collide inside a file, the colours are the design
 * tokens, and the generated text files match what the build would write.
 *
 * Run with `node --test`.
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brand = path.join(root, "source/brand");
const svgs = ["logo", "favicon", "social"].flatMap((dir) =>
  readdirSync(path.join(brand, dir))
    .filter((name) => name.endsWith(".svg"))
    .map((name) => `${dir}/${name}`),
);

describe("brand pack", () => {
  it("has the nine logo files", () => {
    const logos = svgs.filter((file) => file.startsWith("logo/"));
    assert.equal(logos.length, 9);
  });

  for (const file of svgs) {
    describe(file, () => {
      const text = readFileSync(path.join(brand, file), "utf8");

      it("is named, tagged and labelled", () => {
        assert.ok(text.includes(`SPDX-License-${"Identifier"}: LicenseRef-MONTE3L-Brand`));
        assert.match(text, /<svg [^>]*role="img"[^>]*aria-labelledby="([\w-]+)-t"/);
        const labelledby = text.match(/aria-labelledby="([\w-]+)"/)[1];
        assert.match(text, new RegExp(`<title id="${labelledby}">`));
      });

      it("has no duplicate id", () => {
        const ids = [...text.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
        assert.equal(new Set(ids).size, ids.length);
      });

      it("uses only token colours, currentColor or black", () => {
        const allowed = new Set([
          "#1a1617", "#692746", "#fefcfd", "#554d50", "#faf5f7", "#d1789e", "#120e10", "#000", "#fff", "#000000",
        ]);
        for (const [hex] of text.matchAll(/#[0-9a-fA-F]{3,6}\b/g)) {
          if (/^#[0-9a-f]{6}$/.test(hex) || hex.length === 4) assert.ok(allowed.has(hex), `${file}: ${hex} is not a token colour`);
        }
      });
    });
  }

  it("ships every raster the manifest and docs name", () => {
    const manifest = JSON.parse(readFileSync(path.join(brand, "favicon/site.webmanifest"), "utf8"));
    for (const icon of manifest.icons) assert.ok(existsSync(path.join(brand, "favicon", icon.src)), icon.src);
    for (const file of ["favicon/favicon.ico", "favicon/apple-touch-icon.png", "github/avatar.png", "social/social-preview.png", "social/og-image.png"]) {
      assert.ok(existsSync(path.join(brand, file)), file);
    }
  });

  it("favicon.ico holds the 16, 32 and 48 px frames", () => {
    const ico = readFileSync(path.join(brand, "favicon/favicon.ico"));
    assert.equal(ico.readUInt16LE(2), 1, "type is icon");
    const count = ico.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, i) => ico.readUInt8(6 + i * 16));
    assert.deepEqual(sizes, [16, 32, 48]);
  });

  describe("raster stamp", () => {
    const build = path.join(root, "bin/build-brand.mjs");
    const run = (stamp) => spawnSync(process.execPath, [build, "--check", "--stamp", stamp], { encoding: "utf8" });

    it("fails when the digest differs from the rasters' inputs", () => {
      const dir = mkdtempSync(path.join(tmpdir(), "m3l-stamp-"));
      try {
        writeFileSync(path.join(dir, "stamp"), `${"0".repeat(64)}\n`);
        const result = run(path.join(dir, "stamp"));
        assert.equal(result.status, 1, result.stdout + result.stderr);
        assert.match(result.stderr, /PNG and ICO files are stale \(a different /);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("fails when the stamp file is missing", () => {
      const result = run(path.join(tmpdir(), "m3l-no-such-stamp"));
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stderr, /stale \(no /);
    });

    it("passes with the committed stamp", () => {
      const result = run(path.join(root, "bin/brand-rasters.sha256"));
      assert.equal(result.status, 0, result.stdout + result.stderr);
    });
  });

  it("is up to date with the build", () => {
    execFileSync(process.execPath, [path.join(root, "bin/build-brand.mjs"), "--check"], { stdio: "pipe" });
  });
});
