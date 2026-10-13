#!/usr/bin/env python3
"""Slice ImageGen originals and assemble the 48px-cell atlas. Requires Pillow."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageChops, ImageFilter

OUT = Path(__file__).resolve().parents[1] / 'assets' / 'generated'
SRC = OUT / 'originals'
FRAMES = OUT / 'frames'
HD = OUT / 'frames-hd'
ORDER = ['hero_d0', 'hero_d1', 'hero_u0', 'hero_u1', 'hero_s0', 'hero_s1',
         'rat0', 'rat1', 'sv0', 'sv1', 'monk0', 'monk1', 'ogre0', 'ogre1',
         'gems', 'gemm', 'geml', 'heart', 'slash', 'ring', 'puff0', 'puff1', 'ember']
ATTACKS = [f'hero_a{direction}{i}' for direction in 'dus' for i in range(4)]
ENEMY_ATTACKS = [f'{name}_a{i}' for name in ['rat', 'sv', 'monk', 'ogre'] for i in range(4)]


def source(name):
    return Image.open(SRC / f'{name}.png').convert('RGBA')


def trim(image):
    # Ignore faint generation halos for crop bounds, but preserve source alpha.
    bounds = image.getchannel('A').point(lambda a: 255 if a > 96 else 0).getbbox()
    assert bounds, 'Empty source sprite'
    return image.crop(bounds)


def fit(image, size, content=None, trim_input=True):
    if trim_input:
        image = trim(image)
    w, h = content or size
    ratio = min(w / image.width, h / image.height)
    image = image.resize((max(1, round(image.width * ratio)), max(1, round(image.height * ratio))), Image.Resampling.NEAREST)
    canvas = Image.new('RGBA', size)
    canvas.paste(image, ((size[0] - image.width) // 2, (size[1] - image.height) // 2))
    return canvas


def attack_cells(image):
    """Separate four silhouettes, including weapons extending beyond grid gutters."""
    width, height = image.size
    remaining = bytearray(image.getchannel('A').point(lambda a: 255 if a > 64 else 0).tobytes())
    components = []
    for start in range(len(remaining)):
        if not remaining[start]:
            continue
        remaining[start] = 0
        pending, pixels = [start], []
        while pending:
            p = pending.pop()
            pixels.append(p)
            x, y = p % width, p // width
            for q in (p - 1 if x else -1, p + 1 if x + 1 < width else -1,
                      p - width if y else -1, p + width if y + 1 < height else -1):
                if q >= 0 and remaining[q]:
                    remaining[q] = 0
                    pending.append(q)
        components.append(pixels)
    largest = sorted(components, key=len, reverse=True)[:4]
    assert len(largest) == 4 and min(map(len, largest)) > 1000
    centers = sorted(sum(p % width for p in group) / len(group) for group in largest)
    masks = [bytearray(width * height) for _ in range(4)]
    for group in components:
        center = sum(p % width for p in group) / len(group)
        slot = min(range(4), key=lambda i: abs(center - centers[i]))
        for p in group:
            masks[slot][p] = 255
    cells = []
    for data in masks:
        mask = Image.frombytes('L', image.size, bytes(data)).filter(ImageFilter.MaxFilter(3))
        cell = image.copy()
        cell.putalpha(ImageChops.multiply(image.getchannel('A'), mask))
        cells.append(trim(cell))
    return cells


def build(scale=1):
    suffix = '-hd' if scale > 1 else ''
    frames_out = OUT / ('frames-game-hd' if scale > 1 else 'frames')
    frames_out.mkdir(exist_ok=True)
    scaled = lambda size: tuple(v * scale for v in size)
    cell_size = 48 * scale
    HD.mkdir(exist_ok=True)
    frames = {}
    for name, keys, rows in [('hero', ORDER[:6], 3), ('rat', ORDER[6:8], 1),
                             ('sv', ORDER[8:10], 1), ('monk', ORDER[10:12], 1),
                             ('ogre', ORDER[12:14], 1)]:
        image = source(name + '_sheet')
        size = (26, 24) if name == 'ogre' else (16, 16)
        for i, key in enumerate(keys):
            x, y = i % 2, i // 2
            cell = image.crop((round(x * image.width / 2), round(y * image.height / rows),
                               round((x + 1) * image.width / 2), round((y + 1) * image.height / rows)))
            trim(cell).save(HD / f'{key}.png')
            frames[key] = fit(cell, scaled(size))
    # Use one crop/scale for both walk phases so changing leg silhouettes cannot
    # change the character's size. Vertical hero frames remain from the original.
    walk_pairs = [('hero_down_walk', ['hero_d0', 'hero_d1'], (16, 16)),
                  ('hero_side_walk', ['hero_s0', 'hero_s1'], (16, 16))] + [
        (name + '_walk', [name + '0', name + '1'], (26, 24) if name == 'ogre' else (16, 16))
        for name in ['rat', 'sv', 'monk', 'ogre']]
    for name, keys, size in walk_pairs:
        image = source(name)
        cells = [image.crop((i * image.width // 2, 0, (i + 1) * image.width // 2, image.height)) for i in range(2)]
        bounds = [cell.getchannel('A').point(lambda a: 255 if a > 96 else 0).getbbox() for cell in cells]
        common = (min(b[0] for b in bounds), min(b[1] for b in bounds),
                  max(b[2] for b in bounds), max(b[3] for b in bounds))
        for key, cell in zip(keys, cells):
            cell = cell.crop(common)
            cell.save(HD / f'{key}.png')
            frames[key] = fit(cell, scaled(size), trim_input=False)
    sizes = {'slash': (32, 32), 'ring': (48, 48), 'puff0': (20, 20), 'puff1': (26, 26), 'ember': (4, 4)}
    gems = {'gems': (6, 8), 'gemm': (9, 11), 'geml': (12, 14)}
    for key in ORDER[14:]:
        trim(source(key)).save(HD / f'{key}.png')
        frames[key] = fit(source(key), scaled(sizes.get(key, (16, 16))), scaled(gems[key]) if key in gems else None)
        if key == 'slash':
            # Preserve the empty left half: canvas center is the swing pivot.
            wave = source('slash-v2')
            wave.save(HD / 'slash.png')
            frames[key] = wave.resize(scaled((32, 32)), Image.Resampling.NEAREST)
    trim(source('axe')).save(HD / 'axe.png')
    fit(source('axe'), scaled((16, 16))).save(frames_out / 'axe.png')

    image = source('hero_attack_sheet')
    # Hand-verified gutters: the generated weapon arcs extend beyond equal cells.
    assert image.size == (1448, 1086), 'Recheck attack gutters for a new generation'
    y_edges = [0, 359, 710, 1086]
    for row, direction in enumerate('dus'):
        cells = attack_cells(image.crop((0, y_edges[row], image.width, y_edges[row + 1])))
        # Same scale for every phase; reserve eight pixels for the weapon swing.
        ratio = scale * min(16 / cells[3].height, 24 / max(c.width for c in cells), 20 / max(c.height for c in cells))
        for i, cell in enumerate(cells):
            cell.save(HD / f'hero_a{direction}{i}.png')
            cell = cell.resize((max(1, round(cell.width * ratio)), max(1, round(cell.height * ratio))), Image.Resampling.NEAREST)
            canvas = Image.new('RGBA', scaled((24, 24)))
            canvas.paste(cell, ((24 * scale - cell.width) // 2, 20 * scale - cell.height))
            frames[f'hero_a{direction}{i}'] = canvas

    for name in ['rat', 'sv', 'monk', 'ogre']:
        cells = attack_cells(source(name + '_attack'))
        w, h = (36, 32) if name == 'ogre' else (24, 24)
        walk = frames[name + '0']
        bounds = walk.getchannel('A').point(lambda a: 255 if a > 96 else 0).getbbox()
        body_w, body_h = bounds[2] - bounds[0], bounds[3] - bounds[1]
        baseline = (h * scale - walk.height) // 2 + bounds[3]
        ratio = min(body_w / cells[3].width, body_h / cells[3].height,
                    w * scale / max(c.width for c in cells), baseline / max(c.height for c in cells))
        for i, cell in enumerate(cells):
            key = f'{name}_a{i}'
            cell.save(HD / f'{key}.png')
            cell = cell.resize((max(1, round(cell.width * ratio)), max(1, round(cell.height * ratio))), Image.Resampling.NEAREST)
            canvas = Image.new('RGBA', scaled((w, h)))
            canvas.paste(cell, ((w * scale - cell.width) // 2, baseline - cell.height))
            frames[key] = canvas

    order = ORDER + ATTACKS + ENEMY_ATTACKS
    rows = (len(order) + 7) // 8
    atlas = Image.new('RGBA', scaled((384, rows * 48)))
    metadata = {'columns': 8, 'cell': cell_size, 'resolution_scale': scale, 'frames': {},
                'note': 'Slot 18 is slash. The original-request axe PNG is also supplied separately. frames-hd contains native-resolution crops, not enlarged game sprites.'}
    for i, key in enumerate(order):
        frame = frames[key]
        assert frame.getchannel('A').getbbox(), key
        frame.save(frames_out / f'{key}.png')
        x, y = i % 8 * cell_size, i // 8 * cell_size
        atlas.paste(frame, (x, y))
        metadata['frames'][key] = {'x': x, 'y': y, 'w': frame.width, 'h': frame.height}
    atlas.save(OUT / f'spritesheet{suffix}.png')
    source('ground').resize((64, 64), Image.Resampling.NEAREST).save(OUT / 'ground.png')
    (OUT / f'atlas{suffix}.json').write_text(json.dumps(metadata, indent=2) + '\n')

    preview_cell = 192 if scale > 1 else 120
    preview_row = 240 if scale > 1 else 180
    preview = Image.new('RGB', (8 * preview_cell, rows * preview_row), '#26232b')
    draw = ImageDraw.Draw(preview)
    for i, key in enumerate(order):
        frame = frames[key]
        frame = frame.resize((frame.width * (1 if scale > 1 else 3), frame.height * (1 if scale > 1 else 3)), Image.Resampling.NEAREST)
        x, y = i % 8 * preview_cell, i // 8 * preview_row
        preview.paste(frame, (x + (preview_cell - frame.width) // 2, y + 22), frame)
        draw.text((x + 4, y + preview_row - 20), key, fill='white')
    preview.save(OUT / f'preview{suffix}.png')
    if scale == 4:
        animation = []
        for phase in range(2):
            canvas = Image.new('RGB', (800, 160), '#26232b')
            labels = ImageDraw.Draw(canvas)
            for i, prefix in enumerate(['hero_s', 'rat', 'sv', 'monk', 'ogre']):
                frame = frames[f'{prefix}{phase}']
                canvas.paste(frame, (i * 160 + (160 - frame.width) // 2, 120 - frame.height), frame)
                labels.text((i * 160 + 40, 140), prefix, fill='white')
            animation.append(canvas)
        animation[0].save(OUT / 'walk-preview.gif', save_all=True, append_images=animation[1:], duration=145, loop=0)
        attacks = []
        for phase in range(4):
            canvas = Image.new('RGB', (800, 180), '#26232b')
            labels = ImageDraw.Draw(canvas)
            for i, prefix in enumerate(['rat', 'sv', 'monk', 'ogre']):
                frame = frames[f'{prefix}_a{phase}']
                canvas.paste(frame, (i * 200 + (200 - frame.width) // 2, 145 - frame.height), frame)
                labels.text((i * 200 + 65, 160), prefix, fill='white')
            attacks.append(canvas)
        attacks[0].save(OUT / 'enemy-attacks-preview.gif', save_all=True, append_images=attacks[1:], duration=90, loop=0)
    assert len(frames) == 51
    wave_alpha = frames['slash'].getchannel('A').point(lambda a: 255 if a > 96 else 0)
    assert not wave_alpha.crop((0, 0, 16 * scale, 32 * scale)).getbbox(), 'Slash must leave the hero/pivot side empty'
    assert wave_alpha.crop((24 * scale, 8 * scale, 32 * scale, 24 * scale)).getbbox(), 'Slash leading edge must face +X'
    for i, key in enumerate(order):
        x, y = i % 8 * cell_size, i // 8 * cell_size
        f = frames[key]
        assert atlas.crop((x, y, x + f.width, y + f.height)).tobytes() == f.tobytes(), key
    assert len(list(HD.glob('*.png'))) == 52
    print(f'Validated {scale}x: {len(frames)} atlas entries, 52 native-resolution crops, extra axe, ground tile and previews')


if __name__ == '__main__':
    build()
    build(4)
