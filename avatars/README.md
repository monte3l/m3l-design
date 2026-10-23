# Avatars

The personal GitHub avatars for `enri3l` and `giulmonte`. They belong to the MONTE3L brand but not to the design system, so a release never copies them into another repository.

Each is the brand's peak repeated inward like the contour lines of a map, with a bright summit, centred for the circle GitHub crops it to. The two are the same shape with the palettes swapped: `enri3l` is light on a dark ground and `giulmonte` is dark on a light one, so neither is the default.

| File | Use |
| --- | --- |
| `enri3l.svg`, `giulmonte.svg` | The source. A square, so a platform that crops to a circle and one that does not both work |
| `enri3l-1024.png`, `giulmonte-1024.png` | A larger copy for other platforms and print |
| `enri3l-500.png`, `giulmonte-500.png` | GitHub's recommended size |

To set one, open **Settings**, then **Public profile**, and upload the 500 px PNG as the profile picture. GitHub has no API for it.

The colours come from the design tokens (the wine ramp, `color-text-primary` and `color-surface-default`). Rebuild with `node bin/build-brand.mjs`; the files are generated, so do not edit them.

The files are under the MONTE3L brand licence, `LICENSES/LicenseRef-MONTE3L-Brand.txt`, not MIT.
