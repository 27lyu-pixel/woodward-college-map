"""Cuts the "WA" shirt logo out of the mascot artwork into assets/eddy/wa.png.

    python3 tools/cut_wa_logo.py [mascot.png]

The logo sits on his black shirt, so black is keyed out to transparent. Needs Pillow.
"""
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "assets" / "eddy-hf" / "source" / "mascot.png"
BOX = (128, 222, 212, 308)       # logo area in the 368x543 mascot image
WING = (202 - BOX[0], 298 - BOX[1])  # his wing pokes into the bottom-right corner: drop it

im = Image.open(src).convert("RGBA").crop(BOX)
px = im.load()
for y in range(im.height):
    for x in range(im.width):
        r, g, b, _ = px[x, y]
        a = max(0, min(255, (max(r, g, b) - 45) * 255 // 55))
        if x >= WING[0] and y >= WING[1]:
            a = 0
        px[x, y] = (r, g, b, a)
im = im.crop(im.getbbox())
im = im.resize((im.width * 4, im.height * 4), Image.LANCZOS)
im.save(ROOT / "assets" / "eddy" / "wa.png")
print("wa.png", im.size, "aspect (h/w) =", round(im.height / im.width, 3))
