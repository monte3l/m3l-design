# Security Policy

## Scope

This covers `m3l-design`: the release payload (`source/`, `tokens.css` and
`SHA256SUMS`), the zero-dependency resolver in `source/lib/design-tokens.mjs`,
and the scripts in `bin/`. `bin/sync-design.sh` copies a release into another
repository, so a defect in it, or in the checksum list it verifies against,
reaches every consumer. A vulnerability in a consumer's own code is reported
to that consumer.

## Supported versions

| Version | Supported |
| --- | --- |
| Latest `vX.Y.Z` release | Yes |
| Anything else | No |

This is a two-owner project with one active author. Releases are immutable: a
published tag is never reused, and a fix ships as the next release. There is no
backport policy.

### Scope and duration of support

Support covers the latest release, the scripts in `bin/` and the CI that checks
them. A release is supported until the next one is published. From then on it
receives no fixes, security fixes included, and the remedy is to re-sync to the
latest release with `bin/sync-design.sh`. There is no fixed calendar duration
and no long-term-support line.

## Reporting a vulnerability

Use GitHub's [private vulnerability reporting](https://github.com/monte3l/m3l-design/security/advisories/new)
for this repository.

> [!IMPORTANT]
> Do not open a public issue for a suspected vulnerability.

Include the affected version, the steps to reproduce and the impact you think
it has. If you think `sync-design.sh` can write outside its target, or accept a
payload whose hashes do not match `SHA256SUMS`, name the exact path or step.

You should get an acknowledgment within 7 days, and you will hear back before a
fix ships.

## Response process

1. **Acknowledge** the report within 7 days.
2. **Triage.** Reproduce it, and decide its severity and scope: this repository, or a consumer's own code.
3. **Fix privately** in a security advisory's temporary private fork. A confirmed vulnerability of medium or higher severity is fixed within 60 days of confirmation, and a critical one as fast as a review allows.
4. **Request a CVE** through the advisory when the issue warrants one.
5. **Release.** The fix ships as the next release, which is a patch version unless it removes or renames something public. Consumers then receive a re-sync pull request from `monte3l/.github`.
6. **Publish** the advisory once the release is out, crediting the reporter unless they ask not to be. The default disclosure date is the day the release is published, and a reporter who wants a different date should say so in the report.

## Credit

A reporter of a vulnerability that is fixed and disclosed is credited in the
GitHub security advisory and the CHANGELOG line, unless they ask to stay
anonymous. There is no bug bounty. No vulnerability has been reported and
resolved yet.

## What you can and cannot expect

**What this project guarantees.** `bin/sync-design.sh` verifies a release with
`gh release verify`, `gh release verify-asset` and `SHA256SUMS` before it
writes anything, and writes only under `design/` in your repository. The
resolver and the docs kit have no dependency. Every release is immutable and
attested. See [`docs/assurance-case.md`](docs/assurance-case.md) for the
threat model.

**What it does not guarantee.** It does not review your repository, and it does
not guarantee that a consumer's own code is free of vulnerabilities. It states
that every text and UI pairing meets WCAG 2.2 AA, which is an accessibility
claim and not a security one. A copy that you edit by hand is no longer the
release, and `SHA256SUMS` will say so.

## Dependency and code-scanning findings

This is the policy for two kinds of automated finding: software composition
analysis (SCA), meaning known vulnerabilities and licenses in dependencies, and
static analysis (SAST), meaning CodeQL. It describes what is enforced today.

### What runs

| Check | When | On a finding |
| --- | --- | --- |
| Dependency Review (`dependency-review.yml`), required on `main` | Every pull request | Fails the PR if it adds or updates a dependency with a high or critical known vulnerability, or a license outside the allow-list in that file |
| CodeQL default setup, `javascript-typescript` and `actions`. Its `CodeQL` check is required on `main` | Every push and pull request | Fails the PR on a new alert of error severity or critical or high security severity, which is GitHub's default threshold |
| Gitleaks and GitHub secret scanning with push protection | Every push and pull request, and weekly in full | Fails the PR, or blocks the push |
| ScanCode (`scancode.yml`) with `policies.yml` | Every push and pull request | Fails the check on a license in a file that the policy does not list. Not a required check, because the action is still beta |
| Dependabot alerts, security updates and version updates (`dependabot.yml`) | Weekly, for GitHub Actions and the `tools/deploy` npm directory | Opens an update PR. An alert on a locked dependency published after a merge is how a late advisory is caught |
| zizmor and actionlint (`workflow-lint.yml`) | Every change to a workflow | Fails the check. It runs only when a workflow changes, so it cannot be a required check |

