# Build Log — Asiatic Surfaces Home Page

**Date:** 2026-08-27
**Scope:** 3-section brand home page (hero slider · 8-product bento · thank you)
**Status:** Complete, verified in-browser

---

## Delivered

| Item | Detail |
|---|---|
| `index.html` | Topbar + 3 sections. 4 hero slide decks, 8 bento tiles, thank-you + footer. |
| `assets/css/style.css` | ~700 lines. Brand tokens, bento map, all keyframes, 6 breakpoints, reduced-motion block. |
| `assets/js/main.js` | Slider (autoplay/arrows/dots/keyboard/swipe/pause), IntersectionObserver reveals, parallax, scroll progress, sticky topbar. |
| `assets/textures/` | 12 procedural SVG surfaces — 8 product + 4 hero slides. |
| `.claude/launch.json` | Static preview server on port 5599. |
| `memory.md` | Project knowledge base (tokens, file map, image-swap guide, non-obvious decisions). |

## Section 1 — Hero (slide revolution)
4 auto-advancing slides (6.8s), each with its own headline deck. Clip-path wipe + ken-burns
zoom on the incoming slide; per-word mask reveal on the headline (staggered 70ms); progress
bar per rail dot; `01/04` counter. Controls: arrows, dots, ← →  keys, touch swipe. Pauses on
hover, on tab blur, and when scrolled out of view. Bottom-right "shelf" of surface cards
peeks above the hero's bottom edge with a rotating `SCROLL TO SEE` stamp.

## Section 2 — Collection (bento)
12-column asymmetric bento, fully packed across 4 rows — 8 tiles at 5 different span sizes.
Per-tile: `01–08` index, name in Asar, palette swatch chip that pops in on reveal, and a
description + rotating arrow that reveal on hover. Tiles rise in with a staggered
clip-path + translate reveal; tile imagery gets a subtle counter-scroll parallax. Dark-toned
tiles (Wooden, Charcoal, Louvers) flip to a dark scrim + light type automatically.

## Section 3 — Thank You
Infinite marquee of the 8 family names, oversized `Thank You` (Asar, italic gradient
second word), the 4-colour palette bands, Instagram CTA, and a footer.

## Verification performed
Ran against a local server in a real browser (no screenshots available — Browser pane
could not composite in this session, so everything below was measured programmatically).

- **Assets:** all 12 SVGs return 200 and decode at full size; **0 console errors**.
- **Fonts:** `document.fonts.check()` confirms **Asar** and **Palanquin** both active;
  computed `font-family` on `h1` = Asar, on body copy = Palanquin.
- **Texture rasterisation:** each SVG drawn to canvas and pixel-sampled. All 12 produce real
  tonal range (e.g. wooden lum 85→224, charcoal 5→113) and on-brand average colours —
  fabric `#bdc8b8` ≈ Soft Sage, thermolam `#b4ccd4` ≈ Powder Blue, laminates `#cedff0` ≈
  Light Blue. No blank or black frames.
- **Slider state machine:** next / prev / dot-jump / wrap-forward (4→1) / wrap-back (1→4)
  all advance slide + deck + dot + counter in sync.
- **Responsive:** audited at 1440, 1180, 1024, 900, 375, 360, 320px — 0 horizontal
  overflow, 0 bento tile overlaps, 0 clipped tile names at every width.

## Issues found and fixed during verification
1. **Hero contrast failure.** White headline measured **2.24:1** on the laminate slide,
   3.05:1 on fabric, 3.37:1 on wood — all failing WCAG. Added a two-axis `.hero::after`
   scrim (horizontal for desktop, vertical for mobile). Re-measured by compositing slide +
   scrim on canvas: headline now **6.86–16.28:1** mean, body copy **8.95–17.12:1**.
2. **Rail / shelf collision** at ~1180px — the labelled slider rail overlapped the shelf
   plate by 19px. Dot labels now hide below 1340px, and shelf cards thin 4→3→2 below
   1200px / 1000px.
