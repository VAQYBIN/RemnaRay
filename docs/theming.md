# Themes

RemnaRay themes are data directories under `themes/<slug>`. A theme contains
`theme.json` plus the asset filenames declared by its `assets` section. The
default `manta` theme and the non-editable `_admin` theme are included in the
repository.

Validate a theme before selecting it:

```sh
pnpm theme-validate themes/manta
```

The validator checks the Zod manifest, required assets, and WCAG contrast.
Body text contrast is a hard failure: `foreground` on `background` and
`dark.foreground` on `dark.background` must reach AA (4.5:1), which is the pair
section 13.5 names (text on sea foam and on deep ocean). The remaining pairs
(`primary-foreground` on `primary`, `accent-foreground` on `accent`,
`muted-foreground` on `muted`) are reported as warnings, because the palette in
the v1 specification intentionally keeps the Manta teal and white brand pairing
at 3.03:1.

To create a private brand, copy the default theme and keep the same asset
filenames:

```sh
cp -r themes/manta themes/mybrand
# edit themes/mybrand/theme.json and replace the assets
pnpm theme-validate themes/mybrand
```

`ThemeService` in `apps/api` owns theme loading. It reads
`themes/<slug>/theme.json` from the mounted directory (`RR_THEMES_DIR`, or
`/themes` in Compose), validates it, and serves `GET /api/v1/public/theme` with
an `ETag` and `Cache-Control: max-age=60`. Asset URLs are absolute and carry a
`?v=<hash>` fingerprint over the manifest and the asset files, so replacing an
asset busts the one-day immutable cache of `/themes/<slug>/<file>`.
`GET /api/admin/v1/themes` rescans the directory, so a new theme appears
without restarting anything, and a `rr:theme.changed` message drops the cache.

The web application reads those tokens per request with a five-second
revalidation window (AC-181) and converts them into CSS custom
properties at render time. Tailwind v4 utilities such as `bg-primary`,
`text-foreground`, `border-border`, and `ring-ring` therefore follow the
selected theme without rebuilding the application. The admin and setup
surfaces use `_admin` so owner branding cannot affect administration screens.
