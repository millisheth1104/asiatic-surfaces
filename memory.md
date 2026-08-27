# Asiatic Surfaces — Project Knowledge Base

## What this is
Single-page brand home page for **Asiatic Surfaces** (surfaces / panels / laminates brand).
Instagram reference: https://www.instagram.com/asiaticsurfaces/

Three sections only, as specified:
1. **Hero** — inset rounded card with **one fixed image** (no rotation), a full-sheet
   one-line headline, a note beneath, and a plate of all 8 surface cards breaking the
   hero's bottom edge
2. **Collection** — bento grid of the 8 product families
3. **Thank You** — closing section + footer

Hero layout follows the Mumbai Dabbawala launch page the user supplied as reference:
white page frame around a rounded hero card, logo on a white plate, concave notch where
the card plate meets the hero's bottom edge, cards overhanging below that edge.

## Brand tokens (locked)

| Token | Hex | Name |
|---|---|---|
| `--sage` | `#b9c8b3` | Soft Sage |
| `--powder` | `#b8d5de` | Powder Blue |
| `--sky` | `#d2e8ff` | Light Blue |
| `--ivory` | `#f5f0e8` | Warm Ivory |
| `--ink` | `#1b211c` | derived deep green-charcoal (text) |

Fonts: **Asar** = all headings (`--f-display`) · **Palanquin** = body/UI (`--f-body`).
Loaded from Google Fonts in `index.html`.

## The 8 product families (fixed order + numbering)
01 Fabric · 02 Wooden · 03 Charcoal Panels · 04 Laminates · 05 Louvers · 06 Thermolam · 07 Edge Bands · 08 Texture

Display order in the bento differs from the numbering — the grid is packed for visual
rhythm, the `01–08` labels carry the sequence.

## File map
```
index.html                    all markup (3 sections + topbar)
assets/css/style.css          tokens, layout, all animation keyframes, responsive
assets/js/main.js             slider, headline fitter, GSAP motion + CSS/IO fallback
assets/textures/*.svg         8 surface visuals, one per family (hero composes from these)
.claude/launch.json           `python -m http.server 5599` preview config
```

## Images — how to swap in real photos
There are **8 files, one per family** — no separate hero art. Each is **procedural SVG**
(real interlaced weave, cathedral wood grain bent by a displacement map, cylindrically
shaded slats with cast shadows, a routed door profile, a laminate core edge), because no
image-generation tool was available in the build session.

⚠️ **Never put the webp and its fallback in one comma-separated `background-image`.** A
layer list downloads **every** image in it, so phones were pulling 294 KB (39 KB webp +
255 KB jpeg) to display one. Use two separate declarations instead — an overridden
declaration downloads nothing, so exactly one image is fetched:
`background-image:url(...jpg); background-image:var(--hero-img);`

⚠️ **The phone variant is pre-exposed.** `hero-interior-900.webp` has the CSS filter baked
in (brightness .82, saturate .96, contrast 1.02), so mobile sets `--hero-b:1` and disables
`filter` and the drift animation — one fewer filtered, animated, composited layer for a
mobile GPU to mishandle. If you regenerate that file, re-bake the exposure or reinstate the
filter, or the phone hero will look washed out.

The hero is **a real photograph** now — `hero-interior.webp` (1672×941, 16:9), served from
`.hero__bg { --hero-img }` with `hero-interior.jpg` layered beneath as a non-WebP fallback and
`hero-interior-900.webp` (38 KB) substituted below 680px. The 2.1 MB PNG master was converted
and removed; keep it out of the repo if it comes back.

The eight surface files are still procedural SVG.

**One place to change per family.** In `assets/css/style.css`:

```css
[data-tex="fabric"] { --tex:url("../textures/fabric.svg"); }   /* → your photo */
```

That single declaration feeds the hero planes AND the hero card. The bento tile uses a
plain `<img src>` in `index.html`, so a full swap is 2 edits per family.

⚠️ **The `[data-tex]` rules are load-bearing and easy to lose.** They sit next to the shelf
rules in `style.css`. They were once wiped out by a wholesale replacement of the hero CSS
region and the eight plate cards silently rendered with no image at all — `--tex` resolved to
empty, so `background-image: var(--tex)` became `none`. After any large edit to `style.css`,
check that `document.querySelectorAll('.chip__media')` all report a `textures/` background.