3. **Headline wrap risk on mobile.** At 375px the longest hero line had only 8px of slack
   and "One material language." had 1px — a 360px phone would have wrapped mid-mask.
   Retuned the mobile type scale: slack is now 47px at 360px, 63px at 430px, with a
   dedicated guard under 340px.
4. **Squat bento tiles** — single-row tiles were 146px tall at 1280px. Row height changed
   from viewport-height-based to width-based (`clamp(158px,15.4vw,224px)`).
5. **Stale `is-leaving` slides** accumulated when clicking through the slider quickly;
   `goTo()` now clears the class on all slides before transitioning.
6. **Parallax edge gap** — translating `.tile__media` would have exposed the tile edge;
   media now has ±28px vertical bleed.
7. Swapped Louvers into the tall narrow bento slot (vertical slats suit it, and it's the
   shorter word) with Thermolam taking the wider slot.

## Known limitations
- **Imagery is procedural SVG, not photography.** No text-to-image tool was exposed in this
  session (searched twice; only Canva design-generation and an unauthenticated Adobe
  connector were available). Swap instructions are in `memory.md`.
- Instagram content was **not** scraped — the account requires login and blocks automated
  access. Product names, copy and palette came from the brief; real photos need to be
  exported from the account manually.
- Nav links are in-page anchors only (no sub-pages exist yet).


---

# Build Log — Revision 2 (hero rework)

**Date:** 2026-08-27
**Trigger:** review against the supplied reference screenshots — hero didn't match, only 4
of 8 families appeared in it, headline ran to two lines, imagery read as flat swatches,
marquee too large.

## Changes

### Hero rebuilt to the reference layout
- Page is now framed: `.frame` pads the viewport and `.hero` is an **inset rounded card**
  (`--r-hero`), with the wordmark on a **white plate** — matching the reference.
- The card plate of surfaces moved **out of** `.hero` into `.hero-block`, so it can
  **overhang below the hero's bottom edge** instead of being clipped by it (measured:
  hangs 82–115px below, rises 122–160px into the hero, flush to its right edge).
- Added the **concave notch** where the plate meets the hero's bottom line
  (`.shelf::before`, a radial-gradient inverted corner).
- Cards are now full rounded cards with an **icon badge** and **title + description inside**,
  as in the reference — not top-cropped strips.

### All 8 families in the hero
- 4 slides → **8 slides**, one per family, each with its own eyebrow, headline and body copy.
- 4 cards → **8 cards** in a snap-scrolling strip with an arrow control.
- **The cards are the slider's navigation** — clicking one switches the slide, and the
  autoplay progress bar moved onto the active card. The old 8-dot rail was removed as
  redundant (it also could not fit beside the plate).

### Headline: one line, full sheet width
- Copy rewritten to eight one-line headlines, all 24–31 characters.
- `fitTitles()` measures each headline's single-line width and passes the fitted size in as
  `--fit`; CSS consumes it via `font-size:var(--fit, clamp(...))`.
- Verified at 1440×900: **all 8 fit on one row, 100% width fill, 0 overflowing, 95–100px**.

### Imagery rebuilt
All 8 textures rewritten for material realism, and the 4 separate hero SVGs deleted — the
hero now composes depth from the same 8 files via two clipped, differently-lit `.plane`
layers.
- **Fabric** — true plain-weave interlace (weft under, warp over, weft floats on top), each
  yarn cylindrically shaded, displaced off-grid for slub, plus fibre fuzz and bolt mottle.
- **Wooden** — cathedral grain: banded turbulence bent by a second displacement map, open
  pore lines, plank joints with a lit arris, two knots, sheen sweep.
- **Louvers** — individually shaded slats (shadowed arris → hot highlight → falling mid),
  lit top edges, a tighter second run behind, and the shadow the near run casts on it.
- **Charcoal** — half-round matte flutes with V grooves and a lit top edge.
- **Thermolam** — an actual routed shaker door: bevel lit from the upper left, recessed
  field, thermofoil-soft edges.
