# Asiatic Surfaces — home page

Single-page site for **Asiatic Surfaces** (laminates, panels and surface finishes).
Instagram: [@asiaticsurfaces](https://www.instagram.com/asiaticsurfaces/)

Five pages: the home page, plus a masonry sheet gallery for each of the four families
whose photography has arrived (`45-degree.html`, `digital.html`, `stone.html`,
`wooden.html`).

## Home page

Three sections, as specified:

1. **Hero** — an inset rounded card with one fixed image, the headline *Full Sheet View*
   fitted to the sheet width on a single line, and a plate of all eight surface families
   breaking the hero's bottom edge.
2. **Collection** — a 12-column asymmetric bento of the eight families.
3. **Thank You** — a continuously looping name ticker and the sign-off.

## Run it

```bash
python -m http.server 5599
```

Then open <http://localhost:5599>. There is no build step — it is plain HTML, CSS and JS.
(`.claude/launch.json` starts the same server if you use Claude Code.)

## Layout

```
index.html                    markup for all three home sections
45-degree.html digital.html   the four category galleries — GENERATED, do not hand-edit
stone.html wooden.html
assets/css/style.css          design tokens, layout, keyframes, breakpoints
assets/css/gallery.css        category pages: nav, masonry, lightbox
assets/js/main.js             headline fitter, card strip, GSAP motion + fallback
assets/js/gallery.js          masonry spans, reveal, lightbox
assets/gallery/<family>/      web-ready sheets, two sizes each, + catalogue.json
assets/textures/*.webp        the eight lifestyle images used on the home page
assets/textures/PROMPTS.md    prompts + filenames for regenerating those
scripts/build_gallery.py      source folders -> assets/gallery + catalogue.json
scripts/gen_pages.py          catalogue.json -> the four category pages
memory.md                     project knowledge base — read this before changing anything
BUILD_LOG.md                  what was built, what broke, what was measured
```

## Category galleries

Each page is a masonry grid of full sheet scans; clicking one opens a lightbox with
arrow-key navigation. **The four HTML files are generated** — edit `scripts/gen_pages.py`
(layout and copy) or `assets/gallery/catalogue.json` (the sheets), never the pages.

To add sheets: drop the originals into a folder, point `CATS` in
`scripts/build_gallery.py` at it, then

```bash
python scripts/build_gallery.py && python scripts/gen_pages.py
```

The originals stay out of git (273 MB); only the derivatives ship.

## Brand

| Token | Hex | Name |
|---|---|---|
| `--sage` | `#b9c8b3` | Soft Sage |
| `--powder` | `#b8d5de` | Powder Blue |
| `--sky` | `#d2e8ff` | Light Blue |
| `--ivory` | `#f5f0e8` | Warm Ivory |

Type: **Asar** for headings, **Palanquin** for body, both from Google Fonts. Every heading
runs two colours and two styles — roman in ink, the emphasis word italic in the accent.

## Imagery

All nine images are **lifestyle photographs** — each surface shown applied in a modern
interior. Served as WebP at two sizes, because the plate cards and the bento tiles need very
different resolutions:

| | used by | size each |
|---|---|---|
| `<family>.webp` (1100px) | bento tiles, lazy-loaded | 26–224 KB |
| `<family>-420.webp` | hero plate cards, loaded up front | 5–24 KB |
| `hero-interior.webp` / `-900.webp` | hero background | 147 KB / 30 KB |

Source PNGs were 17.5 MB in total; converted they are 857 KB lazy plus 110 KB up front.
**Always convert before committing** — raw generated PNGs are ~2 MB each.

The procedural SVGs are kept in `assets/textures/` as a fallback and as a record of the
original approach; nothing references them now. The prompts that produced the photographs are
in [`assets/textures/PROMPTS.md`](assets/textures/PROMPTS.md), so a single family can be
regenerated consistently.

**After replacing any image, re-measure contrast.** `scratchpad/hero_contrast.py` does the
hero; the tile-caption method is in `memory.md`.

## Motion

GSAP 3 + ScrollTrigger from a CDN drive the entrances and scroll-linked motion. If the CDN is
unreachable — or GSAP's ticker never advances — the page reverts to an
IntersectionObserver + CSS path, so content is never left invisible. `prefers-reduced-motion`
is respected throughout.