⚠️ **Keep those `url()`s in the stylesheet, not in an inline `style` attribute.** Chrome
resolves a relative `url()` inside a custom property against the stylesheet that *uses*
`var()`, not the document — inline `--tex:url('assets/…')` silently 404s as
`assets/css/assets/…`. This was a real bug during the build.

Recommended photo specs: **1600×1100** or larger, subject centred, even lighting.
Hero legibility comes from the plane brightness filters plus the scrim — if a photo is
much brighter than the current textures, re-check contrast (see below).

## Motion: GSAP, and why the fallback matters
GSAP 3.12.5 + ScrollTrigger load from jsDelivr (CDN script tags, `defer`, so order holds).
When they load, JS adds `gsap-on` to `<html>` and **CSS stands down** — the `html.gsap-on`
block neutralises every entrance/scroll start state. Without GSAP the IntersectionObserver
+ rAF path runs, so content is never stranded.

Three rules learned the hard way here:
- **Never put a CSS `transition` on a property GSAP animates.** `.tile__swatch` had
  `transition:transform`, which fought the tween's per-frame writes and left the value
  unsettled. Hover-only transitions are fine; animated ones need `transition:none`.
- **Never share one ScrollTrigger config object between two tweens** — the instance
  consumes it and the second tween breaks silently.
- **`gsap.from()` writes its start state immediately**, so a dead ticker leaves content
  invisible. A watchdog checks `gsap.ticker.frame` 1.8s after load and, if it hasn't
  advanced *while the tab is visible*, reverts GSAP and starts the CSS/IO path. A
  backgrounded tab is deliberately not judged — rAF is throttled there by design.

## Non-obvious decisions
- **Hero scrim (`.hero::after`)** is load-bearing, not decoration. Measured across all 8
  slides the headline sits at 9.07–17.68:1 and body copy at 11.76–18.91:1. Brighter
  imagery erodes this — re-measure before shipping a photo swap.
- **The headline is fitted by JS, but CSS owns the breakpoint.** `fitTitles()` measures the
  one-line width and passes the result in as `--fit`; `font-size:var(--fit, clamp(...))`
  consumes it. Above 900px every headline fills the hero width exactly on one line
  (measured: 100% fill, 95–100px, 0 of 8 overflowing). At ≤900px the media query sets
  font-size directly and ignores `--fit`, so a stale value from a wider layout can never
  win. Do not switch this back to setting `font-size` inline.
- **The hero headline text is literally "Full Sheet View."** That phrase was the user's
  requirement, repeated several times before it became clear it meant the copy itself and not
  a layout instruction. Do not "improve" it.
- **Hero copy is split top/bottom.** Eyebrow + headline sit at the top of the sheet; the
  sub-line and Instagram link sit near the bottom but lifted clear of the plate's top edge
  (`padding-bottom: clamp(150px,21vh,250px)`), because sitting on the hero floor put them
  level with the plate. `.hero__inner--bottom` also carries `padding-right: --shelf-w + 28px`
  so it can never run under the plate.
- **Every heading runs two colours and two styles**: roman in `--ink`, the emphasis word
  italic in `--accent-ink` (`#6c7f64`, deep sage) on ivory, or `--accent-dark` (`#c8d6c1`) on
  the hero. `#6c7f64` on ivory measures ~3.8:1, which passes AA for large text only — keep
  this treatment on headings, never on body copy.
- **Headline scale is `FILL` in `main.js`** (currently `0.74`: the headline spans ~74% of
  the sheet on one line, ~70–74px at 1440). That one number is the whole size control.
- **Headline copy must stay ~24–31 characters.** All eight are within that band, which is
  why the fitted sizes land within 5px of each other. A much shorter or longer line will
  visibly jump in size between slides.
- **`.hero-block` must wrap ONLY the hero.** The plate is `position:absolute; bottom:-var(--shelf-drop)`
  against that block, so anything else inside it (the note, once) moves the anchor and the
  overhang measures from the wrong edge. The note lives after `.hero-block`, inside `.frame`.
