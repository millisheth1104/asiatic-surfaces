# Asiatic Surfaces — project memory

Context for anyone (or any future session) picking this up. Written 2026-08-28, at the end of
the build session. `BUILD_LOG.md` has the blow-by-blow; this file is the part worth reading
first.

---

## 1. What this is

Single-page brand home page for **Asiatic Surfaces** — a surfaces / panels / laminates brand.
Instagram: https://www.instagram.com/asiaticsurfaces/

- Repo: https://github.com/millisheth1104/asiatic-surfaces (branch `main`)
- Live: https://asiatic-surfaces.vercel.app
- No build step. Plain HTML + CSS + JS. `python -m http.server 5599`, or the
  `asiatic-static` config in `.claude/launch.json`.

**Three sections, and only three** — that was the brief and it has not changed:

1. **Hero** — an inset rounded card holding one fixed photograph. Eyebrow + headline
   (*Full Sheet View*) at the top; sub-line + Instagram link near the bottom. A plate of all
   eight surface cards breaks the hero's bottom-right edge, and a short note sits under the
   hero to its left.
2. **Collection** — a 12-column asymmetric bento of the eight families.
3. **Thank You** — a looping name ticker, the sign-off, the palette bands, a footer.

The hero's shape follows the Mumbai Dabbawala launch page the user supplied as reference:
page frame around a rounded hero card, a plate breaking its bottom edge with cards on it, a
concave fillet where the two meet.

---

## 2. Brand system (locked — supplied, not chosen)

| Token | Hex | Name |
|---|---|---|
| `--sage` | `#b9c8b3` | Soft Sage |
| `--powder` | `#b8d5de` | Powder Blue |
| `--sky` | `#d2e8ff` | Light Blue |
| `--ivory` | `#f5f0e8` | Warm Ivory |
| `--ink` | `#1b211c` | derived deep green-charcoal, body text |
| `--accent-ink` | `#6c7f64` | heading emphasis on ivory |
| `--accent-dark` | `#c8d6c1` | heading emphasis on the hero |

Fonts: **Asar** for every heading, **Palanquin** for body and UI. Google Fonts, linked in
`index.html`.

**Eight families, fixed set and numbering:**
01 45 Degree · 02 Wooden · 03 Digital · 04 Laminates · 05 Louvers · 06 Stone ·
07 Edge Bands · 08 Texture

The bento's visual order differs from the numbering; the `01–08` labels carry the sequence.

**Display name ≠ slug.** Three families were renamed on 2026-09-05 and the internal slugs
were deliberately left alone, because they key the CSS `[data-tex]` rules, the `.tile--*`
grid placements, the caption-scrim groups and the image filenames — renaming them would
touch four files and 16 assets to change nothing a visitor sees.

| shown to the visitor | slug / class / image |
|---|---|
| 45 Degree | `fabric` |
| Digital | `charcoal` |
| Stone | `thermolam` |

So a grep for a label will not find its styling, and vice versa. The five unchanged families
(Texture, Wooden, Edge Bands, Laminates, Louvers) still match their slugs.

---

## 3. File map

```
index.html                      markup, all three sections
assets/css/style.css            tokens, layout, keyframes, breakpoints, gsap-on block
assets/js/main.js               headline fitter, card strip, marquee builder, GSAP + fallback
assets/textures/
  hero-interior.webp            hero, desktop (147 KB)
  hero-interior-900.webp        hero, ≤680px, exposure pre-baked (30 KB)
  hero-interior.jpg             hero, pre-var() browsers (255 KB, rarely fetched)
  <family>.webp        ×8        bento tiles, 1100px, lazy-loaded (26–224 KB)
  <family>-420.webp    ×8        hero plate cards, loaded up front (5–24 KB)
  <family>.svg         ×8        the original procedural SVGs — unreferenced, kept as record
  PROMPTS.md                    the prompts that produced the photographs
45-degree.html digital.html    the four category galleries — GENERATED, never hand-edited
stone.html wooden.html
assets/css/gallery.css          category pages: sticky nav, masonry, lightbox
assets/js/gallery.js            masonry row spans, reveal, lightbox
assets/gallery/
  catalogue.json                every sheet: code, name, ratio, both file paths
  <family>/<code>.webp          grid image, 900px long edge (2–200 KB)
  <family>/<code>-full.webp     lightbox image, 2000px long edge (14 KB–1.1 MB)
scripts/build_gallery.py        source folders → assets/gallery + catalogue.json
scripts/gen_pages.py            catalogue.json → the four category pages
README.md · BUILD_LOG.md · memory.md
.claude/launch.json             preview server
```

