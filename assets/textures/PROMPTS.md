# Images to generate — Asiatic Surfaces

**8 lifestyle images**, one per surface family: each material shown **applied in a real
interior**, not as a flat swatch. The hero (`hero-interior.webp`) is already done.

Save into this folder (`assets/textures/`) with the **exact filenames** below. PNG or JPG
both fine — tell me which and I'll wire the extension.

| # | Filename | Aspect | Size | Setting it's shown in |
|---|---|---|---|---|
| 1 | `fabric` | 1:1 | 1024–2048 | bedroom wall behind a bed |
| 2 | `texture` | 1:1 | 1024–2048 | hallway wall with a bench |
| 3 | `wooden` | 1:1 | 1024–2048 | living-room wall with a sideboard |
| 4 | `thermolam` | 1:1 | 1024–2048 | kitchen cabinetry |
| 5 | `edgebands` | 1:1 | 1024–2048 | wardrobe door corner, matched edge |
| 6 | `laminates` | 1:1 | 1024–2048 | kitchen island, core edge visible |
| 7 | `louvers` | 1:1 | 1024–2048 | living-space partition |
| 8 | `charcoal` | 1:1 | 1024–2048 | media wall with a console |

Square, because each is cropped into both wide and tall tiles — a square survives both.

---

## Three rules that matter more than the wording

**1. The material must fill at least two thirds of the frame.** These render as cards about
150–200px wide and as bento tiles. A wide shot of a whole room becomes unreadable mush at that
size — you won't be able to tell fabric from plaster. Tight interior vignette, not a room tour.

**2. Keep the bottom third quiet.** The family name and its one-line description sit over the
bottom of every card and tile, on a dark scrim. Busy detail there fights the text. Props
should be low-contrast, cropped, and off to one side.

**3. One light direction across all eight.** Soft daylight from the upper left (charcoal is
the one exception — upper right, to match how it reads best). Eight images that disagree about
where the sun is will never look like one collection, however good each one is.

## Shared suffix — append to every one of the eight

> Editorial interior photography of a real room. Natural true colour, no colour cast. Soft
> directional daylight, shallow depth of field with the surface itself in sharp focus. The
> material fills at least two thirds of the frame and is clearly the subject; any props are
> minimal, low-contrast and cropped at the edges. Keep the lower third of the frame visually
> quiet. Square 1:1 crop, shot square on. No people, no text, no lettering, no logos, no
> watermarks.

Palette to hold the family together: Soft Sage `#b9c8b3`, Powder Blue `#b8d5de`, Light Blue
`#d2e8ff`, Warm Ivory `#F5F0E8`, plus walnut brown and graphite charcoal.

---

## 1 — fabric

> A quiet corner of a contemporary bedroom where the wall behind the bed is clad in soft muted
> sage-green woven acoustic fabric panels. The panelled wall fills most of the frame, its
> plain-weave interlacing and slightly irregular slub yarn clearly visible. The top corner of
> an upholstered bed, one linen pillow and a slim brass reading light enter from the lower
> left. Morning daylight rakes across the weave from the upper left, catching a faint matte
> halo of loose fibres.

## 2 — texture

> A section of hallway wall finished in pale sage-ivory matte micro-relief plaster, filling
> most of the frame, its broad trowel movement and fine sandy tooth raked by low afternoon
> daylight from the upper left. A slim oak bench and a single pale ceramic vase sit low in the
> frame. Almost no sheen — the surface reads as mineral and hand-finished.

## 3 — wooden

> A living-room wall clad in warm mid-brown oak woodgrain panels with the grain running
> horizontally, filling most of the frame, cathedral grain figure and open pores clearly
> readable. A low walnut sideboard and a single stoneware bowl sit along the bottom edge, the
> corner of a linen armchair cropped at the left. Daylight from the upper left gives the wood
> a low satin sheen, no gloss.

## 4 — thermolam

> A run of contemporary kitchen cabinetry in seamless satin powder-blue thermofoil, shaker
> profile — routed rectangular frames with recessed centre panels, every edge wrapped in one
> continuous skin. The doors fill most of the frame. A pale stone worktop crosses the lower
> third with a single ceramic jug. Soft daylight from the upper left so the routed bevel reads
> clearly; satin and fingerprint-matte, no reflections.

## 5 — edgebands

> A tight detail of a fitted wardrobe corner in a bedroom, the door held at a slight angle so
> its edge runs diagonally through the frame and shows a perfectly colour-matched slim edge
> band against the door face — the join almost invisible. The door fills most of the frame. Out
> of focus behind it, a low stack of banding coils in muted sage green, walnut brown, powder
> blue and charcoal. Soft daylight from the upper left.

## 6 — laminates

> A contemporary kitchen island clad in pale icy-blue high-pressure laminate, photographed
> close along its front edge so the layered kraft-paper core reads as a fine dark line beneath
> the pale decor face. The laminate surface fills most of the frame with one long specular
> gloss streak across it. A single ceramic cup and a folded tea towel sit at the far edge,
> cropped. Daylight from the upper left.

## 7 — louvers

> A living-space partition of vertical walnut louver slats, seen slightly from the left so the
> slats recede across the frame and fill it. Warm daylight rakes between them from the upper
> left, lighting one rounded arris of each slat and dropping the recesses between them into
> deep shadow — a strong rhythm of light and shadow. A low lounge chair and the edge of a
> textured rug enter at the lower left, in shadow.

## 8 — charcoal

> A media wall clad in deep graphite grey-black fluted bamboo-charcoal panelling, tall
> half-round flutes with narrow V grooves filling most of the frame. Cool daylight from the
> **upper right** shades each flute so its rounded profile reads clearly. Matte, low sheen,
> almost no reflection. A slim dark console and a single stoneware vase sit low in the frame,
> with a soft shadow across the floor.

---

## What happens when they land

1. Point the eight `[data-tex="..."]` rules in `assets/css/style.css` and the eight bento
   `<img src>` in `index.html` at the new extension.
2. **Convert first.** Anything over ~250 KB gets converted to WebP the way the hero was
   (2.1 MB → 147 KB) — the cards and tiles load eight of these at once, so raw PNGs would be
   several megabytes on a phone.
3. **Re-check the bento captions.** Tiles with a dark scrim (Wooden, Charcoal, Louvers) carry
   light type; the other five carry dark type on a light scrim. A lifestyle photo that is
   darker or lighter than the SVG it replaces may need its tile flipped to the other scrim —
   the rule is in `style.css` under the `.tile--wooden, .tile--charcoal, .tile--louvers` group.
4. Keep the SVGs in git as a fallback — all eight together are only 52 KB.

## Why these weren't generated here

Both configured providers refuse billable calls:
- **OpenAI** `gpt-image-2` — `HTTP 400 billing_hard_limit_reached`
- **Gemini**, all four image models — `HTTP 429`, quota detail
  `generate_content_free_tier_requests, limit: 0` (the free tier includes **no** image
  generation, so retrying cannot succeed)

`scratchpad/gen_images.py` is ready to run whenever one of those accounts has billing.
