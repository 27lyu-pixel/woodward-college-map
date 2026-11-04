"""Draws the cartoon Eddy sprite frames into assets/eddy/.

    python3 tools/draw_eddy.py

Every frame is a 240x200 box facing right, feet at (118, 172). The "WA" on his shirt is a
separate image (assets/eddy/wa.svg) placed by js/eddy.js so it never reads backwards when
he flies west; its spot on each pose is CONFIG.eddy.badge in js/config.js.
"""
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "assets" / "eddy"

INK = "#1b1416"         # outline
RED = "#d21f3c"         # feathers
RED_DARK = "#a3172f"    # far wing, shading
RED_DEEP = "#8a1228"    # eye patch, curls
SHIRT = "#151515"
BEAK = "#8d9197"
BEAK_DARK = "#6b6f75"
MOUTH = "#5a0f1c"
TONGUE = "#f28b9b"
LEG = "#9a9ca1"
WHITE = "#ffffff"


def layer(shapes, width=6):
    """Shapes as (svg_tag_body, fill). Drawn outline-first so overlapping shapes merge
    into one silhouette with a single outline."""
    outline = "".join(f'<{s} fill="{INK}" stroke="{INK}" stroke-width="{width}" stroke-linejoin="round"/>'
                      for s, _ in shapes)
    fill = "".join(f'<{s} fill="{f}"/>' for s, f in shapes)
    return outline + fill


def g(transform, body):
    return f'<g transform="{transform}">{body}</g>'


def head():
    """Head centered on (0,0), facing right, turned three-quarters toward the viewer."""
    crest = [
        ('circle cx="-20" cy="-26" r="13"', RED), ('circle cx="-5" cy="-34" r="13"', RED),
        ('circle cx="11" cy="-31" r="11"', RED), ('circle cx="-30" cy="-10" r="12"', RED),
        ('circle cx="-31" cy="8" r="10"', RED), ('circle cx="-24" cy="-40" r="8"', RED),
        ('circle cx="5" cy="-45" r="7"', RED), ('circle cx="-38" cy="-24" r="7"', RED),
        ('ellipse cx="0" cy="0" rx="30" ry="28"', RED),
        ('circle cx="-12" cy="20" r="13"', RED),
    ]
    curls = "".join(f'<path d="{d}" fill="none" stroke="{RED_DEEP}" stroke-width="2.5" stroke-linecap="round"/>'
                    for d in ["M-27,-31 q6,-9 13,-2", "M-11,-39 q7,-7 13,1", "M-37,-7 q2,-9 11,-6",
                              "M3,-37 q6,-5 10,2", "M-36,10 q0,-7 7,-7", "M-30,-44 q4,-5 9,-1"])
    eyes = (
        f'<ellipse cx="18" cy="-9" rx="22" ry="16" fill="{RED_DEEP}"/>'
        f'<path d="M-2,-24 q10,-8 20,-1" fill="none" stroke="{INK}" stroke-width="3" stroke-linecap="round"/>'
        f'<path d="M22,-24 q7,-5 13,0" fill="none" stroke="{INK}" stroke-width="3" stroke-linecap="round"/>'
        f'<ellipse cx="9" cy="-8" rx="10" ry="13" fill="{WHITE}" stroke="{INK}" stroke-width="2.5"/>'
        f'<ellipse cx="28" cy="-9" rx="7.5" ry="11.5" fill="{WHITE}" stroke="{INK}" stroke-width="2.5"/>'
        f'<circle cx="12.5" cy="-6" r="5.5" fill="{INK}"/><circle cx="30" cy="-7" r="4.3" fill="{INK}"/>'
        f'<circle cx="11" cy="-8.5" r="1.9" fill="{WHITE}"/><circle cx="29" cy="-9" r="1.4" fill="{WHITE}"/>'
    )
    beak = (
        f'<path d="M17,8 C28,10 42,13 50,20 C46,32 30,37 21,28 Z" fill="{MOUTH}" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>'
        f'<path d="M23,22 C31,22 40,24 45,27 C41,34 29,35 24,29 Z" fill="{TONGUE}"/>'
        f'<path d="M20,27 C27,36 41,36 48,24 L51,22 C49,35 40,42 30,41 C23,40 19,34 20,27 Z" fill="{BEAK_DARK}" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>'
        f'<path d="M14,2 C24,-8 46,-8 56,4 C62,12 60,22 53,27 C53,20 50,15 43,14 C34,13 24,13 16,11 Z" fill="{BEAK}" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>'
        f'<path d="M26,0 C34,-3 44,-2 50,4" fill="none" stroke="{WHITE}" stroke-opacity=".45" stroke-width="2.5" stroke-linecap="round"/>'
    )
    return layer(crest) + curls + eyes + beak


def sneaker():
    """High-top sneaker, toe pointing right, sole bottom at y=14."""
    shoe = layer([
        ('path d="M-12,-16 L4,-16 L6,-4 C15,-3 24,0 26,7 L26,9 L-13,9 Z"', RED),
        ('rect x="-15" y="6" width="43" height="8" rx="4"', WHITE),
    ], width=5)
    trim = (
        f'<path d="M16,-1 C22,1 25,4 26,8" fill="none" stroke="{WHITE}" stroke-width="3"/>'
        f'<path d="M0,-11 l7,3 M1,-6 l7,3" stroke="{WHITE}" stroke-width="2.2" stroke-linecap="round"/>'
        f'<path d="M-13,10 h40" stroke="{INK}" stroke-width="1.5"/>'
    )
    return shoe + trim


