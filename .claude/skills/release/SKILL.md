---
name: release
description: Prepare a m3l-design release up to a draft GitHub release, following the README "Releasing" steps 1 to 5. Run it only when the user types /release or explicitly asks to cut, prepare or draft a release. It never publishes.
disable-model-invocation: true
argument-hint: "[vX.Y.Z]"
---

# Release m3l-design (draft only)

Releases here are immutable: once a tag is published, its name can never be used again, and a mistake costs a version number. This skill therefore does steps 1 to 5 of the README's "Releasing" section and **stops with a draft**. Publishing (step 6) and attestation (step 7) happen only when the user asks for them in plain words, after they have looked at the draft.

Run from the repository root. Stop and report at the first failing check instead of working around it.

## 1. Choose the version

Read `CHANGELOG.md` `[Unreleased]` and `git log <last-tag>..HEAD`, then pick the bump from the README "Versions" table:

| Bump | When |
| --- | --- |
| Major | A token, class or file is removed or renamed |
| Minor | A token, component or variant is added, or a value changes and still passes AA |
| Patch | Docs or the generator change, with no token change |

If the user passed a version argument, use it, but say so if it disagrees with the table. Confirm the final `vX.Y.Z` with the user before editing, because everything after this is keyed to it.

## 2. Bump the version everywhere

Change these in one commit, and nothing else in that commit:

- `CHANGELOG.md`: move the `[Unreleased]` entries under a new `## [X.Y.Z] - <today>` heading and fix the compare links at the bottom.
- `README.md`: the `**Version:**` line near the top, and the `bin/sync-design.sh vX.Y.Z` example in "Adopt it".
- `design/README.md`: the `**Version adopted:**` line and `**Date adopted:**`.

These files are outside `source/` and `tokens.css`, so `SHA256SUMS` does not change. If it does, something else was edited by hand. Find out what.

Commit with a Conventional Commit message (for example `chore: release vX.Y.Z`) using `git commit -s`, as the repository requires. Do not push or tag.

## 3. Verify

Run all three and show their results:

```sh
node bin/build-design-tokens.mjs --check
node --test
pipx run --spec 'reuse[charset-normalizer]==6.2.0' reuse lint
```

Never regenerate `tokens.css` or `SHA256SUMS` by hand to make `--check` pass. If it fails, a source change is missing its rebuild: run `node bin/build-design-tokens.mjs`, review the diff and commit it separately.

## 4. Rehearse against each consumer

The consumers are `m3l-groundwork` and `m3l-prompt-optimizer`. In a scratch copy of each (never the working clone):

```sh
bin/sync-design.sh --dry-run --from <commit> vX.Y.Z <scratch-consumer>
```

`<commit>` is the release commit from step 2. Summarise what would change per consumer. Flag anything that looks like a breaking change for a Minor or Patch release.

## 5. Build the assets and create the draft

```sh
bin/package-release.sh vX.Y.Z <commit> dist
gh release create vX.Y.Z --draft --target <commit> --title vX.Y.Z --notes-file <notes> dist/*
```

The tarball is named after the tag because that is the name `sync-design.sh` asks the release for. Write `<notes>` from the new CHANGELOG section into the scratchpad, not into the repository. Always pass `--draft`: a `gh release create` without it publishes immediately and the tag is gone for good.

Then download the draft assets again and compare them with `dist/` (`sha256sum`) so you know what was uploaded is what was built.

## 6. Stop

Report the draft URL, the commit it targets and the results of steps 3 and 4, then tell the user the next steps are theirs to trigger:

```sh
gh release edit vX.Y.Z --draft=false   # publish: makes the tag permanent
gh release verify vX.Y.Z               # check the attestation
```

Do not run either unless the user explicitly asks. Approval to prepare a release is not approval to publish it.