- **Laminates** — sheet stack showing the **core on the edge** (decor, overlay, kraft
  layers) with a gloss streak.
- **Edge Bands** — stroked curved bands with a visible thickness edge and gloss, in the
  brand colours.
- **Texture** — two-scale relief (broad trowel + fine tooth) under raking light.

### Marquee
Reduced from `clamp(1.4rem,3.1vw,2.9rem)` to `clamp(.9rem,1.15vw,1.22rem)` — 35px → 14.4px
at desktop — with tighter padding and gaps. It now reads as a fine ticker, not a headline.

## Bugs found and fixed
1. **All 16 hero/chip backgrounds were 404ing and rendering blank.** Chrome resolves a
   relative `url()` inside a custom property against the stylesheet that *uses* `var()`,
   not the document — so inline `style="--tex:url('assets/textures/x.svg')"` requested
   `/assets/css/assets/textures/x.svg`. Moved all 8 declarations into `style.css` keyed off
   `data-tex`, where `../textures/x.svg` resolves correctly. Verified: 0 wrong-path
   requests, all 8 textures 200, all 16 backgrounds resolve.
2. **Slider rail and CTA overlapped the card plate** by 80px and 65px. Fixed by deriving
   the plate width and the copy column's `max-width` from one `--shelf-w` variable, and by
   replacing the 8-dot rail with prev/next + counter. Clearances now 140–495px.
3. **Stale fitted font sizes survived a resize past the breakpoint**, so a desktop size
   could persist into the mobile layout. Fixed by having JS set `--fit` instead of
   `font-size`, so the mobile media query always wins; added a `matchMedia` listener.
4. Charcoal read as near-black (max luminance 94/255) and Texture as washed out — flute
   highlights lifted and relief depth increased.
5. Fabric's average drifted off-palette (#a8b2a3 vs sage #b9c8b3) from over-heavy mottle
   and fold shadows — both eased.

## Verification
- **Textures at 1:1**: wood now reads horizontal grain (rowSD 19.2 vs colSD 8.7), louvers
  vertical (colSD 47.7), charcoal vertical (19.6); fabric detail 20.3, wood 15.4.
- **Contrast across all 8 slides**, compositing texture + plane filter + both scrim layers
  on canvas: headline **9.07–17.68:1** mean (worst pixel ≥5.94), body **11.76–18.91:1**
  (worst ≥9.78). Every slide clears AAA.
- **Slider**: next, card click (jump to 7), keyboard wrap 8→1 and 1→8, prev — slide, deck,
  card and counter stay in sync; progress bar present on the active card.
- **Responsive** at 1440, 1280, 1024, 900, 430, 375: 0 horizontal overflow, 0 bento
  overlaps, 0 rail/CTA/plate collisions, 0 of 8 headlines overflowing. On mobile the plate
  becomes a full-width tray below the hero copy, the far plane is dropped, and `--fit` is
  correctly not applied.
- 0 console errors; 0 wrong-path resource requests.

## Still true
- Imagery is procedural SVG, not photography — no text-to-image tool is exposed in this
  session (searched again this revision). Swap path documented in `memory.md`.
- Instagram was not scraped (login-walled); copy and palette come from the brief.


---

# Build Log — Revision 3 (review pass: chrome, type, colour, motion)

**Date:** 2026-08-28
**Trigger:** review feedback across one session — remove chrome, shrink type, fix alignment,
drop the gradient word, kill a card shadow, fix a black hero, use GSAP.

## Asked and done

