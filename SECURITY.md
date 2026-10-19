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

This is a single-maintainer project. Releases are immutable: a published tag is
never reused, and a fix ships as the next release. There is no backport policy.

## Reporting a vulnerability

Use GitHub's [private vulnerability reporting](https://github.com/monte3l/m3l-design/security/advisories/new)
for this repository.

> [!IMPORTANT]
> Do not open a public issue for a suspected vulnerability.

Include the affected version, the steps to reproduce and the impact you think
it has. If you think `sync-design.sh` can write outside its target, or accept a
payload whose hashes do not match `SHA256SUMS`, name the exact path or step.

You should get an acknowledgment within 7 days. There is no fixed disclosure
timeline beyond that, but you will hear back before a fix ships.

## Secrets this repository holds

| Secret | Scope | Reaches | Expiry |
| --- | --- | --- | --- |
| `GITLEAKS_LICENSE` | Organization secret shared with this repository | A free license for the Gitleaks action. It reads nothing in the repository | Annual renewal |

No workflow publishes to a registry or holds a deploy credential.

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

The OpenSSF Best Practices badge is a real gap, not an accepted one. The
project registers for it, and the alert stays open until the badge reaches
Passing.