- **`.hero-foot` min-height must exceed `--shelf-drop`** or the overhanging plate touches the
  collection section.
- **The plate's left padding must clear the stamp** (`clamp(80px,7.6vw,118px)` vs a stamp
  ~106px wide at its widest). Too little and the stamp crops the first card.
- **`.shelf` is a sibling of `.hero`, not a child** — `.hero` has `overflow:hidden` for the
  slide wipe, so a child could never overhang. The plate sits in `.hero-block` and hangs
  `var(--shelf-drop)` below the hero's bottom edge; `.collection` adds that same variable to
  its top padding to make room. The concave notch is `.shelf::before`, a radial-gradient
  inverted corner pinned to the hero's bottom line.
- **On mobile the bento uses 2 columns with only the FIRST and LAST tiles spanning both.**
  A full-width tile placed after an odd number of half tiles cannot fit the remaining single
  column, so it jumps to the next row and abandons the cell beside it — that left visible holes
  next to Wooden and Louvers. DOM order is fabric, wooden, charcoal, laminates, thermolam,
  louvers, edge, texture, so spanning only fabric and texture pairs the middle six into three
  clean rows. `grid-auto-flow: row dense` is set as a guard if that order ever changes.
- **Anything whose padding derives from `--shelf-w` MUST be reset at every breakpoint where
  the plate stops sitting beside it.** This bit twice: `.hero__inner--bottom` and `.hero-foot`
  both carry `padding-right: --shelf-w + 28px` so the desktop copy clears the plate. At 375px
  that was 291px of padding on a 375px screen — the sub-line rendered in a **51px column over
  16 lines**. At 700px it was still 498px, leaving 164px. Both ranges now reset it: below
  900px the bottom copy goes **above** the plate at full width (hero `padding-bottom` grows to
  clear the plate's rise), and below 680px the plate is a tray below the hero anyway.
- **`--shelf-w` drives both sides of the hero floor.** The plate's width and the
  `max-width` on `.hero__foot` / `.hero__rail` come from the same variable, which is what
  keeps the CTA and slider controls clear of the plate at every width. Change it in one
  place, then re-check clearances.
- **Per-material hero exposure.** Each slide sets `--near-b`/`--far-b` (the plane
  `brightness()`). A flat value cannot work across the set: at `.60` charcoal and louvers
  rendered as a black void, so they run at `1.45`/`1.30` while pale materials sit at
  `.64–.72`. Contrast was re-measured after every change.
- **No top bar.** Removed on request — wordmark, nav, counter chip and Explore button are
  gone, and the brand now appears only in the footer. The hero starts at the frame padding.
- **The 8 cards are anchors to the collection**, not slider controls — the hero is static
  now. The plate has its own prev/next arrows that scroll the strip and disable at the ends.
- **Autoplay timing** lives in one place: `--slide-dur` (6800ms). JS reads it from CSS, and
  the ken-burns zoom on both planes plus the active card's progress bar are keyed to the same
  variable. Change it once.

## The marquee must be built, not hard-coded
The `translateX(-50%)` loop is only seamless when **half the track is at least as wide as the
frame**. One group of eight names is narrower than that on a wide screen, which showed as a
gap mid-loop after the font size was reduced. `buildMarquee()` in `main.js` measures the group
and clones it to `2 × ceil(frameWidth / groupWidth)` copies, then sets the duration from the
distance so the speed stays constant (~55 px/s). It re-runs on resize and after fonts load.
Never hard-code the number of copies.

## Verification notes
Everything in this project was verified programmatically (canvas pixel sampling, geometry
measurement, contrast compositing) because the Browser pane could not composite frames in
the build sessions — no screenshots were available. Useful probes, if you need them again:
- texture direction: compare row-mean vs column-mean standard deviation of luminance
  (wood should read HORIZONTAL, louvers/charcoal VERTICAL)
- hero contrast: draw the texture to canvas with `ctx.filter` set to the plane's CSS
  filter, paint the two scrim gradients over it, then measure relative luminance
- entrance animations must be neutralised before measuring geometry, or you measure the
  `from` state

## Preview
```bash
python -m http.server 5599
```
Then open http://localhost:5599 — or use the `asiatic-static` config in `.claude/launch.json`.
