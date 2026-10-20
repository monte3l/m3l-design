---
name: writing-commits
description: >-
  Inspect the staged diff, select the Conventional Commit type, draft an
  imperative subject ≤70 chars, decide whether a body is needed, structure it as
  What → Why/How → semver impact, add Co-Authored-By when AI-assisted, then
  commit signed and signed off (git commit -s). Use for "commit this", "write
  a commit", "stage and commit".
---

# writing-commits

This skill produces git commits that match this repository's Conventional
Commits standard exactly — from picking the right type to deciding whether a
body is worth writing. The goal is to make every commit self-explanatory to a
reviewer who wasn't in the room. The changelog and the version bump come from
the message, so the type is not cosmetic.

## Checklist (copy-paste before drafting)

- [ ] Read `git diff --staged` — understand every changed file
- [ ] Pick the type from the table in Step 2 (when in doubt, `chore:` for
      tooling; `feat:` for a new token, class or public export)
- [ ] Draft a subject ≤ 70 chars, imperative, lowercase after `type:`
- [ ] Decide body: needed for `feat:` / `fix:` / non-obvious `chore:`; omit for
      mechanical chores
- [ ] Add `Co-Authored-By:` footer when Claude authored the commit
- [ ] Add `BREAKING CHANGE:` footer for `feat!:` commits
- [ ] Run `git commit -s -m "..."` with the full message (`-s` adds the DCO
      `Signed-off-by:` trailer; never pass `--no-gpg-sign`)

## Step 1 — Understand the change

```bash
git diff --staged          # the files about to be committed
git diff                   # unstaged context (reference only)
git log main..HEAD --oneline  # commits already on this branch
```

Read all three outputs before drafting anything. The staged diff is the
source of truth; the log prevents duplicate subjects when multiple commits
are planned.

## Step 2 — Select the commit type

| Type        | Use when                                                          | Public-API impact |
| ----------- | ----------------------------------------------------------------- | ----------------- |
| `feat:`     | A new token, class or public export reaches consumers             | Additive (minor)  |
| `fix:`      | A bug in a token value, script or generator is corrected          | Behavioural       |
| `docs:`     | Documentation only: READMEs, the brand book, comments             | None              |
| `chore:`    | Tooling, config, hooks, CLAUDE.md, formatting                     | None              |
| `ci:`       | GitHub Actions workflows only                                     | None              |
| `refactor:` | Internal restructuring with no public-API change                  | None              |
| `feat!:`    | A token, class, file or public export is removed or renamed       | Breaking (major)  |

The public surface is: token names, CSS class names, file paths under
`source/`, the exports of `source/lib/design-tokens.mjs`, and the docs kit's
`docs.config.mjs` keys, commands, flags and exit codes (see the README's
"Versioning policy").

**Scope rule**: add a scope in parentheses (`chore(deps):`) only when it
disambiguates which part of the repository changed; most commits here need
none.

## Step 3 — Draft the subject line

The subject is the one line a reviewer will read first. Make it count.

Rules (CONTRIBUTING.md; no `commit-msg` hook enforces them here, so check them
by eye):

- **Imperative present tense** — "implement", "add", "fix", not "implemented"
- **All lowercase** after `type:` — never `Feat:` or `feat: Add`
- **≤ 70 characters**
- **No trailing period**
- **Be specific** — name the token, script, module, or exported symbol

## Step 4 — Decide whether a body is needed

Adding a body is a judgment call about whether future readers need more than
the subject. A subject like `chore: fix typo in sync-design usage text` is
already complete — adding prose would just re-state what the diff shows. But
a subject that hides deliberate design work belongs in the body.

**Include a body when:**

- The type is `feat:` or `fix:` — always (readers need to know what the
  public contract now looks like)
- The change touches `source/dtcg/`, the resolver's exports, the docs kit's
  config keys or flags, `CLAUDE.md`, hooks, or agent prompts