### Remediation thresholds

| Finding | Threshold |
| --- | --- |
| A critical or high SCA vulnerability | A PR that introduces one does not merge. One published against a dependency already locked is fixed (update, replace or remove) within 60 days of Dependabot raising it |
| A medium SCA vulnerability | Fixed within 60 days, through a dependency update |
| A low SCA vulnerability | Fixed in the normal course of dependency updates, with no deadline |
| A license outside the allow-list | A PR that adds one does not merge. Either the dependency is removed, or the license is added to the allow-list in the same PR with the reason in its description |
| A SAST (CodeQL) alert | A new alert of error severity or critical or high security severity blocks the PR. One in merged code at medium or higher is fixed within 60 days of triage. A dismissed alert records its reason in GitHub |

Dependency Review, CodeQL and Gitleaks are required checks in the `main`
ruleset, so a pull request that fails one cannot merge. A release is cut from
`main`, so nothing that failed them reaches a release. ScanCode and the workflow
linters are not required, and a reviewer treats a failure in either as blocking.

### Process

1. **Identify.** The checks above, plus Dependabot and GitHub security advisories.
2. **Prioritize.** Severity first, then whether the code ships. The release payload has no dependency, so a finding in the one npm tool directory (`tools/deploy`, which runs only in the deploy job) affects CI, not a consumer.
3. **Remediate.** Update, replace or remove the dependency by moving its pinned version.
4. **Accept, only when nothing else works.** A finding that does not affect the project and has no patched version is dismissed in GitHub with its reason, and a vulnerability judged not exploitable is recorded under the next heading.

### Vulnerabilities that do not affect the project

