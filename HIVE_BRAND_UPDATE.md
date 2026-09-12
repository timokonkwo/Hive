# Hive logo update — September 12

Status: implemented and locally reviewed on `main_redesign`. No push or deployment.

## Supplied identity

The user supplied `public/logo.svg` (compact icon + lettering), `public/Hive main.svg` and `public/Hive main.png` (full exports), `public/hive-icon.svg` and `public/hive.png` (icon), `public/hive.jpg` (square artwork), and updated browser/app icons.

Use the supplied lime `#BEFF00` and olive `#94C700`. Preserve the path geometry. `BrandMark.tsx` contains the supplied SVG paths: the icon crops only empty canvas; the wordmark retains the provided lettering and changes its fill with the surface text color. No substitute font or new logo was drawn. The input exports remain intact.

## Placements

- Landing header/footer, app sidebar/mobile header, and legacy navigation/footer: compact full wordmark at 96 × 40px.
- Landing document/closing artwork and token identity: icon only.
- Login providers and organization metadata: tightly framed `/brand/hive-icon.svg`.
- Browser/app icons: supplied updated files, with versioned icon URLs to avoid the old cached green mark. The web manifest now names Hive.
- Default, agent and task share images: supplied full logo. `/og.png` was exported from the local default image renderer; the landing now includes it in share metadata.
- Old `/images/logo.svg` and `/images/logo.png` asset URLs serve the supplied full exports. The user had already replaced `/images/hive-icon.svg` with the new icon.

The Three.js agent scene is an illustration, not a logo, and remains in place. Legacy documentation retains its existing dark presentation pending its separately approved redesign.

## Validation

Production build, TypeScript and scoped lint passed (zero lint errors; existing warnings remain). The brand browser audit passed 35 checks, including redesigned light/dark surfaces, 320/390/1440px, legacy navigation, footer, static assets and dynamic agent share-image rendering. Screenshots were inspected for fit and letter contrast. No old green logo path fills remain in app/components/lib/public SVG sources. Existing user uploads were not discarded.

Reproduce: `node scripts/redesign/check-brand.mjs` with an isolated Chrome CDP endpoint on port 9350 and local preview on port 3100. Evidence: `/private/tmp/hive-redesign-qa/brand-results.json`, `brand-landing-light-320.png`, `brand-marketplace-dark-1440.png`, and `brand-footer-light-1440.png`.


## Follow-up — smaller navigation identity

The user found the mark too large beside the export lettering and authorized using the icon plus manual text. The interface lockup now uses the supplied icon at 28px with 24px Hive text, reducing to 24px/22px on mobile. This supersedes the 96 × 40px full-wordmark placement described above. Shared landing/app/legacy headers and footers use the new proportions; original artwork exports and share images are unchanged. See `HIVE_LANDING_NAVIGATION.md`.
