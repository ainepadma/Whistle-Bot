"""Draw a true pixel-art Qilian star board kite from geometric primitives.

Three supplied reference renders inform this design. The model is one joined
three-tier board with seven red-rimmed circular paintings arranged two, three,
two. Blue geometric panels, ivory painted fields, connector paintings, rows of
small whistles, and two red bass whistles match the frontal references.
There is deliberately no tail and no anthropomorphic anatomy or behaviour.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


LOGICAL_SIZE = 96
OUTPUT_SIZE = 192

COLORS = {
    'outline': '#20232d',
    'bamboo_dark': '#6f4a25',
    'bamboo': '#c49a4a',
    'indigo': '#263f66',
    'indigo_light': '#416b87',
    'blue': '#0756aa',
    'blue_light': '#168bd0',
    'paper': '#efe4c7',
    'paper_light': '#fff7df',
    'vermilion': '#b33a36',
    'red_dark': '#73262a',
    'rose': '#dc777d',
    'teal': '#397b77',
    'green': '#368b4d',
    'orange': '#df772c',
    'gold': '#d6ab45',
    'ink': '#34333d',
}


def polygon(draw: ImageDraw.ImageDraw, points, fill, outline=None, width=1):
    draw.polygon(points, fill=fill)
    if outline:
        draw.line(points + [points[0]], fill=outline, width=width, joint='curve')


def line(draw: ImageDraw.ImageDraw, points, fill, width=1):
    draw.line(points, fill=fill, width=width, joint='curve')


def octagon(cx: int, cy: int, radius: int, cut: int):
    return [
        (cx - radius + cut, cy - radius),
        (cx + radius - cut, cy - radius),
        (cx + radius, cy - radius + cut),
        (cx + radius, cy + radius - cut),
        (cx + radius - cut, cy + radius),
        (cx - radius + cut, cy + radius),
        (cx - radius, cy + radius - cut),
        (cx - radius, cy - radius + cut),
    ]


def six_corner(cx: int, cy: int, half_width: int, half_height: int, point: int):
    """Traditional rectangle/square board silhouette with six protruding corners."""
    return [
        (cx - half_width, cy - half_height),
        (cx + half_width, cy - half_height),
        (cx + half_width + point, cy),
        (cx + half_width, cy + half_height),
        (cx - half_width, cy + half_height),
        (cx - half_width - point, cy),
    ]


def draw_medallion(draw: ImageDraw.ImageDraw, cx: int, cy: int, variant: int):
    """A red-rimmed miniature folk painting with deliberate pixel clusters."""
    draw.ellipse((cx - 6, cy - 6, cx + 6, cy + 6), fill=COLORS['red_dark'], outline=COLORS['outline'])
    draw.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), fill=COLORS['vermilion'], outline=COLORS['rose'])
    draw.ellipse((cx - 4, cy - 4, cx + 4, cy + 4), fill=COLORS['blue_light'], outline=COLORS['paper_light'])
    palettes = [
        (COLORS['green'], COLORS['orange'], COLORS['gold']),
        (COLORS['teal'], COLORS['rose'], COLORS['green']),
        (COLORS['orange'], COLORS['gold'], COLORS['green']),
    ]
    first, second, third = palettes[variant % len(palettes)]
    draw.rectangle((cx - 3, cy - 1, cx, cy + 2), fill=first)
    draw.rectangle((cx, cy - 3, cx + 2, cy), fill=second)
    draw.rectangle((cx + 1, cy + 1, cx + 3, cy + 3), fill=third)
    draw.point((cx - 2, cy - 3), fill=COLORS['paper_light'])
    draw.point((cx + 3, cy - 1), fill=COLORS['red_dark'])
    draw.point((cx - 2, cy + 3), fill=COLORS['gold'])


def draw_circle_panel(draw: ImageDraw.ImageDraw, cx: int, cy: int, variant: int):
    field = [
        (cx - 5, cy - 11), (cx + 5, cy - 11),
        (cx + 9, cy - 6), (cx + 9, cy + 6),
        (cx + 5, cy + 11), (cx - 5, cy + 11),
        (cx - 9, cy + 6), (cx - 9, cy - 6),
    ]
    polygon(draw, field, COLORS['paper_light'], COLORS['ink'])
    polygon(draw, [(cx - 9, cy - 6), (cx - 5, cy - 11), (cx - 2, cy - 7)], COLORS['blue'])
    polygon(draw, [(cx + 9, cy - 6), (cx + 5, cy - 11), (cx + 2, cy - 7)], COLORS['blue'])
    polygon(draw, [(cx - 9, cy + 6), (cx - 5, cy + 11), (cx - 2, cy + 7)], COLORS['blue'])
    polygon(draw, [(cx + 9, cy + 6), (cx + 5, cy + 11), (cx + 2, cy + 7)], COLORS['blue'])
    draw_medallion(draw, cx, cy, variant)
    draw.rectangle((cx - 1, cy + 8, cx + 1, cy + 9), fill=COLORS['gold'])


def draw_flower_tile(draw: ImageDraw.ImageDraw, cx: int, cy: int, flip: bool = False):
    polygon(draw, [(cx, cy - 5), (cx + 4, cy), (cx, cy + 5), (cx - 4, cy)], COLORS['paper_light'], COLORS['indigo'])
    direction = -1 if flip else 1
    draw.rectangle((cx - 1, cy - 1, cx + 1, cy + 1), fill=COLORS['rose'])
    draw.point((cx + 2 * direction, cy - 2), fill=COLORS['green'])
    draw.point((cx - 2 * direction, cy + 2), fill=COLORS['orange'])
    draw.point((cx, cy - 3), fill=COLORS['gold'])


def draw_group(draw: ImageDraw.ImageDraw, left: int, top: int, right: int, bottom: int, point: int):
    middle = (top + bottom) // 2
    shape = [
        (left + point, top), (right - point, top),
        (right - point, top + 5), (right, middle), (right - point, bottom - 5),
        (right - point, bottom), (left + point, bottom),
        (left + point, bottom - 5), (left, middle), (left + point, top + 5),
    ]
    polygon(draw, shape, COLORS['outline'])
    inner = [(x + (1 if x < 48 else -1), y + (1 if y < middle else -1)) for x, y in shape]
    polygon(draw, inner, COLORS['blue'], COLORS['bamboo'], 1)
    line(draw, [(left + point, top), (right - point, top)], COLORS['blue_light'], 1)


def draw_petal(draw: ImageDraw.ImageDraw, cx: int, cy: int):
    draw.point((cx, cy), fill=COLORS['paper_light'])
    draw.point((cx - 1, cy), fill=COLORS['rose'])
    draw.point((cx + 1, cy), fill=COLORS['rose'])
    draw.point((cx, cy - 1), fill=COLORS['paper_light'])


def draw_whistle(draw: ImageDraw.ImageDraw, cx: int, cy: int):
    """A red-lacquered board whistle with a visible dark mouth slot."""
    draw.rectangle((cx - 5, cy - 2, cx + 5, cy + 3), fill=COLORS['red_dark'], outline=COLORS['outline'])
    draw.ellipse((cx - 5, cy - 5, cx + 5, cy + 3), fill=COLORS['vermilion'], outline=COLORS['outline'])
    draw.line((cx - 3, cy - 2, cx + 3, cy - 2), fill=COLORS['ink'], width=2)
    draw.rectangle((cx - 1, cy, cx + 1, cy + 2), fill=COLORS['ink'])
    draw.line((cx - 3, cy - 4, cx + 2, cy - 4), fill=COLORS['gold'])


def draw_board() -> Image.Image:
    image = Image.new('RGBA', (LOGICAL_SIZE, LOGICAL_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # One joined silhouette: top pair, middle trio, bottom pair.
    draw_group(draw, 21, 7, 75, 36, 10)
    draw_group(draw, 4, 35, 92, 63, 10)
    draw_group(draw, 21, 62, 75, 90, 10)

    # Pink corner blossoms on the blue wing fields.
    for x, y in ((24, 21), (72, 21), (8, 49), (88, 49), (24, 76), (72, 76)):
        draw_petal(draw, x, y)

    panels = [(38, 22), (58, 22), (25, 49), (48, 49), (71, 49), (38, 76), (58, 76)]
    for index, (cx, cy) in enumerate(panels):
        draw_circle_panel(draw, cx, cy, index)

    # Painted connector panels visible between the seven circular fields.
    for index, (cx, cy) in enumerate(((48, 12), (48, 32), (36, 40), (36, 58), (60, 40), (60, 58), (48, 68), (48, 86))):
        draw_flower_tile(draw, cx, cy, bool(index % 2))

    # Bamboo rails and gold bindings at the main joints.
    for x1, y1, x2, y2 in ((31, 7, 65, 7), (14, 35, 82, 35), (14, 63, 82, 63), (31, 90, 65, 90)):
        line(draw, [(x1, y1), (x2, y2)], COLORS['bamboo'], 1)
        for x in (x1, x2):
            draw.rectangle((x - 1, y1 - 1, x + 1, y1 + 1), fill=COLORS['gold'], outline=COLORS['outline'])

    # A row of small high-tone whistles and two large red bass whistles.
    for x in (33, 39, 45, 51, 57, 63):
        draw.ellipse((x - 1, 36, x + 1, 38), fill=COLORS['gold'], outline=COLORS['outline'])
    draw_whistle(draw, 39, 64)
    draw_whistle(draw, 57, 64)
    return image


def pose(base: Image.Image, angle: float = 0, dx: int = 0, dy: int = 0) -> Image.Image:
    # Rotate on the low-resolution grid so every frame remains deliberate pixel art.
    frame = base.rotate(angle, Image.Resampling.NEAREST, expand=False)
    frame = ImageChops.offset(frame, dx, dy)
    if dx > 0:
        frame.paste((0, 0, 0, 0), (0, 0, dx, LOGICAL_SIZE))
    elif dx < 0:
        frame.paste((0, 0, 0, 0), (LOGICAL_SIZE + dx, 0, LOGICAL_SIZE, LOGICAL_SIZE))
    if dy > 0:
        frame.paste((0, 0, 0, 0), (0, 0, LOGICAL_SIZE, dy))
    elif dy < 0:
        frame.paste((0, 0, 0, 0), (0, LOGICAL_SIZE + dy, LOGICAL_SIZE, LOGICAL_SIZE))
    return frame.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.Resampling.NEAREST)


def save_gif(path: Path, frames: list[Image.Image]):
    indexed_frames = []
    for frame in frames:
        alpha = frame.getchannel('A')
        indexed = frame.convert('RGB').quantize(colors=254, method=Image.Quantize.MEDIANCUT)
        indexed.paste(255, mask=alpha.point(lambda value: 255 if value < 128 else 0))
        indexed.info['transparency'] = 255
        indexed_frames.append(indexed)
    indexed_frames[0].save(
        path,
        save_all=True,
        append_images=indexed_frames[1:],
        duration=125,
        loop=0,
        disposal=2,
        transparency=255,
        optimize=False,
    )


def build(output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    base = draw_board()
    animations = {
        'idle': [(0, 0, 0), (-1, 0, -1), (0, 0, 0), (1, 0, 1)],
        'walk': [(-2, -1, 0), (-1, 0, -1), (1, 1, 0), (2, 0, 1)],
        'walk_fast': [(-2, -1, -1), (2, 1, 1), (-1, 0, -1), (1, 0, 1)],
        'run': [(-3, -1, 0), (2, 1, -1), (-2, 0, 1), (3, 1, 0)],
        'swipe': [(0, 0, 0), (-3, -1, 0), (3, 1, 0), (0, 0, 0)],
        'with_ball': [(0, 0, 0), (-1, 0, -1), (0, 0, 0), (1, 0, 1)],
    }
    for name, specs in animations.items():
        save_gif(output_dir / f'red_{name}_8fps.gif', [pose(base, angle, dx, dy) for angle, dx, dy in specs])

    base.resize((32, 32), Image.Resampling.NEAREST).save(output_dir / 'icon.png')
    pose(base).save(output_dir / 'preview.png')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    build(args.out)


if __name__ == '__main__':
    main()
