# Roadmap

What this project intends to do, and not do, over roughly the next year. It is a file, not an issue board, so it survives outside any one tool. It lists what is still ahead. What has shipped is in the git history and [`CHANGELOG.md`](CHANGELOG.md).

## Now

- Keep every consumer on the current release. When this project publishes one, `design-resync.yml` in `monte3l/.github` opens a re-sync pull request in each repository that vendors the system, and a person reads the notes and the checks before merging it.
- Hold the quality gates: the generated files are current, the payload matches `SHA256SUMS`, the docs site builds with every link resolving and the docs matching the payload, the tests pass with at least 80% coverage of the JavaScript, and every required check on `main` is green.

## Next 12 months

- **Reach the OpenSSF Silver badge and Baseline level 3.** The criteria and their answers are in [`.bestpractices.json`](.bestpractices.json). What is left is entering them on bestpractices.dev and keeping them true as the repository changes.
- **Attach the attestation bundle to each release as an asset.** The shared `release-finalize.yml` in `monte3l/.github` attests every asset, but OpenSSF Scorecard's Signed-Releases check only reads release assets, so it scores 0 here today. Once the shared workflow attaches the bundle, this repository adopts it by bumping its pin.
- **Grow the bus factor past 1.** The second owner approves every change today. What is missing is a second person who also authors changes and can cut a release alone. No committed date. See [`GOVERNANCE.md`](GOVERNANCE.md#gold-level-criteria-this-project-does-not-meet).
- **Close the Scorecard gaps that time closes.** `Maintained` clears once the repository is 90 days old, on 2027-01-09, and `Code-Review` rises as reviewed changes outnumber the first commits.
- **Move the Cloudflare and janitor secrets into their environments.** Today all seven secrets are organization secrets, so any workflow in the repository can read them. As environment secrets of `docs-cloudflare` and `env-janitor`, only a job running on `main` in that environment could. See [`SECURITY.md`](SECURITY.md#storing).

## What this project will not do

- **Take a live dependency on itself.** A consumer copies a pinned release, on purpose. There is no package to install and no URL to link at run time.
- **Ship runtime code in a component.** The components are plain HTML and CSS. Motion drops to zero through the tokens, not through script.
- **Add a dependency to the resolver or the docs kit.** The resolver in `source/lib/design-tokens.mjs` and the docs kit have none, and they are copied into every consumer.
- **Reuse a published tag.** A release is immutable, and a bad one is fixed by the next version.
