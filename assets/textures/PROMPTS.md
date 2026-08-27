# Image prompts — Asiatic Surfaces

**8 lifestyle images**, one per surface family: the material as the hero surface of a modern
interior. The hero image (`hero-interior.webp`) is done.

Save into this folder with these **exact filenames**, square **1:1**, 1024–2048px:
`fabric` · `texture` · `wooden` · `thermolam` · `edgebands` · `laminates` · `louvers` ·
`charcoal`

---

## Append this tail to every prompt

> Editorial interior photograph for a design magazine. Warm minimal Japandi styling, muted
> natural palette of sage green, ivory, powder blue and walnut. Soft diffused daylight from a
> large window, gentle natural shadows. Shot on a 35mm lens at f/4, photorealistic, sharp fine
> detail, true natural colour. Square 1:1 composition. The panelling is the subject and fills
> most of the frame; keep the lower part of the image simple and uncluttered. No text, no logos.

Two habits that make the set work: run all eight in **one session** so the model's style stays
consistent, and if one comes back off-palette, reroll it rather than keeping it — a single
foreign-looking image spoils a row of eight far more than a slightly plain one.

---

## 1 — fabric

> A serene modern bedroom corner. The entire wall behind the bed is upholstered in soft
> sage-green woven fabric panels, the fine textile weave catching the light. A low oak bed with
> crisp white linen, one sage cushion, a slim matte-black wall light. Morning sun from the left
> lays a soft diagonal of light across the fabric.

## 2 — texture

> A quiet modern entryway. The wall is finished in pale ivory limewash plaster with a soft
> hand-troweled texture and gentle tonal movement. A slim oak bench sits against it with a
> single ceramic vase holding one dried branch. Late afternoon light rakes across the wall and
> reveals the texture.

## 3 — wooden

> A sunlit modern living room. A full-height warm oak panelled wall with rich horizontal grain
> runs behind a low linen sofa. A round travertine coffee table, one stoneware bowl, a tall
> dried palm in a clay pot. Daylight glances along the wood, giving it a soft satin glow.

## 4 — thermolam

> A modern minimalist kitchen. Handleless matte powder-blue cabinet fronts fill the frame,
> seamless and softly satin, meeting a pale marble worktop. A single ceramic jug and a glass of
> water. Morning light from a window to the left, soft shadows, no glare.

## 5 — edgebands

> An elegant close-up of a modern wardrobe door in a bright bedroom, shot at a slight angle so
> the crisp vertical edge of the door runs diagonally through the frame. The slim trim on the
> door's edge matches the door face exactly — a seamless, near-invisible join. Soft window
> light, shallow depth of field, the bedroom softly blurred behind.

## 6 — laminates

> A modern kitchen island clad in pale icy-blue matte laminate, photographed close along its
> clean front edge with a fine darker line where the surface meets the edge. A slim stone
> worktop above, one ceramic cup and a folded linen cloth. Soft morning light with a gentle
> sheen travelling across the surface.

## 7 — louvers

> A modern living space divided by a floor-to-ceiling walnut slatted screen. Warm sunlight
> streams between the vertical slats and casts rhythmic shadow lines across a pale oak floor. A
> low bouclé lounge chair and a tall paper floor lamp sit beside it.

## 8 — charcoal

> A modern living room feature wall clad in deep charcoal fluted panelling, the tall vertical
> flutes catching a soft raking light so each rounded rib reads clearly. A slim floating console
> in dark oak below, one pale sculptural vase. Cool daylight from the right, quiet and moody.

---

## If a prompt misbehaves

| What you get | Add this |
|---|---|
| A flat swatch, no room | "wide shot, furniture visible in the foreground" |
| Room too wide, material unreadable | "extreme close-up, camera one metre from the wall" |
| Colours drift off-palette | "muted, desaturated, soft sage and ivory tones" |
| Looks like a CGI render | "photographed on film, real room, natural imperfections, subtle grain" |
| Too dark / too contrasty | "bright airy daylight, low contrast, soft even lighting" |
| Text or a watermark appears | reroll — keep "no text, no logos" in the tail |

## Why the previous prompts underperformed

Worth recording so the mistake isn't repeated. They were written like a materials
specification, not a photograph:

- **Trade vocabulary the models don't know** — "plain-weave interlacing", "slub yarn",
  "cathedral grain figure", "open pores", "kraft-paper core", "one arris of each slat",
  "thermofoil shaker profile". Image models don't map these to anything; they only dilute the
  words that do work.
- **Contradictory framing** — "editorial photograph of a real room" *and* "fills two thirds of
  the frame" *and* "shot square on" *and* "shallow depth of field" pull in four directions.
- **A long negation list** — six "no ..." clauses at the end weaken everything before them.
  One is enough.
- **No style anchor.** Nothing told the model what "good" looked like. "Editorial interior
  photograph for a design magazine, warm minimal Japandi" does more than three sentences of
  technical description.

## When the images arrive

1. Point the eight `[data-tex="..."]` rules in `assets/css/style.css` and the eight bento
   `<img src>` in `index.html` at the new extension.
2. **Convert first** — the way the hero went 2.1 MB → 147 KB. Eight raw PNGs would be several
   megabytes, and the cards and tiles load all eight at once.
3. **Re-check the tile captions.** Wooden, Charcoal and Louvers carry light type on a dark
   scrim; the other five carry dark type on a light scrim. A photo lighter or darker than the
   SVG it replaces may need its tile moved to the other group in `style.css`.
4. Keep the SVGs in git as a fallback — all eight together are only 52 KB.
