# Convert the four supplied sheet folders into web assets + a catalogue manifest.
# Source folders stay out of git; only assets/gallery/** is committed.
import os, re, json, io
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = r"C:\Users\Lenovo\OneDrive\Desktop\asiatic surface"
OUT = os.path.join(ROOT, "assets", "gallery")

CATS = [
    ("45-degree", "45 Degree", "45 Degree"),
    ("digital",   "DIGITAL-20260905T130641Z-1-001", "Digital"),
    ("stone",     "Stone", "Stone"),
    ("wooden",    "WOODEN1", "Wooden"),
]

# Nothing is skipped. ZO 95401 - Silver Oak is byte-identical in Stone/ and in
# DIGITAL/New folder/, and it is published under both, because the folders are
# the source of truth: what is in a folder goes on that folder's page.
SKIP = set()

GRID_W, GRID_W_WIDE, GRID_Q = 520, 800, 75
FULL_EDGE, FULL_Q = 2000, 80

# --- the masonry rhythm ---------------------------------------------------
# 39 of the 46 sheets are the same 1:2 shape, so an honest aspect-preserving
# grid comes out as a plain lattice of identical tiles. The preview tile is
# therefore cropped to a repeating set of heights; the lightbox still opens
# the whole uncropped sheet. Values are width/height, so a larger number is a
# shorter tile. A tile is only ever cropped SHORTER than its source, never
# stretched, so anything below a sheet's own ratio is skipped.
RHYTHM = [0.50, 0.74, 0.58, 1.00, 0.64, 0.50, 0.86, 0.56, 0.70, 0.50, 0.92, 0.62]
# A source already wider than this keeps its own shape: the eight NMD
# composites are landscape and carry their code printed in the artwork, which
# a crop would cut off. In a column masonry they simply make short tiles.
WIDE_AT = 1.2


def display_ratio(src_ar, cursor):
    """Pick this tile's display ratio and column span.

    `cursor` walks the rhythm and is returned advanced, rather than being
    indexed by position. Indexing by position looked fine on paper and put
    four squares in a row on the 45 Degree page: three mockups at 0.80 all
    skipped the same three too-tall values and landed on the same 1.00.
    """
    if src_ar >= WIDE_AT:
        return src_ar, 2, cursor
    n = len(RHYTHM)
    for k in range(n):
        r = RHYTHM[(cursor + k) % n]
        if r >= src_ar - 0.004:
            return r, 1, (cursor + k + 1) % n
    return src_ar, 1, (cursor + 1) % n


def crop_to(im, ar):
    """Centre-crop to `ar` (width/height). Only ever removes height or width."""
    w, h = im.size
    if abs(w / h - ar) < 0.005:
        return im
    if w / h < ar:                      # too tall -> trim top and bottom
        nh = int(round(w / ar))
        top = (h - nh) // 2
        return im.crop((0, top, w, top + nh))
    nw = int(round(h * ar))             # too wide -> trim the sides
    left = (w - nw) // 2
    return im.crop((left, 0, left + nw, h))


def parse_name(stem):
    s = re.sub(r"[_\-]+", " ", stem)
    s = re.sub(r"\bmockup\b", "", s, flags=re.I)
    s = re.sub(r"\s+", " ", s).strip(" -")
    m = re.match(r"^([A-Za-z]{2,4}\s*\d+)\s*(.*)$", s)
    if m:
        return m.group(1).upper(), m.group(2).strip()
    m = re.match(r"^(\d+)\s+(\d+)$", s)
    if m:
        return "%s / %s" % (m.group(1), m.group(2)), ""
    m = re.match(r"^(\d+)\s*(.*)$", s)
    if m:
        return m.group(1), m.group(2).strip()
    return s, ""


def slugify(s):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower())).strip("-")


def load_flat(path):
    im = Image.open(path)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        return bg
    return im.convert("RGB")