| Ask | Change |
|---|---|
| "how to add the image generation tool?" | Nothing to add. An `image-gen` MCP server was already installed (`node ~/.image-gen-mcp/server/index.js`; OpenAI gpt-image-2 + Gemini). `claude mcp list` reports it **Connected**. It was added at 23:01, after the session began ~22:17, and Claude Code loads MCP servers only at startup — hence invisible. Needs a session restart. Prompts for all 8 surfaces pre-written to `assets/textures/PROMPTS.md`. |
| Remove the top bar | Entire `<header>` deleted — wordmark, nav, counter chip, Explore button. Dead CSS (`.topbar`, `.brand*`, `.topnav`, `.counter*`, `pulse`, `.btn--ghost`) and the JS sticky-bar logic removed. Brand survives in the footer. |
| Remove "See The Collection" | Pill deleted; "See it on Instagram" kept (named specifically). `.btn--pill` retained for the Thank You CTA. |
| Hero headline too large | `FILL` factor added to the fitter: **95–100px → 70–74px** at 1440, still one line per slide. |
| Section heading too large | **73px → 49px**. |
| "alignment is not proper" | The body copy was stranded at the far right of a 2-column grid. Now one left column: eyebrow → title → copy, sharing the left edge (verified both at x=63), matching the hero. |
| Gradient word | `.word.italic` gradient / `background-clip:text` removed — solid inherited ink, italic only. It was near-illegible on the pale sections. |
| Card shadow (highlighted) | `box-shadow` removed from `.chip` and its hover state. |
| Hero image "not proper" | Slide 08 was a black void: charcoal at `brightness(.60)` plus the scrim. Exposure is now per material — charcoal `1.45`, louvers `1.30`, wood `.98`, pale materials `.64–.72`. |
| Plate/section seam | A tonal band showed where the ivory plate overhung the tinted section. Radials pushed down, plus a flat-ivory top band behind the overhang. |
| "animation is not smooth, use gsap" | GSAP 3.12.5 + ScrollTrigger via CDN, driving: hero furniture entrance, per-slide headline timeline, section headings, `[data-reveal]` blocks, tile + swatch reveals, scrubbed tile parallax, hero copy drift, scroll progress. |

## Why GSAP is actually smoother here
The old parallax called `getBoundingClientRect()` on all 8 tile media wrappers **every scroll
frame** — layout thrash, and the likeliest source of the reported jank. ScrollTrigger batches
and caches that. Marquee, stamp spin, ken-burns and the card progress bar stay on CSS
keyframes, which were already smooth.

## Bugs found in my own GSAP work
1. **`.tile__swatch` had a CSS `transition:transform`** fighting GSAP's per-frame inline
   writes — the value never settled. Disabled under `gsap-on`. Exactly the class of bug that
   produces the "not smooth" feel.
2. **One ScrollTrigger config object shared between the tile and swatch tweens.** The
   instance consumes it, so the second tween broke silently. Each tween now builds its own.
3. **`gsap.from()` + a dead ticker = permanently invisible content.** Added a watchdog: 1.8s
   after load, if `gsap.ticker.frame` hasn't advanced while the tab is *visible*, GSAP is
   reverted (`kill`, `clearProps`, drop `gsap-on`) and the CSS/IO path starts. A backgrounded
   tab is not judged, since rAF is throttled there by design.

## Verification
The Browser pane runs with `document.hidden = true` and delivers **0 rAF frames per 700ms**,
so GSAP's ticker cannot advance and no animation can be watched. Verified structurally:
- Forced all **78 tweens / 34 ScrollTriggers** to `progress(1)` — **nothing left stuck**:
  every opacity >= 0.95, no collapsed transforms. This caught bugs 1 and 2.
- **Fallback proven end-to-end** by pointing the CDN at an unreachable host: `gsap-on`
  absent, hero words driven by the `wordUp` CSS keyframe, slider unaffected. CDN restored.
- **Contrast re-measured after the exposure change** — title 9.93–13.55:1, body
  12.78–19.45:1 across all 8 slides. Charcoal at `1.45` still reads 13.55:1.
- Layout: 0 horizontal overflow, 0 same-origin 404s, CSS braces balanced, every class in the
  HTML has a rule, no dead selectors left behind.

## Still open
- **Imagery is still procedural SVG.** The `image-gen` server is installed and healthy but
  invisible to this session; restart required before real photography can be generated.
  `assets/textures/PROMPTS.md` holds the eight prompts, settings and post-swap checklist.
