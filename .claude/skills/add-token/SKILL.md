---
name: add-token
description: Checklist for adding, changing, renaming or removing an m3l-design token (colour, spacing, radius, type, motion, shadow, theme value) so source/dtcg/, source/tokens.json, the contrast tables, the generated files and CHANGELOG.md stay in sync. Usually run by hand as /add-token. Not for read-only questions, releases, shell scripts or app CSS that only uses a variable.
---

# Change a m3l-design token

A token lives in several places that must agree, and CI fails on any drift. The canonical copy is `source/dtcg/`; everything else is derived from it or checked against it. Work in this order so each step has something to verify against.

## 1. Edit the canonical source

Change the right file in `source/dtcg/`: `primitives`, `semantic`, `components`, `theme-light`/`theme-dark`, or `motion-default`/`motion-reduced`. Prefer an alias to a primitive (`{color.neutral.700}`) over a raw value, and for a colour that differs by theme, edit both theme files.

If a token file is renamed, added or reordered, also update the constants at the top of `source/lib/design-tokens.mjs` and `source/dtcg/m3l.resolver.json`. The resolver hard-codes the merge order and each file name, and `assertResolverShape` fails at load time when they disagree. A new type style also needs its name in `STYLE_NAMES` and the `org.monte3l.m3l-design` extension on it.

## 2. Mirror it in `source/tokens.json`

`source/tokens.json` is only the test oracle, but `test/design-tokens.test.mjs` compares the resolver's output with it family by family, for both themes. Make the same change there or the parity test fails. Match the surrounding formatting (Prettier style, as the rest of `source/`).

## 3. Update the contrast tables for any colour change

If a colour changed, recompute the affected pairings with the WCAG 2.2 method described in `source/foundations/contrast.md` and update its tables and the worked examples if the tightest pair moved. The floors are **4.5:1** for text and **3:1** for UI boundaries, focus rings and icons, in both themes. A pairing that now fails is a design decision, so stop and tell the user instead of adjusting values to squeeze under the line. Also check the component README under `source/components/` if it quotes the value.

A purely decorative token (a hairline divider, a background tint) is exempt from the floors, which is why existing decorative tokens such as `color-border-subtle` have no rows. Follow that precedent, but still compute its ratio against the surfaces it sits on and report it, so the user can see how faint it is. Add table rows only if the token carries text or marks a UI boundary.

Then compare the new value with its siblings. If an alias now equals another token's (a new border that matches `surface-raised`, a tertiary text step that lands on secondary), the two stop being distinguishable on some surface. Report each collision and let the user decide. Do not invent a new primitive to avoid it.

## 4. Regenerate, never hand-edit

```sh
node bin/build-design-tokens.mjs
node --test
```

`tokens.css` and `SHA256SUMS` are generated. Editing them by hand produces hashes that the build will overwrite or CI will reject. `SHA256SUMS` covers every file in `source/`, docs included, so it must be regenerated and committed after any `source/` edit, not only after a token edit. Finish with `node bin/build-design-tokens.mjs --check`.

## 5. Record the semver impact (required, even for a one-value tweak)

Consumers read the changelog to decide whether to re-sync, and a changed colour is visible to them even when the file diff is one line. The release workflow writes that changelog from your commits, so the commit type is the record: use the README "Versions" table. Removing or renaming a token, class or file is **major** (`feat!:` or `fix!:`, with a `BREAKING CHANGE:` footer naming it); adding one, or changing a value that still passes AA, is **minor** (`feat(tokens):`). Put the token's name in the subject, because the subject becomes the changelog line, and put the contrast ratios in the pull request body. The resolver's exports are a public API for `m3l-groundwork`, so mention it if the change alters them.

For a rename or removal, also search for the old name before regenerating: `grep -rnE '<old-name>' source artifact README.md`. Spellings differ by file (`radius.xl` in DTCG, `--radius-xl` in CSS, `r-xl` in preview classes), so search each form. The artifact preview pages and the brand book often still use the old name, and the parity test will not catch them.

Do not bump the version or cut a release here. The release workflow does that from your commits, and the `release` skill reviews its pull request, only when the user asks.

## Report

Finish with a short report that always contains: the files changed; whether `--check` and `node --test` pass; the contrast ratios (before and after for a change, against the relevant surfaces for a new colour); any sibling collisions found; and the semver bump with the changelog line you wrote. A report that omits the bump or the ratios sends the user back to ask for them.