def wing(color):
    """Wing pointing up from the shoulder at (0,0); fingered feather tips at the top."""
    return layer([(
        'path d="M-9,6 C-15,-28 -20,-58 -12,-86 L-4,-76 L0,-92 L8,-78 L15,-90 L19,-74 L28,-80 '
        'C25,-50 21,-22 11,6 Z"', color)])


def fly_frame(angle, scale):
    """Flying pose; only the wings change between frames."""
    body = (
        layer([('path d="M-34,-6 L-64,-16 L-58,-5 L-70,2 L-58,8 L-65,17 L-34,10 Z"', RED)])
        + f'<path d="M-24,10 L-48,14 M-14,16 L-40,26" stroke="{INK}" stroke-width="8" stroke-linecap="round"/>'
        + f'<path d="M-24,10 L-48,14 M-14,16 L-40,26" stroke="{LEG}" stroke-width="4.5" stroke-linecap="round"/>'
        + g("translate(-56,14) rotate(40) scale(.8)", sneaker())
        + g("translate(-48,26) rotate(34) scale(.85)", sneaker())
        + layer([('ellipse cx="-4" cy="18" rx="26" ry="9"', RED),
                 ('ellipse cx="34" cy="-12" rx="15" ry="15"', RED),
                 ('ellipse cx="0" cy="0" rx="40" ry="27"', SHIRT)])
        + f'<path d="M24,-20 C30,-10 30,4 24,14" fill="none" stroke="#333" stroke-width="2"/>'
    )
    far = g(f"translate(130,100) rotate({angle + 12}) scale({scale * .9})", wing(RED_DARK))
    near = g(f"translate(122,105) rotate({angle}) scale({scale})", wing(RED))
    return far + g("translate(112,124) rotate(-14)", body) + g("translate(172,92)", head()) + near


def perch_frame():
    """Standing pose: one wing on his hip, the other up in a '#1'."""
    legs = (f'<path d="M106,138 L104,154 M126,138 L128,154" stroke="{INK}" stroke-width="8" stroke-linecap="round"/>'
            f'<path d="M106,138 L104,154 M126,138 L128,154" stroke="{LEG}" stroke-width="4.5" stroke-linecap="round"/>')
    tail = layer([('path d="M96,134 L70,158 L80,160 L74,170 L86,166 L86,176 L104,146 Z"', RED)])
    raised = layer([
        ('path d="M102,102 C88,92 80,78 77,64 L65,66 C69,84 80,102 94,118 Z"', RED),
        ('circle cx="71" cy="58" r="10"', RED),
        ('path d="M66,54 L66,30 C66,23 76,23 76,30 L76,54 Z"', RED),
    ])
    hip = layer([('path d="M132,96 C154,98 162,118 148,134 C141,130 137,126 130,124 Z"', RED)])
    torso = layer([('ellipse cx="116" cy="140" rx="22" ry="8"', RED),
                   ('ellipse cx="116" cy="116" rx="32" ry="30"', SHIRT)])
    sleeves = (f'<path d="M92,100 C96,108 96,116 92,122 M140,100 C136,108 136,116 140,122" '
               f'fill="none" stroke="#333" stroke-width="2"/>')
    return (tail + legs + g("translate(104,158) scale(.9)", sneaker()) + g("translate(128,158)", sneaker())
            + raised + torso + sleeves + hip + g("translate(124,60)", head()))


def wa_badge():
    """'WA' shirt logo: big white W with a crimson A tucked under its right side."""
    font = "font-family=\"Georgia, 'Times New Roman', serif\" font-weight=\"700\""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 90" width="100" height="90">'
        f'<text x="42" y="66" text-anchor="middle" font-size="78" font-style="italic" {font} '
        f'fill="{WHITE}" stroke="{SHIRT}" stroke-width="2" paint-order="stroke">W</text>'
        f'<text x="68" y="84" text-anchor="middle" font-size="52" {font} '
        f'fill="{RED}" stroke="{WHITE}" stroke-width="5" paint-order="stroke">A</text>'
        '</svg>\n'
    )


def svg(body, name):
    head_comment = (f"<!-- Cartoon Eddy ({name}), drawn by tools/draw_eddy.py. 240x200 box, facing right, "
                    "feet at (118,172). The shirt's WA is added separately (assets/eddy/wa.svg). -->\n")
    return (head_comment + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="240" height="200">'
            + '<defs><filter id="sticker" x="-10%" y="-10%" width="120%" height="120%">'
            + '<feMorphology in="SourceAlpha" operator="dilate" radius="3.5" result="grow"/>'
            + f'<feFlood flood-color="{WHITE}"/><feComposite in2="grow" operator="in" result="edge"/>'
            + '<feMerge><feMergeNode in="edge"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
            + '<g filter="url(#sticker)">' + body + "</g></svg>\n")


if __name__ == "__main__":
    frames = {
        "fly-1": fly_frame(-18, 1.0),    # wings up
        "fly-2": fly_frame(-78, 0.82),   # wings back
        "fly-3": fly_frame(-148, 0.8),   # wings down
        "perch": perch_frame(),
    }
    for name, body in frames.items():
        (OUT / f"{name}.svg").write_text(svg(body, name))
    (OUT / "wa.svg").write_text(wa_badge())
    print("wrote", ", ".join(list(frames) + ["wa"]), "to", OUT)