- Only `OPENAI_API_KEY` is configured on that server — Gemini models need `GEMINI_API_KEY`.
- With the top bar gone there is no navigation; scrolling and the Instagram link are the only
  affordances. That was the explicit request.


---

# Build Log — Revision 4 (static hero, plate alignment, image generation blocked)

**Date:** 2026-08-28

## Changes
- **Hero is now one fixed image, not a slider.** The 8 slides, 8 copy decks, the autoplay
  loop, the rail, the ticks and the per-card progress bars are all gone. One eyebrow, one
  one-line headline, one sub-line, one link. `.hero__bg { --hero-img }` is the single swap
  point; it points at `wooden.svg` as a placeholder until a real photo exists.
- **First card was being cropped** by the rotating stamp. The plate's left padding went to
  `clamp(80px,7.6vw,118px)` and the stamp now sits inside that gutter — verified at 1440 and
  1024 that the stamp's right edge falls short of the first card's left edge.
- **Notch is now an angled chamfer** (`clip-path` triangle), matching the reference's
  diagonal cut rather than the previous round concave fillet.
- **Added the note under the hero**, left of the plate, as in the reference. Its right
  padding is derived from `--shelf-w`, so it always clears the plate.
- The 8 cards are now anchors into the collection; the plate carries its own prev/next
  arrows that scroll the strip and disable at the ends.

## Bug found and fixed
**The plate hung 230px below the hero instead of 115.** `.hero-block` had grown to include
the new note, and the plate is positioned absolutely against that block — so its anchor moved
to the block's bottom rather than the hero's. Moved the note out of `.hero-block`. Also
raised `.hero-foot` min-height above `--shelf-drop`, since at 1440 the plate was landing
exactly flush against the collection section (0px clearance, now 40px).

Also restored a mobile rule (hide the stamp, chamfer and plate arrows) that had been lost
when the obsolete `.shelf__next` selector was purged.

## Image generation — blocked, twice
1. **OpenAI**: the key is valid and lists `gpt-image-2`, but every generation returns
   `HTTP 400 billing_hard_limit_reached`. The account will not accept billable calls.
2. **Gemini**: the user reported adding a key, but it is not reachable from this session —
   not in the image-gen server's `env` in `~/.claude.json`, not in `~/.claude/settings.json`,
   not in the Claude Desktop config, and not in the User or Machine environment. It was most
   likely entered in an extension settings UI that stores it elsewhere.

Either raise the OpenAI limit, or place the Gemini key somewhere readable — `setx
GEMINI_API_KEY "..."` is enough, since a stdio MCP server inherits the parent environment
and a direct REST call can read it without waiting for a session restart.

## Verification
Same constraint as before: `document.hidden = true`, 0 rAF frames, so tweens were forced to
`progress(1)` to check end states.
- **1440**: overhang 115px (matches `--shelf-drop`), plate flush right, rises 160px into the
  hero, clears the collection by 40px, stamp clear of card 1, note clears the plate by 196px,
  headline 74px on one row, nothing stuck.
- **1024**: overhang 82px, clears collection 37px, stamp clear, no note/plate overlap,
  headline 53px on one row.
- **375**: plate becomes a full-width tray (`position:relative`), stamp/chamfer/arrows
  hidden, 8 cards, strip scrollable, headline 34px, 0 horizontal overflow.
- GSAP 3.12.5 with 34 ScrollTriggers, 0 stuck elements, 0 same-origin 404s, CSS braces
  balanced (199/199), every HTML class has a rule, no dead selectors.


---

# Build Log — Revision 5 (headline text, type scale, dual-tone headings, marquee)

**Date:** 2026-08-28

## Changes
- **Headline text is now literally "Full Sheet View".** The phrase had been read as a layout
  instruction for several revisions; it was the copy. `FIT_MAX` dropped 96 -> 78px so three
  short words don't balloon to the ceiling.
- **Hero copy split top/bottom.** Eyebrow + headline at the top of the sheet; sub-line and
  Instagram link near the bottom, but lifted to 189px above the hero floor so they clear the
  plate's top edge by 29px (at 1440). `.hero__inner--bottom` also stops short of the plate
  horizontally via `--shelf-w`.
