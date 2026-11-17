# Architecture

This page shows the actors and actions in the system, how a design token becomes a file in another repository, and every external interface the project has. The repository layout is in the [README](../README.md#what-is-in-here), and the maintainer reference is [`CLAUDE.md`](../CLAUDE.md#how-the-pieces-fit). The threat analysis is in the [assurance case](assurance-case.md).

## Actors and actions

| Actor | What it does here |
| --- | --- |
| **Consumer maintainer** | Runs `bin/sync-design.sh` in a clone of this repository to copy a release into their own repository, or builds a docs site with the docs kit |
| **Maintainer** | Changes the canonical tokens in `source/dtcg/`, regenerates `tokens.css` and `SHA256SUMS`, and merges the release pull request |
| **Contributor** | Opens issues. Pull requests are limited to collaborators |
| **`bin/build-design-tokens.mjs`** | Resolves the DTCG tokens with the resolver and writes `tokens.css` and `SHA256SUMS`. With `--check` it writes nothing and fails if either is stale |
| **`source/lib/design-tokens.mjs`** | The one resolver: merges the token sets and modifiers and derives the type styles. It has no dependency and does no I/O beyond reading the token files it is given |
| **`bin/package-release.sh`** | Builds the three release assets from a commit, not from the working tree |
| **`bin/sync-design.sh`** | Downloads a release, verifies it, and replaces `design/source/`, `design/tokens.css` and `design/SHA256SUMS` in a consumer |
| **Docs kit** (`source/docs-kit/`) | Builds and gates a docs site from a repository's markdown and config. It is also what builds this project's own site |
| **CI (GitHub Actions)** | Runs the checks, the scanners and the weekly Scorecard. Jobs start from read-only tokens. The ones that hold more, and the secrets they use, are listed in [`SECURITY.md`](../SECURITY.md#secrets-and-credentials) |
| **Release workflow** | Opens a release pull request, and on merge tags the commit, builds the assets, attests them, publishes an immutable release and tells `monte3l/.github` |
| **GitHub and Cloudflare** | GitHub hosts the code and the releases. Cloudflare Workers Static Assets serves the docs site at `design.monte3l.com` |

## Data flow

```text
source/dtcg/*.json
      |  resolver (design-tokens.mjs, no dependencies)
      v
tokens.css + SHA256SUMS            committed, never edited by hand
      |  release PR merged
      v
package-release.sh  ->  m3l-design-vX.Y.Z.tar.gz, SHA256SUMS, tokens.css
      |  attested, then published as an immutable release
      v
sync-design.sh  ->  gh release verify, verify-asset, sha256sum -c
      |  only if all three pass (with --from, only the checksum)
      v
consumer/design/{source/, tokens.css, SHA256SUMS}
```

Nothing is sent anywhere except to GitHub. From a consumer the script reads its `design/README.md` marker, its `REUSE.toml` (only to print a warning), and the existing `design/` files to show a dry-run diff and `git status`.

## External interfaces

**Interface 1: `bin/sync-design.sh [--dry-run] [--from <git-ref>] <tag> [consumer-dir]`.** This is the public contract for adopting a release.

| Part | Contract |
| --- | --- |
| `<tag>` | Must match `^v[0-9]+\.[0-9]+\.[0-9]+$`. Anything else exits 2 before any network call |
| `consumer-dir` | A directory that already has `design/README.md` with a `Version copied` or `Version adopted` line. The script never creates the marker |
| `--dry-run` | Shows what would change and writes nothing |
| `--from <git-ref>` | Takes the payload from this clone instead of a release, to rehearse a sync before the tag exists |
| Verification | For a release: `gh release verify`, `gh release verify-asset`, then `SHA256SUMS`, all before anything is written. A mismatch exits 1. With `--from` the payload comes from this clone, so only `SHA256SUMS` is checked and the output says it is a rehearsal, not a release |
| Exit codes | 0 done, 1 verification failed, 2 usage or missing marker |
| Writes | Only under `design/`: it replaces `design/source/` (removing the old one first), `design/tokens.css` and `design/SHA256SUMS`, and rewrites the version lines of `design/README.md`, including a `Last re-synced` date. It leaves `design/local/` alone |

**Interface 2: the release.** Three assets named for the tag: `m3l-design-<tag>.tar.gz`, `SHA256SUMS` and `tokens.css`. The tarball holds exactly what a consumer receives. Releases are immutable and each asset carries an attestation.

**Interface 3: the public API.** The token names and their meaning, the CSS class names in `tokens.css` and the component bundle, the file paths under `source/`, the exports of `source/lib/design-tokens.mjs`, and the docs kit's config keys, commands, flags and exit codes. [Versioning policy](../README.md#versioning-policy) says which change is major, minor or patch.

**Interface 4: `bin/build-design-tokens.mjs [--check]`.** Exit code 0 when `tokens.css` and `SHA256SUMS` are current, 1 when either is stale. CI runs it with `--check`.

**Interface 5: the docs kit.** `source/docs-kit/build.mjs` (`--check` gates a site, `--out <dir>` writes it) and `check-live.mjs` (compares a live site with a build, byte for byte, headers included). Its contract is [`source/docs-kit/README.md`](../source/docs-kit/README.md).

**Interface 6: the docs site.** Static HTML served from Cloudflare Workers Static Assets under a content security policy that allows one hashed inline script, no external script and no framing of the site. The daily `docs-live.yml` fails if what is served differs from what is built.

## Trust boundaries

| Party | Trust | Why |
| --- | --- | --- |
| Maintainers (two owners) | Trusted, and reviewed | Every change needs an approval from the other owner and passes the required checks. The bypass list is empty |
| Contributors without access | Untrusted | They can open an issue and nothing else |
| GitHub (repository, releases, Actions) | Trusted infrastructure | The project cannot defend against its compromise. Releases are immutable and attested to narrow what it could change after the fact |
| Cloudflare | Trusted infrastructure, for the docs site only | A compromise could change the site, not a release. `check-live.mjs` would notice a difference from the build |
| Third-party actions and tools | Trusted only when pinned | Every action is pinned to a commit SHA, and the one npm tool installs from a lockfile with integrity hashes |
| A consumer's repository | Not trusted by the script | The script writes only the paths above and executes no file from the consumer. It does run `git status` there to print what changed, and `git` reads the consumer's own git configuration |
