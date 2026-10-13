#!/usr/bin/env python3
"""
build_alt_sheet.py — assemble assets/spritesheet.png from the free packs
downloaded into assets/downloads/ (see ATTRIBUTION.md for authors/licenses).

The output sheet follows the layout the game's override loader expects:
8 columns of 32x32 cells, frames in the fixed order below, each frame drawn
into the top-left corner of its cell at exactly the frame's canonical size
(16x16, or 26x24 for the ogre). Frames not present in the packs are left
empty — the game keeps its procedural pixel-art for those.

Usage:  python3 tools/build_alt_sheet.py
"""
from PIL import Image
import os

ROOT = os.path.join(os.path.dirname(__file__), "..")
DL = os.path.join(ROOT, "assets", "downloads")
OUT = os.path.join(ROOT, "assets", "spritesheet.png")

# order must match SHEET_FRAME_ORDER in src/main.ts
FRAMES = [
    "hero_d0", "hero_d1", "hero_u0", "hero_u1", "hero_s0", "hero_s1",
    "rat0", "rat1", "sv0", "sv1", "monk0", "monk1", "ogre0", "ogre1",
    "gems", "gemm", "geml", "heart", "slash", "ring", "puff0", "puff1", "ember",
]
SIZES = {
    "ogre0": (26, 24), "ogre1": (26, 24),
    "slash": (32, 32), "ring": (48, 48), "puff0": (20, 20), "puff1": (26, 26),
}
COLS = 8
CELL = 32


def load(name):
    return Image.open(os.path.join(DL, name)).convert("RGBA")


def tint(img, fr, fg, fb):
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (int(r * fr), int(g * fg), int(b * fb), a)
    return img


def fit(img, w, h):
    """Nearest-neighbour scale to exactly w x h."""
    return img.resize((w, h), Image.NEAREST)


def place(img, w, h, dx=0, dy=0):
    """Trim to alpha bbox, scale to w x h, return cell canvas."""
    bbox = img.getchannel("A").getbbox()
    src = img.crop(bbox) if bbox else img
    scaled = fit(src, w, h)
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    canvas.paste(scaled, (dx, dy))
    return canvas


def shift(img, dx=0, dy=0):
    canvas = Image.new("RGBA", img.size, (0, 0, 0, 0))
    canvas.paste(img, (dx, dy))
    return canvas


def mirror(img):
    return img.transpose(Image.FLIP_LEFT_RIGHT)


def build():
    dwarf = load("cinder_dwarf.png")
    ratmen = load("rat-men_final_0.png")
    ratking = load("ratking_0.png")

    def dwarf_cell(gx, gy):
        return dwarf.crop((gx * 32, gy * 32, (gx + 1) * 32, (gy + 1) * 32))

    def ratman(idx):
        return ratmen.crop((idx * 50, 0, (idx + 1) * 50, 50))

    # hero: front (0,0), side facing left (1,0) -> mirrored to face right, back (0,1)
    hero_d = place(dwarf_cell(0, 0), 16, 16)
    hero_s = mirror(place(dwarf_cell(1, 0), 16, 16))
    hero_u = place(dwarf_cell(0, 1), 16, 16)
    # second walk frames: nudge down one pixel (cheap 2-frame bob)
    frames = {
        "hero_d0": hero_d, "hero_d1": shift(hero_d, 0, 1),
        "hero_u0": hero_u, "hero_u1": shift(hero_u, 0, 1),
        "hero_s0": hero_s, "hero_s1": shift(hero_s, 0, 1),
    }

    rat = place(ratman(0), 16, 16)
    frames["rat0"] = rat
    frames["rat1"] = shift(rat, 1, 0)

    sv = tint(place(ratman(3), 16, 16), 0.72, 0.78, 1.05)  # cold steel tint
    frames["sv0"] = sv
    frames["sv1"] = shift(sv, 1, 0)

    monk = tint(place(ratman(1), 16, 16), 0.55, 1.0, 0.55)  # plague green tint
    frames["monk0"] = monk
    frames["monk1"] = shift(monk, 1, 0)

    ogre = place(ratking, 26, 24)
    frames["ogre0"] = ogre
    frames["ogre1"] = shift(ogre, 1, 0)

    rows = (len(FRAMES) + COLS - 1) // COLS
    sheet = Image.new("RGBA", (COLS * CELL, rows * CELL), (0, 0, 0, 0))
    for i, key in enumerate(FRAMES):
        if key not in frames:
            continue  # leave empty -> procedural art stays
        cx = (i % COLS) * CELL
        cy = (i // COLS) * CELL
        w, h = SIZES.get(key, (16, 16))
        img = frames[key]
        if img.size != (w, h):
            img = fit(img, w, h)
        sheet.paste(img, (cx, cy))

    sheet.save(OUT)
    print(f"wrote {OUT} ({sheet.size[0]}x{sheet.size[1]}) with {len(frames)} frames")


if __name__ == "__main__":
    build()