**The four category pages are build output.** Edit `scripts/gen_pages.py` for layout or copy
and `scripts/build_gallery.py` for the images, then re-run both — in that order, because the
generator reads the catalogue the converter writes. A hand-edit to `digital.html` is lost the
next time anyone adds a sheet.

---

## 4. How this evolved (so you don't undo a decision)

The design moved a long way during one session. The current state is the result of specific
requests, several of which reversed earlier work:

1. Built first as a **4-slide "slide revolution"** hero with procedural SVG textures, because
   no image-generation tool was available.
2. Reference screenshots arrived → hero rebuilt as an **inset rounded card** with the plate
   breaking its bottom edge; slides went 4 → **8**, one per family.
3. **"I don't want this hero section's image to change — I want only one proper image"** →
   the slider was removed entirely. The hero is now **static**. The eight cards became
   anchors into the Collection, not slide controls. All slider machinery (slides, decks,
   autoplay, rail, ticks, per-card progress, `--slide-dur`, the two-plane composition) is
   gone. **Do not reintroduce it.**
4. **"Full sheet view"** was said three times and read three times as a layout instruction
   (span the sheet, one line, full width). It meant the **literal headline text**. It is now
   the headline. Do not "improve" it.
5. **Top bar removed on request** — wordmark, nav, counter chip, Explore button. The brand
   appears only in the footer. Also removed: the "See The Collection" pill (the Instagram
   link stays) and the rotating "SCROLL TO SEE" stamp.
6. **Headings gained two colours and two styles** (roman in ink, emphasis word italic in the
   accent) after an earlier instruction to make the gradient-filled word "a basic colour".
   The gradient is gone; do not bring it back.
7. **GSAP was requested by name** for smoother motion, and now drives everything.
8. Images arrived last: the hero interior photograph, then all eight family photographs.

Things the user rejected along the way, so they stay rejected: the rotating stamp, the
gradient-filled heading word, the card drop-shadow, a rotating hero image, oversized
headings, and the two-line Collection heading.

---

## 5. Working preferences observed

- Replies should be **terse and direct**. Organisation instruction: don't use 100 words where
  20 will do; no filler affirmations.
- Every project keeps a **`memory.md` knowledge base** and a **`BUILD_LOG.md`** updated on
  completion. Organisation-level requirement, not a preference.
- The user **reviews on a real phone** against the Vercel deployment, and sends annotated
  screenshots (red circles) rather than descriptions. Mobile correctness matters as much as
  desktop.
- The user **wants everything pushed to git** as it lands.
- The user **supplies the images** — generate prompts, not pictures (see §7).

---

## 6. Layout invariants — the load-bearing bits

Break any of these and the hero visibly falls apart.

- **`.hero-block` wraps ONLY the hero.** The plate is `position:absolute;
  bottom:-var(--shelf-drop)` against that block. Put anything else inside it and the anchor
  moves, so the overhang measures from the wrong edge (this happened: the plate hung 230px
  instead of 115). The note lives *after* `.hero-block`, inside `.frame`.
- **`.shelf` is a sibling of `.hero`, not a child** — `.hero` has `overflow:hidden`, so a
  child could never overhang. The concave fillet is `.shelf::before`, a radial-gradient
  inverted corner overlapping the plate by 1px on each side so no hairline seam shows.
