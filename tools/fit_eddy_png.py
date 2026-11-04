"""Fits generated Eddy PNGs (e.g. from Higgsfield) onto the sprite box used by the slideshow.

    python3 tools/fit_eddy_png.py <folder with fly-1.png fly-2.png fly-3.png perch.png>

Writes assets/eddy-hf/*.png: every frame on the same 600x500 canvas (same shape as the drawn
240x200 frames), so CONFIG.eddy sizes work for both art styles. Also:
- strips the soft glow/halo image models add around a "transparent" cutout,
- puts the perched pose's sneaker soles on the feet point, and
- puts the flying poses' body (the black shirt) where the drawn flying body is,
  so takeoffs and landings line up the same way as the drawn art.
Needs Pillow (pip3 install pillow).
"""
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "eddy-hf"
W, H = 600, 500
FEET = (0.492 * W, 0.86 * H)       # matches CONFIG.eddy.feet
FLY_BODY = (0.483 * W, 0.62 * H)   # drawn flying body center (a bit right of the feet)
PERCH_HEIGHT = 0.86 * H            # how tall the standing pose is on the canvas


def clean(im):
    """Hard-edge the alpha: drop the halo, keep the white sticker border."""
    r, g, b, a = im.convert("RGBA").split()
    a = a.point(lambda v: 0 if v < 150 else min(255, (v - 150) * 255 // 60))
    return Image.merge("RGBA", (r, g, b, a))


def centroid(im, test):
    """Center of the opaque pixels whose color passes `test`."""
    px = im.load()
    xs = ys = n = 0
    for y in range(0, im.height, 3):
        for x in range(0, im.width, 3):
            r, g, b, a = px[x, y]
            if a > 200 and test(r, g, b):
                xs += x; ys += y; n += 1
    return (xs / n, ys / n)


is_shirt = lambda r, g, b: r < 40 and g < 40 and b < 40
is_beak = lambda r, g, b: 110 < r < 190 and abs(r - g) < 14 and abs(g - b) < 14   # the grey beak


def place(im, scale, anchor_src, anchor_dst):
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    x = round(anchor_dst[0] - anchor_src[0] * scale)
    y = round(anchor_dst[1] - anchor_src[1] * scale)
    canvas.alpha_composite(im, (x, y)) if x >= 0 and y >= 0 else canvas.paste(im, (x, y), im)
    return canvas


def main(src):
    src = Path(src)
    OUT.mkdir(parents=True, exist_ok=True)
    perch = clean(Image.open(src / "perch.png"))
    x0, y0, x1, y1 = perch.getbbox()
    scale = PERCH_HEIGHT / (y1 - y0)
    place(perch, scale, ((x0 + x1) / 2, y1), FEET).save(OUT / "perch.png")   # soles on the feet point

    # Flying frames: fly-2's shirt sets the placement; every frame is lined up on its beak
    # (the wings cover the shirt differently per frame) so the head doesn't jitter.
    flys = {n: clean(Image.open(src / f"{n}.png")) for n in ("fly-1", "fly-2", "fly-3")}
    body = centroid(flys["fly-2"], is_shirt)
    beak = centroid(flys["fly-2"], is_beak)
    for n, im in flys.items():
        b = centroid(im, is_beak)
        anchor = (body[0] + b[0] - beak[0], body[1] + b[1] - beak[1])
        place(im, scale, anchor, FLY_BODY).save(OUT / f"{n}.png")
    print(f"scale {scale:.3f}; fly body at {body}; wrote {OUT}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
