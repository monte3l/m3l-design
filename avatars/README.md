# Avatars

The personal GitHub avatars for `enri3l` and `giulmonte`. They belong to the MONTE3L brand but not to the design system, so a release never copies them into another repository.

Each is the brand's peak repeated inward like the contour lines of a map, with a bright summit, centred for the circle GitHub crops it to. The two are the same shape with the palettes swapped: `enri3l` is light on a dark ground and `giulmonte` is dark on a light one, so neither is the default.

| File | Use |
| --- | --- |
| `enri3l.svg`, `giulmonte.svg` | The source. A square, so a platform that crops to a circle and one that does not both work |
| `enri3l-1024.png`, `giulmonte-1024.png` | A larger copy for other platforms and print |
| `enri3l-500.png`, `giulmonte-500.png` | GitHub's recommended size |

To set one, open **Settings**, then **Public profile**, and upload the 500 px PNG as the profile picture. GitHub has no API for it.

## GitHub Apps

`apps/` holds one avatar for each of the organization's five GitHub Apps. They share one frame, a single pale peak on the solid accent ground, so they read as a family and not as a person (the personal avatars use contours and no emblem). The emblem cut into the peak tells them apart, and holds at 40 px.

| App | Emblem | Does |
| --- | --- | --- |
| `monte3l-release` | A flag on the summit | Opens the release pull request and publishes |
| `monte3l-sync` | Two arrows chasing each other | Syncs workflow templates and best-practice files |
| `monte3l-env-janitor` | A broom | Cleans up environment secrets |
| `monte3l-audit` | A lens with a tick | Reads settings for the baseline audit, read-only |
| `monte3l-planning` | A dotted route to a destination | Keeps the project board in step |

Each has `apps/<name>.svg` and `apps/<name>-500.png`. To set one, open the organization's **Settings**, then **GitHub Apps**, **Edit** the App, and upload the PNG under **Display information**. GitHub has no API for it.

The colours come from the design tokens (the wine ramp, `color-text-primary` and `color-surface-default`). Rebuild with `node bin/build-brand.mjs`; the files are generated, so do not edit them.

The files are under the MONTE3L brand licence, `LICENSES/LicenseRef-MONTE3L-Brand.txt`, not MIT.