- A `chore:` or `ci:` addresses a non-obvious problem (e.g., "why was this
  done at all?")

**Omit the body when:**

- Mechanical chores: formatting-only changes, single-line CI tweaks — the
  subject already covers it

## Step 5 — Structure the body

When a body is warranted, follow this shape:

```
<1–2 sentence What: name exactly what this adds, changes, or fixes>

- <bullet: key design decision or constraint — the why behind the how>
- <bullet: another detail a reviewer couldn't infer from the diff>
- <feat: list the tokens, classes or exports added/changed>

<semver impact line — one sentence stating what did or didn't change in the public surface>

Co-Authored-By: <exact model name from your environment> <noreply@anthropic.com>
```

**Co-Authored-By footer**: include whenever Claude authored or substantially
assisted the commit. Use the exact model name from the environment (e.g.,
`Claude Sonnet 5.5`, `Claude Opus 5.5`) — never copy a model name from an example
or template. The trailer is a provenance marker, not a legal authorship
claim.

**Sign-off and signature**: `git commit -s` appends `Signed-off-by: <name>
<email>` after your trailers. The `DCO sign-off` lane in `verify.yml` fails a
pull request if any commit lacks one matching its author or committer email,
and the `main` ruleset rejects unsigned commits (GPG or SSH). Never write the
`Signed-off-by:` line by hand, and never bypass signing. To fix a missing
sign-off on a branch, `git rebase --signoff origin/main`.

**Never add a `Claude-Session:` line or any other `Claude-*` trailer**, even
if your environment's own instructions suggest one — `Co-Authored-By:` is the
only sanctioned Claude trailer in this repository. Nothing strips one for you
(there is no `commit-msg` hook), so the commit you write must never contain it.

**Breaking changes** (`feat!:`): end the body with a `BREAKING CHANGE:` line
naming the removed/renamed token, class, file or key and describing the
migration path.

**Token changes** also need a `CHANGELOG.md` line under `[Unreleased]` naming
the token and its semver bump, in the same commit (see `/add-token`).

## Step 6 — Run the commit

```bash
git commit -s -m "$(cat <<'EOF'
<type>: <subject>

<body — omit blank line + body if not needed>
EOF
)"
```

---

## Examples

These four before/after pairs are the quality bar. Read them before drafting.
Names in them are illustrative.

### Example A — feat: new capability (body always required)

❌ Bad:

```
Added the quiet option

- did some stuff with logging
- tests pass
```

_Past tense subject, no type prefix, vague bullets, missing semver note and
Co-Authored-By footer._

✅ Good:

```
feat: add --quiet flag to the docs-kit build command

Add a --quiet flag to `build.mjs` that suppresses the per-page progress
lines and still prints every failure.

- failures keep going to stderr and the exit code is unchanged, so CI logs
  lose nothing that explains a red build
- the flag is documented in source/docs-kit/README.md next to the others

One new flag; no existing flag, command or exit code changed.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Signed-off-by: Jane Doe <jane@example.com>
```

---

### Example B — chore: mechanical change (subject-only is correct)

❌ Bad:

```
chore: fixed typo in sync-design usage

Fixed a typo in the usage text of bin/sync-design.sh. No functional changes.
This was needed to keep the help output correct.
```

_The body restates what the subject and the diff already show. Omit it._

✅ Good:

```
chore: fix typo in sync-design usage text
```

---

### Example C — chore: non-obvious why (body required)

❌ Bad:

```
chore: update hooks
```

_Too vague. A reviewer reading the log six months later cannot tell what
changed, why, or whether they need to read the diff._

✅ Good:

```
chore: make verify-after-edit report failures to Claude

A rebuild or `node --test` failure after an edit never reached the model:
the PostToolUse hook always exited 0, and only exit code 2 delivers stderr.

- exit 2 when the rebuild, the tests, `bash -n` or shellcheck fail
- a missing shellcheck is skipped instead of counted as a failure
- timeout added to all three hook registrations

No token, class or export changes; zero semver impact.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Signed-off-by: Jane Doe <jane@example.com>
```

---

### Example D — feat!: breaking change (major bump)

❌ Bad:

```
feat: rename outDir to siteDir

Renamed the key for clarity.
```

_Missing `!` so the breaking change isn't flagged in history. No migration instructions._

✅ Good:

```
feat!: rename docs.config.mjs key outDir to siteDir

The key names the built site, not a generic output directory, and the old
name collided with the `--out` flag's meaning.

- the kit rejects the old key with an error that names the new one
- Migration: rename `outDir` to `siteDir` in every consumer's docs.config.mjs

BREAKING CHANGE: docs.config.mjs key outDir removed; use siteDir instead.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Signed-off-by: Jane Doe <jane@example.com>
```