- **Rotating "SCROLL TO SEE" stamp removed**, and the plate's left gutter that existed only
  to hold it went with it — the first card now starts 19px from the plate edge instead of 118,
  so the cards fill the plate.
- **Collection heading on one line** — "Eight families. One material language." merged into a
  single masked line with `white-space:nowrap` above 900px (536px of slack at 1440, 377 at
  1024, 337 at 920). It wraps normally below 900px.
- **Dual colour + dual style on every heading**: roman in `--ink`, emphasis word italic in
  `--accent-ink` (#6c7f64 deep sage) on ivory, `--accent-dark` (#c8d6c1) on the hero. #6c7f64
  on ivory is ~3.8:1 — AA for large text, so this treatment stays on headings only.
- **Thank You reduced from 225px to 81px** at 1440 (`clamp(2.4rem,5.6vw,5.5rem)`).
- **Marquee rebuilt to loop continuously.** The `-50%` loop is seamless only when half the
  track is at least as wide as the frame; after the earlier font reduction one group no longer
  was, which showed as a gap. `buildMarquee()` now measures the group and clones it to
  `2 x ceil(frameWidth / groupWidth)`, then derives the duration from the distance so speed
  stays constant (~55 px/s). Verified seamless with 4 groups at 1440/1024 and 2 at 375.
- **Notch reverted from a hard triangle to a smooth concave fillet**, overlapping the plate by
  1px on each side so no hairline seam can appear.

## Verification
Entrance tweens forced to `progress(1)`, scrub tweens held at `progress(0)` — forcing scrub
tweens was itself producing a false failure earlier (it dragged the hero copy 110px down and
made the CTA look clipped).

| | 1440 | 1024 | 375 |
|---|---|---|---|
| hero / section / thanks px | 78 / 49 / 81 | 78 / 35 / 57 | 34 / 30 / 39 |
| heading rows | 1 / 1 / 1 | 1 / 1 / 1 | 1 / 2 / 1 |
| marquee seamless | yes (4 groups) | yes (4) | yes (2) |
| CTA above hero floor | 189px | 161px | n/a |
| horizontal overflow | 0 | 0 | 0 |

Nothing stuck at any width; 0 same-origin 404s; CSS braces balanced.

## Image generation — both providers require billing
| Provider | Result |
|---|---|
| OpenAI `gpt-image-2` | `HTTP 400 billing_hard_limit_reached` |
| Gemini (all 4 image models) | `HTTP 429 RESOURCE_EXHAUSTED`, and the quota detail is explicit: `generate_content_free_tier_requests, limit: 0` |

`limit: 0` is the important part — the Gemini **free tier grants no image-generation requests
at all**, so this is not a rate limit that resets and retrying cannot succeed. One of the two
accounts needs billing enabled:
- OpenAI: platform.openai.com -> Settings -> Billing -> raise the hard limit
- Gemini: enable billing on the Google Cloud project behind the key (paid tier)

The generation script is ready at `scratchpad/gen_images.py` (model fallback chain, aspect
ratio hints, writes straight into `assets/textures/`). The hero still shows `wooden.svg` as a
placeholder; the swap is one line, `--hero-img` in `style.css`.


---

# Build Log — Revision 6 (mobile and tablet)

**Date:** 2026-08-28

## The bug
`.hero__inner--bottom` and `.hero-foot` carry `padding-right: calc(var(--shelf-w) + 28px)` so
the desktop copy clears the plate that breaks the hero's bottom edge. Neither was reset for
narrow screens, and `--shelf-w` stays large relative to the viewport there:

| Width | padding-right | resulting copy column |
|---|---|---|
| 375px | 291px | **51px — sub-line over 16 lines** |
| 700px | 498px | **164px — sub-line over 6 lines** |

A mobile `.hero-foot` reset had existed earlier but was silently lost when the mobile `.hero`
rule was rewritten in revision 4, and `.hero__inner--bottom` never had one — it was created in
revision 5.

## Fixes
- **≤900px**: bottom copy stops sitting beside the plate and goes **above** it at full width —
  `padding-right` back to `--hpad`, and hero `padding-bottom` grows to `clamp(180px,25vh,260px)`
  so the copy clears the plate's rise into the hero.
- **≤680px**: same reset, plus the hero's dead vertical space cut (top padding 179px -> 89px,
  height 827px -> 617px), `max-width` caps dropped on the sub-line and note, the manual `<br>`
  in the note disabled, cards 132px -> 142px, and `.hero__link` padded to a 44px touch target.