An [OpenVEX](https://openvex.dev) document would state which published
advisories do not affect the release payload and why. None is needed today: as
of 2026-11-17 GitHub reports no open Dependabot alert and no open code-scanning
alert, and no advisory has been judged not exploitable. When one is, the
statement is added at `docs/m3l-design.openvex.json` in the same PR that
dismisses the alert, with the reasoning in its description. The payload
declares no dependency and bundles none.

## Secrets and credentials

This is the policy for the secrets this repository uses: how they are stored, who can reach them and when they are replaced. The first rule is to hold as few as possible.

### What the project does not store

- **No signing key for artifacts.** Releases are attested through GitHub's Sigstore integration, with no key to hold.
- **No personal access token.** Where a job needs more than `GITHUB_TOKEN`, it mints a short-lived GitHub App installation token instead.
- **No registry credential.** Nothing is published to npm or any other registry.

### Inventory

As of 2026-11-17, read from the workflows and from the GitHub API, which lists secret names and never values:

| Secret | What it is | Stored at | Used by | Scope and expiry |
| --- | --- | --- | --- | --- |
| `RELEASE_APP_CLIENT_ID`, `RELEASE_APP_PRIVATE_KEY` | Client ID and private key of the `monte3l-release` GitHub App | Organization secrets, visible to selected repositories | `release.yml`: the prepare job opens the release pull request, and the finalize job tells `monte3l/.github` | The token the prepare job mints is limited to this repository with `contents: write` and `pull-requests: write`, and lasts an hour. The private key does not expire |
| `JANITOR_APP_CLIENT_ID`, `JANITOR_APP_PRIVATE_KEY` | Client ID and private key of the `monte3l-env-janitor` GitHub App | Organization secrets, visible to selected repositories | `environments.yml`, the weekly cleanup | The token it mints is limited to this repository, and never reaches repository secrets. The private key does not expire |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | A Cloudflare API token and the account id | Organization secrets, visible to selected repositories | `docs.yml`, the deploy job, which runs in the `docs-cloudflare` environment restricted to `main` | The token is limited to Workers Scripts and Routes on the `monte3l.com` zone, and is issued with a TTL of one year at most |
| `GITLEAKS_LICENSE` | The license key the Gitleaks action needs for an organization-owned repository | Organization secret, visible to selected repositories | `gitleaks.yml` | It licenses a scanner and authenticates to nothing else. Annual renewal |
| `GITHUB_TOKEN` | GitHub's automatic per-run token | Created for each run | Every workflow | Each job sets its own `permissions:` block, and the repository default is read-only. In `release.yml` the `package` job holds `contents: write` to attach assets to the draft, and the finalize job `id-token: write` and `attestations: write` to attest them |

### Storing

- A secret lives only in GitHub Actions secrets, at the narrowest scope that works. It never goes in a file, a repository variable or a log.
- Secret scanning and push protection are on, and Gitleaks scans every push and pull request (`.gitleaks.toml`).

> [!NOTE]
> All seven secrets are **organization** secrets shared with selected repositories, not secrets of an environment. GitHub makes an organization secret available to every workflow in a repository it is shared with, so `docs-cloudflare` and `env-janitor` restrict where a deploy runs, not who can read the secret. The controls are the required review of every workflow change and the rule that each secret is named only in the workflow that needs it. Moving the Cloudflare and janitor secrets into their environments would close this and is on the [roadmap](ROADMAP.md).

### Accessing

- Only the two organization owners, `enri3l` and `giulmonte`, can create, replace or delete a secret. GitHub never shows a stored value back. The organization requires two-factor authentication, by authenticator app or hardware key (see [`CONTRIBUTING.md`](CONTRIBUTING.md#account-security)).
- No fork pull request receives a secret, and no workflow uses `pull_request_target` or `workflow_run`.

### Rotating

1. **At once** when a secret is exposed or suspected to be, or when someone with access to it leaves or loses a device that held a key.
2. **A credential that can expire is issued with an expiry of at most one year.** That is the Cloudflare token.
3. **A credential that cannot expire is replaced at least once a year.** That is the two GitHub App private keys: generate a new key in the App's settings, update the organization secret, delete the old key, then run the workflow that uses it to prove the new one works.
4. **`GITLEAKS_LICENSE`** is replaced when the license renews, or on exposure.
5. A rotation is recorded in the PR or issue that makes it, never with the value.

To compare this inventory with what is set, list names and dates with `gh api orgs/monte3l/actions/secrets` and `gh api repos/monte3l/m3l-design/actions/organization-secrets`.

## Accepted OpenSSF Scorecard findings

Background, not policy: this explains the Scorecard results for anyone who
looks them up. `scorecard.yml` runs weekly and surfaces its findings as Code
Scanning alerts. The ones below are dismissed as deliberate or time-based, not
defects. Do not "fix" the first one into a standing bypass.

| Check | Score | Why it stays |
| --- | --- | --- |
| Branch-Protection | 8 | The top tier asks for two approvals. The organization has two members, so a PR has one reviewer who is not its author, and requiring two would block every merge unless a standing bypass existed. The `main` ruleset has an empty bypass list on purpose. Every other protection is on: a code-owner approval, approval of the last push, stale-review dismissal, an up-to-date branch, required checks, signed commits, and no force-push or deletion |
| Code-Review | 1 | The first commits landed before the `main` ruleset existed. Every PR since needs a code-owner approval, so the approved share rises as PRs merge. The alert is dismissed only until the score reaches 10 |
| Maintained | 0 | Scorecard scores any repository under 90 days old as 0. This one was created on 2026-10-11, so it resolves itself on 2027-01-09 |
| Fuzzing | 0 | Not applicable. The inputs are CSS, design tokens in JSON and a copy script. The resolver reads this repository's own token files, and `sync-design.sh` verifies a fixed hash list, so no untrusted input reaches a parser. A fuzzing library would also end the repository's no-dependency rule |

Signed-Releases also scores 0, and it is a gap, not an accepted finding.
Scorecard reads release assets only, and a release here carries GitHub's
attestation rather than a signature file. Scorecard raises no Code Scanning
alert for it, so nothing is dismissed. Attaching the attestation bundle to each
release as an asset is on the [roadmap](ROADMAP.md).

The OpenSSF Best Practices badge is registered, at
[project 15706](https://www.bestpractices.dev/projects/15706). The Silver and
Baseline answers are kept in `.bestpractices.json`.
