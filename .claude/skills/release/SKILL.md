---
name: release
description: Review the open m3l-design release pull request before it is merged. Checks the proposed version against the README "Versions" table, the generated changelog, the payload checks and a dry-run sync into each consumer. Run it only when the user types /release or explicitly asks to review or prepare a release. It never merges or publishes.
disable-model-invocation: true
argument-hint: "[pull request number]"
---

# Review the m3l-design release pull request

Releases here are automatic and immutable. The `Release` workflow opens one pull request from the Conventional Commits since the last tag, and merging it builds the assets, attests them and publishes. A published tag name can never be reused, so a mistake costs a version number. This skill is the review that happens **before** the merge, and it stops there: merging is the user's decision, and approval to review is not approval to merge.

Run from the repository root. Stop and report at the first failing check instead of working around it.

## 1. Find the pull request

```sh
gh pr list --state open --search "chore(main): release" --json number,title,headRefOid,url
```

Use the number the user passed, if any. If there is none, nothing releasable has landed since the last tag, or a payload change was committed with a type that is never released. Go to step 2, and tell the user which.

## 2. Check the version against the commits

Read the commits since the last tag and the payload diff:

```sh
git log --format='%h %s' "$(git describe --tags --abbrev=0)"..origin/main
git diff --stat "$(git describe --tags --abbrev=0)"..origin/main -- source tokens.css
```

Compare the proposed version with the README "Versions" table. The commit type is the bump, so check both directions:

| Finding | What it means | Fix |
| --- | --- | --- |
| Payload changed, but only `docs:` or `chore:` commits touch it | It will never be released | A follow-up `fix(docs):` commit, or a `Release-As: X.Y.Z` footer |
| A token or class was removed or renamed, but no commit is `!` | The bump is too small | Amend the history through a pull request, or `Release-As` with the major version |
| A `feat` that only changes docs or the generator | The bump is too large | `Release-As` with the patch version |

Report what you find. Do not change commits yourself.

## 3. Read the pull request

The release pull request must change **only** `CHANGELOG.md`, `README.md`, `design/README.md` and `.release-please-manifest.json`. Anything else, and above all `SHA256SUMS`, `tokens.css` or `source/`, means something was edited by hand.

Check that the `Version:` line in `README.md`, the `Version adopted:` line in `design/README.md` and the manifest all name the proposed version, and that the new `CHANGELOG.md` section lists what the commits say. `scripts/doc-parity.mjs` compares the changelog with `Version adopted`, and CI runs it.

## 4. Verify the pull request head

In a scratch worktree of the pull request's head commit, never the working clone:

```sh
node bin/build-design-tokens.mjs --check
node --test
node source/docs-kit/build.mjs --check
pipx run --spec 'reuse[charset-normalizer]==6.2.0' reuse lint
```

Never regenerate `tokens.css` or `SHA256SUMS` to make `--check` pass. If it fails, a source change is missing its rebuild: that belongs in its own commit on `main`.

## 5. Rehearse against each consumer

The consumers are `m3l-groundwork`, `m3l-prompt-optimizer` and `m3l-output-governor`. The release pull request changes no payload file, so its head commit carries the payload that will be released. In a scratch copy of each consumer (never the working clone):

```sh
bin/sync-design.sh --dry-run --from <pull request head commit> vX.Y.Z <scratch-consumer>
```

Summarise what would change per consumer. Flag anything that looks like a breaking change in a minor or patch release.

## 6. Stop

Report the pull request URL, the proposed version, and the results of steps 2 to 5. Then say the merge is theirs: merging with a merge commit publishes an immutable release. If the user asks for it afterwards, `gh release verify vX.Y.Z` checks the attestation.

Do not merge the pull request, and do not run `gh release edit --draft=false` or `gh release create`. The release guard hook asks before either.
