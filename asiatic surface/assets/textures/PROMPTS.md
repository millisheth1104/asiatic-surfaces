# Images to generate — Asiatic Surfaces

**9 images: 1 hero + 8 product surfaces.**
Save them into this folder (`assets/textures/`) with the **exact filenames** below. PNG or
JPG both fine — tell me which and I'll wire the extension.

| # | Filename | Aspect | Suggested size | Used for |
|---|---|---|---|---|
| 1 | `hero-interior` | **16:9 landscape** | 2048×1152 or larger | the whole hero background |
| 2 | `fabric` | 1:1 square | 1024–2048 | bento tile + plate card |
| 3 | `texture` | 1:1 | 1024–2048 | bento tile + plate card |
| 4 | `wooden` | 1:1 | 1024–2048 | bento tile + plate card |
| 5 | `thermolam` | 1:1 | 1024–2048 | bento tile + plate card |
| 6 | `edgebands` | 1:1 | 1024–2048 | bento tile + plate card |
| 7 | `laminates` | 1:1 | 1024–2048 | bento tile + plate card |
| 8 | `louvers` | 1:1 | 1024–2048 | bento tile + plate card |
| 9 | `charcoal` | 1:1 | 1024–2048 | bento tile + plate card |

Square for the eight because each one is cropped into both wide and tall tiles — a square
survives both crops. The hero is cropped to roughly 1.6:1, so 16:9 is right.

---

## 1 — hero-interior  (16:9)

> Wide architectural interior photograph of a calm contemporary living space in a private
> house, where the walls and joinery are finished entirely in large decorative laminate
> panels. On the right, a full-height wall of warm walnut woodgrain laminate with visible
> horizontal grain. On the left, a soft sage-green woven-texture panelled wall. Between them a
> section of tall fluted charcoal panelling. Built-in cabinetry with seamless satin
> powder-blue doors and slim matched edge banding. Warm ivory plaster ceiling, pale oak floor.
> Late afternoon daylight enters from the right through a tall window and rakes across the
> panels so the grain, the weave and the flutes all read clearly, while the left third of the
> frame falls into soft shadow. Editorial interior photography, natural true colour, no colour
> cast, 35mm lens at eye level. Minimal styling: one low sofa, a side table, no clutter, no
> people. No text, no lettering, no logos, no watermarks.

**Two things matter for the hero specifically:** the **left third should stay quiet and
mid-to-dark** (the headline sits there in white), and it should not be a bright, high-key
shot. If what comes back is bright, send it anyway — I adjust exposure in CSS and re-measure
the text contrast.

---

## The eight surfaces

Append this to **every one** of the eight prompts:

> Editorial architectural material photography. Soft directional daylight raking across the
> surface from the upper left with a gentle falloff into shadow at the lower right. Fine
> grain, true colour, no colour cast. Fills the whole frame, shot square on. No text, no
> lettering, no logos, no watermarks, no people, no props, no borders.

### 2 — fabric
> A close, square-on view of a woven upholstery-grade textile wall panel in a soft muted sage
> green. Visible plain-weave interlacing, slightly irregular slub yarn, a faint matte halo of
> loose fibres catching the light. Warm, matte, acoustic-looking.

### 3 — texture
> A close view of a fine matte micro-relief surface panel in pale sage-ivory, like polished
> lime plaster or a fine mineral finish. Broad trowel movement visible under raking light, a
> fine sandy tooth over it. Almost no sheen.

### 4 — wooden
> A close view of an oak veneer panel in warm mid-brown, grain running horizontally across the
> frame. Cathedral grain figure, open pores, one soft knot off-centre, a low satin sheen.
> Natural, dimensionally flat, no gloss.

### 5 — thermolam
> A square-on view of a single thermofoil cabinet door in soft powder blue, shaker profile: a
> routed rectangular frame with a recessed centre panel, edges wrapped seamlessly in one
> continuous skin. Satin, fingerprint-matte, softly lit so the bevel reads clearly.

### 6 — edgebands
> Several coils of PVC furniture edge banding tape relaxing across a warm ivory surface, laid
> in loose parallel curves. Each strip shows its thickness on the cut edge and a soft sheen
> down its length. Colours: muted sage green, walnut brown, powder blue, charcoal, pale icy
> blue. Soft shadows beneath each coil.

### 7 — laminates
> A stack of two high-pressure laminate sheets in pale icy blue, the top sheet lifted just
> clear of the one beneath so its cut edge shows the layered kraft-paper core: dark brown
> layers under the pale decor face. One long specular gloss streak across the top sheet.

### 8 — louvers
> A wall of vertical wooden louver slats in warm walnut, seen slightly from the left so the
> slats recede. Each slat rounded, lit along one arris and falling into shadow on the other,
> with deep dark recesses between them and the lit top edges visible. Strong rhythm of light
> and shadow.

### 9 — charcoal
> A fluted bamboo-charcoal wall panel in deep graphite grey-black. Tall half-round flutes with
> narrow V grooves between them, each flute softly shaded so the profile reads as rounded.
> Matte, low sheen, almost no reflection. Cool daylight from the upper right.

---

## Palette to keep them a family

Soft Sage `#b9c8b3` · Powder Blue `#b8d5de` · Light Blue `#d2e8ff` · Warm Ivory `#F5F0E8`,
plus walnut brown and graphite charcoal. If a generator drifts off-palette on one of them,
that single image will look foreign next to the other seven — worth a reroll.

## What happens when they land

1. Point the 8 `[data-tex="..."]` rules in `assets/css/style.css` and the 8 bento `<img src>`
   in `index.html` at the new extension.
2. Point `.hero__bg { --hero-img }` at `hero-interior`.
3. **Re-measure hero contrast** and retune `--hero-b` — the current scrim was tuned against
   the SVG placeholders, and photographs are usually brighter. Method is in `memory.md`.
4. Keep the SVGs in place as a fallback — all eight together are only 52 KB.

## Why these weren't generated here

Both configured providers refuse billable calls:
- **OpenAI** `gpt-image-2` — `HTTP 400 billing_hard_limit_reached`
- **Gemini**, all four image models — `HTTP 429`, quota detail
  `generate_content_free_tier_requests, limit: 0`, i.e. the free tier includes **no** image
  generation, so retrying cannot succeed.

A ready-to-run script is at `scratchpad/gen_images.py` (model fallback chain, aspect-ratio
hints, writes straight into this folder) for whenever one of those accounts has billing.