## Verification
| | 375 | 430 | 320 | 700 | 768 | 900 | 1024 | 1440 |
|---|---|---|---|---|---|---|---|---|
| copy column px | 323 | 378 | 268 | 435 | 435 | 435 | 378 | 535 |
| sub-line rows | 3 | 3 | 3 | 2 | 2 | 2 | 3 | 2 |
| squeezed blocks | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| copy/plate overlap | n/a | n/a | n/a | none | none | none | none | none |
| horizontal overflow | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| tap targets < 44px | 0 | 0 | 0 | — | — | — | — | — |

Hero height 617px at 375 (was 827). Headline stays on one row at every width down to 320px.
Marquee seamless at all widths; nothing stuck; desktop layout unchanged (1440 still 535px copy
beside the plate, CTA 189px above the floor, plate rise 160px).

**Testing note:** the preview browser caches `style.css` across navigations, so CSS-only edits
appeared to do nothing. Every measurement above was taken after force-refetching the
stylesheet with a cache-busting query in-page. Worth remembering — it produced one false
"the fix did not work" reading.


---

# Build Log — Revision 7 (repo cleanup + a regression it uncovered)

**Date:** 2026-08-28

## Repo cleanup
The two "Add files via upload" commits had put the project in three places at once. Removed
**27 duplicated files** — 12 flattened copies at the repo root (`style.css`, `main.js`,
`launch.json`, `PROMPTS.md` and 8 loose `.svg`s) and the 15-file nested `asiatic surface/`
directory. The flattened root copy was broken anyway: its `index.html` asked for
`assets/css/style.css`, which did not exist at the root.

Verified before deleting that the live `index.html` references only `assets/…` paths, and that
every keep-list file was present. Both upload commits remain in history, so nothing is lost.

The repo is now exactly the 17 files of the project.

## Regression the cleanup uncovered
Checking the site after the deletions surfaced a bug that had nothing to do with them: **all
eight plate cards had no image.** `--tex` computed to empty, so
`background-image: var(--tex)` was `none`.

Cause: the eight `[data-tex="..."]` rules that define the material sources sat immediately
before `.slide{` in the stylesheet — inside the region wholesale-replaced during the
revision 4 static-hero rework. They went with it. After that rework I verified the hero
background (which has its own `--hero-img`) and the geometry, but never re-checked the cards,
so this shipped in both pushed commits.

Restored, and verified all eight map to the right file — `fabric -> fabric`,
`texture -> texture`, … `charcoal -> charcoal`, zero mismatches, zero 404s.

**Lesson recorded in `memory.md`:** after any large edit to `style.css`, assert that every
`.chip__media` reports a `textures/` background. A wholesale region replacement can drop rules
silently, and a missing custom property fails quietly rather than loudly.


---

# Build Log — Revision 8 (real hero photograph + mobile grid holes)

**Date:** 2026-08-28

## The hero is now a photograph
The user supplied the interior shot the prompt described — sage fabric panelling, fluted
charcoal, slate cabinetry, walnut, oak floor. 1672×941, exactly 16:9.

Delivered at **2.1 MB → 147 KB**:

| File | Size | Used |
|---|---|---|
| `hero-interior.webp` | 147 KB | desktop / tablet |
| `hero-interior-900.webp` | 38 KB | ≤680px (a phone only shows a ~360px crop) |
| `hero-interior.jpg` | 255 KB | layered beneath the WebP as a non-WebP fallback |