- **`.hero-foot` min-height must exceed `--shelf-drop`**, or the overhanging plate touches the
  Collection section.
- **Anything whose padding derives from `--shelf-w` must be reset at every breakpoint where
  the plate stops sitting beside it.** This bit twice. `.hero__inner--bottom` and
  `.hero-foot` both carry `padding-right: --shelf-w + 28px` for the desktop layout. At 375px
  that was **291px of padding on a 375px screen** — the sub-line rendered in a 51px column
  over 16 lines. At 700px it was still 498px. Below 900px the bottom copy now goes **above**
  the plate at full width (hero `padding-bottom` grows to clear the plate's rise); below
  680px the plate is a tray beneath the hero anyway.
- **The headline is fitted by JS, but CSS owns the breakpoint.** `fitTitle()` measures the
  one-line width and passes the result in as **`--fit`**;
  `font-size:var(--fit, clamp(...))` consumes it. Above 900px it is one line at ~74% of the
  sheet width; at ≤900px the media query sets font-size directly and ignores `--fit`, so a
  stale value from a wider layout can never win. **Do not go back to setting `font-size`
  inline** — that bug shipped once.
- **Headline size is one number**: `FILL` in `main.js` (currently `0.74`, capped by
  `FIT_MAX = 78`). The cap exists because a three-word headline would otherwise balloon.
- **Mobile bento: 2 columns, only the FIRST and LAST tiles span both.** A full-width tile
  placed after an odd number of half tiles cannot fit the single remaining column, so it
  jumps a row and abandons the cell beside it — that left visible holes next to Wooden and
  Louvers. DOM order is fabric, wooden, charcoal, laminates, thermolam, louvers, edge,
  texture, so spanning only fabric and texture pairs the middle six into three clean rows.
  `grid-auto-flow: row dense` guards the order.
- **The marquee is built, not hard-coded.** The `translateX(-50%)` loop is seamless only when
  half the track is at least as wide as the frame. `buildMarquee()` measures one group and
  clones it to `2 × ceil(frameWidth / groupWidth)`, then derives the duration from the
  distance so speed stays constant (~55 px/s). Re-runs on resize and after fonts load.
- **Heading emphasis stays on headings.** `--accent-ink` `#6c7f64` on ivory measures ~3.8:1 —
  AA for large text only. Never use it for body copy.

---

## 7. Imagery

All nine images are lifestyle photographs, supplied by the user and converted here.

**Two sizes per family, deliberately:** a plate card is ~196px and loads immediately, while a
bento tile reaches 733px and is lazy. One file cannot serve both without wasting weight up
front. Source PNGs were 17.5 MB total → **857 KB lazy + 110 KB up front**.

**Always convert before committing.** Raw generated PNGs are ~2 MB each.

To swap one family: the `[data-tex="<family>"]` rule in `style.css` (card) and the matching
bento `<img src>` in `index.html` (tile). Two edits. The hero is one: `--hero-img` on
`.hero__bg`.

Four traps, all of which have already caused real bugs:

- **Keep `url()`s in the stylesheet, never in an inline `style` attribute.** Chrome resolves a
  relative `url()` inside a custom property against the stylesheet that *uses* `var()`, not
  the document — inline `--tex:url('assets/…')` 404s as `assets/css/assets/…`. All 16
  backgrounds broke this way once.
- **The `[data-tex]` rules are easy to lose.** They sit next to the shelf rules. A wholesale
  replacement of the hero CSS region once deleted them and all eight cards silently rendered
  with **no image** — a missing custom property fails quietly, with no console error and no
  404. After any large `style.css` edit, check that every `.chip__media` reports a
  `textures/` background.
- **Never put an image and its fallback in one comma-separated `background-image`.** A layer
  list downloads *every* image in it; phones were pulling 294 KB to show one. Use two
  declarations — the overridden one costs nothing:
  `background-image:url(...jpg); background-image:var(--hero-img);`
- **`hero-interior-900.webp` has the exposure baked in** (brightness .82, saturate .96,
  contrast 1.02), so mobile sets `--hero-b:1` and disables `filter` and the drift animation.
  Regenerate that file and you must re-bake the exposure or reinstate the filter, or the
  phone hero looks washed out.

The eight procedural SVGs remain in the folder, unreferenced. They were the original approach
(SVG filters producing a real interlaced weave, cathedral wood grain, cylindrically shaded
slats, a routed door profile, a laminate core edge) and are kept as a 52 KB fallback and a
record. `PROMPTS.md` holds the prompts that produced the photographs, so a single family can
be regenerated in the same style.

**Image generation is not available from here.** Both configured providers refuse billable
calls: OpenAI returns `billing_hard_limit_reached`; Gemini returns `429` with
`generate_content_free_tier_requests, limit: 0`, i.e. the free tier includes no image
generation at all, so retrying cannot succeed. An `image-gen` MCP server *is* installed and
healthy (`node ~/.image-gen-mcp/server/index.js`, gpt-image-2 + Gemini) but MCP servers load
only at session start, so one added mid-session stays invisible until restart.
`scratchpad/gen_images.py` is ready if an account ever has billing.

---

## 8. Motion

GSAP 3.12.5 + ScrollTrigger from jsDelivr (`defer`, so order holds). When they load, JS adds
`gsap-on` to `<html>` and **the CSS start states stand down**. Without GSAP the
IntersectionObserver + rAF path runs, so content is never stranded.

Three rules learned painfully:

- **Never put a CSS `transition` on a property GSAP animates.** `.tile__swatch` had
  `transition:transform`, which fought the tween's per-frame writes and left the value
  unsettled. Hover-only transitions are fine; animated ones need `transition:none` under
  `gsap-on`.
- **Never share one ScrollTrigger config object between two tweens.** The instance consumes
  it and the second tween breaks silently.
- **`gsap.from()` writes its start state immediately**, so a dead ticker leaves content
  permanently invisible. A watchdog checks `gsap.ticker.frame` 1.8s after load and, if it
  hasn't advanced *while the tab is visible*, reverts GSAP and starts the CSS/IO path. A
  backgrounded tab is deliberately not judged — rAF is throttled there by design.

Why GSAP is genuinely smoother here: the old parallax called `getBoundingClientRect()` on all
eight tile media wrappers **every scroll frame**. ScrollTrigger batches and caches that.

---

## 9. Verification playbook

The Browser pane in these sessions ran with `document.hidden = true` and **0 rAF frames** — no
screenshots, and GSAP's ticker cannot advance. Everything was verified programmatically. If
you are in the same position:

- **Force tween end states before measuring geometry**, or you measure the `from` state:
  entrance tweens to `progress(1)`, scrub tweens to `progress(0)`. Forcing scrub tweens too
  produced a false "the CTA is clipped" reading.
- **The preview browser caches `style.css` across navigations.** A CSS-only edit can appear
  to do nothing. Re-fetch the stylesheet with a cache-busting query in-page before measuring.
  This produced a false "the fix didn't work" reading.
- **Contrast: measure with the text's own alpha.** The body copy is
  `rgba(247,244,236,.70)`, not opaque white. Ignoring that overstated every figure (10–13:1
  reported where the honest number was 7–8:1). `scratchpad/hero_contrast.py` does it properly
  in Pillow: cover-crop → the CSS filter chain in order → both scrim gradients → per-zone
  ratios against the composited text colour. **Python, not canvas** — the canvas version kept
  timing out in a hidden pane.
- **Lazy `<img>`s report `complete: false`** when below the fold. That is not a broken image.
- **The tool's console/network log is cumulative across navigations.** Use
  `performance.getEntriesByType('resource')` for per-load truth.
- Grid holes: group tiles into row bands by `top` offset and check each band's widths plus
  gaps sum to the grid width.

Current measured state: hero headline 17.1:1, body copy 7.7–8.8:1, worst pixel 5.23:1; worst
tile caption 7.62:1; no horizontal overflow and no squeezed copy at 320/375/430/700/768/900/
1024/1440.

---

## 10. Bugs that shipped, and what each one teaches

| Bug | Lesson |
|---|---|
| All 16 backgrounds 404'd as `assets/css/assets/…` | relative `url()` in a custom property resolves against the stylesheet using `var()` |
| Eight cards rendered with no image at all | a wholesale CSS region replacement deleted the `[data-tex]` rules; a missing custom property fails silently |
| Sub-line in a 51px column on a phone | desktop padding derived from `--shelf-w` was never reset for narrow screens |
| Plate hung 230px instead of 115px | `.hero-block` grew to include the note, moving the absolute anchor |
| Phones downloaded 294 KB to show one image | a comma-separated `background-image` list fetches every layer |
| Swatch tween never settled | a CSS `transition` was fighting GSAP's per-frame writes |
| Second tween silently dead | one ScrollTrigger config object shared between two tweens |
| White headline at 2.24:1 on a pale slide | scrims are load-bearing; measure, don't eyeball |
| Contrast overstated all session | measure with the text's actual alpha |
| Mobile grid holes | a full-width grid item after an odd number of half items abandons a cell |

---

## 10b. The category galleries

- **Masonry is a CSS grid, not CSS columns.** `grid-auto-rows: 4px`, and `gallery.js`
  converts each card's measured height into a `grid-row-end: span n`. Columns would have been
  zero-JS but would reorder the codes down each column; in a catalogue people scan for a code,
  so DOM order has to survive. Without JS the cards fall back to even rows — plainer, still
  correct.
- **`align-items:start` on `.masonry` is load-bearing.** Without it each card stretches to its
  grid row, every measurement returns the row height, and the spans grow on every relayout.
- **Card height is known before the image loads** — `aspect-ratio: var(--ar)` is written into
  each figure from the real pixel ratio, so the first `layout()` is correct and nothing jumps.
- **The lightbox focuses one frame late.** `visibility` only flips once the transition starts,
  so a synchronous `btnX.focus()` lands on nothing.
- **Seven supplied files were mockups floating in a flat mat** (18% white each side, one on
  grey). `trim_flat_border()` strips a border only when every row or column of it is one flat
  colour and the trim keeps ≥40% of the area — the guard exists because several sheets are
  nearly white all over and would otherwise be eaten.
- Digital carries 2.1 MB of grid images against 150 KB for the other three: eight of its
  sheets are dense woven repeats that WebP cannot compress. All lazy-loaded. If it ever needs
  to be lighter, those eight are the whole problem.

---

## 11. Outstanding

- Nothing is broken or half-finished. Repo clean, in sync, deployed.
- The eight procedural SVGs are unreferenced — keep or delete, but they are the documented
  fallback.
- **Four of the eight families have gallery pages** (45 Degree, Digital, Stone, Wooden — 45
  sheets). Texture, Edge Bands, Laminates and Louvers have no sheets yet, so their chips and
  tiles still scroll to `#collection`. When their images arrive, add a folder to `CATS` in
  `scripts/build_gallery.py`, add copy to `COPY` in `scripts/gen_pages.py`, re-run both, and
  point the chip and tile in `index.html` at the new page.
- Two things in the supplied folders worth a decision: the Stone folder holds several
  wood-named sheets (Natural Ashwood, Aromatic Walnut, Classic Walnut, Sandal Wood, Silver
  Oak), and `ZO 95401 - Silver Oak` was in both Stone and Digital. It is published under
  Stone only, so no visitor meets the same sheet twice; the skip is declared in `SKIP` in
  `scripts/build_gallery.py`.
- With the top bar gone there is no navigation. Scrolling and the Instagram link are the only
  affordances. That was the explicit request.
- If real photography ever replaces the AI images, re-run the contrast checks in §9 — that is
  the only step easy to forget and expensive to get wrong.
