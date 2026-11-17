# Security assurance case

This is the argument that `m3l-design` is secure enough for what it does, and the evidence for each step. It is the project's answer to the OpenSSF criteria `assurance_case`, `implement_secure_design`, `know_secure_design` and `know_common_errors`, and to Baseline `OSPS-SA-03`. It is kept short on purpose: the project is a set of tokens, CSS and docs, a zero-dependency resolver, a docs kit and two shell scripts, so the claims are few.

**The top-level claim:** a consumer who runs `bin/sync-design.sh` on a release tag gets exactly the files that release's attested assets contain, and nothing is written to their repository unless that check passes.

## Threat model

The asset is the integrity of what lands in other repositories: `design/source/`, `design/tokens.css` and `design/SHA256SUMS`. The design system carries no user data and no secrets, so confidentiality is not at stake. Availability matters little: a consumer holds its own copy and can keep working if this repository disappears.

| Threat | How it would work | Control | Where to check |
| --- | --- | --- | --- |
| A published release is altered | Someone replaces an asset or moves the tag | Releases are immutable, and each asset carries an attestation. `sync-design.sh` runs `gh release verify` and `verify-asset` before it extracts anything | `bin/sync-design.sh`, `README.md#versioning-policy`. Only the release path runs these checks: a `--from` rehearsal checks `SHA256SUMS` alone |
| The payload does not match its checksums | A corrupted download, or a tarball built from other files | After verification, `sha256sum -c SHA256SUMS` runs on the extracted payload and a mismatch exits 1 before any write | `bin/sync-design.sh` |
| A hostile tag argument | A tag such as `v1/../x` reaches a URL or a path | The tag must match `^v[0-9]+\.[0-9]+\.[0-9]+$` before any other use, and the asset name is built from it afterwards | `bin/sync-design.sh`, `bin/package-release.sh`, `test/scripts.test.mjs` |
| The sync writes outside its target | A crafted consumer layout or payload path | It writes only under `design/` in the consumer's resolved directory (`source/`, `tokens.css`, `SHA256SUMS` and the version lines of the marker), and extracts into a temporary directory removed on exit. A test runs it against a scratch consumer and checks nothing else appears | `bin/sync-design.sh`, `test/scripts.test.mjs` |
| A generated file is edited by hand | `tokens.css` or `SHA256SUMS` no longer matches the tokens | CI runs `build-design-tokens.mjs --check` and `sha256sum -c`, and the docs kit's `--check` fails on a hand-edited payload file. A hook stops an agent from editing them | `verify.yml`, `.claude/hooks/block-generated.sh` |
| A release of an unchanged payload, or a payload change that is not released | A `chore:` commit changes `source/`, or a `feat:` changes nothing in it | The `Payload commit types` lane fails both | `bin/check-payload-commits.mjs`, `test/check-payload-commits.test.mjs` |
| A malicious change merges | A compromised or careless account | Two-person review with no bypass, signed commits, two-factor authentication for the organization, required checks | `main` ruleset, `GOVERNANCE.md` |
| CI is turned against the repository | Template injection, a pinned action replaced, a leaked token | Every workflow starts from `permissions: {}`, read-only or `read-all` and widens per job. Every checkout sets `persist-credentials: false`, every action is pinned to a commit SHA, no workflow uses `pull_request_target` or `workflow_run`, and zizmor and actionlint run on every workflow change | `.github/workflows/`, `workflow-lint.yml` |
| A secret leaks | A token committed or logged | Secret scanning with push protection, and Gitleaks on every push and pull request. The inventory is in `SECURITY.md` | `SECURITY.md#secrets-and-credentials` |
| A dependency of the deploy tool is compromised | A malicious version of `wrangler` | An exact version and integrity hashes in a committed lockfile, installed with `npm ci --ignore-scripts`, and a one-day Dependabot cooldown. It runs only in the deploy job | `tools/deploy/`, `docs.yml`, `.github/dependabot.yml` |
| Script injected into the docs site | A component preview with an inline script or event handler | The build fails on one, because the site's content security policy allows neither | `scripts/site/gallery.mjs`, `source/docs-kit/` |

