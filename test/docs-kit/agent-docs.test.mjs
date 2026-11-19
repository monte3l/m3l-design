// SPDX-FileCopyrightText: 2026 Enrico Lionello (enri3l), Giulia Montevecchi (giulmonte), monte3l
// SPDX-License-Identifier: MIT

/**
 * The agent-readable parts of a docs site: the pure builders in
 * `lib/agent-docs.mjs` (the `.md` copy name, `llms.txt`, `llms-full.txt`,
 * `sitemap.xml`, the config checks) and `rewriteLinks` in `lib/markdown.mjs`,
 * which turns a page into its copy. The end-to-end cases are in
 * `build.test.mjs`.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  agentDocsConfigProblems,
  buildLlmsFull,
  buildLlmsTxt,
  buildSitemap,
  encodePath,
  markdownOutPath,
} from "../../source/docs-kit/lib/agent-docs.mjs";
import { configProblems } from "../../source/docs-kit/lib/config.mjs";
import { rewriteLinks } from "../../source/docs-kit/lib/markdown.mjs";

const SITE = "https://docs.example.com";

describe("markdownOutPath", () => {
  it("names the copy by swapping the extension, in any directory", () => {
    assert.equal(markdownOutPath("standard.html"), "standard.md");
    assert.equal(markdownOutPath("components/badge.html"), "components/badge.md");
    assert.equal(markdownOutPath("index.html"), "index.md");
  });

  it("refuses a path that does not end in .html", () => {
    assert.throws(() => markdownOutPath("data.json"), /does not end in \.html/);
  });
});

describe("buildLlmsTxt", () => {
  const pages = [
    { out: "index.html", group: "Start", label: "Overview", summary: "What this is", markdownOut: "index.md" },
    { out: "guide.html", group: "Start", label: "Guide", markdownOut: "guide.md" },
    { out: "components/badge.html", group: "Parts", label: "Badge", summary: "A badge", markdownOut: "components/badge.md" },
    { out: "tokens.html", group: "Parts", label: "Tokens" },
    { out: "CHANGELOG.html", group: "Project", label: "Releases", markdownOut: "CHANGELOG.md" },
  ];
  const base = {
    title: "Fixture",
    siteUrl: SITE,
    navGroups: ["Start", "Parts", "Empty", "Project"],
    pages,
  };

  it("writes the title, the summary and one list per group, in nav order", () => {
    const text = buildLlmsTxt({ ...base, llms: { description: "A fixture site." } });
    assert.equal(
      text,
      [
        "# Fixture",
        "",
        "> A fixture site.",
        "",
        "## Start",
        "",
        `- [Overview](${SITE}/index.md): What this is`,
        `- [Guide](${SITE}/guide.md)`,
        "",
        "## Parts",
        "",
        `- [Badge](${SITE}/components/badge.md): A badge`,
        `- [Tokens](${SITE}/tokens)`,
        "",
        "## Project",
        "",
        `- [Releases](${SITE}/CHANGELOG.md)`,
        "",
      ].join("\n"),
    );
  });

  it("skips a group with no pages and ends with one newline", () => {
    const text = buildLlmsTxt({ ...base, llms: { description: "d" } });
    assert.doesNotMatch(text, /## Empty/);
    assert.ok(text.endsWith(")\n") && !text.endsWith("\n\n"));
  });

  it("gathers the optional groups under a final Optional heading", () => {
    const text = buildLlmsTxt({ ...base, llms: { description: "d", optionalGroups: ["Project"] } });
    assert.doesNotMatch(text, /## Project/);
    assert.ok(text.indexOf("## Optional") > text.indexOf("## Parts"));
    assert.match(text, /## Optional\n\n- \[Releases\]\(https:\/\/docs\.example\.com\/CHANGELOG\.md\)\n$/);
  });

  it("escapes a bracket in a label so it cannot end the link early", () => {
    const text = buildLlmsTxt({
      title: "T",
      siteUrl: SITE,
      navGroups: ["A"],
      llms: { description: "d" },
      pages: [{ out: "x.html", group: "A", label: "Use [x] and \\y", markdownOut: "x.md" }],
    });
    assert.match(text, /- \[Use \\\[x\\\] and \\\\y\]\(https:\/\/docs\.example\.com\/x\.md\)/);
  });

  it("links a page with no copy to its public URL, and the home page to the root's copy", () => {
    const text = buildLlmsTxt({ ...base, llms: { description: "d" } });
    assert.match(text, /\[Tokens\]\(https:\/\/docs\.example\.com\/tokens\)/);
    assert.match(text, /\[Overview\]\(https:\/\/docs\.example\.com\/index\.md\)/);
  });
});

describe("buildLlmsFull", () => {
  it("joins every copy under the title, each after the URL it is served at", () => {
    const text = buildLlmsFull({
      title: "Fixture",
      siteUrl: SITE,
      llms: { description: "A fixture site." },
      copies: [
        { markdownOut: "index.md", text: "# Home\n\nHello.\n" },
        { markdownOut: "guide.md", text: "# Guide\n" },
      ],
    });
    const sections = ["# Fixture\n\n> A fixture site.", `Source: ${SITE}/index.md\n\n# Home\n\nHello.`, `Source: ${SITE}/guide.md\n\n# Guide`];
    assert.equal(text, `${sections.join("\n\n---\n\n")}\n`);
  });
});

describe("buildSitemap", () => {
  it("lists each page by its public URL, with the home page as the root", () => {
    const xml = buildSitemap({
      siteUrl: SITE,
      pages: [{ out: "index.html" }, { out: "guide.html" }, { out: "components/badge.html" }],
    });
    assert.ok(xml.startsWith(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`));
    assert.match(xml, /<loc>https:\/\/docs\.example\.com\/<\/loc>/);
    assert.match(xml, /<loc>https:\/\/docs\.example\.com\/guide<\/loc>/);
    assert.match(xml, /<loc>https:\/\/docs\.example\.com\/components\/badge<\/loc>/);
    assert.ok(xml.endsWith("</urlset>\n"));
  });

  it("keeps what XML reserves out of a location: the path is percent-encoded, then escaped", () => {
    const xml = buildSitemap({ siteUrl: SITE, pages: [{ out: "a&b.html" }, { out: "x'y.html" }] });
    assert.match(xml, /a%26b</);
    assert.match(xml, /x%27y</);
    assert.doesNotMatch(xml, /<loc>[^<]*[&'"][^<]*<\/loc>/);
  });

  it("still escapes a reserved character that reaches the location, as defence in depth", () => {
    assert.match(buildSitemap({ siteUrl: "https://a.example.com/?x=1&y=2", pages: [{ out: "p.html" }] }), /\?x=1&amp;y=2\/p</);
  });
});

describe("agentDocsConfigProblems", () => {
  const ok = {
    navGroups: ["Start", "Project"],
    pages: [{ src: "README.md", out: "index.html", group: "Start", label: "Home", summary: "The home page" }],
    llms: { description: "A site.", optionalGroups: ["Project"], full: true },
    sitemap: true,
  };
  const withConfig = (patch) => agentDocsConfigProblems({ ...ok, ...patch });

  it("has nothing to say about a valid config, or one that sets neither option", () => {
    assert.deepEqual(agentDocsConfigProblems(ok), []);
    assert.deepEqual(
      agentDocsConfigProblems({ navGroups: ["A"], pages: [{ src: "a.md", out: "a.json", group: "A", label: "A" }] }),
      [],
      "the .html rule applies only when llms is set",
    );
  });

  it("requires llms to be an object with a one-line description", () => {
    assert.match(withConfig({ llms: "yes" })[0], /"llms" must be an object/);
    assert.match(withConfig({ llms: [] })[0], /"llms" must be an object/);
    assert.match(withConfig({ llms: {} })[0], /"llms.description" must be a non-empty single line/);
    assert.match(withConfig({ llms: { description: "two\nlines" } })[0], /single line/);
    assert.match(withConfig({ llms: { description: "   " } })[0], /single line/);
  });

  it("rejects an unknown llms option, so a typo is not silently ignored", () => {
    assert.match(withConfig({ llms: { description: "d", optionalGroup: ["Project"] } })[0], /"llms.optionalGroup" is not an option/);
  });

  it("checks optionalGroups and full", () => {
    assert.match(withConfig({ llms: { description: "d", optionalGroups: "Project" } })[0], /must be an array/);
    assert.match(withConfig({ llms: { description: "d", optionalGroups: ["Nope"] } })[0], /"Nope", which is not in navGroups/);
    assert.match(withConfig({ llms: { description: "d", full: "yes" } })[0], /"llms.full" must be true or false/);
  });

  it("needs .html pages when llms is set, so each copy can be named", () => {
    const problems = withConfig({ pages: [{ src: "a.md", out: "index.html", group: "Start", label: "A" }, { src: "b.md", out: "b.txt", group: "Start", label: "B" }] });
    assert.match(problems.join("\n"), /pages\[1\]\.out "b\.txt" must end in \.html/);
  });

  it("checks sitemap and a page's summary", () => {
    assert.match(withConfig({ sitemap: "yes" })[0], /"sitemap" must be true or false/);
    assert.match(withConfig({ pages: [{ ...ok.pages[0], summary: "" }] })[0], /pages\[0\]\.summary must be a non-empty single line/);
    assert.match(withConfig({ pages: [{ ...ok.pages[0], summary: "a\nb" }] })[0], /single line/);
    assert.match(withConfig({ pages: [{ ...ok.pages[0], summary: 7 }] })[0], /single line/);
  });

  it("refuses a page whose output is a file the kit writes", () => {
    for (const out of ["llms.txt", "llms-full.txt", "sitemap.xml"]) {
      const problems = agentDocsConfigProblems({ ...ok, llms: { description: "d", full: true }, pages: [{ src: "a.md", out, group: "Start", label: "A" }] });
      assert.match(problems.join("\n"), /is a file the kit writes/);
    }
  });

  it("is part of configProblems", () => {
    const full = {
      title: "T",
      repo: "https://github.com/a/b",
      siteUrl: "https://x.example.com",
      designDir: "design",
      navGroups: ["Start"],
      pages: [{ src: "a.md", out: "index.html", group: "Start", label: "A" }],
    };
    assert.deepEqual(configProblems(full), []);
    assert.match(configProblems({ ...full, llms: {} }).join("\n"), /llms\.description/);
  });
});

describe("rewriteLinks", () => {
  const up = (href) => `<${href}>`;

  it("rewrites the target of a link and of an image, and keeps their text", () => {
    assert.equal(rewriteLinks("See [the guide](guide.md) and ![logo](a/b.png).", up), "See [the guide](<guide.md>) and ![logo](<a/b.png>).");
  });

  it("rewrites both targets of a badge image inside a link", () => {
    assert.equal(rewriteLinks("[![ci](https://x/ci.svg)](https://x/run)", up), "[![ci](<https://x/ci.svg>)](<https://x/run>)");
  });

  it("finds a link inside bold or italic, and inside a link's own text", () => {
    assert.equal(rewriteLinks("**[a](a.md)** and *[b](b.md)* and __[c](c.md)__ and _[d](d.md)_", up), "**[a](<a.md>)** and *[b](<b.md>)* and __[c](<c.md>)__ and _[d](<d.md>)_");
    assert.equal(rewriteLinks("[**bold** text](t.md)", up), "[**bold** text](<t.md>)");
  });

  it("leaves a code span alone, even when it holds a link", () => {
    assert.equal(rewriteLinks("Write `[x](y.md)` then [z](z.md).", up), "Write `[x](y.md)` then [z](<z.md>).");
  });

  it("leaves fenced code alone, with backticks or tildes", () => {
    const text = "```md\n[x](y.md)\n```\n[a](a.md)\n~~~\n[b](b.md)\n~~~\n";
    assert.equal(rewriteLinks(text, up), "```md\n[x](y.md)\n```\n[a](<a.md>)\n~~~\n[b](b.md)\n~~~\n");
  });

  it("leaves a footnote reference alone and rewrites a link in a footnote body", () => {
    assert.equal(rewriteLinks("Claim.[^1]\n\n[^1]:\n    See [it](it.md).\n", up), "Claim.[^1]\n\n[^1]:\n    See [it](<it.md>).\n");
  });

  it("rewrites a link in a table cell and in a list item", () => {
    assert.equal(rewriteLinks("| a | [b](b.md) |\n| - | - |\n\n- [c](c.md)\n", up), "| a | [b](<b.md>) |\n| - | - |\n\n- [c](<c.md>)\n");
  });

  it("drops frontmatter and HTML comments, as the renderer does", () => {
    assert.equal(rewriteLinks("---\ntitle: x\n---\n# Page\n<!-- hidden [x](x.md) -->\nText.\n", up), "# Page\n\nText.\n");
  });

  it("passes the whole target to mapHref, anchor and all", () => {
    const seen = [];
    rewriteLinks("[a](page.md#part) [b](#here) [c](https://example.com/x)", (href) => {
      seen.push(href);
      return href;
    });
    assert.deepEqual(seen, ["page.md#part", "#here", "https://example.com/x"]);
  });

  it("returns the text unchanged when mapHref is the identity and there is nothing to drop", () => {
    const text = "# Title\n\nPlain **bold** text, `code`, and [a link](a.md).\n\n```\nfence\n```\n";
    assert.equal(rewriteLinks(text, (href) => href), text);
  });
});

describe("rewriteLinks: the start of a line", () => {
  const up = (href) => `<${href}>`;

  it("does not let a bullet `*` pair with the `**` of a bold link", () => {
    assert.equal(rewriteLinks("* [**Arch**](docs/a.md) tail", up), "* [**Arch**](<docs/a.md>) tail");
    assert.equal(rewriteLinks("+ [**Arch**](docs/a.md)", up), "+ [**Arch**](<docs/a.md>)");
  });

  it("finds a link after a blockquote marker, an ordered marker and a nested bullet", () => {
    assert.equal(rewriteLinks("> * [**Arch**](a.md)", up), "> * [**Arch**](<a.md>)");
    assert.equal(rewriteLinks("1. [**Arch**](a.md)", up), "1. [**Arch**](<a.md>)");
    assert.equal(rewriteLinks("      - [x](y.md)", up), "      - [x](<y.md>)");
    assert.equal(rewriteLinks("> [!NOTE]\n> See [x](y.md).", up), "> [!NOTE]\n> See [x](<y.md>).");
  });

  it("does not take bold or italic at the start of a line for a bullet", () => {
    assert.equal(rewriteLinks("**bold** [a](b.md)", up), "**bold** [a](<b.md>)");
    assert.equal(rewriteLinks("*italic* and [a](b.md)", up), "*italic* and [a](<b.md>)");
  });
});

describe("encodePath and non-trivial page paths", () => {
  it("leaves an ordinary path alone and encodes what would break a link", () => {
    assert.equal(encodePath("components/badge.md"), "components/badge.md");
    assert.equal(encodePath("/CHANGELOG"), "/CHANGELOG");
    assert.equal(encodePath("a (b).md"), "a%20%28b%29.md");
    assert.equal(encodePath("caf\u00e9.md"), "caf%C3%A9.md");
  });

  it("uses it in llms.txt, llms-full.txt and the sitemap", () => {
    const pages = [{ out: "a (b).html", group: "A", label: "Odd", markdownOut: "a (b).md" }];
    assert.match(buildLlmsTxt({ title: "T", siteUrl: SITE, navGroups: ["A"], llms: { description: "d" }, pages }), /\(https:\/\/docs\.example\.com\/a%20%28b%29\.md\)/);
    assert.match(buildLlmsFull({ title: "T", siteUrl: SITE, llms: { description: "d" }, copies: [{ markdownOut: "a (b).md", text: "x" }] }), /Source: https:\/\/docs\.example\.com\/a%20%28b%29\.md/);
    assert.match(buildSitemap({ siteUrl: SITE, pages }), /<loc>https:\/\/docs\.example\.com\/a%20%28b%29<\/loc>/);
  });

  it("keeps an uppercase output and a nested index page as written", () => {
    const xml = buildSitemap({ siteUrl: SITE, pages: [{ out: "CHANGELOG.html" }, { out: "docs/index.html" }] });
    assert.match(xml, /<loc>https:\/\/docs\.example\.com\/CHANGELOG<\/loc>/);
    assert.match(xml, /<loc>https:\/\/docs\.example\.com\/docs\/index<\/loc>/);
    const text = buildLlmsTxt({ title: "T", siteUrl: SITE, navGroups: ["A"], llms: { description: "d" }, pages: [{ out: "docs/index.html", group: "A", label: "D", markdownOut: "docs/index.md" }] });
    assert.match(text, /\(https:\/\/docs\.example\.com\/docs\/index\.md\)/);
  });

  it("refuses a nav group called Optional unless it is listed as optional", () => {
    const base = { navGroups: ["Optional"], pages: [{ src: "a.md", out: "index.html", group: "Optional", label: "A" }], llms: { description: "d" } };
    assert.match(agentDocsConfigProblems(base).join("\n"), /nav group called "Optional" would clash/);
    assert.deepEqual(agentDocsConfigProblems({ ...base, llms: { description: "d", optionalGroups: ["Optional"] } }), []);
  });
});