The 2.1 MB PNG master was converted with Pillow and removed — it would have been dead weight
in git and a genuine problem on mobile data.

## Contrast, measured honestly this time
Re-measured against the real photograph — and corrected a flaw in my own earlier method: the
body copy is `rgba(247,244,236,.70)`, not opaque white, and ignoring that alpha **overstated
every previous figure**. Where I had been reporting 10–13:1, the honest numbers are:

| zone | mean | worst pixel | needs | |
|---|---|---|---|---|
| eyebrow | 8.82 | 8.59 | 4.5 | PASS |
| title | 17.12 | 9.39 | 3.0 (large) | PASS |
| sub | 7.71 | 5.52 | 4.5 | PASS |
| cta | 7.92 | 5.23 | 4.5 | PASS |

At the original scrim the CTA's worst pixel was only **4.79:1** — the photo's bottom-left is a
pale sofa, directly under the sub-line and CTA. Strengthening the scrim's lower stops
(`.14→.18` at 58%, `.52→.62` at 100%) lifted it to 5.23:1 while keeping `--hero-b` at .82, so
the photograph stays bright.

Measured with `scratchpad/hero_contrast.py` (Pillow: cover-crop, the CSS filter chain in
order, both scrim gradients, then per-zone ratios against the composited text colour). The
browser-canvas version timed out repeatedly in a hidden pane — Python is the reliable route
for this.

## Mobile grid holes
The phone view had empty cells beside `Wooden` and `Louvers`. Cause: with 2 columns, a
full-width tile placed after an odd number of half tiles cannot fit the one remaining column,
so it moves to the next row and abandons the cell beside it. `fabric`, `charcoal` and `edge`
were all spanning 2.

Now only the **first and last** tiles span both columns, which pairs the middle six into three
clean rows. `grid-auto-flow: row dense` added as a guard.

Verified at 375 and 430: **5 rows, 0 holes** —
`fabric` / `wooden|charcoal` / `laminates|thermolam` / `louvers|edge` / `texture`.
Desktop bento unchanged (12-column asymmetric, 4 row bands).


---

# Build Log — Revision 9 (hero image on phones: one fetch, no filter stack)

**Date:** 2026-08-28

## Reported: "no image in hero section" on the phone
**Could not reproduce.** Tested the live deployment at 375px: `--hero-img` resolved to
`hero-interior-900.webp`, the file downloaded (39 KB), and the layer painted at 395×680 with
opacity 1 and the filter applied. The deployed `style.css` is byte-identical to local and all
three hero files return 200 at the right sizes. The most likely explanation is a stale CSS or
HTML cache on the device.

## But the test found a real bug
The fallback was written as a comma-separated layer list:
`background-image: var(--hero-img), url(...jpg)`. **A layer list downloads every image in
it** — so every phone visitor was pulling **294 KB** (39 KB webp + 255 KB jpeg) to show one
image, defeating the point of the mobile variant.

Replaced with two declarations, where the overridden one costs nothing:

```css
background-image:url("../textures/hero-interior.jpg");   /* pre-var() browsers */
background-image:var(--hero-img);                        /* everything current */
```

Verified: one hero image fetched at 1440 and at 375, jpeg no longer requested.

## Hardened the mobile path while there
Since the failure could not be reproduced, the mobile hero was simplified to remove the
device-specific ways it could fail. The exposure is now **baked into** the phone variant
(brightness .82, saturate .96, contrast 1.02 applied in Pillow), so mobile sets `--hero-b:1`
and drops `filter`, the `heroDrift` animation and `will-change` — a large filtered, animated,
composited layer is a known source of paint failures on mobile GPUs. `will-change:transform`
was removed everywhere.

Phone variant also got smaller: 39 KB -> **30 KB** (900×507).

| | fetches | weight | filter | animation |
|---|---|---|---|---|
| desktop | 1 (`hero-interior.webp`) | 147 KB | yes | drift |
| phone | 1 (`hero-interior-900.webp`) | 30 KB | none | none |
