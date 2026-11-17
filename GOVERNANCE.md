# Governance

**In short:** two people hold every right over this repository, and one of them writes nearly everything. No change reaches `main` without the other's approval, and no one can bypass that. This document says who decides what, who may get access, what happens if someone becomes unavailable, and which Gold-level badge criteria the project does not meet.

The model is a **small-team, owner-run** one: no board and no vote. It exists to satisfy the [OpenSSF Best Practices](https://www.bestpractices.dev/projects/15706) Silver criteria `governance`, `roles_responsibilities` and `access_continuity`, and Baseline `OSPS-GV-01` and `OSPS-GV-04`. It also records, in plain terms, the Gold criteria this project cannot meet.

## Decision-making

- **Day-to-day changes** (a docs fix, a CI change, a token tweak) are proposed as a pull request by one owner and approved by the other. The `main` ruleset requires one approval from a code owner who is not the author, approval of the last push, resolved review threads, signed commits and the required checks. Its bypass list is empty, so nobody can skip any of it.
- **Larger changes** (a new component, a removed or renamed token, a change to the docs kit's contract or to what `bin/sync-design.sh` verifies) are discussed in an issue first, so the reasoning is public and searchable. Removing or renaming anything in the public API is a major release: see [Versioning policy](README.md#versioning-policy).
- **Releases** follow [Releasing](README.md#releasing). The release pull request is opened by the release App, and a code owner other than its author merges it. A published release is immutable, so a mistake is fixed by the next version.
- **Disputes.** The two owners decide together. If they disagree, the change does not merge: the ruleset needs both. A contributor who disagrees with a decision can reopen it in the issue.
- **Security decisions** (triaging a report, accepting or dismissing a Scorecard finding) follow [`SECURITY.md`](SECURITY.md).

If one owner is unavailable, the other cannot merge their own pull request. The only way around that is to switch the ruleset to `disabled` and back, which GitHub logs, and which is reserved for the emergency in [Access continuity](#access-continuity).

## Roles

| Role | Held by | Responsibilities |
| --- | --- | --- |
| **Owner and maintainer** | [Enrico Lionello](https://github.com/enri3l) (`enri3l`) | Writes most changes, triages issues, makes design decisions, holds admin on the repository and ownership of the `monte3l` organization |
| **Owner and reviewer** | [Giulia Montevecchi](https://github.com/giulmonte) (`giulmonte`) | Approves and merges pull requests, holds the same admin and ownership rights, and is the code owner who approves the maintainer's changes |
| **Security contact** | Both owners | Receive reports through [private vulnerability reporting](SECURITY.md#reporting-a-vulnerability) and follow the [response process](SECURITY.md#response-process) |
| **Contributor** | Anyone opening an issue | Follows [`CONTRIBUTING.md`](CONTRIBUTING.md). Pull requests are limited to collaborators, so an issue is the contribution |

`.github/CODEOWNERS` lists both owners for every path. The release App (`monte3l-release`) opens the release pull request and holds no standing right to merge it.

## Granting access

This covers **write or admin access to this repository, membership of the `monte3l` organization, and any credential** from the inventory in [`SECURITY.md`](SECURITY.md#secrets-and-credentials). Write access counts as access to secrets, because a workflow run from a branch can reach them.

- **Who decides.** Only an organization owner grants access, and the other owner agrees first. No automation grants or widens it.
- **Review before the grant.** Both checks happen, and neither is skipped:
  - **Track record.** A history of accepted contributions through issues, or in another project the owners can look at.
  - **Identity.** The account has two-factor authentication on, and an owner has confirmed who the person is through a channel outside GitHub, such as an employer or another project's maintainer list. The issue that proposes the access records which check was used.
- **Least privilege.** Access starts at `triage`, moves to `write` after accepted contributions, and to `admin` or ownership only for a co-maintainer, which repeats both checks for the wider scope.
- **Secrets.** No credential is shared with a collaborator in a message or a file.
- **Revocation.** Either owner can remove access at any time and tells the other afterwards. Access is reviewed at least once a year, and a collaborator inactive for 12 months is reduced to `triage` or removed.

Today the only people with access are the two owners above. The record for each future grant is the issue that proposed it.

## Related repositories

This project is one repository. Other repositories depend on it, and it depends on none of them at run time.

| Repository | What it is | Relationship |
| --- | --- | --- |
| [`monte3l/.github`](https://github.com/monte3l/.github) | Organization defaults, the repository baseline script and `design-resync.yml` | Pins the release every repository should record, and opens a re-sync pull request in each consumer when this project publishes a release |
| [`monte3l/m3l-groundwork`](https://github.com/monte3l/m3l-groundwork) | The project bootstrapper | Imports the resolver in `source/lib/design-tokens.mjs`, so its exports are public API |
| Every other `monte3l` repository with a visual surface | Consumers | Hold a verbatim copy of a release under `design/`. They take no live dependency |

A vulnerability in a consumer's own code belongs in that consumer's repository.

## Access continuity

If one owner becomes unavailable, the other must still be able to triage, merge and respond to a report within about a week. Two things make that true today:

- **Both owners hold GitHub administration independently.** Either can manage the `main` ruleset, the organization's secrets and the GitHub App installations without the other.
- **The `main` ruleset requires signed commits, not a particular key.** Signing is configured per machine, so a lost key blocks commits only until its owner configures a new one.

Beyond that, each owner keeps an **emergency access kit** for their own accounts: recovery codes, and a backup and revocation certificate for their signing key, held in a password manager's emergency-access feature or an equivalent sealed offline copy. The kit and its executor are not described here, because naming a person or storing a secret in a public repository would defeat the purpose. Recovery uses GitHub's ordinary account-recovery flows and `gh api` calls against the ruleset, both already documented.

This satisfies `access_continuity`, which allows a small project to rely on keys held offline rather than a larger team.

## Bus factor

Today's bus factor is **1**, stated plainly. Both owners have full access and one of them approves nearly every change, but one person has written all of them. As of 2026-11-17, `enri3l` authored all 33 merged pull requests written by a person. The rest were opened by Dependabot (8) and the release App (4). `giulmonte` approved 30 of the 33. The other three are the first pull requests, which landed before the `main` ruleset existed (see the Code-Review row in [`SECURITY.md`](SECURITY.md#accepted-openssf-scorecard-findings)). Growing past 1 means the second owner also authoring changes and cutting a release alone. It is on the [roadmap](ROADMAP.md).

## Gold-level criteria this project does not meet

Two Gold criteria cannot honestly be met today. Each is recorded **Unmet** in `.bestpractices.json`.

- **`bus_factor`** needs two or more people who can run the project. See above.
- **`contributors_unassociated`** needs at least two significant contributors who are not affiliated with the same organization. Both people with access belong to `monte3l`, so more contribution from either leaves it Unmet. It needs a significant contributor from outside the organization.

`two_person_review` is **Met**: the ruleset requires an approval from someone other than the author, and 30 of the 33 pull requests written by a person had one.

`version_tags_signed` is **Unmet** and only suggested: release tags are lightweight tags made by release-please. Releases are immutable, so a tag cannot be moved, and every release asset carries a Sigstore-backed attestation, which `gh release verify` and `bin/sync-design.sh` check.

Closing the first two means onboarding a second active maintainer and an outside contributor, not a code or process change. See [`ROADMAP.md`](ROADMAP.md).
