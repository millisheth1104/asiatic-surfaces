# Asiatic Surfaces — home page

Single-page site for **Asiatic Surfaces** (laminates, panels and surface finishes).
Instagram: [@asiaticsurfaces](https://www.instagram.com/asiaticsurfaces/)

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
index.html                    markup for all three sections
assets/css/style.css          design tokens, layout, keyframes, breakpoints
assets/js/main.js             headline fitter, card strip, GSAP motion + fallback
assets/textures/*.svg         the eight surface visuals
assets/textures/PROMPTS.md    prompts + filenames for replacing them with photography
memory.md                     project knowledge base — read this before changing anything
BUILD_LOG.md                  what was built, what broke, what was measured
```

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

The eight surfaces are currently **procedural SVG** (built from SVG filters — real interlaced
weave, cathedral wood grain, cylindrically shaded slats, a routed door profile, a laminate
core edge), not photography. All eight together are 52 KB and resolution-independent.

To swap in real photographs, see [`assets/textures/PROMPTS.md`](assets/textures/PROMPTS.md) —
it lists the nine images, the exact filenames, aspect ratios and prompts. The hero is a
one-line change (`--hero-img` in `style.css`); each family is one CSS rule plus one `<img>`.

**After any swap, re-measure the hero text contrast.** The scrim is tuned against the current
placeholders and photographs are usually brighter; the method is documented in `memory.md`.

## Motion

GSAP 3 + ScrollTrigger from a CDN drive the entrances and scroll-linked motion. If the CDN is
unreachable — or GSAP's ticker never advances — the page reverts to an
IntersectionObserver + CSS path, so content is never left invisible. `prefers-reduced-motion`
is respected throughout.
