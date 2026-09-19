# Themes

RemnaRay themes are data directories under `themes/<slug>`. A theme contains
`theme.json` plus the asset filenames declared by its `assets` section. The
default `manta` theme and the non-editable `_admin` theme are included in the
repository.

Validate a theme before selecting it:

```sh
pnpm theme-validate themes/manta
```

The validator checks the Zod manifest, required assets, and WCAG contrast. A
contrast ratio below 4.5:1 is reported as a warning because the palette in the
v1 specification intentionally keeps the Manta teal and white brand pairing.

To create a private brand, copy the default theme and keep the same asset
filenames:

```sh
cp -r themes/manta themes/mybrand
# edit themes/mybrand/theme.json and replace the assets
pnpm theme-validate themes/mybrand
```

The web application converts the validated theme tokens into CSS custom
properties at render time. Tailwind v4 utilities such as `bg-primary`,
`text-foreground`, `border-border`, and `ring-ring` therefore follow the
selected theme without rebuilding the application. The admin and setup
surfaces use `_admin` so owner branding cannot affect administration screens.
