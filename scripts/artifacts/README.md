# Design Artifacts

Pre-built SVG/CSS/HTML components for the Stage 4 composition engine.
These are uploaded to Vercel Blob and cataloged in Neon by `scripts/seed-design-artifacts.mjs`.

## Categories
- `blobs/` — Organic accent shapes (opacity 0.3-0.6, corner anchored)
- `dividers/` — Section separators (wave, arc, straight)
- `masks/` — Clip-paths for actor photos (egg, organic, circle)
- `badges/` — Circle gradient + icon (64x64)
- `gradients/` — CSS background gradient classes
- `ctas/` — Pre-styled CTA button HTML snippets
- `patterns/` — Subtle texture overlays

## Adding artifacts
1. Add the SVG/CSS/HTML file to the appropriate category folder
2. Add an entry to `ARTIFACTS` array in `scripts/seed-design-artifacts.mjs`
3. Run `node scripts/seed-design-artifacts.mjs`
