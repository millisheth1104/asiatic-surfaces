# Generate the four category pages from assets/gallery/catalogue.json.
# Rerun after adding sheets: python gen_pages.py
import json, io, os

ROOT = r"C:\Users\Lenovo\OneDrive\Desktop\asiatic surface"
CAT = json.load(io.open(os.path.join(ROOT, "assets", "gallery", "catalogue.json"), encoding="utf-8"))

ORDER = ["45-degree", "digital", "stone", "wooden"]

COPY = {
    "45-degree": {
        "roman": "45 Degree", "italic": "sheets",
        "sub": "Brushed faces worked on the diagonal. The grain runs at forty-five degrees, "
               "so two sheets meeting at a corner mirror each other instead of fighting.",
        "alt": "brushed 45-degree laminate",
    },
    "digital": {
        "roman": "Digital", "italic": "sheets",
        "sub": "Digitally printed faces \u2014 repeats, weaves and figured artwork, printed "
               "sheet by sheet and finished to the same wear rating as the plains.",
        "alt": "digitally printed laminate",
    },
    "stone": {
        "roman": "Stone", "italic": "sheets",
        "sub": "Stone and figured faces with real depth in the veining, held matte and "
               "low-glare so the pattern reads rather than the shine.",
        "alt": "stone-finish laminate",
    },
    "wooden": {
        "roman": "Wooden", "italic": "sheets",
        "sub": "Woodgrains that run true down the full length of the sheet, from pale ash "
               "through to deep walnut.",
        "alt": "woodgrain laminate",
    },
}

ARROW_L = ('<svg viewBox="0 0 20 20" fill="none"><path d="M16 10H4M9 4.5 3.5 10 9 15.5" '
           'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>')
ZOOM = ('<svg viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="5.4" stroke="currentColor" stroke-width="1.5"/>'
        '<path d="M9 6.8v4.4M6.8 9h4.4M13 13l3.4 3.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>')
X = ('<svg viewBox="0 0 20 20" fill="none"><path d="m5.5 5.5 9 9m0-9-9 9" stroke="currentColor" '
     'stroke-width="1.6" stroke-linecap="round"/></svg>')
CHEV_L = ('<svg viewBox="0 0 20 20" fill="none"><path d="M12 4.5 6.5 10 12 15.5" stroke="currentColor" '
          'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>')
CHEV_R = ('<svg viewBox="0 0 20 20" fill="none"><path d="M8 4.5 13.5 10 8 15.5" stroke="currentColor" '
          'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>')


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;"))


def nav(current):
    out = []
    for s in ORDER:
        cls = ' class="is-current"' if s == current else ""
        aria = ' aria-current="page"' if s == current else ""
        out.append('      <a href="%s.html"%s%s>%s</a>' % (s, cls, aria, esc(CAT[s]["label"])))
    return "\n".join(out)


def page(slug):
    c = COPY[slug]
    items = CAT[slug]["items"]
    label = CAT[slug]["label"]

    figs = []
    for it in items:
        cap_name = ('<span>%s</span>' % esc(it["name"])) if it["name"] else ""
        alt = "Full sheet view of %s %s \u2014 %s" % (label, it["code"], c["alt"])
        figs.append(
            '    <figure class="sheet" style="--ar:%.4f">\n'
            '      <button class="sheet__hit" type="button" data-full="%s" data-code="%s" data-name="%s" data-alt="%s"\n'
            '              aria-label="View %s %s at full size">\n'
            '        <img src="%s" alt="%s" width="%d" height="%d" loading="lazy" decoding="async">\n'
            '        <span class="sheet__zoom" aria-hidden="true">%s</span>\n'
            '      </button>\n'
            '      <figcaption class="sheet__cap"><b>%s</b>%s</figcaption>\n'
            '    </figure>'
            % (it["ar"], it["full"], esc(it["code"]), esc(it["name"]), esc(alt),
               esc(label), esc(it["code"]),
               it["grid"], esc(alt), it["w"], it["h"], ZOOM,
               esc(it["code"]), cap_name)
        )

    return """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>%(label)s \u2014 Full Sheet View</title>
<meta name="description" content="%(count)d %(lower)s sheets, each shown as a full sheet. %(subplain)s">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Asar&family=Palanquin:wght@200;300;400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/style.css">
<link rel="stylesheet" href="assets/css/gallery.css">
</head>
<body class="page-gallery">

<div class="scroll-progress" aria-hidden="true"><span id="scrollBar"></span></div>

<header class="gnav">
  <a class="gnav__home" href="index.html">%(arrow)s<span>Full Sheet View</span></a>
  <nav class="gnav__cats" aria-label="Surface categories">
%(nav)s
  </nav>
</header>

<main class="gpage">

  <header class="ghead">
    <p class="eyebrow"><span class="eyebrow__rule"></span>The Collection</p>
    <h1 class="ghead__title">%(roman)s <span class="italic">%(italic)s</span></h1>
    <p class="ghead__sub">%(sub)s</p>
  </header>

  <div class="masonry" id="masonry">
%(figs)s
  </div>

</main>

<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="Full sheet view" aria-hidden="true">
  <div class="lb__bar">
    <p class="lb__code"></p>
    <span class="lb__count"></span>
    <button class="lb__x" type="button" aria-label="Close">%(x)s</button>
  </div>
  <div class="lb__stage">
    <button class="lb__nav lb__nav--prev" type="button" aria-label="Previous sheet">%(chevl)s</button>
    <img alt="">
    <button class="lb__nav lb__nav--next" type="button" aria-label="Next sheet">%(chevr)s</button>
  </div>
  <p class="lb__foot">%(label)s \u00b7 Full Sheet View</p>
</div>

<footer class="gfoot">
  <span>Full Sheet View</span>
  <span class="gfoot__mid">%(footnav)s</span>
  <span>\u00a9 <span id="yr">2026</span></span>
</footer>

<script src="assets/js/gallery.js" defer></script>
</body>
</html>
""" % {
        "label": esc(label),
        "lower": label.lower(),
        "count": len(items),
        "sub": c["sub"],
        "subplain": c["sub"].replace('"', "'"),
        "roman": esc(c["roman"]),
        "italic": esc(c["italic"]),
        "arrow": ARROW_L,
        "nav": nav(slug),
        "figs": "\n".join(figs),
        "x": X, "chevl": CHEV_L, "chevr": CHEV_R,
        "footnav": " ".join('<a href="%s.html">%s</a>' % (s, esc(CAT[s]["label"])) for s in ORDER),
    }


for slug in ORDER:
    p = os.path.join(ROOT, slug + ".html")
    io.open(p, "w", encoding="utf-8", newline="\n").write(page(slug))
    print("wrote %-18s %2d sheets" % (slug + ".html", len(CAT[slug]["items"])))