## Trust boundaries

The boundaries are drawn in [`architecture.md`](architecture.md#trust-boundaries). The ones that matter most: GitHub is **trusted infrastructure**, because the verification relies on its attestations. A contributor without access is **untrusted**, and can only open an issue. A consumer's repository is **not trusted** by the script, which writes only under `design/` and executes no file from it.

## Secure design principles applied (Saltzer and Schroeder)

| Principle | How it shows up here |
| --- | --- |
| Economy of mechanism | The resolver and the docs kit have no dependency, and `sync-design.sh` is one 174-line script. There is no server, no database and no runtime code in a component |
| Fail-safe defaults | The sync verifies first and writes last, so a failure leaves the consumer untouched. `verify` needs an explicit `success` from every lane, so a skipped or cancelled lane fails closed |
| Complete mediation | The `main` ruleset applies to every change, the maintainers included. The bypass list is empty |
| Open design | The repository, the scripts, the policies and this document are public. Nothing depends on obscurity |
| Separation of privilege | A change needs an author, a different approver, signed commits and passing checks. A release needs a person to merge the release pull request that the App opens, and publishing happens only after the assets are attested |
| Least privilege | Workflows start from `permissions: {}` or read-only. The deploy runs in an environment restricted to `main`, and the App tokens are minted for one repository |
| Least common mechanism | The only npm tool lives in its own directory with its own lockfile, so it shares nothing with the scripts or the resolver |
| Psychological acceptability | One command per task, `--dry-run` on the sync, and the same checks run locally and in CI |

## Common implementation weaknesses countered

| Weakness | Where it could occur | Mitigation |
| --- | --- | --- |
| CWE-20, improper input validation | The tag and the consumer marker in `sync-design.sh`, the token files the resolver reads | The tag pattern above, an exit 2 on a missing or malformed marker, and `assertResolverShape`, which fails at load time if the token manifest stops matching what the resolver expects |
| CWE-22, path traversal | The paths the sync writes | They are fixed subpaths of the consumer's resolved directory, and the tag that names the asset cannot contain a separator |
| CWE-78, OS command injection | The shell scripts | Variables are quoted, nothing is built into an `eval` or a command string, and `shellcheck` runs in CI. Workflow values reach `run:` only through `env:` |
| CWE-94, code injection in CI | Template expansion in workflows | zizmor reports no unsuppressed finding on the repository's workflows. No workflow interpolates event data into a script |
| CWE-200, exposure of sensitive information | Logs and error messages | No secret is written to a log, and the scripts print paths and versions only |
| CWE-494, download of code without integrity check | Fetching a release, installing the deploy tool | Attestation, `gh release verify` and `SHA256SUMS` for the release, and a lockfile with integrity hashes for the tool |
| CWE-829, inclusion of functionality from an untrusted source | Third-party actions | Every action is pinned to a commit SHA, and Dependabot proposes bumps after a cooldown |

## Residual risks

- **Two accounts** are enough to merge any change. The organization requires two-factor authentication and the ruleset requires signed commits, but a compromise of both owners defeats the review control.
- **`SHA256SUMS` lists files, and the sync does not check for files it omits.** A tarball with an extra file would pass `sha256sum -c`. The control is upstream: the tarball is built from a commit by `package-release.sh`, attested, and verified by `gh release verify-asset` before extraction.
- **The consumer directory is taken on trust.** The script resolves it and writes only under `design/`, but it will replace `design/source/` in whatever directory it is given. It also runs `git status` there, and `git` reads that repository's own configuration, so a hostile consumer configuration could run a program (for example through a configured filesystem monitor). Run the sync only in a repository you control.
- **Organization secrets reach every workflow in this repository**, not only the job that names them. A malicious change to a workflow could read them. Required review of every workflow change is the control, and `SECURITY.md` records it.
- **GitHub and Cloudflare** are trusted. An outage or compromise of either is outside what this project can prevent.