def trim_flat_border(im):
    """Strip a uniform mat around a sheet scan.

    Six of the supplied files are mockups on a white card and one sits on flat
    grey, so their sheets floated inside an 18% margin while the rest ran
    edge to edge — side by side in the grid the margins read as a mistake.
    A row/column counts as mat only if it is one flat colour (std < 1.5), and
    the trim is abandoned unless it keeps at least 40% of the area, so a pale
    sheet with genuinely even tone is never eaten.
    """
    import numpy as np
    a = np.asarray(im.convert("RGB")).astype(np.int16)
    h, w, _ = a.shape

    def flatline(line):
        return line.std() < 1.5

    top = 0
    while top < h - 1 and flatline(a[top]):
        top += 1
    bot = h - 1
    while bot > top and flatline(a[bot]):
        bot -= 1
    left = 0
    while left < w - 1 and flatline(a[:, left]):
        left += 1
    right = w - 1
    while right > left and flatline(a[:, right]):
        right -= 1

    nw, nh = right - left + 1, bot - top + 1
    if nw * nh < 0.40 * w * h or (nw == w and nh == h):
        return im, False
    return im.crop((left, top, right + 1, bot + 1)), True


catalogue = {}
total_grid = total_full = 0

for slug, folder, label in CATS:
    src = os.path.join(ROOT, folder)
    dest = os.path.join(OUT, slug)
    os.makedirs(dest, exist_ok=True)
    files = []
    for dp, dn, fn in os.walk(src):
        for f in fn:
            if os.path.splitext(f)[1].lower() in (".jpg", ".jpeg", ".png", ".webp"):
                files.append(os.path.join(dp, f))
    files.sort(key=lambda p: os.path.basename(p).lower())

    items = []
    cursor = 0
    for p in files:
        stem = os.path.splitext(os.path.basename(p))[0]
        if (slug, stem) in SKIP:
            print("skip duplicate:", slug, stem)
            continue
        code, name = parse_name(stem)
        fslug = slugify(stem)
        im = load_flat(p)
        # Seven files are sheets floating in a flat white or grey mat. The mat is
        # part of the file, not of the sheet, and in a gallery it reads as a hole
        # in the layout — so it comes off both the tile and the lightbox image.
        # Nothing else is cropped away: no sheet is skipped and no sheet loses any
        # of its own face.
        im, trimmed = trim_flat_border(im)
        w, h = im.size
        ar, span, cursor = display_ratio(w / h, cursor)

        g = crop_to(im.copy(), ar)
        target = GRID_W_WIDE if span == 2 else GRID_W
        if g.size[0] > target:
            g = g.resize((target, max(1, int(round(target / ar)))), Image.LANCZOS)
        gp = os.path.join(dest, fslug + ".webp")
        g.save(gp, "WEBP", quality=GRID_Q, method=6)

        f = im.copy()
        f.thumbnail((FULL_EDGE, FULL_EDGE), Image.LANCZOS)
        fp = os.path.join(dest, fslug + "-full.webp")
        f.save(fp, "WEBP", quality=FULL_Q, method=4)

        gs, fs = os.path.getsize(gp), os.path.getsize(fp)
        total_grid += gs
        total_full += fs
        items.append({
            "code": code, "name": name, "slug": fslug,
            "w": g.size[0], "h": g.size[1], "ar": round(g.size[0] / g.size[1], 4),
            "span": span, "src_w": w, "src_h": h, "src_ar": round(w / h, 4),
            "grid": "assets/gallery/%s/%s.webp" % (slug, fslug),
            "full": "assets/gallery/%s/%s-full.webp" % (slug, fslug),
            "grid_kb": round(gs / 1024), "full_kb": round(fs / 1024),
        })
        print("%-10s %-26s tile %4dx%-4d ar %.2f  grid %4dKB  full %5dKB%s" %
              (slug, code + (" " + name if name else ""), g.size[0], g.size[1], ar,
               gs / 1024, fs / 1024, "  mat trimmed" if trimmed else ""))

    catalogue[slug] = {"label": label, "items": items}

with io.open(os.path.join(OUT, "catalogue.json"), "w", encoding="utf-8") as fh:
    json.dump(catalogue, fh, indent=1, ensure_ascii=False)

print("\ntotals: grid %.2f MB across %d sheets, full %.2f MB" %
      (total_grid / 1e6, sum(len(v["items"]) for v in catalogue.values()), total_full / 1e6))
for k, v in catalogue.items():
    print("  %-10s %2d sheets, %4.0f KB of grid images" % (k, len(v["items"]), sum(i["grid_kb"] for i in v["items"])))
